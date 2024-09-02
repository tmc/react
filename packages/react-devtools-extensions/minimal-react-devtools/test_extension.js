const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const DEBUG = process.env.DEBUG === 'true';

function debugLog(component, message) {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${component}] ${message}`);
  }
}

async function captureMainPageScreenshot(page, filename) {
  try {
    await page.screenshot({ path: filename, fullPage: true });
    debugLog('Test', `Screenshot saved as ${filename}`);
  } catch (error) {
    debugLog('Test', `Error capturing screenshot: ${error.message}`);
  }
}

async function findDevToolsTarget(browser, maxAttempts = 5, delay = 1000) {
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

    if (attempt < maxAttempts) {
      debugLog('Test', `DevTools target not found, waiting ${delay}ms before next attempt`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('DevTools target not found after multiple attempts');
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

    debugLog('Test', 'Navigating to React website');
    await page.goto('https://react.dev', { waitUntil: 'networkidle0', timeout: 30000 });

    debugLog('Test', 'Waiting for DevTools to initialize');
    const devToolsInitialized = await page.evaluate(() => {
      return new Promise(resolve => {
        let attempts = 0;
        const maxAttempts = 10;
        const checkInterval = setInterval(() => {
          attempts++;
          if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
            clearInterval(checkInterval);
            resolve({ initialized: true, attempts });
          }
          if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            resolve({ initialized: false, attempts });
          }
        }, 500);
      });
    });

    if (!devToolsInitialized.initialized) {
      debugLog('Test', `DevTools did not initialize within ${devToolsInitialized.attempts} attempts`);
    } else {
      debugLog('Test', `DevTools initialized successfully after ${devToolsInitialized.attempts} attempts`);
    }

    debugLog('Test', 'Checking window properties');
    const windowProps = await page.evaluate(() => {
      return {
        hasReactDevToolsGlobalHook: '__REACT_DEVTOOLS_GLOBAL_HOOK__' in window,
        hasMinimalReactDevToolsGlobalHook: '__MINIMAL_REACT_DEVTOOLS_GLOBAL_HOOK__' in window,
        react: window.React ? window.React.version : 'not found',
        reactDOM: window.ReactDOM ? window.ReactDOM.version : 'not found',
        documentReadyState: document.readyState,
        location: window.location.href,
      };
    });
    debugLog('Test', `Window properties: ${JSON.stringify(windowProps, null, 2)}`);

    await captureMainPageScreenshot(page, 'main_page_screenshot.png');

    debugLog('Test', 'Checking for React components');
    const reactComponentsExist = await client.send('Runtime.evaluate', {
      expression: `
        (function() {
          if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
            return {
              renderersSize: window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.size,
              hookTypes: Object.keys(window.__REACT_DEVTOOLS_GLOBAL_HOOK__),
            };
          }
          return null;
        })()
      `,
      returnByValue: true,
    });

    debugLog('Test', `React components check result: ${JSON.stringify(reactComponentsExist.result.value, null, 2)}`);

    debugLog('Test', 'Checking for Minimal React DevTools extension');
    const extensionExists = await client.send('Runtime.evaluate', {
      expression: 'typeof window.__MINIMAL_REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined"',
      returnByValue: true,
    });

    debugLog('Test', `Minimal React DevTools extension detected: ${extensionExists.result.value}`);

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
      debugLog('Test', 'Minimal React tab not found');
    } else {
      debugLog('Test', 'Minimal React tab found');

      debugLog('Test', 'Clicking Minimal React tab');
      await devtoolsClient.send('Runtime.evaluate', {
        expression: 'document.querySelector(\'div[data-testid="Minimal React"]\').click()',
        awaitPromise: true,
      });

      debugLog('Test', 'Checking for React components in DevTools');
      const componentsExist = await devtoolsClient.send('Runtime.evaluate', {
        expression: 'const componentsTree = document.querySelector("#tree"); componentsTree && componentsTree.children.length > 0',
        returnByValue: true,
      });

      if (componentsExist.result.value) {
        debugLog('Test', 'React components found in DevTools');
      } else {
        debugLog('Test', 'No React components found in DevTools');
      }
    }

    debugLog('Test', 'Taking DevTools screenshot');
    const screenshot = await devtoolsPage.screenshot({ fullPage: true });
    fs.writeFileSync('react_devtools_test.png', screenshot);

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
  debugLog('Test', 'Test timed out after 30 seconds');
  process.exit(1);
}, 30 * 1000);

runTest().then(() => {
  clearTimeout(testTimeout);
  process.exit(0);
}).catch((error) => {
  console.error('Unhandled error in test:', error);
  process.exit(1);
});