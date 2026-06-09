import { describe, expect, it } from "vitest";
import { MAX_DRESSING_BATCH, chunkDressingCells } from "./dressingBatch";

describe("dressingBatch", () => {
  it("returns empty array for empty input", () => {
    expect(chunkDressingCells([])).toEqual([]);
  });

  it("returns single chunk when under max", () => {
    const cells = Array.from({ length: 5 }, (_, i) => i);
    expect(chunkDressingCells(cells)).toEqual([cells]);
  });

  it("splits into chunks of MAX_DRESSING_BATCH", () => {
    const cells = Array.from({ length: 25 }, (_, i) => i);
    const chunks = chunkDressingCells(cells);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(MAX_DRESSING_BATCH);
    expect(chunks[1]).toHaveLength(MAX_DRESSING_BATCH);
    expect(chunks[2]).toHaveLength(1);
  });
});
