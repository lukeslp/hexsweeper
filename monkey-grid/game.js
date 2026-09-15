/**
 * File Purpose: Flat hex-grid route-blocking game for Catch the Monkey.
 * Primary Functions: buildGarden, shortestEscape, closeHex, draw.
 * Author: Luke Steuber <luke@lukesteuber.com>
 */
(function () {
  "use strict";

  const RADIUS = 5;
  const STARTING_WALLS = 14;
  const DIRECTIONS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const turnCount = document.getElementById("turn-count");
  const exitCount = document.getElementById("exit-count");
  const undoButton = document.getElementById("undo-button");
  const newButton = document.getElementById("new-button");
  const result = document.getElementById("result");
  const resultTitle = document.getElementById("result-title");
  const resultCopy = document.getElementById("result-copy");
  const liveStatus = document.getElementById("live-status");
  const helpOverlay = document.getElementById("help-overlay");
  const helpButton = document.getElementById("help-button");
  const helpClose = document.getElementById("help-close");
  const helpDone = document.getElementById("help-done");

  const cells = [];
  const byKey = new Map();
  let walls = new Set();
  let monkey = 0;
  let turns = 0;
  let gameOver = false;
  let outcome = "";
  let seed = 1;
  let turnHistory = [];
  let hovered = -1;
  let keyboardSelected = -1;
  let polygons = [];
  let layout = { size: 20, cx: 0, cy: 0 };
  let hop = null;
  let raf = 0;

  function key(q, r) { return `${q},${r}`; }
  function distance(q, r) { return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)); }
  for (let q = -RADIUS; q <= RADIUS; q += 1) {
    for (let r = -RADIUS; r <= RADIUS; r += 1) {
      if (distance(q, r) > RADIUS) continue;
      const cell = { index: cells.length, q, r, edge: distance(q, r) === RADIUS, neighbors: [] };
      cells.push(cell);
      byKey.set(key(q, r), cell.index);
    }
  }
  cells.forEach((cell) => {
    cell.neighbors = DIRECTIONS.map(([dq, dr]) => byKey.get(key(cell.q + dq, cell.r + dr))).filter(Number.isInteger);
  });
  const centerIndex = byKey.get("0,0");

  function mulberry32(value) {
    let a = value >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(values, salt) {
    const copy = values.slice();
    const random = mulberry32((seed ^ salt) >>> 0);
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function escapeSearch(start, salt) {
    const parent = new Map([[start, -1]]);
    const depth = new Map([[start, 0]]);
    const queue = [start];
    const exits = [];
    let nearest = Infinity;
    while (queue.length) {
      const current = queue.shift();
      const d = depth.get(current);
      if (d > nearest) break;
      if (cells[current].edge) {
        nearest = d;
        exits.push(current);
        continue;
      }
      for (const next of shuffled(cells[current].neighbors, salt + current * 97)) {
        if (walls.has(next) || parent.has(next)) continue;
        parent.set(next, current);
        depth.set(next, d + 1);
        queue.push(next);
      }
    }
    if (!exits.length) return { path: null, reachableExits: 0 };
    const target = shuffled(exits, salt + 911)[0];
    const path = [];
    let cursor = target;
    while (cursor >= 0) {
      path.push(cursor);
      cursor = parent.get(cursor);
    }
    path.reverse();

    const reachable = new Set([start]);
    const reachQueue = [start];
    let reachableExits = 0;
    while (reachQueue.length) {
      const current = reachQueue.shift();
      if (cells[current].edge) reachableExits += 1;
      for (const next of cells[current].neighbors) {
        if (walls.has(next) || reachable.has(next)) continue;
        reachable.add(next);
        reachQueue.push(next);
      }
    }
    return { path, reachableExits };
  }

  function currentSearch() { return escapeSearch(monkey, turns * 4099 + 17); }

  function randomSeed() {
    if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
      const value = new Uint32Array(1);
      globalThis.crypto.getRandomValues(value);
      return value[0] || 1;
    }
    return Math.floor(Math.random() * 0xffffffff) || 1;
  }

  function querySeed() {
    const value = Number(new URLSearchParams(location.search).get("seed"));
    return Number.isFinite(value) && value > 0 ? value >>> 0 : randomSeed();
  }

  function updateURL() {
    try {
      const url = new URL(location.href);
      url.searchParams.set("seed", String(seed));
      window.history.replaceState(window.history.state, "", url);
    } catch (_) {}
  }

  function buildGarden(nextSeed) {
    seed = nextSeed || randomSeed();
    const random = mulberry32(seed);
    monkey = centerIndex;
    turns = 0;
    gameOver = false;
    outcome = "";
    turnHistory = [];
    hovered = -1;
    hop = null;
    walls = new Set();
    const candidates = cells.filter((cell) => cell.index !== centerIndex && distance(cell.q, cell.r) > 1);
    let attempts = 0;
    do {
      walls.clear();
      const pool = candidates.slice();
      for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      pool.slice(0, STARTING_WALLS).forEach((cell) => walls.add(cell.index));
      attempts += 1;
    } while (!escapeSearch(monkey, attempts * 101).path && attempts < 40);
    keyboardSelected = cells.find((cell) => cell.index !== monkey && !walls.has(cell.index))?.index ?? -1;
    result.hidden = true;
    updateURL();
    updateUI();
    scheduleDraw();
  }

  function snapshot() {
    return { walls: Array.from(walls), monkey, turns, gameOver, outcome };
  }

  function restore(saved) {
    walls = new Set(saved.walls);
    monkey = saved.monkey;
    turns = saved.turns;
    gameOver = saved.gameOver;
    outcome = saved.outcome;
    hop = null;
    if (keyboardSelected < 0 || keyboardSelected === monkey || walls.has(keyboardSelected)) {
      keyboardSelected = cells.find((cell) => cell.index !== monkey && !walls.has(cell.index))?.index ?? -1;
    }
    result.hidden = !gameOver;
    if (gameOver) showResult(outcome);
    updateUI();
    scheduleDraw();
  }

  function showResult(kind) {
    result.hidden = false;
    if (kind === "caught") {
      resultTitle.textContent = "Caught in the garden.";
      resultCopy.textContent = `${turns} wall${turns === 1 ? "" : "s"} closed every route. Press New for another arrangement.`;
    } else {
      resultTitle.textContent = "The monkey found the rim.";
      resultCopy.textContent = `It escaped after ${turns} turn${turns === 1 ? "" : "s"}. Undo the last wall or start a new garden.`;
    }
  }

  function closeHex(index) {
    if (gameOver || hop || index < 0 || index === monkey || walls.has(index)) return;
    turnHistory.push(snapshot());
    walls.add(index);
    turns += 1;
    let search = currentSearch();
    if (!search.path) {
      gameOver = true;
      outcome = "caught";
      showResult(outcome);
      liveStatus.textContent = `Caught in ${turns} turns.`;
      updateUI();
      scheduleDraw();
      return;
    }
    const from = monkey;
    const next = search.path[1];
    monkey = next;
    if (!reduceMotion) hop = { from, to: next, started: performance.now(), duration: 230 };
    if (cells[monkey].edge) {
      gameOver = true;
      outcome = "escaped";
      showResult(outcome);
      liveStatus.textContent = `The monkey escaped after ${turns} turns.`;
    } else {
      search = currentSearch();
      liveStatus.textContent = `Wall closed. The monkey moved. ${search.reachableExits} perimeter exits remain open.`;
    }
    updateUI();
    scheduleDraw();
  }

  function updateUI() {
    const search = currentSearch();
    turnCount.textContent = String(turns);
    exitCount.textContent = gameOver && outcome === "caught" ? "0" : String(search.reachableExits);
    undoButton.disabled = turnHistory.length === 0;
    document.body.dataset.gameState = outcome || "playing";
    document.body.dataset.turns = String(turns);
    document.body.dataset.monkey = String(monkey);
    canvas.setAttribute("aria-label", gameOver
      ? outcome === "caught" ? `Monkey caught in ${turns} turns.` : `Monkey escaped after ${turns} turns.`
      : `Catch the Monkey board. ${search.reachableExits} open perimeter exits. Select an empty hex to close it.`);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(2, Math.round(rect.width * dpr));
    canvas.height = Math.max(2, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const width = rect.width;
    const height = rect.height;
    const sizeByWidth = width / (Math.sqrt(3) * (RADIUS * 2 + 1.35));
    const sizeByHeight = height / (1.5 * RADIUS * 2 + 2.25);
    layout = { size: Math.max(9, Math.min(sizeByWidth, sizeByHeight)), cx: width / 2, cy: height / 2 };
    scheduleDraw();
  }

  function pointFor(cell) {
    return {
      x: layout.cx + layout.size * Math.sqrt(3) * (cell.q + cell.r / 2),
      y: layout.cy + layout.size * 1.5 * cell.r,
    };
  }

  function hexPath(x, y, radius) {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = Math.PI / 180 * (60 * i - 30);
      const px = x + radius * Math.cos(angle);
      const py = y + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function monkeyPosition(now) {
    const current = pointFor(cells[monkey]);
    if (!hop) return current;
    const from = pointFor(cells[hop.from]);
    const to = pointFor(cells[hop.to]);
    const raw = Math.min(1, (now - hop.started) / hop.duration);
    const t = 1 - Math.pow(1 - raw, 3);
    const lift = Math.sin(t * Math.PI) * layout.size * 0.38;
    if (raw >= 1) hop = null;
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t - lift };
  }

  function drawMonkey(x, y, radius, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.strokeStyle = "#11130f";
    ctx.lineWidth = Math.max(1.4, radius * 0.09);
    ctx.beginPath(); ctx.arc(-radius * .62, -radius * .05, radius * .27, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(radius * .62, -radius * .05, radius * .27, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, radius * .67, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#11130f";
    ctx.beginPath(); ctx.arc(-radius * .22, -radius * .1, radius * .075, 0, Math.PI * 2); ctx.arc(radius * .22, -radius * .1, radius * .075, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.arc(0, radius * .1, radius * .28, .12 * Math.PI, .88 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    raf = 0;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);
    polygons = [];
    const now = performance.now();
    const search = currentSearch();
    const predicted = !gameOver && search.path && search.path[1];
    const shadow = ctx.createRadialGradient(layout.cx, layout.cy + layout.size * 2, layout.size, layout.cx, layout.cy, layout.size * 8.8);
    shadow.addColorStop(0, "rgba(42,37,27,.12)");
    shadow.addColorStop(1, "rgba(42,37,27,0)");
    ctx.fillStyle = shadow;
    ctx.beginPath(); ctx.arc(layout.cx, layout.cy, layout.size * 8.8, 0, Math.PI * 2); ctx.fill();

    for (const cell of cells) {
      const point = pointFor(cell);
      polygons[cell.index] = point;
      const isWall = walls.has(cell.index);
      const isHover = hovered === cell.index && !isWall && cell.index !== monkey && !gameOver;
      const isKeyboard = document.activeElement === canvas && keyboardSelected === cell.index;
      hexPath(point.x, point.y, layout.size * .965);
      ctx.fillStyle = isWall ? "#132018" : isHover || isKeyboard ? "#fff9dc" : "rgba(245,239,207,.78)";
      ctx.fill();
      ctx.strokeStyle = isKeyboard ? "#f5cc66" : isWall ? "#0a120d" : cell.edge ? "#687863" : "rgba(13,27,17,.42)";
      ctx.lineWidth = isKeyboard ? 3 : isHover ? 2.1 : cell.edge ? 1.65 : 1.05;
      ctx.stroke();

      if (cell.edge && !isWall) {
        const mag = Math.hypot(cell.q + cell.r / 2, cell.r * .86) || 1;
        const dx = (cell.q + cell.r / 2) / mag;
        const dy = (cell.r * .86) / mag;
        ctx.beginPath();
        ctx.moveTo(point.x + dx * layout.size * .64, point.y + dy * layout.size * .64);
        ctx.lineTo(point.x + dx * layout.size * .92, point.y + dy * layout.size * .92);
        ctx.strokeStyle = "#777b72";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (cell.index === predicted && cell.index !== monkey) {
        ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(2.2, layout.size * .11), 0, Math.PI * 2);
        ctx.fillStyle = "#d59a24"; ctx.fill();
      }
    }

    const mp = monkeyPosition(now);
    drawMonkey(mp.x, mp.y, layout.size * .68, outcome === "caught" ? "#6ca47f" : outcome === "escaped" ? "#d95b4f" : "#d7a232");
    if (hop) scheduleDraw();
  }

  function scheduleDraw() {
    if (!raf) raf = requestAnimationFrame(draw);
  }

  function hitTest(x, y) {
    let best = -1;
    let bestDistance = layout.size * .92;
    polygons.forEach((point, index) => {
      if (!point) return;
      const d = Math.hypot(x - point.x, y - point.y);
      if (d < bestDistance) { best = index; bestDistance = d; }
    });
    return best;
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  canvas.addEventListener("pointermove", (event) => {
    const point = canvasPoint(event);
    hovered = hitTest(point.x, point.y);
    scheduleDraw();
  });
  canvas.addEventListener("pointerleave", () => { hovered = -1; scheduleDraw(); });
  canvas.addEventListener("pointerup", (event) => {
    const point = canvasPoint(event);
    keyboardSelected = hitTest(point.x, point.y);
    closeHex(keyboardSelected);
  });
  canvas.addEventListener("focus", () => {
    if (keyboardSelected < 0) keyboardSelected = cells.find((cell) => cell.index !== monkey && !walls.has(cell.index))?.index ?? -1;
    scheduleDraw();
  });
  canvas.addEventListener("blur", scheduleDraw);

  undoButton.addEventListener("click", () => {
    if (!turnHistory.length) return;
    restore(turnHistory.pop());
    liveStatus.textContent = "Last turn undone.";
  });
  newButton.addEventListener("click", () => buildGarden(randomSeed()));

  let helpReturn = null;
  function openHelp() {
    helpReturn = document.activeElement;
    helpOverlay.hidden = false;
    helpDone.focus();
  }
  function closeHelp() {
    helpOverlay.hidden = true;
    if (helpReturn && typeof helpReturn.focus === "function") helpReturn.focus();
  }
  helpButton.addEventListener("click", openHelp);
  helpClose.addEventListener("click", closeHelp);
  helpDone.addEventListener("click", closeHelp);
  helpOverlay.addEventListener("click", (event) => { if (event.target === helpOverlay) closeHelp(); });

  addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !helpOverlay.hidden) {
      closeHelp();
      return;
    }
    if (!helpOverlay.hidden) {
      if (event.key === "Tab") {
        event.preventDefault();
        const target = event.shiftKey
          ? document.activeElement === helpClose ? helpDone : helpClose
          : document.activeElement === helpDone ? helpClose : helpDone;
        target.focus();
      }
      return;
    }
    if ((event.key === "u" || event.key === "U")) undoButton.click();
    else if ((event.key === "r" || event.key === "R")) newButton.click();
    else if (event.key === "?") openHelp();
    else if (document.activeElement === canvas) {
      const moves = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        closeHex(keyboardSelected);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const current = cells[keyboardSelected] || cells[centerIndex];
        const [dq, dr] = moves[event.key];
        const next = byKey.get(key(current.q + dq, current.r + dr));
        if (Number.isInteger(next)) {
          keyboardSelected = next;
          liveStatus.textContent = walls.has(next) ? "Closed hex selected." : next === monkey ? "Monkey hex selected." : "Open hex selected. Press Enter to close it.";
          scheduleDraw();
        }
      }
    }
  });
  addEventListener("resize", resize, { passive: true });

  buildGarden(querySeed());
  resize();
})();
