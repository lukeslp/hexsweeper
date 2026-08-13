#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const routeDir = __dirname;

function read(name) {
  try {
    return fs.readFileSync(path.join(routeDir, name), "utf8");
  } catch (_) {
    return "";
  }
}

const html = read("index.html");
const css = read("glitch-sphere.css");
let GlitchSphere = null;
try {
  GlitchSphere = require("./glitch-sphere.js");
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

function makeRoot(options) {
  options = options || {};
  const canvasListeners = Object.create(null);
  const documentListeners = Object.create(null);
  const dispatched = [];
  const posted = [];
  const calls = { pause: 0, resume: 0, undo: 0, digs: [], flags: [] };
  const status = { textContent: "" };
  const canvas = {
    addEventListener(type, listener) {
      canvasListeners[type] = listener;
    },
  };
  const state = {
    cells: [],
    tiles: [],
    centerX: 400,
    centerY: 300,
    rotX: 0.25,
    rotY: 0,
    targetRotX: 0.25,
    targetRotY: 0,
    isGameOver: false,
    reduceMotion: false,
  };
  let bootOptions = null;
  const game = {
    getState: () => state,
    pickTile: () => 7,
    digAt(index) {
      calls.digs.push(index);
      return true;
    },
    flagAt(index) {
      calls.flags.push(index);
      return true;
    },
    pauseTimer() {
      calls.pause++;
    },
    resumeTimer() {
      calls.resume++;
    },
    undo() {
      calls.undo++;
      return typeof options.undo === "function" ? options.undo() : false;
    },
  };
  const root = {
    document: {
      visibilityState: "visible",
      getElementById(id) {
        if (id === "gameCanvas") return canvas;
        if (id === "glitch-status") return status;
        return null;
      },
      addEventListener(type, listener) {
        documentListeners[type] = listener;
      },
    },
    location: { origin: "https://example.test" },
    SphereSweeper: {
      boot(received) {
        bootOptions = received;
        return game;
      },
    },
    initHexBloom(received) {
      assert.strictEqual(received, game);
      return { open() {}, close() {} };
    },
    CustomEvent: function CustomEvent(type, init) {
      this.type = type;
      this.detail = init.detail;
    },
    dispatchEvent(event) {
      dispatched.push(event);
      return true;
    },
  };
  root.parent = options.embedded
    ? {
        location: { origin: options.parentOrigin || root.location.origin },
        postMessage(payload, targetOrigin) {
          posted.push([payload, targetOrigin]);
        },
      }
    : root;
  return {
    root,
    game,
    state,
    status,
    calls,
    canvasListeners,
    documentListeners,
    dispatched,
    posted,
    getBootOptions: () => bootOptions,
  };
}

console.log("Glitch Sphere route integration tests…");

test("publishes Glitch Sphere title, metadata, and canonical shared assets", () => {
  assert.match(html, /<title>[^<]*Glitch Sphere[^<]*<\/title>/i);
  assert.match(html, /<meta\s+name=["']description["'][^>]+moving|<meta\s+name=["']description["'][^>]+trap/i);
  for (const asset of [
    "../fonts/fonts.css",
    "../skin-chrome.css",
    "../sphere/dev-chrome.css",
    "../sphere/hex-bloom.css",
    "../sphere/hexasphere.js",
    "../sphere/sphere.js",
    "../sphere/hex-bloom.js",
  ]) {
    assert.ok(html.includes(asset), `missing shared asset reference: ${asset}`);
  }
  assert.ok(html.includes("glitch-sphere.css"));
  assert.ok(html.includes("glitch-hazard.js"));
  assert.ok(html.includes("glitch-sphere.js"));
  for (const duplicate of ["hexasphere.js", "sphere.js", "hex-bloom.js"]) {
    assert.strictEqual(fs.existsSync(path.join(routeDir, duplicate)), false, `duplicated ${duplicate}`);
  }
});

test("exposes a named keyboard-focusable board and restrained live status", () => {
  const canvas = tagWithId(html, "canvas", "gameCanvas");
  const status = tagWithId(html, "p", "glitch-status") || tagWithId(html, "div", "glitch-status");
  assert.match(canvas, /\btabindex=["']0["']/i);
  assert.match(canvas, /\baria-label=["'][^"']*Glitch Sphere[^"']*["']/i);
  assert.match(canvas, /\baria-describedby=["']board-instructions["']/i);
  assert.match(status, /\brole=["']status["']/i);
  assert.match(status, /\baria-live=["']polite["']/i);
  assert.match(status, /\baria-atomic=["']true["']/i);
  assert.match(css, /#gameCanvas:focus-visible[\s\S]*outline/i);
  assert.match(css, /\.sphere-banner\[hidden\][\s\S]{0,80}display:\s*none/i);
  assert.match(css, /\.help-overlay\[hidden\][\s\S]{0,80}display:\s*none/i);
});

test("documents the Glitch objective, closed routes, and keyboard controls", () => {
  assert.match(html, /trap the Glitch/i);
  assert.match(html, /revealed[^<.]*flagged|flagged[^<.]*revealed/i);
  assert.match(html, /Arrow keys/i);
  assert.match(html, /Enter[^<]*(dig|center)|dig[^<]*Enter/i);
  assert.match(html, /Shift[^<]*(flag|Space|Enter)/i);
  assert.match(html, /direct dig[^<.]*blocked|blocks? a direct dig/i);
});

test("keeps the marker and cadence while reduced motion removes pulse and interpolation", () => {
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
  assert.match(css, /animation[^;]*none|transition[^;]*none/i);
  assert.match(html, /non-color|exclamation|! marker/i);
});

test("boots Sphere with isolated persistence, run kind, variant, and completion callback", () => {
  assert.ok(GlitchSphere && typeof GlitchSphere.boot === "function", "GlitchSphere.boot is unavailable");
  const harness = makeRoot();
  const result = GlitchSphere.boot({ root: harness.root });
  const options = harness.getBootOptions();
  assert.strictEqual(options.canvasId, "gameCanvas");
  assert.strictEqual(options.storageKey, "hexsweeper-glitch-sphere-run-v1");
  assert.strictEqual(options.runKind, "glitch-sphere");
  assert.strictEqual(options.variant.id, "glitch-sphere");
  assert.strictEqual(options.variant.useDefaultWin(), false);
  assert.strictEqual(typeof options.onRunComplete, "function");
  assert.strictEqual(result.game, harness.game);
});

test("blocks an occupied dig and completes an immediate route trap through the Sphere lifecycle", () => {
  assert.ok(GlitchSphere && typeof GlitchSphere.createAdapter === "function", "createAdapter is unavailable");
  const status = { textContent: "" };
  const adapter = GlitchSphere.createAdapter({ random: () => 0, now: () => 0, statusElement: status });
  const cells = [
    { revealed: true, flagged: false, isMine: false },
    { revealed: false, flagged: false, isMine: false },
    { revealed: true, flagged: false, isMine: false },
    { revealed: false, flagged: false, isMine: false },
  ];
  const tiles = [
    { neighborIndices: [1] },
    { neighborIndices: [0, 2, 3] },
    { neighborIndices: [1] },
    { neighborIndices: [1] },
  ];
  const endings = [];
  const context = {
    cells,
    tiles,
    state: { cells, tiles, isGameOver: false },
    endRun(outcome) {
      endings.push(outcome);
      return true;
    },
    persist() {},
    requestDraw() {},
  };
  adapter.variant.firstResolvedDig(context);
  const spawnAnnouncement = status.textContent;
  assert.strictEqual(adapter.variant.admitReveal(Object.assign({ index: 1, source: "flood" }, context)).status, "blocked");
  assert.strictEqual(status.textContent, spawnAnnouncement);
  assert.strictEqual(adapter.variant.admitReveal(Object.assign({ index: 1, source: "direct" }, context)).status, "blocked");
  assert.match(status.textContent, /blocks|occupied/i);
  assert.strictEqual(adapter.variant.admitFlag(Object.assign({ index: 1, flagged: true }, context)).status, "blocked");
  cells[3].flagged = true;
  adapter.variant.flag(Object.assign({ index: 3, flagged: true }, context));
  assert.deepStrictEqual(endings, ["win"]);
});

test("round-trips active hazard state and rejects invalid terminal persistence", () => {
  const cells = [
    { revealed: true, flagged: false, isMine: false },
    { revealed: false, flagged: false, isMine: false },
    { revealed: false, flagged: false, isMine: false },
  ];
  const tiles = [
    { neighborIndices: [1] },
    { neighborIndices: [0, 2] },
    { neighborIndices: [1] },
  ];
  const context = {
    cells,
    tiles,
    state: { cells, tiles, isGameOver: false, won: false },
    persist() {},
    requestDraw() {},
    endRun() {},
  };
  const first = GlitchSphere.createAdapter({ random: () => 0, now: () => 0 });
  first.variant.firstResolvedDig(context);
  const saved = first.variant.exportState();
  assert.deepStrictEqual(saved, {
    hazard: { active: true, index: 1, remainingMs: 1000 },
    terminalReason: null,
  });

  const restored = GlitchSphere.createAdapter({ random: () => 0, now: () => 5000 });
  assert.strictEqual(restored.variant.importState(Object.assign({ saved }, context)), true);
  assert.deepStrictEqual(restored.variant.exportState(), saved);
  assert.strictEqual(
    restored.variant.importState(Object.assign({
      saved: { hazard: saved.hazard, terminalReason: "unknown" },
    }, context)),
    false
  );
  assert.strictEqual(
    restored.variant.importState(Object.assign({
      saved: { hazard: saved.hazard, terminalReason: "direct-mine" },
    }, context)),
    false
  );
});

test("round-trips each completed terminal reason to the correct restored banner copy", () => {
  const cases = [
    ["trapped", "win", /Glitch trapped/i],
    ["hazard-mine", "loss", /Glitch reached a mine/i],
    ["direct-mine", "loss", /Mine detonated/i],
  ];
  for (const [terminalReason, outcome, expectedCopy] of cases) {
    const cells = [
      { revealed: true, flagged: false, isMine: false },
      { revealed: false, flagged: false, isMine: false },
      { revealed: false, flagged: false, isMine: true },
    ];
    const tiles = [
      { neighborIndices: [1] },
      { neighborIndices: [0, 2] },
      { neighborIndices: [1] },
    ];
    const state = { cells, tiles, isGameOver: true, won: outcome === "win" };
    const context = { cells, tiles, state, persist() {}, requestDraw() {}, endRun() {} };
    const saved = {
      hazard: { active: false, index: null, remainingMs: 0 },
      terminalReason,
    };
    const restored = GlitchSphere.createAdapter({ now: () => 0 });
    assert.strictEqual(restored.variant.importState(Object.assign({ saved }, context)), true);
    assert.deepStrictEqual(restored.variant.exportState(), saved);
    assert.match(restored.variant.terminalCopy({ outcome }).message, expectedCopy);
  }
});

test("restores the hazard and terminal reason captured for undo", () => {
  const cells = [
    { revealed: true, flagged: false, isMine: false },
    { revealed: false, flagged: false, isMine: false },
    { revealed: false, flagged: false, isMine: false },
  ];
  const tiles = [
    { neighborIndices: [1] },
    { neighborIndices: [0, 2] },
    { neighborIndices: [1] },
  ];
  const context = {
    cells,
    tiles,
    state: { cells, tiles, isGameOver: false, won: false },
    persist() {},
    requestDraw() {},
    endRun() {},
  };
  const adapter = GlitchSphere.createAdapter({ random: () => 0, now: () => 0 });
  adapter.variant.firstResolvedDig(context);
  const undo = adapter.variant.captureUndo(context);
  adapter.variant.terminal(Object.assign({ outcome: "loss" }, context));
  assert.strictEqual(adapter.variant.exportState().terminalReason, "direct-mine");
  adapter.variant.restoreUndo(Object.assign({ saved: undo }, context));
  assert.deepStrictEqual(adapter.variant.exportState(), undo);
});

test("leaves an ordinary mined reveal to Sphere instead of converting it to a trap win", () => {
  const adapter = GlitchSphere.createAdapter({ random: () => 0, now: () => 0 });
  const cells = [
    { revealed: true, flagged: false, isMine: false },
    { revealed: false, flagged: false, isMine: false },
    { revealed: true, flagged: false, isMine: false },
    { revealed: false, flagged: false, isMine: true },
  ];
  const tiles = [
    { neighborIndices: [1] },
    { neighborIndices: [0, 2, 3] },
    { neighborIndices: [1] },
    { neighborIndices: [1] },
  ];
  const endings = [];
  const context = {
    cells,
    tiles,
    state: { cells, tiles, isGameOver: false },
    endRun(outcome) {
      endings.push(outcome);
      return true;
    },
    persist() {},
    requestDraw() {},
  };
  adapter.variant.firstResolvedDig(context);
  cells[3].revealed = true;
  adapter.variant.reveal(Object.assign({ index: 3, source: "direct", revealed: [3] }, context));
  assert.deepStrictEqual(endings, []);
});

test("freezes the remaining hazard delay across pause and resume without catch-up", () => {
  assert.ok(GlitchSphere && typeof GlitchSphere.createAdapter === "function", "createAdapter is unavailable");
  let now = 0;
  const adapter = GlitchSphere.createAdapter({ random: () => 0, now: () => now });
  const cells = [
    { revealed: true, flagged: false, isMine: false },
    { revealed: false, flagged: false, isMine: false },
    { revealed: false, flagged: false, isMine: false },
  ];
  const tiles = [
    { neighborIndices: [1] },
    { neighborIndices: [0, 2] },
    { neighborIndices: [1] },
  ];
  const context = { cells, tiles, state: { cells, tiles }, persist() {}, requestDraw() {}, endRun() {} };
  adapter.variant.firstResolvedDig(context);
  now = 400;
  adapter.pause();
  assert.strictEqual(adapter.exportState().remainingMs, 600);
  now = 5000;
  assert.strictEqual(adapter.exportState().remainingMs, 600);
  adapter.resume();
  now = 5599;
  assert.strictEqual(adapter.variant.tick(context).status, "waiting");
  assert.strictEqual(adapter.exportState().remainingMs, 1);
});

test("wires arrow rotation, centered dig/flag, and visibility pause through the returned API", () => {
  assert.ok(GlitchSphere && typeof GlitchSphere.boot === "function", "GlitchSphere.boot is unavailable");
  const harness = makeRoot();
  GlitchSphere.boot({ root: harness.root });
  const keydown = harness.canvasListeners.keydown;
  assert.strictEqual(typeof keydown, "function");
  const before = harness.state.targetRotY;
  keydown({ key: "ArrowRight", shiftKey: false, repeat: false, preventDefault() {} });
  assert.ok(harness.state.targetRotY > before);
  keydown({ key: "Enter", shiftKey: false, repeat: false, preventDefault() {} });
  keydown({ key: " ", shiftKey: true, repeat: false, preventDefault() {} });
  assert.deepStrictEqual(harness.calls.digs, [7]);
  assert.deepStrictEqual(harness.calls.flags, [7]);
  harness.root.document.visibilityState = "hidden";
  harness.documentListeners.visibilitychange();
  assert.strictEqual(harness.calls.pause, 1);
  harness.root.document.visibilityState = "visible";
  harness.documentListeners.visibilitychange();
  assert.strictEqual(harness.calls.resume, 1);
});

test("keeps undo paused under nested help, menu, and visibility reasons", () => {
  let now = 0;
  let undoAction = () => false;
  const harness = makeRoot({ undo: () => undoAction() });
  const result = GlitchSphere.boot({ root: harness.root, now: () => now, random: () => 0 });
  const options = harness.getBootOptions();
  assert.strictEqual(typeof options.onHelpOpen, "function");
  assert.strictEqual(typeof options.onHelpClose, "function");

  const cells = [
    { revealed: true, flagged: false, isMine: false },
    { revealed: false, flagged: false, isMine: false },
    { revealed: false, flagged: false, isMine: false },
  ];
  const tiles = [
    { neighborIndices: [1] },
    { neighborIndices: [0, 2] },
    { neighborIndices: [1] },
  ];
  const context = { cells, tiles, state: { cells, tiles }, persist() {}, requestDraw() {}, endRun() {} };
  result.adapter.variant.firstResolvedDig(context);

  now = 400;
  options.onHelpOpen();
  result.game.pauseTimer("menu");
  harness.root.document.visibilityState = "hidden";
  harness.documentListeners.visibilitychange();
  assert.strictEqual(harness.calls.pause, 1);
  assert.strictEqual(result.adapter.exportState().remainingMs, 600);
  const saved = result.adapter.variant.captureUndo(context);
  undoAction = () => {
    result.adapter.variant.restoreUndo(Object.assign({ saved }, context));
    return true;
  };
  assert.strictEqual(result.game.undo(), true);
  assert.strictEqual(harness.calls.undo, 1);
  assert.strictEqual(harness.calls.pause, 2);

  now = 5000;
  options.onHelpClose();
  result.game.resumeTimer("menu");
  assert.strictEqual(harness.calls.resume, 0);
  assert.strictEqual(result.adapter.exportState().remainingMs, 600);
  harness.root.document.visibilityState = "visible";
  harness.documentListeners.visibilitychange();
  assert.strictEqual(harness.calls.resume, 1);
  assert.strictEqual(result.adapter.exportState().remainingMs, 600);
});

test("dispatches completion locally and forwards only to an embedded same-origin parent", () => {
  assert.ok(GlitchSphere && typeof GlitchSphere.forwardCompletion === "function", "forwardCompletion is unavailable");
  const payload = { type: "hexsweeper:run-complete", runId: "run-1" };
  const sameOrigin = makeRoot({ embedded: true });
  GlitchSphere.forwardCompletion(payload, sameOrigin.root);
  assert.strictEqual(sameOrigin.dispatched.length, 1);
  assert.strictEqual(sameOrigin.dispatched[0].type, "hexsweeper:run-complete");
  assert.strictEqual(sameOrigin.dispatched[0].detail, payload);
  assert.deepStrictEqual(sameOrigin.posted, [[payload, "https://example.test"]]);

  const crossOrigin = makeRoot({ embedded: true, parentOrigin: "https://elsewhere.test" });
  GlitchSphere.forwardCompletion(payload, crossOrigin.root);
  assert.strictEqual(crossOrigin.dispatched.length, 1);
  assert.deepStrictEqual(crossOrigin.posted, []);

  const topLevel = makeRoot();
  GlitchSphere.forwardCompletion(payload, topLevel.root);
  assert.strictEqual(topLevel.dispatched.length, 1);
  assert.deepStrictEqual(topLevel.posted, []);
});

if (failures) {
  console.error(`${failures} integration test${failures === 1 ? "" : "s"} failed.`);
  process.exitCode = 1;
} else {
  console.log("All tests passed.");
}
