console.log('Content script loaded');

window.addEventListener('message', function(event) {
  if (event.source !== window || !event.data) return;

  if (event.data.source === 'react-devtools-bridge') {
    console.log('Message from page to content script:', event.data);
    chrome.runtime.sendMessage(event.data.payload);
  }
});

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('Message from extension to content script:', message);
  window.postMessage({
    source: 'react-devtools-content-script',
    payload: message
  }, '*');
});
