/*
 * Glitch Sphere route adapter.
 * Connects the DOM-free hazard state machine to SphereSweeper's optional
 * variant lifecycle without copying the canonical sphere engine.
 */
(function attachGlitchSphere(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./glitch-hazard.js"));
  } else {
    root.GlitchSphere = factory(root.GlitchHazard);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildGlitchSphere(createHazard) {
  "use strict";

  const STORAGE_KEY = "hexsweeper-glitch-sphere-run-v1";
  const RUN_KIND = "glitch-sphere";
  const ROTATION_STEP = Math.PI / 18;
  const TERMINAL_REASONS = new Set(["trapped", "hazard-mine", "direct-mine"]);

  function neighborsFor(tiles) {
    return (tiles || []).map((tile) =>
      Array.isArray(tile && tile.neighborIndices) ? tile.neighborIndices : []
    );
  }

  function createAdapter(options) {
    options = options || {};
    if (typeof createHazard !== "function") {
      throw new Error("GlitchSphere: hazard engine not loaded");
    }

    const hazard = createHazard({
      random: options.random,
      now: options.now,
      moveIntervalMs: options.moveIntervalMs,
    });
    const statusElement = options.statusElement || null;
    let lastContext = null;
    let paused = false;
    let pausedState = null;
    let terminalReason = null;
    let lastAnnouncement = "";

    function remember(context) {
      if (context) lastContext = context;
      return context || lastContext;
    }

    function gameFor(context) {
      const current = remember(context) || {};
      const cells = current.cells || (current.state && current.state.cells) || [];
      const tiles = current.tiles || (current.state && current.state.tiles) || [];
      return { cells, neighbors: neighborsFor(tiles) };
    }

    function announce(message) {
      if (!statusElement || !message || message === lastAnnouncement) return;
      lastAnnouncement = message;
      statusElement.textContent = message;
    }

    function requestUpdate(context, shouldPersist) {
      const current = remember(context);
      if (!current) return;
      if (typeof current.requestDraw === "function") current.requestDraw();
      if (shouldPersist && typeof current.persist === "function") current.persist();
    }

    function finishFrom(result, context) {
      const current = remember(context) || {};
      if (!result || result.status === "idle" || result.status === "waiting") {
        return result || { status: "idle" };
      }
      if (result.status === "moved") {
        announce("The Glitch moved to another covered face.");
        requestUpdate(current, true);
        return result;
      }
      if (result.status === "trapped") {
        terminalReason = "trapped";
        announce("Glitch trapped. Every route is closed.");
        requestUpdate(current, false);
        if (typeof current.endRun === "function") current.endRun("win");
        return result;
      }
      if (result.status === "mine") {
        terminalReason = "hazard-mine";
        announce("The Glitch reached a mine.");
        requestUpdate(current, false);
        if (typeof current.endRun === "function") {
          current.endRun("loss", { detonatorIndex: result.index });
        }
      }
      return result;
    }

    function closeIfTrapped(context) {
      const current = remember(context);
      const game = gameFor(current);
      const snapshot = paused && pausedState ? pausedState : hazard.exportState();
      if (!snapshot.active) return { status: "idle" };
      const routes = game.neighbors[snapshot.index] || [];
      const trapped = routes.every((index) => {
        const cell = game.cells[index];
        return !cell || cell.revealed || cell.flagged;
      });
      if (!trapped) return { status: "waiting", remainingMs: snapshot.remainingMs };

      const due = {
        active: true,
        index: snapshot.index,
        remainingMs: 0,
      };
      if (paused) pausedState = due;
      hazard.restore(due, game);
      return finishFrom(hazard.tick(game), current);
    }

    function exportState() {
      if (paused && pausedState) return Object.assign({}, pausedState);
      return hazard.exportState();
    }

    function exportPersistedState() {
      return { hazard: exportState(), terminalReason };
    }

    function readPersistedState(saved, state) {
      if (!saved || typeof saved !== "object") return null;
      const wrapped = Object.prototype.hasOwnProperty.call(saved, "hazard");
      const hazardState = wrapped ? saved.hazard : saved;
      let reason = wrapped ? saved.terminalReason : null;
      const completed = !!(state && state.isGameOver);

      if (wrapped) {
        if (!Object.prototype.hasOwnProperty.call(saved, "terminalReason")) return null;
        if (reason !== null && !TERMINAL_REASONS.has(reason)) return null;
      } else if (completed) {
        // Saves written before terminal reasons were persisted can still restore.
        reason = state.won ? "trapped" : "direct-mine";
      }

      if (!completed && reason !== null) return null;
      if (completed) {
        if (!hazardState || hazardState.active !== false) return null;
        if (state.won ? reason !== "trapped" : reason === "trapped") return null;
      }
      return { hazard: hazardState, terminalReason: reason };
    }

    function pause() {
      if (paused) return exportState();
      pausedState = hazard.exportState();
      paused = true;
      const current = remember();
      if (current && typeof current.persist === "function") current.persist();
      return exportState();
    }

    function resume() {
      if (!paused) return exportState();
      const snapshot = pausedState;
      paused = false;
      pausedState = null;
      if (snapshot) hazard.restore(snapshot, gameFor());
      const current = remember();
      if (current && typeof current.persist === "function") current.persist();
      if (current && typeof current.requestDraw === "function") current.requestDraw();
      return hazard.exportState();
    }

    function paintMarker(context) {
      remember(context);
      const snapshot = exportState();
      if (!snapshot.active || typeof context.projectFace !== "function") return;
      const projection = context.projectFace(snapshot.index, 0.018);
      if (!projection || projection.z <= 0.02 || !projection.boundary.length) return;

      const drawing = context.context2d;
      if (!drawing) return;
      const reduceMotion = !!(context.state && context.state.reduceMotion);
      const pulse = reduceMotion ? 1 : 1 + Math.sin((context.now || 0) / 240) * 0.045;
      const center = projection.center;
      const boundary = projection.boundary.map((point) => ({
        x: center.x + (point.x - center.x) * pulse,
        y: center.y + (point.y - center.y) * pulse,
      }));
      const fontSize = Math.max(13, Math.min(30, Math.sqrt(projection.area || 225) * 0.9));

      drawing.save();
      drawing.beginPath();
      drawing.moveTo(boundary[0].x, boundary[0].y);
      for (let i = 1; i < boundary.length; i++) drawing.lineTo(boundary[i].x, boundary[i].y);
      drawing.closePath();
      drawing.fillStyle = "#ffd500";
      drawing.strokeStyle = "#111111";
      drawing.lineWidth = 2.5;
      drawing.fill();
      drawing.stroke();
      drawing.fillStyle = "#111111";
      drawing.font = `700 ${fontSize}px "IBM Plex Mono", ui-monospace, monospace`;
      drawing.textAlign = "center";
      drawing.textBaseline = "middle";
      drawing.fillText("!", center.x, center.y + fontSize * 0.03);
      drawing.restore();
    }

    const variant = {
      id: RUN_KIND,

      reset(context) {
        remember(context);
        hazard.restore({ active: false, index: null, remainingMs: 0 }, gameFor(context));
        paused = false;
        pausedState = null;
        terminalReason = null;
        lastAnnouncement = "";
        announce("Dig a face to release the Glitch.");
      },

      admitReveal(context) {
        remember(context);
        const result = hazard.admitReveal(context.index);
        if (result.status === "blocked" && context.source === "direct") {
          announce("That face is occupied. The Glitch blocks a direct dig.");
        }
        return result;
      },

      admitFlag(context) {
        remember(context);
        const result = hazard.admitReveal(context.index);
        if (result.status === "blocked") {
          announce("That face is occupied. The Glitch cannot be flagged.");
        }
        return result;
      },

      firstResolvedDig(context) {
        remember(context);
        const result = hazard.spawn(gameFor(context));
        if (result.status === "waiting") {
          announce("The Glitch appeared. Trap it by closing every route.");
          requestUpdate(context, true);
          return closeIfTrapped(context);
        }
        return result;
      },

      reveal(context) {
        remember(context);
        const game = gameFor(context);
        const revealed = Array.isArray(context.revealed)
          ? context.revealed
          : [context.index];
        if (revealed.some((index) => game.cells[index] && game.cells[index].isMine)) {
          return { status: "idle" };
        }
        return closeIfTrapped(context);
      },

      flag(context) {
        remember(context);
        return closeIfTrapped(context);
      },

      tick(context) {
        remember(context);
        if (paused) return { status: "waiting", remainingMs: exportState().remainingMs };
        return finishFrom(hazard.tick(gameFor(context)), context);
      },

      draw(context) {
        paintMarker(context);
      },

      exportState() {
        return exportPersistedState();
      },

      importState(context) {
        remember(context);
        const saved = readPersistedState(context.saved, context.state);
        if (!saved) return false;
        const result = hazard.restore(saved.hazard, gameFor(context));
        if (result.status === "blocked") return false;
        paused = false;
        pausedState = null;
        terminalReason = saved.terminalReason;
        if (result.status === "waiting") {
          announce("Glitch run restored.");
        }
        return true;
      },

      captureUndo(context) {
        remember(context);
        return { hazard: exportState(), terminalReason };
      },

      restoreUndo(context) {
        remember(context);
        const saved = context.saved || {};
        const preservePause = paused;
        terminalReason = TERMINAL_REASONS.has(saved.terminalReason)
          ? saved.terminalReason
          : null;
        const result = hazard.restore(
          saved.hazard || { active: false, index: null, remainingMs: 0 },
          gameFor(context)
        );
        if (preservePause) {
          paused = true;
          pausedState = hazard.exportState();
        } else {
          paused = false;
          pausedState = null;
        }
        announce(result.status === "waiting" ? "Previous Glitch position restored." : "Glitch reset.");
      },

      terminal(context) {
        remember(context);
        hazard.restore({ active: false, index: null, remainingMs: 0 }, gameFor(context));
        paused = false;
        pausedState = null;
        if (context.outcome === "win" || terminalReason === "trapped") {
          terminalReason = "trapped";
          announce("Glitch trapped. Every route is closed.");
        } else if (terminalReason === "hazard-mine") {
          announce("The Glitch reached a mine.");
        } else {
          terminalReason = "direct-mine";
          announce("Mine detonated. Run lost.");
        }
      },

      terminalCopy(context) {
        if (context.outcome === "win" || terminalReason === "trapped") {
          return { message: "Glitch trapped. Every route is closed!", share: true };
        }
        if (terminalReason === "hazard-mine") {
          return { message: "The Glitch reached a mine.", share: false };
        }
        return { message: "Mine detonated. The Glitch escaped.", share: false };
      },

      useDefaultWin() {
        return false;
      },
    };

    return { variant, pause, resume, exportState };
  }

  function forwardCompletion(payload, host) {
    if (!host || !payload) return;
    if (typeof host.dispatchEvent === "function" && typeof host.CustomEvent === "function") {
      host.dispatchEvent(new host.CustomEvent("hexsweeper:run-complete", { detail: payload }));
    }
    if (!host.parent || host.parent === host || !host.location) return;
    try {
      const origin = host.location.origin;
      if (host.parent.location.origin === origin && typeof host.parent.postMessage === "function") {
        host.parent.postMessage(payload, origin);
      }
    } catch (_) {
      // Cross-origin parent access is intentionally ignored.
    }
  }

  function boot(options) {
    options = options || {};
    const host = options.root || (typeof window !== "undefined" ? window : null);
    if (!host || !host.document || !host.SphereSweeper) {
      throw new Error("GlitchSphere: browser dependencies not loaded");
    }

    const document = host.document;
    const canvas = document.getElementById(options.canvasId || "gameCanvas");
    const statusElement = document.getElementById("glitch-status");
    const adapter = createAdapter({
      random: options.random,
      now: options.now,
      moveIntervalMs: options.moveIntervalMs,
      statusElement,
    });
    let game = null;
    let helpPauseHeld = false;
    function acquireHelpPause() {
      if (helpPauseHeld) return;
      helpPauseHeld = true;
      if (game) game.pauseTimer("help");
    }
    function releaseHelpPause() {
      if (!helpPauseHeld) return;
      helpPauseHeld = false;
      if (game) game.resumeTimer("help");
    }
    game = host.SphereSweeper.boot({
      canvasId: options.canvasId || "gameCanvas",
      variant: adapter.variant,
      storageKey: STORAGE_KEY,
      runKind: RUN_KIND,
      createRunId: options.createRunId,
      onHelpOpen: acquireHelpPause,
      onHelpClose: releaseHelpPause,
      onRunComplete(payload) {
        forwardCompletion(payload, host);
        if (typeof options.onRunComplete === "function") options.onRunComplete(payload);
      },
    });

    const basePause = typeof game.pauseTimer === "function" ? game.pauseTimer.bind(game) : function () {};
    const baseResume = typeof game.resumeTimer === "function" ? game.resumeTimer.bind(game) : function () {};
    const baseUndo = typeof game.undo === "function" ? game.undo.bind(game) : null;
    const pauseReasons = new Set();
    game.pauseTimer = function pauseTimer(reason) {
      const key = typeof reason === "string" && reason ? reason : "menu";
      const wasRunning = pauseReasons.size === 0;
      pauseReasons.add(key);
      if (wasRunning) {
        basePause();
        adapter.pause();
      }
    };
    game.resumeTimer = function resumeTimer(reason) {
      const key = typeof reason === "string" && reason ? reason : "menu";
      pauseReasons.delete(key);
      if (pauseReasons.size === 0) {
        adapter.resume();
        baseResume();
      }
    };
    if (baseUndo) {
      game.undo = function undo() {
        const restored = baseUndo();
        if (restored && pauseReasons.size > 0) basePause();
        return restored;
      };
    }

    if (helpPauseHeld) game.pauseTimer("help");

    if (canvas && typeof canvas.addEventListener === "function") {
      canvas.addEventListener("keydown", (event) => {
        if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
        const state = game.getState();
        if (!state || state.isGameOver) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          state.targetRotY += event.key === "ArrowRight" ? ROTATION_STEP : -ROTATION_STEP;
          return;
        }
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          state.targetRotX += event.key === "ArrowDown" ? ROTATION_STEP : -ROTATION_STEP;
          return;
        }
        if (event.key !== "Enter" && event.key !== " " && event.code !== "Space") return;
        event.preventDefault();
        const index = game.pickTile(state.centerX, state.centerY);
        if (index < 0) return;
        if (event.shiftKey) game.flagAt(index);
        else game.digAt(index);
      });
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") game.pauseTimer("visibility");
      else game.resumeTimer("visibility");
    });
    if (document.visibilityState === "hidden") game.pauseTimer("visibility");

    const menu = typeof host.initHexBloom === "function" ? host.initHexBloom(game) : null;
    return { game, menu, adapter };
  }

  return {
    STORAGE_KEY,
    RUN_KIND,
    createAdapter,
    forwardCompletion,
    boot,
  };
});
