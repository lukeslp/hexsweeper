/**
 * File Purpose: Reflective-material fork of Hexsweeper's closed hex sphere.
 * Primary Functions/Classes: SphereSweeper.boot, project, pick, render loop.
 * Inputs: transparent Canvas 2D overlay, difficulty, reflection theme. Outputs: playable sphere minesweeper.
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
 * Persist: autosave mid-run (localStorage + sessionStorage `hexsweeper-reflection-run-v1`).
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

  const THEME_STORAGE_KEY = "hexsweeper-reflection-theme-v1";
  const SIZE_STORAGE_KEY = "hexsweeper-reflection-size-v1";
  const NEST_STORAGE_KEY = "hexsweeper-reflection-nest-v1";
  const COUNT_STYLE_STORAGE_KEY = "hexsweeper-reflection-countstyle-v1";
  const INVERT_STORAGE_KEY = "hexsweeper-reflection-invert-v1";
  const WELCOME_KEY = "hexsweeper-reflection-welcome-v1";
  const RUN_STORAGE_KEY = "hexsweeper-reflection-run-v1";
  const RUN_STORAGE_KEY_LEGACY = "hexsweeper-reflection-run-v0";
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
  };

  /** Loaded equirectangular maps (ImageData cache). */
  const globeCache = Object.create(null);

  function boot(opts) {
    opts = opts || {};
    // Publish the resolved effects preference before first paint so CSS gates
    // apply to the opening frame rather than snapping in after it.
    applyEffectsAttribute();
    const canvas = document.getElementById(opts.canvasId || "gameCanvas");
    if (!canvas) throw new Error("SphereSweeper: canvas not found");
    const ctx = canvas.getContext("2d");

    function readStoredThemeId() {
      try {
        const id =
          localStorage.getItem(THEME_STORAGE_KEY) ||
          null;
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
          localStorage.getItem(SIZE_STORAGE_KEY);
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
     * Reflection materials are an optional observer of gameplay. The Canvas
     * engine remains authoritative; these semantic events add optical response
     * without replacing reveal, flag, mine, or end-state animation paths.
     */
    function emitMaterialAction(type, index, detail) {
      document.dispatchEvent(new CustomEvent("hexsweeper:sphere-action", {
        detail: Object.assign({ type, index }, detail || {}),
      }));
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
          `Theme: ${t.name}. Activate to cycle Light, Shell, Dark, Ink, Float, Card, Earth, Moon, Glow.`
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
      if (fromWelcome) markWelcomeSeen = true;
      helpFocusReturn =
        document.activeElement && document.activeElement !== document.body
          ? document.activeElement
          : helpBtn;
      helpOverlay.hidden = false;
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
      emitMaterialAction("reset", -1);
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
      let openedCount = 1;
      if (cell.neighborMines === 0) openedCount += floodFrom(idx).size;
      emitMaterialAction("dig", idx, {
        strength: Math.min(1.35, 0.72 + openedCount / 18),
        opened: openedCount,
      });
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
      emitMaterialAction(cell.flagged ? "flag" : "unflag", idx, {
        strength: 1,
      });
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
      state.ambientSpin = false;
      if (won && !state.reduceMotion) {
        state.targetRotY = state.rotY + 0.16;
        state.targetRotX = state.rotX + angleDelta(state.rotX, 0.18) * 0.28;
      } else {
        state.targetRotY = state.rotY;
        state.targetRotX = state.rotX;
      }
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
      emitMaterialAction("finish", -1, { won: !!won });
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
     * Selected shells reveal a continuous material beneath the crust. The
     * field is drawn in screen coordinates, then clipped per cleared face, so
     * neighboring digs join without restarting the texture at every hex.
     */
    function revealedCoreProfile(cell) {
      if (!cell || !cell.revealed || cell.flagged || cell.isMine) return null;
      const material = document.body.dataset.reflectionMaterial || "";
      if (material === "amber-cells") return "microcells";
      if (material === "mercury" || material === "portoro") return "metal";
      return null;
    }

    function coreHash(x, y, seed) {
      const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
      return value - Math.floor(value);
    }

    function drawMicrocellCore(proj, now) {
      const bounds = proj.boundary.reduce(
        (box, point) => ({
          minX: Math.min(box.minX, point.x),
          minY: Math.min(box.minY, point.y),
          maxX: Math.max(box.maxX, point.x),
          maxY: Math.max(box.maxY, point.y),
        }),
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
      );
      const ambientTime = state.reduceMotion ? 0 : now * 0.001;
      const base = ctx.createRadialGradient(
        state.centerX - state.scale * 0.22,
        state.centerY - state.scale * 0.28,
        state.scale * 0.04,
        state.centerX,
        state.centerY,
        state.scale * 1.05
      );
      base.addColorStop(0, "#d98724");
      base.addColorStop(0.42, "#71300a");
      base.addColorStop(1, "#160603");
      ctx.fillStyle = base;
      ctx.fillRect(bounds.minX - 2, bounds.minY - 2, bounds.maxX - bounds.minX + 4, bounds.maxY - bounds.minY + 4);

      // A global field gives every clipped face the same moving sub-surface.
      // Deliberately vary scale, speed, eccentricity, and orbit so this reads
      // as living oil cells rather than stationary stipple.
      const pitch = Math.max(11, state.scale * 0.039);
      const minGX = Math.floor((bounds.minX - pitch) / pitch);
      const maxGX = Math.ceil((bounds.maxX + pitch) / pitch);
      const minGY = Math.floor((bounds.minY - pitch) / pitch);
      const maxGY = Math.ceil((bounds.maxY + pitch) / pitch);
      for (let gy = minGY; gy <= maxGY; gy++) {
        for (let gx = minGX; gx <= maxGX; gx++) {
          const seed = coreHash(gx, gy, 1.3);
          const secondSeed = coreHash(gx, gy, 4.7);
          const phase = ambientTime * (0.34 + seed * 0.42) + seed * Math.PI * 2;
          const currentX = Math.sin(ambientTime * 0.19 + gy * 0.31) * pitch * 0.34;
          const currentY = Math.cos(ambientTime * 0.15 + gx * 0.27) * pitch * 0.26;
          const px = (gx + 0.5) * pitch + (seed - 0.5) * pitch * 0.48 +
            currentX + Math.sin(phase) * pitch * (0.24 + secondSeed * 0.12);
          const py = (gy + 0.5) * pitch + (secondSeed - 0.5) * pitch * 0.48 +
            currentY + Math.cos(phase * 0.79) * pitch * (0.18 + seed * 0.10);
          const breathe = 0.84 + Math.sin(phase * 1.37 + secondSeed * 4.0) * 0.16;
          const radius = pitch * (0.27 + coreHash(gx, gy, 8.1) * 0.24) * breathe;
          const radiusY = radius * (0.74 + secondSeed * 0.46);
          const lens = ctx.createRadialGradient(
            px - radius * 0.34,
            py - radius * 0.38,
            radius * 0.08,
            px,
            py,
            Math.max(radius, radiusY)
          );
          lens.addColorStop(0, "rgba(255,222,133,0.88)");
          lens.addColorStop(0.36, "rgba(207,117,30,0.72)");
          lens.addColorStop(0.82, "rgba(92,32,7,0.78)");
          lens.addColorStop(1, "rgba(28,7,2,0.96)");
          ctx.beginPath();
          ctx.ellipse(px, py, radius, radiusY, phase * 0.11, 0, Math.PI * 2);
          ctx.fillStyle = lens;
          ctx.fill();
          ctx.strokeStyle = "rgba(255,188,83,0.30)";
          ctx.lineWidth = Math.max(0.55, radius * 0.11);
          ctx.stroke();
        }
      }

      // Slow caustic bands make the entire field advect as one fluid layer.
      ctx.globalCompositeOperation = "screen";
      ctx.lineCap = "round";
      for (let band = 0; band < 3; band++) {
        const yBase = state.centerY + (band - 1) * state.scale * 0.38;
        ctx.beginPath();
        for (let step = 0; step <= 30; step++) {
          const x = state.centerX - state.scale * 1.15 + (step / 30) * state.scale * 2.3;
          const y = yBase + Math.sin(step * 0.46 + ambientTime * (0.72 + band * 0.11)) * state.scale * 0.055;
          if (step === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = band === 1
          ? "rgba(255,218,128,0.18)"
          : "rgba(255,139,42,0.11)";
        ctx.lineWidth = Math.max(1.2, state.scale * 0.012);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    function drawMetalCore(proj, now) {
      const time = state.reduceMotion ? 0 : now * 0.000075;
      const angle = state.rotY * 0.22 + state.rotX * 0.10 + time;
      const span = state.scale * 1.55;
      const dx = Math.cos(angle) * span;
      const dy = Math.sin(angle) * span;
      const metal = ctx.createLinearGradient(
        state.centerX - dx,
        state.centerY - dy,
        state.centerX + dx,
        state.centerY + dy
      );
      metal.addColorStop(0, "#030607");
      metal.addColorStop(0.24, "#424d50");
      metal.addColorStop(0.43, "#dce7e8");
      metal.addColorStop(0.49, "#6f7c7f");
      metal.addColorStop(0.66, "#182023");
      metal.addColorStop(0.84, "#a8b5b7");
      metal.addColorStop(1, "#06090a");
      ctx.fillStyle = metal;
      ctx.fillRect(
        state.centerX - state.scale * 1.2,
        state.centerY - state.scale * 1.2,
        state.scale * 2.4,
        state.scale * 2.4
      );

      // The highlight settles just behind the shell rotation, giving the
      // exposed metal a little optical inertia rather than a scrolling decal.
      const hx = state.centerX + Math.cos(angle * 0.73 - 0.8) * state.scale * 0.34;
      const hy = state.centerY + Math.sin(angle * 0.61 - 1.2) * state.scale * 0.25;
      const gleam = ctx.createRadialGradient(hx, hy, 0, hx, hy, state.scale * 0.52);
      gleam.addColorStop(0, "rgba(255,255,255,0.44)");
      gleam.addColorStop(0.18, "rgba(226,244,246,0.16)");
      gleam.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gleam;
      ctx.fillRect(
        state.centerX - state.scale,
        state.centerY - state.scale,
        state.scale * 2,
        state.scale * 2
      );
    }

    function drawRevealedCore(proj, cell, now, profile) {
      if (!profile || !cell || !cell.revealed || cell.isMine) return;
      ctx.save();
      if (!drawHexPath(proj)) {
        ctx.restore();
        return;
      }
      ctx.clip();
      if (profile === "microcells") drawMicrocellCore(proj, now);
      else if (profile === "metal") drawMetalCore(proj, now);
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

    function reflectionFlagStyle(proj, theme) {
      const material = document.body.dataset.reflectionMaterial || "";
      if (material !== "mercury") {
        return {
          fill: theme.tierFlagged || theme.flagFill,
          stroke: theme.flagEdge,
          lineWidth: theme.takeFlagHalo ? 3.4 : 2,
        };
      }

      // Mercury flags are small pieces of warm metal planted into cool metal.
      // The highlight is anchored in screen space so it behaves like a sheen,
      // while the face still rises with the ordinary flag geometry.
      const radius = Math.max(12, Math.sqrt(Math.max(24, proj.area)) * 0.92);
      const shine = ctx.createLinearGradient(
        proj.center.x - radius,
        proj.center.y + radius * 0.72,
        proj.center.x + radius,
        proj.center.y - radius * 0.72
      );
      shine.addColorStop(0, "#3f2705");
      shine.addColorStop(0.22, "#8c5a0d");
      shine.addColorStop(0.48, "#f4d77a");
      shine.addColorStop(0.62, "#b67a17");
      shine.addColorStop(1, "#4b2b04");
      return {
        fill: shine,
        stroke: "#ffe7a0",
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
        const flag = reflectionFlagStyle(proj, T);
        return {
          fill: flag.fill,
          stroke: flag.stroke,
          lineWidth: flag.lineWidth,
          showLabel: false,
        };
      }

      // The WebGL canvas below owns the continuous mirrored surface. Covered
      // cells contribute only a faint silvering and etched topology here;
      // revealed cells become matte wells in the branch below.
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

      if (!state.theme.reflectionSurface) {
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
      if (state.theme.reflectionSurface) {
        // The analytic WebGL orb is the sphere core for this material.
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

      // Flags stand above the shell, so they paint after their neighbors
      // (still back-to-front among themselves) or the shell clips their skirts.
      const proudFlags = [];
      for (const proj of projected) {
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
        drawTile(proj);
      }
      for (const proj of proudFlags) drawTile(proj);

      // Raised pass: hover/press on covered or flagged, lifted over its tier.
      if (
        highlightIdx >= 0 &&
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

      drawEndFxOverlay(now);
      ctx.restore();
    }

    function frameNeedsPaint(now) {
      if (state.ambientSpin && !state.reduceMotion) return true;
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
      if (state.isGameOver && state.won) return;
      const p = canvasPoint(e);
      touchMoved = false;
      state.dragging = true;
      // Anchor on the live camera, not a lagging target (avoids catch-up snap).
      state.dragStart = { x: p.x, y: p.y, rotY: state.rotY, rotX: state.rotX };
      state.targetRotY = state.rotY;
      state.targetRotX = state.rotX;
      state.hovered = pickTile(p.x, p.y);
      state.pressed = state.hovered;
      if (e.type === "touchstart") {
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
        }
      }
      state.hovered = pickTile(p.x, p.y);
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
  };
})(typeof window !== "undefined" ? window : global);
