(function() {
    const HOOK_NAME = '__MINIMAL_REACT_DEVTOOLS_GLOBAL_HOOK__';

    function debugLog(...args) {
        console.log('[Minimal React DevTools]', ...args);
    }

    function getReactVersion() {
        if (window.React && window.React.version) {
            return window.React.version;
        }
        return 'Unknown';
    }

    function detectReact() {
        const indicators = [
            () => window.React,
            () => window.ReactDOM,
            () => window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
            () => window._REACT_DEVTOOLS_GLOBAL_HOOK,
            () => document.querySelector('[data-reactroot]'),
            () => document.querySelector('[data-reactid]'),
            () => Array.from(document.querySelectorAll('*')).some(el => Object.keys(el).some(key => key.startsWith('__reactInternalInstance$') || key.startsWith('__reactFiber$'))),
            () => window.document._reactRootContainer,
            () => window.__REACT_DEVTOOLS_ATTACH__,
        ];

        let reactDetected = false;
        for (let i = 0; i < indicators.length; i++) {
            try {
                if (indicators[i]()) {
                    debugLog(`React detected using method ${i + 1}`);
                    reactDetected = true;
                }
            } catch (e) {
                debugLog(`Error in React detection method ${i + 1}:`, e);
            }
        }
        if (!reactDetected) { 
          debugLog('React not detected');
        } else {
          const roots = findReactRoots();
          window.postMessage({
              source: 'react-minimal-devtools-extension',
              payload: { type: 'reactRootsFound', data: roots.length }
          }, '*');
        }
        return reactDetected;
    }

    function findReactRoots() {
        const roots = [];
        const rootElements = document.querySelectorAll('[data-reactroot]');
        if (rootElements.length > 0) {
            roots.push(...Array.from(rootElements));
        }

        // Fallback: look for elements with __reactInternalInstance$ or __reactFiber$ properties
        const allElements = document.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            if (Object.keys(el).some(key => key.startsWith('__reactInternalInstance$') || key.startsWith('__reactFiber$'))) {
                roots.push(el);
            }
            if (roots.length >= 10) break; // Limit to first 10 to reduce noise
        }

        debugLog('Found React roots:', roots.length);
        return roots;
    }

    function injectHook() {
        if (window[HOOK_NAME]) {
            debugLog('Hook already exists, not re-initializing');
            return;
        }

        debugLog('Injecting hook');

        const hook = {
            supportsFiber: true,
            inject: function(renderer) {
                debugLog('Renderer injected:', renderer);
                this.emit('renderer', renderer);
            },
            onCommitFiberRoot: function(rendererID, root, priorityLevel) {
                debugLog('onCommitFiberRoot called:', rendererID, root);
                const serializedRoot = this.serializeFiber(root.current);
                this.emit('commitFiberRoot', { rendererID, root: serializedRoot, priorityLevel });
            },
            serializeFiber: function(fiber) {
                if (!fiber) return null;
                return {
                    tag: fiber.tag,
                    key: fiber.key,
                    elementType: String(fiber.elementType),
                    type: String(fiber.type),
                    stateNode: fiber.stateNode ? String(fiber.stateNode.nodeName) : null,
                    child: this.serializeFiber(fiber.child),
                    sibling: this.serializeFiber(fiber.sibling),
                };
            },
            emit: function(event, data) {
                debugLog('Emitting event:', event, data);
                window.postMessage({
                    source: 'react-minimal-devtools-extension',
                    payload: { type: event, data: data }
                }, '*');
            }
        };

        Object.defineProperty(window, HOOK_NAME, {
            enumerable: false,
            get: function() { return hook; }
        });

        // Attempt to inject into existing DevTools hook
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

            // Force a commit if possible
            if (existingHook.getFiberRoots && existingHook.onCommitFiberRoot) {
                existingHook.getFiberRoots(1).forEach(root => {
                    existingHook.onCommitFiberRoot(1, root);
                });
            }
        }

        debugLog('Hook injected successfully');
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

    // Attempt immediate injection
    if (!attemptInjection()) {
        debugLog('React not detected initially, setting up MutationObserver');
        const observer = new MutationObserver(() => {
            if (attemptInjection()) {
                debugLog('React detected by MutationObserver, disconnecting observer');
                observer.disconnect();
            }
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-reactroot', 'data-reactid']
        });

        // Also try again after short delays
        [1000, 2000, 5000, 10000].forEach(delay => {
            setTimeout(() => {
                if (attemptInjection()) {
                    debugLog(`React detected after ${delay}ms delay`);
                }
            }, delay);
        });
    }

    // Check for React roots periodically
    setInterval(() => {
        const roots = findReactRoots();
        if (roots.length > 0) {
            window.postMessage({
                source: 'react-minimal-devtools-extension',
                payload: { type: 'reactRootsFound', data: roots.length }
            }, '*');
        }
    }, 5000);  // Check every 5 seconds

    // Send a message to verify inject.js is running
    window.postMessage({
        source: 'react-minimal-devtools-extension',
        payload: { type: 'inject-script-loaded' }
    }, '*');

    debugLog('Inject script finished running');
    debugLog('Detected React version:', getReactVersion());
})();
