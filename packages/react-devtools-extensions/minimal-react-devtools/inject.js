console.log('Minimal React DevTools Plus: Inject script loaded');

(function() {
  const HOOK_NAME = '__MINIMAL_REACT_DEVTOOLS_GLOBAL_HOOK__';
  if (window[HOOK_NAME]) {
    console.log('Hook already exists, not re-initializing');
    return;
  }

  let highlightOverlay = null;
  let isInspecting = false;

  function createHighlightOverlay() {
    highlightOverlay = document.createElement('div');
    highlightOverlay.style.backgroundColor = 'rgba(120, 170, 210, 0.7)';
    highlightOverlay.style.position = 'fixed';
    highlightOverlay.style.zIndex = 1000000;
    highlightOverlay.style.pointerEvents = 'none';
    document.body.appendChild(highlightOverlay);
  }

  function highlightNode(id) {
    const node = findNodeById(id);
    if (node) {
      const rect = node.getBoundingClientRect();
      if (!highlightOverlay) {
        createHighlightOverlay();
      }
      highlightOverlay.style.top = `${rect.top}px`;
      highlightOverlay.style.left = `${rect.left}px`;
      highlightOverlay.style.width = `${rect.width}px`;
      highlightOverlay.style.height = `${rect.height}px`;
      highlightOverlay.style.display = 'block';
    }
  }

  function clearHighlight() {
    if (highlightOverlay) {
      highlightOverlay.style.display = 'none';
    }
  }

  function findNodeById(id) {
    let foundNode = null;
    hook.renderers.forEach((renderer) => {
      if (renderer.findHostInstanceByFiber) {
        try {
          const fiber = renderer.findFiberByHostInstance(document.body);
          if (fiber) {
            const node = findNodeByIdInFiber(fiber, id);
            if (node) {
              foundNode = renderer.findHostInstanceByFiber(node);
            }
          }
        } catch (error) {
          console.error('Error finding node:', error);
        }
      }
    });
    return foundNode;
  }

  function findNodeByIdInFiber(fiber, targetId) {
    if (fiber.id === targetId) {
      return fiber;
    }
    if (fiber.child) {
      const childResult = findNodeByIdInFiber(fiber.child, targetId);
      if (childResult) {
        return childResult;
      }
    }
    if (fiber.sibling) {
      return findNodeByIdInFiber(fiber.sibling, targetId);
    }
    return null;
  }

  function serializeFiber(fiber, depth = 0) {
    if (!fiber || depth > 50) return null;
    const serialized = {
      id: fiber._debugID || Math.random().toString(36).substr(2, 9),
      tag: fiber.tag,
      key: fiber.key,
      elementType: fiber.elementType ? (typeof fiber.elementType === 'string' ? fiber.elementType : fiber.elementType.name || String(fiber.elementType)) : null,
      type: fiber.type ? (typeof fiber.type === 'string' ? fiber.type : fiber.type.name || String(fiber.type)) : null,
      stateNode: fiber.stateNode ? (fiber.stateNode.nodeType ? fiber.stateNode.nodeName : 'NonDOMNode') : null,
      props: fiber.memoizedProps,
      state: fiber.memoizedState,
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
    },
    onCommitFiberRoot: function(rendererID, root, priorityLevel) {
      console.log('Commit fiber root called:', rendererID, root);
      if (root && root.current) {
        console.log('Root current:', root.current);
        const serializedRoot = serializeFiber(root.current);
        console.log('Serialized root:', serializedRoot);
        window.postMessage({ source: 'minimal-react-devtools-bridge', payload: { type: 'commitFiberRoot', rendererID, root: serializedRoot, priorityLevel } }, '*');
      } else {
        console.error('Root or root.current is null or undefined');
      }
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

  function startInspecting() {
    isInspecting = true;
    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('click', onClick, true);
    document.addEventListener('mouseout', onMouseOut);
  }

  function stopInspecting() {
    isInspecting = false;
    document.removeEventListener('mouseover', onMouseOver);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('mouseout', onMouseOut);
    clearHighlight();
  }

  function onMouseOver(event) {
    if (!isInspecting) return;
    const target = event.target;
    highlightElement(target);
  }

  function onMouseOut(event) {
    if (!isInspecting) return;
    clearHighlight();
  }

  function onClick(event) {
    if (!isInspecting) return;
    event.preventDefault();
    event.stopPropagation();
    selectElement(event.target);
    stopInspecting();
  }

  function highlightElement(element) {
    const rect = element.getBoundingClientRect();
    if (!highlightOverlay) {
      createHighlightOverlay();
    }
    highlightOverlay.style.top = `${rect.top}px`;
    highlightOverlay.style.left = `${rect.left}px`;
    highlightOverlay.style.width = `${rect.width}px`;
    highlightOverlay.style.height = `${rect.height}px`;
    highlightOverlay.style.display = 'block';
  }

  function selectElement(element) {
    let fiber = null;
    hook.renderers.forEach((renderer) => {
      if (renderer.findFiberByHostInstance) {
        fiber = renderer.findFiberByHostInstance(element);
        if (fiber) return;
      }
    });

    if (fiber) {
      window.postMessage({
        source: 'react-devtools-extension',
        payload: {
          type: 'selectNode',
          id: fiber._debugID || fiber.id
        }
      }, '*');
    }
  }

  window.addEventListener('message', function(event) {
    if (event.source !== window || !event.data) return;

    if (event.data.source === 'react-devtools-extension') {
      const payload = event.data.payload;
      if (payload.type === 'highlightNode') {
        highlightNode(payload.id);
      } else if (payload.type === 'clearHighlight') {
        clearHighlight();
      } else if (payload.type === 'startInspecting') {
        startInspecting();
      } else if (payload.type === 'stopInspecting') {
        stopInspecting();
      }
    }
  });

  console.log('Minimal React DevTools hook initialized');
  window.postMessage({ source: 'minimal-react-devtools-bridge', payload: { type: 'initialized' } }, '*');
})();
