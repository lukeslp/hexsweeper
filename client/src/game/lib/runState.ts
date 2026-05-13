/**
 * File Purpose: Run-level progression, escape/catch outcomes, and roguelike meta knobs.
 * Primary Functions: createRunState, reduceRun, floorSeed, milestoneBand, defaultProgression.
 * Inputs/Outputs: Seeds and actions in; immutable RunState snapshots out.
 */

export type RunProgressionMode = "infinite" | "finite";

/** Policy for when a run ends successfully (escaped) vs continues forever. */
export interface RunProgressionPolicy {
  mode: RunProgressionMode;
  /** In finite mode: escape after completing this floor number (1-based), same semantics as legacy 12. */
  maxFloors?: number;
}

export interface RunCheckpoint {
  floor: number;
  seed: string;
}

export type RouteChoice = "safe" | "loot" | "risk";

export interface RunState {
  runId: string;
  seed: string;
  floor: number;
  status: "active" | "escaped" | "caught";
  bestFloor: number;
  totalWrongs: number;
  progression: RunProgressionPolicy;
  checkpoint: RunCheckpoint;
  /** 0–1 regional pressure (anti-grind / tempo). */
  regionalPressure: number;
  /** 0–1 long-run escalation. */
  campaignEntropy: number;
  /** Salt applied to floor seeds after the player picks an inter-floor route. */
  routeSalt: string;
  /** Between-floor branch picks (sidegrades unlock from "loot"/"risk"). */
  sidegrades: string[];
}

export interface StartRunOptions {
  seed: string;
  runId?: string;
  progression?: RunProgressionPolicy;
}

export type RunAction =
  | { type: "startRun"; seed: string; runId?: string; progression?: RunProgressionPolicy }
  | { type: "completeFloor" }
  | { type: "failRun"; wrongsOnFloor: number }
  | { type: "setRouteChoice"; choice: RouteChoice }
  | { type: "checkpoint"; floor: number };

/** Default shipped experience: infinite descent unless overridden. */
export function defaultProgression(): RunProgressionPolicy {
  return { mode: "infinite" };
}

/** Legacy / challenge: escape after clearing maxFloors (default 12). */
export function finiteProgression(maxFloors = 12): RunProgressionPolicy {
  return { mode: "finite", maxFloors: Math.max(1, Math.trunc(maxFloors)) };
}

export function milestoneBand(floor: number): string {
  const f = Math.max(1, Math.trunc(floor));
  if (f <= 6) return "shallow";
  if (f <= 12) return "mid";
  if (f <= 24) return "deep";
  if (f <= 48) return "abyss";
  return "endless";
}

export function createRunState({
  seed,
  runId,
  progression,
}: StartRunOptions): RunState {
  const prog = progression ?? defaultProgression();
  return {
    runId: runId ?? `run-${seed}`,
    seed,
    floor: 1,
    status: "active",
    bestFloor: 1,
    totalWrongs: 0,
    progression: prog,
    checkpoint: { floor: 1, seed },
    regionalPressure: 0,
    campaignEntropy: 0,
    routeSalt: "none",
    sidegrades: [],
  };
}

function maxFloorsFor(policy: RunProgressionPolicy): number {
  if (policy.mode !== "finite") return Number.POSITIVE_INFINITY;
  return policy.maxFloors ?? 12;
}

export function reduceRun(state: RunState, action: RunAction): RunState {
  if (action.type === "startRun") {
    return createRunState({
      seed: action.seed,
      runId: action.runId,
      progression: action.progression,
    });
  }
  if (state.status !== "active") return state;

  switch (action.type) {
    case "completeFloor": {
      const cap = maxFloorsFor(state.progression);
      if (state.floor >= cap) {
        return {
          ...state,
          status: "escaped",
          bestFloor: Math.max(state.bestFloor, cap),
          checkpoint: { ...state.checkpoint, floor: state.floor },
        };
      }
      const nextFloor = state.floor + 1;
      return {
        ...state,
        floor: nextFloor,
        bestFloor: Math.max(state.bestFloor, nextFloor),
        regionalPressure: clamp01(state.regionalPressure + 0.02),
        campaignEntropy: clamp01(state.campaignEntropy + 0.012),
        checkpoint: { floor: nextFloor, seed: state.seed },
      };
    }
    case "failRun":
      return {
        ...state,
        status: "caught",
        totalWrongs: state.totalWrongs + action.wrongsOnFloor,
      };
    case "setRouteChoice": {
      const choice = action.choice;
      const nextSalt = choice;
      const side =
        choice === "loot" || choice === "risk"
          ? uniqPush(state.sidegrades, `route-${choice}`)
          : state.sidegrades;
      return {
        ...state,
        routeSalt: nextSalt,
        sidegrades: side,
        regionalPressure: clamp01(
          state.regionalPressure + (choice === "risk" ? 0.06 : -0.03)
        ),
      };
    }
    case "checkpoint":
      return {
        ...state,
        checkpoint: { floor: action.floor, seed: state.seed },
      };
    default:
      return state;
  }
}

export function floorSeed(
  run: Pick<RunState, "seed" | "floor" | "routeSalt">
): string {
  return `${run.seed}:floor:${run.floor}:route:${run.routeSalt}`;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function uniqPush(list: string[], item: string): string[] {
  if (list.includes(item)) return list;
  return [...list, item];
}
