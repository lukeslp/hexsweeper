/**
 * File Purpose: Focused canvas renderer and input controller for the
 * dodecahedron panel campaign.
 * Primary Functions/Classes: PolyhedronRenderer.
 * Inputs: DodecaLayout solid + DodecaCampaign state. Outputs: whole-solid
 * overview, face-focus transition, active micro-board picking and orbit.
 * Author: Luke Steuber <luke@lukesteuber.com>
 */
(function (global) {
  "use strict";

  const FRONT = { x: 0, y: 0, z: 1 };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function easeOutCubic(value) {
    return 1 - Math.pow(1 - clamp(value, 0, 1), 3);
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  function cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  function normalize(v) {
    const length = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x / length, y: v.y / length, z: v.z / length };
  }

  function quatNormalize(q) {
    const length = Math.hypot(q.x, q.y, q.z, q.w) || 1;
    return { x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length };
  }

  function quatMultiply(a, b) {
    return quatNormalize({
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    });
  }

  function quatAxis(axis, angle) {
    const half = angle / 2;
    const s = Math.sin(half);
    const unit = normalize(axis);
    return quatNormalize({ x: unit.x * s, y: unit.y * s, z: unit.z * s, w: Math.cos(half) });
  }

  function quatFromVectors(from, to) {
    const a = normalize(from);
    const b = normalize(to);
    const similarity = dot(a, b);
    if (similarity < -0.999999) {
      let axis = cross({ x: 1, y: 0, z: 0 }, a);
      if (Math.hypot(axis.x, axis.y, axis.z) < 1e-6) {
        axis = cross({ x: 0, y: 1, z: 0 }, a);
      }
      return quatAxis(axis, Math.PI);
    }
    const axis = cross(a, b);
    return quatNormalize({ x: axis.x, y: axis.y, z: axis.z, w: 1 + similarity });
  }

  function quatRotate(q, point) {
    const u = { x: q.x, y: q.y, z: q.z };
    const uv = cross(u, point);
    const uuv = cross(u, uv);
    return {
      x: point.x + 2 * (q.w * uv.x + uuv.x),
      y: point.y + 2 * (q.w * uv.y + uuv.y),
      z: point.z + 2 * (q.w * uv.z + uuv.z),
    };
  }

  function quatSlerp(a, b, t) {
    let target = b;
    let cosine = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
    if (cosine < 0) {
      cosine = -cosine;
      target = { x: -b.x, y: -b.y, z: -b.z, w: -b.w };
    }
    if (cosine > 0.9995) {
      return quatNormalize({
        x: a.x + (target.x - a.x) * t,
        y: a.y + (target.y - a.y) * t,
        z: a.z + (target.z - a.z) * t,
        w: a.w + (target.w - a.w) * t,
      });
    }
    const theta = Math.acos(clamp(cosine, -1, 1));
    const sine = Math.sin(theta);
    const aWeight = Math.sin((1 - t) * theta) / sine;
    const bWeight = Math.sin(t * theta) / sine;
    return quatNormalize({
      x: a.x * aWeight + target.x * bWeight,
      y: a.y * aWeight + target.y * bWeight,
      z: a.z * aWeight + target.z * bWeight,
      w: a.w * aWeight + target.w * bWeight,
    });
  }

  function pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i];
      const b = polygon[j];
      if (
        (a.y > y) !== (b.y > y) &&
        x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
      ) {
        inside = !inside;
      }
    }
    return inside;
  }

  function polygonCenter(polygon) {
    const sum = polygon.reduce(
      (out, point) => ({ x: out.x + point.x, y: out.y + point.y }),
      { x: 0, y: 0 }
    );
    return { x: sum.x / polygon.length, y: sum.y / polygon.length };
  }

  function colorMix(a, b, amount) {
    const parse = (hex) => {
      const value = hex.replace("#", "");
      const full = value.length === 3 ? value.replace(/(.)/g, "$1$1") : value;
      return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16));
    };
    const left = parse(a);
    const right = parse(b);
    const out = left.map((value, index) => Math.round(value + (right[index] - value) * amount));
    return `rgb(${out[0]},${out[1]},${out[2]})`;
  }

  class PolyhedronRenderer {
    constructor(canvas, layout, campaign, options) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.layout = layout;
      this.campaign = campaign;
      this.options = options || {};
      this.mode = "overview";
      this.focusPanel = campaign.startPanel;
      this.hoverPanel = -1;
      this.hoverCell = -1;
      this.keyboardPanel = campaign.startPanel;
      this.keyboardCell = 0;
      this.pointer = null;
      this.longPressTimer = null;
      this.dragging = false;
      this.reducedMotion =
        !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
      this.width = 1;
      this.height = 1;
      this.dpr = 1;
      this.overviewScale = 1;
      this.activeScale = 1;
      this.scale = 1;
      this.targetScale = 1;
      this.orientation = this.faceOrientation(campaign.startPanel);
      this.targetOrientation = this.orientation;
      this.transitionStarted = 0;
      this.transitionDuration = 480;
      this.screenPanels = [];
      this.screenCells = [];
      this.palette = null;
      this.canvas.tabIndex = 0;
      this.canvas.setAttribute("role", "application");
      this.bind();
      this.resize();
      this.frame = this.frame.bind(this);
      this.raf = requestAnimationFrame(this.frame);
    }

    destroy() {
      cancelAnimationFrame(this.raf);
      global.removeEventListener("resize", this.onResize);
    }

    setLayout(layout, campaign) {
      this.layout = layout;
      this.campaign = campaign;
      this.focusPanel = campaign.startPanel;
      this.keyboardPanel = campaign.startPanel;
      this.keyboardCell = 0;
      this.orientation = this.faceOrientation(campaign.startPanel);
      this.targetOrientation = this.orientation;
      this.mode = "overview";
      this.resize();
    }

    faceOrientation(panelIndex) {
      const panel = this.layout.panels[panelIndex];
      let orientation = quatFromVectors(panel.normal, FRONT);
      const center = quatRotate(orientation, panel.centerPoint);
      const vertex = quatRotate(orientation, panel.boundary[0]);
      const tangent = { x: vertex.x - center.x, y: vertex.y - center.y };
      const currentAngle = Math.atan2(tangent.y, tangent.x);
      const roll = quatAxis(FRONT, Math.PI / 2 - currentAngle);
      orientation = quatMultiply(roll, orientation);
      return orientation;
    }

    focus(panelIndex) {
      this.focusPanel = panelIndex;
      this.keyboardCell = Math.floor(this.layout.panels[panelIndex].cells.length / 2);
      const centerCell = this.layout.panels[panelIndex].cells.findIndex(
        (cell) => cell.q === 0 && cell.r === 0
      );
      if (centerCell >= 0) this.keyboardCell = centerCell;
      this.mode = "active";
      this.targetOrientation = this.faceOrientation(panelIndex);
      this.targetScale = this.activeScale;
      this.transitionStarted = performance.now();
    }

    overview() {
      this.mode = "overview";
      this.targetScale = this.overviewScale;
      this.transitionStarted = performance.now();
      this.hoverCell = -1;
    }

    setCampaign(campaign) {
      this.campaign = campaign;
    }

    bind() {
      this.onResize = () => this.resize();
      global.addEventListener("resize", this.onResize);
      this.canvas.addEventListener("pointerdown", (event) => this.pointerDown(event));
      this.canvas.addEventListener("pointermove", (event) => this.pointerMove(event));
      this.canvas.addEventListener("pointerup", (event) => this.pointerUp(event));
      this.canvas.addEventListener("pointercancel", (event) => this.pointerUp(event));
      this.canvas.addEventListener("pointerleave", () => {
        if (!this.pointer) {
          this.hoverPanel = -1;
          this.hoverCell = -1;
        }
      });
      this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
      this.canvas.addEventListener("keydown", (event) => this.keyDown(event));
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.width = Math.max(1, rect.width || global.innerWidth);
      this.height = Math.max(1, rect.height || global.innerHeight);
      this.dpr = Math.min(2, global.devicePixelRatio || 1);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      const short = Math.min(this.width, this.height);
      this.overviewScale = short * 0.38;
      const face = this.layout.panels[this.focusPanel] || this.layout.panels[0];
      const radius = Math.max(
        ...face.boundary.map((point) =>
          Math.hypot(
            point.x - face.centerPoint.x,
            point.y - face.centerPoint.y,
            point.z - face.centerPoint.z
          )
        )
      );
      // Perspective enlarges the front panel by roughly 1.25×. Budget for it
      // here so all five corners stay visible with a quiet status gutter.
      this.activeScale = (short * (this.width < 600 ? 0.39 : 0.34)) / radius;
      if (!this.scale || this.scale === 1) this.scale = this.overviewScale;
      this.targetScale = this.mode === "active" ? this.activeScale : this.overviewScale;
    }

    pointerDown(event) {
      if (event.button != null && event.button !== 0) return;
      this.canvas.setPointerCapture && this.canvas.setPointerCapture(event.pointerId);
      this.pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: 0,
        at: performance.now(),
      };
      this.dragging = false;
      if (this.mode === "active" && event.pointerType === "touch") {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = setTimeout(() => {
          if (!this.pointer || this.pointer.moved > 8) return;
          const cell = this.pickCell(this.pointer.x, this.pointer.y);
          if (cell >= 0 && this.options.onCellAction) {
            this.options.onCellAction(cell, true);
            this.pointer.longPressed = true;
          }
        }, 480);
      }
    }

    pointerMove(event) {
      if (this.pointer && this.pointer.id === event.pointerId) {
        const dx = event.clientX - this.pointer.lastX;
        const dy = event.clientY - this.pointer.lastY;
        this.pointer.moved += Math.hypot(dx, dy);
        this.pointer.lastX = event.clientX;
        this.pointer.lastY = event.clientY;
        if (this.mode === "overview" && this.pointer.moved > 7) {
          this.dragging = true;
          clearTimeout(this.longPressTimer);
          const invert = this.options.getInvert ? this.options.getInvert() : { x: false, y: false };
          const yaw = quatAxis({ x: 0, y: 1, z: 0 }, dx * 0.008 * (invert.x ? -1 : 1));
          const pitch = quatAxis({ x: 1, y: 0, z: 0 }, -dy * 0.008 * (invert.y ? -1 : 1));
          this.orientation = quatMultiply(pitch, quatMultiply(yaw, this.orientation));
          this.targetOrientation = this.orientation;
        }
      }
      if (this.mode === "overview") {
        this.hoverPanel = this.pickPanel(event.clientX, event.clientY);
      } else {
        this.hoverCell = this.pickCell(event.clientX, event.clientY);
      }
    }

    pointerUp(event) {
      if (!this.pointer || this.pointer.id !== event.pointerId) return;
      clearTimeout(this.longPressTimer);
      const pointer = this.pointer;
      this.pointer = null;
      try {
        this.canvas.releasePointerCapture && this.canvas.releasePointerCapture(event.pointerId);
      } catch (_) {}
      if (pointer.longPressed || pointer.moved > 8 || this.inTransition()) {
        this.dragging = false;
        return;
      }
      if (this.mode === "overview") {
        const panel = this.pickPanel(event.clientX, event.clientY);
        if (panel >= 0 && this.options.onPanelSelect) this.options.onPanelSelect(panel);
      } else {
        const cell = this.pickCell(event.clientX, event.clientY);
        if (cell >= 0 && this.options.onCellAction) this.options.onCellAction(cell, false);
      }
      this.dragging = false;
    }

    keyDown(event) {
      if (event.key === "Escape" && this.mode === "active") {
        event.preventDefault();
        if (this.options.onBack) this.options.onBack();
        return;
      }
      if (this.mode === "overview") {
        const available = this.campaign.panels
          .filter((panel) => panel.status === "unlocked" || panel.status === "failed")
          .map((panel) => panel.index);
        if (["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(event.key)) {
          event.preventDefault();
          const current = Math.max(0, available.indexOf(this.keyboardPanel));
          const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
          this.keyboardPanel = available[(current + step + available.length) % available.length];
          this.targetOrientation = this.faceOrientation(this.keyboardPanel);
          this.hoverPanel = this.keyboardPanel;
        }
        if ((event.key === "Enter" || event.key === " ") && this.keyboardPanel >= 0) {
          event.preventDefault();
          if (this.options.onPanelSelect) this.options.onPanelSelect(this.keyboardPanel);
        }
        return;
      }

      if (["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        const current = this.screenCells.find((cell) => cell.localIndex === this.keyboardCell);
        if (!current) return;
        const direction = {
          ArrowLeft: { x: -1, y: 0 },
          ArrowRight: { x: 1, y: 0 },
          ArrowUp: { x: 0, y: -1 },
          ArrowDown: { x: 0, y: 1 },
        }[event.key];
        let best = null;
        for (const candidate of this.screenCells) {
          if (candidate.localIndex === current.localIndex) continue;
          const dx = candidate.center.x - current.center.x;
          const dy = candidate.center.y - current.center.y;
          const forward = dx * direction.x + dy * direction.y;
          if (forward <= 1) continue;
          const lateral = Math.abs(dx * direction.y - dy * direction.x);
          const score = lateral * 4 + Math.hypot(dx, dy);
          if (!best || score < best.score) best = { index: candidate.localIndex, score };
        }
        if (best) {
          this.keyboardCell = best.index;
          this.hoverCell = best.index;
        }
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (this.options.onCellAction) this.options.onCellAction(this.keyboardCell, false);
      }
    }

    inTransition() {
      return performance.now() - this.transitionStarted < this.transitionDuration;
    }

    project(point, lift) {
      let world = point;
      if (lift && lift.normal) {
        world = {
          x: point.x + lift.normal.x * lift.amount,
          y: point.y + lift.normal.y * lift.amount,
          z: point.z + lift.normal.z * lift.amount,
        };
      }
      const rotated = quatRotate(this.orientation, world);
      const perspective = 4 / (4 - rotated.z);
      return {
        x: this.width / 2 + rotated.x * this.scale * perspective,
        y: this.height / 2 - rotated.y * this.scale * perspective,
        z: rotated.z,
        perspective,
      };
    }

    projectPolygon(points, lift) {
      return points.map((point) => this.project(point, lift));
    }

    pickPanel(x, y) {
      const candidates = this.screenPanels.slice().sort((a, b) => b.depth - a.depth);
      for (const panel of candidates) {
        const status = this.campaign.panels[panel.index].status;
        if (status !== "unlocked" && status !== "failed") continue;
        if (pointInPolygon(x, y, panel.polygon)) return panel.index;
      }
      return -1;
    }

    pickCell(x, y) {
      for (let i = this.screenCells.length - 1; i >= 0; i--) {
        const cell = this.screenCells[i];
        if (pointInPolygon(x, y, cell.polygon)) return cell.localIndex;
      }
      return -1;
    }

    path(polygon) {
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.moveTo(polygon[0].x, polygon[0].y);
      for (let i = 1; i < polygon.length; i++) ctx.lineTo(polygon[i].x, polygon[i].y);
      ctx.closePath();
    }

    paletteFor(state) {
      const axes = state.appearanceAxes || { field: "light", shell: "light", well: "dark" };
      const fieldDark = axes.field === "dark";
      const shellDark = axes.shell === "dark";
      const wellDark = axes.well === "dark";
      return {
        field: fieldDark ? "#050505" : "#ffffff",
        ink: fieldDark ? "#ffffff" : "#000000",
        shell: shellDark ? "#111111" : "#fbfbfa",
        shellInk: shellDark ? "#ffffff" : "#000000",
        well: wellDark ? "#111111" : "#ffffff",
        wellInk: wellDark ? "#ffffff" : "#000000",
        locked: shellDark ? "#090909" : "#ececea",
        completed: shellDark ? "#252525" : "#d9d9d5",
        green: "#0aa84f",
        yellow: "#ffd000",
        red: "#f12626",
      };
    }

    drawPanel(panel, projected, depth, normalZ, state) {
      const ctx = this.ctx;
      const panelState = this.campaign.panels[panel.index];
      const palette = this.palette;
      const hovered = this.mode === "overview" && panel.index === this.hoverPanel;
      const keyboard = this.mode === "overview" && panel.index === this.keyboardPanel;
      let fill = palette.shell;
      if (panelState.status === "locked") fill = palette.locked;
      if (panelState.status === "completed") fill = palette.completed;
      if (panelState.status === "failed") fill = colorMix(palette.shell, palette.red, 0.12);
      const light = clamp(0.68 + normalZ * 0.32, 0.5, 1);
      fill = colorMix(fill, palette.field === "#ffffff" ? "#ffffff" : "#000000", 1 - light);

      this.path(projected);
      ctx.fillStyle = fill;
      ctx.fill();

      // All panels are genuinely tiled. State controls contrast rather than
      // substituting an untiled plate, so the dodecahedral premise is visible
      // before the first selection without making locked faces look active.
      const seamAlpha =
        panelState.status === "unlocked" || panelState.status === "failed"
          ? 0.24
          : panelState.status === "completed"
            ? 0.16
            : 0.07;
      ctx.save();
      ctx.globalAlpha = seamAlpha;
      ctx.strokeStyle = palette.shellInk;
      ctx.lineWidth = 0.75;
      for (const cell of panel.cells) {
        const polygon = this.projectPolygon(cell.boundary);
        this.path(polygon);
        ctx.stroke();
      }
      ctx.restore();

      this.path(projected);
      ctx.strokeStyle = palette.shellInk;
      ctx.globalAlpha = normalZ > 0.05 ? 0.85 : 0.45;
      ctx.lineWidth = hovered || keyboard ? 3.2 : panelState.status === "unlocked" ? 2.15 : 1.55;
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (panelState.status === "unlocked" && (hovered || keyboard)) {
        const center = polygonCenter(projected);
        ctx.beginPath();
        ctx.arc(center.x, center.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = palette.yellow;
        ctx.fill();
      }
    }

    drawActivePanel(panel, state) {
      const ctx = this.ctx;
      const palette = this.palette;
      const panelState = this.campaign.panels[panel.index];
      const board = panelState.board;
      this.screenCells = [];

      for (const tile of panel.cells) {
        const cell = board.cells[tile.panelCellIndex];
        const amount =
          state.relief === "flush"
            ? 0
            : cell.flagged && !cell.revealed
              ? 0.018
              : cell.revealed
                ? -0.014
                : 0;
        const polygon = this.projectPolygon(tile.boundary, {
          normal: panel.normal,
          amount,
        });
        const center = polygonCenter(polygon);
        this.screenCells.push({
          localIndex: tile.panelCellIndex,
          polygon,
          center,
        });

        let fill = palette.shell;
        let ink = palette.shellInk;
        if (cell.revealed) {
          fill = palette.well;
          ink = palette.wellInk;
        }
        if (cell.flagged && !cell.revealed) {
          fill = palette.red;
          ink = "#ffffff";
        }
        if (cell.detonated) {
          fill = palette.red;
          ink = "#000000";
        }
        this.path(polygon);
        ctx.save();
        if (amount > 0) {
          ctx.shadowColor = "rgba(0,0,0,.24)";
          ctx.shadowBlur = 9;
          ctx.shadowOffsetY = 4;
        }
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.restore();
        if (state.seams !== false || !cell.revealed) {
          this.path(polygon);
          ctx.strokeStyle = palette.shellInk;
          ctx.globalAlpha = cell.revealed ? 0.48 : 0.9;
          ctx.lineWidth = cell.revealed ? 1.15 : 1.6;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        const highlighted =
          tile.panelCellIndex === this.hoverCell ||
          (this.canvas.matches(":focus-visible") && tile.panelCellIndex === this.keyboardCell);
        if (highlighted && !cell.revealed) {
          this.path(polygon);
          ctx.strokeStyle = palette.yellow;
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        if (cell.revealed && cell.isMine) {
          const radius = Math.max(5, Math.min(15, Math.sqrt(Math.abs(this.polygonArea(polygon))) * 0.18));
          ctx.beginPath();
          ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = ink;
          ctx.fill();
        } else if (cell.revealed && cell.neighborMines > 0) {
          this.drawCount(center, polygon, cell.neighborMines, ink, state.countStyle, palette);
        }
      }

      const outline = this.projectPolygon(panel.boundary);
      this.path(outline);
      ctx.strokeStyle = palette.shellInk;
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 3.2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    polygonArea(poly) {
      let area = 0;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        area += a.x * b.y - b.x * a.y;
      }
      return area / 2;
    }

    drawCount(center, polygon, count, ink, style, palette) {
      const ctx = this.ctx;
      const radius = clamp(Math.sqrt(Math.abs(this.polygonArea(polygon))) * 0.18, 6, 22);
      if (style === "rings") {
        ctx.strokeStyle = ink;
        ctx.lineWidth = Math.max(2, radius * 0.22);
        ctx.beginPath();
        for (let ring = 1; ring <= Math.min(3, count); ring++) {
          ctx.moveTo(center.x + (radius * ring) / 3, center.y);
          ctx.arc(center.x, center.y, (radius * ring) / 3, 0, Math.PI * 2);
        }
        ctx.stroke();
        return;
      }
      if (style === "yellow") {
        ctx.fillStyle = palette.yellow;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius * (0.45 + count * 0.06), 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.fillStyle = ink;
      ctx.font = `700 ${Math.round(radius * 1.65)}px "IBM Plex Sans", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(count), center.x, center.y + 0.5);
    }

    drawStatus(text) {
      const ctx = this.ctx;
      ctx.font = '600 12px "IBM Plex Sans", system-ui, sans-serif';
      const width = Math.ceil(ctx.measureText(text).width) + 20;
      const height = 25;
      const x = this.width / 2 - width / 2;
      const y = Math.max(12, this.height * 0.028);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = this.palette.field;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, width, height, 12);
      else ctx.rect(x, y, width, height);
      ctx.fill();
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = this.palette.ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, this.width / 2, y + height / 2 + 0.5);
      ctx.restore();
    }

    draw(now) {
      const ctx = this.ctx;
      const state = this.options.getState ? this.options.getState() : {};
      this.palette = this.paletteFor(state);
      document.body.style.background = this.palette.field;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.fillStyle = this.palette.field;
      ctx.fillRect(0, 0, this.width, this.height);

      this.screenPanels = [];
      const visible = [];
      for (const panel of this.layout.panels) {
        const rotatedNormal = quatRotate(this.orientation, panel.normal);
        if (rotatedNormal.z < -0.12) continue;
        const rotatedCenter = quatRotate(this.orientation, panel.centerPoint);
        const projected = this.projectPolygon(panel.boundary);
        visible.push({ panel, projected, depth: rotatedCenter.z, normalZ: rotatedNormal.z });
      }
      visible.sort((a, b) => a.depth - b.depth);
      for (const entry of visible) {
        this.screenPanels.push({
          index: entry.panel.index,
          polygon: entry.projected,
          depth: entry.depth,
        });
        const isActive =
          this.mode === "active" &&
          entry.panel.index === this.focusPanel &&
          entry.normalZ > 0.6;
        if (isActive) this.drawActivePanel(entry.panel, state);
        else this.drawPanel(entry.panel, entry.projected, entry.depth, entry.normalZ, state);
      }

      if (this.mode === "active") {
        const progress = global.PanelBoard.safeProgress(
          this.campaign.panels[this.focusPanel].board
        );
        this.drawStatus(
          `PANEL ${this.focusPanel + 1} / 12  ·  ${progress.safeRevealed} / ${progress.safeTotal}`
        );
      } else {
        const completed = this.campaign.panels.filter((panel) => panel.status === "completed").length;
        this.drawStatus(`${completed} / 12 PANELS`);
      }
    }

    frame(now) {
      const duration = this.reducedMotion ? 1 : this.transitionDuration;
      const progress = easeOutCubic((now - this.transitionStarted) / duration);
      if (progress < 1) {
        this.orientation = quatSlerp(this.orientation, this.targetOrientation, 0.14 + progress * 0.16);
        this.scale += (this.targetScale - this.scale) * (0.15 + progress * 0.2);
      } else {
        this.orientation = quatSlerp(this.orientation, this.targetOrientation, 0.22);
        this.scale += (this.targetScale - this.scale) * 0.22;
      }
      this.draw(now);
      this.raf = requestAnimationFrame(this.frame);
    }

    getScreen() {
      return {
        cx: this.width / 2,
        cy: this.height / 2,
        r: this.mode === "active" ? Math.min(this.width, this.height) * 0.45 : this.scale * 1.08,
      };
    }
  }

  global.PolyhedronRenderer = PolyhedronRenderer;
})(window);
