#!/usr/bin/env node
"use strict";

// Frame-loop lifecycle of the WebGL reflection renderer (sphere/mirror-material.js).
// Sphere stops the renderer and hides its canvas on plain themes. Returning to
// the page must not restart it: before this guard, one trip to the background
// left it drawing into the hidden canvas at its usual frame rate for the rest
// of the session. A running loop still pauses while hidden and resumes on return.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.join(__dirname, "mirror-material.js"), "utf8");

/** A WebGL2 stand-in: every call succeeds, every query reports success. */
function fakeGl() {
  return new Proxy({}, {
    get(target, property) {
      if (property === "isContextLost") return () => false;
      if (property === "getAttribLocation") return () => 0;
      if (typeof property === "string" && /^[A-Z0-9_]+$/.test(property)) return 1;
      return () => ({});
    },
  });
}

function createHarness() {
  const frames = new Map();
  let nextFrame = 1;
  const documentListeners = Object.create(null);
  const classes = new Set();
  const gl = fakeGl();
  const canvas = {
    clientWidth: 400,
    clientHeight: 800,
    width: 0,
    height: 0,
    style: {},
    setAttribute() {},
    addEventListener() {},
    getContext: (type) => (type === "webgl2" ? gl : null),
  };
  const document = {
    hidden: false,
    body: {
      dataset: {},
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
      },
    },
    documentElement: { dataset: {} },
    getElementById: (id) => (id === "reflectionCanvas" ? canvas : null),
    addEventListener(type, listener) {
      (documentListeners[type] = documentListeners[type] || []).push(listener);
    },
    dispatchEvent() {},
  };
  const sandbox = {
    console,
    document,
    location: { search: "" },
    navigator: { userAgent: "test" },
    localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false }),
    performance: { now: () => 0 },
    requestAnimationFrame(callback) {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    addEventListener() {},
    setTimeout: () => 0,
    clearTimeout() {},
    innerWidth: 400,
    innerHeight: 800,
    devicePixelRatio: 2,
    Float32Array,
    Uint8Array,
    URL,
    URLSearchParams,
    CustomEvent: function CustomEvent(type, init) {
      this.type = type;
      this.detail = init && init.detail;
    },
    Image: function Image() {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "mirror-material.js" });
  const material = sandbox.MirrorMaterial.boot({ canvasId: "reflectionCanvas", material: "mercury", persist: false });
  material.attach({
    getState: () => ({ rotY: 0, rotX: 0, cells: [], isGameOver: false }),
    projectTile: () => null,
    getSphereScreen: () => ({ cx: 200, cy: 400, r: 150 }),
  });
  return {
    material,
    pending: () => frames.size,
    runFrames(count) {
      for (let i = 0; i < count; i++) {
        const [id, callback] = frames.entries().next().value || [];
        if (!callback) return;
        frames.delete(id);
        callback(16 * (i + 1));
      }
    },
    setVisible(visible) {
      document.hidden = !visible;
      for (const listener of documentListeners.visibilitychange || []) listener();
    },
  };
}

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

console.log("Reflection renderer frame-loop tests…");

test("a running loop keeps one frame queued", () => {
  const h = createHarness();
  assert.strictEqual(h.material.failed, false, "renderer fell back without WebGL");
  assert.strictEqual(h.pending(), 1);
  h.runFrames(5);
  assert.strictEqual(h.pending(), 1);
});

test("a running loop pauses while hidden and resumes on return", () => {
  const h = createHarness();
  h.setVisible(false);
  assert.strictEqual(h.pending(), 0);
  h.setVisible(true);
  assert.strictEqual(h.pending(), 1);
});

test("a stopped renderer stays stopped across background and foreground", () => {
  const h = createHarness();
  h.material.stop(); // what Sphere does when a plain theme is chosen
  assert.strictEqual(h.pending(), 0);
  for (let i = 0; i < 3; i++) {
    h.setVisible(false);
    h.setVisible(true);
  }
  assert.strictEqual(h.pending(), 0, "the hidden renderer restarted itself");
  h.material.start(); // a reflection theme again
  assert.strictEqual(h.pending(), 1);
});

test("a renderer started while the page is hidden begins once it is shown", () => {
  const h = createHarness();
  h.material.stop();
  h.setVisible(false);
  h.material.start();
  assert.strictEqual(h.pending(), 0);
  h.setVisible(true);
  assert.strictEqual(h.pending(), 1);
});

if (failures) {
  console.error(`${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All tests passed.");
