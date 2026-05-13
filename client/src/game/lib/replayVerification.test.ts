/**
 * File Purpose: Determinism smoke tests for floor generation and replay parity.
 * Primary Functions: describe blocks for replay + shallow fairness sampling.
 * Inputs/Outputs: Fixed seeds in; equality / bounds assertions out.
 */

import { describe, expect, it } from "vitest";
import { tryGenerateSolvableFloor } from "./generator";
import type { FloorState } from "./types";

function truthSignature(state: FloorState | null): string | null {
  if (!state) return null;
  return Object.values(state.cells)
    .map(c => `${c.key}:${c.truth}:${c.view}`)
    .sort()
    .join("|");
}

describe("replayVerification", () => {
  it("produces identical board truth for the same floor seed (replay parity)", () => {
    const opts = { floor: 7, seed: "replay-parity-7" };
    const a = tryGenerateSolvableFloor(opts);
    const b = tryGenerateSolvableFloor(opts);
    expect(a).not.toBeNull();
    expect(truthSignature(a)).toBe(truthSignature(b));
  });

  it("fairness sample: mid floors stay solvable across a seed cohort", () => {
    const floor = 8;
    let failures = 0;
    for (let i = 0; i < 40; i++) {
      const s = tryGenerateSolvableFloor({ floor, seed: `fair-cohort-${i}` });
      if (!s) failures++;
    }
    expect(failures).toBe(0);
  });
});
