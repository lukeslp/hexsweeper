/**
 * File Purpose: Pure run lifecycle helpers between floors (route salt, checkpoints, seeds).
 * Primary Functions: advanceRunAfterFloorWin, createNextFloorState.
 * Inputs/Outputs: RunState + player route choice in; next RunState and FloorState factory out.
 */

import { createFloorState } from "./gameState";
import {
  floorSeed,
  reduceRun,
  type RouteChoice,
  type RunState,
} from "./runState";
import type { FloorState } from "./types";

export interface AdvanceRunResult {
  nextRun: RunState;
}

/**
 * After a floor win: apply inter-floor route, advance run floor, checkpoint, return next seed.
 */
export function advanceRunAfterFloorWin(
  run: RunState,
  route: RouteChoice
): AdvanceRunResult {
  let next = reduceRun(run, { type: "setRouteChoice", choice: route });
  next = reduceRun(next, { type: "completeFloor" });
  next = reduceRun(next, { type: "checkpoint", floor: next.floor });
  return { nextRun: next };
}

/** Build the next floor board from post-win run state (caller sets React state). */
export function createNextFloorState(nextRun: RunState): FloorState {
  return createFloorState(nextRun.floor, floorSeed(nextRun));
}
