console.log('Minimal React DevTools Plus: Content script loaded');

const inject = () => {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
};

inject();

window.addEventListener('message', function(event) {
  if (event.source !== window || !event.data) return;

  if (event.data.source === 'minimal-react-devtools-bridge') {
    chrome.runtime.sendMessage(event.data.payload);
  }
});

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  window.postMessage({
    source: 'minimal-react-devtools-content-script',
    payload: message
  }, '*');
});
