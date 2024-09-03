document.addEventListener('DOMContentLoaded', function() {
    let fiberRoot = null;
    let loadingTimeout = null;

    function showLoading() {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'flex';
        }
    }

    function hideLoading() {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }

    function updateTree() {
        const treeElement = document.getElementById('tree');
        if (!treeElement) {
            console.error('Tree element not found');
            return;
        }
        treeElement.innerHTML = '';

        function renderNode(node, depth = 0) {
            if (!node) return;
            const element = document.createElement('div');
            element.className = 'tree-node';
            element.style.paddingLeft = `${depth * 10}px`;

            let displayName = node.type || node.elementType || 'Unknown';
            if (typeof displayName === 'object') {
                displayName = displayName.name || 'Anonymous';
            }
            element.textContent = displayName;

            element.onclick = () => {
                showDetails(node);
                document.querySelectorAll('.tree-node').forEach(el => el.classList.remove('selected'));
                element.classList.add('selected');
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
            hideLoading();
        } else {
            treeElement.innerHTML = '<div class="tree-node">No React components detected</div>';
        }
    }

    function showDetails(node) {
        const detailsElement = document.getElementById('details');
        if (!detailsElement) {
            console.error('Details element not found');
            return;
        }
        detailsElement.innerHTML = '';

        const pre = document.createElement('pre');
        pre.textContent = JSON.stringify(node, null, 2);
        detailsElement.appendChild(pre);
    }

    function toggleSelectionMode() {
        console.log('Toggle selection mode');
        // Implement the logic to start/stop component selection mode
        // This should communicate with inject.js to enable/disable selection in the page
    }

    function handleSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        const treeNodes = document.querySelectorAll('.tree-node');
        treeNodes.forEach(node => {
            if (node.textContent.toLowerCase().includes(searchTerm)) {
                node.style.display = 'block';
            } else {
                node.style.display = 'none';
            }
        });
    }

    const componentSelector = document.getElementById('componentSelector');
    if (componentSelector) {
        componentSelector.addEventListener('click', toggleSelectionMode);
    } else {
        console.error('Component selector button not found');
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    } else {
        console.error('Search input not found');
    }

    // Listen for messages from the injected script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Panel received message:', message);
        if (message.source === 'react-minimal-devtools-extension') {
            if (message.payload.type === 'commitFiberRoot') {
                fiberRoot = message.payload.root;
                updateTree();
                clearTimeout(loadingTimeout);
                hideLoading();
            } else if (message.payload.type === 'inject-script-loaded') {
                console.log('Inject script loaded successfully');
                showLoading();
                // Set a timeout to hide loading if no components are detected
                loadingTimeout = setTimeout(() => {
                    hideLoading();
                    updateTree(); // This will show "No React components detected"
                }, 5000); // 5 seconds timeout
            }
        }
    });

    // Initial loading state
    showLoading();
});

// This function needs to be in the global scope to be called from the DevTools page
window.updateTree = function(newRoot) {
    fiberRoot = newRoot;
    updateTree();
};