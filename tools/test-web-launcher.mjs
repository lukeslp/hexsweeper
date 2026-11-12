#!/usr/bin/env node
// Static contract for the generated web surface: Sphere at the root, the
// three-hex launcher at launcher.html, and their destinations.

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const rootPage = read("index.html");
const launcher = read("launcher.html");
const appRoot = read("build/app/index.html");
const template = read("tools/app-launcher.html");
const core = read("core.js");
const infinite = read("infinite.html");
const bounded = read("bounded.html");
const sphere = read("sphere/index.html");
const play = read("play.html");

for (const [label, href] of [
  ["Infinite", "infinite.html"],
  ["Classic", "bounded.html"],
  ["Sphere", "index.html"],
]) {
  expect(launcher.includes(href), `launcher is missing the ${label} route (${href})`);
}

// Root is Sphere itself: sealed engine, Mercury available, Games pill down to
// the launcher, and no prompt in the way — Sphere restores its own autosave.
expect(rootPage.includes("HEXSWEEPER_SPHERE_GAME"), "root Sphere does not expose the game");
expect(!rootPage.includes("resume-gate"), "root Sphere still carries a resume prompt");
expect(!rootPage.includes('class="app-back"'), "root Sphere grew a Games pill; the sphere is the front door");
expect(rootPage.includes('id: "mercury"') && rootPage.includes("global.MirrorMaterial = {"), "root Sphere is missing the Mercury theme or its renderer");
expect(rootPage.includes('<link rel="stylesheet" href="fonts/fonts.css">'), "root Sphere inlines fonts instead of linking them");
expect(rootPage.includes('rel="canonical" href="https://dr.eamer.dev/games/hexsweeper/"'), "root canonical is wrong");
expect(rootPage.includes('location.replace("play.html" + location.search + location.hash)'), "legacy ?mode= root queries do not forward to play.html");
expect(!rootPage.includes("user-scalable=no"), "root Sphere disables browser zoom");
expect(rootPage.includes('data-goatcounter="https://stats.dr.eamer.dev/count"'), "root analytics tag is missing");
expect(rootPage.includes('name: "Mercury"') && sphere.includes('src="mirror-material.js?v='), "Sphere page does not load the reflection renderer");

// App payload is Sphere and nothing else: no launcher, no flat games, no pill.
expect(appRoot.includes("window.HEXSWEEPER_SPHERE_APP = true;"), "app root is not the sealed Sphere");
expect(!appRoot.includes("resume-gate"), "app root still carries a resume prompt");
expect(!appRoot.includes('class="app-back"'), "app root grew a Games pill");
expect(!existsSync(join(root, "build/app/games")), "app payload still ships games/ (launcher, Infinite, Classic)");
expect(appRoot.includes('id: "mercury"') && appRoot.includes("global.MirrorMaterial = {"), "app root is missing Mercury or its renderer");
expect(appRoot.includes("initQuietChrome") && !appRoot.includes("initHexBloom("), "app root does not boot the quiet chrome");
expect(appRoot.includes('id="help-theme-grid"') && appRoot.includes('id="help-size-grid"') && !appRoot.includes('id="help-warn-grid"'), "settings sheet should carry theme + size and no warnings group (themes own it)");
expect(appRoot.includes("HEXSWEEPER_REFLECTION_TEXTURES = (function(){") && appRoot.includes("data:image/webp;base64,"), "app root does not seal the reflection textures");
expect(!appRoot.includes("HEXSWEEPER_REFLECTION_TEXTURE_BASE = "), "app root still assigns a texture URL base");
expect(rootPage.includes('HEXSWEEPER_REFLECTION_TEXTURE_BASE = "sphere/"'), "web root does not point reflection textures at sphere/");
for (const id of ["stratosphere", "ion-storm", "aurora", "galaxy", "heat-lightning"]) {
  expect(rootPage.includes(`id: "${id}"`), `root Sphere is missing the ${id} theme`);
}
for (const id of ["stratosphere", "ion-storm", "galaxy", "heat-lightning"]) {
  expect(appRoot.includes(`"${id}":{desktop:t`), `app root does not seal the ${id} texture`);
}
expect(existsSync(join(root, "sphere/assets/reflections/stratosphere-1024.webp")) && existsSync(join(root, "sphere/assets/reflections/ion-storm-768.webp")), "reflection textures are not under sphere/assets/reflections");
expect(!appRoot.includes("https://stats.dr.eamer.dev"), "app root leaks analytics");

for (const [label, selector] of [
  ["Infinite mode", 'id="infinite-game" href="infinite.html?mode=light&amp;fresh=1" data-mode="infinite" data-branch="infinite" data-q="0" data-r="-1"'],
  ["Classic mode", 'id="classic-game" href="bounded.html?size=medium&amp;new=1" data-mode="bounded" data-branch="classic" data-q="1" data-r="0"'],
  ["Sphere mode", 'id="sphere-game" href="index.html?theme=light&amp;fresh=1" data-mode="sphere" data-branch="sphere" data-q="-1" data-r="1"'],
]) {
  expect(launcher.includes(selector), `launcher lost ${label}`);
}
expect(
  launcher.includes('id="resume-game"') && launcher.includes('data-q="0" data-r="0"'),
  "Resume is no longer centered",
);
expect(
  template.includes('class="triad"') &&
    template.includes('id="infinite-game"') &&
    template.includes('id="classic-game"') &&
    template.includes('id="sphere-game"') &&
    template.includes('id="resume-game"') &&
    template.includes('style="--q:0;--r:-1"') &&
    template.includes('style="--q:1;--r:0"') &&
    template.includes('style="--q:-1;--r:1"') &&
    template.includes('style="--q:0;--r:0"'),
  "launcher is no longer a three-hex picker with a centered Resume",
);
expect(
  !template.includes("Hexsweeper.boot") &&
    !template.includes('id="launcher-canvas"') &&
    !template.includes("function openBloom(") &&
    !template.includes("function layoutChoiceSeats("),
  "launcher kept the playable-board menu or settings blooms",
);
expect(
  core.includes("exportRunState()") && core.includes("applyRunState(data)"),
  "core no longer exposes topology-safe run persistence",
);
expect(
  bounded.includes('CLASSIC_RUN_KEY = "hexsweeper-classic-run-v1"') &&
    bounded.includes("classicGame.applyRunState(savedClassicRun)") &&
    launcher.includes("hexsweeper-classic-run-v1"),
  "Classic active runs no longer feed the centered Resume tile",
);

expect(launcher.includes('<meta name="robots" content="noindex">'), "unlinked launcher lost its noindex");
expect(
  template.includes('href: "{{SPHERE_HREF}}?resume=1"'),
  "Sphere resume route does not skip the root gate",
);
expect(
  launcher.includes('class="launcher-fallback"') && launcher.includes("<noscript>"),
  "launcher has no no-script route fallback",
);
expect(
  launcher.includes('data-goatcounter="https://stats.dr.eamer.dev/count"'),
  "launcher analytics tag is missing",
);
expect(!/\{\{[A-Z_]+\}\}/.test(launcher), "generated launcher contains an unresolved placeholder");

for (const [label, page, canonical] of [
  ["Infinite", infinite, "/infinite.html"],
  ["Classic", bounded, "/bounded.html"],
]) {
  expect(page.includes(`rel="canonical" href="https://dr.eamer.dev/games/hexsweeper${canonical}"`), `${label} canonical is wrong`);
}
// Every web game stands alone: nothing links back to the launcher.
for (const [label, page] of [["Infinite", infinite], ["Classic", bounded], ["Root", rootPage], ["Sphere", sphere]]) {
  expect(!page.includes("launcher.html\""), `${label} links to the unlisted launcher`);
  expect(!page.includes('class="app-back"') && !page.includes('class="web-games-back"'), `${label} grew a Games pill`);
}
expect(infinite.includes('"stillPlane": true'), "standalone Infinite lost its still plane");
// Infinite help matches Sphere: no card, one line + three rows, no tooltips.
expect(infinite.includes('"minimalHelp": true'), "Infinite lost its minimal-help config");
expect(!infinite.includes('id="welcome-overlay"'), "Infinite carries the welcome card again");
expect(!/\stitle="/.test(infinite), "Infinite has a title= tooltip");
expect(!infinite.includes('class="help-glyphs"') && !infinite.includes('id="help-body"') && !infinite.includes("wikipedia.org"), "Infinite help grew back its glyph grid, paragraphs or Wikipedia line");
expect((infinite.match(/<li><span class="act">/g) || []).length === 3, "Infinite help should have exactly three control rows");
// Infinite has one sheet, Sphere's: no Menu, one Help and settings button,
// tabs Play · Look · Settings, and Sphere's sheet CSS copied verbatim.
expect(!infinite.includes('id="modal-overlay"') && !infinite.includes('id="menu-btn"'), "Infinite grew back its separate Menu");
expect((infinite.match(/id="help-overlay"/g) || []).length === 1, "Infinite should have exactly one sheet");
// Quiet chrome (minimal brief): a top readout and a bottom bar of bare icon
// buttons, New board · Flag mode | Help and settings; no glass pill.
expect(infinite.includes('<p class="readout" id="readout">'), "Infinite lost its top readout");
expect(infinite.includes('<div class="bar" role="toolbar" aria-label="Game controls">'), "Infinite lost its bottom bar");
for (const [id, label] of [["reset-btn", "New board"], ["flag-btn", "Flag mode"], ["help-btn", "Help and settings"]]) {
  expect(infinite.includes(`id="${id}" class="ib" aria-label="${label}"`), `Infinite bar lost ${label}`);
}
expect(!infinite.includes('class="hud-actions') && !infinite.includes('id="plate-toggle"'), "Infinite grew back its glass pill or Appearance button");
expect(
  infinite.includes('<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff">') &&
    infinite.includes('<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000">'),
  "Infinite needs one theme-color per scheme",
);
expect(infinite.includes("<main class=\"game\">") && infinite.includes('<h1 class="sr-only">Hexsweeper Infinite</h1>'), "Infinite lost its main landmark or sr-only title");
expect(
  ["play", "look", "settings"].every((t) => infinite.includes(`role="tab" class="help-tab" id="help-tab-${t}"`)) &&
    (infinite.match(/role="tab"/g) || []).length === 3,
  "Infinite sheet tabs should be Play · Look · Settings",
);
expect(infinite.includes('<h2 id="help-title">Hexsweeper Infinite <span class="help-title-sub">settings</span></h2>'), "Infinite sheet title drifted from Sphere's header style");
expect(infinite.includes('id="help-tabstack"') && sphere.includes('id="help-tabstack"'), "a sheet lost its one-height tab stack");
for (const id of ["fx-btn", "export-run-btn", "import-run-btn", "import-run-file"]) {
  expect(infinite.includes(`id="${id}"`), `Infinite sheet lost #${id}`);
}
// The score lives in the readout and Flag mode in the bar, not twice.
expect(!infinite.includes('id="stats-mines"') && !infinite.includes('class="help-score"'), "Infinite sheet still carries the score line");
expect((infinite.match(/id="flag-btn"/g) || []).length === 1, "Infinite should have one Flag mode control");
expect(
  [...infinite.matchAll(/class="help-theme" data-(?:plate|mode)="([a-z]+)"/g)].map((m) => m[1]).join(" ") === "system light dark",
  "Infinite Look tab should offer exactly System, Light and Dark, in that order",
);
expect(
  infinite.includes('class="help-theme" data-plate="system" aria-pressed="true"'),
  "Infinite Look tab should start on System",
);
{
  const block = (sphere.match(/\/\* sheet:begin [\s\S]*?\/\* sheet:end \*\/\n/) || [""])[0];
  expect(block && infinite.includes(block), "Infinite sheet CSS is not Sphere's sheet:begin … sheet:end block");
}
expect(play.includes('id="modal-overlay"') && play.includes('id="menu-btn"'), "play.html lost its own Menu");
expect(play.includes('id="help-body"') && play.includes('id="welcome-overlay"'), "play.html lost its own help sheet or welcome preview");

for (const [label, page] of [
  ["Infinite", infinite],
  ["Classic", bounded],
  ["Sphere", sphere],
]) {
  expect(!page.includes("user-scalable=no"), `${label} disables browser zoom`);
  expect(!page.includes("maximum-scale=1"), `${label} caps browser zoom`);
}

expect(sphere.includes("window.HEXSWEEPER_SPHERE_GAME = sphereGame;"), "Sphere page no longer exposes the game");
expect(play.includes("ONEPAGER_MODES") && play.includes('id="gameCanvas"'), "play.html no longer contains the flat game source");

for (const placeholder of [
  "{{INFINITE_HREF}}",
  "{{BOUNDED_HREF}}",
  "{{SPHERE_HREF}}",
  "{{PLATFORM_HEAD}}",
  "{{PLATFORM_TAIL}}",
]) {
  expect(template.includes(placeholder), `shared launcher template lost ${placeholder}`);
}

if (failures.length) {
  console.error(`web launcher contract failed (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("web launcher contract: ok");

// Infinite's Look tab in a real browser: System follows the scheme live, a
// Light / Dark pick survives a reload, and System forgets the pick again.
// HEXSWEEPER_SKIP_BROWSER=1 skips this step where Chrome is not installed.
const chromePath = process.env.CHROME_PATH || [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium", "/usr/bin/chromium-browser",
].find(existsSync);
if (process.env.HEXSWEEPER_SKIP_BROWSER === "1") {
  console.log("infinite look (browser): skipped");
} else {
  if (!chromePath) throw new Error("Chrome is unavailable; set CHROME_PATH to an installed browser");
  await infiniteLookBrowser();
  console.log("infinite look (browser): ok");
}

async function infiniteLookBrowser() {
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
  const mime = { ".css": "text/css", ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".woff2": "font/woff2" };
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
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const url = `http://127.0.0.1:${server.address().port}/infinite.html`;
  const profile = await mkdtemp(join(tmpdir(), "hexsweeper-infinite-"));
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
    const scheme = (value) => send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value }] });
    const load = async (navigate) => {
      if (navigate) await send("Page.navigate", { url });
      else await send("Page.reload", { ignoreCache: true });
      await waitFor(() => evaluate('location.pathname.endsWith("/infinite.html") && document.readyState === "complete" && !!document.querySelector("#help-panel-look .help-theme")'), "Infinite did not load");
      await delay(150);
    };
    // The live look: plate, html[data-theme], both theme-color metas, pressed tile, saved key.
    const look = () => evaluate(`(() => ({
      plate: document.body.dataset.mode,
      forced: document.documentElement.dataset.theme,
      metas: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content),
      pressed: [...document.querySelectorAll("#help-panel-look .help-theme")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.textContent.trim()),
      saved: localStorage.getItem("hexsweeper-infinite-theme-v1"),
    }))()`);
    const tile = (name) => evaluate(`[...document.querySelectorAll("#help-panel-look .help-theme")].find((b) => b.textContent.trim() === ${JSON.stringify(name)}).click()`);
    const check = async (want, step) => {
      const got = await waitFor(async () => {
        const l = await look();
        return l.plate === want.plate ? l : null;
      }, `${step}: plate never became ${want.plate}`).catch(async (e) => { failures.push(`${e.message} (${JSON.stringify(await look())})`); return null; });
      if (!got) return;
      const bg = want.plate === "dark" ? "#000000" : "#ffffff";
      if (got.forced !== want.plate) failures.push(`${step}: html[data-theme] is ${got.forced}, want ${want.plate}`);
      if (got.metas.length !== 2 || got.metas.some((c) => c.toLowerCase() !== bg)) failures.push(`${step}: theme-color metas ${JSON.stringify(got.metas)}, want both ${bg}`);
      if (got.pressed.join() !== want.pressed) failures.push(`${step}: pressed ${JSON.stringify(got.pressed)}, want ${want.pressed}`);
      if (got.saved !== want.saved) failures.push(`${step}: saved key ${got.saved}, want ${want.saved}`);
    };
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 393, height: 852, deviceScaleFactor: 1, mobile: false });

    // Default: nothing saved, System pressed, follows the scheme live.
    await scheme("light");
    await load(true);
    await evaluate("localStorage.clear()");
    await load(false);
    await check({ plate: "light", pressed: "System", saved: null }, "default, light scheme");
    await scheme("dark");
    await check({ plate: "dark", pressed: "System", saved: null }, "default, live switch to dark");
    await load(false);
    await check({ plate: "dark", pressed: "System", saved: null }, "default, dark scheme after reload");

    // Light overrides a dark system and survives a reload and a scheme switch.
    await tile("Light");
    await check({ plate: "light", pressed: "Light", saved: "light" }, "picked Light");
    await load(false);
    await check({ plate: "light", pressed: "Light", saved: "light" }, "Light after reload");
    await scheme("light");
    await scheme("dark");
    await check({ plate: "light", pressed: "Light", saved: "light" }, "Light ignores a scheme switch");

    // Dark over a light system, across a reload.
    await scheme("light");
    await tile("Dark");
    await check({ plate: "dark", pressed: "Dark", saved: "dark" }, "picked Dark");
    await load(false);
    await check({ plate: "dark", pressed: "Dark", saved: "dark" }, "Dark after reload");

    // System clears the key and follows a live switch again.
    await tile("System");
    await check({ plate: "light", pressed: "System", saved: null }, "picked System");
    await scheme("dark");
    await check({ plate: "dark", pressed: "System", saved: null }, "System follows a live switch");
    await load(false);
    await check({ plate: "dark", pressed: "System", saved: null }, "System after reload");

    // T steps System → Light → Dark → System.
    const press = async (key) => {
      for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key, text: type === "keyDown" ? key : undefined, code: "KeyT", windowsVirtualKeyCode: 84 });
    };
    await press("t");
    await check({ plate: "light", pressed: "Light", saved: "light" }, "T to Light");
    await press("t");
    await check({ plate: "dark", pressed: "Dark", saved: "dark" }, "T to Dark");
    await scheme("light");
    await press("t");
    await check({ plate: "light", pressed: "System", saved: null }, "T back to System");
  } finally {
    try { socket?.close(); } catch (_) {}
    chrome.kill();
    server.close();
    await delay(200);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
  if (failures.length) {
    console.error(`infinite look (browser) failed (${failures.length})`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }
}
