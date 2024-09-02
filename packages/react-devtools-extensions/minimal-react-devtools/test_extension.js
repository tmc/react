const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const { debugLog, getDisplays } = require('./test_utils');
const { getExtensionId, openMinimalReactDevTools, captureScreenshot } = require('./test_browser');

puppeteer.use(require('puppeteer-extra-plugin-repl')())
//puppeteer.use(StealthPlugin());

async function runTest() {
  const extensionPath = path.join(__dirname, 'path/to/your/extension');

  const browser = await puppeteer.launch({
    headless: false,
    // devtools: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--auto-open-devtools-for-tabs',
    ]
  });

  // Open the target page
  const targetPage = await browser.newPage();
  await targetPage.goto('https://react.dev');
  await targetPage.repl();
  await browser.repl();

  // Wait for DevTools to open
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Find the DevTools target
  const targets = await browser.targets();
  const devtoolsTarget = targets.find((t) => {
    return t.type() === 'other' && t.url().startsWith('devtools://');
  });

  if (!devtoolsTarget) {
    console.error('DevTools target not found');
    await browser.close();
    return;
  }

  // Create a CDP session
  const client = await devtoolsTarget.createCDPSession();
  await client.send('Runtime.enable');

  // Switch to the Network panel and dock to bottom
  await client.send('Runtime.evaluate', {
    expression: `
      window.UI.viewManager.showView('network');
      window.UI.dockController.setDockSide('bottom');
    `
  });

  // Switch to your extension's panel
  await client.send('Runtime.evaluate', {
    expression: `
      const panelButton = Array.from(document.querySelectorAll('.tabbed-pane-header-tab-title'))
        .find(el => el.textContent.includes('Minimal React'));
      if (panelButton) panelButton.click();
    `
  });

  // Interact with your extension's panel
  const panelContent = await client.send('Runtime.evaluate', {
    expression: `
      const panel = document.querySelector('.panel.visible');
      panel ? panel.textContent : null;
    `
  });

  console.log('Panel content:', panelContent.result.value);

  // Perform your tests here...
  // For example, you can interact with your extension's UI:
  await client.send('Runtime.evaluate', {
    expression: `
      // Replace this with actual interactions with your extension's UI
      const searchInput = document.querySelector('#searchInput');
      if (searchInput) searchInput.value = 'TestComponent';

      const searchButton = document.querySelector('#searchButton');
      if (searchButton) searchButton.click();
    `
  });

  // Wait for any asynchronous operations in your extension
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Check the results of your interaction
  const searchResults = await client.send('Runtime.evaluate', {
    expression: `
      // Replace this with actual checks for your extension's behavior
      const results = document.querySelector('#searchResults');
      results ? results.textContent : 'No results found';
    `
  });

  console.log('Search results:', searchResults.result.value);

  await browser.close();
}

runTest().catch(console.error);
