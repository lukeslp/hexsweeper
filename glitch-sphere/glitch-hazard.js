/*
 * Deterministic, board-agnostic state machine for the Glitch Sphere hazard.
 * The adapter supplies simple { cells, neighbors } data; this module owns no UI
 * or persistence side effects.
 */
(function attachGlitchHazard(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory;
  } else {
    root.GlitchHazard = factory;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createHazard(options) {
  "use strict";

  options = options || {};
  const random = typeof options.random === "function" ? options.random : Math.random;
  const now = typeof options.now === "function" ? options.now : Date.now;
  const moveIntervalMs = Number.isFinite(options.moveIntervalMs) && options.moveIntervalMs > 0
    ? options.moveIntervalMs
    : 1000;

  let active = false;
  let index = null;
  let nextMoveAt = null;

  function remainingMs() {
    return active ? Math.max(0, nextMoveAt - now()) : 0;
  }

  function isEligible(cell) {
    return cell && !cell.revealed && !cell.flagged && !cell.isMine;
  }

  function close() {
    active = false;
    nextMoveAt = null;
  }

  function choose(indices) {
    const raw = Number(random());
    const ratio = Number.isFinite(raw) ? Math.max(0, Math.min(raw, 1)) : 0;
    return indices[Math.min(indices.length - 1, Math.floor(ratio * indices.length))];
  }

  function validActiveSnapshot(snapshot, game) {
    return snapshot && snapshot.active === true && Number.isInteger(snapshot.index)
      && snapshot.index >= 0 && Array.isArray(game && game.cells)
      && snapshot.index < game.cells.length && isEligible(game.cells[snapshot.index])
      && Number.isFinite(snapshot.remainingMs) && snapshot.remainingMs >= 0
      && snapshot.remainingMs <= moveIntervalMs;
  }

  return {
    spawn(game) {
      const cells = game && game.cells;
      if (!Array.isArray(cells)) return { status: "idle" };
      const eligible = [];
      for (let cellIndex = 0; cellIndex < cells.length; cellIndex++) {
        if (isEligible(cells[cellIndex])) eligible.push(cellIndex);
      }
      if (!eligible.length) return { status: "idle" };

      active = true;
      index = choose(eligible);
      nextMoveAt = now() + moveIntervalMs;
      return { status: "waiting", index };
    },

    tick(game) {
      if (!active) return { status: "idle" };
      const remaining = remainingMs();
      if (remaining > 0) return { status: "waiting", remainingMs: remaining };

      const cells = game && game.cells;
      const neighbors = game && game.neighbors;
      const adjacent = Array.isArray(neighbors && neighbors[index]) ? neighbors[index] : [];
      const openRoutes = adjacent.filter((candidate) => {
        const route = cells && cells[candidate];
        return route && !route.revealed && !route.flagged;
      });
      if (!openRoutes.length) {
        const trappedIndex = index;
        close();
        return { status: "trapped", index: trappedIndex };
      }

      const from = index;
      const destination = choose(openRoutes);
      if (cells[destination].isMine) {
        index = destination;
        close();
        return { status: "mine", from, index: destination };
      }

      index = destination;
      nextMoveAt = now() + moveIntervalMs;
      return { status: "moved", from, index };
    },

    admitReveal(candidate) {
      return active && candidate === index
        ? { status: "blocked", index }
        : { status: "idle" };
    },

    exportState() {
      return {
        active,
        index: active ? index : null,
        remainingMs: remainingMs(),
      };
    },

    restore(snapshot, game) {
      if (snapshot && snapshot.active === false && Number.isFinite(snapshot.remainingMs)
        && snapshot.remainingMs >= 0) {
        close();
        index = null;
        return { status: "idle" };
      }
      if (!validActiveSnapshot(snapshot, game)) return { status: "blocked" };

      active = true;
      index = snapshot.index;
      nextMoveAt = now() + snapshot.remainingMs;
      return { status: "waiting", index, remainingMs: snapshot.remainingMs };
    },
  };
});
