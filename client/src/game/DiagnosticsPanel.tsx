/**
 * File Purpose: Dev-only HUD panel for exercising async dressing + director metrics on device.
 * Primary Functions: DiagnosticsPanel — gated by `?diag=1` query string.
 * Inputs/Outputs: Callback props in; burst / null-streak / rim-sim actions out.
 */

export interface DiagnosticsPanelProps {
  /** When false, renders nothing (no layout cost). */
  enabled: boolean;
  /** Fire up to three rapid reveals on frontier keys (async race harness). */
  onBurstReveal: () => void;
  /** Next three director dressing calls return null (circuit breaker harness). */
  onForceDirectorNulls: () => void;
  /** Show rim-fallback HUD line without mutating generator truth. */
  onSimulateRimBanner: () => void;
}

export function DiagnosticsPanel({
  enabled,
  onBurstReveal,
  onForceDirectorNulls,
  onSimulateRimBanner,
}: DiagnosticsPanelProps) {
  if (!enabled) return null;

  return (
    <div className="pointer-events-auto mt-2 max-w-[min(28rem,calc(100vw-2rem))] space-y-2 border border-amber-500/40 bg-black/70 px-2 py-2 font-mono text-[10px] uppercase text-amber-100/95 backdrop-blur">
      <div className="text-[9px] text-amber-200/80">
        diag mode (?diag=1) — dev only
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-[44px] min-w-[44px] rounded border border-amber-400/50 px-2 py-1.5 hover:bg-amber-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          onClick={onBurstReveal}
        >
          Burst reveal
        </button>
        <button
          type="button"
          className="min-h-[44px] min-w-[44px] rounded border border-amber-400/50 px-2 py-1.5 hover:bg-amber-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          onClick={onForceDirectorNulls}
        >
          Force null ×3
        </button>
        <button
          type="button"
          className="min-h-[44px] min-w-[44px] rounded border border-amber-400/50 px-2 py-1.5 hover:bg-amber-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          onClick={onSimulateRimBanner}
        >
          Sim rim banner
        </button>
      </div>
    </div>
  );
}

export function readDiagQueryEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("diag") === "1";
}
