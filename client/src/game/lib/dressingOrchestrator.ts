/**
 * File Purpose: Pure async dressing pipeline used by GameApp — director call + gate check + applyDressing.
 * Primary Functions: tryDressFloor — returns tagged result for UI to commit or discard.
 * Inputs/Outputs: ExpansionDirectorInput + gate generation id in; TryDressFloorResult out (no React).
 */

import type {
  ExpansionDirectorInput,
  ExpansionDirectorOutput,
  TextGenerator,
} from "./director";
import { reduceFloor } from "./gameState";
import type { DressingGenerationGate } from "./dressingGenerationGate";
import type { FloorState } from "./types";

export type TryDressFloorResult =
  | { kind: "no-new-cells"; shouldCommit: boolean }
  | { kind: "discarded"; output: ExpansionDirectorOutput }
  | { kind: "committed"; floor: FloorState; output: ExpansionDirectorOutput };

export async function tryDressFloor(params: {
  gate: DressingGenerationGate;
  opGen: number;
  nextFloor: FloorState;
  input: ExpansionDirectorInput;
  directExpansion: (
    input: ExpansionDirectorInput,
    generate: TextGenerator
  ) => Promise<ExpansionDirectorOutput>;
  generate: TextGenerator;
}): Promise<TryDressFloorResult> {
  const { gate, opGen, nextFloor, input, directExpansion, generate } = params;

  if (input.newCells.length === 0) {
    return { kind: "no-new-cells", shouldCommit: gate.isCurrent(opGen) };
  }

  const output = await directExpansion(input, generate);

  if (!gate.isCurrent(opGen)) {
    return { kind: "discarded", output };
  }

  const floor = reduceFloor(nextFloor, {
    type: "applyDressing",
    dressing: output.tiles,
  });
  return { kind: "committed", floor, output };
}
