/**
 * File Purpose: Pure async dressing pipeline — procedural or @Generable path + gate check.
 * Primary Functions: tryDressFloor, completeDeferredDressingIris.
 * Inputs/Outputs: ExpansionDirectorInput + dressingMode in; TryDressFloorResult out.
 */

import type { DressingMode } from "./dressingMode";
import type {
  ExpansionDirectorInput,
  ExpansionDirectorOutput,
  IrisLineGenerator,
  StructuredDressingGenerator,
} from "./director";
import {
  directExpansionGenerable,
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
  dressingMode: DressingMode;
  generateTileBatch?: StructuredDressingGenerator;
  generateIrisLine?: IrisLineGenerator;
  deferIris?: boolean;
}): Promise<TryDressFloorResult> {
  const {
    gate,
    opGen,
    nextFloor,
    input,
    dressingMode,
    generateTileBatch,
    generateIrisLine,
    deferIris,
  } = params;

  if (input.newCells.length === 0) {
    return { kind: "no-new-cells", shouldCommit: gate.isCurrent(opGen) };
  }

  if (dressingMode === "procedural") {
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

  if (!generateTileBatch) {
    throw new Error("tryDressFloor(generable): generateTileBatch required");
  }

  const output = await directExpansionGenerable(input, generateTileBatch);

  if (!gate.isCurrent(opGen)) {
    return { kind: "discarded", output };
  }

  const floor = reduceFloor(nextFloor, {
    type: "applyDressing",
    dressing: output.tiles,
  });
  return { kind: "committed", floor, output };
}

export async function completeDeferredDressingIris(params: {
  input: ExpansionDirectorInput;
  procedural: ExpansionDirectorOutput;
  generateIrisLine?: IrisLineGenerator;
}): Promise<ExpansionDirectorOutput> {
  const iris = await resolveDirectorIris(params.input, params.generateIrisLine);
  return { ...params.procedural, ...iris };
}
