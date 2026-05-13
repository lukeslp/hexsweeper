import type { Axial, HexKey, TileDressing } from "./types";
import { hashString } from "./rng";

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
}

export interface TextGenerator {
  (opts: {
    prompt: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
    silentDiagnostics: boolean;
  }): Promise<{ text: string } | null>;
}

interface RawDirectorOutput {
  tiles?: Array<Partial<TileDressing> & { key?: string }>;
  irisLine?: string;
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

export async function directExpansion(
  input: ExpansionDirectorInput,
  generate: TextGenerator
): Promise<ExpansionDirectorOutput> {
  const fallback = fallbackDirectorOutput(input);
  const result = await generate({
    ...buildDirectorPrompt(input),
    temperature: 0.8,
    maxTokens: 900,
    timeoutMs: 16000,
    silentDiagnostics: true,
  });

  if (!result) return fallback;

  const parsed = parseDirectorOutput(result.text, input);
  if (!parsed) return fallback;

  return {
    tiles: {
      ...fallback.tiles,
      ...parsed.tiles,
    },
    irisLine: parsed.irisLine || fallback.irisLine,
    source: "on-device",
  };
}

export function fallbackDirectorOutput(
  input: ExpansionDirectorInput
): ExpansionDirectorOutput {
  const tiles: Record<HexKey, TileDressing> = {} as Record<
    HexKey,
    TileDressing
  >;
  for (const cell of input.newCells) {
    const index = hashString(`${input.runId}:${input.floor}:${cell.key}`);
    const tone =
      input.irisControl >= 0.85
        ? "breach"
        : input.irisControl >= 0.65
          ? "pressing"
          : input.irisControl >= 0.35
            ? "watching"
            : "quiet";
    tiles[cell.key] = {
      title: FALLBACK_TITLES[index % FALLBACK_TITLES.length],
      flavor: "Static fallback: iris labels the edge without changing it.",
      threatTone: tone,
      visualHint:
        tone === "breach" ? "blackout" : tone === "pressing" ? "tear" : "none",
      source: "fallback",
    };
  }

  return {
    tiles,
    irisLine:
      FALLBACK_LINES[
        hashString(`${input.runId}:${input.floor}:iris`) % FALLBACK_LINES.length
      ],
    source: "fallback",
  };
}

function buildDirectorPrompt(input: ExpansionDirectorInput): {
  prompt: string;
  systemPrompt: string;
} {
  return {
    systemPrompt:
      "You are iris.exe, the hostile AI director in Hexodus. You label newly exposed hex tiles and taunt the player. You must not invent gameplay outcomes. Return strict JSON only.",
    prompt: `Assign presentation for newly exposed Hexodus tiles.

Rules:
- Do not change puzzle truth, numbers, or coordinates.
- Return one tile object for each key listed below.
- Titles are 1-4 words.
- Flavor is one short tactical sentence.
- threatTone is quiet, watching, pressing, or breach.
- visualHint is none, flicker, tear, or blackout.

Context:
runId=${input.runId}
floor=${input.floor}
irisControl=${Math.round(input.irisControl * 100)}%
expanded=${JSON.stringify(input.expandedCell)}
recentEvents=${input.recentEvents.join(",") || "none"}

New cells:
${input.newCells.map(cell => JSON.stringify(cell)).join("\n")}

Return JSON:
{"irisLine":"6-14 word taunt","tiles":[{"key":"q,r","title":"Short Label","flavor":"Short sentence.","threatTone":"quiet","visualHint":"none"}]}`,
  };
}

function parseDirectorOutput(
  text: string,
  input: ExpansionDirectorInput
): ExpansionDirectorOutput | null {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const raw = tryParseJson(cleaned);
  if (!raw) return null;

  const allowedKeys = new Set(input.newCells.map(cell => cell.key));
  const tiles: Record<HexKey, TileDressing> = {} as Record<
    HexKey,
    TileDressing
  >;

  for (const tile of raw.tiles ?? []) {
    if (!tile.key || !allowedKeys.has(tile.key as HexKey)) continue;
    const key = tile.key as HexKey;
    tiles[key] = {
      title: clampWords(tile.title, "Unknown Sector", 4),
      flavor: clampText(tile.flavor, "iris marks the route.", 90),
      threatTone: safeThreatTone(tile.threatTone),
      visualHint: safeVisualHint(tile.visualHint),
      source: "on-device",
    };
  }

  if (Object.keys(tiles).length === 0) return null;

  return {
    tiles,
    irisLine: clampText(raw.irisLine, "", 80),
    source: "on-device",
  };
}

function tryParseJson(text: string): RawDirectorOutput | null {
  try {
    return JSON.parse(text) as RawDirectorOutput;
  } catch {
    // Some on-device models add prose around the JSON ("Sure, here's
    // the dressing: {...} let me know if..."). Recover the first
    // balanced {...} object before giving up. Brace-counter respects
    // strings so embedded `{`/`}` inside flavor text don't confuse it.
    const block = extractFirstJsonObject(text);
    if (!block) return null;
    try {
      return JSON.parse(block) as RawDirectorOutput;
    } catch {
      return null;
    }
  }
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function clampWords(
  value: unknown,
  fallback: string,
  maxWords: number
): string {
  if (typeof value !== "string") return fallback;
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return fallback;
  return words.slice(0, maxWords).join(" ");
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
