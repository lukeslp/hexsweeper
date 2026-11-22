#!/usr/bin/env node
// Drag contract for the sphere engines, measured in a real browser with real
// touch events on a 390x844 phone viewport: the point of the sphere under the
// finger when it lands stays under the finger for the whole drag, whatever
// the sphere's tilt and wherever the finger grabs it.
//
// How it measures: for each case the camera is set to a tilt, the finger
// lands at a grab point, and the test finds the exact sphere point under it
// by inverting the engine's own projectTile() (Gauss-Newton on the sphere
// surface, residual under 0.05 px). After the drag it projects that point
// again with the engine's camera and compares it with where the finger is.
//
// Tolerance: TOLERANCE_PX = 2. Touch coordinates are CSS pixels and may be
// rounded to the nearest half pixel at both ends of the gesture (up to about
// 0.7 px together), and faces are flat polygons on a unit sphere, so the drawn
// surface sits within 0.1 px of the sphere the test tracks at the default
// zoom. Two pixels covers both with room to spare and still fails a 1.4x
// overshoot by a factor of six on a 40 px drag.
//
// Also checked: a drag that starts just outside the rim turns the sphere and
// tracks once the finger is on it; one gesture that drags down past the pole
// and then right; a mouse drag; Invert X; a pinch zooms; a tap digs a face.
//
// Usage:
//   node tools/test-sphere-drag-browser.mjs                 # sphere/
//   node tools/test-sphere-drag-browser.mjs wheel/index.html
//   node tools/test-sphere-drag-browser.mjs sphere-reflection/index.html
//   HEXSWEEPER_DRAG_TABLE=1 ...   prints every case, not only the failures
//   HEXSWEEPER_DRAG_ONLY=tap,pinch ...   runs only those sections
//     (grid, pole, rim, mouse, invert, pinch, tap)

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { existsSync } from "node:fs";

const root = resolve(new URL("..", import.meta.url).pathname);
const pagePath = (process.argv[2] || "sphere/index.html").replace(/^\/+/, "");
const showTable = process.env.HEXSWEEPER_DRAG_TABLE === "1";
const only = (process.env.HEXSWEEPER_DRAG_ONLY || "").split(",").filter(Boolean);
const runs = (section) => !only.length || only.includes(section);
const chromePath = process.env.CHROME_PATH || [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].find((p) => existsSync(p));
const TOLERANCE_PX = 2;
const DEG = Math.PI / 180;
const TILTS = [14, 45, 70, 85, 95, 120, 180];
// Grab points: offset from the sphere's centre in sphere radii, screen
// coordinates (positive is below the centre).
const GRABS = [0.8, 0.4, 0, -0.5, -0.8];
const DRAGS = [
  { name: "right", dx: 40, dy: 0 },
  { name: "down", dx: 0, dy: 40 },
  { name: "up-right", dx: 28, dy: -28 },
];

const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, message, timeout = 20000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(80);
  }
  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ""}`);
}

function startServer() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const file = normalize(join(root, pathname.replace(/^\/+/, "")));
      if (!file.startsWith(`${root}/`)) throw new Error("outside root");
      const data = await readFile(file);
      response.writeHead(200, {
        "content-type": mime[extname(file)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(data);
    } catch (_) {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r(server)));
}

function cdp(socket) {
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: done, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else done(message.result);
  });
  return (method, params = {}) =>
    new Promise((done, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve: done, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
}

// Runs in the page. Finds the game, and offers camera, projection and
// inverse-projection helpers built only on the engine's public API.
const PAGE_HELPERS = String.raw`(() => {
  const game = [window.sphereGame, window.wheelGame, window.reflectionBaseGame]
    .concat([typeof sphereGame !== "undefined" ? sphereGame : null,
             typeof wheelGame !== "undefined" ? wheelGame : null,
             typeof reflectionBaseGame !== "undefined" ? reflectionBaseGame : null])
    .find((g) => g && typeof g.getState === "function");
  if (!game) return false;
  const h = (window.__drag = { game });
  const st = () => game.getState();
  h.setCam = (rotX, rotY) => {
    const s = st();
    s.ambientSpin = false;
    s.rotY = s.targetRotY = rotY || 0;
    s.rotX = s.targetRotX = rotX;
    if ("rotZ" in s || "targetRotZ" in s) s.rotZ = s.targetRotZ = 0;
    s.projectedCache = null;
    return h.screen();
  };
  h.screen = () => {
    const s = st();
    return { cx: s.centerX, cy: s.centerY, R: s.scale, zoom: s.zoomFactor };
  };
  h.project = (p) => {
    const s = st();
    const r = game.projectTile({ centerPoint: p, boundary: [], index: -1 }, s.rotY, s.rotX, 0);
    return { x: r.center.x, y: r.center.y, front: r.normalZ };
  };
  const norm = (v) => {
    const l = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x / l, y: v.y / l, z: v.z / l };
  };
  // The sphere point that projects to (fx, fy), searched on the unit sphere
  // from the centre of the face under the finger.
  h.grab = (fx, fy) => {
    const s = st();
    s.projectedCache = null;
    const idx = game.pickTile(fx, fy);
    if (idx < 0) return null;
    let p = norm(s.tiles[idx].centerPoint);
    for (let it = 0; it < 30; it++) {
      const a = Math.abs(p.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
      const e1 = norm({ x: p.y * a.z - p.z * a.y, y: p.z * a.x - p.x * a.z, z: p.x * a.y - p.y * a.x });
      const e2 = { x: p.y * e1.z - p.z * e1.y, y: p.z * e1.x - p.x * e1.z, z: p.x * e1.y - p.y * e1.x };
      const at = (u, v) => h.project(norm({ x: p.x + u * e1.x + v * e2.x, y: p.y + u * e1.y + v * e2.y, z: p.z + u * e1.z + v * e2.z }));
      const q0 = at(0, 0);
      const rx = fx - q0.x, ry = fy - q0.y;
      if (Math.hypot(rx, ry) < 0.01) break;
      const d = 1e-5;
      const qu = at(d, 0), qv = at(0, d);
      const j11 = (qu.x - q0.x) / d, j21 = (qu.y - q0.y) / d;
      const j12 = (qv.x - q0.x) / d, j22 = (qv.y - q0.y) / d;
      const det = j11 * j22 - j12 * j21;
      if (!det) break;
      let du = (j22 * rx - j12 * ry) / det;
      let dv = (-j21 * rx + j11 * ry) / det;
      const step = Math.hypot(du, dv);
      if (step > 0.2) { du *= 0.2 / step; dv *= 0.2 / step; }
      p = norm({ x: p.x + du * e1.x + dv * e2.x, y: p.y + du * e1.y + dv * e2.y, z: p.z + du * e1.z + dv * e2.z });
    }
    const q = h.project(p);
    return { idx, p, residual: Math.hypot(q.x - fx, q.y - fy), front: q.front };
  };
  h.faceCentre = (idx) => h.project(norm(st().tiles[idx].centerPoint));
  return true;
})()`;

let server;
let chrome;
let profile;
const failures = [];
const rows = [];

function check(ok, row) {
  rows.push(row);
  if (!ok) failures.push(row);
}

try {
  if (!chromePath) throw new Error("Chrome not found; set CHROME_PATH");
  await stat(join(root, pagePath));
  server = await startServer();
  const port = server.address().port;
  profile = await mkdtemp(join(tmpdir(), "hexsweeper-drag-"));
  chrome = spawn(chromePath, [
    "--headless=new",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    "--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: "ignore" });

  const debugPort = await waitFor(async () => {
    const raw = await readFile(join(profile, "DevToolsActivePort"), "utf8");
    return Number(raw.split("\n", 1)[0]) || 0;
  }, "Chrome did not expose DevTools");
  const target = await waitFor(async () => {
    const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    return pages.find((page) => page.type === "page" && page.webSocketDebuggerUrl);
  }, "Chrome did not create a page target");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, reject) => {
    socket.addEventListener("open", done, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const send = cdp(socket);
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      const d = result.exceptionDetails;
      throw new Error((d.exception && d.exception.description) || d.text);
    }
    return result.result.value;
  };

  await send("Network.enable");
  // Offline: no counters, fonts or textures from the network.
  await send("Network.setBlockedURLs", { urls: ["https://*"] });
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  // The Water Wheel floats: its centre bobs on the water, which moves the
  // sphere under a still finger. Reduced motion stills the bob (the drag
  // mapping does not depend on it), so the contract measures the drag alone.
  if (pagePath.startsWith("wheel/")) {
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  }
  await send("Page.enable");
  await send("Page.navigate", { url: `http://127.0.0.1:${port}/${pagePath}?welcome=0` });
  await waitFor(() => evaluate(PAGE_HELPERS), `no sphere game on ${pagePath}`);
  await waitFor(() => evaluate("__drag.game.getState().tiles && __drag.game.getState().tiles.length > 0"), "board did not build");
  await delay(600);

  const touch = (type, points) =>
    send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" || type === "touchCancel" ? [] : points.map(([x, y], i) => ({ x, y, id: i + 1 })),
    });
  // A finger path: lands on path[0], moves through the rest at about 60 Hz.
  async function fingerTo(from, to, steps = 8) {
    for (let s = 1; s <= steps; s++) {
      await touch("touchMove", [[from[0] + ((to[0] - from[0]) * s) / steps, from[1] + ((to[1] - from[1]) * s) / steps]]);
      await delay(16);
    }
    // The finger rests where it ended: Chrome can hold the last move until
    // the next input frame (seen on the Water Wheel), and a second report
    // at the same point flushes it.
    await delay(50);
    await touch("touchMove", [to]);
    await delay(50);
  }
  const err = (q, f) => Math.hypot(q.x - f[0], q.y - f[1]);
  const fmt = (n) => (n >= 0 ? " " : "") + n.toFixed(1);

  // 1. Grabbed point follows the finger: tilt x grab x direction. When the
  // finger ends past the rim the point it held has rolled over the limb and
  // cannot be under it; then it must still have moved the finger's way.
  for (const tilt of runs("grid") ? TILTS : []) {
    for (const gy of GRABS) {
      for (const drag of DRAGS) {
        const sc = await evaluate(`__drag.setCam(${tilt * DEG}, 0)`);
        await delay(20);
        const f0 = [sc.cx, sc.cy + gy * sc.R];
        const grab = await evaluate(`__drag.grab(${f0[0]}, ${f0[1]})`);
        const label = `tilt ${String(tilt).padStart(3)}°, grab ${fmt(gy)}R, ${drag.name.padEnd(8)}`;
        if (!grab || grab.residual > 0.05) {
          check(false, `${label}  could not find the sphere point under the finger`);
          continue;
        }
        const f1 = [f0[0] + drag.dx, f0[1] + drag.dy];
        await touch("touchStart", [f0]);
        await fingerTo(f0, f1);
        const q = await evaluate(`__drag.project(${JSON.stringify(grab.p)})`);
        const onSphere = await evaluate(`!!__drag.grab(${f1[0]}, ${f1[1]})`);
        await touch("touchEnd", []);
        await delay(20);
        const moved = [q.x - f0[0], q.y - f0[1]];
        const e = err(q, f1);
        const follows = moved[0] * drag.dx + moved[1] * drag.dy > 0;
        check((e <= TOLERANCE_PX || !onSphere) && follows,
          `${label}  point moved (${fmt(moved[0])}, ${fmt(moved[1])}) for finger (${drag.dx}, ${drag.dy}); ${onSphere ? `off by ${e.toFixed(1)} px` : "finger past the rim"}${follows ? "" : "  OPPOSITE"}`);
      }
    }
  }

  // 2. One gesture: drag down past the pole, then right. The point grabbed at
  // the start must still be under the finger at the end of each leg.
  if (runs("pole")) {
    const sc = await evaluate(`__drag.setCam(${45 * DEG}, 0)`);
    const f0 = [sc.cx, sc.cy - 0.74 * sc.R];
    const grab = await evaluate(`__drag.grab(${f0[0]}, ${f0[1]})`);
    const f1 = [f0[0], f0[1] + 1.28 * sc.R];
    const f2 = [f1[0] + 40, f1[1]];
    await touch("touchStart", [f0]);
    await fingerTo(f0, f1, 26);
    const mid = await evaluate(`__drag.project(${JSON.stringify(grab.p)})`);
    const tiltMid = await evaluate("__drag.game.getState().rotX / (Math.PI / 180)");
    await fingerTo(f1, f2, 8);
    const end = await evaluate(`__drag.project(${JSON.stringify(grab.p)})`);
    await touch("touchEnd", []);
    await delay(20);
    const e1 = err(mid, f1);
    const e2 = err(end, f2);
    check(e1 <= TOLERANCE_PX, `pole: down ${Math.round(f1[1] - f0[1])} px from tilt 45° (tilt now ${tiltMid.toFixed(0)}°): grabbed point off by ${e1.toFixed(1)} px`);
    check(e2 <= TOLERANCE_PX && end.x - mid.x > 0,
      `pole: then right 40 px: grabbed point moved ${fmt(end.x - mid.x)} px, off by ${e2.toFixed(1)} px${end.x - mid.x > 0 ? "" : "  OPPOSITE"}`);
  }

  // 3. A drag that lands just outside the rim turns the sphere, and the
  // surface it reaches then stays under the finger.
  if (runs("rim")) {
    const sc = await evaluate(`__drag.setCam(${14 * DEG}, 0)`);
    let edge = sc.cx;
    while (edge < sc.cx + 3 * sc.R && (await evaluate(`__drag.game.pickTile(${edge + 1}, ${sc.cy})`)) >= 0) edge += 1;
    const f0 = [edge + 12, sc.cy];
    const centre0 = await evaluate(`__drag.grab(${sc.cx}, ${sc.cy})`);
    const f1 = [edge - 30, sc.cy];
    const f2 = [edge - 70, sc.cy];
    await touch("touchStart", [f0]);
    await fingerTo(f0, f1, 10);
    const onSphere = await evaluate(`__drag.grab(${f1[0]}, ${f1[1]})`);
    const centreMid = await evaluate(`__drag.project(${JSON.stringify(centre0.p)})`);
    await fingerTo(f1, f2, 10);
    const end = await evaluate(`__drag.project(${JSON.stringify(onSphere.p)})`);
    await touch("touchEnd", []);
    await delay(20);
    const turned = centreMid.x - sc.cx;
    check(turned < -5, `rim: landing 12 px outside the rim and dragging left turns the front face left: moved ${fmt(turned)} px`);
    const e = err(end, f2);
    check(e <= TOLERANCE_PX, `rim: once on the sphere the point under the finger stays there: off by ${e.toFixed(1)} px`);

    // Landing outside the right rim and dragging down carries the right limb down.
    const sc2 = await evaluate(`__drag.setCam(${14 * DEG}, 0)`);
    const limb = await evaluate(`__drag.grab(${edge - 10}, ${sc2.cy})`);
    const g0 = [edge + 12, sc2.cy];
    await touch("touchStart", [g0]);
    await fingerTo(g0, [g0[0], g0[1] + 40]);
    const limbEnd = await evaluate(`__drag.project(${JSON.stringify(limb.p)})`);
    await touch("touchEnd", []);
    await delay(20);
    const limbDy = limbEnd.y - sc2.cy;
    check(limbDy > 5, `rim: landing outside the right rim and dragging down carries the right limb down: moved ${fmt(limbDy)} px`);
  }

  // 4. Mouse drag follows the same contract.
  if (runs("mouse")) {
    const sc = await evaluate(`__drag.setCam(${70 * DEG}, 0)`);
    const f0 = [sc.cx, sc.cy - 0.8 * sc.R];
    const grab = await evaluate(`__drag.grab(${f0[0]}, ${f0[1]})`);
    const f1 = [f0[0] + 40, f0[1]];
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: f0[0], y: f0[1], button: "left", buttons: 1, clickCount: 1 });
    for (let s = 1; s <= 8; s++) {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: f0[0] + (40 * s) / 8, y: f0[1], button: "left", buttons: 1 });
      await delay(16);
    }
    await delay(50);
    const q = await evaluate(`__drag.project(${JSON.stringify(grab.p)})`);
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: f1[0], y: f1[1], button: "left", buttons: 0, clickCount: 1 });
    await delay(20);
    const e = err(q, f1);
    check(e <= TOLERANCE_PX, `mouse: tilt 70°, grab -0.8R, right 40 px: off by ${e.toFixed(1)} px`);
  }

  // 5. Invert X mirrors the horizontal drag.
  if (runs("invert") && (await evaluate("typeof __drag.game.setInvertDragX === 'function'"))) {
    await evaluate("__drag.game.setInvertDragX(true)");
    const sc = await evaluate(`__drag.setCam(${14 * DEG}, 0)`);
    const f0 = [sc.cx, sc.cy];
    const grab = await evaluate(`__drag.grab(${f0[0]}, ${f0[1]})`);
    await touch("touchStart", [f0]);
    await fingerTo(f0, [f0[0] + 40, f0[1]]);
    const q = await evaluate(`__drag.project(${JSON.stringify(grab.p)})`);
    await touch("touchEnd", []);
    await evaluate("__drag.game.setInvertDragX(false)");
    await delay(20);
    const moved = q.x - f0[0];
    const e = Math.hypot(q.x - (f0[0] - 40), q.y - f0[1]);
    check(moved < 0 && e <= TOLERANCE_PX, `invert X: right 40 px moves the grabbed point ${fmt(moved)} px (mirror), off by ${e.toFixed(1)} px`);
  }

  // 6. A tap still digs the face under it.
  if (runs("tap")) {
    // A fresh board: on a slow software renderer an earlier drag can sit
    // past the 480 ms hold before it moves and flag the face it landed on.
    if (await evaluate("typeof __drag.game.reset === 'function'")) {
      await evaluate("__drag.game.reset()");
      await delay(300);
    }
    const sc = await evaluate(`__drag.setCam(${14 * DEG}, 0)`);
    await delay(40);
    const idx = await evaluate(`__drag.game.pickTile(${sc.cx}, ${sc.cy})`);
    await touch("touchStart", [[sc.cx, sc.cy]]);
    await delay(60);
    await touch("touchEnd", []);
    await delay(200);
    const cell = await evaluate(`(() => { const s = __drag.game.getState(); const c = s.cells[${idx}] || {}; return { revealed: !!c.revealed, flagged: !!c.flagged, over: !!s.isGameOver, flagMode: !!s.flagMode }; })()`);
    check(cell.revealed, `tap: a touch tap on the front face digs it: ${cell.revealed ? "dug" : `not dug (${JSON.stringify(cell)})`}`);
  }

  // 7. A pinch zooms (last: it leaves the zoom changed).
  if (runs("pinch")) {
    const sc = await evaluate(`__drag.setCam(${14 * DEG}, 0)`);
    const z0 = sc.zoom;
    const a0 = [sc.cx - 40, sc.cy], b0 = [sc.cx + 40, sc.cy];
    await touch("touchStart", [a0, b0]);
    for (let s = 1; s <= 8; s++) {
      await touch("touchMove", [[a0[0] - (30 * s) / 8, a0[1]], [b0[0] + (30 * s) / 8, b0[1]]]);
      await delay(16);
    }
    await touch("touchEnd", []);
    await delay(40);
    const z1 = (await evaluate("__drag.screen()")).zoom;
    check(z1 > z0 * 1.3, `pinch: spreading two fingers from 80 to 140 px zooms ${z0.toFixed(2)} -> ${z1.toFixed(2)}`);
  }

  const passed = rows.length - failures.length;
  console.log(`${pagePath}: ${passed}/${rows.length} drag checks pass (tolerance ${TOLERANCE_PX} px)`);
  for (const row of showTable ? rows : failures) console.log(`${failures.includes(row) ? "FAIL" : "ok  "}  ${row}`);
  assert.equal(failures.length, 0, `${failures.length} drag checks failed on ${pagePath}`);
} finally {
  if (chrome) chrome.kill("SIGTERM");
  if (server) server.close();
  await delay(300);
  if (profile) await rm(profile, { recursive: true, force: true });
}
