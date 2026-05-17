/**
 * File Purpose: Scrolling monospace terminal for iris.exe + deterministic events.
 * Primary Functions: TerminalPanel
 * Inputs/Outputs: Read-only line list; auto-scroll; typewriter for iris channel.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import type { TerminalLine } from "@/game/lib/terminalLog";

export type TerminalLayout = "boot" | "strip";

export interface TerminalPanelProps {
  lines: TerminalLine[];
  layout: TerminalLayout;
  /** When true, skip typewriter / glitch styling. */
  reducedMotion: boolean;
}

export function TerminalPanel({
  lines,
  layout,
  reducedMotion,
}: TerminalPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [typedById, setTypedById] = useState<Record<number, string>>({});

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines]);

  const lastIrisId = useMemo(() => {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].channel === "iris") return lines[i].id;
    }
    return null;
  }, [lines]);

  useEffect(() => {
    if (reducedMotion) {
      const next: Record<number, string> = {};
      for (const line of lines) {
        if (line.channel === "iris") next[line.id] = line.text;
      }
      setTypedById(next);
      return;
    }

    const irisLines = lines.filter(l => l.channel === "iris");
    const last = irisLines[irisLines.length - 1];
    if (!last) return;

    let cancelled = false;
    let i = 0;
    const full = last.text;
    const tick = () => {
      if (cancelled) return;
      i = Math.min(i + 2, full.length);
      setTypedById(prev => ({ ...prev, [last.id]: full.slice(0, i) }));
      if (i < full.length) {
        window.setTimeout(tick, 28);
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [lastIrisId, lines, reducedMotion]);

  const outer =
    layout === "boot"
      ? "flex min-h-[140px] flex-1 flex-col border border-emerald-500/25 bg-black/60 p-3 text-[12px] leading-snug"
      : "pointer-events-auto max-h-[28vh] min-h-[7rem] w-full max-w-full border border-emerald-500/25 bg-black/45 px-2 py-1.5 text-[10px] leading-snug backdrop-blur-sm sm:max-w-[min(36rem,calc(100vw-1rem))]";

  return (
    <div
      className={outer}
      aria-label="iris.exe terminal log"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-400/90">
        iris.exe // session
      </div>
      <div className="max-h-[min(50vh,22rem)] flex-1 overflow-y-auto font-mono">
        {lines.map(line => {
          const display =
            line.channel === "iris"
              ? (typedById[line.id] ?? (reducedMotion ? line.text : ""))
              : line.text;
          const cls =
            line.channel === "iris"
              ? "text-rose-300/95 drop-shadow-[0_0_6px_rgba(251,113,133,0.35)]"
              : line.channel === "map"
                ? "text-cyan-400/90"
                : "text-emerald-500/80";
          return (
            <div
              key={line.streamKey ?? line.id}
              className={`whitespace-pre-wrap break-words ${cls}`}
            >
              {display}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
