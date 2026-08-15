#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const createHazard = require("./glitch-hazard.js");

function board(cells, neighbors) {
  return { cells, neighbors };
}

function cell(overrides) {
  return Object.assign({ revealed: false, flagged: false, isMine: false }, overrides);
}

function clock(start) {
  let value = start;
  return { now: () => value, set: (next) => { value = next; } };
}

function makeHazard(options) {
  const time = clock(options && options.time || 0);
  const hazard = createHazard(Object.assign({
    random: () => 0,
    moveIntervalMs: 1000,
    now: time.now,
  }, options));
  return { hazard, time };
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

console.log("Glitch hazard state-machine tests…");

test("spawns deterministically among eligible faces", () => {
  const { hazard } = makeHazard({ random: () => 0.51 });
  const result = hazard.spawn(board([
    cell({ revealed: true }), cell(), cell({ isMine: true }), cell(), cell({ flagged: true }),
  ], [[], [], [], [], []]));
  assert.deepStrictEqual(result, { status: "waiting", index: 3 });
});

test("excludes revealed, flagged, and mined spawn faces", () => {
  const { hazard } = makeHazard();
  const result = hazard.spawn(board([
    cell({ revealed: true }), cell({ flagged: true }), cell({ isMine: true }),
  ], [[], [], []]));
  assert.deepStrictEqual(result, { status: "idle" });
});

test("moves only when a full interval has elapsed", () => {
  const { hazard, time } = makeHazard();
  const game = board([cell(), cell()], [[1], [0]]);
  hazard.spawn(game);
  time.set(999);
  assert.deepStrictEqual(hazard.tick(game), { status: "waiting", remainingMs: 1 });
  time.set(1000);
  assert.deepStrictEqual(hazard.tick(game), { status: "moved", from: 0, index: 1 });
});

test("uses the default 1000ms interval when none is supplied", () => {
  const time = clock(0);
  const hazard = createHazard({ random: () => 0, now: time.now });
  const game = board([cell(), cell()], [[1], [0]]);
  hazard.spawn(game);
  time.set(999);
  assert.deepStrictEqual(hazard.tick(game), { status: "waiting", remainingMs: 1 });
  time.set(1000);
  assert.deepStrictEqual(hazard.tick(game), { status: "moved", from: 0, index: 1 });
});

test("closes revealed and flagged routes", () => {
  const { hazard, time } = makeHazard();
  const game = board([cell(), cell({ revealed: true }), cell({ flagged: true }), cell()], [[1, 2, 3], [0], [0], [0]]);
  hazard.spawn(game);
  time.set(1000);
  assert.deepStrictEqual(hazard.tick(game), { status: "moved", from: 0, index: 3 });
});

test("wins when every adjacent route is closed", () => {
  const { hazard, time } = makeHazard();
  const game = board([cell(), cell({ revealed: true }), cell({ flagged: true })], [[1, 2], [0], [0]]);
  hazard.spawn(game);
  time.set(1000);
  assert.deepStrictEqual(hazard.tick(game), { status: "trapped", index: 0 });
});

test("loses when the chosen route contains a mine", () => {
  const { hazard, time } = makeHazard();
  const game = board([cell(), cell({ isMine: true })], [[1], [0]]);
  hazard.spawn(game);
  time.set(1000);
  assert.deepStrictEqual(hazard.tick(game), { status: "mine", from: 0, index: 1 });
});

test("rejects a direct reveal of the occupied face", () => {
  const { hazard } = makeHazard();
  const game = board([cell(), cell()], [[1], [0]]);
  hazard.spawn(game);
  assert.deepStrictEqual(hazard.admitReveal(0), { status: "blocked", index: 0 });
  assert.deepStrictEqual(hazard.admitReveal(1), { status: "idle" });
});

test("exports active state with its remaining delay", () => {
  const { hazard, time } = makeHazard();
  const game = board([cell()], [[]]);
  hazard.spawn(game);
  time.set(375);
  assert.deepStrictEqual(hazard.exportState(), { active: true, index: 0, remainingMs: 625 });
});

test("restores a valid active hazard and its delay", () => {
  const { hazard, time } = makeHazard({ time: 500 });
  const game = board([cell(), cell()], [[1], [0]]);
  assert.deepStrictEqual(hazard.restore({ active: true, index: 1, remainingMs: 400 }, game), {
    status: "waiting", index: 1, remainingMs: 400,
  });
  time.set(899);
  assert.deepStrictEqual(hazard.tick(game), { status: "waiting", remainingMs: 1 });
  time.set(900);
  assert.deepStrictEqual(hazard.tick(game), { status: "moved", from: 1, index: 0 });
});

test("rejects invalid active restore state", () => {
  const { hazard } = makeHazard();
  const game = board([cell({ revealed: true }), cell({ flagged: true }), cell({ isMine: true })], [[], [], []]);
  for (const snapshot of [
    { active: true, index: -1, remainingMs: 10 },
    { active: true, index: 3, remainingMs: 10 },
    { active: true, index: 0, remainingMs: 10 },
    { active: true, index: 1, remainingMs: 10 },
    { active: true, index: 2, remainingMs: 10 },
    { active: true, index: 0, remainingMs: -1 },
  ]) {
    assert.deepStrictEqual(hazard.restore(snapshot, game), { status: "blocked" });
  }
});

test("rejects a restore delay beyond the move interval", () => {
  const { hazard } = makeHazard();
  const game = board([cell()], [[]]);
  assert.deepStrictEqual(hazard.restore({ active: true, index: 0, remainingMs: 1001 }, game), {
    status: "blocked",
  });
});

test("exposes the factory through the browser-global UMD path", () => {
  const source = fs.readFileSync(path.join(__dirname, "glitch-hazard.js"), "utf8");
  const browser = {};
  vm.runInNewContext(source, browser, { filename: "glitch-hazard.js" });
  assert.strictEqual(typeof browser.GlitchHazard, "function");
});

console.log("All tests passed.");
