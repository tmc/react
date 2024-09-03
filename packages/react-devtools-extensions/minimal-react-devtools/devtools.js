console.log('Minimal React DevTools Plus: DevTools script loaded');

console.log("creating panel");
let panel = await chrome.devtools.panels.create(
  'Minimal React',
  null,
  'panel.html',
  (panel) => {
    console.log("Panel created");
    panel.onShown.addListener((window) => {
      panelWindow = window;
      console.log("Panel shown");
    });
    panel.onHidden.addListener(() => {
      panelWindow = null;
      console.log("Panel hidden");
    });
  }
);
console.log("created panel");

const backgroundPageConnection = chrome.runtime.connect({
  name: 'devtools-page'
});

backgroundPageConnection.postMessage({
  type: 'init',
  tabId: chrome.devtools.inspectedWindow.tabId
});

backgroundPageConnection.onMessage.addListener((message) => {
  console.log('DevTools received message from background:', JSON.stringify(message, null, 2));
  if (message.type === 'initialized') {
    console.log('DevTools page initialized');
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('DevTools received runtime message:', JSON.stringify(message, null, 2));
  if (message.action === 'showCustomPanel' && customPanel) {
    customPanel.show(() => {
      console.log('Custom panel shown programmatically');
    });
    sendResponse({ status: 'success' });
  }
});


