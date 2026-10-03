#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const createFluxPairs = require("./flux-pairs.js");
const Hexasphere = require("../sphere/hexasphere.js");

function cell(overrides) {
  return Object.assign({ revealed: false, flagged: false, isMine: false }, overrides);
}

function tile(x, y, z) {
  return { centerPoint: { x, y, z } };
}

/** A tile on the unit circle in the xy plane, `degrees` from +x. */
function at(degrees) {
  const radians = (degrees * Math.PI) / 180;
  return tile(Math.cos(radians), Math.sin(radians), 0);
}

function board(cells, tiles) {
  return { cells, tiles };
}

function angleBetween(tiles, a, b) {
  const p = tiles[a].centerPoint;
  const q = tiles[b].centerPoint;
  const dot = (p.x * q.x + p.y * q.y + p.z * q.z) /
    ((Math.hypot(p.x, p.y, p.z) || 1) * (Math.hypot(q.x, q.y, q.z) || 1));
  return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
}

/** Seeded generator so the real-board checks are repeatable. */
function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * A real Sphere board as the game deals it: 17% mines, never on the first
 * dig or its neighbors, with the opening dig and its flood already revealed.
 */
function dealSphere(subdivisions, seed) {
  const sphere = Hexasphere.generateHexasphere(1, subdivisions);
  const tiles = sphere.tiles;
  const cells = tiles.map(() => cell());
  const random = rng(seed);
  const start = Math.floor(random() * tiles.length);
  const forbidden = new Set([start, ...tiles[start].neighborIndices]);
  const candidates = tiles.map((_, index) => index).filter((index) => !forbidden.has(index));
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const mineCount = Math.round(tiles.length * 0.17);
  for (let i = 0; i < mineCount; i++) cells[candidates[i]].isMine = true;
  const count = (index) => tiles[index].neighborIndices.filter((n) => cells[n].isMine).length;
  const queue = [start];
  cells[start].revealed = true;
  while (queue.length) {
    const index = queue.shift();
    if (count(index) > 0) continue;
    for (const next of tiles[index].neighborIndices) {
      if (cells[next].revealed || cells[next].isMine) continue;
      cells[next].revealed = true;
      queue.push(next);
    }
  }
  return { cells, tiles };
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ${name} — OK`);
  } catch (error) {
    console.error(`  ${name} — FAIL`);
    throw error;
  }
}

console.log("Flux pair state-machine tests…");

test("links twins of one fate at the closest angle to the target", () => {
  const flux = createFluxPairs();
  assert.strictEqual(flux.TWIN_ANGLE_DEG, 55);
  const result = flux.activate(board(
    [cell(), cell(), cell(), cell()],
    [at(0), at(55), at(180), at(235)]
  ));
  assert.deepStrictEqual(result, { status: "active", pairCount: 2, unpairedCount: 0 });
  assert.strictEqual(flux.partnerFor(0), 1);
  assert.strictEqual(flux.partnerFor(1), 0);
  assert.strictEqual(flux.partnerFor(2), 3);
  assert.strictEqual(flux.partnerFor(3), 2);
});

test("never links a safe face to a mine, even when the mine sits at the ideal angle", () => {
  const flux = createFluxPairs();
  const result = flux.activate(board(
    [cell(), cell({ isMine: true }), cell(), cell({ isMine: true })],
    [at(0), at(55), at(180), at(235)]
  ));
  assert.deepStrictEqual(result, { status: "active", pairCount: 2, unpairedCount: 0 });
  assert.strictEqual(flux.partnerFor(0), 2, "safe pairs with safe");
  assert.strictEqual(flux.partnerFor(1), 3, "mine pairs with mine");
});

test("uses stable index tie-breaking", () => {
  const flux = createFluxPairs();
  flux.activate(board(
    [cell(), cell(), cell()],
    [at(0), at(55), at(-55)]
  ));
  assert.strictEqual(flux.partnerFor(0), 1);
  assert.strictEqual(flux.partnerFor(1), 0);
  assert.strictEqual(flux.partnerFor(2), -1);
});

test("links covered faces only and leaves the odd face of a class unpaired", () => {
  const flux = createFluxPairs();
  const result = flux.activate(board(
    [
      cell({ revealed: true }),
      cell({ flagged: true }),
      cell({ isMine: true }),
      cell(),
      cell(),
      cell({ isMine: true }),
      cell(),
    ],
    [at(0), at(55), at(110), at(165), at(220), at(275), at(330)]
  ));
  // Safe 3, 4, 6 (one left over); mines 2 and 5 (165 degrees apart, the only choice).
  assert.deepStrictEqual(result, { status: "active", pairCount: 2, unpairedCount: 1 });
  assert.strictEqual(flux.partnerFor(0), -1);
  assert.strictEqual(flux.partnerFor(1), -1);
  assert.strictEqual(flux.partnerFor(3), 4);
  assert.strictEqual(flux.partnerFor(6), -1);
  assert.strictEqual(flux.partnerFor(2), 5);
});

test("returns no partner before activation or for invalid indexes", () => {
  const flux = createFluxPairs();
  assert.strictEqual(flux.partnerFor(0), -1);
  flux.activate(board([cell(), cell()], [at(0), at(55)]));
  assert.strictEqual(flux.partnerFor(-1), -1);
  assert.strictEqual(flux.partnerFor(2), -1);
  assert.strictEqual(flux.partnerFor(1.5), -1);
});

test("regression: on real sphere boards an echo can never land on a mine", () => {
  // The version-2 rules linked any two covered faces, so about one safe dig
  // in six echoed onto a mine across the globe and ended the run.
  for (const [subdivisions, seeds] of [[4, 12], [6, 8], [10, 3]]) {
    const angles = [];
    for (let seed = 1; seed <= seeds; seed++) {
      const game = dealSphere(subdivisions, seed * 7919 + subdivisions);
      const flux = createFluxPairs();
      const result = flux.activate(game);
      assert.strictEqual(result.status, "active");
      let safeLinks = 0;
      game.cells.forEach((current, index) => {
        const partner = flux.partnerFor(index);
        if (current.revealed || current.flagged) {
          assert.strictEqual(partner, -1, "open faces get no twin");
          return;
        }
        if (partner < 0) return;
        assert.strictEqual(flux.partnerFor(partner), index, "links are symmetric");
        assert.strictEqual(
          !!game.cells[partner].isMine,
          !!current.isMine,
          `sub ${subdivisions} seed ${seed}: face ${index} (${current.isMine ? "mine" : "safe"}) linked to ${partner}`
        );
        if (!current.isMine) safeLinks++;
        if (partner > index) angles.push(angleBetween(game.tiles, index, partner));
      });
      assert.ok(safeLinks > 0);
      assert.ok(result.unpairedCount <= 2, "at most one odd face per class");
    }
    // Twins sit about 55 degrees apart. The last few faces of a small class
    // can land off target, so check the spread over every deal of a size.
    angles.sort((a, b) => a - b);
    const median = angles[Math.floor(angles.length / 2)];
    assert.ok(median > 50 && median < 60, `sub ${subdivisions}: median twin angle ${median.toFixed(1)}`);
    const offTarget = angles.filter((angle) => Math.abs(angle - 55) > 15).length;
    assert.ok(offTarget / angles.length < 0.05, `sub ${subdivisions}: ${offTarget} of ${angles.length} twins off target`);
  }
});

test("exports and restores a version-3 mapping", () => {
  const game = board(
    [cell(), cell(), cell()],
    [at(0), at(55), at(180)]
  );
  const first = createFluxPairs();
  first.activate(game);
  const saved = first.exportState();
  assert.deepStrictEqual(saved, { v: 3, active: true, pairFor: [1, 0, -1] });

  const restored = createFluxPairs();
  assert.deepStrictEqual(restored.restore(saved, game), {
    status: "active",
    pairCount: 1,
    unpairedCount: 1,
  });
  assert.deepStrictEqual(restored.exportState(), saved);
});

test("rebuilds a version-2 run that linked a safe face to a mine", () => {
  const game = board(
    [cell(), cell({ isMine: true }), cell(), cell({ isMine: true })],
    [at(0), at(55), at(180), at(235)]
  );
  const flux = createFluxPairs();
  assert.deepStrictEqual(
    flux.restore({ v: 2, active: true, pairFor: [1, 0, 3, 2] }, game),
    { status: "active", pairCount: 2, unpairedCount: 0 }
  );
  assert.deepStrictEqual(flux.exportState(), { v: 3, active: true, pairFor: [2, 3, 0, 1] });
});

test("rebuilds a valid legacy safe-pair mapping", () => {
  const game = board(
    [cell(), cell(), cell({ isMine: true }), cell({ isMine: true })],
    [at(0), at(55), at(180), at(235)]
  );
  const flux = createFluxPairs();
  assert.deepStrictEqual(
    flux.restore({ v: 1, active: true, pairFor: [1, 0, -1, -1] }, game),
    { status: "active", pairCount: 2, unpairedCount: 0 }
  );
  assert.deepStrictEqual(flux.exportState(), { v: 3, active: true, pairFor: [1, 0, 3, 2] });
});

test("rebuilds a version-3 payload whose twins disagree instead of trusting it", () => {
  const game = board(
    [cell(), cell({ isMine: true }), cell(), cell({ isMine: true })],
    [at(0), at(55), at(180), at(235)]
  );
  const flux = createFluxPairs();
  flux.restore({ v: 3, active: true, pairFor: [1, 0, 3, 2] }, game);
  assert.strictEqual(flux.partnerFor(0), 2);
  assert.strictEqual(flux.partnerFor(1), 3);
});

test("rejects malformed, asymmetric, self, and out-of-range mappings", () => {
  const game = board(
    [cell(), cell(), cell({ isMine: true })],
    [at(0), at(55), at(180)]
  );
  for (const saved of [
    null,
    { v: 4, active: true, pairFor: [1, 0, -1] },
    { v: 1, active: true, pairFor: [2, -1, 0] },
    { v: 3, active: true, pairFor: [1, 0] },
    { v: 3, active: true, pairFor: [1, -1, -1] },
    { v: 3, active: true, pairFor: [0, -1, -1] },
    { v: 3, active: true, pairFor: [3, -1, -1] },
    { v: 3, active: "yes", pairFor: [] },
  ]) {
    const flux = createFluxPairs();
    assert.deepStrictEqual(flux.restore(saved, game), { status: "blocked" });
    assert.deepStrictEqual(flux.exportState(), { v: 3, active: false, pairFor: [] });
  }
});

test("rejecting a malformed restore preserves the active pair mapping", () => {
  const game = board(
    [cell(), cell(), cell()],
    [at(0), at(55), at(180)]
  );
  const flux = createFluxPairs();
  flux.activate(game);
  const before = flux.exportState();

  assert.deepStrictEqual(
    flux.restore({ v: 3, active: true, pairFor: [1, -1, -1] }, game),
    { status: "blocked" }
  );
  assert.deepStrictEqual(flux.exportState(), before);
});

test("restore summaries count only currently eligible unpaired faces", () => {
  const game = board(
    [cell({ revealed: true }), cell(), cell(), cell({ isMine: true }), cell({ isMine: true })],
    [at(0), at(55), at(110), at(165), at(220)]
  );
  const flux = createFluxPairs();
  assert.deepStrictEqual(
    flux.restore({ v: 3, active: true, pairFor: [-1, 2, 1, 4, 3] }, game),
    { status: "active", pairCount: 2, unpairedCount: 0 }
  );
});

test("reset clears all pair state", () => {
  const flux = createFluxPairs();
  flux.activate(board([cell(), cell()], [at(0), at(55)]));
  assert.deepStrictEqual(flux.reset(), { status: "idle" });
  assert.deepStrictEqual(flux.exportState(), { v: 3, active: false, pairFor: [] });
});

test("exposes the factory through the browser-global UMD path", () => {
  const source = fs.readFileSync(path.join(__dirname, "flux-pairs.js"), "utf8");
  const browser = {};
  vm.runInNewContext(source, browser, { filename: "flux-pairs.js" });
  assert.strictEqual(typeof browser.FluxPairs, "function");
});

console.log("All tests passed.");
