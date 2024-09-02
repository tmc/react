let treeData = null;

function updateTree(fiberRoot) {
  treeData = fiberRoot;
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
    element.onclick = () => getSource(node.id);
    treeElement.appendChild(element);

    if (node.children) {
      node.children.forEach(child => renderNode(child, depth + 1));
    }
  }

  renderNode(treeData);
}

function getSource(id) {
  chrome.runtime.sendMessage({
    type: "get-source",
    tabId: chrome.devtools.inspectedWindow.tabId,
    id: id
  });
}

chrome.runtime.onMessage.addListener(function(message) {
  if (message.type === 'updateTree') {
    updateTree(message.payload);
  } else if (message.type === 'source-result') {
    document.getElementById('source').textContent = message.source;
  }
});
