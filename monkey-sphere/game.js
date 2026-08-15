/**
 * File Purpose: Spherical route-blocking game for Catch the Monkey.
 * Primary Functions: buildOrbit, shortestPortal, closeFace, projectTiles, draw.
 * Author: Luke Steuber <luke@lukesteuber.com>
 */
(function () {
  "use strict";

  const STARTING_WALLS = 25;
  const PORTAL_TOTAL = 3;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const turnCount = document.getElementById("turn-count");
  const portalCount = document.getElementById("portal-count");
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

  const geometry = Hexasphere.generateHexasphere(1, 4);
  const tiles = geometry.tiles;
  let walls = new Set();
  let portals = new Set();
  let monkey = 0;
  let turns = 0;
  let gameOver = false;
  let outcome = "";
  let seed = 1;
  let turnHistory = [];
  let hovered = -1;
  let keyboardSelected = -1;
  let projected = [];
  let rotation = { x: -0.17, y: 0.38 };
  let zoom = 1;
  let drag = null;
  let hop = null;
  let raf = 0;
  let drawTime = 0;

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

  function distancesFrom(starts, respectWalls) {
    const distance = new Map();
    const queue = [];
    starts.forEach((index) => {
      distance.set(index, 0);
      queue.push(index);
    });
    while (queue.length) {
      const current = queue.shift();
      for (const next of tiles[current].neighborIndices) {
        if (distance.has(next) || (respectWalls && walls.has(next))) continue;
        distance.set(next, distance.get(current) + 1);
        queue.push(next);
      }
    }
    return distance;
  }

  function choosePortals() {
    const candidates = tiles.filter((tile) => !tile.isPentagon).map((tile) => tile.index);
    const chosen = [shuffled(candidates, 41)[0]];
    while (chosen.length < PORTAL_TOTAL) {
      const distance = distancesFrom(chosen, false);
      const available = candidates.filter((index) => !chosen.includes(index));
      const furthest = Math.max(...available.map((index) => distance.get(index)));
      chosen.push(shuffled(available.filter((index) => distance.get(index) === furthest), 71 + chosen.length)[0]);
    }
    return new Set(chosen);
  }

  function shortestPortal(start, salt) {
    const parent = new Map([[start, -1]]);
    const queue = [start];
    let target = -1;
    while (queue.length) {
      const current = queue.shift();
      if (portals.has(current)) {
        target = current;
        break;
      }
      for (const next of shuffled(tiles[current].neighborIndices, salt + current * 101)) {
        if (walls.has(next) || parent.has(next)) continue;
        parent.set(next, current);
        queue.push(next);
      }
    }
    if (target < 0) return { path: null, reachablePortals: 0 };
    const path = [];
    for (let cursor = target; cursor >= 0; cursor = parent.get(cursor)) path.push(cursor);
    path.reverse();

    const reachable = new Set([start]);
    const reachQueue = [start];
    const exits = new Set();
    while (reachQueue.length) {
      const current = reachQueue.shift();
      if (portals.has(current)) exits.add(current);
      for (const next of tiles[current].neighborIndices) {
        if (walls.has(next) || reachable.has(next)) continue;
        reachable.add(next);
        reachQueue.push(next);
      }
    }
    return { path, reachablePortals: exits.size };
  }

  function currentSearch() { return shortestPortal(monkey, turns * 4099 + 113); }

  function buildOrbit(nextSeed) {
    seed = nextSeed || randomSeed();
    portals = choosePortals();
    walls = new Set();
    const baseDistances = distancesFrom(Array.from(portals), false);
    const maxDistance = Math.max(...Array.from(baseDistances.values()));
    monkey = shuffled(tiles.filter((tile) => !tile.isPentagon && baseDistances.get(tile.index) === maxDistance).map((tile) => tile.index), 211)[0];
    const protectedFaces = new Set([monkey, ...portals]);
    tiles[monkey].neighborIndices.forEach((index) => protectedFaces.add(index));
    const candidates = tiles.filter((tile) => !protectedFaces.has(tile.index));
    let attempts = 0;
    do {
      walls.clear();
      shuffled(candidates, 307 + attempts * 13).slice(0, STARTING_WALLS).forEach((tile) => walls.add(tile.index));
      attempts += 1;
    } while (!shortestPortal(monkey, attempts * 173).path && attempts < 60);

    turns = 0;
    gameOver = false;
    outcome = "";
    turnHistory = [];
    hovered = -1;
    keyboardSelected = -1;
    hop = null;
    result.hidden = true;
    const startPoint = tiles[monkey].centerPoint;
    rotation = {
      x: Math.atan2(startPoint.y, Math.hypot(startPoint.x, startPoint.z)),
      y: Math.atan2(-startPoint.x, startPoint.z),
    };
    updateURL();
    updateUI();
    scheduleDraw();
  }

  function snapshot() {
    return { walls: Array.from(walls), monkey, turns, gameOver, outcome, rotation: { ...rotation } };
  }

  function restore(saved) {
    walls = new Set(saved.walls);
    monkey = saved.monkey;
    turns = saved.turns;
    gameOver = saved.gameOver;
    outcome = saved.outcome;
    rotation = saved.rotation;
    hop = null;
    keyboardSelected = -1;
    result.hidden = !gameOver;
    if (gameOver) showResult(outcome);
    updateUI();
    scheduleDraw();
  }

  function showResult(kind) {
    result.hidden = false;
    if (kind === "caught") {
      resultTitle.textContent = "Caught between worlds.";
      resultCopy.textContent = `${turns} closed face${turns === 1 ? "" : "s"} sealed all three portals. Rotate and play another orbit.`;
    } else {
      resultTitle.textContent = "The monkey found a portal.";
      resultCopy.textContent = `It escaped after ${turns} turn${turns === 1 ? "" : "s"}. Undo the last face or start a new orbit.`;
    }
  }

  function closeFace(index) {
    if (gameOver || hop || index < 0 || index === monkey || walls.has(index) || portals.has(index)) return;
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
    monkey = search.path[1];
    if (!reduceMotion) hop = { from, to: monkey, started: performance.now(), duration: 280 };
    if (portals.has(monkey)) {
      gameOver = true;
      outcome = "escaped";
      showResult(outcome);
      liveStatus.textContent = `The monkey escaped after ${turns} turns.`;
    } else {
      search = currentSearch();
      liveStatus.textContent = `Face closed. The monkey moved. ${search.reachablePortals} portal${search.reachablePortals === 1 ? "" : "s"} remain reachable.`;
    }
    updateUI();
    scheduleDraw();
  }

  function updateUI() {
    const search = currentSearch();
    turnCount.textContent = String(turns);
    portalCount.textContent = String(search.reachablePortals);
    undoButton.disabled = turnHistory.length === 0;
    document.body.dataset.gameState = outcome || "playing";
    document.body.dataset.turns = String(turns);
    document.body.dataset.monkey = String(monkey);
    canvas.setAttribute("aria-label", gameOver
      ? outcome === "caught" ? `Monkey caught in ${turns} turns.` : `Monkey escaped after ${turns} turns.`
      : `Catch the Monkey spherical board. ${search.reachablePortals} portal${search.reachablePortals === 1 ? "" : "s"} reachable. Drag to rotate; select an empty face to close it.`);
  }

  function rotatePoint(point) {
    const cy = Math.cos(rotation.y);
    const sy = Math.sin(rotation.y);
    const x1 = point.x * cy + point.z * sy;
    const z1 = -point.x * sy + point.z * cy;
    const cx = Math.cos(rotation.x);
    const sx = Math.sin(rotation.x);
    return { x: x1, y: point.y * cx - z1 * sx, z: point.y * sx + z1 * cx };
  }

  function dimensions() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height, cx: width / 2, cy: height / 2, radius: Math.min(width, height) * 0.405 * zoom };
  }

  function project(point, view) {
    const rotated = rotatePoint(point);
    const depth = 2.8 / (2.8 - rotated.z);
    return { x: view.cx + rotated.x * view.radius * depth, y: view.cy - rotated.y * view.radius * depth, z: rotated.z, depth };
  }

  function projectTiles(view) {
    return tiles.map((tile) => {
      const center = project(tile.centerPoint, view);
      const polygon = tile.boundary.map((point) => project(point, view));
      return { index: tile.index, center, polygon, z: center.z };
    }).filter((face) => face.z > -0.12).sort((a, b) => a.z - b.z);
  }

  function tracePolygon(polygon) {
    ctx.beginPath();
    polygon.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.closePath();
  }

  function pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i];
      const b = polygon[j];
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  function pickFace(x, y) {
    for (let i = projected.length - 1; i >= 0; i -= 1) {
      const face = projected[i];
      if (face.z > 0.02 && pointInPolygon(x, y, face.polygon)) return face.index;
    }
    return -1;
  }

  function drawMonkey(point, scale, alpha) {
    const size = Math.max(8, 12 * scale);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#e4ab36";
    ctx.beginPath(); ctx.arc(-size * .65, -size * .08, size * .42, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(size * .65, -size * .08, size * .42, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, size * .78, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#101311";
    ctx.beginPath(); ctx.arc(0, size * .12, size * .48, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f5f1e6";
    ctx.beginPath(); ctx.arc(-size * .25, -size * .14, size * .10, 0, Math.PI * 2); ctx.arc(size * .25, -size * .14, size * .10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#f5f1e6";
    ctx.lineWidth = Math.max(1.2, size * .1);
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, size * .22, size * .22, .2, Math.PI - .2); ctx.stroke();
    ctx.restore();
  }

  function drawRimCue(view, monkeyPoint) {
    if (monkeyPoint.z > .01) return;
    const length = Math.hypot(monkeyPoint.x - view.cx, monkeyPoint.y - view.cy) || 1;
    const x = view.cx + (monkeyPoint.x - view.cx) / length * view.radius * .94;
    const y = view.cy + (monkeyPoint.y - view.cy) / length * view.radius * .94;
    const angle = Math.atan2(view.cy - y, view.cx - x);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = "#e4ab36";
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-7, -8); ctx.lineTo(-3, 0); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function draw(time) {
    raf = 0;
    drawTime = time || performance.now();
    const view = dimensions();
    ctx.clearRect(0, 0, view.width, view.height);

    const glow = ctx.createRadialGradient(view.cx, view.cy, view.radius * .18, view.cx, view.cy, view.radius * 1.12);
    glow.addColorStop(0, "rgba(245,241,230,.14)");
    glow.addColorStop(.72, "rgba(245,241,230,.03)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(view.cx, view.cy, view.radius * 1.18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#050705";
    ctx.beginPath(); ctx.arc(view.cx, view.cy, view.radius * .93, 0, Math.PI * 2); ctx.fill();

    projected = projectTiles(view);
    if (document.activeElement === canvas) keyboardSelected = pickFace(view.cx, view.cy);
    const search = currentSearch();
    const predicted = search.path && search.path[1];
    projected.forEach((face) => {
      const isWall = walls.has(face.index);
      const isPortal = portals.has(face.index);
      const isHover = face.index === hovered && !isWall && !isPortal && face.index !== monkey && !gameOver;
      const isKeyboard = document.activeElement === canvas && face.index === keyboardSelected;
      const shade = Math.max(0, Math.min(1, (face.z + .1) / 1.1));
      tracePolygon(face.polygon);
      if (isWall) ctx.fillStyle = `rgb(${Math.round(8 + shade * 8)},${Math.round(10 + shade * 9)},${Math.round(8 + shade * 8)})`;
      else if (isPortal) ctx.fillStyle = `rgb(${Math.round(44 + shade * 28)},${Math.round(16 + shade * 8)},${Math.round(13 + shade * 7)})`;
      else if (isHover || isKeyboard) ctx.fillStyle = "#fff8d8";
      else ctx.fillStyle = `rgb(${Math.round(174 + shade * 55)},${Math.round(191 + shade * 48)},${Math.round(171 + shade * 49)})`;
      ctx.fill();
      ctx.strokeStyle = isKeyboard ? "#f4c75d" : isPortal ? "#e45143" : isWall ? "rgba(245,241,230,.24)" : `rgba(9,24,17,${.32 + shade * .5})`;
      ctx.lineWidth = isKeyboard ? Math.max(3, face.center.depth * 4) : isPortal ? Math.max(2.5, face.center.depth * 3.5) : Math.max(.8, face.center.depth * 1.15);
      ctx.stroke();

      if (face.index === predicted && face.index !== monkey && !gameOver) {
        ctx.fillStyle = "#e4ab36";
        ctx.beginPath(); ctx.arc(face.center.x, face.center.y, Math.max(2.2, 3.3 * face.center.depth), 0, Math.PI * 2); ctx.fill();
      }
      if (isPortal) {
        ctx.strokeStyle = "rgba(245,241,230,.88)";
        ctx.lineWidth = Math.max(1.2, 1.6 * face.center.depth);
        ctx.beginPath(); ctx.arc(face.center.x, face.center.y, Math.max(5, 8.5 * face.center.depth), 0, Math.PI * 2); ctx.stroke();
      }
    });

    let monkeyPoint = project(tiles[monkey].centerPoint, view);
    if (hop) {
      const elapsed = drawTime - hop.started;
      let t = Math.min(1, elapsed / hop.duration);
      t = 1 - Math.pow(1 - t, 3);
      const a = tiles[hop.from].centerPoint;
      const b = tiles[hop.to].centerPoint;
      const x = a.x * (1 - t) + b.x * t;
      const y = a.y * (1 - t) + b.y * t;
      const z = a.z * (1 - t) + b.z * t;
      const length = Math.hypot(x, y, z) || 1;
      monkeyPoint = project({ x: x / length * 1.035, y: y / length * 1.035, z: z / length * 1.035 }, view);
      if (elapsed >= hop.duration) hop = null;
      else scheduleDraw();
    }
    if (monkeyPoint.z > -.03) drawMonkey(monkeyPoint, monkeyPoint.depth, Math.max(.2, Math.min(1, monkeyPoint.z + .45)));
    drawRimCue(view, monkeyPoint);

    const vignette = ctx.createRadialGradient(view.cx - view.radius * .24, view.cy - view.radius * .3, view.radius * .35, view.cx, view.cy, view.radius * 1.02);
    vignette.addColorStop(.62, "rgba(255,255,255,0)");
    vignette.addColorStop(1, "rgba(0,0,0,.23)");
    ctx.fillStyle = vignette;
    ctx.beginPath(); ctx.arc(view.cx, view.cy, view.radius * 1.01, 0, Math.PI * 2); ctx.fill();
  }

  function scheduleDraw() {
    if (!raf) raf = requestAnimationFrame(draw);
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  canvas.addEventListener("pointerdown", (event) => {
    const point = canvasPoint(event);
    drag = { id: event.pointerId, x: point.x, y: point.y, lastX: point.x, lastY: point.y, moved: false };
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    const point = canvasPoint(event);
    if (drag && drag.id === event.pointerId) {
      const dx = point.x - drag.lastX;
      const dy = point.y - drag.lastY;
      if (Math.hypot(point.x - drag.x, point.y - drag.y) > 5) drag.moved = true;
      if (drag.moved) {
        rotation.y += dx * .007;
        rotation.x = Math.max(-1.45, Math.min(1.45, rotation.x + dy * .007));
        drag.lastX = point.x;
        drag.lastY = point.y;
        hovered = -1;
        scheduleDraw();
      }
    } else {
      hovered = pickFace(point.x, point.y);
      scheduleDraw();
    }
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const point = canvasPoint(event);
    if (!drag.moved) {
      keyboardSelected = pickFace(point.x, point.y);
      closeFace(keyboardSelected);
    }
    drag = null;
  });
  canvas.addEventListener("pointercancel", () => { drag = null; });
  canvas.addEventListener("pointerleave", () => { if (!drag) { hovered = -1; scheduleDraw(); } });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoom = Math.max(.72, Math.min(1.18, zoom - event.deltaY * .0007));
    scheduleDraw();
  }, { passive: false });
  canvas.addEventListener("focus", scheduleDraw);
  canvas.addEventListener("blur", scheduleDraw);

  undoButton.addEventListener("click", () => {
    if (!turnHistory.length) return;
    restore(turnHistory.pop());
    liveStatus.textContent = "Last turn undone.";
  });
  newButton.addEventListener("click", () => buildOrbit(randomSeed()));

  function showHelp() { helpOverlay.hidden = false; helpDone.focus(); }
  function hideHelp() { helpOverlay.hidden = true; helpButton.focus(); }
  helpButton.addEventListener("click", showHelp);
  helpClose.addEventListener("click", hideHelp);
  helpDone.addEventListener("click", hideHelp);
  helpOverlay.addEventListener("click", (event) => { if (event.target === helpOverlay) hideHelp(); });
  addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !helpOverlay.hidden) {
      hideHelp();
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
    else if (event.key === "?") showHelp();
    else if (document.activeElement === canvas) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        closeFace(keyboardSelected);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        rotation.y -= .13;
        scheduleDraw();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        rotation.y += .13;
        scheduleDraw();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        rotation.x = Math.max(-1.45, rotation.x - .13);
        scheduleDraw();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        rotation.x = Math.min(1.45, rotation.x + .13);
        scheduleDraw();
      }
    }
  });
  addEventListener("resize", scheduleDraw);

  buildOrbit(querySeed());
})();
