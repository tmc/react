const { execSync } = require('child_process');

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

module.exports = {
  debugLog,
  getDisplays,
};