import { describe, expect, it } from "vitest";
import { generateFloor } from "./generator";
import { solveFloorTruth } from "./solver";

describe("solver", () => {
  it("solves generated floors from revealed clues without guessing", () => {
    for (let floor = 1; floor <= 12; floor++) {
      for (let index = 0; index < 20; index++) {
        const state = generateFloor({
          floor,
          seed: `solver-fuzz-${floor}-${index}`,
        });

        const solved = solveFloorTruth(state.cells);

        expect(solved.contradiction).toBe(false);
        expect(solved.solved).toBe(true);
        expect(solved.steps.length).toBeGreaterThan(0);
      }
    }
  });

  it("marks every blocked cell and reveals every safe cell in its solution", () => {
    const state = generateFloor({ floor: 8, seed: "solver-classifies" });
    const solved = solveFloorTruth(state.cells);

    for (const cell of Object.values(state.cells)) {
      if (cell.truth === "safe") {
        expect(solved.revealedSafe.has(cell.key)).toBe(true);
      } else {
        expect(solved.markedBlocked.has(cell.key)).toBe(true);
      }
    }
  });
});
