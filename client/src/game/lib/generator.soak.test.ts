/**
 * Optional long generator sweep for local/nightly runs.
 * Enable with: `SOAK=1 pnpm vitest run client/src/game/lib/generator.soak.test.ts`
 */
import { describe, expect, it } from "vitest";
import { tryGenerateSolvableFloor } from "./generator";

const soak = process.env.SOAK === "1";

(soak ? describe : describe.skip)("generator soak (SOAK=1)", () => {
  it(
    "strided solvability sweep floors 1..2000 (every 5th floor)",
    () => {
      for (let floor = 1; floor <= 2000; floor += 5) {
        const state = tryGenerateSolvableFloor({
          floor,
          seed: `soak-strided-${floor}`,
        });
        expect(state, `floor ${floor} exhausted retry budget`).not.toBeNull();
      }
    },
    { timeout: 600_000 }
  );
});
