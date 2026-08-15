#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, get as httpGet } from "node:http";
import {
  accessSync,
  constants,
  createReadStream,
  existsSync,
  mkdirSync,
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
const diagnosticSelfTest = process.argv.includes("--self-test-diagnostics");
const artifactDir = process.env.GLITCH_SPHERE_ARTIFACT_DIR
  ? resolve(process.env.GLITCH_SPHERE_ARTIFACT_DIR)
  : mkdtempSync(join(tmpdir(), "glitch-sphere-browser-"));
mkdirSync(artifactDir, { recursive: true });

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
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
    process.env.GLITCH_SPHERE_CHROME,
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
    // Chrome requests a root favicon even when a route declares none. Keep
    // that browser-generated request out of the declared-resource contract.
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

async function staticFallback(baseUrl) {
  const routeHtml = readFileSync(join(routeDir, "index.html"), "utf8");
  const localAssets = Array.from(
    routeHtml.matchAll(/(?:src|href)=["']([^"']+)["']/g),
    (match) => match[1]
  ).filter((asset) => !/^(?:https?:|#|mailto:)/.test(asset));
  assert.match(routeHtml, /aria-label=["']Glitch Sphere minesweeper board["']/i);
  assert.match(routeHtml, /role=["']status["']/i);
  for (const route of ["/sphere/", "/glitch-sphere/", ...localAssets.map((asset) => `/glitch-sphere/${asset}`)]) {
    const status = await requestStatus(new URL(route, baseUrl));
    assert.equal(status, 200, `static fallback failed to load ${route}`);
  }
  note(`Static fallback passed ${localAssets.length + 2} route/resource checks.`);
  note("Browser automation unavailable: interactive desktop/mobile/reduced-motion behavior is unverified.");
  process.exitCode = 2;
}

class PipeCdp {
  constructor(executable) {
    this.profileDir = mkdtempSync(join(tmpdir(), "glitch-sphere-chrome-"));
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    this.buffer = "";
    this.stderr = "";
    this.child = spawn(
      executable,
      [
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
      ],
      { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] }
    );
    this.input = this.child.stdio[3];
    this.output = this.child.stdio[4];
    // Chrome may close the protocol pipe a moment before its exit event. A
    // late Browser.close write is normal cleanup, not an unhandled EPIPE.
    this.input.on("error", () => {});
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk) => {
      this.stderr += chunk;
    });
    this.output.setEncoding("utf8");
    this.output.on("data", (chunk) => this.onData(chunk));
    this.child.once("exit", (code, signal) => {
      const error = new Error(
        `Chrome exited before the probe completed (${signal || code}). ${this.stderr.trim()}`
      );
      for (const { reject } of this.pending.values()) reject(error);
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
        continue;
      }
      for (const listener of this.listeners) listener(message);
    }
  }

  send(method, params = {}, sessionId) {
    if (this.child.exitCode !== null || this.input.destroyed || !this.input.writable) {
      return Promise.reject(new Error(`${method}: Chrome protocol pipe is closed`));
    }
    const id = this.nextId++;
    return new Promise((resolveSend, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, 15000);
      this.pending.set(id, {
        method,
        resolve(value) {
          clearTimeout(timer);
          resolveSend(value);
        },
        reject(error) {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.input.write(
        `${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`,
        (error) => {
          if (!error || !this.pending.has(id)) return;
          const pending = this.pending.get(id);
          this.pending.delete(id);
          pending.reject(error);
        }
      );
    });
  }

  waitFor(method, sessionId, predicate = () => true, timeoutMs = 15000) {
    return new Promise((resolveWait, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        reject(new Error(`${method} event timed out`));
      }, timeoutMs);
      const listener = (message) => {
        if (message.method !== method || message.sessionId !== sessionId || !predicate(message.params || {})) return;
        clearTimeout(timer);
        this.listeners.delete(listener);
        resolveWait(message.params || {});
      };
      this.listeners.add(listener);
    });
  }

  observe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async close() {
    if (this.child.exitCode === null) {
      try {
        await this.send("Browser.close");
      } catch (_) {
        if (this.child.exitCode === null) this.child.kill("SIGTERM");
      }
    }
    await new Promise((done) => {
      if (this.child.exitCode !== null) done();
      else {
        const timer = setTimeout(() => {
          this.child.kill("SIGKILL");
          done();
        }, 3000);
        this.child.once("exit", () => {
          clearTimeout(timer);
          done();
        });
      }
    });
    rmSync(this.profileDir, { force: true, recursive: true });
  }
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send(
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true, userGesture: true },
    sessionId
  );
  if (result.exceptionDetails) {
    const description = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
    throw new Error(`Browser evaluation failed: ${description}`);
  }
  return result.result?.value;
}

async function waitForExpression(cdp, sessionId, expression, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(cdp, sessionId, expression);
    if (last) return last;
    await new Promise((resolveWait) => setTimeout(resolveWait, 40));
  }
  throw new Error(`Timed out waiting for browser condition: ${expression}; last=${JSON.stringify(last)}`);
}

async function navigateDocument(cdp, sessionId, url) {
  const result = await cdp.send("Page.navigate", { url }, sessionId);
  if (result.errorText) throw new Error(`Browser navigation failed for ${url}: ${result.errorText}`);
  await waitForExpression(cdp, sessionId, 'document.readyState === "complete"');
}

async function navigate(cdp, sessionId, url, diagnostics) {
  diagnostics.failures.length = 0;
  diagnostics.requests.clear();
  await navigateDocument(cdp, sessionId, url);
  await waitForExpression(
    cdp,
    sessionId,
    "typeof glitchSphereRoute !== 'undefined' && glitchSphereRoute.game.getState().cells.length > 0"
  );
  await new Promise((resolveWait) => setTimeout(resolveWait, 120));
}

async function pressKey(cdp, sessionId, key, code, keyCode, modifiers = 0) {
  const base = {
    key,
    code,
    modifiers,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  };
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", ...base }, sessionId);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...base }, sessionId);
}

async function capture(cdp, sessionId, name) {
  const result = await cdp.send(
    "Page.captureScreenshot",
    { format: "png", fromSurface: true, captureBeyondViewport: false },
    sessionId
  );
  const target = join(artifactDir, `${name}.png`);
  writeFileSync(target, Buffer.from(result.data, "base64"));
  assert.ok(statSync(target).size > 1000, `${name} screenshot is unexpectedly small`);
  return target;
}

async function orientHazardForCapture(cdp, sessionId) {
  const projection = await evaluate(
    cdp,
    sessionId,
    `(() => {
      const game = glitchSphereRoute.game;
      const state = game.getState();
      const hazard = glitchSphereRoute.adapter.exportState();
      const tile = state.tiles[hazard.index];
      let best = null;
      for (let rotX = -Math.PI / 2; rotX <= Math.PI / 2; rotX += Math.PI / 24) {
        for (let rotY = -Math.PI; rotY <= Math.PI; rotY += Math.PI / 24) {
          const projected = game.projectTile(tile, rotY, rotX, 0.018);
          if (!projected || !projected.boundary?.length) continue;
          const distance = Math.hypot(
            projected.center.x - state.centerX,
            projected.center.y - state.centerY
          );
          const score = projected.z * 1000 - distance;
          if (!best || score > best.score) best = { score, rotX, rotY };
        }
      }
      if (!best) throw new Error("hazard face could not be projected");
      state.rotX = state.targetRotX = best.rotX;
      state.rotY = state.targetRotY = best.rotY;
      const visible = game.projectTile(tile, best.rotY, best.rotX, 0.018);
      return { z: visible.z, x: visible.center.x, y: visible.center.y };
    })()`
  );
  assert.ok(projection.z > 0.5, "active hazard was not rotated onto the visible hemisphere");
  assert.ok(projection.x > 0 && projection.y > 0, "active hazard projected outside the viewport");
  await new Promise((resolveWait) => setTimeout(resolveWait, 180));
}

function assertNoFailures(diagnostics, label) {
  assert.deepEqual(diagnostics.failures, [], `${label} browser failures:\n${diagnostics.failures.join("\n")}`);
}

async function assertRouteContract(cdp, sessionId) {
  const contract = await evaluate(
    cdp,
    sessionId,
    `(() => {
      const canvas = document.getElementById("gameCanvas");
      const status = document.getElementById("glitch-status");
      const description = document.querySelector('meta[name="description"]');
      return {
        title: document.title,
        description: description && description.content,
        canvasName: canvas && canvas.getAttribute("aria-label"),
        canvasTabIndex: canvas && canvas.tabIndex,
        statusRole: status && status.getAttribute("role"),
        help: document.getElementById("help-overlay")?.textContent || "",
        scripts: Array.from(document.scripts, (script) => script.src).filter(Boolean),
      };
    })()`
  );
  assert.match(contract.title, /Glitch Sphere/);
  assert.match(contract.description, /Trap a moving Glitch/i);
  assert.equal(contract.canvasName, "Glitch Sphere minesweeper board");
  assert.equal(contract.canvasTabIndex, 0);
  assert.equal(contract.statusRole, "status");
  assert.match(contract.help, /revealed and flagged faces close routes/i);
  assert.match(contract.help, /Shift \+ Enter/i);
  for (const asset of ["sphere.js", "glitch-hazard.js", "glitch-sphere.js"]) {
    assert.ok(contract.scripts.some((source) => source.includes(asset)), `missing loaded script ${asset}`);
  }
}

async function exerciseActiveRun(cdp, sessionId, injectDiagnostics = false) {
  const prepared = await evaluate(
    cdp,
    sessionId,
    `(() => {
      const game = glitchSphereRoute.game;
      const state = game.getState();
      const first = state.cells.findIndex((cell) => !cell.revealed && !cell.flagged);
      window.__probePickTile = game.pickTile;
      game.pickTile = () => first;
      document.getElementById("gameCanvas").focus();
      return { first, isFirstClick: state.isFirstClick };
    })()`
  );
  assert.equal(prepared.isFirstClick, true);
  await pressKey(cdp, sessionId, "Enter", "Enter", 13);
  const active = await evaluate(
    cdp,
    sessionId,
    `(() => {
      const game = glitchSphereRoute.game;
      game.pauseTimer("browser-probe");
      game.pickTile = window.__probePickTile;
      const state = game.getState();
      const hazard = glitchSphereRoute.adapter.exportState();
      return {
        first: state.isFirstClick,
        firstRevealed: state.cells[${prepared.first}].revealed,
        hazard,
        status: document.getElementById("glitch-status").textContent,
      };
    })()`
  );
  assert.equal(active.first, false, "Enter did not resolve the first dig");
  assert.equal(active.firstRevealed, true, "first keyboard dig did not reveal its face");
  assert.equal(active.hazard.active, true, "hazard did not spawn after the first resolved dig");
  assert.match(active.status, /Glitch appeared|Trap it/i);

  const firstUndo = await evaluate(
    cdp,
    sessionId,
    `(() => {
      const game = glitchSphereRoute.game;
      const undone = game.undo();
      const state = game.getState();
      const hazard = glitchSphereRoute.adapter.exportState();
      const occupied = hazard.active ? state.cells[hazard.index] : null;
      const replayed = game.digAt(${prepared.first});
      return {
        undone,
        replayed,
        first: state.isFirstClick,
        hazard,
        occupied: occupied && {
          revealed: occupied.revealed,
          flagged: occupied.flagged,
          mine: occupied.isMine,
        },
      };
    })()`
  );
  assert.equal(firstUndo.undone, true, "first resolved dig was not undoable");
  assert.equal(firstUndo.first, false, "first-dig undo lost the resolved mine layout");
  assert.equal(firstUndo.hazard.active, true, "first-dig undo removed the only hazard");
  assert.deepEqual(firstUndo.occupied, { revealed: false, flagged: false, mine: false });
  assert.equal(firstUndo.replayed, true, "the board was not playable after first-dig undo");

  const blocked = await evaluate(
    cdp,
    sessionId,
    `(() => {
      const game = glitchSphereRoute.game;
      const before = glitchSphereRoute.adapter.exportState();
      const result = game.digAt(before.index);
      const after = glitchSphereRoute.adapter.exportState();
      return { result, before, after, status: document.getElementById("glitch-status").textContent };
    })()`
  );
  assert.equal(blocked.result, false, "occupied face accepted a direct dig");
  assert.equal(blocked.after.index, blocked.before.index);
  assert.match(blocked.status, /occupied|blocks/i);

  const beforeRotation = await evaluate(cdp, sessionId, "glitchSphereRoute.game.getState().targetRotY");
  await pressKey(cdp, sessionId, "ArrowRight", "ArrowRight", 39);
  const afterRotation = await evaluate(cdp, sessionId, "glitchSphereRoute.game.getState().targetRotY");
  assert.ok(afterRotation > beforeRotation, "ArrowRight did not rotate the focused board");

  const flagIndex = await evaluate(
    cdp,
    sessionId,
    `(() => {
      const game = glitchSphereRoute.game;
      const state = game.getState();
      const hazard = glitchSphereRoute.adapter.exportState();
      const index = state.cells.findIndex((cell, i) => i !== hazard.index && !cell.revealed && !cell.flagged);
      window.__probePickTile = game.pickTile;
      game.pickTile = () => index;
      return index;
    })()`
  );
  assert.ok(flagIndex >= 0, "no covered face available for keyboard flag test");
  await pressKey(cdp, sessionId, " ", "Space", 32, 8);
  const flagged = await evaluate(
    cdp,
    sessionId,
    `(() => {
      const game = glitchSphereRoute.game;
      game.pickTile = window.__probePickTile;
      return game.getState().cells[${flagIndex}].flagged;
    })()`
  );
  assert.equal(flagged, true, "Shift+Space did not flag the selected centered face");

  if (injectDiagnostics) {
    await evaluate(
      cdp,
      sessionId,
      `(() => {
        console.error("probe-active-console-error");
        fetch("/glitch-sphere/probe-active-missing.js").catch(() => {});
      })()`
    );
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }

  return evaluate(
    cdp,
    sessionId,
    `(() => {
      const saved = JSON.parse(localStorage.getItem("hexsweeper-glitch-sphere-run-v1"));
      return {
        runId: saved.runId,
        hazard: saved.variant.hazard,
        revealed: saved.revealed.length,
        flagged: saved.flagged.length,
      };
    })()`
  );
}

async function assertRestoreAndReset(cdp, sessionId, baseUrl, previous, diagnostics) {
  await navigate(cdp, sessionId, `${baseUrl}/glitch-sphere/?welcome=0`, diagnostics);
  const restored = await evaluate(
    cdp,
    sessionId,
    `(() => {
      glitchSphereRoute.game.pauseTimer("browser-probe");
      const saved = JSON.parse(localStorage.getItem("hexsweeper-glitch-sphere-run-v1"));
      const state = glitchSphereRoute.game.getState();
      return {
        runId: saved.runId,
        hazard: glitchSphereRoute.adapter.exportState(),
        first: state.isFirstClick,
        revealed: state.cells.filter((cell) => cell.revealed).length,
        flagged: state.cells.filter((cell) => cell.flagged).length,
        status: document.getElementById("glitch-status").textContent,
      };
    })()`
  );
  assert.equal(restored.runId, previous.runId);
  assert.equal(restored.first, false);
  assert.equal(restored.hazard.active, true);
  assert.equal(restored.hazard.index, previous.hazard.index);
  assert.ok(restored.revealed >= previous.revealed);
  assert.equal(restored.flagged, previous.flagged);
  assert.match(restored.status, /restored/i);

  const reset = await evaluate(
    cdp,
    sessionId,
    `(() => {
      document.getElementById("reset-btn").click();
      const state = glitchSphereRoute.game.getState();
      return {
        first: state.isFirstClick,
        over: state.isGameOver,
        hazard: glitchSphereRoute.adapter.exportState(),
        local: localStorage.getItem("hexsweeper-glitch-sphere-run-v1"),
        session: sessionStorage.getItem("hexsweeper-glitch-sphere-run-v1"),
      };
    })()`
  );
  assert.equal(reset.first, true);
  assert.equal(reset.over, false);
  assert.equal(reset.hazard.active, false);
  assert.equal(reset.local, null);
  assert.equal(reset.session, null);
}

async function exerciseTerminalFixtures(cdp, sessionId, label) {
  const result = await evaluate(
    cdp,
    sessionId,
    `(async () => {
      const game = glitchSphereRoute.game;
      game.resumeTimer("browser-probe");
      const state = game.getState();
      const choose = () => {
        for (let hazard = 0; hazard < state.tiles.length; hazard++) {
          const blocked = new Set([hazard, ...state.tiles[hazard].neighborIndices]);
          const mine = state.cells.findIndex((_, index) => !blocked.has(index));
          const trigger = state.cells.findIndex((_, index) => !blocked.has(index) && index !== mine);
          if (mine >= 0 && trigger >= 0) return { hazard, mine, trigger };
        }
        throw new Error("unable to build terminal fixture");
      };
      const base = (runId, fixture) => ({
        v: 2,
        kind: "glitch-sphere",
        difficulty: state.difficulty,
        first: false,
        over: false,
        won: false,
        flags: 0,
        mineCount: 1,
        time: 7,
        rotY: 0,
        rotX: 0.25,
        zoom: 0.72,
        mines: [fixture.mine],
        revealed: [],
        flagged: [],
        savedAt: Date.now(),
        runId,
        completionEmitted: false,
        variant: {
          hazard: { active: true, index: fixture.hazard, remainingMs: 900 },
          terminalReason: null,
        },
      });
      const fixture = choose();
      const winRunId = "browser-${label}-win";
      const winSave = base(winRunId, fixture);
      winSave.revealed = state.tiles[fixture.hazard].neighborIndices.slice();
      if (!game.applyRunState(winSave)) throw new Error("win fixture was rejected");
      game.flagAt(fixture.trigger);
      game.flagAt(fixture.trigger);
      const win = {
        over: game.getState().isGameOver,
        won: game.getState().won,
        banner: document.getElementById("banner-msg").textContent,
      };

      const lossRunId = "browser-${label}-loss";
      const lossFixture = choose();
      const lossSave = base(lossRunId, lossFixture);
      lossSave.revealed = [lossFixture.trigger];
      if (!game.applyRunState(lossSave)) throw new Error("loss fixture was rejected");
      game.digAt(lossFixture.mine);
      game.digAt(lossFixture.mine);
      const loss = {
        over: game.getState().isGameOver,
        won: game.getState().won,
        banner: document.getElementById("banner-msg").textContent,
      };

      const undone = game.undo();
      const continuationRunId = game.exportRunState().runId;
      const continuationHazard = glitchSphereRoute.adapter.exportState();
      for (const neighbor of state.tiles[continuationHazard.index].neighborIndices) {
        if (!state.cells[neighbor].revealed && !state.cells[neighbor].flagged) {
          game.flagAt(neighbor);
        }
      }
      const continuation = {
        over: game.getState().isGameOver,
        won: game.getState().won,
        banner: document.getElementById("banner-msg").textContent,
      };

      const counts = Object.fromEntries(
        [winRunId, lossRunId, continuationRunId].map((runId) => [
          runId,
          window.__glitchCompletions.filter((payload) => payload.runId === runId).length,
        ])
      );
      const payloads = window.__glitchCompletions.filter((payload) =>
        payload.runId === winRunId || payload.runId === lossRunId || payload.runId === continuationRunId
      );
      return { win, loss, undone, continuationRunId, continuation, counts, payloads };
    })()`
  );
  assert.notEqual(result.continuationRunId, `browser-${label}-loss`);
  assert.deepEqual(result.counts, {
    [`browser-${label}-win`]: 1,
    [`browser-${label}-loss`]: 1,
    [result.continuationRunId]: 1,
  });
  assert.equal(result.win.over, true);
  assert.equal(result.win.won, true);
  assert.match(result.win.banner, /Glitch trapped/i);
  assert.equal(result.loss.over, true);
  assert.equal(result.loss.won, false);
  assert.match(result.loss.banner, /Mine detonated/i);
  assert.equal(result.undone, true);
  assert.equal(result.continuation.over, true);
  assert.equal(result.continuation.won, true);
  assert.match(result.continuation.banner, /Glitch trapped/i);
  for (const payload of result.payloads) {
    assert.equal(payload.type, "hexsweeper:run-complete");
    assert.equal(payload.schemaVersion, 1);
    assert.equal(payload.variant, "glitch-sphere");
    assert.ok(payload.outcome === "win" || payload.outcome === "loss");
  }
}

async function measureReducedMotionCadence(cdp, sessionId) {
  const fixture = await evaluate(
    cdp,
    sessionId,
    `(() => {
      const game = glitchSphereRoute.game;
      const state = game.getState();
      let hazard = -1;
      let mine = -1;
      for (let index = 0; index < state.tiles.length; index++) {
        const blocked = new Set([index, ...state.tiles[index].neighborIndices]);
        const candidateMine = state.cells.findIndex((_, candidate) => !blocked.has(candidate));
        if (candidateMine >= 0 && state.tiles[index].neighborIndices.length > 0) {
          hazard = index;
          mine = candidateMine;
          break;
        }
      }
      if (hazard < 0 || mine < 0) throw new Error("unable to build cadence fixture");
      const saved = {
        v: 2,
        kind: "glitch-sphere",
        difficulty: state.difficulty,
        first: false,
        over: false,
        won: false,
        flags: 0,
        mineCount: 1,
        time: 0,
        rotY: 0,
        rotX: 0.25,
        zoom: 0.72,
        mines: [mine],
        revealed: [],
        flagged: [],
        savedAt: Date.now(),
        runId: "browser-reduced-cadence",
        completionEmitted: false,
        variant: {
          hazard: { active: true, index: hazard, remainingMs: 1000 },
          terminalReason: null,
        },
      };
      if (!game.applyRunState(saved)) throw new Error("cadence fixture was rejected");
      window.__probeCadenceStart = performance.now();
      return { initialIndex: hazard };
    })()`
  );

  await new Promise((resolveWait) => setTimeout(resolveWait, 600));
  const early = await evaluate(
    cdp,
    sessionId,
    `(() => {
      const hazard = glitchSphereRoute.adapter.exportState();
      return { index: hazard.index, remainingMs: hazard.remainingMs };
    })()`
  );
  const moved = await waitForExpression(
    cdp,
    sessionId,
    `(() => {
      const hazard = glitchSphereRoute.adapter.exportState();
      if (!hazard.active || hazard.index === ${fixture.initialIndex}) return null;
      return { index: hazard.index, elapsedMs: performance.now() - window.__probeCadenceStart };
    })()`,
    1600
  );
  return {
    initialIndex: fixture.initialIndex,
    earlyIndex: early.index,
    earlyRemainingMs: early.remainingMs,
    movedIndex: moved.index,
    movedAfterMs: moved.elapsedMs,
  };
}

async function runViewport(cdp, sessionId, baseUrl, diagnostics, viewport, injectDiagnostics = false) {
  await cdp.send(
    "Emulation.setDeviceMetricsOverride",
    {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.mobile ? 2 : 1,
      mobile: viewport.mobile,
    },
    sessionId
  );
  await cdp.send(
    "Emulation.setEmulatedMedia",
    { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] },
    sessionId
  );
  await navigate(cdp, sessionId, `${baseUrl}/glitch-sphere/?welcome=0&fresh=1`, diagnostics);
  await assertRouteContract(cdp, sessionId);
  assertNoFailures(diagnostics, `${viewport.name} initial route`);
  const previous = await exerciseActiveRun(cdp, sessionId, injectDiagnostics);
  await orientHazardForCapture(cdp, sessionId);
  await capture(cdp, sessionId, `${viewport.name}-active`);
  assertNoFailures(diagnostics, `${viewport.name} active interactions`);
  await assertRestoreAndReset(cdp, sessionId, baseUrl, previous, diagnostics);
  assertNoFailures(diagnostics, `${viewport.name} restore`);
  await exerciseTerminalFixtures(cdp, sessionId, viewport.name);
  await capture(cdp, sessionId, `${viewport.name}-loss`);
  assertNoFailures(diagnostics, `${viewport.name} terminal fixtures`);
  note(`  ${viewport.name}: first dig, active hazard, keyboard, restore, reset, win/loss, exactly-once completion — OK`);
}

async function runBrowser(baseUrl, executable, options = {}) {
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
    await cdp.send(
      "Page.addScriptToEvaluateOnNewDocument",
      {
        source: `(() => {
          window.__glitchCompletions = [];
          window.addEventListener("hexsweeper:run-complete", (event) => {
            window.__glitchCompletions.push(JSON.parse(JSON.stringify(event.detail)));
          });
          try { localStorage.setItem("hexsweeper-sphere-welcome-v1", "1"); } catch (_) {}
          let seed = 0x5eed1234;
          Math.random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x100000000;
          };
        })();`,
      },
      sessionId
    );

    const diagnostics = { failures: [], requests: new Map() };
    const stopObserving = cdp.observe((message) => {
      if (message.sessionId !== sessionId) return;
      const params = message.params || {};
      if (message.method === "Network.requestWillBeSent") {
        diagnostics.requests.set(params.requestId, params.request?.url || "unknown resource");
      } else if (message.method === "Network.loadingFailed") {
        if (!params.canceled && params.errorText !== "net::ERR_ABORTED") {
          diagnostics.failures.push(
            `resource: ${diagnostics.requests.get(params.requestId) || params.requestId} (${params.errorText})`
          );
        }
      } else if (message.method === "Network.responseReceived" && params.response?.status >= 400) {
        diagnostics.failures.push(`HTTP ${params.response.status}: ${params.response.url}`);
      } else if (message.method === "Runtime.exceptionThrown") {
        diagnostics.failures.push(
          `exception: ${params.exceptionDetails?.exception?.description || params.exceptionDetails?.text}`
        );
      } else if (message.method === "Runtime.consoleAPICalled" && params.type === "error") {
        diagnostics.failures.push(
          `console: ${(params.args || []).map((arg) => arg.value || arg.description).join(" ")}`
        );
      } else if (message.method === "Log.entryAdded" && params.entry?.level === "error") {
        diagnostics.failures.push(`log: ${params.entry.text}`);
      }
    });

    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
      sessionId
    );
    diagnostics.failures.length = 0;
    await navigateDocument(cdp, sessionId, `${baseUrl}/sphere/?welcome=0&fresh=1`);
    await waitForExpression(cdp, sessionId, "typeof SphereSweeper !== 'undefined'");
    await new Promise((resolveWait) => setTimeout(resolveWait, 120));
    assertNoFailures(diagnostics, "canonical Sphere route");
    note("  canonical Sphere resource load — OK");

    for (const viewport of [
      { name: "desktop", width: 1280, height: 800, mobile: false },
      { name: "mobile", width: 390, height: 844, mobile: true },
    ]) {
      await runViewport(
        cdp,
        sessionId,
        baseUrl,
        diagnostics,
        viewport,
        !!options.injectActiveDiagnostics && viewport.name === "desktop"
      );
    }

    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false },
      sessionId
    );
    await cdp.send(
      "Emulation.setEmulatedMedia",
      { features: [{ name: "prefers-reduced-motion", value: "reduce" }] },
      sessionId
    );
    await navigate(cdp, sessionId, `${baseUrl}/glitch-sphere/?welcome=0&fresh=1`, diagnostics);
    const reducedBefore = await evaluate(
      cdp,
      sessionId,
      `({
        media: matchMedia("(prefers-reduced-motion: reduce)").matches,
        state: glitchSphereRoute.game.getState().reduceMotion,
        transition: getComputedStyle(document.getElementById("glitch-status")).transitionDuration,
      })`
    );
    assert.equal(reducedBefore.media, true);
    assert.equal(reducedBefore.state, true);
    assert.equal(reducedBefore.transition, "0s");
    const reducedCadence = await measureReducedMotionCadence(cdp, sessionId);
    assert.equal(reducedCadence.earlyIndex, reducedCadence.initialIndex);
    assert.ok(reducedCadence.earlyRemainingMs > 0, "reduced-motion hazard moved before its deadline");
    assert.notEqual(reducedCadence.movedIndex, reducedCadence.initialIndex);
    assert.ok(reducedCadence.movedAfterMs >= 900, "reduced-motion hazard moved too early");
    assert.ok(reducedCadence.movedAfterMs <= 1600, "reduced-motion hazard missed its cadence window");
    note(`  reduced-motion cadence: held through 600ms; moved at ${Math.round(reducedCadence.movedAfterMs)}ms — OK`);
    assertNoFailures(diagnostics, "reduced-motion cadence");
    await navigate(cdp, sessionId, `${baseUrl}/glitch-sphere/?welcome=0&fresh=1`, diagnostics);
    const reducedActive = await exerciseActiveRun(cdp, sessionId);
    assert.equal(reducedActive.hazard.active, true);
    await orientHazardForCapture(cdp, sessionId);
    await capture(cdp, sessionId, "reduced-motion-active");
    assertNoFailures(diagnostics, "reduced-motion route");
    note("  reduced motion: static treatment with active marker and unchanged cadence — OK");
    stopObserving();
  } finally {
    await cdp.close();
  }
}

const server = await startStaticServer();
try {
  for (const route of ["/sphere/", "/glitch-sphere/"]) {
    assert.equal(await requestStatus(new URL(route, server.baseUrl)), 200, `${route} did not return HTTP 200`);
  }
  const executable = chromePath();
  if (!executable) {
    await staticFallback(server.baseUrl);
  } else if (diagnosticSelfTest) {
    let rejection = null;
    try {
      await runBrowser(server.baseUrl, executable, { injectActiveDiagnostics: true });
    } catch (error) {
      rejection = error;
    }
    assert.ok(rejection, "Diagnostic self-test failed: browser probe accepted injected active-phase failures");
    assert.match(rejection.message, /probe-active-console-error/);
    assert.match(rejection.message, /probe-active-missing\.js/);
    note("Diagnostic self-test: injected active-phase console/resource failures were rejected — OK");
  } else {
    note(`Glitch Sphere browser probe (${executable})…`);
    await runBrowser(server.baseUrl, executable);
    note(`Screenshots: ${artifactDir}`);
    note("All browser checks passed.");
  }
} finally {
  await server.close();
}
