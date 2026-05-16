import { HEX_DIRECTIONS, type GameCell, type HexKey, hexKey } from "./types";

export interface Deductions {
  /** Unknown cells provably safe from visible clues + marks (no guessing). */
  provablySafe: HexKey[];
  /** Unknown cells provably mines (informational; gameplay does not auto-mark). */
  provablyMine: HexKey[];
}

/**
 * Constraint propagation using only clues where `clueVisible` is true.
 * Hidden clues are excluded — same information the player sees.
 * Uses player marks as known mines for counting.
 */
export function deriveDeductions(cells: Record<HexKey, GameCell>): Deductions {
  const logicalSafe = new Set<HexKey>();
  const logicalMine = new Set<HexKey>();

  for (const cell of Object.values(cells)) {
    if (cell.view === "revealed") logicalSafe.add(cell.key);
    if (cell.view === "marked") logicalMine.add(cell.key);
  }

  const provablySafe = new Set<HexKey>();
  const provablyMine = new Set<HexKey>();
  let changed = true;

  while (changed) {
    changed = false;
    for (const clue of Object.values(cells)) {
      if (clue.view !== "revealed" || !clue.clueVisible) continue;

      const neighbors = neighborKeys(clue).filter(key => cells[key]);
      const unknown = neighbors.filter(
        key => !logicalSafe.has(key) && !logicalMine.has(key)
      );
      const knownMines = neighbors.filter(key => logicalMine.has(key)).length;
      const remaining = clue.adjacentBlocked - knownMines;

      if (remaining < 0 || remaining > unknown.length) {
        return { provablySafe: [], provablyMine: [] };
      }

      if (remaining === 0) {
        for (const key of unknown) {
          logicalSafe.add(key);
          if (cells[key].view === "unknown") {
            provablySafe.add(key);
            changed = true;
          }
        }
      } else if (remaining === unknown.length) {
        for (const key of unknown) {
          logicalMine.add(key);
          if (cells[key].view === "unknown") {
            provablyMine.add(key);
            changed = true;
          }
        }
      }
    }
  }

  return {
    provablySafe: sortKeys(Array.from(provablySafe)),
    provablyMine: sortKeys(Array.from(provablyMine)),
  };
}

/** Axial hex distance (pointy-top) between two cells. */
export function axialHexDistance(
  a: Pick<GameCell, "q" | "r">,
  b: Pick<GameCell, "q" | "r">
): number {
  return (
    (Math.abs(a.q - b.q) +
      Math.abs(a.q + a.r - b.q - b.r) +
      Math.abs(a.r - b.r)) /
    2
  );
}

/**
 * Group newly revealed safe keys into animation rings by axial distance
 * from the trigger cell (same distance = same ring).
 */
export function partitionCascadeRings(
  triggerKey: HexKey,
  newSafeKeys: HexKey[],
  cells: Record<HexKey, GameCell>
): HexKey[][] {
  const trigger = cells[triggerKey];
  if (!trigger || newSafeKeys.length === 0) return [];

  const byDist = new Map<number, HexKey[]>();
  for (const key of newSafeKeys) {
    const c = cells[key];
    if (!c) continue;
    const d = axialHexDistance(trigger, c);
    const bucket = byDist.get(d);
    if (bucket) bucket.push(key);
    else byDist.set(d, [key]);
  }

  const dists = Array.from(byDist.keys()).sort((a, b) => a - b);
  return dists.map(d => sortKeys(byDist.get(d) ?? []));
}

function sortKeys(keys: HexKey[]): HexKey[] {
  return [...keys].sort((a, b) => a.localeCompare(b));
}

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
