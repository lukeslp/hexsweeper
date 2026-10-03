/**
 * File Purpose: Deterministic twin links for Flux Sphere.
 * Primary Functions: activate, partnerFor, exportState, restore, reset.
 * Inputs: Sphere cells and tile center points.
 * Output: symmetric twin links in which both faces share a fate (safe with
 * safe, mine with mine), each pair about TWIN_ANGLE_DEG apart on the globe.
 *
 * Why twins share a fate: the version-2 rules linked any two covered faces,
 * so a safe dig could echo onto a mine on the far side of the globe and end
 * the run with no way to see it coming (about one echo in six). With matched
 * twins an echo can never land on a mine, and the link becomes something to
 * reason with: prove either twin and you have proven both.
 *
 * Why ~55 degrees: the old most-distant pairing put every twin behind the
 * globe, so echoes were never seen. At 55 degrees a twin is several faces
 * away on every board size yet usually on the same visible hemisphere.
 *
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

  const VERSION = 3;
  const TWIN_ANGLE_DEG = 55;
  const TWIN_ANGLE = (TWIN_ANGLE_DEG * Math.PI) / 180;
  /** Pairs further than this from the target angle get a repair pass. */
  const REPAIR_TOLERANCE = (8 * Math.PI) / 180;
  const REPAIR_ROUNDS = 6;

  let active = false;
  let pairFor = [];

  function isCellEligible(cell) {
    return !!cell && !cell.revealed && !cell.flagged;
  }

  function unit(point) {
    const length = Math.hypot(point.x, point.y, point.z) || 1;
    return { x: point.x / length, y: point.y / length, z: point.z / length };
  }

  function angleBetween(a, b) {
    const dot = a.x * b.x + a.y * b.y + a.z * b.z;
    return Math.acos(Math.max(-1, Math.min(1, dot)));
  }

  /** Distance from the ideal twin angle; lower is better. */
  function linkCost(units, a, b) {
    return Math.abs(angleBetween(units[a], units[b]) - TWIN_ANGLE);
  }

  /**
   * Greedy pass in index order: each face takes the remaining face of its own
   * class whose angle is closest to the target, ties to the lower index.
   */
  function linkClass(indices, units, mapping) {
    const remaining = indices.slice();
    const links = [];
    while (remaining.length > 1) {
      const index = remaining.shift();
      let bestPosition = 0;
      let bestIndex = remaining[0];
      let bestCost = linkCost(units, index, bestIndex);
      for (let position = 1; position < remaining.length; position++) {
        const candidate = remaining[position];
        const cost = linkCost(units, index, candidate);
        if (cost < bestCost - 1e-12 || (
          Math.abs(cost - bestCost) <= 1e-12 && candidate < bestIndex
        )) {
          bestPosition = position;
          bestIndex = candidate;
          bestCost = cost;
        }
      }
      remaining.splice(bestPosition, 1);
      links.push([index, bestIndex]);
    }
    repairLinks(links, units);
    for (const [a, b] of links) {
      mapping[a] = b;
      mapping[b] = a;
    }
    return remaining.length;
  }

  /**
   * The greedy pass leaves its last few faces with poor choices (twins that
   * touch, or sit behind the globe). Swap partners between two links of the
   * same class whenever that brings the pair closer to the target. Swaps stay
   * inside one class, so a twin never changes fate.
   */
  function repairLinks(links, units) {
    for (let round = 0; round < REPAIR_ROUNDS; round++) {
      let improved = false;
      for (let i = 0; i < links.length; i++) {
        const [a, b] = links[i];
        const own = linkCost(units, a, b);
        if (own <= REPAIR_TOLERANCE) continue;
        let best = null;
        for (let j = 0; j < links.length; j++) {
          if (j === i) continue;
          const [c, d] = links[j];
          const current = own + linkCost(units, c, d);
          const crossed = linkCost(units, a, c) + linkCost(units, b, d);
          const swapped = linkCost(units, a, d) + linkCost(units, b, c);
          const option = crossed <= swapped
            ? { gain: current - crossed, first: [a, c], second: [b, d] }
            : { gain: current - swapped, first: [a, d], second: [b, c] };
          if (option.gain > 1e-9 && (!best || option.gain > best.gain + 1e-12)) {
            best = Object.assign({ j }, option);
          }
        }
        if (best) {
          links[i] = best.first;
          links[best.j] = best.second;
          improved = true;
        }
      }
      if (!improved) break;
    }
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

    const units = tiles.map((tile) => (tile && tile.centerPoint ? unit(tile.centerPoint) : null));
    const eligible = cells
      .map((cell, index) => (isCellEligible(cell) && units[index] ? index : -1))
      .filter((index) => index >= 0);
    const mapping = cells.map(() => -1);
    const safeFaces = eligible.filter((index) => !cells[index].isMine);
    const mineFaces = eligible.filter((index) => cells[index].isMine);
    const unpaired = linkClass(safeFaces, units, mapping) + linkClass(mineFaces, units, mapping);

    pairFor = mapping;
    active = true;
    return summary(unpaired);
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
      v: VERSION,
      active,
      pairFor: active ? pairFor.slice() : [],
    };
  }

  function restore(saved, game) {
    const cells = game && Array.isArray(game.cells) ? game.cells : [];
    const tiles = game && Array.isArray(game.tiles) ? game.tiles : [];
    if (!saved || ![1, 2, VERSION].includes(saved.v) || typeof saved.active !== "boolean") {
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
    let mixedFate = false;
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
      if (!!cells[index].isMine !== !!cells[partner].isMine) mixedFate = true;
    }

    // Older payloads used other linking rules (v1: safe faces only; v2: any
    // two covered faces, so an echo could land on a mine). Rebuild them from
    // the restored board so a resumed run plays by the current rules. A v3
    // payload whose twins disagree is treated the same way: never restore a
    // link that could echo onto a mine.
    if (saved.v !== VERSION || mixedFate) return activate(game);

    pairFor = candidate;
    active = true;
    const unpairedCount = candidate.reduce((count, partner, index) => (
      count + (partner === -1 && isCellEligible(cells[index]) ? 1 : 0)
    ), 0);
    return summary(unpairedCount);
  }

  return {
    VERSION,
    TWIN_ANGLE_DEG,
    activate,
    partnerFor,
    exportState,
    restore,
    reset,
  };
});
