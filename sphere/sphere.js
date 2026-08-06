/**
 * File Purpose: Hexsweeper on a closed hex sphere — dig/flag/flood via neighborIndices.
 * Primary Functions/Classes: SphereSweeper.boot, project, pick, render loop.
 * Inputs: canvas, difficulty, theme id (localStorage). Outputs: playable sphere minesweeper.
 * Chrome: Reset · Size · Theme · Flag · Help; themes Void/Light/Dusk/Ember/Moss.
 * Notes: Canvas 2D orthographic projection; drag rotates; first dig safe; RM-safe camera lerp.
 * Flood: logic immediate, paint staggered by BFS ring (mirrors flat core.js wave).
 * Author: Luke Steuber <luke@lukesteuber.com>
 */
(function (global) {
  "use strict";

  /** S=362 · M=1002 · L=1442 faces (~3× prior); mines ≈17%. Goldberg dual: 10n²+2. */
  const CONFIG = {
    easy: { subdivisions: 6, minePct: 0.17 },
    medium: { subdivisions: 10, minePct: 0.17 },
    hard: { subdivisions: 12, minePct: 0.17 },
  };

  const REVEAL_STEP_MS = 28;
  const REVEAL_CAP_MS = 880;
  const REVEAL_LERP = 0.18;
  const REVEAL_FLASH_MS = 240;
  const IDLE_FRAME_MS = 200;

  const THEME_VOID = {
    id: "void",
    name: "Void",
    accent: "#60a5fa",
    bg: "#060a12",
    bgGlow: "#0e1624",
    covered: "#1c2840",
    coveredHi: "#263552",
    coveredEdge: "#3d5278",
    coveredShadow: "#0a1018",
    revealed: "#2a3d58",
    revealedEmpty: "#324a6a",
    revealedEdge: "#4a6288",
    flagFill: "#7f1d1d",
    flagIcon: "#fca5a5",
    flagEdge: "#ef4444",
    mine: "#dc2626",
    mineCore: "#450a0a",
    mineEdge: "#991b1b",
    mineBurst: "#fef08a",
    pentagon: "#243044",
    pentagonEdge: "#4a5870",
    hoverRing: "#60a5fa",
    activeRing: "#93c5fd",
    backface: "#111827",
    backfaceEdge: "#1f2937",
    text: {
      1: "#7dd3fc",
      2: "#6ee7b7",
      3: "#fca5a5",
      4: "#c4b5fd",
      5: "#fcd34d",
      6: "#f9a8d4",
    },
    label: "#94a3b8",
    labelStroke: "#0c1018",
    revealFlash: "#8cb4e8",
    revealGlow: "#c8daf4",
  };

  const THEME_LIGHT = {
    id: "light",
    name: "Light",
    accent: "#64748b",
    bg: "#e4e9f2",
    bgGlow: "#f2f5fa",
    covered: "#c8d0dc",
    coveredHi: "#d8dee8",
    coveredEdge: "#a8b4c8",
    coveredShadow: "#b0bac8",
    revealed: "#eef1f6",
    revealedEmpty: "#f4f6fa",
    revealedEdge: "#b8c4d4",
    flagFill: "#fce7f3",
    flagIcon: "#e11d48",
    flagEdge: "#f43f5e",
    mine: "#dc2626",
    mineCore: "#fecaca",
    mineEdge: "#b91c1c",
    mineBurst: "#fef08a",
    pentagon: "#bcc6d4",
    pentagonEdge: "#94a3b8",
    hoverRing: "#475569",
    activeRing: "#334155",
    backface: "#d0d8e4",
    backfaceEdge: "#b0bac8",
    text: {
      1: "#0369a1",
      2: "#047857",
      3: "#b91c1c",
      4: "#6d28d9",
      5: "#b45309",
      6: "#be185d",
    },
    label: "#475569",
    labelStroke: "#f8fafc",
    revealFlash: "#cbd5e1",
    revealGlow: "#e2e8f0",
  };

  const THEME_DUSK = {
    id: "dusk",
    name: "Dusk",
    accent: "#a78bfa",
    bg: "#100c18",
    bgGlow: "#1a1428",
    covered: "#241c38",
    coveredHi: "#2e2448",
    coveredEdge: "#4a3a68",
    coveredShadow: "#0c0814",
    revealed: "#342a50",
    revealedEmpty: "#3e325c",
    revealedEdge: "#5a4878",
    flagFill: "#4c1d4a",
    flagIcon: "#f0abfc",
    flagEdge: "#d946ef",
    mine: "#c026d3",
    mineCore: "#3b0764",
    mineEdge: "#86198f",
    mineBurst: "#fde68a",
    pentagon: "#2a2040",
    pentagonEdge: "#504068",
    hoverRing: "#a78bfa",
    activeRing: "#c4b5fd",
    backface: "#181024",
    backfaceEdge: "#281c38",
    text: {
      1: "#93c5fd",
      2: "#6ee7b7",
      3: "#fda4af",
      4: "#c4b5fd",
      5: "#fcd34d",
      6: "#f9a8d4",
    },
    label: "#a89bc8",
    labelStroke: "#100c18",
    revealFlash: "#9f8fd8",
    revealGlow: "#c8b8f0",
  };

  const THEME_EMBER = {
    id: "ember",
    name: "Ember",
    accent: "#fb923c",
    bg: "#0c0604",
    bgGlow: "#180c08",
    covered: "#281810",
    coveredHi: "#342018",
    coveredEdge: "#503828",
    coveredShadow: "#080402",
    revealed: "#3c2818",
    revealedEmpty: "#483020",
    revealedEdge: "#604838",
    flagFill: "#4a1810",
    flagIcon: "#fdba74",
    flagEdge: "#ea580c",
    mine: "#dc2626",
    mineCore: "#450a0a",
    mineEdge: "#991b1b",
    mineBurst: "#fef08a",
    pentagon: "#302018",
    pentagonEdge: "#504030",
    hoverRing: "#fb923c",
    activeRing: "#fdba74",
    backface: "#140c08",
    backfaceEdge: "#241810",
    text: {
      1: "#7dd3fc",
      2: "#86efac",
      3: "#fca5a5",
      4: "#c4b5fd",
      5: "#fcd34d",
      6: "#f9a8d4",
    },
    label: "#c8a090",
    labelStroke: "#0c0604",
    revealFlash: "#d89060",
    revealGlow: "#f0b890",
  };

  const THEME_MOSS = {
    id: "moss",
    name: "Moss",
    accent: "#6b9e72",
    bg: "#080c08",
    bgGlow: "#101810",
    covered: "#182018",
    coveredHi: "#202a20",
    coveredEdge: "#344838",
    coveredShadow: "#040804",
    revealed: "#283830",
    revealedEmpty: "#304438",
    revealedEdge: "#405848",
    flagFill: "#2a3020",
    flagIcon: "#d4a574",
    flagEdge: "#a08058",
    mine: "#7f4a3a",
    mineCore: "#2a1810",
    mineEdge: "#5c3828",
    mineBurst: "#e8d8a0",
    pentagon: "#1c281c",
    pentagonEdge: "#384838",
    hoverRing: "#6b9e72",
    activeRing: "#8fbc8f",
    backface: "#0c100c",
    backfaceEdge: "#182018",
    text: {
      1: "#7ec8e8",
      2: "#8fd4a0",
      3: "#d4a080",
      4: "#a8c8d8",
      5: "#d8c878",
      6: "#c8a8b8",
    },
    label: "#88a888",
    labelStroke: "#080c08",
    revealFlash: "#688868",
    revealGlow: "#98b898",
  };

  const THEMES = [THEME_VOID, THEME_LIGHT, THEME_DUSK, THEME_EMBER, THEME_MOSS];
  const DEFAULT_THEME = THEME_VOID;
  const SIZE_ORDER = ["easy", "medium", "hard"];
  const SIZE_LABEL = { easy: "S", medium: "M", hard: "L" };
  const SIZE_NAMES = { easy: "Small", medium: "Medium", hard: "Large" };
  const SIZE_FACES = { easy: 362, medium: 1002, hard: 1442 };
  const THEME_STORAGE_KEY = "hexsweeper-sphere-theme-v1";
  const SIZE_STORAGE_KEY = "hexsweeper-sphere-size-v1";
  const WELCOME_KEY = "hexsweeper-sphere-welcome-v1";

  function boot(opts) {
    opts = opts || {};
    const canvas = document.getElementById(opts.canvasId || "gameCanvas");
    if (!canvas) throw new Error("SphereSweeper: canvas not found");
    const ctx = canvas.getContext("2d");

    function readStoredThemeId() {
      try {
        const id = localStorage.getItem(THEME_STORAGE_KEY);
        if (id && THEMES.some((t) => t.id === id)) return id;
      } catch (_) {}
      return DEFAULT_THEME.id;
    }

    function readStoredSize() {
      try {
        const val = localStorage.getItem(SIZE_STORAGE_KEY);
        if (val && SIZE_ORDER.includes(val)) return val;
      } catch (_) {}
      return opts.difficulty || "medium";
    }

    let themeIndex = THEMES.findIndex((t) => t.id === readStoredThemeId());
    if (themeIndex < 0) themeIndex = 0;

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
      reduceMotion:
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches,
      radius: 1,
      scale: 200,
      centerX: 0,
      centerY: 0,
      projectedCache: null,
      rotCacheKey: "",
      rafScheduled: false,
    };

    const statsMines = document.getElementById("stats-mines");
    const statsTime = document.getElementById("stats-time");
    const restartBtn = document.getElementById("reset-btn") || document.getElementById("restart-btn");
    const flagToggle = document.getElementById("flag-toggle");
    const sizeBtn = document.getElementById("size-btn");
    const sizeBadge = document.getElementById("size-badge");
    const themeBtn = document.getElementById("theme-btn");
    const themeDot = document.getElementById("theme-dot");
    const themeToast = document.getElementById("theme-toast");
    const helpOverlay = document.getElementById("help-overlay");
    const helpBtn = document.getElementById("help-btn");
    const helpClose = document.getElementById("help-close");
    const helpPlay = document.getElementById("help-play");
    let helpFocusReturn = null;
    let themeToastTimer = 0;

    function themePalette(themeDef) {
      const out = {};
      for (const key of Object.keys(themeDef)) {
        if (key === "id" || key === "name" || key === "accent") continue;
        out[key] = themeDef[key];
      }
      return out;
    }

    function currentThemeDef() {
      return THEMES[themeIndex];
    }

    function syncChromeTheme() {
      const t = currentThemeDef();
      document.body.dataset.sphereTheme = t.id;
      if (themeBtn) {
        themeBtn.title = `Theme — ${t.name}`;
        themeBtn.setAttribute("aria-label", `Theme: ${t.name}`);
      }
      if (themeDot) themeDot.style.background = t.accent;
    }

    function syncSizeChrome() {
      const label = SIZE_LABEL[state.difficulty] || "M";
      const name = SIZE_NAMES[state.difficulty] || "Medium";
      const faces = SIZE_FACES[state.difficulty] || 1002;
      if (sizeBadge) sizeBadge.textContent = label;
      if (sizeBtn) {
        sizeBtn.title = `Size — ${name} (${faces} faces)`;
        sizeBtn.setAttribute("aria-label", `Board size: ${name}`);
      }
    }

    function showThemeToast(name) {
      if (!themeToast) return;
      themeToast.textContent = name;
      themeToast.classList.add("show");
      clearTimeout(themeToastTimer);
      themeToastTimer = setTimeout(() => themeToast.classList.remove("show"), 1400);
    }

    function applyTheme(index, optsApply) {
      optsApply = optsApply || {};
      themeIndex = ((index % THEMES.length) + THEMES.length) % THEMES.length;
      const def = currentThemeDef();
      state.theme = themePalette(def);
      syncChromeTheme();
      try {
        localStorage.setItem(THEME_STORAGE_KEY, def.id);
      } catch (_) {}
      if (optsApply.toast !== false) showThemeToast(def.name);
      scheduleFrame();
    }

    function cycleTheme() {
      applyTheme(themeIndex + 1);
    }

    function setDifficulty(val, restart) {
      if (!SIZE_ORDER.includes(val)) return;
      state.difficulty = val;
      syncSizeChrome();
      try {
        localStorage.setItem(SIZE_STORAGE_KEY, val);
      } catch (_) {}
      if (restart !== false) {
        hideBanner();
        resetGame();
      }
    }

    function cycleSize() {
      const i = SIZE_ORDER.indexOf(state.difficulty);
      const next = SIZE_ORDER[(i + 1) % SIZE_ORDER.length];
      setDifficulty(next, true);
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
      (helpClose || helpPlay)?.focus();
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
      state.scale = Math.min(w, h) * 0.36;
      state.projectedCache = null;
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

    function projectPoint(p, rotY, rotX) {
      const r = rotatePoint(p, rotY, rotX);
      const fov = 2.8;
      const depth = fov / (fov - r.z);
      return {
        x: state.centerX + r.x * state.scale * depth,
        y: state.centerY - r.y * state.scale * depth,
        z: r.z,
        depth,
      };
    }

    function projectTile(tile, rotY, rotX) {
      const center = projectPoint(tile.centerPoint, rotY, rotX);
      const boundary = tile.boundary.map((b) => projectPoint(b, rotY, rotX));
      const avgZ =
        boundary.reduce((s, p) => s + p.z, center.z) / (boundary.length + 1);
      const normal = rotatePoint(tile.centerPoint, rotY, rotX);
      const nLen = Math.hypot(normal.x, normal.y, normal.z) || 1;
      return {
        center,
        boundary,
        z: avgZ,
        normalZ: normal.z / nLen,
        index: tile.index,
        area: hexScreenArea(boundary),
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

    function startTimer() {
      if (state.timerInterval) return;
      state.timerInterval = setInterval(() => {
        state.timeElapsed++;
        updateUI();
      }, 1000);
    }

    function stopTimer() {
      if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
      }
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

    function resetGame() {
      stopTimer();
      const cfg = CONFIG[state.difficulty];
      state.sphere = Hexasphere.generateHexasphere(1, cfg.subdivisions);
      state.tiles = state.sphere.tiles;
      state.cells = state.tiles.map(() => ({
        isMine: false,
        revealed: false,
        flagged: false,
        neighborMines: 0,
        animReveal: 0,
        visualDue: 0,
        pulseAt: 0,
      }));
      state.isFirstClick = true;
      state.isGameOver = false;
      state.won = false;
      state.flagsPlaced = 0;
      state.timeElapsed = 0;
      state.hovered = -1;
      state.pressed = -1;
      state.mineCount = mineTargetForDifficulty(state.tiles.length);
      invalidateProjection();
      updateUI();
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
      cell.revealed = true;
      scheduleRevealVisual(idx, 0);
      if (cell.isMine) {
        cell.animReveal = 1;
        gameOver(false);
        return;
      }
      if (cell.neighborMines === 0) floodFrom(idx);
      checkWin();
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
        for (let i = 0; i < state.cells.length; i++) {
          const c = state.cells[i];
          if (c.isMine) {
            c.revealed = true;
            c.animReveal = 1;
            c.visualDue = 0;
          }
        }
      }
      showBanner(won ? "Cleared the sphere!" : "Mine detonated.");
    }

    function showBanner(msg) {
      let el = document.getElementById("sphere-banner");
      if (!el) {
        el = document.createElement("div");
        el.id = "sphere-banner";
        el.setAttribute("role", "status");
        el.className = "sphere-banner";
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.classList.add("visible");
    }

    function hideBanner() {
      const el = document.getElementById("sphere-banner");
      if (el) el.classList.remove("visible");
    }

    function colorMix(hex, hex2, t) {
      function parse(h) {
        const n = parseInt(h.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
      const a = parse(hex);
      const b = parse(hex2);
      const r = Math.round(a[0] + (b[0] - a[0]) * t);
      const g = Math.round(a[1] + (b[1] - a[1]) * t);
      const bl = Math.round(a[2] + (b[2] - a[2]) * t);
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
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth != null ? lineWidth : 1.4;
      ctx.stroke();
    }

    function drawHexRing(proj, color, lineWidth) {
      if (!drawHexPath(proj)) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }

    function labelFontSize(area) {
      const base = Math.sqrt(area) * 0.42;
      return Math.max(9, Math.min(18, base));
    }

    function drawLabel(proj, text, color, opts) {
      opts = opts || {};
      const size = opts.size || labelFontSize(proj.area);
      const weight = opts.weight || "700";
      ctx.font = `${weight} ${size}px IBM Plex Sans, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (opts.stroke) {
        ctx.lineWidth = opts.strokeWidth || Math.max(2, size * 0.18);
        ctx.strokeStyle = opts.stroke;
        ctx.strokeText(text, proj.center.x, proj.center.y);
      }
      ctx.fillStyle = color;
      ctx.fillText(text, proj.center.x, proj.center.y);
    }

    function coveredStyle(proj, tile, isFront) {
      const T = state.theme;
      const lit = shadeByNormal;
      let fill = tile.isPentagon ? T.pentagon : T.covered;
      let stroke = tile.isPentagon ? T.pentagonEdge : T.coveredEdge;
      fill = lit(fill, proj.normalZ, isFront ? 0.38 : 0.22);
      if (isFront) fill = colorMix(fill, T.coveredHi, 0.15);
      return {
        fill,
        stroke,
        lineWidth: tile.isPentagon ? 1.6 : 1.4,
        showLabel: false,
      };
    }

    function tileColors(idx, proj, cell, tile, now) {
      const T = state.theme;
      const lit = shadeByNormal;
      const isBack = proj.z <= 0.02;
      const isFront = proj.z > 0.08;

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
        if (cell.isMine) {
          return {
            fill: lit(T.mine, proj.normalZ, 0.25),
            stroke: T.mineEdge,
            lineWidth: 2,
            showLabel: true,
            label: "✹",
            labelColor: T.mineBurst,
            labelStroke: T.mineCore,
          };
        }
        const empty = cell.neighborMines === 0;
        let fill = lit(empty ? T.revealedEmpty : T.revealed, proj.normalZ, 0.28);
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

      if (cell.flagged) {
        return {
          fill: lit(T.flagFill, proj.normalZ, 0.2),
          stroke: T.flagEdge,
          lineWidth: 2,
          showLabel: true,
          label: "⚑",
          labelColor: T.flagIcon,
          labelStroke: T.mineCore,
        };
      }

      return coveredStyle(proj, tile, isFront);
    }

    function popProjected(proj, pop) {
      if (pop >= 0.999) return proj;
      const cx = proj.center.x;
      const cy = proj.center.y;
      return {
        ...proj,
        boundary: proj.boundary.map((p) => ({
          x: cx + (p.x - cx) * pop,
          y: cy + (p.y - cy) * pop,
        })),
        area: proj.area * pop * pop,
      };
    }

    function draw() {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      ctx.clearRect(0, 0, w, h);

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

      if (!state.reduceMotion) {
        state.rotY += (state.targetRotY - state.rotY) * 0.12;
        state.rotX += (state.targetRotX - state.rotX) * 0.12;
      } else {
        state.rotY = state.targetRotY;
        state.rotX = state.targetRotX;
      }

      const projected = getProjected();
      const now = performance.now();

      for (const proj of projected) {
        const idx = proj.index;
        const cell = state.cells[idx];
        const tile = state.tiles[idx];
        const colors = tileColors(idx, proj, cell, tile, now);
        let drawProj = proj;
        if (
          cell.revealed &&
          now >= cell.visualDue &&
          cell.animReveal < 1 &&
          !state.reduceMotion
        ) {
          const pop = 0.86 + cell.animReveal * 0.14;
          drawProj = popProjected(proj, pop);
        }

        drawHex(drawProj, colors.fill, colors.stroke, colors.lineWidth);

        if (colors.showLabel && colors.label) {
          drawLabel(drawProj, colors.label, colors.labelColor, {
            stroke: colors.labelStroke,
            weight: cell.flagged ? "600" : "700",
          });
        }
      }

      if (!state.isGameOver) {
        const highlightIdx = state.pressed >= 0 ? state.pressed : state.hovered;
        if (highlightIdx >= 0) {
          const hp = projected.find((p) => p.index === highlightIdx && p.z > 0.02);
          if (hp) {
            const ringColor = state.pressed >= 0 ? state.theme.activeRing : state.theme.hoverRing;
            const lw = state.pressed >= 0 ? 3.2 : 2.4;
            drawHexRing(hp, ringColor, lw);
            if (state.pressed < 0 && !state.cells[highlightIdx].revealed) {
              drawHex(
                hp,
                colorMix(state.theme.coveredHi, state.theme.hoverRing, 0.35),
                state.theme.hoverRing,
                1.6
              );
            }
          }
        }
      }
    }

    function frameNeedsPaint(now) {
      if (state.dragging || state.pressed >= 0 || state.hovered >= 0) return true;
      if (revealAnimBusy(now)) return true;
      if (state.isGameOver) return true;
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
      tickRevealAnim(now);
      draw();
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

    function onPointerDown(e) {
      if (state.isGameOver && state.won) return;
      const p = canvasPoint(e);
      touchMoved = false;
      state.dragging = true;
      state.dragStart = { x: p.x, y: p.y, rotY: state.targetRotY, rotX: state.targetRotX };
      state.hovered = pickTile(p.x, p.y);
      state.pressed = state.hovered;
      if (e.type === "touchstart") {
        clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
          if (state.hovered >= 0 && !touchMoved) {
            toggleFlag(state.hovered);
            touchMoved = true;
            state.pressed = -1;
          }
        }, 480);
      }
    }

    function onPointerMove(e) {
      const p = canvasPoint(e);
      if (state.dragging && state.dragStart) {
        const dx = p.x - state.dragStart.x;
        const dy = p.y - state.dragStart.y;
        if (Math.hypot(dx, dy) > 6) {
          touchMoved = true;
          clearTimeout(longPressTimer);
          state.pressed = -1;
          state.targetRotY = state.dragStart.rotY + dx * 0.008;
          state.targetRotX = Math.max(
            -0.8,
            Math.min(0.8, state.dragStart.rotX + dy * 0.008)
          );
          invalidateProjection();
        }
      }
      state.hovered = pickTile(p.x, p.y);
    }

    function onPointerUp(e) {
      clearTimeout(longPressTimer);
      const p = canvasPoint(e.changedTouches ? e.changedTouches[0] : e);
      if (!touchMoved && state.dragStart) {
        const idx = pickTile(p.x, p.y);
        if (idx >= 0 && !state.isGameOver) {
          if (state.flagMode || e.button === 2) toggleFlag(idx);
          else reveal(idx);
        } else if (state.isGameOver) {
          hideBanner();
          resetGame();
        }
      }
      state.dragging = false;
      state.dragStart = null;
      state.pressed = -1;
      touchMoved = false;
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

    if (restartBtn) {
      restartBtn.addEventListener("click", () => {
        hideBanner();
        resetGame();
      });
    }
    if (flagToggle) {
      flagToggle.addEventListener("click", () => {
        state.flagMode = !state.flagMode;
        flagToggle.setAttribute("aria-pressed", state.flagMode ? "true" : "false");
        flagToggle.classList.toggle("active", state.flagMode);
      });
    }
    if (sizeBtn) sizeBtn.addEventListener("click", cycleSize);
    if (themeBtn) themeBtn.addEventListener("click", cycleTheme);
    if (helpBtn) helpBtn.addEventListener("click", () => openHelp(false));
    if (helpClose) helpClose.addEventListener("click", closeHelp);
    if (helpPlay) helpPlay.addEventListener("click", closeHelp);
    helpOverlay?.addEventListener("click", (e) => {
      if (e.target === helpOverlay) closeHelp();
    });

    window.addEventListener("keydown", (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        if (helpOverlay?.classList.contains("open")) closeHelp();
        else openHelp(false);
        return;
      }
      if (e.key === "Escape") {
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
      if (e.key === "r" || e.key === "R") {
        hideBanner();
        resetGame();
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
    if (opts.theme) state.theme = Object.assign({}, state.theme, opts.theme);

    try {
      const forceWelcome = /(?:\?|&)welcome=1(?:&|$)/.test(location.search);
      const skipWelcome =
        /(?:\?|&)welcome=0(?:&|$)/.test(location.search);
      if (forceWelcome) openHelp(true);
      else if (!skipWelcome && !localStorage.getItem(WELCOME_KEY)) openHelp(true);
    } catch (_) {
      openHelp(true);
    }

    window.addEventListener("resize", resize);
    resize();
    resetGame();
    scheduleFrame();

    return {
      reset: resetGame,
      floodFrom,
      getState: () => state,
      pickTile,
      projectTile,
      mineTargetForDifficulty,
    };
  }

  global.SphereSweeper = {
    boot,
    CONFIG,
    THEMES,
    DEFAULT_THEME: THEME_VOID,
  };
})(typeof window !== "undefined" ? window : global);
