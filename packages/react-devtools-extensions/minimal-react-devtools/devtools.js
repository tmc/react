console.log('Minimal React DevTools Plus: DevTools script loaded');

let panelWindow = null;

chrome.devtools.panels.create(
  'Minimal React',
  null,
  'panel.html',
  (panel) => {
    panel.onShown.addListener((window) => {
      panelWindow = window;
    });
    panel.onHidden.addListener(() => {
      panelWindow = null;
    });
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
  if (message.type === 'initialized') {
    console.log('DevTools page initialized');
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'panelMessage' && message.tabId === chrome.devtools.inspectedWindow.tabId) {
    if (panelWindow) {
      panelWindow.postMessage(message.data, '*');
    }
  }
});