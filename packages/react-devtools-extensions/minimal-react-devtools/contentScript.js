window.addEventListener('message', function(event) {
  if (event.source !== window || !event.data) return;

  if (event.data.source === 'react-devtools-bridge') {
    chrome.runtime.sendMessage(event.data.payload);
  }
});

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === "get-source") {
    window.postMessage({
      source: 'react-devtools-content-script',
      payload: { type: "get-source", id: message.id }
    }, '*');
  } else {
    window.postMessage({
      source: 'react-devtools-content-script',
      payload: message
    }, '*');
  }
});
