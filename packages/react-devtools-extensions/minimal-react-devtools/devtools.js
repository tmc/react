console.log('DevTools script loaded');

chrome.devtools.panels.create("React", "", "panel.html", function(panel) {
  console.log('React panel created');
});

const backgroundPageConnection = chrome.runtime.connect({
  name: "devtools-page"
});

console.log('Sending inject-script message');
backgroundPageConnection.postMessage({
  type: "inject-script",
  tabId: chrome.devtools.inspectedWindow.tabId
});

backgroundPageConnection.onMessage.addListener(function(message) {
  console.log('Message received in devtools:', message);
  if (message.type === "source-result" || message.type === "fiber-roots-result") {
    chrome.runtime.sendMessage(message);
  }
});

// Request fiber roots after a short delay to ensure inject.js has run
setTimeout(() => {
  console.log('Requesting fiber roots');
  backgroundPageConnection.postMessage({
    type: "get-fiber-roots",
    tabId: chrome.devtools.inspectedWindow.tabId
  });
}, 1000);
