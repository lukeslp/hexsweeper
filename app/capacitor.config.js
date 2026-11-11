// Plain JS rather than .ts on purpose: this repo ships a prebuilt static
// payload and has no TypeScript source, and @capacitor/cli requires a full
// typescript install just to read a .ts config.

// Capacitor 8 loads a JavaScript config through `require()`, so this deliberately
// uses CommonJS. An ESM default export is wrapped as `{ default: ... }` and makes
// `cap add` think appId is missing.
// Retained from the retired Hivescape record so the existing App Store record
// carries forward. Android shares this valid application id to avoid a second
// environment-specific config.
const appId = "app.hexodus.ios";
const appName = "Hexsweeper";
// Vendored static payload from lukeslp/hexsweeper — see WWW_SOURCE.txt.
// No bundler runs here; www/ is already the finished game.
const webDir = "www";
const loggingBehavior = "production";
const plugins = {
  // Keeps the native launch screen up until the game calls SplashScreen.hide()
  // after its first painted frame (boot snippet injected by the app export).
  // Without this the native screen drops while the game builds its board.
  SplashScreen: {
    launchAutoHide: false,
    launchShowDuration: 0,
    // Matches the native launch backgrounds.
    backgroundColor: "#0a0a0a",
    showSpinner: true,
    iosSpinnerStyle: "medium",
    spinnerColor: "#10b981",
    splashFullScreen: true,
    splashImmersive: true,
  },
};

/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId,
  appName,
  webDir,
  loggingBehavior,
  plugins,
};

module.exports = config;
