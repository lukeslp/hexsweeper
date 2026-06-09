/**
 * File Purpose: Unit tests for tryDressFloor — stale gate, races, empty newCells.
 * Primary Functions: Vitest cases mirroring GameApp dressing commit semantics.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/platform", () => ({
  getPlatform: () => "ios",
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
  floorSeed: "orch-floor-seed",
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
  it("returns no-new-cells without dressing", async () => {
    const gate = new DressingGenerationGate();
    const opGen = gate.begin();
    const spy = vi.fn();
    const run = createRunState({ seed: "empty", runId: "r1" });
    const floor = createFloorState(run.floor, floorSeed(run));

    const result = await tryDressFloor({
      gate,
      opGen,
      nextFloor: floor,
      input: baseInput([]),
      dressingMode: "generable",
      generateTileBatch: spy,
    });

    expect(result.kind).toBe("no-new-cells");
    if (result.kind === "no-new-cells") {
      expect(result.shouldCommit).toBe(true);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("procedural: commits tiles immediately with irisPending when deferIris", async () => {
    const gate = new DressingGenerationGate();
    const opGen = gate.begin();
    const run = createRunState({ seed: "proc", runId: "r2" });
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
      dressingMode: "procedural",
      deferIris: true,
    });

    expect(result.kind).toBe("committed");
    if (result.kind === "committed") {
      expect(result.irisPending).toBe(true);
      expect(result.floor.cells["1,0"]?.dressing?.title).toBeTruthy();
    }
  });

  it("generable: discards when gate invalidated before batch resolves", async () => {
    const gate = new DressingGenerationGate();
    const opGen = gate.begin();
    const run = createRunState({ seed: "inv", runId: "r3" });
    const floor = createFloorState(run.floor, floorSeed(run));

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
      dressingMode: "generable",
      generateTileBatch: async () =>
        new Promise(resolve => {
          setTimeout(
            () =>
              resolve({
                irisLine: "late",
                tiles: [
                  {
                    key: "1,0",
                    title: "Late",
                    flavor: "x",
                    threatTone: "quiet",
                    visualHint: "none",
                  },
                ],
              }),
            20
          );
        }),
    });

    gate.invalidate();
    const result = await pending;

    expect(result.kind).toBe("discarded");
  });

  it("generable: rapid second begin invalidates first op", async () => {
    const gate = new DressingGenerationGate();
    const op1 = gate.begin();
    const op2 = gate.begin();
    const run = createRunState({ seed: "race", runId: "r4" });
    const floor = createFloorState(run.floor, floorSeed(run));
    const cells = [
      {
        key: "1,0" as const,
        q: 1,
        r: 0,
        view: "unknown" as const,
        clueVisible: false,
      },
    ];

    const slow = tryDressFloor({
      gate,
      opGen: op1,
      nextFloor: floor,
      input: baseInput(cells),
      dressingMode: "generable",
      generateTileBatch: async () =>
        new Promise(resolve => {
          setTimeout(
            () =>
              resolve({
                irisLine: "slow",
                tiles: [
                  {
                    key: "1,0",
                    title: "Slow",
                    flavor: "s",
                    threatTone: "quiet",
                    visualHint: "none",
                  },
                ],
              }),
            40
          );
        }),
    });

    const fast = tryDressFloor({
      gate,
      opGen: op2,
      nextFloor: floor,
      input: baseInput(cells),
      dressingMode: "generable",
      generateTileBatch: async () => ({
        irisLine: "fast",
        tiles: [
          {
            key: "1,0",
            title: "Fast",
            flavor: "f",
            threatTone: "quiet",
            visualHint: "none",
          },
        ],
      }),
    });

    const [r1, r2] = await Promise.all([slow, fast]);
    expect(r1.kind).toBe("discarded");
    expect(r2.kind).toBe("committed");
    if (r2.kind === "committed") {
      expect(r2.output.irisLine).toBe("fast");
      expect(r2.floor.cells["1,0"]?.dressing?.title).toBe("Fast");
    }
  });
});
