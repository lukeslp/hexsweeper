import {
  HEX_DIRECTIONS,
  type Axial,
  type FloorState,
  type GameCell,
  type HexKey,
  hexKey,
} from "./types";
import { makeRng } from "./rng";
import { isSolverSolvable } from "./solver";

export interface GenerateFloorOptions {
  floor: number;
  seed: string;
}

interface FloorParams {
  radius: number;
  blockedRate: number;
  maxWrongs: number;
  clueRate: number;
}

export function floorParams(floor: number): FloorParams {
  const clamped = Math.min(Math.max(Math.trunc(floor), 1), 12);
  return {
    radius: clamped <= 2 ? 2 : clamped <= 6 ? 3 : clamped <= 10 ? 4 : 5,
    blockedRate: 0.18 + clamped * 0.018,
    maxWrongs: Math.max(1, 6 - Math.ceil(clamped / 2)),
    clueRate: Math.max(0.34, 0.62 - clamped * 0.018),
  };
}

export function generateFloor({
  floor,
  seed,
}: GenerateFloorOptions): FloorState {
  const params = floorParams(floor);
  for (let attempt = 0; attempt < 80; attempt++) {
    const candidate = generateCandidate({
      floor,
      seed,
      params,
      attempt,
      blockedRate: params.blockedRate,
    });
    if (isSolverSolvable(candidate.cells)) {
      return candidate;
    }
  }

  return generateCandidate({
    floor,
    seed,
    params,
    attempt: 80,
    blockedRate: 1,
    rimFallback: true,
  });
}

function generateCandidate({
  floor,
  seed,
  params,
  attempt,
  blockedRate,
  rimFallback = false,
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
    const isStartingZone = distance <= 1;
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
      view: isOrigin ? "revealed" : "unknown",
      adjacentBlocked: 0,
      clueVisible: isOrigin,
    };
  }

  for (const cell of Object.values(cells)) {
    cell.adjacentBlocked = countAdjacentBlocked(cell, cells);
    if (cell.truth === "safe" && cell.view !== "revealed") {
      cell.clueVisible = rng() < params.clueRate;
    }
  }

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
