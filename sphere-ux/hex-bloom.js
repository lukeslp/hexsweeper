/*
 * Hex bloom menu for sphere-ux.
 *
 * Closed: compact dock hex at bottom-center.
 * Open: seed rises to viewport center, honeycomb blooms, board blurs;
 *        dock seat becomes Close and folds the menu home.
 *
 * Axial geometry + origami fold from /uxperiments/clex.
 * Author: Luke Steuber <luke@lukesteuber.com>
 */
(function (global) {
  "use strict";

  const SIZES = [
    ["xsmall", "XS"],
    ["easy", "S"],
    ["medium", "M"],
    ["hard", "L"],
    ["xlarge", "XL"],
  ];

  // Count *paint* only — flush/seams are independent surface axes now.
  const COUNTS = [
    ["numerals", "123"],
    ["rings", "Rings"],
    ["yellow", "Mark"],
  ];

  const CLASSIC_PACKS = [
    { id: "earth", name: "Earth" },
    { id: "moon", name: "Moon" },
    { id: "glow", name: "Glow" },
  ];

  // Full 6-neighbour ring (pointy-top axial) — used for leaf fans around a parent.
  const DIRECTIONS = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];
  // Primary bloom from the dock Menu tile: only cells with r < 0 (screen-up).
  // E/W would sit under Restart/Help; SE/SW would clip off the bottom.
  // Ring-1 NE/NW + ring-2 above → a clean fan that opens upward from the seed.
  const BLOOM_DIRS = [
    { q: 1, r: -1 }, // NE
    { q: 0, r: -1 }, // NW
    { q: 2, r: -2 }, // ring-2 up-right
    { q: 1, r: -2 }, // ring-2 NNE
    { q: 0, r: -2 }, // ring-2 N
    { q: -1, r: -1 }, // ring-2 up-left
  ];

  // Stroke icons (24×24) — board language, not tool metaphors
  const ICONS = {
    // Dig = open / cleared hex face (hollow honeycomb cell)
    dig:
      '<path d="M12 2.8 20.2 7.6v8.8L12 21.2 3.8 16.4V7.6L12 2.8Z"/>',
    // Flag = solid red hex face (matches in-game flag fill)
    flag:
      '<path d="M12 2.8 20.2 7.6v8.8L12 21.2 3.8 16.4V7.6L12 2.8Z" fill="currentColor" stroke="none"/>',
    size:
      '<path d="M12 3 4.5 7.5v9L12 21l7.5-4.5v-9L12 3Z"/>' +
      '<path d="M12 8 8.5 10v4L12 16l3.5-2v-4L12 8Z"/>',
    // Theme control = literally a circle (swatches carry the theme paint)
    theme: '<circle cx="12" cy="12" r="8"/>',
    style:
      '<path d="M7 7h.01M12 7h.01M17 7h.01"/><path d="M7 12h.01M12 12h.01M17 12h.01"/>' +
      '<path d="M7 17h.01M12 17h.01M17 17h.01"/>',
    numerals:
      '<path d="M8 17V7l-2 2"/><path d="M11.5 17h4.2c1.2 0 2-.8 2-2s-.8-2-2-2h-2.2c-1.2 0-2-.8-2-2s.8-2 2-2H18"/>',
    rings:
      '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="10"/>',
    drag:
      '<path d="M12 4v16"/><path d="m8 8 4-4 4 4"/><path d="m8 16 4 4 4-4"/>' +
      '<path d="M4 12h16"/><path d="m8 8-4 4 4 4"/><path d="m16 8 4 4-4 4"/>',
    more: '<circle cx="6.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="17.5" cy="12" r="1.6"/>',
    reset:
      '<path d="M3.5 12a8.5 8.5 0 0 1 14.3-6.2L20 8"/><path d="M20 3.5V8h-4.5"/>' +
      '<path d="M20.5 12a8.5 8.5 0 0 1-14.3 6.2L4 16"/><path d="M4 20.5V16h4.5"/>',
    help:
      '<circle cx="12" cy="12" r="9"/><path d="M9.2 9.2a2.8 2.8 0 1 1 3.9 2.6c-.9.5-1.6 1.1-1.6 2.2"/>' +
      '<path d="M12 17.2h.01"/>',
    flipX:
      '<path d="M12 4v16"/><path d="M4 12h6"/><path d="M14 12h6"/><path d="m8 9-3 3 3 3"/><path d="m16 9 3 3-3 3"/>',
    flipY:
      '<path d="M4 12h16"/><path d="M12 4v6"/><path d="M12 14v6"/><path d="m9 8 3-3 3 3"/><path d="m9 16 3 3 3-3"/>',
  };

  function iconMarkup(name) {
    const paths = ICONS[name] || ICONS.more;
    return (
      '<svg class="hb-icon hb-icon-' +
      name +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      paths +
      "</svg>"
    );
  }

  /** Pull a compact preview palette from a SphereSweeper theme def. */
  function themeSwatchVars(t) {
    if (!t) {
      return {
        fill: "#ffffff",
        edge: "#000000",
        field: "#ffffff",
        ink: "#000000",
        accent: "#ff0000",
      };
    }
    // covered ≈ shell tiles; bg ≈ page/field; flagFill for accent tick
    let fill = t.covered || t.tierCovered || "#888888";
    let field = t.bg || "#000000";
    let edge = t.coveredEdge || t.accent || "#888888";
    // coveredEdge can be rgba — fine for border color
    if (typeof edge === "string" && edge.indexOf("rgba") === 0) {
      edge = t.accent || (t.chrome === "dark" ? "#ffffff" : "#000000");
    }
    const ink =
      t.label ||
      t.accent ||
      (t.chrome === "dark" ? "#ffffff" : "#000000");
    const accent = t.flagFill || t.tierFlagged || "#ff0000";
    // Globe themes: covered is a muted map fallback — keep it
    return { fill, edge, field, ink, accent };
  }

  function prefersReducedMotion() {
    return (
      global.matchMedia &&
      global.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function riseMs() {
    if (prefersReducedMotion()) return 0;
    return 220; // keep in sync with --rise-ms in hex-bloom.css
  }

  function foldMs() {
    if (prefersReducedMotion()) return 0;
    return 180; // petal fold / close settle — snappier than the rise
  }

  function initHexBloom(game) {
    if (!game) return null;
    document.body.classList.add("hex-bloom-ui");

    const THEMES = (global.SphereSweeper && global.SphereSweeper.THEMES) || [];

    let root = document.getElementById("hex-bloom");
    if (!root) {
      root = document.createElement("nav");
      root.id = "hex-bloom";
      root.className = "hex-bloom";
      root.setAttribute("aria-label", "Game menu");
      document.body.appendChild(root);
    } else {
      root.textContent = "";
    }

    const scrim = document.createElement("div");
    scrim.className = "hex-bloom-scrim";
    scrim.setAttribute("aria-hidden", "true");
    root.appendChild(scrim);

    const stage = document.createElement("div");
    stage.className = "hex-bloom-stage";
    stage.id = "hex-bloom-stage";
    stage.setAttribute("role", "dialog");
    stage.setAttribute("aria-modal", "true");
    stage.setAttribute("aria-label", "Game menu");
    root.appendChild(stage);

    const dock = document.createElement("div");
    dock.className = "hex-bloom-dock";
    root.appendChild(dock);

    const live = document.createElement("p");
    live.className = "hex-bloom-live";
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    root.appendChild(live);

    let hub = document.getElementById("hex-bloom-hub");
    if (!hub) {
      hub = document.createElement("div");
      hub.id = "hex-bloom-hub";
      hub.className = "hex-bloom-hub";
      hub.hidden = true;
      hub.setAttribute("aria-live", "polite");
      hub.innerHTML =
        '<span id="hex-bloom-hub-mines">00</span>' +
        '<span id="hex-bloom-hub-time">0</span>';
      document.body.appendChild(hub);
    }
    const hubMines = document.getElementById("hex-bloom-hub-mines");
    const hubTime = document.getElementById("hex-bloom-hub-time");

    // ---- Hex math (clex) ----
    function tileMetrics() {
      const cs = getComputedStyle(root);
      const th = parseFloat(cs.getPropertyValue("--tile-h")) || 88;
      return { HEX: th / 2, tileH: th };
    }

    function hexToPixel(q, r, HEX) {
      return {
        x: HEX * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r),
        y: HEX * ((3 / 2) * r),
      };
    }

    function centerXY() {
      // Bloom origin = menu dock tile (activation node). Petals open upward.
      const stageRect = stage.getBoundingClientRect();
      const menu = dockBtn || document.getElementById("hex-bloom-seed");
      if (menu) {
        const r = menu.getBoundingClientRect();
        return {
          cx: r.left + r.width / 2 - stageRect.left,
          cy: r.top + r.height / 2 - stageRect.top,
        };
      }
      const h = stage.clientHeight || global.innerHeight;
      const w = stage.clientWidth || global.innerWidth;
      const th = tileMetrics().tileH;
      return {
        cx: w / 2,
        cy: h - th / 2 - 6,
      };
    }

    function setRiseVar() {
      // No vertical travel — bloom is rooted at the dock menu.
      root.style.setProperty("--rise-y", "0px");
    }

    function leafOffsets(dirIndex, count) {
      if (count <= 0) return [];
      // Prefer bloom-up directions so nested fans also stay on-screen.
      const ring = BLOOM_DIRS;
      if (count <= 3) {
        const trio = [
          ring[(dirIndex + ring.length - 1) % ring.length],
          ring[dirIndex % ring.length],
          ring[(dirIndex + 1) % ring.length],
        ];
        if (count === 1) return [trio[1]];
        if (count === 2) return [trio[0], trio[2]];
        return trio;
      }
      const out = ring[dirIndex % ring.length];
      const left = ring[(dirIndex + ring.length - 1) % ring.length];
      const right = ring[(dirIndex + 1) % ring.length];
      const farLeft = ring[(dirIndex + ring.length - 2) % ring.length];
      const farRight = ring[(dirIndex + 2) % ring.length];
      const candidates = [
        left,
        out,
        right,
        { q: out.q + left.q, r: out.r + left.r },
        { q: out.q * 2, r: out.r * 2 },
        { q: out.q + right.q, r: out.r + right.r },
        { q: left.q + farLeft.q, r: left.r + farLeft.r },
        { q: right.q + farRight.q, r: right.r + farRight.r },
        { q: out.q + farLeft.q, r: out.r + farLeft.r },
        { q: out.q + farRight.q, r: out.r + farRight.r },
      ];
      const ox = out.q * 2 + out.r;
      const oy = out.r * Math.sqrt(3);
      const scored = candidates.map((c, i) => {
        const px = c.q * 2 + c.r;
        const py = c.r * Math.sqrt(3);
        return { c, i, proj: px * ox + py * oy };
      });
      scored.sort((a, b) => b.proj - a.proj || a.i - b.i);
      const seen = new Set();
      const outList = [];
      for (const s of scored) {
        const key = s.c.q + "," + s.c.r;
        if (seen.has(key)) continue;
        if (s.c.q === 0 && s.c.r === 0) continue;
        seen.add(key);
        outList.push(s.c);
        if (outList.length >= count) break;
      }
      outList.sort((a, b) => {
        const pa = hexToPixel(a.q, a.r, 1);
        const pb = hexToPixel(b.q, b.r, 1);
        return Math.atan2(pa.y, pa.x) - Math.atan2(pb.y, pb.x);
      });
      return outList;
    }

    function place(el, x, y, originX, originY) {
      el.style.left = x + "px";
      el.style.top = y + "px";
      el.style.setProperty("--tx", "0px");
      el.style.setProperty("--ty", "0px");
      const dx = x - originX;
      const dy = y - originY;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      el.style.setProperty("--ax", (-uy).toFixed(3));
      el.style.setProperty("--ay", ux.toFixed(3));
      el.style.transformOrigin =
        (50 - ux * 50).toFixed(1) + "% " + (50 - uy * 50).toFixed(1) + "%";
    }

    function makeHex({ cls, label, ariaLabel, labelSize, icon, iconOnly }) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "hb-hex " + (cls || "");
      el.setAttribute("aria-label", ariaLabel || label || "Option");

      if (icon) {
        const glyph = document.createElement("span");
        glyph.className = "hb-glyph";
        glyph.innerHTML = iconMarkup(
          typeof icon === "function" ? icon() : icon
        );
        el.appendChild(glyph);
        el._glyphEl = glyph;
        el._iconName =
          typeof icon === "function" ? icon() : icon;
      }

      const span = document.createElement("span");
      span.className = "hb-label" + (iconOnly ? " hb-label-sr" : "");
      span.textContent = label || "";
      if (labelSize) span.dataset.size = labelSize;
      if (iconOnly) span.classList.add("sr-visual-hide");
      el.appendChild(span);
      el._labelEl = span;
      el._iconOnly = !!iconOnly;
      return el;
    }

    function setHexIcon(el, name) {
      if (!el) return;
      if (!el._glyphEl) {
        const glyph = document.createElement("span");
        glyph.className = "hb-glyph";
        el.insertBefore(glyph, el.firstChild);
        el._glyphEl = glyph;
      }
      if (el._iconName === name) return;
      el._iconName = name;
      el._glyphEl.innerHTML = iconMarkup(name);
    }

    function unfold(nodes) {
      const list = Array.from(nodes);
      if (!list.length) return;
      if (prefersReducedMotion()) {
        list.forEach((el) => {
          el.classList.remove("folded");
          el.classList.add("shown");
          el.style.transitionDelay = "0ms";
        });
        return;
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          list.forEach((el) => {
            el.style.transitionDelay = (el.dataset.delay || 0) + "ms";
            el.classList.remove("folded");
            el.classList.add("shown");
          });
        });
      });
    }

    // ---- Game helpers ----
    function invertGet(axis) {
      const inv =
        typeof game.getInvertDrag === "function"
          ? game.getInvertDrag()
          : { x: false, y: false };
      return axis === "y" ? !!inv.y : !!inv.x;
    }

    function currentMode() {
      return game.getState().flagMode ? "Flag" : "Dig";
    }
    function currentSize() {
      const d = game.getState().difficulty;
      const hit = SIZES.find((s) => s[0] === d);
      return hit ? hit[1] : "S";
    }
    function currentTheme() {
      const i =
        typeof game.getThemeIndex === "function" ? game.getThemeIndex() : 0;
      const t = THEMES[i];
      return t ? t.name : "Theme";
    }
    function currentStyle() {
      const st = game.getState() || {};
      const c = st.countStyle;
      const hit = COUNTS.find((x) => x[0] === c);
      const paint = hit ? hit[1] : "123";
      const relief = st.relief === "flush" ? "Flat" : "3D";
      return paint;
    }
    function shortLabel(s, n) {
      s = String(s || "");
      return s.length > n ? s.slice(0, n - 1) + "…" : s;
    }

    function getAxes() {
      if (typeof game.getAppearance === "function") {
        const a = game.getAppearance();
        return (a && a.axes) || { field: "light", shell: "light", well: "dark" };
      }
      return { field: "light", shell: "light", well: "dark" };
    }

    function getPack() {
      if (typeof game.getAppearance === "function") {
        const a = game.getAppearance();
        return (a && a.pack) || "classic";
      }
      return "classic";
    }

    function axisSwatch(axis, value) {
      // Mini palette for Bg / Shell / Well flip tiles
      const light = value !== "dark";
      if (axis === "field") {
        return {
          id: "classic-field",
          name: light ? "Bg light" : "Bg dark",
          covered: light ? "#ffffff" : "#000000",
          bg: light ? "#ffffff" : "#000000",
          coveredEdge: light ? "#000000" : "#ffffff",
          chrome: light ? "light" : "dark",
          flagFill: "#ff0000",
          label: light ? "#000000" : "#ffffff",
        };
      }
      if (axis === "shell") {
        return {
          id: "classic-shell",
          name: light ? "Shell light" : "Shell dark",
          covered: light ? "#ffffff" : "#000000",
          bg: "#888888",
          coveredEdge: light ? "#000000" : "#ffffff",
          chrome: "dark",
          flagFill: "#ff0000",
          label: light ? "#000000" : "#ffffff",
        };
      }
      // well
      return {
        id: "classic-well",
        name: light ? "Dug light" : "Dug dark",
        covered: light ? "#ffffff" : "#000000",
        bg: "#666666",
        coveredEdge: light ? "#000000" : "#ffffff",
        chrome: "dark",
        flagFill: "#ff0000",
        label: light ? "#000000" : "#ffffff",
      };
    }

    function flipAxis(axis) {
      const axes = getAxes();
      const next = Object.assign({}, axes);
      next[axis] = axes[axis] === "dark" ? "light" : "dark";
      if (typeof game.setAppearanceAxes === "function") {
        game.setAppearanceAxes(next);
      }
      announce(
        (axis === "field" ? "Background" : axis === "shell" ? "Covered" : "Dug") +
          " · " +
          next[axis]
      );
    }

    function invertModeIndex() {
      const x = invertGet("x");
      const y = invertGet("y");
      if (!x && !y) return 0;
      if (x && !y) return 1;
      if (!x && y) return 2;
      return 3;
    }

    function invertModeLabel() {
      return ["Off", "X", "Y", "X+Y"][invertModeIndex()];
    }

    function cycleInvert() {
      const next = (invertModeIndex() + 1) % 4;
      const map = [
        [false, false],
        [true, false],
        [false, true],
        [true, true],
      ];
      if (typeof game.setInvertDragX === "function")
        game.setInvertDragX(map[next][0]);
      if (typeof game.setInvertDragY === "function")
        game.setInvertDragY(map[next][1]);
      announce("Invert · " + ["Off", "X", "Y", "X+Y"][next]);
    }

    function cycleMode() {
      const on = !!game.getState().flagMode;
      game.setFlagMode(!on);
      announce("Mode · " + (!on ? "Flag" : "Dig"));
    }

    function cycleSize() {
      const d = game.getState().difficulty;
      let i = SIZES.findIndex((s) => s[0] === d);
      if (i < 0) i = 1;
      const next = (i + 1) % SIZES.length;
      game.setSize(SIZES[next][0]);
      announce("Size · " + SIZES[next][1]);
    }

    function cycleFlush() {
      const flush = game.getState().relief === "flush";
      if (typeof game.setRelief === "function") {
        game.setRelief(flush ? "extruded" : "flush");
      }
      announce("Relief · " + (flush ? "3D" : "Flush"));
    }

    function cycleSeams() {
      const on = game.getState().seams !== false;
      if (typeof game.setSeams === "function") game.setSeams(!on);
      announce("Seams · " + (on ? "off" : "on"));
    }

    function cycleCount() {
      const c = game.getState().countStyle;
      let i = COUNTS.findIndex((x) => x[0] === c);
      if (i < 0) i = 0;
      const next = (i + 1) % COUNTS.length;
      game.setCountStyle(COUNTS[next][0], { syncSurface: false });
      announce("Counts · " + COUNTS[next][1]);
    }

    function doReset() {
      if (typeof game.reset === "function") game.reset();
      else {
        const b = document.getElementById("reset-btn");
        if (b) b.click();
      }
      announce("Board reset");
      if (state.phase === "open" || state.phase === "rising") collapse();
    }

    function doHelp() {
      const b = document.getElementById("help-btn");
      if (b) b.click();
      if (state.phase === "open" || state.phase === "rising") collapse();
    }

    function categories() {
      // Six primaries. Cycle items flip state on click (no submenu).
      // Look blooms: Classic axes + World packs + count paint only.
      // Restart / Help live on the always-visible three-tile dock.
      return [
        {
          id: "mode",
          label: () => currentMode(),
          icon: () => (game.getState().flagMode ? "flag" : "dig"),
          iconOnly: false,
          aria: () =>
            "Mode: " + currentMode() + ". Activate to switch Dig or Flag.",
          cycle: cycleMode,
        },
        {
          id: "size",
          label: () => currentSize(),
          icon: "size",
          iconOnly: false,
          badge: true,
          aria: () =>
            "Size: " + currentSize() + ". Activate to cycle board size.",
          cycle: cycleSize,
        },
        {
          id: "theme",
          label: () => {
            const p = getPack();
            if (p === "classic") return "Look";
            const hit = CLASSIC_PACKS.find((x) => x.id === p);
            return hit ? hit.name : "Look";
          },
          icon: "theme",
          iconOnly: false,
          aria: () => "Look and theme packs",
          sub: () => {
            const axes = getAxes();
            const pack = getPack();
            const leaves = [
              {
                id: "ax-field",
                label: "Bg",
                themeSwatch: axisSwatch("field", axes.field),
                iconOnly: true,
                chosen: () => pack === "classic",
                run: () => flipAxis("field"),
              },
              {
                id: "ax-shell",
                label: "Shell",
                themeSwatch: axisSwatch("shell", axes.shell),
                iconOnly: true,
                chosen: () => pack === "classic",
                run: () => flipAxis("shell"),
              },
              {
                id: "ax-well",
                label: "Dug",
                themeSwatch: axisSwatch("well", axes.well),
                iconOnly: true,
                chosen: () => pack === "classic",
                run: () => flipAxis("well"),
              },
            ];
            CLASSIC_PACKS.forEach((pk) => {
              const t = THEMES.find((x) => x.id === pk.id);
              leaves.push({
                id: "pack-" + pk.id,
                label: pk.name,
                themeSwatch:
                  t || {
                    id: pk.id,
                    name: pk.name,
                    covered: "#666",
                    bg: "#000",
                    coveredEdge: "#fff",
                    flagFill: "#ff0000",
                    label: "#fff",
                    chrome: "dark",
                  },
                iconOnly: true,
                chosen: () => pack === pk.id,
                run: () => {
                  if (typeof game.setAppearancePack === "function") {
                    game.setAppearancePack(pk.id);
                  } else {
                    const i = THEMES.findIndex((x) => x.id === pk.id);
                    if (i >= 0) game.setThemeIndex(i);
                  }
                  announce("Pack · " + pk.name);
                },
              });
            });
            // Count paint under Look (not Reset/Help — those are dock tiles)
            COUNTS.forEach(([id, lab]) => {
              leaves.push({
                id: "st-" + id,
                label: lab,
                icon:
                  id === "rings"
                    ? "rings"
                    : id === "numerals"
                      ? "numerals"
                      : "style",
                labelSize: "sm",
                chosen: () => game.getState().countStyle === id,
                run: () => {
                  game.setCountStyle(id, { syncSurface: false });
                  announce("Counts · " + lab);
                },
              });
            });
            return leaves;
          },
        },
        {
          id: "invert",
          label: () => invertModeLabel(),
          icon: "drag",
          iconOnly: false,
          aria: () =>
            "Invert drag: " +
            invertModeLabel() +
            ". Activate to cycle Off, X, Y, X+Y.",
          cycle: cycleInvert,
        },
        {
          id: "flush",
          label: () =>
            game.getState().relief === "flush" ? "Flush" : "3D",
          icon: "size",
          iconOnly: false,
          aria: () => {
            const flush = game.getState().relief === "flush";
            return (
              "Relief: " +
              (flush ? "flush" : "extruded") +
              ". Activate to toggle."
            );
          },
          cycle: cycleFlush,
        },
        {
          id: "seams",
          label: () =>
            game.getState().seams === false ? "Seam" : "Seams",
          icon: "style",
          iconOnly: false,
          aria: () => {
            const on = game.getState().seams !== false;
            return (
              "Seams: " +
              (on ? "on" : "off") +
              ". Activate to toggle honeycomb edges."
            );
          },
          cycle: cycleSeams,
        },
      ];
    }

    // ---- State ----
    // phase: closed | rising | open | falling
    const state = {
      phase: "closed",
      active: null,
    };
    let statsTimer = null;
    let ignoreOutsideUntil = 0;
    let phaseTimer = null;
    let dockBtn = null; // center menu / close
    let dockResetBtn = null;
    let dockHelpBtn = null;
    let lastFocus = null;

    function announce(msg) {
      live.textContent = msg || "";
    }

    function isOpenish() {
      return state.phase === "open" || state.phase === "rising";
    }

    function setPhase(phase) {
      state.phase = phase;
      root.dataset.phase = phase;
      root.dataset.open = phase === "open" || phase === "rising" ? "true" : "false";
      if (phase === "open" && state.active) root.dataset.branch = state.active;
      else if (phase !== "open") delete root.dataset.branch;
      if (phase !== "open") delete root.dataset.dock;
      document.body.classList.toggle(
        "hex-bloom-open",
        phase === "open" || phase === "rising" || phase === "falling"
      );
      paintDock();
    }

    function paintDock() {
      if (!dockBtn) return;
      const open = state.phase === "open";
      const rising = state.phase === "rising" || state.phase === "falling";
      if (open) {
        dockBtn._labelEl.textContent = "×";
        dockBtn.setAttribute("aria-label", "Close menu");
        dockBtn.setAttribute("aria-expanded", "true");
      } else if (rising) {
        dockBtn._labelEl.textContent = "";
        dockBtn.setAttribute("aria-expanded", "true");
      } else {
        dockBtn._labelEl.textContent = "";
        dockBtn.setAttribute("aria-label", "Open game menu");
        dockBtn.setAttribute("aria-expanded", "false");
      }
      // Side tiles stay available while open (restart / help without hunting)
      if (dockResetBtn) {
        dockResetBtn.hidden = false;
        dockResetBtn.setAttribute("aria-hidden", "false");
      }
      if (dockHelpBtn) {
        dockHelpBtn.hidden = false;
        dockHelpBtn.setAttribute("aria-hidden", "false");
      }
    }

    function readStats() {
      const st = game.getState() || {};
      const faceN =
        (st.cells && st.cells.length) ||
        ({ xsmall: 162, easy: 362, medium: 642, hard: 1002, xlarge: 1442 }[
          st.difficulty
        ] || 362);
      let planned = st.mineCount | 0;
      if (planned <= 0 && typeof game.mineTargetForDifficulty === "function") {
        planned = game.mineTargetForDifficulty(faceN) | 0;
      }
      if (planned <= 0) planned = Math.max(1, Math.round(faceN * 0.17));
      const flags = st.flagsPlaced | 0;
      const left = Math.max(
        0,
        (st.mineCount > 0 ? st.mineCount : planned) - flags
      );
      const time = Math.max(0, st.timeElapsed | 0);
      return { left, time };
    }

    function paintStats() {
      const { left, time } = readStats();
      if (hubMines) hubMines.textContent = String(left);
      if (hubTime) hubTime.textContent = String(time);
      const legacyLeft = document.getElementById("stats-mines");
      const legacyTime = document.getElementById("stats-time");
      if (legacyLeft) legacyLeft.textContent = String(left).padStart(2, "0");
      if (legacyTime) legacyTime.textContent = String(time).padStart(3, "0") + "s";
    }

    function clearStage() {
      stage.querySelectorAll(".hb-hex").forEach((n) => n.remove());
    }

    function removeSubmenu() {
      stage.querySelectorAll(".hb-hex.is-sub").forEach((el) => {
        el.style.transitionDelay = "0ms";
        el.classList.remove("shown");
        el.classList.add("folded");
        const drop = () => el.remove();
        el.addEventListener("transitionend", drop, { once: true });
        setTimeout(drop, foldMs());
      });
    }

    function addSubmenu(dirIndex, cat) {
      const { HEX } = tileMetrics();
      const { cx, cy } = centerXY();
      const dir = BLOOM_DIRS[dirIndex] || DIRECTIONS[dirIndex];
      const p = hexToPixel(dir.q, dir.r, HEX);
      const px = cx + p.x;
      const py = cy + p.y;
      const items = cat.sub();
      const offsets = leafOffsets(dirIndex, items.length);

      items.forEach((item, j) => {
        const off = offsets[j] || DIRECTIONS[dirIndex];
        const o = hexToPixel(off.q, off.r, HEX);
        const isSwatch = !!item.themeSwatch;
        const el = makeHex({
          cls:
            "is-sub" +
            (item.chosen && item.chosen() ? " is-chosen" : "") +
            (item.icon ? " has-icon" : "") +
            (isSwatch ? " is-theme-swatch" : ""),
          label: item.label,
          labelSize: item.labelSize,
          ariaLabel: cat.id + ": " + item.label,
          icon: isSwatch ? null : item.icon,
          iconOnly: isSwatch
            ? true
            : !!item.icon && item.iconOnly !== false && !item.labelKeep,
        });
        if (isSwatch) {
          const sw = themeSwatchVars(item.themeSwatch);
          el.style.setProperty("--theme-fill", sw.fill);
          el.style.setProperty("--theme-edge", sw.edge);
          el.style.setProperty("--theme-field", sw.field);
          el.style.setProperty("--theme-ink", sw.ink);
          el.style.setProperty("--theme-accent", sw.accent);
          // Tiny field-circle in the middle — same grammar as the Theme control
          const dot = document.createElement("span");
          dot.className = "hb-theme-dot";
          dot.setAttribute("aria-hidden", "true");
          el.appendChild(dot);
        }
        // Flag leaf paints red like in-game flags
        if (item.icon === "flag") el.classList.add("is-flag-icon");
        if (item.icon === "dig") el.classList.add("is-dig-icon");
        // Subs with icons still keep short labels when useful
        if (item.icon && item.label && !item.iconOnly && !isSwatch) {
          el.classList.add("is-sub-icon-label");
          if (el._labelEl)
            el._labelEl.classList.remove("sr-visual-hide", "hb-label-sr");
        }
        el.dataset.cat = cat.id;
        el.dataset.sub = item.id;
        place(el, px + o.x, py + o.y, px, py);
        el.classList.add("folded");
        el.dataset.delay = String(j * 28);
        el.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (typeof item.run === "function") item.run();
          refreshChosen(cat.id);
          refreshPrimaryLabels();
        });
        stage.appendChild(el);
      });
      unfold(stage.querySelectorAll(".hb-hex.is-sub.folded"));
    }

    function refreshChosen(catId) {
      const cat = categories().find((c) => c.id === catId);
      if (!cat) return;
      const items = cat.sub();
      stage
        .querySelectorAll('.hb-hex.is-sub[data-cat="' + catId + '"]')
        .forEach((el) => {
          const item = items.find((it) => it.id === el.dataset.sub);
          el.classList.toggle(
            "is-chosen",
            !!(item && item.chosen && item.chosen())
          );
        });
    }

    function refreshPrimaryLabels() {
      const cats = categories();
      stage.querySelectorAll(".hb-hex.is-primary").forEach((el) => {
        const cat = cats.find((c) => c.id === el.dataset.cat);
        if (!cat) return;
        const lab = typeof cat.label === "function" ? cat.label() : cat.label;
        const aria = typeof cat.aria === "function" ? cat.aria() : lab;
        el.setAttribute("aria-label", aria);
        if (cat.icon) {
          const name =
            typeof cat.icon === "function" ? cat.icon() : cat.icon;
          setHexIcon(el, name);
          el.classList.toggle("is-flag-icon", name === "flag");
          el.classList.toggle("is-dig-icon", name === "dig");
          el.classList.toggle("is-theme-icon", name === "theme");
        }
        // Theme primary circle can pick up current theme accent
        if (cat.id === "theme") {
          const t = THEMES[game.getThemeIndex()] || THEMES[0];
          const sw = themeSwatchVars(t);
          el.style.setProperty("--theme-fill", sw.fill);
          el.style.setProperty("--theme-edge", sw.edge);
          el.style.setProperty("--theme-field", sw.field);
        }
        // Size keeps a visible letter badge; other primaries are icon-only
        if (el._labelEl) {
          if (cat.badge) {
            el._labelEl.textContent = lab;
            el._labelEl.classList.remove("sr-visual-hide", "hb-label-sr");
            el.classList.add("has-badge");
          } else if (cat.iconOnly) {
            el._labelEl.textContent = lab;
            el._labelEl.classList.add("sr-visual-hide", "hb-label-sr");
          } else {
            el._labelEl.textContent = lab;
          }
        }
      });
      // Dock menu is the close control while open
      if (dockBtn && state.phase === "open") {
        dockBtn._labelEl.textContent = "×";
        dockBtn.setAttribute("aria-label", "Close menu");
      }
    }

    function clearActive() {
      stage
        .querySelectorAll(".hb-hex.is-active")
        .forEach((e) => e.classList.remove("is-active"));
      removeSubmenu();
      state.active = null;
      delete root.dataset.branch;
    }

    function toggleCategory(id, dirIndex) {
      const cat = categories().find((c) => c.id === id);
      const el = stage.querySelector(
        '.hb-hex.is-primary[data-cat="' + id + '"]'
      );
      if (!cat || !el) return;

      // Cycle primaries: one click flips state, no nested bloom.
      if (typeof cat.cycle === "function") {
        clearActive();
        cat.cycle();
        refreshPrimaryLabels();
        return;
      }

      if (state.active === id) {
        clearActive();
        announce("Menu open");
        return;
      }
      clearActive();
      state.active = id;
      root.dataset.branch = id;
      el.classList.add("is-active");
      addSubmenu(dirIndex, cat);
      announce(typeof cat.aria === "function" ? cat.aria() : cat.id);
    }

    function renderDockOnly() {
      dock.textContent = "";
      dock.className = "hex-bloom-dock";
      dock.setAttribute("role", "toolbar");
      dock.setAttribute("aria-label", "Game chrome");

      // Restart — left, quieter
      dockResetBtn = makeHex({
        cls: "is-dock is-dock-side is-dock-reset",
        label: "",
        icon: "reset",
        iconOnly: true,
        ariaLabel: "Restart game",
      });
      dockResetBtn.title = "Restart";
      dockResetBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        ignoreOutsideUntil = Date.now() + 250;
        doReset();
      });

      // Menu — center, primary (opens bloom / closes when open)
      dockBtn = makeHex({
        cls: "is-dock is-dock-menu",
        label: "",
        ariaLabel: "Open game menu",
      });
      dockBtn.id = "hex-bloom-seed";
      dockBtn.setAttribute("aria-haspopup", "dialog");
      dockBtn.setAttribute("aria-controls", "hex-bloom-stage");
      dockBtn.setAttribute("aria-expanded", "false");
      dockBtn.title = "Menu";
      dockBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        ignoreOutsideUntil = Date.now() + 250;
        if (state.phase === "open" || state.phase === "rising") collapse();
        else if (state.phase === "closed") expand();
      });

      // Help — right, quieter
      dockHelpBtn = makeHex({
        cls: "is-dock is-dock-side is-dock-help",
        label: "",
        icon: "help",
        iconOnly: true,
        ariaLabel: "Help",
      });
      dockHelpBtn.title = "Help";
      dockHelpBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        ignoreOutsideUntil = Date.now() + 250;
        doHelp();
      });

      dock.appendChild(dockResetBtn);
      dock.appendChild(dockBtn);
      dock.appendChild(dockHelpBtn);
      paintDock();
    }

    function renderBloom(options) {
      const withPetals = !options || options.petals !== false;
      clearStage();
      setRiseVar();
      const { HEX } = tileMetrics();
      const { cx, cy } = centerXY();
      const cats = categories();

      // Center is the activation node (dock menu). When open, dock menu is the
      // close control — no separate traveler hex (avoids double × and rise).
      if (!withPetals) return;

      cats.forEach((cat, i) => {
        const d = BLOOM_DIRS[i] || DIRECTIONS[i];
        const p = hexToPixel(d.q, d.r, HEX);
        const lab = typeof cat.label === "function" ? cat.label() : cat.label;
        const iconName =
          typeof cat.icon === "function" ? cat.icon() : cat.icon;
        const el = makeHex({
          cls:
            "is-primary cat-" +
            cat.id +
            (state.active === cat.id ? " is-active" : "") +
            (cat.badge ? " has-badge" : "") +
            (iconName === "flag" ? " is-flag-icon" : "") +
            (iconName === "dig" ? " is-dig-icon" : "") +
            (iconName === "theme" ? " is-theme-icon" : ""),
          label: lab,
          labelSize: cat.labelSize,
          ariaLabel: typeof cat.aria === "function" ? cat.aria() : lab,
          icon: iconName,
          iconOnly: !!cat.iconOnly && !cat.badge,
        });
        if (cat.badge && el._labelEl) {
          el._labelEl.classList.remove("sr-visual-hide", "hb-label-sr");
        }
        if (cat.id === "theme") {
          const t = THEMES[game.getThemeIndex()] || THEMES[0];
          const sw = themeSwatchVars(t);
          el.style.setProperty("--theme-fill", sw.fill);
          el.style.setProperty("--theme-edge", sw.edge);
          el.style.setProperty("--theme-field", sw.field);
        }
        el.dataset.cat = cat.id;
        el.dataset.index = String(i);
        if (cat.sub) {
          el.setAttribute("aria-haspopup", "true");
          el.setAttribute("aria-expanded", String(state.active === cat.id));
        } else {
          el.removeAttribute("aria-haspopup");
          el.setAttribute("aria-expanded", "false");
        }
        place(el, cx + p.x, cy + p.y, cx, cy);
        el.classList.add("folded");
        el.dataset.delay = String(i * 26);
        el.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          ignoreOutsideUntil = Date.now() + 200;
          toggleCategory(cat.id, i);
        });
        stage.appendChild(el);
      });
    }

    function bloomPetals() {
      unfold(stage.querySelectorAll(".hb-hex.is-primary.folded"));
      if (state.active) {
        const cats = categories();
        const i = cats.findIndex((c) => c.id === state.active);
        const cat = cats[i];
        if (cat && i >= 0) {
          requestAnimationFrame(() => addSubmenu(i, cat));
          root.dataset.branch = state.active;
        }
      }
      // focus the close dock — menu is the active surface
      if (dockBtn) dockBtn.focus({ preventScroll: true });
    }

    function setCanvasInert(on) {
      const canvas = document.querySelector(".canvas-container");
      if (canvas) {
        if (on) canvas.setAttribute("inert", "");
        else canvas.removeAttribute("inert");
      }
    }

    function expand() {
      if (state.phase !== "closed") return;
      clearTimeout(phaseTimer);
      lastFocus = document.activeElement;
      root.dataset.sphereBusy = "false";

      hub.hidden = false;
      hub.dataset.open = "true";
      clearInterval(statsTimer);
      statsTimer = setInterval(paintStats, 250);
      paintStats();
      setCanvasInert(true);

      // Rooted at dock menu — no rise travel; unfold petals upward in place.
      setRiseVar();
      setPhase("open");
      root.dataset.dock = "ready";
      paintDock();
      renderBloom({ petals: true });
      refreshPrimaryLabels();
      requestAnimationFrame(() => {
        if (state.phase !== "open") return;
        bloomPetals();
        announce("Menu open");
      });
    }

    function collapse() {
      if (state.phase !== "open" && state.phase !== "rising") return;
      clearTimeout(phaseTimer);
      state.active = null;
      delete root.dataset.branch;

      // Fold petals immediately (no stagger on the way in)
      stage.querySelectorAll(".hb-hex.is-primary, .hb-hex.is-sub").forEach((el) => {
        el.style.transitionDelay = "0ms";
        el.classList.remove("shown");
        el.classList.add("folded");
        el.style.pointerEvents = "none";
      });

      setPhase("falling");

      const finish = () => {
        if (state.phase !== "falling") return;
        clearStage();
        setPhase("closed");
        clearInterval(statsTimer);
        statsTimer = null;
        hub.dataset.open = "false";
        hub.hidden = true;
        setCanvasInert(false);
        announce("Menu closed");
        if (dockBtn) dockBtn.focus({ preventScroll: true });
        else if (lastFocus && lastFocus.focus) {
          try {
            lastFocus.focus({ preventScroll: true });
          } catch (_) {}
        }
      };

      phaseTimer = setTimeout(finish, foldMs());
    }

    // Scrim click closes
    scrim.addEventListener("click", (e) => {
      e.preventDefault();
      if (state.phase === "open") collapse();
    });

    // Focus trap while open
    document.addEventListener(
      "keydown",
      (e) => {
        if (state.phase !== "open" && state.phase !== "rising") return;

        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          if (state.active && state.phase === "open") {
            clearActive();
            announce("Menu open");
            if (dockBtn) dockBtn.focus({ preventScroll: true });
          } else {
            collapse();
          }
          return;
        }

        if (e.key === "Tab") {
          const focusables = [
            dockResetBtn,
            dockBtn,
            dockHelpBtn,
            ...stage.querySelectorAll(
              ".hb-hex.is-primary.shown, .hb-hex.is-sub.shown"
            ),
          ].filter(Boolean);
          if (!focusables.length) return;
          const i = focusables.indexOf(document.activeElement);
          e.preventDefault();
          if (e.shiftKey) {
            const prev = i <= 0 ? focusables.length - 1 : i - 1;
            focusables[prev].focus({ preventScroll: true });
          } else {
            const next = i < 0 || i >= focusables.length - 1 ? 0 : i + 1;
            focusables[next].focus({ preventScroll: true });
          }
        }
      },
      true
    );

    document.addEventListener("keydown", (e) => {
      if (
        (e.key === "c" || e.key === "C") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "")
      ) {
        if (state.phase === "open" || state.phase === "rising") collapse();
        else if (state.phase === "closed") expand();
      }
    });

    document.addEventListener("keyup", (e) => {
      if (state.phase !== "open") return;
      if (/^[stnfrSTNFR]$/.test(e.key)) refreshPrimaryLabels();
    });

    let raf;
    window.addEventListener("resize", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setRiseVar();
        if (state.phase === "open") {
          // rebuild petal positions without losing open state
          const active = state.active;
          renderBloom({ petals: true });
          state.active = active;
          bloomPetals();
        } else if (state.phase === "rising" || state.phase === "falling") {
          setRiseVar();
        }
      });
    });

    // ---- Dock attention fade ----
    // Hide while the player is on the board (spinning or aiming over tiles).
    // Show only when attention leaves the playfield into the bottom chrome band
    // (or off the canvas). Dig taps alone do not hide; orbit / sustained board
    // attention does. Menu open always forces visible.
    function wireSphereBusyFade() {
      const canvas = document.getElementById("gameCanvas");
      if (!canvas) return;

      let down = false;
      let dragging = false;
      let boardAttention = false;
      let engaged = false; // once true, board hover keeps dock hidden
      let startX = 0;
      let startY = 0;
      const MOVE_PX = 10;
      // Bottom strip reserved for chrome — pointer here reveals the seed
      // Tall enough for full-size dock trio + upward bloom clearance
      const CHROME_BAND = 140;

      function pointFrom(e) {
        if (e.touches && e.touches.length) return e.touches[0];
        if (e.changedTouches && e.changedTouches.length)
          return e.changedTouches[0];
        return e;
      }

      function inChromeBand(x, y) {
        const h = window.innerHeight || document.documentElement.clientHeight;
        const band = CHROME_BAND + (parseInt(getComputedStyle(document.documentElement).getPropertyValue("env(safe-area-inset-bottom)"), 10) || 0);
        // safe-area via CSS env isn't readable as number easily — pad generously
        return y >= h - (CHROME_BAND + 24);
      }

      function applyBusyAttr() {
        if (state.phase !== "closed") {
          root.dataset.sphereBusy = "false";
          return;
        }
        const hide = dragging || (engaged && boardAttention);
        root.dataset.sphereBusy = hide ? "true" : "false";
      }

      function setDragging(v) {
        dragging = !!v;
        if (dragging) engaged = true;
        applyBusyAttr();
      }

      function setBoardAttention(v) {
        boardAttention = !!v;
        applyBusyAttr();
      }

      function updateFromPoint(x, y, target) {
        if (state.phase !== "closed") {
          root.dataset.sphereBusy = "false";
          return;
        }
        if (inChromeBand(x, y)) {
          setBoardAttention(false);
          return;
        }
        // Pointer over playfield (canvas / board)
        const onCanvas =
          target === canvas ||
          (target && canvas.contains && canvas.contains(target)) ||
          target === document.body ||
          target === document.documentElement;
        if (onCanvas || (x >= 0 && y >= 0 && y < window.innerHeight - CHROME_BAND)) {
          if (engaged || dragging) setBoardAttention(true);
          else setBoardAttention(false); // first visit: keep seed visible until engage
        } else {
          setBoardAttention(false);
        }
      }

      function onDown(e) {
        if (state.phase !== "closed") return;
        down = true;
        dragging = false;
        if (e.touches && e.touches.length >= 2) {
          setDragging(true);
          return;
        }
        const t = pointFrom(e);
        if (!t) return;
        startX = t.clientX;
        startY = t.clientY;
        if (inChromeBand(t.clientX, t.clientY)) {
          setBoardAttention(false);
          return;
        }
      }

      function onMove(e) {
        const t = pointFrom(e);
        if (!t) return;

        if (state.phase !== "closed") {
          root.dataset.sphereBusy = "false";
          return;
        }

        // Not dragging: mouse move can reveal chrome only in the bottom band
        if (!down) {
          updateFromPoint(t.clientX, t.clientY, e.target);
          return;
        }

        if (e.touches && e.touches.length >= 2) {
          setDragging(true);
          return;
        }
        if (!dragging) {
          const dx = t.clientX - startX;
          const dy = t.clientY - startY;
          if (dx * dx + dy * dy >= MOVE_PX * MOVE_PX) setDragging(true);
        }
        if (dragging) {
          if (inChromeBand(t.clientX, t.clientY)) setBoardAttention(false);
          else setBoardAttention(true);
        }
      }

      function onUp(e) {
        const t = pointFrom(e);
        down = false;
        const wasDragging = dragging;
        setDragging(false);
        if (t) updateFromPoint(t.clientX, t.clientY, e && e.target);
        else if (wasDragging) {
          // stay hidden if we don't know where the pointer is — engaged board
          if (engaged) setBoardAttention(true);
        }
      }

      function onLeave() {
        // Pointer left the window → allow chrome back
        if (!down) setBoardAttention(false);
      }

      window.addEventListener("pointerdown", onDown, { passive: true });
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerup", onUp, { passive: true });
      window.addEventListener("pointercancel", onUp, { passive: true });
      window.addEventListener("blur", onLeave);
      document.addEventListener("mouseleave", onLeave);
      // Touch
      window.addEventListener("touchstart", onDown, { passive: true });
      window.addEventListener("touchmove", onMove, { passive: true });
      window.addEventListener("touchend", onUp, { passive: true });
    }

    // Boot
    setPhase("closed");
    root.dataset.sphereBusy = "false";
    renderDockOnly();
    paintStats();
    wireSphereBusyFade();

    return {
      open: expand,
      close: collapse,
      toggle: () => (state.phase === "closed" ? expand() : collapse()),
      isOpen: () => isOpenish(),
    };
  }

  global.initHexBloom = initHexBloom;
})(window);
