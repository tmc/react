chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.source === 'react-minimal-devtools-extension') {
    chrome.runtime.sendMessage(message);
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.source === 'react-minimal-devtools-extension') {
    chrome.runtime.sendMessage(message);
  }
});
