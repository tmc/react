console.log('Minimal React DevTools Plus: Inject script loaded');

(function() {
  const HOOK_NAME = '__MINIMAL_REACT_DEVTOOLS_GLOBAL_HOOK__';
  if (window[HOOK_NAME]) return;

  const hook = {
    renderers: new Map(),
    supportsFiber: true,
    inject: function(renderer) {
      const id = Math.random().toString(16).slice(2);
      console.log('Renderer injected:', id);
      hook.renderers.set(id, renderer);
    },
    onCommitFiberRoot: function(rendererID, root, priorityLevel) {
      console.log('Commit fiber root:', rendererID, root, priorityLevel);
      sendMessage({ type: 'commitFiberRoot', rendererID, root: serializeFiber(root), priorityLevel });
    },
    onCommitFiberUnmount: function(rendererID, fiber) {
      console.log('Commit fiber unmount:', rendererID, fiber);
      sendMessage({ type: 'commitFiberUnmount', rendererID, fiber: serializeFiber(fiber) });
    },
    getFiberRoots: function(rendererID) {
      const renderer = hook.renderers.get(rendererID);
      return renderer ? new Set(renderer._roots || []) : new Set();
    },
  };

  function serializeFiber(fiber) {
    if (!fiber) return null;
    return {
      tag: fiber.tag,
      key: fiber.key,
      elementType: fiber.elementType ? fiber.elementType.name || String(fiber.elementType) : null,
      type: fiber.type ? fiber.type.name || String(fiber.type) : null,
      stateNode: fiber.stateNode ? (fiber.stateNode.constructor ? fiber.stateNode.constructor.name : 'Unknown') : null,
    };
  }

  function sendMessage(payload) {
    window.postMessage({ source: 'minimal-react-devtools-bridge', payload }, '*');
  }

  Object.defineProperty(window, HOOK_NAME, {
    enumerable: false,
    get: function() {
      return hook;
    }
  });

  window.addEventListener('message', function(event) {
    if (event.source !== window || !event.data) return;
    if (event.data.source === 'minimal-react-devtools-content-script') {
      const payload = event.data.payload;
      if (payload.type === 'getFiberRoots') {
        const rendererID = Array.from(hook.renderers.keys())[0];
        const roots = hook.getFiberRoots(rendererID);
        sendMessage({ type: 'fiberRoots', roots: Array.from(roots).map(serializeFiber) });
      }
    }
  });

  // Attempt to detect React
  const reactDetectInterval = setInterval(() => {
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__ && window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.size > 0) {
      console.log('React detected by Minimal React DevTools Plus');
      clearInterval(reactDetectInterval);
      sendMessage({ type: 'reactDetected' });
    }
  }, 1000);
})();
