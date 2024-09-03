console.log("Minimal DevTools Extension background script loaded");
let devtoolsLogs = [];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'devtoolsLog') {
        console.log('[devtools.js] log:', ...message.message);
        devtoolsLogs.push(message.message);
        return;
    }

    console.log("Minimal DevTools Extension background script got message:", message);

    if (message.payload && message.payload.type === 'showCustomPanel') {
        chrome.runtime.sendMessage({ action: 'showCustomPanel' });
        sendResponse({ status: 'forwarded to devtools' });
    }
});

chrome.runtime.onConnect.addListener((port) => {
    console.log("Minimal DevTools Extension background script connected to DevTools page");
    console.assert(port.name === 'devtools-page');
    port.onMessage.addListener((message) => {
        console.log('Background received message from DevTools:', JSON.stringify(message, null, 2));
        if (message.type === 'init') {
            port.postMessage({type: 'initialized'});
        }
    });
});