#!/usr/bin/env node
// site-move.js on real pages in Chrome. Every request is answered from this
// checkout through the DevTools Fetch domain, so the pages run under their
// real host names (https://dr.eamer.dev, https://lukesteuber.com) and under
// hosts that must be left alone (localhost, 127.0.0.1, another domain,
// file://). Covers: saves made on the old host arrive on the new one before
// the game reads storage, referred by dr.eamer.dev; better records and
// existing settings survive; a crafted link with no referrer, or followed
// from another site, imports nothing and leaves no trace; a malformed board
// is rejected even from dr.eamer.dev; the fragment is stripped and never
// reaches a server or a Referer; a reload or a replayed link does not import
// again; other hosts do nothing.
// CHROME_PATH picks the browser; HEXSWEEPER_SKIP_BROWSER=1 skips the file.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
  console.log("site move (browser): skipped");
  process.exit(0);
}
if (!chromePath) throw new Error("Chrome is unavailable; set CHROME_PATH to an installed browser");

const delay = (ms) => new Promise((done) => setTimeout(done, ms));
async function waitFor(fn, message, timeout = 15000) {
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

const OLD = "https://dr.eamer.dev/games/hexsweeper";
const NEW = "https://lukesteuber.com/games/hexsweeper";
const SERVED = new Set(["dr.eamer.dev", "lukesteuber.com", "localhost", "127.0.0.1", "hexsweeper.example"]);
const mime = { ".css": "text/css", ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".woff2": "font/woff2", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".json": "application/json", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

/** The checkout, as /games/hexsweeper/ on every host the test serves. */
async function answer(url) {
  const u = new URL(url);
  if (!SERVED.has(u.hostname) || !u.pathname.startsWith("/games/hexsweeper")) return { status: 204, body: Buffer.alloc(0), type: "text/plain" };
  let rel = decodeURIComponent(u.pathname.slice("/games/hexsweeper".length)).replace(/^\/+/, "");
  if (rel === "" || rel.endsWith("/")) rel += "index.html";
  const file = normalize(join(root, rel));
  if (!file.startsWith(`${root}/`)) return { status: 404, body: Buffer.alloc(0), type: "text/plain" };
  try {
    return { status: 200, body: await readFile(file), type: mime[extname(file)] || "application/octet-stream" };
  } catch (_) {
    return { status: 404, body: Buffer.alloc(0), type: "text/plain" };
  }
}

const profile = await mkdtemp(join(tmpdir(), "hexsweeper-move-"));
const chrome = spawn(chromePath, [
  "--headless=new",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
  "--remote-debugging-port=0",
  "--allow-file-access-from-files",
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
  const requests = [];
  const landings = [];
  const send = (method, params = {}) => new Promise((done, fail) => {
    const id = ++nextId;
    pending.set(id, { done, fail });
    socket.send(JSON.stringify({ id, method, params }));
  });
  socket.addEventListener("message", async (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { done, fail } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) fail(new Error(msg.error.message));
      else done(msg.result);
      return;
    }
    if (msg.method === "Fetch.requestPaused") {
      const { requestId, request } = msg.params;
      requests.push({ url: request.url, referer: request.headers.Referer || request.headers.referer || "" });
      const got = await answer(request.url);
      send("Fetch.fulfillRequest", {
        requestId,
        responseCode: got.status,
        responseHeaders: [{ name: "content-type", value: got.type }, { name: "cache-control", value: "no-store" }],
        body: got.body.toString("base64"),
      }).catch(() => {});
    }
    if (msg.method === "Page.frameNavigated" && !msg.params.frame.parentId) {
      landings.push(msg.params.frame.url + (msg.params.frame.urlFragment || ""));
    }
  });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const open = async (url, ready = "true") => {
    await send("Page.navigate", { url });
    await delay(100);
    await waitFor(() => evaluate(`document.readyState === "complete" && (${ready})`), `${url} did not load`);
  };
  /** Follow a link from a page, so the browser sends that page's referrer. */
  const follow = async (from, to, ready = "true") => {
    await open(from);
    const host = new URL(to).hostname;
    await evaluate(`location.href = ${JSON.stringify(to)}`);
    await waitFor(async () => (await evaluate("location.hostname")) === host && (await evaluate(`document.readyState === "complete" && (${ready})`)), `${to.slice(0, 60)} did not load`);
  };
  const dump = () => evaluate("JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])))").then(JSON.parse);
  const sphereReady = "!!window.HEXSWEEPER_SPHERE_GAME";

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "http://*" }, { urlPattern: "https://*" }] });
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

  // ---- 1. Saves on lukesteuber.com before the move -------------------------
  await open(`${NEW}/privacy.html`);
  expect(await evaluate("location.href") === `${NEW}/privacy.html`, "lukesteuber.com redirected a plain visit");
  await evaluate(`localStorage.clear();
    localStorage.setItem("hexsweeper-sphere-best-v1", JSON.stringify({ easy: { seconds: 40, at: "keep" }, medium: { seconds: 250, at: "slower" } }));
    localStorage.setItem("hexsweeper-effects-v1", "full");`);

  // ---- 2. A player on dr.eamer.dev (?stay=1 keeps them there) --------------
  await open(`${OLD}/index.html?stay=1`, sphereReady);
  expect((await evaluate("location.hostname")) === "dr.eamer.dev", "?stay=1 did not keep dr.eamer.dev");
  await evaluate("localStorage.clear(); sessionStorage.clear()");
  await open(`${OLD}/index.html?stay=1&fresh=1`, sphereReady);
  // A real unfinished Large board: pick Large, dig a safe face, let autosave run.
  const board = await evaluate(`(async () => {
    const g = HEXSWEEPER_SPHERE_GAME;
    g.setSize("hard");
    await new Promise((r) => setTimeout(r, 300));
    g.digAt(0);
    await new Promise((r) => setTimeout(r, 600));
    const s = g.getState();
    return { size: s.difficulty, revealed: s.cells.filter((c) => c.revealed).length, over: s.isGameOver, saved: localStorage.getItem("hexsweeper-sphere-run-v2") };
  })()`);
  expect(board.size === "hard" && board.revealed > 0 && !board.over && board.saved, `could not make an unfinished Large board on dr.eamer.dev: ${JSON.stringify({ ...board, saved: !!board.saved })}`);
  // A large Infinite plate in the shape core.js saves: far past the budget.
  const plateCells = [];
  for (let q = -150; q <= 150; q++) for (let r = Math.max(-150, -q - 150); r <= Math.min(150, -q + 150); r++) plateCells.push(`${q},${r}`);
  const plate = JSON.stringify({ v: 1, endless: true, difficulty: "medium", density: 0.16, radius: 150, first: false, over: false, win: null, endReason: null, finish: null, cleared: 1, flags: 0, mineCount: 9, time: 9, cam: [0, 0], zoom: 1, mines: plateCells.filter((_, i) => i % 6 === 0), revealed: plateCells.filter((_, i) => i % 6 === 1), flagged: [], torn: [], mode: "light", savedAt: 1 });
  await evaluate(`
    localStorage.setItem("hexsweeper-sphere-best-v1", JSON.stringify({ easy: { seconds: 50, at: "2026-10-01T10:00:00.000Z" }, medium: { seconds: 200, at: "2026-10-02T10:00:00.000Z" }, xlarge: { seconds: 999, at: null } }));
    localStorage.setItem("hexsweeper-endless-best", "77");
    localStorage.setItem("hexsweeper-effects-v1", "reduced");
    localStorage.setItem("hexsweeper-infinite-theme-v1", "dark");
    localStorage.setItem("hexsweeper-mode-v3", "<img>");
    localStorage.setItem("someone-else", "private");
    localStorage.setItem("hexsweeper-endless-plate-v1", ${JSON.stringify(plate)});`);
  const before = await dump();

  // ---- 3. The move ---------------------------------------------------------
  requests.length = 0;
  landings.length = 0;
  await send("Page.navigate", { url: `${OLD}/index.html?x=1#keep` });
  await waitFor(async () => (await evaluate("location.hostname")) === "lukesteuber.com" && (await evaluate(`document.readyState === "complete" && ${sphereReady}`)), "dr.eamer.dev did not hand off to lukesteuber.com");
  await delay(300);
  const handoff = landings.find((url) => url.startsWith(NEW) && url.includes("#hexsweeper-move="));
  expect(!!handoff, `no hand-off landing seen: ${landings.join(" | ")}`);
  if (handoff) {
    const fragment = handoff.slice(handoff.indexOf("#"));
    expect(fragment.length < 16100, `hand-off fragment is ${fragment.length} characters`);
    expect(handoff.startsWith(`${NEW}/index.html?x=1#hexsweeper-move=`), `hand-off went to ${handoff.slice(0, 80)}`);
  }
  expect(await evaluate("location.href") === `${NEW}/index.html?x=1#keep`, `address after the move is ${await evaluate("location.href")}`);
  expect(await evaluate("document.referrer") === "https://dr.eamer.dev/", `the moved page was referred by ${JSON.stringify(await evaluate("document.referrer"))}`);
  for (const r of requests) {
    expect(!r.url.includes("hexsweeper-move") && !r.referer.includes("hexsweeper-move"), `the hand-off reached a request: ${r.url.slice(0, 80)} (Referer ${r.referer.slice(0, 80)})`);
  }
  const game = await evaluate(`(() => { const s = HEXSWEEPER_SPHERE_GAME.getState(); return { size: s.difficulty, revealed: s.cells.filter((c) => c.revealed).length, best: HEXSWEEPER_SPHERE_GAME.getBestTimes() }; })()`);
  expect(game.size === "hard", `the moved game opened on ${game.size}, want hard: the import ran after the game read storage`);
  expect(game.revealed === board.revealed, `the moved board shows ${game.revealed} open faces, want ${board.revealed}`);
  expect(game.best.easy?.seconds === 40, `a better best time on lukesteuber.com was overwritten (easy ${game.best.easy?.seconds})`);
  expect(game.best.medium?.seconds === 200, `a better best time from dr.eamer.dev was not taken (medium ${game.best.medium?.seconds})`);
  expect(game.best.xlarge?.seconds === 999, "a best time only dr.eamer.dev had did not arrive");
  const after = await dump();
  expect(after["hexsweeper-effects-v1"] === "full", "an existing lukesteuber.com setting was overwritten");
  expect(after["hexsweeper-infinite-theme-v1"] === "dark", "a setting did not arrive");
  expect(after["hexsweeper-endless-best"] === "77", "the endless best did not arrive");
  expect(!("hexsweeper-mode-v3" in after), "a malformed setting was imported");
  expect(!("someone-else" in after), "a key that is not the game's was imported");
  expect(!("hexsweeper-endless-plate-v1" in after), "the oversized Infinite plate should have been dropped");
  const report = await evaluate("JSON.parse(JSON.stringify(HexsweeperSiteMove.last))");
  expect(report?.dropped?.includes("hexsweeper-endless-plate-v1"), `the drop was not reported: ${JSON.stringify(report)}`);
  expect(report?.imported?.includes("hexsweeper-sphere-run-v2"), "the board was not reported as imported");

  // dr.eamer.dev keeps its copy: nothing there is deleted.
  await open(`${OLD}/privacy.html?stay=1`);
  const oldAfter = await dump();
  for (const key of Object.keys(before)) expect(key in oldAfter, `dr.eamer.dev lost ${key}`);

  // ---- 4. No second import -------------------------------------------------
  await open(`${NEW}/privacy.html`);
  await evaluate(`localStorage.removeItem("hexsweeper-endless-best"); localStorage.removeItem("hexsweeper-infinite-theme-v1")`);
  await send("Page.reload");
  await delay(200);
  await waitFor(() => evaluate("document.readyState === 'complete'"), "reload did not finish");
  let now = await dump();
  expect(!("hexsweeper-endless-best" in now) && !("hexsweeper-infinite-theme-v1" in now), "a reload imported again");
  if (handoff) {
    // The same hand-off again, followed from dr.eamer.dev: remembered, not imported.
    await follow(`${OLD}/privacy.html?stay=1`, handoff.replace("/index.html?", "/privacy.html?"));
    now = await dump();
    expect(!("hexsweeper-endless-best" in now) && !("hexsweeper-infinite-theme-v1" in now), "a replayed hand-off link imported again");
    expect(await evaluate("location.hash") === "#keep", "a replayed hand-off kept its fragment");
    expect(await evaluate("HexsweeperSiteMove.last && HexsweeperSiteMove.last.repeat") === true, "a replayed hand-off was not recognized");
  }

  // ---- 5. Crafted links ------------------------------------------------------
  const encode = (payload) => evaluate(`HexsweeperSiteMove.encode(${JSON.stringify(JSON.stringify(payload))})`);
  const planted = await encode({ v: 1, id: "craft-1", x: [], d: {
    "hexsweeper-sphere-best-v1": JSON.stringify({ xsmall: { seconds: 3, at: null } }),
    "hexsweeper-endless-best": "99999",
    "hexsweeper-sphere-size-v2": "xlarge",
  } });
  const plantedElsewhere = await encode({ v: 1, id: "craft-3", x: [], d: { "hexsweeper-endless-best": "88888", "hexsweeper-sphere-size-v2": "xsmall" } });
  const badBoard = await encode({ v: 1, id: "craft-2", x: [], d: {
    "hexsweeper-sphere-best-v1": JSON.stringify({ xsmall: { seconds: 3, at: null } }),
    "hexsweeper-sphere-run-v2": JSON.stringify({ v: 2, kind: "sphere", difficulty: "xsmall", mines: [1, 2, 900], revealed: [], flagged: [] }),
  } });
  const cases = [
    ["a well-formed link with no referrer", (url) => open(url), planted],
    ["a well-formed link followed from another site", (url) => follow("https://hexsweeper.example/games/hexsweeper/privacy.html", url), plantedElsewhere],
    ["a malformed board followed from dr.eamer.dev", (url) => follow(`${OLD}/privacy.html?stay=1`, url), badBoard],
    ["junk followed from dr.eamer.dev", (url) => follow(`${OLD}/privacy.html?stay=1`, url), "!!!not-a-handoff"],
    ["an oversized fragment with no referrer", (url) => open(url), "A".repeat(50000)],
  ];
  // A new query each time: a change of fragment alone would not load the page.
  for (const [i, [why, go, frag]] of cases.entries()) {
    await open(`${NEW}/privacy.html`);
    const was = await dump();
    await go(`${NEW}/privacy.html?m=${i}#hexsweeper-move=${frag}`);
    const is = await dump();
    expect(JSON.stringify(is) === JSON.stringify(was), `${why} changed storage: ${Object.keys(is).filter((k) => is[k] !== was[k]).join(", ")}`);
    expect(await evaluate("location.hash") === "" && await evaluate("location.search") === `?m=${i}`, `${why} was not stripped`);
  }

  // ---- 6. Other hosts do nothing ------------------------------------------
  const valid = await encode({ v: 1, id: "other-1", x: [], d: { "hexsweeper-sphere-size-v2": "hard" } });
  for (const base of ["http://localhost/games/hexsweeper", "http://127.0.0.1/games/hexsweeper", "https://hexsweeper.example/games/hexsweeper", pathToFileURL(root).href]) {
    const url = `${base}/privacy.html#hexsweeper-move=${valid}`;
    await open(url);
    expect(await evaluate("location.href") === url, `${base} moved or rewrote the address`);
    expect(await evaluate("localStorage.getItem('hexsweeper-sphere-size-v2')") === null, `${base} imported a hand-off`);
  }
  await open(`${OLD}/play.html?stay=1`);
  expect(await evaluate("location.hostname") === "dr.eamer.dev", "dr.eamer.dev ?stay=1 still moved");
} finally {
  try { socket?.close(); } catch (_) {}
  chrome.kill();
  await delay(300);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

if (failures.length) {
  console.error(`site move (browser) failed (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("site move (browser): ok");
