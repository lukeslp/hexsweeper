/**
 * File Purpose: Append-only localStorage log of session HUD diagnostics for beta analysis.
 * Primary Functions: appendSessionDiagSnapshot, loadSessionDiagSnapshots, exportSnapshotsJson.
 * Inputs/Outputs: JSON array under key `hexodus_session_diag_snapshots` (max 80 rows).
 */

export const SESSION_DIAG_STORAGE_KEY = "hexodus_session_diag_snapshots";
const MAX_ENTRIES = 80;

export interface SessionDiagSnapshot {
  at: number;
  /** Why this row was captured (restart persists prior session; export marks a pull). */
  reason: "restartRun" | "manualExport";
  runId: string;
  runFloor?: number;
  directorDressingCalls: number;
  directorFallbackCount: number;
  directorCircuitDegradedCount: number;
  directorPlatformFallbackCount?: number;
  generatorRimFallbackCount: number;
}

function parse(raw: string | null): SessionDiagSnapshot[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? (v as SessionDiagSnapshot[]) : [];
  } catch {
    return [];
  }
}

export function loadSessionDiagSnapshots(): SessionDiagSnapshot[] {
  if (typeof localStorage === "undefined") return [];
  return parse(localStorage.getItem(SESSION_DIAG_STORAGE_KEY));
}

export function appendSessionDiagSnapshot(row: SessionDiagSnapshot): void {
  if (typeof localStorage === "undefined") return;
  const prev = loadSessionDiagSnapshots();
  const next = [...prev, row].slice(-MAX_ENTRIES);
  localStorage.setItem(SESSION_DIAG_STORAGE_KEY, JSON.stringify(next));
}

export function exportSnapshotsJson(): string {
  return JSON.stringify(loadSessionDiagSnapshots(), null, 2);
}

export function clearSessionDiagSnapshots(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(SESSION_DIAG_STORAGE_KEY);
}
