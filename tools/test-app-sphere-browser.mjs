#!/usr/bin/env node
// Browser contract for the sealed native payload (build/app): the app is the
// sphere and nothing else. Cold start lands on the board with no prompt and no
// Games chrome; the quiet bar (Undo · Reset · Flag · ?) sits at the bottom;
// the ? sheet carries theme, size, warnings, invert, effects; Undo acts on the
// first tap; the material themes bring up the WebGL renderer offline.

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
    bloom: !!document.getElementById("hex-bloom"),
    helpOpen: !document.getElementById("help-overlay").hidden,
    bar: ["qc-undo", "qc-reset", "qc-flag", "qc-help"].map(id => { const el = document.getElementById(id); if (!el) return null; const r = el.getBoundingClientRect(); return { id, w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(innerHeight - r.bottom) }; }),
    stats: (document.querySelector(".qc-stats") || {}).textContent || "",
    sphereR: Math.round(window.HEXSWEEPER_SPHERE_GAME.getSphereScreen().r),
    width: innerWidth,
  }))()`);
  assert.equal(cold.dialog, false, "a dialog opened over root Sphere on cold start");
  assert.equal(cold.back, false, "root Sphere carries a Games pill");
  assert.equal(cold.bloom, false, "the hex-bloom menu is still mounted");
  assert.equal(cold.helpOpen, false, "help opened uninvited on cold start");
  assert.ok(cold.bar.every(Boolean), "quiet bar is missing a button");
  assert.ok(cold.bar.every(b => b.w >= 44 && b.h >= 44), `quiet bar targets: ${JSON.stringify(cold.bar)}`);
  assert.match(cold.stats, /\d+/, "top readout has no numbers");
  assert.ok(cold.sphereR / cold.width > 0.4, `sphere fills only ${(cold.sphereR * 2 / cold.width * 100).toFixed(0)}% of a portrait phone`);

  // ? opens the settings sheet: gestures, theme grid, size, warnings, invert/effects, Done.
  await evaluate('document.getElementById("qc-help").click()');
  await waitExpression('!document.getElementById("help-overlay").hidden', "help did not open");
  const help = await evaluate(`(() => {
    const keys = document.querySelector(".help-keys");
    const done = document.getElementById("help-done-btn").getBoundingClientRect();
    const panel = document.getElementById("help-panel").getBoundingClientRect();
    return { keysHidden: getComputedStyle(keys).display === "none", doneH: Math.round(done.height), panelW: Math.round(panel.width), text: document.getElementById("help-panel").innerText,
      themes: Array.from(document.querySelectorAll("#help-theme-grid .help-theme")).map(b => b.dataset.theme),
      sizes: Array.from(document.querySelectorAll("#help-size-grid .help-size")).map(b => b.dataset.size),
      warns: Array.from(document.querySelectorAll("#help-warn-grid .help-warn")).map(b => b.dataset.warn),
      invert: !!document.querySelector('#help-controls [data-ctl="invert"]'), effects: !!document.querySelector('#help-controls [data-ctl="effects"]') };
  })()`);
  assert.equal(help.keysHidden, true, "keyboard hints show on a touch device");
  assert.ok(help.doneH >= 44, `Done button is ${help.doneH}px tall`);
  assert.ok(help.panelW >= 340, `help panel is only ${help.panelW}px wide on a 390px phone`);
  assert.match(help.text, /bottom left/i, "help copy does not point at the bottom bar");
  assert.deepEqual(help.themes, ["light", "dark", "stratosphere", "mercury", "ion-storm", "aurora", "galaxy", "gilded-ribbon", "heat-lightning"], `theme grid roster is ${help.themes.join(",")}`);
  assert.deepEqual(help.sizes, ["xsmall", "easy", "medium", "hard", "xlarge"], `size pills are ${help.sizes.join(",")}`);
  assert.deepEqual(help.warns, ["numbers-depth", "numbers-flat", "mono-depth", "yellow-flat"], `warning pills are ${help.warns.join(",")}`);
  assert.ok(help.invert && help.effects, "invert / effects pills missing from the sheet");
  await evaluate('document.querySelector("#help-theme-grid .help-theme[data-theme=galaxy]").click()');
  assert.equal(await evaluate('window.HEXSWEEPER_SPHERE_GAME.getState().theme.id'), "galaxy", "theme grid did not apply Galaxy");
  assert.equal(await evaluate('document.querySelector("#help-theme-grid .help-theme[aria-pressed=true]").dataset.theme'), "galaxy", "theme grid did not mark Galaxy pressed");
  await evaluate('document.querySelector("#help-warn-grid .help-warn[data-warn=yellow-flat]").click()');
  assert.equal(await evaluate('(() => { const s = window.HEXSWEEPER_SPHERE_GAME.getState(); return s.countStyle + "/" + s.relief + "/" + s.seams; })()'), "yellow/flush/false", "warning pill did not apply");
  await evaluate('document.querySelector("#help-warn-grid .help-warn[data-warn=numbers-depth]").click()');
  await evaluate('document.querySelector("#help-size-grid .help-size[data-size=easy]").click()');
  assert.equal(await evaluate('window.HEXSWEEPER_SPHERE_GAME.getState().difficulty'), "easy", "size pill did not start a Small sphere");
  await evaluate('document.querySelector("#help-size-grid .help-size[data-size=medium]").click()');
  await evaluate('document.querySelector("#help-theme-grid .help-theme[data-theme=light]").click()');
  await evaluate('document.getElementById("help-done-btn").click()');
  await waitExpression('document.getElementById("help-overlay").hidden', "help did not close");

  // Dig the front face (mouse: headless SwiftShader drops synthetic touch taps on the canvas), then Undo on the first tap.
  const centre = await evaluate('(() => { const g = window.HEXSWEEPER_SPHERE_GAME.getSphereScreen(); return { x: g.cx, y: g.cy }; })()');
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: centre.x, y: centre.y, button: "left", clickCount: 1 });
  await delay(60);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: centre.x, y: centre.y, button: "left", clickCount: 1 });
  await waitExpression('!window.HEXSWEEPER_SPHERE_GAME.getState().isFirstClick', "first dig did not resolve");
  const revealedBefore = await evaluate('window.HEXSWEEPER_SPHERE_GAME.getState().cells.filter(c => c.revealed).length');
  assert.ok(revealedBefore > 0, "nothing revealed after the dig");
  const undoBox = await evaluate('(() => { const r = document.getElementById("qc-undo").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()');
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: undoBox.x, y: undoBox.y }] });
  await delay(70);
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await waitExpression('window.HEXSWEEPER_SPHERE_GAME.getState().cells.filter(c => c.revealed).length === 0', "Undo did not act on the first tap");
  // Flag mode: the bar flag arms red; a board tap flags instead of digging.
  await evaluate('document.getElementById("qc-flag").click()');
  await delay(300);
  assert.equal(await evaluate('document.getElementById("qc-flag").classList.contains("is-armed") && document.getElementById("qc-flag").getAttribute("aria-pressed") === "true"'), true, "flag button did not arm");
  assert.equal(await evaluate('window.HEXSWEEPER_SPHERE_GAME.getState().flagMode'), true, "flag mode did not engage");
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: centre.x, y: centre.y, button: "left", clickCount: 1 });
  await delay(60);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: centre.x, y: centre.y, button: "left", clickCount: 1 });
  await delay(300);
  assert.equal(await evaluate('window.HEXSWEEPER_SPHERE_GAME.getState().flagsPlaced'), 1, "board tap in flag mode did not plant a flag");
  await evaluate('document.getElementById("qc-flag").click()');
  await delay(200);
  assert.equal(await evaluate('window.HEXSWEEPER_SPHERE_GAME.getState().flagMode'), false, "flag mode did not disarm");
  await evaluate('document.getElementById("qc-reset").click()');
  await delay(300);
  assert.equal(await evaluate('window.HEXSWEEPER_SPHERE_GAME.getState().flagsPlaced'), 0, "New sphere did not reset the board");

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
