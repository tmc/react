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

async function captureFullPageScreenshot(page, filename) {
  const client = await page.target().createCDPSession();
  
  try {
    // Get the browser window size
    const { windowWidth, windowHeight } = await client.send('Browser.getWindowForTarget');
    
    // Capture the full screenshot
    const { data } = await client.send('Page.captureScreenshot', {
      format: 'png',
      clip: { 
        x: 0, 
        y: 0, 
        width: windowWidth || 1920, 
        height: windowHeight || 1080, 
        scale: 1 
      }
    });

    fs.writeFileSync(filename, Buffer.from(data, 'base64'));
    debugLog('Test', `Full window screenshot saved as ${filename}`);
  } catch (error) {
    debugLog('Test', `Error capturing full page screenshot: ${error.message}`);
    
    // Fallback to capturing the viewport
    try {
      const screenshot = await page.screenshot({ path: filename, fullPage: true });
      debugLog('Test', `Fallback screenshot saved as ${filename}`);
    } catch (fallbackError) {
      debugLog('Test', `Error capturing fallback screenshot: ${fallbackError.message}`);
    }
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
      defaultViewport: null,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--auto-open-devtools-for-tabs',
        '--start-maximized',
        '--window-position=1921,0',  // Adjust these values based on your setup
        '--window-size=1920,1080'    // Adjust these values based on your setup
      ],
    });

    debugLog('Test', 'Opening new page');
    const page = await browser.newPage();

    // Enable the debugger for the page
    const client = await page.target().createCDPSession();
    await client.send('Debugger.enable');

    // Capture console logs
    client.on('Runtime.consoleAPICalled', (params) => {
      const { type, args } = params;
      const text = args.map(arg => arg.value || arg.description).join(' ');
      debugLog('Browser Console', `${type.toUpperCase()} ${text}`);
    });

    debugLog('Test', 'Navigating to React website');
    await page.goto('https://react.dev', { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for a moment to ensure DevTools is fully loaded
    await new Promise(resolve => setTimeout(resolve, 5000));

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

    // Capture full window screenshot
    await captureFullPageScreenshot(page, 'full_window_screenshot.png');

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
