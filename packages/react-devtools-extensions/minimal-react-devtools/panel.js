console.log('Minimal React DevTools Plus: Panel script loaded');

let fiberRoot = null;

function updateTree() {
  console.log('Updating tree with fiber root:', fiberRoot);
  const treeElement = document.getElementById('tree');
  treeElement.innerHTML = '';

  function renderNode(node, depth = 0) {
    if (!node) return;
    const element = document.createElement('div');
    element.className = 'component';
    element.style.paddingLeft = depth * 20 + 'px';
    element.style.cursor = 'pointer';
    element.style.marginBottom = '5px';

    let displayName = node.type || node.elementType || 'Unknown';
    if (typeof displayName === 'object') {
      displayName = displayName.name || 'Anonymous';
    }
    if (displayName === 'Symbol(react.strict_mode)') {
      displayName = 'StrictMode';
    }
    element.textContent = displayName;

    element.onclick = () => {
      showDetails(node);
      highlightElement(node);
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
  const detailsElement = document.getElementById('details');
  detailsElement.innerHTML = '';

  const pre = document.createElement('pre');
  pre.style.whiteSpace = 'pre-wrap';
  pre.style.wordWrap = 'break-word';
  pre.style.padding = '10px';
  pre.style.backgroundColor = '#f5f5f5';
  pre.style.border = '1px solid #ddd';
  pre.style.borderRadius = '4px';

  const cleanNode = {...node};
  delete cleanNode.child;
  delete cleanNode.sibling;

  pre.textContent = JSON.stringify(cleanNode, null, 2);
  detailsElement.appendChild(pre);
}

function highlightElement(node) {
  console.log('highlightElement', node);
  if (!node.stateNode || typeof node.stateNode !== 'object') return;

  const nodeType = node.stateNode.nodeType;
  console.log('highlightElement', nodeType);
  if (nodeType !== 1 && nodeType !== 3) return; // Only highlight Element and Text nodes

  chrome.devtools.inspectedWindow.eval(`
    (function() {
      const node = $0;
      if (node) {
        node.style.outline = node.style.outline ? '' : '2px solid red';
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    })()
  `, { useContentScriptContext: true });
}

window.addEventListener('message', (event) => {
  console.log('Panel received message:', event.data);
  if (event.data.type === 'commitFiberRoot') {
    console.log('Commit fiber root detected, updating tree');
    fiberRoot = event.data.root;
    updateTree();
  }
});

document.getElementById('refreshButton').addEventListener('click', () => {
  chrome.devtools.inspectedWindow.eval(
    'window.postMessage({ source: "minimal-react-devtools-content-script", payload: { type: "getFiberRoots" } }, "*");'
  );
});

// Initial request for fiber roots
chrome.devtools.inspectedWindow.eval(
  'window.postMessage({ source: "minimal-react-devtools-content-script", payload: { type: "getFiberRoots" } }, "*");'
);

// Add some basic styling
const style = document.createElement('style');
style.textContent = `
  body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    font-size: 14px;
  }
  #tree {
    margin-bottom: 20px;
  }
  .component:hover {
    background-color: #f0f0f0;
  }
`;
document.head.appendChild(style);
