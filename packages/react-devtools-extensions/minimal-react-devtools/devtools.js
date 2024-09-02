console.log('Minimal React DevTools Plus: DevTools script loaded');

chrome.devtools.panels.create(
  "Minimal React",
  "icons/icon16.png",
  "panel.html",
  function(panel) {
    console.log('Minimal React panel created');
  }
);

const backgroundPageConnection = chrome.runtime.connect({
  name: "devtools-page"
});

backgroundPageConnection.postMessage({
  name: 'init',
  tabId: chrome.devtools.inspectedWindow.tabId
});

backgroundPageConnection.onMessage.addListener(function(message) {
  if (message.type === 'reactDetected') {
    console.log('React detected on the page');
  }
});
