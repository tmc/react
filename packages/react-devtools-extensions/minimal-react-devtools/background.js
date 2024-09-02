console.log('Background script loaded');

chrome.runtime.onConnect.addListener(function(port) {
  console.log('Port connected:', port.name);
  if (port.name === "devtools-page") {
    port.onMessage.addListener(function(message) {
      console.log('Message received in background:', message);
      if (message.type === "inject-script") {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            files: ["inject.js"]
          }).then(() => console.log('inject.js injected')).catch(console.error);
        });
      } else if (message.type === "get-source" || message.type === "get-fiber-roots") {
        chrome.tabs.sendMessage(message.tabId, message);
      }
    });
  }
});

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('Message received in background:', message);
  if (message.type === "source-result" || message.type === "fiber-roots-result") {
    chrome.runtime.sendMessage(message);
  }
});
