#!/usr/bin/env node
// Two play contracts in a real browser:
//   1. Classic (bounded.html): after a mine hit, Undo stands in the toolbar
//      beside Play again and puts the board back as it was before the dig. A
//      win offers no Undo.
//   2. Sphere (index.html): a first visit on a phone starts on Small; a saved
//      size always wins; desktops and tablets keep Medium.
// CHROME_PATH picks the browser; HEXSWEEPER_SKIP_BROWSER=1 skips the file
// where Chrome is not installed. PORT pins the local server (default: any).

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const chromePath = process.env.CHROME_PATH || [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium", "/usr/bin/chromium-browser",
].find(existsSync);
if (process.env.HEXSWEEPER_SKIP_BROWSER === "1") {
  console.log("play contracts (browser): skipped");
  process.exit(0);
}
if (!chromePath) throw new Error("Chrome is unavailable; set CHROME_PATH to an installed browser");

const delay = (ms) => new Promise((done) => setTimeout(done, ms));
async function waitFor(fn, message, timeout = 10000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      last = error;
    }
    await delay(50);
  }
  throw new Error(`${message}${last ? `: ${last.message}` : ""}`);
}

const mime = { ".css": "text/css", ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".woff2": "font/woff2", ".png": "image/png", ".webp": "image/webp", ".json": "application/json" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = normalize(join(root, pathname.replace(/^\/+/, "") || "index.html"));
    if (!file.startsWith(`${root}/`)) throw new Error("outside root");
    const data = await readFile(file);
    response.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    response.end(data);
  } catch (_) {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((done) => server.listen(Number(process.env.PORT) || 0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(join(tmpdir(), "hexsweeper-play-"));
const chrome = spawn(chromePath, [
  "--headless=new",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-debugging-port=0",
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore" });

let socket;
try {
  const debugPort = await waitFor(async () => Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n", 1)[0]) || 0, "Chrome did not expose DevTools");
  const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find((t) => t.type === "page" && t.webSocketDebuggerUrl), "Chrome did not create a page");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, fail) => {
    socket.addEventListener("open", done, { once: true });
    socket.addEventListener("error", fail, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { done, fail } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) fail(new Error(msg.error.message));
    else done(msg.result);
  });
  const send = (method, params = {}) => new Promise((done, fail) => {
    const id = ++nextId;
    pending.set(id, { done, fail });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const open = async (path, ready) => {
    await send("Page.navigate", { url: base + path });
    await waitFor(() => evaluate(`document.readyState === "complete" && (${ready})`), `${path} did not load`);
  };
  // A phone is a small, touch-only screen: hover none, pointer coarse.
  const device = async ({ width, height, touch }) => {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: !!touch });
    await send("Emulation.setTouchEmulationEnabled", touch ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
  };
  await send("Runtime.enable");
  await send("Page.enable");
  // Seeded deals, so every run plays the same boards (mulberry32).
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    let a = 20261117;
    Math.random = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })()` });

  // ---- 1. Classic: Undo after a mine hit -----------------------------------
  await device({ width: 412, height: 860, touch: false });
  await open("/bounded.html?size=easy", "(typeof classicGame === \"object\" && !!classicGame)");
  await evaluate(`localStorage.clear(); localStorage.setItem("hexsweeper-effects-v1", "reduced")`);
  await open("/bounded.html?size=easy", "(typeof classicGame === \"object\" && !!classicGame) && document.body.dataset.controlFrame === 'hex-classic'");
  const settled = () => waitFor(() => evaluate("classicGame.state.floodPending === 0"), "flood never settled");
  const openKeys = `[...classicGame.state.map.values()].filter((c) => c.revealed).map((c) => c.q + "," + c.r).sort().join(" ")`;
  const visible = (id) => `(() => { const n = document.getElementById(${JSON.stringify(id)}); return !!n && !n.hidden && n.getClientRects().length > 0; })()`;

  // Every point of the board takes a real click: nothing invisible (the closed
  // menu's readouts and close button once did) sits over the canvas.
  const covered = await evaluate(`(() => {
    const canvas = classicGame.state.canvas, rect = canvas.getBoundingClientRect(), out = new Set();
    for (let y = rect.top + 1; y < Math.min(rect.bottom, innerHeight); y += 3) for (let x = rect.left + 1; x < Math.min(rect.right, innerWidth); x += 3) {
      const el = document.elementFromPoint(x, y);
      if (!el || el === canvas) continue;
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const css = getComputedStyle(n);
        if (css.opacity === "0" || css.visibility === "hidden") { out.add(el.id || n.id || el.tagName); break; }
      }
    }
    return [...out].join(", ");
  })()`);
  expect(!covered, `Classic: invisible elements catch clicks over the board (${covered})`);
  expect(await evaluate(`document.getElementById("undo-btn").hidden`), "Classic: Undo shows before any loss");
  expect(await evaluate("classicGame.canUndo() === false"), "Classic: a fresh board claims an undo");
  await evaluate(`classicGame.dig("0,0")`);
  await settled();
  expect(await evaluate("classicGame.canUndo() === false"), "Classic: the first (always safe) dig left an undo");
  // A second safe dig, so the snapshot holds a real board.
  await evaluate(`(() => { const c = [...classicGame.state.map.values()].find((c) => !c.revealed && !c.isMine && !c.flagged); classicGame.dig(c); })()`);
  await settled();
  // Flag one mine: the loss must not take the flag back.
  const flagKey = await evaluate(`(() => { const c = [...classicGame.state.map.values()].filter((c) => c.isMine && !c.revealed)[0]; classicGame.toggleFlag(c); return c.q + "," + c.r; })()`);
  const before = await evaluate(openKeys);
  const beforeTime = await evaluate("classicGame.state.timeElapsed");
  const mineKey = await evaluate(`(() => { const c = [...classicGame.state.map.values()].find((c) => c.isMine && !c.flagged && !c.revealed); classicGame.dig(c); return c.q + "," + c.r; })()`);
  await waitFor(() => evaluate("classicGame.state.isGameOver"), "Classic: digging a mine did not end the board");
  expect(await evaluate("classicGame.state.win === false"), "Classic: a mine hit counted as a win");
  expect(await evaluate(`document.getElementById("end-note").textContent.startsWith("Mine hit")`), "Classic: the end line does not say Mine hit");
  expect(await evaluate(visible("again-btn")), "Classic: Play again is not shown after a loss");
  expect(await evaluate(visible("undo-btn")), "Classic: Undo is not shown after a loss");
  expect(await evaluate(`!!document.getElementById("undo-btn").closest(".control-toolbar .control-actions")`), "Classic: Undo is not in the toolbar's action group");
  expect(await evaluate(`document.getElementById("undo-btn").getAttribute("aria-label") === "Undo last move"`), "Classic: Undo is not named like Sphere's (Undo last move)");
  expect(await evaluate("localStorage.getItem('hexsweeper-classic-run-v1') === null"), "Classic: a lost run is still saved");

  await evaluate(`document.getElementById("undo-btn").click()`);
  await delay(250);
  expect(await evaluate("classicGame.state.isGameOver === false"), "Classic: Undo left the board over");
  expect(await evaluate(openKeys) === before, "Classic: Undo did not restore the open cells from before the dig");
  expect(await evaluate(`!classicGame.state.map.get(${JSON.stringify(mineKey)}).revealed`), "Classic: the mine that went off is still open");
  expect(await evaluate(`classicGame.state.map.get(${JSON.stringify(flagKey)}).flagged`), "Classic: Undo dropped a flag placed before the loss");
  expect(await evaluate("classicGame.state.detonator === null"), "Classic: Undo kept the detonator");
  expect((await evaluate("classicGame.state.timeElapsed")) >= beforeTime, "Classic: Undo moved the clock backwards past the dig");
  expect(await evaluate(`document.getElementById("undo-btn").hidden && document.getElementById("again-btn").hidden`), "Classic: end controls stay up after Undo");
  expect(await evaluate("classicGame.canUndo() === false"), "Classic: Undo is more than one step");
  expect(await evaluate(`document.activeElement && document.activeElement.id === "gameCanvas"`), "Classic: focus is not on the board after Undo");
  await waitFor(() => evaluate("JSON.parse(localStorage.getItem('hexsweeper-classic-run-v1') || 'null')?.over === false"), "Classic: the run is not saved again after Undo").catch((e) => failures.push(e.message));
  expect(await evaluate("classicGame.undo() === false"), "Classic: a second undo did something");

  // The board plays on: clear it and the win offers no Undo.
  for (let guard = 0; guard < 200; guard++) {
    const left = await evaluate(`(() => { const c = [...classicGame.state.map.values()].find((c) => !c.revealed && !c.isMine && !c._pendingReveal); if (!c || classicGame.state.isGameOver) return 0; if (c.flagged) classicGame.toggleFlag(c); classicGame.dig(c); return 1; })()`);
    await settled();
    if (!left) break;
  }
  await waitFor(() => evaluate("classicGame.state.isGameOver && classicGame.state.win === true"), "Classic: clearing the board did not win").catch((e) => failures.push(e.message));
  expect(await evaluate(visible("again-btn")), "Classic: Play again is not shown after a win");
  expect(await evaluate(`document.getElementById("undo-btn").hidden`), "Classic: a win offers Undo");

  // A chord that opens a mine is one undo step too. Flag a safe neighbor of
  // a number so the count is "satisfied" wrongly, then click the number.
  // Not every opening shows a 1 beside a mine and a safe hex; deal again
  // until one does.
  let chordKey = null;
  for (let deal = 0; deal < 20 && !chordKey; deal++) {
    await evaluate(`document.getElementById("again-btn").click()`);
    await waitFor(() => evaluate("classicGame.state.isFirstClick && !classicGame.state.isGameOver"), "Classic: Play again did not deal a fresh board");
    await evaluate(`classicGame.dig("0,0")`);
    await settled();
    chordKey = await evaluate(`(() => {
      const g = classicGame;
      for (const c of g.state.map.values()) {
        if (!c.revealed || c.neighborMines !== 1) continue;
        const ns = g.getNeighbors(c.q, c.r).filter((n) => !n.revealed);
        const safe = ns.find((n) => !n.isMine);
        if (!safe || !ns.some((n) => n.isMine)) continue;
        g.toggleFlag(safe);
        return c.q + "," + c.r;
      }
      return null;
    })()`);
  }
  expect(!!chordKey, "Classic: no number to chord in 20 deals");
  if (chordKey) {
    // Find the number on screen through the board's own hover hit test.
    const spot = await evaluate(`(() => {
      const canvas = classicGame.state.canvas, rect = canvas.getBoundingClientRect();
      for (let y = 2; y < rect.height; y += 4) for (let x = 2; x < rect.width; x += 4) {
        canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: rect.left + x, clientY: rect.top + y, bubbles: true }));
        if (classicGame.state.hoveredKey === ${JSON.stringify(chordKey)}) return { x: rect.left + x, y: rect.top + y };
      }
      return null;
    })()`);
    expect(!!spot, "Classic: the chord number is not on screen");
    if (spot) {
      const beforeChord = await evaluate(openKeys);
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
        await send("Input.dispatchMouseEvent", { type, x: spot.x, y: spot.y, button: type === "mouseMoved" ? "none" : "left", clickCount: 1 });
      }
      await waitFor(() => evaluate("classicGame.state.isGameOver && classicGame.state.win === false"), "Classic: the chord onto a mine did not end the board").catch(async (e) => {
        const why = await evaluate(`JSON.stringify((() => {
          const s = classicGame.state, c = s.map.get(${JSON.stringify(chordKey)}), canvas = s.canvas, r = canvas.getBoundingClientRect();
          const el = document.elementFromPoint(${spot.x}, ${spot.y});
          return { spot: ${JSON.stringify(spot)}, el: el ? (el.id || el.className || el.tagName) : null, rect: [r.left, r.top, r.width, r.height], canvas: [canvas.width, canvas.height], view: [innerWidth, innerHeight, devicePixelRatio, scrollX, scrollY],
            over: s.isGameOver, win: s.win, first: s.isFirstClick, hovered: s.hoveredKey, cell: c && { revealed: c.revealed, n: c.neighborMines, flags: classicGame.getNeighbors(c.q, c.r).filter((n) => n.flagged).length },
            opened: [...s.map.values()].filter((x) => x.revealed).length, opened0: ${JSON.stringify(beforeChord.split(" ").length)}, ua: navigator.userAgent };
        })())`).catch((err) => err.message);
        failures.push(`${e.message} (${why})`);
      });
      expect(await evaluate(visible("undo-btn")), "Classic: a chord onto a mine offers no Undo");
      await evaluate(`document.getElementById("undo-btn").click()`);
      await delay(250);
      expect(await evaluate("classicGame.state.isGameOver === false"), "Classic: Undo after a chord left the board over");
      expect(await evaluate(openKeys) === beforeChord, "Classic: Undo after a chord did not restore the board");
    }
  }

  // ---- 2. Sphere: first-visit size ------------------------------------------
  const sphereSize = async (viewport, saved) => {
    await device(viewport);
    await open("/index.html", "!!window.HEXSWEEPER_SPHERE_GAME");
    await evaluate(`localStorage.clear()${saved ? `; localStorage.setItem("hexsweeper-sphere-size-v2", ${JSON.stringify(saved)})` : ""}`);
    await open("/index.html", "!!window.HEXSWEEPER_SPHERE_GAME");
    const got = await evaluate("({ size: HEXSWEEPER_SPHERE_GAME.getState().difficulty, faces: HEXSWEEPER_SPHERE_GAME.getState().cells.length, saved: localStorage.getItem('hexsweeper-sphere-size-v2') })");
    return got;
  };
  const phone = { width: 412, height: 860, touch: true };
  let got = await sphereSize(phone);
  expect(got.size === "easy", `Sphere: a first visit on a phone starts on ${got.size}, want easy (Small)`);
  expect(got.faces === 362, `Sphere: phone first visit has ${got.faces} faces, want 362`);
  expect(got.saved === null, "Sphere: the phone default was written as a saved choice");
  got = await sphereSize({ width: 860, height: 412, touch: true });
  expect(got.size === "easy", `Sphere: a landscape phone starts on ${got.size}, want easy`);
  got = await sphereSize(phone, "medium");
  expect(got.size === "medium", `Sphere: a saved Medium on a phone became ${got.size}`);
  got = await sphereSize(phone, "hard");
  expect(got.size === "hard", `Sphere: a saved Large on a phone became ${got.size}`);
  got = await sphereSize({ width: 1280, height: 800, touch: false });
  expect(got.size === "medium", `Sphere: desktop first visit starts on ${got.size}, want medium`);
  got = await sphereSize({ width: 412, height: 860, touch: false });
  expect(got.size === "medium", `Sphere: a narrow desktop window starts on ${got.size}, want medium`);
  got = await sphereSize({ width: 820, height: 1180, touch: true });
  expect(got.size === "medium", `Sphere: a tablet first visit starts on ${got.size}, want medium`);
} finally {
  try { socket?.close(); } catch (_) {}
  chrome.kill();
  server.close();
  await delay(200);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

if (failures.length) {
  console.error(`play contracts (browser) failed (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("play contracts (browser): ok");
