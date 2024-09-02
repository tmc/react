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

  // Wait for DevTools to open (it should auto-open due to the launch flag)
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Find the DevTools target
  const targets = await browser.targets();
  const devtoolsTarget = targets.find((t) =>
    t.type() === 'other' && t.url().startsWith('devtools://'));

  if (!devtoolsTarget) {
    debugLog('Test', 'DevTools target not found');
    return false;
  }

  // Create a CDP session
  const client = await devtoolsTarget.createCDPSession();
  await client.send('Runtime.enable');

  // Switch to the Elements panel and dock to right (adjust as needed)
  await client.send('Runtime.evaluate', {
    expression: `
      window.UI.viewManager.showView('elements');
      window.UI.dockController.setDockSide('right');
    `
  });

  // Look for the Minimal React panel and switch to it
  const panelFound = await client.send('Runtime.evaluate', {
    expression: `
      const panelButton = Array.from(document.querySelectorAll('.tabbed-pane-header-tab-title'))
        .find(el => el.textContent.includes('Minimal React'));
      if (panelButton) {
        panelButton.click();
        true;
      } else {
        false;
      }
    `
  });

  if (!panelFound.result.value) {
    debugLog('Test', 'Minimal React DevTools panel not found');
    return false;
  }

  debugLog('Test', 'Minimal React DevTools panel opened');

  // Wait for the panel content to load
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Verify that the panel content has loaded
  const panelContent = await client.send('Runtime.evaluate', {
    expression: `
      const panel = document.querySelector('.panel.visible');
      panel ? panel.textContent : null;
    `
  });

  if (panelContent.result.value) {
    debugLog('Test', 'Panel content loaded successfully');
  } else {
    debugLog('Test', 'Panel content not found or empty');
  }

  // You can add more specific checks here to verify the panel's content

  return client; // Return the CDP client for further interactions
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
