import { describe, expect, it } from "vitest";
import { floorParams, tryGenerateSolvableFloor } from "./generator";

describe("generator", () => {
  // The 200-attempt budget is supposed to find a real, varied
  // solver-solvable floor on every standard run. If we ever start
  // falling through to the rim-fallback, players see a degenerate
  // ring-of-blocked floor that's trivially solvable. The smoke fuzz
  // catches that regression class.
  it("tags blocked cells with cellVariant in 0..3 at generation", () => {
    const state = tryGenerateSolvableFloor({
      floor: 6,
      seed: "cell-variant-tier-smoke",
    });
    expect(state).not.toBeNull();
    for (const c of Object.values(state!.cells)) {
      if (c.truth === "blocked") {
        expect(c.cellVariant).toBeGreaterThanOrEqual(0);
        expect(c.cellVariant).toBeLessThanOrEqual(3);
      }
    }
  });

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

  it("finds a solvable floor within budget for deep floors (infinite curve)", () => {
    const deepFloors = [13, 18, 25, 40, 80, 120];
    for (const floor of deepFloors) {
      for (let i = 0; i < 12; i++) {
        const state = tryGenerateSolvableFloor({
          floor,
          seed: `deep-fuzz-${floor}-${i}`,
        });
        expect(
          state,
          `floor ${floor} seed ${i} exhausted the retry budget`
        ).not.toBeNull();
      }
    }
  });

  it(
    "solvability sweep: one seeded candidate per floor 1..500 (infinite curve)",
    () => {
      for (let floor = 1; floor <= 500; floor++) {
        const state = tryGenerateSolvableFloor({
          floor,
          seed: `depth-sweep-${floor}`,
        });
        expect(state, `floor ${floor} exhausted retry budget`).not.toBeNull();
      }
    },
    { timeout: 180_000 }
  );

  it("returned floors actually exercise the interior, not just the rim", () => {
    for (const floor of [3, 6, 12, 18, 25]) {
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
