console.log('Minimal React DevTools Plus: Panel script loaded');

let fiberRoot = null;
let isInspecting = false;
let retryCount = 0;
const MAX_RETRIES = 5;

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
    console.log('Panel received message:', message);
    if (message.source === 'react-minimal-devtools-extension') {
        if (message.payload.type === 'commitFiberRoot') {
            console.log('Received commitFiberRoot, updating tree');
            fiberRoot = message.payload.root;
            updateTree();
        } else if (message.payload.type === 'inject-script-loaded') {
            console.log('Inject script loaded successfully');
        } else if (message.payload.type === 'content-script-loaded') {
            console.log('Content script loaded successfully');
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

function initialize() {
    console.log('Initializing panel');
    chrome.devtools.inspectedWindow.eval(`
        console.log('Evaluating in inspected window');
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
            console.log('Hook found, getting fiber roots');
            const roots = Array.from(window.__REACT_DEVTOOLS_GLOBAL_HOOK__.getFiberRoots(1));
            console.log('Roots found:', roots);
            roots.forEach(root => {
                console.log('Processing root:', root);
                window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot(1, root);
            });
            if (roots.length === 0) {
                console.log('No roots found, might need to wait for React to initialize');
            }
        } else {
            console.log('__REACT_DEVTOOLS_GLOBAL_HOOK__ not found');
        }
    `, (result, isException) => {
        if (isException) {
            console.error('Error during initialization:', isException);
        } else {
            console.log('Initialization completed');
        }
        if (!fiberRoot && retryCount < MAX_RETRIES) {
            retryCount++;
            console.log(`Retrying initialization in 1 second (attempt ${retryCount}/${MAX_RETRIES})`);
            setTimeout(initialize, 1000);
        }
    });
}

initialize();
updateTree();