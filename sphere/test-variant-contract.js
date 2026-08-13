#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const sphereSource = fs.readFileSync(path.join(__dirname, "sphere.js"), "utf8");

function memoryStorage(initial) {
  const values = new Map(Object.entries(initial || {}));
  const writes = [];
  const removals = [];
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      const stringValue = String(value);
      writes.push([key, stringValue]);
      values.set(key, stringValue);
    },
    removeItem(key) {
      removals.push(key);
      values.delete(key);
    },
    value(key) {
      return values.get(key);
    },
    writes,
    removals,
  };
}

function noOpContext() {
  const gradient = { addColorStop() {} };
  return new Proxy(
    {
      createRadialGradient: () => gradient,
      createLinearGradient: () => gradient,
      measureText: () => ({ width: 0 }),
    },
    {
      get(target, property) {
        if (property in target) return target[property];
        return () => {};
      },
      set(target, property, value) {
        target[property] = value;
        return true;
      },
    }
  );
}

function makeCanvas() {
  const context = noOpContext();
  return {
    clientWidth: 800,
    clientHeight: 600,
    width: 800,
    height: 600,
    getContext: () => context,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    addEventListener() {},
  };
}

function makeTiles() {
  const neighbors = [[1], [0, 2], [1, 3], [2]];
  return neighbors.map((neighborIndices, index) => ({
    index,
    isPentagon: false,
    neighborIndices,
    centerPoint: { x: (index - 1.5) * 0.2, y: 0, z: 0.9 },
    boundary: [
      { x: -0.04 + index * 0.02, y: -0.04, z: 0.9 },
      { x: 0.04 + index * 0.02, y: -0.04, z: 0.9 },
      { x: 0.04 + index * 0.02, y: 0.04, z: 0.9 },
      { x: -0.04 + index * 0.02, y: 0.04, z: 0.9 },
    ],
  }));
}

function createHarness(options) {
  options = options || {};
  const canvas = makeCanvas();
  const localStorage = options.localStorage || memoryStorage();
  const sessionStorage = options.sessionStorage || memoryStorage();
  const frames = [];
  const listeners = Object.create(null);
  const classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
  const document = {
    visibilityState: "visible",
    documentElement: { setAttribute() {} },
    body: { dataset: {}, classList, appendChild() {} },
    activeElement: null,
    getElementById(id) {
      return id === "gameCanvas" ? canvas : null;
    },
    querySelector: () => null,
    addEventListener(type, listener) {
      listeners[`document:${type}`] = listener;
    },
    createElement(tag) {
      if (tag === "canvas") return makeCanvas();
      return { click() {}, remove() {}, classList, setAttribute() {} };
    },
  };
  const sandbox = {
    console,
    document,
    localStorage,
    sessionStorage,
    location: { search: "?welcome=0", pathname: "/sphere/", href: "https://example.test/sphere/" },
    navigator: {},
    performance: { now: () => 100 },
    requestAnimationFrame(callback) {
      frames.push(callback);
      return frames.length;
    },
    setInterval: () => 1,
    clearInterval() {},
    setTimeout(callback) {
      return { callback };
    },
    clearTimeout() {},
    URL,
    URLSearchParams,
    Uint8Array,
    Float32Array,
    Set,
    Map,
    Date,
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    Hexasphere: {
      generateHexasphere() {
        return { tiles: makeTiles() };
      },
    },
    matchMedia: () => ({ matches: true }),
    addEventListener(type, listener) {
      listeners[`window:${type}`] = listener;
    },
    getSelection: () => ({ isCollapsed: true, removeAllRanges() {} }),
    devicePixelRatio: 1,
    innerWidth: 800,
    innerHeight: 600,
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  vm.runInNewContext(sphereSource, sandbox, { filename: "sphere.js" });
  const api = sandbox.SphereSweeper.boot(options.boot || {});
  return {
    api,
    SphereSweeper: sandbox.SphereSweeper,
    localStorage,
    sessionStorage,
    runFrame() {
      const frame = frames.shift();
      if (frame) frame(100);
    },
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
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

function begunRun(overrides) {
  return Object.assign({
    v: 2,
    kind: "glitch-sphere",
    difficulty: "xsmall",
    first: false,
    over: false,
    won: false,
    flags: 0,
    mineCount: 1,
    time: 7,
    rotY: 0,
    rotX: 0.25,
    zoom: 0.72,
    mines: [3],
    revealed: [],
    flagged: [],
    runId: "run-restored",
    completionEmitted: false,
    variant: { token: "saved" },
    savedAt: 10,
  }, overrides);
}

console.log("Sphere optional variant contract tests…");

test("builds the exact normalized completion payload", () => {
  const harness = createHarness();
  assert.deepStrictEqual(plain(harness.SphereSweeper.buildRunCompletionPayload({
    runId: "run-123",
    variant: "glitch-sphere",
    outcome: "win",
    elapsedSeconds: 19,
    safeFacesRevealed: 137,
    mineCount: 25,
    difficulty: "xsmall",
    completedAt: "2026-08-13T12:34:56.000Z",
  })), {
    type: "hexsweeper:run-complete",
    schemaVersion: 1,
    runId: "run-123",
    variant: "glitch-sphere",
    outcome: "win",
    elapsedSeconds: 19,
    safeFacesRevealed: 137,
    mineCount: 25,
    difficulty: "xsmall",
    completedAt: "2026-08-13T12:34:56.000Z",
  });
});

test("keeps the canonical storage key and run kind unchanged without a variant", () => {
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  const { api } = createHarness({ localStorage, sessionStorage });
  assert.strictEqual(api.flagAt(0), true);
  const saved = plain(api.exportRunState());
  assert.strictEqual(saved.kind, "sphere");
  assert.strictEqual(Object.prototype.hasOwnProperty.call(saved, "variant"), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(saved, "runId"), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(saved, "completionEmitted"), false);
  assert.ok(localStorage.value("hexsweeper-sphere-run-v2"));
  assert.ok(sessionStorage.value("hexsweeper-sphere-run-v2"));
});

test("isolates variant persistence and restores its run identity and state", () => {
  const canonical = JSON.stringify({ kind: "sphere", sentinel: true });
  const localStorage = memoryStorage({ "hexsweeper-sphere-run-v2": canonical });
  const sessionStorage = memoryStorage();
  const imported = [];
  const variant = {
    id: "glitch-sphere",
    exportState: () => ({ occupied: 2, remainingMs: 400 }),
    importState: ({ saved }) => {
      imported.push(saved);
      return true;
    },
  };
  const first = createHarness({
    localStorage,
    sessionStorage,
    boot: {
      variant,
      storageKey: "hexsweeper-glitch-sphere-run-v1",
      runKind: "glitch-sphere",
      createRunId: () => "run-one",
    },
  });
  first.api.flagAt(0);
  const saved = plain(first.api.exportRunState());
  assert.strictEqual(saved.kind, "glitch-sphere");
  assert.strictEqual(saved.runId, "run-one");
  assert.strictEqual(saved.completionEmitted, false);
  assert.deepStrictEqual(saved.variant, { occupied: 2, remainingMs: 400 });
  assert.strictEqual(localStorage.value("hexsweeper-sphere-run-v2"), canonical);
  assert.ok(localStorage.value("hexsweeper-glitch-sphere-run-v1"));

  const second = createHarness({
    localStorage,
    sessionStorage,
    boot: {
      variant,
      storageKey: "hexsweeper-glitch-sphere-run-v1",
      runKind: "glitch-sphere",
      createRunId: () => "should-not-replace-restored-id",
    },
  });
  assert.strictEqual(second.api.exportRunState().runId, "run-one");
  assert.deepStrictEqual(plain(imported.at(-1)), { occupied: 2, remainingMs: 400 });
});

test("admits direct and flood reveals separately and runs the first-dig hook after flood", () => {
  const admissions = [];
  const firstDigs = [];
  const reveals = [];
  const variant = {
    id: "glitch-sphere",
    admitReveal({ index, source }) {
      admissions.push([index, source]);
      return index !== 1;
    },
    reveal(event) {
      reveals.push({ source: event.source, revealed: Array.from(event.revealed) });
    },
    firstResolvedDig(event) {
      firstDigs.push(Array.from(event.revealed));
    },
    useDefaultWin: () => false,
  };
  const { api } = createHarness({
    boot: { variant, runKind: "glitch-sphere", createRunId: () => "run-admission" },
  });
  assert.strictEqual(api.digAt(1), false);
  assert.strictEqual(api.digAt(0), true);
  assert.deepStrictEqual(admissions, [[1, "direct"], [0, "direct"], [1, "flood"]]);
  assert.strictEqual(api.getState().cells[1].revealed, false);
  assert.deepStrictEqual(reveals, [{ source: "direct", revealed: [0] }]);
  assert.deepStrictEqual(firstDigs, [[0]]);
  assert.strictEqual(api.getState().isGameOver, false);
});

test("includes variant state in undo and exposes reset, flag, tick, and draw hooks", () => {
  const events = [];
  let token = "before-dig";
  const variant = {
    id: "glitch-sphere",
    reset: () => events.push("reset"),
    captureUndo: () => ({ token }),
    restoreUndo: ({ saved }) => {
      token = saved.token;
      events.push("undo");
    },
    reveal: () => { token = "after-dig"; },
    flag: ({ index, flagged }) => events.push(`flag:${index}:${flagged}`),
    tick: ({ endRun }) => {
      events.push("tick");
      endRun("win");
    },
    draw: () => events.push("draw"),
    importState: () => true,
    useDefaultWin: () => false,
  };
  const { api, runFrame } = createHarness({
    boot: { variant, runKind: "glitch-sphere", createRunId: () => "run-hooks" },
  });
  assert.strictEqual(api.applyRunState(begunRun()), true);
  assert.strictEqual(api.digAt(0), true);
  assert.strictEqual(token, "after-dig");
  assert.strictEqual(api.undo(), true);
  assert.strictEqual(token, "before-dig");
  assert.strictEqual(api.flagAt(2), true);
  runFrame();
  assert.strictEqual(api.getState().isGameOver, true);
  assert.strictEqual(api.getState().won, true);
  api.reset();
  assert.ok(events.includes("undo"));
  assert.ok(events.includes("flag:2:true"));
  assert.ok(events.includes("tick"));
  assert.ok(events.includes("draw"));
  assert.strictEqual(events.filter((event) => event === "reset").length, 2);
});

test("emits one completion per run and does not re-emit a restored completion", () => {
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  const completions = [];
  const terminal = [];
  const variant = {
    id: "glitch-sphere",
    importState: () => true,
    exportState: () => ({ active: false }),
    terminal: ({ outcome }) => terminal.push(outcome),
    terminalCopy: ({ outcome }) => ({
      message: outcome === "loss" ? "The Glitch found a mine." : "Glitch trapped.",
      share: outcome === "win",
    }),
    useDefaultWin: () => false,
  };
  const boot = {
    variant,
    storageKey: "hexsweeper-glitch-sphere-run-v1",
    runKind: "glitch-sphere",
    createRunId: () => "run-complete",
    onRunComplete: (payload) => completions.push(plain(payload)),
  };
  const first = createHarness({ localStorage, sessionStorage, boot });
  assert.strictEqual(first.api.applyRunState(begunRun({ runId: "run-complete" })), true);
  assert.strictEqual(first.api.digAt(3), true);
  assert.strictEqual(first.api.digAt(3), false);
  assert.strictEqual(completions.length, 1);
  assert.deepStrictEqual(completions[0], {
    type: "hexsweeper:run-complete",
    schemaVersion: 1,
    runId: "run-complete",
    variant: "glitch-sphere",
    outcome: "loss",
    elapsedSeconds: 7,
    safeFacesRevealed: 0,
    mineCount: 1,
    difficulty: "xsmall",
    completedAt: completions[0].completedAt,
  });
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(completions[0].completedAt));
  assert.deepStrictEqual(terminal, ["loss"]);
  const completedSave = plain(first.api.exportRunState());
  assert.strictEqual(completedSave.completionEmitted, true);

  const restoredCompletions = [];
  createHarness({
    localStorage,
    sessionStorage,
    boot: Object.assign({}, boot, {
      onRunComplete: (payload) => restoredCompletions.push(payload),
    }),
  });
  assert.strictEqual(restoredCompletions.length, 0);
});

console.log("All tests passed.");
