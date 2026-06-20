/**
 * File Purpose: Procedural tile dressing + on-device iris taunts on expansion.
 * Primary Functions: directExpansion, fallbackDirectorOutput, resetDirectorCircuit(runId?).
 * Inputs/Outputs: Public cell context in; ExpansionDirectorOutput (never mutates puzzle truth).
 */

import { getPlatform } from "@/lib/platform";
import { proceduralTilesForCells } from "./proceduralTileDressing";
import { hashString } from "./rng";
import type { HexKey, PublicCellContext, TileDressing } from "./types";

export type { PublicCellContext } from "./types";

export type PacingBand = "calm" | "ramp" | "spike" | "recovery";

export interface ExpansionDirectorInput {
  runId: string;
  floor: number;
  /** Deterministic floor seed (from runState.floorSeed). */
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
  /** True when on-device path was skipped (non-iOS / FM unavailable). */
  platformUnavailable?: boolean;
}

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

const MAX_IRIS_CHARS = 80;

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

/** Sync procedural tiles + fallback iris/pacing (no FM). */
export function proceduralDirectorOutput(
  input: ExpansionDirectorInput
): ExpansionDirectorOutput {
  return fallbackDirectorOutput(input);
}

export type DirectorIrisResolution = Pick<
  ExpansionDirectorOutput,
  "irisLine" | "source" | "degradedByCircuit" | "platformUnavailable"
>;

/** FM iris line only — tiles must already come from `proceduralDirectorOutput`. */
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

export async function directExpansion(
  input: ExpansionDirectorInput,
  generateIrisLine?: IrisLineGenerator
): Promise<ExpansionDirectorOutput> {
  const base = proceduralDirectorOutput(input);
  const iris = await resolveDirectorIris(input, generateIrisLine);
  return { ...base, ...iris };
}

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
        hashString(`${input.runId}:${input.floor}:iris`) %
          FALLBACK_LINES.length
      ],
    pacingBand: proceduralPacingBand(input),
    source: "fallback",
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
