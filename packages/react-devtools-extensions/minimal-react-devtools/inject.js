console.log('Minimal React DevTools Plus: Inject script loaded');

(function() {
  const HOOK_NAME = '__MINIMAL_REACT_DEVTOOLS_GLOBAL_HOOK__';
  if (window[HOOK_NAME]) {
    console.log('Hook already exists, not re-initializing');
    return;
  }

  function serializeFiber(fiber, depth = 0) {
    if (!fiber || depth > 50) return null;
    const serialized = {
      tag: fiber.tag,
      key: fiber.key,
      elementType: fiber.elementType ? (typeof fiber.elementType === 'string' ? fiber.elementType : fiber.elementType.name || String(fiber.elementType)) : null,
      type: fiber.type ? (typeof fiber.type === 'string' ? fiber.type : fiber.type.name || String(fiber.type)) : null,
      stateNode: fiber.stateNode ? (fiber.stateNode.nodeType ? fiber.stateNode.nodeName : 'NonDOMNode') : null,
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
      console.log('Commit fiber root:', rendererID, root);
      const serializedRoot = serializeFiber(root.current);
      window.postMessage({ source: 'react-minimal-devtools-extension', payload: { type: 'commitFiberRoot', rendererID, root: serializedRoot, priorityLevel } }, '*');
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

  let isInspecting = false;
  let hoveredFiber = null;

  window.addEventListener('message', function(event) {
    if (event.source !== window || !event.data) return;

    if (event.data.source === 'react-minimal-devtools-extension') {
      const payload = event.data.payload;
      switch (payload.type) {
        case 'highlightNode':
          if (payload.action === 'highlight') {
            highlightNode(payload.fiber);
          } else if (payload.action === 'removeHighlight') {
            removeHighlight(payload.fiber);
          }
          break;
        case 'clearHighlight':
          clearHighlight();
          break;
        case 'startInspecting':
          startInspecting();
          break;
        case 'stopInspecting':
          stopInspecting();
          break;
      }
    }
  });

  function highlightNode(fiber) {
    console.log('Attempting to highlight fiber:', fiber);
    let node = null;
    hook.renderers.forEach((renderer) => {
      if (renderer.findHostInstanceByFiber) {
        try {
          node = renderer.findHostInstanceByFiber(fiber);
          if (node) return;
        } catch (error) {
          console.log('Error finding host instance:', error);
        }
      }
    });

    console.log('Found DOM node:', node);

    if (node && node.nodeType === Node.ELEMENT_NODE) {
      node.style.outline = '2px solid red';
      node.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
      console.log('Highlighted node:', node);
    } else {
      console.log('Unable to highlight node. It might be a non-host component.');
    }
  }

  function removeHighlight(fiber) {
    console.log('Attempting to remove highlight from fiber:', fiber);
    let node = null;
    hook.renderers.forEach((renderer) => {
      if (renderer.findHostInstanceByFiber) {
        try {
          node = renderer.findHostInstanceByFiber(fiber);
          if (node) return;
        } catch (error) {
          console.log('Error finding host instance:', error);
        }
      }
    });

    if (node && node.nodeType === Node.ELEMENT_NODE) {
      node.style.outline = '';
      node.style.backgroundColor = '';
      console.log('Removed highlight from node:', node);
    }
  }

  function clearHighlight() {
    console.log('Clearing all highlights');
    document.querySelectorAll('[style*="outline"][style*="background-color"]').forEach(el => {
      el.style.outline = '';
      el.style.backgroundColor = '';
    });
  }

  function startInspecting() {
    console.log('Start inspecting');
    isInspecting = true;
    document.body.style.cursor = 'crosshair';
    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('click', onClick);
  }

  function stopInspecting() {
    console.log('Stop inspecting');
    isInspecting = false;
    document.body.style.cursor = '';
    document.removeEventListener('mouseover', onMouseOver);
    document.removeEventListener('click', onClick);
    clearHighlight();
  }

  function onMouseOver(event) {
    if (!isInspecting) return;

    const target = event.target;
    hoveredFiber = null;

    hook.renderers.forEach((renderer) => {
      if (renderer.findFiberByHostInstance) {
        try {
          const fiber = renderer.findFiberByHostInstance(target);
          if (fiber) {
            hoveredFiber = fiber;
            highlightNode(serializeFiber(fiber));
          }
        } catch (error) {
          console.log('Error finding fiber:', error);
        }
      }
    });
  }

  function onClick(event) {
    if (!isInspecting) return;
    event.preventDefault();
    event.stopPropagation();

    if (hoveredFiber) {
      const serializedFiber = serializeFiber(hoveredFiber);
      window.postMessage({
        source: 'react-minimal-devtools-extension',
        payload: {
          type: 'inspectedElement',
          element: serializedFiber
        }
      }, '*');
    }

    stopInspecting();
  }

  // Expose the function to open the custom panel
  function openMinimalReactDevtoolsCustomPanel() {
    console.log('Requesting to open custom DevTools panel');
    // Post a message to the content script to handle the panel opening
    window.postMessage({ 
      source: 'react-minimal-devtools-extension', 
      payload: { type: 'openCustomPanel' } 
    }, '*');
  }

  window.openMinimalReactDevtoolsCustomPanel = openMinimalReactDevtoolsCustomPanel;

  console.log('Minimal React DevTools hook initialized');
  window.postMessage({ source: 'react-minimal-devtools-extension', payload: { type: 'initialized' } }, '*');
})();
