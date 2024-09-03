function devtoolsLog(...args) {
    console.log(...args);
    chrome.runtime.sendMessage({type: 'devtoolsLog', message: args});
}
devtoolsLog('Minimal React DevTools Plus: DevTools script loaded');

let panelWindow = null;
let customPanel = null;

devtoolsLog("creating panel");
chrome.devtools.panels.create(
    'Minimal React',
    null,
    'panel.html',
    (panel) => {
        customPanel = panel; // Set customPanel
        devtoolsLog("Panel created");
        panel.onShown.addListener((window) => {
            panelWindow = window;
            devtoolsLog("Panel shown");
        });
        panel.onHidden.addListener(() => {
            panelWindow = null;
            devtoolsLog("Panel hidden");
        });
        devtoolsLog("created panel", customPanel); // Log customPanel inside the callback

        // print details of panel, includijng methods and properties:
        console.log("Created panel:");
        // also send this to devtoolsLog:
        console.dir(customPanel, { depth: null, colors: true });
        // Alternative approach using JSON.stringify with a custom replacer
        const panelDetails = JSON.stringify(customPanel, (key, value) => {
            if (typeof value === 'function') {
                return value.toString();
            }
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                return Object.keys(value);
            }
            return value;
        }, 2);
        devtoolsLog("Panel details:", panelDetails);
    }
);
const backgroundPageConnection = chrome.runtime.connect({
    name: 'devtools-page'
});
backgroundPageConnection.postMessage({
    type: 'init',
    tabId: chrome.devtools.inspectedWindow.tabId
});
backgroundPageConnection.onMessage.addListener((message) => {
    devtoolsLog('DevTools received message from background: ' + JSON.stringify(message, null, 2));
    if (message.type === 'initialized') {
        devtoolsLog('DevTools page initialized');
    }
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type == 'devtoolsLog') {
      return
    }
    devtoolsLog('DevTools received runtime message: ' + JSON.stringify(message, null, 2));
    if (message.action === 'showCustomPanel' && customPanel) {
        customPanel.show(() => {
            devtoolsLog('Custom panel shown programmatically');
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {type: "panelOpened"});
            });
        });
        sendResponse({ status: 'success' });
    }
});
