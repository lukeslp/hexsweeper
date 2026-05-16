import { describe, expect, it } from "vitest";
import { generateFloor } from "./generator";
import {
  axialHexDistance,
  deriveDeductions,
  partitionCascadeRings,
  solveFloorTruth,
} from "./solver";
import { hexKey, type GameCell, type HexKey } from "./types";

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
        const hasBlocked = Object.values(state.cells).some(
          c => c.truth === "blocked"
        );
        if (hasBlocked) {
          expect(solved.steps.length).toBeGreaterThan(0);
        }
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

  describe("deriveDeductions", () => {
    it("returns empty deductions on an empty cell map", () => {
      expect(deriveDeductions({})).toEqual({
        provablySafe: [],
        provablyMine: [],
      });
    });

    it("flags a lone unknown neighbor as safe when clue count is satisfied by marks", () => {
      const c0 = hexKey(0, 0);
      const c1 = hexKey(1, 0);
      const c2 = hexKey(1, -1);
      const cells: Record<HexKey, GameCell> = {
        [c0]: {
          key: c0,
          q: 0,
          r: 0,
          truth: "safe",
          view: "revealed",
          adjacentBlocked: 1,
          clueVisible: true,
        },
        [c1]: {
          key: c1,
          q: 1,
          r: 0,
          truth: "blocked",
          view: "marked",
          adjacentBlocked: 0,
          clueVisible: false,
        },
        [c2]: {
          key: c2,
          q: 1,
          r: -1,
          truth: "safe",
          view: "unknown",
          adjacentBlocked: 0,
          clueVisible: false,
        },
      };
      expect(deriveDeductions(cells)).toEqual({
        provablySafe: [c2],
        provablyMine: [],
      });
    });

    it("returns empty arrays on contradiction (mine count oversaturated)", () => {
      const c0 = hexKey(0, 0);
      const c1 = hexKey(1, 0);
      const cells: Record<HexKey, GameCell> = {
        [c0]: {
          key: c0,
          q: 0,
          r: 0,
          truth: "safe",
          view: "revealed",
          adjacentBlocked: 0,
          clueVisible: true,
        },
        [c1]: {
          key: c1,
          q: 1,
          r: 0,
          truth: "blocked",
          view: "marked",
          adjacentBlocked: 0,
          clueVisible: false,
        },
      };
      expect(deriveDeductions(cells)).toEqual({
        provablySafe: [],
        provablyMine: [],
      });
    });

    it("chains safe and mine deductions across visible clues in one call", () => {
      const a = hexKey(0, 0);
      const b = hexKey(1, 0);
      const c = hexKey(2, 0);
      const d = hexKey(3, 0);
      const cells: Record<HexKey, GameCell> = {
        [a]: {
          key: a,
          q: 0,
          r: 0,
          truth: "safe",
          view: "revealed",
          adjacentBlocked: 0,
          clueVisible: true,
        },
        [b]: {
          key: b,
          q: 1,
          r: 0,
          truth: "safe",
          view: "unknown",
          adjacentBlocked: 0,
          clueVisible: false,
        },
        [c]: {
          key: c,
          q: 2,
          r: 0,
          truth: "safe",
          view: "revealed",
          adjacentBlocked: 1,
          clueVisible: true,
        },
        [d]: {
          key: d,
          q: 3,
          r: 0,
          truth: "blocked",
          view: "unknown",
          adjacentBlocked: 0,
          clueVisible: false,
        },
      };
      const d1 = deriveDeductions(cells);
      expect(d1.provablySafe).toEqual([b]);
      expect(d1.provablyMine).toEqual([d]);
    });
  });

  describe("partitionCascadeRings", () => {
    it("buckets keys by axial distance from the trigger", () => {
      const t = hexKey(0, 0);
      const a = hexKey(1, 0);
      const b = hexKey(2, 0);
      const cells: Record<HexKey, GameCell> = {
        [t]: {
          key: t,
          q: 0,
          r: 0,
          truth: "safe",
          view: "revealed",
          adjacentBlocked: 0,
          clueVisible: true,
        },
        [a]: {
          key: a,
          q: 1,
          r: 0,
          truth: "safe",
          view: "unknown",
          adjacentBlocked: 0,
          clueVisible: false,
        },
        [b]: {
          key: b,
          q: 2,
          r: 0,
          truth: "safe",
          view: "unknown",
          adjacentBlocked: 0,
          clueVisible: false,
        },
      };
      const rings = partitionCascadeRings(t, [a, b], cells);
      expect(rings.length).toBe(2);
      expect(axialHexDistance(cells[t]!, cells[a]!)).toBe(1);
      expect(rings[0]).toEqual([a].sort());
      expect(rings[1]).toEqual([b].sort());
    });
  });
});
