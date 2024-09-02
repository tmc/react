console.log('Minimal React DevTools Plus: Content script loaded');

function injectScript(file) {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL(file);
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

injectScript('inject.js');

window.addEventListener('message', function(event) {
  console.log('Content script received message:', event);
  if (event.source !== window || !event.data) return;

  if (event.data.source === 'minimal-react-devtools-bridge') {
    console.log('Forwarding message to extension:', event.data);
    chrome.runtime.sendMessage(event.data.payload);
  }
});

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('Content script received runtime message:', JSON.stringify(message, null, 2));
  window.postMessage({
    source: 'minimal-react-devtools-content-script',
    payload: message
  }, '*');
});
