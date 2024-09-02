const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');

puppeteer.use(StealthPlugin());

const DEBUG = process.env.DEBUG === 'true';

function debugLog(component, message) {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${component}] ${message}`);
  }
}

async function runTest() {
  debugLog('Test', 'Starting extension test');

  const extensionPath = path.join(__dirname);
  debugLog('Test', `Extension path: ${extensionPath}`);

  let browser;
  try {
    debugLog('Test', 'Launching browser');
    browser = await puppeteer.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--auto-open-devtools-for-tabs'
      ],
      defaultViewport: null,
    });

    debugLog('Test', 'Opening new page');
    const page = await browser.newPage();

    // Capture console logs
    page.on('console', message => {
      debugLog('Browser Console', `${message.type().substr(0, 3).toUpperCase()} ${message.text()}`);
    });

    debugLog('Test', 'Navigating to React website');
    await page.goto('https://react.dev', { waitUntil: 'networkidle0' });

    debugLog('Test', 'Waiting for page content to load');
    await page.waitForSelector('body', { timeout: 10000 });

    debugLog('Test', 'Checking for React components');
    const reactComponentsExist = await page.evaluate(() => {
      return window.__REACT_DEVTOOLS_GLOBAL_HOOK__ && window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.size > 0;
    });

    debugLog('Test', `React components detected: ${reactComponentsExist}`);

    debugLog('Test', 'Waiting for DevTools to open');
    await page.waitForTimeout(5000);

    debugLog('Test', 'Looking for DevTools target');
    const targets = await browser.targets();
    const devtoolsTarget = targets.find(target =>
      target.url().includes('chrome-devtools://') && target.url().includes('panel.html')
    );

    if (!devtoolsTarget) {
      throw new Error('DevTools target not found');
    }

    debugLog('Test', 'Attaching to DevTools page');
    const devtoolsPage = await devtoolsTarget.page();
    if (!devtoolsPage) {
      throw new Error('Could not get DevTools page');
    }

    // Capture console logs for DevTools page
    devtoolsPage.on('console', message => {
      debugLog('DevTools Console', `${message.type().substr(0, 3).toUpperCase()} ${message.text()}`);
    });

    debugLog('Test', 'Looking for Minimal React tab');
    await devtoolsPage.waitForSelector('div[data-testid="Minimal React"]', { timeout: 10000 });
    debugLog('Test', 'Minimal React tab found');

    debugLog('Test', 'Clicking Minimal React tab');
    await devtoolsPage.click('div[data-testid="Minimal React"]');

    debugLog('Test', 'Checking for React components in DevTools');
    const componentsExist = await devtoolsPage.evaluate(() => {
      const componentsTree = document.querySelector('#components-tree');
      return componentsTree && componentsTree.children.length > 0;
    });

    if (componentsExist) {
      debugLog('Test', 'React components found in DevTools');
    } else {
      throw new Error('No React components found in DevTools');
    }

    debugLog('Test', 'Taking screenshot');
    await devtoolsPage.screenshot({ path: 'react_devtools_test.png', fullPage: true });

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

runTest();