console.log('Minimal React DevTools Plus: Panel script loaded');

let fiberRoots = [];

function updateTree() {
  const treeElement = document.getElementById('tree');
  treeElement.innerHTML = '';

  function renderNode(node, depth = 0) {
    const element = document.createElement('div');
    element.className = 'component';
    element.style.paddingLeft = depth * 20 + 'px';
    element.textContent = node.type || node.elementType || 'Unknown';
    element.onclick = () => showDetails(node);
    treeElement.appendChild(element);
  }

  fiberRoots.forEach(root => renderNode(root));
}

function showDetails(node) {
  const detailsElement = document.getElementById('details');
  detailsElement.textContent = JSON.stringify(node, null, 2);
}

function getFiberRoots() {
  chrome.runtime.sendMessage({ type: 'getFiberRoots' });
}

chrome.runtime.onMessage.addListener(function(message) {
  if (message.type === 'fiberRoots') {
    fiberRoots = message.roots;
    updateTree();
  } else if (message.type === 'commitFiberRoot' || message.type === 'commitFiberUnmount') {
    getFiberRoots(); // Refresh the tree on any change
  }
});

document.getElementById('refreshButton').addEventListener('click', getFiberRoots);

// Initial request for fiber roots
getFiberRoots();
