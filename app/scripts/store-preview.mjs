#!/usr/bin/env node
// App Preview renderer: drives the sealed sphere payload in headless Chrome at
// App Store preview metrics (iPhone 6.9" 886x1920, iPad 13" 1200x1600), plays a
// scripted 24-second timeline (digs, a flag, theme changes, slow spins), records
// the DevTools screencast, and stitches an H.264 MP4 with ffmpeg.
//   node scripts/store-preview.mjs iphone out/dir   → out/dir/preview-iphone.mp4
//   node scripts/store-preview.mjs ipad out/dir     → out/dir/preview-ipad.mp4
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve, normalize, extname } from "node:path";
import { tmpdir } from "node:os";
import { spawn, execFileSync } from "node:child_process";

const family = process.argv[2] || "iphone";
const outDir = resolve(process.argv[3] || "build/store-preview");
const root = resolve("www");
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DEVICES = {
  iphone: { width: 443, height: 960, dpr: 2, out: "886x1920" },
  ipad: { width: 600, height: 800, dpr: 2, out: "1200x1600" },
};
const device = DEVICES[family];
if (!device) { console.error("family must be iphone or ipad"); process.exit(2); }
const FPS = 30;
// --dpr=N overrides the capture scale (default 2 = native). Software GL renders
// a 2x iPhone frame at ~14 fps; 1.5 or 1 trades sharpness for smoother motion
// and is upscaled to the store size by ffmpeg.
const dprArg = process.argv.find((a) => a.startsWith("--dpr="));
// Frames before the mirror material has booted show a flat wireframe; skip them.
const LEAD_MS = 3500;
// Software GL cannot paint 30 fps at store size, so the timeline runs slowed by
// SLOWMO and the capture is sped back up: every 1/30 s of the final cut is a
// real painted frame. Reveal animations play SLOWMO× faster as a result.
const slowArg = process.argv.find((a) => a.startsWith("--slowmo="));
const SLOWMO = slowArg ? Number(slowArg.split("=")[1]) || 2.5 : 2.5;
const DURATION_MS = 24000 * SLOWMO + 3500; // 24 s of footage after the lead-in, slowed
if (dprArg) device.dpr = Number(dprArg.split("=")[1]) || device.dpr;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, what, timeout = 30000) {
  const deadline = Date.now() + timeout; let last;
  while (Date.now() < deadline) { try { const v = await fn(); if (v) return v; } catch (e) { last = e; } await delay(60); }
  throw new Error(`timeout: ${what}${last ? ` (${last.message})` : ""}`);
}
const mime = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".js": "text/javascript", ".css": "text/css" };
async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      const file = normalize(join(root, p === "/" ? "index.html" : p.replace(/^\/+/, "")));
      if (!file.startsWith(root)) throw new Error("outside root");
      const data = await readFile(file);
      res.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream" }); res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return server;
}

// The in-page timeline. Runs on the game's own clock so digs, flags and theme
// changes animate exactly as they do for a player; the driver only spins.
const TIMELINE = `
(() => {
  const g = window.HEXSWEEPER_SPHERE_GAME;
  const themeIndex = (id) => SphereSweeper.THEMES.findIndex(t => t.id === id);
  g.reset();
  g.setThemeIndex(themeIndex("mercury"));
  const st = g.getState();
  st.ambientSpin = false;
  let seed = 8675309;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const cells = st.cells, tiles = st.tiles;
  const target = g.mineTargetForDifficulty(st.difficulty) || Math.round(cells.length * 0.12);
  let placed = 0, guard = 0;
  while (placed < target && guard++ < 50000) { const m = Math.floor(rnd() * cells.length); if (!cells[m].isMine) { cells[m].isMine = true; placed++; } }
  for (let i = 0; i < cells.length; i++) { let n = 0; for (const k of (tiles[i].neighborIndices || [])) if (cells[k].isMine) n++; cells[i].neighborMines = n; }
  // A modest opening patch so the first dig grows something visible.
  const front = g.pickTile(g.getSphereScreen().cx, g.getSphereScreen().cy);
  const seen = new Set([front]); const queue = [front];
  while (queue.length && seen.size < Math.round(cells.length * 0.18)) {
    const i = queue.shift();
    for (const k of (tiles[i].neighborIndices || [])) { if (!seen.has(k) && !cells[k].isMine && rnd() < 0.86) { seen.add(k); queue.push(k); } }
  }
  for (const i of seen) { const c = cells[i]; if (c.isMine) continue; c.revealed = true; c.animReveal = 1; c.visualDue = 0; c.pulseAt = -1e9; c.endFlash = 0; }
  st.isFirstClick = false; st.mineCount = target; st.flagsPlaced = 0;
  st.rotY = -0.4; st.targetRotY = -0.4; st.rotX = 0.35; st.targetRotX = 0.35;
  g.setThemeIndex(g.getThemeIndex());

  // Pick a covered, safe, numbered-neighbour tile near the front to dig.
  function frontCandidate(pred) {
    const s = g.getSphereScreen(); const list = [];
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]; if (!pred(c, i)) continue;
      const p = g.projectTile(tiles[i], st.rotY, st.rotX, 0);
      if (!p || p.center.z < 0.35) continue;
      list.push([Math.hypot(p.center.x - s.cx, p.center.y - s.cy), i]);
    }
    list.sort((a, b) => a[0] - b[0]); return list.length ? list[Math.min(2, list.length - 1)][1] : -1;
  }
  const safeCovered = (c, i) => !c.revealed && !c.isMine && !c.flagged && (tiles[i].neighborIndices || []).some(k => cells[k].revealed);
  const mineCovered = (c, i) => !c.revealed && c.isMine && !c.flagged && (tiles[i].neighborIndices || []).some(k => cells[k].revealed);

  // Spin driver: eases targetRotY/targetRotX toward waypoints between events.
  const start = performance.now() + 3500; const K = ${SLOWMO};
  let spins = [];
  function spinTo(atMs, rotY, rotX, overMs) { spins.push({ atMs: atMs * K, rotY, rotX, overMs: overMs * K }); }
  const evs = [];
  function at(ms, fn) { evs.push({ ms: ms * K, fn, done: false }); }

  at(1200, () => { const i = frontCandidate(safeCovered); if (i >= 0) g.floodFrom(i); });
  at(3400, () => { const i = frontCandidate(safeCovered); if (i >= 0) g.floodFrom(i); });
  at(5200, () => { const i = frontCandidate(mineCovered); if (i >= 0) g.flagAt(i); });
  at(7000, () => g.setThemeIndex(themeIndex("ion-storm")));
  at(9200, () => { const i = frontCandidate(safeCovered); if (i >= 0) g.floodFrom(i); });
  at(11500, () => g.setThemeIndex(themeIndex("gilded-ribbon")));
  at(13400, () => { const i = frontCandidate(safeCovered); if (i >= 0) g.floodFrom(i); });
  at(15000, () => { const i = frontCandidate(mineCovered); if (i >= 0) g.flagAt(i); });
  at(16500, () => g.setThemeIndex(themeIndex("stratosphere")));
  at(18800, () => { const i = frontCandidate(safeCovered); if (i >= 0) g.floodFrom(i); });
  at(20500, () => g.setThemeIndex(themeIndex("heat-lightning")));
  at(22300, () => { const i = frontCandidate(safeCovered); if (i >= 0) g.floodFrom(i); });

  spinTo(0, -0.4, 0.35, 1);
  spinTo(1400, 0.3, 0.2, 5000);
  spinTo(7000, -0.9, 0.45, 4000);
  spinTo(11500, 0.6, 0.15, 4500);
  spinTo(16500, -0.5, 0.4, 3800);
  spinTo(20500, 0.9, 0.25, 3500);

  let cur = { rotY: st.rotY, rotX: st.rotX };
  function tick() {
    const t = performance.now() - start;
    for (const e of evs) if (!e.done && t >= e.ms) { e.done = true; try { e.fn(); } catch (err) { console.warn(err); } }
    let from = cur, seg = null;
    for (const s of spins) if (t >= s.atMs) seg = s;
    if (seg) {
      const k = Math.min(1, (t - seg.atMs) / seg.overMs); const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const prev = spins[Math.max(0, spins.indexOf(seg) - 1)];
      const fy = prev === seg ? seg.rotY : prev.rotY, fx = prev === seg ? seg.rotX : prev.rotX;
      st.targetRotY = fy + (seg.rotY - fy) * e; st.targetRotX = fx + (seg.rotX - fx) * e;
      st.rotY = st.targetRotY; st.rotX = st.targetRotX;
    }
    window.__previewT = t;
    if (t < ${DURATION_MS} - 3500 + 500) requestAnimationFrame(tick); else window.__previewDone = true;
  }
  requestAnimationFrame(tick);
  return true;
})()`;

const server = await serve();
const port = server.address().port;
const profile = await mkdtemp(join(tmpdir(), "hex-preview-"));
const framesDir = await mkdtemp(join(tmpdir(), "hex-frames-"));
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
  let id = 0; const pending = new Map(); const frames = [];
  socket.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === "Page.screencastFrame") {
      frames.push({ t: m.params.metadata.timestamp, data: m.params.data });
      socket.send(JSON.stringify({ id: ++id, method: "Page.screencastFrameAck", params: { sessionId: m.params.sessionId } }));
      return;
    }
    if (!m.id || !pending.has(m.id)) return; const { resolve: ok, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : ok(m.result);
  });
  const send = (method, params = {}) => new Promise((ok, reject) => { const n = ++id; pending.set(n, { resolve: ok, reject }); socket.send(JSON.stringify({ id: n, method, params })); });
  const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text); return r.result.value; };
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: device.width, height: device.height, deviceScaleFactor: device.dpr, mobile: family === "iphone" });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await send("Page.reload", { ignoreCache: true });
  await waitFor(() => ev('document.readyState === "complete" && !!window.HEXSWEEPER_SPHERE_GAME'), "sphere did not boot");
  await delay(800);
  await ev('(() => { const st = document.createElement("style"); st.textContent = "#count-style-toast,.count-style-toast,.hex-bloom-live,.hex-bloom-tooltip{display:none !important}"; document.head.appendChild(st); })()');
  await send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: device.width * device.dpr, maxHeight: device.height * device.dpr, everyNthFrame: 1 });
  await ev(TIMELINE);
  await waitFor(() => ev("!!window.__previewDone"), "timeline", DURATION_MS + 15000);
  await send("Page.stopScreencast");
  socket.close();
  if (frames.length < 20) throw new Error(`only ${frames.length} frames captured`);
  // Resample the variable-rate screencast onto a fixed 30 fps timeline, after the lead-in.
  const t0 = frames[0].t + LEAD_MS / 1000; const captured = Math.min((DURATION_MS - LEAD_MS) / 1000, frames[frames.length - 1].t - t0);
  const total = captured / SLOWMO;
  const n = Math.floor(total * FPS); let fi = 0; const sourceFps = frames.length / (frames[frames.length - 1].t - frames[0].t) * SLOWMO;
  for (let k = 0; k < n; k++) {
    const t = t0 + (k / FPS) * SLOWMO; while (fi + 1 < frames.length && frames[fi + 1].t <= t) fi++;
    await writeFile(join(framesDir, `f${String(k).padStart(5, "0")}.jpg`), Buffer.from(frames[fi].data, "base64"));
  }
  const out = join(outDir, `preview-${family}.mp4`);
  // App Store Connect rejects a preview with no audio track (MOV_RESAVE_STEREO):
  // mux a silent 48 kHz stereo AAC track alongside the video.
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(framesDir, "f%05d.jpg"),
    "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-vf", `scale=${device.out.replace("x", ":")}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-profile:v", "high", "-level", "4.0",
    "-b:v", "11M", "-maxrate", "12M", "-bufsize", "24M", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "256k", "-ac", "2", "-shortest", "-movflags", "+faststart", out]);
  console.log(`captured ${captured.toFixed(1)}s slowed ${SLOWMO}x → ${total.toFixed(1)}s at ${sourceFps.toFixed(1)} effective fps (dpr ${device.dpr}) → ${out} (${n} frames @ ${FPS} fps, ${device.out})`);
} finally {
  chrome.kill("SIGTERM");
  await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  await rm(framesDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  server.close();
}
