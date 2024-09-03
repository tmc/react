(function() {
    const HOOK_NAME = '__MINIMAL_REACT_DEVTOOLS_GLOBAL_HOOK__';

    function debugLog(...args) {
        console.log('[Minimal React DevTools]', ...args);
    }

    function sendMessageToContentScript(type, data) {
        debugLog('Sending message to content script:', type, data);
        try {
            const serializedData = JSON.parse(JSON.stringify(data || null));
            window.postMessage({
                source: 'react-minimal-devtools-extension',
                payload: { type, data: serializedData }
            }, '*');
        } catch (error) {
            console.error('Failed to serialize message data:', error);
            // Send a simplified version of the message
            window.postMessage({
                source: 'react-minimal-devtools-extension',
                payload: { type, data: { error: 'Failed to serialize data' } }
            }, '*');
        }
    }

    function getReactVersion() {
        if (window.React && window.React.version) {
            return window.React.version;
        }
        return 'Unknown';
    }

    function detectReact() {
        debugLog('Starting React detection');
        const indicators = [
            () => window.React,
            () => window.ReactDOM,
            () => window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
            () => window._REACT_DEVTOOLS_GLOBAL_HOOK,
            () => document.querySelector('[data-reactroot]'),
            () => document.querySelector('[data-reactid]'),
            () => Array.from(document.querySelectorAll('*')).some(el =>
                Object.keys(el).some(key => key.startsWith('__reactInternalInstance$') || key.startsWith('__reactFiber$'))
            ),
            () => window.document._reactRootContainer,
            () => window.__REACT_DEVTOOLS_ATTACH__,
        ];

        for (let i = 0; i < indicators.length; i++) {
            try {
                if (indicators[i]()) {
                    debugLog(`React detected using method ${i + 1}`);
                    sendMessageToContentScript('reactDetected', { method: i + 1 });
                    return true;
                }
            } catch (e) {
                debugLog(`Error in React detection method ${i + 1}:`, e);
            }
        }

        debugLog('React not detected');
        sendMessageToContentScript('reactNotDetected');
        return false;
    }

    function serializeFiber(fiber, depth = 0) {
        if (!fiber || depth > 50) return null;

        const serialized = {
            tag: fiber.tag,
            key: fiber.key,
            elementType: serializeValue(fiber.elementType),
            type: serializeValue(fiber.type),
            stateNode: fiber.stateNode ? serializeValue({
                nodeName: fiber.stateNode.nodeName,
                nodeType: fiber.stateNode.nodeType,
                id: fiber.stateNode.id,
                className: fiber.stateNode.className,
            }) : null,
            index: fiber.index,
            mode: fiber.mode,
        };

        try {
            serialized.props = serializeValue(fiber.memoizedProps);
        } catch (error) {
            console.warn('Failed to serialize props:', error);
            serialized.props = '[Failed to serialize]';
        }

        try {
            serialized.state = serializeValue(fiber.memoizedState);
        } catch (error) {
            console.warn('Failed to serialize state:', error);
            serialized.state = '[Failed to serialize]';
        }

        serialized.child = serializeFiber(fiber.child, depth + 1);
        serialized.sibling = serializeFiber(fiber.sibling, depth);

        if (fiber.return) {
            serialized.return = { tag: fiber.return.tag, key: fiber.return.key };
        }

        return serialized;
    }

    function serializeValue(value) {
        if (value === null || value === undefined) {
            return value;
        }
        const type = typeof value;
        if (type === 'function') {
            return `[Function ${value.name || 'anonymous'}]`;
        }
        if (type === 'object') {
            if (Array.isArray(value)) {
                return value.map(serializeValue);
            }
            if (value instanceof Date) {
                return value.toISOString();
            }
            if (value instanceof RegExp) {
                return value.toString();
            }
            if (value instanceof SVGAnimatedString) {
                return value.baseVal;
            }
            if (value.constructor && value.constructor.name) {
                return `[${value.constructor.name}]`;
            }
            const serialized = {};
            for (let key in value) {
                if (value.hasOwnProperty(key)) {
                    try {
                        const serializedValue = serializeValue(value[key]);
                        if (serializedValue !== undefined) {
                            serialized[key] = serializedValue;
                        }
                    } catch (error) {
                        console.warn(`Failed to serialize property ${key}:`, error);
                    }
                }
            }
            return serialized;
        }
        if (type === 'symbol') {
            return value.toString();
        }
        return value;
    }

    function injectHook() {
        if (window[HOOK_NAME]) {
            debugLog('Hook already exists, not re-initializing');
            return;
        }

        debugLog('Injecting hook');

        try {
            const hook = {
                supportsFiber: true,
                inject: function(renderer) {
                    debugLog('Renderer injected:', renderer);
                    this.emit('renderer', renderer);
                },
                  onCommitFiberRoot: function(rendererID, root, priorityLevel) {
                      debugLog('onCommitFiberRoot called:', rendererID, root);
                      const serializedRoot = serializeFiber(root.current);
                      debugLog('Serialized root:', serializedRoot);
                      sendMessageToContentScript('commitFiberRoot', { rendererID, root: serializedRoot, priorityLevel });
                  },
                emit: function(event, data) {
                    debugLog('Emitting event:', event, data);
                    sendMessageToContentScript(event, data);
                }
            };

            Object.defineProperty(window, HOOK_NAME, {
                enumerable: false,
                get: function() { return hook; }
            });

            const existingHook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__ || window._REACT_DEVTOOLS_GLOBAL_HOOK;
            if (existingHook) {
                debugLog('Existing DevTools hook found, modifying methods');
                ['inject', 'onCommitFiberRoot'].forEach(method => {
                    if (typeof existingHook[method] === 'function') {
                        const original = existingHook[method];
                        existingHook[method] = function(...args) {
                            original.apply(existingHook, args);
                            hook[method].apply(hook, args);
                        };
                    }
                });
            }

            debugLog('Hook injected successfully');
            sendMessageToContentScript('hookInjected');
        } catch (error) {
            console.error('Error injecting hook:', error);
        }
    }

    function attemptInjection() {
        if (detectReact()) {
            debugLog('React detected, injecting hook');
            injectHook();
            return true;
        }
        debugLog('React not detected, injection attempt failed');
        return false;
    }

    function checkForReactRoot() {
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__ && window.__REACT_DEVTOOLS_GLOBAL_HOOK__._renderers) {
            const renderers = Object.values(window.__REACT_DEVTOOLS_GLOBAL_HOOK__._renderers);
            for (const renderer of renderers) {
                if (renderer.findFiberByHostInstance) {
                    const roots = renderer.getMountedRootInstances();
                    debugLog('Existing React roots:', roots);
                    if (roots.length > 0) {
                        const serializedRoots = roots.map(root => {
                            const fiber = renderer.findFiberByHostInstance(root);
                            return serializeFiber(fiber);
                        });
                        sendMessageToContentScript('existingRootsFound', { roots: serializedRoots });
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function findReactRoots() {
        const roots = [];
        const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT);
        let currentNode;

        while (currentNode = walker.nextNode()) {
            const keys = Object.keys(currentNode);
            const reactKey = keys.find(key => key.startsWith('__reactContainer$') || key.startsWith('__reactFiber$'));
            if (reactKey) {
                roots.push({
                    tagName: currentNode.tagName,
                    id: currentNode.id,
                    className: currentNode.className,
                });
            }
        }

        return roots;
    }

    // Main execution
    if (attemptInjection()) {
        if (!checkForReactRoot()) {
            debugLog('No roots found using primary method, trying fallback');
            const fallbackRoots = findReactRoots();
            if (fallbackRoots.length > 0) {
                debugLog('React roots found using fallback method:', fallbackRoots);
                sendMessageToContentScript('existingRootsFound', { roots: fallbackRoots });
            } else {
                debugLog('No roots found immediately, setting up MutationObserver');
                const observer = new MutationObserver(() => {
                    if (checkForReactRoot() || findReactRoots().length > 0) {
                        debugLog('React root found by MutationObserver, disconnecting observer');
                        observer.disconnect();
                    }
                });
                observer.observe(document.documentElement, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['data-reactroot', 'data-reactid']
                });

                // Also check a few times after short delays
                [1000, 2000, 5000].forEach(delay => {
                    setTimeout(() => {
                        if (checkForReactRoot() || findReactRoots().length > 0) {
                            debugLog(`React root found after ${delay}ms delay`);
                            observer.disconnect();
                        }
                    }, delay);
                });
            }
        }
    } else {
        debugLog('React not detected initially, setting up MutationObserver for detection');
        const observer = new MutationObserver(() => {
            if (attemptInjection()) {
                debugLog('React detected by MutationObserver, disconnecting observer');
                observer.disconnect();
                checkForReactRoot();
            }
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-reactroot', 'data-reactid']
        });

        // Also attempt injection after short delays
        [1000, 2000, 5000].forEach(delay => {
            setTimeout(() => {
                if (attemptInjection()) {
                    debugLog(`React detected after ${delay}ms delay`);
                    observer.disconnect();
                    checkForReactRoot();
                }
            }, delay);
        });
    }

    debugLog('Inject script finished running');
    debugLog('Detected React version:', getReactVersion());
    sendMessageToContentScript('injectScriptLoaded');
})();
