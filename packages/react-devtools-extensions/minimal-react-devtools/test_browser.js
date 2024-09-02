const { execSync } = require('child_process');
const { debugLog } = require('./test_utils');

async function getExtensionId(browser) {
  debugLog('Test', 'Attempting to find extension ID');
  
  for (let i = 0; i < 5; i++) {
    const targets = await browser.targets();
    
    const serviceWorkerTarget = targets.find(
      target => target.type() === 'service_worker' && target.url().includes('chrome-extension://')
    );
    
    if (serviceWorkerTarget) {
      const extensionId = serviceWorkerTarget.url().match(/chrome-extension:\/\/([^/]+)/)[1];
      debugLog('Test', `Found extension ID from service worker: ${extensionId}`);
      return extensionId;
    }
    
    const backgroundPageTarget = targets.find(
      target => target.type() === 'background_page' && target.url().includes('chrome-extension://')
    );
    
    if (backgroundPageTarget) {
      const extensionId = backgroundPageTarget.url().match(/chrome-extension:\/\/([^/]+)/)[1];
      debugLog('Test', `Found extension ID from background page: ${extensionId}`);
      return extensionId;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Unable to find extension ID');
}

async function openMinimalReactDevTools(browser, extensionId) {
  debugLog('Test', 'Attempting to open Minimal React DevTools');

  for (let i = 0; i < 5; i++) {
    const backgroundPageTarget = await browser.targets().find(
      target => (target.type() === 'background_page' || target.type() === 'service_worker') && target.url().includes(extensionId)
    );

    if (backgroundPageTarget) {
      debugLog('Test', 'Found extension background page/service worker');
      const backgroundPage = await backgroundPageTarget.page();
      
      try {
        await backgroundPage.evaluate((extensionId) => {
          return new Promise((resolve) => {
            chrome.developerPrivate.openDevTools({
              extensionId: extensionId,
              renderViewId: -1,
              renderProcessId: -1,
              incognito: false
            }, () => {
              resolve();
            });
          });
        }, extensionId);
        
        debugLog('Test', 'Minimal React DevTools opened successfully');
        return;
      } catch (error) {
        debugLog('Test', `Error opening DevTools: ${error.message}`);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  debugLog('Test', 'Attempting fallback method to open DevTools');
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/panel.html`);
  await page.evaluate(() => {
    chrome.developerPrivate.openDevTools({
      extensionId: chrome.runtime.id,
      renderViewId: -1,
      renderProcessId: -1,
      incognito: false
    });
  });
  await page.close();

  debugLog('Test', 'Fallback method completed');
}

async function captureScreenshot(page, filename) {
  debugLog('Test', 'Capturing screenshot');

  const windowSize = await page.evaluate(() => ({
    width: window.outerWidth,
    height: window.outerHeight,
    left: window.screenX,
    top: window.screenY
  }));

  await page.evaluate(() => window.focus());
  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    execSync(`screencapture -R${windowSize.left},${windowSize.top},${windowSize.width},${windowSize.height} ${filename}`);
    debugLog('Test', `Screenshot saved as ${filename}`);
  } catch (error) {
    debugLog('Test', `Error capturing specific region: ${error.message}`);
    debugLog('Test', 'Falling back to full screen capture');
    execSync(`screencapture ${filename}`);
  }
}

module.exports = {
  getExtensionId,
  openMinimalReactDevTools,
  captureScreenshot,
};
