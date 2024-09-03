console.log('Minimal React DevTools Plus: Panel script loaded');

let fiberRoot = null;
let isInspecting = false;
let loadingTimeout = null;
let lastReactRootsCount = 0;

function debugLog(...args) {
    console.log('[Minimal React DevTools Panel]', ...args);
}

function showLoading() {
    document.getElementById('loading').style.display = 'flex';
    debugLog('Showing loading screen');
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
    debugLog('Hiding loading screen');
}

function updateTree() {
    debugLog('Updating tree with fiber root:', fiberRoot);
    const treeElement = document.getElementById('tree');
    treeElement.innerHTML = '';

    function renderNode(node, parentElement, depth = 0) {
        if (!node) return;

        const element = document.createElement('div');
        element.className = 'tree-node';
        element.style.paddingLeft = `${depth * 20}px`;
        element.textContent = node.type || node.elementType || 'Unknown';
        element.onclick = () => showDetails(node);

        parentElement.appendChild(element);

        if (node.child) {
            renderNode(node.child, treeElement, depth + 1);
        }
        if (node.sibling) {
            renderNode(node.sibling, treeElement, depth);
        }
    }

    if (fiberRoot) {
        renderNode(fiberRoot, treeElement);
        hideLoading();
    } else if (lastReactRootsCount > 0) {
        treeElement.innerHTML = `<div id="noReactMessage">
            Found ${lastReactRootsCount} React root(s).<br>
            Waiting for component data...<br>
            If this persists, try refreshing the page or the DevTools panel.
        </div>`;
        hideLoading();
    } else {
        treeElement.innerHTML = '<div id="noReactMessage">No React components detected</div>';
        debugLog('No fiber root available');
    }
}

function showDetails(node) {
    debugLog('Showing details for node:', node);
    const detailsElement = document.getElementById('details');
    detailsElement.innerHTML = '';

    const pre = document.createElement('pre');
    pre.className = 'details';
    pre.textContent = JSON.stringify(node, null, 2);
    detailsElement.appendChild(pre);
}

function startLoadingTimeout() {
    loadingTimeout = setTimeout(() => {
        debugLog('Loading timeout reached');
        hideLoading();
    }, 9000); // 9 seconds
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    debugLog('Panel received message:', message);
    if (message.source === 'react-minimal-devtools-extension') {
        if (message.payload.type === 'commitFiberRoot') {
            debugLog('Received commitFiberRoot, data:', message.payload.data);
            fiberRoot = message.payload.data.root;
            updateTree();
            hideLoading();
            clearTimeout(loadingTimeout);
        } else if (message.payload.type === 'inject-script-loaded') {
            debugLog('Inject script loaded successfully');
            showLoading();
            startLoadingTimeout();
        } else if (message.payload.type === 'reactRootsFound') {
            console.log("reactRootsFound!", message.payload.data == lastReactRootsCount)
            if (message.payload.data !== lastReactRootsCount) {
                debugLog('React roots found:', message.payload.data);
                lastReactRootsCount = message.payload.data;
                updateTree(); // Call updateTree to reflect the new state
                if (!fiberRoot) {
                    // If we've found roots but haven't received commitFiberRoot, hide loading after a delay
                    setTimeout(() => {
                        if (!fiberRoot) {
                            hideLoading();
                        }
                    }, 5000);
                }
            }
        }
    }
});

// Initial loading state
showLoading();
startLoadingTimeout();
updateTree();
debugLog('Initial loading state set');

// Check if we're connected to the background script
if (chrome.runtime.connect) {
    const port = chrome.runtime.connect({name: "minimal-devtools-panel"});
    port.postMessage({type: "panel-ready"});
    debugLog('Panel ready message sent to background script');
    port.onMessage.addListener((message) => {
        debugLog('Panel received port message:', message);
    });
} else {
    console.error('Unable to connect to background script');
}

// Setup search functionality
const searchInput = document.getElementById('searchInput');
searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.toLowerCase();
    const treeNodes = document.querySelectorAll('.tree-node');
    treeNodes.forEach(node => {
        if (node.textContent.toLowerCase().includes(searchTerm)) {
            node.style.display = 'block';
        } else {
            node.style.display = 'none';
        }
    });
});

// Setup component selector functionality
const componentSelector = document.getElementById('componentSelector');
componentSelector.addEventListener('click', () => {
    isInspecting = !isInspecting;
    componentSelector.classList.toggle('active', isInspecting);
    chrome.runtime.sendMessage({
        source: 'react-minimal-devtools-extension',
        payload: { type: 'toggleInspector', data: isInspecting }
    });
});

// Add a manual refresh button
const refreshButton = document.getElementById('refreshButton');
refreshButton.onclick = () => {
    debugLog('Manual refresh requested');
    showLoading();
    startLoadingTimeout();
    chrome.runtime.sendMessage({
        source: 'react-minimal-devtools-extension',
        payload: { type: 'manualRefresh' }
    });
};

// Add version information
const versionInfo = document.createElement('div');
versionInfo.id = 'versionInfo';
versionInfo.style.position = 'absolute';
versionInfo.style.bottom = '5px';
versionInfo.style.right = '5px';
versionInfo.style.fontSize = '12px';
versionInfo.style.color = '#888';
document.body.appendChild(versionInfo);

chrome.runtime.sendMessage({
    source: 'react-minimal-devtools-extension',
    payload: { type: 'getExtensionVersion' }
}, (response) => {
    if (response && response.version) {
        versionInfo.textContent = `Extension v${response.version}`;
    }
});
