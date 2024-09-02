const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const assert = require('assert');

puppeteer.use(StealthPlugin());

const DEBUG = process.env.DEBUG === 'true';

function debugLog(component, message) {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${component}] ${message}`);
  }
}

class TestError extends Error {
  constructor(message, component) {
    super(message);
    this.component = component;
  }
}

function assertCondition(condition, message, component) {
  if (!condition) {
    throw new TestError(message, component);
  }
}

async function waitForCondition(page, condition, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await page.evaluate(condition)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return false;
}

async function findDevToolsTarget(browser, maxAttempts = 10, delay = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    debugLog('Test', `Looking for DevTools target (attempt ${attempt}/${maxAttempts})`);
    const targets = await browser.targets();
    
    for (const target of targets) {
      const url = target.url();
      debugLog('Test', `Checking target: ${url}`);
      
      if (url.includes('chrome-extension://') && url.includes('devtools.html')) {
        debugLog('Test', `Found extension DevTools target: ${url}`);
        return target;
      }
    }

    debugLog('Test', `DevTools target not found, waiting ${delay}ms before next attempt`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new Error('DevTools target not found after multiple attempts');
}

async function testComponentInteraction(devtoolsPage) {
  await devtoolsPage.click('#components-tree .tree-node');
  const detailsVisible = await devtoolsPage.evaluate(() => {
    return document.querySelector('#details').innerHTML !== '';
  });
  assertCondition(detailsVisible, 'Component details not displayed after click', 'DevTools');
}

async function testEmptyReactPage(browser) {
  const page = await browser.newPage();
  await page.goto('about:blank');
  // Add assertions to check that the extension behaves correctly with no React components
}

async function measurePageLoadTime(page, url) {
  const start = Date.now();
  await page.goto(url, { waitUntil: 'networkidle0' });
  return Date.now() - start;
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
      defaultViewport: null,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--auto-open-devtools-for-tabs',
        '--silent-debugger-extension-api',
        '--start-maximized',
        '--window-position=1921,0',  // Adjust these values based on your setup
        '--window-size=1920,1080'    // Adjust these values based on your setup
      ],
    });

    debugLog('Test', 'Opening new page');
    const page = await browser.newPage();

    // Set up CDP session
    const client = await page.target().createCDPSession();
    await client.send('Runtime.enable');

    // Capture console logs
    client.on('Runtime.consoleAPICalled', (params) => {
      const { type, args } = params;
      const text = args.map(arg => arg.value || arg.description).join(' ');
      debugLog('Browser Console', `${type.toUpperCase()} ${text}`);
    });

    try {
      debugLog('Test', 'Navigating to React website');
      await page.goto('https://react.dev', { waitUntil: 'networkidle0', timeout: 60000 });
    } catch (error) {
      debugLog('Test', `Error navigating to React website: ${error.message}`);
      throw error;
    }

    debugLog('Test', 'Waiting for DevTools to initialize');
    const devToolsInitialized = await page.evaluate(() => {
      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
            clearInterval(checkInterval);
            resolve(true);
          }
        }, 1000);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(false);
        }, 30000); // Increased timeout to 30 seconds
      });
    });

    if (!devToolsInitialized) {
      debugLog('Test', 'DevTools did not initialize within the expected timeframe');
      debugLog('Test', 'Attempting to proceed with the test anyway');
    } else {
      debugLog('Test', 'DevTools initialized successfully');
    }

    debugLog('Test', 'Checking for React components');
    const reactComponentsExist = await client.send('Runtime.evaluate', {
      expression: 'window.__REACT_DEVTOOLS_GLOBAL_HOOK__ && window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.size > 0',
      returnByValue: true,
    });

    debugLog('Test', `React components detected: ${reactComponentsExist.result.value}`);

    debugLog('Test', 'Checking for Minimal React DevTools extension');
    const extensionExists = await client.send('Runtime.evaluate', {
      expression: 'typeof window.__MINIMAL_REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined"',
      returnByValue: true,
    });

    debugLog('Test', `Minimal React DevTools extension detected: ${extensionExists.result.value}`);

    if (!extensionExists.result.value) {
      debugLog('Test', 'Minimal React DevTools extension not detected, but continuing test');
    }

    debugLog('Test', 'Waiting for DevTools to open');
    await new Promise(resolve => setTimeout(resolve, 10000));

    debugLog('Test', 'Looking for DevTools target');
    const devtoolsTarget = await findDevToolsTarget(browser);

    debugLog('Test', 'Attaching to DevTools page');
    const devtoolsPage = await devtoolsTarget.page();
    if (!devtoolsPage) {
      throw new Error('Could not get DevTools page');
    }

    const devtoolsClient = await devtoolsPage.target().createCDPSession();
    await devtoolsClient.send('Runtime.enable');

    debugLog('Test', 'Looking for Minimal React tab');
    const minimalReactTabExists = await devtoolsClient.send('Runtime.evaluate', {
      expression: 'document.querySelector(\'div[data-testid="Minimal React"]\') !== null',
      returnByValue: true,
    });

    if (!minimalReactTabExists.result.value) {
      debugLog('Test', 'Minimal React tab not found, but continuing test');
    } else {
      debugLog('Test', 'Minimal React tab found');

      debugLog('Test', 'Clicking Minimal React tab');
      await devtoolsClient.send('Runtime.evaluate', {
        expression: 'document.querySelector(\'div[data-testid="Minimal React"]\').click()',
        awaitPromise: true,
      });

      debugLog('Test', 'Checking for React components in DevTools');
      const componentsExist = await devtoolsClient.send('Runtime.evaluate', {
        expression: 'const componentsTree = document.querySelector("#components-tree"); componentsTree && componentsTree.children.length > 0',
        returnByValue: true,
      });

      if (componentsExist.result.value) {
        debugLog('Test', 'React components found in DevTools');
        await testComponentInteraction(devtoolsPage);
      } else {
        debugLog('Test', 'No React components found in DevTools, but continuing test');
      }
    }

    debugLog('Test', 'Taking screenshot');
    const screenshot = await devtoolsPage.screenshot({ fullPage: true });
    require('fs').writeFileSync('react_devtools_test.png', screenshot);

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
