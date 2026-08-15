#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
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
  profile = await mkdtemp(join(tmpdir(), "hexsweeper-resume-"));
  chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
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

  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "evaluation failed");
    return result.result.value;
  }

  async function waitExpression(expression, message) {
    return waitFor(async () => evaluate(expression), message);
  }

  await waitExpression('location.pathname.endsWith("/index.html") && document.readyState === "complete"', "launcher did not load");
  await evaluate(`
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("hexsweeper-welcome-v1", "1");
    localStorage.setItem("hexsweeper-mode-v3", "light");
    location.href = "games/infinite.html?mode=light";
  `);
  await waitExpression('location.pathname.endsWith("/games/infinite.html") && document.readyState === "complete" && !!document.getElementById("gameCanvas")', "Infinite did not load");
  await delay(200);

  const rect = await evaluate(`(() => {
    const rect = document.getElementById("gameCanvas").getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await waitExpression('window.Hexsweeper && document.getElementById("stats-time").textContent !== "000"', "first dig did not resolve");

  // Match the reported app path: leave immediately through the in-game Games control.
  await evaluate('document.querySelector(".app-back").click()');
  await waitExpression('location.pathname.endsWith("/index.html") && document.readyState === "complete"', "Games did not return to the launcher");
  const outcome = await evaluate(`(() => {
    const raw = localStorage.getItem("hexsweeper-endless-plate-v1");
    const save = raw ? JSON.parse(raw) : null;
    const resume = document.getElementById("resume-game");
    return {
      hasSave: !!save,
      first: save && save.first,
      over: save && save.over,
      cleared: save && save.cleared,
      resumeHidden: resume.hidden,
      resumeMode: resume.dataset.mode,
      resumeLabel: resume.getAttribute("aria-label"),
    };
  })()`);

  assert.equal(outcome.hasSave, true, "the first dig was not saved before Games navigation");
  assert.equal(outcome.first, false, "the persisted run still looks pristine");
  assert.equal(outcome.over, false, "the persisted run is unexpectedly terminal");
  assert.ok(outcome.cleared > 0, "the persisted run has no cleared cells");
  assert.equal(outcome.resumeHidden, false, "Resume is hidden after returning from an active run");
  assert.equal(outcome.resumeMode, "infinite", "Resume does not identify the saved mode");
  assert.match(outcome.resumeLabel || "", /Resume Infinite/, "Resume has no mode-specific accessible name");

  await evaluate('location.href = "games/bounded.html?size=medium"');
  await waitExpression('location.pathname.endsWith("/games/bounded.html") && document.readyState === "complete" && !!document.getElementById("gameCanvas")', "Classic did not load");
  await delay(200);
  const classicRect = await evaluate(`(() => {
    const rect = document.getElementById("gameCanvas").getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: classicRect.x, y: classicRect.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: classicRect.x, y: classicRect.y, button: "left", clickCount: 1 });
  await delay(200);
  await evaluate('document.querySelector(".app-back").click()');
  await waitExpression('location.pathname.endsWith("/index.html") && document.readyState === "complete"', "Classic Games did not return to the launcher");
  const classicOutcome = await evaluate(`(() => {
    const raw = localStorage.getItem("hexsweeper-classic-run-v1");
    const save = raw ? JSON.parse(raw) : null;
    const resume = document.getElementById("resume-game");
    return {
      hasSave: !!save,
      first: save && save.first,
      over: save && save.over,
      resumeHidden: resume.hidden,
      resumeMode: resume.dataset.mode,
      resumeLabel: resume.getAttribute("aria-label"),
    };
  })()`);
  assert.equal(classicOutcome.hasSave, true, "the Classic first dig was not saved before Games navigation");
  assert.equal(classicOutcome.first, false, "the persisted Classic run still looks pristine");
  assert.equal(classicOutcome.over, false, "the persisted Classic run is unexpectedly terminal");
  assert.equal(classicOutcome.resumeHidden, false, "Classic Resume is hidden after returning from an active run");
  assert.equal(classicOutcome.resumeMode, "bounded", "Resume does not identify the Classic mode");
  assert.match(classicOutcome.resumeLabel || "", /Resume Classic/, "Classic Resume has no mode-specific accessible name");
  console.log("app resume browser contract: ok");
  socket.close();
} finally {
  if (chrome && chrome.exitCode == null) chrome.kill("SIGTERM");
  if (server) await new Promise((resolveClose) => server.close(resolveClose));
  if (profile) await rm(profile, { recursive: true, force: true });
}
