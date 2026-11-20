#!/usr/bin/env node
// Drag-frame timing for the app payload under an Android phone profile.
// Loads a payload folder, starts a board, digs and flags a spread of faces so
// the frame has depth tiers and counts, then drags the sphere with touch input
// for a few seconds and reports frames per second and per-frame paint time.
//   node tools/perf-android-drag.mjs <payload dir> [cpu throttle] [sizes] [themes]
// e.g. node tools/perf-android-drag.mjs build/app 4 medium,xlarge light,dark
// Needs Chrome for Testing and playwright-core (paths below, overridable).

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE ||
  "/Users/luke/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core");
const CHROME = process.env.PW_CHROME ||
  "/Users/luke/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const root = resolve(process.argv[2] || "build/app");
const throttle = Number(process.argv[3] || 4);
const sizes = (process.argv[4] || "medium,xlarge").split(",");
const themes = (process.argv[5] || "light").split(",");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".webp": "image/webp" };

const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = normalize(join(root, p === "/" ? "index.html" : p.replace(/^\/+/, "")));
    if (!file.startsWith(root)) throw 0;
    const data = await readFile(file);
    res.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch (_) { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/index.html?welcome=0`;

const browser = await chromium.launch({ executablePath: CHROME, args: ["--enable-gpu-rasterization", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({
  viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, hasTouch: true, isMobile: true,
  userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36",
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(url);
await page.waitForFunction(() => window.HEXSWEEPER_SPHERE_GAME && window.SphereSweeper);
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });

async function touchDrag(ms) {
  const box = await page.evaluate(() => { const s = window.HEXSWEEPER_SPHERE_GAME.getSphereScreen(); return s; });
  const x0 = box.cx - box.r * 0.4, y0 = box.cy;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < ms) {
    i++;
    const a = i * 0.08;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + Math.sin(a) * box.r * 0.6, y: y0 + Math.cos(a * 0.7) * box.r * 0.3 }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

const rows = [];
for (const size of sizes) {
  for (const theme of themes) {
    await page.evaluate(({ size, theme }) => {
      const G = window.HEXSWEEPER_SPHERE_GAME;
      const i = window.SphereSweeper.THEMES.findIndex((t) => t.id === theme);
      if (i >= 0) G.setThemeIndex(i);
      G.setSize(size);
      G.reset();
      const s = G.getState();
      // A first dig floods an opening; then dig and flag a spread of safe and
      // mined faces so depth tiers and counts cover much of the sphere.
      G.digAt(0);
      let dug = 0, flagged = 0;
      for (let k = 0; k < s.cells.length; k += 3) {
        const c = s.cells[k];
        if (c.revealed) continue;
        if (c.isMine) { if (flagged < s.mineCount * 0.6) { G.flagAt(k); flagged++; } }
        else if (dug < s.cells.length * 0.25) { G.digAt(k); dug++; }
      }
      s.ambientSpin = false;
    }, { size, theme });
    await page.waitForTimeout(800);
    // Frame instrumentation: count animation frames and time spent in them.
    await page.evaluate(() => {
      window.__f = { n: 0, t: [], start: performance.now() };
      const raf = window.requestAnimationFrame.bind(window);
      if (!window.__wrapped) {
        window.__wrapped = true;
        window.requestAnimationFrame = (cb) => raf((ts) => {
          const a = performance.now();
          cb(ts);
          const f = window.__f;
          if (f) { f.n++; f.t.push(performance.now() - a); }
        });
      }
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => { window.__f = { n: 0, t: [], start: performance.now() }; });
    if (process.env.PROFILE) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 }); await cdp.send("Profiler.start"); }
    await touchDrag(3000);
    if (process.env.PROFILE) {
      const { profile } = await cdp.send("Profiler.stop");
      const self = new Map(), byId = new Map(profile.nodes.map((n) => [n.id, n]));
      const counts = new Map();
      for (const id of profile.samples) counts.set(id, (counts.get(id) || 0) + 1);
      let total = 0;
      for (const [id, c] of counts) { const n = byId.get(id); const k = `${n.callFrame.functionName || "(anon)"}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) || 0) + c); total += c; }
      const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 22).map(([k, c]) => `${(100 * c / total).toFixed(1)}% ${k}`);
      console.error(`--- ${size} ${theme} self-time top:\n` + top.join("\n"));
    }
    const r = await page.evaluate(() => {
      const f = window.__f, el = (performance.now() - f.start) / 1000;
      const t = f.t.slice().sort((a, b) => a - b);
      const s = window.HEXSWEEPER_SPHERE_GAME.getState();
      return {
        fps: +(f.n / el).toFixed(1),
        p50: +(t[Math.floor(t.length * 0.5)] || 0).toFixed(1),
        p90: +(t[Math.floor(t.length * 0.9)] || 0).toFixed(1),
        revealed: s.cells.filter((c) => c.revealed).length,
        flags: s.flagsPlaced,
        over: s.isGameOver,
        faces: s.cells.length,
        light: [...(s.lightMotionFaces || [])], gaps: (window.__gaps || []).slice(-12), ngaps: (window.__gaps || []).length,
      };
    });
    rows.push({ size, theme, ...r });
    await page.evaluate(() => { window.__f = null; });
  }
}
console.log(JSON.stringify({ root, throttle, rows, errors: errors.slice(0, 3) }, null, 1));
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
await browser.close();
server.close();
