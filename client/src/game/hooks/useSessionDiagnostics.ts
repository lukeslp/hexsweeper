/**
 * File Purpose: Session HUD diagnostic counters for director/generator degradation.
 * Primary Functions: useSessionDiagnostics — state + record + reset + coherence samples.
 * Inputs/Outputs: ExpansionDirectorOutput in; SessionDiagnostics state out.
 */
import { useCallback, useState } from "react";
import type { ExpansionDirectorOutput } from "@/game/lib/director";
import type { HexKey } from "@/game/lib/types";

export interface DressingCoherenceSample {
  key: HexKey;
  adjacentBlocked: number | null;
  threatTone: string;
  flavor: string;
  source: "on-device" | "fallback";
}

export interface SessionDiagnostics {
  directorDressingCalls: number;
  directorFallbackCount: number;
  directorCircuitDegradedCount: number;
  directorPlatformFallbackCount: number;
  generatorRimFallbackCount: number;
  coherenceSamples: DressingCoherenceSample[];
}

const COHERENCE_RING_MAX = 80;

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
    (output: ExpansionDirectorOutput) => {
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
      }));
    },
    []
  );

  const appendCoherenceSamples = useCallback(
    (samples: DressingCoherenceSample[]) => {
      if (samples.length === 0) return;
      setSessionDiag(d => {
        const next = [...d.coherenceSamples, ...samples];
        return {
          ...d,
          coherenceSamples: next.slice(-COHERENCE_RING_MAX),
        };
      });
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
