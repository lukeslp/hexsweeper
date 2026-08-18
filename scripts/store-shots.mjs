#!/usr/bin/env node
// Capture App Store screenshots from the sealed payload (www/index.html) as
// real device-size frames: headless Chrome with SwiftShader WebGL, device
// metrics per family, a seeded mid-game state, one theme per shot. Output is
// raw PNGs; scripts/generate-store-screenshots.py adds the caption band.
//
//   node scripts/store-shots.mjs iphone out/dir     # 1320×2868 (6.9")
//   node scripts/store-shots.mjs ipad   out/dir     # 2064×2752 (13")

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";

const family = process.argv[2] || "iphone";
const outDir = resolve(process.argv[3] || "build/store-shots");
const root = resolve("www");
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DEVICES = {
  iphone: { width: 440, height: 956, dpr: 3 },
  ipad: { width: 1032, height: 1376, dpr: 2 },
};
const device = DEVICES[family];
if (!device) throw new Error(`unknown family ${family}`);

// theme, seed, reveal fraction, flags, rotation, extras
export const SHOTS = [
  { file: "01-mercury", theme: "mercury", seed: 24601, reveal: 0.55, flags: 2, rotY: -0.35, rotX: 0.42 },
  { file: "02-stratosphere", theme: "stratosphere", seed: 7,  reveal: 0.5,  flags: 1, rotY: 0.6,  rotX: 0.3 },
  { file: "03-flower", theme: "light", seed: 99, reveal: 0.45, flags: 1, rotY: 0.2, rotX: 0.35, flower: true },
  { file: "04-ion-storm", theme: "ion-storm", seed: 313, reveal: 0.5, flags: 3, rotY: -0.8, rotX: 0.25 },
  { file: "05-heat-lightning", theme: "heat-lightning", seed: 1201, reveal: 0.5, flags: 2, rotY: 0.9, rotX: 0.4 },
  { file: "06-dark", theme: "dark", seed: 4242, reveal: 0.55, flags: 2, rotY: -0.2, rotX: 0.3 },
];

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, message, timeout = 20000) {
  const deadline = Date.now() + timeout; let last;
  while (Date.now() < deadline) { try { const v = await fn(); if (v) return v; } catch (e) { last = e; } await delay(60); }
  throw new Error(message + (last ? `: ${last.message}` : ""));
}
const mime = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".js": "text/javascript", ".css": "text/css" };
async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      const file = normalize(join(root, p === "/" ? "index.html" : p.replace(/^\/+/, "")));
      if (!file.startsWith(root)) throw new Error("outside");
      const data = await readFile(file);
      res.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream" });
      res.end(data);
    } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return server;
}

const server = await serve();
const port = server.address().port;
const profile = await mkdtemp(join(tmpdir(), "hex-store-"));
await mkdir(outDir, { recursive: true });
const chrome = spawn(chromePath, [
  "--headless=new", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
  `--window-size=${device.width},${device.height}`, `http://127.0.0.1:${port}/index.html?welcome=0&fresh=1`,
], { stdio: "ignore" });
try {
  const debugPort = await waitFor(async () => Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n", 1)[0]) || 0, "no devtools port");
  const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find((p) => p.type === "page" && p.webSocketDebuggerUrl), "no page");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { socket.addEventListener("open", res, { once: true }); socket.addEventListener("error", rej, { once: true }); });
  let id = 0; const pending = new Map();
  socket.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (!m.id || !pending.has(m.id)) return; const { resolve: ok, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : ok(m.result); });
  const send = (method, params = {}) => new Promise((ok, reject) => { const n = ++id; pending.set(n, { resolve: ok, reject }); socket.send(JSON.stringify({ id: n, method, params })); });
  const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text); return r.result.value; };
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: device.width, height: device.height, deviceScaleFactor: device.dpr, mobile: family === "iphone" });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await send("Page.reload", { ignoreCache: true });
  await waitFor(() => ev('document.readyState === "complete" && !!window.HEXSWEEPER_SPHERE_GAME'), "sphere did not boot");
  await delay(500);
  // Toasts and live regions are transient chrome; keep them out of stills.
  await ev('(() => { const st = document.createElement("style"); st.textContent = "#count-style-toast,.count-style-toast,.hex-bloom-live,.hex-bloom-tooltip{display:none !important}"; document.head.appendChild(st); })()');

  for (const shot of SHOTS) {
    await ev(`(() => {
      const g = window.HEXSWEEPER_SPHERE_GAME;
      g.reset();
      g.setThemeIndex(SphereSweeper.THEMES.findIndex(t => t.id === ${JSON.stringify(shot.theme)}));
      const st = g.getState();
      st.ambientSpin = false;
      st.rotY = ${shot.rotY}; st.targetRotY = ${shot.rotY}; st.rotX = ${shot.rotX}; st.targetRotX = ${shot.rotX};
      let seed = ${shot.seed};
      const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      const cells = st.cells, tiles = st.tiles;
      const target = g.mineTargetForDifficulty(st.difficulty) || Math.round(cells.length * 0.12);
      let placed = 0, guard = 0;
      while (placed < target && guard++ < 50000) { const m = Math.floor(rnd() * cells.length); if (!cells[m].isMine) { cells[m].isMine = true; placed++; } }
      for (let i = 0; i < cells.length; i++) { let n = 0; for (const k of (tiles[i].neighborIndices || [])) if (cells[k].isMine) n++; cells[i].neighborMines = n; }
      // Reveal a connected patch from the front face so the dig reads as one excavation.
      const front = g.pickTile(g.getSphereScreen().cx, g.getSphereScreen().cy);
      const seen = new Set([front]); const queue = [front];
      const wanted = Math.round(cells.length * ${shot.reveal});
      while (queue.length && seen.size < wanted) {
        const i = queue.shift();
        for (const k of (tiles[i].neighborIndices || [])) { if (!seen.has(k) && !cells[k].isMine && rnd() < 0.86) { seen.add(k); queue.push(k); } }
      }
      for (const i of seen) { const c = cells[i]; if (c.isMine) continue; c.revealed = true; c.animReveal = 1; c.visualDue = 0; c.pulseAt = -1e9; c.endFlash = 0; }
      let flags = 0;
      for (let i = 0; i < cells.length && flags < ${shot.flags}; i++) {
        const c = cells[i];
        if (!c.isMine || c.revealed) continue;
        const nb = (tiles[i].neighborIndices || []);
        if (nb.some(k => cells[k].revealed)) { c.flagged = true; flags++; }
      }
      st.flagsPlaced = flags;
      st.isFirstClick = false;
      st.mineCount = target;
      g.setThemeIndex(g.getThemeIndex()); // repaint
      return { revealed: seen.size, flags };
    })()`);
    await delay(1400);
    if (shot.flower) {
      // Settings sheet open over the board.
      await ev('document.getElementById("qc-help").click()');
      await waitFor(() => ev('!document.getElementById("help-overlay").hidden && document.getElementById("help-overlay").classList.contains("open")'), "settings sheet");
      await delay(500);
    }
    const png = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(join(outDir, `${shot.file}.png`), Buffer.from(png.data, "base64"));
    console.log(`shot ${shot.file} (${shot.theme})`);
    if (shot.flower) { await ev('document.getElementById("help-done-btn").click()'); await delay(400); }
  }
  socket.close();
} finally {
  chrome.kill("SIGTERM");
  await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  server.close();
}
