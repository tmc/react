const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const { debugLog } = require('./test_utils');
const { getExtensionId, openMinimalReactDevTools } = require('./test_browser');

puppeteer.use(require('puppeteer-extra-plugin-repl')())
//puppeteer.use(StealthPlugin());

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

  browser.on('targetcreated', async (target) => {
    if (target.type() === 'background_page' || target.type() === 'service_worker') {
      try {
        const backgroundPage = await target.page();
        if (backgroundPage) {
          backgroundPage.on('console', msg => console.log('Background:', msg.text()));
        }
      } catch (error) {
        console.log('Error accessing background page:', error.message);
      }
    }
  });

  // Open the target page
  const targetPage = await browser.newPage();
  await targetPage.goto('https://react.dev');
  targetPage.on('console', msg => console.log('Content:', msg.text()));

  // Check content script injection immediately after page load
  await targetPage.evaluate(() => {
    console.log('Page script: Checking for content script');
    if (window.__MINIMAL_REACT_DEVTOOLS_GLOBAL_HOOK__) {
      console.log('Page script: Content script injected successfully');
    } else {
      console.log('Page script: Content script not found');
    }
  });

  // Wait for DevTools to open
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Find the DevTools target
  const targets = await browser.targets();
  console.log("Available targets:");
  targets.forEach(t => console.log(`- Type: ${t.type()}, URL: ${t.url()}`));

  const devtoolsTarget = targets.find((t) => t.url().startsWith('devtools://'));

if (devtoolsTarget) {
  let devtoolsPage;
  try {
    devtoolsPage = await devtoolsTarget.page();
    if (devtoolsPage) {
      const title = await devtoolsPage.title();
      const url = devtoolsPage.url();
      console.log(`DevTools page title: ${title}, URL: ${url}`);
      devtoolsPage.on('console', msg => console.log('DevTools Console:', msg.text()));

      // Log the HTML content of the DevTools page
      const htmlContent = await devtoolsPage.content();
      console.log('DevTools page HTML content:', htmlContent);

    } else {
      console.log("Unable to get DevTools page");
    }
  } catch (error) {
    console.log("Error getting DevTools page:", error.message);
    devtoolsPage = null;
  }

  // Open Minimal React DevTools
  if (devtoolsPage) {
    const minimalReactDevToolsOpened = await openMinimalReactDevTools(devtoolsPage);

    if (minimalReactDevToolsOpened) {
      console.log('Minimal React DevTools panel opened successfully');
      // ... (rest of the code remains the same)
    } else {
      console.log('Failed to open Minimal React DevTools panel');

      // Log all iframes in the DevTools page
      const iframes = await devtoolsPage.frames();
      console.log(`Number of iframes: ${iframes.length}`);
      for (let i = 0; i < iframes.length; i++) {
        console.log(`iframe ${i} URL: ${iframes[i].url()}`);
      }
    }
  } else {
    console.log("Unable to interact with DevTools page");
  }
} else {
  console.log("DevTools target not found");
}

  // Modify the extension DevTools target section
  const devtoolsExtensionTargets = targets.filter(t => t.url().includes('chrome-extension') && t.url().includes('devtools.html'));
  console.log(`Found ${devtoolsExtensionTargets.length} extension DevTools targets`);

  for (const target of devtoolsExtensionTargets) {
    console.log(`Examining extension DevTools target: ${target.url()}`);
    try {
      const page = await target.page();
      if (page) {
        console.log('Extension DevTools page loaded:', await page.evaluate(() => document.readyState === 'complete'));
        console.log('Extension DevTools page title:', await page.title());
        console.log('Extension DevTools page content:', await page.content());
      } else {
        console.log('Unable to get page for this target');
      }
    } catch (error) {
      console.log(`Error accessing extension DevTools page: ${error.message}`);
    }
  }

  if (devtoolsExtensionTargets.length === 0) {
    console.log('No extension DevTools pages found');
  }

  // Modify the background script section
  const backgroundTargets = targets.filter(t => t.type() === 'service_worker' && t.url().includes('background.js'));
  console.log(`Found ${backgroundTargets.length} background script targets`);

  for (const target of backgroundTargets) {
    console.log(`Examining background script target: ${target.url()}`);
    try {
      const worker = await target.worker();
      if (worker) {
        console.log('Background script is running');
        worker.on('console', msg => console.log('Background console:', msg.text()));
      } else {
        console.log('Unable to get worker for this background script target');
      }
    } catch (error) {
      console.log(`Error accessing background script: ${error.message}`);
    }
  }

  if (backgroundTargets.length === 0) {
    console.log('No background script targets found');
  }

  await browser.close();
}

runTest().catch(console.error);
