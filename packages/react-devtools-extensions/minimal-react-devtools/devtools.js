function devtoolsLog(...args) {
    console.log('[Minimal React DevTools]', ...args);
    chrome.runtime.sendMessage({type: 'devtoolsLog', message: args});
}

devtoolsLog('DevTools script loaded');

let panelWindow = null;

chrome.devtools.panels.create(
    'Minimal React',
    null,
    'panel.html',
    (panel) => {
        devtoolsLog("Panel created");
        panel.onShown.addListener((window) => {
            panelWindow = window;
            devtoolsLog("Panel shown");
        });
        panel.onHidden.addListener(() => {
            panelWindow = null;
            devtoolsLog("Panel hidden");
        });
    }
);

const backgroundPageConnection = chrome.runtime.connect({
    name: 'minimal-devtools-panel'
});

backgroundPageConnection.postMessage({
    type: 'init',
    tabId: chrome.devtools.inspectedWindow.tabId
});

backgroundPageConnection.onMessage.addListener((message) => {
    devtoolsLog('DevTools received message from background:', JSON.stringify(message, null, 2));
    if (message.type === 'initialized') {
        devtoolsLog('DevTools page initialized');
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    devtoolsLog('DevTools received runtime message:', JSON.stringify(message, null, 2));
    if (message.source === 'react-minimal-devtools-extension' && panelWindow) {
        panelWindow.postMessage(message, '*');
    }
});
