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
    console.log('Content script received message:', event.data);
    if (event.source !== window) return;

    if (event.data.source === 'react-minimal-devtools-extension') {
        console.log('Forwarding message to extension:', event.data);
        chrome.runtime.sendMessage(event.data);
    } else {
        console.log('Received non-extension message:', event.data);
    }
});

chrome.runtime.sendMessage({
    source: 'react-minimal-devtools-extension',
    payload: { type: 'content-script-loaded' }
});