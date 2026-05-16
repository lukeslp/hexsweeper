/**
 * File Purpose: React context for the persistent iris.exe terminal (boot + run).
 * Primary Functions: TerminalFeedProvider, useTerminalFeed
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

import {
  createTerminalState,
  reduceTerminalLog,
  type TerminalLogAction,
  type TerminalState,
} from "@/game/lib/terminalLog";

type Ctx = {
  terminal: TerminalState;
  dispatchTerminal: (a: TerminalLogAction) => void;
};

const TerminalFeedContext = createContext<Ctx | null>(null);

export function TerminalFeedProvider({ children }: { children: ReactNode }) {
  const [terminal, dispatch] = useReducer(
    reduceTerminalLog,
    undefined,
    createTerminalState
  );

  const dispatchTerminal = useCallback((a: TerminalLogAction) => {
    dispatch(a);
  }, []);

  const value = useMemo(
    () => ({ terminal, dispatchTerminal }),
    [terminal, dispatchTerminal]
  );

  return (
    <TerminalFeedContext.Provider value={value}>
      {children}
    </TerminalFeedContext.Provider>
  );
}

export function useTerminalFeed(): Ctx {
  const ctx = useContext(TerminalFeedContext);
  if (!ctx) {
    throw new Error("useTerminalFeed: missing TerminalFeedProvider");
  }
  return ctx;
}
