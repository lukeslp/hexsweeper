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
   * XS=162 · S=362 · M=642 · L=1002 · XL=1442 (n = 4, 6, 8, 10, 12).
   */
  const CONFIG = {
    xsmall: { subdivisions: 4, minePct: 0.17 },
    easy: { subdivisions: 6, minePct: 0.17 },
    medium: { subdivisions: 8, minePct: 0.17 },
    hard: { subdivisions: 10, minePct: 0.17 },
    xlarge: { subdivisions: 12, minePct: 0.17 },
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
      file: "earth_daymap_2k.jpg",
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
    // Magma core borrows Fire / Magma Core palette + boil/mote language
    // (procedural canvas, same family as index.html drawMagmaPitWell).
    return {
      id: spec.id,
      name: spec.name,
      chrome: "dark",
      float: true,
      globeMap: spec.mapId,
      magmaCore: true,
      // Empty digs (lowest tier) open onto the Fire-style core; numbered stay darker.
      wellGlow: true,
      wellGlowHot: "#ffe896",
      wellGlowColor: "#ff5a12",
      wellGlowEmptyBoost: 1.45,
      pureCovered: false,
      pureRevealed: true,
      accent: spec.accent || "#e8eef8",
      bg: "#0a0402",
      bgGlow: "#160a06",
      covered: GLOBE_MAPS[spec.mapId]?.fallback || "#666666",
      coveredHi: "#ffffff",
      coveredEdge: "rgba(0,0,0,0.45)",
      coveredShadow: "#000000",
      tierCovered: GLOBE_MAPS[spec.mapId]?.fallback || "#666666",
      tierFlagged: "#ff2200",
      tierNumbered: "#1a0a06",
      // Warm throat under empty clears — never pure black (that hid the magma).
      tierEmpty: "#3a1408",
      revealed: "#1a0a06",
      revealedEmpty: "#3a1408",
      revealedEdge: "rgba(255,140,40,0.22)",
      valleyGroove: "rgba(255,120,30,0.18)",
      valleyGrooveDeep: "rgba(0,0,0,0.45)",
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
      backface: "#100604",
      backfaceEdge: "#2a1008",
      core: "#1a0804",
      coreGlow: "#ff5a12",
      floatShadow: "rgba(0,0,0,0.4)",
      text: {
        1: "#ffd8a0",
        2: "#ffb070",
        3: "#ff9060",
        4: "#f0c070",
        5: "#f09060",
        6: "#f07080",
      },
      label: "#fff0e0",
      labelStroke: "rgba(40,8,0,0.85)",
      revealFlash: "#ffe8c0",
      revealGlow: "#ff8040",
    };
  }

  const THEME_EARTH = globeTheme({
    id: "earth",
    name: "Earth",
    mapId: "earth",
    accent: "#6ec8ff",
  });
  const THEME_MOON = globeTheme({
    id: "moon",
    name: "Moon",
    mapId: "moon",
    accent: "#d0d4dc",
  });


  /**
   * Water — the globe half-submerged.
   *
   * Sky above the line, open sea below. The surface, the reflection and the
   * refraction are a screen-space post-pass (drawWaterPass) run after the
   * sphere is fully painted, so rotation carries hexes down through the
   * waterline with no change to projection, picking or tile state: a
   * submerged face is an ordinary face that happens to be drawn wet.
   *
   * Wet stone shell against a cold sea; amber flags, because every other
   * signal in the scene is already blue.
   */
  const THEME_WATER = {
    id: "water",
    name: "Water",
    chrome: "dark",
    float: false,
    waterScene: true,
    pureCovered: false,
    pureRevealed: false,
    accent: "#7fe0e8",
    bg: "#04202f",
    bgGlow: "#12617d",
    covered: "#c3dbe4",
    coveredHi: "#f2fbff",
    coveredEdge: "rgba(8,38,54,0.42)",
    coveredShadow: "#3d6273",
    tierCovered: "#c3dbe4",
    tierFlagged: "#ffb454",
    tierNumbered: "#10394d",
    tierEmpty: "#072634",
    revealed: "#10394d",
    revealedEmpty: "#072634",
    revealedEdge: "rgba(140,220,240,0.22)",
    valleyGroove: "rgba(120,200,225,0.18)",
    valleyGrooveDeep: "rgba(0,18,28,0.55)",
    flagFill: "#ffb454",
    flagIcon: "#06202c",
    flagEdge: "#ffd08a",
    mine: "#0b2430",
    mineCore: "#ff8a5c",
    mineEdge: "#02121a",
    mineBurst: "#ffc08a",
    pentagon: "#b6d2dd",
    pentagonEdge: "rgba(8,38,54,0.5)",
    hoverRing: "#eafbff",
    activeRing: "#7fe0e8",
    backface: "#062230",
    backfaceEdge: "#0d3a4e",
    core: "#04202f",
    coreGlow: "#12617d",
    floatShadow: null,
    text: {
      1: "#8fd9f0",
      2: "#6fe3c4",
      3: "#ffab7a",
      4: "#a9b8f5",
      5: "#ffd684",
      6: "#7fe0e8",
    },
    label: "#eafbff",
    labelStroke: "rgba(3,26,40,0.85)",
    revealFlash: "#eafbff",
    revealGlow: "#7fe0e8",
  };

  const THEMES = [
    THEME_LIGHT,
    THEME_SHELL,
    THEME_DARK,
    THEME_INK,
    THEME_FLOAT,
    THEME_CARD,
    THEME_EARTH,
    THEME_MOON,
  ];
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
    medium: 642,
    hard: 1002,
    xlarge: 1442,
  };
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
   * Flagged sits at the same radial height as a hovered covered tile
   * (TIER_COVERED + HOVER_LIFT) so flags match hover extrusion.
   * Flush relief keeps everything at shell height.
   */
  const TIER_FLAGGED = HOVER_LIFT; // was 0.01 — match hover pop
  const TIER_COVERED = 0;
  const TIER_NUMBERED = -0.018;
  const TIER_EMPTY = -0.034;
  /** Legacy count styles that used to imply extrusion (before independent relief). */
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
  };

  /** Loaded equirectangular maps (ImageData cache). */
  const globeCache = Object.create(null);

  function boot(opts) {
    opts = opts || {};
    const canvas = document.getElementById(opts.canvasId || "gameCanvas");
    if (!canvas) throw new Error("SphereSweeper: canvas not found");
    const ctx = canvas.getContext("2d");

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
      return opts.difficulty || "easy";
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

    const state = {
      canvas,
      ctx,
      theme: themePalette(THEMES[themeIndex]),
      waterLevel: 0.5,
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
      // Spatial menu scenes can leave rotation live without allowing a canvas
      // tap, long press, pinch or wheel gesture to mutate gameplay.
      menuRotateOnly: false,
      flagMode: false,
      hovered: -1,
      pressed: -1,
      timeElapsed: 0,
      timerInterval: null,
      reduceMotion: systemReducedMotion(),
      effectsMode: "auto",
      radius: 1,
      baseScale: 200,
      zoomFactor: INITIAL_ZOOM,
      scale: 200,
      centerX: 0,
      centerY: 0,
      projectedCache: null,
      rotCacheKey: "",
      // Modal-only projection study. Never persisted and never active during
      // play; sphere-ux chrome may temporarily turn the globe into a concave
      // chamber while its controls own input.
      chromeProjectionMode: null,
      chromeProjectionProgress: 0,
      chromeProjectionScale: 1.48,
      interiorPlay: false,

      // Eggshell is a renderer-native split of whole faces. Membership is
      // frozen when the menu starts opening so the interlocking seam cannot
      // crawl across the globe while the two shell halves travel apart.
      chromeShellMode: null,
      chromeShellProgress: 0,
      chromeShellGroups: null,
      chromeShellRevision: 0,
      rafScheduled: false,
      detonatorIdx: -1,
      endFx: null,
      camShake: 0,
      ambientSpin:
        !(
          typeof matchMedia === "function" &&
          matchMedia("(prefers-reduced-motion: reduce)").matches
        ),
      lastFrameAt: 0,
      countStyle: readStoredCountStyle(),
      // Surface axes (sphere-ux experiment) — independent of count paint mode.
      // relief: extruded | flush. seams: honeycomb edges on cleared faces.
      relief: "extruded",
      seams: true,
      // Classic mono axes when pack is "classic"; packs lock a full theme.
      appearancePack: "classic",
      appearanceAxes: { field: "light", shell: "light", well: "dark" },
      invertDragX: storedInvert.x,
      invertDragY: storedInvert.y,
    };

    // Seed relief/seams from legacy count styles that used to encode them.
    (function seedSurfaceFromCountStyle() {
      const cs = state.countStyle;
      if (cs === "flush" || cs === "yellow") state.relief = "flush";
      else state.relief = "extruded";
      if (cs === "borderless") state.seams = false;
      else state.seams = true;
    })();

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
      };
    }

    function restoreUndo() {
      if (!undoSnapshot) return false;
      const snap = undoSnapshot;
      undoSnapshot = null;
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
      // Prefer absolute (works in collection/ CodePen); fall back to relative under sphere/.
      try {
        if (/\/sphere\/?$|\/sphere\//.test(location.pathname)) {
          return new URL(`assets/textures/${meta.file}`, location.href).href;
        }
      } catch (_) {}
      return GLOBE_TEX_BASE + meta.file;
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
          `Theme: ${t.name}. Activate to cycle Light, Shell, Dark, Ink, Float, Card, Earth, Moon.`
        );
        // Keep stub empty — visible theme UI lives in settings; injecting SVG here
        // used to leak paint over the BR gear when the legacy tray failed to clip.
        themeBtn.innerHTML = "";
      }
    }

    function syncSizeChrome() {
      const key = state.difficulty;
      const letter = SIZE_LABEL[key] || "M";
      const name = SIZE_NAMES[key] || "Medium";
      const faces = SIZE_FACES[key] || 362;
      if (sizeBtn) {
        sizeBtn.title = `Board size ${letter} — ${name} (${faces} faces). Click to cycle XS → S → M → L → XL.`;
        sizeBtn.setAttribute(
          "aria-label",
          `Board size ${letter}, ${name}, ${faces} faces. Activate to cycle XS, S, M, L, XL.`
        );
        // Empty stub only (no size-mark letter paint).
        sizeBtn.innerHTML = "";
      }
    }

    function applyTheme(index, optsApply) {
      optsApply = optsApply || {};
      themeIndex = ((index % THEMES.length) + THEMES.length) % THEMES.length;
      const def = currentThemeDef();
      state.theme = themePalette(def);
      // Clear per-tile globe cache when leaving/entering a map theme.
      if (state.tiles) {
        for (let i = 0; i < state.tiles.length; i++) {
          state.tiles[i]._globeCss = null;
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

    /**
     * Surface row in the ? modal — Earth / Moon as quiet curiosities
     * rather than dock tiles. Classic returns to the three-axis mono look, so
     * the row is a way in *and* a way back.
     */
    let syncHelpPacks = null;

    function bindHelpPacks() {
      const row = document.getElementById("help-packs");
      if (!row) return;
      const buttons = Array.from(row.querySelectorAll("[data-pack]"));
      syncHelpPacks = () => {
        const cur = state.appearancePack || "classic";
        for (const b of buttons) {
          b.setAttribute("aria-pressed", b.dataset.pack === cur ? "true" : "false");
        }
      };
      row.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-pack]");
        if (!btn) return;
        setAppearancePack(btn.dataset.pack);
        syncHelpPacks();
      });
      syncHelpPacks();
    }


    /**
     * Controls row in the ? modal: Invert drag and Effects. Set-once plumbing
     * moved out of the bloom (discuss verdict 2026-08-10) — unlike the failed
     * split-dock, these are not identity controls anyone scans the menu for.
     */
    let syncHelpControls = null;

    function bindHelpControls() {
      const row = document.getElementById("help-controls");
      if (!row) return;
      const invBtn = row.querySelector('[data-ctl="invert"]');
      const fxBtn = row.querySelector('[data-ctl="effects"]');
      const INV = [
        [false, false, "Invert off"],
        [true, false, "Invert X"],
        [false, true, "Invert Y"],
        [true, true, "Invert X+Y"],
      ];
      const FX = { auto: "Effects auto", full: "Effects full", reduced: "Effects reduced" };
      const invIndex = () =>
        INV.findIndex(
          ([x, y]) => x === !!state.invertDragX && y === !!state.invertDragY
        );
      syncHelpControls = () => {
        if (invBtn) invBtn.textContent = INV[Math.max(0, invIndex())][2];
        if (fxBtn) fxBtn.textContent = FX[state.effectsMode] || FX.auto;
      };
      if (invBtn) {
        invBtn.addEventListener("click", () => {
          const [x, y] = INV[(Math.max(0, invIndex()) + 1) % INV.length];
          state.invertDragX = x;
          state.invertDragY = y;
          persistInvert();
          syncHelpControls();
        });
      }
      if (fxBtn) {
        fxBtn.addEventListener("click", () => {
          const order = ["auto", "full", "reduced"];
          applyEffectsMode(
            order[(order.indexOf(state.effectsMode) + 1) % order.length]
          );
          syncHelpControls();
        });
      }
      syncHelpControls();
    }

    function openHelp(fromWelcome) {
      if (!helpOverlay) return;
      if (fromWelcome) markWelcomeSeen = true;
      helpFocusReturn =
        document.activeElement && document.activeElement !== document.body
          ? document.activeElement
          : helpBtn;
      helpOverlay.hidden = false;
      // The dock can change the pack too; re-read on every open.
      if (syncHelpPacks) syncHelpPacks();
      if (syncHelpControls) syncHelpControls();
      document.body.classList.add("help-open");
      requestAnimationFrame(() => helpOverlay.classList.add("open"));
      if (releaseFocusTrap) releaseFocusTrap();
      releaseFocusTrap = trapFocus(helpOverlay);
      (helpPanel || helpOverlay).focus?.();
    }

    function closeHelp() {
      if (!helpOverlay) return;
      if (markWelcomeSeen) {
        try {
          localStorage.setItem(WELCOME_KEY, "1");
        } catch (_) {}
        markWelcomeSeen = false;
      }
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

    /** 0 = globe fully above the surface, 1 = fully under. 0.5 = half. */
    function readWaterLevel() {
      try {
        const raw = new URLSearchParams(location.search).get("water");
        if (raw != null) {
          const v = parseFloat(raw);
          if (Number.isFinite(v)) return Math.max(0, Math.min(1, v > 1 ? v / 100 : v));
        }
      } catch (_) {}
      return 0.5;
    }

    function setWaterLevel(v) {
      state.waterLevel = Math.max(0, Math.min(1, v));
      scheduleFrame();
    }

    function bindWaterLevel() {
      const el = document.getElementById("water-level");
      if (!el) return;
      el.value = String(Math.round(state.waterLevel * 100));
      el.addEventListener("input", () => {
        setWaterLevel(parseFloat(el.value) / 100);
      });
    }

    const EFFECTS_KEY = "hexsweeper-sphere-effects-v1";

    function systemReducedMotion() {
      return (
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    }

    /** Auto follows the OS; Full and Reduced override it. */
    function applyEffectsMode(mode, opts) {
      const m = mode === "full" || mode === "reduced" ? mode : "auto";
      state.effectsMode = m;
      state.reduceMotion =
        m === "reduced" ? true : m === "full" ? false : systemReducedMotion();
      state.ambientSpin = state.ambientSpin && !state.reduceMotion;
      if (!opts || opts.persist !== false) {
        try {
          localStorage.setItem(EFFECTS_KEY, m);
        } catch (_) {}
      }
      scheduleFrame();
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
      state.baseScale = Math.min(w, h) * BASE_SCALE_FRAC;
      state.scale = state.baseScale * state.zoomFactor;
      state.projectedCache = null;
      // The chamber's scale is derived from the viewport, and interior play
      // holds that projection open indefinitely — so it has to be recomputed
      // here or the wall stops filling the frame after a rotate or resize.
      if (state.interiorPlay) setChromeProjection("chamber", 1);
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

    function clampUnit(value) {
      return Math.max(0, Math.min(1, value));
    }

    function smoothUnit(value) {
      const t = clampUnit(value);
      return t * t * (3 - 2 * t);
    }

    /**
     * Chamber turns from the screen centre outward. The radius term is based
     * only on a shared rotated vertex, so adjacent faces always project their
     * common edge through the same fold and cannot tear apart mid-animation.
     */
    function chamberFoldAtRotated(r) {
      if (
        state.chromeProjectionMode !== "chamber" ||
        state.chromeProjectionProgress <= 0
      ) {
        return 0;
      }
      const radius = clampUnit(Math.hypot(r.x, r.y));
      return smoothUnit(state.chromeProjectionProgress * 1.7 - radius * 0.7);
    }

    function projectRotated(r) {
      const fov = 2.8;
      const convex = fov / (fov - r.z);
      let depth = convex;
      if (
        state.chromeProjectionMode === "chamber" &&
        state.chromeProjectionProgress > 0
      ) {
        const fold = chamberFoldAtRotated(r);
        const concave = (fov / (fov + r.z)) * state.chromeProjectionScale;
        depth = convex + (concave - convex) * fold;
      }
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

    function shellTransformRotated(r, tileIndex) {
      if (
        state.chromeShellMode !== "eggshell" ||
        state.chromeShellProgress <= 0 ||
        !state.chromeShellGroups
      ) {
        return r;
      }
      const raw = Math.max(0, Math.min(1, state.chromeShellProgress));
      const eased = raw * raw * (3 - 2 * raw);
      const group = state.chromeShellGroups[tileIndex] || 1;
      // A rigid camera-space translation keeps every shared vertex inside a
      // half coincident. Only edges crossing the frozen partition separate,
      // producing a real tile-boundary seam instead of bisected face art.
      return {
        x: r.x,
        y: r.y + group * 0.43 * eased,
        z: r.z + 0.035 * eased,
      };
    }

    function projectTile(tile, rotY, rotX, lift) {
      const liftAmt = lift || 0;
      const n = faceNormal(tile, rotY, rotX);
      const liftVec = (p) => {
        const r = rotatePoint(p, rotY, rotX);
        return shellTransformRotated({
          x: r.x + n.x * liftAmt,
          y: r.y + n.y * liftAmt,
          z: r.z + n.z * liftAmt,
        }, tile.index);
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
            ? tile.boundary.map((b) =>
                projectRotated(
                  shellTransformRotated(rotatePoint(b, rotY, rotX), tile.index)
                )
              )
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
      return `${state.rotY.toFixed(4)}|${state.rotX.toFixed(4)}|${state.scale}|${state.chromeProjectionMode || "none"}|${state.chromeProjectionProgress.toFixed(4)}|${state.chromeProjectionScale.toFixed(3)}|${state.chromeShellMode || "none"}|${state.chromeShellProgress.toFixed(4)}|${state.chromeShellRevision}`;
    }

    /** Project all tiles once per frame; cull back hemisphere for pick + draw. */
    function getProjected() {
      const key = rotKey();
      if (state.projectedCache && state.rotCacheKey === key) {
        return state.projectedCache;
      }
      const all = state.tiles.map((t) => projectTile(t, state.rotY, state.rotX));
      const front =
        state.chromeProjectionMode === "chamber"
          ? all
          : all.filter((p) => p.z > -0.05);
      // Chamber keeps one stable far-to-near geometric order while the back
      // hemisphere becomes the wall seen through its central aperture. A
      // depth-derived sort changes direction halfway through the projection
      // and reads as a second, unrelated animation step.
      if (state.chromeProjectionMode === "chamber") {
        front.sort((a, b) => a.z - b.z || a.index - b.index);
      } else {
        front.sort(
          (a, b) => a.center.depth - b.center.depth || a.z - b.z
        );
      }
      state.projectedCache = front;
      state.rotCacheKey = key;
      return front;
    }

    /**
     * Draw-only view of the inside of both Eggshell halves. Gameplay still
     * sees the ordinary culled front list; this second pass only exposes the
     * real rear-facing mesh through the opening, with no labels or hit area.
     */
    function getEggshellInteriorProjected() {
      if (
        state.chromeShellMode !== "eggshell" ||
        state.chromeShellProgress <= 0.03 ||
        !state.chromeShellGroups
      ) {
        return [];
      }
      return state.tiles
        .map((tile) => projectTile(tile, state.rotY, state.rotX))
        .filter((proj) => proj.z <= -0.05)
        .sort(
          (a, b) => a.center.depth - b.center.depth || a.z - b.z
        );
    }

    function invalidateProjection() {
      state.projectedCache = null;
    }

    /**
     * ?fold=<0..1> pins the chamber at a fixed fold instead of letting the
     * dock tween it. A study aid: it parks the projection anywhere on its
     * travel so the geometry can be judged (or captured) at a chosen depth,
     * which a timing-dependent animation otherwise makes impossible.
     */
    const foldPinRaw = new URLSearchParams(location.search).get("fold");
    const foldPin =
      foldPinRaw == null || foldPinRaw === "" || Number.isNaN(Number(foldPinRaw))
        ? null
        : Math.max(0, Math.min(1, Number(foldPinRaw)));

    /**
     * Interior play: stand inside the sphere and play the wall.
     *
     * The chamber projection was only ever a menu affordance — opened with the
     * dock, torn down with it. This makes it a mode that simply stays on, with
     * no dock and no spatial menu, so the concave view is the board rather
     * than a backdrop for chrome. Everything else about play is untouched:
     * digging, flagging, drag-to-rotate and the ordinary HUD all behave
     * exactly as they do outside.
     */
    function setInteriorPlay(on) {
      state.interiorPlay = !!on;
      if (state.interiorPlay) {
        setChromeProjection("chamber", 1);
      } else {
        setChromeProjection(null, 0);
      }
    }

    function setChromeProjection(mode, progress) {
      const nextMode = mode === "chamber" ? "chamber" : null;
      const nextProgress = nextMode
        ? foldPin != null
          ? foldPin
          : Math.max(0, Math.min(1, Number(progress) || 0))
        : 0;
      state.chromeProjectionMode = nextMode;
      state.chromeProjectionProgress = nextProgress;
      if (nextMode) {
        // No aperture is cut at all now (see the note by chamberBackAlpha),
        // so there is no tile list to choose here either.
        const w = canvas.clientWidth || window.innerWidth;
        const h = canvas.clientHeight || window.innerHeight;
        const baseR = Math.max(1, state.scale);
        // Luke, 2026-08-21: go the other way. The old cap held the annulus to
        // 88% of the short edge so the chamber still read as one complete
        // globe seen from outside — but the whole point is to be *inside* it.
        // Target the viewport diagonal instead, so the tiled wall runs past
        // every corner and the dark outer rim is pushed off-screen: what is
        // left is tiles all the way out, with the inverted backdrop covering
        // whatever sliver remains.
        const targetR = Math.hypot(w, h) * 0.62;
        state.chromeProjectionScale = Math.min(
          2.8,
          Math.max(1.18, targetR / baseR)
        );
      } else {
        state.chromeProjectionScale = 1.48;
      }
      invalidateProjection();
      scheduleFrame();
    }

    function setChromeShell(mode, progress) {
      const nextMode = mode === "eggshell" ? "eggshell" : null;
      const nextProgress = nextMode
        ? Math.max(0, Math.min(1, Number(progress) || 0))
        : 0;
      if (
        nextMode &&
        (!state.chromeShellGroups ||
          state.chromeShellGroups.length !== state.tiles.length)
      ) {
        const groups = [];
        state.tiles.forEach((tile) => {
          const rotated = rotatePoint(tile.centerPoint, state.rotY, state.rotX);
          groups[tile.index] = rotated.y >= 0 ? 1 : -1;
        });
        state.chromeShellGroups = groups;
        state.chromeShellRevision += 1;
      }
      state.chromeShellMode = nextMode;
      state.chromeShellProgress = nextProgress;
      if (!nextMode) {
        state.chromeShellGroups = null;
        state.chromeShellRevision += 1;
      }
      invalidateProjection();
      scheduleFrame();
    }

    /**
     * Inner-menu bridge.
     *
     * A menu that lives *inside* the sphere cannot be a DOM overlay. The
     * canvas is one opaque element, so no z-index will ever put a menu tile
     * behind a board tile — every previous dock could only fake depth. Here
     * the menu hands us projected polygons each frame and we merge them into
     * the same back-to-front sort the shell already uses, so the sphere's own
     * faces occlude them for free as it turns.
     *
     * The split: the renderer owns depth, paint order and the shell fade; the
     * menu owns seat geometry, labels and hit-testing. None of this runs
     * unless a menu registers *and* reports itself open, so the default sphere
     * is untouched.
     */
    let innerMenu = null;
    function setInnerMenu(api) {
      innerMenu = api || null;
      scheduleFrame();
    }
    function innerMenuActive() {
      return !!(innerMenu && innerMenu.isOpen && innerMenu.isOpen());
    }
    /**
     * Project a point given in unrotated sphere space, where radius 1 is the
     * shell. The inner menu seats itself below that and rides the same camera.
     */
    function projectLocalPoint(p) {
      return projectPoint(p, state.rotY, state.rotX);
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
     * Return one real front-facing hex and its six projected neighbours for
     * chrome experiments that inhabit the board instead of floating over it.
     * Coordinates are CSS pixels in the canvas coordinate space. A hex is
     * deliberately preferred over the twelve Goldberg pentagons so callers
     * always receive a complete seven-face patch.
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
      // Paint order is the truth: whatever was drawn last at this point is
      // what the player is looking at, and getProjected() is already in draw
      // order, so walking it backwards finds it.
      //
      // Outside the sphere the z filter only stops you picking through to the
      // far side, which is culled anyway. Inside the chamber the wall you are
      // looking at IS the far hemisphere, so that same filter would make the
      // entire interior unclickable — which is why interior play needs it
      // dropped rather than inverted.
      const all = getProjected();
      const projected =
        state.chromeProjectionMode === "chamber"
          ? all
          : all.filter((p) => p.z > 0.02);
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
      for (let i = 0; i < state.cells.length; i++) {
        state.cells[i].neighborMines = countNeighborMines(i);
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
        // Pre-first dig: mineCount is still 0 — show the planned mine total so
        // "Left" is live from the first paint (not a dead 00).
        const faceN =
          state.cells.length || SIZE_FACES[state.difficulty] || 362;
        const left =
          state.isFirstClick && state.mineCount === 0
            ? mineTargetForDifficulty(faceN)
            : Math.max(0, state.mineCount - state.flagsPlaced);
        statsMines.textContent = String(left).padStart(2, "0");
      }
      if (statsTime) {
        statsTime.textContent =
          String(Math.max(0, state.timeElapsed | 0)).padStart(3, "0") + "s";
      }
    }

    function stopAmbientSpin() {
      if (!state.ambientSpin) return;
      state.ambientSpin = false;
      state.targetRotY = state.rotY;
      state.targetRotX = state.rotX;
    }

    function tickAmbientSpin(now) {
      if (
        !state.ambientSpin ||
        state.reduceMotion ||
        state.dragging ||
        state.chromeShellMode ||
        state.chromeProjectionMode
      ) return false;
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
      // Fresh board: resume idle spin until the player touches the canvas again.
      state.ambientSpin = !state.reduceMotion;
      state.mineCount = mineTargetForDifficulty(state.tiles.length);
      invalidateProjection();
      ensureGlobeForTheme(state.theme);
      bakeGlobeTileColors();
      updateUI();
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
      return {
        v: 2,
        kind: "sphere",
        difficulty: state.difficulty,
        tileCount: state.cells.length,
        first: !!state.isFirstClick,
        over: !!state.isGameOver,
        won: !!state.won,
        flags: state.flagsPlaced | 0,
        mineCount: state.mineCount | 0,
        time: state.timeElapsed | 0,
        rotY: state.rotY,
        rotX: state.rotX,
        zoom: state.zoomFactor,
        mines,
        revealed,
        flagged,
        savedAt: Date.now(),
      };
    }

    /** Explicit clear only — Reset button / size change / invalid save. */
    function clearPersist() {
      storageRemove(localStorage, RUN_STORAGE_KEY);
      storageRemove(localStorage, RUN_STORAGE_KEY_LEGACY);
      storageRemove(sessionStorage, RUN_STORAGE_KEY);
      storageRemove(sessionStorage, RUN_STORAGE_KEY_LEGACY);
    }

    function writePersistPayload(json) {
      // Dual-write: session for same-tab reload resilience, local for return visits.
      const a = storageSet(localStorage, RUN_STORAGE_KEY, json);
      const b = storageSet(sessionStorage, RUN_STORAGE_KEY, json);
      return a || b;
    }

    function flushPersist() {
      if (persistSuspended) return false;
      const data = exportRunState();
      if (!data) {
        // Fresh board: do NOT wipe an existing save here. Only clearPersist()
        // (Reset / size) should drop a stored run. Avoids races wiping progress.
        return false;
      }
      return writePersistPayload(JSON.stringify(data));
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
      if (!data || data.kind !== "sphere") return false;
      if (data.v !== 1 && data.v !== 2) return false;
      if (!SIZE_ORDER.includes(data.difficulty)) return false;
      if (!global.Hexasphere || typeof global.Hexasphere.generateHexasphere !== "function") {
        return false;
      }

      persistSuspended = true;
      stopTimer();
      clearEndFx();
      hideBanner();

      state.difficulty = data.difficulty;
      syncSizeChrome();
      try {
        localStorage.setItem(SIZE_STORAGE_KEY, data.difficulty);
      } catch (_) {}

      const cfg = CONFIG[state.difficulty];
      state.sphere = Hexasphere.generateHexasphere(1, cfg.subdivisions);
      state.tiles = state.sphere.tiles;
      attachEdgeNeighbors();
      state.cells = state.tiles.map(() => freshCell());
      const n = state.cells.length;

      const mineList = Array.isArray(data.mines) ? data.mines : [];
      const revealedList = Array.isArray(data.revealed) ? data.revealed : [];
      const flaggedList = Array.isArray(data.flagged) ? data.flagged : [];

      // Size ladder changes (or corrupt saves) must not clip indices onto a smaller board.
      if (Number.isFinite(data.tileCount) && (data.tileCount | 0) !== n) {
        persistSuspended = false;
        return false;
      }
      const listsOutOfRange = [mineList, revealedList, flaggedList].some((list) =>
        list.some((idx) => (idx | 0) === idx && idx >= n)
      );
      if (listsOutOfRange) {
        persistSuspended = false;
        return false;
      }

      // Started game with no mines recorded = corrupt save (post-first-dig always has mines).
      if (!data.first && mineList.length === 0 && !data.over) {
        persistSuspended = false;
        return false;
      }

      for (const idx of mineList) {
        if ((idx | 0) === idx && idx >= 0 && idx < n) state.cells[idx].isMine = true;
      }
      for (const idx of revealedList) {
        if ((idx | 0) !== idx || idx < 0 || idx >= n) continue;
        const c = state.cells[idx];
        c.revealed = true;
        c.animReveal = 1;
        c.visualDue = 0;
        c.pulseAt = 0;
      }
      let flags = 0;
      for (const idx of flaggedList) {
        if ((idx | 0) !== idx || idx < 0 || idx >= n) continue;
        const c = state.cells[idx];
        if (c.revealed) continue;
        c.flagged = true;
        flags++;
      }
      computeAllCounts();

      state.isFirstClick = !!data.first;
      state.isGameOver = !!data.over;
      state.won = !!data.won;
      state.detonatorIdx = -1;
      state.flagsPlaced =
        Number.isFinite(data.flags) ? data.flags | 0 : flags;
      state.mineCount = Number.isFinite(data.mineCount)
        ? data.mineCount | 0
        : mineList.length || mineTargetForDifficulty(n);
      state.timeElapsed = data.time | 0;
      state.hovered = -1;
      state.pressed = -1;
      state.camShake = 0;
      // Fresh-ish (flags only, no dig yet): allow ambient spin again.
      state.ambientSpin = !!data.first && !state.reduceMotion && flags === 0;

      if (Number.isFinite(data.rotY)) {
        state.rotY = data.rotY;
        state.targetRotY = data.rotY;
      }
      if (Number.isFinite(data.rotX)) {
        state.rotX = data.rotX;
        state.targetRotX = data.rotX;
      }
      if (Number.isFinite(data.zoom)) {
        state.zoomFactor = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, data.zoom));
        state.scale = state.baseScale * state.zoomFactor;
      }

      invalidateProjection();
      ensureGlobeForTheme(state.theme);
      bakeGlobeTileColors();
      updateUI();

      if (!state.isFirstClick && !state.isGameOver) {
        startTimer(state.timeElapsed);
      }
      if (state.isGameOver) {
        if (state.won) {
          showBanner("Cleared the sphere!", {
            share: true,
            meta: `${formatTime(state.timeElapsed)} · ${state.mineCount} mines · ${SIZE_LABEL[state.difficulty] || "M"}`,
          });
        } else {
          showBanner("Mine detonated.", { share: false });
        }
      }

      persistSuspended = false;
      // Re-write under v2 key so legacy saves migrate.
      flushPersist();
      return true;
    }

    function readStoredRun() {
      const keys = [RUN_STORAGE_KEY, RUN_STORAGE_KEY_LEGACY];
      const stores = [sessionStorage, localStorage];
      let best = null;
      let bestAt = -1;
      for (const store of stores) {
        for (const key of keys) {
          const raw = storageGet(store, key);
          if (!raw) continue;
          try {
            const data = JSON.parse(raw);
            if (!data || data.kind !== "sphere") continue;
            const at = Number(data.savedAt) || 0;
            if (at >= bestAt) {
              best = data;
              bestAt = at;
            }
          } catch (_) {
            /* skip bad payload */
          }
        }
      }
      return best;
    }

    function tryRestoreRun() {
      // ?fresh=1 forces a clean board (dev / explicit wipe) without touching themes.
      try {
        if (/(?:\?|&)fresh=1(?:&|$)/.test(location.search)) {
          clearPersist();
          return false;
        }
      } catch (_) {}

      const data = readStoredRun();
      if (!data) return false;
      const ok = applyRunState(data);
      if (!ok) {
        // Corrupt for current build — drop so we do not loop-fail.
        clearPersist();
        return false;
      }
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
    function floodFrom(startIdx) {
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
          c.revealed = true;
          scheduleRevealVisual(n, dist + 1);
          opened.add(n);
          if (c.neighborMines === 0) queue.push({ idx: n, dist: dist + 1 });
        }
      }
      return opened;
    }

    function reveal(idx) {
      const cell = state.cells[idx];
      if (!cell || cell.revealed || cell.flagged || state.isGameOver) return;
      if (state.isFirstClick) {
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
        gameOver(false);
        return;
      }
      if (cell.neighborMines === 0) floodFrom(idx);
      checkWin();
      persistNow();
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
      if (!cell || cell.revealed || state.isGameOver) return;
      cell.flagged = !cell.flagged;
      state.flagsPlaced += cell.flagged ? 1 : -1;
      updateUI();
      persistNow();
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
      if (safeRevealed === safeTotal) gameOver(true);
    }

    function gameOver(won) {
      state.isGameOver = true;
      state.won = won;
      stopTimer();
      if (!won) {
        startLoseFx(state.detonatorIdx >= 0 ? state.detonatorIdx : 0);
        showBanner("Mine detonated.", { share: false });
      } else {
        startWinFx();
        showBanner("Cleared the sphere!", {
          share: true,
          meta: `${formatTime(state.timeElapsed)} · ${state.mineCount} mines · ${SIZE_LABEL[state.difficulty] || "M"}`,
        });
      }
      persistNow();
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
        shareWinBtn.hidden = !opts.share;
        shareWinBtn.disabled = !opts.share;
        if (opts.share) setShareState("idle");
      }
      if (bannerUndoBtn) bannerUndoBtn.hidden = !undoSnapshot;
      pendingShareFile = null;
      if (opts.share) prepareShareFile();
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
      idle: "Share image",
      busy: "Preparing image…",
      error: "Share failed",
    };
    function setShareState(kind) {
      if (!shareWinBtn) return;
      const label = SHARE_LABEL[kind] || SHARE_LABEL.idle;
      shareWinBtn.dataset.state = kind;
      shareWinBtn.title = label;
      shareWinBtn.setAttribute("aria-label", label);
      const sr = shareWinBtn.querySelector(".sr-only");
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
        const text = shareLabels().text;
        const url = "https://dr.eamer.dev/games/hexsweeper/sphere/";
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

    /**
     * Radial center glow clipped to the hex face (Glow theme / wellGlow themes).
     * Empty clears run hotter; numbered wells stay softer so digits stay readable.
     * Magma-core globes (Earth/Moon): empty digs = Fire throat; numbered softer ember.
     */
    function drawWellCenterGlow(proj, cell, now) {
      const T = state.theme;
      if (!T || !cell || !cell.revealed || cell.isMine) return;
      const magma = !!T.magmaCore;
      if (!T.wellGlow && !magma) return;
      // Magma: only the lowest tier (empty) gets the full throat; numbers stay dark.
      if (magma && cell.neighborMines > 0) return;
      if (!proj.boundary || proj.boundary.length < 3) return;
      const cx = proj.center.x;
      const cy = proj.center.y;
      const outer = Math.sqrt(Math.max(24, proj.area));
      const r = outer * (cell.neighborMines === 0 ? (magma ? 0.78 : 0.62) : 0.48);
      let boost = cell.neighborMines === 0 ? T.wellGlowEmptyBoost || 1.1 : 0.62;
      if (magma) boost *= 1.15;
      // Brief hotter flash right after dig.
      if (!state.reduceMotion && cell.pulseAt) {
        const age = now - cell.pulseAt;
        if (age >= 0 && age < REVEAL_FLASH_MS * 1.4) {
          const flash = 1 - age / (REVEAL_FLASH_MS * 1.4);
          boost += flash * 0.55;
        }
      }
      const hot = T.wellGlowHot || (magma ? "#ffe896" : "#ffffff");
      const mid = T.wellGlowColor || T.coreGlow || T.accent || "#88ccff";
      const a0 = Math.min(0.98, (magma ? 0.92 : 0.72) * boost);
      const a1 = Math.min(0.85, (magma ? 0.62 : 0.42) * boost);
      ctx.save();
      if (!drawHexPath(proj)) {
        ctx.restore();
        return;
      }
      ctx.clip();
      // Magma wells: additive so the underlayer + fill read as molten.
      if (magma) ctx.globalCompositeOperation = "lighter";
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

    /** Whether permanent height tiers are active (independent of count paint). */
    function reliefIsExtruded() {
      if (state.relief === "flush") return false;
      if (state.relief === "extruded") return true;
      // Fallback for older sessions: legacy count-style encoding
      return EXTRUDED_STYLES.has(state.countStyle);
    }

    /** Whether cleared faces keep honeycomb strokes. */
    function seamsEnabled() {
      if (state.seams === false) return false;
      if (state.seams === true) return true;
      return state.countStyle !== "borderless";
    }

    /**
     * Permanent radial height for a cell (before hover/press).
     * Flagged matches hover height of a covered tile when extruded.
     * Flush relief keeps the whole board at shell height.
     */
    function tileHeight(cell, styleId) {
      if (!cell) return TIER_COVERED;
      const extruded = reliefIsExtruded();
      if (cell.flagged && !cell.revealed) {
        // Same as covered + HOVER_LIFT (TIER_FLAGGED === HOVER_LIFT).
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
    function attachEdgeNeighbors() {
      const pointKey = (p) =>
        `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.z.toFixed(6)}`;
      const edgeMap = new Map();
      for (let ti = 0; ti < state.tiles.length; ti++) {
        const b = state.tiles[ti].boundary;
        state.tiles[ti].edgeNeighbors = new Array(b.length).fill(-1);
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
        state.tiles[a.ti].edgeNeighbors[a.ei] = b.ti;
        state.tiles[b.ti].edgeNeighbors[b.ei] = a.ti;
      });
    }

    /** Cliff/skirt fill — into black wells vs into white wells. */
    function skirtFill(nw) {
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
     * Seamless mode strips strokes on cleared faces only.
     * (Valley pass must not re-apply grooves when seamless.)
     * Count style "borderless" still forces seamless for legacy saves.
     */
    function drawColorsForStyle(colors, styleId, cell) {
      const seamless = !seamsEnabled() || styleId === "borderless";
      if (!seamless) return colors;
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
      // Empty stub only — no numeral glyph paint (was leaking over the gear).
      nestBtn.innerHTML = "";
    }

    function setCountStyle(id, optsSet) {
      optsSet = optsSet || {};
      const def = COUNT_STYLES.find((s) => s.id === id);
      if (!def) return;
      state.countStyle = def.id;
      // Legacy count styles that also meant surface: keep in sync when cycled.
      if (optsSet.syncSurface !== false) {
        if (def.id === "flush" || def.id === "yellow") state.relief = "flush";
        else if (def.id === "numerals" || def.id === "rings" || def.id === "borderless") {
          if (state.relief !== "flush" || optsSet.forceRelief)
            state.relief = "extruded";
        }
        if (def.id === "borderless") state.seams = false;
        else if (optsSet.forceSeams !== false && def.id !== "borderless") {
          // Don't clobber explicit seamless when only changing numerals/rings.
        }
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

    /**
     * Classic mono appearance from three axes (sphere-ux experiment).
     * field = page/bg, shell = covered outer, well = dug inner.
     * Independent well (not forced opposite of shell).
     */
    function buildAxesTheme(axes) {
      const fieldLight = (axes && axes.field) !== "dark";
      const shellLight = (axes && axes.shell) !== "dark";
      const wellLight = (axes && axes.well) !== "dark";
      const well = wellLight ? "#ffffff" : "#000000";
      const covered = shellLight ? "#ffffff" : "#000000";
      const bg = fieldLight ? "#ffffff" : "#000000";
      return {
        id: "classic-axes",
        name: "Classic",
        chrome: fieldLight ? "light" : "dark",
        float: false,
        pureCovered: true,
        pureRevealed: true,
        accent: fieldLight ? "#000000" : "#ffffff",
        bg,
        bgGlow: bg,
        covered,
        coveredHi: covered,
        coveredEdge: shellLight ? "#000000" : "#ffffff",
        coveredShadow: shellLight ? "#cccccc" : "#000000",
        tierCovered: covered,
        tierFlagged: "#ff0000",
        tierNumbered: well,
        tierEmpty: well,
        revealed: well,
        revealedEmpty: well,
        revealedEdge: wellLight ? "#999999" : "#6a6a6a",
        valleyGroove: wellLight ? "#777777" : "#8a8a8a",
        valleyGrooveDeep: wellLight ? "#cccccc" : "#3a3a3a",
        flagFill: "#ff0000",
        flagIcon: "#ffffff",
        flagEdge: "#ff0000",
        mine: wellLight ? "#ffffff" : "#000000",
        mineCore: wellLight ? "#000000" : "#ffffff",
        mineEdge: wellLight ? "#cccccc" : "#000000",
        mineBurst: wellLight ? "#000000" : "#ffffff",
        pentagon: covered,
        pentagonEdge: shellLight ? "#000000" : "#ffffff",
        hoverRing: shellLight ? "#000000" : "#ffffff",
        activeRing: shellLight ? "#222222" : "#dddddd",
        backface: well,
        backfaceEdge: wellLight ? "#cccccc" : "#333333",
        core: well,
        floatShadow: null,
        text: wellLight
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
        // Warning emphasis: yellow-leaning when wells are dark; gold when light wells
        warning: "#e6b800",
        label: wellLight ? "#000000" : "#ffffff",
        labelStroke: wellLight ? "#ffffff" : "#000000",
        revealFlash: wellLight ? "#000000" : "#ffffff",
        revealGlow: wellLight ? "#666666" : "#888888",
      };
    }

    function setAppearanceAxes(axes) {
      state.appearancePack = "classic";
      state.appearanceAxes = {
        field: axes.field === "dark" ? "dark" : "light",
        shell: axes.shell === "dark" ? "dark" : "light",
        well: axes.well === "dark" ? "dark" : "light",
      };
      state.theme = buildAxesTheme(state.appearanceAxes);
      syncChromeTheme();
      scheduleFrame();
    }

    function setAppearancePack(packId) {
      const pack = String(packId || "classic");
      if (pack === "classic") {
        state.appearancePack = "classic";
        state.theme = buildAxesTheme(state.appearanceAxes);
        syncChromeTheme();
        scheduleFrame();
        return;
      }
      const i = THEMES.findIndex((t) => t.id === pack);
      if (i < 0) return;
      state.appearancePack = pack;
      applyTheme(i);
      scheduleFrame();
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
      const origin = shellTransformRotated({
        x: c.x + n.x * lift,
        y: c.y + n.y * lift,
        z: c.z + n.z * lift,
      }, tile.index);
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
          lineWidth: tile.isPentagon ? 1.6 : 1.15,
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

    function tileColors(idx, proj, cell, tile, now) {
      const T = state.theme;
      const lit = shadeByNormal;
      const isBack = proj.z <= 0.02;
      const isFront = proj.z > 0.08;
      const darkMono = !!(T.pureCovered || T.id === "dark");

      // Flags: pure fill only — no glyph (color is enough). Optional halo for takes.
      if (cell.flagged && !cell.revealed) {
        return {
          fill: T.tierFlagged || T.flagFill,
          // Translucent dark seam: reads as a darker line of the flag color
          // over the fill AND covers the projection gap between lifted flag
          // faces. Opaque seam ink here made fat pale channels between
          // adjacent flags; pure flag color made them fuse. Takes keep halos.
          stroke: T.takeFlagHalo ? T.flagEdge : "rgba(0,0,0,0.38)",
          lineWidth: T.takeFlagHalo ? 3.4 : 1.75,
          showLabel: false,
        };
      }

      // Dark mono: unrevealed hexes are always pure white — including the rim.
      // Must run before isBack: the old backface pass painted them near-black.
      if (
        darkMono &&
        !cell.revealed &&
        !(state.chromeProjectionMode === "chamber" && isBack)
      ) {
        return {
          fill: T.covered || "#ffffff",
          stroke: isBack ? T.backfaceEdge : T.coveredEdge,
          lineWidth: isBack ? 1.1 : tile.isPentagon ? 1.8 : 1.5,
          showLabel: false,
        };
      }

      if (isBack) {
        if (state.chromeProjectionMode === "chamber") {
          const wall = smoothUnit(state.chromeProjectionProgress);
          const rim = clampUnit(1 - Math.abs(proj.normalZ));
          return {
            fill: colorMix(
              T.backface,
              T.coveredEdge,
              wall * (0.05 + rim * 0.13)
            ),
            stroke: T.backfaceEdge,
            lineWidth: tile.isPentagon ? 1.4 : 1.05,
            showLabel: false,
          };
        }
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
        // Magma-core globes: empty (lowest tier) stays warm so the throat can show;
        // do not wash empty digs back toward cool daymap ghost.
        if (T.globeMap) {
          const ghost = tileGlobeColor(tile);
          if (ghost) {
            if (T.magmaCore && empty) {
              wellFill = colorMix(wellFill, ghost, 0.08);
            } else {
              wellFill = colorMix(wellFill, ghost, empty ? 0.18 : 0.28);
            }
          }
        }
        // Magma empty digs: hotter floor (Fire palette) so lowest tier reads molten.
        if (T.magmaCore && empty) {
          wellFill = colorMix(wellFill, T.wellGlowColor || T.coreGlow || "#ff5a12", 0.35);
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

    /** Deterministic 0–1 for magma boil/mote placement (mirrors Fire cellHash). */
    function magmaHash(i, a, b) {
      const x = Math.sin(i * 12.9898 + a * 78.233 + b * 4.1414) * 43758.5453;
      return x - Math.floor(x);
    }

    /**
     * Fire-family magma core under Earth/Moon shells.
     * Color language + boil/motes from index.html drawMagmaPitWell / Magma Core,
     * clipped to the sphere disk so the crust (tiles) sit over a glowing throat.
     */
    function drawMagmaCore(cx, cy, R, t) {
      const reduce = state.reduceMotion;
      const pulse = reduce ? 0.72 : 0.58 + 0.42 * Math.sin(t * 0.0018);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      // Hell floor: near-black rim → warm throat (Fire shaft base)
      const base = ctx.createRadialGradient(cx, cy, R * 0.06, cx, cy, R * 1.05);
      base.addColorStop(0, "#4a1a0c");
      base.addColorStop(0.18, "#2a1008");
      base.addColorStop(0.45, "#140806");
      base.addColorStop(0.78, "#080201");
      base.addColorStop(1, "#010000");
      ctx.fillStyle = base;
      ctx.fillRect(cx - R - 2, cy - R - 2, R * 2 + 4, R * 2 + 4);

      // Soft underworld throat (additive — Magma Core lamp)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(
        cx,
        cy + R * 0.04,
        0,
        cx,
        cy,
        R * 0.78
      );
      glow.addColorStop(0, `rgba(255, 160, 52, ${0.38 + pulse * 0.16})`);
      glow.addColorStop(0.28, `rgba(255, 90, 18, ${0.2 + pulse * 0.1})`);
      glow.addColorStop(0.62, `rgba(180, 40, 6, ${0.08 + pulse * 0.04})`);
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(cx, cy + R * 0.04, R * 0.62, R * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();

      // Boil pools — overlapping soft cells (Fire pit floor goo)
      const boilN = reduce ? 6 : 16;
      for (let i = 0; i < boilN; i++) {
        const u = magmaHash(i, 17, 3);
        const v = magmaHash(i, 29, 5);
        const w2 = magmaHash(i, 41, 11);
        const scale = 0.35 + u * 0.65;
        const speed = 0.00008 / (0.22 + scale * 0.9);
        const phase = reduce ? 0.35 + v * 0.3 : (t * speed + v) % 1;
        const swell = Math.sin(phase * Math.PI);
        const ang = w2 * Math.PI * 2 + (reduce ? 0 : Math.sin(t * 0.00012 + i) * 0.45);
        const rad = R * (0.04 + v * 0.38) * (0.55 + (1 - scale) * 0.4);
        const bx = cx + Math.cos(ang) * rad;
        const by = cy + Math.sin(ang) * rad * 0.72 + R * 0.02;
        const br = R * (0.06 + scale * 0.12) * (0.55 + swell * 0.55);
        const a = (0.06 + swell * (0.09 + scale * 0.1)) * (0.85 + pulse * 0.22);
        const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        bg.addColorStop(0, `rgba(255, 230, 150, ${a * 1.4})`);
        bg.addColorStop(0.28, `rgba(255, 120, 32, ${a * 1.05})`);
        bg.addColorStop(0.65, `rgba(220, 60, 10, ${a * 0.45})`);
        bg.addColorStop(1, "transparent");
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }

      // Rising heat motes in the well
      const moteN = reduce ? 5 : 14;
      for (let i = 0; i < moteN; i++) {
        const u = magmaHash(i, 61, 3);
        const v = magmaHash(i, 73, 9);
        const w2 = magmaHash(i, 89, 5);
        const life = reduce ? 0.35 + v * 0.35 : (t * (0.00012 + u * 0.0001) + v) % 1;
        const spiral = reduce ? 0 : Math.sin(t * 0.0004 + i * 1.7) * 0.12;
        const ang = w2 * Math.PI * 2 + life * 0.9 + spiral;
        const rad = R * (0.06 + u * 0.32) * (1 - life * 0.35);
        const mx = cx + Math.cos(ang) * rad;
        const my =
          cy + R * 0.18 - life * R * 0.55 + Math.sin(ang) * rad * 0.2;
        const ma = (1 - life) * (0.14 + v * 0.16) * (0.75 + pulse * 0.25);
        const mr = (1.1 + (1 - life) * 2.1) * (0.7 + u * 0.55);
        const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 2.2);
        mg.addColorStop(0, `rgba(255, 220, 140, ${ma})`);
        mg.addColorStop(0.4, `rgba(255, 110, 30, ${ma * 0.55})`);
        mg.addColorStop(1, "transparent");
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(mx, my, mr * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Soft crust rim — darkens toward shell so texture hexes seat cleanly
      ctx.globalCompositeOperation = "source-over";
      const rim = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.02);
      rim.addColorStop(0, "transparent");
      rim.addColorStop(0.65, "transparent");
      rim.addColorStop(0.88, "rgba(8, 2, 1, 0.35)");
      rim.addColorStop(1, "rgba(2, 0, 0, 0.55)");
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = rim;
      ctx.fill();

      ctx.restore();
    }

    // —— Water · half-submerged globe ——————————————————————————————
    //
    // The flat board carries a parallel implementation in index.html, anchored
    // to the board instead of the globe — a change to the wave, the meniscus or
    // the depth haze here usually wants mirroring there.
    //
    // Adapted from Wakana Y.K.'s SVG feTurbulence water reflection (codepen
    // oNOwpqM). The displacement is canvas row slices rather than a real
    // `filter: url(#…)` on the canvas: an SVG filter warps what you see but
    // not where the pointer lands, so every dig below the line would miss by
    // the displacement amount. Slices keep picking exact.
    const WATER = { buf: null, bctx: null };

    /** Three octaves standing in for feTurbulence fractalNoise. ~[-1,1]. */
    function waterWave(y, t) {
      return (
        (Math.sin(y * 0.021 + t * 1.9) +
          Math.sin(y * 0.052 - t * 2.7) * 0.42 +
          Math.sin(y * 0.009 + t * 1.1) * 0.72) /
        2.14
      );
    }

    /**
     * Waterline in CSS px. Anchored to the sphere, not the viewport, so the
     * horizon keeps the same bite out of the globe at any zoom or window size.
     * level 0.5 puts it exactly on the equator — half under.
     */
    function waterLineY(h) {
      const level = state.waterLevel != null ? state.waterLevel : 0.5;
      const r = state.scale * 1.15;
      const tide =
        state.reduceMotion ? 0 : Math.sin(performance.now() * 0.00011) * r * 0.02;
      return Math.round(
        Math.max(-40, Math.min(h + 40, state.centerY + r - level * r * 2 + tide))
      );
    }

    /** Sky above, sea below — painted over the flat backdrop before the globe. */
    function drawWaterField(w, h, surf) {
      const t = performance.now();
      ctx.save();

      if (surf > 0) {
        const sky = ctx.createLinearGradient(0, 0, 0, surf);
        sky.addColorStop(0, "#0b2438");
        sky.addColorStop(0.55, "#14415c");
        sky.addColorStop(1, "#2d7b96");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, surf);

        const sunY = surf - h * 0.08;
        const sun = ctx.createRadialGradient(w / 2, sunY, 0, w / 2, sunY, Math.max(w, h) * 0.45);
        sun.addColorStop(0, "rgba(190,240,255,0.24)");
        sun.addColorStop(0.4, "rgba(120,200,225,0.1)");
        sun.addColorStop(1, "transparent");
        ctx.fillStyle = sun;
        ctx.fillRect(0, 0, w, surf);
      }

      if (surf < h) {
        const sea = ctx.createLinearGradient(0, surf, 0, h);
        sea.addColorStop(0, "#12617d");
        sea.addColorStop(0.35, "#0a3f57");
        sea.addColorStop(1, "#04202f");
        ctx.fillStyle = sea;
        ctx.fillRect(0, surf, w, h - surf);

        // Caustics — light sheets bending through the surface.
        const bands = state.reduceMotion ? 4 : 9;
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < bands; i++) {
          const phase = state.reduceMotion ? i * 0.7 : t * 0.00016 + i * 0.7;
          const cx = w * (0.5 + Math.sin(phase) * 0.42);
          const spread = w * (0.05 + 0.035 * Math.sin(phase * 1.7 + i));
          const g = ctx.createLinearGradient(cx - spread, 0, cx + spread, 0);
          g.addColorStop(0, "transparent");
          g.addColorStop(0.5, `rgba(150,230,240,${0.05 + 0.03 * Math.sin(phase * 2.3)})`);
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g;
          ctx.fillRect(cx - spread, surf, spread * 2, h - surf);
        }
      }
      ctx.restore();
    }

    /** Refraction, reflection and meniscus over the finished frame. */
    function drawWaterPass(w, h, surf) {
      const depth = h - surf;
      if (depth < 4 || surf < -h) return;
      const t = performance.now() * 0.001;

      // The context carries a dpr transform, so source rects are in device px
      // while destination rects stay in CSS px.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bw = canvas.width;
      const bh = canvas.height;
      if (!WATER.buf) {
        WATER.buf = document.createElement("canvas");
        WATER.bctx = WATER.buf.getContext("2d");
      }
      if (WATER.buf.width !== bw || WATER.buf.height !== bh) {
        WATER.buf.width = bw;
        WATER.buf.height = bh;
      }
      const buf = WATER.buf;
      WATER.bctx.setTransform(1, 0, 0, 1, 0, 0);
      WATER.bctx.clearRect(0, 0, bw, bh);
      WATER.bctx.drawImage(canvas, 0, 0);

      const amp = Math.max(2.5, state.scale * 0.03);
      const slice = 2;
      const squeeze = 0.78;
      const top = Math.max(0, surf);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, top, w, h - top);
      ctx.clip();

      // Deep water first, so the strip a slice vacates as it shifts sideways
      // resolves to sea rather than a smear of its own edge pixels.
      const fill = ctx.createLinearGradient(0, top, 0, h);
      fill.addColorStop(0, "#0d4d67");
      fill.addColorStop(1, "#04202f");
      ctx.fillStyle = fill;
      ctx.fillRect(0, top, w, h - top);

      // 1 · Refraction — the submerged cap, wobbling where it sits. Stops at the
      // bottom of the globe: past it the frame is flat sea, and refracting sea
      // onto identical sea is hundreds of copies for no visible pixel.
      const stop = Math.min(h, state.centerY + state.scale * 1.15);
      for (let y = top; y < stop; y += slice) {
        const d = (y - surf) / depth;
        const dx = waterWave(y, t) * amp * (0.35 + d * 1.15);
        ctx.drawImage(buf, 0, y * dpr, bw, slice * dpr, dx, y, w, slice);
      }

      // 2 · Reflection — the dry cap mirrored down, fading with distance.
      for (let y = top; y < h; y += slice) {
        const d = (y - surf) / depth;
        const srcY = surf - (y - surf) * squeeze;
        if (srcY < 0) break;
        const dx = waterWave(y * 1.7 + 40, t * 1.25) * amp * (0.6 + d * 1.7);
        ctx.globalAlpha = 0.34 * Math.max(0, 1 - d * 1.05);
        ctx.drawImage(buf, 0, srcY * dpr, bw, slice * dpr, dx, y, w, slice);
      }
      ctx.globalAlpha = 1;

      // 3 · Depth haze.
      const haze = ctx.createLinearGradient(0, top, 0, h);
      haze.addColorStop(0, "rgba(20,110,140,0.08)");
      haze.addColorStop(0.45, "rgba(10,70,100,0.3)");
      haze.addColorStop(1, "rgba(3,26,40,0.64)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, top, w, h - top);
      ctx.restore();

      if (surf < 0 || surf > h) return;

      // 4 · Meniscus — bright rim where air meets sea.
      ctx.save();
      const band = Math.max(2.5, state.scale * 0.012);
      const glow = ctx.createLinearGradient(0, surf - band * 5, 0, surf + band * 5);
      glow.addColorStop(0, "rgba(190,240,255,0)");
      glow.addColorStop(0.5, "rgba(200,245,255,0.24)");
      glow.addColorStop(0.62, "rgba(255,255,255,0.42)");
      glow.addColorStop(1, "rgba(120,200,230,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, surf - band * 5, w, band * 10);

      // Broken specular chop — jittered, or the highlights land on an even
      // pitch and the horizon reads as a dashed rule.
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(226,250,255,0.9)";
      const step = Math.max(9, Math.round(w / 74));
      for (let x = 0; x < w; x += step) {
        const j = (Math.sin(x * 12.9898) * 43758.5453) % 1;
        const jj = j < 0 ? j + 1 : j;
        const ph = x * 0.014 + t * 1.6 + jj * 6.283;
        const a = Math.sin(ph) * Math.sin(ph * 0.37 + 1.1);
        if (a < 0.3) continue;
        ctx.globalAlpha = Math.min(0.6, a * 0.55);
        ctx.fillRect(
          x + jj * step * 0.6,
          surf - 1 + Math.sin(ph * 1.3) * 1.6,
          step * (0.3 + jj * 0.5),
          1.5
        );
      }
      ctx.restore();
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

      // Chamber inverts the world. Once the sphere has turned itself inside
      // out you are standing in it, so the page behind must become the same
      // wall you are looking at — otherwise the dark back-hemisphere rim stops
      // at the silhouette and reads as an annulus floating on white daylight.
      // Lerped on the chamber's own progress so the background turns with the
      // fold rather than snapping.
      const invert =
        state.chromeProjectionMode === "chamber"
          ? smoothUnit(state.chromeProjectionProgress)
          : 0;
      let bgGlowCol = state.theme.bgGlow;
      let bgCol = state.theme.bg;
      if (invert > 0) {
        const wall = state.theme.backface || "#000000";
        // Match the wall's own tint ramp rather than pure backface, or the
        // background and the rim meet with a visible step exactly at the
        // silhouette. tileColors() tints the wall by 0.05 + rim * 0.13, and
        // rim peaks at the edge-on faces on the outline — so 0.18 out there,
        // 0.05 at the centre where the faces look straight back at you.
        bgGlowCol = colorMix(
          bgGlowCol,
          colorMix(wall, state.theme.coveredEdge, 0.05),
          invert
        );
        bgCol = colorMix(
          bgCol,
          colorMix(wall, state.theme.coveredEdge, 0.18),
          invert
        );
      }

      const grd = ctx.createRadialGradient(
        state.centerX,
        state.centerY,
        state.scale * 0.1,
        state.centerX,
        state.centerY,
        state.scale * 1.35
      );
      grd.addColorStop(0, bgGlowCol);
      grd.addColorStop(1, bgCol);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      // Water replaces the radial backdrop with a horizon, so the submerged
      // cap of the globe is painted into sea rather than onto it. One waterline
      // per frame, handed to both passes — nothing to fall out of sync.
      const waterY = state.theme.waterScene ? waterLineY(h) : 0;
      if (state.theme.waterScene) drawWaterField(w, h, waterY);

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
      // Glow theme: soft luminous core. Earth/Moon: Fire-style magma core.
      const coreFill = state.theme.core || state.theme.backface || "#000000";
      const coreR = Math.max(12, state.scale * 1.02);
      const coreNow = performance.now();
      const chamberCoreAlpha =
        state.chromeProjectionMode === "chamber"
          ? Math.max(0, Math.min(1, 1 - state.chromeProjectionProgress * 5))
          : 1;
      const shellCoreAlpha =
        state.chromeShellMode === "eggshell"
          ? Math.max(0, Math.min(1, 1 - state.chromeShellProgress * 5))
          : 1;
      const chromeCoreAlpha = chamberCoreAlpha * shellCoreAlpha;
      if (chromeCoreAlpha > 0.001) {
        ctx.save();
        ctx.globalAlpha *= chromeCoreAlpha;
        if (state.theme.magmaCore) {
          drawMagmaCore(state.centerX, state.centerY, coreR, coreNow);
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
        ctx.restore();
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

      // Both shell halves remain rigid groups, but opening them reveals the
      // same mesh from behind. Paint that real tessellation before the outer
      // faces so each cap has an inside surface instead of a flat CSS disk.
      const eggInteriorAlpha = smoothUnit(
        (state.chromeShellProgress - 0.06) / 0.3
      );
      if (eggInteriorAlpha > 0.001) {
        const T = state.theme;
        ctx.save();
        ctx.globalAlpha *= eggInteriorAlpha;
        for (const proj of getEggshellInteriorProjected()) {
          const tile = state.tiles[proj.index];
          const shellFill = tile.isPentagon ? T.pentagon : T.covered;
          const inward = clampUnit(-proj.normalZ);
          const fill = colorMix(
            shellFill,
            T.backface || T.core || "#777777",
            0.14 + (1 - inward) * 0.14
          );
          drawHex(
            proj,
            fill,
            T.backfaceEdge || T.coveredEdge,
            tile.isPentagon ? 1.4 : 1.05
          );
        }
        ctx.restore();
      }

      /*
       * There is deliberately no aperture any more.
       *
       * Two versions of one mistake died here. First a fixed Set of seven tile
       * indices, welded to the mesh so the hole wandered off when you turned
       * the sphere. Then a soft disc in screen space, which stayed put but
       * could never match the menu's silhouette — the shell is large hexes and
       * the hole is a circle, so a ragged black corona always poked out around
       * the menu, showing the dark interior through the gap.
       *
       * Luke's call: keep the tiles exactly as they are, dig state and all,
       * and simply do not lift any. The menu is opaque and covers what it
       * covers; nothing needs filling in because nothing is removed. This also
       * retires the seam question outright — there is nothing to keep in sync
       * while the sphere rotates.
       */
      function chamberBackAlpha(proj) {
        if (
          state.chromeProjectionMode !== "chamber" ||
          proj.z > -0.05
        ) {
          return 1;
        }
        return smoothUnit((state.chromeProjectionProgress - 0.08) / 0.42);
      }

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
        let colors = tileColors(idx, proj, cell, tile, now);
        colors = drawColorsForStyle(colors, styleId, cell);
        if (state.interiorPlay) {
          // Grazing faces catch less light. Standing inside, the face dead
          // ahead has its normal along the view axis (|normalZ| = 1) while the
          // ones wrapping past your shoulders at the equator are edge-on
          // (|normalZ| = 0). That is the real curvature term, and because the
          // tiles are large it steps face by face — where the radial wash in
          // drawInteriorShading() is only a smooth screen-space approximation
          // of the same thing. The two are tuned to sit on top of each other.
          //
          // Kept deliberately gentle. At full strength it dimmed almost
          // everything, because most faces you can see in here are grazing —
          // the board went uniformly grey and lost the crisp black/white the
          // game is read by. This is a facet accent over the wash, not the
          // main light.
          const dim = 1 - (0.62 + 0.38 * Math.abs(proj.normalZ || 0));
          if (dim > 0.005) {
            colors = Object.assign({}, colors, {
              fill: colorMix(colors.fill, "#000000", dim * 0.5),
              stroke: colorMix(colors.stroke, "#000000", dim * 0.35),
            });
          }
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
            if (!seamsEnabled() || styleId === "borderless") {
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

        // Magma-core empty digs: translucent floor so the disk throat shows through
        // the lowest tier (opaque near-black was hiding drawMagmaCore entirely).
        const magmaEmpty =
          state.theme.magmaCore &&
          cell.revealed &&
          !cell.isMine &&
          cell.neighborMines === 0 &&
          (state.reduceMotion ||
            now >= cell.visualDue ||
            cell.animReveal >= 0.98);
        if (magmaEmpty) {
          ctx.save();
          ctx.globalAlpha = 0.38;
          drawHex(drawProj, colors.fill, colors.stroke, colors.lineWidth);
          ctx.restore();
          // Warm rim so the open well still reads as a hex, not a hole in the map.
          if (drawHexPath(drawProj)) {
            ctx.strokeStyle =
              state.theme.revealedEdge || "rgba(255,140,40,0.35)";
            ctx.lineWidth = Math.max(colors.lineWidth || 1.2, 1.35);
            ctx.stroke();
          }
        } else {
          drawHex(drawProj, colors.fill, colors.stroke, colors.lineWidth);
        }
        drawWellCenterGlow(drawProj, cell, now);
        paintCountMark(tile, drawProj, cell, colors, markLift);
      }

      // The inner menu never fades the shell. It splits it (setChromeShell)
      // and sits in the cavity, so the shell paints over any seat still
      // behind it at full strength — the shell hides the menu, not the
      // reverse. Fading it was the first cut and it wrecked the sphere.
      const innerTiles = innerMenuActive() ? innerMenu.project(now) || [] : [];

      function drawChromeTile(proj) {
        const alpha =
          chamberBackAlpha(proj);
        if (alpha <= 0.001) return;
        if (alpha >= 0.999) {
          drawTile(proj);
          return;
        }
        ctx.save();
        ctx.globalAlpha *= alpha;
        drawTile(proj);
        ctx.restore();
      }

      // Flags stand above the shell, so they paint after their neighbors
      // (still back-to-front among themselves) or the shell clips their skirts.
      // One list, one sort: menu tiles are ordinary projected polygons and take
      // their place among the faces by depth like anything else.
      const drawList = innerTiles.length
        ? projected
            .concat(innerTiles)
            .sort((a, b) => a.center.depth - b.center.depth || a.z - b.z)
        : projected;

      const proudFlags = [];
      for (const proj of drawList) {
        if (proj.innerMenu) {
          innerMenu.paint(ctx, proj, now);
          continue;
        }
        const idx = proj.index;
        const cell = state.cells[idx];
        // Hover/press on activatable covered faces draw in the raised pass.
        const hoverRaise =
          highlightIdx >= 0 &&
          idx === highlightIdx &&
          tileCanActivate(cell);
        if (proj.z > 0.02 && hoverRaise) {
          continue;
        }
        if (proj.z > 0.02 && heights[idx] > 1e-6) {
          proudFlags.push(proj);
          continue;
        }
        drawChromeTile(proj);
      }
      for (const proj of proudFlags) drawChromeTile(proj);

      // Raised pass: hover/press on covered or flagged, lifted over its tier.
      if (
        highlightIdx >= 0 &&
        tileCanActivate(state.cells[highlightIdx])
      ) {
        const idx = highlightIdx;
        const base = projected.find((p) => p.index === idx && p.z > 0.02);
        if (base) {
          ctx.save();
          const tile = state.tiles[idx];
          const cell = state.cells[idx];
          let colors = drawColorsForStyle(
            tileColors(idx, base, cell, tile, now),
            styleId,
            cell
          );
          // Hover lift over the tile's tier. Flagged already sits at hover
          // height when extruded, so only press can add a little more.
          const baseH = tileHeight(cell, styleId);
          const addLift = cell.flagged && !cell.revealed
            ? (state.pressed === idx ? PRESS_LIFT * 0.5 : 0)
            : (state.pressed === idx ? PRESS_LIFT : HOVER_LIFT);
          const lift = baseH + addLift;
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
          drawHex(raised, fill, colors.stroke, edgeW);
          paintCountMark(tile, raised, cell, colors, lift);
          ctx.restore();
        }
      }

      drawInteriorShading();
      drawChamberEdgeBlur();

      drawEndFxOverlay(now);
      ctx.restore();

      // Screen space, after the shake transform is released — otherwise
      // the waterline shudders loose from the horizon on a detonation.
      if (state.theme.waterScene) drawWaterPass(w, h, waterY);
    }

    /**
     * Interior play: light the cavity.
     *
     * The concave wall was flat-lit, so it read as wallpaper rather than as
     * something curving away around you — every hex the same value whether it
     * was straight ahead or bending past your shoulder. Standing inside a
     * sphere, the surface directly in front is nearest and brightest and the
     * light falls off as the wall turns away toward the periphery.
     *
     * Multiply rather than an overlay: it scales what is already there, so a
     * white face dims to grey while a black face stays black. The contrast
     * direction of the board — and therefore its readability — is preserved
     * exactly, which an alpha wash over the top would have flattened.
     *
     * One gradient, not a per-face term. Shading each hex separately either
     * seams along the tile edges or double-darkens where the two hemispheres
     * overlap in this projection; a single smooth falloff has neither problem
     * and still steps visibly from hex to hex because the tiles are large.
     */
    function drawInteriorShading() {
      if (!state.interiorPlay) return;
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      if (!w || !h) return;
      const near = Math.min(w, h) * 0.12;
      const far = Math.hypot(w, h) * 0.62;
      const g = ctx.createRadialGradient(
        state.centerX,
        state.centerY,
        near,
        state.centerX,
        state.centerY,
        far
      );
      // White is the identity for multiply, so the centre is untouched and
      // only the periphery loses light.
      g.addColorStop(0, "rgb(255,255,255)");
      g.addColorStop(0.55, "rgb(206,209,215)");
      g.addColorStop(1, "rgb(104,108,118)");
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    /**
     * Chamber only: soften the board toward the viewport edges while its menu
     * is up.
     *
     * Two jobs. It deepens the "you are standing inside this" read now that
     * the wall runs past every corner — the periphery falls out of focus the
     * way it would if you were really in there. And it says, without a scrim
     * or a dark hole, that the board is not the live layer: with the shell
     * drawn flat and fully lit the tiles look playable, but taps only rotate
     * or close, so there was no cue you were in a menu at all, let alone how
     * to leave it.
     *
     * Done as one masked blurred copy rather than a per-tile effect: a single
     * offscreen pass, only while the chamber is open, costing nothing the rest
     * of the time.
     */
    let edgeBlurBuf = null;
    function drawChamberEdgeBlur() {
      if (state.chromeProjectionMode !== "chamber") return;
      // Interior play keeps the chamber on permanently, and this blur means
      // "the board is not the live layer" — which is the opposite of true
      // there. It belongs to the dock, not to the projection.
      if (state.interiorPlay) return;
      const amt = smoothUnit(state.chromeProjectionProgress);
      if (amt <= 0.02 || state.reduceMotion) return;
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      if (!edgeBlurBuf) edgeBlurBuf = document.createElement("canvas");
      if (
        edgeBlurBuf.width !== canvas.width ||
        edgeBlurBuf.height !== canvas.height
      ) {
        edgeBlurBuf.width = canvas.width;
        edgeBlurBuf.height = canvas.height;
      }
      const b = edgeBlurBuf.getContext("2d");
      if (!b) return;
      b.setTransform(1, 0, 0, 1, 0, 0);
      b.clearRect(0, 0, edgeBlurBuf.width, edgeBlurBuf.height);
      // A blurred copy of everything painted so far. ctx.filter is a no-op on
      // engines that lack it, which degrades to an identical copy — invisible
      // rather than wrong.
      b.filter = "blur(" + (7 * amt * dpr).toFixed(2) + "px)";
      b.drawImage(canvas, 0, 0);
      b.filter = "none";
      // Keep only its outer part, ramping in from the middle.
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = b.createRadialGradient(
        state.centerX,
        state.centerY,
        Math.min(w, h) * 0.3,
        state.centerX,
        state.centerY,
        Math.hypot(w, h) * 0.55
      );
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0," + amt.toFixed(3) + ")");
      b.globalCompositeOperation = "destination-in";
      b.fillStyle = g;
      b.fillRect(0, 0, w, h);
      b.globalCompositeOperation = "source-over";
      // Lay it back over the sharp board with the shake transform released —
      // the copy already contains that offset.
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.drawImage(edgeBlurBuf, 0, 0, w, h);
      ctx.restore();
    }

    function frameNeedsPaint(now) {
      // The inner menu blooms and fades off the paint clock, so the loop has
      // to stay alive while it moves or it would animate at the 200ms idle
      // cadence — or not at all, once the loop parked.
      if (innerMenu && innerMenu.animating && innerMenu.animating()) return true;
      if (state.ambientSpin && !state.reduceMotion) return true;
      // Ripple, tide and caustics are all time-driven; keep the loop alive.
      if (state.theme && state.theme.waterScene && !state.reduceMotion) return true;
      // Earth/Moon magma core animates (boil + motes); keep the loop alive.
      if (state.theme && state.theme.magmaCore && !state.reduceMotion) return true;
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

    let idleFrameTimer = 0;

    function scheduleFrame(delay) {
      const wait = delay != null ? delay : 0;
      if (wait > 0) {
        if (state.rafScheduled || idleFrameTimer) return;
        idleFrameTimer = setTimeout(() => {
          idleFrameTimer = 0;
          if (state.rafScheduled) return;
          state.rafScheduled = true;
          requestAnimationFrame(loop);
        }, wait);
        return;
      }
      // Renderer state can change while the low-power idle timer is waiting.
      // Promote that request to the very next frame instead of letting an
      // animation inherit the idle loop's 200 ms cadence.
      if (idleFrameTimer) {
        clearTimeout(idleFrameTimer);
        idleFrameTimer = 0;
      }
      if (state.rafScheduled) return;
      state.rafScheduled = true;
      requestAnimationFrame(loop);
    }

    function loop(ts) {
      state.rafScheduled = false;
      const now = ts || performance.now();
      tickAmbientSpin(now);
      tickRevealAnim(now);
      tickEndFx(now);
      draw();
      state.lastFrameAt = now;
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
          // invertDragX/Y flip drag polarity (preference; not mid-run board state).
          const sx = state.invertDragX ? -1 : 1;
          const sy = state.invertDragY ? -1 : 1;
          state.targetRotY = state.dragStart.rotY + dx * 0.0105 * sx;
          state.targetRotX = state.dragStart.rotX + dy * 0.0105 * sy;
          state.rotY = state.targetRotY;
          state.rotX = state.targetRotX;
          invalidateProjection();
          scheduleFrame();
          if (state.menuRotateOnly) {
            canvas.dispatchEvent(new CustomEvent("hexsweeper:rotation"));
          }
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
        // A tap that lands on an inner-menu seat is the menu's, not the
        // background's — otherwise every activation would also close it.
        if (!touchMoved && state.dragStart && innerMenuActive()) {
          if (innerMenu.tap(p.x, p.y)) {
            state.dragging = false;
            state.dragStart = null;
            state.hovered = -1;
            state.pressed = -1;
            touchMoved = false;
            schedulePersist();
            return;
          }
        }
        const backgroundTap = !touchMoved && !!state.dragStart;
        state.dragging = false;
        state.dragStart = null;
        state.hovered = -1;
        state.pressed = -1;
        touchMoved = false;
        schedulePersist();
        if (backgroundTap) {
          canvas.dispatchEvent(
            new CustomEvent("hexsweeper:menu-background-tap", {
              bubbles: true,
            })
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
    // Keep a drag alive when a reprojected menu face moves beneath the cursor.
    window.addEventListener("mousemove", (event) => {
      if (!state.dragging && event.target !== canvas) return;
      onPointerMove(event);
    });
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
    // Transparent overlay — click the field outside the sheet to dismiss.
    if (helpOverlay) {
      helpOverlay.addEventListener("click", (e) => {
        if (e.target === helpOverlay) closeHelp();
      });
    }
    if (helpPanel) {
      helpPanel.addEventListener("click", (e) => e.stopPropagation());
    }

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
      if (/^Arrow(Left|Right|Up|Down)$/.test(e.key)) {
        if (helpOverlay?.classList.contains("open")) return;
        e.preventDefault();
        stopAmbientSpin();
        const step = e.shiftKey ? 0.24 : 0.13;
        if (e.key === "ArrowLeft") state.rotY -= step;
        if (e.key === "ArrowRight") state.rotY += step;
        if (e.key === "ArrowUp") state.rotX -= step;
        if (e.key === "ArrowDown") state.rotX += step;
        state.targetRotY = state.rotY;
        state.targetRotX = state.rotX;
        invalidateProjection();
        scheduleFrame();
        if (state.menuRotateOnly) {
          canvas.dispatchEvent(new CustomEvent("hexsweeper:rotation"));
        }
        schedulePersist();
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
    if (opts.theme) state.theme = Object.assign({}, state.theme, opts.theme);

    window.addEventListener("resize", resize);
    // Flush on every leave path so F5 / mobile background never loses a dig.
    window.addEventListener("pagehide", () => persistNow());
    window.addEventListener("beforeunload", () => persistNow());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") persistNow();
    });
    resize();

    state.waterLevel = readWaterLevel();
    try {
      applyEffectsMode(localStorage.getItem(EFFECTS_KEY) || "auto", { persist: false });
    } catch (_) {}
    bindWaterLevel();
    bindHelpPacks();
    bindHelpControls();

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
      if (forceWelcome) openHelp(true);
      else if (!skipWelcome && !localStorage.getItem(WELCOME_KEY)) openHelp(true);
    } catch (_) {
      // Storage blocked — only show help on a truly fresh first board.
      if (!restored && !wantDeal) openHelp(true);
    }

    scheduleFrame();

    return {
      reset: () => requestReset({ force: true }),
      undo: () => restoreUndo(),
      canUndo: () => !!undoSnapshot,
      floodFrom,
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
      /** Sphere's screen-space disk in CSS px — for chrome that needs to know
       *  what counts as "the board" vs background (center-bloom tap-to-open). */
      /** Menu-open freeze: the bloom pauses play time. Resume only if a
       *  run is actually underway (first dig starts the clock). */
      pauseTimer: () => stopTimer(),
      resumeTimer: () => {
        if (!state.isGameOver && !state.isFirstClick) startTimer();
      },
      getSphereScreen: () => ({
        cx: state.centerX,
        cy: state.centerY,
        r: state.scale * 1.15,
      }),
      getMenuPatch,
      setInnerMenu,
      setInteriorPlay,
      projectLocalPoint,
      /**
       * Project a point that is already in camera space — rotation applied,
       * perspective divide still to do. This is what a billboarded overlay
       * needs: geometry that keeps facing the viewer while the mesh turns
       * behind it, but still sorts against that mesh by depth.
       */
      projectCameraPoint: (p) => projectRotated(p),
      scheduleFrame: () => scheduleFrame(),
      setChromeProjection,
      setChromeShell,
      setMenuInteraction,
      orbitBy: (dx, dy) => {
        const sx = state.invertDragX ? -1 : 1;
        const sy = state.invertDragY ? -1 : 1;
        const nextY = state.rotY + (Number(dx) || 0) * 0.0105 * sx;
        const nextX = state.rotX + (Number(dy) || 0) * 0.0105 * sy;
        state.rotY = nextY;
        state.rotX = nextX;
        state.targetRotY = nextY;
        state.targetRotX = nextX;
        invalidateProjection();
        scheduleFrame();
      },
      setCountStyle: (id, opts) => setCountStyle(id, opts),
      setRelief: (mode) => setRelief(mode),
      setSeams: (on) => setSeams(on),
      setAppearanceAxes: (axes) => setAppearanceAxes(axes || {}),
      setAppearancePack: (id) => setAppearancePack(id),
      getAppearance: () => ({
        pack: state.appearancePack,
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
      },
      setInvertDragY: (on) => {
        state.invertDragY = !!on;
        persistInvert();
      },
    };
  }

  global.SphereSweeper = {
    boot,
    CONFIG,
    THEMES,
    DEFAULT_THEME: THEME_LIGHT,
  };
})(typeof window !== "undefined" ? window : global);
