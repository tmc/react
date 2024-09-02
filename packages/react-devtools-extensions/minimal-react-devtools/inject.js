(function() {
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) return;

  function installHook(window) {
    const hook = {
      renderers: new Map(),
      supportsFiber: true,
      inject: function(renderer) {
        const id = Math.random().toString(16).slice(2);
        hook.renderers.set(id, renderer);
      },
      onCommitFiberRoot: function() {},
      onCommitFiberUnmount: function() {},
      getFiberRoots: function(rendererID) {
        const roots = Array.from(hook.renderers.get(rendererID).getInteractionCommits().keys());
        return new Set(roots);
      },
      getSourceForElementType: function(elementType) {
        // This is a simplified version. In a real implementation, you'd need to
        // traverse the element's fiber to find the source.
        return elementType.toString();
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

      if (event.data.source === 'react-devtools-content-script' && event.data.payload.type === "get-source") {
        const source = hook.getSourceForElementType(event.data.payload.id);
        window.postMessage({
          source: 'react-devtools-bridge',
          payload: { type: "source-result", id: event.data.payload.id, source: source }
        }, '*');
      }
    });
  }

  installHook(window);
})();
