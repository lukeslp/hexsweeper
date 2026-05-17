export type HexKey = `${number},${number}`;

export interface Axial {
  q: number;
  r: number;
}

export type CellTruth = "safe" | "blocked";
export type CellView = "unknown" | "revealed" | "marked" | "broken";

export interface TileDressing {
  title: string;
  flavor: string;
  threatTone: "quiet" | "watching" | "pressing" | "breach";
  visualHint?: "none" | "flicker" | "tear" | "blackout";
  source: "on-device" | "fallback";
}

export interface GameCell extends Axial {
  key: HexKey;
  truth: CellTruth;
  view: CellView;
  adjacentBlocked: number;
  clueVisible: boolean;
  /** Mine-cluster visual tier (blocked cells only); set at generation. */
  cellVariant?: 0 | 1 | 2 | 3;
  dressing?: TileDressing;
}

/** Public puzzle-facing cell snapshot for director / procedural dressing. */
export interface PublicCellContext extends Axial {
  key: HexKey;
  view: CellView;
  adjacentBlocked?: number;
  clueVisible: boolean;
  title?: string;
}

export type FloorStatus = "playing" | "won" | "lost";

export interface FloorState {
  floor: number;
  seed: string;
  cells: Record<HexKey, GameCell>;
  frontier: HexKey[];
  wrongsLeft: number;
  maxWrongs: number;
  irisControl: number;
  status: FloorStatus;
  lastEvent?: FloorEvent;
  /** Auto-reveal cascade rings (hex axial distance from trigger); cleared after animation. */
  lastCascade?: HexKey[][];
  /** True when solvability budget was exhausted and the rim-fallback board was used. */
  usedRimFallback?: boolean;
}

export type FloorEvent =
  | "correct-reveal"
  | "wrong-reveal"
  | "correct-mark"
  | "wrong-mark"
  | "tile-broken"
  | "cascade-reveal"
  | "floor-won"
  | "floor-lost";

export const HEX_DIRECTIONS: readonly Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
] as const;

export function hexKey(q: number, r: number): HexKey {
  return `${q},${r}` as HexKey;
}
