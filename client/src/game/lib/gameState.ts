import { computeFrontier, generateFloor } from "./generator";
import { deriveDeductions, partitionCascadeRings } from "./solver";
import {
  type FloorEvent,
  type FloorState,
  type GameCell,
  type HexKey,
  type TileDressing,
} from "./types";

export type GameAction =
  | { type: "startFloor"; floor: number; seed: string }
  | { type: "revealCell"; key: HexKey }
  | { type: "markCell"; key: HexKey }
  | { type: "applyDressing"; dressing: Record<HexKey, TileDressing> }
  | { type: "breakRandomTile" }
  | { type: "clearCascade" }
  | { type: "reset"; state: FloorState };

export function createFloorState(
  floor: number,
  seed: string,
  opts?: { warmStartDeductionCap?: number }
): FloorState {
  return generateFloor({ floor, seed, ...opts });
}

export function reduceFloor(state: FloorState, action: GameAction): FloorState {
  if (action.type === "startFloor") {
    return createFloorState(action.floor, action.seed);
  }
  if (action.type === "reset") {
    return action.state;
  }
  if (state.status !== "playing") {
    return state;
  }

  switch (action.type) {
    case "revealCell":
      return revealCell(state, action.key);
    case "markCell":
      return markCell(state, action.key);
    case "applyDressing":
      return applyDressing(state, action.dressing);
    case "breakRandomTile":
      return breakRandomTile(state);
    case "clearCascade":
      return { ...state, lastCascade: undefined };
    default:
      return state;
  }
}

function revealCell(state: FloorState, key: HexKey): FloorState {
  const cell = state.cells[key];
  if (
    !cell ||
    cell.view === "revealed" ||
    cell.view === "marked" ||
    cell.view === "broken"
  ) {
    return state;
  }

  if (cell.truth === "blocked") {
    return finalize({
      ...state,
      cells: updateCell(state.cells, key, {
        view: "broken",
        clueVisible: false,
      }),
      wrongsLeft: Math.max(0, state.wrongsLeft - 1),
      irisControl: clamp01(state.irisControl + 0.16),
      lastEvent: "wrong-reveal",
    });
  }

  let afterReveal: FloorState = {
    ...state,
    cells: updateCell(state.cells, key, {
      view: "revealed",
      clueVisible: true,
    }),
    irisControl: clamp01(state.irisControl - 0.015),
    lastEvent: "correct-reveal",
  };
  afterReveal = applyCascadeDeductions(afterReveal, key);
  return finalize(afterReveal);
}

function markCell(state: FloorState, key: HexKey): FloorState {
  const cell = state.cells[key];
  if (!cell || cell.view === "revealed" || cell.view === "broken") return state;

  if (cell.view === "marked") {
    return finalize({
      ...state,
      cells: updateCell(state.cells, key, { view: "unknown" }),
      lastEvent: undefined,
    });
  }

  const correct = cell.truth === "blocked";
  let afterMark: FloorState = {
    ...state,
    cells: updateCell(state.cells, key, { view: "marked" }),
    wrongsLeft: correct ? state.wrongsLeft : Math.max(0, state.wrongsLeft - 1),
    irisControl: clamp01(state.irisControl + (correct ? -0.035 : 0.08)),
    lastEvent: correct ? "correct-mark" : "wrong-mark",
  };
  if (correct) {
    afterMark = applyCascadeDeductions(afterMark, key);
  }
  return finalize(afterMark);
}

function applyDressing(
  state: FloorState,
  dressing: Record<HexKey, TileDressing>
): FloorState {
  const cells = { ...state.cells };
  for (const [key, value] of Object.entries(dressing) as Array<
    [HexKey, TileDressing]
  >) {
    if (cells[key]) {
      cells[key] = { ...cells[key], dressing: value };
    }
  }
  return { ...state, cells };
}

function breakRandomTile(state: FloorState): FloorState {
  const key = Object.values(state.cells)
    .filter(cell => cell.view === "unknown")
    .sort((a, b) => a.key.localeCompare(b.key))[0]?.key;
  if (!key) return state;
  return finalize({
    ...state,
    cells: updateCell(state.cells, key, {
      view: "broken",
      clueVisible: false,
    }),
    irisControl: clamp01(state.irisControl + 0.08),
    lastEvent: "tile-broken",
  });
}

function finalize(state: FloorState): FloorState {
  const cells = state.cells;
  const safeComplete = Object.values(cells).every(
    cell => cell.truth !== "safe" || cell.view === "revealed"
  );
  const blockedHandled = Object.values(cells).every(
    cell =>
      cell.truth !== "blocked" ||
      cell.view === "marked" ||
      cell.view === "broken"
  );
  const lost = state.wrongsLeft <= 0 || state.irisControl >= 1;
  const won = !lost && safeComplete && blockedHandled;
  const status = lost ? "lost" : won ? "won" : "playing";
  const lastEvent: FloorEvent | undefined =
    status === "lost"
      ? "floor-lost"
      : status === "won"
        ? "floor-won"
        : state.lastEvent;

  return {
    ...state,
    status,
    lastEvent,
    frontier: computeFrontier(cells),
  };
}

function updateCell(
  cells: Record<HexKey, GameCell>,
  key: HexKey,
  patch: Partial<GameCell>
): Record<HexKey, GameCell> {
  return {
    ...cells,
    [key]: {
      ...cells[key],
      ...patch,
    },
  };
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Auto-reveal all provably-safe unknown cells from visible clues + marks.
 * Sets `lastCascade` rings (axial distance from trigger) when any extras reveal.
 */
export function applyCascadeDeductions(
  state: FloorState,
  triggerKey: HexKey
): FloorState {
  let cells = state.cells;
  const toReveal = new Set<HexKey>();

  while (true) {
    const { provablySafe } = deriveDeductions(cells);
    const batch = provablySafe.filter(k => cells[k]?.view === "unknown");
    if (batch.length === 0) break;
    for (const key of batch) {
      toReveal.add(key);
      cells = updateCell(cells, key, {
        view: "revealed",
        clueVisible: true,
      });
    }
  }

  if (toReveal.size === 0) {
    return { ...state, cells };
  }

  const newKeys = Array.from(toReveal).sort((a, b) => a.localeCompare(b));
  const rings = partitionCascadeRings(triggerKey, newKeys, cells);

  return {
    ...state,
    cells,
    lastCascade: rings.length > 0 ? rings : undefined,
  };
}
