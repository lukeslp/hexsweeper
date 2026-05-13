import { describe, expect, it } from "vitest";
import { createFloorState, reduceFloor } from "./gameState";
import type { FloorState, GameCell, HexKey } from "./types";

describe("gameState", () => {
  it("generates deterministic floors from floor and seed", () => {
    const a = createFloorState(1, "alpha");
    const b = createFloorState(1, "alpha");
    const c = createFloorState(1, "beta");

    expect(snapshot(a)).toEqual(snapshot(b));
    expect(snapshot(a)).not.toEqual(snapshot(c));
  });

  it("reveals a safe cell without spending the wrong budget", () => {
    const floor = createFloorState(1, "safe-reveal");
    const safe = findCell(
      floor,
      cell => cell.truth === "safe" && cell.view === "unknown"
    );

    const next = reduceFloor(floor, { type: "revealCell", key: safe.key });

    expect(next.cells[safe.key].view).toBe("revealed");
    expect(next.cells[safe.key].clueVisible).toBe(true);
    expect(next.wrongsLeft).toBe(floor.wrongsLeft);
    expect(next.lastEvent).toBe("correct-reveal");
  });

  it("breaks a blocked cell and spends wrong budget when revealed", () => {
    const floor = createFloorState(1, "blocked-reveal");
    const blocked = findCell(
      floor,
      cell => cell.truth === "blocked" && cell.view === "unknown"
    );

    const next = reduceFloor(floor, { type: "revealCell", key: blocked.key });

    expect(next.cells[blocked.key].view).toBe("broken");
    expect(next.wrongsLeft).toBe(floor.wrongsLeft - 1);
    expect(next.irisControl).toBeGreaterThan(floor.irisControl);
    expect(next.lastEvent).toBe("wrong-reveal");
  });

  it("marks blocked cells as correct and lowers iris pressure", () => {
    const floor = {
      ...createFloorState(1, "correct-mark"),
      irisControl: 0.5,
    };
    const blocked = findCell(
      floor,
      cell => cell.truth === "blocked" && cell.view === "unknown"
    );

    const next = reduceFloor(floor, { type: "markCell", key: blocked.key });

    expect(next.cells[blocked.key].view).toBe("marked");
    expect(next.wrongsLeft).toBe(floor.wrongsLeft);
    expect(next.irisControl).toBeLessThan(floor.irisControl);
    expect(next.lastEvent).toBe("correct-mark");
  });

  it("penalizes marking a safe cell", () => {
    const floor = createFloorState(1, "wrong-mark");
    const safe = findCell(
      floor,
      cell => cell.truth === "safe" && cell.view === "unknown"
    );

    const next = reduceFloor(floor, { type: "markCell", key: safe.key });

    expect(next.cells[safe.key].view).toBe("marked");
    expect(next.wrongsLeft).toBe(floor.wrongsLeft - 1);
    expect(next.lastEvent).toBe("wrong-mark");
  });

  it("does not reveal a marked cell until it is unmarked", () => {
    const floor = createFloorState(1, "marked-reveal");
    const safe = findCell(
      floor,
      cell => cell.truth === "safe" && cell.view === "unknown"
    );

    const marked = reduceFloor(floor, { type: "markCell", key: safe.key });
    const revealed = reduceFloor(marked, { type: "revealCell", key: safe.key });

    expect(revealed.cells[safe.key].view).toBe("marked");
    expect(revealed.wrongsLeft).toBe(marked.wrongsLeft);
  });

  it("applies dressing without changing truth, numbers, or view", () => {
    const floor = createFloorState(1, "dressing");
    const cell = findCell(floor, candidate => candidate.view === "unknown");

    const next = reduceFloor(floor, {
      type: "applyDressing",
      dressing: {
        [cell.key]: {
          title: "False Door",
          flavor: "iris lies around the edges.",
          threatTone: "pressing",
          visualHint: "tear",
          source: "on-device",
        },
      },
    });

    expect(next.cells[cell.key].dressing?.title).toBe("False Door");
    expect(next.cells[cell.key].truth).toBe(cell.truth);
    expect(next.cells[cell.key].adjacentBlocked).toBe(cell.adjacentBlocked);
    expect(next.cells[cell.key].view).toBe(cell.view);
  });

  it("wins when every safe cell is revealed and every blocked cell is handled", () => {
    const floor = createFloorState(1, "win");
    let next: FloorState = floor;

    for (const cell of Object.values(floor.cells)) {
      if (cell.view === "revealed") continue;
      next =
        cell.truth === "safe"
          ? reduceFloor(next, { type: "revealCell", key: cell.key })
          : reduceFloor(next, { type: "markCell", key: cell.key });
    }

    expect(next.status).toBe("won");
    expect(next.lastEvent).toBe("floor-won");
  });

  it("loses when wrong budget reaches zero", () => {
    let floor = createFloorState(12, "loss");
    const blocked = Object.values(floor.cells).filter(
      cell => cell.truth === "blocked" && cell.view === "unknown"
    );
    expect(blocked.length).toBeGreaterThan(0);

    for (const cell of blocked) {
      floor = reduceFloor(floor, { type: "revealCell", key: cell.key });
      if (floor.status === "lost") break;
    }

    expect(floor.status).toBe("lost");
    expect(floor.wrongsLeft).toBe(0);
    expect(floor.lastEvent).toBe("floor-lost");
  });
});

function findCell(
  floor: FloorState,
  predicate: (cell: GameCell) => boolean
): GameCell {
  const cell = Object.values(floor.cells).find(predicate);
  if (!cell) {
    throw new Error("test fixture did not contain a matching cell");
  }
  return cell;
}

function snapshot(floor: FloorState): Array<[HexKey, string, number]> {
  return Object.values(floor.cells)
    .map(
      cell =>
        [cell.key, cell.truth, cell.adjacentBlocked] as [HexKey, string, number]
    )
    .sort(([a], [b]) => a.localeCompare(b));
}
