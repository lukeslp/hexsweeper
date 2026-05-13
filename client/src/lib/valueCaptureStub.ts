/**
 * File Purpose: Feature-flagged stub for economics / value-capture experiments (no StoreKit).
 * Primary Functions: isValueCaptureStubEnabled, get/setValueCaptureStubGranted.
 * Inputs/Outputs: Vite env + optional `?commerce=1`; persists `hexodus_value_capture_stub` in localStorage.
 */

const STORAGE_KEY = "hexodus_value_capture_stub";

function envFlagOn(): boolean {
  const v = import.meta.env.VITE_VALUE_CAPTURE_STUB;
  return v === "1" || v === "true";
}

/** True when the stub UI should surface (build flag or dev URL override). */
export function isValueCaptureStubEnabled(): boolean {
  if (typeof window === "undefined") return envFlagOn();
  if (envFlagOn()) return true;
  try {
    return new URLSearchParams(window.location.search).get("commerce") === "1";
  } catch {
    return false;
  }
}

export function getValueCaptureStubGranted(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function setValueCaptureStubGranted(granted: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, granted ? "1" : "0");
}
