console.log('Minimal React DevTools Plus: Inject script loaded');

(function() {
    const HOOK_NAME = '__MINIMAL_REACT_DEVTOOLS_GLOBAL_HOOK__';
    
    function detectReact() {
        const detected = !!(
            window.React ||
            window.__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
            window._REACT_DEVTOOLS_GLOBAL_HOOK ||
            document.querySelector('[data-reactroot], [data-reactid]') ||
            window.__NUXT__ || // Check for Nuxt.js, which uses React
            window.next // Check for Next.js, which uses React
        );
        console.log('React detection result:', detected);
        return detected;
    }

    function findReactRoot() {
        // Look for common React root attributes
        const reactRoots = document.querySelectorAll('[data-reactroot], [data-reactid], [data-react-checksum]');
        if (reactRoots.length > 0) {
            console.log('Found React-like roots:', reactRoots);
            return Array.from(reactRoots);
        }
        
        // Look for elements with __reactInternalInstance$ or __reactFiber$ properties
        const allElements = document.getElementsByTagName('*');
        const reactElements = Array.from(allElements).filter(el => {
            return Object.keys(el).some(key => key.startsWith('__reactInternalInstance$') || key.startsWith('__reactFiber$'));
        });
        
        if (reactElements.length > 0) {
            console.log('Found React-like elements:', reactElements);
            return reactElements;
        }
        
        return null;
    }

    function injectHook() {
        if (window[HOOK_NAME]) {
            console.log('Hook already exists, not re-initializing');
            return;
        }

        const hook = {
            supportsFiber: true,
            inject: function(renderer) {
                console.log('Renderer injected:', renderer);
                this.emit('renderer', renderer);
            },
            onCommitFiberRoot: function(rendererID, root, priorityLevel) {
                console.log('onCommitFiberRoot called:', rendererID, root);
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
                    return: this.serializeFiber(fiber.return),
                    child: this.serializeFiber(fiber.child),
                    sibling: this.serializeFiber(fiber.sibling),
                };
            },
            emit: function(event, data) {
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
        if (existingHook && typeof existingHook.inject === 'function') {
            console.log('Existing DevTools hook found, modifying inject method');
            const oldInject = existingHook.inject;
            existingHook.inject = function(renderer) {
                oldInject.call(existingHook, renderer);
                hook.inject(renderer);
            };
        } else {
            console.log('No existing DevTools hook found');
        }

        console.log('Minimal React DevTools hook initialized');
    }

    function attemptInjection() {
        if (detectReact()) {
            console.log('React detected, injecting hook');
            injectHook();
            return true;
        }
        return false;
    }

    // Attempt immediate injection
    if (!attemptInjection()) {
        console.log('React not detected initially, setting up MutationObserver');
        const observer = new MutationObserver(() => {
            if (attemptInjection()) {
                observer.disconnect();
            }
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-reactroot', 'data-reactid']
        });

        // Also try again after a short delay
        setTimeout(attemptInjection, 1000);
        setTimeout(attemptInjection, 2000);
        setTimeout(attemptInjection, 5000);
    }

    // Periodically check for React roots
    setInterval(() => {
        const roots = findReactRoot();
        if (roots) {
            console.log('Found React roots:', roots);
            window.postMessage({
                source: 'react-minimal-devtools-extension',
                payload: { type: 'reactRootsFound', data: roots.length }
            }, '*');
        }
    }, 2000);

    // Send a message to verify inject.js is running
    window.postMessage({
        source: 'react-minimal-devtools-extension',
        payload: { type: 'inject-script-loaded' }
    }, '*');

    console.log('Inject script finished running');
})();
