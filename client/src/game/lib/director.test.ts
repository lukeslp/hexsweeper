import { beforeEach, describe, expect, it } from "vitest";
import {
  directExpansion,
  fallbackDirectorOutput,
  resetDirectorCircuit,
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
  beforeEach(() => {
    resetDirectorCircuit();
  });

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

  it("recovers when the model wraps valid JSON in prose", async () => {
    const json = JSON.stringify({
      irisLine: "your edges resolve.",
      tiles: [
        {
          key: "1,0",
          title: "Recovered Tile",
          flavor: "the wrapper prose did not hide me.",
          threatTone: "pressing",
          visualHint: "flicker",
        },
      ],
    });
    const output = await directExpansion(input, async () => ({
      text: `Sure, here's the dressing you asked for: ${json}\n\nLet me know if you need anything else.`,
    }));

    expect(output.source).toBe("on-device");
    expect(output.tiles["1,0"]).toMatchObject({
      title: "Recovered Tile",
      threatTone: "pressing",
      source: "on-device",
    });
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

  it("passes through a valid pacingBand", async () => {
    const output = await directExpansion(input, async () => ({
      text: JSON.stringify({
        irisLine: "pace yourself.",
        pacingBand: "ramp",
        tiles: [
          {
            key: "1,0",
            title: "Alpha",
            flavor: "short.",
            threatTone: "quiet",
            visualHint: "none",
          },
          {
            key: "0,1",
            title: "Beta",
            flavor: "short.",
            threatTone: "quiet",
            visualHint: "none",
          },
        ],
      }),
    }));

    expect(output.pacingBand).toBe("ramp");
    expect(output.source).toBe("on-device");
  });

  it("opens the circuit breaker after repeated failures and skips generation", async () => {
    await directExpansion(input, async () => null);
    await directExpansion(input, async () => null);
    await directExpansion(input, async () => null);

    let calls = 0;
    const out = await directExpansion(input, async () => {
      calls++;
      return {
        text: JSON.stringify({
          irisLine: "should not run",
          tiles: [
            {
              key: "1,0",
              title: "A",
              flavor: "b",
              threatTone: "quiet",
              visualHint: "none",
            },
            {
              key: "0,1",
              title: "B",
              flavor: "c",
              threatTone: "quiet",
              visualHint: "none",
            },
          ],
        }),
      };
    });

    expect(calls).toBe(0);
    expect(out.degradedByCircuit).toBe(true);
    expect(out.source).toBe("fallback");
  });

  it("does not share circuit breaker state across different runId values", async () => {
    const inputA: ExpansionDirectorInput = { ...input, runId: "run-a" };
    const inputB: ExpansionDirectorInput = { ...input, runId: "run-b" };

    await directExpansion(inputA, async () => null);
    await directExpansion(inputA, async () => null);
    await directExpansion(inputA, async () => null);

    let callsB = 0;
    const outB = await directExpansion(inputB, async () => {
      callsB++;
      return {
        text: JSON.stringify({
          irisLine: "other run still talks",
          tiles: [
            {
              key: "1,0",
              title: "X",
              flavor: "y",
              threatTone: "quiet",
              visualHint: "none",
            },
            {
              key: "0,1",
              title: "Z",
              flavor: "w",
              threatTone: "quiet",
              visualHint: "none",
            },
          ],
        }),
      };
    });

    expect(callsB).toBe(1);
    expect(outB.source).toBe("on-device");
  });

  it("resetDirectorCircuit(runId) clears breaker for that run only", async () => {
    const inputA: ExpansionDirectorInput = { ...input, runId: "reset-one" };
    await directExpansion(inputA, async () => null);
    await directExpansion(inputA, async () => null);
    await directExpansion(inputA, async () => null);

    let callsBefore = 0;
    await directExpansion(inputA, async () => {
      callsBefore++;
      return {
        text: JSON.stringify({
          irisLine: "blocked by circuit",
          tiles: [
            {
              key: "1,0",
              title: "A",
              flavor: "b",
              threatTone: "quiet",
              visualHint: "none",
            },
            {
              key: "0,1",
              title: "B",
              flavor: "c",
              threatTone: "quiet",
              visualHint: "none",
            },
          ],
        }),
      };
    });
    expect(callsBefore).toBe(0);

    resetDirectorCircuit("reset-one");

    let callsAfter = 0;
    const out = await directExpansion(inputA, async () => {
      callsAfter++;
      return {
        text: JSON.stringify({
          irisLine: "restored path",
          tiles: [
            {
              key: "1,0",
              title: "C",
              flavor: "d",
              threatTone: "quiet",
              visualHint: "none",
            },
            {
              key: "0,1",
              title: "D",
              flavor: "e",
              threatTone: "quiet",
              visualHint: "none",
            },
          ],
        }),
      };
    });
    expect(callsAfter).toBe(1);
    expect(out.source).toBe("on-device");
  });
});
