/**
 * File Purpose: Session HUD diagnostic counters for director/generator degradation.
 * Primary Functions: useSessionDiagnostics — state + record + reset.
 * Inputs/Outputs: ExpansionDirectorOutput in; SessionDiagnostics state out.
 */
import { useCallback, useState } from "react";
import type { ExpansionDirectorOutput } from "@/game/lib/director";
import type { DressingMode } from "@/game/lib/dressingMode";
import type { HexKey } from "@/game/lib/types";

export interface CoherenceSample {
  key: HexKey;
  adjacentBlocked?: number;
  threatTone: string;
  flavor: string;
  source: string;
  dressingMode: DressingMode;
}

export interface SessionDiagnostics {
  directorDressingCalls: number;
  directorFallbackCount: number;
  directorCircuitDegradedCount: number;
  directorPlatformFallbackCount: number;
  generatorRimFallbackCount: number;
  lastDressingMode?: DressingMode;
  coherenceSamples: CoherenceSample[];
}

const MAX_COHERENCE_SAMPLES = 48;

const initial: SessionDiagnostics = {
  directorDressingCalls: 0,
  directorFallbackCount: 0,
  directorCircuitDegradedCount: 0,
  directorPlatformFallbackCount: 0,
  generatorRimFallbackCount: 0,
  coherenceSamples: [],
};

export function useSessionDiagnostics() {
  const [sessionDiag, setSessionDiag] = useState<SessionDiagnostics>(initial);

  const recordDirectorMetrics = useCallback(
    (output: ExpansionDirectorOutput, dressingMode: DressingMode) => {
      setSessionDiag(d => ({
        ...d,
        directorDressingCalls: d.directorDressingCalls + 1,
        directorFallbackCount:
          d.directorFallbackCount + (output.source === "fallback" ? 1 : 0),
        directorCircuitDegradedCount:
          d.directorCircuitDegradedCount + (output.degradedByCircuit ? 1 : 0),
        directorPlatformFallbackCount:
          d.directorPlatformFallbackCount +
          (output.platformUnavailable ? 1 : 0),
        lastDressingMode: dressingMode,
      }));
    },
    []
  );

  const appendCoherenceSamples = useCallback(
    (
      output: ExpansionDirectorOutput,
      cells: Array<{ key: HexKey; adjacentBlocked?: number }>,
      dressingMode: DressingMode
    ) => {
      const rows: CoherenceSample[] = cells.map(cell => {
        const dressing = output.tiles[cell.key];
        return {
          key: cell.key,
          adjacentBlocked: cell.adjacentBlocked,
          threatTone: dressing?.threatTone ?? "unknown",
          flavor: dressing?.flavor ?? "",
          source: dressing?.source ?? output.source,
          dressingMode,
        };
      });
      setSessionDiag(d => ({
        ...d,
        coherenceSamples: [...d.coherenceSamples, ...rows].slice(
          -MAX_COHERENCE_SAMPLES
        ),
      }));
    },
    []
  );

  const resetSessionDiag = useCallback(() => {
    setSessionDiag(initial);
  }, []);

  return {
    sessionDiag,
    setSessionDiag,
    recordDirectorMetrics,
    appendCoherenceSamples,
    resetSessionDiag,
  };
}
