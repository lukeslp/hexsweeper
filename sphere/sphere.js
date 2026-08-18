/**
 * File Purpose: Hexsweeper on a closed hex sphere — dig/flag/flood via neighborIndices.
 * Primary Functions/Classes: SphereSweeper.boot, project, pick, render loop.
 * Inputs: canvas, difficulty, theme id (localStorage). Outputs: playable sphere minesweeper.
 * Chrome: Reset·Size·Theme | Flag | Help; sizes XS–XL; themes Light·Shell·Dark·Ink·Float·Card·Earth·Moon.
 * Globe maps: Earth/Moon equirectangular daymaps sampled per face (lat/lon).
 * Mono: four shell·field pairings + two light-field float themes (contact shadow under sphere).
 * Zoom: wheel + pinch (clamped); starts pulled back (~0.72×).
 * Heights (highest→lowest): flagged → covered → numbered clear → empty clear.
 * Tiers apply in numerals·rings·borderless only; flush/yellow stay flat.
 * Hover: temporary lift over the tile's own tier (cleared stay put).
 * Counts: cycle numerals · rings · yellow · flush · borderless (btn / N).
 * Borderless: stroke-off + recess on cleared only; covered keep borders.
 * Endgame: 2D-style detonation finale (charge · shock · scatter · shards); win bloom (RM-safe).
 * Notes: Canvas 2D projection; drag tumbles freely; camera angles stay continuous (no ±π wrap yoink).
 * Idle: ambient yaw until first canvas interaction (off under reduced motion).
 * Win: share card (sphere snapshot + time + mine count) via Web Share / download.
 * Flood: logic immediate, paint staggered by BFS ring (mirrors flat core.js wave).
 * Persist: autosave mid-run (localStorage + sessionStorage `hexsweeper-sphere-run-v2`).
 * Soft/hard browser reload restores; only UX Reset (or size change) clears the run.
 * No window.confirm dialogs — Reset/size are deliberate. Welcome help only once, not over a restored run.
 * Flags: pure red fill only (no glyph); stand proud of the shell as pins.
 * Author: Luke Steuber <luke@lukesteuber.com>
 */
(function (global) {
  "use strict";

  /**
   * Board sizes (Goldberg dual faces = 10n²+2), mines ≈17%.
   * XS=162 · S=362 · M=1002 · L=1442 · XL=2252.
   */
  const CONFIG = {
    xsmall: { subdivisions: 4, minePct: 0.17 },
    easy: { subdivisions: 6, minePct: 0.17 },
    medium: { subdivisions: 10, minePct: 0.17 },
    hard: { subdivisions: 12, minePct: 0.17 },
    xlarge: { subdivisions: 15, minePct: 0.17 },
  };

  const REVEAL_STEP_MS = 28;
  const REVEAL_CAP_MS = 880;
  const REVEAL_LERP = 0.18;
  const REVEAL_FLASH_MS = 240;
  const IDLE_FRAME_MS = 200;
  /** Blast phases (ms) match flat Soft UI: charge 0–300 · shock from 260 · scatter 300+ */
  const BLAST_CHARGE_MS = 300;
  const BLAST_SCATTER_MS = 300;
  const BLAST_DURATION_MS = 2600;
  const BLAST_SHAKE0 = 18;
  const BLAST_KICK = 9.4;
  const MAX_SHARDS = 420;
  const END_PARTICLE_CAP = 180;
  /** Lose FX: mine cascade stagger (restored — used by startLoseFx / tickEndFx). */
  const END_MINE_STEP_MS = 42;
  const END_MINE_CAP_MS = 1200;
  const END_SHAKE_DECAY = 0.88;
  /** Idle yaw before first interact — ~2.6°/s, one turn ≈ 2.3 min. */
  const AMBIENT_SPIN_RAD_PER_MS = 0.000045;

  /**
   * Mono pairings (tile · field), flat fills only:
   *   Light  — white on white · black wells/core
   *   Shell  — white on black · black wells/core   (light-on-dark)
   *   Dark   — black on black · white wells/core
   *   Ink    — black on white · white wells/core   (dark-on-light)
   *   Float  — Light + contact shadow (sphere floats on the light field)
   *   Card   — Ink + contact shadow
   *
   * Height tiers (radial lift, highest → lowest) share slots with optional
   * tier* color fields — numbered uses the same well fill as empty for now.
   */
  function monoTheme(spec) {
    const whiteShell = spec.shell === "white";
    const whiteField = spec.field === "white";
    const whiteWell = !whiteShell; // dig into the opposite of the shell
    const float = !!spec.float;
    const well = whiteWell ? "#ffffff" : "#000000";
    return {
      id: spec.id,
      name: spec.name,
      chrome: whiteField ? "light" : "dark",
      float,
      accent: whiteField ? "#000000" : "#ffffff",
      pureCovered: true,
      pureRevealed: true,
      bg: whiteField ? "#ffffff" : "#000000",
      bgGlow: whiteField ? "#ffffff" : "#000000",
      covered: whiteShell ? "#ffffff" : "#000000",
      coveredHi: whiteShell ? "#ffffff" : "#000000",
      coveredEdge: whiteShell ? "#000000" : "#ffffff",
      coveredShadow: whiteShell ? "#cccccc" : "#000000",
      // Color-tier slots (height tiers always apply; fill override optional).
      tierCovered: whiteShell ? "#ffffff" : "#000000",
      tierFlagged: "#ff0000",
      tierNumbered: well,
      tierEmpty: well,
      revealed: well,
      revealedEmpty: well,
      revealedEdge: whiteWell ? "#999999" : "#6a6a6a",
      valleyGroove: whiteWell ? "#777777" : "#8a8a8a",
      valleyGrooveDeep: whiteWell ? "#cccccc" : "#3a3a3a",
      flagFill: "#ff0000",
      flagIcon: "#ffffff",
      flagEdge: "#ff0000",
      mine: whiteWell ? "#ffffff" : "#000000",
      mineCore: whiteWell ? "#000000" : "#ffffff",
      mineEdge: whiteWell ? "#cccccc" : "#000000",
      mineBurst: whiteWell ? "#000000" : "#ffffff",
      pentagon: whiteShell ? "#ffffff" : "#000000",
      pentagonEdge: whiteShell ? "#000000" : "#ffffff",
      hoverRing: whiteShell ? "#000000" : "#ffffff",
      activeRing: whiteShell ? "#222222" : "#dddddd",
      backface: whiteWell ? "#ffffff" : "#000000",
      backfaceEdge: whiteWell ? "#cccccc" : "#333333",
      core: whiteWell ? "#ffffff" : "#000000",
      floatShadow: float
        ? whiteField
          ? "rgba(0,0,0,0.18)"
          : "rgba(255,255,255,0.12)"
        : null,
      text: whiteWell
        ? {
            1: "#000000",
            2: "#222222",
            3: "#444444",
            4: "#666666",
            5: "#888888",
            6: "#aaaaaa",
          }
        : {
            1: "#ffffff",
            2: "#eeeeee",
            3: "#dddddd",
            4: "#cccccc",
            5: "#bbbbbb",
            6: "#aaaaaa",
          },
      label: whiteWell ? "#000000" : "#ffffff",
      labelStroke: whiteWell ? "#ffffff" : "#000000",
      revealFlash: whiteWell ? "#000000" : "#ffffff",
      revealGlow: whiteWell ? "#666666" : "#888888",
    };
  }

  const THEME_LIGHT = monoTheme({
    id: "light",
    name: "Light",
    shell: "white",
    field: "white",
  });
  const THEME_SHELL = monoTheme({
    id: "shell",
    name: "Shell",
    shell: "white",
    field: "black",
  });
  const THEME_DARK = monoTheme({
    id: "dark",
    name: "Dark",
    shell: "black",
    field: "black",
  });
  const THEME_INK = monoTheme({
    id: "ink",
    name: "Ink",
    shell: "black",
    field: "white",
  });
  const THEME_FLOAT = monoTheme({
    id: "float",
    name: "Float",
    shell: "white",
    field: "white",
    float: true,
  });
  const THEME_CARD = monoTheme({
    id: "card",
    name: "Card",
    shell: "black",
    field: "white",
    float: true,
  });

  /**
   * Globe map themes — equirectangular daymaps sampled per hex face (lat/lon).
   * Textures: Solar System Scope style daymaps (same set as orrery.solar).
   */
  const GLOBE_TEX_BASE =
    "https://dr.eamer.dev/games/hexsweeper/sphere/assets/textures/";
  const GLOBE_MAPS = {
    earth: {
      id: "earth",
      file: "earth_gloss_4k.webp",
      mobileFile: "earth_gloss_2k.webp",
      // Fallback while loading / if sample fails
      fallback: "#2a6a9a",
    },
    moon: {
      id: "moon",
      file: "moon_2k.jpg",
      fallback: "#9a9a9a",
    },
  };

  function globeTheme(spec) {
    // Dark sky field; covered faces carry the planet texture.
    return {
      id: spec.id,
      name: spec.name,
      chrome: "dark",
      float: true,
      globeMap: spec.mapId,
      globeGloss: !!spec.gloss,
      pureCovered: false,
      pureRevealed: true,
      accent: spec.accent || "#e8eef8",
      bg: "#05070c",
      bgGlow: "#0a101c",
      covered: GLOBE_MAPS[spec.mapId]?.fallback || "#666666",
      coveredHi: "#ffffff",
      coveredEdge: spec.coveredEdge || "rgba(0,0,0,0.45)",
      globeEdgeWidth: spec.edgeWidth || 1.15,
      coveredShadow: "#000000",
      tierCovered: GLOBE_MAPS[spec.mapId]?.fallback || "#666666",
      tierFlagged: "#ff2200",
      tierNumbered: "#0a0e18",
      tierEmpty: "#05080f",
      revealed: "#0a0e18",
      revealedEmpty: "#05080f",
      revealedEdge: "rgba(255,255,255,0.12)",
      valleyGroove: "rgba(255,255,255,0.1)",
      valleyGrooveDeep: "rgba(0,0,0,0.5)",
      flagFill: "#ff2200",
      flagIcon: "#ffffff",
      flagEdge: "#ff2200",
      mine: "#1a1010",
      mineCore: "#ff6644",
      mineEdge: "#000000",
      mineBurst: "#ffaa66",
      pentagon: GLOBE_MAPS[spec.mapId]?.fallback || "#666666",
      pentagonEdge: "rgba(0,0,0,0.5)",
      hoverRing: "#ffffff",
      activeRing: "#ffe8a0",
      backface: "#080a10",
      backfaceEdge: "#1a2030",
      core: "#020308",
      floatShadow: "rgba(0,0,0,0.35)",
      text: {
        1: "#d8e8ff",
        2: "#a8d4ff",
        3: "#7ec8a8",
        4: "#f0c070",
        5: "#f09060",
        6: "#f07080",
      },
      label: "#eef4ff",
      labelStroke: "rgba(0,0,0,0.75)",
      revealFlash: "#ffffff",
      revealGlow: spec.accent || "#88aaff",
    };
  }

  const THEME_EARTH = globeTheme({
    id: "earth",
    name: "Earth",
    mapId: "earth",
    accent: "#6ec8ff",
    gloss: true,
    coveredEdge: "rgba(171,220,245,0.20)",
    edgeWidth: 0.72,
  });
  const THEME_MOON = globeTheme({
    id: "moon",
    name: "Moon",
    mapId: "moon",
    accent: "#d0d4dc",
  });

  /**
   * Glow — dark shell; revealed faces keep a luminous center (radial, clipped to hex).
   * Empty clears glow hotter; numbered wells glow softer under the digit.
   */
  const THEME_GLOW = {
    id: "glow",
    name: "Glow",
    chrome: "dark",
    float: true,
    wellGlow: true,
    wellGlowHot: "#f4fbff",
    wellGlowColor: "#5ec8ff",
    wellGlowEmptyBoost: 1.15,
    pureCovered: false,
    pureRevealed: true,
    accent: "#5ec8ff",
    bg: "#03050a",
    bgGlow: "#071018",
    covered: "#141a24",
    coveredHi: "#1e2836",
    coveredEdge: "rgba(120,180,220,0.22)",
    coveredShadow: "#000000",
    tierCovered: "#141a24",
    tierFlagged: "#ff2a2a",
    tierNumbered: "#060a12",
    tierEmpty: "#02060c",
    revealed: "#060a12",
    revealedEmpty: "#02060c",
    revealedEdge: "rgba(100,170,220,0.2)",
    valleyGroove: "rgba(90,160,210,0.18)",
    valleyGrooveDeep: "rgba(0,0,0,0.55)",
    flagFill: "#ff2a2a",
    flagIcon: "#ffffff",
    flagEdge: "#ff2a2a",
    mine: "#1a0a0a",
    mineCore: "#ff6644",
    mineEdge: "#000000",
    mineBurst: "#ffaa66",
    pentagon: "#181f2a",
    pentagonEdge: "rgba(120,180,220,0.28)",
    hoverRing: "#8ad4ff",
    activeRing: "#c8ecff",
    backface: "#05080f",
    backfaceEdge: "#121820",
    core: "#02060c",
    coreGlow: "#3aa0e8",
    floatShadow: "rgba(0,0,0,0.4)",
    text: {
      1: "#b8e8ff",
      2: "#7ec8ff",
      3: "#5ad4a8",
      4: "#f0c060",
      5: "#f09060",
      6: "#f07090",
    },
    label: "#e8f6ff",
    labelStroke: "rgba(0,0,0,0.7)",
    revealFlash: "#ffffff",
    revealGlow: "#5ec8ff",
  };

  /**
   * Mercury — the reflection studio's Smoked Mercury material, shipped as a
   * first-class theme. `reflectionSurface` hands the sphere body to the WebGL
   * renderer in sphere/mirror-material.js (lazy-booted by the reflection
   * bridge in boot); this palette only paints the etched crust, wells, flags
   * and mines on top. Mercury is the one material with no texture asset — the
   * environment is analytic in the shader — so it seals into the offline app.
   * `fallback*` colors paint a plain metal field when WebGL is unavailable.
   */
  const THEME_MERCURY = {
    id: "mercury",
    name: "Mercury",
    chrome: "dark",
    reflectionSurface: true,
    material: "mercury",
    // Themes own the warning treatment (count paint · relief · seams) and
    // declare what a cleared face opens onto. Solid metals: depth, no seams.
    interior: "metal",
    warn: { count: "numerals", relief: "extruded", seams: false },
    accent: "#eaf8ff",
    pureCovered: false,
    pureRevealed: false,
    bg: "rgba(0,0,0,0)",
    bgGlow: "rgba(0,0,0,0)",
    fallbackBg: "#050708",
    fallbackBgGlow: "#3d484b",
    fallbackCore: "#101719",
    covered: "rgba(3,9,13,0.08)",
    coveredHi: "rgba(255,255,255,0.08)",
    coveredEdge: "rgba(222,242,250,0.20)",
    surfaceEdgeWidth: 0.78,
    surfacePentagonEdgeWidth: 1.05,
    surfaceBackfaceEdgeWidth: 0.45,
    coveredShadow: "rgba(0,0,0,0.4)",
    tierCovered: "rgba(3,9,13,0.08)",
    tierFlagged: "#e5222a",
    tierNumbered: "rgba(3,7,10,0.94)",
    tierEmpty: "rgba(0,3,6,0.97)",
    revealed: "rgba(3,7,10,0.94)",
    revealedEmpty: "rgba(0,3,6,0.97)",
    revealedEdge: "rgba(208,232,242,0.34)",
    revealedEmptyEdge: "rgba(150,181,194,0.18)",
    valleyGroove: "rgba(222,242,250,0.28)",
    valleyGrooveDeep: "rgba(0,0,0,0.86)",
    flagFill: "#e5222a",
    flagIcon: "#ffffff",
    flagEdge: "#ff5a5f",
    mine: "#05070a",
    mineCore: "#05070a",
    mineEdge: "#ff3b3f",
    mineBurst: "#ffffff",
    pentagon: "rgba(3,9,13,0.08)",
    pentagonEdge: "rgba(238,248,252,0.28)",
    hoverRing: "#ffffff",
    activeRing: "#9ee8ff",
    backface: "rgba(0,4,8,0.035)",
    backfaceEdge: "rgba(214,237,246,0.075)",
    core: "rgba(0,0,0,0)",
    floatShadow: null,
    text: {
      1: "#f4fbff",
      2: "#bcecff",
      3: "#8ed9f5",
      4: "#ffd7a0",
      5: "#ff9f8f",
      6: "#ff7180",
    },
    label: "#f4fbff",
    labelStroke: "rgba(0,3,7,0.96)",
    revealFlash: "#ffffff",
    revealGlow: "#9ee8ff",
  };

  /**
   * Two more materials from the reflection studio, chosen for different drift
   * mechanisms from Mercury's analytic environment + liquid-metal wells:
   *  - Stratosphere: a bright sky environment map drifting across the mirror
   *    (mapping "environment", ambient frame, kernel 10). Light chrome.
   *  - Ion Storm: a hybrid-mapped storm cloud on a lagging frame (mapping
   *    "hybrid", lag frame, kernel 8, pulse) — the reflection carries inertia
   *    and trails the rotation. Dark chrome.
   * Both are texture-backed: sphere/assets/reflections/*.webp on the web,
   * data URIs sealed into the app by the exporter.
   */
  function reflectionTheme(overrides) {
    return Object.assign({}, THEME_MERCURY, overrides);
  }
  const THEME_STRATOSPHERE = reflectionTheme({
    id: "stratosphere",
    name: "Stratosphere",
    chrome: "light",
    material: "stratosphere",
    // Cleared faces open into an empty shell whose inside is sky.
    interior: "hollow",
    warn: { count: "numerals", relief: "flush", seams: false },
    accent: "#1d6fa9",
    fallbackBg: "#e7f2fa",
    fallbackBgGlow: "#ffffff",
    fallbackCore: "#74b5df",
    hoverRing: "#1d6fa9",
    activeRing: "#0f4f80",
    flagEdge: "#ffd6d8",
    // Wells open onto bright sky glass, so numbers go dark on a light stroke.
    text: { 1: "#0b2540", 2: "#123c66", 3: "#1d5a8f", 4: "#7a2d10", 5: "#8f1d1d", 6: "#5a0f2c" },
    label: "#0b2540",
    labelStroke: "rgba(255,255,255,0.85)",
  });
  const THEME_ION_STORM = reflectionTheme({
    id: "ion-storm",
    name: "Ion Storm",
    chrome: "dark",
    material: "ion-storm",
    interior: "plasma",
    warn: { count: "numerals", relief: "extruded", seams: false },
    accent: "#c893dc",
    fallbackBg: "#060a19",
    fallbackBgGlow: "#175fa2",
    fallbackCore: "#06142d",
    coveredEdge: "rgba(200,147,220,0.22)",
    pentagonEdge: "rgba(214,178,240,0.3)",
    hoverRing: "#e2c4f5",
    activeRing: "#c893dc",
    revealGlow: "#c893dc",
    text: {
      1: "#f1e8ff",
      2: "#d9c0f5",
      3: "#c893dc",
      4: "#9fd0ff",
      5: "#ffb27a",
      6: "#ff7a9c",
    },
    label: "#f1e8ff",
  });
  // The rest of the flower roster: aurora is procedural (no texture); the
  // others carry small textures. Palettes lift the studio's fallback tones.
  const THEME_AURORA = reflectionTheme({
    id: "aurora",
    name: "Aurora",
    material: "aurora",
    interior: "hollow",
    warn: { count: "numerals", relief: "flush", seams: false },
    accent: "#88d2d0",
    fallbackBg: "#02070d",
    fallbackBgGlow: "#2e7f83",
    fallbackCore: "#141329",
    coveredEdge: "rgba(136,210,208,0.22)",
    pentagonEdge: "rgba(170,230,228,0.3)",
    hoverRing: "#b9f0ee",
    activeRing: "#88d2d0",
    revealGlow: "#88d2d0",
    text: { 1: "#e9fffe", 2: "#b9f0ee", 3: "#88d2d0", 4: "#ffd7a0", 5: "#ff9f8f", 6: "#ff7180" },
    label: "#e9fffe",
  });
  const THEME_GALAXY = reflectionTheme({
    id: "galaxy",
    name: "Galaxy",
    material: "galaxy",
    interior: "hollow",
    warn: { count: "numerals", relief: "flush", seams: false },
    accent: "#d09a9e",
    fallbackBg: "#050714",
    fallbackBgGlow: "#49405c",
    fallbackCore: "#08172b",
    coveredEdge: "rgba(208,154,158,0.22)",
    pentagonEdge: "rgba(230,190,194,0.3)",
    hoverRing: "#f0cdd0",
    activeRing: "#d09a9e",
    revealGlow: "#d09a9e",
    text: { 1: "#fff1f2", 2: "#f0cdd0", 3: "#d09a9e", 4: "#c9b8ff", 5: "#ffb27a", 6: "#ff7a9c" },
    label: "#fff1f2",
  });
  const THEME_GILDED_RIBBON = reflectionTheme({
    id: "gilded-ribbon",
    name: "Gilded Ribbon",
    material: "gilded-ribbon",
    interior: "gold",
    warn: { count: "numerals", relief: "extruded", seams: false },
    accent: "#dfa35f",
    fallbackBg: "#080510",
    fallbackBgGlow: "#4d3449",
    fallbackCore: "#020103",
    coveredEdge: "rgba(223,163,95,0.24)",
    pentagonEdge: "rgba(240,200,140,0.32)",
    hoverRing: "#f4cf9a",
    activeRing: "#dfa35f",
    revealGlow: "#dfa35f",
    text: { 1: "#fff4e4", 2: "#f4cf9a", 3: "#dfa35f", 4: "#e0b8ff", 5: "#ff9f8f", 6: "#ff7180" },
    label: "#fff4e4",
  });
  const THEME_HEAT_LIGHTNING = reflectionTheme({
    id: "heat-lightning",
    name: "Heat Lightning",
    material: "heat-lightning",
    interior: "magma",
    warn: { count: "numerals", relief: "extruded", seams: false },
    accent: "#ffb05b",
    fallbackBg: "#190f16",
    fallbackBgGlow: "#7a3f53",
    fallbackCore: "#0d1017",
    coveredEdge: "rgba(255,176,91,0.24)",
    pentagonEdge: "rgba(255,205,150,0.32)",
    hoverRing: "#ffd6a3",
    activeRing: "#ffb05b",
    revealGlow: "#ffb05b",
    text: { 1: "#fff2e2", 2: "#ffd6a3", 3: "#ffb05b", 4: "#ff9db1", 5: "#c9b8ff", 6: "#8ed9f5" },
    label: "#fff2e2",
  });

  // The two mono looks keep the classic read: numbers, depth, seams.
  THEME_LIGHT.warn = { count: "numerals", relief: "extruded", seams: true };
  THEME_DARK.warn = { count: "numerals", relief: "extruded", seams: true };

  const THEMES = [
    THEME_LIGHT,
    THEME_SHELL,
    THEME_DARK,
    THEME_INK,
    THEME_FLOAT,
    THEME_CARD,
    THEME_EARTH,
    THEME_MOON,
    THEME_GLOW,
    THEME_MERCURY,
    THEME_STRATOSPHERE,
    THEME_ION_STORM,
    THEME_AURORA,
    THEME_GALAXY,
    THEME_GILDED_RIBBON,
    THEME_HEAT_LIGHTNING,
  ].filter((t) => {
    // Native app builds ship without the globe-map themes. Their daymaps are
    // the only assets fetched over the network (globeUrl falls back to an
    // absolute dr.eamer.dev URL off the /sphere/ path), so they would fail in
    // an offline shell — and their provenance/attribution is unresolved.
    // Filtered by the globeMap property, not by id, so future globe themes
    // are covered automatically. Theme choice persists by id (see
    // readStoredThemeId), so a stored "earth" simply falls back to default.
    return !(window.HEXSWEEPER_SPHERE_APP && t.globeMap);
  });
  const DEFAULT_THEME = THEME_LIGHT;

  /**
   * Model-authored one-pager takes (Kimi / Claude / Muse).
   * Applied via ?take=<id> or window.HEXSWEEPER_SPHERE_TAKE.
   */
  function paletteTheme(p) {
    const field = p.field || "#ffffff";
    const shell = p.shell || "#ffffff";
    const well = p.well || "#000000";
    const numbered = p.numberedWell || well;
    const edge = p.edge || "#888888";
    const flag = p.flag || "#ff0000";
    const text = p.text || "#ffffff";
    const chrome = p.chrome === "light" ? "light" : "dark";
    const accent = p.accent || text;
    // Gradient number ink from base text toward accent by count.
    const textMap = {};
    for (let n = 1; n <= 6; n++) {
      textMap[n] = text;
    }
    return {
      id: p.id || "take",
      name: p.name || "Take",
      chrome,
      float: !!p.float,
      accent,
      pureCovered: false,
      pureRevealed: false,
      bg: field,
      bgGlow: field,
      covered: shell,
      coveredHi: shell,
      coveredEdge: edge,
      coveredShadow: edge,
      tierCovered: shell,
      tierFlagged: flag,
      tierNumbered: numbered,
      tierEmpty: well,
      revealed: numbered,
      revealedEmpty: well,
      revealedEdge: edge,
      valleyGroove: edge,
      valleyGrooveDeep: edge,
      flagFill: flag,
      flagIcon: text,
      flagEdge: flag,
      mine: shell,
      mineCore: text,
      mineEdge: edge,
      mineBurst: accent,
      pentagon: shell,
      pentagonEdge: edge,
      hoverRing: accent,
      activeRing: accent,
      backface: well,
      backfaceEdge: edge,
      core: well,
      floatShadow: p.float
        ? chrome === "light"
          ? "rgba(0,0,0,0.18)"
          : "rgba(255,255,255,0.12)"
        : null,
      text: textMap,
      label: text,
      labelStroke: field,
      revealFlash: p.revealFlash || accent,
      revealGlow: p.revealGlow || accent,
      // Take-specific render flags (read by tileColors / drawCounts)
      takeInkDepth: !!p.takeInkDepth,
      takeCountTint: !!p.takeCountTint,
      takeFlagHalo: !!p.takeFlagHalo,
      countTintRamp: p.countTintRamp || null,
    };
  }

  const SPHERE_TAKES = {
    "kimi-moon-ink-orrery": {
      id: "kimi-moon-ink-orrery",
      author: "kimi",
      title: "Hexsweeper 3D — Moon Ink Orrery",
      tagline:
        "Hex minesweeper on a Goldberg sphere, restyled as an ink-brushed lunar orrery.",
      helpLede:
        "Hexsweeper on a paper-moon sphere — six neighbors, first dig always safe. Read the brush rings; vermillion marks a mine.",
      hudNote: "The moon turns while you think.",
      countStyleDefault: "rings",
      defaultZoom: 0.85,
      ambientSpin: true,
      boardSizeDefault: "medium",
      theme: paletteTheme({
        id: "kimi-moon-ink",
        name: "Moon Ink",
        field: "#0c0f1d",
        shell: "#e8e4d8",
        well: "#1a2033",
        numberedWell: "#232c47",
        edge: "#3d4666",
        flag: "#c9372c",
        text: "#9fd8e8",
        chrome: "dark",
        accent: "#7dd3c0",
        float: true,
        revealFlash: "#9fd8e8",
        revealGlow: "#7dd3c0",
        takeInkDepth: true,
        takeFlagHalo: true,
      }),
    },
    "claude-amber-codex": {
      id: "claude-amber-codex",
      author: "claude",
      title: "Hexsweeper 3D — Amber Codex",
      tagline:
        "A hex-tile minesweeper on a Goldberg sphere, like a scholar's annotated globe.",
      helpLede:
        "Hexsweeper as a lacquered codex-globe — dig parchment faces, flag in sealing-wax red. First dig is always safe.",
      hudNote: "Every safe cell is a folio turned.",
      countStyleDefault: "numerals",
      defaultZoom: 0.88,
      ambientSpin: true,
      boardSizeDefault: "medium",
      theme: paletteTheme({
        id: "claude-amber",
        name: "Amber Codex",
        field: "#1c1f2b",
        shell: "#4a3f2f",
        well: "#e8dcc8",
        numberedWell: "#f5e6c8",
        edge: "#8c7a5e",
        flag: "#c0392b",
        text: "#2c1a0e",
        chrome: "dark",
        accent: "#d4a240",
        float: true,
        revealFlash: "#d4a240",
        revealGlow: "#f5e6c8",
      }),
    },
    "muse-constellation-void": {
      id: "muse-constellation-void",
      author: "muse",
      title: "Hexsweeper 3D — Starlit Void",
      tagline:
        "Hexsweeper's Goldberg sphere adrift in a soft void — a constellation to chart.",
      helpLede:
        "Six neighbors, one sphere, first dig always safe. Flag the coral stars; trust the rings of starlight.",
      hudNote: "The void holds its breath — chart lightly.",
      countStyleDefault: "rings",
      defaultZoom: 0.88,
      ambientSpin: true,
      boardSizeDefault: "medium",
      theme: paletteTheme({
        id: "muse-void",
        name: "Starlit Void",
        field: "#0b1020",
        shell: "#2e3a52",
        well: "#141c33",
        numberedWell: "#1b2547",
        edge: "#3d4e6e",
        flag: "#ff8a6b",
        text: "#d8e2ff",
        chrome: "dark",
        accent: "#8bb8ff",
        float: true,
        revealFlash: "#8bb8ff",
        revealGlow: "#ff8a6b",
        takeCountTint: true,
        takeFlagHalo: true,
        countTintRamp: [
          null,
          "#1b2547",
          "#1e2a52",
          "#24305e",
          "#2a3568",
          "#3a3060",
          "#4a2e4a",
        ],
      }),
    },
  };
  const SIZE_ORDER = ["xsmall", "easy", "medium", "hard", "xlarge"];
  const SIZE_LABEL = {
    xsmall: "XS",
    easy: "S",
    medium: "M",
    hard: "L",
    xlarge: "XL",
  };
  const SIZE_NAMES = {
    xsmall: "Extra small",
    easy: "Small",
    medium: "Medium",
    hard: "Large",
    xlarge: "Extra large",
  };
  const SIZE_FACES = {
    xsmall: 162,
    easy: 362,
    medium: 1002,
    hard: 1442,
    xlarge: 2252,
  };
  /**
   * Global effects preference — "auto" (follow OS Reduce Motion) | "full" | "reduced".
   * MIRROR of the same helper in core.js and tools/app-launcher.html; the sphere
   * does not load core.js. Change all three together.
   */
  const EFFECTS_KEY = "hexsweeper-effects-v1";

  function effectsReduced() {
    let pref = null;
    try {
      pref = localStorage.getItem(EFFECTS_KEY);
    } catch (_) {}
    if (pref === "reduced") return true;
    if (pref === "full") return false;
    return (
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function applyEffectsAttribute() {
    document.documentElement.setAttribute(
      "data-effects",
      effectsReduced() ? "reduced" : "full"
    );
  }

  const THEME_STORAGE_KEY = "hexsweeper-sphere-theme-v6";
  const SIZE_STORAGE_KEY = "hexsweeper-sphere-size-v2";
  const NEST_STORAGE_KEY = "hexsweeper-sphere-nest-v1";
  const COUNT_STYLE_STORAGE_KEY = "hexsweeper-sphere-countstyle-v1";
  const INVERT_STORAGE_KEY = "hexsweeper-sphere-invert-v1";
  const WELCOME_KEY = "hexsweeper-sphere-welcome-v1";
  const RUN_STORAGE_KEY = "hexsweeper-sphere-run-v2";
  const RUN_STORAGE_KEY_LEGACY = "hexsweeper-sphere-run-v1";
  /** History-tile accent — mark only, never well fill. */
  const YELLOW_COUNT = "#facc15";
  const COUNT_STYLES = [
    { id: "numerals", name: "Numerals" },
    { id: "rings", name: "Rings" },
    { id: "yellow", name: "Yellow" },
    { id: "flush", name: "Flush" },
    { id: "borderless", name: "Borderless" },
  ];
  const COUNT_STYLE_ICONS = {
    numerals:
      '<span class="count-mark" aria-hidden="true">1</span>',
    rings:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 3 20 8 20 16 12 21 4 16 4 8"></polygon><polygon points="12 7 17 10 17 14 12 17 7 14 7 10"></polygon><polygon points="12 11 14.5 12.5 14.5 14.5 12 16 9.5 14.5 9.5 12.5"></polygon></svg>',
    yellow:
      '<svg viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 3 20 8 20 16 12 21 4 16 4 8"></polygon><polygon points="12 7 17 10 17 14 12 17 7 14 7 10" stroke="#facc15"></polygon></svg>',
    flush:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 4 19 8.5 19 15.5 12 20 5 15.5 5 8.5"></polygon></svg>',
    borderless:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="12 4 19 8.5 19 15.5 12 20 5 15.5 5 8.5" opacity="0.55"></polygon></svg>',
  };
  const ZOOM_MIN = 0.55;
  const ZOOM_MAX = 2.25;
  /** Start pulled back — prior 1.0 filled the frame too aggressively. */
  const INITIAL_ZOOM = 0.72;
  /** Sphere fill of the short viewport edge at zoomFactor = 1. */
  const BASE_SCALE_FRAC = 0.42;
  /** Hover / press radial lift in sphere-radius units (~1). Temporary on covered. */
  const HOVER_LIFT = 0.022;
  const PRESS_LIFT = 0.011;
  /**
   * Four permanent height tiers (radial, sphere-radius units).
   * Flagged proudest → empty deepest. Hover adds HOVER_LIFT over the tier.
   * Flags only stand proud in styles that extrude; flush/yellow keep them
   * at shell height so those styles stay a flat mono field.
   */
  const TIER_FLAGGED = 0.01;
  const TIER_COVERED = 0;
  const TIER_NUMBERED = -0.018;
  const TIER_EMPTY = -0.034;
  /** Count styles that recess clears — the only ones that pin flags high. */
  const EXTRUDED_STYLES = new Set(["numerals", "rings", "borderless"]);
  /** @deprecated kept as alias of TIER_NUMBERED for any external callers */
  const REVEAL_INSET = TIER_NUMBERED;
  /** Static letter marks — readable size at a glance. */
  const SIZE_ICONS = {
    xsmall: '<span class="size-mark" data-size="XS" aria-hidden="true">XS</span>',
    easy: '<span class="size-mark" data-size="S" aria-hidden="true">S</span>',
    medium: '<span class="size-mark" data-size="M" aria-hidden="true">M</span>',
    hard: '<span class="size-mark" data-size="L" aria-hidden="true">L</span>',
    xlarge: '<span class="size-mark" data-size="XL" aria-hidden="true">XL</span>',
  };

  const THEME_ICONS = {
    light:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>',
    shell:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.2"></circle><circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="2"></circle><circle cx="12" cy="12" r="2.5" fill="currentColor"></circle></svg>',
    dark:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
    ink:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5s5 5.2 5 9.2a5 5 0 1 1-10 0c0-4 5-9.2 5-9.2z"></path><path d="M12 16.5v2"></path></svg>',
    float:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><ellipse cx="12" cy="18" rx="6" ry="1.6" opacity="0.35" fill="currentColor" stroke="none"></ellipse><circle cx="12" cy="10" r="5"></circle></svg>',
    card:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="19" rx="5.5" ry="1.4" opacity="0.35" fill="currentColor" stroke="none"></ellipse><rect x="6" y="4" width="12" height="13" rx="1.5"></rect></svg>',
    earth:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"></path></svg>',
    moon:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
    glow:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.35"></circle><circle cx="12" cy="12" r="7"></circle><path d="M12 2v2M12 20v2M2 12h2M20 12h2"></path></svg>',
    mercury:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M7.5 9.5a5 5 0 0 1 6-2.5" opacity="0.9"></path><path d="M9 15.5c1.8 1.6 4.4 1.4 6-.4" opacity="0.5"></path></svg>',
    stratosphere:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M6 12.5h4a2 2 0 0 0 0-4 3 3 0 0 0-5.6 1" opacity="0.9"></path><path d="M11 16h6a1.6 1.6 0 0 0 0-3.2 2.4 2.4 0 0 0-4.5-.6" opacity="0.7"></path></svg>',
    "ion-storm":
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M13.2 7.5 9.8 12.4h3.4l-2.2 4.1" opacity="0.95"></path><path d="M6.5 10.5c1.4-1.2 3-1 4-.2" opacity="0.5"></path></svg>',
    aurora:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M6.5 13.5c1.5-3 3-3 4.5 0s3 3 4.5 0" opacity="0.9"></path><path d="M7.5 9.5c1.2-2 2.4-2 3.6 0s2.4 2 3.6 0" opacity="0.5"></path></svg>',
    galaxy:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M12 12c-3-2.5-1.5-6 2-6.2" opacity="0.9"></path><path d="M12 12c3 2.5 1.5 6-2 6.2" opacity="0.9"></path><circle cx="12" cy="12" r="1.2" fill="currentColor"></circle></svg>',
    "gilded-ribbon":
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M7 15c2-6 4-6 6 0s4 6 4-1" opacity="0.9"></path></svg>',
    "heat-lightning":
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M12.5 6.5 9 12h3l-1.5 5.5" opacity="0.95"></path><path d="M15.5 9.5l-1.6 2.6h1.8l-1.2 2.4" opacity="0.5"></path></svg>',
  };

  /** Loaded equirectangular maps (ImageData cache). */
  const globeCache = Object.create(null);

  /** Build the stable, transport-neutral payload shared by Sphere variants. */
  function buildRunCompletionPayload(details) {
    return {
      type: "hexsweeper:run-complete",
      schemaVersion: 1,
      runId: details.runId,
      variant: details.variant,
      outcome: details.outcome,
      elapsedSeconds: details.elapsedSeconds,
      safeFacesRevealed: details.safeFacesRevealed,
      mineCount: details.mineCount,
      difficulty: details.difficulty,
      completedAt: details.completedAt,
    };
  }

  function boot(opts) {
    opts = opts || {};
    const variant =
      opts.variant && typeof opts.variant === "object" ? opts.variant : null;
    if (variant) {
      const storageKeyValid =
        typeof opts.storageKey === "string" &&
        opts.storageKey === opts.storageKey.trim() &&
        opts.storageKey.length > 0 &&
        opts.storageKey !== RUN_STORAGE_KEY &&
        opts.storageKey !== RUN_STORAGE_KEY_LEGACY;
      const runKindValid =
        typeof opts.runKind === "string" &&
        opts.runKind === opts.runKind.trim() &&
        opts.runKind.length > 0 &&
        opts.runKind !== "sphere";
      if (!storageKeyValid || !runKindValid) {
        throw new Error(
          "SphereSweeper: variant storageKey and runKind must be non-canonical"
        );
      }
    }
    const runStorageKey =
      variant ? opts.storageKey : RUN_STORAGE_KEY;
    const runKind =
      variant ? opts.runKind : "sphere";
    const variantId =
      variant && typeof variant.id === "string" && variant.id
        ? variant.id
        : runKind;

    function createRunId() {
      if (variant && typeof opts.createRunId === "function") {
        const supplied = opts.createRunId();
        if (typeof supplied === "string" && supplied) return supplied;
      }
      try {
        if (global.crypto && typeof global.crypto.randomUUID === "function") {
          return global.crypto.randomUUID();
        }
      } catch (_) {}
      return `sphere-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }

    // Publish the resolved effects preference before first paint so CSS gates
    // apply to the opening frame rather than snapping in after it.
    applyEffectsAttribute();
    const canvas = document.getElementById(opts.canvasId || "gameCanvas");
    if (!canvas) throw new Error("SphereSweeper: canvas not found");
    const ctx = canvas.getContext("2d");

    /**
     * Reflection bridge. Themes flagged `reflectionSurface` hand the sphere
     * body to sphere/mirror-material.js (WebGL) on a canvas layered under the
     * game canvas. The renderer is created lazily on the first such theme,
     * kept across theme switches, and stopped (canvas hidden) whenever a
     * plain theme is active. When the script is not loaded, WebGL is missing,
     * or forced colors are on, reflectionLive() stays false and the Canvas 2D
     * paths paint a plain metal field instead.
     */
    let reflection = null;
    let reflectionCanvasEl = null;
    function reflectionLive() {
      return !!(
        reflection &&
        !reflection.failed &&
        state.theme &&
        state.theme.reflectionSurface
      );
    }
    function reflectionBlocked() {
      try {
        return !!(global.matchMedia && global.matchMedia("(forced-colors: active)").matches);
      } catch (_) {
        return false;
      }
    }
    function ensureReflectionCanvas() {
      if (reflectionCanvasEl && reflectionCanvasEl.isConnected) return reflectionCanvasEl;
      let el = document.getElementById("reflectionCanvas");
      if (!el) {
        el = document.createElement("canvas");
        el.id = "reflectionCanvas";
        el.setAttribute("aria-hidden", "true");
        el.style.cssText =
          "position:absolute;inset:0;width:100%;height:100%;display:block;" +
          "z-index:0;pointer-events:none;transform:translateZ(0)";
        const parent = canvas.parentNode || document.body;
        parent.insertBefore(el, canvas);
        // Keep the game canvas above the material without touching page CSS.
        if (!canvas.style.position) canvas.style.position = "relative";
        if (!canvas.style.zIndex) canvas.style.zIndex = "1";
      }
      reflectionCanvasEl = el;
      return el;
    }
    function syncReflectionForTheme() {
      const T = state.theme;
      const wants = !!(T && T.reflectionSurface);
      if (!wants) {
        if (reflection) {
          reflection.stop();
          if (reflectionCanvasEl) reflectionCanvasEl.style.display = "none";
          try {
            delete document.body.dataset.reflectionMaterial;
          } catch (_) {}
        }
        return;
      }
      if (!global.MirrorMaterial || reflectionBlocked()) return;
      const el = ensureReflectionCanvas();
      el.style.display = "";
      if (!reflection) {
        try {
          reflection = global.MirrorMaterial.boot({
            canvasId: el.id,
            appearance: "dark",
            material: T.material || "mercury",
            persist: false,
          });
          reflection.attach({
            getState: () => state,
            projectTile,
            getSphereScreen: () => ({
              cx: state.centerX,
              cy: state.centerY,
              r: state.scale * 1.15,
            }),
          });
        } catch (err) {
          reflection = null;
          try {
            console.warn("SphereSweeper: reflection material unavailable", err);
          } catch (_) {}
          return;
        }
      } else {
        reflection.setMaterial(T.material || "mercury", { persist: false });
        reflection.resize();
        reflection.start();
      }
      // The renderer stamps body chrome for its own appearance mode; the
      // theme owns page chrome here (Stratosphere is a light-chrome material).
      document.body.dataset.sphereChrome = T.chrome || "dark";
    }

    function readStoredThemeId() {
      try {
        const id =
          localStorage.getItem(THEME_STORAGE_KEY) ||
          localStorage.getItem("hexsweeper-sphere-theme-v5") ||
          localStorage.getItem("hexsweeper-sphere-theme-v4") ||
          localStorage.getItem("hexsweeper-sphere-theme-v3");
        if (id && THEMES.some((t) => t.id === id)) return id;
      } catch (_) {}
      return DEFAULT_THEME.id;
    }

    function readStoredCountStyle() {
      try {
        const id = localStorage.getItem(COUNT_STYLE_STORAGE_KEY);
        if (id && COUNT_STYLES.some((s) => s.id === id)) return id;
        if (localStorage.getItem(NEST_STORAGE_KEY) === "1") return "rings";
      } catch (_) {}
      return COUNT_STYLES[0].id;
    }

    function readStoredSize() {
      try {
        const val =
          localStorage.getItem(SIZE_STORAGE_KEY) ||
          localStorage.getItem("hexsweeper-sphere-size-v1");
        if (val && SIZE_ORDER.includes(val)) return val;
      } catch (_) {}
      return opts.difficulty || "medium";
    }

    function readStoredInvert() {
      try {
        const raw = localStorage.getItem(INVERT_STORAGE_KEY);
        if (!raw) return { x: false, y: false };
        const data = JSON.parse(raw);
        return { x: !!data.x, y: !!data.y };
      } catch (_) {
        return { x: false, y: false };
      }
    }

    function persistInvert() {
      try {
        localStorage.setItem(
          INVERT_STORAGE_KEY,
          JSON.stringify({ x: !!state.invertDragX, y: !!state.invertDragY })
        );
      } catch (_) {}
    }

    let themeIndex = THEMES.findIndex((t) => t.id === readStoredThemeId());
    if (themeIndex < 0) themeIndex = 0;
    const storedInvert = readStoredInvert();
    const storedCountStyle = readStoredCountStyle();
    const storedTheme = THEMES[themeIndex];
    const storedDark = (storedTheme && storedTheme.chrome) === "dark";

    const state = {
      canvas,
      ctx,
      theme: themePalette(THEMES[themeIndex]),
      difficulty: readStoredSize(),
      tiles: [],
      cells: [],
      sphere: null,
      mineCount: 0,
      flagsPlaced: 0,
      isFirstClick: true,
      isGameOver: false,
      won: false,
      rotY: 0,
      rotX: 0.25,
      targetRotY: 0,
      targetRotX: 0.25,
      dragging: false,
      dragStart: null,
      flagMode: false,
      hovered: -1,
      pressed: -1,
      timeElapsed: 0,
      timerInterval: null,
      reduceMotion: effectsReduced(),
      radius: 1,
      baseScale: 200,
      zoomFactor: INITIAL_ZOOM,
      scale: 200,
      centerX: 0,
      centerY: 0,
      projectedCache: null,
      rotCacheKey: "",
      rafScheduled: false,
      detonatorIdx: -1,
      endFx: null,
      camShake: 0,
      ambientSpin: !effectsReduced(),
      // Chrome that lives on the sphere (face menu) keeps rotation live while
      // it is open but must not dig, flag, long-press, pinch, or wheel-zoom.
      menuRotateOnly: false,
      lastFrameAt: 0,
      countStyle: storedCountStyle,
      relief:
        storedCountStyle === "flush" || storedCountStyle === "yellow"
          ? "flush"
          : "extruded",
      seams: storedCountStyle !== "borderless",
      appearanceAxes: storedDark
        ? { field: "dark", shell: "dark", well: "light" }
        : { field: "light", shell: "light", well: "dark" },
      invertDragX: storedInvert.x,
      invertDragY: storedInvert.y,
    };
    let runId = null;
    let completionEmitted = false;
    let lastVariantState = null;
    const VARIANT_HOOK_FAILED = {};

    const END_FX = {
      active: false,
      won: false,
      t0: 0,
      lastT: 0,
      duration: BLAST_DURATION_MS,
      detonator: -1,
      x: 0,
      y: 0,
      particles: [],
      rings: [],
      shards: [],
      poppedMines: null,
      mineDue: null,
    };

    /**
     * Reflection materials (sphere/mirror-material.js) are an optional
     * observer of gameplay. The Canvas engine remains authoritative; these
     * semantic events add optical response without replacing reveal, flag,
     * mine, or end-state animation paths.
     */
    function emitMaterialAction(type, index, detail) {
      try {
        document.dispatchEvent(new CustomEvent("hexsweeper:sphere-action", {
          detail: Object.assign({ type, index }, detail || {}),
        }));
      } catch (_) {}
    }

    function freshCell() {
      return {
        isMine: false,
        revealed: false,
        flagged: false,
        neighborMines: 0,
        animReveal: 0,
        visualDue: 0,
        pulseAt: 0,
        endFlash: 0,
        endPop: 0,
        blast: null,
        blastOx: 0,
        blastOy: 0,
        blastRot: 0,
        blastAlpha: 1,
        blastScale: 1,
      };
    }

    function monoBlastPalette() {
      const dark = state.theme.id !== "light";
      return dark
        ? ["#ffffff", "#e8e8e8", "#bbbbbb", "#888888", "#555555"]
        : ["#000000", "#222222", "#444444", "#666666", "#999999"];
    }

    function monoShockStroke(alpha) {
      const dark = state.theme.id !== "light";
      return dark
        ? `rgba(255,255,255,${alpha})`
        : `rgba(0,0,0,${alpha})`;
    }

    function avgTileRadius(projected) {
      if (!projected || !projected.length) return state.scale * 0.06;
      let sum = 0;
      let n = 0;
      for (const p of projected) {
        if (p.z > 0.02 && p.area > 0) {
          sum += Math.sqrt(p.area);
          n++;
        }
      }
      return n ? sum / n : state.scale * 0.06;
    }

    const statsMines = document.getElementById("stats-mines");
    const statsTime = document.getElementById("stats-time");
    const bannerEl = document.getElementById("sphere-banner");
    const bannerMsg = document.getElementById("banner-msg");
    const bannerMeta = document.getElementById("banner-meta");
    const bannerActions = document.getElementById("banner-actions");
    const shareWinBtn = document.getElementById("share-win-btn");
    const bannerUndoBtn = document.getElementById("banner-undo-btn");
    const bannerAgainBtn = document.getElementById("banner-again-btn");
    const restartBtn = document.getElementById("reset-btn") || document.getElementById("restart-btn");
    const flagToggle = document.getElementById("flag-toggle");
    const sizeBtn = document.getElementById("size-btn");
    const themeBtn = document.getElementById("theme-btn");
    const nestBtn = document.getElementById("nest-btn");
    const countStyleToast = document.getElementById("count-style-toast");
    const helpOverlay = document.getElementById("help-overlay");
    const helpPanel = document.getElementById("help-panel");
    const helpBtn = document.getElementById("help-btn");
    const helpCloseBtn = document.getElementById("help-close-btn");
    const helpDoneBtn = document.getElementById("help-done-btn");
    let helpFocusReturn = null;
    let helpOpenFrame = 0;
    function cancelHelpOpenFrame() {
      if (!helpOpenFrame) return;
      // Test harnesses stub requestAnimationFrame without its cancel twin.
      if (typeof global.cancelAnimationFrame === "function") {
        global.cancelAnimationFrame(helpOpenFrame);
      }
      helpOpenFrame = 0;
    }
    let shareBusy = false;
    /*
     * The share File is built when the win banner appears, not when the button
     * is tapped. iOS Safari only honours navigator.share() while the user
     * gesture is still active, and canvas.toBlob() is async — awaiting it
     * spent the activation, so share() rejected with NotAllowedError and the
     * download fallback (which iOS also ignores for blob URLs) did nothing
     * visible. Preparing ahead lets the click call share() synchronously.
     */
    let pendingShareFile = null;
    /*
     * One-level undo. Only `revealed` and `flagged` are mutable per cell, so a
     * snapshot is two byte arrays plus a few scalars — cheap enough to take
     * before every dig. It exists for the game-over banner: a detonation is
     * the one move players want back.
     */
    let undoSnapshot = null;
    let variantRevealMutationDepth = 0;

    function variantContext(extra) {
      return Object.assign(
        {
          state,
          cells: state.cells,
          tiles: state.tiles,
          canvas,
          context2d: ctx,
          runId,
          endRun(outcome, terminal) {
            if (state.isGameOver) return false;
            if (
              terminal &&
              Number.isInteger(terminal.detonatorIndex) &&
              terminal.detonatorIndex >= 0 &&
              terminal.detonatorIndex < state.cells.length
            ) {
              state.detonatorIdx = terminal.detonatorIndex;
            }
            gameOver(outcome === true || outcome === "win");
            return true;
          },
          persist: () => persistNow(),
          requestDraw: () => scheduleFrame(),
          revealSafeFaces: (indices) => revealSafeFaces(indices),
          resolveLinkedFaces: (indices) => resolveLinkedFaces(indices),
          projectFace(index, lift) {
            const tile = state.tiles[index];
            return tile
              ? projectTile(tile, state.rotY, state.rotX, lift || 0)
              : null;
          },
        },
        extra || {}
      );
    }

    function callVariant(hook, extra, fallback) {
      if (!variant || typeof variant[hook] !== "function") return undefined;
      try {
        return variant[hook](variantContext(extra));
      } catch (_) {
        return fallback;
      }
    }

    function notifyVariantReveal(extra, allowLinkedReveal) {
      if (!allowLinkedReveal) return callVariant("reveal", extra);
      variantRevealMutationDepth++;
      try {
        return callVariant("reveal", extra);
      } finally {
        variantRevealMutationDepth--;
      }
    }

    function exportVariantState() {
      if (!variant || typeof variant.exportState !== "function") {
        return lastVariantState;
      }
      try {
        const exported = variant.exportState(variantContext());
        lastVariantState = exported === undefined ? null : exported;
      } catch (_) {}
      return lastVariantState;
    }

    function variantAdmitsReveal(index, source) {
      const result = callVariant("admitReveal", { index, source }, false);
      return !(
        result === false ||
        (result && result.allowed === false) ||
        (result && result.status === "blocked")
      );
    }

    function variantAdmitsFlag(index, flagged) {
      const result = callVariant("admitFlag", { index, flagged }, false);
      return !(
        result === false ||
        (result && result.allowed === false) ||
        (result && result.status === "blocked")
      );
    }

    function captureUndo() {
      const n = state.cells.length;
      const revealed = new Uint8Array(n);
      const flagged = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        revealed[i] = state.cells[i].revealed ? 1 : 0;
        flagged[i] = state.cells[i].flagged ? 1 : 0;
      }
      undoSnapshot = {
        revealed,
        flagged,
        flagsPlaced: state.flagsPlaced,
        isFirstClick: state.isFirstClick,
        timeElapsed: state.timeElapsed,
        runId,
        completionEmitted,
      };
      if (variant) undoSnapshot.variant = callVariant("captureUndo");
    }

    function restoreUndo() {
      if (!undoSnapshot) return false;
      const snap = undoSnapshot;
      const startsContinuation =
        !!variant && state.isGameOver && completionEmitted;
      undoSnapshot = null;
      clearEndFx();
      for (let i = 0; i < state.cells.length; i++) {
        const c = state.cells[i];
        c.revealed = !!snap.revealed[i];
        c.flagged = !!snap.flagged[i];
        // Revealed cells keep their finished animation; undone ones reset so
        // a re-dig animates again instead of popping in.
        c.animReveal = c.revealed ? 1 : 0;
        c.visualDue = 0;
      }
      state.flagsPlaced = snap.flagsPlaced;
      state.isFirstClick = snap.isFirstClick;
      state.timeElapsed = snap.timeElapsed;
      state.isGameOver = false;
      state.won = false;
      state.detonatorIdx = -1;
      if (variant) {
        runId = startsContinuation ? createRunId() : snap.runId || runId;
        completionEmitted = startsContinuation
          ? false
          : !!snap.completionEmitted;
      }
      if (variant) callVariant("restoreUndo", { saved: snap.variant });
      hideBanner();
      if (!state.isFirstClick) startTimer();
      updateUI();
      draw();
      persistNow();
      return true;
    }

    function hudClick(fn) {
      return (e) => {
        e.preventDefault();
        e.stopPropagation();
        fn(e);
      };
    }

    function themePalette(themeDef) {
      // Keep id/name — coveredStyle / tileColors branch on theme.id (dark = pure white hexes).
      const out = {};
      for (const key of Object.keys(themeDef)) {
        out[key] = themeDef[key];
      }
      return out;
    }

    function currentThemeDef() {
      return THEMES[themeIndex];
    }

    function globeUrl(mapId) {
      const meta = GLOBE_MAPS[mapId];
      if (!meta) return null;
      const compact = !!(
        global.matchMedia &&
        global.matchMedia("(max-width: 760px), (max-resolution: 1.25dppx)").matches
      );
      const file = compact && meta.mobileFile ? meta.mobileFile : meta.file;
      // Prefer absolute (works in collection/ CodePen); fall back to relative under sphere/.
      try {
        if (/\/sphere\/?$|\/sphere\//.test(location.pathname)) {
          return new URL(`assets/textures/${file}`, location.href).href;
        }
      } catch (_) {}
      return GLOBE_TEX_BASE + file;
    }

    function loadGlobeMap(mapId) {
      if (!mapId || !GLOBE_MAPS[mapId]) return Promise.resolve(null);
      if (globeCache[mapId] && globeCache[mapId].ready) {
        return Promise.resolve(globeCache[mapId]);
      }
      if (globeCache[mapId] && globeCache[mapId].promise) {
        return globeCache[mapId].promise;
      }
      const entry = { ready: false, promise: null, data: null, w: 0, h: 0 };
      globeCache[mapId] = entry;
      entry.promise = new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const c = document.createElement("canvas");
            c.width = img.naturalWidth || img.width;
            c.height = img.naturalHeight || img.height;
            const g = c.getContext("2d", { willReadFrequently: true });
            g.drawImage(img, 0, 0);
            entry.data = g.getImageData(0, 0, c.width, c.height);
            entry.w = c.width;
            entry.h = c.height;
            entry.ready = true;
          } catch (_) {
            entry.ready = false;
          }
          resolve(entry);
          bakeGlobeTileColors();
          scheduleFrame();
        };
        img.onerror = () => {
          entry.ready = false;
          resolve(entry);
        };
        img.src = globeUrl(mapId);
      });
      return entry.promise;
    }

    function sampleGlobeRgb(mapId, lat, lon) {
      const entry = globeCache[mapId];
      if (!entry || !entry.ready || !entry.data) return null;
      let la = Number(lat);
      let lo = Number(lon);
      if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
      la = Math.max(-90, Math.min(90, la));
      // lon from atan2 is -180..180
      while (lo < -180) lo += 360;
      while (lo > 180) lo -= 360;
      const u = (lo + 180) / 360;
      const v = (90 - la) / 180;
      const x = Math.min(entry.w - 1, Math.max(0, Math.floor(u * entry.w)));
      const y = Math.min(entry.h - 1, Math.max(0, Math.floor(v * entry.h)));
      const i = (y * entry.w + x) * 4;
      const d = entry.data.data;
      return [d[i], d[i + 1], d[i + 2]];
    }

    function rgbCss(rgb, a) {
      if (!rgb) return null;
      if (a != null && a < 1) {
        return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
      }
      return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    }

    function shadeRgb(rgb, amount) {
      // amount > 0 lighten, < 0 darken
      if (!rgb) return rgb;
      const t = Math.max(-1, Math.min(1, amount));
      return rgb.map((c) => {
        if (t >= 0) return Math.round(c + (255 - c) * t);
        return Math.round(c * (1 + t));
      });
    }

    function tileGlobeColor(tile, opts) {
      opts = opts || {};
      const mapId = state.theme && state.theme.globeMap;
      if (!mapId || !tile) return null;
      if (tile._globeCss && !opts.force) return tile._globeCss;
      const sph = tile.spherical ||
        (global.Hexasphere && global.Hexasphere.cartesianToSpherical
          ? global.Hexasphere.cartesianToSpherical(tile.centerPoint)
          : null);
      if (!sph) return null;
      let rgb = sampleGlobeRgb(mapId, sph.lat, sph.lon);
      if (!rgb) return null;
      if (opts.darken) rgb = shadeRgb(rgb, -opts.darken);
      if (opts.lighten) rgb = shadeRgb(rgb, opts.lighten);
      const css = rgbCss(rgb);
      if (!opts.ephemeral) tile._globeCss = css;
      return css;
    }

    function bakeGlobeTileColors() {
      const mapId = state.theme && state.theme.globeMap;
      if (!mapId || !state.tiles || !state.tiles.length) return;
      for (let i = 0; i < state.tiles.length; i++) {
        const t = state.tiles[i];
        t._globeCss = null;
        t._globeDetail = null;
        tileGlobeColor(t);
      }
    }

    function ensureGlobeForTheme(themeDef) {
      if (themeDef && themeDef.globeMap) {
        loadGlobeMap(themeDef.globeMap);
      }
    }

    function syncChromeTheme() {
      const t = state.theme || currentThemeDef();
      // Page chrome follows field (bg); dataset keeps the concrete theme id.
      document.body.dataset.sphereTheme = t.id;
      document.body.dataset.sphereChrome = t.chrome || "light";
      if (themeBtn) {
        themeBtn.title = `Theme — ${t.name} (T)`;
        themeBtn.setAttribute(
          "aria-label",
          `Theme: ${t.name}. Activate to cycle Light, Shell, Dark, Ink, Float, Card, Earth, Moon, Glow, Mercury, Stratosphere, Ion Storm, Aurora, Galaxy, Gilded Ribbon, Heat Lightning.`
        );
        themeBtn.innerHTML = THEME_ICONS[t.id] || THEME_ICONS.light;
      }
    }

    function syncSizeChrome() {
      const key = state.difficulty;
      const letter = SIZE_LABEL[key] || "M";
      const name = SIZE_NAMES[key] || "Medium";
      const faces = SIZE_FACES[key] || 1002;
      if (sizeBtn) {
        sizeBtn.title = `Board size ${letter} — ${name} (${faces} faces). Click to cycle XS → S → M → L → XL.`;
        sizeBtn.setAttribute(
          "aria-label",
          `Board size ${letter}, ${name}, ${faces} faces. Activate to cycle XS, S, M, L, XL.`
        );
        sizeBtn.innerHTML = SIZE_ICONS[key] || SIZE_ICONS.medium;
      }
    }

    function applyTheme(index, optsApply) {
      optsApply = optsApply || {};
      themeIndex = ((index % THEMES.length) + THEMES.length) % THEMES.length;
      const def = currentThemeDef();
      state.theme = themePalette(def);
      applyThemeWarnings(def);
      syncReflectionForTheme();
      if (def.id === "light" || def.id === "dark") {
        const dark = def.id === "dark";
        state.appearanceAxes = dark
          ? { field: "dark", shell: "dark", well: "light" }
          : { field: "light", shell: "light", well: "dark" };
      }
      // Clear per-tile globe cache when leaving/entering a map theme.
      if (state.tiles) {
        for (let i = 0; i < state.tiles.length; i++) {
          state.tiles[i]._globeCss = null;
          state.tiles[i]._globeDetail = null;
        }
      }
      ensureGlobeForTheme(def);
      bakeGlobeTileColors();
      syncChromeTheme();
      try {
        localStorage.setItem(THEME_STORAGE_KEY, def.id);
      } catch (_) {}
      scheduleFrame();
    }

    /** Themes own count paint · relief · seams; a theme without `warn` leaves them alone. */
    function applyThemeWarnings(def) {
      const w = def && def.warn;
      if (!w) return;
      if (w.count && state.countStyle !== w.count) {
        setCountStyle(w.count, { syncSurface: false, toast: false });
      }
      if (w.relief) state.relief = w.relief === "flush" ? "flush" : "extruded";
      if (typeof w.seams === "boolean") state.seams = w.seams;
    }

    function cycleTheme() {
      applyTheme(themeIndex + 1);
    }

    function boardIsFresh() {
      return state.isFirstClick && state.flagsPlaced === 0 && !state.isGameOver;
    }

    function setDifficulty(val, restart, optsSet) {
      optsSet = optsSet || {};
      if (!SIZE_ORDER.includes(val)) return false;
      // Same size already — no wipe (S/M/L keys while already there).
      if (val === state.difficulty && restart !== false) return true;
      // No browser confirm — size button is the deliberate wipe (same as Reset).
      state.difficulty = val;
      syncSizeChrome();
      try {
        localStorage.setItem(SIZE_STORAGE_KEY, val);
      } catch (_) {}
      if (restart !== false) {
        hideBanner();
        resetGame();
        if (typeof showCountStyleToast === "function") {
          showCountStyleToast(
            `${SIZE_LABEL[val] || val} · new board`
          );
        }
        scheduleFrame();
      }
      return true;
    }

    function cycleSize() {
      const i = SIZE_ORDER.indexOf(state.difficulty);
      const next = SIZE_ORDER[(i < 0 ? 1 : i + 1) % SIZE_ORDER.length];
      setDifficulty(next, true);
    }

    function requestReset(optsReset) {
      // Reset control is intentional — no window.confirm dialog.
      hideBanner();
      resetGame();
      if (typeof showCountStyleToast === "function") {
        showCountStyleToast("New sphere");
      }
      scheduleFrame();
      return true;
    }

    function trapFocus(container) {
      const sel =
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const nodes = [...container.querySelectorAll(sel)].filter(
        (el) => !el.hidden && !el.disabled
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      function onKey(e) {
        if (e.key !== "Tab") return;
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
      container.addEventListener("keydown", onKey);
      return () => container.removeEventListener("keydown", onKey);
    }

    let releaseFocusTrap = null;
    let markWelcomeSeen = false;
    let helpLifecycleHeld = false;

    let syncHelpControls = null;

    function bindHelpControls() {
      const row = document.getElementById("help-controls");
      if (!row) return;
      const invBtn = row.querySelector('[data-ctl="invert"]');
      const fxBtn = row.querySelector('[data-ctl="effects"]');
      const inversions = [
        [false, false, "Invert off"],
        [true, false, "Invert X"],
        [false, true, "Invert Y"],
        [true, true, "Invert X+Y"],
      ];
      const effects = {
        auto: "Effects auto",
        full: "Effects full",
        reduced: "Effects reduced",
      };
      const inversionIndex = () =>
        inversions.findIndex(
          ([x, y]) => x === !!state.invertDragX && y === !!state.invertDragY
        );
      const effectsMode = () => {
        try {
          return localStorage.getItem(EFFECTS_KEY) || "auto";
        } catch (_) {
          return "auto";
        }
      };
      syncHelpControls = () => {
        if (invBtn) {
          invBtn.textContent = inversions[Math.max(0, inversionIndex())][2];
        }
        if (fxBtn) fxBtn.textContent = effects[effectsMode()] || effects.auto;
      };
      if (invBtn) {
        invBtn.addEventListener("click", () => {
          const [x, y] =
            inversions[(Math.max(0, inversionIndex()) + 1) % inversions.length];
          state.invertDragX = x;
          state.invertDragY = y;
          persistInvert();
          syncHelpControls();
        });
      }
      if (fxBtn) {
        fxBtn.addEventListener("click", () => {
          const order = ["auto", "full", "reduced"];
          const next = order[(order.indexOf(effectsMode()) + 1) % order.length];
          try {
            localStorage.setItem(EFFECTS_KEY, next);
          } catch (_) {}
          state.reduceMotion = effectsReduced();
          state.ambientSpin = !state.reduceMotion;
          applyEffectsAttribute();
          syncHelpControls();
          scheduleFrame();
        });
      }
      syncHelpControls();
    }

    function openHelp(fromWelcome) {
      if (!helpOverlay) return;
      if (!helpLifecycleHeld) {
        helpLifecycleHeld = true;
        try {
          if (typeof opts.onHelpOpen === "function") opts.onHelpOpen();
        } catch (_) {}
      }
      if (fromWelcome) markWelcomeSeen = true;
      helpFocusReturn =
        document.activeElement && document.activeElement !== document.body
          ? document.activeElement
          : helpBtn;
      helpOverlay.hidden = false;
      document.body.classList.add("help-open");
      // Deferred a frame so the opacity transition runs; closeHelp cancels it
      // so an open→close inside one frame cannot leave the overlay both
      // hidden and "open" (which blocked every tap on the board).
      cancelHelpOpenFrame();
      helpOpenFrame = requestAnimationFrame(() => {
        helpOpenFrame = 0;
        helpOverlay.classList.add("open");
      });
      if (releaseFocusTrap) releaseFocusTrap();
      releaseFocusTrap = trapFocus(helpOverlay);
      (helpPanel || helpOverlay).focus?.();
    }

    function closeHelp() {
      if (!helpOverlay) return;
      if (helpLifecycleHeld) {
        helpLifecycleHeld = false;
        try {
          if (typeof opts.onHelpClose === "function") opts.onHelpClose();
        } catch (_) {}
      }
      if (markWelcomeSeen) {
        try {
          localStorage.setItem(WELCOME_KEY, "1");
        } catch (_) {}
        markWelcomeSeen = false;
      }
      cancelHelpOpenFrame();
      helpOverlay.classList.remove("open");
      document.body.classList.remove("help-open");
      if (releaseFocusTrap) {
        releaseFocusTrap();
        releaseFocusTrap = null;
      }
      setTimeout(() => {
        helpOverlay.hidden = true;
      }, 200);
      if (helpFocusReturn && typeof helpFocusReturn.focus === "function") {
        helpFocusReturn.focus();
      }
      helpFocusReturn = null;
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.centerX = w / 2;
      state.centerY = h / 2;
      // Portrait phones: the short edge is the width and the flower must fit
      // inside the sphere, so let the sphere take more of it (~86% at the
      // default zoom) instead of the desktop-tuned 70%. Tall margins above
      // and below stay free for the tap-outside menu gesture.
      const portraitPhone = h > w * 1.25 && w <= 600;
      state.baseScale = portraitPhone
        ? w * 0.52
        : Math.min(w, h) * BASE_SCALE_FRAC;
      state.scale = state.baseScale * state.zoomFactor;
      state.projectedCache = null;
    }

    function setZoomFactor(factor) {
      state.zoomFactor = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, factor));
      state.scale = state.baseScale * state.zoomFactor;
      invalidateProjection();
      scheduleFrame();
      schedulePersist();
    }

    function touchDistance(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    }

    /** Shortest signed delta from → to on the circle (avoids lerp yoink across ±π). */
    function angleDelta(from, to) {
      let d = to - from;
      const tau = Math.PI * 2;
      d = ((d + Math.PI) % tau + tau) % tau - Math.PI;
      return d;
    }

    /** When idle, fold huge angles back without changing orientation. */
    function normalizeIdleRotation() {
      if (state.dragging) return;
      if (
        Math.abs(state.targetRotY - state.rotY) > 0.001 ||
        Math.abs(state.targetRotX - state.rotX) > 0.001
      ) {
        return;
      }
      const tau = Math.PI * 2;
      if (Math.abs(state.rotY) > tau * 2) {
        state.rotY = ((state.rotY + Math.PI) % tau + tau) % tau - Math.PI;
        state.targetRotY = state.rotY;
      }
      if (Math.abs(state.rotX) > tau * 2) {
        state.rotX = ((state.rotX + Math.PI) % tau + tau) % tau - Math.PI;
        state.targetRotX = state.rotX;
      }
    }

    function rotatePoint(p, rotY, rotX) {
      let x = p.x;
      let y = p.y;
      let z = p.z;
      const cy = Math.cos(rotY);
      const sy = Math.sin(rotY);
      const x1 = x * cy + z * sy;
      const z1 = -x * sy + z * cy;
      const cx = Math.cos(rotX);
      const sx = Math.sin(rotX);
      const y2 = y * cx - z1 * sx;
      const z2 = y * sx + z1 * cx;
      return { x: x1, y: y2, z: z2 };
    }

    function projectRotated(r) {
      const fov = 2.8;
      const depth = fov / (fov - r.z);
      return {
        x: state.centerX + r.x * state.scale * depth,
        y: state.centerY - r.y * state.scale * depth,
        z: r.z,
        depth,
      };
    }

    function projectPoint(p, rotY, rotX) {
      return projectRotated(rotatePoint(p, rotY, rotX));
    }

    function faceNormal(tile, rotY, rotX) {
      const n = rotatePoint(tile.centerPoint, rotY, rotX);
      const len = Math.hypot(n.x, n.y, n.z) || 1;
      return { x: n.x / len, y: n.y / len, z: n.z / len };
    }

    function projectTile(tile, rotY, rotX, lift) {
      const liftAmt = lift || 0;
      const n = faceNormal(tile, rotY, rotX);
      const liftVec = (p) => {
        const r = rotatePoint(p, rotY, rotX);
        return {
          x: r.x + n.x * liftAmt,
          y: r.y + n.y * liftAmt,
          z: r.z + n.z * liftAmt,
        };
      };
      const centerR = liftVec(tile.centerPoint);
      const boundaryR = tile.boundary.map(liftVec);
      const center = projectRotated(centerR);
      const boundary = boundaryR.map(projectRotated);
      const avgZ =
        boundary.reduce((s, p) => s + p.z, center.z) / (boundary.length + 1);
      return {
        center,
        boundary,
        z: avgZ,
        normalZ: n.z,
        normal: n,
        index: tile.index,
        area: hexScreenArea(boundary),
        baseBoundary:
          liftAmt !== 0
            ? tile.boundary.map((b) => projectPoint(b, rotY, rotX))
            : null,
      };
    }

    function hexScreenArea(boundary) {
      let area = 0;
      for (let i = 0; i < boundary.length; i++) {
        const j = (i + 1) % boundary.length;
        area += boundary[i].x * boundary[j].y - boundary[j].x * boundary[i].y;
      }
      return Math.abs(area) * 0.5;
    }

    function rotKey() {
      return `${state.rotY.toFixed(4)}|${state.rotX.toFixed(4)}|${state.scale}`;
    }

    /** Project all tiles once per frame; cull back hemisphere for pick + draw. */
    function getProjected() {
      const key = rotKey();
      if (state.projectedCache && state.rotCacheKey === key) {
        return state.projectedCache;
      }
      const all = state.tiles.map((t) => projectTile(t, state.rotY, state.rotX));
      const front = all.filter((p) => p.z > -0.05);
      front.sort((a, b) => a.z - b.z);
      state.projectedCache = front;
      state.rotCacheKey = key;
      return front;
    }

    function invalidateProjection() {
      state.projectedCache = null;
      state.interiorCache = null;
    }

    /**
     * "The sphere comes to the menu": rotate a seven-face patch dead-front
     * and zoom in until its centre face is at least `faceMin` CSS px across,
     * so on-sphere chrome uses real faces at finger size. Rotation eases via
     * the ordinary camera targets; zoom tweens here. releaseFocus() tweens
     * the zoom back (rotation stays where the player left it). The focus zoom
     * is never persisted — a reload restores the player's own zoom.
     */
    let focusRestore = null;
    let focusTween = 0;
    const FOCUS_ZOOM_MAX = 3.6;
    function tweenZoom(to, ms, done) {
      cancelAnimationFrame(focusTween);
      const from = state.zoomFactor;
      const t0 = performance.now();
      const step = (now) => {
        const k = ms > 0 ? Math.min(1, (now - t0) / ms) : 1;
        const e = 1 - Math.pow(1 - k, 3);
        state.zoomFactor = from + (to - from) * e;
        state.scale = state.baseScale * state.zoomFactor;
        invalidateProjection();
        // Paint now: the main loop may be parked on its idle timer, which
        // would turn a 320ms tween into two visible steps.
        draw();
        if (state.menuRotateOnly) {
          canvas.dispatchEvent(new CustomEvent("hexsweeper:rotation"));
        }
        if (k < 1) focusTween = requestAnimationFrame(step);
        else {
          scheduleFrame();
          if (done) done();
        }
      };
      focusTween = requestAnimationFrame(step);
    }
    function focusPatch(options) {
      const opts = options || {};
      const indices = Array.isArray(opts.indices) ? opts.indices : null;
      const centerIndex = indices ? indices[0] : -1;
      const tile = state.tiles[centerIndex];
      if (!tile) return null;
      if (!focusRestore) focusRestore = { zoom: state.zoomFactor };
      stopAmbientSpin();
      // Rotation that carries the tile's centre to +z (camera): yaw first
      // (rotatePoint applies Y then X), then pitch.
      const c = tile.centerPoint;
      const len = Math.hypot(c.x, c.y, c.z) || 1;
      const x = c.x / len, y = c.y / len, z = c.z / len;
      const yaw = Math.atan2(-x, z);
      const rho = Math.hypot(x, z);
      const pitch = Math.atan2(y, rho);
      state.targetRotY = state.rotY + angleDelta(state.rotY, yaw);
      state.targetRotX = state.rotX + angleDelta(state.rotX, pitch);
      // Zoom so the centre face reaches faceMin px across (measured at the
      // target rotation, where it is widest).
      const faceMin = Number(opts.faceMin) || 80;
      const proj = projectTile(tile, yaw, pitch);
      const xs = proj.boundary.map((pt) => pt.x);
      const width = Math.max(...xs) - Math.min(...xs);
      let zoom = state.zoomFactor;
      if (width > 0) zoom = state.zoomFactor * (faceMin / width);
      // Both directions: small boards zoom out so a fan still fits on screen.
      zoom = Math.max(ZOOM_MIN, Math.min(FOCUS_ZOOM_MAX, zoom));
      tweenZoom(zoom, state.reduceMotion ? 0 : Number(opts.ms) || 320);
      return { zoom, restore: focusRestore.zoom };
    }
    function releaseFocus() {
      if (!focusRestore) return;
      const back = focusRestore.zoom;
      focusRestore = null;
      tweenZoom(back, state.reduceMotion ? 0 : 260, () => {
        state.zoomFactor = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.zoomFactor));
        state.scale = state.baseScale * state.zoomFactor;
        invalidateProjection();
        scheduleFrame();
        schedulePersist();
      });
    }

    function setMenuInteraction(active) {
      state.menuRotateOnly = !!active;
      state.hovered = -1;
      state.pressed = -1;
      if (!state.menuRotateOnly) return;
      clearTimeout(longPressTimer);
      state.dragging = false;
      state.dragStart = null;
      pinching = false;
    }

    /**
     * One real front-facing hex and its six projected neighbours, for chrome
     * that inhabits the board instead of floating over it. Coordinates are
     * CSS pixels in canvas space. Hexes only — the twelve Goldberg pentagons
     * would break the seven-face patch. Pass {indices} to re-project the same
     * patch after a rotation; it returns null once that patch turns away.
     */
    function getMenuPatch(options) {
      const opts = options || {};
      const projected = getProjected().filter((face) => face.z > 0.08);
      const byIndex = new Map(projected.map((face) => [face.index, face]));
      const copyFace = (face) => ({
        index: face.index,
        z: face.z,
        center: { x: face.center.x, y: face.center.y },
        boundary: face.boundary.map((point) => ({ x: point.x, y: point.y })),
      });
      if (Array.isArray(opts.indices) && opts.indices.length === 7) {
        const center = byIndex.get(opts.indices[0]);
        const ring = opts.indices.slice(1).map((index) => byIndex.get(index));
        if (
          center &&
          center.boundary.length === 6 &&
          ring.every((face) => face && face.boundary.length === 6)
        ) {
          return {
            center: copyFace(center),
            ring: ring.map(copyFace),
            indices: opts.indices.slice(),
          };
        }
        if (opts.strict) return null;
      }
      const candidates = projected
        .filter((face) => {
          const tile = state.tiles[face.index];
          return (
            tile &&
            tile.boundary &&
            tile.boundary.length === 6 &&
            tile.neighborIndices &&
            tile.neighborIndices.length === 6 &&
            tile.neighborIndices.every((index) => {
              const neighbor = state.tiles[index];
              return (
                byIndex.has(index) &&
                neighbor &&
                neighbor.boundary &&
                neighbor.boundary.length === 6
              );
            })
          );
        })
        .sort((a, b) => {
          const ad = Math.hypot(a.center.x - state.centerX, a.center.y - state.centerY);
          const bd = Math.hypot(b.center.x - state.centerX, b.center.y - state.centerY);
          return ad - bd || b.z - a.z;
        });
      const center = candidates[0];
      if (!center) return null;
      const ring = state.tiles[center.index].neighborIndices
        .map((index) => byIndex.get(index))
        .filter(Boolean);
      if (ring.length !== 6) return null;
      return {
        center: copyFace(center),
        ring: ring.map(copyFace),
        indices: [center.index].concat(ring.map((face) => face.index)),
      };
    }

    function pointInPoly(x, y, poly) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x;
        const yi = poly[i].y;
        const xj = poly[j].x;
        const yj = poly[j].y;
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    }

    function pickTile(px, py) {
      const projected = getProjected().filter((p) => p.z > 0.02);
      for (let i = projected.length - 1; i >= 0; i--) {
        const p = projected[i];
        if (pointInPoly(px, py, p.boundary)) return p.index;
      }
      return -1;
    }

    function countNeighborMines(idx) {
      let n = 0;
      for (const ni of state.tiles[idx].neighborIndices) {
        if (state.cells[ni].isMine) n++;
      }
      return n;
    }

    function computeAllCounts() {
      computeCountsFor(state.tiles, state.cells);
    }

    function computeCountsFor(tiles, cells) {
      for (let i = 0; i < cells.length; i++) {
        let count = 0;
        for (const neighbor of tiles[i].neighborIndices) {
          if (cells[neighbor].isMine) count++;
        }
        cells[i].neighborMines = count;
      }
    }

    function mineTargetForDifficulty(tileCount) {
      const cfg = CONFIG[state.difficulty];
      return Math.max(1, Math.round(tileCount * cfg.minePct));
    }

    function placeMines(safeIdx) {
      const forbidden = new Set([safeIdx]);
      for (const n of state.tiles[safeIdx].neighborIndices) forbidden.add(n);
      const candidates = [];
      for (let i = 0; i < state.cells.length; i++) {
        if (!forbidden.has(i)) candidates.push(i);
      }
      shuffle(candidates);
      const count = Math.min(mineTargetForDifficulty(state.cells.length), candidates.length);
      for (let i = 0; i < count; i++) {
        state.cells[candidates[i]].isMine = true;
      }
      state.mineCount = count;
      computeAllCounts();
    }

    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }

    function startTimer(resumeAt) {
      if (Number.isFinite(resumeAt)) {
        state.timeElapsed = Math.max(0, resumeAt | 0);
      }
      if (state.timerInterval) return;
      state.timerInterval = setInterval(() => {
        state.timeElapsed++;
        updateUI();
        schedulePersist();
      }, 1000);
    }

    function stopTimer() {
      if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
      }
    }

    function formatTime(sec) {
      const s = Math.max(0, sec | 0);
      if (s < 60) return `${s}s`;
      const m = Math.floor(s / 60);
      const r = s % 60;
      return `${m}:${String(r).padStart(2, "0")}`;
    }

    function updateUI() {
      if (statsMines) {
        statsMines.textContent = String(
          Math.max(0, state.mineCount - state.flagsPlaced)
        ).padStart(2, "0");
      }
      if (statsTime) {
        statsTime.textContent = String(state.timeElapsed).padStart(3, "0");
      }
    }

    function stopAmbientSpin() {
      if (!state.ambientSpin) return;
      state.ambientSpin = false;
      state.targetRotY = state.rotY;
      state.targetRotX = state.rotX;
    }

    function tickAmbientSpin(now) {
      if (!state.ambientSpin || state.reduceMotion || state.dragging) return false;
      const prev = state.lastFrameAt || now;
      const dt = Math.min(48, Math.max(0, now - prev));
      if (dt <= 0) return true;
      const dY = AMBIENT_SPIN_RAD_PER_MS * dt;
      state.rotY += dY;
      state.targetRotY = state.rotY;
      invalidateProjection();
      return true;
    }

    /**
     * Start a clean board. Callers: UX Reset, size change, failed restore, ?deal=1.
     * Drops saved run unless keepPersist (OG deal must not wipe the player’s save).
     */
    function resetGame(optsReset) {
      optsReset = optsReset || {};
      stopTimer();
      clearEndFx();
      undoSnapshot = null;
      const cfg = CONFIG[state.difficulty];
      if (!global.Hexasphere || typeof global.Hexasphere.generateHexasphere !== "function") {
        throw new Error("SphereSweeper: Hexasphere not loaded");
      }
      state.sphere = Hexasphere.generateHexasphere(1, cfg.subdivisions);
      state.tiles = state.sphere.tiles;
      attachEdgeNeighbors();
      state.cells = state.tiles.map(() => freshCell());
      state.isFirstClick = true;
      state.isGameOver = false;
      state.won = false;
      state.detonatorIdx = -1;
      state.flagsPlaced = 0;
      state.timeElapsed = 0;
      state.hovered = -1;
      state.pressed = -1;
      state.camShake = 0;
      runId = variant ? createRunId() : null;
      completionEmitted = false;
      lastVariantState = null;
      // Fresh board: resume idle spin until the player touches the canvas again.
      state.ambientSpin = !state.reduceMotion;
      state.mineCount = mineTargetForDifficulty(state.tiles.length);
      invalidateProjection();
      ensureGlobeForTheme(state.theme);
      bakeGlobeTileColors();
      updateUI();
      emitMaterialAction("reset", -1);
      callVariant("reset");
      if (!optsReset.keepPersist) clearPersist();
    }

    /**
     * ?deal=1 — open a starting flood for OG cards / previews.
     * Digs the front-center face; retries a few nearby seeds if the flood is tiny.
     */
    function dealOpeningDig() {
      if (!state.tiles.length) return;
      invalidateProjection();
      const cx = state.centerX;
      const cy = state.centerY;
      const ranked = getProjected()
        .filter((p) => p.z > 0.2)
        .slice()
        .sort((a, b) => {
          const da = Math.hypot(a.center.x - cx, a.center.y - cy);
          const db = Math.hypot(b.center.x - cx, b.center.y - cy);
          return da - db;
        });
      const seeds = ranked.length
        ? ranked.slice(0, 8).map((p) => p.index)
        : [0];

      let best = { open: -1, mines: null, revealed: null, counts: null, seed: seeds[0] };

      for (const seed of seeds) {
        // Fresh layout for this seed
        for (let i = 0; i < state.cells.length; i++) {
          const c = state.cells[i];
          c.isMine = false;
          c.revealed = false;
          c.flagged = false;
          c.neighborMines = 0;
        }
        state.isFirstClick = true;
        state.isGameOver = false;
        placeMines(seed);
        // Mark flood as revealed without paint side-effects
        const opened = new Set([seed]);
        state.cells[seed].revealed = true;
        if (state.cells[seed].neighborMines === 0) {
          const q = [seed];
          while (q.length) {
            const cur = q.shift();
            for (const n of state.tiles[cur].neighborIndices) {
              if (opened.has(n)) continue;
              const c = state.cells[n];
              if (c.isMine || c.flagged) continue;
              opened.add(n);
              c.revealed = true;
              if (c.neighborMines === 0) q.push(n);
            }
          }
        }
        if (opened.size > best.open) {
          best = {
            open: opened.size,
            seed,
            mines: state.cells.map((c) => c.isMine),
            revealed: state.cells.map((c) => c.revealed),
            counts: state.cells.map((c) => c.neighborMines),
            mineCount: state.mineCount,
          };
        }
        // Early out if we already have a generous opening
        if (best.open >= 40) break;
      }

      for (let i = 0; i < state.cells.length; i++) {
        const c = state.cells[i];
        c.isMine = !!best.mines[i];
        c.revealed = !!best.revealed[i];
        c.flagged = false;
        c.neighborMines = best.counts[i] | 0;
        c.animReveal = c.revealed ? 1 : 0;
        c.visualDue = 0;
        c.pulseAt = 0;
      }
      state.isFirstClick = false;
      state.isGameOver = false;
      state.won = false;
      state.flagsPlaced = 0;
      state.mineCount = best.mineCount | 0;
      state.timeElapsed = 0;
      state.ambientSpin = false;
      stopTimer();
      updateUI();
    }

    let persistSuspended = false;
    let persistTimer = null;

    function storageGet(store, key) {
      try {
        return store.getItem(key);
      } catch (_) {
        return null;
      }
    }

    function storageSet(store, key, val) {
      try {
        store.setItem(key, val);
        return true;
      } catch (_) {
        return false;
      }
    }

    function storageRemove(store, key) {
      try {
        store.removeItem(key);
      } catch (_) {}
    }

    function exportRunState() {
      // Save any non-pristine board (flags, digs, or finished run).
      if (boardIsFresh()) return null;
      if (!state.cells.length) return null;
      const mines = [];
      const revealed = [];
      const flagged = [];
      for (let i = 0; i < state.cells.length; i++) {
        const c = state.cells[i];
        if (c.isMine) mines.push(i);
        if (c.revealed) revealed.push(i);
        else if (state.isGameOver && !state.won && c.isMine) revealed.push(i);
        if (c.flagged) flagged.push(i);
      }
      // Pre-first-dig with only flags: still persist flags + camera.
      const data = {
        v: 2,
        kind: runKind,
        difficulty: state.difficulty,
        first: !!state.isFirstClick,
        over: !!state.isGameOver,
        won: !!state.won,
        flags: state.flagsPlaced | 0,
        mineCount: state.mineCount | 0,
        time: state.timeElapsed | 0,
        rotY: state.rotY,
        rotX: state.rotX,
        zoom: focusRestore ? focusRestore.zoom : state.zoomFactor,
        mines,
        revealed,
        flagged,
        savedAt: Date.now(),
      };
      if (variant) {
        data.runId = runId;
        data.completionEmitted = !!completionEmitted;
        data.variant = exportVariantState();
      }
      return data;
    }

    /** Explicit clear only — Reset button / size change / invalid save. */
    function clearPersist() {
      if (variant) {
        storageRemove(localStorage, runStorageKey);
        storageRemove(sessionStorage, runStorageKey);
      } else {
        storageRemove(localStorage, RUN_STORAGE_KEY);
        storageRemove(localStorage, RUN_STORAGE_KEY_LEGACY);
        storageRemove(sessionStorage, RUN_STORAGE_KEY);
        storageRemove(sessionStorage, RUN_STORAGE_KEY_LEGACY);
      }
    }

    function writePersistPayload(json) {
      // Dual-write: session for same-tab reload resilience, local for return visits.
      return {
        local: storageSet(localStorage, runStorageKey, json),
        session: storageSet(sessionStorage, runStorageKey, json),
      };
    }

    function flushPersistResult() {
      if (persistSuspended) return { local: false, session: false };
      const data = exportRunState();
      if (!data) {
        // Fresh board: do NOT wipe an existing save here. Only clearPersist()
        // (Reset / size) should drop a stored run. Avoids races wiping progress.
        return { local: false, session: false };
      }
      return writePersistPayload(JSON.stringify(data));
    }

    function flushPersist() {
      const result = flushPersistResult();
      return result.local || result.session;
    }

    function schedulePersist() {
      if (persistSuspended) return;
      clearTimeout(persistTimer);
      persistTimer = setTimeout(() => flushPersist(), 200);
    }

    /** Immediate write after dig/flag/end — reload-safe even if tab dies mid-debounce. */
    function persistNow() {
      if (persistSuspended) return false;
      clearTimeout(persistTimer);
      persistTimer = null;
      return flushPersist();
    }

    function applyRunState(data) {
      if (!data || data.kind !== runKind) return false;
      if (data.v !== 1 && data.v !== 2) return false;
      if (!SIZE_ORDER.includes(data.difficulty)) return false;
      if (!global.Hexasphere || typeof global.Hexasphere.generateHexasphere !== "function") {
        return false;
      }

      const mineList = Array.isArray(data.mines) ? data.mines : [];
      const revealedList = Array.isArray(data.revealed) ? data.revealed : [];
      const flaggedList = Array.isArray(data.flagged) ? data.flagged : [];

      // Started game with no mines recorded = corrupt save (post-first-dig always has mines).
      if (!data.first && mineList.length === 0 && !data.over) {
        return false;
      }

      // Build and validate a candidate board before mutating the active run.
      // Variant import is therefore a preflight: rejection or an exception
      // leaves the current board, timer, banner, and persistence untouched.
      const cfg = CONFIG[data.difficulty];
      const candidateSphere = Hexasphere.generateHexasphere(1, cfg.subdivisions);
      const candidateTiles = candidateSphere.tiles;
      attachEdgeNeighbors(candidateTiles);
      const candidateCells = candidateTiles.map(() => freshCell());
      const n = candidateCells.length;

      for (const idx of mineList) {
        if ((idx | 0) === idx && idx >= 0 && idx < n) {
          candidateCells[idx].isMine = true;
        }
      }
      for (const idx of revealedList) {
        if ((idx | 0) !== idx || idx < 0 || idx >= n) continue;
        const c = candidateCells[idx];
        c.revealed = true;
        c.animReveal = 1;
        c.visualDue = 0;
        c.pulseAt = 0;
      }
      let flags = 0;
      for (const idx of flaggedList) {
        if ((idx | 0) !== idx || idx < 0 || idx >= n) continue;
        const c = candidateCells[idx];
        if (c.revealed) continue;
        c.flagged = true;
        flags++;
      }
      computeCountsFor(candidateTiles, candidateCells);

      const candidateFlags = Number.isFinite(data.flags) ? data.flags | 0 : flags;
      const candidateMineCount = Number.isFinite(data.mineCount)
        ? data.mineCount | 0
        : mineList.length || Math.max(1, Math.round(n * cfg.minePct));
      const candidateRotY = Number.isFinite(data.rotY) ? data.rotY : state.rotY;
      const candidateRotX = Number.isFinite(data.rotX) ? data.rotX : state.rotX;
      const candidateZoom = Number.isFinite(data.zoom)
        ? Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, data.zoom))
        : state.zoomFactor;
      const restoredRunId =
        variant && typeof data.runId === "string" && data.runId
          ? data.runId
          : null;
      const candidateState = Object.assign({}, state, {
        difficulty: data.difficulty,
        sphere: candidateSphere,
        tiles: candidateTiles,
        cells: candidateCells,
        isFirstClick: !!data.first,
        isGameOver: !!data.over,
        won: !!data.won,
        detonatorIdx: -1,
        flagsPlaced: candidateFlags,
        mineCount: candidateMineCount,
        timeElapsed: data.time | 0,
        hovered: -1,
        pressed: -1,
        camShake: 0,
        ambientSpin: !!data.first && !state.reduceMotion && flags === 0,
        rotY: candidateRotY,
        rotX: candidateRotX,
        targetRotY: candidateRotY,
        targetRotX: candidateRotX,
        zoomFactor: candidateZoom,
        scale: state.baseScale * candidateZoom,
      });
      if (
        variant &&
        callVariant(
          "importState",
          {
            saved: data.variant,
            state: candidateState,
            cells: candidateCells,
            tiles: candidateTiles,
            runId: restoredRunId,
            endRun: () => false,
            persist: () => false,
            requestDraw: () => {},
            projectFace: () => null,
          },
          false
        ) === false
      ) {
        return false;
      }

      persistSuspended = true;
      stopTimer();
      clearEndFx();
      hideBanner();

      state.difficulty = candidateState.difficulty;
      state.sphere = candidateSphere;
      state.tiles = candidateTiles;
      state.cells = candidateCells;
      state.isFirstClick = candidateState.isFirstClick;
      state.isGameOver = candidateState.isGameOver;
      state.won = candidateState.won;
      state.detonatorIdx = candidateState.detonatorIdx;
      state.flagsPlaced = candidateFlags;
      state.mineCount = candidateMineCount;
      state.timeElapsed = candidateState.timeElapsed;
      state.hovered = candidateState.hovered;
      state.pressed = candidateState.pressed;
      state.camShake = candidateState.camShake;
      state.ambientSpin = candidateState.ambientSpin;
      state.rotY = candidateRotY;
      state.rotX = candidateRotX;
      state.targetRotY = candidateRotY;
      state.targetRotX = candidateRotX;
      state.zoomFactor = candidateZoom;
      state.scale = candidateState.scale;
      runId = variant ? restoredRunId || createRunId() : null;
      completionEmitted = variant && !!data.completionEmitted;
      if (variant) lastVariantState = data.variant === undefined ? null : data.variant;
      undoSnapshot = null;

      syncSizeChrome();
      try {
        localStorage.setItem(SIZE_STORAGE_KEY, data.difficulty);
      } catch (_) {}
      invalidateProjection();
      ensureGlobeForTheme(state.theme);
      bakeGlobeTileColors();
      updateUI();

      if (!state.isFirstClick && !state.isGameOver) {
        startTimer(state.timeElapsed);
      }
      if (state.isGameOver) {
        showTerminalBanner(state.won);
      }

      persistSuspended = false;
      // Re-write under v2 key so legacy saves migrate.
      flushPersistResult();
      return true;
    }

    function readStoredRuns() {
      const keys = variant
        ? [runStorageKey]
        : [RUN_STORAGE_KEY, RUN_STORAGE_KEY_LEGACY];
      const stores = [sessionStorage, localStorage];
      const candidates = [];
      let order = 0;
      for (const store of stores) {
        for (const key of keys) {
          const raw = storageGet(store, key);
          if (!raw) continue;
          try {
            const data = JSON.parse(raw);
            if (!data || data.kind !== runKind) continue;
            const at = Number(data.savedAt) || 0;
            candidates.push({ data, at, order: order++ });
          } catch (_) {
            /* skip bad payload */
          }
        }
      }
      candidates.sort((a, b) => b.at - a.at || b.order - a.order);
      return candidates.map((candidate) => candidate.data);
    }

    function tryRestoreRun() {
      // ?fresh=1 forces a clean board (dev / explicit wipe) without touching themes.
      try {
        if (/(?:\?|&)fresh=1(?:&|$)/.test(location.search)) {
          clearPersist();
          return false;
        }
      } catch (_) {}

      const candidates = readStoredRuns();
      if (!candidates.length) return false;
      for (const data of candidates) {
        if (!applyRunState(data)) continue;
        if (typeof showCountStyleToast === "function") {
          const cleared = Array.isArray(data.revealed) ? data.revealed.length : 0;
          showCountStyleToast(
            data.over
              ? data.won
                ? "Restored · cleared"
                : "Restored · ended"
              : cleared > 0
                ? `Restored · ${cleared} open`
                : "Restored"
          );
        }
        return true;
      }
      // Every parseable candidate was corrupt for this build. Explicitly
      // clear the lane only after exhausting older copies.
      clearPersist();
      return false;
    }

    function clearEndFx() {
      END_FX.active = false;
      END_FX.won = false;
      END_FX.t0 = 0;
      END_FX.detonator = -1;
      END_FX.particles.length = 0;
      END_FX.rings.length = 0;
      END_FX.mineDue = null;
      state.camShake = 0;
    }

    function graphDistancesFrom(startIdx) {
      const dist = new Map([[startIdx, 0]]);
      const queue = [startIdx];
      while (queue.length) {
        const idx = queue.shift();
        const d = dist.get(idx);
        for (const n of state.tiles[idx].neighborIndices) {
          if (dist.has(n)) continue;
          dist.set(n, d + 1);
          queue.push(n);
        }
      }
      return dist;
    }

    function spawnBurstParticles(sx, sy, count, palette) {
      const calm = state.reduceMotion;
      const n = calm ? Math.min(8, count) : count;
      for (let i = 0; i < n; i++) {
        if (END_FX.particles.length >= END_PARTICLE_CAP) break;
        const a = Math.random() * Math.PI * 2;
        const sp = calm ? 0.6 + Math.random() * 1.2 : 1.5 + Math.random() * 4.5;
        END_FX.particles.push({
          x: sx,
          y: sy,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - (calm ? 0.2 : 0.8),
          life: 1,
          decay: calm ? 0.04 : 0.012 + Math.random() * 0.018,
          r: calm ? 1.2 : 1.5 + Math.random() * 3.2,
          color: palette[i % palette.length],
        });
      }
    }

    function startLoseFx(detonatorIdx) {
      const now = performance.now();
      END_FX.active = true;
      END_FX.won = false;
      END_FX.t0 = now;
      END_FX.detonator = detonatorIdx;
      END_FX.particles.length = 0;
      END_FX.rings.length = 0;
      state.camShake = state.reduceMotion ? 0 : 14;
      emitMaterialAction("detonate", detonatorIdx, { strength: 1 });

      const distMap = graphDistancesFrom(detonatorIdx);
      END_FX.mineDue = new Map();

      for (let i = 0; i < state.cells.length; i++) {
        const c = state.cells[i];
        if (!c.isMine) continue;
        if (i === detonatorIdx) {
          c.revealed = true;
          c.animReveal = 1;
          c.visualDue = 0;
          c.endFlash = 1;
          c.endPop = 1.08;
          continue;
        }
        if (state.reduceMotion) {
          c.revealed = true;
          c.animReveal = 1;
          c.visualDue = 0;
          continue;
        }
        c.revealed = false;
        c.animReveal = 0;
        const d = distMap.get(i);
        const delay =
          d != null
            ? Math.min(d * END_MINE_STEP_MS, END_MINE_CAP_MS)
            : END_MINE_CAP_MS;
        END_FX.mineDue.set(i, now + delay);
      }

      if (!state.reduceMotion) {
        const proj = projectTile(state.tiles[detonatorIdx], state.rotY, state.rotX);
        const palette = [
          state.theme.mineBurst,
          state.theme.mine,
          state.theme.mineEdge,
          "#fef3c7",
        ];
        spawnBurstParticles(proj.center.x, proj.center.y, 48, palette);
        END_FX.rings.push({
          x: proj.center.x,
          y: proj.center.y,
          r: 0,
          life: 1,
          speed: Math.max(2.8, state.scale * 0.018),
        });
      } else {
        for (let i = 0; i < state.cells.length; i++) {
          const c = state.cells[i];
          if (c.isMine) {
            c.revealed = true;
            c.animReveal = 1;
          }
        }
        END_FX.mineDue = null;
      }
      scheduleFrame();
    }

    function startWinFx() {
      const now = performance.now();
      END_FX.active = true;
      END_FX.won = true;
      END_FX.t0 = now;
      END_FX.detonator = -1;
      END_FX.particles.length = 0;
      END_FX.mineDue = null;
      END_FX.rings.length = 0;

      const distMap = graphDistancesFrom(0);
      for (let i = 0; i < state.cells.length; i++) {
        const c = state.cells[i];
        if (!c.revealed || c.isMine) continue;
        const d = distMap.get(i) || 0;
        c.endFlash = state.reduceMotion ? 0.85 : 1;
        c.endPop = state.reduceMotion ? 1 : 1.06;
        c.pulseAt = now + (state.reduceMotion ? 0 : Math.min(d * 22, 900));
      }

      if (!state.reduceMotion) {
        spawnBurstParticles(state.centerX, state.centerY, 36, [
          state.theme.revealGlow,
          state.theme.revealFlash,
          state.theme.hoverRing,
          "#fef08a",
        ]);
        END_FX.rings.push({
          x: state.centerX,
          y: state.centerY,
          r: 0,
          life: 1,
          speed: Math.max(2.2, state.scale * 0.014),
        });
      }
      scheduleFrame();
    }

    function tickEndFx(now) {
      if (!END_FX.active) return false;
      let busy = false;
      const elapsed = now - END_FX.t0;

      if (state.camShake > 0.2 && !state.reduceMotion) {
        state.camShake *= END_SHAKE_DECAY;
        busy = true;
      } else {
        state.camShake = 0;
      }

      if (END_FX.mineDue && END_FX.mineDue.size) {
        for (const [idx, due] of END_FX.mineDue) {
          if (now >= due) {
            const c = state.cells[idx];
            c.revealed = true;
            c.animReveal = 0;
            c.visualDue = now;
            c.pulseAt = now;
            c.endFlash = 1;
            c.endPop = 1.05;
            END_FX.mineDue.delete(idx);
            if (!state.reduceMotion && END_FX.particles.length < END_PARTICLE_CAP - 6) {
              const proj = projectTile(state.tiles[idx], state.rotY, state.rotX);
              if (proj.z > 0) {
                spawnBurstParticles(proj.center.x, proj.center.y, 6, [
                  state.theme.mineBurst,
                  state.theme.mine,
                ]);
              }
            }
          } else {
            busy = true;
          }
        }
        if (END_FX.mineDue.size === 0) END_FX.mineDue = null;
      }

      for (let i = END_FX.particles.length - 1; i >= 0; i--) {
        const p = END_FX.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.vx *= 0.985;
        p.life -= p.decay;
        if (p.life <= 0) END_FX.particles.splice(i, 1);
        else busy = true;
      }

      for (const ring of END_FX.rings) {
        ring.r += ring.speed;
        ring.life -= state.reduceMotion ? 0.04 : 0.016;
        if (ring.life > 0) busy = true;
      }
      END_FX.rings = END_FX.rings.filter((r) => r.life > 0);

      for (let i = 0; i < state.cells.length; i++) {
        const c = state.cells[i];
        if (c.endFlash > 0.01) {
          c.endFlash *= state.reduceMotion ? 0.82 : 0.94;
          busy = true;
        } else {
          c.endFlash = 0;
        }
        if (c.endPop > 1.001) {
          c.endPop += (1 - c.endPop) * 0.12;
          if (Math.abs(c.endPop - 1) < 0.004) c.endPop = 1;
          else busy = true;
        }
      }

      const duration = END_FX.won ? 1600 : 2400;
      if (!busy && elapsed > duration) clearEndFx();
      else if (busy || elapsed < duration) busy = true;
      return busy;
    }

    function drawEndFxOverlay(now) {
      if (!END_FX.active) return;
      const T = state.theme;
      for (const ring of END_FX.rings) {
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        ctx.strokeStyle = END_FX.won
          ? colorMix(T.revealGlow, T.hoverRing, 1 - ring.life)
          : colorMix(T.mineBurst, T.mine, 1 - ring.life);
        ctx.globalAlpha = ring.life * 0.55;
        ctx.lineWidth = END_FX.won ? 2.4 : 3.2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      for (const p of END_FX.particles) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    function scheduleRevealVisual(idx, dist) {
      const cell = state.cells[idx];
      const now = performance.now();
      const delay = state.reduceMotion
        ? 0
        : Math.min(dist * REVEAL_STEP_MS, REVEAL_CAP_MS);
      cell.visualDue = now + delay;
      cell.pulseAt = cell.visualDue;
      cell.animReveal = state.reduceMotion ? 1 : 0;
    }

    /**
     * Flood zeros with logic immediate (revealed=true) and paint staggered by
     * graph distance — mirrors flat core.js BFS wave, capped ~880ms.
     */
    function floodFrom(startIdx, optsFlood) {
      optsFlood = optsFlood || {};
      const opened = new Set();
      const queue = [{ idx: startIdx, dist: 0 }];
      const visited = new Set([startIdx]);
      while (queue.length) {
        const { idx, dist } = queue.shift();
        for (const n of state.tiles[idx].neighborIndices) {
          if (visited.has(n)) continue;
          visited.add(n);
          const c = state.cells[n];
          if (c.revealed || c.flagged || c.isMine) continue;
          if (!variantAdmitsReveal(n, "flood")) continue;
          c.revealed = true;
          scheduleRevealVisual(n, dist + 1);
          opened.add(n);
          if (c.neighborMines === 0) queue.push({ idx: n, dist: dist + 1 });
        }
      }
      if (variant && optsFlood.notify !== false && opened.size) {
        notifyVariantReveal({
          index: startIdx,
          source: "flood",
          revealed: Array.from(opened),
        }, false);
      }
      return opened;
    }

    /**
     * Reveal variant-requested safe faces inside the current direct-dig undo.
     * The window guard keeps import/reset/tick/draw hooks from mutating a board,
     * and notify:false prevents an echo from recursively creating another echo.
     */
    function revealSafeFaces(indices) {
      if (!variant || variantRevealMutationDepth < 1 || !Array.isArray(indices)) {
        return [];
      }
      const opened = new Set();
      for (const index of indices) {
        if (!Number.isInteger(index) || index < 0 || index >= state.cells.length) continue;
        const cell = state.cells[index];
        if (!cell || cell.revealed || cell.flagged || cell.isMine) continue;
        if (!variantAdmitsReveal(index, "linked")) continue;
        cell.revealed = true;
        scheduleRevealVisual(index, 0);
        opened.add(index);
        if (cell.neighborMines === 0) {
          for (const flooded of floodFrom(index, { notify: false })) opened.add(flooded);
        }
      }
      return Array.from(opened);
    }

    /**
     * Resolve variant-linked faces inside the current direct-dig undo. Unlike
     * revealSafeFaces, this path preserves mine semantics: an unflagged linked
     * mine is revealed and ends the run through the engine-owned terminal path.
     */
    function resolveLinkedFaces(indices) {
      if (!variant || variantRevealMutationDepth < 1 || !Array.isArray(indices)) {
        return { opened: [], detonated: -1 };
      }
      const opened = new Set();
      let detonated = -1;
      for (const index of indices) {
        if (!Number.isInteger(index) || index < 0 || index >= state.cells.length) continue;
        const cell = state.cells[index];
        if (!cell || cell.revealed || cell.flagged) continue;
        if (!variantAdmitsReveal(index, "linked")) continue;
        cell.revealed = true;
        scheduleRevealVisual(index, 0);
        opened.add(index);
        if (cell.isMine) {
          cell.animReveal = 1;
          state.detonatorIdx = index;
          detonated = index;
          break;
        }
        if (cell.neighborMines === 0) {
          for (const flooded of floodFrom(index, { notify: false })) opened.add(flooded);
        }
      }
      if (detonated >= 0) gameOver(false);
      return { opened: Array.from(opened), detonated };
    }

    function reveal(idx) {
      const cell = state.cells[idx];
      if (!cell || cell.revealed || cell.flagged || state.isGameOver) return false;
      if (!variantAdmitsReveal(idx, "direct")) return false;
      const isFirstResolvedDig = state.isFirstClick;
      if (isFirstResolvedDig) {
        placeMines(idx);
        state.isFirstClick = false;
        startTimer();
      }
      captureUndo();
      cell.revealed = true;
      scheduleRevealVisual(idx, 0);
      if (cell.isMine) {
        cell.animReveal = 1;
        state.detonatorIdx = idx;
        notifyVariantReveal({
          index: idx,
          source: "direct",
          revealed: [idx],
        }, true);
        gameOver(false);
        return true;
      }
      const opened =
        cell.neighborMines === 0 ? floodFrom(idx, { notify: false }) : new Set();
      const revealed = [idx, ...opened];
      notifyVariantReveal({ index: idx, source: "direct", revealed }, true);
      emitMaterialAction("dig", idx, {
        strength: Math.min(1.35, 0.72 + revealed.length / 18),
        opened: revealed.length,
      });
      if (isFirstResolvedDig) {
        const result = callVariant(
          "firstResolvedDig",
          { index: idx, revealed },
          VARIANT_HOOK_FAILED
        );
        if (result === VARIANT_HOOK_FAILED) {
          resetGame();
          scheduleFrame();
          return false;
        }
        if (variant && undoSnapshot) {
          undoSnapshot.variant = callVariant("captureUndo");
        }
      }
      if (!state.isGameOver) checkWin();
      persistNow();
      return true;
    }

    function tickRevealAnim(now) {
      let busy = false;
      for (let i = 0; i < state.cells.length; i++) {
        const c = state.cells[i];
        if (!c.revealed) continue;
        if (now < c.visualDue) {
          busy = true;
          continue;
        }
        if (c.animReveal < 0.995) {
          c.animReveal += (1 - c.animReveal) * REVEAL_LERP;
          busy = true;
        } else {
          c.animReveal = 1;
        }
      }
      return busy;
    }

    function revealAnimBusy(now) {
      for (let i = 0; i < state.cells.length; i++) {
        const c = state.cells[i];
        if (!c.revealed) continue;
        if (now < c.visualDue || c.animReveal < 0.995) return true;
        if (now - c.pulseAt < REVEAL_FLASH_MS) return true;
      }
      return false;
    }

    function toggleFlag(idx) {
      const cell = state.cells[idx];
      if (!cell || cell.revealed || state.isGameOver) return false;
      const flagged = !cell.flagged;
      if (!variantAdmitsFlag(idx, flagged)) return false;
      cell.flagged = flagged;
      state.flagsPlaced += cell.flagged ? 1 : -1;
      updateUI();
      emitMaterialAction(cell.flagged ? "flag" : "unflag", idx, { strength: 1 });
      callVariant("flag", { index: idx, flagged: cell.flagged });
      persistNow();
      return true;
    }

    function checkWin() {
      let safeTotal = 0;
      let safeRevealed = 0;
      for (let i = 0; i < state.cells.length; i++) {
        if (!state.cells[i].isMine) {
          safeTotal++;
          if (state.cells[i].revealed) safeRevealed++;
        }
      }
      if (
        variant &&
        callVariant(
          "useDefaultWin",
          {
            safeFacesRevealed: safeRevealed,
            safeFaceCount: safeTotal,
          },
          false
        ) === false
      ) {
        return;
      }
      if (safeRevealed === safeTotal) gameOver(true);
    }

    function gameOver(won) {
      if (state.isGameOver) return false;
      state.isGameOver = true;
      state.won = won;
      stopTimer();
      callVariant("terminal", { won, outcome: won ? "win" : "loss" });
      if (!won) {
        startLoseFx(state.detonatorIdx >= 0 ? state.detonatorIdx : 0);
      } else {
        startWinFx();
      }
      showTerminalBanner(won);
      emitMaterialAction("finish", -1, { won: !!won });
      emitRunCompletion(won);
      persistNow();
      return true;
    }

    function terminalCopy(won) {
      const defaults = won
        ? {
            message: "Cleared the sphere!",
            share: true,
            meta: `${formatTime(state.timeElapsed)} · ${state.mineCount} mines · ${SIZE_LABEL[state.difficulty] || "M"}`,
          }
        : { message: "Mine detonated.", share: false };
      const custom = callVariant("terminalCopy", {
        won,
        outcome: won ? "win" : "loss",
        defaultCopy: Object.assign({}, defaults),
      });
      return custom && typeof custom === "object"
        ? Object.assign({}, defaults, custom)
        : defaults;
    }

    function showTerminalBanner(won) {
      const copy = terminalCopy(won);
      showBanner(copy.message, copy);
    }

    function emitRunCompletion(won) {
      if (
        !variant ||
        completionEmitted ||
        typeof opts.onRunComplete !== "function"
      ) {
        return false;
      }
      let safeFacesRevealed = 0;
      for (const cell of state.cells) {
        if (!cell.isMine && cell.revealed) safeFacesRevealed++;
      }
      const payload = buildRunCompletionPayload({
        runId,
        variant: variantId,
        outcome: won ? "win" : "loss",
        elapsedSeconds: state.timeElapsed | 0,
        safeFacesRevealed,
        mineCount: state.mineCount | 0,
        difficulty: state.difficulty,
        completedAt: new Date().toISOString(),
      });
      completionEmitted = true;
      try {
        opts.onRunComplete(payload);
      } catch (_) {}
      return true;
    }

    function showBanner(msg, opts) {
      opts = opts || {};
      const el = bannerEl || document.getElementById("sphere-banner");
      if (!el) return;
      if (bannerMsg) bannerMsg.textContent = msg;
      else el.textContent = msg;
      if (bannerMeta) {
        if (opts.meta) {
          bannerMeta.hidden = false;
          bannerMeta.textContent = opts.meta;
        } else {
          bannerMeta.hidden = true;
          bannerMeta.textContent = "";
        }
      }
      if (bannerActions) {
        bannerActions.hidden = false;
      }
      if (shareWinBtn) {
        shareWinBtn.hidden = false;
        shareWinBtn.disabled = false;
        setShareState("idle");
      }
      if (bannerUndoBtn) bannerUndoBtn.hidden = !undoSnapshot;
      pendingShareFile = null;
      prepareShareFile();
      el.hidden = false;
      el.classList.add("visible");
    }

    function hideBanner() {
      const el = bannerEl || document.getElementById("sphere-banner");
      if (!el) return;
      el.classList.remove("visible");
      if (bannerActions) bannerActions.hidden = true;
      setTimeout(() => {
        if (!el.classList.contains("visible")) el.hidden = true;
      }, 200);
    }

    /**
     * Square share card: current sphere view + time + mine count.
     * Web Share with file when available; otherwise download PNG.
     */
    function buildShareCard() {
      const side = 1080;
      const out = document.createElement("canvas");
      out.width = side;
      out.height = side;
      const octx = out.getContext("2d");
      const T = state.theme;
      const dark = T.id === "dark" || T.pureCovered;
      const bg = T.bg || (dark ? "#000000" : "#ffffff");
      /*
       * Contrast against the colour actually painted, not the theme's notion
       * of "dark". `dark` is true for any pureCovered theme, several of which
       * paint a white bg — that rendered the headline white on white and made
       * it vanish, while the grey meta lines survived and hid the problem.
       */
      const [br, bgc, bb] = parseCssColor(bg);
      const bgLight = (0.2126 * br + 0.7152 * bgc + 0.0722 * bb) / 255 > 0.55;
      const ink = bgLight ? "#000000" : "#ffffff";
      const muted = bgLight ? "#666666" : "#999999";

      octx.fillStyle = bg;
      octx.fillRect(0, 0, side, side);

      /*
       * Crop to the sphere, not the viewport. Fitting the whole canvas into a
       * square meant a tall phone screen contributed mostly empty space and
       * the sphere landed tiny in the middle of the card.
       *
       * state.centerX/centerY/scale are CSS pixels; canvas.width/height are
       * device pixels, so everything is converted through dpr before it can
       * index into the bitmap. centerX is w/2, which recovers dpr without
       * reading devicePixelRatio again — the canvas may have been sized under
       * a different one.
       */
      // Leaves ~190px under the sphere for the caption block.
      const margin = 110;
      const box = side - margin * 2;
      const sw = canvas.width;
      const sh = canvas.height;
      if (sw > 0 && sh > 0) {
        const dpr = state.centerX > 0 ? sw / (state.centerX * 2) : 1;
        const half = Math.max(1, state.scale * dpr * 1.16);
        let cropW = Math.min(sw, half * 2);
        let cropH = Math.min(sh, half * 2);
        const span = Math.min(cropW, cropH);
        cropW = cropH = span;
        let sx = state.centerX * dpr - span / 2;
        let sy = state.centerY * dpr - span / 2;
        sx = Math.max(0, Math.min(sw - span, sx));
        sy = Math.max(0, Math.min(sh - span, sy));
        // Reflection themes paint the sphere body on a WebGL canvas beneath
        // the game canvas; composite it first so share cards are not hollow.
        const reflectionCanvas = document.getElementById("reflectionCanvas");
        if (
          state.theme.reflectionSurface &&
          reflectionCanvas &&
          reflectionCanvas.width > 0 &&
          reflectionCanvas.height > 0
        ) {
          const rx = reflectionCanvas.width / Math.max(1, canvas.width);
          const ry = reflectionCanvas.height / Math.max(1, canvas.height);
          octx.drawImage(
            reflectionCanvas,
            sx * rx,
            sy * ry,
            span * rx,
            span * ry,
            (side - box) / 2,
            26,
            box,
            box
          );
        }
        octx.drawImage(canvas, sx, sy, span, span, (side - box) / 2, 26, box, box);
      }

      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.fillStyle = ink;
      // Sized for a 1080 card seen as a thumbnail in a feed, where the old
      // 42/28/22 stack was unreadable.
      octx.font = '700 66px "IBM Plex Sans", system-ui, sans-serif';
      octx.fillText(shareLabels().headline, side / 2, side - 142);

      octx.fillStyle = muted;
      octx.font = '500 44px "IBM Plex Sans", system-ui, sans-serif';
      const line = `${formatTime(state.timeElapsed)}  ·  ${state.mineCount} mines  ·  ${SIZE_LABEL[state.difficulty] || "M"}`;
      octx.fillText(line, side / 2, side - 80);

      octx.font = '400 32px "IBM Plex Sans", system-ui, sans-serif';
      octx.fillStyle = colorMix(muted, bg, 0.15);
      octx.fillText("dr.eamer.dev/games/hexsweeper/sphere/", side / 2, side - 32);

      return out;
    }

    function shareCardBlob(canvasEl) {
      return new Promise((resolve, reject) => {
        canvasEl.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
          "image/png"
        );
      });
    }

    /*
     * The banner buttons are icon-only, so assigning textContent would delete
     * the SVG inside them. Share progress therefore lives on the accessible
     * label and a data-state attribute, which also keeps the state announced
     * to screen readers rather than conveyed by colour alone.
     */
    const SHARE_LABEL = {
      idle: "Share",
      busy: "Preparing…",
      error: "Couldn't share",
    };
    function setShareState(kind) {
      if (!shareWinBtn) return;
      const label = SHARE_LABEL[kind] || SHARE_LABEL.idle;
      shareWinBtn.dataset.state = kind;
      shareWinBtn.title = label;
      shareWinBtn.setAttribute("aria-label", label);
      const sr = shareWinBtn.querySelector(".banner-btn-label, .sr-only");
      if (sr) sr.textContent = label;
    }

    /** Card headline, share text and filename, all from one outcome check. */
    function shareLabels() {
      const time = formatTime(state.timeElapsed);
      const mines = `${state.mineCount} mines`;
      const size = SIZE_LABEL[state.difficulty] || "M";
      return state.won
        ? {
            headline: "Hex Sphere · Cleared",
            text: `Cleared Hex Sphere in ${time} · ${mines} · ${size}`,
            file: "hex-sphere-cleared.png",
          }
        : {
            headline: "Hex Sphere",
            text: `Hex Sphere · ${time} · ${mines} · ${size}`,
            file: "hex-sphere-run.png",
          };
    }

    /** Build the share File while the banner animates in, before any tap. */
    async function prepareShareFile() {
      try {
        draw();
        const blob = await shareCardBlob(buildShareCard());
        pendingShareFile = new File([blob], shareLabels().file, {
          type: "image/png",
        });
      } catch (_) {
        pendingShareFile = null;
      }
    }

    async function shareWinImage() {
      if (shareBusy) return;
      shareBusy = true;
      if (shareWinBtn) {
        shareWinBtn.disabled = true;
        setShareState("busy");
      }
      try {
        // Prepared at banner time so no await sits between the tap and
        // navigator.share(). Only rebuild if preparation failed.
        let file = pendingShareFile;
        if (!file) {
          draw();
          file = new File([await shareCardBlob(buildShareCard())], shareLabels().file, {
            type: "image/png",
          });
        }
        const blob = file;
        // Native shell: hand the PNG over as an image (UIImage activity item)
        // so the iOS sheet offers Messages, Instagram, Bluesky and friends.
        // Web Share with a File shows a document sheet there instead.
        const native =
          typeof window !== "undefined" &&
          window.Capacitor &&
          window.Capacitor.Plugins &&
          window.Capacitor.Plugins.HexShare;
        if (native && typeof native.shareImage === "function") {
          try {
            const base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(blob);
            });
            await native.shareImage({ base64, filename: file.name });
            return;
          } catch (err) {
            if (err && /cancel|abort/i.test(String(err.message || err))) return;
            // fall through to Web Share / download
          }
        }
        let canFileShare = false;
        try {
          canFileShare =
            typeof navigator !== "undefined" &&
            typeof navigator.share === "function" &&
            (!navigator.canShare || navigator.canShare({ files: [file] }));
        } catch (_) {
          canFileShare = false;
        }
        if (canFileShare) {
          try {
            /*
             * File only, no title or text. Bluesky's share target takes one or
             * the other: given both it posted the text and dropped the image,
             * producing an empty post. The card already carries the time, mine
             * count, board size and the URL, so nothing is lost by letting the
             * image be the whole payload.
             */
            await navigator.share({ files: [file] });
          } catch (err) {
            if (err && err.name === "AbortError") return;
            downloadBlob(blob, file.name);
          }
        } else {
          downloadBlob(blob, file.name);
        }
      } catch (_) {
        setShareState("error");
        setTimeout(() => setShareState("idle"), 1600);
      } finally {
        shareBusy = false;
        if (shareWinBtn) {
          shareWinBtn.disabled = false;
          if (shareWinBtn.dataset.state === "busy") setShareState("idle");
        }
      }
    }

    function downloadBlob(blob, name) {
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = name || "hex-sphere.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 2000);
    }

    function parseCssColor(c) {
      if (typeof c !== "string") return [0, 0, 0];
      const s = c.trim();
      if (s.charAt(0) === "#") {
        let h = s.slice(1);
        if (h.length === 3) {
          h = h
            .split("")
            .map((ch) => ch + ch)
            .join("");
        }
        const n = parseInt(h, 16);
        if (!Number.isFinite(n)) return [0, 0, 0];
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
      const m = s.match(
        /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i
      );
      if (m) return [m[1] | 0, m[2] | 0, m[3] | 0];
      return [0, 0, 0];
    }

    function colorMix(c1, c2, t) {
      const a = parseCssColor(c1);
      const b = parseCssColor(c2);
      const u = Math.max(0, Math.min(1, t));
      const r = Math.round(a[0] + (b[0] - a[0]) * u);
      const g = Math.round(a[1] + (b[1] - a[1]) * u);
      const bl = Math.round(a[2] + (b[2] - a[2]) * u);
      return `rgb(${r},${g},${bl})`;
    }

    function shadeByNormal(base, normalZ, amt) {
      const t = Math.max(0, Math.min(1, (normalZ + 0.15) * 0.55));
      return colorMix(base, "#ffffff", t * (amt != null ? amt : 0.35));
    }

    function drawHexPath(proj) {
      const pts = proj.boundary;
      if (pts.length < 3) return false;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      return true;
    }

    function drawHex(proj, fill, stroke, lineWidth) {
      if (!drawHexPath(proj)) return;
      ctx.fillStyle = fill;
      ctx.fill();
      if (lineWidth != null && lineWidth <= 0) return;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth != null ? lineWidth : 1.4;
      ctx.stroke();
    }

    function sampleGlobePointRgb(point) {
      const mapId = state.theme && state.theme.globeMap;
      if (
        !mapId ||
        !point ||
        !global.Hexasphere ||
        typeof global.Hexasphere.cartesianToSpherical !== "function"
      ) return null;
      const spherical = global.Hexasphere.cartesianToSpherical(point);
      return spherical
        ? sampleGlobeRgb(mapId, spherical.lat, spherical.lon)
        : null;
    }

    function averageRgb(a, b) {
      if (!a) return b;
      if (!b) return a;
      return [
        Math.round((a[0] + b[0]) * 0.5),
        Math.round((a[1] + b[1]) * 0.5),
        Math.round((a[2] + b[2]) * 0.5),
      ];
    }

    function globeTileSamples(tile) {
      const mapId = state.theme && state.theme.globeMap;
      if (!mapId || !tile) return null;
      if (tile._globeDetail && tile._globeDetail.mapId === mapId) {
        return tile._globeDetail;
      }
      const detail = {
        mapId,
        center: sampleGlobePointRgb(tile.centerPoint),
        edges: tile.boundary.map(sampleGlobePointRgb),
      };
      if (!detail.center) return null;
      tile._globeDetail = detail;
      return detail;
    }

    function globeDisplayRgb(rgb, normalZ, isFront) {
      if (!rgb) return null;
      const limb = Math.max(0, Math.min(1, 1 - normalZ));
      let out = shadeRgb(rgb, -limb * 0.44);
      if (isFront) out = shadeRgb(out, 0.035);
      return out;
    }

    /**
     * Earth uses the 4K map as a continuous-looking faceted skin: each face is
     * a fan of locally sampled gradients rather than one center-pixel swatch.
     * Shared screen-space specular and Fresnel layers give the ocean real
     * gloss while keeping revealed wells untouched.
     */
    function drawGlossedGlobeHex(proj, tile, colors, isFront, hoverBoost) {
      const T = state.theme;
      if (!T || !T.globeGloss || !tile || !proj.boundary?.length) return false;
      const samples = globeTileSamples(tile);
      if (!samples) return false;
      const centerRgb = samples.center;
      const centerColor = globeDisplayRgb(centerRgb, proj.normalZ, isFront);
      const edgeRgb = samples.edges;
      const n = Math.min(proj.boundary.length, edgeRgb.length);
      if (n < 3) return false;

      ctx.save();
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const a = proj.boundary[i];
        const b = proj.boundary[j];
        const mx = (a.x + b.x) * 0.5;
        const my = (a.y + b.y) * 0.5;
        const edgeColor = globeDisplayRgb(
          averageRgb(edgeRgb[i], edgeRgb[j]),
          proj.normalZ,
          isFront
        );
        const gradient = ctx.createLinearGradient(
          proj.center.x,
          proj.center.y,
          mx,
          my
        );
        gradient.addColorStop(0, rgbCss(centerColor));
        gradient.addColorStop(0.58, rgbCss(averageRgb(centerColor, edgeColor)));
        gradient.addColorStop(1, rgbCss(edgeColor));
        ctx.beginPath();
        ctx.moveTo(proj.center.x, proj.center.y);
        ctx.lineTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }

      drawHexPath(proj);
      ctx.clip();
      const ocean = centerRgb[2] > centerRgb[0] * 1.18 &&
        centerRgb[2] > centerRgb[1] * 1.06;
      const hx = state.centerX - state.scale * 0.34;
      const hy = state.centerY - state.scale * 0.38;
      const sheen = ctx.createRadialGradient(
        hx,
        hy,
        state.scale * 0.015,
        hx,
        hy,
        state.scale * 0.68
      );
      sheen.addColorStop(0, ocean ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.25)");
      sheen.addColorStop(0.24, ocean ? "rgba(197,235,255,0.20)" : "rgba(255,244,217,0.10)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(
        state.centerX - state.scale * 1.15,
        state.centerY - state.scale * 1.15,
        state.scale * 2.3,
        state.scale * 2.3
      );

      const rim = ctx.createRadialGradient(
        state.centerX,
        state.centerY,
        state.scale * 0.63,
        state.centerX,
        state.centerY,
        state.scale * 1.04
      );
      rim.addColorStop(0, "rgba(96,188,240,0)");
      rim.addColorStop(0.72, "rgba(96,188,240,0.035)");
      rim.addColorStop(1, "rgba(207,240,255,0.23)");
      ctx.fillStyle = rim;
      ctx.fillRect(
        state.centerX - state.scale * 1.1,
        state.centerY - state.scale * 1.1,
        state.scale * 2.2,
        state.scale * 2.2
      );
      if (hoverBoost) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.18, hoverBoost)})`;
        ctx.fillRect(
          proj.center.x - state.scale * 0.16,
          proj.center.y - state.scale * 0.16,
          state.scale * 0.32,
          state.scale * 0.32
        );
      }
      ctx.restore();

      drawHexPath(proj);
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = colors.lineWidth;
      ctx.stroke();
      return true;
    }

    /**
     * Reflection themes: dug faces reveal a continuous material beneath the
     * mirrored crust. The field is drawn in screen coordinates, then clipped
     * per cleared face, so neighboring digs join without restarting the
     * texture at every hex. Only the "metal" profile ships (Mercury); the
     * reflection studio (sphere-reflection/) carries the others.
     */
    function revealedCoreProfile(cell) {
      if (!cell || !cell.revealed || cell.flagged || cell.isMine) return null;
      const T = state.theme;
      if (!T || !T.reflectionSurface) return null;
      return T.interior || null;
    }
    /** Fixed spherical coordinates of a face — turn with the shell. */
    function faceLatLon(tile) {
      const c = tile.centerPoint;
      const len = Math.hypot(c.x, c.y, c.z) || 1;
      return { lat: Math.asin(c.y / len), lon: Math.atan2(c.x / len, c.z / len) };
    }
    function faceDepth(proj) {
      // 0 at the rim → 1 at the sphere's centre, in screen terms.
      const d = Math.hypot(proj.center.x - state.centerX, proj.center.y - state.centerY);
      return Math.max(0, Math.min(1, 1 - d / Math.max(1, state.scale * 1.15)));
    }
    function mixHex(a, b, k) {
      const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
      const r = Math.round(((pa >> 16) & 255) * (1 - k) + ((pb >> 16) & 255) * k);
      const g = Math.round(((pa >> 8) & 255) * (1 - k) + ((pb >> 8) & 255) * k);
      const bl = Math.round((pa & 255) * (1 - k) + (pb & 255) * k);
      return `rgb(${r},${g},${bl})`;
    }
    function fillFace(proj, fill) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      proj.boundary.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
      ctx.closePath();
      ctx.fill();
    }
    // Deterministic per-face hash for procedural cores.
    function coreHash(x, y, seed) {
      const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
      return value - Math.floor(value);
    }
    function coreTime(now) {
      return state.reduceMotion ? 0 : now * 0.001;
    }
    /** Brushed gold whose ribbons run along the sphere (by lat/lon), plus a view-locked sheen. */
    function drawGoldFace(proj, tile, now) {
      const t = coreTime(now);
      const { lat, lon } = faceLatLon(tile);
      const band = 0.5 + 0.5 * Math.sin(lon * 4 + lat * 3 + t * 0.35);
      const band2 = 0.5 + 0.5 * Math.sin(lon * 11 - lat * 5 - t * 0.2);
      const base = mixHex(mixHex("#5c3a0c", "#c8942a", band), "#f4d98a", band2 * 0.35);
      fillFace(proj, base);
      // Sheen: one screen-space gleam settles behind the rotation like Mercury's.
      const angle = state.rotY * 0.22 + t * 0.06;
      const hx = state.centerX + Math.cos(angle * 0.73 - 0.8) * state.scale * 0.34;
      const hy = state.centerY + Math.sin(angle * 0.61 - 1.2) * state.scale * 0.25;
      const gleam = ctx.createRadialGradient(hx, hy, 0, hx, hy, state.scale * 0.55);
      gleam.addColorStop(0, "rgba(255,246,210,0.42)");
      gleam.addColorStop(0.2, "rgba(255,240,190,0.14)");
      gleam.addColorStop(1, "rgba(255,255,255,0)");
      fillFace(proj, gleam);
    }
    /** Magma nucleus: hottest at the sphere's centre, heat bands ride the latitude, a flash passes. */
    function drawMagmaFace(proj, tile, now) {
      const t = coreTime(now);
      const { lat } = faceLatLon(tile);
      const depth = faceDepth(proj);
      const bands = 0.85 + 0.15 * Math.sin(lat * 9 + t * 1.4);
      const heat = Math.min(1, depth * 1.15 * bands);
      const base = heat > 0.5
        ? mixHex("#c9481f", "#ffb05b", (heat - 0.5) * 2)
        : mixHex("#190f16", "#c9481f", heat * 2);
      fillFace(proj, base);
      const glow = ctx.createRadialGradient(state.centerX, state.centerY, 0, state.centerX, state.centerY, state.scale * 0.9);
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.1);
      glow.addColorStop(0, `rgba(255,220,150,${(0.28 + pulse * 0.16).toFixed(3)})`);
      glow.addColorStop(0.5, "rgba(255,150,80,0.10)");
      glow.addColorStop(1, "rgba(255,120,60,0)");
      fillFace(proj, glow);
      const flash = Math.max(0, Math.sin(t * 0.7) - 0.92) / 0.08;
      if (flash > 0) fillFace(proj, `rgba(255,236,200,${(flash * 0.4).toFixed(3)})`);
    }
    /** Plasma nucleus: navy at the rim, violet-blue at the centre; a filament lives on each face and pulses. */
    function drawPlasmaFace(proj, tile, now) {
      const t = coreTime(now);
      const depth = faceDepth(proj);
      fillFace(proj, mixHex("#060a1e", "#1c3f8f", Math.pow(depth, 1.4)));
      const glow = ctx.createRadialGradient(state.centerX, state.centerY, 0, state.centerX, state.centerY, state.scale * 0.8);
      glow.addColorStop(0, "rgba(160,120,255,0.30)");
      glow.addColorStop(0.55, "rgba(90,70,200,0.10)");
      glow.addColorStop(1, "rgba(60,40,140,0)");
      fillFace(proj, glow);
      const seed = coreHash(tile.index, 3, 2.1);
      if (seed < 0.55) return; // not every face carries a filament
      const pulse = 0.25 + 0.75 * Math.max(0, Math.sin(t * (1.2 + seed) + seed * 9));
      const b = proj.boundary;
      const k = Math.floor(seed * b.length);
      const a = b[k], c = b[(k + 3) % b.length];
      ctx.strokeStyle = `rgba(200,147,220,${(0.25 + pulse * 0.6).toFixed(3)})`;
      ctx.lineWidth = Math.max(0.8, Math.sqrt(proj.area) * 0.06);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      const mx = (a.x + c.x) / 2 + (coreHash(tile.index, 5, 1.3) - 0.5) * Math.sqrt(proj.area) * 0.5;
      const my = (a.y + c.y) / 2 + (coreHash(tile.index, 7, 4.2) - 0.5) * Math.sqrt(proj.area) * 0.5;
      ctx.lineTo(mx, my);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
    }
    /**
     * Hollow interiors: cleared faces are holes; through them you see the
     * concave far side of the shell, painted per back face from that face's
     * own coordinates (so it turns with the sphere) — Galaxy's stars sit on
     * the inside of the shell, Aurora's curtains hang by longitude, the sky
     * shades by height. Drawn once per frame before the front faces, clipped
     * to the union of the holes.
     */
    function interiorFaces() {
      const key = rotKey() + "|i";
      if (state.interiorCache && state.interiorKey === key) return state.interiorCache;
      const back = [];
      for (let i = 0; i < state.tiles.length; i++) {
        const pr = projectTile(state.tiles[i], state.rotY, state.rotX);
        if (pr.z < -0.02) back.push(pr);
      }
      back.sort((a, b) => a.z - b.z);
      state.interiorCache = back;
      state.interiorKey = key;
      return back;
    }
    function drawHollowInterior(projected, now) {
      const T = state.theme;
      if (!T || T.interior !== "hollow") return;
      const holes = projected.filter((p) => {
        const c = state.cells[p.index];
        return p.z > 0.02 && c && c.revealed && !c.isMine && !c.flagged;
      });
      if (!holes.length) return;
      const t = coreTime(now);
      ctx.save();
      ctx.beginPath();
      for (const h of holes) {
        h.boundary.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
        ctx.closePath();
      }
      ctx.clip();
      const R = state.scale;
      // A soft dark falloff so the interior reads as a cavity, not a poster.
      const cavity = ctx.createRadialGradient(state.centerX, state.centerY, R * 0.1, state.centerX, state.centerY, R * 1.05);
      const material = T.material;
      if (material === "stratosphere") {
        cavity.addColorStop(0, "#9ccbe9");
        cavity.addColorStop(1, "#5a9ccf");
      } else if (material === "aurora") {
        cavity.addColorStop(0, "#08202a");
        cavity.addColorStop(1, "#02070d");
      } else {
        cavity.addColorStop(0, "#1a1436");
        cavity.addColorStop(1, "#050714");
      }
      ctx.fillStyle = cavity;
      ctx.fillRect(state.centerX - R * 1.2, state.centerY - R * 1.2, R * 2.4, R * 2.4);
      for (const face of interiorFaces()) {
        const tile = state.tiles[face.index];
        const { lat, lon } = faceLatLon(tile);
        const depth = -face.z; // 0 near the rim → 1 at the far pole
        let fill;
        if (material === "stratosphere") {
          // Height inside the shell: face normal's screen-up component.
          const up = 0.5 + 0.5 * (face.normal ? face.normal.y : 0);
          fill = up > 0.55 ? mixHex("#4c98d2", "#1d6fa9", (up - 0.55) * 2.2) : mixHex("#dceaf5", "#4c98d2", up / 0.55);
          fillFace(face, fill);
          const puff = coreHash(face.index, 2, 1.7);
          if (puff > 0.7) {
            fillFace(face, `rgba(255,255,255,${(0.10 + (puff - 0.7) * 0.6 + 0.05 * Math.sin(t + puff * 8)).toFixed(3)})`);
          }
        } else if (material === "aurora") {
          const curtain = Math.pow(Math.max(0, Math.sin(lon * 3 + t * 0.35)), 2) * (0.55 + 0.45 * Math.cos(lat * 2.2));
          fill = mixHex(mixHex("#02070d", "#0d3a3c", depth * 0.6), "#7fe0c8", curtain * 0.7);
          fillFace(face, fill);
        } else {
          fill = mixHex("#07061a", "#2a1f4a", depth * 0.8 * (0.6 + 0.4 * Math.sin(lon * 2 + lat)));
          fillFace(face, fill);
          const star = coreHash(face.index, 4, 6.2);
          if (star > 0.62) {
            const tw = 0.45 + 0.55 * Math.abs(Math.sin(t * (0.5 + star) + face.index));
            const b = face.boundary;
            const ox = (coreHash(face.index, 1, 1.1) - 0.5) * 0.5;
            const oy = (coreHash(face.index, 9, 3.3) - 0.5) * 0.5;
            const w = Math.max(...b.map((p) => p.x)) - Math.min(...b.map((p) => p.x));
            ctx.fillStyle = `rgba(255,${230 + Math.round(star * 20)},${205 + Math.round(star * 40)},${tw.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(face.center.x + ox * w, face.center.y + oy * w, Math.max(0.6, w * (0.05 + star * 0.05)), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();
    }
    function drawRevealedCore(proj, cell, now, profile) {
      if (!profile || !cell || !cell.revealed || cell.isMine) return;
      ctx.save();
      if (!drawHexPath(proj)) {
        ctx.restore();
        return;
      }
      ctx.clip();
      const tile = state.tiles[proj.index];
      if (profile === "metal") drawMetalCore(proj, now);
      else if (profile === "gold") drawGoldFace(proj, tile, now);
      else if (profile === "magma") drawMagmaFace(proj, tile, now);
      else if (profile === "plasma") drawPlasmaFace(proj, tile, now);
      // "hollow" paints nothing here: the interior pass shows through.
      ctx.restore();
    }
    /**
     * Radial center glow clipped to the hex face (Glow theme / wellGlow themes).
     * Empty clears run hotter; numbered wells stay softer so digits stay readable.
     */
    function drawWellCenterGlow(proj, cell, now) {
      const T = state.theme;
      if (!T || !T.wellGlow || !cell || !cell.revealed || cell.isMine) return;
      if (!proj.boundary || proj.boundary.length < 3) return;
      const cx = proj.center.x;
      const cy = proj.center.y;
      const outer = Math.sqrt(Math.max(24, proj.area));
      const r = outer * (cell.neighborMines === 0 ? 0.62 : 0.48);
      let boost = cell.neighborMines === 0 ? T.wellGlowEmptyBoost || 1.1 : 0.62;
      // Brief hotter flash right after dig.
      if (!state.reduceMotion && cell.pulseAt) {
        const age = now - cell.pulseAt;
        if (age >= 0 && age < REVEAL_FLASH_MS * 1.4) {
          const flash = 1 - age / (REVEAL_FLASH_MS * 1.4);
          boost += flash * 0.55;
        }
      }
      const hot = T.wellGlowHot || "#ffffff";
      const mid = T.wellGlowColor || T.accent || "#88ccff";
      const a0 = Math.min(0.95, 0.72 * boost);
      const a1 = Math.min(0.7, 0.42 * boost);
      ctx.save();
      if (!drawHexPath(proj)) {
        ctx.restore();
        return;
      }
      ctx.clip();
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      // parseCssColor + rgba for soft falloff
      const h = parseCssColor(hot);
      const m = parseCssColor(mid);
      g.addColorStop(0, `rgba(${h[0]},${h[1]},${h[2]},${a0})`);
      g.addColorStop(0.38, `rgba(${m[0]},${m[1]},${m[2]},${a1})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      // Soft outer bloom (unclipped-ish: drawn inside clip still, larger radius)
      if (cell.neighborMines === 0 && !state.reduceMotion) {
        const r2 = r * 1.15;
        const g2 = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r2);
        g2.addColorStop(0, `rgba(${m[0]},${m[1]},${m[2]},${0.18 * boost})`);
        g2.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g2;
        ctx.fillRect(cx - r2, cy - r2, r2 * 2, r2 * 2);
      }
      ctx.restore();
    }

    function drawHexRing(proj, color, lineWidth) {
      if (!drawHexPath(proj)) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }

    /** Shrink boundary toward center (inset 0 = full, 1 = point). */
    function insetProjected(proj, inset) {
      const t = Math.max(0.08, 1 - inset);
      if (t > 0.998) return proj;
      const cx = proj.center.x;
      const cy = proj.center.y;
      return {
        ...proj,
        boundary: proj.boundary.map((p) => ({
          x: cx + (p.x - cx) * t,
          y: cy + (p.y - cy) * t,
        })),
        area: proj.area * t * t,
      };
    }

    /**
     * Nested hex/pent rings for neighbor count — denser rings = more danger.
     * Same topology as the tile (5 or 6 sides).
     */
    function drawNestedCount(proj, count, color) {
      const n = Math.max(0, Math.min(6, count | 0));
      if (n < 1 || !proj.boundary || proj.boundary.length < 3) return;
      const outer = Math.sqrt(proj.area);
      const inkDepth = !!(state.theme && state.theme.takeInkDepth);
      for (let k = 1; k <= n; k++) {
        // Even spacing into ~72% of the face; outer ring near the rim.
        const inset = (k / (n + 0.85)) * 0.7;
        const ring = insetProjected(proj, inset);
        // Kimi take: denser/heavier brush rings as count rises (calligraphy weight).
        const lw = inkDepth
          ? Math.max(1.2, Math.min(3.4, outer * (0.04 + n * 0.01) - k * 0.003))
          : Math.max(1.1, Math.min(2.4, outer * (0.055 - k * 0.004)));
        drawHexRing(ring, color, lw);
      }
    }

    function countStyleById(id) {
      return COUNT_STYLES.find((s) => s.id === id) || COUNT_STYLES[0];
    }

    function countStyleIndex() {
      const i = COUNT_STYLES.findIndex((s) => s.id === state.countStyle);
      return i >= 0 ? i : 0;
    }

    /**
     * Permanent radial height for a cell (before hover/press).
     * Flagged → covered → numbered clear → empty clear.
     * Only extruded styles tier at all; flush/yellow stay at shell height.
     */
    function reliefIsExtruded() {
      return state.relief !== "flush";
    }

    function seamsEnabled() {
      return state.seams !== false;
    }

    function tileHeight(cell, styleId) {
      if (!cell) return TIER_COVERED;
      const extruded = reliefIsExtruded();
      if (cell.flagged && !cell.revealed) {
        return extruded ? TIER_FLAGGED : TIER_COVERED;
      }
      if (!cell.revealed) return TIER_COVERED;
      if (!extruded) return TIER_COVERED;
      if (cell.isMine) return TIER_NUMBERED;
      if (cell.neighborMines === 0) return TIER_EMPTY;
      return TIER_NUMBERED;
    }

    /** True when a clear sits below the shell (numbered or empty recess). */
    function tileShouldInset(cell, styleId) {
      return tileHeight(cell, styleId) < TIER_COVERED - 1e-6;
    }

    /** Quantize height for skirt comparisons (float noise guard). */
    function heightBucket(h) {
      if (h >= TIER_FLAGGED - 0.002) return 0;
      if (h >= TIER_COVERED - 0.002) return 1;
      if (h >= TIER_NUMBERED - 0.002) return 2;
      return 3;
    }

    /** Map each boundary edge → neighbor tile index (for valley perimeter skirts). */
    function attachEdgeNeighbors(tiles) {
      tiles = tiles || state.tiles;
      const pointKey = (p) =>
        `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.z.toFixed(6)}`;
      const edgeMap = new Map();
      for (let ti = 0; ti < tiles.length; ti++) {
        const b = tiles[ti].boundary;
        tiles[ti].edgeNeighbors = new Array(b.length).fill(-1);
        for (let i = 0; i < b.length; i++) {
          const j = (i + 1) % b.length;
          const key = [pointKey(b[i]), pointKey(b[j])].sort().join("|");
          if (!edgeMap.has(key)) edgeMap.set(key, []);
          edgeMap.get(key).push({ ti, ei: i });
        }
      }
      edgeMap.forEach((ends) => {
        if (ends.length !== 2) return;
        const [a, b] = ends;
        tiles[a.ti].edgeNeighbors[a.ei] = b.ti;
        tiles[b.ti].edgeNeighbors[b.ei] = a.ti;
      });
    }

    /** Cliff/skirt fill — into black wells vs into white wells. */
    function skirtFill(nw) {
      if (state.theme && state.theme.reflectionSurface) {
        const alpha = (0.5 + (1 - nw) * 0.22).toFixed(3);
        return `rgba(2,7,11,${alpha})`;
      }
      const well = parseCssColor(
        state.theme.revealedEmpty || state.theme.revealed || "#000000"
      );
      const lightWell = (well[0] + well[1] + well[2]) / 3 > 128;
      if (lightWell) {
        return colorMix("#2a2a2a", "#c8c8c8", 1 - nw);
      }
      return colorMix("#dddddd", "#777777", 1 - nw);
    }

    /**
     * Extrusion skirts only on edges that leave the raised/inset set —
     * shared edges between two valley (or two hover) faces stay open.
     */
    function drawSelectiveSkirt(
      tileIdx,
      baseBoundary,
      faceBoundary,
      _unused,
      skipNeighbor
    ) {
      if (!baseBoundary || !faceBoundary) return;
      const tile = state.tiles[tileIdx];
      const edgeN = tile.edgeNeighbors || [];
      const n = Math.min(baseBoundary.length, faceBoundary.length);
      for (let i = 0; i < n; i++) {
        const ni = edgeN[i];
        if (ni >= 0 && typeof skipNeighbor === "function" && skipNeighbor(ni)) {
          continue;
        }
        const j = (i + 1) % n;
        const mx =
          (baseBoundary[i].x +
            baseBoundary[j].x +
            faceBoundary[i].x +
            faceBoundary[j].x) *
          0.25;
        const my =
          (baseBoundary[i].y +
            baseBoundary[j].y +
            faceBoundary[i].y +
            faceBoundary[j].y) *
          0.25;
        const cx =
          faceBoundary.reduce((s, p) => s + p.x, 0) / faceBoundary.length;
        const cy =
          faceBoundary.reduce((s, p) => s + p.y, 0) / faceBoundary.length;
        const vx = mx - cx;
        const vy = my - cy;
        const len = Math.hypot(vx, vy) || 1;
        const nw = Math.max(0, Math.min(1, (-vx / len - vy / len) * 0.5 + 0.5));
        ctx.beginPath();
        ctx.moveTo(baseBoundary[i].x, baseBoundary[i].y);
        ctx.lineTo(baseBoundary[j].x, baseBoundary[j].y);
        ctx.lineTo(faceBoundary[j].x, faceBoundary[j].y);
        ctx.lineTo(faceBoundary[i].x, faceBoundary[i].y);
        ctx.closePath();
        ctx.fillStyle = skirtFill(nw);
        ctx.fill();
      }
    }

    /**
     * Borderless strips strokes on cleared faces only.
     * (Valley pass must not re-apply grooves when styleId === borderless.)
     */
    function drawColorsForStyle(colors, styleId, cell) {
      if (seamsEnabled() && styleId !== "borderless") return colors;
      if (!cell || !cell.revealed || cell.flagged) return colors;
      return {
        ...colors,
        stroke: colors.fill,
        lineWidth: 0,
      };
    }

    /** Hover lift only for faces you can still activate (covered / flaggable). */
    function tileCanActivate(cell) {
      return !!(cell && !cell.revealed);
    }

    let countStyleToastTimer = null;

    function showCountStyleToast(name) {
      if (!countStyleToast) return;
      countStyleToast.textContent = name;
      countStyleToast.classList.add("show");
      clearTimeout(countStyleToastTimer);
      countStyleToastTimer = setTimeout(() => {
        countStyleToast.classList.remove("show");
      }, 1400);
    }

    function syncCountStyleChrome() {
      if (!nestBtn) return;
      const def = countStyleById(state.countStyle);
      nestBtn.classList.toggle("active", state.countStyle !== "numerals");
      nestBtn.title = `Count style — ${def.name} (N)`;
      nestBtn.setAttribute("aria-label", `Count style: ${def.name}. Activate to cycle.`);
      nestBtn.innerHTML =
        COUNT_STYLE_ICONS[state.countStyle] || COUNT_STYLE_ICONS.numerals;
    }

    function setCountStyle(id, optsSet) {
      optsSet = optsSet || {};
      const def = COUNT_STYLES.find((s) => s.id === id);
      if (!def) return;
      state.countStyle = def.id;
      if (optsSet.syncSurface !== false) {
        state.relief =
          def.id === "flush" || def.id === "yellow" ? "flush" : "extruded";
        state.seams = def.id !== "borderless";
      }
      try {
        localStorage.setItem(COUNT_STYLE_STORAGE_KEY, def.id);
      } catch (_) {}
      syncCountStyleChrome();
      if (optsSet.toast !== false) showCountStyleToast(def.name);
      scheduleFrame();
    }

    function setRelief(mode) {
      state.relief = mode === "flush" ? "flush" : "extruded";
      scheduleFrame();
    }

    function setSeams(on) {
      state.seams = !!on;
      scheduleFrame();
    }

    function setAppearanceAxes(axes) {
      const dark = axes && axes.field === "dark";
      const wanted = dark ? "dark" : "light";
      const index = THEMES.findIndex((theme) => theme.id === wanted);
      if (index >= 0) applyTheme(index);
    }

    function cycleCountStyle() {
      const next = COUNT_STYLES[(countStyleIndex() + 1) % COUNT_STYLES.length];
      setCountStyle(next.id);
    }

    function paintCountMark(tile, proj, cell, colors, lift) {
      if (!colors.showLabel || !colors.label) return;
      const isDigit =
        cell.revealed &&
        !cell.isMine &&
        !cell.flagged &&
        cell.neighborMines > 0;
      const styleId = state.countStyle;
      if ((styleId === "rings" || styleId === "yellow") && isDigit) {
        const ringColor =
          styleId === "yellow" ? YELLOW_COUNT : colors.labelColor;
        drawNestedCount(proj, cell.neighborMines, ringColor);
        return;
      }
      drawLabelUpright(tile, colors.label, colors.labelColor, {
        stroke: colors.labelStroke,
        weight: cell.flagged ? "600" : "700",
        lift: lift || 0,
        area: proj.area,
      });
    }

    /** Full skirt (hover/flag pins) — every edge. */
    function drawExtrusionSkirt(baseBoundary, raisedBoundary) {
      if (!baseBoundary || !raisedBoundary) return;
      const n = Math.min(baseBoundary.length, raisedBoundary.length);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const mx =
          (baseBoundary[i].x +
            baseBoundary[j].x +
            raisedBoundary[i].x +
            raisedBoundary[j].x) *
          0.25;
        const my =
          (baseBoundary[i].y +
            baseBoundary[j].y +
            raisedBoundary[i].y +
            raisedBoundary[j].y) *
          0.25;
        const cx =
          raisedBoundary.reduce((s, p) => s + p.x, 0) / raisedBoundary.length;
        const cy =
          raisedBoundary.reduce((s, p) => s + p.y, 0) / raisedBoundary.length;
        const vx = mx - cx;
        const vy = my - cy;
        const len = Math.hypot(vx, vy) || 1;
        const nw = Math.max(0, Math.min(1, (-vx / len - vy / len) * 0.5 + 0.5));
        ctx.beginPath();
        ctx.moveTo(baseBoundary[i].x, baseBoundary[i].y);
        ctx.lineTo(baseBoundary[j].x, baseBoundary[j].y);
        ctx.lineTo(raisedBoundary[j].x, raisedBoundary[j].y);
        ctx.lineTo(raisedBoundary[i].x, raisedBoundary[i].y);
        ctx.closePath();
        ctx.fillStyle = skirtFill(nw);
        ctx.fill();
      }
    }

    function labelFontSize(area) {
      const base = Math.sqrt(area) * 0.42;
      return Math.max(9, Math.min(18, base));
    }

    /**
     * Numerals stay screen-upright for the viewer (plain 2D draw at face center).
     * Optional opts.lift recenters on a radially lifted face.
     */
    function drawLabelUpright(tile, text, color, opts) {
      opts = opts || {};
      const rotY = state.rotY;
      const rotX = state.rotX;
      const n = faceNormal(tile, rotY, rotX);
      const c = rotatePoint(tile.centerPoint, rotY, rotX);
      const lift = opts.lift || 0;
      const origin = {
        x: c.x + n.x * lift,
        y: c.y + n.y * lift,
        z: c.z + n.z * lift,
      };
      const p0 = projectRotated(origin);
      const size =
        opts.size ||
        labelFontSize(
          opts.area != null ? opts.area : Math.max(80, state.scale * 0.02)
        );
      const weight = opts.weight || "700";
      ctx.save();
      ctx.translate(p0.x, p0.y);
      // Identity 2D orientation — always faces the user.
      ctx.font = `${weight} ${size}px IBM Plex Sans, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (opts.stroke) {
        ctx.lineWidth = opts.strokeWidth || Math.max(2, size * 0.18);
        ctx.strokeStyle = opts.stroke;
        ctx.strokeText(text, 0, 0);
      }
      ctx.fillStyle = color;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }

    function coveredStyle(proj, tile, isFront) {
      const T = state.theme;
      // Reflection themes: the WebGL canvas below owns the mirrored body.
      // Covered cells contribute only a faint silvering and etched topology.
      if (T.reflectionSurface) {
        const edgeWidth = tile.isPentagon
          ? T.surfacePentagonEdgeWidth || 1.05
          : T.surfaceEdgeWidth || 0.78;
        return {
          fill: isFront ? T.covered : T.backface,
          stroke: isFront ? T.coveredEdge : T.backfaceEdge,
          lineWidth: isFront
            ? edgeWidth
            : T.surfaceBackfaceEdgeWidth || 0.45,
          showLabel: false,
        };
      }
      // Flat pure covered (dark mono): white hexes, no normal shading.
      if (T.pureCovered || T.id === "dark") {
        return {
          fill: T.covered || "#ffffff",
          stroke: T.coveredEdge,
          lineWidth: tile.isPentagon ? 2 : 1.75,
          showLabel: false,
        };
      }
      // Globe maps: each face samples equirectangular daymap at tile lat/lon.
      if (T.globeMap) {
        const sample = tileGlobeColor(tile);
        let fill = sample || T.covered;
        // Soft limb darkening so the sphere reads round.
        const limb = Math.max(0, Math.min(1, 1 - proj.normalZ));
        fill = colorMix(fill, "#000000", limb * 0.42);
        if (isFront) fill = colorMix(fill, T.coveredHi || "#ffffff", 0.06);
        return {
          fill,
          stroke: T.coveredEdge,
          lineWidth: tile.isPentagon
            ? Math.max(0.95, (T.globeEdgeWidth || 1.15) * 1.24)
            : T.globeEdgeWidth || 1.15,
          showLabel: false,
        };
      }
      let fill = tile.isPentagon ? T.pentagon : T.covered;
      let stroke = tile.isPentagon ? T.pentagonEdge : T.coveredEdge;
      fill = shadeByNormal(fill, proj.normalZ, isFront ? 0.38 : 0.22);
      if (isFront) fill = colorMix(fill, T.coveredHi, 0.15);
      return {
        fill,
        stroke,
        // Light shell: keep a crisp black honeycomb (was washing out when thin).
        lineWidth: tile.isPentagon ? 2 : 1.75,
        showLabel: false,
      };
    }

    // Each material plants a flag in its own metal or light: a screen-space
    // sheen (like Mercury's gilded pin) so it reads as a sheen, not a decal,
    // while the face still rises with the ordinary flag geometry.
    const FLAG_SHEENS = {
      mercury: { stops: ["#3f2705", "#8c5a0d", "#f4d77a", "#b67a17", "#4b2b04"], stroke: "#ffe7a0" },
      stratosphere: { stops: ["#0f4f80", "#3f95d6", "#f4fbff", "#5aa9e2", "#0b3a5c"], stroke: "#ffffff" },
      "ion-storm": { stops: ["#2c1150", "#7a3fbf", "#f0d8ff", "#9a5be0", "#1a0a33"], stroke: "#e2c4f5" },
      aurora: { stops: ["#083b3a", "#1f8a7c", "#dcfff6", "#38b39a", "#052625"], stroke: "#b9f0ee" },
      galaxy: { stops: ["#4a2033", "#b0606f", "#ffe1e4", "#c47b88", "#2a1220"], stroke: "#f0cdd0" },
      "gilded-ribbon": { stops: ["#3a2205", "#a06f14", "#fff0b8", "#c78a1c", "#2b1804"], stroke: "#f4cf9a" },
      "heat-lightning": { stops: ["#5a1a10", "#d9622a", "#fff0cf", "#e88a3c", "#3a0e0c"], stroke: "#ffd6a3" },
    };
    function reflectionFlagStyle(proj, theme) {
      const sheen = FLAG_SHEENS[theme.material];
      if (!sheen) {
        return {
          fill: theme.tierFlagged || theme.flagFill,
          stroke: theme.flagEdge,
          lineWidth: theme.takeFlagHalo ? 3.4 : 2,
        };
      }
      const radius = Math.max(12, Math.sqrt(Math.max(24, proj.area)) * 0.92);
      const shine = ctx.createLinearGradient(
        proj.center.x - radius,
        proj.center.y + radius * 0.72,
        proj.center.x + radius,
        proj.center.y - radius * 0.72
      );
      const [a, b, c, d, e] = sheen.stops;
      shine.addColorStop(0, a);
      shine.addColorStop(0.22, b);
      shine.addColorStop(0.48, c);
      shine.addColorStop(0.62, d);
      shine.addColorStop(1, e);
      return {
        fill: shine,
        stroke: sheen.stroke,
        lineWidth: 2.15,
      };
    }

    function tileColors(idx, proj, cell, tile, now) {
      const T = state.theme;
      const lit = shadeByNormal;
      const isBack = proj.z <= 0.02;
      const isFront = proj.z > 0.08;
      const darkMono = !!(T.pureCovered || T.id === "dark");

      // Flags: pure fill only — no glyph (color is enough). Optional halo for takes.
      if (cell.flagged && !cell.revealed) {
        const flag = T.reflectionSurface
          ? reflectionFlagStyle(proj, T)
          : {
              fill: T.tierFlagged || T.flagFill,
              stroke: T.flagEdge,
              lineWidth: T.takeFlagHalo ? 3.4 : 2,
            };
        return {
          fill: flag.fill,
          stroke: flag.stroke,
          lineWidth: flag.lineWidth,
          showLabel: false,
        };
      }

      // Reflection themes: the WebGL canvas below owns the continuous mirrored
      // surface. Covered cells contribute only a faint silvering and etched
      // topology here; revealed cells become matte wells in the branch below.
      if (T.reflectionSurface && !cell.revealed) {
        return coveredStyle(proj, tile, isFront);
      }

      // Dark mono: unrevealed hexes are always pure white — including the rim.
      // Must run before isBack: the old backface pass painted them near-black.
      if (darkMono && !cell.revealed) {
        return {
          fill: T.covered || "#ffffff",
          stroke: isBack ? T.backfaceEdge : T.coveredEdge,
          lineWidth: isBack ? 1.1 : tile.isPentagon ? 1.8 : 1.5,
          showLabel: false,
        };
      }

      if (isBack) {
        return {
          fill: lit(T.backface, proj.normalZ, 0.12),
          stroke: T.backfaceEdge,
          lineWidth: 0.8,
          showLabel: false,
        };
      }

      const visualReady =
        state.reduceMotion || now >= cell.visualDue || cell.animReveal >= 0.98;

      if (cell.revealed && !visualReady) {
        return coveredStyle(proj, tile, isFront);
      }

      if (cell.revealed && visualReady) {
        if (T.reflectionSurface) {
          if (cell.isMine) {
            return {
              fill: T.mine,
              stroke: T.mineEdge,
              lineWidth: 2.4,
              showLabel: true,
              label: "✹",
              labelColor: T.mineBurst,
              labelStroke: T.mineCore,
            };
          }
          const empty = cell.neighborMines === 0;
          if (T.interior === "hollow") {
            return {
              fill: "rgba(0,0,0,0)",
              stroke: "rgba(0,0,0,0)",
              lineWidth: 0,
              showLabel: cell.neighborMines > 0,
              label: cell.neighborMines > 0 ? String(cell.neighborMines) : "",
              labelColor: T.text[cell.neighborMines] || T.label,
              labelStroke: T.labelStroke,
            };
          }
          return {
            fill: empty ? T.revealedEmpty : T.revealed,
            stroke: empty ? T.revealedEmptyEdge : T.revealedEdge,
            lineWidth: empty ? 0.8 : 1.25,
            showLabel: cell.neighborMines > 0,
            label: cell.neighborMines > 0 ? String(cell.neighborMines) : "",
            labelColor: T.text[cell.neighborMines] || T.label,
            labelStroke: T.labelStroke,
          };
        }
        const pureWell = !!(T.pureRevealed || darkMono);
        if (cell.isMine) {
          let fill = pureWell ? T.mine : lit(T.mine, proj.normalZ, 0.25);
          if (cell.endFlash > 0) {
            fill = colorMix(fill, T.mineBurst, cell.endFlash * 0.65);
          }
          return {
            fill,
            stroke: T.mineEdge,
            lineWidth: 2,
            showLabel: true,
            label: "✹",
            labelColor: T.mineBurst,
            labelStroke: T.mineCore,
          };
        }
        const empty = cell.neighborMines === 0;
        // Numbered shares empty well fill for now (tier color slots reserved).
        let wellFill = empty
          ? T.tierEmpty || T.revealedEmpty
          : T.tierNumbered || T.revealed;
        // Muse take: faint count-tint ramp on numbered wells.
        if (
          !empty &&
          T.takeCountTint &&
          Array.isArray(T.countTintRamp) &&
          T.countTintRamp[cell.neighborMines]
        ) {
          wellFill = T.countTintRamp[cell.neighborMines];
        }
        // Globe maps: dug faces keep a ghost of the terrain under a dark well.
        if (T.globeMap) {
          const ghost = tileGlobeColor(tile);
          if (ghost) {
            wellFill = colorMix(wellFill, ghost, empty ? 0.18 : 0.28);
          }
        }
        let fill = pureWell && !T.globeMap ? wellFill : lit(wellFill, proj.normalZ, 0.28);
        const pulseAge = now - cell.pulseAt;
        if (
          !state.reduceMotion &&
          pulseAge >= 0 &&
          pulseAge < REVEAL_FLASH_MS
        ) {
          const flash = 1 - pulseAge / REVEAL_FLASH_MS;
          fill = colorMix(fill, T.revealFlash, flash * 0.5);
          fill = colorMix(fill, T.revealGlow, flash * 0.22);
        }
        if (cell.endFlash > 0) {
          // Stay mono — no warm yellow wash.
          fill = colorMix(fill, T.revealGlow, cell.endFlash * 0.55);
          fill = colorMix(fill, T.revealFlash, cell.endFlash * 0.25);
        }
        return {
          fill,
          stroke: T.revealedEdge,
          lineWidth: 1.2,
          showLabel: cell.neighborMines > 0,
          label: cell.neighborMines > 0 ? String(cell.neighborMines) : "",
          labelColor: T.text[cell.neighborMines] || T.label,
          labelStroke: T.labelStroke,
        };
      }

      return coveredStyle(proj, tile, isFront);
    }

    function popProjected(proj, pop, endPop) {
      const extra = endPop != null && endPop > 1.001 ? endPop : 1;
      const scale = pop * extra;
      if (Math.abs(scale - 1) < 0.001) return proj;
      const cx = proj.center.x;
      const cy = proj.center.y;
      return {
        ...proj,
        boundary: proj.boundary.map((p) => ({
          x: cx + (p.x - cx) * scale,
          y: cy + (p.y - cy) * scale,
        })),
        area: proj.area * scale * scale,
      };
    }

    function draw() {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      const shakeX =
        state.camShake > 0.2 && !state.reduceMotion
          ? (Math.random() - 0.5) * state.camShake
          : 0;
      const shakeY =
        state.camShake > 0.2 && !state.reduceMotion
          ? (Math.random() - 0.5) * state.camShake
          : 0;

      ctx.save();
      if (shakeX || shakeY) ctx.translate(shakeX, shakeY);

      if (state.theme.reflectionSurface && reflectionLive()) {
        // The WebGL material canvas beneath paints field and body; keep this
        // canvas transparent so the mirror shows through.
      } else if (state.theme.reflectionSurface) {
        // Reflection theme without a live renderer (no WebGL, script not
        // loaded, forced colors): paint a plain metal field so the board
        // still reads instead of showing the page background.
        const grd = ctx.createRadialGradient(
          state.centerX,
          state.centerY,
          state.scale * 0.1,
          state.centerX,
          state.centerY,
          state.scale * 1.35
        );
        grd.addColorStop(0, state.theme.fallbackBgGlow || "#3d484b");
        grd.addColorStop(1, state.theme.fallbackBg || "#050708");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
      } else {
        const grd = ctx.createRadialGradient(
          state.centerX,
          state.centerY,
          state.scale * 0.1,
          state.centerX,
          state.centerY,
          state.scale * 1.35
        );
        grd.addColorStop(0, state.theme.bgGlow);
        grd.addColorStop(1, state.theme.bg);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
      }

      // Float themes: soft contact shadow under the sphere (light-field lift).
      if (state.theme.float) {
        const r = Math.max(12, state.scale * 1.02);
        const cx = state.centerX;
        const cy = state.centerY + r * 0.08;
        const ink =
          (state.theme.chrome || "light") === "light"
            ? [0, 0, 0]
            : [255, 255, 255];
        const sh = ctx.createRadialGradient(
          cx,
          cy + r * 0.12,
          r * 0.2,
          cx,
          cy + r * 0.18,
          r * 1.05
        );
        sh.addColorStop(0, `rgba(${ink[0]},${ink[1]},${ink[2]},0.22)`);
        sh.addColorStop(0.45, `rgba(${ink[0]},${ink[1]},${ink[2]},0.1)`);
        sh.addColorStop(1, `rgba(${ink[0]},${ink[1]},${ink[2]},0)`);
        ctx.beginPath();
        ctx.ellipse(cx, cy + r * 0.22, r * 0.92, r * 0.28, 0, 0, Math.PI * 2);
        ctx.fillStyle = sh;
        ctx.fill();
      }

      // Sphere underlayer / core — black beneath white shell (and inverse).
      // Glow theme: soft luminous core so dug faces feel lit from inside.
      const coreFill = state.theme.core || state.theme.backface || "#000000";
      const coreR = Math.max(12, state.scale * 1.02);
      if (state.theme.reflectionSurface && reflectionLive()) {
        // The analytic WebGL orb is the sphere core for this material.
      } else if (state.theme.reflectionSurface) {
        ctx.beginPath();
        ctx.arc(state.centerX, state.centerY, coreR, 0, Math.PI * 2);
        ctx.fillStyle = state.theme.fallbackCore || "#101719";
        ctx.fill();
      } else if (state.theme.wellGlow && state.theme.coreGlow) {
        const cg = ctx.createRadialGradient(
          state.centerX,
          state.centerY,
          coreR * 0.08,
          state.centerX,
          state.centerY,
          coreR
        );
        const hot = parseCssColor(state.theme.wellGlowHot || "#ffffff");
        const mid = parseCssColor(state.theme.coreGlow);
        cg.addColorStop(0, `rgba(${hot[0]},${hot[1]},${hot[2]},0.55)`);
        cg.addColorStop(0.35, `rgba(${mid[0]},${mid[1]},${mid[2]},0.35)`);
        cg.addColorStop(0.75, coreFill);
        cg.addColorStop(1, coreFill);
        ctx.beginPath();
        ctx.arc(state.centerX, state.centerY, coreR, 0, Math.PI * 2);
        ctx.fillStyle = cg;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(state.centerX, state.centerY, coreR, 0, Math.PI * 2);
        ctx.fillStyle = coreFill;
        ctx.fill();
      }

      if (!state.reduceMotion) {
        state.rotY += angleDelta(state.rotY, state.targetRotY) * 0.12;
        state.rotX += angleDelta(state.rotX, state.targetRotX) * 0.12;
      } else {
        state.rotY = state.targetRotY;
        state.rotX = state.targetRotX;
      }
      normalizeIdleRotation();

      const projected = getProjected();
      const now = performance.now();
      const highlightIdx =
        !state.isGameOver &&
        (state.pressed >= 0 ? state.pressed : state.hovered);
      const darkMono =
        !!(state.theme.pureCovered || state.theme.id === "dark");
      const styleId = state.countStyle;

      // Per-tile permanent heights (hover is a temporary fifth offset).
      const heights = new Float32Array(state.cells.length);
      for (let i = 0; i < state.cells.length; i++) {
        const c = state.cells[i];
        const ready =
          state.reduceMotion ||
          now >= c.visualDue ||
          c.animReveal >= 0.98;
        // While the reveal anim is pending, keep shell height so flood doesn't pop.
        if (c.revealed && !ready) heights[i] = TIER_COVERED;
        else heights[i] = tileHeight(c, styleId);
      }

      function drawTile(proj) {
        const idx = proj.index;
        const cell = state.cells[idx];
        const tile = state.tiles[idx];
        const coreProfile = revealedCoreProfile(cell);
        let colors = tileColors(idx, proj, cell, tile, now);
        colors = drawColorsForStyle(colors, styleId, cell);
        if (coreProfile) {
          colors = { ...colors, stroke: colors.fill, lineWidth: 0 };
        }
        const h = heights[idx];
        let drawProj = proj;
        let markLift = 0;
        if (Math.abs(h) > 1e-6 && proj.z > 0.02) {
          const lifted = projectTile(tile, state.rotY, state.rotX, h);
          const baseBoundary =
            lifted.baseBoundary ||
            tile.boundary.map((b) =>
              projectPoint(b, state.rotY, state.rotX)
            );
          if (h > 1e-6) {
            // Proud flag pin: wall on every edge, it sits above the whole shell.
            drawExtrusionSkirt(baseBoundary, lifted.boundary);
          } else {
            // Cliff only toward a strictly higher neighbor (same-depth edges stay open).
            const myBucket = heightBucket(h);
            drawSelectiveSkirt(
              idx,
              baseBoundary,
              lifted.boundary,
              darkMono,
              (ni) => heightBucket(heights[ni]) >= myBucket
            );
          }
          drawProj = lifted;
          markLift = h;
          if (h < -1e-6) {
            if (coreProfile || styleId === "borderless") {
              // Seamless valley floor — no per-hex grid (covered tiles keep edges).
              colors = {
                ...colors,
                stroke: colors.fill,
                lineWidth: 0,
              };
            } else {
              // Recessed clears: groove rides the inset face.
              const groove =
                state.theme.valleyGroove ||
                state.theme.revealedEdge ||
                colors.stroke;
              colors = {
                ...colors,
                stroke: groove,
                lineWidth: Math.max(colors.lineWidth || 1.2, 1.25),
              };
            }
          }
        }
        const pop =
          cell.revealed &&
          now >= cell.visualDue &&
          cell.animReveal < 1 &&
          !state.reduceMotion
            ? 0.86 + cell.animReveal * 0.14
            : 1;
        if (pop < 1 || (cell.endPop && cell.endPop > 1.001)) {
          drawProj = popProjected(drawProj, pop, cell.endPop);
        }

        if (!cell.revealed && !cell.flagged && drawProj.z > 0.02) {
          if (!drawGlossedGlobeHex(drawProj, tile, colors, true, 0)) {
            drawHex(drawProj, colors.fill, colors.stroke, colors.lineWidth);
          }
        } else {
          drawHex(drawProj, colors.fill, colors.stroke, colors.lineWidth);
        }
        drawRevealedCore(drawProj, cell, now, coreProfile);
        drawWellCenterGlow(drawProj, cell, now);
        paintCountMark(tile, drawProj, cell, colors, markLift);
      }

      // Hollow interiors paint once, under the front faces, through the holes.
      drawHollowInterior(projected, now);

      // Flags stand above the shell, so they paint after their neighbors
      // (still back-to-front among themselves) or the shell clips their skirts.
      const proudFlags = [];
      for (const proj of projected) {
        const idx = proj.index;
        const cell = state.cells[idx];
        // Hover/press on activatable covered faces draw in the raised pass.
        // Reflection themes have no raised pass (it tore the mirror), so the
        // pressed face must stay in this pass or it vanishes for the whole
        // hold — the long-press flag then only showed on release.
        const hoverRaise =
          highlightIdx >= 0 &&
          idx === highlightIdx &&
          !(state.theme && state.theme.reflectionSurface) &&
          tileCanActivate(cell);
        if (proj.z > 0.02 && hoverRaise) {
          continue;
        }
        if (proj.z > 0.02 && heights[idx] > 1e-6) {
          proudFlags.push(proj);
          continue;
        }
        drawTile(proj);
      }
      for (const proj of proudFlags) drawTile(proj);

      // Raised pass: hover/press on covered or flagged, lifted over its tier.
      // Reflection themes skip it: the shell is a continuous mirror on the
      // WebGL canvas, and a lifted, skirted copy of one face tears that
      // surface on every touch (the ring highlight below still marks it).
      if (
        highlightIdx >= 0 &&
        !(state.theme && state.theme.reflectionSurface) &&
        tileCanActivate(state.cells[highlightIdx])
      ) {
        const idx = highlightIdx;
        const base = projected.find((p) => p.index === idx && p.z > 0.02);
        if (base) {
          const tile = state.tiles[idx];
          const cell = state.cells[idx];
          let colors = drawColorsForStyle(
            tileColors(idx, base, cell, tile, now),
            styleId,
            cell
          );
          // Additive over the tile's tier, so a proud flag still lifts on hover.
          const lift =
            tileHeight(cell, styleId) +
            (state.pressed === idx ? PRESS_LIFT : HOVER_LIFT);
          const raised = projectTile(tile, state.rotY, state.rotX, lift);
          const baseBoundary =
            raised.baseBoundary ||
            tile.boundary.map((b) => projectPoint(b, state.rotY, state.rotX));
          drawExtrusionSkirt(baseBoundary, raised.boundary);
          let fill = colors.fill;
          if (!cell.revealed && !cell.flagged) {
            // Nudge toward the edge ink so hover reads on pure white *and* pure black.
            fill = colorMix(colors.fill, state.theme.coveredEdge, 0.14);
          }
          // Covered tiles always keep a visible edge (even in borderless mode).
          const edgeW = Math.max(colors.lineWidth || 1.5, 1.8);
          if (!cell.revealed && !cell.flagged) {
            const globeColors = { ...colors, fill, lineWidth: edgeW };
            if (!drawGlossedGlobeHex(raised, tile, globeColors, true, 0.10)) {
              drawHex(raised, fill, colors.stroke, edgeW);
            }
          } else {
            drawHex(raised, fill, colors.stroke, edgeW);
          }
          paintCountMark(tile, raised, cell, colors, lift);
        }
      }

      callVariant("draw", { now, projected });
      drawEndFxOverlay(now);
      ctx.restore();
    }

    function frameNeedsPaint(now) {
      if (state.ambientSpin && !state.reduceMotion) return true;
      if (focusTween) return true;
      if (state.dragging || state.pressed >= 0 || state.hovered >= 0) return true;
      if (revealAnimBusy(now)) return true;
      if (END_FX.active) return true;
      if (state.camShake > 0.2) return true;
      if (state.isGameOver && END_FX.particles.length) return true;
      if (state.reduceMotion) return false;
      return (
        Math.abs(state.targetRotY - state.rotY) > 0.0008 ||
        Math.abs(state.targetRotX - state.rotX) > 0.0008
      );
    }

    function scheduleFrame(delay) {
      if (state.rafScheduled) return;
      state.rafScheduled = true;
      const wait = delay != null ? delay : 0;
      if (wait > 0) setTimeout(() => requestAnimationFrame(loop), wait);
      else requestAnimationFrame(loop);
    }

    let lastMenuPose = null;
    function loop(ts) {
      state.rafScheduled = false;
      const now = ts || performance.now();
      tickAmbientSpin(now);
      tickRevealAnim(now);
      if (!state.isGameOver) callVariant("tick", { now });
      tickEndFx(now);
      draw();
      state.lastFrameAt = now;
      if (state.menuRotateOnly) {
        // On-sphere chrome re-projects itself on every frame the camera moved
        // (eased rotation, focus zoom, drag) — not only on drag events.
        const pose = state.rotY + "|" + state.rotX + "|" + state.zoomFactor + "|" + state.centerX + "|" + state.centerY;
        if (pose !== lastMenuPose) {
          lastMenuPose = pose;
          canvas.dispatchEvent(new CustomEvent("hexsweeper:rotation"));
        }
      } else {
        lastMenuPose = null;
      }
      if (frameNeedsPaint(now)) scheduleFrame();
      else scheduleFrame(IDLE_FRAME_MS);
    }

    function canvasPoint(e) {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches && e.touches[0] ? e.touches[0] : e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }

    let longPressTimer = null;
    let touchMoved = false;
    let pinching = false;
    let pinchStartDist = 0;
    let pinchStartZoom = 1;

    function onPointerDown(e) {
      stopAmbientSpin();
      // Block iOS/Android long-press selection / callout on the canvas.
      if (e.type === "touchstart") {
        e.preventDefault();
      }
      if (e.type === "touchstart" && e.touches && e.touches.length >= 2) {
        if (state.menuRotateOnly) {
          touchMoved = true;
          state.dragging = false;
          state.dragStart = null;
          state.pressed = -1;
          return;
        }
        pinching = true;
        touchMoved = true;
        clearTimeout(longPressTimer);
        state.dragging = false;
        state.dragStart = null;
        state.pressed = -1;
        pinchStartDist = touchDistance(e.touches);
        pinchStartZoom = state.zoomFactor;
        return;
      }
      if (!state.menuRotateOnly && state.isGameOver && state.won) return;
      const p = canvasPoint(e);
      touchMoved = false;
      state.dragging = true;
      // Anchor on the live camera, not a lagging target (avoids catch-up snap).
      state.dragStart = { x: p.x, y: p.y, rotY: state.rotY, rotX: state.rotX };
      state.targetRotY = state.rotY;
      state.targetRotX = state.rotX;
      state.hovered = state.menuRotateOnly ? -1 : pickTile(p.x, p.y);
      state.pressed = state.hovered;
      if (e.type === "touchstart" && !state.menuRotateOnly) {
        clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
          if (state.hovered >= 0 && !touchMoved) {
            /*
             * A long press does the opposite of the tap, which is what the
             * Tap action row advertises: "Dig · hold to flag" and
             * "Flag · hold to dig". This used to flag unconditionally, so in
             * flag mode holding just repeated the tap and there was no way to
             * dig by touch at all. reveal() and toggleFlag() both guard
             * isGameOver themselves.
             */
            if (state.flagMode) reveal(state.hovered);
            else toggleFlag(state.hovered);
            touchMoved = true;
            state.pressed = -1;
          }
        }, 480);
      }
    }

    function onPointerMove(e) {
      if (e.type === "touchmove" && e.touches && e.touches.length >= 2) {
        e.preventDefault();
        if (state.menuRotateOnly) return;
        if (!pinching) {
          pinching = true;
          pinchStartDist = touchDistance(e.touches);
          pinchStartZoom = state.zoomFactor;
          clearTimeout(longPressTimer);
          state.pressed = -1;
        }
        const dist = touchDistance(e.touches);
        if (pinchStartDist > 0) {
          setZoomFactor(pinchStartZoom * (dist / pinchStartDist));
        }
        return;
      }
      const p = canvasPoint(e);
      if (state.dragging && state.dragStart) {
        const dx = p.x - state.dragStart.x;
        const dy = p.y - state.dragStart.y;
        if (Math.hypot(dx, dy) > 6) {
          touchMoved = true;
          clearTimeout(longPressTimer);
          state.pressed = -1;
          // Free tumble — keep continuous angles (do not wrap mid-drag).
          const sx = state.invertDragX ? -1 : 1;
          const sy = state.invertDragY ? -1 : 1;
          state.targetRotY = state.dragStart.rotY + dx * 0.0105 * sx;
          state.targetRotX = state.dragStart.rotX + dy * 0.0105 * sy;
          state.rotY = state.targetRotY;
          state.rotX = state.targetRotX;
          invalidateProjection();
          if (state.menuRotateOnly) scheduleFrame(); // the loop re-projects on-sphere chrome
        }
      }
      state.hovered = state.menuRotateOnly ? -1 : pickTile(p.x, p.y);
    }

    function onPointerUp(e) {
      clearTimeout(longPressTimer);
      if (pinching) {
        if (e.touches && e.touches.length >= 2) return;
        pinching = false;
        pinchStartDist = 0;
        state.dragging = false;
        state.dragStart = null;
        state.pressed = -1;
        touchMoved = false;
        return;
      }
      const p = canvasPoint(e.changedTouches ? e.changedTouches[0] : e);
      if (state.menuRotateOnly) {
        const backgroundTap = !touchMoved && !!state.dragStart;
        state.dragging = false;
        state.dragStart = null;
        state.hovered = -1;
        state.pressed = -1;
        touchMoved = false;
        schedulePersist();
        if (backgroundTap) {
          canvas.dispatchEvent(
            new CustomEvent("hexsweeper:menu-background-tap", { bubbles: true })
          );
        }
        return;
      }
      if (!touchMoved && state.dragStart) {
        const idx = pickTile(p.x, p.y);
        if (idx >= 0 && !state.isGameOver) {
          if (state.flagMode || e.button === 2 || e.ctrlKey) toggleFlag(idx);
          else reveal(idx);
        } else if (state.isGameOver) {
          requestReset({ force: true });
        }
      }
      state.dragging = false;
      state.dragStart = null;
      state.pressed = -1;
      touchMoved = false;
      schedulePersist();
    }

    canvas.addEventListener("mousedown", onPointerDown);
    canvas.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    canvas.addEventListener("touchstart", onPointerDown, { passive: false });
    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      onPointerMove(e);
    }, { passive: false });
    canvas.addEventListener("touchend", onPointerUp);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("selectstart", (e) => e.preventDefault());
    // Suppress OS text-selection / magnifier (long-press flag on mobile)
    document.addEventListener(
      "selectionchange",
      () => {
        const sel = window.getSelection && window.getSelection();
        if (sel && !sel.isCollapsed) sel.removeAllRanges();
      },
      { passive: true }
    );
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (state.menuRotateOnly) return;
        stopAmbientSpin();
        const delta = -e.deltaY * 0.0012;
        setZoomFactor(state.zoomFactor * (1 + delta));
      },
      { passive: false }
    );

    if (restartBtn) {
      restartBtn.addEventListener("click", hudClick(() => {
        requestReset();
      }));
    }
    if (shareWinBtn) {
      shareWinBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        shareWinImage();
      });
    }
    if (bannerUndoBtn) {
      bannerUndoBtn.addEventListener("click", hudClick(() => {
        restoreUndo();
      }));
    }
    if (bannerAgainBtn) {
      bannerAgainBtn.addEventListener("click", hudClick(() => {
        requestReset({ force: true });
      }));
    }
    if (flagToggle) {
      flagToggle.addEventListener("click", hudClick(() => {
        state.flagMode = !state.flagMode;
        flagToggle.setAttribute("aria-pressed", state.flagMode ? "true" : "false");
        flagToggle.classList.toggle("active", state.flagMode);
      }));
    }
    if (sizeBtn) sizeBtn.addEventListener("click", hudClick(cycleSize));
    if (themeBtn) themeBtn.addEventListener("click", hudClick(cycleTheme));
    if (nestBtn) nestBtn.addEventListener("click", hudClick(cycleCountStyle));
    if (helpBtn) helpBtn.addEventListener("click", hudClick(() => openHelp(false)));
    if (helpCloseBtn) helpCloseBtn.addEventListener("click", hudClick(closeHelp));
    if (helpDoneBtn) helpDoneBtn.addEventListener("click", hudClick(closeHelp));

    window.addEventListener("keydown", (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        if (helpOverlay?.classList.contains("open")) closeHelp();
        else openHelp(false);
        return;
      }
      if (e.key === "Escape") {
        const lb = document.getElementById("history-lightbox");
        if (lb?.classList.contains("open")) return; // lightbox owns Esc
        if (helpOverlay?.classList.contains("open")) closeHelp();
        return;
      }
      if (e.key === "f" || e.key === "F") {
        state.flagMode = !state.flagMode;
        if (flagToggle) {
          flagToggle.setAttribute("aria-pressed", state.flagMode ? "true" : "false");
          flagToggle.classList.toggle("active", state.flagMode);
        }
      }
      if (e.key === "n" || e.key === "N") {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          cycleCountStyle();
        }
      }
      if (e.key === "r" || e.key === "R") {
        requestReset();
      }
      if (e.key === "t" || e.key === "T") {
        if (!e.metaKey && !e.ctrlKey) cycleTheme();
      }
      if (e.key === "s" || e.key === "S") {
        if (!e.metaKey && !e.ctrlKey) setDifficulty("easy", true);
      }
      if (e.key === "m" || e.key === "M") {
        if (!e.metaKey && !e.ctrlKey) setDifficulty("medium", true);
      }
      if (e.key === "l" || e.key === "L") {
        if (!e.metaKey && !e.ctrlKey) setDifficulty("hard", true);
      }
    });

    syncChromeTheme();
    syncSizeChrome();
    syncCountStyleChrome();
    bindHelpControls();
    if (opts.theme) state.theme = Object.assign({}, state.theme, opts.theme);

    window.addEventListener("resize", resize);
    // Flush on every leave path so F5 / mobile background never loses a dig.
    window.addEventListener("pagehide", () => persistNow());
    window.addEventListener("beforeunload", () => persistNow());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") persistNow();
    });
    resize();

    // Deep-link theme: ?theme=earth|moon|light|…
    try {
      const tid = new URLSearchParams(location.search).get("theme");
      if (tid) {
        const i = THEMES.findIndex((t) => t.id === tid);
        if (i >= 0) {
          themeIndex = i;
          state.theme = themePalette(THEMES[i]);
          syncChromeTheme();
        }
      }
    } catch (_) {}

    // Model-authored takes (?take=… or window.HEXSWEEPER_SPHERE_TAKE).
    let activeTake = null;
    try {
      const fromWin =
        typeof global.HEXSWEEPER_SPHERE_TAKE === "string"
          ? global.HEXSWEEPER_SPHERE_TAKE
          : null;
      const fromQs = new URLSearchParams(location.search).get("take");
      const takeId = fromWin || fromQs;
      if (takeId && SPHERE_TAKES[takeId]) activeTake = SPHERE_TAKES[takeId];
    } catch (_) {}

    function applyActiveTake() {
      if (!activeTake) return;
      state.theme = themePalette(activeTake.theme);
      document.body.dataset.sphereTake = activeTake.id;
      document.body.dataset.sphereTheme = activeTake.theme.id;
      document.body.dataset.sphereChrome = activeTake.theme.chrome || "dark";
      if (activeTake.countStyleDefault) {
        state.countStyle = activeTake.countStyleDefault;
        syncCountStyleChrome();
      }
      if (Number.isFinite(activeTake.defaultZoom)) {
        state.zoomFactor = Math.max(
          ZOOM_MIN,
          Math.min(ZOOM_MAX, activeTake.defaultZoom)
        );
        state.scale = state.baseScale * state.zoomFactor;
      }
      if (typeof activeTake.ambientSpin === "boolean") {
        state.ambientSpin = activeTake.ambientSpin && !state.reduceMotion;
      }
      // Help modal: title + lede for the take (keep controls list).
      const titleEl = document.getElementById("help-title");
      const ledeEl = document.querySelector(".help-lede");
      if (titleEl && activeTake.title) titleEl.textContent = activeTake.title;
      if (ledeEl && activeTake.helpLede) {
        ledeEl.textContent = activeTake.helpLede;
      }
      document.title = activeTake.title || document.title;
      if (activeTake.hudNote && typeof showCountStyleToast === "function") {
        setTimeout(() => showCountStyleToast(activeTake.hudNote), 480);
      }
      // Don't persist take boards into the main sphere save slot.
      persistSuspended = true;
    }

    // ?deal=1 — preview/OG board with a dig already open (does not wipe player save).
    let wantDeal = false;
    try {
      wantDeal = /(?:\?|&)deal=1(?:&|$)/.test(location.search);
    } catch (_) {}
    // ?fresh=1 — the launcher's "play Sphere" route: start a new board instead
    // of restoring the autosave. The autosave is replaced once the new run
    // persists, exactly as a Reset would.
    let wantFresh = false;
    try {
      wantFresh = /(?:\?|&)fresh=1(?:&|$)/.test(location.search);
    } catch (_) {}

    let restored = false;
    if (activeTake) {
      // Takes always start clean (no restore of main-run progress).
      if (
        activeTake.boardSizeDefault &&
        SIZE_ORDER.includes(activeTake.boardSizeDefault)
      ) {
        state.difficulty = activeTake.boardSizeDefault;
        syncSizeChrome();
      }
      resetGame({ keepPersist: true });
      applyActiveTake();
    } else if (wantDeal) {
      persistSuspended = true;
      resetGame({ keepPersist: true });
      // Prefer a readable size for social stills.
      if (state.difficulty === "xlarge" || state.difficulty === "xsmall") {
        state.difficulty = "medium";
        syncSizeChrome();
      }
      // Slight tilt so the dig reads as a globe, not a flat disk.
      state.rotY = -0.35;
      state.rotX = 0.42;
      state.targetRotY = state.rotY;
      state.targetRotX = state.rotX;
      state.zoomFactor = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, 0.88));
      state.scale = state.baseScale * state.zoomFactor;
      invalidateProjection();
      dealOpeningDig();
    } else if (wantFresh) {
      resetGame();
    } else {
      // Restore before any welcome UI so a saved sphere is not hidden under help.
      restored = tryRestoreRun();
      if (!restored) resetGame();
    }

    try {
      const forceWelcome = /(?:\?|&)welcome=1(?:&|$)/.test(location.search);
      const skipWelcome =
        /(?:\?|&)welcome=0(?:&|$)/.test(location.search) ||
        restored ||
        wantDeal ||
        !!activeTake;
      // The page may supply a first-timer tutorial (opts.onWelcome); it
      // marks the welcome key itself. Otherwise the settings sheet opens.
      const welcome = () => {
        if (typeof opts.onWelcome === "function" && opts.onWelcome()) return;
        openHelp(true);
      };
      if (forceWelcome) welcome();
      else if (!skipWelcome && !localStorage.getItem(WELCOME_KEY)) welcome();
    } catch (_) {
      // Storage blocked — only show help on a truly fresh first board.
      if (!restored && !wantDeal) openHelp(true);
    }

    // Reflection themes need their renderer from the first frame, not the
    // first theme change; the theme's warning treatment likewise.
    applyThemeWarnings(currentThemeDef());
    syncReflectionForTheme();
    scheduleFrame();

    return {
      reset: () => requestReset({ force: true }),
      undo: () => restoreUndo(),
      canUndo: () => !!undoSnapshot,
      floodFrom,
      digAt: (index) => reveal(index),
      flagAt: (index) => toggleFlag(index),
      getState: () => state,
      pickTile,
      projectTile,
      mineTargetForDifficulty,
      exportRunState,
      applyRunState,
      // Direct setters for alternate chrome (see sphere/dev/). The shipped HUD
      // still drives the cycle* wrappers; these change no in-game behaviour.
      setSize: (id) => setDifficulty(id, true),
      setThemeIndex: (i) => applyTheme(i),
      getThemeIndex: () => themeIndex,
      getMenuPatch,
      setMenuInteraction,
      focusPatch,
      releaseFocus,
      pauseTimer: () => stopTimer(),
      resumeTimer: () => {
        if (!state.isGameOver && !state.isFirstClick) startTimer();
      },
      getSphereScreen: () => ({
        cx: state.centerX,
        cy: state.centerY,
        r: state.scale * 1.15,
      }),
      setCountStyle: (id, options) => setCountStyle(id, options),
      setRelief: (mode) => setRelief(mode),
      setSeams: (on) => setSeams(on),
      setAppearanceAxes: (axes) => setAppearanceAxes(axes || {}),
      getAppearance: () => ({
        axes: Object.assign({}, state.appearanceAxes),
        relief: state.relief,
        seams: !!state.seams,
      }),
      setFlagMode: (on) => {
        state.flagMode = !!on;
        if (flagToggle) {
          flagToggle.setAttribute("aria-pressed", state.flagMode ? "true" : "false");
          flagToggle.classList.toggle("active", state.flagMode);
        }
      },
      getInvertDrag: () => ({
        x: !!state.invertDragX,
        y: !!state.invertDragY,
      }),
      setInvertDragX: (on) => {
        state.invertDragX = !!on;
        persistInvert();
        if (syncHelpControls) syncHelpControls();
      },
      setInvertDragY: (on) => {
        state.invertDragY = !!on;
        persistInvert();
        if (syncHelpControls) syncHelpControls();
      },
    };
  }

  global.SphereSweeper = {
    boot,
    CONFIG,
    THEMES,
    DEFAULT_THEME: THEME_LIGHT,
    EFFECTS_KEY,
    effectsReduced,
    applyEffectsAttribute,
    buildRunCompletionPayload,
  };
})(typeof window !== "undefined" ? window : global);
