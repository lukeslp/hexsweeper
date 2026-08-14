/**
 * File Purpose: Flux Sphere adapter for the canonical Sphere variant lifecycle.
 * Primary Functions: createAdapter, boot, forwardCompletion.
 * Shared Inputs: FluxPairs and SphereSweeper.
 * Author: Luke Steuber <luke@lukesteuber.com>
 */
(function attachFluxSphere(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./flux-pairs.js"));
  } else {
    root.FluxSphere = factory(root.FluxPairs);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildFluxSphere(createFluxPairs) {
  "use strict";

  const STORAGE_KEY = "hexsweeper-flux-sphere-run-v1";
  const RUN_KIND = "flux-sphere";
  const ROTATION_STEP = Math.PI / 18;
  const ECHO_VISIBLE_MS = 1600;

  function createAdapter(options) {
    options = options || {};
    if (typeof createFluxPairs !== "function") {
      throw new Error("FluxSphere: pair engine not loaded");
    }
    const pairs = createFluxPairs();
    const statusElement = options.statusElement || null;
    const now = typeof options.now === "function"
      ? options.now
      : () => typeof performance !== "undefined" ? performance.now() : Date.now();
    const schedule = typeof options.schedule === "function"
      ? options.schedule
      : (callback) => setTimeout(callback, 20);
    let lastContext = null;
    let lastAnnouncement = "";
    let announcementToken = 0;
    let lastEcho = null;
    let justActivated = false;
    let tracedPair = null;

    function remember(context) {
      if (context) lastContext = context;
      return context || lastContext;
    }

    function gameFor(context) {
      const current = remember(context) || {};
      return {
        cells: current.cells || (current.state && current.state.cells) || [],
        tiles: current.tiles || (current.state && current.state.tiles) || [],
      };
    }

    function announce(message) {
      if (!statusElement || !message) return;
      const repeated = message === lastAnnouncement;
      lastAnnouncement = message;
      const token = ++announcementToken;
      if (repeated) {
        statusElement.textContent = "";
        schedule(() => {
          if (token === announcementToken) statusElement.textContent = message;
        });
        return;
      }
      statusElement.textContent = message;
    }

    function requestUpdate(context, persist) {
      const current = remember(context);
      if (!current) return;
      if (typeof current.requestDraw === "function") current.requestDraw();
      if (persist && typeof current.persist === "function") current.persist();
    }

    function exportState() {
      return {
        pairs: pairs.exportState(),
        trace: tracedPair ? tracedPair.slice() : null,
      };
    }

    function validTrace(trace, savedPairs, game) {
      if (trace == null) return null;
      if (!Array.isArray(trace) || trace.length !== 2) return false;
      const [from, partner] = trace;
      const mapping = savedPairs && Array.isArray(savedPairs.pairFor) ? savedPairs.pairFor : [];
      if (!Number.isInteger(from) || !Number.isInteger(partner) || from === partner) return false;
      if (mapping[from] !== partner || mapping[partner] !== from) return false;
      const cells = game.cells || [];
      if (!cells[from] || !cells[partner]) return false;
      if (cells[from].revealed || cells[partner].revealed) return false;
      return [from, partner];
    }

    function paintEndpoint(context, index, glyph, palette) {
      if (typeof context.projectFace !== "function" || !context.context2d) return false;
      const projection = context.projectFace(index, 0.02);
      if (!projection || projection.z <= 0.02 || !projection.boundary.length) return false;
      const drawing = context.context2d;
      const center = projection.center;
      const fontSize = Math.max(12, Math.min(27, Math.sqrt(projection.area || 225) * 0.82));
      drawing.save();
      drawing.beginPath();
      drawing.moveTo(projection.boundary[0].x, projection.boundary[0].y);
      for (let i = 1; i < projection.boundary.length; i++) {
        drawing.lineTo(projection.boundary[i].x, projection.boundary[i].y);
      }
      drawing.closePath();
      drawing.strokeStyle = palette.stroke;
      drawing.lineWidth = 3;
      drawing.stroke();
      const badgeRadius = fontSize * 0.62;
      drawing.beginPath();
      drawing.arc(center.x, center.y, badgeRadius, 0, Math.PI * 2);
      drawing.fillStyle = "#ffffff";
      drawing.fill();
      drawing.strokeStyle = "#000000";
      drawing.lineWidth = 2;
      drawing.stroke();
      drawing.fillStyle = "#000000";
      drawing.font = `700 ${fontSize}px "IBM Plex Mono", ui-monospace, monospace`;
      drawing.textAlign = "center";
      drawing.textBaseline = "middle";
      drawing.fillText(glyph, center.x, center.y + fontSize * 0.03);
      drawing.restore();
      return true;
    }

    const variant = {
      id: RUN_KIND,

      reset(context) {
        remember(context);
        pairs.reset();
        lastEcho = null;
        justActivated = false;
        tracedPair = null;
        lastAnnouncement = "";
        announcementToken++;
        announce("Dig a face to energize the Flux field.");
      },

      firstResolvedDig(context) {
        remember(context);
        const result = pairs.activate(gameFor(context));
        lastEcho = null;
        justActivated = result.status === "active";
        const noun = result.pairCount === 1 ? "pair" : "pairs";
        announce(`Flux linked ${result.pairCount} distant ${noun}. Activate a face once to trace its pair, then again to open both.`);
        requestUpdate(context, true);
        return result;
      },

      admitReveal(context) {
        remember(context);
        if (!context || context.source !== "direct") return true;
        const partner = pairs.partnerFor(context.index);
        if (partner < 0) return true;
        if (tracedPair && tracedPair.includes(context.index)) return true;
        tracedPair = [context.index, partner];
        announce("Pair traced: A here, B across the globe. Rotate to inspect B; activate either again to commit both, or flag one to ground it.");
        requestUpdate(context, true);
        return { allowed: false, status: "traced", from: context.index, partner };
      },

      reveal(context) {
        remember(context);
        if (!context || context.source !== "direct") return { status: "idle" };
        const game = gameFor(context);
        const cell = game.cells[context.index];
        if (!cell) return { status: "idle" };
        const partner = pairs.partnerFor(context.index);
        tracedPair = null;
        if (partner < 0) {
          announce("This face has no remaining Flux partner.");
          return { status: "unpaired", from: context.index };
        }
        const partnerCell = game.cells[partner];
        if (!partnerCell) return { status: "idle" };
        if (partnerCell.flagged) {
          announce("The linked face is flagged, so the Flux echo is held.");
          return { status: "held", from: context.index, partner };
        }
        if (partnerCell.revealed) {
          announce("That Flux link was already resolved.");
          return { status: "resolved", from: context.index, partner };
        }
        if (cell.isMine) {
          const resolution = typeof context.resolveLinkedFaces === "function"
            ? context.resolveLinkedFaces([partner])
            : { opened: [], detonated: -1 };
          const opened = resolution && Array.isArray(resolution.opened) ? resolution.opened : [];
          lastEcho = { from: context.index, partner, opened: opened.slice(), at: now() };
          announce("Mine detonated. Its linked endpoint resolved with it.");
          requestUpdate(context, false);
          return {
            status: "detonated",
            from: context.index,
            partner,
            opened,
            detonated: context.index,
          };
        }
        const resolution = typeof context.resolveLinkedFaces === "function"
          ? context.resolveLinkedFaces([partner])
          : { opened: [], detonated: -1 };
        const opened = resolution && Array.isArray(resolution.opened) ? resolution.opened : [];
        if (!opened.length) {
          announce("The Flux echo could not open its linked face.");
          return { status: "held", from: context.index, partner };
        }
        lastEcho = { from: context.index, partner, opened: opened.slice(), at: now() };
        if (resolution.detonated >= 0) {
          announce("The linked endpoint was a mine. The Flux field collapsed.");
          requestUpdate(context, false);
          return {
            status: "detonated",
            from: context.index,
            partner,
            opened: opened.slice(),
            detonated: resolution.detonated,
          };
        }
        announce(opened.length === 1
          ? "Flux echo opened a linked face."
          : `Flux echo opened ${opened.length} linked faces.`);
        requestUpdate(context, false);
        return { status: "echoed", from: context.index, partner, opened: opened.slice() };
      },

      draw(context) {
        remember(context);
        if (tracedPair) {
          paintEndpoint(context, tracedPair[0], "A", { stroke: "#00a6b2", fill: "#005a61" });
          paintEndpoint(context, tracedPair[1], "B", { stroke: "#d97706", fill: "#78350f" });
        }
        if (!lastEcho) return;
        const frameNow = Number.isFinite(context.now) ? context.now : now();
        if (frameNow - lastEcho.at > ECHO_VISIBLE_MS) {
          lastEcho = null;
          return;
        }
        paintEndpoint(context, lastEcho.from, "↔", { stroke: "#00a6b2", fill: "#005a61" });
        paintEndpoint(context, lastEcho.partner, "↔", { stroke: "#d97706", fill: "#78350f" });
        if (!(context.state && context.state.reduceMotion) && typeof context.requestDraw === "function") {
          context.requestDraw();
        }
      },

      exportState,

      importState(context) {
        remember(context);
        if (!context.saved || typeof context.saved !== "object") return false;
        const game = gameFor(context);
        const trace = validTrace(context.saved.trace, context.saved.pairs, game);
        if (trace === false) return false;
        const result = pairs.restore(context.saved.pairs, game);
        if (result.status === "blocked") return false;
        justActivated = false;
        lastEcho = null;
        tracedPair = trace;
        announce(tracedPair
          ? "Traced Flux pair restored. Rotate to inspect B, then activate either endpoint to commit."
          : result.status === "active" ? "Flux run restored." : "Dig a face to energize the Flux field.");
        return true;
      },

      captureUndo(context) {
        remember(context);
        const saved = {
          pairs: pairs.exportState(),
          regenerateOnRestore: justActivated,
          trace: tracedPair ? tracedPair.slice() : null,
        };
        justActivated = false;
        return saved;
      },

      restoreUndo(context) {
        remember(context);
        const saved = context.saved || {};
        const result = saved.regenerateOnRestore
          ? pairs.activate(gameFor(context))
          : pairs.restore(saved.pairs, gameFor(context));
        if (result.status === "blocked") pairs.reset();
        justActivated = false;
        lastEcho = null;
        const trace = validTrace(saved.trace, pairs.exportState(), gameFor(context));
        tracedPair = trace === false ? null : trace;
        announce(tracedPair
          ? "Previous Flux reveal restored with its traced A/B pair. Activating either endpoint now commits both."
          : "Previous Flux reveal restored.");
        requestUpdate(context, false);
      },

      terminal(context) {
        remember(context);
        lastEcho = null;
        justActivated = false;
        tracedPair = null;
        announce(context.outcome === "win"
          ? "Flux stabilized. Every safe face is clear."
          : "Mine detonated. The Flux field collapsed.");
      },

      flag(context) {
        remember(context);
        if (!context || !context.flagged) return;
        if (tracedPair && tracedPair.includes(context.index)) tracedPair = null;
        announce("Endpoint grounded. Its linked echo will hold while the flag remains.");
        requestUpdate(context, false);
      },

      terminalCopy(context) {
        return context.outcome === "win"
          ? { message: "Flux stabilized. Every safe face is clear!", share: true }
          : { message: "Mine detonated. The Flux field collapsed.", share: false };
      },

      useDefaultWin() {
        return true;
      },
    };

    return { variant, exportState };
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
      throw new Error("FluxSphere: browser dependencies not loaded");
    }
    const document = host.document;
    const canvas = document.getElementById(options.canvasId || "gameCanvas");
    const adapter = createAdapter({
      statusElement: document.getElementById("flux-status"),
      now: options.now,
    });
    const game = host.SphereSweeper.boot({
      canvasId: options.canvasId || "gameCanvas",
      variant: adapter.variant,
      storageKey: STORAGE_KEY,
      runKind: RUN_KIND,
      createRunId: options.createRunId,
      onRunComplete(payload) {
        forwardCompletion(payload, host);
        if (typeof options.onRunComplete === "function") options.onRunComplete(payload);
      },
    });

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
