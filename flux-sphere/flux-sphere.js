/**
 * File Purpose: Flux Sphere adapter for the canonical Sphere variant lifecycle.
 * Primary Functions: createAdapter, boot, forwardCompletion.
 * Shared Inputs: FluxPairs and SphereSweeper.
 *
 * Rules (version 3, 2026-10-03): after the first dig, every covered face has a
 * twin about 55 degrees away, and twins share a fate: both safe or both mines.
 * Dig a face and its twin opens too (the echo). Because a safe face's twin is
 * always safe, an echo can never set off a mine; only a face you dig yourself
 * can. The Twin tool (button, or E on the keyboard) shows a face's twin
 * without digging, so a stuck spot can be solved from the other end. A flag on
 * a twin still holds its echo, and the twin of every flag gets a dashed mark.
 *
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
  /** Marks the one-line first-visit cue as shown (once per browser). */
  const WELCOME_KEY = "hexsweeper-flux-welcome-v3";
  const CUE = "Tap to clear · hold to flag · drag to spin";
  const ROTATION_STEP = Math.PI / 18;
  const ECHO_VISIBLE_MS = 2000;
  const ECHO_HOLD_MS = 1200;
  const ECHO_TRAVEL_MS = 450;
  /** Margin past an echo's expiry before the clearing repaint, so its frame is past it. */
  const ECHO_CLEAR_SLACK_MS = 40;
  const MAX_ECHOES = 6;
  /** A traced twin closer to the limb than this turns the globe toward it. */
  const FRAME_MIN_Z = 0.3;
  const ARC_STEPS = 32;
  const ARC_LIFT = 0.03;
  const ARC_BOW = 0.07;
  const A_COLOR = "#00a6b2";
  const B_COLOR = "#d97706";
  const HINT_COLOR = "#d62828";

  function unit(point) {
    const length = Math.hypot(point.x, point.y, point.z) || 1;
    return { x: point.x / length, y: point.y / length, z: point.z / length };
  }

  function angleDelta(from, to) {
    const tau = Math.PI * 2;
    let delta = to - from;
    delta = ((delta + Math.PI) % tau + tau) % tau - Math.PI;
    return delta;
  }

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
    const scheduleAfter = typeof options.scheduleAfter === "function"
      ? options.scheduleAfter
      : (callback, ms) => setTimeout(callback, ms);
    const listeners = new Set();
    let lastContext = null;
    let lastAnnouncement = "";
    let announcementToken = 0;
    let echoes = [];
    let justActivated = false;
    let tracedPair = null;
    let traceArmed = false;
    let pairsActive = false;
    let runOver = false;
    let projector = null;
    let clearPending = false;

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

    function stateFor(context) {
      const current = context || lastContext || {};
      return current.state || null;
    }

    function uiSnapshot() {
      return { armed: traceArmed, active: pairsActive, over: runOver, traced: tracedPair ? tracedPair.slice() : null };
    }

    function notify() {
      const snapshot = uiSnapshot();
      for (const listener of listeners) {
        try {
          listener(snapshot);
        } catch (_) {}
      }
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

    function setArmed(armed) {
      const next = !!armed;
      if (next === traceArmed) return;
      traceArmed = next;
      notify();
    }

    function syncActive(over) {
      pairsActive = pairs.exportState().active;
      if (typeof over === "boolean") runOver = over;
      if (!pairsActive || runOver) traceArmed = false;
      notify();
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
      // A trace starts on a covered face; its twin may already be open.
      if (cells[from].revealed) return false;
      return [from, partner];
    }

    function pushEcho(entry) {
      echoes.push(Object.assign({ at: now() }, entry));
      if (echoes.length > MAX_ECHOES) echoes = echoes.slice(-MAX_ECHOES);
    }

    /**
     * Reduced motion paints echoes as still frames, and the Sphere engine parks
     * its frame loop once nothing moves (frameNeedsPaint), so no frame would
     * come along to remove an arc when it expires. Book one repaint for the
     * moment the oldest echo is due to go; that frame books the next, if any.
     */
    function scheduleEchoClear(frameNow) {
      if (clearPending || !echoes.length) return;
      const due = echoes[0].at + ECHO_VISIBLE_MS;
      clearPending = true;
      scheduleAfter(() => {
        clearPending = false;
        requestUpdate(null, false);
      }, Math.max(16, due - frameNow + ECHO_CLEAR_SLACK_MS));
    }

    // ---- camera ----

    /** Turn the globe so a unit direction faces the camera (focusPatch's math). */
    function turnToward(context, direction) {
      const state = stateFor(context);
      if (!state || !direction) return false;
      state.ambientSpin = false;
      const yaw = Math.atan2(-direction.x, direction.z);
      const pitch = Math.atan2(direction.y, Math.hypot(direction.x, direction.z));
      state.targetRotY = state.rotY + angleDelta(state.rotY, yaw);
      state.targetRotX = state.rotX + angleDelta(state.rotX, pitch);
      requestUpdate(context, false);
      return true;
    }

    function faceDirection(context, index) {
      const tile = gameFor(context).tiles[index];
      return tile && tile.centerPoint ? unit(tile.centerPoint) : null;
    }

    function faceFacing(context, index) {
      if (!context || typeof context.projectFace !== "function") return 1;
      const projection = context.projectFace(index, 0);
      if (!projection) return 1;
      return Number.isFinite(projection.normalZ) ? projection.normalZ : projection.z;
    }

    /** Pointer traces only move the camera when the twin is hidden or on the limb. */
    function frameTrace(context, from, partner) {
      if (faceFacing(context, partner) >= FRAME_MIN_Z) return false;
      const a = faceDirection(context, from);
      const b = faceDirection(context, partner);
      if (!a || !b) return false;
      return turnToward(context, unit({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }));
    }

    // ---- tracing ----

    function describeTrace(context, partner) {
      const cell = gameFor(context).cells[partner] || {};
      if (cell.revealed) return "Its twin B is already open, so A is safe too.";
      if (cell.flagged) return "Its twin B is flagged. If that flag is right, A is a mine too.";
      return "Twin traced: A here, B there. Twins match: both safe or both mines.";
    }

    /**
     * Trace one face. `center` (keyboard) turns the globe to center the twin so
     * Enter acts on it; tracing either end again turns back to the other end.
     */
    function traceFace(context, index, center) {
      const current = remember(context);
      const game = gameFor(current);
      const cell = game.cells[index];
      setArmed(false);
      if (!cell) return { status: "idle" };
      if (!pairs.exportState().active) {
        announce("Twins link after your first dig.");
        return { status: "inactive", from: index };
      }
      if (cell.revealed) {
        announce("That face is open. Pick a covered face to see its twin.");
        return { status: "open", from: index };
      }
      if (center && tracedPair && tracedPair.includes(index)) {
        const other = tracedPair[0] === index ? tracedPair[1] : tracedPair[0];
        turnToward(current, faceDirection(current, other));
        announce(other === tracedPair[0] ? "Turned to A." : "Turned to B.");
        return { status: "turned", from: index, partner: other };
      }
      const partner = pairs.partnerFor(index);
      if (partner < 0) {
        tracedPair = null;
        announce("This face has no twin.");
        requestUpdate(current, true);
        return { status: "unpaired", from: index };
      }
      tracedPair = [index, partner];
      if (center) turnToward(current, faceDirection(current, partner));
      else frameTrace(current, index, partner);
      announce(describeTrace(current, partner));
      requestUpdate(current, true);
      notify();
      return { status: "traced", from: index, partner };
    }

    // ---- echoes ----

    function echoFrom(context, sources, kind) {
      const game = gameFor(context);
      const links = [];
      const held = [];
      let alreadyOpen = 0;
      let lonely = 0;
      for (const source of sources) {
        const partner = pairs.partnerFor(source);
        if (partner < 0) {
          lonely++;
          continue;
        }
        const partnerCell = game.cells[partner];
        if (!partnerCell) continue;
        if (partnerCell.revealed) {
          alreadyOpen++;
          continue;
        }
        if (partnerCell.flagged) {
          held.push([source, partner]);
          continue;
        }
        // Twins share a fate, so this cannot happen; never echo onto a mine.
        if (partnerCell.isMine) continue;
        links.push([source, partner]);
      }
      let opened = [];
      if (links.length && typeof context.revealSafeFaces === "function") {
        const result = context.revealSafeFaces(links.map(([, partner]) => partner));
        opened = Array.isArray(result) ? result : [];
      }
      const openedSet = new Set(opened);
      const fired = links.filter(([, partner]) => openedSet.has(partner));
      for (const [source, partner] of fired) {
        pushEcho({ from: source, partner, opened: opened.slice(), kind: "echo" });
      }
      if (fired.length) {
        if (kind === "chord" && fired.length > 1) {
          announce(`Echo: ${fired.length} twins opened ${opened.length} faces.`);
        } else {
          announce(opened.length === 1 ? "Echo: its twin opened." : `Echo: its twin opened ${opened.length} faces.`);
        }
      } else if (held.length) {
        announce("Echo held: its twin is flagged. Twins match, so that flag is wrong.");
      } else if (kind === "direct" && alreadyOpen) {
        announce("Its twin was already open.");
      } else if (kind === "direct" && lonely) {
        announce("This face has no twin.");
      }
      requestUpdate(context, false);
      const first = sources[0];
      if (kind === "direct") {
        const partner = pairs.partnerFor(first);
        if (fired.length) return { status: "echoed", from: first, partner, opened: opened.slice() };
        if (held.length) return { status: "held", from: first, partner };
        if (alreadyOpen) return { status: "resolved", from: first, partner };
        return { status: "unpaired", from: first };
      }
      return { status: fired.length ? "echoed" : "idle", from: first, opened: opened.slice(), twins: fired.length };
    }

    // ---- drawing ----

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

    /** The twin of a flag: a dashed ring and a dot, no fill (it is not a flag). */
    function paintFlagTwin(context, index) {
      const projection = context.projectFace(index, 0.02);
      if (!projection || projection.z <= 0.05 || !projection.boundary.length) return false;
      const drawing = context.context2d;
      const center = projection.center;
      const size = Math.sqrt(projection.area || 225);
      drawing.save();
      drawing.beginPath();
      const inset = 0.8;
      projection.boundary.forEach((point, i) => {
        const x = center.x + (point.x - center.x) * inset;
        const y = center.y + (point.y - center.y) * inset;
        if (i === 0) drawing.moveTo(x, y);
        else drawing.lineTo(x, y);
      });
      drawing.closePath();
      if (typeof drawing.setLineDash === "function") drawing.setLineDash([Math.max(3, size * 0.16), Math.max(2, size * 0.1)]);
      drawing.strokeStyle = HINT_COLOR;
      drawing.lineWidth = Math.max(1.5, Math.min(3, size * 0.09));
      drawing.stroke();
      if (typeof drawing.setLineDash === "function") drawing.setLineDash([]);
      drawing.beginPath();
      drawing.arc(center.x, center.y, Math.max(2, Math.min(5, size * 0.12)), 0, Math.PI * 2);
      drawing.fillStyle = HINT_COLOR;
      drawing.fill();
      drawing.restore();
      return true;
    }

    function arcPoints(context, from, to) {
      if (typeof projector !== "function") return null;
      const a = faceDirection(context, from);
      const b = faceDirection(context, to);
      if (!a || !b) return null;
      const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
      const omega = Math.acos(dot);
      const sinOmega = Math.sin(omega);
      const points = [];
      for (let step = 0; step <= ARC_STEPS; step++) {
        const t = step / ARC_STEPS;
        let p = a;
        if (sinOmega > 1e-6) {
          const k0 = Math.sin((1 - t) * omega) / sinOmega;
          const k1 = Math.sin(t * omega) / sinOmega;
          p = { x: a.x * k0 + b.x * k1, y: a.y * k0 + b.y * k1, z: a.z * k0 + b.z * k1 };
        }
        const radius = 1 + ARC_LIFT + ARC_BOW * Math.sin(Math.PI * t);
        const projected = projector({ x: p.x * radius, y: p.y * radius, z: p.z * radius });
        if (!projected) return null;
        points.push(projected);
      }
      return points;
    }

    /** Stroke only the stretches of the arc on the near side of the globe. */
    function strokeRuns(drawing, points) {
      drawing.beginPath();
      let penDown = false;
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        if (point.z <= 0) {
          penDown = false;
          continue;
        }
        if (!penDown) drawing.moveTo(point.x, point.y);
        else drawing.lineTo(point.x, point.y);
        penDown = true;
      }
      drawing.stroke();
    }

    function paintArc(context, from, to, style) {
      const drawing = context.context2d;
      const points = arcPoints(context, from, to);
      if (!points) return false;
      const first = points[0];
      const last = points[points.length - 1];
      drawing.save();
      if ("globalAlpha" in drawing) drawing.globalAlpha = Math.max(0, Math.min(1, style.alpha));
      if ("lineCap" in drawing) drawing.lineCap = "round";
      if ("lineJoin" in drawing) drawing.lineJoin = "round";
      if (typeof drawing.setLineDash === "function") drawing.setLineDash(style.dashed ? [7, 6] : []);
      drawing.strokeStyle = "rgba(0, 0, 0, 0.55)";
      drawing.lineWidth = 6;
      strokeRuns(drawing, points);
      let core = A_COLOR;
      if (typeof drawing.createLinearGradient === "function") {
        core = drawing.createLinearGradient(first.x, first.y, last.x, last.y);
        core.addColorStop(0, A_COLOR);
        core.addColorStop(1, B_COLOR);
      }
      drawing.strokeStyle = core;
      drawing.lineWidth = 2.6;
      strokeRuns(drawing, points);
      if (typeof drawing.setLineDash === "function") drawing.setLineDash([]);
      if (style.pulse != null && style.pulse < 1) {
        const at = points[Math.min(points.length - 1, Math.round(style.pulse * (points.length - 1)))];
        if (at.z > 0) {
          drawing.beginPath();
          drawing.arc(at.x, at.y, 5.5, 0, Math.PI * 2);
          drawing.fillStyle = "#ffffff";
          drawing.fill();
          drawing.strokeStyle = A_COLOR;
          drawing.lineWidth = 2.5;
          drawing.stroke();
        }
      }
      drawing.restore();
      return true;
    }

    const variant = {
      id: RUN_KIND,

      reset(context) {
        remember(context);
        pairs.reset();
        echoes = [];
        justActivated = false;
        tracedPair = null;
        traceArmed = false;
        lastAnnouncement = "";
        announcementToken++;
        syncActive(false);
        announce("Dig any face. Twins link after your first dig.");
      },

      firstResolvedDig(context) {
        remember(context);
        const result = pairs.activate(gameFor(context));
        echoes = [];
        justActivated = result.status === "active";
        syncActive(false);
        const noun = result.pairCount === 1 ? "pair" : "pairs";
        announce(`Flux linked ${result.pairCount} twin ${noun}. Dig a face and its twin opens too.`);
        requestUpdate(context, true);
        return result;
      },

      admitReveal(context) {
        remember(context);
        if (!context || context.source !== "direct" || !traceArmed) return true;
        const result = traceFace(context, context.index, false);
        return Object.assign({ allowed: false }, result);
      },

      admitFlag(context) {
        remember(context);
        if (!context || !traceArmed) return true;
        const result = traceFace(context, context.index, false);
        return Object.assign({ allowed: false }, result);
      },

      reveal(context) {
        remember(context);
        if (!context || (context.source !== "direct" && context.source !== "chord")) {
          return { status: "idle" };
        }
        const game = gameFor(context);
        const hadTrace = !!tracedPair;
        tracedPair = null;
        if (hadTrace) notify();
        if (context.source === "direct") {
          const cell = game.cells[context.index];
          if (!cell) return { status: "idle" };
          if (cell.isMine) {
            const partner = pairs.partnerFor(context.index);
            if (partner >= 0) pushEcho({ from: context.index, partner, opened: [], kind: "mine" });
            announce(partner >= 0 ? "Mine. Its twin was a mine too." : "Mine.");
            requestUpdate(context, false);
            return { status: "detonated", from: context.index, partner, opened: [], detonated: context.index };
          }
          return echoFrom(context, [context.index], "direct");
        }
        const state = context.state || {};
        if (state.isGameOver || (Number.isInteger(state.detonatorIdx) && state.detonatorIdx >= 0)) {
          return { status: "idle" };
        }
        const tile = game.tiles[context.index];
        const around = new Set(tile && Array.isArray(tile.neighborIndices) ? tile.neighborIndices : []);
        const sources = (Array.isArray(context.revealed) ? context.revealed : []).filter((index) => (
          around.has(index) && game.cells[index] && !game.cells[index].isMine
        ));
        if (!sources.length) return { status: "idle" };
        return echoFrom(context, sources, "chord");
      },

      draw(context) {
        remember(context);
        if (!context || !context.context2d || typeof context.projectFace !== "function") return;
        const state = context.state || {};
        const reduce = !!state.reduceMotion;
        const frameNow = Number.isFinite(context.now) ? context.now : now();
        const { cells } = gameFor(context);

        if (!state.isGameOver) {
          for (let index = 0; index < cells.length; index++) {
            if (!cells[index] || !cells[index].flagged) continue;
            const partner = pairs.partnerFor(index);
            const twin = cells[partner];
            if (!twin || twin.revealed || twin.flagged) continue;
            paintFlagTwin(context, partner);
          }
        }

        echoes = echoes.filter((echo) => frameNow - echo.at <= ECHO_VISIBLE_MS);
        for (const echo of echoes) {
          const age = Math.max(0, frameNow - echo.at);
          const alpha = reduce
            ? 1
            : 1 - Math.max(0, age - ECHO_HOLD_MS) / (ECHO_VISIBLE_MS - ECHO_HOLD_MS);
          paintArc(context, echo.from, echo.partner, {
            alpha,
            pulse: reduce ? null : Math.min(1, age / ECHO_TRAVEL_MS),
          });
          // A lost run already shows every mine; the arc alone links the pair.
          if (echo.kind === "mine") continue;
          paintEndpoint(context, echo.from, "↔", { stroke: A_COLOR });
          paintEndpoint(context, echo.partner, "↔", { stroke: B_COLOR });
        }

        if (tracedPair) {
          paintArc(context, tracedPair[0], tracedPair[1], { alpha: 1, dashed: true, pulse: null });
          paintEndpoint(context, tracedPair[0], "A", { stroke: A_COLOR });
          paintEndpoint(context, tracedPair[1], "B", { stroke: B_COLOR });
        }

        if (echoes.length && typeof context.requestDraw === "function") {
          // Moving arcs need every frame until they fade; still ones only
          // need the frame that clears them.
          if (reduce) scheduleEchoClear(frameNow);
          else context.requestDraw();
        }
      },

      exportState,

      importState(context) {
        remember(context);
        if (!context.saved || typeof context.saved !== "object") return false;
        const game = gameFor(context);
        const savedPairs = context.saved.pairs;
        const trace = validTrace(context.saved.trace, savedPairs, game);
        const result = pairs.restore(savedPairs, game);
        if (result.status === "blocked") return false;
        const mapping = pairs.exportState().pairFor;
        justActivated = false;
        echoes = [];
        traceArmed = false;
        tracedPair = Array.isArray(trace) && mapping[trace[0]] === trace[1] ? trace : null;
        const migrated = !!savedPairs && savedPairs.v !== pairs.exportState().v && result.status === "active";
        pairsActive = result.status === "active";
        runOver = !!(context.state && context.state.isGameOver);
        notify();
        announce(migrated
          ? "Flux has new rules: twins now match, so an echo never hits a mine. Your run carries on."
          : tracedPair
            ? "Twin trace restored."
            : result.status === "active" ? "Flux run restored." : "Dig any face. Twins link after your first dig.");
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
        echoes = [];
        const trace = validTrace(saved.trace, pairs.exportState(), gameFor(context));
        tracedPair = trace === false ? null : trace;
        traceArmed = false;
        syncActive(false);
        announce(tracedPair ? "Undone. Your twin trace is back." : "Undone.");
        requestUpdate(context, false);
      },

      terminal(context) {
        remember(context);
        justActivated = false;
        tracedPair = null;
        syncActive(true);
        announce(context.outcome === "win"
          ? "Flux stabilized. Every safe face is clear."
          : "Mine detonated. The Flux field collapsed.");
      },

      flag(context) {
        remember(context);
        if (!context) return;
        if (tracedPair && tracedPair.includes(context.index)) {
          tracedPair = null;
          notify();
        }
        if (context.flagged) {
          announce(pairs.partnerFor(context.index) >= 0
            ? "Flagged. Its twin gets a dashed mark: twins match."
            : "Flagged.");
        }
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

    return {
      variant,
      exportState,
      /** Pointer Twin tool: the next tap on a face shows its twin instead of digging. */
      armTrace(armed) {
        if (armed && (!pairs.exportState().active || runOver)) {
          announce(runOver ? "Start a new sphere to trace twins." : "Twins link after your first dig.");
          setArmed(false);
          return false;
        }
        setArmed(armed);
        announce(traceArmed ? "Tap a face to see its twin." : "Back to digging.");
        requestUpdate(null, false);
        return traceArmed;
      },
      isTraceArmed: () => traceArmed,
      /** Keyboard: trace the given face and center its twin (again: the other end). */
      traceAndTurn(index) {
        return traceFace(lastContext, index, true);
      },
      clearTrace() {
        const had = traceArmed || !!tracedPair;
        setArmed(false);
        if (tracedPair) {
          tracedPair = null;
          notify();
          requestUpdate(null, true);
        }
        if (had) announce("Twin trace cleared.");
        return had;
      },
      setProjector(fn) {
        projector = typeof fn === "function" ? fn : null;
      },
      wake() {
        requestUpdate(null, false);
      },
      onChange(listener) {
        if (typeof listener !== "function") return () => {};
        listeners.add(listener);
        listener(uiSnapshot());
        return () => listeners.delete(listener);
      },
    };
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

  /**
   * Play starts at once: no sheet opens by itself. A first visit gets one
   * quiet line above the bar instead (the engine's toast); a restored run, a
   * ?welcome= preview or blocked storage never shows it.
   */
  function showFirstVisitCue(host, game) {
    try {
      if (/(?:\?|&)welcome=[01](?:&|$)/.test(host.location ? host.location.search || "" : "")) return;
      const storage = host.localStorage;
      if (!storage || storage.getItem(WELCOME_KEY)) return;
      const frame = typeof host.requestAnimationFrame === "function"
        ? host.requestAnimationFrame.bind(host)
        : (callback) => setTimeout(callback, 16);
      let tries = 0;
      (function check() {
        const state = typeof game.getState === "function" ? game.getState() : null;
        if (!state || !state.cells || !state.cells.length) {
          if (++tries < 180) frame(check);
          return;
        }
        if (state.cells.some((cell) => cell.revealed || cell.flagged)) return;
        if (typeof game.toast === "function") game.toast(CUE, 5200);
        try { storage.setItem(WELCOME_KEY, "1"); } catch (_) {}
      })();
    } catch (_) {
      // Storage blocked: no cue, and still no sheet.
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
      autoWelcome: false,
      onRunComplete(payload) {
        forwardCompletion(payload, host);
        if (typeof options.onRunComplete === "function") options.onRunComplete(payload);
      },
    });

    if (typeof game.projectTile === "function") {
      adapter.setProjector((point) => {
        const state = game.getState();
        const projection = game.projectTile({ centerPoint: point, boundary: [] }, state.rotY, state.rotX, 0);
        return projection ? projection.center : null;
      });
    }

    function stopSpin(state) {
      if (state && state.ambientSpin) {
        state.ambientSpin = false;
        state.targetRotY = state.rotY;
        state.targetRotX = state.rotX;
      }
    }

    if (canvas && typeof canvas.addEventListener === "function") {
      canvas.addEventListener("keydown", (event) => {
        if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
        const state = game.getState();
        if (!state || state.isGameOver) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          stopSpin(state);
          state.targetRotY += event.key === "ArrowRight" ? ROTATION_STEP : -ROTATION_STEP;
          adapter.wake();
          return;
        }
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          stopSpin(state);
          state.targetRotX += event.key === "ArrowDown" ? ROTATION_STEP : -ROTATION_STEP;
          adapter.wake();
          return;
        }
        if (event.key === "e" || event.key === "E") {
          event.preventDefault();
          const index = game.pickTile(state.centerX, state.centerY);
          if (index >= 0) adapter.traceAndTurn(index);
          return;
        }
        if (event.key === "Escape") {
          if (adapter.clearTrace()) event.preventDefault();
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

    const twinButton = document.getElementById("twin-btn");
    if (twinButton && typeof twinButton.addEventListener === "function") {
      twinButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        adapter.armTrace(!adapter.isTraceArmed());
      });
    }
    adapter.onChange((ui) => {
      if (!twinButton) return;
      twinButton.hidden = !ui.active || ui.over;
      twinButton.setAttribute("aria-pressed", ui.armed ? "true" : "false");
      if (twinButton.classList) twinButton.classList.toggle("is-armed", ui.armed);
      if (document.body && document.body.classList) {
        document.body.classList.toggle("flux-tracing", ui.armed);
      }
    });

    const menu = typeof host.initHexBloom === "function" ? host.initHexBloom(game, { tooltips: false }) : null;
    showFirstVisitCue(host, game);
    return { game, menu, adapter };
  }

  return {
    STORAGE_KEY,
    RUN_KIND,
    WELCOME_KEY,
    createAdapter,
    forwardCompletion,
    boot,
  };
});
