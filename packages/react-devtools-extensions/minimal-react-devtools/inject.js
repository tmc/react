console.log('Minimal React DevTools Plus: Inject script loaded');

(function() {
  const HOOK_NAME = '__MINIMAL_REACT_DEVTOOLS_GLOBAL_HOOK__';
  if (window[HOOK_NAME]) return;

  function serializeFiber(fiber, depth = 0) {
    if (!fiber || depth > 50) return null; // Limit depth to prevent circular references
    const serialized = {
      tag: fiber.tag,
      key: fiber.key,
      elementType: fiber.elementType ? (typeof fiber.elementType === 'string' ? fiber.elementType : fiber.elementType.name || String(fiber.elementType)) : null,
      type: fiber.type ? (typeof fiber.type === 'string' ? fiber.type : fiber.type.name || String(fiber.type)) : null,
      stateNode: fiber.stateNode ? (fiber.stateNode.constructor ? fiber.stateNode.constructor.name : 'Unknown') : null,
      child: null,
      sibling: null,
    };


    if (fiber.child) {
      serialized.child = serializeFiber(fiber.child, depth + 1);
    }
    if (fiber.sibling) {
      serialized.sibling = serializeFiber(fiber.sibling, depth + 1);
    }

    return serialized;
  }

  const hook = {
    renderers: new Map(),
    supportsFiber: true,
    inject: function(renderer) {
      const id = Math.random().toString(16).slice(2);
      console.log('Renderer injected:', id);
      hook.renderers.set(id, renderer);
      window.postMessage({ source: 'minimal-react-devtools-bridge', payload: { type: 'rendererInjected', id } }, '*');
    },
    onCommitFiberRoot:function(rendererID, root, priorityLevel) {
      console.log('Commit fiber root:', rendererID, root, priorityLevel);
      const serializedRoot = serializeFiber(root.current);
      window.postMessage({ source: 'minimal-react-devtools-bridge', payload: { type: 'commitFiberRoot', rendererID, root: serializedRoot, priorityLevel } }, '*');
    },
    getFiberRoots: function(rendererID) {
      console.log('Getting fiber roots for renderer:', rendererID);
      const roots = [];
      hook.renderers.forEach((renderer, id) => {
        if (renderer.findFiberByHostInstance) {
          const fiberRoot = renderer.findFiberByHostInstance(document.body);
          if (fiberRoot) {
            roots.push(fiberRoot);
          }
        }
      });
      return new Set(roots);
    },
  };

  Object.defineProperty(window, HOOK_NAME, {
    enumerable: false,
    get: function() {
      return hook;
    }
  });

  // Integrate with existing React DevTools hook
  const existingHook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (existingHook) {
    console.log('Existing React DevTools hook found');

    // Wrap the existing inject method
    const originalInject = existingHook.inject;
    existingHook.inject = function(renderer) {
      hook.inject(renderer);
      return originalInject.call(this, renderer);
    };

    // Wrap the existing onCommitFiberRoot method
    const originalOnCommitFiberRoot = existingHook.onCommitFiberRoot;
    existingHook.onCommitFiberRoot = function(id, root, priorityLevel) {
      hook.onCommitFiberRoot(id, root, priorityLevel);
      return originalOnCommitFiberRoot.call(this, id, root, priorityLevel);
    };

    // Copy over any existing renderers
    existingHook.renderers.forEach((renderer, id) => {
      hook.inject(renderer);
    });

    console.log('Successfully integrated with existing React DevTools hook');
  } else {
    console.log('No existing React DevTools hook found');
  }

  window.postMessage({ source: 'minimal-react-devtools-bridge', payload: { type: 'initialized' } }, '*');
})();
