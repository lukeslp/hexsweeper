import { describe, expect, it } from "vitest";
import { DressingGenerationGate } from "./dressingGenerationGate";

describe("DressingGenerationGate", () => {
  it("invalidates older dressing operation ids after begin()", () => {
    const gate = new DressingGenerationGate();
    const first = gate.begin();
    const second = gate.begin();
    expect(first).not.toBe(second);
    expect(gate.isCurrent(first)).toBe(false);
    expect(gate.isCurrent(second)).toBe(true);
  });

  it("invalidate drops all in-flight ids", () => {
    const gate = new DressingGenerationGate();
    const id = gate.begin();
    gate.invalidate();
    expect(gate.isCurrent(id)).toBe(false);
    const next = gate.begin();
    expect(gate.isCurrent(next)).toBe(true);
  });
});
