/**
 * File Purpose: Build deterministic Hexodus floor states and frontier metadata.
 * Primary Functions: floorParams, regionEpoch, effectiveDifficultyStep,
 *   generateFloor, computeFrontier, neighborKeys.
 * Inputs/Outputs: Accepts floor/seed inputs; returns populated FloorState objects (marks `usedRimFallback` only on rim-fallback path). Retry budget `GENERATOR_BUDGET` is 200 attempts per `tryGenerateSolvableFloor`.
 */
import {
  HEX_DIRECTIONS,
  type Axial,
  type FloorState,
  type GameCell,
  type HexKey,
  hexKey,
} from "./types";
import { makeRng } from "./rng";
import { deriveDeductions, isSolverSolvable } from "./solver";

export interface GenerateFloorOptions {
  floor: number;
  seed: string;
  /**
   * Max auto-reveal steps after generation (constraint propagation).
   * Default 80. Pass 0 in unit tests that need unknown safe cells.
   */
  warmStartDeductionCap?: number;
}

interface FloorParams {
  radius: number;
  blockedRate: number;
  maxWrongs: number;
  clueRate: number;
  startRadius: number;
}

/** 1-based floor index, always >= 1. */
export function rawFloorIndex(floor: number): number {
  return Math.max(1, Math.trunc(floor));
}

/**
 * Region epoch: every `span` floors the generator grammar shifts slightly
 * (blocked density / clue pressure) without breaking solver gating.
 */
export function regionEpoch(floor: number, span = 6): number {
  return Math.floor((rawFloorIndex(floor) - 1) / span);
}

/**
 * Difficulty step used for curves: linear 1..12 then sublinear beyond 12
 * so infinite runs do not explode grid size or solver failure rates.
 */
export function effectiveDifficultyStep(floor: number): number {
  const f = rawFloorIndex(floor);
  if (f <= 12) return f;
  return 12 + Math.floor((f - 12) / 3);
}

function radiusForStep(step: number): number {
  const s = Math.min(step, 22);
  if (s <= 2) return 2;
  if (s <= 6) return 3;
  if (s <= 10) return 4;
  if (s <= 18) return 5;
  return Math.min(7, 5 + Math.floor((s - 18) / 12));
}

export function floorParams(floor: number): FloorParams {
  const step = effectiveDifficultyStep(floor);
  const epoch = Math.min(regionEpoch(floor), 8);
  const densityStep = Math.min(step, 15);
  const blockedRate = Math.min(
    0.46,
    0.18 + densityStep * 0.016 + epoch * 0.007
  );
  return {
    radius: radiusForStep(step),
    blockedRate,
    maxWrongs: Math.max(2, 7 - Math.ceil(step / 2)),
    clueRate: Math.max(0.3, 0.62 - densityStep * 0.017 - epoch * 0.015),
    startRadius: step <= 6 ? 1 : step <= 10 ? 2 : 3,
  };
}

const GENERATOR_BUDGET = 200;

/**
 * Best-effort solvable-floor generation. Returns `null` if the
 * retry budget (`GENERATOR_BUDGET` attempts) runs out without
 * finding a solver-solvable candidate. Tests use this to assert
 * the budget is enough for real gameplay floors.
 */
export function tryGenerateSolvableFloor({
  floor,
  seed,
  warmStartDeductionCap,
}: GenerateFloorOptions): FloorState | null {
  const params = floorParams(floor);
  for (let attempt = 0; attempt < GENERATOR_BUDGET; attempt++) {
    const candidate = generateCandidate({
      floor,
      seed,
      params,
      attempt,
      blockedRate: params.blockedRate,
      warmStartDeductionCap,
    });
    if (isSolverSolvable(candidate.cells)) {
      return candidate;
    }
  }
  return null;
}

export function generateFloor(opts: GenerateFloorOptions): FloorState {
  const found = tryGenerateSolvableFloor(opts);
  if (found) return found;

  const params = floorParams(opts.floor);
  const rim = generateCandidate({
    floor: opts.floor,
    seed: opts.seed,
    params,
    attempt: GENERATOR_BUDGET,
    blockedRate: 1,
    rimFallback: true,
    warmStartDeductionCap: opts.warmStartDeductionCap,
  });
  return { ...rim, usedRimFallback: true };
}

const WARM_START_DEDUCTION_CAP = 80;

function countAdjacentBlockedAmongBlocked(
  cell: Axial,
  cells: Record<HexKey, GameCell>
): number {
  return neighborKeys(cell).filter(key => cells[key]?.truth === "blocked")
    .length;
}

function cellVariantFromAmongBlocked(n: number): 0 | 1 | 2 | 3 {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n <= 3) return 2;
  return 3;
}

/** Deterministic auto-reveal from starting clues (capped). Mutates `cells`. */
function applyWarmStartDeductionsInPlace(
  cells: Record<HexKey, GameCell>,
  cap: number
): void {
  if (cap <= 0) return;
  let total = 0;
  while (total < cap) {
    const { provablySafe } = deriveDeductions(cells);
    const batch = provablySafe.filter(k => cells[k]?.view === "unknown");
    if (batch.length === 0) break;
    for (const key of batch) {
      if (total >= cap) break;
      const c = cells[key];
      cells[key] = { ...c, view: "revealed", clueVisible: true };
      total++;
    }
  }
}

function generateCandidate({
  floor,
  seed,
  params,
  attempt,
  blockedRate,
  rimFallback = false,
  warmStartDeductionCap = WARM_START_DEDUCTION_CAP,
}: GenerateFloorOptions & {
  params: FloorParams;
  attempt: number;
  blockedRate: number;
  rimFallback?: boolean;
}): FloorState {
  const rng = makeRng(`${seed}:floor:${floor}:attempt:${attempt}`);
  const coords = axialDisk(params.radius);
  const cells: Record<HexKey, GameCell> = {} as Record<HexKey, GameCell>;

  for (const coord of coords) {
    const key = hexKey(coord.q, coord.r);
    const isOrigin = coord.q === 0 && coord.r === 0;
    const distance = axialDistance(coord, { q: 0, r: 0 });
    const isStartingZone = distance <= params.startRadius;
    const truth = rimFallback
      ? distance === params.radius
        ? "blocked"
        : "safe"
      : isOrigin || isStartingZone || rng() > blockedRate
        ? "safe"
        : "blocked";
    cells[key] = {
      ...coord,
      key,
      truth,
      view: isStartingZone ? "revealed" : "unknown",
      adjacentBlocked: 0,
      clueVisible: isStartingZone,
    };
  }

  for (const cell of Object.values(cells)) {
    cell.adjacentBlocked = countAdjacentBlocked(cell, cells);
    if (cell.truth === "safe" && cell.view !== "revealed") {
      cell.clueVisible = rng() < params.clueRate;
    }
  }

  for (const cell of Object.values(cells)) {
    if (cell.truth === "blocked") {
      const among = countAdjacentBlockedAmongBlocked(cell, cells);
      cell.cellVariant = cellVariantFromAmongBlocked(among);
    }
  }

  applyWarmStartDeductionsInPlace(cells, warmStartDeductionCap);

  return {
    floor,
    seed,
    cells,
    frontier: computeFrontier(cells),
    wrongsLeft: params.maxWrongs,
    maxWrongs: params.maxWrongs,
    irisControl: 0.02,
    status: "playing",
  };
}

export function neighborKeys(cell: Axial): HexKey[] {
  return HEX_DIRECTIONS.map(dir => hexKey(cell.q + dir.q, cell.r + dir.r));
}

export function computeFrontier(cells: Record<HexKey, GameCell>): HexKey[] {
  const revealed = new Set(
    Object.values(cells)
      .filter(cell => cell.view === "revealed")
      .map(cell => cell.key)
  );
  const frontier = new Set<HexKey>();

  for (const cell of Object.values(cells)) {
    if (!revealed.has(cell.key)) continue;
    for (const key of neighborKeys(cell)) {
      const neighbor = cells[key];
      if (neighbor && neighbor.view === "unknown") {
        frontier.add(key);
      }
    }
  }

  return Array.from(frontier).sort();
}

function countAdjacentBlocked(
  cell: Axial,
  cells: Record<HexKey, GameCell>
): number {
  return neighborKeys(cell).filter(key => cells[key]?.truth === "blocked")
    .length;
}

function axialDisk(radius: number): Axial[] {
  const coords: Axial[] = [];
  for (let q = -radius; q <= radius; q++) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r++) {
      coords.push({ q, r });
    }
  }
  return coords;
}

function axialDistance(a: Axial, b: Axial): number {
  return (
    (Math.abs(a.q - b.q) +
      Math.abs(a.q + a.r - b.q - b.r) +
      Math.abs(a.r - b.r)) /
    2
  );
}
