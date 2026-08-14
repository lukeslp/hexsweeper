#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, get as httpGet } from "node:http";
import {
  accessSync,
  constants,
  createReadStream,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const routeDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(routeDir, "..");
const artifactDir = mkdtempSync(join(tmpdir(), "flux-sphere-browser-"));
const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function note(message) {
  process.stdout.write(`${message}\n`);
}

function chromePath() {
  const candidates = [
    process.env.FLUX_SPHERE_CHROME,
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch (_) {}
  }
  return null;
}

function startStaticServer() {
  const server = createServer((request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
    } catch (_) {
      response.writeHead(400).end("Bad request");
      return;
    }
    if (pathname === "/favicon.ico") {
      response.writeHead(204, { "cache-control": "no-store" }).end();
      return;
    }
    const relative = normalize(pathname).replace(/^[/\\]+/, "");
    let target = resolve(rootDir, relative);
    if (target !== rootDir && !target.startsWith(`${rootDir}/`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    try {
      if (statSync(target).isDirectory()) target = join(target, "index.html");
      const stat = statSync(target);
      if (!stat.isFile()) throw new Error("not a file");
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-length": stat.size,
        "content-type": MIME[extname(target)] || "application/octet-stream",
      });
      if (request.method === "HEAD") response.end();
      else createReadStream(target).pipe(response);
    } catch (_) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
    }
  });
  return new Promise((resolveStart, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolveStart({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

function requestStatus(url) {
  return new Promise((resolveRequest, reject) => {
    const request = httpGet(url, (response) => {
      response.resume();
      resolveRequest(response.statusCode || 0);
    });
    request.once("error", reject);
  });
}

class PipeCdp {
  constructor(executable) {
    this.profileDir = mkdtempSync(join(tmpdir(), "flux-sphere-chrome-"));
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    this.buffer = "";
    this.stderr = "";
    this.child = spawn(executable, [
      "--headless=new",
      "--remote-debugging-pipe",
      `--user-data-dir=${this.profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-features=MediaRouter,Translate",
      "--disable-gpu",
      "about:blank",
    ], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
    this.input = this.child.stdio[3];
    this.output = this.child.stdio[4];
    this.input.on("error", () => {});
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk) => { this.stderr += chunk; });
    this.output.setEncoding("utf8");
    this.output.on("data", (chunk) => this.onData(chunk));
    this.child.once("exit", (code, signal) => {
      const error = new Error(`Chrome exited early (${signal || code}). ${this.stderr.trim()}`);
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    });
  }

  onData(chunk) {
    this.buffer += chunk;
    while (this.buffer.includes("\0")) {
      const end = this.buffer.indexOf("\0");
      const raw = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 1);
      if (!raw) continue;
      const message = JSON.parse(raw);
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result || {});
      } else {
        for (const listener of this.listeners) listener(message);
      }
    }
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolveSend, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, 15000);
      this.pending.set(id, {
        method,
        resolve(value) { clearTimeout(timer); resolveSend(value); },
        reject(error) { clearTimeout(timer); reject(error); },
      });
      this.input.write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
    });
  }

  observe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async close() {
    if (this.child.exitCode === null) {
      try { await this.send("Browser.close"); } catch (_) { this.child.kill("SIGTERM"); }
    }
    await new Promise((done) => {
      if (this.child.exitCode !== null) return done();
      const timer = setTimeout(() => { this.child.kill("SIGKILL"); done(); }, 3000);
      this.child.once("exit", () => { clearTimeout(timer); done(); });
    });
    rmSync(this.profileDir, { force: true, recursive: true });
  }
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  }, sessionId);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result?.value;
}

async function waitForExpression(cdp, sessionId, expression, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await evaluate(cdp, sessionId, expression);
    if (value) return value;
    await new Promise((done) => setTimeout(done, 40));
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

async function navigate(cdp, sessionId, url) {
  const result = await cdp.send("Page.navigate", { url }, sessionId);
  if (result.errorText) throw new Error(result.errorText);
  await waitForExpression(cdp, sessionId, 'document.readyState === "complete"');
}

async function pressKey(cdp, sessionId, key, code, keyCode, modifiers = 0) {
  const fields = { key, code, modifiers, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", ...fields }, sessionId);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...fields }, sessionId);
}

async function capture(cdp, sessionId, name) {
  const shot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  }, sessionId);
  const target = join(artifactDir, `${name}.png`);
  writeFileSync(target, Buffer.from(shot.data, "base64"));
  assert.ok(statSync(target).size > 1000, `${name} screenshot is too small`);
}

function assertNoFailures(failures, label) {
  assert.deepEqual(failures, [], `${label} browser failures:\n${failures.join("\n")}`);
}

async function runViewport(cdp, sessionId, baseUrl, failures, viewport) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.mobile ? 2 : 1,
    mobile: viewport.mobile,
  }, sessionId);
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: viewport.reduce ? "reduce" : "no-preference" }],
  }, sessionId);
  if (await evaluate(cdp, sessionId, "location.origin !== 'null'")) {
    await evaluate(cdp, sessionId, `(() => {
      if (typeof fluxSphereRoute !== "undefined") fluxSphereRoute.game.reset();
      localStorage.removeItem("hexsweeper-flux-sphere-run-v1");
      sessionStorage.removeItem("hexsweeper-flux-sphere-run-v1");
      localStorage.removeItem("hexsweeper-flux-sphere-run-v2");
      sessionStorage.removeItem("hexsweeper-flux-sphere-run-v2");
    })()`);
  }
  failures.length = 0;
  await navigate(cdp, sessionId, `${baseUrl}/flux-sphere/?welcome=0`);
  await waitForExpression(cdp, sessionId, "typeof fluxSphereRoute !== 'undefined' && fluxSphereRoute.game.getState().cells.length > 0");

  const contract = await evaluate(cdp, sessionId, `(() => ({
    title: document.title,
    canvas: document.getElementById("gameCanvas").getAttribute("aria-label"),
    status: document.getElementById("flux-status").getAttribute("role"),
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    transition: getComputedStyle(document.getElementById("flux-status")).transitionDuration,
  }))()`);
  assert.match(contract.title, /Flux Sphere/);
  assert.equal(contract.canvas, "Flux Sphere minesweeper board");
  assert.equal(contract.status, "status");
  assert.equal(contract.reduced, viewport.reduce);
  if (viewport.reduce) assert.equal(contract.transition, "0s");

  const prepared = await evaluate(cdp, sessionId, `(() => {
    const game = fluxSphereRoute.game;
    const state = game.getState();
    const first = state.cells.findIndex((cell) => !cell.revealed && !cell.flagged);
    window.__fluxPick = game.pickTile;
    game.pickTile = () => first;
    document.getElementById("gameCanvas").focus();
    return first;
  })()`);
  assert.ok(prepared >= 0);
  await pressKey(cdp, sessionId, "Enter", "Enter", 13);
  const active = await evaluate(cdp, sessionId, `(() => {
    const game = fluxSphereRoute.game;
    game.pickTile = window.__fluxPick;
    const state = game.getState();
    const saved = game.exportRunState();
    const mapping = fluxSphereRoute.adapter.exportState().pairs.pairFor;
    const pair = mapping.map((partner, index) => [index, partner]).find(([index, partner]) =>
      partner > index && !state.cells[index].revealed && !state.cells[partner].revealed &&
      !state.cells[index].flagged && !state.cells[partner].flagged &&
      !state.cells[index].isMine && !state.cells[partner].isMine
    );
    return {
      first: state.isFirstClick,
      over: state.isGameOver,
      won: state.won,
      revealedCount: state.cells.filter((cell) => cell.revealed).length,
      cellCount: state.cells.length,
      saved,
      mapping,
      pair,
    };
  })()`);
  assert.equal(active.first, false);
  assert.equal(active.over, false, `opening ended the run: ${JSON.stringify(active)}`);
  assert.ok(active.mapping.some((partner) => partner >= 0));
  assert.ok(active.pair, "no covered Flux pair remained after the opening");

  const beforeRotation = await evaluate(cdp, sessionId, `({
    value: fluxSphereRoute.game.getState().targetRotY,
    activeId: document.activeElement && document.activeElement.id,
  })`);
  await pressKey(cdp, sessionId, "ArrowRight", "ArrowRight", 39);
  const afterRotation = await evaluate(cdp, sessionId, `({
    value: fluxSphereRoute.game.getState().targetRotY,
    activeId: document.activeElement && document.activeElement.id,
  })`);
  const syntheticRotation = afterRotation.value === beforeRotation.value
    ? await evaluate(cdp, sessionId, `(() => {
        document.getElementById("gameCanvas").dispatchEvent(new KeyboardEvent("keydown", {
          key: "ArrowRight",
          code: "ArrowRight",
          bubbles: true,
          cancelable: true,
        }));
        return fluxSphereRoute.game.getState().targetRotY;
      })()`)
    : afterRotation.value;
  assert.ok(
    syntheticRotation > beforeRotation.value,
    `ArrowRight did not rotate: ${JSON.stringify({ beforeRotation, afterRotation, syntheticRotation })}`
  );

  const echoed = await evaluate(cdp, sessionId, `(() => {
    const game = fluxSphereRoute.game;
    const pair = ${JSON.stringify(active.pair)};
    const traced = game.digAt(pair[0]);
    const result = game.digAt(pair[0]);
    const state = game.getState();
    return {
      traced,
      result,
      from: state.cells[pair[0]].revealed,
      partner: state.cells[pair[1]].revealed,
      status: document.getElementById("flux-status").textContent,
      runId: game.exportRunState().runId,
      mapping: fluxSphereRoute.adapter.exportState().pairs.pairFor,
      undo: game.undo(),
      afterUndo: [state.cells[pair[0]].revealed, state.cells[pair[1]].revealed],
    };
  })()`);
  assert.equal(echoed.traced, false);
  assert.equal(echoed.result, true);
  assert.equal(echoed.from, true);
  assert.equal(echoed.partner, true);
  assert.match(echoed.status, /echo opened|already resolved/i);
  assert.equal(echoed.undo, true);
  assert.deepEqual(echoed.afterUndo, [false, false]);

  const flagIndex = active.pair[0];
  await evaluate(cdp, sessionId, `(() => {
    const game = fluxSphereRoute.game;
    window.__fluxPick = game.pickTile;
    game.pickTile = () => ${flagIndex};
  })()`);
  await pressKey(cdp, sessionId, " ", "Space", 32, 8);
  const flagged = await evaluate(cdp, sessionId, `(() => {
    const game = fluxSphereRoute.game;
    game.pickTile = window.__fluxPick;
    const value = game.getState().cells[${flagIndex}].flagged;
    game.flagAt(${flagIndex});
    return value;
  })()`);
  assert.equal(flagged, true);

  await evaluate(cdp, sessionId, `fluxSphereRoute.game.digAt(${active.pair[0]})`);
  await capture(cdp, sessionId, viewport.name);

  const restoredRunId = await evaluate(cdp, sessionId, "fluxSphereRoute.game.exportRunState().runId");
  await navigate(cdp, sessionId, `${baseUrl}/flux-sphere/?welcome=0`);
  await waitForExpression(cdp, sessionId, "typeof fluxSphereRoute !== 'undefined' && fluxSphereRoute.game.getState().cells.length > 0");
  const restored = await evaluate(cdp, sessionId, `(() => ({
    runId: fluxSphereRoute.game.exportRunState().runId,
    active: fluxSphereRoute.adapter.exportState().pairs.active,
    trace: fluxSphereRoute.adapter.exportState().trace,
    status: document.getElementById("flux-status").textContent,
  }))()`);
  assert.equal(restored.runId, restoredRunId);
  assert.equal(restored.active, true);
  assert.deepEqual(restored.trace, active.pair);
  assert.match(restored.status, /restored/i);

  const terminal = await evaluate(cdp, sessionId, `(async () => {
    const game = fluxSphereRoute.game;
    const state = game.getState();
    const base = game.exportRunState();
    const mapping = fluxSphereRoute.adapter.exportState().pairs.pairFor;
    const winPair = mapping.map((partner, index) => [index, partner]).find(([index, partner]) =>
      partner > index && !state.cells[index].isMine && !state.cells[partner].isMine &&
      state.cells[index].neighborMines > 0 && state.cells[partner].neighborMines > 0
    );
    if (!winPair) throw new Error("no numbered Flux pair for win fixture");
    const winId = "browser-${viewport.name}-win";
    const winSave = JSON.parse(JSON.stringify(base));
    winSave.runId = winId;
    winSave.over = false;
    winSave.won = false;
    winSave.completionEmitted = false;
    winSave.flags = 0;
    winSave.flagged = [];
    winSave.variant.trace = null;
    winSave.revealed = state.cells.map((cell, index) => !cell.isMine && !winPair.includes(index) ? index : -1).filter((index) => index >= 0);
    winSave.savedAt = Date.now();
    if (!game.applyRunState(winSave)) throw new Error("win fixture rejected");
    game.digAt(winPair[0]);
    game.digAt(winPair[0]);
    const win = { over: game.getState().isGameOver, won: game.getState().won };

    const lossId = "browser-${viewport.name}-loss";
    const lossSave = JSON.parse(JSON.stringify(base));
    lossSave.runId = lossId;
    lossSave.over = false;
    lossSave.won = false;
    lossSave.completionEmitted = false;
    lossSave.variant.trace = null;
    lossSave.savedAt = Date.now() + 1;
    if (!game.applyRunState(lossSave)) throw new Error("loss fixture rejected");
    const mine = game.getState().cells.findIndex((cell) => cell.isMine);
    const partner = mapping[mine];
    game.digAt(mine);
    game.digAt(mine);
    const loss = {
      over: game.getState().isGameOver,
      won: game.getState().won,
      partnerResolved: partner < 0 || game.getState().cells[partner].revealed,
      undo: game.undo(),
      afterUndo: partner < 0 || (!game.getState().cells[mine].revealed && !game.getState().cells[partner].revealed),
    };
    const counts = Object.fromEntries([winId, lossId].map((runId) => [
      runId,
      window.__fluxCompletions.filter((payload) => payload.runId === runId).length,
    ]));
    const payloads = window.__fluxCompletions.filter((payload) => payload.runId === winId || payload.runId === lossId);
    return { win, loss, counts, payloads };
  })()`);
  assert.deepEqual(terminal.win, { over: true, won: true });
  assert.deepEqual(terminal.loss, { over: true, won: false, partnerResolved: true, undo: true, afterUndo: true });
  assert.deepEqual(terminal.counts, {
    [`browser-${viewport.name}-win`]: 1,
    [`browser-${viewport.name}-loss`]: 1,
  });
  for (const payload of terminal.payloads) {
    assert.equal(payload.type, "hexsweeper:run-complete");
    assert.equal(payload.schemaVersion, 1);
    assert.equal(payload.variant, "flux-sphere");
  }
  assertNoFailures(failures, viewport.name);
  note(`  ${viewport.name}: keyboard, echo, undo, restore, win/loss, completion — OK`);
}

async function runBrowser(baseUrl, executable) {
  const cdp = new PipeCdp(executable);
  try {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await Promise.all([
      cdp.send("Page.enable", {}, sessionId),
      cdp.send("Runtime.enable", {}, sessionId),
      cdp.send("Network.enable", {}, sessionId),
      cdp.send("Log.enable", {}, sessionId),
    ]);
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `(() => {
        window.__fluxCompletions = [];
        window.addEventListener("hexsweeper:run-complete", (event) => {
          window.__fluxCompletions.push(JSON.parse(JSON.stringify(event.detail)));
        });
        try { localStorage.setItem("hexsweeper-sphere-welcome-v1", "1"); } catch (_) {}
      })();`,
    }, sessionId);

    const failures = [];
    const requests = new Map();
    const stop = cdp.observe((message) => {
      if (message.sessionId !== sessionId) return;
      const params = message.params || {};
      if (message.method === "Network.requestWillBeSent") {
        requests.set(params.requestId, params.request?.url || params.requestId);
      } else if (message.method === "Network.loadingFailed" && !params.canceled && params.errorText !== "net::ERR_ABORTED") {
        failures.push(`resource: ${requests.get(params.requestId)} (${params.errorText})`);
      } else if (message.method === "Network.responseReceived" && params.response?.status >= 400) {
        failures.push(`HTTP ${params.response.status}: ${params.response.url}`);
      } else if (message.method === "Runtime.exceptionThrown") {
        failures.push(`exception: ${params.exceptionDetails?.exception?.description || params.exceptionDetails?.text}`);
      } else if (message.method === "Runtime.consoleAPICalled" && params.type === "error") {
        failures.push(`console: ${(params.args || []).map((arg) => arg.value || arg.description).join(" ")}`);
      } else if (message.method === "Log.entryAdded" && params.entry?.level === "error") {
        failures.push(`log: ${params.entry.text}`);
      }
    });

    await navigate(cdp, sessionId, `${baseUrl}/sphere/?welcome=0`);
    await waitForExpression(cdp, sessionId, "typeof SphereSweeper !== 'undefined'");
    assertNoFailures(failures, "canonical Sphere");
    note("  canonical Sphere resource load — OK");

    for (const viewport of [
      { name: "desktop", width: 1280, height: 800, mobile: false, reduce: false },
      { name: "mobile", width: 390, height: 844, mobile: true, reduce: false },
      { name: "reduced-motion", width: 1024, height: 768, mobile: false, reduce: true },
    ]) {
      await runViewport(cdp, sessionId, baseUrl, failures, viewport);
    }
    stop();
  } finally {
    await cdp.close();
  }
}

const server = await startStaticServer();
try {
  const routeHtml = readFileSync(join(routeDir, "index.html"), "utf8");
  const localAssets = Array.from(routeHtml.matchAll(/(?:src|href)=["']([^"']+)["']/g), (match) => match[1])
    .filter((asset) => !/^(?:https?:|#|mailto:)/.test(asset));
  for (const route of ["/sphere/", "/flux-sphere/", ...localAssets.map((asset) => `/flux-sphere/${asset}`)]) {
    assert.equal(await requestStatus(new URL(route, server.baseUrl)), 200, `${route} did not return HTTP 200`);
  }
  const executable = chromePath();
  if (!executable) {
    note(`Static fallback passed ${localAssets.length + 2} route/resource checks.`);
    note("Browser automation unavailable; interactive Flux checks are unverified.");
    process.exitCode = 2;
  } else {
    note(`Flux Sphere browser probe (${executable})…`);
    await runBrowser(server.baseUrl, executable);
    note(`Screenshots: ${artifactDir}`);
    note("All browser checks passed.");
  }
} finally {
  await server.close();
}
