/**
 * File Purpose: Deterministic per-cell tile titles/flavor from floor seed + puzzle context.
 * Primary Functions: proceduralTilesForCells, proceduralTileForCell.
 * Inputs/Outputs: floorSeed, irisControl, PublicCellContext[] in; Record<HexKey, TileDressing> out.
 */

import type { PublicCellContext } from "./director";
import { hashString } from "./rng";
import type { HexKey, TileDressing } from "./types";

/** Short title pool — combined procedurally for variety without LLM. */
const TITLE_A = [
  "Static",
  "Cold",
  "False",
  "Dead",
  "Green",
  "Audit",
  "Null",
  "Ghost",
  "Cipher",
  "Rim",
  "Hollow",
  "Bit",
] as const;

const TITLE_B = [
  "Ghost",
  "Port",
  "Route",
  "Lattice",
  "Relay",
  "Noise",
  "Scar",
  "Node",
  "Gate",
  "Vein",
  "Shard",
  "Loop",
] as const;

const FRONTIER_FLAVORS = [
  "iris tags the edge; the count does not lie.",
  "a clean label on an unmapped route.",
  "the lattice waits for your next step.",
  "signal dust on an unknown bearing.",
] as const;

const REVEALED_FLAVORS = [
  "the adjacency count already told the story.",
  "mapped ground; iris only renames it.",
  "telemetry confirms what you proved.",
  "a named corridor through verified safe stone.",
] as const;

const HIGH_CLUE_FLAVORS = [
  "heavy adjacency pressure on this bearing.",
  "the numbers crowd this junction.",
  "iris watches a dense clue cluster.",
] as const;

export function proceduralTileForCell(
  floorSeed: string,
  irisControl: number,
  cell: PublicCellContext
): TileDressing {
  const h = hashString(`${floorSeed}:${cell.key}:${cell.view}:${cell.adjacentBlocked ?? -1}`);
  const title = pickTitle(h);
  const flavor = pickFlavor(h, cell);
  const threatTone = threatToneForIris(irisControl);
  return {
    title,
    flavor,
    threatTone,
    visualHint: visualHintForTone(threatTone, h),
    source: "fallback",
  };
}

export function proceduralTilesForCells(
  floorSeed: string,
  irisControl: number,
  cells: PublicCellContext[]
): Record<HexKey, TileDressing> {
  const tiles = {} as Record<HexKey, TileDressing>;
  for (const cell of cells) {
    tiles[cell.key] = proceduralTileForCell(floorSeed, irisControl, cell);
  }
  return tiles;
}

function pickTitle(h: number): string {
  const a = TITLE_A[h % TITLE_A.length]!;
  const b = TITLE_B[(h >>> 8) % TITLE_B.length]!;
  if (a === b) {
    return `${a} ${TITLE_B[(h >>> 16) % TITLE_B.length]!}`;
  }
  return `${a} ${b}`;
}

function pickFlavor(h: number, cell: PublicCellContext): string {
  if (
    cell.clueVisible &&
    typeof cell.adjacentBlocked === "number" &&
    cell.adjacentBlocked >= 3
  ) {
    return HIGH_CLUE_FLAVORS[h % HIGH_CLUE_FLAVORS.length]!;
  }
  if (cell.view === "revealed") {
    return REVEALED_FLAVORS[(h >>> 4) % REVEALED_FLAVORS.length]!;
  }
  return FRONTIER_FLAVORS[(h >>> 12) % FRONTIER_FLAVORS.length]!;
}

function threatToneForIris(
  irisControl: number
): TileDressing["threatTone"] {
  if (irisControl >= 0.85) return "breach";
  if (irisControl >= 0.65) return "pressing";
  if (irisControl >= 0.35) return "watching";
  return "quiet";
}

function visualHintForTone(
  tone: TileDressing["threatTone"],
  h: number
): TileDressing["visualHint"] {
  if (tone === "breach") return "blackout";
  if (tone === "pressing") return h % 2 === 0 ? "tear" : "flicker";
  if (tone === "watching" && h % 5 === 0) return "flicker";
  return "none";
}
