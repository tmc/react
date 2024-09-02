console.log('Inject script loaded');

(function() {
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('React DevTools hook already exists');
    return;
  }

  function installHook(window) {
    console.log('Installing React DevTools hook');
    const hook = {
      renderers: new Map(),
      supportsFiber: true,
      inject: function(renderer) {
        const id = Math.random().toString(16).slice(2);
        console.log('Renderer injected:', id);
        hook.renderers.set(id, renderer);
      },
      onCommitFiberRoot: function() {},
      onCommitFiberUnmount: function() {},
      getFiberRoots: function(rendererID) {
        console.log('Getting fiber roots for renderer:', rendererID);
        const renderer = hook.renderers.get(rendererID);
        if (!renderer || !renderer.getInteractionCommits) {
          console.log('Renderer or getInteractionCommits not found');
          return new Set();
        }
        const roots = Array.from(renderer.getInteractionCommits().keys());
        console.log('Found roots:', roots.length);
        return new Set(roots);
      },
      getSourceForElementType: function(elementType) {
        console.log('Getting source for element type:', elementType);
        return elementType.toString();
      },
      serializeElement: function(element) {
        if (typeof element !== 'object' || element === null) {
          return element;
        }
        return {
          name: element.type?.displayName || element.type?.name || (typeof element.type === 'string' ? element.type : 'Unknown'),
          props: Object.keys(element.props || {}).reduce((acc, key) => {
            acc[key] = typeof element.props[key] === 'function' ? 'function' : element.props[key];
            return acc;
          }, {}),
          children: Array.isArray(element.children) ? element.children.map(hook.serializeElement) : []
        };
      }
    };

    Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
      enumerable: false,
      get: function() {
        return hook;
      }
    });

    window.addEventListener('message', function(event) {
      if (event.source !== window || !event.data) return;

      console.log('Message received in inject script:', event.data);

      if (event.data.source === 'react-devtools-content-script') {
        if (event.data.payload.type === "get-source") {
          const source = hook.getSourceForElementType(event.data.payload.id);
          window.postMessage({
            source: 'react-devtools-bridge',
            payload: { type: "source-result", id: event.data.payload.id, source: source }
          }, '*');
        } else if (event.data.payload.type === "get-fiber-roots") {
          const rendererID = Array.from(hook.renderers.keys())[0]; // Get the first renderer
          const roots = hook.getFiberRoots(rendererID);
          const serializedRoots = Array.from(roots).map(root => hook.serializeElement(root.current));
          console.log('Serialized roots:', serializedRoots);
          window.postMessage({
            source: 'react-devtools-bridge',
            payload: { type: "fiber-roots-result", roots: serializedRoots }
          }, '*');
        }
      }
    });
  }

  installHook(window);
})();
