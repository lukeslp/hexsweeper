import { describe, expect, it } from "vitest";
import { advanceRunAfterFloorWin, createNextFloorState } from "./cycleOrchestrator";
import { createRunState, finiteProgression, floorSeed } from "./runState";

describe("cycleOrchestrator", () => {
  it("advances run and produces deterministic next floor state", () => {
    const run = createRunState({ seed: "orch", progression: finiteProgression(99) });
    const beforeSeed = floorSeed(run);
    const { nextRun } = advanceRunAfterFloorWin(run, "loot");
    expect(nextRun.floor).toBe(2);
    expect(nextRun.routeSalt).toBe("loot");
    const nextFloor = createNextFloorState(nextRun);
    expect(nextFloor.floor).toBe(nextRun.floor);
    expect(nextFloor.floor).toBe(2);
    expect(floorSeed(nextRun)).not.toBe(beforeSeed);
    expect(nextFloor.seed).toBe(floorSeed(nextRun));
  });
});
