/**
 * File Purpose: Unit tests for session diagnostic localStorage ring buffer.
 * Primary Functions: append/load/clear behavior and max entry cap.
 * Inputs/Outputs: localStorage key `hexodus_session_diag_snapshots`.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  appendSessionDiagSnapshot,
  loadSessionDiagSnapshots,
  clearSessionDiagSnapshots,
} from "./sessionDiagLog";

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear() {
      m.clear();
    },
    getItem(key: string) {
      return m.has(key) ? m.get(key)! : null;
    },
    key(index: number) {
      return [...m.keys()][index] ?? null;
    },
    removeItem(key: string) {
      m.delete(key);
    },
    setItem(key: string, value: string) {
      m.set(key, value);
    },
  } as Storage;
}

describe("sessionDiagLog", () => {
  const orig = globalThis.localStorage;

  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: memoryStorage(),
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    if (orig === undefined) {
      Reflect.deleteProperty(globalThis, "localStorage");
    } else {
      Object.defineProperty(globalThis, "localStorage", {
        value: orig,
        configurable: true,
        writable: true,
      });
    }
  });

  it("appends rows and keeps a bounded ring buffer", () => {
    for (let i = 0; i < 85; i++) {
      appendSessionDiagSnapshot({
        at: i,
        reason: "restartRun",
        runId: "run",
        directorDressingCalls: i,
        directorFallbackCount: 0,
        directorCircuitDegradedCount: 0,
        generatorRimFallbackCount: 0,
      });
    }
    const rows = loadSessionDiagSnapshots();
    expect(rows).toHaveLength(80);
    expect(rows[79].directorDressingCalls).toBe(84);
  });

  it("clearSessionDiagSnapshots removes the key", () => {
    appendSessionDiagSnapshot({
      at: 1,
      reason: "restartRun",
      runId: "x",
      directorDressingCalls: 0,
      directorFallbackCount: 0,
      directorCircuitDegradedCount: 0,
      generatorRimFallbackCount: 0,
    });
    clearSessionDiagSnapshots();
    expect(loadSessionDiagSnapshots()).toEqual([]);
  });
});
