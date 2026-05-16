import { describe, expect, it } from "vitest";
import {
  createTerminalState,
  floorEventToTerminalLines,
  reduceTerminalLog,
} from "./terminalLog";
import { hexKey } from "./types";

describe("terminalLog", () => {
  it("append increases nextId and preserves order", () => {
    let s = createTerminalState();
    s = reduceTerminalLog(s, {
      type: "append",
      channel: "event",
      text: "a",
    });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]!.id).toBe(1);
    expect(s.nextId).toBe(2);
  });

  it("caps total lines at 300 (ring buffer)", () => {
    let s = createTerminalState();
    for (let i = 0; i < 305; i++) {
      s = reduceTerminalLog(s, {
        type: "append",
        channel: "event",
        text: `line-${i}`,
      });
    }
    expect(s.lines).toHaveLength(300);
    expect(s.lines[0]!.text).toBe("line-5");
    expect(s.lines[299]!.text).toBe("line-304");
  });

  it("floorEventToTerminalLines is stable for the same inputs", () => {
    const ctx = {
      floor: 3,
      key: hexKey(1, 0),
      cascadeCellCount: 4,
      cascadeRingCount: 2,
      irisControl: 0.42,
      wrongsLeft: 2,
      maxWrongs: 5,
      status: "playing" as const,
    };
    const a = floorEventToTerminalLines("correct-reveal", ctx);
    const b = floorEventToTerminalLines("correct-reveal", ctx);
    expect(a).toEqual(b);
    expect(a[0]!.text).toMatch(/REVEAL 1\/0 ok iris=42%/);
  });

  it("setStreamLine updates an existing row in place", () => {
    let s = createTerminalState();
    s = reduceTerminalLog(s, {
      type: "setStreamLine",
      key: "k1",
      text: "[map] a",
    });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]!.streamKey).toBe("k1");
    expect(s.lines[0]!.channel).toBe("map");
    s = reduceTerminalLog(s, {
      type: "setStreamLine",
      key: "k1",
      text: "[map] ab",
    });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]!.text).toBe("[map] ab");
  });
});
