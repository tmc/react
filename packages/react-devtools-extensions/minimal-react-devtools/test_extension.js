const puppeteer = require('puppeteer-extra');
const path = require('path');

async function runTest() {
  const extensionPath = path.join(__dirname);
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--auto-open-devtools-for-tabs',
    ]
  });

  const targetPage = await browser.newPage();
  await targetPage.goto('https://react.dev', { waitUntil: 'networkidle0' });

  // Wait for DevTools to open
  const devtoolsTarget = await waitForDevTools(browser);
  const devtoolsPage = await devtoolsTarget.page();

  // Connect to the DevTools protocol
  const client = await devtoolsPage.target().createCDPSession();

  // Define an array of panels to cycle through
  const panels = ['elements', 'console', 'network', 'sources'];

  // Cycle through the panels
  for (const panel of panels) {
    console.log(`Switching to ${panel} panel`);
    let x = await client.send('Runtime.evaluate', {
      expression: `UI.inspectorView.showPanel('${panel}')`
    });
    console.log('result:', x);
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

runTest().catch(console.error);
