console.log('Minimal React DevTools Plus: Panel script loaded');

let fiberRoot = null;
let isInspecting = false;

function updateTree() {
  console.log('Updating tree with fiber root:', fiberRoot);
  const treeElement = document.getElementById('tree');
  treeElement.innerHTML = '';

  function renderNode(node, depth = 0) {
    if (!node) return;
    const element = document.createElement('div');
    element.className = 'tree-node';
    element.style.paddingLeft = depth * 20 + 'px';

    let displayName = node.type || node.elementType || 'Unknown';
    if (typeof displayName === 'object') {
      displayName = displayName.name || 'Anonymous';
    }
    if (displayName === 'Symbol(react.strict_mode)') {
      displayName = 'StrictMode';
    }
    element.textContent = displayName;

    element.onmouseover = () => {
      console.log('Component hovered:', displayName);
      chrome.devtools.inspectedWindow.eval(`
        window.postMessage({
          source: 'react-minimal-devtools-extension',
          payload: {
            type: 'highlightNode',
            fiber: ${JSON.stringify(node)},
            action: 'highlight'
          }
        }, '*');
      `);
    };

    element.onmouseout = () => {
      chrome.devtools.inspectedWindow.eval(`
        window.postMessage({
          source: 'react-minimal-devtools-extension',
          payload: {
            type: 'highlightNode',
            fiber: ${JSON.stringify(node)},
            action: 'removeHighlight'
          }
        }, '*');
      `);
    };

    element.onclick = () => {
      console.log('Component clicked:', displayName);
      showDetails(node);
    };

    treeElement.appendChild(element);

    if (node.child) {
      renderNode(node.child, depth + 1);
    }
    if (node.sibling) {
      renderNode(node.sibling, depth);
    }
  }

  if (fiberRoot) {
    renderNode(fiberRoot);
  } else {
    treeElement.innerHTML = '<div>No React components detected</div>';
  }
}

function showDetails(node) {
  console.log('Showing details for node:', node);
  const detailsElement = document.getElementById('details');
  detailsElement.innerHTML = '';

  const pre = document.createElement('pre');
  pre.className = 'details';

  const cleanNode = {...node};
  delete cleanNode.child;
  delete cleanNode.sibling;

  pre.textContent = JSON.stringify(cleanNode, null, 2);
  detailsElement.appendChild(pre);
}

// Listen for messages from the injected script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.source === 'react-minimal-devtools-extension') {
    console.log('Panel received message:', message);
    if (message.payload.type === 'commitFiberRoot') {
      console.log('Received commitFiberRoot, updating tree');
      fiberRoot = message.payload.root;
      updateTree();
    } else if (message.payload.type === 'inspectedElement') {
      console.log('Received inspected element:', message.payload.element);
      showDetails(message.payload.element);
    }
  }
});

document.getElementById('inspectButton').addEventListener('click', () => {
  isInspecting = !isInspecting;
  const button = document.getElementById('inspectButton');

  if (isInspecting) {
    button.textContent = 'Cancel inspection';
    button.style.backgroundColor = '#ff6b6b';
    chrome.devtools.inspectedWindow.eval(
      'window.postMessage({ source: "react-minimal-devtools-extension", payload: { type: "startInspecting" } }, "*");'
    );
  } else {
    button.textContent = 'Select an element in the page to inspect it';
    button.style.backgroundColor = '';
    chrome.devtools.inspectedWindow.eval(
      'window.postMessage({ source: "react-minimal-devtools-extension", payload: { type: "stopInspecting" } }, "*");'
    );
  }
});

// Request initial fiber roots when the panel is opened
function initialize() {
  chrome.devtools.inspectedWindow.eval(`
    if (window.__MINIMAL_REACT_DEVTOOLS_GLOBAL_HOOK__) {
      window.__MINIMAL_REACT_DEVTOOLS_GLOBAL_HOOK__.getFiberRoots().forEach(root => {
        window.postMessage({
          source: 'react-minimal-devtools-extension',
          payload: {
            type: 'commitFiberRoot',
            root: window.__MINIMAL_REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot(null, root)
          }
        }, '*');
      });
    }
  `);
}

// Call initialize when the panel is opened
initialize();