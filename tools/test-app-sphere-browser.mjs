#!/usr/bin/env node
// Browser contract for the sealed native payload (build/app): the app is the
// sphere and nothing else. Cold start lands on the board with no prompt and no
// Games chrome; the corner Menu opens the flower; Undo acts on the first tap;
// the Theme tile reaches Mercury and its WebGL renderer comes up.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] || "build/app");
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

async function waitFor(fn, message, timeout = 10000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(50);
  }
  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ""}`);
}

async function startStaticServer() {
  await stat(join(root, "index.html"));
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
      const file = normalize(join(root, relative));
      if (!file.startsWith(`${root}/`) && file !== root) throw new Error("outside root");
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
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  return server;
}

function cdp(socket) {
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: resolveCall, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolveCall(message.result);
  });
  return (method, params = {}) => new Promise((resolveCall, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve: resolveCall, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

let server;
let chrome;
let profile;
try {
  server = await startStaticServer();
  const port = server.address().port;
  profile = await mkdtemp(join(tmpdir(), "hexsweeper-app-"));
  chrome = spawn(chromePath, [
    "--headless=new",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    `http://127.0.0.1:${port}/index.html`,
  ], { stdio: "ignore" });

  const debugPort = await waitFor(async () => {
    const raw = await readFile(join(profile, "DevToolsActivePort"), "utf8");
    return Number(raw.split("\n", 1)[0]) || 0;
  }, "Chrome did not expose DevTools");
  const target = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const pages = await response.json();
    return pages.find((page) => page.type === "page" && page.webSocketDebuggerUrl);
  }, "Chrome did not create a page target");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const send = cdp(socket);
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  if (process.env.HEXSWEEPER_DARK === "1") {
    await send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: "dark" }],
    });
  }
  await send("Page.reload", { ignoreCache: true });

  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      const d = result.exceptionDetails;
      throw new Error((d.exception && d.exception.description) || d.text || "evaluation failed");
    }
    return result.result.value;
  }

  async function waitExpression(expression, message) {
    return waitFor(async () => evaluate(expression), message);
  }

  // Root is Sphere; nothing stands between the launch screen and the board.
  await waitExpression('location.pathname.endsWith("/index.html") && document.readyState === "complete" && !!window.HEXSWEEPER_SPHERE_GAME', "root Sphere did not load");
  await evaluate("localStorage.clear(); sessionStorage.clear();");
  await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await send("Page.reload", { ignoreCache: true });
  await waitExpression('document.readyState === "complete" && !!window.HEXSWEEPER_SPHERE_GAME', "root Sphere did not reload");
  await delay(400);

  const cold = await evaluate(`(() => ({
    dialog: !!document.querySelector("dialog[open]"),
    back: !!document.querySelector(".app-back"),
    helpOpen: !document.getElementById("help-overlay").hidden,
    menuBtn: !!document.querySelector(".is-menu-corner .is-dock"),
    helpBtn: !!document.querySelector(".hex-bloom-corner:not(.is-menu-corner) .is-dock"),
    menuBox: (() => { const r = document.querySelector(".is-menu-corner .is-dock").getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), bottom: Math.round(innerHeight - r.bottom) }; })(),
    sphereR: Math.round(window.HEXSWEEPER_SPHERE_GAME.getSphereScreen().r),
    width: innerWidth,
  }))()`);
  assert.equal(cold.dialog, false, "a dialog opened over root Sphere on cold start");
  assert.equal(cold.back, false, "root Sphere carries a Games pill");
  assert.equal(cold.helpOpen, false, "help opened uninvited on cold start");
  assert.equal(cold.menuBtn, true, "no corner Menu button");
  assert.equal(cold.helpBtn, true, "no corner Help button");
  assert.ok(cold.menuBox.w >= 44 && cold.menuBox.h >= 44, `corner Menu target is ${cold.menuBox.w}x${cold.menuBox.h}, under 44pt`);
  assert.ok(cold.sphereR / cold.width > 0.4, `sphere fills only ${(cold.sphereR * 2 / cold.width * 100).toFixed(0)}% of a portrait phone`);

  // Help modal opens from the corner and closes with Done; touch copy hides key hints.
  await evaluate('document.querySelector(".hex-bloom-corner:not(.is-menu-corner) .is-dock").click()');
  await waitExpression('!document.getElementById("help-overlay").hidden', "help did not open");
  const help = await evaluate(`(() => {
    const keys = document.querySelector(".help-keys");
    const done = document.getElementById("help-done-btn").getBoundingClientRect();
    const panel = document.getElementById("help-panel").getBoundingClientRect();
    return { keysHidden: getComputedStyle(keys).display === "none", doneH: Math.round(done.height), panelW: Math.round(panel.width), text: document.getElementById("help-panel").innerText };
  })()`);
  assert.equal(help.keysHidden, true, "keyboard hints show on a touch device");
  assert.ok(help.doneH >= 44, `Done button is ${help.doneH}px tall`);
  assert.ok(help.panelW >= 340, `help panel is only ${help.panelW}px wide on a 390px phone`);
  assert.match(help.text, /menu button/i, "help copy does not mention the menu button");
  assert.match(help.text, /Stratosphere, Mercury, Ion Storm, Aurora, Galaxy, Gilded Ribbon, Heat Lightning/, "help copy does not name the theme cycle");
  await evaluate('document.getElementById("help-done-btn").click()');
  await waitExpression('document.getElementById("help-overlay").hidden', "help did not close");

  // Dig the front face, then Undo through the flower on the FIRST tap of each control.
  // A finger tap holds for a few dozen ms; a zero-length synthetic tap can
  // land between the engine's press and release bookkeeping.
  async function fingerTap(x, y) {
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await delay(70);
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  const centre = await evaluate('(() => { const g = window.HEXSWEEPER_SPHERE_GAME.getSphereScreen(); return { x: g.cx, y: g.cy }; })()');
  // Board digs use mouse events: headless SwiftShader intermittently drops a
  // synthetic touch tap on the canvas (real fingers do not), and the flat-game
  // contracts always dug this way. Chrome controls stay on touch below.
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: centre.x, y: centre.y, button: "left", clickCount: 1 });
  await delay(60);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: centre.x, y: centre.y, button: "left", clickCount: 1 });
  if (process.env.HEX_DEBUG) console.log("dbg", JSON.stringify(await evaluate('(() => { const g = window.HEXSWEEPER_SPHERE_GAME; const s = g.getState(); const d = g.getSphereScreen(); const el = document.elementFromPoint(d.cx, d.cy); return { first: s.isFirstClick, over: s.isGameOver, pick: g.pickTile(d.cx, d.cy), r: d.r, cx: d.cx, cy: d.cy, el: el && (el.tagName + "#" + el.id + "." + el.className), chain: el && (() => { const out = []; let n = el; while (n && n !== document.body) { out.push(n.tagName + "#" + n.id + "." + (n.className || "")); n = n.parentElement; } return out.join(" < "); })(), html: el && el.outerHTML.slice(0, 160), phase: document.getElementById("hex-bloom").dataset.phase, helpHidden: document.getElementById("help-overlay").hidden, iw: innerWidth, ih: innerHeight }; })()')));
  await waitExpression('!window.HEXSWEEPER_SPHERE_GAME.getState().isFirstClick', "first dig did not resolve");
  const revealedBefore = await evaluate('window.HEXSWEEPER_SPHERE_GAME.getState().cells.filter(c => c.revealed).length');
  assert.ok(revealedBefore > 0, "nothing revealed after the dig");
  const menuBox = await evaluate('(() => { const r = document.querySelector(".is-menu-corner .is-dock").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()');
  await fingerTap(menuBox.x, menuBox.y);
  await waitExpression('document.getElementById("hex-bloom").dataset.phase === "open" && !!document.querySelector("#hex-bloom-stage .hb-hex[data-cat=undo].shown")', "corner Menu did not open the flower on one tap");
  // Tiles fold open with a transform; wait for the rise to finish before measuring.
  await waitExpression('(() => { const el = document.querySelector("#hex-bloom-stage .hb-hex[data-cat=undo]"); return el && el.getBoundingClientRect().width >= 52; })()', "Undo tile never reached full size");
  const undoBox = await evaluate('(() => { const el = document.querySelector("#hex-bloom-stage .hb-hex[data-cat=undo]"); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: Math.round(r.width), h: Math.round(r.height) }; })()');
  assert.ok(undoBox.w >= 44 && undoBox.h >= 44, `Undo tile is ${undoBox.w}x${undoBox.h}`);
  // The flower sits off the sphere on a portrait phone (below it), and the
  // scrim no longer fogs the board.
  const placement = await evaluate(`(() => {
    const d = window.HEXSWEEPER_SPHERE_GAME.getSphereScreen();
    const tops = Array.from(document.querySelectorAll("#hex-bloom-stage .hb-hex")).map(e => e.getBoundingClientRect().top);
    const scrim = getComputedStyle(document.querySelector(".hex-bloom-scrim"));
    return { flowerTop: Math.min(...tops), sphereBottom: d.cy + d.r, blur: scrim.backdropFilter || scrim.webkitBackdropFilter || "none", bg: scrim.backgroundColor };
  })()`);
  assert.ok(placement.flowerTop >= placement.sphereBottom - 4, `flower (top ${Math.round(placement.flowerTop)}) overlaps the sphere (bottom ${Math.round(placement.sphereBottom)})`);
  assert.ok(placement.blur === "none" || placement.blur === "", `scrim still blurs the board: ${placement.blur}`);
  assert.equal(placement.bg, "rgba(0, 0, 0, 0)", `scrim still tints the board: ${placement.bg}`);
  await evaluate('document.querySelector("#hex-bloom-stage .hb-hex[data-cat=undo]").click()');
  await waitExpression('window.HEXSWEEPER_SPHERE_GAME.getState().cells.filter(c => c.revealed).length === 0', "Undo did not act on the first activation");
  // The flower stays open after Undo (only Reset folds it); the corner button closes it.
  await evaluate('document.querySelector(".is-menu-corner .is-dock").click()');
  await waitExpression('document.getElementById("hex-bloom").dataset.phase === "closed"', "corner Menu did not close the flower");
  await delay(200);

  // Theme tile: Light → Dark → Glow → Mercury, and Mercury brings up the WebGL material.
  await evaluate('document.querySelector(".is-menu-corner .is-dock").click()');
  await waitExpression('document.getElementById("hex-bloom").dataset.phase === "open" && !!document.querySelector("#hex-bloom-stage .hb-hex[data-cat=theme]")', "flower did not reopen");
  const themeTile = '#hex-bloom-stage .hb-hex[data-cat=theme]';
  assert.equal(await evaluate(`!!document.querySelector('${themeTile}')`), true, "flower has no Theme tile");
  const seen = [];
  for (let i = 0; i < 9; i++) {
    if ((await evaluate('document.getElementById("hex-bloom").dataset.phase')) !== "open") {
      await evaluate('document.querySelector(".is-menu-corner .is-dock").click()');
      await waitExpression('document.getElementById("hex-bloom").dataset.phase === "open" && !!document.querySelector("#hex-bloom-stage .hb-hex[data-cat=theme]")', "flower did not reopen for the next theme");
    }
    await evaluate(`document.querySelector('${themeTile}').click()`);
    await delay(150);
    seen.push(await evaluate('window.HEXSWEEPER_SPHERE_GAME.getState().theme.id'));
  }
  assert.deepEqual(seen, ["dark", "stratosphere", "mercury", "ion-storm", "aurora", "galaxy", "gilded-ribbon", "heat-lightning", "light"], `theme cycle was ${seen.join(" → ")}`);
  // Textured materials: the sealed data URI must actually load into the renderer.
  await evaluate('window.HEXSWEEPER_SPHERE_GAME.setThemeIndex(SphereSweeper.THEMES.findIndex(t => t.id === "ion-storm")); void 0;');
  const storm = await waitExpression(`(() => {
    const c = document.getElementById("reflectionCanvas");
    if (!c || c.style.display === "none") return null;
    if (document.body.dataset.reflectionMaterial !== "ion-storm") return null;
    return { chrome: document.body.dataset.sphereChrome };
  })()`, "Ion Storm did not switch the renderer");
  assert.equal(storm.chrome, "dark", "Ion Storm did not switch chrome to dark");
  await evaluate('window.HEXSWEEPER_SPHERE_GAME.setThemeIndex(SphereSweeper.THEMES.findIndex(t => t.id === "stratosphere")); void 0;');
  const strato = await waitExpression(`(() => document.body.dataset.reflectionMaterial === "stratosphere" ? { chrome: document.body.dataset.sphereChrome } : null)()`, "Stratosphere did not switch the renderer");
  assert.equal(strato.chrome, "light", "Stratosphere did not switch chrome to light");
  await evaluate('window.HEXSWEEPER_SPHERE_GAME.setThemeIndex(SphereSweeper.THEMES.findIndex(t => t.id === "mercury")); void 0;');
  const mercury = await waitExpression(`(() => {
    const c = document.getElementById("reflectionCanvas");
    if (!c || c.style.display === "none" || !c.width) return null;
    return { material: document.body.dataset.reflectionMaterial, chrome: document.body.dataset.sphereChrome, w: c.width, stored: localStorage.getItem("hexsweeper-sphere-theme-v6") };
  })()`, "Mercury did not bring up the reflection canvas");
  assert.equal(mercury.material, "mercury", "reflection renderer is not on the Mercury material");
  assert.equal(mercury.chrome, "dark", "Mercury did not switch chrome to dark");
  assert.equal(mercury.stored, "mercury", "Mercury theme did not persist");
  if (process.env.HEXSWEEPER_APP_SCREENSHOT) {
    const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(process.env.HEXSWEEPER_APP_SCREENSHOT, Buffer.from(screenshot.data, "base64"));
  }
  console.log("app sphere browser contract: ok");
  socket.close();
} finally {
  if (chrome && chrome.exitCode == null) {
    const exited = new Promise((resolveExit) => chrome.once("exit", resolveExit));
    chrome.kill("SIGTERM");
    await Promise.race([exited, delay(2000)]);
  }
  if (server) await new Promise((resolveClose) => server.close(resolveClose));
  if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
}
