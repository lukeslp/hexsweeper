#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

function read(name) {
  try {
    return fs.readFileSync(path.join(__dirname, name), "utf8");
  } catch (_) {
    return "";
  }
}

const html = read("index.html");
const css = read("flux-sphere.css");
const adapterSource = read("flux-sphere.js");
const choices = fs.readFileSync(path.join(__dirname, "..", "choices.html"), "utf8");
const readme = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");
const workflow = fs.readFileSync(
  path.join(__dirname, "..", ".github", "workflows", "ci.yml"),
  "utf8"
);
let FluxSphere = null;
try {
  FluxSphere = require("./flux-sphere.js");
} catch (_) {}

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ${name} — OK`);
  } catch (error) {
    failures++;
    console.error(`  ${name} — FAIL`);
    console.error(`    ${error.message}`);
  }
}

function tagWithId(source, tagName, id) {
  const match = source.match(new RegExp(`<${tagName}\\b[^>]*\\bid=["']${id}["'][^>]*>`, "i"));
  return match ? match[0] : "";
}

function cell(overrides) {
  return Object.assign({ revealed: false, flagged: false, isMine: false }, overrides);
}

function tile(x, y, z, neighborIndices) {
  return {
    centerPoint: { x, y, z },
    neighborIndices: neighborIndices || [],
  };
}

/**
 * Face 0 is open; 1 and 2 are safe twins; 3 is a lone mine. With
 * `secondMine`, face 4 is another mine, so 3 and 4 become mine twins.
 */
function makeContext(overrides, options) {
  options = options || {};
  const cells = [
    cell({ revealed: true }),
    cell(),
    cell(),
    cell({ isMine: true }),
  ];
  const tiles = [
    tile(0, 1, 0, [1]),
    tile(1, 0, 0, [0]),
    tile(-1, 0, 0),
    tile(0, -1, 0),
  ];
  if (options.secondMine) {
    cells.push(cell({ isMine: true }));
    tiles.push(tile(0, 0, 1));
  }
  const calls = { revealSafeFaces: [], resolveLinkedFaces: [], persisted: 0, draws: 0 };
  const context = Object.assign({
    cells,
    tiles,
    state: { cells, tiles, isGameOver: false, won: false, reduceMotion: false },
    now: 100,
    revealSafeFaces(indices) {
      calls.revealSafeFaces.push(indices.slice());
      const opened = [];
      for (const index of indices) {
        const target = cells[index];
        if (!target || target.revealed || target.flagged || target.isMine) continue;
        target.revealed = true;
        opened.push(index);
      }
      return opened;
    },
    resolveLinkedFaces(indices) {
      calls.resolveLinkedFaces.push(indices.slice());
      const opened = [];
      for (const index of indices) {
        if (cells[index] && !cells[index].revealed && !cells[index].flagged) {
          cells[index].revealed = true;
          opened.push(index);
          if (cells[index].isMine) return { opened, detonated: index };
        }
      }
      return { opened, detonated: -1 };
    },
    persist() { calls.persisted++; },
    requestDraw() { calls.draws++; },
    projectFace() { return null; },
  }, overrides || {});
  return { context, cells, tiles, calls };
}

function makeRoot(options) {
  options = options || {};
  const canvasListeners = {};
  const dispatched = [];
  const posted = [];
  const calls = { digs: [], flags: [] };
  const status = { textContent: "" };
  const canvas = {
    addEventListener(type, listener) { canvasListeners[type] = listener; },
  };
  const state = {
    centerX: 400,
    centerY: 300,
    targetRotX: 0.25,
    targetRotY: 0,
    isGameOver: false,
  };
  const game = {
    getState: () => state,
    pickTile: () => 5,
    digAt(index) { calls.digs.push(index); return true; },
    flagAt(index) { calls.flags.push(index); return true; },
  };
  let bootOptions = null;
  const root = {
    document: {
      getElementById(id) {
        if (id === "gameCanvas") return canvas;
        if (id === "flux-status") return status;
        return null;
      },
    },
    location: { origin: "https://example.test" },
    SphereSweeper: {
      boot(received) { bootOptions = received; return game; },
    },
    initHexBloom(received, bloomOptions) {
      assert.strictEqual(received, game);
      assert.deepStrictEqual(bloomOptions, { tooltips: false });
      return { open() {}, close() {} };
    },
    CustomEvent: function CustomEvent(type, init) {
      this.type = type;
      this.detail = init.detail;
    },
    dispatchEvent(event) { dispatched.push(event); return true; },
  };
  root.parent = options.embedded
    ? {
        location: { origin: options.parentOrigin || root.location.origin },
        postMessage(payload, origin) { posted.push([payload, origin]); },
      }
    : root;
  return {
    root,
    state,
    calls,
    canvasListeners,
    dispatched,
    posted,
    getBootOptions: () => bootOptions,
  };
}

console.log("Flux Sphere route integration tests…");

test("publishes Flux metadata and canonical Sphere dependencies", () => {
  assert.match(html, /<title>[^<]*Flux Sphere[^<]*<\/title>/i);
  assert.match(html, /<meta\s+name=["']description["'][^>]+(entangled|linked|echo)/i);
  assert.match(html, /https:\/\/dr\.eamer\.dev\/games\/hexsweeper\/flux-sphere\//i);
  assert.match(html, /flux-sphere\/assets\/og\.png/i);
  assert.ok(fs.existsSync(path.join(__dirname, "assets", "og.png")), "missing Flux screenshot card");
  for (const asset of [
    "../fonts/fonts.css",
    "../skin-chrome.css",
    "../sphere/dev-chrome.css",
    "../sphere/hex-bloom.css",
    "../sphere/hexasphere.js",
    "../sphere/sphere.js",
    "../sphere/hex-bloom.js",
    "flux-pairs.js",
    "flux-sphere.js",
    "flux-sphere.css",
  ]) {
    assert.ok(html.includes(asset), `missing asset reference: ${asset}`);
  }
  for (const duplicate of ["hexasphere.js", "sphere.js", "hex-bloom.js"]) {
    assert.strictEqual(fs.existsSync(path.join(__dirname, duplicate)), false, `duplicated ${duplicate}`);
  }
});

test("exposes a named keyboard board, instructions, and polite atomic status", () => {
  const canvas = tagWithId(html, "canvas", "gameCanvas");
  const status = tagWithId(html, "p", "flux-status");
  assert.match(canvas, /tabindex=["']0["']/i);
  assert.match(canvas, /aria-label=["'][^"']*Flux Sphere[^"']*["']/i);
  assert.match(canvas, /aria-describedby=["']board-instructions["']/i);
  assert.match(status, /role=["']status["']/i);
  assert.match(status, /aria-live=["']polite["']/i);
  assert.match(status, /aria-atomic=["']true["']/i);
  assert.match(html, /Arrow keys/i);
  assert.match(html, /Enter[^<]*(dig|center)|dig[^<]*Enter/i);
  assert.match(html, /Shift[^<]*(flag|Space|Enter)/i);
  assert.match(css, /#gameCanvas:focus-visible[\s\S]*outline/i);
});

test("help is one line of what to do and three gestures, with no tooltips", () => {
  const sheet = html.slice(html.indexOf('id="help-overlay"'), html.indexOf("</nav>", html.indexOf('id="help-overlay"')));
  const lede = sheet.match(/<p class="help-lede">([^<]*)<\/p>/);
  assert.ok(lede, "help needs one lede line");
  assert.match(lede[1], /twin/i);
  assert.match(lede[1], /dig one and both open/i);
  assert.strictEqual((sheet.match(/class="help-lede"/g) || []).length, 1);
  const rows = sheet.match(/<li><span class="act">([^<]*)<\/span>/g) || [];
  assert.deepStrictEqual(rows.map((row) => row.replace(/<[^>]+>/g, "")), ["Tap", "Hold", "Drag"]);
  for (const gone of ["help-body", "help-keys", "help-more"]) {
    assert.ok(!sheet.includes(gone), `help still carries ${gone}`);
  }
  assert.ok(!/\stitle="/.test(html), "the page carries a title= tooltip");
  const twin = tagWithId(html, "button", "twin-btn");
  assert.match(twin, /aria-pressed=["']false["']/i);
  assert.match(twin, /aria-label=["'][^"']*twin[^"']*["']/i);
  assert.match(css, /\.flux-twin-btn:focus-visible[\s\S]*outline/i);
  assert.match(css, /\.flux-twin-btn[\s\S]*min-height:\s*48px/i);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
  assert.match(css, /animation[^;]*none|transition[^;]*none/i);
  assert.match(adapterSource, /reduceMotion/);
});

test("play starts at once: no sheet opens by itself, the first visit gets one cue", () => {
  const options = { autoWelcome: null, bloom: null };
  const toasts = [];
  const stored = {};
  let helpClicks = 0;
  const cells = [{ revealed: false, flagged: false }];
  const game = {
    getState: () => ({ cells }),
    toast(text, ms) { toasts.push([text, ms]); },
  };
  const root = {
    document: {
      getElementById(id) {
        if (id === "help-btn") return { click() { helpClicks++; } };
        if (id === "help-overlay") return { hidden: true };
        return null;
      },
    },
    location: { origin: "https://example.test", search: "" },
    localStorage: {
      getItem: (key) => (key in stored ? stored[key] : null),
      setItem: (key, value) => { stored[key] = String(value); },
    },
    requestAnimationFrame: (callback) => callback(),
    SphereSweeper: { boot(received) { options.autoWelcome = received.autoWelcome; return game; } },
    initHexBloom(received, bloomOptions) { options.bloom = bloomOptions; return {}; },
  };
  FluxSphere.boot({ root });
  assert.strictEqual(options.autoWelcome, false, "the engine may not open the sheet on a first visit");
  assert.deepStrictEqual(options.bloom, { tooltips: false });
  assert.strictEqual(helpClicks, 0, "help opened by itself");
  assert.strictEqual(toasts.length, 1);
  assert.match(toasts[0][0], /^Tap to clear/);
  assert.strictEqual(stored[FluxSphere.WELCOME_KEY], "1");
  FluxSphere.boot({ root });
  assert.strictEqual(toasts.length, 1, "the cue shows once");
});

test("one tap digs a face and echoes onto its safe twin", () => {
  assert.ok(FluxSphere && typeof FluxSphere.createAdapter === "function");
  const status = { textContent: "" };
  const adapter = FluxSphere.createAdapter({ statusElement: status, schedule: (callback) => callback() });
  const { context, cells, calls } = makeContext();
  const activated = adapter.variant.firstResolvedDig(context);
  assert.deepStrictEqual(activated, { status: "active", pairCount: 1, unpairedCount: 1 });
  assert.match(status.textContent, /linked 1 twin pair\./i);

  // No trace step: the first tap is admitted and digs.
  assert.strictEqual(adapter.variant.admitReveal(Object.assign({ index: 1, source: "direct" }, context)), true);
  cells[1].revealed = true;
  const result = adapter.variant.reveal(Object.assign({
    index: 1,
    source: "direct",
    revealed: [1],
  }, context));
  assert.deepStrictEqual(calls.revealSafeFaces, [[2]]);
  assert.deepStrictEqual(calls.resolveLinkedFaces, [], "the echo never takes the mine-capable path");
  assert.deepStrictEqual(result, { status: "echoed", from: 1, partner: 2, opened: [2] });
  assert.strictEqual(cells[2].revealed, true);
  assert.match(status.textContent, /its twin opened/i);
});

test("regression: a safe dig never echoes onto a mine, even from an old saved run", () => {
  const status = { textContent: "" };
  const adapter = FluxSphere.createAdapter({ statusElement: status });
  const run = makeContext(null, { secondMine: true });
  // A version-2 save linked safe face 1 to mine 3 and safe 2 to mine 4.
  const saved = { pairs: { v: 2, active: true, pairFor: [-1, 3, 4, 1, 2] }, trace: [1, 3] };
  assert.strictEqual(adapter.variant.importState(Object.assign({ saved }, run.context)), true);
  assert.match(status.textContent, /new rules/i);
  assert.deepStrictEqual(adapter.variant.exportState(), {
    pairs: { v: 3, active: true, pairFor: [-1, 2, 1, 4, 3] },
    trace: null,
  });
  run.cells[1].revealed = true;
  const result = adapter.variant.reveal(Object.assign({ index: 1, source: "direct", revealed: [1] }, run.context));
  assert.deepStrictEqual(result, { status: "echoed", from: 1, partner: 2, opened: [2] });
  assert.strictEqual(run.cells[3].revealed, false);
  assert.strictEqual(run.cells[4].revealed, false);
  assert.deepStrictEqual(run.calls.resolveLinkedFaces, []);
});

test("a mine you dig yourself ends the run without opening anything else", () => {
  const status = { textContent: "" };
  const adapter = FluxSphere.createAdapter({ statusElement: status });
  const first = makeContext(null, { secondMine: true });
  adapter.variant.firstResolvedDig(first.context);
  first.cells[3].revealed = true;
  assert.deepStrictEqual(adapter.variant.reveal(Object.assign({
    index: 3,
    source: "direct",
    revealed: [3],
  }, first.context)), { status: "detonated", from: 3, partner: 4, opened: [], detonated: 3 });
  assert.deepStrictEqual(first.calls.revealSafeFaces, []);
  assert.deepStrictEqual(first.calls.resolveLinkedFaces, []);
  assert.strictEqual(first.cells[4].revealed, false);
  assert.match(status.textContent, /twin was a mine too/i);
});

test("a chord echoes the twins of the faces it opens", () => {
  const adapter = FluxSphere.createAdapter();
  const run = makeContext();
  adapter.variant.firstResolvedDig(run.context);
  run.cells[1].revealed = true;
  const result = adapter.variant.reveal(Object.assign({ index: 0, source: "chord", revealed: [1] }, run.context));
  assert.strictEqual(result.status, "echoed");
  assert.deepStrictEqual(run.calls.revealSafeFaces, [[2]]);
  assert.strictEqual(run.cells[2].revealed, true);
});

test("a flagged twin holds the echo", () => {
  const status = { textContent: "" };
  const adapter = FluxSphere.createAdapter({ statusElement: status });
  const held = makeContext();
  adapter.variant.reset(held.context);
  adapter.variant.firstResolvedDig(held.context);
  held.cells[2].flagged = true;
  held.cells[1].revealed = true;
  assert.deepStrictEqual(adapter.variant.reveal(Object.assign({
    index: 1,
    source: "direct",
    revealed: [1],
  }, held.context)), { status: "held", from: 1, partner: 2 });
  assert.deepStrictEqual(held.calls.revealSafeFaces, []);
  assert.deepStrictEqual(held.calls.resolveLinkedFaces, []);
  assert.match(status.textContent, /flagged[^.]*held|held[^.]*flagged/i);
});

test("the Twin tool traces one face instead of digging, then returns to digging", () => {
  const status = { textContent: "" };
  const adapter = FluxSphere.createAdapter({ statusElement: status });
  const run = makeContext();
  const seen = [];
  adapter.onChange((ui) => seen.push(ui));
  assert.strictEqual(adapter.armTrace(true), false, "nothing to trace before the first dig");
  assert.match(status.textContent, /after your first dig/i);

  adapter.variant.firstResolvedDig(run.context);
  assert.strictEqual(adapter.armTrace(true), true);
  assert.strictEqual(seen[seen.length - 1].armed, true);
  const traced = adapter.variant.admitReveal(Object.assign({ index: 1, source: "direct" }, run.context));
  assert.deepStrictEqual(traced, { allowed: false, status: "traced", from: 1, partner: 2 });
  assert.strictEqual(adapter.isTraceArmed(), false, "one trace per arming");
  assert.match(status.textContent, /both safe or both mines/i);
  assert.deepStrictEqual(adapter.variant.exportState().trace, [1, 2]);
  assert.strictEqual(adapter.variant.admitReveal(Object.assign({ index: 1, source: "direct" }, run.context)), true);

  // A long press while armed traces too, instead of flagging.
  adapter.armTrace(true);
  const viaFlag = adapter.variant.admitFlag(Object.assign({ index: 2, flagged: true }, run.context));
  assert.deepStrictEqual(viaFlag, { allowed: false, status: "traced", from: 2, partner: 1 });

  // Tracing a face whose twin is open says the face is safe.
  run.cells[2].revealed = true;
  adapter.armTrace(true);
  adapter.variant.admitReveal(Object.assign({ index: 1, source: "direct" }, run.context));
  assert.match(status.textContent, /already open, so A is safe/i);

  assert.strictEqual(adapter.clearTrace(), true);
  assert.strictEqual(adapter.variant.exportState().trace, null);

  adapter.variant.terminal(Object.assign({ outcome: "loss" }, run.context));
  assert.strictEqual(seen[seen.length - 1].over, true);
  assert.strictEqual(adapter.armTrace(true), false, "no tracing after the run ends");
});

test("marks the twin of every flag with a dashed ring, but not after the run ends", () => {
  const adapter = FluxSphere.createAdapter({ now: () => 100 });
  const run = makeContext(null, { secondMine: true });
  adapter.variant.firstResolvedDig(run.context);
  run.cells[3].flagged = true;
  const dashes = [];
  const painted = [];
  const drawing = {
    save() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {},
    arc() {}, fill() {}, fillText() {}, restore() {},
    setLineDash(value) { dashes.push(value.slice()); },
    set strokeStyle(_) {}, set lineWidth(_) {}, set fillStyle(_) {}, set font(_) {},
    set textAlign(_) {}, set textBaseline(_) {},
  };
  const frame = (state) => Object.assign({}, run.context, {
    now: 100,
    state: Object.assign({}, run.context.state, state || {}),
    context2d: drawing,
    projectFace(index) {
      painted.push(index);
      return { z: 1, area: 225, center: { x: 10, y: 10 }, boundary: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 20 }] };
    },
  });
  adapter.variant.draw(frame());
  assert.deepStrictEqual(painted, [4], "only the flag's twin is marked");
  assert.ok(dashes.some((value) => value.length === 2), "the mark is dashed");
  painted.length = 0;
  adapter.variant.draw(frame({ isGameOver: true }));
  assert.deepStrictEqual(painted, []);
});

test("re-announces identical held echoes as separate live-region updates", () => {
  const writes = [];
  const status = {};
  Object.defineProperty(status, "textContent", {
    get() { return writes[writes.length - 1] || ""; },
    set(value) { writes.push(value); },
  });
  const adapter = FluxSphere.createAdapter({ statusElement: status, schedule: (callback) => callback() });
  const held = makeContext();
  adapter.variant.firstResolvedDig(held.context);
  held.cells[2].flagged = true;
  held.cells[1].revealed = true;
  const action = Object.assign({ index: 1, source: "direct", revealed: [1] }, held.context);
  adapter.variant.reveal(action);
  const afterFirst = writes.length;
  adapter.variant.reveal(action);
  assert.strictEqual(writes.length, afterFirst + 2);
  assert.strictEqual(writes[afterFirst], "");
  assert.strictEqual(writes[writes.length - 1], writes[afterFirst - 1]);
});

test("draws echo endpoints with distinct cyan and amber outlines", () => {
  const adapter = FluxSphere.createAdapter({ now: () => 100 });
  const active = makeContext();
  adapter.variant.firstResolvedDig(active.context);
  active.cells[1].revealed = true;
  adapter.variant.reveal(Object.assign({ index: 1, source: "direct", revealed: [1] }, active.context));

  const strokeStyles = [];
  const fillStyles = [];
  const glyphs = [];
  const drawing = {
    save() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {},
    arc() {}, fill() {}, fillText(value) { glyphs.push(value); }, restore() {},
    set strokeStyle(value) { strokeStyles.push(value); },
    set lineWidth(_) {}, set fillStyle(value) { fillStyles.push(value); }, set font(_) {}, set textAlign(_) {},
    set textBaseline(_) {},
  };
  adapter.variant.draw(Object.assign({}, active.context, {
    now: 100,
    context2d: drawing,
    projectFace() {
      return {
        z: 1,
        area: 225,
        center: { x: 10, y: 10 },
        boundary: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 20 }],
      };
    },
  }));
  assert.ok(strokeStyles.includes("#00a6b2"));
  assert.ok(strokeStyles.includes("#d97706"));
  assert.ok(fillStyles.includes("#ffffff"));
  assert.ok(fillStyles.includes("#000000"));
  assert.deepStrictEqual(glyphs, ["↔", "↔"]);
});

test("reduced motion: a still echo arc is cleared by one booked repaint", () => {
  let clock = 100;
  const booked = [];
  const adapter = FluxSphere.createAdapter({
    now: () => clock,
    scheduleAfter: (callback, ms) => booked.push({ callback, ms }),
  });
  const run = makeContext();
  run.context.state.reduceMotion = true;
  adapter.variant.firstResolvedDig(run.context);
  run.cells[1].revealed = true;
  adapter.variant.reveal(Object.assign({ index: 1, source: "direct", revealed: [1] }, run.context));

  const glyphs = [];
  const drawing = {
    save() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {},
    arc() {}, fill() {}, fillText(value) { glyphs.push(value); }, restore() {},
    set strokeStyle(_) {}, set lineWidth(_) {}, set fillStyle(_) {}, set font(_) {},
    set textAlign(_) {}, set textBaseline(_) {},
  };
  const frame = (at) => Object.assign({}, run.context, {
    now: at,
    context2d: drawing,
    projectFace() {
      return { z: 1, area: 225, center: { x: 10, y: 10 }, boundary: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 20 }] };
    },
  });

  const drawsBefore = run.calls.draws;
  adapter.variant.draw(frame(120));
  assert.deepStrictEqual(glyphs, ["↔", "↔"], "the still arc is painted");
  assert.strictEqual(run.calls.draws, drawsBefore, "no frame-by-frame redraw under reduced motion");
  assert.strictEqual(booked.length, 1, "one clearing repaint is booked");
  assert.ok(booked[0].ms > 1980 - 1 && booked[0].ms < 2100, `booked at ${booked[0].ms} ms`);

  adapter.variant.draw(frame(500));
  assert.strictEqual(booked.length, 1, "a second still frame does not book another repaint");

  clock = 120 + booked[0].ms;
  booked[0].callback();
  assert.strictEqual(run.calls.draws, drawsBefore + 1, "the booked repaint asks the engine for a frame");
  glyphs.length = 0;
  adapter.variant.draw(frame(clock));
  assert.deepStrictEqual(glyphs, [], "that frame no longer shows the arc");
  assert.strictEqual(booked.length, 1, "nothing left to clear, so nothing more is booked");
});

test("round-trips pair state and regenerates pairs for first-dig undo", () => {
  const adapter = FluxSphere.createAdapter();
  const first = makeContext();
  adapter.variant.firstResolvedDig(first.context);
  adapter.armTrace(true);
  adapter.variant.admitReveal(Object.assign({ index: 1, source: "direct" }, first.context));
  const saved = adapter.variant.exportState();
  assert.deepStrictEqual(saved, {
    pairs: { v: 3, active: true, pairFor: [-1, 2, 1, -1] },
    trace: [1, 2],
  });

  const restored = FluxSphere.createAdapter();
  assert.strictEqual(restored.variant.importState(Object.assign({ saved }, first.context)), true);
  assert.deepStrictEqual(restored.variant.exportState(), saved);

  const undo = adapter.variant.captureUndo(first.context);
  assert.strictEqual(undo.regenerateOnRestore, true);
  assert.deepStrictEqual(undo.trace, [1, 2]);
  const allCovered = makeContext();
  allCovered.cells[0].revealed = false;
  adapter.variant.restoreUndo(Object.assign({ saved: undo }, allCovered.context));
  const regenerated = adapter.variant.exportState().pairs.pairFor;
  assert.ok(regenerated[0] >= 0, "the undone opening face should receive a new pair");
});

test("uses canonical win, terminal copy, isolated storage, and Flux completion", () => {
  const adapter = FluxSphere.createAdapter();
  assert.strictEqual(adapter.variant.useDefaultWin(), true);
  assert.match(adapter.variant.terminalCopy({ outcome: "win" }).message, /Flux stabilized/i);

  const harness = makeRoot();
  const result = FluxSphere.boot({ root: harness.root });
  const options = harness.getBootOptions();
  assert.strictEqual(options.storageKey, "hexsweeper-flux-sphere-run-v1");
  assert.strictEqual(options.runKind, "flux-sphere");
  assert.strictEqual(options.variant.id, "flux-sphere");
  assert.strictEqual(typeof options.onRunComplete, "function");
  assert.strictEqual(result.game.getState(), harness.state);
});

test("wires centered keyboard dig and flag actions", () => {
  const harness = makeRoot();
  FluxSphere.boot({ root: harness.root });
  const keydown = harness.canvasListeners.keydown;
  assert.strictEqual(typeof keydown, "function");
  const before = harness.state.targetRotY;
  keydown({ key: "ArrowRight", shiftKey: false, repeat: false, preventDefault() {} });
  keydown({ key: "Enter", shiftKey: false, repeat: false, preventDefault() {} });
  keydown({ key: " ", code: "Space", shiftKey: true, repeat: false, preventDefault() {} });
  keydown({ key: "e", shiftKey: false, repeat: false, preventDefault() {} });
  keydown({ key: "Escape", shiftKey: false, repeat: false, preventDefault() {} });
  assert.ok(harness.state.targetRotY > before);
  assert.deepStrictEqual(harness.calls.digs, [5], "E traces; it never digs");
  assert.deepStrictEqual(harness.calls.flags, [5]);
});

test("dispatches completion locally and posts only to a same-origin parent", () => {
  const payload = { type: "hexsweeper:run-complete", runId: "flux-1" };
  const same = makeRoot({ embedded: true });
  FluxSphere.forwardCompletion(payload, same.root);
  assert.strictEqual(same.dispatched.length, 1);
  assert.deepStrictEqual(same.posted, [[payload, "https://example.test"]]);

  const cross = makeRoot({ embedded: true, parentOrigin: "https://elsewhere.test" });
  FluxSphere.forwardCompletion(payload, cross.root);
  assert.strictEqual(cross.dispatched.length, 1);
  assert.deepStrictEqual(cross.posted, []);
});

test("is discoverable from the worlds flow, documented, and covered by CI", () => {
  for (const route of [
    "flux-sphere/",
    "monkey-grid/",
    "monkey-sphere/",
    "sphere-reflection/",
    "wheel/",
    "polyhedron/",
  ]) {
    assert.ok(choices.includes(`href="${route}"`), `choices hub omits ${route}`);
  }
  assert.match(readme, /## Flux Sphere \(experimental\)/);
  assert.match(readme, /hexsweeper-flux-sphere-run-v1/);
  assert.match(workflow, /node flux-sphere\/test-flux-pairs\.js/);
  assert.match(workflow, /node flux-sphere\/test-integration\.js/);
});

if (failures) {
  console.error(`${failures} integration test${failures === 1 ? "" : "s"} failed.`);
  process.exitCode = 1;
} else {
  console.log("All tests passed.");
}
