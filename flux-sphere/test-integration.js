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

function tile(x, y, z) {
  return {
    centerPoint: { x, y, z },
    neighborIndices: [],
  };
}

function makeContext(overrides) {
  const cells = [
    cell({ revealed: true }),
    cell(),
    cell(),
    cell({ isMine: true }),
  ];
  const tiles = [
    tile(0, 1, 0),
    tile(1, 0, 0),
    tile(-1, 0, 0),
    tile(0, -1, 0),
  ];
  const calls = { resolveLinkedFaces: [], persisted: 0, draws: 0 };
  const context = Object.assign({
    cells,
    tiles,
    state: { cells, tiles, isGameOver: false, won: false, reduceMotion: false },
    now: 100,
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
    initHexBloom(received) {
      assert.strictEqual(received, game);
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

test("documents trace-then-commit pairs, linked glyphs, grounded flags, and reduced motion", () => {
  assert.match(html, /(trace|select)[^<.]*(pair|link)|pair[^<.]*(trace|select)/i);
  assert.match(html, /(again|second)[^<.]*(open|commit|dig)|commit[^<.]*both/i);
  assert.match(html, /either endpoint[^<.]*mine|mine[^<.]*either endpoint/i);
  assert.match(html, /flagged[^<.]*(held|hold)|held[^<.]*flag/i);
  assert.match(html, /(linked glyph|chain glyph|↔)/i);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
  assert.match(css, /animation[^;]*none|transition[^;]*none/i);
  assert.match(adapterSource, /reduceMotion/);
});

test("traces a distant pair before committing one atomic linked reveal", () => {
  assert.ok(FluxSphere && typeof FluxSphere.createAdapter === "function");
  const status = { textContent: "" };
  const adapter = FluxSphere.createAdapter({ statusElement: status, schedule: (callback) => callback() });
  const { context, cells, calls } = makeContext();
  const activated = adapter.variant.firstResolvedDig(context);
  assert.deepStrictEqual(activated, { status: "active", pairCount: 1, unpairedCount: 1 });
  assert.match(status.textContent, /linked 1 distant pair/i);

  const trace = adapter.variant.admitReveal(Object.assign({ index: 1, source: "direct" }, context));
  assert.deepStrictEqual(trace, { allowed: false, status: "traced", from: 1, partner: 2 });
  assert.match(status.textContent, /trace|linked/i);
  assert.strictEqual(adapter.variant.admitReveal(Object.assign({ index: 1, source: "direct" }, context)), true);
  cells[1].revealed = true;
  const result = adapter.variant.reveal(Object.assign({
    index: 1,
    source: "direct",
    revealed: [1],
  }, context));
  assert.deepStrictEqual(calls.resolveLinkedFaces, [[2]]);
  assert.deepStrictEqual(result, { status: "echoed", from: 1, partner: 2, opened: [2] });
  assert.strictEqual(cells[2].revealed, true);
  assert.match(status.textContent, /echo opened a linked face/i);
});

test("a linked mine detonates while a flagged endpoint grounds the echo", () => {
  const status = { textContent: "" };
  const adapter = FluxSphere.createAdapter({ statusElement: status });
  const first = makeContext();
  first.cells[1].revealed = true;
  adapter.variant.firstResolvedDig(first.context);
  adapter.variant.admitReveal(Object.assign({ index: 2, source: "direct" }, first.context));
  adapter.variant.admitReveal(Object.assign({ index: 2, source: "direct" }, first.context));
  first.cells[2].revealed = true;
  assert.deepStrictEqual(adapter.variant.reveal(Object.assign({
    index: 2,
    source: "direct",
    revealed: [2],
  }, first.context)), { status: "detonated", from: 2, partner: 3, opened: [3], detonated: 3 });
  assert.deepStrictEqual(first.calls.resolveLinkedFaces, [[3]]);

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
  assert.deepStrictEqual(held.calls.resolveLinkedFaces, []);
  assert.match(status.textContent, /flagged[^.]*held|held[^.]*flagged/i);
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

test("round-trips pair state and regenerates pairs for first-dig undo", () => {
  const adapter = FluxSphere.createAdapter();
  const first = makeContext();
  adapter.variant.firstResolvedDig(first.context);
  adapter.variant.admitReveal(Object.assign({ index: 1, source: "direct" }, first.context));
  const saved = adapter.variant.exportState();
  assert.deepStrictEqual(saved, {
    pairs: { v: 2, active: true, pairFor: [-1, 2, 1, -1] },
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
  assert.ok(harness.state.targetRotY > before);
  assert.deepStrictEqual(harness.calls.digs, [5]);
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
