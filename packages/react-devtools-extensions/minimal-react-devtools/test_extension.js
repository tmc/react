const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const { debugLog, getDisplays } = require('./test_utils');
const { getExtensionId, openMinimalReactDevTools, captureScreenshot } = require('./test_browser');

puppeteer.use(StealthPlugin());

async function runTest() {
  debugLog('Test', 'Starting extension test');

  const extensionPath = path.join(__dirname);
  debugLog('Test', `Extension path: ${extensionPath}`);

  const displays = getDisplays();
  debugLog('Test', `Found ${displays.length} displays`);
  displays.forEach((display, index) => {
    debugLog('Test', `Display ${index}: ${display.name} (${display.width}x${display.height})`);
  });

  const targetDisplay = displays.length > 1 ? displays[1] : displays[0];
  debugLog('Test', `Using display: ${JSON.stringify(targetDisplay)}`);

  let browser;
  try {
    debugLog('Test', 'Launching browser');
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--auto-open-devtools-for-tabs',
        `--window-position=${targetDisplay.index * targetDisplay.width},0`,
        `--window-size=${targetDisplay.width},${targetDisplay.height}`,
      ],
    });

    const extensionId = await getExtensionId(browser);
    debugLog('Test', `Extension ID: ${extensionId}`);

    debugLog('Test', 'Opening new page');
    const page = await browser.newPage();

    debugLog('Test', 'Navigating to React website');
    await page.goto('https://react.dev', { waitUntil: 'networkidle0', timeout: 30000 });

    await openMinimalReactDevTools(browser, extensionId);

    debugLog('Test', 'Waiting for DevTools to stabilize');
    await new Promise(resolve => setTimeout(resolve, 10000));

    debugLog('Test', 'Bringing main page to front');
    const pages = await browser.pages();
    const mainPage = pages.find(p => p.url().includes('react.dev'));
    if (mainPage) {
      await mainPage.bringToFront();
    }

    await captureScreenshot(mainPage || page, 'puppeteer_window.png');

    debugLog('Test', 'Test completed successfully');
  } catch (error) {
    debugLog('Test', `Error occurred: ${error.message}`);
    console.error(error);
  } finally {
    if (browser) {
      debugLog('Test', 'Closing browser');
      await browser.close();
    }
  }
}

const testTimeout = setTimeout(() => {
  debugLog('Test', 'Test timed out after 60 seconds');
  process.exit(1);
}, 60 * 1000);

runTest().then(() => {
  clearTimeout(testTimeout);
  process.exit(0);
}).catch((error) => {
  console.error('Unhandled error in test:', error);
  process.exit(1);
});
