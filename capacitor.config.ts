import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.hexodus.ios",
  appName: "Hexodus",
  webDir: "dist/public",
  // Production: ship info/warn/error to the native log but suppress the
  // debug-level bridge chatter (`⚡️ To Native ->` plugin call traces and
  // JS↔native message bodies) that we used during the FoundationModels
  // dispatch bisect. Switch back to 'debug' for diagnostic sessions.
  loggingBehavior: "production",
  plugins: {
    // Patch fetch + XMLHttpRequest in the WebView to route through native
    // HTTP (bypasses WKWebView CORS). Hexodus v1 has no cloud API; this stays
    // enabled so a future release (telemetry, sync) does not rediscover CORS
    // limits in WKWebView.
    CapacitorHttp: {
      enabled: true,
    },
    // Splash plugin keeps the native LaunchScreen visible until JS calls
    // SplashScreen.hide() in main.tsx after React mounts. Without this,
    // the launch storyboard disappears the instant Capacitor mounts the
    // WKWebView, leaving a blank screen for the rest of the boot
    // (~7-16s on cold launch per Xcode console traces).
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 0,
      // Matches dark boot (`client/src/main.tsx`) + LaunchScreen.storyboard.
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
