/**
 * File Purpose: Deterministic entangled-pair state for Flux Sphere.
 * Primary Functions: activate, partnerFor, exportState, restore, reset.
 * Inputs: Sphere cells and tile center points. Output: symmetric covered-face pairs.
 * Author: Luke Steuber <luke@lukesteuber.com>
 */
(function attachFluxPairs(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory;
  } else {
    root.FluxPairs = factory;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createFluxPairs() {
  "use strict";

  let active = false;
  let pairFor = [];

  function isCellEligible(cell) {
    return !!cell && !cell.revealed && !cell.flagged;
  }

  function separationScore(a, b) {
    const al = Math.hypot(a.x, a.y, a.z) || 1;
    const bl = Math.hypot(b.x, b.y, b.z) || 1;
    return (a.x * b.x + a.y * b.y + a.z * b.z) / (al * bl);
  }

  function summary(unpairedCount) {
    let pairedFaces = 0;
    for (const partner of pairFor) if (partner >= 0) pairedFaces++;
    return {
      status: active ? "active" : "idle",
      pairCount: pairedFaces / 2,
      unpairedCount: unpairedCount == null
        ? pairFor.reduce((count, partner) => count + (partner === -1 ? 1 : 0), 0)
        : unpairedCount,
    };
  }

  function reset() {
    active = false;
    pairFor = [];
    return { status: "idle" };
  }

  function activate(game) {
    const cells = game && Array.isArray(game.cells) ? game.cells : [];
    const tiles = game && Array.isArray(game.tiles) ? game.tiles : [];
    if (!cells.length || tiles.length !== cells.length) return reset();

    pairFor = cells.map(() => -1);
    const remaining = cells
      .map((cell, index) => isCellEligible(cell) && tiles[index] && tiles[index].centerPoint ? index : -1)
      .filter((index) => index >= 0);
    const eligibleCount = remaining.length;

    while (remaining.length > 1) {
      const index = remaining.shift();
      const origin = tiles[index].centerPoint;
      let bestPosition = 0;
      let bestIndex = remaining[0];
      let bestScore = separationScore(origin, tiles[bestIndex].centerPoint);
      for (let position = 1; position < remaining.length; position++) {
        const candidate = remaining[position];
        const score = separationScore(origin, tiles[candidate].centerPoint);
        if (score < bestScore - 1e-12 || (
          Math.abs(score - bestScore) <= 1e-12 && candidate < bestIndex
        )) {
          bestPosition = position;
          bestIndex = candidate;
          bestScore = score;
        }
      }
      remaining.splice(bestPosition, 1);
      pairFor[index] = bestIndex;
      pairFor[bestIndex] = index;
    }

    active = true;
    return summary(eligibleCount % 2);
  }

  function partnerFor(index) {
    if (!active || !Number.isInteger(index) || index < 0 || index >= pairFor.length) {
      return -1;
    }
    const partner = pairFor[index];
    return Number.isInteger(partner) && partner >= 0 ? partner : -1;
  }

  function exportState() {
    return {
      v: 2,
      active,
      pairFor: active ? pairFor.slice() : [],
    };
  }

  function restore(saved, game) {
    const cells = game && Array.isArray(game.cells) ? game.cells : [];
    const tiles = game && Array.isArray(game.tiles) ? game.tiles : [];
    if (!saved || ![1, 2].includes(saved.v) || typeof saved.active !== "boolean") {
      return { status: "blocked" };
    }
    if (!saved.active) {
      if (!Array.isArray(saved.pairFor) || saved.pairFor.length !== 0) {
        return { status: "blocked" };
      }
      return reset();
    }
    if (!cells.length || tiles.length !== cells.length || !Array.isArray(saved.pairFor)) {
      return { status: "blocked" };
    }
    if (saved.pairFor.length !== cells.length) return { status: "blocked" };

    const candidate = saved.pairFor.slice();
    for (let index = 0; index < candidate.length; index++) {
      const partner = candidate[index];
      if (!Number.isInteger(partner) || partner < -1 || partner >= candidate.length) {
        return { status: "blocked" };
      }
      if (partner === -1) continue;
      if (partner === index || candidate[partner] !== index) return { status: "blocked" };
      if (saved.v === 1 && (cells[index].isMine || cells[partner].isMine)) {
        return { status: "blocked" };
      }
    }

    // V1 deliberately omitted mines from the map. Rebuild from the restored
    // board so a resumed run receives the current all-covered-face rules.
    if (saved.v === 1) return activate(game);

    pairFor = candidate;
    active = true;
    const unpairedCount = candidate.reduce((count, partner, index) => (
      count + (partner === -1 && isCellEligible(cells[index]) ? 1 : 0)
    ), 0);
    return summary(unpairedCount);
  }

  return {
    activate,
    partnerFor,
    exportState,
    restore,
    reset,
  };
});
