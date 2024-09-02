console.log('Minimal React DevTools Plus: Panel script loaded');

let fiberRoot = null;
let selectedNodeId = null;

function updateTree() {
  console.log('Updating tree with fiber root:', fiberRoot);
  const treeElement = document.getElementById('tree');
  if (!treeElement) {
    console.error('Tree element not found in the DOM');
    return;
  }
  treeElement.innerHTML = '';

  if (fiberRoot) {
    renderNode(fiberRoot, treeElement);
  } else {
    treeElement.innerHTML = '<div>No React components detected</div>';
  }
}

function renderNode(node, parentElement, depth = 0) {
  if (!node) return;

  const element = document.createElement('div');
  element.className = 'tree-node';
  element.style.paddingLeft = `${depth * 20}px`;

  let displayName = node.type || node.elementType || 'Unknown';
  if (typeof displayName === 'object') {
    displayName = displayName.name || 'Anonymous';
  }
  if (displayName === 'Symbol(react.strict_mode)') {
    displayName = 'StrictMode';
  }
  element.textContent = displayName;
  element.dataset.nodeId = node.id;

  element.onmouseover = () => highlightElement(node);
  element.onmouseout = () => removeHighlight();
  element.onclick = (e) => {
    e.stopPropagation();
    selectNode(node);
  };

  parentElement.appendChild(element);

  if (node.child) {
    renderNode(node.child, parentElement, depth + 1);
  }
  if (node.sibling) {
    renderNode(node.sibling, parentElement, depth);
  }
}

function selectNode(node) {
  if (selectedNodeId) {
    const prevSelected = document.querySelector(`.tree-node[data-node-id="${selectedNodeId}"]`);
    if (prevSelected) prevSelected.classList.remove('selected');
  }
  selectedNodeId = node.id;
  const newSelected = document.querySelector(`.tree-node[data-node-id="${selectedNodeId}"]`);
  if (newSelected) newSelected.classList.add('selected');
  showDetails(node);
}

function showDetails(node) {
  const detailsElement = document.getElementById('details');
  if (!detailsElement) {
    console.error('Details element not found in the DOM');
    return;
  }
  detailsElement.innerHTML = '';

  const pre = document.createElement('pre');
  pre.className = 'details';
  const nodeDetails = { ...node };
  delete nodeDetails.child;
  delete nodeDetails.sibling;
  pre.textContent = JSON.stringify(nodeDetails, null, 2);
  detailsElement.appendChild(pre);
}

function highlightElement(node) {
  chrome.devtools.inspectedWindow.eval(`
    window.postMessage({
      source: 'react-devtools-extension',
      payload: {
        type: 'highlightNode',
        id: "${node.id}"
      }
    }, '*');
  `);
}

function removeHighlight() {
  chrome.devtools.inspectedWindow.eval(`
    window.postMessage({
      source: 'react-devtools-extension',
      payload: {
        type: 'clearHighlight'
      }
    }, '*');
  `);
}

function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const treeNodes = document.querySelectorAll('.tree-node');
    treeNodes.forEach(node => {
      const text = node.textContent.toLowerCase();
      node.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });
  });
}

function setupInspector() {
  const inspectButton = document.getElementById('inspectButton');
  let isInspecting = false;

  inspectButton.addEventListener('click', () => {
    isInspecting = !isInspecting;
    inspectButton.textContent = isInspecting ? 'Cancel inspection' : 'Select an element in the page to inspect it';

    chrome.devtools.inspectedWindow.eval(`
      window.postMessage({
        source: 'react-devtools-extension',
        payload: {
          type: ${isInspecting ? '"startInspecting"' : '"stopInspecting"'}
        }
      }, '*');
    `);
  });
}

window.addEventListener('message', (event) => {
  console.log('Panel received message:', event.data);
  if (event.data.type === 'commitFiberRoot') {
    console.log('Received commitFiberRoot, updating tree');
    fiberRoot = event.data.root;
    console.log('New fiber root:', fiberRoot);
    updateTree();
  } else if (event.data.type === 'selectNode') {
    const node = findNodeById(fiberRoot, event.data.id);
    if (node) {
      selectNode(node);
    }
  } else {
    console.log('Received unknown message type:', event.data.type);
  }
});

function findNodeById(root, id) {
  if (!root) return null;
  if (root.id === id) return root;
  let result = findNodeById(root.child, id);
  if (result) return result;
  return findNodeById(root.sibling, id);
}

// Initial setup
updateTree();
setupSearch();
setupInspector();

console.log('Panel script initialization complete');
