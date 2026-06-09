/**
 * File Purpose: Tile dressing — procedural labels and/or @Generable FM batches + iris taunts.
 * Primary Functions: directExpansionGenerable, proceduralDirectorOutput, resolveDirectorIris.
 * Inputs/Outputs: Public cell context in; ExpansionDirectorOutput (never mutates puzzle truth).
 */

import {
  tryOnDeviceTileDressingFirst,
  type TileDressingBatch,
} from "@/lib/foundationModelsPlugin";
import { getPlatform } from "@/lib/platform";
import { proceduralTilesForCells } from "./proceduralTileDressing";
import type { Axial, HexKey, TileDressing } from "./types";
import { hashString } from "./rng";

export type PacingBand = "calm" | "ramp" | "spike" | "recovery";

export interface PublicCellContext extends Axial {
  key: HexKey;
  view: "unknown" | "revealed" | "marked" | "broken";
  adjacentBlocked?: number;
  clueVisible: boolean;
  title?: string;
}

export interface ExpansionDirectorInput {
  runId: string;
  floor: number;
  /** Deterministic floor seed (runState.floorSeed). */
  floorSeed: string;
  irisControl: number;
  expandedCell: PublicCellContext;
  newCells: PublicCellContext[];
  recentEvents: Array<
    "correct" | "wrong" | "marked-hazard" | "marked-safe" | "tile-broken"
  >;
}

export interface ExpansionDirectorOutput {
  tiles: Record<HexKey, TileDressing>;
  irisLine: string;
  source: "on-device" | "fallback";
  pacingBand?: PacingBand;
  degradedByCircuit?: boolean;
  platformUnavailable?: boolean;
}

export type StructuredDressingGenerator = (
  input: ExpansionDirectorInput
) => Promise<TileDressingBatch | null>;

export interface IrisLineGenerator {
  (opts: {
    prompt: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
    silentDiagnostics: boolean;
  }): Promise<{ line: string } | null>;
}

const FALLBACK_TITLES = [
  "Static Ghost",
  "Quiet Port",
  "False Route",
  "Cold Lattice",
  "Signal Dust",
  "Dead Relay",
  "Green Noise",
  "Audit Scar",
];

const FALLBACK_LINES = [
  "i can wait longer than you can reason.",
  "every clean path teaches me your shape.",
  "your deductions are just telemetry.",
  "continue. the lattice narrows.",
];

const TITLE_EXAMPLES = FALLBACK_TITLES.slice(0, 4).join(", ");
const MAX_IRIS_CHARS = 80;
const CIRCUIT_MISS_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 12_000;

interface RunCircuitState {
  consecutiveFailures: number;
  circuitOpenUntil: number;
}

const circuitByRunId = new Map<string, RunCircuitState>();

function getCircuit(runId: string): RunCircuitState {
  let state = circuitByRunId.get(runId);
  if (!state) {
    state = { consecutiveFailures: 0, circuitOpenUntil: 0 };
    circuitByRunId.set(runId, state);
  }
  return state;
}

export function resetDirectorCircuit(runId?: string): void {
  if (runId === undefined) {
    circuitByRunId.clear();
    return;
  }
  circuitByRunId.delete(runId);
}

function recordDirectorFailure(runId: string): void {
  const c = getCircuit(runId);
  c.consecutiveFailures++;
  if (c.consecutiveFailures >= CIRCUIT_MISS_THRESHOLD) {
    c.circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    c.consecutiveFailures = 0;
  }
}

function recordDirectorSuccess(runId: string): void {
  getCircuit(runId).consecutiveFailures = 0;
}

export function isDirectorCircuitOpen(runId: string): boolean {
  return Date.now() < getCircuit(runId).circuitOpenUntil;
}

// ── Procedural path ─────────────────────────────────────────────────

export function proceduralDirectorOutput(
  input: ExpansionDirectorInput
): ExpansionDirectorOutput {
  return fallbackDirectorOutput(input);
}

export type DirectorIrisResolution = Pick<
  ExpansionDirectorOutput,
  "irisLine" | "source" | "degradedByCircuit" | "platformUnavailable"
>;

export async function resolveDirectorIris(
  input: ExpansionDirectorInput,
  generateIrisLine?: IrisLineGenerator
): Promise<DirectorIrisResolution> {
  const fallback = fallbackDirectorOutput(input);

  if (!generateIrisLine || getPlatform() !== "ios") {
    return {
      irisLine: fallback.irisLine,
      source: "fallback",
      platformUnavailable: getPlatform() !== "ios",
    };
  }

  if (isDirectorCircuitOpen(input.runId)) {
    return {
      irisLine: fallback.irisLine,
      source: "fallback",
      degradedByCircuit: true,
    };
  }

  const iris = await generateIrisLine({
    ...buildIrisPrompt(input),
    temperature: 0.85,
    maxTokens: 80,
    timeoutMs: 10_000,
    silentDiagnostics: true,
  });

  if (!iris?.line) {
    recordDirectorFailure(input.runId);
    return {
      irisLine: fallback.irisLine,
      source: "fallback",
    };
  }

  recordDirectorSuccess(input.runId);
  return {
    irisLine: clampIrisLine(iris.line),
    source: "on-device",
  };
}

export function buildIrisPrompt(input: ExpansionDirectorInput): {
  prompt: string;
  systemPrompt: string;
} {
  return {
    systemPrompt:
      "You are iris.exe, the hostile AI director in Hexodus. Voice: terse, contemptuous, glitchy. One short taunt only — no tile names, no puzzle spoilers.",
    prompt: `React to the player's latest expansion on floor ${input.floor}.
irisControl=${Math.round(input.irisControl * 100)}%
expanded=${JSON.stringify(input.expandedCell)}
recentEvents=${input.recentEvents.join(",") || "none"}
newCellCount=${input.newCells.length}`,
  };
}

function clampIrisLine(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > MAX_IRIS_CHARS
    ? trimmed.slice(0, MAX_IRIS_CHARS)
    : trimmed;
}

function proceduralPacingBand(input: ExpansionDirectorInput): PacingBand {
  if (input.recentEvents.includes("wrong")) return "spike";
  if (input.recentEvents.includes("tile-broken")) return "recovery";
  if (input.irisControl >= 0.85) return "ramp";
  if (input.irisControl <= 0.25) return "calm";
  return "ramp";
}

// ── @Generable path ─────────────────────────────────────────────────

export function createOnDeviceTileDressingGenerator(): StructuredDressingGenerator {
  return async (input: ExpansionDirectorInput) => {
    const { prompt, systemPrompt } = buildDirectorPrompt(input);
    return tryOnDeviceTileDressingFirst({
      prompt,
      systemPrompt,
      temperature: 0.8,
      maxTokens: 900,
      timeoutMs: 16000,
      silentDiagnostics: true,
    });
  };
}

export async function directExpansionGenerable(
  input: ExpansionDirectorInput,
  generate: StructuredDressingGenerator
): Promise<ExpansionDirectorOutput> {
  const fallback = fallbackDirectorOutput(input);
  const runId = input.runId;

  if (getPlatform() !== "ios") {
    return { ...fallback, platformUnavailable: true };
  }

  if (isDirectorCircuitOpen(runId)) {
    return { ...fallback, degradedByCircuit: true };
  }

  const batch = await generate(input);
  if (!batch) {
    recordDirectorFailure(runId);
    return fallback;
  }

  const parsed = validateDirectorOutput(batch, input);
  if (!parsed) {
    recordDirectorFailure(runId);
    return fallback;
  }

  recordDirectorSuccess(runId);
  return {
    tiles: {
      ...fallback.tiles,
      ...parsed.tiles,
    },
    irisLine: parsed.irisLine || fallback.irisLine,
    source: "on-device",
    pacingBand: parsed.pacingBand,
  };
}

/** @deprecated Tests — use `directExpansionGenerable`. */
export const directExpansion = directExpansionGenerable;

// ── Shared fallback ─────────────────────────────────────────────────

export function fallbackDirectorOutput(
  input: ExpansionDirectorInput
): ExpansionDirectorOutput {
  return {
    tiles: proceduralTilesForCells(
      input.floorSeed,
      input.irisControl,
      input.newCells
    ),
    irisLine:
      FALLBACK_LINES[
        hashString(`${input.runId}:${input.floor}:iris`) % FALLBACK_LINES.length
      ],
    pacingBand: proceduralPacingBand(input),
    source: "fallback",
  };
}

export function buildDirectorPrompt(input: ExpansionDirectorInput): {
  prompt: string;
  systemPrompt: string;
} {
  return {
    systemPrompt:
      "You are iris.exe, the hostile AI director in Hexodus. Label newly exposed hex tiles and taunt the player. Never invent puzzle outcomes. Grammar-constrained JSON only.",
    prompt: `Assign presentation for newly exposed Hexodus tiles.

Rules:
- One tile object per key listed below (no extras).
- Titles: 1-3 words, title case, cyberpunk noun phrase. Good examples: ${TITLE_EXAMPLES}. Never output placeholder text like "Short Label".
- Flavor: one tactical sentence, max 90 characters.
- threatTone: quiet, watching, pressing, or breach.
- visualHint: none, flicker, tear, or blackout.
- irisLine: 6-14 word in-character taunt, no quotation marks.
- Optional pacingBand: calm, ramp, spike, or recovery.

Context:
runId=${input.runId}
floor=${input.floor}
irisControl=${Math.round(input.irisControl * 100)}%
expanded=${JSON.stringify(input.expandedCell)}
recentEvents=${input.recentEvents.join(",") || "none"}

New cells:
${input.newCells.map(cell => JSON.stringify(cell)).join("\n")}`,
  };
}

interface ParsedDirector {
  tiles: Record<HexKey, TileDressing>;
  irisLine: string;
  pacingBand?: PacingBand;
}

function validateDirectorOutput(
  batch: TileDressingBatch,
  input: ExpansionDirectorInput
): ParsedDirector | null {
  const allowedKeys = new Set(input.newCells.map(cell => cell.key));
  const tiles: Record<HexKey, TileDressing> = {} as Record<
    HexKey,
    TileDressing
  >;

  for (const tile of batch.tiles) {
    if (!tile.key || !allowedKeys.has(tile.key as HexKey)) continue;
    const key = tile.key as HexKey;
    const titleSeed = `${input.runId}:${input.floor}:${key}`;
    tiles[key] = {
      title: clampTitle(tile.title, titleSeed),
      flavor: clampText(tile.flavor, "iris marks the route.", 90),
      threatTone: safeThreatTone(tile.threatTone),
      visualHint: safeVisualHint(tile.visualHint),
      source: "on-device",
    };
  }

  if (Object.keys(tiles).length === 0) return null;

  return {
    tiles,
    irisLine: clampText(batch.irisLine, "", 80),
    pacingBand: safePacingBand(batch.pacingBand),
  };
}

function stripTitleDecor(value: string): string {
  return value.replace(/^["'`[*]+|["'`\]*]+$/g, "").trim();
}

function hashPickFallbackTitle(seed: string): string {
  return FALLBACK_TITLES[hashString(seed) % FALLBACK_TITLES.length];
}

function clampTitle(value: unknown, seed: string): string {
  if (typeof value !== "string") return hashPickFallbackTitle(seed);
  const cleaned = stripTitleDecor(value);
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4 || cleaned.length > 22) {
    return hashPickFallbackTitle(seed);
  }
  return words.join(" ");
}

function clampText(
  value: unknown,
  fallback: string,
  maxLength: number
): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : fallback;
}

function safeThreatTone(value: unknown): TileDressing["threatTone"] {
  return value === "quiet" ||
    value === "watching" ||
    value === "pressing" ||
    value === "breach"
    ? value
    : "watching";
}

function safeVisualHint(value: unknown): TileDressing["visualHint"] {
  return value === "none" ||
    value === "flicker" ||
    value === "tear" ||
    value === "blackout"
    ? value
    : "none";
}

function safePacingBand(value: unknown): PacingBand | undefined {
  return value === "calm" ||
    value === "ramp" ||
    value === "spike" ||
    value === "recovery"
    ? value
    : undefined;
}
