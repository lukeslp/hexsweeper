/**
 * File Purpose: Unit tests for tryDressFloor — stale gate, races, empty newCells.
 * Primary Functions: Vitest cases mirroring GameApp dressing commit semantics.
 */
import { describe, expect, it, vi } from "vitest";
import type {
  ExpansionDirectorInput,
  ExpansionDirectorOutput,
} from "./director";
import { DressingGenerationGate } from "./dressingGenerationGate";
import { createFloorState } from "./gameState";
import { tryDressFloor } from "./dressingOrchestrator";
import { createRunState, floorSeed } from "./runState";

const baseInput = (
  newCells: ExpansionDirectorInput["newCells"]
): ExpansionDirectorInput => ({
  runId: "orch-test",
  floor: 1,
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
  it("returns no-new-cells without calling directExpansion", async () => {
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
      directExpansion: spy,
      generate: async () => null,
    });

    expect(result.kind).toBe("no-new-cells");
    if (result.kind === "no-new-cells") {
      expect(result.shouldCommit).toBe(true);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("discards when gate is invalidated before directExpansion resolves", async () => {
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
      directExpansion: async () =>
        new Promise<ExpansionDirectorOutput>(resolve => {
          setTimeout(
            () =>
              resolve({
                tiles: {
                  "1,0": {
                    title: "Late",
                    flavor: "x",
                    threatTone: "quiet",
                    visualHint: "none",
                    source: "fallback",
                  },
                },
                irisLine: "late",
                source: "fallback",
              }),
            20
          );
        }),
      generate: async () => null,
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
      directExpansion: async () =>
        new Promise<ExpansionDirectorOutput>(resolve => {
          setTimeout(
            () =>
              resolve({
                tiles: {
                  "1,0": {
                    title: "Slow",
                    flavor: "s",
                    threatTone: "quiet",
                    visualHint: "none",
                    source: "fallback",
                  },
                },
                irisLine: "slow",
                source: "fallback",
              }),
            40
          );
        }),
      generate: async () => null,
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
      directExpansion: async () => ({
        tiles: {
          "1,0": {
            title: "Fast",
            flavor: "f",
            threatTone: "quiet",
            visualHint: "none",
            source: "fallback",
          },
        },
        irisLine: "fast",
        source: "fallback",
      }),
      generate: async () => null,
    });

    const [r1, r2] = await Promise.all([slow, fast]);
    expect(r1.kind).toBe("discarded");
    expect(r2.kind).toBe("committed");
    if (r2.kind === "committed") {
      expect(r2.output.irisLine).toBe("fast");
      expect(r2.floor.cells["1,0"]?.dressing?.title).toBe("Fast");
    }
  });

  it("commits when gate still current after directExpansion", async () => {
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
      directExpansion: async () => ({
        tiles: {
          "1,0": {
            title: "Ok",
            flavor: "o",
            threatTone: "quiet",
            visualHint: "none",
            source: "fallback",
          },
        },
        irisLine: "ok-line",
        source: "fallback",
      }),
      generate: async () => null,
    });

    expect(result.kind).toBe("committed");
    if (result.kind === "committed") {
      expect(result.floor.cells["1,0"]?.dressing?.title).toBe("Ok");
    }
  });
});
