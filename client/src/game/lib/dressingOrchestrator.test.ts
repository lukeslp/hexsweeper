/**
 * File Purpose: Unit tests for tryDressFloor — stale gate, races, empty newCells.
 * Primary Functions: Vitest cases mirroring GameApp dressing commit semantics.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/platform", () => ({
  getPlatform: vi.fn(() => "ios"),
}));
import type { ExpansionDirectorInput } from "./director";
import { DressingGenerationGate } from "./dressingGenerationGate";
import { createFloorState } from "./gameState";
import { tryDressFloor } from "./dressingOrchestrator";
import { createRunState, floorSeed } from "./runState";

const baseInput = (
  newCells: ExpansionDirectorInput["newCells"]
): ExpansionDirectorInput => ({
  runId: "orch-test",
  floor: 1,
  floorSeed: "orch-seed:floor:1:route:loot",
  irisControl: 0.5,
  expandedCell: {
    key: "0,0",
    q: 0,
    r: 0,
    view: "revealed",
    adjacentBlocked: 0,
    clueVisible: true,
    title: "Entry",
  },
  newCells,
  recentEvents: [],
});

describe("tryDressFloor", () => {
  it("returns no-new-cells without calling iris generation", async () => {
    const gate = new DressingGenerationGate();
    const opGen = gate.begin();
    const irisSpy = vi.fn(async () => null);
    const run = createRunState({ seed: "empty", runId: "r1" });
    const floor = createFloorState(run.floor, floorSeed(run));

    const result = await tryDressFloor({
      gate,
      opGen,
      nextFloor: floor,
      input: baseInput([]),
      generateIrisLine: irisSpy,
    });

    expect(result.kind).toBe("no-new-cells");
    if (result.kind === "no-new-cells") {
      expect(result.shouldCommit).toBe(true);
    }
    expect(irisSpy).not.toHaveBeenCalled();
  });

  it("discards when gate is invalidated before iris resolves", async () => {
    const gate = new DressingGenerationGate();
    const opGen = gate.begin();
    const run = createRunState({ seed: "inv", runId: "r2" });
    const floor = createFloorState(run.floor, floorSeed(run));
    const cell = floor.cells["1,0"];
    expect(cell).toBeDefined();

    const pending = tryDressFloor({
      gate,
      opGen,
      nextFloor: floor,
      input: baseInput([
        {
          key: "1,0",
          q: 1,
          r: 0,
          view: "unknown",
          clueVisible: false,
        },
      ]),
      generateIrisLine: () =>
        new Promise<{ line: string } | null>(resolve => {
          setTimeout(() => resolve({ line: "late" }), 20);
        }),
    });

    gate.invalidate();
    const result = await pending;

    expect(result.kind).toBe("discarded");
    if (result.kind === "discarded") {
      expect(result.output.irisLine).toBe("late");
    }
  });

  it("rapid second begin invalidates first op: only second commits", async () => {
    const gate = new DressingGenerationGate();
    const op1 = gate.begin();
    const op2 = gate.begin();

    const run = createRunState({ seed: "race", runId: "r3" });
    const floor = createFloorState(run.floor, floorSeed(run));

    const slow = tryDressFloor({
      gate,
      opGen: op1,
      nextFloor: floor,
      input: baseInput([
        {
          key: "1,0",
          q: 1,
          r: 0,
          view: "unknown",
          clueVisible: false,
        },
      ]),
      generateIrisLine: () =>
        new Promise<{ line: string } | null>(resolve => {
          setTimeout(() => resolve({ line: "slow" }), 40);
        }),
    });

    const fast = tryDressFloor({
      gate,
      opGen: op2,
      nextFloor: floor,
      input: baseInput([
        {
          key: "1,0",
          q: 1,
          r: 0,
          view: "unknown",
          clueVisible: false,
        },
      ]),
      generateIrisLine: async () => ({ line: "fast" }),
    });

    const [r1, r2] = await Promise.all([slow, fast]);
    expect(r1.kind).toBe("discarded");
    expect(r2.kind).toBe("committed");
    if (r2.kind === "committed") {
      expect(r2.output.irisLine).toBe("fast");
      expect(r2.floor.cells["1,0"]?.dressing?.title.length).toBeGreaterThan(0);
    }
  });

  it("commits procedural tiles before deferred iris when deferIris is set", async () => {
    const gate = new DressingGenerationGate();
    const opGen = gate.begin();
    const run = createRunState({ seed: "defer", runId: "r-defer" });
    const floor = createFloorState(run.floor, floorSeed(run));

    const result = await tryDressFloor({
      gate,
      opGen,
      nextFloor: floor,
      input: baseInput([
        {
          key: "1,0",
          q: 1,
          r: 0,
          view: "unknown",
          clueVisible: false,
        },
      ]),
      deferIris: true,
      generateIrisLine: () =>
        new Promise<{ line: string } | null>(resolve => {
          setTimeout(() => resolve({ line: "later" }), 50);
        }),
    });

    expect(result.kind).toBe("committed");
    if (result.kind === "committed") {
      expect(result.irisPending).toBe(true);
      expect(result.floor.cells["1,0"]?.dressing?.title.length).toBeGreaterThan(
        0
      );
      expect(result.output.irisLine).not.toBe("later");
    }
  });

  it("commits when gate still current after iris resolves", async () => {
    const gate = new DressingGenerationGate();
    const opGen = gate.begin();
    const run = createRunState({ seed: "ok", runId: "r4" });
    const floor = createFloorState(run.floor, floorSeed(run));

    const result = await tryDressFloor({
      gate,
      opGen,
      nextFloor: floor,
      input: baseInput([
        {
          key: "1,0",
          q: 1,
          r: 0,
          view: "unknown",
          clueVisible: false,
        },
      ]),
      generateIrisLine: async () => ({ line: "ok-line" }),
    });

    expect(result.kind).toBe("committed");
    if (result.kind === "committed") {
      expect(result.output.irisLine).toBe("ok-line");
      expect(result.floor.cells["1,0"]?.dressing?.title.length).toBeGreaterThan(
        0
      );
    }
  });
});
