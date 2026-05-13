import { computeFrontier, generateFloor } from "./generator";
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
  | { type: "reset"; state: FloorState };

export function createFloorState(floor: number, seed: string): FloorState {
  return generateFloor({ floor, seed });
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

  return finalize({
    ...state,
    cells: updateCell(state.cells, key, {
      view: "revealed",
      clueVisible: true,
    }),
    irisControl: clamp01(state.irisControl - 0.015),
    lastEvent: "correct-reveal",
  });
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
  return finalize({
    ...state,
    cells: updateCell(state.cells, key, { view: "marked" }),
    wrongsLeft: correct ? state.wrongsLeft : Math.max(0, state.wrongsLeft - 1),
    irisControl: clamp01(state.irisControl + (correct ? -0.035 : 0.08)),
    lastEvent: correct ? "correct-mark" : "wrong-mark",
  });
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
