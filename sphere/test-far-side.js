#!/usr/bin/env node
"use strict";

// The far side of the sphere stays hidden in the reflection themes.
//
// The camera is a perspective eye 2.8 radii out, so faces with a normal z
// between about -0.05 and 0.36 are projected but lie behind the horizon:
// their outlines fold back inside the silhouette, wound the other way. The
// painter draws them first and lets the faces in front cover them. In Light
// and Dark that works, because a covered face is opaque. The reflection
// themes paint covered faces at a few percent opacity over the WebGL mirror,
// so the far side showed through the rim: its wells and counts, and at the
// end of a run every mine it held, over rim faces that a tap reaches instead.
//
// Second, the Android shader's field behind the orb: it sampled the theme's
// photograph at screen coordinates, so the picture itself showed behind the
// sphere at the canvas's reduced resolution.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Hexasphere = require("./hexasphere.js");

const sphereSource = fs.readFileSync(path.join(__dirname, "sphere.js"), "utf8");
const mirrorSource = fs.readFileSync(path.join(__dirname, "mirror-material.js"), "utf8");

/** A 2D context that keeps every filled path, so a test can read its outline. */
function recordingContext(fills) {
  let subpaths = [];
  let current = null;
  const gradient = { addColorStop() {} };
  const own = {
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    createPattern: () => ({}),
    measureText: () => ({ width: 0 }),
    getLineDash: () => [],
    beginPath() { subpaths = []; current = null; },
    moveTo(x, y) { current = { points: [[x, y]], curved: false }; subpaths.push(current); },
    lineTo(x, y) { if (current) current.points.push([x, y]); },
    arc() { if (current) current.curved = true; else subpaths.push((current = { points: [], curved: true })); },
    ellipse() { if (current) current.curved = true; else subpaths.push((current = { points: [], curved: true })); },
    quadraticCurveTo() { if (current) current.curved = true; },
    bezierCurveTo() { if (current) current.curved = true; },
    closePath() {},
    fill() { fills.push(subpaths.map((s) => ({ points: s.points.slice(), curved: s.curved }))); },
  };
  return new Proxy(own, {
    get(target, property) {
      if (property in target) return target[property];
      return () => {};
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  });
}

function boot(themeId) {
  const fills = [];
  const context = recordingContext(fills);
  const canvas = {
    clientWidth: 412,
    clientHeight: 860,
    width: 412,
    height: 860,
    style: {},
    getContext: () => context,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 412, height: 860 }),
    addEventListener() {},
    dispatchEvent() {},
  };
  const frames = [];
  let clock = 1000;
  const noop = () => {};
  const classList = { add: noop, remove: noop, toggle: noop, contains: () => false };
  const element = () => ({ hidden: true, classList, textContent: "", style: {}, dataset: {}, setAttribute: noop, addEventListener: noop, querySelector: () => null });
  const elements = { "sphere-banner": element(), "banner-msg": element() };
  const memory = () => {
    const values = new Map();
    return { getItem: (k) => (values.has(k) ? values.get(k) : null), setItem: (k, v) => values.set(k, String(v)), removeItem: (k) => values.delete(k) };
  };
  const document = {
    visibilityState: "visible",
    hidden: false,
    documentElement: { setAttribute: noop, dataset: {} },
    body: { dataset: {}, classList, appendChild: noop },
    activeElement: null,
    getElementById: (id) => (id === "gameCanvas" ? canvas : elements[id] || null),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: noop,
    createElement: () => element(),
  };
  const sandbox = {
    console,
    document,
    localStorage: memory(),
    sessionStorage: memory(),
    location: { search: "?fresh=1&welcome=0", pathname: "/sphere/", href: "https://example.test/sphere/" },
    navigator: { userAgent: "Mozilla/5.0 (Linux; Android 15) Chrome/148.0.0.0 Mobile Safari/537.36" },
    performance: { now: () => clock },
    requestAnimationFrame(callback) { frames.push(callback); return frames.length; },
    cancelAnimationFrame: noop,
    setInterval: () => 1,
    clearInterval: noop,
    setTimeout: () => 1,
    clearTimeout: noop,
    queueMicrotask: noop,
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
    URL,
    URLSearchParams,
    Uint8Array,
    Float32Array,
    Set,
    Map,
    Date,
    // Seeded, so the board repeats; reduced motion, so the end of a run lands in one frame.
    Math: Object.assign(Object.create(Math), { random: (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })() }),
    Hexasphere,
    matchMedia: (query) => ({ matches: /reduce/.test(query), addEventListener: noop, removeEventListener: noop }),
    addEventListener: noop,
    removeEventListener: noop,
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    getSelection: () => ({ isCollapsed: true, removeAllRanges: noop }),
    devicePixelRatio: 2.625,
    innerWidth: 412,
    innerHeight: 860,
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(sphereSource, sandbox, { filename: "sphere.js" });
  const api = sandbox.SphereSweeper.boot({ canvasId: "gameCanvas", autoWelcome: false });
  const themes = sandbox.SphereSweeper.THEMES;
  api.setSize("medium");
  api.setThemeIndex(themes.findIndex((t) => t.id === themeId));
  const state = api.getState();
  const paint = () => {
    clock += 50;
    fills.length = 0;
    state.projectedCache = null;
    const frame = frames.shift();
    if (frame) frame(clock);
    else throw new Error("no frame was scheduled");
    assert.ok(!state.drawErrorReported, `${themeId}: the painter threw`);
    return fills.slice();
  };
  return { api, state, paint, theme: themes.find((t) => t.id === themeId) };
}

/** Shoelace sum in canvas coordinates: faces toward the eye are negative. */
function twiceArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    sum += ax * by - bx * ay;
  }
  return sum;
}

/** Filled face outlines (one plain five- or six-sided path) wound away from the eye. */
function farSideFaces(fills) {
  return fills.filter((subpaths) =>
    subpaths.length === 1 &&
    !subpaths[0].curved &&
    (subpaths[0].points.length === 5 || subpaths[0].points.length === 6) &&
    twiceArea(subpaths[0].points) > 1e-6
  ).length;
}

/** Deal a medium board, dig the face in front, then detonate a mine: every mine opens. */
function lostRun(themeId) {
  const run = boot(themeId);
  const { api, state } = run;
  state.ambientSpin = false;
  state.rotY = state.targetRotY = -0.35;
  state.rotX = state.targetRotX = 0.42;
  const byDepth = state.tiles
    .map((tile, index) => ({ index, z: api.projectTile(tile, state.rotY, state.rotX).normalZ }))
    .sort((a, b) => b.z - a.z);
  api.digAt(byDepth[0].index);
  const mine = byDepth.find(({ index }) => state.cells[index].isMine);
  api.digAt(mine.index);
  assert.ok(state.isGameOver && !state.won, `${themeId}: the run did not end in a loss`);
  return run;
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

console.log("far side and Android backdrop");

test("the detector sees the far side where the crust is opaque (Light)", () => {
  const run = lostRun("light");
  assert.ok(!run.theme.reflectionSurface);
  const fills = run.paint();
  assert.ok(fills.length > 500, `only ${fills.length} fills recorded`);
  assert.ok(farSideFaces(fills) > 20, `expected far-side faces under Light's opaque crust, saw ${farSideFaces(fills)}`);
});

for (const themeId of ["galaxy", "mercury", "aurora", "ion-storm", "heat-lightning"]) {
  test(`${themeId}: no face behind the horizon is painted at the end of a lost run`, () => {
    const run = lostRun(themeId);
    assert.ok(run.theme.reflectionSurface, `${themeId} is not a reflection theme`);
    const fills = run.paint();
    assert.ok(fills.length > 200, `only ${fills.length} fills recorded`);
    assert.strictEqual(farSideFaces(fills), 0, `${themeId}: ${farSideFaces(fills)} faces from behind the horizon were painted`);
  });
}

test("galaxy: the faces in front still paint, mines and counts included", () => {
  const run = lostRun("galaxy");
  const { api, state } = run;
  const facing = state.tiles.filter((tile) => {
    const p = api.projectTile(tile, state.rotY, state.rotX);
    return twiceArea(p.boundary.map((q) => [q.x, q.y])) < 0;
  }).length;
  const painted = run.paint().filter((subpaths) =>
    subpaths.length === 1 && !subpaths[0].curved &&
    (subpaths[0].points.length === 5 || subpaths[0].points.length === 6) &&
    twiceArea(subpaths[0].points) < 0
  ).length;
  assert.ok(painted >= facing, `${painted} face fills for ${facing} faces toward the eye`);
});

test("Android shader: the field behind the orb never samples the photograph at screen coordinates", () => {
  const start = mirrorSource.indexOf("const ANDROID_FRAGMENT_SOURCE = `");
  assert.ok(start >= 0, "ANDROID_FRAGMENT_SOURCE not found");
  const shader = mirrorSource.slice(start, mirrorSource.indexOf("`;", start));
  const main = shader.slice(shader.indexOf("void main()"));
  assert.ok(!/plate\(\s*vec2\(\s*screenUv/.test(main), "main() still paints plate(screenUv), the photograph itself, behind the orb");
  assert.match(main, /vec3 backdrop = backdropTone\(/);
  const tone = shader.slice(shader.indexOf("vec3 backdropTone("), shader.indexOf("vec2 sphereUv("));
  assert.match(tone, /textureLod\(uEnvironmentMap, vec2\(0\.5\), \d+\.0\)/, "backdropTone should read only the photograph's last mip level");
  assert.ok(!/\btexture\(uEnvironmentMap/.test(tone), "backdropTone samples the photograph at full detail");
});

if (failures) {
  console.error(`${failures} far-side test(s) failed`);
  process.exit(1);
}
console.log("far-side tests passed");
