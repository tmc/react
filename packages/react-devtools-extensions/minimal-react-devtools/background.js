console.log('Minimal React DevTools Plus: Background script loaded');

const connections = {};

chrome.runtime.onConnect.addListener(function(port) {
  const extensionListener = function(message, sender, sendResponse) {
    if (message.name === "init") {
      connections[message.tabId] = port;
      return;
    }
  };

  port.onMessage.addListener(extensionListener);

  port.onDisconnect.addListener(function(port) {
    port.onMessage.removeListener(extensionListener);
    const tabs = Object.keys(connections);
    for (let i = 0, len = tabs.length; i < len; i++) {
      if (connections[tabs[i]] == port) {
        delete connections[tabs[i]];
        break;
      }
    }
  });
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (sender.tab) {
    const tabId = sender.tab.id;
    if (tabId in connections) {
      connections[tabId].postMessage(request);
    } else {
      console.log("Tab not found in connection list.");
    }
  } else {
    console.log("sender.tab not defined.");
  }
  return true;
});

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: "panel.html" });
});
