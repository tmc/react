const puppeteer = require('puppeteer-extra');
const path = require('path');
const { exec, execSync } = require('child_process');
const fs = require('fs');

function debugLog(component, message) {
  console.log(`[${component}] ${message}`);
}

async function captureScreenshot(page, filename) {
  const windowSize = await page.evaluate(() => ({
    width: window.outerWidth,
    height: window.outerHeight,
    left: window.screenX,
    top: window.screenY
  }));
  await page.evaluate(() => window.focus());
  await new Promise(resolve => setTimeout(resolve, 1000));
  try {
    execSync(`screencapture -R${windowSize.left},${windowSize.top},${windowSize.width},${windowSize.height} ${filename}`);
    debugLog('Test', `Screenshot saved as ${filename}`);
  } catch (error) {
    debugLog('Test', `Error capturing specific region: ${error.message}`);
    debugLog('Test', 'Falling back to full screen capture');
    execSync(`screencapture ${filename}`);
  }
}

async function runTest() {
  const extensionPath = path.join(__dirname);
  debugLog('Test', 'Launching browser with extension...');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--auto-open-devtools-for-tabs',
    ]
  });

  const targetPage = await browser.newPage();
  targetPage.on('console', msg => debugLog('Page', msg.text()));
  debugLog('Test', 'Navigating to target page...');
  await targetPage.goto('https://react.dev', { waitUntil: 'networkidle0' });

  // Get the window ID of the browser
  const browserWindowId = await targetPage.evaluate(() => window.name);
  debugLog('Test', `Browser window ID: ${browserWindowId}`);

  // sleep 1s:
  await new Promise(resolve => setTimeout(resolve, 1000));
  // fix escape:
  const appleScriptCommand = `
    tell application "Google Chrome for Testing"
      activate
      tell application "System Events"
        keystroke "[" using command down
        key code 53
      end tell
    end tell
  `;
  
  exec(`osascript -e '${appleScriptCommand}'`, (error, stdout, stderr) => {
    if (error) {
      debugLog('Test', `Error executing AppleScript: ${error}`);
      return;
    }
    debugLog('Test', 'AppleScript executed successfully: cmd+[ sent to the correct Chrome window');
  });

  // Wait a bit for the DevTools to open
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Take screenshot
  debugLog('Test', 'Taking screenshot...');
  await captureScreenshot(targetPage, 'test_screenshot1.png');

  // Wait a bit for the DevTools to open
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Take screenshot
  debugLog('Test', 'Taking screenshot...');
  await captureScreenshot(targetPage, 'test_screenshot2.png');

  // Add a 4s sleep to see the panel
  debugLog('Test', 'Waiting for 4 seconds...');
  await new Promise(resolve => setTimeout(resolve, 4000));
  debugLog('Test', 'Closing browser...');
  await browser.close();

  // Log the screenshot path
  debugLog('Test', `Screenshot saved to: ${path.join(__dirname, 'test_screenshot.png')}`);
}

runTest().catch(error => {
  debugLog('Test', `Error during test execution: ${error}`);
});
