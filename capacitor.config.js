// Plain JS rather than .ts on purpose: this repo ships a prebuilt static
// payload and has no TypeScript source, and @capacitor/cli requires a full
// typescript install just to read a .ts config.

/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  // Retained from the retired Hivescape record so the existing App Store
  // Connect app (and its build history) carries forward. Deliberately does
  // not match the product name — see README.
  appId: "app.hexodus.ios",
  appName: "Hexsweeper",
  // Vendored static payload from lukeslp/hexsweeper — see www/SOURCE.txt.
  // No bundler runs here; www/ is already the finished game.
  webDir: "www",
  loggingBehavior: "production",
  plugins: {
    // Keeps the native LaunchScreen up until the game calls
    // SplashScreen.hide() after its first painted frame (boot snippet
    // injected by export-collection.py --app). Without this the storyboard
    // drops the instant the WebView mounts, showing a blank canvas while
    // hexasphere builds the board.
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 0,
      // Matches LaunchScreen.storyboard's background.
      backgroundColor: "#0a0a0a",
      showSpinner: true,
      iosSpinnerStyle: "medium",
      spinnerColor: "#10b981",
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
