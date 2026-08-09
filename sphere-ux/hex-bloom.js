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

  const COUNTS = [
    ["numerals", "123"],
    ["rings", "Rings"],
    ["yellow", "Mark"],
    ["flush", "Flush"],
    ["borderless", "Seam"],
  ];

  // 6 neighbour directions, clockwise from East (pointy-top axial)
  const DIRECTIONS = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
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
      // Bloom sits 25% up from the bottom (not screen-center / halfway).
      const h = stage.clientHeight || global.innerHeight;
      const w = stage.clientWidth || global.innerWidth;
      return {
        cx: w / 2,
        cy: h * 0.75,
      };
    }

    function dockCenterY() {
      const rect = dock.getBoundingClientRect();
      return rect.top + rect.height / 2;
    }

    function setRiseVar() {
      const { cy } = centerXY();
      const dockY = dockCenterY();
      // positive = below center (CSS translateY)
      const dy = dockY - cy;
      root.style.setProperty("--rise-y", dy.toFixed(1) + "px");
    }

    function leafOffsets(dirIndex, count) {
      if (count <= 0) return [];
      if (count <= 3) {
        const trio = [
          DIRECTIONS[(dirIndex + 5) % 6],
          DIRECTIONS[dirIndex],
          DIRECTIONS[(dirIndex + 1) % 6],
        ];
        if (count === 1) return [trio[1]];
        if (count === 2) return [trio[0], trio[2]];
        return trio;
      }
      const out = DIRECTIONS[dirIndex];
      const left = DIRECTIONS[(dirIndex + 5) % 6];
      const right = DIRECTIONS[(dirIndex + 1) % 6];
      const farLeft = DIRECTIONS[(dirIndex + 4) % 6];
      const farRight = DIRECTIONS[(dirIndex + 2) % 6];
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
      const c = game.getState().countStyle;
      const hit = COUNTS.find((x) => x[0] === c);
      return hit ? hit[1] : "123";
    }
    function shortLabel(s, n) {
      s = String(s || "");
      return s.length > n ? s.slice(0, n - 1) + "…" : s;
    }

    function styleIconName() {
      const c = game.getState().countStyle;
      if (c === "rings") return "rings";
      if (c === "numerals") return "numerals";
      return "style";
    }

    function categories() {
      return [
        {
          id: "mode",
          label: () => currentMode(),
          icon: () => (game.getState().flagMode ? "flag" : "dig"),
          iconOnly: true,
          aria: () => "Mode: " + currentMode(),
          sub: () => [
            {
              id: "dig",
              label: "Dig",
              icon: "dig",
              chosen: () => !game.getState().flagMode,
              run: () => {
                game.setFlagMode(false);
                announce("Mode · Dig");
              },
            },
            {
              id: "flag",
              label: "Flag",
              icon: "flag",
              chosen: () => !!game.getState().flagMode,
              run: () => {
                game.setFlagMode(true);
                announce("Mode · Flag");
              },
            },
          ],
        },
        {
          id: "size",
          // Letter stays as a value badge; nested-hex icon under it
          label: () => currentSize(),
          icon: "size",
          iconOnly: false,
          badge: true,
          aria: () => "Size: " + currentSize(),
          sub: () =>
            SIZES.map(([id, lab]) => ({
              id: "sz-" + id,
              label: lab,
              chosen: () => game.getState().difficulty === id,
              run: () => {
                game.setSize(id);
                announce("Size · " + lab);
              },
            })),
        },
        {
          id: "theme",
          label: () => shortLabel(currentTheme(), 7),
          icon: "theme",
          iconOnly: true,
          aria: () => "Theme: " + currentTheme(),
          sub: () =>
            THEMES.map((t, i) => ({
              id: "th-" + (t.id || i),
              label: t.name,
              // No generic icon — the hex face *is* the theme paint
              themeSwatch: t,
              iconOnly: true,
              chosen: () => game.getThemeIndex() === i,
              run: () => {
                game.setThemeIndex(i);
                announce("Theme · " + t.name);
              },
            })),
        },
        {
          id: "style",
          label: () => shortLabel(currentStyle(), 7),
          icon: () => styleIconName(),
          iconOnly: true,
          aria: () => "Warning style: " + currentStyle(),
          sub: () =>
            COUNTS.map(([id, lab]) => ({
              id: "st-" + id,
              label: lab,
              icon:
                id === "rings"
                  ? "rings"
                  : id === "numerals"
                    ? "numerals"
                    : "style",
              labelSize: lab.length > 5 ? "xs" : "sm",
              chosen: () => game.getState().countStyle === id,
              run: () => {
                game.setCountStyle(id);
                announce("Style · " + lab);
              },
            })),
        },
        {
          id: "drag",
          label: "Drag",
          icon: "drag",
          iconOnly: true,
          aria: () => "Drag invert",
          sub: () => [
            {
              id: "inv-x",
              label: "Flip X",
              icon: "flipX",
              chosen: () => invertGet("x"),
              run: () => {
                const next = !invertGet("x");
                if (typeof game.setInvertDragX === "function")
                  game.setInvertDragX(next);
                announce("Invert X · " + (next ? "on" : "off"));
              },
            },
            {
              id: "inv-y",
              label: "Flip Y",
              icon: "flipY",
              chosen: () => invertGet("y"),
              run: () => {
                const next = !invertGet("y");
                if (typeof game.setInvertDragY === "function")
                  game.setInvertDragY(next);
                announce("Invert Y · " + (next ? "on" : "off"));
              },
            },
          ],
        },
        {
          id: "system",
          label: "More",
          icon: "more",
          iconOnly: true,
          aria: () => "Reset and help",
          sub: () => [
            {
              id: "reset",
              label: "Reset",
              icon: "reset",
              chosen: () => false,
              run: () => {
                if (typeof game.reset === "function") game.reset();
                else {
                  const b = document.getElementById("reset-btn");
                  if (b) b.click();
                }
                announce("Board reset");
                collapse();
              },
            },
            {
              id: "help",
              label: "Help",
              icon: "help",
              chosen: () => false,
              run: () => {
                const b = document.getElementById("help-btn");
                if (b) b.click();
                collapse();
              },
            },
          ],
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
    let dockBtn = null;
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
        // Bottom seat mirrors center close (glyph only)
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
      const p = hexToPixel(DIRECTIONS[dirIndex].q, DIRECTIONS[dirIndex].r, HEX);
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
      // Center is always the close control while open (×), never last-selection text
      const core = stage.querySelector(".hb-hex.is-center");
      if (core && core._labelEl && state.phase === "open") {
        core._labelEl.textContent = "×";
        core.setAttribute("aria-label", "Close menu");
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
      dockBtn = makeHex({
        cls: "is-dock",
        label: "",
        ariaLabel: "Open game menu",
      });
      dockBtn.id = "hex-bloom-seed";
      dockBtn.setAttribute("aria-haspopup", "dialog");
      dockBtn.setAttribute("aria-controls", "hex-bloom-stage");
      dockBtn.setAttribute("aria-expanded", "false");
      dockBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        ignoreOutsideUntil = Date.now() + 250;
        if (state.phase === "open" || state.phase === "rising") collapse();
        else if (state.phase === "closed") expand();
      });
      dock.appendChild(dockBtn);
      paintDock();
    }

    function renderBloom(options) {
      const withPetals = !options || options.petals !== false;
      clearStage();
      setRiseVar();
      const { HEX } = tileMetrics();
      const { cx, cy } = centerXY();
      const cats = categories();

      // Center core at bloom anchor (25% up from bottom) — × closes while open
      const center = makeHex({
        cls: "is-center",
        label: state.phase === "open" ? "×" : "",
        ariaLabel: state.phase === "open" ? "Close menu" : "Game menu",
      });
      center.id = "hex-bloom-core";
      center.style.left = cx + "px";
      center.style.top = cy + "px";
      center.setAttribute(
        "aria-hidden",
        state.phase === "open" ? "false" : "true"
      );
      if (state.phase === "open") {
        center.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          ignoreOutsideUntil = Date.now() + 250;
          collapse();
        });
      } else {
        center.tabIndex = -1;
      }
      stage.appendChild(center);

      if (!withPetals) return;

      cats.forEach((cat, i) => {
        const d = DIRECTIONS[i];
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
        el.setAttribute("aria-haspopup", "true");
        el.setAttribute("aria-expanded", String(state.active === cat.id));
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

      hub.hidden = false;
      hub.dataset.open = "true";
      clearInterval(statsTimer);
      statsTimer = setInterval(paintStats, 250);
      paintStats();
      setCanvasInert(true);

      // 1) Show traveler at dock seat
      setRiseVar();
      setPhase("rising");
      renderBloom({ petals: true }); // primaries exist but CSS hides until open

      // 2) Next frame: rise; start petal unfold partway through so it feels one motion
      const go = () => {
        if (state.phase !== "rising") return;
        setPhase("open");
        refreshPrimaryLabels();
        const bloomAt = Math.round(riseMs() * 0.45);
        phaseTimer = setTimeout(() => {
          if (state.phase !== "open") return;
          root.dataset.dock = "ready";
          paintDock();
          bloomPetals();
          announce("Menu open");
        }, bloomAt);
      };

      if (prefersReducedMotion()) go();
      else requestAnimationFrame(() => requestAnimationFrame(go));
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

      setRiseVar();
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

      // Fall home only — was riseMs+80 (~500ms) of dead air after fold
      phaseTimer = setTimeout(finish, Math.max(foldMs(), riseMs() * 0.75));
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
            dockBtn,
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

    // Boot
    setPhase("closed");
    renderDockOnly();
    paintStats();

    return {
      open: expand,
      close: collapse,
      toggle: () =>
        state.phase === "closed" ? expand() : collapse(),
      isOpen: () => isOpenish(),
    };
  }

  global.initHexBloom = initHexBloom;
})(window);
