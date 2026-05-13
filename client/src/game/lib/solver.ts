import { HEX_DIRECTIONS, type GameCell, type HexKey, hexKey } from "./types";

export type SolverStep =
  | { type: "reveal-safe"; source: HexKey; keys: HexKey[] }
  | { type: "mark-blocked"; source: HexKey; keys: HexKey[] };

export interface SolverResult {
  solved: boolean;
  contradiction: boolean;
  steps: SolverStep[];
  revealedSafe: Set<HexKey>;
  markedBlocked: Set<HexKey>;
}

export function solveFloorTruth(cells: Record<HexKey, GameCell>): SolverResult {
  const revealedSafe = new Set<HexKey>();
  const markedBlocked = new Set<HexKey>();
  const steps: SolverStep[] = [];

  for (const cell of Object.values(cells)) {
    if (cell.view === "revealed") {
      if (cell.truth !== "safe") {
        return result(false, true, steps, revealedSafe, markedBlocked);
      }
      revealedSafe.add(cell.key);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;

    for (const clue of Object.values(cells)) {
      if (!revealedSafe.has(clue.key)) continue;

      const neighbors = neighborKeys(clue).filter(key => cells[key]);
      const unknown = neighbors.filter(
        key => !revealedSafe.has(key) && !markedBlocked.has(key)
      );
      if (unknown.length === 0) continue;

      const knownBlocked = neighbors.filter(key => markedBlocked.has(key));
      const remainingBlocked = clue.adjacentBlocked - knownBlocked.length;

      if (remainingBlocked < 0 || remainingBlocked > unknown.length) {
        return result(false, true, steps, revealedSafe, markedBlocked);
      }

      if (remainingBlocked === 0) {
        for (const key of unknown) {
          if (cells[key].truth !== "safe") {
            return result(false, true, steps, revealedSafe, markedBlocked);
          }
          revealedSafe.add(key);
        }
        steps.push({ type: "reveal-safe", source: clue.key, keys: unknown });
        changed = true;
        continue;
      }

      if (remainingBlocked === unknown.length) {
        for (const key of unknown) {
          if (cells[key].truth !== "blocked") {
            return result(false, true, steps, revealedSafe, markedBlocked);
          }
          markedBlocked.add(key);
        }
        steps.push({ type: "mark-blocked", source: clue.key, keys: unknown });
        changed = true;
      }
    }
  }

  const solved = Object.values(cells).every(cell =>
    cell.truth === "safe"
      ? revealedSafe.has(cell.key)
      : markedBlocked.has(cell.key)
  );
  return result(solved, false, steps, revealedSafe, markedBlocked);
}

export function isSolverSolvable(cells: Record<HexKey, GameCell>): boolean {
  return solveFloorTruth(cells).solved;
}

function neighborKeys(cell: Pick<GameCell, "q" | "r">): HexKey[] {
  return HEX_DIRECTIONS.map(dir => hexKey(cell.q + dir.q, cell.r + dir.r));
}

function result(
  solved: boolean,
  contradiction: boolean,
  steps: SolverStep[],
  revealedSafe: Set<HexKey>,
  markedBlocked: Set<HexKey>
): SolverResult {
  return {
    solved,
    contradiction,
    steps,
    revealedSafe,
    markedBlocked,
  };
}
