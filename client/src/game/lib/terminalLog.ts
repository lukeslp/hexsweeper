/**
 * File Purpose: Pure reducer for the iris.exe terminal feed (event + iris channels).
 * Primary Functions: createTerminalState, reduceTerminalLog, floorEventToTerminalLines.
 * Inputs/Outputs: Append-only log with ring cap; deterministic event lines from FloorEvent.
 */

import type { FloorEvent, FloorStatus, HexKey } from "./types";

export type TerminalChannel = "event" | "iris" | "map";

export interface TerminalLine {
  channel: TerminalChannel;
  text: string;
  /** Monotonic id for ordering (run-wide). */
  id: number;
  takeoverId?: string;
  /** When set, `setStreamLine` updates this row in place (live mapping / stream). */
  streamKey?: string;
}

export interface TerminalState {
  lines: TerminalLine[];
  nextId: number;
}

const MAX_LINES = 300;

export type TerminalLogAction =
  | {
      type: "append";
      channel: TerminalChannel;
      text: string;
      takeoverId?: string;
    }
  | {
      type: "appendMany";
      entries: Array<{
        channel: TerminalChannel;
        text: string;
        takeoverId?: string;
      }>;
    }
  /** One live row per `key` (e.g. director JSON stream); updates in place. */
  | { type: "setStreamLine"; key: string; text: string }
  | { type: "clear" };

export function createTerminalState(): TerminalState {
  return { lines: [], nextId: 1 };
}

export function reduceTerminalLog(
  state: TerminalState,
  action: TerminalLogAction
): TerminalState {
  if (action.type === "clear") {
    return createTerminalState();
  }

  const push = (
    lines: TerminalLine[],
    nextId: number,
    channel: TerminalChannel,
    text: string,
    takeoverId?: string
  ): { lines: TerminalLine[]; nextId: number } => {
    const line: TerminalLine = { id: nextId, channel, text, takeoverId };
    const merged = [...lines, line];
    const trimmed =
      merged.length > MAX_LINES ? merged.slice(-MAX_LINES) : merged;
    return { lines: trimmed, nextId: nextId + 1 };
  };

  if (action.type === "append") {
    const { lines, nextId } = push(
      state.lines,
      state.nextId,
      action.channel,
      action.text,
      action.takeoverId
    );
    return { lines, nextId };
  }

  if (action.type === "setStreamLine") {
    const idx = state.lines.findIndex(l => l.streamKey === action.key);
    if (idx >= 0) {
      const lines = [...state.lines];
      const prev = lines[idx]!;
      lines[idx] = { ...prev, text: action.text };
      return { ...state, lines };
    }
    const line: TerminalLine = {
      id: state.nextId,
      channel: "map",
      text: action.text,
      streamKey: action.key,
    };
    const merged = [...state.lines, line];
    const trimmed =
      merged.length > MAX_LINES ? merged.slice(-MAX_LINES) : merged;
    return { lines: trimmed, nextId: state.nextId + 1 };
  }

  if (action.type === "appendMany") {
    let lines = state.lines;
    let nextId = state.nextId;
    for (const e of action.entries) {
      const out = push(lines, nextId, e.channel, e.text, e.takeoverId);
      lines = out.lines;
      nextId = out.nextId;
    }
    return { lines, nextId };
  }

  return state;
}

export interface TerminalEventContext {
  floor: number;
  key?: HexKey;
  cascadeCellCount?: number;
  cascadeRingCount?: number;
  irisControl: number;
  wrongsLeft: number;
  maxWrongs: number;
  status?: FloorStatus;
}

function fmtKey(k?: HexKey): string {
  return k ? k.replace(",", "/") : "?";
}

function padFloor(f: number): string {
  return String(f).padStart(2, "0");
}

/**
 * Deterministic event-channel lines for replay / tests. Never reads LLM output.
 */
export function floorEventToTerminalLines(
  event: FloorEvent,
  ctx: TerminalEventContext
): Array<{ channel: "event"; text: string }> {
  const f = padFloor(ctx.floor);
  switch (event) {
    case "correct-reveal":
      return [
        {
          channel: "event",
          text: `[evt] F${f} REVEAL ${fmtKey(ctx.key)} ok iris=${Math.round(ctx.irisControl * 100)}%`,
        },
      ];
    case "wrong-reveal":
      return [
        {
          channel: "event",
          text: `[evt] F${f} REVEAL ${fmtKey(ctx.key)} HIT wrongs=${ctx.wrongsLeft}/${ctx.maxWrongs}`,
        },
      ];
    case "correct-mark":
      return [
        {
          channel: "event",
          text: `[evt] F${f} MARK ${fmtKey(ctx.key)} hazard_ok`,
        },
      ];
    case "wrong-mark":
      return [
        {
          channel: "event",
          text: `[evt] F${f} MARK ${fmtKey(ctx.key)} false_positive`,
        },
      ];
    case "tile-broken":
      return [
        {
          channel: "event",
          text: `[evt] F${f} TILE_BREAK random`,
        },
      ];
    case "cascade-reveal": {
      const n = ctx.cascadeCellCount ?? 0;
      const r = ctx.cascadeRingCount ?? 0;
      return [
        {
          channel: "event",
          text: `[evt] F${f} CASCADE +${n} cells rings=${r}`,
        },
      ];
    }
    case "floor-won":
      return [
        {
          channel: "event",
          text: `[evt] F${f} FLOOR_WIN status=${ctx.status ?? "won"}`,
        },
      ];
    case "floor-lost":
      return [
        {
          channel: "event",
          text: `[evt] F${f} FLOOR_LOST status=${ctx.status ?? "lost"}`,
        },
      ];
    default:
      return [];
  }
}
