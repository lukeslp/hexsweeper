/**
 * File Purpose: A/B toggle between procedural tile labels and @Generable FM tile batches.
 * Primary Functions: getDressingMode, setDressingMode, cycleDressingMode, readDressingModeFromUrl.
 * Inputs/Outputs: localStorage + optional ?dressing= query when ?diag=1.
 */

export type DressingMode = "procedural" | "generable";

const STORAGE_KEY = "hexodus_dressing_mode";
const DEFAULT_MODE: DressingMode = "procedural";

function parseMode(raw: string | null): DressingMode | null {
  if (raw === "procedural" || raw === "generable") return raw;
  return null;
}

/** URL override: `?diag=1&dressing=generable` (diag required so production URLs stay stable). */
export function readDressingModeFromUrl(): DressingMode | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("diag") !== "1") return null;
  return parseMode(params.get("dressing"));
}

export function getDressingMode(): DressingMode {
  const fromUrl = readDressingModeFromUrl();
  if (fromUrl) return fromUrl;
  if (typeof localStorage === "undefined") return DEFAULT_MODE;
  return parseMode(localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_MODE;
}

export function setDressingMode(mode: DressingMode): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, mode);
  }
}

export function cycleDressingMode(): DressingMode {
  const next: DressingMode =
    getDressingMode() === "procedural" ? "generable" : "procedural";
  setDressingMode(next);
  return next;
}
