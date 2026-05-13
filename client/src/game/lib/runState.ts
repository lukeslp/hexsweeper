export interface StartRunOptions {
  seed: string;
  runId?: string;
}

export interface RunState {
  runId: string;
  seed: string;
  floor: number;
  status: "active" | "escaped" | "caught";
  bestFloor: number;
  totalWrongs: number;
}

export type RunAction =
  | { type: "startRun"; seed: string; runId?: string }
  | { type: "completeFloor" }
  | { type: "failRun"; wrongsOnFloor: number }
  | { type: "recordWrong" };

export function createRunState({ seed, runId }: StartRunOptions): RunState {
  return {
    runId: runId ?? `run-${seed}`,
    seed,
    floor: 1,
    status: "active",
    bestFloor: 1,
    totalWrongs: 0,
  };
}

export function reduceRun(state: RunState, action: RunAction): RunState {
  if (action.type === "startRun") {
    return createRunState({ seed: action.seed, runId: action.runId });
  }
  if (state.status !== "active") return state;

  switch (action.type) {
    case "completeFloor": {
      if (state.floor >= 12) {
        return {
          ...state,
          status: "escaped",
          bestFloor: 12,
        };
      }
      const nextFloor = state.floor + 1;
      return {
        ...state,
        floor: nextFloor,
        bestFloor: Math.max(state.bestFloor, nextFloor),
      };
    }
    case "failRun":
      return {
        ...state,
        status: "caught",
        totalWrongs: state.totalWrongs + action.wrongsOnFloor,
      };
    case "recordWrong":
      return {
        ...state,
        totalWrongs: state.totalWrongs + 1,
      };
    default:
      return state;
  }
}

export function floorSeed(run: Pick<RunState, "seed" | "floor">): string {
  return `${run.seed}:floor:${run.floor}`;
}
