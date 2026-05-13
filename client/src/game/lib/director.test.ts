import { describe, expect, it } from "vitest";
import {
  directExpansion,
  fallbackDirectorOutput,
  type ExpansionDirectorInput,
} from "./director";

const input: ExpansionDirectorInput = {
  runId: "run-a",
  floor: 2,
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

describe("director", () => {
  it("returns deterministic fallback when generation is unavailable", async () => {
    const output = await directExpansion(input, async () => null);
    const expected = fallbackDirectorOutput(input);

    expect(output).toEqual(expected);
    expect(Object.keys(output.tiles).sort()).toEqual(["0,1", "1,0"]);
  });

  it("returns fallback when generation emits malformed JSON", async () => {
    const output = await directExpansion(input, async () => ({
      text: "not-json",
    }));

    expect(output.source).toBe("fallback");
    expect(output.tiles["1,0"].source).toBe("fallback");
  });

  it("accepts valid on-device dressing and fills missing cells from fallback", async () => {
    const output = await directExpansion(input, async () => ({
      text: JSON.stringify({
        irisLine: "your map begins to confess.",
        tiles: [
          {
            key: "1,0",
            title: "Long Title That Should Clamp",
            flavor:
              "this route has a sentence that is intentionally long enough to be clamped by validation.",
            threatTone: "breach",
            visualHint: "tear",
          },
        ],
      }),
    }));

    expect(output.source).toBe("on-device");
    expect(output.irisLine).toBe("your map begins to confess.");
    expect(output.tiles["1,0"]).toMatchObject({
      title: "Long Title That Should",
      threatTone: "breach",
      visualHint: "tear",
      source: "on-device",
    });
    expect(output.tiles["0,1"].source).toBe("fallback");
  });

  it("ignores unknown keys and unsafe enum values", async () => {
    const output = await directExpansion(input, async () => ({
      text: JSON.stringify({
        irisLine: "acceptable",
        tiles: [
          {
            key: "99,99",
            title: "Wrong Key",
            flavor: "ignored",
            threatTone: "breach",
            visualHint: "blackout",
          },
          {
            key: "1,0",
            title: "Valid",
            flavor: "kept",
            threatTone: "invalid",
            visualHint: "invalid",
          },
        ],
      }),
    }));

    expect(output.tiles["99,99"]).toBeUndefined();
    expect(output.tiles["1,0"].threatTone).toBe("watching");
    expect(output.tiles["1,0"].visualHint).toBe("none");
  });
});
