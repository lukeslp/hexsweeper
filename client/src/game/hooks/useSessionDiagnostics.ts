/**
 * File Purpose: Session HUD diagnostic counters for director/generator degradation.
 * Primary Functions: useSessionDiagnostics — state + record + reset.
 * Inputs/Outputs: ExpansionDirectorOutput in; SessionDiagnostics state out.
 */
import { useCallback, useState } from "react";
import type { ExpansionDirectorOutput } from "@/game/lib/director";

export interface SessionDiagnostics {
  directorDressingCalls: number;
  directorFallbackCount: number;
  directorCircuitDegradedCount: number;
  generatorRimFallbackCount: number;
}

const initial: SessionDiagnostics = {
  directorDressingCalls: 0,
  directorFallbackCount: 0,
  directorCircuitDegradedCount: 0,
  generatorRimFallbackCount: 0,
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
    resetSessionDiag,
  };
}
