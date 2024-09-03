const puppeteer = require('puppeteer-extra');
const path = require('path');

async function runTest() {
  const extensionPath = path.join(__dirname);
  console.log('Launching browser with extension...');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--auto-open-devtools-for-tabs',
    ]
  });

  const targetPage = await browser.newPage();
  console.log('Navigating to target page...');
  await targetPage.goto('https://react.dev', { waitUntil: 'networkidle0' });

  console.log('Waiting for openMinimalReactDevtoolsCustomPanel function to be available...');
  await targetPage.waitForFunction(() => !!window.openMinimalReactDevtoolsCustomPanel, {
    timeout: 5000,
  });

  console.log('Calling openMinimalReactDevtoolsCustomPanel...');
  const result = await targetPage.evaluate(() => {
    if (typeof window.openMinimalReactDevtoolsCustomPanel === 'function') {
      console.log('Function exists, calling now...');
      window.openMinimalReactDevtoolsCustomPanel();
      return 'openMinimalReactDevtoolsCustomPanel called successfully';
    } else {
      console.error('Function openMinimalReactDevtoolsCustomPanel not found!');
      return 'Function not found';
    }
  });

  console.log('Result from function call:', result);

  // Additional logging to see if the panel opens correctly
  console.log('Checking if custom DevTools panel was opened...');

  // Add further checks if needed, depending on how you can verify the panel opened
  // Add a 4s sleep to see the panel
  console.log('Waiting for 4 seconds...');
  await new Promise(resolve => setTimeout(resolve, 40000));
  console.log('Closing browser...');
  await browser.close();
}

runTest().catch(error => {
  console.error('Error during test execution:', error);
});
