chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', JSON.stringify(message, null, 2));

  if (message.type === 'commitFiberRoot') {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const tabId = tabs[0].id;
      console.log('Sending message to DevTools for tab:', tabId);
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
    console.log('Background received message from DevTools:', JSON.stringify(message, null, 2));
    if (message.type === 'init') {
      port.postMessage({type: 'initialized'});
    }
  });
});
