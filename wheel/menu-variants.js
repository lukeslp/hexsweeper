/*
 * Water Wheel menu presentation profiles.
 *
 * This module is deliberately pure: the game, run, actions and persistence
 * never vary with the menu treatment. It only resolves a presentation and
 * ranks complete seven-face patches for the projected takeover renderer.
 */
(function (global) {
  "use strict";

  const ARRANGEMENT = "sphere-center-v1";
  const RING_ACTIONS = Object.freeze([
    "lightdark",
    "warnings",
    "undo",
    "flagmode",
    "invert",
    "size",
  ]);
  const CENTER_ACTION = "reset";

  const PROFILES = Object.freeze({
    base: Object.freeze({
      id: "base",
      renderer: "flower",
      anchor: "center",
      arrangement: ARRANGEMENT,
      zoomScale: 1,
      openMs: 220,
      closeMs: 180,
    }),
    takeover: Object.freeze({
      id: "takeover",
      renderer: "faces",
      anchor: "center",
      arrangement: ARRANGEMENT,
      zoomScale: 1.22,
      openMs: 300,
      closeMs: 300,
    }),
    underwater: Object.freeze({
      id: "underwater",
      renderer: "faces",
      anchor: "underwater",
      arrangement: ARRANGEMENT,
      zoomScale: 1.34,
      openMs: 300,
      closeMs: 300,
    }),
  });

  const ALIASES = Object.freeze({
    base: "base",
    default: "base",
    bloom: "base",
    takeover: "takeover",
    faces: "takeover",
    "faces-zoom": "takeover",
    underwater: "underwater",
    water: "underwater",
    "faces-water": "underwater",
  });

  function normalize(value) {
    const key = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[;,]+$/, "");
    return ALIASES[key] || "base";
  }

  function resolve(search, override) {
    if (override) return PROFILES[normalize(override)];
    let menu = "";
    let dock = "";
    try {
      const params = new URLSearchParams(search || "");
      menu = params.get("menu") || "";
      dock = params.get("dock") || "";
    } catch (_) {}
    return PROFILES[normalize(menu || dock)];
  }

  function facesFor(candidate) {
    if (!candidate) return [];
    return [candidate.center].concat(candidate.ring || []).filter(Boolean);
  }

  function faceSides(face) {
    if (!face) return 0;
    if (Number.isFinite(face.sides)) return face.sides;
    return Array.isArray(face.boundary) ? face.boundary.length : 0;
  }

  function isHexPatch(candidate) {
    const faces = facesFor(candidate);
    return faces.length === 7 && faces.every((face) => faceSides(face) === 6);
  }

  function patchDistance(candidate, target) {
    const center = candidate && candidate.center && candidate.center.center;
    if (!center) return Infinity;
    return Math.hypot(center.x - target.x, center.y - target.y);
  }

  /**
   * Pick a complete face patch near a screen target. When `belowY` is set,
   * first prefer patches whose seven centers all clear the surface, then a
   * submerged center, then the nearest complete patch. This is deterministic
   * and side-effect free so renderer and tests share the same fallback rules.
   */
  function choosePatch(candidates, target) {
    const list = Array.isArray(candidates)
      ? candidates.filter(isHexPatch)
      : [];
    if (!list.length) return null;
    const point = {
      x: Number.isFinite(target && target.x) ? target.x : 0,
      y: Number.isFinite(target && target.y) ? target.y : 0,
    };
    const belowY = Number.isFinite(target && target.belowY)
      ? target.belowY
      : null;

    let pool = list;
    if (belowY != null) {
      const fullyBelow = list.filter((candidate) =>
        facesFor(candidate).every(
          (face) => face.center && face.center.y >= belowY
        )
      );
      if (fullyBelow.length) pool = fullyBelow;
      else {
        const centerBelow = list.filter(
          (candidate) =>
            candidate.center &&
            candidate.center.center &&
            candidate.center.center.y >= belowY
        );
        if (centerBelow.length) pool = centerBelow;
      }
    }

    return pool
      .slice()
      .sort(
        (a, b) =>
          patchDistance(a, point) - patchDistance(b, point) ||
          (b.center.z || 0) - (a.center.z || 0) ||
          (a.center.index || 0) - (b.center.index || 0)
      )[0];
  }

  const api = Object.freeze({
    PROFILES,
    ARRANGEMENT,
    RING_ACTIONS,
    CENTER_ACTION,
    isHexPatch,
    normalize,
    resolve,
    choosePatch,
  });
  global.WheelMenuVariants = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
