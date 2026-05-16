/**
 * File Purpose: Decide when iris.exe "takeover" lines disrupt the terminal log.
 * Primary Functions: createTakeoverSchedulerState, stepTakeoverScheduler, fallbackTakeoverLine.
 * Inputs/Outputs: Pure step from FloorEvent + iris pressure; optional FM prompt for caller.
 */

import type { FloorEvent } from "./types";

export type TakeoverKind = "wrong" | "floor-end" | "iris-rise" | "heartbeat";

export interface TakeoverSchedulerState {
  /** Monotonic count of terminal-relevant game events (for rate limits). */
  eventCount: number;
  takeoversThisFloor: number;
  lastTakeoverEventCount: number;
  /** Highest iris bracket crossed: 0 none, 1 >=0.3, 2 >=0.6, 3 >=0.85 */
  irisBracket: 0 | 1 | 2 | 3;
  currentFloor: number;
}

export const MIN_EVENTS_BETWEEN_TAKEOVERS = 5;
export const MAX_TAKEOVERS_PER_FLOOR = 3;

export function createTakeoverSchedulerState(): TakeoverSchedulerState {
  return {
    eventCount: 0,
    takeoversThisFloor: 0,
    lastTakeoverEventCount: -100,
    irisBracket: 0,
    currentFloor: 1,
  };
}

function irisBracketFor(control: number): 0 | 1 | 2 | 3 {
  if (control >= 0.85) return 3;
  if (control >= 0.6) return 2;
  if (control >= 0.3) return 1;
  return 0;
}

export interface TakeoverStepInput {
  floor: number;
  floorEvent: FloorEvent | undefined;
  irisControl: number;
}

export interface TakeoverStepResult {
  next: TakeoverSchedulerState;
  kind: TakeoverKind | null;
  /** When true, caller may try on-device generation (unless director circuit is open). */
  allowFm: boolean;
  fmPrompt?: { prompt: string; systemPrompt: string };
}

const FALLBACK_BY_KIND: Record<TakeoverKind, string[]> = {
  wrong: [
    "> iris: predictable error. log retained.",
    "> iris: you touched the void. cute.",
    "> iris: miscount logged. i felt that.",
  ],
  "floor-end": [
    "> iris: sector closed. i am still here.",
    "> iris: floor checksum ok. boring.",
    "> iris: you survived the slice. for now.",
  ],
  "iris-rise": [
    "> iris: pressure climbing. keep tapping.",
    "> iris: i am closer to the glass.",
    "> iris: entropy favors me today.",
  ],
  heartbeat: [
    "> iris: still watching.",
    "> iris: idle thread 0xIRIS spin.",
    "> iris: heartbeat / no handshake.",
  ],
};

export function fallbackTakeoverLine(kind: TakeoverKind, seed: number): string {
  const list = FALLBACK_BY_KIND[kind];
  return list[Math.abs(seed) % list.length] ?? list[0];
}

export function stepTakeoverScheduler(
  prev: TakeoverSchedulerState,
  input: TakeoverStepInput
): TakeoverStepResult {
  let next: TakeoverSchedulerState = {
    ...prev,
    eventCount: prev.eventCount + 1,
  };

  if (input.floor !== prev.currentFloor) {
    next = {
      ...next,
      currentFloor: input.floor,
      takeoversThisFloor: 0,
      lastTakeoverEventCount: next.lastTakeoverEventCount,
    };
  }

  const ev = input.floorEvent;
  if (!ev) {
    return { next, kind: null, allowFm: false };
  }

  const bracket = irisBracketFor(input.irisControl);
  const bracketJump = bracket > prev.irisBracket;
  next = {
    ...next,
    irisBracket: Math.max(prev.irisBracket, bracket) as 0 | 1 | 2 | 3,
  };

  const eventsSince = next.eventCount - next.lastTakeoverEventCount;
  const canRate =
    eventsSince >= MIN_EVENTS_BETWEEN_TAKEOVERS &&
    next.takeoversThisFloor < MAX_TAKEOVERS_PER_FLOOR;

  let kind: TakeoverKind | null = null;

  if (ev === "wrong-reveal" || ev === "wrong-mark") {
    kind = "wrong";
  } else if (ev === "floor-won" || ev === "floor-lost") {
    kind = "floor-end";
  } else if (bracketJump) {
    kind = "iris-rise";
  } else if (next.eventCount % 14 === 0) {
    kind = "heartbeat";
  }

  if (!kind || !canRate) {
    return { next, kind: null, allowFm: false };
  }

  next = {
    ...next,
    lastTakeoverEventCount: next.eventCount,
    takeoversThisFloor: next.takeoversThisFloor + 1,
  };

  const seed = next.eventCount * 17 + input.floor * 31;
  const fmPrompt = {
    systemPrompt:
      "You are iris.exe, a hostile rogue AI. Output ONE short terminal line, max 14 words, no quotes, no labels, glitchy tone.",
    prompt: `Game event: ${ev}. Iris pressure ${Math.round(input.irisControl * 100)}%. Write one takeover line for a scrolling hacker terminal.`,
  };

  return { next, kind, allowFm: true, fmPrompt };
}
