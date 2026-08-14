#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const createFluxPairs = require("./flux-pairs.js");

function cell(overrides) {
  return Object.assign({ revealed: false, flagged: false, isMine: false }, overrides);
}

function tile(x, y, z) {
  return { centerPoint: { x, y, z } };
}

function board(cells, tiles) {
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

test("pairs eligible faces by greatest geometric separation", () => {
  const flux = createFluxPairs();
  const result = flux.activate(board(
    [cell(), cell(), cell(), cell()],
    [tile(1, 0, 0), tile(-1, 0, 0), tile(0, 1, 0), tile(0, -1, 0)]
  ));
  assert.deepStrictEqual(result, { status: "active", pairCount: 2, unpairedCount: 0 });
  assert.strictEqual(flux.partnerFor(0), 1);
  assert.strictEqual(flux.partnerFor(1), 0);
  assert.strictEqual(flux.partnerFor(2), 3);
  assert.strictEqual(flux.partnerFor(3), 2);
});

test("uses stable index tie-breaking", () => {
  const flux = createFluxPairs();
  flux.activate(board(
    [cell(), cell(), cell(), cell()],
    [tile(1, 0, 0), tile(0, 1, 0), tile(0, -1, 0), tile(0, 0, 1)]
  ));
  assert.strictEqual(flux.partnerFor(0), 1);
  assert.strictEqual(flux.partnerFor(1), 0);
});

test("excludes revealed, flagged, and mined faces", () => {
  const flux = createFluxPairs();
  const result = flux.activate(board(
    [cell({ revealed: true }), cell({ flagged: true }), cell({ isMine: true }), cell(), cell()],
    [tile(1, 0, 0), tile(-1, 0, 0), tile(0, 1, 0), tile(0, -1, 0), tile(0, 0, 1)]
  ));
  assert.deepStrictEqual(result, { status: "active", pairCount: 1, unpairedCount: 0 });
  assert.strictEqual(flux.partnerFor(0), -1);
  assert.strictEqual(flux.partnerFor(1), -1);
  assert.strictEqual(flux.partnerFor(2), -1);
  assert.strictEqual(flux.partnerFor(3), 4);
});

test("leaves one eligible face unpaired when the count is odd", () => {
  const flux = createFluxPairs();
  const result = flux.activate(board(
    [cell(), cell(), cell()],
    [tile(1, 0, 0), tile(-1, 0, 0), tile(0, 1, 0)]
  ));
  assert.deepStrictEqual(result, { status: "active", pairCount: 1, unpairedCount: 1 });
  assert.strictEqual(flux.partnerFor(2), -1);
});

test("returns no partner before activation or for invalid indexes", () => {
  const flux = createFluxPairs();
  assert.strictEqual(flux.partnerFor(0), -1);
  flux.activate(board([cell(), cell()], [tile(1, 0, 0), tile(-1, 0, 0)]));
  assert.strictEqual(flux.partnerFor(-1), -1);
  assert.strictEqual(flux.partnerFor(2), -1);
  assert.strictEqual(flux.partnerFor(1.5), -1);
});

test("exports and restores a symmetric mapping", () => {
  const game = board(
    [cell(), cell(), cell()],
    [tile(1, 0, 0), tile(-1, 0, 0), tile(0, 1, 0)]
  );
  const first = createFluxPairs();
  first.activate(game);
  const saved = first.exportState();
  assert.deepStrictEqual(saved, { v: 1, active: true, pairFor: [1, 0, -1] });

  const restored = createFluxPairs();
  assert.deepStrictEqual(restored.restore(saved, game), {
    status: "active",
    pairCount: 1,
    unpairedCount: 1,
  });
  assert.deepStrictEqual(restored.exportState(), saved);
});

test("rejects malformed, asymmetric, self, out-of-range, and mined mappings", () => {
  const game = board(
    [cell(), cell(), cell({ isMine: true })],
    [tile(1, 0, 0), tile(-1, 0, 0), tile(0, 1, 0)]
  );
  for (const saved of [
    null,
    { v: 2, active: true, pairFor: [1, 0, -1] },
    { v: 1, active: true, pairFor: [1, 0] },
    { v: 1, active: true, pairFor: [1, -1, -1] },
    { v: 1, active: true, pairFor: [0, -1, -1] },
    { v: 1, active: true, pairFor: [3, -1, -1] },
    { v: 1, active: true, pairFor: [2, -1, 0] },
  ]) {
    const flux = createFluxPairs();
    assert.deepStrictEqual(flux.restore(saved, game), { status: "blocked" });
    assert.deepStrictEqual(flux.exportState(), { v: 1, active: false, pairFor: [] });
  }
});

test("reset clears all pair state", () => {
  const flux = createFluxPairs();
  flux.activate(board([cell(), cell()], [tile(1, 0, 0), tile(-1, 0, 0)]));
  assert.deepStrictEqual(flux.reset(), { status: "idle" });
  assert.deepStrictEqual(flux.exportState(), { v: 1, active: false, pairFor: [] });
});

test("exposes the factory through the browser-global UMD path", () => {
  const source = fs.readFileSync(path.join(__dirname, "flux-pairs.js"), "utf8");
  const browser = {};
  vm.runInNewContext(source, browser, { filename: "flux-pairs.js" });
  assert.strictEqual(typeof browser.FluxPairs, "function");
});

console.log("All tests passed.");
