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
  dressing?: TileDressing;
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
}

export type FloorEvent =
  | "correct-reveal"
  | "wrong-reveal"
  | "correct-mark"
  | "wrong-mark"
  | "tile-broken"
  | "floor-won"
  | "floor-lost";

export interface RunState {
  runId: string;
  seed: string;
  floor: number;
  status: "active" | "escaped" | "caught";
  bestFloor: number;
  totalWrongs: number;
}

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
