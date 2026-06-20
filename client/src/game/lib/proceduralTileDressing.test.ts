import { describe, expect, it } from "vitest";
import {
  proceduralTileForCell,
  proceduralTilesForCells,
} from "./proceduralTileDressing";
import type { PublicCellContext } from "./types";

const cell = (key: string, view: PublicCellContext["view"]): PublicCellContext => ({
  key: key as PublicCellContext["key"],
  q: 0,
  r: 0,
  view,
  clueVisible: view === "revealed",
  adjacentBlocked: view === "revealed" ? 2 : undefined,
});

describe("proceduralTileDressing", () => {
  it("is deterministic for the same floor seed and cell key", () => {
    const a = proceduralTileForCell("seed-a", 0.5, cell("1,0", "unknown"));
    const b = proceduralTileForCell("seed-a", 0.5, cell("1,0", "unknown"));
    expect(a).toEqual(b);
  });

  it("varies title across different cell keys on the same floor", () => {
    const tiles = proceduralTilesForCells("seed-b", 0.5, [
      cell("1,0", "unknown"),
      cell("0,1", "unknown"),
      cell("-1,0", "unknown"),
    ]);
    const titles = new Set(Object.values(tiles).map(t => t.title));
    expect(titles.size).toBeGreaterThan(1);
  });

  it("uses short titles without placeholders", () => {
    const tile = proceduralTileForCell("seed-c", 0.9, cell("2,0", "unknown"));
    expect(tile.title.length).toBeGreaterThan(0);
    expect(tile.title.length).toBeLessThanOrEqual(24);
    expect(tile.title.toLowerCase()).not.toContain("short label");
    expect(tile.threatTone).toBe("breach");
  });
});
