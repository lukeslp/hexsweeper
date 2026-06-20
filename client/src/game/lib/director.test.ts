import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  directExpansion,
  fallbackDirectorOutput,
  proceduralDirectorOutput,
  resetDirectorCircuit,
  type ExpansionDirectorInput,
  type IrisLineGenerator,
} from "./director";

const input: ExpansionDirectorInput = {
  runId: "run-a",
  floor: 2,
  floorSeed: "hex-seed:floor:2:route:loot",
  irisControl: 0.72,
  expandedCell: {
    key: "0,0",
    q: 0,
    r: 0,
    view: "revealed",
    adjacentBlocked: 2,
    clueVisible: true,
    title: "Entry Node",
  },
  newCells: [
    { key: "1,0", q: 1, r: 0, view: "unknown", clueVisible: false },
    { key: "0,1", q: 0, r: 1, view: "unknown", clueVisible: false },
  ],
  recentEvents: ["correct", "wrong"],
};

function irisFrom(
  factory: () => { line: string } | null
): IrisLineGenerator {
  return vi.fn(async () => factory());
}

vi.mock("@/lib/platform", () => ({
  getPlatform: vi.fn(() => "ios"),
}));

describe("director", () => {
  beforeEach(() => {
    platformRef.value = "ios";
    resetDirectorCircuit();
  });

  it("always assigns procedural tiles for new cells", async () => {
    const sync = proceduralDirectorOutput(input);
    const output = await directExpansion(input);
    const expectedTiles = fallbackDirectorOutput(input).tiles;

    expect(sync.tiles).toEqual(expectedTiles);
    expect(Object.keys(output.tiles).sort()).toEqual(["0,1", "1,0"]);
    expect(output.tiles).toEqual(expectedTiles);
    expect(output.tiles["1,0"].source).toBe("fallback");
  });

  it("uses on-device iris line when generation succeeds", async () => {
    const output = await directExpansion(
      input,
      irisFrom(() => ({ line: "your map begins to confess." }))
    );

    expect(output.source).toBe("on-device");
    expect(output.irisLine).toBe("your map begins to confess.");
    expect(output.tiles["1,0"].title.length).toBeGreaterThan(0);
  });

  it("falls back iris line when generation returns null", async () => {
    const output = await directExpansion(input, irisFrom(() => null));
    const fallback = fallbackDirectorOutput(input);

    expect(output.source).toBe("fallback");
    expect(output.irisLine).toBe(fallback.irisLine);
    expect(output.tiles).toEqual(fallback.tiles);
  });

  it("derives pacingBand from recent events without LLM", async () => {
    const output = await directExpansion(input, irisFrom(() => null));
    expect(output.pacingBand).toBe("spike");
  });

  it("opens the circuit breaker after repeated iris failures", async () => {
    await directExpansion(input, irisFrom(() => null));
    await directExpansion(input, irisFrom(() => null));
    await directExpansion(input, irisFrom(() => null));

    const gen = irisFrom(() => ({ line: "should not run" }));
    const out = await directExpansion(input, gen);

    expect(gen).not.toHaveBeenCalled();
    expect(out.degradedByCircuit).toBe(true);
    expect(out.source).toBe("fallback");
  });

  it("does not share circuit breaker state across different runId values", async () => {
    const inputA: ExpansionDirectorInput = { ...input, runId: "run-a" };
    const inputB: ExpansionDirectorInput = { ...input, runId: "run-b" };

    await directExpansion(inputA, irisFrom(() => null));
    await directExpansion(inputA, irisFrom(() => null));
    await directExpansion(inputA, irisFrom(() => null));

    const genB = irisFrom(() => ({ line: "other run still talks" }));
    const outB = await directExpansion(inputB, genB);

    expect(genB).toHaveBeenCalled();
    expect(outB.source).toBe("on-device");
  });

  it("resetDirectorCircuit(runId) clears breaker for that run only", async () => {
    const inputA: ExpansionDirectorInput = { ...input, runId: "reset-one" };
    await directExpansion(inputA, irisFrom(() => null));
    await directExpansion(inputA, irisFrom(() => null));
    await directExpansion(inputA, irisFrom(() => null));

    const genBefore = irisFrom(() => ({ line: "blocked" }));
    await directExpansion(inputA, genBefore);
    expect(genBefore).not.toHaveBeenCalled();

    resetDirectorCircuit("reset-one");

    const genAfter = irisFrom(() => ({ line: "restored path" }));
    const out = await directExpansion(inputA, genAfter);
    expect(genAfter).toHaveBeenCalled();
    expect(out.source).toBe("on-device");
  });

  it("short-circuits on non-iOS without calling the iris generator", async () => {
    const { getPlatform } = await import("@/lib/platform");
    vi.mocked(getPlatform).mockReturnValue("web");
    const gen = irisFrom(() => {
      throw new Error("should not call FM");
    });
    const out = await directExpansion(input, gen);
    expect(out.platformUnavailable).toBe(true);
    expect(out.source).toBe("fallback");
    expect(gen).not.toHaveBeenCalled();
    vi.mocked(getPlatform).mockReturnValue("ios");
  });
});
