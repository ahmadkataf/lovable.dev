/**
 * Build-time version of the web game, reported by `info()` when running in a plain browser.
 * Inside the Android wrapper the real versionName / versionCode come from the bridge instead.
 * Keep in step with package.json (tests/platform checks it).
 */
export const APP_VERSION_NAME = '1.0.0';
export const APP_VERSION_CODE = 1;
