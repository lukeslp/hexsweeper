#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const sphereSource = fs.readFileSync(path.join(__dirname, "sphere.js"), "utf8");

function memoryStorage(initial) {
  const values = new Map(Object.entries(initial || {}));
  const reads = [];
  const writes = [];
  const removals = [];
  return {
    getItem(key) {
      reads.push(key);
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
    entries() {
      return Object.fromEntries(values);
    },
    reads,
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
  const elements = {
    "sphere-banner": { hidden: true, classList: { ...classList }, textContent: "" },
    "banner-msg": { hidden: false, classList: { ...classList }, textContent: "" },
  };
  const document = {
    visibilityState: "visible",
    documentElement: { setAttribute() {} },
    body: { dataset: {}, classList, appendChild() {} },
    activeElement: null,
    getElementById(id) {
      return id === "gameCanvas" ? canvas : elements[id] || null;
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
    elements,
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
    elements,
    runFrame() {
      const frame = frames.shift();
      if (frame) frame(100);
    },
  };
}

function variantBoot(variant, overrides) {
  return Object.assign({
    variant,
    storageKey: "hexsweeper-glitch-sphere-run-v1",
    runKind: "glitch-sphere",
  }, overrides);
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

test("rejects missing or canonical variant persistence options before storage access", () => {
  const invalidOptions = [
    { runKind: "glitch-sphere" },
    { storageKey: "hexsweeper-glitch-sphere-run-v1" },
    { storageKey: "hexsweeper-sphere-run-v2", runKind: "glitch-sphere" },
    { storageKey: "hexsweeper-sphere-run-v1", runKind: "glitch-sphere" },
    { storageKey: "hexsweeper-glitch-sphere-run-v1", runKind: "sphere" },
  ];
  for (const invalid of invalidOptions) {
    const canonical = JSON.stringify({ kind: "sphere", sentinel: true });
    const localStorage = memoryStorage({
      "hexsweeper-sphere-run-v2": canonical,
      "hexsweeper-sphere-run-v1": canonical,
    });
    const sessionStorage = memoryStorage({
      "hexsweeper-sphere-run-v2": canonical,
      "hexsweeper-sphere-run-v1": canonical,
    });
    assert.throws(
      () => createHarness({
        localStorage,
        sessionStorage,
        boot: Object.assign({ variant: { id: "glitch-sphere" } }, invalid),
      }),
      /variant.*(?:storageKey|runKind)/i
    );
    assert.deepStrictEqual(localStorage.entries(), {
      "hexsweeper-sphere-run-v2": canonical,
      "hexsweeper-sphere-run-v1": canonical,
    });
    assert.deepStrictEqual(sessionStorage.entries(), {
      "hexsweeper-sphere-run-v2": canonical,
      "hexsweeper-sphere-run-v1": canonical,
    });
    assert.deepStrictEqual(localStorage.reads, []);
    assert.deepStrictEqual(sessionStorage.reads, []);
    assert.deepStrictEqual(localStorage.writes, []);
    assert.deepStrictEqual(sessionStorage.writes, []);
    assert.deepStrictEqual(localStorage.removals, []);
    assert.deepStrictEqual(sessionStorage.removals, []);
  }
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
    boot: variantBoot(variant, {
      createRunId: () => "run-one",
    }),
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
    boot: variantBoot(variant, {
      createRunId: () => "should-not-replace-restored-id",
    }),
  });
  assert.strictEqual(second.api.exportRunState().runId, "run-one");
  assert.deepStrictEqual(plain(imported.at(-1)), { occupied: 2, remainingMs: 400 });
});

test("advances run IDs on reset while retaining a restored run ID", () => {
  const ids = ["run-first", "run-second", "run-unexpected"];
  let calls = 0;
  const { api } = createHarness({
    boot: variantBoot({ id: "glitch-sphere", importState: () => true }, {
      createRunId: () => ids[calls++],
    }),
  });
  api.flagAt(0);
  const first = plain(api.exportRunState());
  assert.strictEqual(first.runId, "run-first");
  api.reset();
  api.flagAt(0);
  assert.strictEqual(api.exportRunState().runId, "run-second");
  assert.strictEqual(api.applyRunState(Object.assign({}, first, {
    variant: null,
    savedAt: 20,
  })), true);
  assert.strictEqual(api.exportRunState().runId, "run-first");
  assert.strictEqual(calls, 2);
});

test("restores canonical current saves without a variant", () => {
  const saved = begunRun({
    kind: "sphere",
    runId: undefined,
    completionEmitted: undefined,
    variant: undefined,
    revealed: [0],
  });
  const sessionStorage = memoryStorage({
    "hexsweeper-sphere-run-v2": JSON.stringify(saved),
  });
  const { api } = createHarness({ sessionStorage });
  assert.strictEqual(api.getState().difficulty, "xsmall");
  assert.strictEqual(api.getState().isFirstClick, false);
  assert.strictEqual(api.getState().cells[0].revealed, true);
  assert.strictEqual(api.exportRunState().kind, "sphere");
});

test("migrates a canonical legacy save and removes both legacy copies", () => {
  const saved = begunRun({
    v: 1,
    kind: "sphere",
    runId: undefined,
    completionEmitted: undefined,
    variant: undefined,
    revealed: [0],
  });
  const localStorage = memoryStorage({
    "hexsweeper-sphere-run-v1": JSON.stringify(saved),
  });
  const sessionStorage = memoryStorage({
    "hexsweeper-sphere-run-v1": JSON.stringify(saved),
  });
  const { api } = createHarness({ localStorage, sessionStorage });
  assert.strictEqual(api.getState().cells[0].revealed, true);
  assert.ok(localStorage.value("hexsweeper-sphere-run-v2"));
  assert.ok(sessionStorage.value("hexsweeper-sphere-run-v2"));
  assert.strictEqual(localStorage.value("hexsweeper-sphere-run-v1"), undefined);
  assert.strictEqual(sessionStorage.value("hexsweeper-sphere-run-v1"), undefined);
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
    boot: variantBoot(variant, { createRunId: () => "run-admission" }),
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
    boot: variantBoot(variant, { createRunId: () => "run-hooks" }),
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

test("contains throwing notification hooks and continues engine actions", () => {
  const events = [];
  const fail = (name) => () => { throw new Error(`${name} failed`); };
  const variant = {
    id: "glitch-sphere",
    reset: fail("reset"),
    admitReveal: ({ index }) => index !== 1,
    captureUndo: fail("captureUndo"),
    restoreUndo: fail("restoreUndo"),
    reveal: fail("reveal"),
    firstResolvedDig: () => events.push("firstResolvedDig"),
    flag: fail("flag"),
    tick: fail("tick"),
    draw: fail("draw"),
    useDefaultWin: () => false,
  };
  const { api, runFrame } = createHarness({
    boot: variantBoot(variant, { createRunId: () => "run-errors" }),
  });
  assert.strictEqual(api.digAt(0), true);
  assert.deepStrictEqual(events, ["firstResolvedDig"]);
  assert.strictEqual(api.undo(), true);
  assert.strictEqual(api.flagAt(2), true);
  assert.doesNotThrow(() => runFrame());
  assert.doesNotThrow(() => api.reset());
});

test("rejects a throwing import without mutating the active board", () => {
  const variant = {
    id: "glitch-sphere",
    importState: () => { throw new Error("bad variant snapshot"); },
  };
  const { api, localStorage, sessionStorage } = createHarness({
    boot: variantBoot(variant, { createRunId: () => "run-atomic" }),
  });
  const before = {
    difficulty: api.getState().difficulty,
    first: api.getState().isFirstClick,
    cells: api.getState().cells.map((cell) => ({
      isMine: cell.isMine,
      revealed: cell.revealed,
      flagged: cell.flagged,
    })),
    localWrites: localStorage.writes.length,
    sessionWrites: sessionStorage.writes.length,
  };
  assert.strictEqual(api.applyRunState(begunRun()), false);
  assert.strictEqual(api.getState().difficulty, before.difficulty);
  assert.strictEqual(api.getState().isFirstClick, before.first);
  assert.deepStrictEqual(
    plain(api.getState().cells.map((cell) => ({
      isMine: cell.isMine,
      revealed: cell.revealed,
      flagged: cell.flagged,
    }))),
    before.cells
  );
  assert.strictEqual(localStorage.writes.length, before.localWrites);
  assert.strictEqual(sessionStorage.writes.length, before.sessionWrites);
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
  const boot = variantBoot(variant, {
    createRunId: () => "run-complete",
    onRunComplete: (payload) => completions.push(plain(payload)),
  });
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

test("contains terminal hook failures and persists a recoverable terminal record", () => {
  const completions = [];
  const variant = {
    id: "glitch-sphere",
    terminal: () => { throw new Error("terminal failed"); },
    terminalCopy: () => { throw new Error("copy failed"); },
    exportState: () => { throw new Error("export failed"); },
    useDefaultWin: () => false,
  };
  const { api, localStorage, elements } = createHarness({
    boot: variantBoot(variant, {
      createRunId: () => "run-terminal-errors",
      onRunComplete: (payload) => completions.push(plain(payload)),
    }),
  });
  const state = api.getState();
  state.isFirstClick = false;
  state.mineCount = 1;
  state.cells[3].isMine = true;
  assert.doesNotThrow(() => api.digAt(3));
  assert.strictEqual(state.isGameOver, true);
  assert.strictEqual(state.won, false);
  assert.strictEqual(state.cells[3].endFlash, 1);
  assert.strictEqual(elements["banner-msg"].textContent, "Mine detonated.");
  assert.strictEqual(elements["sphere-banner"].hidden, false);
  assert.strictEqual(completions.length, 1);
  assert.strictEqual(api.digAt(3), false);
  assert.strictEqual(completions.length, 1);
  const saved = JSON.parse(
    localStorage.value("hexsweeper-glitch-sphere-run-v1")
  );
  assert.strictEqual(saved.kind, "glitch-sphere");
  assert.strictEqual(saved.over, true);
  assert.strictEqual(saved.won, false);
  assert.strictEqual(saved.runId, "run-terminal-errors");
  assert.strictEqual(saved.completionEmitted, true);
  assert.strictEqual(saved.variant, null);
});

console.log("All tests passed.");
