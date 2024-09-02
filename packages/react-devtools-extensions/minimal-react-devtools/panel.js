console.log('Panel script loaded');

let treeData = null;

function updateTree(fiberRoots) {
  console.log('Updating tree with fiber roots:', fiberRoots);
  treeData = fiberRoots;
  renderTree();
}

function renderTree() {
  const treeElement = document.getElementById('tree');
  treeElement.innerHTML = '';

  function renderNode(node, depth = 0) {
    const element = document.createElement('div');
    element.className = 'component';
    element.style.paddingLeft = depth * 20 + 'px';
    element.textContent = node.name || 'Unknown';
    element.onclick = () => getSource(node.name);
    treeElement.appendChild(element);

    if (node.children) {
      node.children.forEach(child => renderNode(child, depth + 1));
    }
  }

  if (Array.isArray(treeData)) {
    treeData.forEach(root => renderNode(root));
  } else {
    console.error('treeData is not an array:', treeData);
  }
}

function getSource(id) {
  console.log('Getting source for:', id);
  chrome.runtime.sendMessage({
    type: "get-source",
    tabId: chrome.devtools.inspectedWindow.tabId,
    id: id
  });
}

function getFiberRoots() {
  console.log('Requesting fiber roots');
  chrome.runtime.sendMessage({
    type: "get-fiber-roots",
    tabId: chrome.devtools.inspectedWindow.tabId
  });
}

chrome.runtime.onMessage.addListener(function(message) {
  console.log('Message received in panel:', message);
  if (message.type === 'fiber-roots-result') {
    updateTree(message.roots);
  } else if (message.type === 'source-result') {
    document.getElementById('source').textContent = message.source;
  }
});

// Initial request for fiber roots
getFiberRoots();
