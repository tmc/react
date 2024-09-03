const puppeteer = require('puppeteer-extra');
const path = require('path');
const { exec } = require('child_process');

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
  targetPage.on('console', msg => console.log('Page log:', msg.text()));
  console.log('Navigating to target page...');
  await targetPage.goto('https://react.dev', { waitUntil: 'networkidle0' });

  // Use AppleScript to send "cmd+[" to switch tabs
  exec(`osascript -e 'tell application "System Events" to keystroke "[" using {command down}'`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing AppleScript: ${error}`);
      return;
    }
    console.log('AppleScript executed successfully: cmd+[ sent');
  });

  // Take screenshot

  // Add a 4s sleep to see the panel
  console.log('Waiting for 4 seconds...');
  await new Promise(resolve => setTimeout(resolve, 4000));
  console.log('Closing browser...');
  await browser.close();
}

runTest().catch(error => {
  console.error('Error during test execution:', error);
});
