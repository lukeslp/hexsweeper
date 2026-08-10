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

  // Indicators rotate rather than fan out. `rings` is back in the cycle now
  // that it costs no extra tile — and the Kimi and Muse takes land on it, so
  // it had to stay reachable regardless.
  const INDICATORS = [
    ["numerals", "123"],
    ["yellow", "Mark"],
    ["rings", "Rings"],
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
  // Ring used to fan leaves around a parent. Only cells with r < 0 (screen-up):
  // E/W would sit under Restart/Help, SE/SW would clip off the bottom.
  const LEAF_RING = [
    { q: 1, r: -1 }, // NE
    { q: 0, r: -1 }, // NW
    { q: 2, r: -2 }, // ring-2 up-right
    { q: 1, r: -2 }, // ring-2 NNE
    { q: 0, r: -2 }, // ring-2 N
    { q: -1, r: -1 }, // ring-2 up-left
  ];

  // Fixed seats for the primaries, in categories() order. Three rows stacked
  // above the dock, widest row four tiles — a single five-wide row overflows a
  // phone. x = q + r/2, so each row below is centred on the seed:
  //
  //       [3D] [Indicators]          r = -3
  //     [Bg] [Shell] [Dug]           r = -2
  //   [Seams][Size][Dig][Invert]     r = -1
  //     [reset] [x] [help]           r =  0  (fixed dock)
  const PRIMARY_SLOTS = [
    { q: 1, r: -1 }, // Dig / Flag
    { q: 0, r: -1 }, // Size
    { q: -1, r: -1 }, // Seams
    { q: 2, r: -1 }, // Invert — the notch right of Dig
    { q: 0, r: -2 }, // Bg
    { q: 1, r: -2 }, // Shell
    { q: 2, r: -2 }, // Dug
    { q: 1, r: -3 }, // 3D / Flush
    { q: 2, r: -3 }, // Indicators
  ];

  /**
   * ?dock=split — variant A from CHROME_HISTORY (2026-08-09): the bloom keeps
   * play controls only (Dig · Size · Invert, one row); every appearance
   * toggle moves into the ? modal beside the Surface row. The default dock is
   * untouched — this flag exists so the two can be compared live.
   */
  const DOCK_SPLIT = (() => {
    try {
      return new URLSearchParams(location.search).get("dock") === "split";
    } catch (_) {
      return false;
    }
  })();
  const SPLIT_SLOTS = [
    { q: 1, r: -1 }, // Dig / Flag — same seat as the full dock
    { q: 0, r: -1 }, // Size — same seat
    { q: -1, r: -1 }, // Invert — takes Seams' old seat
  ];
  const ACTIVE_SLOTS = DOCK_SPLIT ? SPLIT_SLOTS : PRIMARY_SLOTS;

  /**
   * iOS Safari double-tap smart-zoom, layer two. touch-action: manipulation
   * on the tiles covers taps that land ON them — but the dock grows and lifts
   * as it opens, so the second tap of a fast open/close often lands where the
   * seed WAS: scrim or bare stage, where iOS ignores touch-action entirely.
   * Suppress the zoom at the document and re-dispatch the tap's click so a
   * fast second tap still activates what it hit.
   */
  let lastTapEnd = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      const now = Date.now();
      const fast = now - lastTapEnd < 350;
      lastTapEnd = now;
      if (!fast || !e.cancelable) return;
      // A finger still down means pinch, not tap — leave it alone.
      if (e.touches && e.touches.length) return;
      e.preventDefault();
      const t =
        e.target && e.target.closest
          ? e.target.closest("button, a, input, .hb-hex")
          : null;
      if (t && typeof t.click === "function") t.click();
    },
    { passive: false, capture: true }
  );

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
    indicators:
      '<path d="M12 3.4 19.3 7.7v8.6L12 20.6 4.7 16.3V7.7L12 3.4Z"/>' +
      '<circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/>',
    numerals:
      '<path d="M8 17V7l-2 2"/><path d="M11.5 17h4.2c1.2 0 2-.8 2-2s-.8-2-2-2h-2.2c-1.2 0-2-.8-2-2s.8-2 2-2H18"/>',
    rings:
      '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="10"/>',
    drag:
      '<path d="M12 4v16"/><path d="m8 8 4-4 4 4"/><path d="m8 16 4 4 4-4"/>' +
      '<path d="M4 12h16"/><path d="m8 8-4 4 4 4"/><path d="m16 8 4 4-4 4"/>',
    more: '<circle cx="6.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="17.5" cy="12" r="1.6"/>',
    // Menu affordance — hollow hex (board language)
    menu:
      '<path d="M12 2.8 20.2 7.6v8.8L12 21.2 3.8 16.4V7.6L12 2.8Z"/>',
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

    function dockOpen() {
      return (
        state.phase === "open" ||
        state.phase === "rising" ||
        state.phase === "falling"
      );
    }

    /**
     * Bloom origin = menu dock tile (activation node).
     *
     * While the dock is open/opening, never trust a live getBoundingClientRect
     * of the menu — width/height/translateY animate over --rise-ms, and a mid-
     * transition rect stacks Dig/Size under Restart/Menu/Help. Compute the
     * *final* open seat from CSS tokens instead.
     */
    function centerXY() {
      const h = stage.clientHeight || global.innerHeight;
      const w = stage.clientWidth || global.innerWidth;
      const csRoot = getComputedStyle(root);
      const csDock = dock ? getComputedStyle(dock) : csRoot;
      // CSS: .hex-bloom-dock { bottom: max(2px, env(safe-area-inset-bottom)) }
      // Computed style resolves the max()/env() to px — hardcoding 2 put the
      // petals ~30px low on phones with a home indicator (viewport-fit=cover).
      let bottomPad = 2;
      if (dock) {
        const b = parseFloat(getComputedStyle(dock).bottom);
        if (Number.isFinite(b) && b >= 0 && b < 120) bottomPad = b;
      }
      if (dockOpen()) {
        // Final open size = full bloom tiles (--tile-h on root; dock mirrors it)
        const th =
          parseFloat(csRoot.getPropertyValue("--tile-h")) ||
          parseFloat(csDock.getPropertyValue("--tile-h-dock")) ||
          88;
        // --dock-rise is set on .hex-bloom-dock when open, not on root
        let rise = parseFloat(
          String(csDock.getPropertyValue("--dock-rise")).replace("px", "")
        );
        if (!Number.isFinite(rise) || rise === 0) {
          // Fallback if computed style still idle mid-frame
          rise = w <= 400 ? -28 : -36;
        }
        // bottom edge at bottomPad; translateY(rise) lifts the center
        const cy = h - bottomPad - th / 2 + rise;
        return { cx: w / 2, cy };
      }
      // Closed / idle: live measure is fine (no transition collision)
      const stageRect = stage.getBoundingClientRect();
      const menu = dockBtn || document.getElementById("hex-bloom-seed");
      if (menu) {
        const r = menu.getBoundingClientRect();
        return {
          cx: r.left + r.width / 2 - stageRect.left,
          cy: r.top + r.height / 2 - stageRect.top,
        };
      }
      const th = parseFloat(csRoot.getPropertyValue("--tile-h-dock-idle")) || 46;
      return { cx: w / 2, cy: h - bottomPad - th / 2 };
    }

    function setRiseVar() {
      root.style.setProperty("--rise-y", "0px");
    }

    /**
     * Vertical distance from the dock's idle seed to its open seed, from the
     * same CSS tokens centerXY trusts. The stage starts translated down by
     * this and rides to 0 in lockstep with the dock's grow+lift.
     */
    function dockRiseDelta() {
      const csRoot = getComputedStyle(root);
      const th = parseFloat(csRoot.getPropertyValue("--tile-h")) || 88;
      const thIdle =
        parseFloat(csRoot.getPropertyValue("--tile-h-dock-idle")) || 46;
      let rise = NaN;
      if (dock) {
        rise = parseFloat(
          String(getComputedStyle(dock).getPropertyValue("--dock-rise")).replace("px", "")
        );
      }
      if (!Number.isFinite(rise) || rise === 0) {
        rise = (stage.clientWidth || global.innerWidth) <= 400 ? -28 : -36;
      }
      return (th - thIdle) / 2 - rise;
    }

    function leafOffsets(dirIndex, count) {
      if (count <= 0) return [];
      // Prefer bloom-up directions so nested fans also stay on-screen.
      const ring = LEAF_RING;
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
      // Bottom-anchored, same as the dock's CSS seat: a height-only viewport
      // change (mobile URL bar show/hide) then moves dock and petals together
      // with zero re-layout, instead of detaching them for a frame and
      // rebuilding. y stays in top-down stage coordinates for the fold math.
      const stageH = stage.clientHeight || global.innerHeight;
      el.style.left = x + "px";
      el.style.bottom = stageH - y + "px";
      el.style.top = "auto";
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

    function indicatorId() {
      const cs = game.getState().countStyle;
      return INDICATORS.some(([id]) => id === cs) ? cs : "numerals";
    }

    function indicatorLabel() {
      const hit = INDICATORS.find(([id]) => id === indicatorId());
      return hit ? hit[1] : "123";
    }

    function cycleIndicators() {
      const i = INDICATORS.findIndex(([id]) => id === indicatorId());
      const [id, lab] = INDICATORS[(i + 1) % INDICATORS.length];
      game.setCountStyle(id, { syncSurface: false });
      announce("Indicators · " + lab);
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
      // Cycle primaries — every tile flips state on click (no submenus).
      // Restart / Help live on the always-visible three-tile dock.
      const all = [
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
          id: "ax-field",
          label: "Bg",
          swatch: () => axisSwatch("field", getAxes().field),
          iconOnly: true,
          aria: () => "Background: " + getAxes().field + ". Activate to flip.",
          // Flipping an axis returns to the classic mono look — setAppearanceAxes
          // clears the surface pack, so these double as the way back from
          // Earth / Moon / Water.
          cycle: () => flipAxis("field"),
        },
        {
          id: "ax-shell",
          label: "Shell",
          swatch: () => axisSwatch("shell", getAxes().shell),
          iconOnly: true,
          aria: () => "Covered faces: " + getAxes().shell + ". Activate to flip.",
          cycle: () => flipAxis("shell"),
        },
        {
          id: "ax-well",
          label: "Dug",
          swatch: () => axisSwatch("well", getAxes().well),
          iconOnly: true,
          aria: () => "Dug faces: " + getAxes().well + ". Activate to flip.",
          cycle: () => flipAxis("well"),
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
          id: "indicators",
          label: () => indicatorLabel(),
          // Stable glyph; the label carries which style is live.
          icon: "indicators",
          iconOnly: false,
          labelSize: "sm",
          aria: () =>
            "Indicators: " +
            indicatorLabel() +
            ". Activate to cycle numerals, mark, rings.",
          cycle: cycleIndicators,
        },
      ];
      if (!DOCK_SPLIT) return all;
      // Split dock: play controls only, in SPLIT_SLOTS order. The appearance
      // tiles' jobs move to the ? modal (see bindHelpLook in sphere.js).
      const keep = ["mode", "size", "invert"];
      return keep
        .map((id) => all.find((c) => c.id === id))
        .filter(Boolean);
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
      const open =
        state.phase === "open" ||
        state.phase === "rising" ||
        state.phase === "falling";
      if (open) {
        // Close affordance on the activation node
        if (dockBtn._glyphEl) {
          dockBtn._glyphEl.innerHTML = "";
          dockBtn._glyphEl.hidden = true;
        }
        dockBtn._labelEl.textContent = "×";
        dockBtn._labelEl.classList.remove("sr-visual-hide", "hb-label-sr");
        dockBtn.setAttribute("aria-label", "Close menu");
        dockBtn.setAttribute("aria-expanded", "true");
      } else {
        setHexIcon(dockBtn, "menu");
        if (dockBtn._glyphEl) dockBtn._glyphEl.hidden = false;
        dockBtn._labelEl.textContent = "Menu";
        dockBtn._labelEl.classList.add("sr-visual-hide", "hb-label-sr");
        dockBtn.setAttribute("aria-label", "Open game menu");
        dockBtn.setAttribute("aria-expanded", "false");
      }
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
      const dir = ACTIVE_SLOTS[dirIndex] || DIRECTIONS[dirIndex];
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

    function applyPrimarySwatch(el, spec) {
      const sw = themeSwatchVars(spec);
      el.style.setProperty("--theme-fill", sw.fill);
      el.style.setProperty("--theme-edge", sw.edge);
      el.style.setProperty("--theme-field", sw.field);
      el.style.setProperty("--theme-ink", sw.ink);
      el.style.setProperty("--theme-accent", sw.accent);
      if (!el.querySelector(".hb-theme-dot")) {
        const dot = document.createElement("span");
        dot.className = "hb-theme-dot";
        dot.setAttribute("aria-hidden", "true");
        el.appendChild(dot);
      }
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
        // Axis tiles repaint their swatch as the look changes under them.
        if (cat.swatch) {
          applyPrimarySwatch(
            el,
            typeof cat.swatch === "function" ? cat.swatch() : cat.swatch
          );
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
        label: "Menu",
        icon: "menu",
        iconOnly: true,
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
        const d = ACTIVE_SLOTS[i] || DIRECTIONS[i];
        const p = hexToPixel(d.q, d.r, HEX);
        const lab = typeof cat.label === "function" ? cat.label() : cat.label;
        const iconName =
          typeof cat.icon === "function" ? cat.icon() : cat.icon;
        const swatch =
          typeof cat.swatch === "function" ? cat.swatch() : cat.swatch;
        const el = makeHex({
          cls:
            "is-primary cat-" +
            cat.id +
            (state.active === cat.id ? " is-active" : "") +
            (cat.badge ? " has-badge" : "") +
            (iconName === "flag" ? " is-flag-icon" : "") +
            (iconName === "dig" ? " is-dig-icon" : "") +
            (iconName === "theme" ? " is-theme-icon" : "") +
            (swatch ? " is-theme-swatch" : ""),
          label: lab,
          labelSize: cat.labelSize,
          ariaLabel: typeof cat.aria === "function" ? cat.aria() : lab,
          icon: swatch ? null : iconName,
          iconOnly: swatch ? true : !!cat.iconOnly && !cat.badge,
        });
        if (swatch) applyPrimarySwatch(el, swatch);
        if (cat.badge && el._labelEl) {
          el._labelEl.classList.remove("sr-visual-hide", "hb-label-sr");
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

      // Dock grows + lifts (CSS). Petals use *final* open geometry from CSS
      // tokens (centerXY), never a mid-transition getBoundingClientRect — that
      // is what stacked Dig/Size under Restart/Menu/Help after grow/lift.
      setPhase("open");
      root.dataset.dock = "ready";
      paintDock();
      // Place on the next frame so data-phase=open has applied open CSS vars
      // (--dock-rise, full tile size) before we read them.
      requestAnimationFrame(() => {
        if (state.phase !== "open") return;
        // Root the petal layer at the dock's *idle* seed with no transition,
        // place petals at final geometry, then ride the whole layer up in
        // lockstep with the dock — petals stay glued to the seed instead of
        // hovering at their final seats while the dock catches up.
        stage.style.transition = "none";
        root.style.setProperty("--rise-y", dockRiseDelta() + "px");
        renderBloom({ petals: true });
        refreshPrimaryLabels();
        void stage.offsetHeight; // commit the pre-rise transform
        stage.style.transition = "";
        requestAnimationFrame(() => {
          if (state.phase !== "open") return;
          setRiseVar();
          bloomPetals();
          announce("Menu open");
        });
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
      // Ride the petal layer back down with the dock while the petals fold —
      // one coherent settle instead of fold-then-drop.
      root.style.setProperty("--rise-y", dockRiseDelta() + "px");

      const finish = () => {
        if (state.phase !== "falling") return;
        clearStage();
        setPhase("closed");
        setRiseVar();
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
    // Seeded now, not 0 — otherwise the first URL-bar height change would
    // read as a width change and trigger the rebuild this gate exists to stop.
    let lastStageW = stage.clientWidth || global.innerWidth;
    window.addEventListener("resize", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Mid-descent the stage is deliberately translated; zeroing it here
        // would snap the folding petals upward.
        if (state.phase !== "falling") setRiseVar();
        // Height-only changes are the mobile URL bar showing/hiding — petals
        // are bottom-anchored, so they already rode along with the dock.
        // Rebuilding on those is what made the open bloom jitter and resettle.
        const w = stage.clientWidth || global.innerWidth;
        const widthChanged = Math.abs(w - lastStageW) > 1;
        lastStageW = w;
        if (!widthChanged) return;
        if (state.phase === "open") {
          // rebuild petal positions without losing open state
          const active = state.active;
          renderBloom({ petals: true });
          state.active = active;
          bloomPetals();
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
