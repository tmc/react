chrome.devtools.panels.create("Minimal React", "", "panel.html", function(panel) {});

const backgroundPageConnection = chrome.runtime.connect({
  name: "devtools-page"
});

backgroundPageConnection.postMessage({
  type: "inject-script",
  tabId: chrome.devtools.inspectedWindow.tabId
});

backgroundPageConnection.onMessage.addListener(function(message) {
  if (message.type === "source-result") {
    // Send the source to the panel
    chrome.runtime.sendMessage(message);
  }
});
