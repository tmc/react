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

    // Use chrome.debugger API to interact with DevTools
    debugLog('Test', 'Attaching debugger');
    await client.send('Debugger.enable');

    debugLog('Test', 'Getting document root');
    const root = await client.send('DOM.getDocument');
    debugLog('Test', `Document root: ${JSON.stringify(root, null, 2)}`);

    debugLog('Test', 'Searching for Minimal React tab');
    const minimalReactTab = await client.send('DOM.querySelector', {
      nodeId: root.root.nodeId,
      selector: 'div[data-testid="Minimal React"]'
    });

    if (minimalReactTab.nodeId) {
      debugLog('Test', 'Minimal React tab found');
      
      debugLog('Test', 'Clicking Minimal React tab');
      await client.send('DOM.focus', { nodeId: minimalReactTab.nodeId });
      await client.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        button: 'left',
        clickCount: 1,
      });
      await client.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        button: 'left',
        clickCount: 1,
      });

      debugLog('Test', 'Checking for React components in DevTools');
      const componentsTree = await client.send('DOM.querySelector', {
        nodeId: root.root.nodeId,
        selector: '#tree'
      });

      if (componentsTree.nodeId) {
        const children = await client.send('DOM.getChildren', { nodeId: componentsTree.nodeId });
        debugLog('Test', `React components found in DevTools: ${children.children.length}`);
      } else {
        debugLog('Test', 'No React components found in DevTools');
      }
    } else {
      debugLog('Test', 'Minimal React tab not found');
    }

    debugLog('Test', 'Taking screenshot');
    const screenshot = await page.screenshot({ fullPage: true });
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