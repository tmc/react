chrome.runtime.onConnect.addListener(function(port) {
  if (port.name === "devtools-page") {
    port.onMessage.addListener(function(message) {
      if (message.type === "inject-script") {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            files: ["inject.js"]
          });
        });
      } else if (message.type === "get-source") {
        chrome.tabs.sendMessage(message.tabId, {type: "get-source", id: message.id});
      }
    });
  }
});

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === "source-result") {
    chrome.runtime.sendMessage(message);
  }
});
