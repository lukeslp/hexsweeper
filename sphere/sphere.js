/**
 * File Purpose: Hexsweeper on a closed hex sphere — dig/flag/flood via neighborIndices.
 * Primary Functions/Classes: SphereSweeper.boot, project, pick, render loop.
 * Inputs: canvas, difficulty, theme. Outputs: playable sphere minesweeper (experimental).
 * Notes: Canvas 2D orthographic projection; drag rotates; first dig safe; RM-safe camera lerp.
 */
(function (global) {
  "use strict";

  const CONFIG = {
    easy: { subdivisions: 1, mines: 2 },
    medium: { subdivisions: 2, mines: 8 },
    hard: { subdivisions: 3, mines: 18 },
  };

  const DEFAULT_THEME = {
    bg: "#0c1018",
    covered: "#1a2233",
    coveredEdge: "#2a3548",
    revealed: "#243044",
    revealedEdge: "#3d4f68",
    flag: "#ef4444",
    mine: "#f87171",
    pentagon: "#2d3a52",
    text: {
      1: "#60a5fa",
      2: "#34d399",
      3: "#f87171",
      4: "#a78bfa",
      5: "#fbbf24",
      6: "#f472b6",
    },
    label: "#8b9cb8",
  };

  function boot(opts) {
    opts = opts || {};
    const canvas = document.getElementById(opts.canvasId || "gameCanvas");
    if (!canvas) throw new Error("SphereSweeper: canvas not found");
    const ctx = canvas.getContext("2d");

    const state = {
      canvas,
      ctx,
      theme: Object.assign({}, DEFAULT_THEME, opts.theme || {}),
      difficulty: opts.difficulty || "medium",
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
      timeElapsed: 0,
      timerInterval: null,
      reduceMotion:
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches,
      radius: 1,
      scale: 200,
      centerX: 0,
      centerY: 0,
    };

    const modal = document.getElementById("modal-overlay");
    const diffOptions = document.querySelectorAll(".diff-option");
    const statsMines = document.getElementById("stats-mines");
    const statsTime = document.getElementById("stats-time");
    const menuBtn = document.getElementById("menu-btn");
    const closeBtn = document.getElementById("close-modal-btn");
    const restartBtn = document.getElementById("reset-btn") || document.getElementById("restart-btn");
    const flagToggle = document.getElementById("flag-toggle");

    function openModal() {
      if (modal) modal.classList.add("open");
    }
    function closeModal() {
      if (modal) modal.classList.remove("open");
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
      return { center, boundary, z: avgZ, index: tile.index };
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
      const projected = state.tiles
        .map((t) => projectTile(t, state.rotY, state.rotX))
        .filter((p) => p.z > -0.15)
        .sort((a, b) => a.z - b.z);
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

    function placeMines(safeIdx) {
      const cfg = CONFIG[state.difficulty];
      const forbidden = new Set([safeIdx]);
      for (const n of state.tiles[safeIdx].neighborIndices) forbidden.add(n);
      const candidates = [];
      for (let i = 0; i < state.cells.length; i++) {
        if (!forbidden.has(i)) candidates.push(i);
      }
      shuffle(candidates);
      const count = Math.min(cfg.mines, candidates.length);
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
      }));
      state.isFirstClick = true;
      state.isGameOver = false;
      state.won = false;
      state.flagsPlaced = 0;
      state.timeElapsed = 0;
      state.mineCount = cfg.mines;
      updateUI();
    }

    /** Immediate flood for zeros — returns set of opened indices (excl. start). */
    function floodFrom(startIdx) {
      const opened = new Set();
      const queue = [{ idx: startIdx, dist: 0 }];
      const visited = new Set([startIdx]);
      while (queue.length) {
        const { idx } = queue.shift();
        for (const n of state.tiles[idx].neighborIndices) {
          if (visited.has(n)) continue;
          visited.add(n);
          const c = state.cells[n];
          if (c.revealed || c.flagged || c.isMine) continue;
          c.revealed = true;
          opened.add(n);
          if (c.neighborMines === 0) queue.push({ idx: n, dist: 0 });
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
      if (cell.isMine) {
        gameOver(false);
        return;
      }
      if (cell.neighborMines === 0) floodFrom(idx);
      checkWin();
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
          if (state.cells[i].isMine) state.cells[i].revealed = true;
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

    function drawHex(proj, fill, stroke) {
      const ctx = state.ctx;
      const pts = proj.boundary;
      if (pts.length < 3) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    function drawLabel(proj, text, color) {
      state.ctx.fillStyle = color;
      state.ctx.font = "600 13px IBM Plex Sans, system-ui, sans-serif";
      state.ctx.textAlign = "center";
      state.ctx.textBaseline = "middle";
      state.ctx.fillText(text, proj.center.x, proj.center.y);
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

    function draw() {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = state.theme.bg;
      ctx.fillRect(0, 0, w, h);

      if (!state.reduceMotion) {
        state.rotY += (state.targetRotY - state.rotY) * 0.12;
        state.rotX += (state.targetRotX - state.rotX) * 0.12;
      } else {
        state.rotY = state.targetRotY;
        state.rotX = state.targetRotX;
      }

      const projected = state.tiles
        .map((t) => projectTile(t, state.rotY, state.rotX))
        .filter((p) => p.z > -0.2)
        .sort((a, b) => a.z - b.z);

      for (const proj of projected) {
        const idx = proj.index;
        const cell = state.cells[idx];
        const tile = state.tiles[idx];
        let fill = state.theme.covered;
        let stroke = state.theme.coveredEdge;

        if (tile.isPentagon && !cell.revealed) fill = state.theme.pentagon;

        if (cell.revealed) {
          if (cell.isMine) {
            fill = state.theme.mine;
            stroke = "#991b1b";
          } else {
            fill = state.theme.revealed;
            stroke = state.theme.revealedEdge;
          }
        }

        if (idx === state.hovered && !state.isGameOver) {
          fill = colorMix(fill, "#ffffff", 0.12);
        }

        drawHex(proj, fill, stroke);

        if (cell.flagged && !cell.revealed) {
          drawLabel(proj, "⚑", state.theme.flag);
        } else if (cell.revealed && cell.isMine) {
          drawLabel(proj, "✹", "#fff");
        } else if (cell.revealed && cell.neighborMines > 0) {
          drawLabel(
            proj,
            String(cell.neighborMines),
            state.theme.text[cell.neighborMines] || state.theme.label
          );
        }
      }
    }

    function loop() {
      draw();
      requestAnimationFrame(loop);
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
      if (e.type === "touchstart") {
        clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
          if (state.hovered >= 0 && !touchMoved) {
            toggleFlag(state.hovered);
            touchMoved = true;
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
          state.targetRotY = state.dragStart.rotY + dx * 0.008;
          state.targetRotX = Math.max(
            -0.8,
            Math.min(0.8, state.dragStart.rotX + dy * 0.008)
          );
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

    if (menuBtn) menuBtn.addEventListener("click", openModal);
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
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
    diffOptions.forEach((btn) => {
      btn.addEventListener("click", () => {
        diffOptions.forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");
        state.difficulty = btn.dataset.val;
        hideBanner();
        resetGame();
        closeModal();
      });
    });

    window.addEventListener("keydown", (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
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
    });

    window.addEventListener("resize", resize);
    resize();
    resetGame();
    loop();

    return {
      reset: resetGame,
      floodFrom,
      getState: () => state,
      pickTile,
      projectTile,
    };
  }

  global.SphereSweeper = { boot, CONFIG, DEFAULT_THEME };
})(typeof window !== "undefined" ? window : global);
