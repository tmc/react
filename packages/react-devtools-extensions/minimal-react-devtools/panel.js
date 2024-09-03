// panel.js

let fiberRoot = null;
let loadingState = 'loading';
let selectedComponent = null;

function debugLog(...args) {
  console.log('[React DevTools Panel]', ...args);
}

function updateUI() {
  const loadingIndicator = document.getElementById('loadingIndicator');
  const content = document.getElementById('content');
  const loadingMessage = document.getElementById('loadingMessage');

  switch (loadingState) {
    case 'loading':
      loadingIndicator.style.display = 'block';
      content.style.display = 'none';
      loadingMessage.textContent = 'Detecting React...';
      break;
    case 'reactDetected':
      loadingIndicator.style.display = 'block';
      content.style.display = 'none';
      loadingMessage.textContent = 'React detected. Loading component tree...';
      break;
    case 'componentsLoaded':
      loadingIndicator.style.display = 'none';
      content.style.display = 'block';
      updateTree();
      updateDetails();
      break;
    default:
      loadingIndicator.style.display = 'block';
      content.style.display = 'none';
      loadingMessage.textContent = 'Unknown state';
  }
}

function updateTree() {
  if (!fiberRoot) {
    debugLog('No fiber root to render');
    return;
  }

  const treeContainer = document.getElementById('tree');
  treeContainer.innerHTML = ''; // Clear existing content

  const rootElement = document.createElement('ul');
  rootElement.className = 'root';
  rootElement.appendChild(renderFiberNode(fiberRoot));
  treeContainer.appendChild(rootElement);
}

function renderFiberNode(fiber) {
  const li = document.createElement('li');

  if (!fiber) {
    li.textContent = 'Invalid fiber node';
    li.className = 'error';
    return li;
  }

  const nameSpan = document.createElement('span');
  nameSpan.textContent = fiber.name || 'Unknown';
  nameSpan.className = 'component-name';
  li.appendChild(nameSpan);

  if (fiber.key) {
    const keySpan = document.createElement('span');
    keySpan.textContent = ` (key: ${fiber.key})`;
    keySpan.className = 'component-key';
    li.appendChild(keySpan);
  }

  li.addEventListener('click', (event) => {
    event.stopPropagation();
    selectComponent(fiber);
  });

  if (fiber.child || fiber.sibling) {
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = '-';
    toggleBtn.className = 'toggle-btn';
    li.insertBefore(toggleBtn, li.firstChild);

    const childrenContainer = document.createElement('ul');
    childrenContainer.className = 'children';
    if (fiber.child) {
      childrenContainer.appendChild(renderFiberNode(fiber.child));
    }
    if (fiber.sibling) {
      li.parentNode.appendChild(renderFiberNode(fiber.sibling));
    }
    li.appendChild(childrenContainer);

    toggleBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      childrenContainer.style.display = childrenContainer.style.display === 'none' ? 'block' : 'none';
      toggleBtn.textContent = childrenContainer.style.display === 'none' ? '+' : '-';
    });
  }

  return li;
}

function selectComponent(fiber) {
  selectedComponent = fiber;
  updateDetails();
}

function updateDetails() {
  const detailsElement = document.getElementById('details');
  if (!selectedComponent) {
    detailsElement.innerHTML = '<p>Select a component to see details</p>';
    return;
  }

  let detailsHTML = `
    <h2>${selectedComponent.name || 'Unknown'}</h2>
    <p>Type: ${selectedComponent.type || 'Unknown'}</p>
    <p>Key: ${selectedComponent.key || 'None'}</p>
  `;

  if (selectedComponent.props) {
    detailsHTML += '<h3>Props:</h3>';
    detailsHTML += '<pre>' + JSON.stringify(selectedComponent.props, null, 2) + '</pre>';
  }

  if (selectedComponent.state) {
    detailsHTML += '<h3>State:</h3>';
    detailsHTML += '<pre>' + JSON.stringify(selectedComponent.state, null, 2) + '</pre>';
  }

  detailsElement.innerHTML = detailsHTML;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.source === 'react-minimal-devtools-extension') {
    debugLog('Panel received message:', message.payload.type, message.payload.data);
    switch (message.payload.type) {
      case 'injectScriptLoaded':
        debugLog('Inject script loaded');
        break;
      case 'reactDetected':
        debugLog('React detected');
        loadingState = 'reactDetected';
        updateUI();
        break;
      case 'commitFiberRoot':
        debugLog('Received commitFiberRoot, updating tree');
        fiberRoot = message.payload.data.root;
        loadingState = 'componentsLoaded';
        updateUI();
        break;
      case 'existingRootsFound':
        debugLog('Existing roots found:', message.payload.data.roots);
        fiberRoot = message.payload.data.roots[0]; // Take the first root
        loadingState = 'componentsLoaded';
        updateUI();
        break;
      case 'reactNotDetected':
        debugLog('React not detected');
        loadingState = 'componentsLoaded';
        updateUI();
        break;
      case 'hookInjected':
        debugLog('Hook injected');
        break;
      default:
        debugLog('Unknown message type:', message.payload.type);
    }
  }
});

function setupInspectMode() {
  // Implement inspect mode functionality here
  debugLog('Inspect mode activated');
}

function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (event) => {
    // Implement search functionality here
    debugLog('Search input:', event.target.value);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  debugLog('Panel loaded');
  updateUI();

  document.getElementById('inspectButton').addEventListener('click', setupInspectMode);
  setupSearch();
});

window.addEventListener('error', (event) => {
  console.error('An error occurred in the panel:', event.error);
});
