/**
 * File Purpose: Deterministic twin links for Flux Sphere.
 * Primary Functions: activate, partnerFor, exportState, restore, reset.
 * Inputs: Sphere cells, tile center points, and tile edge neighbors.
 * Output: symmetric twin links in which both faces share a fate (safe with
 * safe, mine with mine), each pair about TWIN_ANGLE_DEG apart on the globe
 * and never two faces that share an edge.
 *
 * Why twins share a fate: the version-2 rules linked any two covered faces,
 * so a safe dig could echo onto a mine on the far side of the globe and end
 * the run with no way to see it coming (about one echo in six). With matched
 * twins an echo can never land on a mine, and the link becomes something to
 * reason with: prove either twin and you have proven both.
 *
 * Why ~55 degrees: the old most-distant pairing put every twin behind the
 * globe, so echoes were never seen. At 55 degrees a twin is several faces
 * away on every board size yet usually on the same visible hemisphere. On an
 * XS board (162 faces) the last faces to pair used to settle for whatever was
 * left, about one link in 3,000 joined two touching faces; the squared cost,
 * the touch penalty and the swap pass rule that out (2026-10-03).
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
  const REPAIR_COST = REPAIR_TOLERANCE * REPAIR_TOLERANCE;
  const REPAIR_ROUNDS = 12;
  /**
   * Added to the cost of two faces that share an edge. It is larger than any
   * angle cost (the worst, a twin on the far pole, is under 5), so a touching
   * pair is only ever a last resort, and the final pass unlinks it instead.
   */
  const TOUCH_PENALTY = 100;

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

  /** Edge neighbors per face, when the board supplies them. */
  function neighborSets(tiles) {
    return tiles.map((tile) => (
      tile && Array.isArray(tile.neighborIndices) ? new Set(tile.neighborIndices) : null
    ));
  }

  function touching(geometry, a, b) {
    const around = geometry.neighbors[a];
    return !!around && around.has(b);
  }

  /**
   * Squared distance from the ideal twin angle, plus a heavy penalty when the
   * two faces touch; lower is better. Squaring spreads the error: two pairs a
   * little off beat one pair far off, which is what left the last few faces
   * of a small board with a twin right next door.
   */
  function missCost(geometry, a, b) {
    const miss = angleBetween(geometry.units[a], geometry.units[b]) - TWIN_ANGLE;
    return miss * miss;
  }

  function linkCost(geometry, a, b) {
    return missCost(geometry, a, b) + (touching(geometry, a, b) ? TOUCH_PENALTY : 0);
  }

  /**
   * Greedy pass in index order: each face takes the remaining face of its own
   * class with the lowest cost (closest to the target angle, never a neighbor
   * while another face is left), ties to the lower index.
   */
  function linkClass(indices, geometry, mapping) {
    const remaining = indices.slice();
    const links = [];
    while (remaining.length > 1) {
      const index = remaining.shift();
      let bestPosition = 0;
      let bestIndex = remaining[0];
      let bestCost = linkCost(geometry, index, bestIndex);
      for (let position = 1; position < remaining.length; position++) {
        const candidate = remaining[position];
        let cost = missCost(geometry, index, candidate);
        // The touch penalty only adds, so skip the lookup for a face that
        // already loses on angle alone.
        if (cost > bestCost + 1e-12) continue;
        if (touching(geometry, index, candidate)) cost += TOUCH_PENALTY;
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
    repairLinks(links, geometry);
    let unpaired = remaining.length;
    for (const [a, b] of links) {
      // Twins never touch. If no swap could separate a pair, leave both faces
      // without a twin rather than echo onto the face next door.
      if (touching(geometry, a, b)) {
        unpaired += 2;
        continue;
      }
      mapping[a] = b;
      mapping[b] = a;
    }
    return unpaired;
  }

  /**
   * The greedy pass leaves its last few faces with poor choices (twins that
   * touch, or sit behind the globe). Swap partners between two links of the
   * same class whenever that lowers their combined cost. Swaps stay inside one
   * class, so a twin never changes fate.
   */
  function repairLinks(links, geometry) {
    const costs = links.map(([a, b]) => linkCost(geometry, a, b));
    for (let round = 0; round < REPAIR_ROUNDS; round++) {
      let improved = false;
      for (let i = 0; i < links.length; i++) {
        if (costs[i] <= REPAIR_COST) continue;
        const [a, b] = links[i];
        let best = null;
        for (let j = 0; j < links.length; j++) {
          if (j === i) continue;
          const [c, d] = links[j];
          const current = costs[i] + costs[j];
          const ac = linkCost(geometry, a, c);
          const bd = linkCost(geometry, b, d);
          const ad = linkCost(geometry, a, d);
          const bc = linkCost(geometry, b, c);
          const option = ac + bd <= ad + bc
            ? { gain: current - ac - bd, first: [a, c], second: [b, d], costs: [ac, bd] }
            : { gain: current - ad - bc, first: [a, d], second: [b, c], costs: [ad, bc] };
          if (option.gain > 1e-9 && (!best || option.gain > best.gain + 1e-12)) {
            best = Object.assign({ j }, option);
          }
        }
        if (best) {
          links[i] = best.first;
          links[best.j] = best.second;
          costs[i] = best.costs[0];
          costs[best.j] = best.costs[1];
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
    const geometry = { units, neighbors: neighborSets(tiles) };
    const eligible = cells
      .map((cell, index) => (isCellEligible(cell) && units[index] ? index : -1))
      .filter((index) => index >= 0);
    const mapping = cells.map(() => -1);
    const safeFaces = eligible.filter((index) => !cells[index].isMine);
    const mineFaces = eligible.filter((index) => cells[index].isMine);
    const unpaired = linkClass(safeFaces, geometry, mapping) + linkClass(mineFaces, geometry, mapping);

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
