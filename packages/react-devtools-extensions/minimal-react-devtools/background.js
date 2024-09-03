chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.source === 'react-minimal-devtools-extension') {
    chrome.runtime.sendMessage(message);
  }

  if (message.action === 'showCustomPanel') {
    // Send a message to the devtools page to show the custom panel
    chrome.runtime.sendMessage({ action: 'showCustomPanel' });
    sendResponse({status: 'forwarded to devtools'});
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
