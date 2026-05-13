import { describe, expect, it } from "vitest";
import { floorParams, tryGenerateSolvableFloor } from "./generator";

describe("generator", () => {
  // The 80-attempt budget is supposed to find a real, varied
  // solver-solvable floor on every standard run. If we ever start
  // falling through to the rim-fallback, players see a degenerate
  // ring-of-blocked floor that's trivially solvable. The smoke fuzz
  // catches that regression class.
  it("finds a solvable floor within budget for all 12 floors", () => {
    const seedsPerFloor = 30;
    for (let floor = 1; floor <= 12; floor++) {
      for (let i = 0; i < seedsPerFloor; i++) {
        const state = tryGenerateSolvableFloor({
          floor,
          seed: `budget-fuzz-${floor}-${i}`,
        });
        expect(
          state,
          `floor ${floor} seed ${i} exhausted the retry budget`
        ).not.toBeNull();
      }
    }
  });

  it("returned floors actually exercise the interior, not just the rim", () => {
    for (let floor = 3; floor <= 12; floor++) {
      const state = tryGenerateSolvableFloor({
        floor,
        seed: `interior-fuzz-${floor}`,
      });
      expect(state).not.toBeNull();
      if (!state) continue;

      const params = floorParams(floor);
      const interiorBlocked = Object.values(state.cells).filter(cell => {
        const distance =
          (Math.abs(cell.q) + Math.abs(cell.q + cell.r) + Math.abs(cell.r)) / 2;
        return distance < params.radius && cell.truth === "blocked";
      }).length;

      // Rim-fallback puts zero blocked cells in the interior. Any
      // genuinely-generated floor at radius >= 3 with blockedRate ~0.23+
      // will land at least one blocked cell off the rim.
      expect(
        interiorBlocked,
        `floor ${floor} looks like rim-fallback shape`
      ).toBeGreaterThan(0);
    }
  });
});
