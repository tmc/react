const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

puppeteer.use(StealthPlugin());

const DEBUG = process.env.DEBUG === 'true';

function debugLog(component, message) {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${component}] ${message}`);
  }
}

function getDisplays() {
  const displayInfo = execSync('system_profiler SPDisplaysDataType -json').toString();
  const displays = JSON.parse(displayInfo).SPDisplaysDataType[0].spdisplays_ndrvs;
  console.log('displays', JSON.stringify(displays, null, 2));
  return displays.map((display, index) => {
    let width, height;
    if (display._spdisplays_pixels) {
      [width, height] = display._spdisplays_pixels.split(' x ').map(Number);
    } else if (display.spdisplays_resolution) {
      [width, height] = display.spdisplays_resolution.split(' @ ')[0].split(' x ').map(Number);
    } else {
      console.warn(`Unable to determine dimensions for display ${index}`);
      width = height = 0;
    }
    return {
      index,
      width,
      height,
      name: display._name
    };
  });
}

async function captureScreenshot(page, filename) {
  debugLog('Test', 'Capturing screenshot');

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
  debugLog('Test', 'Starting extension test');

  const extensionPath = path.join(__dirname);
  debugLog('Test', `Extension path: ${extensionPath}`);

  const displays = getDisplays();
  debugLog('Test', `Found ${displays.length} displays`);
  displays.forEach((display, index) => {
    debugLog('Test', `Display ${index}: ${display.name} (${display.width}x${display.height})`);
  });

  const targetDisplay = displays.length > 1 ? displays[1] : displays[0];
  debugLog('Test', `Using display: ${JSON.stringify(targetDisplay)}`);

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
        `--window-position=${targetDisplay.index * targetDisplay.width},0`,
        `--window-size=${targetDisplay.width},${targetDisplay.height}`,
      ],
      devtools: true,
    });

    debugLog('Test', 'Opening new page');
    const page = await browser.newPage();

    debugLog('Test', 'Navigating to React website');
    await page.goto('https://react.dev', { waitUntil: 'networkidle0', timeout: 30000 });

    await new Promise(resolve => setTimeout(resolve, 10000));

    await captureScreenshot(page, 'puppeteer_window.png');

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
  debugLog('Test', 'Test timed out after 60 seconds');
  process.exit(1);
}, 60 * 1000);

runTest().then(() => {
  clearTimeout(testTimeout);
  process.exit(0);
}).catch((error) => {
  console.error('Unhandled error in test:', error);
  process.exit(1);
});