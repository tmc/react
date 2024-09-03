const puppeteer = require('puppeteer-extra');
const path = require('path');

async function runTest() {
  const extensionPath = path.join(__dirname);

  // Adjust these dimensions based on your screen resolution
  const screenWidth = 1920;
  const screenHeight = 1080;
  const windowWidth = 800;
  const windowHeight = screenHeight;

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--auto-open-devtools-for-tabs',
      `--window-size=${windowWidth},${windowHeight}`,
      `--window-position=${screenWidth - windowWidth},0`,
    ]
  });

  const targetPage = await browser.newPage();
  await targetPage.goto('https://react.dev', { waitUntil: 'networkidle0' });

  // Wait for DevTools to open
  const devtoolsTarget = await waitForDevTools(browser);
  const devtoolsPage = await devtoolsTarget.page();

  // Connect to the DevTools protocol
  const client = await devtoolsPage.target().createCDPSession();

  // Ensure DevTools is ready
  await ensureDevToolsReady(client);

  // Define an array of panels to cycle through
  const panels = ['elements', 'console', 'network', 'sources'];

  // Cycle through the panels
  for (const panel of panels) {
    await switchToPanel(client, panel);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before switching
  }

  // Close the browser
  await browser.close();
}

async function waitForDevTools(browser) {
  let devtoolsTarget;
  while (!devtoolsTarget) {
    const targets = await browser.targets();
    devtoolsTarget = targets.find((t) => t.url().startsWith('devtools://'));
    if (!devtoolsTarget) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  return devtoolsTarget;
}

async function ensureDevToolsReady(client) {
  const maxRetries = 10;
  let retryCount = 0;
  let isReady = false;

  while (retryCount < maxRetries && !isReady) {
    try {
      const result = await client.send('Runtime.evaluate', {
        expression: `typeof UI !== 'undefined' && typeof UI.inspectorView !== 'undefined'`,
        returnByValue: true,
      });
      console.log('DevTools ready check result:', result);

      if (result.result.value) {
        isReady = true;
        break;
      }
    } catch (error) {
      console.error('DevTools is not ready:', error);
    }

    retryCount += 1;
    console.log(`Retrying... (${retryCount}/${maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
  }

  if (!isReady) {
    throw new Error('DevTools was not ready after maximum retries');
  }
}

async function switchToPanel(client, panel) {
  try {
    const result = await client.send('Runtime.evaluate', {
      expression: `UI.inspectorView.panels`,
      returnByValue: true,
    });

    console.log(`Available panels:`, result.result);

    if (result.result && result.result.value && result.result.value[panel]) {
      const switchResult = await client.send('Runtime.evaluate', {
        expression: `UI.inspectorView.showPanel('${panel}')`,
      });
      console.log(`Switched to ${panel} panel result:`, switchResult);
    } else {
      console.log(`Panel ${panel} is not available.`);
    }
  } catch (error) {
    console.error(`Failed to switch to ${panel} panel:`, error);
  }
}

runTest().catch(console.error);
