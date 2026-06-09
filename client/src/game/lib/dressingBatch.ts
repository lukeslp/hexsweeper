/**
 * File Purpose: Chunk frontier dressing requests so @Generable batches stay within token budget.
 * Primary Functions: MAX_DRESSING_BATCH, chunkDressingCells.
 * Inputs/Outputs: Cell array in; sequential chunk arrays out.
 */

export const MAX_DRESSING_BATCH = 12;

export function chunkDressingCells<T>(cells: T[], maxPerChunk = MAX_DRESSING_BATCH): T[][] {
  if (cells.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < cells.length; i += maxPerChunk) {
    chunks.push(cells.slice(i, i + maxPerChunk));
  }
  return chunks;
}
