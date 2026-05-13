/**
 * File Purpose: Minimal platform detection helpers for web vs Capacitor runtime.
 * Primary Functions: isCapacitor, getPlatform, isIos.
 * Inputs/Outputs: Reads window.Capacitor and returns booleans/platform labels.
 */

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform: () => boolean;
      getPlatform: () => string;
    };
  }
}

/** True when running inside a Capacitor native shell (Android/iOS). */
export function isCapacitor(): boolean {
  return (
    typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.()
  );
}

/** Returns the Capacitor platform string ("android", "ios", "web"). */
export function getPlatform(): string {
  return window.Capacitor?.getPlatform?.() ?? "web";
}

/**
 * True when running inside the iOS Capacitor shell.
 *
 * The iOS bundle is Apple-Intelligence-only by product decision: no provider
 * picker, no API keys, no cloud fallback. Web and Android keep the full
 * multi-provider machinery. Gate any cloud-fetch path with `if (!isIos())`
 * so iOS stays on FoundationModels exclusively.
 */
export function isIos(): boolean {
  return isCapacitor() && getPlatform() === "ios";
}
