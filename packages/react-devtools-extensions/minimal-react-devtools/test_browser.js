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

async function openMinimalReactDevTools(devtoolsPage) {
  debugLog('Test', 'Attempting to open Minimal React DevTools');

  // Log all available tab titles
  const tabTitles = await devtoolsPage.evaluate(() => {
    return Array.from(document.querySelectorAll('.tabbed-pane-header-tab-title')).map(el => el.textContent);
  });
  debugLog('Test', `Available tabs: ${JSON.stringify(tabTitles)}`);

  // Look for the Minimal React panel and switch to it
  const panelFound = await devtoolsPage.evaluate(() => {
    const panelButton = Array.from(document.querySelectorAll('.tabbed-pane-header-tab-title'))
      .find(el => el.textContent.includes('Minimal React'));
    if (panelButton) {
      panelButton.click();
      return true;
    }
    return false;
  });

  if (!panelFound) {
    debugLog('Test', 'Minimal React DevTools panel not found');
    return false;
  }

  debugLog('Test', 'Minimal React DevTools panel opened');

  // Wait for the panel content to load
  await new Promise(resolve => setTimeout(resolve, 1000));

  return true;
}

module.exports = {
  getExtensionId,
  openMinimalReactDevTools,
};
