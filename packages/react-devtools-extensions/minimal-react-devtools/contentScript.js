console.log('Minimal React DevTools Plus: Content script loaded');

function injectScript(file) {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(file);
    script.onload = function() {
        console.log('Inject script loaded');
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
}

injectScript('inject.js');

window.addEventListener('message', function(event) {
    if (event.source !== window || !event.data || event.data.source !== 'react-minimal-devtools-extension') return;
    console.log('Content script received message:', event.data);
    chrome.runtime.sendMessage(event.data);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received runtime message:', message);
});

chrome.runtime.sendMessage({
    source: 'react-minimal-devtools-extension',
    payload: { type: 'content-script-loaded' }
});