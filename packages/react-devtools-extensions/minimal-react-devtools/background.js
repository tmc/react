console.log("Minimal DevTools Extension background script loaded");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Background script received message:", message);
    if (message.source === 'react-minimal-devtools-extension') {
        chrome.runtime.sendMessage(message);
    }
});

chrome.runtime.onConnect.addListener((port) => {
    console.log("Background script connected to port:", port.name);
    port.onMessage.addListener((message) => {
        console.log('Background received message from port:', message);
        if (message.type === 'init') {
            port.postMessage({type: 'initialized'});
        }
    });
});
