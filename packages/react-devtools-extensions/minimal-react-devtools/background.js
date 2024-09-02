chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message);

  if (message.type === 'commitFiberRoot') {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const tabId = tabs[0].id;
      chrome.runtime.sendMessage({
        type: 'panelMessage',
        tabId: tabId,
        data: message
      });
    });
  }
});

chrome.runtime.onConnect.addListener((port) => {
  console.assert(port.name === 'devtools-page');
  port.onMessage.addListener((message) => {
    if (message.type === 'init') {
      port.postMessage({type: 'initialized'});
    }
  });
});