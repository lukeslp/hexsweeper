/**
 * File Purpose: Pure async dressing pipeline used by GameApp — director call + gate check + applyDressing.
 * Primary Functions: tryDressFloor — returns tagged result for UI to commit or discard.
 * Inputs/Outputs: ExpansionDirectorInput + gate generation id in; TryDressFloorResult out (no React).
 */

import type {
  ExpansionDirectorInput,
  ExpansionDirectorOutput,
  IrisLineGenerator,
} from "./director";
import {
  proceduralDirectorOutput,
  resolveDirectorIris,
} from "./director";
import { reduceFloor } from "./gameState";
import type { DressingGenerationGate } from "./dressingGenerationGate";
import type { FloorState } from "./types";

export type TryDressFloorResult =
  | { kind: "no-new-cells"; shouldCommit: boolean }
  | { kind: "discarded"; output: ExpansionDirectorOutput }
  | {
      kind: "committed";
      floor: FloorState;
      output: ExpansionDirectorOutput;
      irisPending?: boolean;
    };

export async function tryDressFloor(params: {
  gate: DressingGenerationGate;
  opGen: number;
  nextFloor: FloorState;
  input: ExpansionDirectorInput;
  generateIrisLine?: IrisLineGenerator;
  /** When true, commit procedural tiles immediately; iris resolves via `irisPending`. */
  deferIris?: boolean;
}): Promise<TryDressFloorResult> {
  const { gate, opGen, nextFloor, input, generateIrisLine, deferIris } = params;

  if (input.newCells.length === 0) {
    return { kind: "no-new-cells", shouldCommit: gate.isCurrent(opGen) };
  }

  const procedural = proceduralDirectorOutput(input);

  if (!gate.isCurrent(opGen)) {
    return { kind: "discarded", output: procedural };
  }

  const floor = reduceFloor(nextFloor, {
    type: "applyDressing",
    dressing: procedural.tiles,
  });

  if (deferIris) {
    return {
      kind: "committed",
      floor,
      output: procedural,
      irisPending: true,
    };
  }

  const iris = await resolveDirectorIris(input, generateIrisLine);
  const output: ExpansionDirectorOutput = { ...procedural, ...iris };

  if (!gate.isCurrent(opGen)) {
    return { kind: "discarded", output };
  }

  return { kind: "committed", floor, output };
}

/** Finish deferred iris after tiles are already on the floor. */
export async function completeDeferredDressingIris(params: {
  input: ExpansionDirectorInput;
  procedural: ExpansionDirectorOutput;
  generateIrisLine?: IrisLineGenerator;
}): Promise<ExpansionDirectorOutput> {
  const iris = await resolveDirectorIris(params.input, params.generateIrisLine);
  return { ...params.procedural, ...iris };
}
