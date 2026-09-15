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
    "--user-agent=Mozilla/5.0 (Linux; Android 11; KFRASWI) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0 Mobile Safari/537.36",
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
  await evaluate(`
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("hexsweeper-sphere-invert-v4", JSON.stringify({ x: false, y: false }));
  `);
  await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await send("Page.reload", { ignoreCache: true });
  await waitExpression('document.readyState === "complete" && !!window.HEXSWEEPER_SPHERE_GAME', "root Sphere did not reload");
  await delay(400);
  // First launch: the tutorial sheet, not the settings sheet; Play dismisses and marks the key.
  await waitExpression('!document.getElementById("tutorial-overlay").hidden', "first launch did not show the tutorial");
  assert.equal(await evaluate('document.getElementById("help-overlay").hidden'), true, "settings sheet opened on first launch instead of the tutorial");
  await evaluate('document.getElementById("tutorial-play-btn").click()');
  await waitExpression('document.getElementById("tutorial-overlay").hidden', "tutorial did not dismiss");
  assert.equal(await evaluate('localStorage.getItem("hexsweeper-sphere-welcome-v1")'), "1", "tutorial did not mark the welcome key");
  assert.deepEqual(
    await evaluate('window.HEXSWEEPER_SPHERE_GAME.getInvertDrag()'),
    { x: true, y: false },
    "v4 drag preference did not reset to the mirrored-X v5 default",
  );
  assert.equal(
    await evaluate('localStorage.getItem("hexsweeper-sphere-invert-v4")'),
    null,
    "legacy v4 drag preference was not removed",
  );

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
      invert: !!document.querySelector('#help-controls [data-ctl="invert"]'), effects: !!document.querySelector('#help-controls [data-ctl="effects"]') };
  })()`);
  assert.equal(help.keysHidden, true, "keyboard hints show on a touch device");
  assert.ok(help.doneH >= 44, `Done button is ${help.doneH}px tall`);
  assert.ok(help.panelW >= 340, `help panel is only ${help.panelW}px wide on a 390px phone`);
  assert.match(help.text, /bottom left/i, "help copy does not point at the bottom bar");
  assert.doesNotMatch(help.text, /\bdig\b/i, "help copy still says dig");
  assert.deepEqual(help.themes, ["light", "dark", "stratosphere", "mercury", "ion-storm", "aurora", "galaxy", "gilded-ribbon", "heat-lightning"], `theme grid roster is ${help.themes.join(",")}`);
  assert.deepEqual(help.sizes, ["xsmall", "easy", "medium", "hard", "xlarge"], `size pills are ${help.sizes.join(",")}`);
  assert.equal(await evaluate('!!document.getElementById("help-warn-grid")'), false, "Warnings group is still on the sheet (themes own it now)");
  assert.ok(help.invert && help.effects, "invert / effects pills missing from the sheet");
  // The sheet is tabbed: Play · Themes · Board · Settings · Keys; one panel at a time; last tab remembered.
  // Keys is the keyboard guide and collapses to nothing on a touch device.
  const tabs = await evaluate('Array.from(document.querySelectorAll("#help-tabs [role=tab]")).map(t => t.dataset.tab + ":" + t.getAttribute("aria-selected") + ":" + Math.round(t.getBoundingClientRect().height))');
  assert.deepEqual(tabs.map(t => t.split(":")[0]), ["play", "themes", "board", "settings", "keys"], `sheet tabs are ${tabs.join(",")}`);
  const keysTab = tabs.find(t => t.startsWith("keys:"));
  assert.equal(Number(keysTab.split(":")[2]), 0, `keyboard tab shows on a touch device: ${keysTab}`);
  assert.ok(tabs.filter(t => !t.startsWith("keys:")).every(t => Number(t.split(":")[2]) >= 44), `sheet tabs under 44pt: ${tabs.join(",")}`);
  assert.equal(await evaluate('Array.from(document.querySelectorAll(".help-tabpanel")).filter(p => !p.hidden).map(p => p.dataset.tab).join(",")'), "play", "sheet did not open on the Play tab");
  await evaluate('document.getElementById("help-tab-themes").click()');
  assert.equal(await evaluate('Array.from(document.querySelectorAll(".help-tabpanel")).filter(p => !p.hidden).map(p => p.dataset.tab).join(",")'), "themes", "Themes tab did not show only the themes panel");
  assert.equal(await evaluate('document.getElementById("help-theme-grid").getBoundingClientRect().height > 40'), true, "theme grid is not visible on the Themes tab");
  await evaluate('document.getElementById("help-tab-board").click()');
  assert.equal(await evaluate('document.getElementById("help-size-grid").getBoundingClientRect().height > 30 && document.getElementById("help-theme-grid").getBoundingClientRect().height === 0'), true, "Board tab did not swap themes for sizes");
  assert.ok(await evaluate('(() => { const b = document.getElementById("help-wheel-btn"); const r = b && b.getBoundingClientRect(); return !!r && r.width >= 24 && r.height >= 24; })()'), "Board tab has no Water Wheel door button");
  await evaluate('document.getElementById("help-tab-settings").click()');
  assert.equal(await evaluate('document.querySelector("#help-controls [data-ctl=invert]").getBoundingClientRect().height > 30'), true, "Settings tab does not show Invert");
  await evaluate('document.getElementById("help-tab-themes").click()');
  await evaluate('document.querySelector("#help-theme-grid .help-theme[data-theme=galaxy]").click()');
  assert.equal(await evaluate('window.HEXSWEEPER_SPHERE_GAME.getState().theme.id'), "galaxy", "theme grid did not apply Galaxy");
  assert.equal(await evaluate('document.querySelector("#help-theme-grid .help-theme[aria-pressed=true]").dataset.theme'), "galaxy", "theme grid did not mark Galaxy pressed");
  // Themes own the warning treatment: depth + seams everywhere except Mercury and Galaxy (continuous interiors, no seams).
  await evaluate('document.querySelector("#help-theme-grid .help-theme[data-theme=mercury]").click()');
  assert.equal(await evaluate('(() => { const s = window.HEXSWEEPER_SPHERE_GAME.getState(); return s.relief + "/" + s.seams; })()'), "extruded/false", "Mercury did not set depth + no seams");
  await evaluate('document.querySelector("#help-theme-grid .help-theme[data-theme=galaxy]").click()');
  assert.equal(await evaluate('(() => { const s = window.HEXSWEEPER_SPHERE_GAME.getState(); return s.relief + "/" + s.seams; })()'), "extruded/false", "Galaxy did not set depth + no seams");
  await evaluate('document.querySelector("#help-theme-grid .help-theme[data-theme=stratosphere]").click()');
  assert.equal(await evaluate('(() => { const s = window.HEXSWEEPER_SPHERE_GAME.getState(); return s.relief + "/" + s.seams; })()'), "extruded/true", "Stratosphere did not set depth + seams");
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
  // Game over: the banner is a labelled card (Share · Undo · New sphere) and its Undo revives the run.
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: centre.x, y: centre.y, button: "left", clickCount: 1 });
  await delay(60);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: centre.x, y: centre.y, button: "left", clickCount: 1 });
  await waitExpression('!window.HEXSWEEPER_SPHERE_GAME.getState().isFirstClick', "dig before detonation did not resolve");
  await evaluate('(() => { const g = window.HEXSWEEPER_SPHERE_GAME; const s = g.getState(); const i = s.cells.findIndex(c => c.isMine && !c.revealed); g.digAt(i); })()');
  await waitExpression('document.getElementById("sphere-banner").classList.contains("visible")', "game-over banner did not show");
  const banner = await evaluate('Array.from(document.querySelectorAll("#banner-actions .banner-btn")).filter(b => !b.hidden).map(b => b.querySelector(".banner-btn-label").textContent.trim())');
  assert.deepEqual(banner, ["Share", "Undo", "New sphere"], `banner buttons are ${banner.join(",")}`);
  await evaluate('document.getElementById("banner-undo-btn").click()');
  await delay(300);
  assert.equal(await evaluate('window.HEXSWEEPER_SPHERE_GAME.getState().isGameOver'), false, "banner Undo did not revive the run");
  await evaluate('document.getElementById("qc-reset").click()');
  await delay(300);

  // Every theme must survive a clear, a flag and a drag with the frame loop
  // intact. TestFlight 51 shipped Mercury with a missing interior painter:
  // the first clear threw inside draw(), the rAF chain died, and the sphere
  // stopped answering touch. Painters run only for revealed faces, so a
  // theme test that never clears a face proves nothing.
  const painterErrors = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") {
      const d = message.params.exceptionDetails;
      painterErrors.push((d.exception && d.exception.description) || d.text || "exception");
    }
  });
  for (const theme of help.themes) {
    await evaluate(`window.HEXSWEEPER_SPHERE_GAME.setThemeIndex(SphereSweeper.THEMES.findIndex(t => t.id === ${JSON.stringify(theme)})); void 0;`);
    await evaluate('document.getElementById("qc-reset").click()');
    await delay(250);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: centre.x, y: centre.y, button: "left", clickCount: 1 });
    await delay(60);
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: centre.x, y: centre.y, button: "left", clickCount: 1 });
    await waitExpression('!window.HEXSWEEPER_SPHERE_GAME.getState().isFirstClick', `${theme}: clear did not resolve`);
    await evaluate('(() => { const g = window.HEXSWEEPER_SPHERE_GAME; const s = g.getState(); const i = s.cells.findIndex(c => !c.revealed && !c.flagged); g.flagAt(i); })()');
    const rotBefore = await evaluate('window.HEXSWEEPER_SPHERE_GAME.getState().rotY');
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: centre.x - 60, y: centre.y, button: "left", clickCount: 1 });
    for (let i = 1; i <= 6; i++) {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: centre.x - 60 + i * 15, y: centre.y, button: "left" });
      await delay(20);
    }
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: centre.x + 30, y: centre.y, button: "left", clickCount: 1 });
    await delay(350);
    const after = await evaluate('(() => { const s = window.HEXSWEEPER_SPHERE_GAME.getState(); return { rotY: s.rotY, revealed: s.cells.filter(c => c.revealed).length, flags: s.flagsPlaced, frameAge: performance.now() - s.lastFrameAt, drawError: !!s.drawErrorReported }; })()');
    assert.ok(after.revealed > 0, `${theme}: clear revealed nothing`);
    assert.equal(after.flags, 1, `${theme}: flag did not plant`);
    assert.ok(Math.abs(after.rotY - rotBefore) > 0.3, `${theme}: drag did not rotate (${rotBefore.toFixed(2)} → ${after.rotY.toFixed(2)})`);
    assert.ok(after.frameAge < 1500, `${theme}: frame loop stalled (${Math.round(after.frameAge)}ms since last frame)`);
    assert.equal(after.drawError, false, `${theme}: draw() threw`);
    assert.deepEqual(painterErrors, [], `${theme}: uncaught exception — ${painterErrors.join(" | ")}`);
  }
  await evaluate('document.getElementById("qc-reset").click()');
  await delay(250);

  // The signed Fire build takes the Android dense-board renderer during
  // interaction. Exercise the full XL geometry, then let the complete resting
  // renderer repaint so both paths stay covered by the native-payload gate.
  await evaluate('window.HEXSWEEPER_SPHERE_GAME.setThemeIndex(SphereSweeper.THEMES.findIndex(t => t.id === "light")); window.HEXSWEEPER_SPHERE_GAME.setSize("xlarge"); void 0;');
  await waitExpression('window.HEXSWEEPER_SPHERE_GAME.getState().cells.length === 2252', "XL sphere did not build");
  const xlAmbientBefore = await evaluate('window.HEXSWEEPER_SPHERE_GAME.getState().rotY');
  await delay(180);
  const xlAmbientAfter = await evaluate('window.HEXSWEEPER_SPHERE_GAME.getState().rotY');
  assert.ok(Math.abs(xlAmbientAfter - xlAmbientBefore) > 0.001, "XL ambient spin did not advance");
  const xlRotBefore = await evaluate('window.HEXSWEEPER_SPHERE_GAME.getState().rotY');
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: centre.x - 80, y: centre.y, button: "left", clickCount: 1 });
  for (let i = 1; i <= 8; i++) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: centre.x - 80 + i * 20, y: centre.y, button: "left" });
    await delay(18);
  }
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: centre.x + 80, y: centre.y, button: "left", clickCount: 1 });
  await delay(450);
  const xlAfter = await evaluate('(() => { const s = window.HEXSWEEPER_SPHERE_GAME.getState(); return { rotY: s.rotY, drawError: !!s.drawErrorReported, frameAge: performance.now() - s.lastFrameAt }; })()');
  assert.ok(Math.abs(xlAfter.rotY - xlRotBefore) > 0.3, "XL drag did not rotate");
  assert.equal(xlAfter.drawError, false, "XL dense-board renderer threw");
  assert.ok(xlAfter.frameAge < 1500, `XL frame loop stalled (${Math.round(xlAfter.frameAge)}ms since last frame)`);
  const xlParkedAt = await evaluate('window.HEXSWEEPER_SPHERE_GAME.getState().lastFrameAt');
  await delay(260);
  assert.equal(
    await evaluate('window.HEXSWEEPER_SPHERE_GAME.getState().lastFrameAt'),
    xlParkedAt,
    "static XL sphere kept repainting after its detailed resting frame",
  );
  await evaluate('window.HEXSWEEPER_SPHERE_GAME.setSize("medium"); void 0;');
  await delay(250);

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
  // Best times: a win on XS records the size's best, the banner says so, and
  // the size pill on the sheet shows it. A slower second win leaves it alone.
  await evaluate('window.HEXSWEEPER_SPHERE_GAME.setThemeIndex(SphereSweeper.THEMES.findIndex(t => t.id === "light")); void 0;');
  await evaluate('window.HEXSWEEPER_SPHERE_GAME.setSize("xsmall"); void 0;');
  await delay(250);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: centre.x, y: centre.y, button: "left", clickCount: 1 });
  await delay(60);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: centre.x, y: centre.y, button: "left", clickCount: 1 });
  await waitExpression('!window.HEXSWEEPER_SPHERE_GAME.getState().isFirstClick', "XS first clear did not resolve");
  await evaluate('(() => { const g = window.HEXSWEEPER_SPHERE_GAME; g.getState().timeElapsed = 42; g.getState().cells.forEach((c, i) => { if (!c.isMine && !c.revealed) g.digAt(i); }); })()');
  await waitExpression('window.HEXSWEEPER_SPHERE_GAME.getState().won === true', "clearing every safe face did not win");
  const win = await evaluate(`(() => ({
    best: JSON.parse(localStorage.getItem("hexsweeper-sphere-best-v1") || "{}"),
    msg: document.getElementById("banner-msg").textContent.trim(),
    meta: document.getElementById("banner-meta").textContent.trim(),
  }))()`);
  assert.equal(win.best.xsmall && win.best.xsmall.seconds, 42, `XS best not recorded: ${JSON.stringify(win.best)}`);
  assert.match(win.meta, /First clear at this size/, `first-win banner meta is "${win.meta}"`);
  await evaluate('document.getElementById("qc-help").click()');
  await waitExpression('!document.getElementById("help-overlay").hidden', "help did not open after the win");
  assert.equal(await evaluate('localStorage.getItem("hexsweeper-sphere-sheet-tab-v1")'), "themes", "sheet did not remember the last tab");
  await evaluate('document.getElementById("help-tab-board").click()');
  assert.equal(await evaluate('document.querySelector("#help-size-grid .help-size[data-size=xsmall] [data-best]").textContent.trim()'), "Best 42s", "XS pill does not show the best time");
  assert.equal(await evaluate('document.querySelector("#help-size-grid .help-size[data-size=medium] [data-best]").hidden'), true, "M pill shows a best it never earned");
  assert.equal(await evaluate('!!document.getElementById("help-egg-hint")'), false, "the patience sentence is back on the sheet");
  await evaluate('document.getElementById("help-done-btn").click()');
  await waitExpression('document.getElementById("help-overlay").hidden', "help did not close after the win");
  await evaluate('document.getElementById("qc-reset").click()');
  await delay(250);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: centre.x, y: centre.y, button: "left", clickCount: 1 });
  await delay(60);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: centre.x, y: centre.y, button: "left", clickCount: 1 });
  await waitExpression('!window.HEXSWEEPER_SPHERE_GAME.getState().isFirstClick', "XS second first-clear did not resolve");
  await evaluate('(() => { const g = window.HEXSWEEPER_SPHERE_GAME; g.getState().timeElapsed = 90; g.getState().cells.forEach((c, i) => { if (!c.isMine && !c.revealed) g.digAt(i); }); })()');
  await waitExpression('window.HEXSWEEPER_SPHERE_GAME.getState().won === true', "second XS clear did not win");
  const slower = await evaluate(`(() => ({ best: JSON.parse(localStorage.getItem("hexsweeper-sphere-best-v1")).xsmall.seconds, meta: document.getElementById("banner-meta").textContent.trim() }))()`);
  assert.equal(slower.best, 42, "a slower win overwrote the best");
  assert.match(slower.meta, /Best 42s/, `slower-win banner meta is "${slower.meta}"`);
  await evaluate('document.getElementById("qc-reset").click()');
  await evaluate('window.HEXSWEEPER_SPHERE_GAME.setSize("medium"); void 0;');
  await delay(250);

  // The Water Wheel door: hold the mine count; the payload carries wheel.html
  // (sealed, app-flagged, its own tutorial, a Sphere pill home); the sphere
  // resumes where it was on the way back.
  assert.equal(await evaluate('window.HEXSWEEPER_WHEEL_HREF'), "wheel.html", "app payload does not point the door at wheel.html");
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: centre.x, y: centre.y, button: "left", clickCount: 1 });
  await delay(60);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: centre.x, y: centre.y, button: "left", clickCount: 1 });
  await waitExpression('!window.HEXSWEEPER_SPHERE_GAME.getState().isFirstClick', "pre-wheel clear did not resolve");
  const revealedBeforeWheel = await evaluate('window.HEXSWEEPER_SPHERE_GAME.getState().cells.filter(c => c.revealed).length');
  const door = await evaluate('(() => { const r = document.querySelector(".qc-mines").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()');
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: door.x, y: door.y }] });
  await delay(600);
  assert.equal(await evaluate('document.querySelector(".qc-mines").classList.contains("is-hinting")'), true, "holding the mine count shows no water rising");
  await delay(1000);
  await waitExpression('location.pathname.endsWith("/wheel.html") && document.readyState === "complete"', "holding the mine count did not open the Water Wheel");
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }).catch(() => {});
  await delay(600);
  const wheel = await evaluate(`(() => ({
    app: window.HEXSWEEPER_SPHERE_APP === true,
    alert: !!document.getElementById("wheel-alert"),
    canvas: !!document.getElementById("gameCanvas"),
    back: (document.querySelector(".app-back") || {}).getAttribute && document.querySelector(".app-back").getAttribute("href"),
    backText: (document.querySelector(".app-back") || {}).textContent,
    globe: !!(window.SphereSweeper && SphereSweeper.THEMES && SphereSweeper.THEMES.some(t => t.globeMap)),
    remote: Array.from(document.querySelectorAll("img[src], script[src], link[href]")).map(e => e.src || e.href).filter(u => /^https?:/.test(u)),
  }))()`);
  assert.equal(wheel.app, true, "wheel.html is not app-flagged");
  assert.ok(wheel.alert && wheel.canvas, "wheel.html is not the Water Wheel");
  assert.equal(wheel.back, "index.html", `Wheel's Sphere pill points at ${wheel.back}`);
  assert.match(wheel.backText || "", /Sphere/, "Wheel's back pill is not labelled Sphere");
  assert.equal(wheel.globe, false, "Wheel still lists a globe (network) theme in the app");
  assert.deepEqual(wheel.remote, [], `wheel.html reaches off-device: ${wheel.remote.join(", ")}`);
  await evaluate('document.querySelector(".app-back").click()');
  await waitExpression('location.pathname.endsWith("/index.html") && document.readyState === "complete" && !!window.HEXSWEEPER_SPHERE_GAME', "Sphere pill did not return to the sphere");
  await delay(500);
  assert.equal(await evaluate('window.HEXSWEEPER_SPHERE_GAME.getState().cells.filter(c => c.revealed).length'), revealedBeforeWheel, "the sphere did not resume its run after the Wheel");
  await evaluate('document.getElementById("qc-reset").click()');
  await delay(250);
  await evaluate('window.HEXSWEEPER_SPHERE_GAME.setThemeIndex(SphereSweeper.THEMES.findIndex(t => t.id === "mercury")); void 0;');
  await delay(400);

  // Rotation: the canvas bitmap must always match its element, and a stale
  // backing store (iOS drops/mis-times the orientation resize) must heal
  // itself within a frame — build 59 stayed squashed in portrait forever.
  const matches = '(() => { const c = document.getElementById("gameCanvas"); const cap = /Android/i.test(navigator.userAgent) ? 1.1 : 2; const dpr = Math.min(devicePixelRatio || 1, cap); return c.width === Math.round(c.clientWidth * dpr) && c.height === Math.round(c.clientHeight * dpr); })()';
  const sized = async (label) => {
    // The guarantee is "heals within a frame or two", not "synchronously".
    await waitFor(async () => evaluate(matches), `${label}: canvas bitmap never matched its element`);
    return evaluate('(() => { const c = document.getElementById("gameCanvas"); return { w: c.clientWidth, h: c.clientHeight, bw: c.width, bh: c.height }; })()');
  };
  await sized("portrait");
  await send("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 2, mobile: true });
  await delay(500);
  const land = await sized("landscape");
  assert.ok(land.w > land.h, `landscape did not apply (${land.w}x${land.h})`);
  await evaluate('(() => { const c = document.getElementById("gameCanvas"); c.width = 780; c.height = 1688; })()');
  await waitExpression(matches, "a stale canvas bitmap did not heal itself");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await delay(500);
  const back = await sized("back to portrait");
  assert.ok(back.h > back.w, `portrait did not restore (${back.w}x${back.h})`);
  assert.ok(await evaluate('window.HEXSWEEPER_SPHERE_GAME.getSphereScreen().r > 40'), "sphere collapsed after the rotation round trip");

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
