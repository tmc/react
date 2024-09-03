console.log('Minimal React DevTools Plus: Panel script loaded');

let fiberRoot = null;
let isInspecting = false;
let loadingTimeout = null;

function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function updateTree() {
    console.log('Updating tree with fiber root:', fiberRoot);
    const treeElement = document.getElementById('tree');
    treeElement.innerHTML = '';

    function renderNode(node, parentElement) {
        if (!node) return;

        const element = document.createElement('div');
        element.className = 'tree-node';
        element.textContent = node.type || node.elementType || 'Unknown';
        element.onclick = () => showDetails(node);

        parentElement.appendChild(element);

        if (node.child) {
            const childrenContainer = document.createElement('div');
            childrenContainer.style.paddingLeft = '20px';
            renderNode(node.child, childrenContainer);
            parentElement.appendChild(childrenContainer);
        }
        if (node.sibling) {
            renderNode(node.sibling, parentElement);
        }
    }

    if (fiberRoot) {
        renderNode(fiberRoot, treeElement);
        hideLoading();
    } else {
        treeElement.innerHTML = 'No React components detected';
    }
}

function showDetails(node) {
    console.log('Showing details for node:', node);
    const detailsElement = document.getElementById('details');
    detailsElement.innerHTML = '';

    const pre = document.createElement('pre');
    pre.className = 'details';
    pre.textContent = JSON.stringify(node, null, 2);
    detailsElement.appendChild(pre);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Panel received message:', JSON.stringify(message));
    if (message.source === 'react-minimal-devtools-extension') {
        if (message.payload.type === 'commitFiberRoot') {
            console.log('Received commitFiberRoot, data:', JSON.stringify(message.payload.data));
            fiberRoot = message.payload.data.root;
            updateTree();
        } else if (message.payload.type === 'inject-script-loaded') {
            console.log('Inject script loaded successfully');
            showLoading();
            // Set a timeout to hide loading if no components are detected
            loadingTimeout = setTimeout(() => {
                hideLoading();
                document.getElementById('tree').innerHTML = 'No React components detected';
            }, 10000); // 10 seconds timeout
        } else if (message.payload.type === 'content-script-loaded') {
            console.log('Content script loaded successfully');
        } else if (message.payload.type === 'renderer') {
            console.log('React renderer detected:', JSON.stringify(message.payload.data));
        } else if (message.payload.type === 'reactRootsFound') {
            console.log('React roots found:', message.payload.data);
            document.getElementById('tree').innerHTML = `Found ${message.payload.data} potential React root(s)`;
            hideLoading();
            clearTimeout(loadingTimeout);
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

document.getElementById('searchInput').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const treeNodes = document.querySelectorAll('.tree-node');
    treeNodes.forEach(node => {
        if (node.textContent.toLowerCase().includes(searchTerm)) {
            node.style.display = '';
        } else {
            node.style.display = 'none';
        }
    });
});

showLoading();
updateTree();
