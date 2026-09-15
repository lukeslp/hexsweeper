#!/usr/bin/env node
/**
 * File Purpose: Smoke test — sphere neighbor graph + flood closure parity.
 * Primary Functions: assertNeighborSymmetry, assertFloodClosure, assertFlagBlocksFlood.
 * Inputs: hexasphere.js (subdivisions 4, 6, 10, 12, 15). Outputs: exit 0 on pass, 1 on fail.
 * Author: Luke Steuber <luke@lukesteuber.com>
 */
"use strict";

const path = require("path");
const Hexasphere = require(path.join(__dirname, "hexasphere.js"));

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  }
}

function assertNeighborSymmetry(tiles) {
  for (const tile of tiles) {
    for (const n of tile.neighborIndices) {
      assert(
        tiles[n].neighborIndices.includes(tile.index),
        `asymmetric edge ${tile.index} ↔ ${n}`
      );
    }
    const expected = tile.isPentagon ? 5 : 6;
    assert(
      tile.neighborIndices.length === expected,
      `tile ${tile.index} has ${tile.neighborIndices.length} neighbors, expected ${expected}`
    );
  }
}

/** Pure flood closure over neighborIndices (mirrors sphere.js). */
function computeFloodClosure(tiles, cells, startIdx) {
  const opened = new Set();
  const queue = [startIdx];
  const visited = new Set([startIdx]);
  while (queue.length) {
    const idx = queue.shift();
    for (const n of tiles[idx].neighborIndices) {
      if (visited.has(n)) continue;
      visited.add(n);
      const c = cells[n];
      if (c.flagged || c.isMine || c.revealed) continue;
      opened.add(n);
      c.revealed = true;
      if (c.neighborMines === 0) queue.push(n);
    }
  }
  return opened;
}

function countNeighborMines(tiles, cells, idx) {
  let n = 0;
  for (const ni of tiles[idx].neighborIndices) {
    if (cells[ni].isMine) n++;
  }
  return n;
}

function assertFloodClosure(subdivisions) {
  const { tiles } = Hexasphere.generateHexasphere(1, subdivisions);
  assertNeighborSymmetry(tiles);

  // Pick a hex tile (not pentagon) with low index for stability
  let safeIdx = tiles.findIndex((t) => !t.isPentagon);
  if (safeIdx < 0) safeIdx = 0;

  const cells = tiles.map(() => ({
    isMine: false,
    revealed: false,
    flagged: false,
    neighborMines: 0,
  }));

  // No mines — entire zero region should flood from safeIdx
  for (let i = 0; i < cells.length; i++) {
    cells[i].neighborMines = countNeighborMines(tiles, cells, i);
  }

  cells[safeIdx].revealed = true;
  const opened = computeFloodClosure(tiles, cells, safeIdx);
  const expected = new Set();
  const queue = [safeIdx];
  const visited = new Set([safeIdx]);
  while (queue.length) {
    const idx = queue.shift();
    if (cells[idx].neighborMines !== 0) continue;
    for (const n of tiles[idx].neighborIndices) {
      if (visited.has(n)) continue;
      visited.add(n);
      if (cells[n].neighborMines === 0) {
        expected.add(n);
        queue.push(n);
      } else {
        // numbered boundary — not opened by flood
      }
    }
  }

  // Re-run: opened zero-region should match BFS over zero-only subgraph
  const zeroRegion = new Set([safeIdx]);
  const zq = [safeIdx];
  const zv = new Set([safeIdx]);
  while (zq.length) {
    const idx = zq.shift();
    for (const n of tiles[idx].neighborIndices) {
      if (zv.has(n)) continue;
      zv.add(n);
      if (cells[n].neighborMines === 0) {
        zeroRegion.add(n);
        zq.push(n);
      }
    }
  }

  for (const idx of zeroRegion) {
    if (idx === safeIdx) continue;
    assert(opened.has(idx), `sub ${subdivisions}: zero tile ${idx} missing from flood`);
  }
  for (const idx of opened) {
    assert(cells[idx].neighborMines === 0, `sub ${subdivisions}: opened non-zero ${idx}`);
  }

  // Flagged face never opens
  const cells2 = tiles.map(() => ({
    isMine: false,
    revealed: false,
    flagged: false,
    neighborMines: 0,
  }));
  for (let i = 0; i < cells2.length; i++) {
    cells2[i].neighborMines = countNeighborMines(tiles, cells2, i);
  }
  const flagIdx = tiles[safeIdx].neighborIndices[0];
  cells2[flagIdx].flagged = true;
  cells2[safeIdx].revealed = true;
  const opened2 = computeFloodClosure(tiles, cells2, safeIdx);
  assert(!opened2.has(flagIdx), `sub ${subdivisions}: flagged tile ${flagIdx} opened`);
}

console.log("Hexasphere neighbor + flood tests…");
const LEVELS = [4, 6, 10, 12, 15];
for (const sub of LEVELS) {
  const { tiles } = Hexasphere.generateHexasphere(1, sub);
  assertFloodClosure(sub);
  console.log(`  subdivisions ${sub}: ${tiles.length} tiles — OK`);
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll tests passed.");
