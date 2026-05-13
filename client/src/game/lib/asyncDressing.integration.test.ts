/**
 * File Purpose: Integration-style checks for run/floor continuity and dressing invalidation patterns.
 * Primary Functions: Vitest cases for advanceRunAfterFloorWin + gate semantics used by GameApp.
 */
import { describe, expect, it } from "vitest";
import { advanceRunAfterFloorWin, createNextFloorState } from "./cycleOrchestrator";
import { createRunState, finiteProgression } from "./runState";
import { DressingGenerationGate } from "./dressingGenerationGate";

describe("runFloorContinuity", () => {
  it("keeps FloorState.floor aligned with RunState.floor after advance", () => {
    const run = createRunState({ seed: "sync", progression: finiteProgression(99) });
    const { nextRun } = advanceRunAfterFloorWin(run, "risk");
    const nextFloor = createNextFloorState(nextRun);
    expect(nextFloor.floor).toBe(nextRun.floor);
    expect(nextFloor.floor).toBe(2);
  });
});

describe("dressingAsyncPattern", () => {
  it("matches GameApp stale-guard: invalidate then complete is ignored", async () => {
    const gate = new DressingGenerationGate();
    const op = gate.begin();
    gate.invalidate();
    await Promise.resolve();
    expect(gate.isCurrent(op)).toBe(false);
  });
});
