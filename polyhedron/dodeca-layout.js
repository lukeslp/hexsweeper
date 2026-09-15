/**
 * File Purpose: Build a dodecahedron whose twelve pentagonal panels are each
 * covered by a bounded hex-lattice Voronoi field.
 * Primary Functions/Classes: generatePanelSolid, buildAxialSeeds.
 * Inputs: Hexasphere's exact subdivision-0 dual. Outputs: macro panels +
 * arbitrary convex micro-tiles lying exactly in each pentagonal face plane.
 * Author: Luke Steuber <luke@lukesteuber.com>
 */
(function (global) {
  "use strict";

  const EPS = 1e-9;

  function vec3(x, y, z) {
    return { x, y, z };
  }

  function add(a, b) {
    return vec3(a.x + b.x, a.y + b.y, a.z + b.z);
  }

  function sub(a, b) {
    return vec3(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  function mul(a, scalar) {
    return vec3(a.x * scalar, a.y * scalar, a.z * scalar);
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  function cross(a, b) {
    return vec3(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }

  function normalize(a) {
    const length = Math.hypot(a.x, a.y, a.z) || 1;
    return mul(a, 1 / length);
  }

  function average3(points) {
    let total = vec3(0, 0, 0);
    for (const point of points) total = add(total, point);
    return mul(total, 1 / Math.max(1, points.length));
  }

  function area2(poly) {
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      area += a.x * b.y - b.x * a.y;
    }
    return area / 2;
  }

  function centroid2(poly) {
    const signedArea = area2(poly);
    if (Math.abs(signedArea) < EPS) {
      const sum = poly.reduce(
        (out, point) => ({ x: out.x + point.x, y: out.y + point.y }),
        { x: 0, y: 0 }
      );
      return { x: sum.x / poly.length, y: sum.y / poly.length };
    }
    let x = 0;
    let y = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const factor = a.x * b.y - b.x * a.y;
      x += (a.x + b.x) * factor;
      y += (a.y + b.y) * factor;
    }
    const divisor = 6 * signedArea;
    return { x: x / divisor, y: y / divisor };
  }

  function rotate2(point, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: point.x * c - point.y * s, y: point.x * s + point.y * c };
  }

  function cleanPolygon(poly) {
    const deduped = [];
    for (const point of poly) {
      const previous = deduped[deduped.length - 1];
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 1e-7) {
        deduped.push(point);
      }
    }
    if (
      deduped.length > 1 &&
      Math.hypot(
        deduped[0].x - deduped[deduped.length - 1].x,
        deduped[0].y - deduped[deduped.length - 1].y
      ) < 1e-7
    ) {
      deduped.pop();
    }

    let changed = true;
    while (changed && deduped.length > 3) {
      changed = false;
      for (let i = 0; i < deduped.length; i++) {
        const previous = deduped[(i - 1 + deduped.length) % deduped.length];
        const point = deduped[i];
        const next = deduped[(i + 1) % deduped.length];
        const ax = point.x - previous.x;
        const ay = point.y - previous.y;
        const bx = next.x - point.x;
        const by = next.y - point.y;
        const turn = Math.abs(ax * by - ay * bx);
        const scale = Math.hypot(ax, ay) * Math.hypot(bx, by);
        if (scale > EPS && turn / scale < 1e-6) {
          deduped.splice(i, 1);
          changed = true;
          break;
        }
      }
    }
    return deduped;
  }

  /** Clip a convex polygon to dot(point, normal) <= limit. */
  function clipHalfPlane(poly, normal, limit) {
    if (!poly.length) return [];
    const output = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const fa = a.x * normal.x + a.y * normal.y - limit;
      const fb = b.x * normal.x + b.y * normal.y - limit;
      const aInside = fa <= EPS;
      const bInside = fb <= EPS;
      if (aInside) output.push(a);
      if (aInside !== bInside) {
        const t = fa / (fa - fb);
        output.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
        });
      }
    }
    return cleanPolygon(output);
  }

  function buildAxialSeeds(radius) {
    const seeds = [];
    for (let q = -radius; q <= radius; q++) {
      const rMin = Math.max(-radius, -q - radius);
      const rMax = Math.min(radius, -q + radius);
      for (let r = rMin; r <= rMax; r++) {
        seeds.push({
          q,
          r,
          x: Math.sqrt(3) * (q + r / 2),
          y: 1.5 * r,
        });
      }
    }
    return seeds;
  }

  function maxSeedScale(poly, seeds, angle) {
    let maximum = Infinity;
    for (let edgeIndex = 0; edgeIndex < poly.length; edgeIndex++) {
      const a = poly[edgeIndex];
      const b = poly[(edgeIndex + 1) % poly.length];
      const edge = { x: b.x - a.x, y: b.y - a.y };
      const centerMargin = edge.x * -a.y - edge.y * -a.x;
      for (const seed of seeds) {
        const point = rotate2(seed, angle);
        const coefficient = edge.x * point.y - edge.y * point.x;
        if (coefficient < -EPS) {
          maximum = Math.min(maximum, centerMargin / -coefficient);
        }
      }
    }
    return maximum;
  }

  function placeSeeds(poly, radius) {
    const raw = buildAxialSeeds(radius);
    let best = { angle: 0, scale: 0 };
    for (let step = 0; step < 120; step++) {
      const angle = (step / 120) * (Math.PI / 3);
      const scale = maxSeedScale(poly, raw, angle);
      if (scale > best.scale) best = { angle, scale };
    }
    // Pull the lattice centers a little inside the edge. The Voronoi cells
    // still cover the full panel; this keeps boundary targets from becoming
    // narrow wedges while preserving a visibly hexagonal interior.
    const scale = best.scale * 0.91;
    return raw.map((seed, index) => {
      const rotated = rotate2(seed, best.angle);
      return {
        index,
        q: seed.q,
        r: seed.r,
        x: rotated.x * scale,
        y: rotated.y * scale,
      };
    });
  }

  function edgeKey(a, b) {
    function pointKey(point) {
      return `${Math.round(point.x * 1e6)},${Math.round(point.y * 1e6)}`;
    }
    return [pointKey(a), pointKey(b)].sort().join("|");
  }

  function buildPanelCells(panel, seeds, startIndex) {
    const cells = [];
    const edgeOwners = new Map();
    for (const seed of seeds) {
      let polygon = panel.localBoundary.map((point) => ({ x: point.x, y: point.y }));
      for (const other of seeds) {
        if (other.index === seed.index) continue;
        const normal = { x: other.x - seed.x, y: other.y - seed.y };
        const limit =
          (other.x * other.x + other.y * other.y - seed.x * seed.x - seed.y * seed.y) /
          2;
        polygon = clipHalfPlane(polygon, normal, limit);
        if (!polygon.length) break;
      }
      polygon = cleanPolygon(polygon);
      const center2 = centroid2(polygon);
      const toWorld = (point) =>
        add(panel.centerPoint, add(mul(panel.u, point.x), mul(panel.v, point.y)));
      const tile = {
        index: startIndex + cells.length,
        panelIndex: panel.index,
        panelCellIndex: cells.length,
        q: seed.q,
        r: seed.r,
        centerPoint: toWorld(center2),
        boundary: polygon.map(toWorld),
        localBoundary: polygon,
        localCenter: center2,
        faceNormal: panel.normal,
        neighborIndices: [],
        localNeighborIndices: [],
        isPentagon: polygon.length === 5,
      };
      cells.push(tile);
      for (let i = 0; i < polygon.length; i++) {
        const key = edgeKey(polygon[i], polygon[(i + 1) % polygon.length]);
        if (!edgeOwners.has(key)) edgeOwners.set(key, []);
        edgeOwners.get(key).push(tile.panelCellIndex);
      }
    }

    for (const owners of edgeOwners.values()) {
      if (owners.length !== 2) continue;
      const [a, b] = owners;
      cells[a].localNeighborIndices.push(b);
      cells[b].localNeighborIndices.push(a);
      cells[a].neighborIndices.push(cells[b].index);
      cells[b].neighborIndices.push(cells[a].index);
    }
    return cells;
  }

  function generatePanelSolid(cellRadius) {
    const radius = Math.max(1, Math.min(4, cellRadius | 0));
    if (!global.Hexasphere || typeof global.Hexasphere.generateHexasphere !== "function") {
      throw new Error("DodecaLayout: Hexasphere is required");
    }
    const macro = global.Hexasphere.generateHexasphere(1, 0).tiles;
    const seedsByPanel = [];
    const panels = [];
    const tiles = [];

    for (const face of macro) {
      const centerPoint = average3(face.boundary);
      const normal = normalize(centerPoint);
      const u = normalize(sub(face.boundary[0], centerPoint));
      const v = normalize(cross(normal, u));
      let localBoundary = face.boundary.map((point) => {
        const relative = sub(point, centerPoint);
        return { x: dot(relative, u), y: dot(relative, v) };
      });
      if (area2(localBoundary) < 0) localBoundary = localBoundary.reverse();

      const panel = {
        index: face.index,
        centerPoint,
        normal,
        u,
        v,
        boundary: face.boundary,
        localBoundary,
        neighborIndices: face.neighborIndices.slice(),
        tileIndices: [],
      };
      const seeds = placeSeeds(localBoundary, radius);
      const cells = buildPanelCells(panel, seeds, tiles.length);
      panel.tileIndices = cells.map((cell) => cell.index);
      panel.cells = cells;
      seedsByPanel.push(seeds);
      panels.push(panel);
      tiles.push(...cells);
    }

    return {
      panels,
      tiles,
      cellRadius: radius,
      cellsPerPanel: tiles.length / panels.length,
      seedsByPanel,
    };
  }

  const api = {
    generatePanelSolid,
    buildAxialSeeds,
    clipHalfPlane,
    area2,
    centroid2,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.DodecaLayout = api;
})(typeof globalThis !== "undefined" ? globalThis : self);
