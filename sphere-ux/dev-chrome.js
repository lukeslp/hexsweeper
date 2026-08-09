/*
 * File Purpose: Drive the sphere settings stack.
 * Stats hub (mines + seconds) upper-center while open.
 * Mode: Dig / Flag word pair. Invert X/Y: single labels, grey=off bright=on.
 * Size · Warning · Theme: label-only, tap to cycle (no current-value text).
 * Author: Luke Steuber <luke@lukesteuber.com>
 */
(function (global) {
  "use strict";

  const SIZES = [
    ["xsmall", "XS", "162 faces"],
    ["easy", "S", "362 faces"],
    ["medium", "M", "642 faces"],
    ["hard", "L", "1002 faces"],
    ["xlarge", "XL", "1442 faces"],
  ];

  const COUNTS = [
    ["numerals", "Numerals", "digits"],
    ["rings", "Rings", "concentric"],
    ["yellow", "Yellow", "mark"],
    ["flush", "Flush", "flat"],
    ["borderless", "Borderless", "seamless"],
  ];

  const TAP = [
    [false, "Dig"],
    [true, "Flag"],
  ];

  function themeMeta(def) {
    if (!def) return "";
    if (def.id === "earth" || def.id === "moon") return "globe map";
    if (def.id === "float" || def.id === "card") return "contact shadow";
    if (def.id === "glow") return "luminous digs";
    return "mono";
  }

  function initDevChrome(game) {
    const panel = document.getElementById("customize-panel");
    const btn = document.getElementById("customize-btn");
    const stack = document.getElementById("settings-stack");
    if (!panel || !btn || !game) return;

    const THEMES = (global.SphereSweeper && global.SphereSweeper.THEMES) || [];

    const staleScrim = document.getElementById("customize-scrim");
    if (staleScrim) staleScrim.remove();

    let hub = document.getElementById("settings-hub");
    if (!hub) {
      hub = document.createElement("div");
      hub.id = "settings-hub";
      hub.className = "settings-hub";
      hub.hidden = true;
      hub.setAttribute("aria-live", "polite");
      hub.innerHTML =
        '<span class="settings-hub-mines" id="settings-hub-mines">00</span>' +
        '<span class="settings-hub-gap" aria-hidden="true"></span>' +
        '<span class="settings-hub-time" id="settings-hub-time">0</span>';
      document.body.appendChild(hub);
    }
    const hubMines = document.getElementById("settings-hub-mines");
    const hubTime = document.getElementById("settings-hub-time");

    // Off-screen live region only — never a visible sibling of the gear.
    const live = document.createElement("p");
    live.className = "cz-live sr-only";
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    document.body.appendChild(live);

    // Remove leftover persistent Dig/Flag dock from earlier builds.
    document.querySelectorAll("#mode-dock, .mode-dock").forEach((n) => n.remove());
    // Ensure legacy stubs cannot paint (display:none in CSS; strip visible glyphs too).
    document.querySelectorAll(".legacy-hud .size-mark, .legacy-hud .count-mark").forEach((n) => {
      n.textContent = "";
    });
    document.querySelectorAll(".legacy-hud button").forEach((n) => {
      // Keep the button node for sphere.js wiring; drop any injected SVG/text paint.
      // size/theme/nest get re-filled by sync* — re-hide after a tick.
      n.setAttribute("tabindex", "-1");
    });
    // After sphere.js syncs icons into legacy buttons, wipe paint again.
    setTimeout(() => {
      document.querySelectorAll(".legacy-hud button").forEach((btnEl) => {
        // Preserve empty control; sphere only needs the element id for listeners.
        // Do not clear if it would break getElementById — just force CSS hide.
        btnEl.style.cssText =
          "display:none!important;visibility:hidden!important;opacity:0!important;" +
          "position:fixed!important;left:-10000px!important;width:0!important;height:0!important;";
      });
    }, 0);
    setTimeout(() => {
      document.querySelectorAll(".legacy-hud button").forEach((btnEl) => {
        btnEl.style.cssText =
          "display:none!important;visibility:hidden!important;opacity:0!important;" +
          "position:fixed!important;left:-10000px!important;width:0!important;height:0!important;";
      });
    }, 50);

    function invertGet(axis) {
      const inv =
        typeof game.getInvertDrag === "function"
          ? game.getInvertDrag()
          : { x: false, y: false };
      return axis === "y" ? !!inv.y : !!inv.x;
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
      const left = Math.max(0, (st.mineCount > 0 ? st.mineCount : planned) - flags);
      const time = Math.max(0, st.timeElapsed | 0);
      return { left, time };
    }

    const CYCLES = [
      {
        label: "Size",
        len: SIZES.length,
        get: () => Math.max(0, SIZES.findIndex((s) => s[0] === game.getState().difficulty)),
        at: (i) => [SIZES[i][1], SIZES[i][2]],
        set: (i) => game.setSize(SIZES[i][0]),
      },
      {
        label: "Warning",
        len: COUNTS.length,
        get: () => Math.max(0, COUNTS.findIndex((c) => c[0] === game.getState().countStyle)),
        at: (i) => [COUNTS[i][1], COUNTS[i][2]],
        set: (i) => game.setCountStyle(COUNTS[i][0]),
      },
      {
        label: "Theme",
        len: THEMES.length,
        get: () => game.getThemeIndex(),
        at: (i) => [THEMES[i] ? THEMES[i].name : "—", themeMeta(THEMES[i])],
        set: (i) => game.setThemeIndex(i),
      },
    ];

    let statsTimer = null;

    function paintStats() {
      const { left, time } = readStats();
      if (hubMines) hubMines.textContent = String(left);
      if (hubTime) hubTime.textContent = String(time);
      const legacyLeft = document.getElementById("stats-mines");
      const legacyTime = document.getElementById("stats-time");
      if (legacyLeft) legacyLeft.textContent = String(left).padStart(2, "0");
      if (legacyTime) legacyTime.textContent = String(time).padStart(3, "0") + "s";
    }

    /** Dig / Flag word pair — inside settings flyout only. */
    function renderMode() {
      const idx = game.getState().flagMode ? 1 : 0;
      const el = document.createElement("div");
      el.className = "cz-toggle";
      el.setAttribute("role", "group");
      el.setAttribute("aria-label", "Mode");

      const opts = document.createElement("div");
      opts.className = "cz-toggle-opts";
      TAP.forEach((opt, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cz-toggle-opt";
        b.textContent = opt[1];
        b.dataset.on = String(i === idx);
        b.setAttribute("aria-pressed", String(i === idx));
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          if (i === (game.getState().flagMode ? 1 : 0)) return;
          game.setFlagMode(TAP[i][0]);
          render();
          live.textContent = "Mode: " + TAP[i][1];
        });
        opts.appendChild(b);
      });
      el.appendChild(opts);
      panel.appendChild(el);
    }

    /**
     * Invert X / Invert Y — single word each.
     * Default off (grey); click brightens and turns invert on.
     */
    function renderInvert(axis, label) {
      const on = invertGet(axis);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cz-switch";
      b.textContent = label;
      b.dataset.on = String(on);
      b.setAttribute("aria-pressed", String(on));
      b.setAttribute(
        "aria-label",
        label + (on ? ", on" : ", off") + ". Activate to toggle."
      );
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const next = !invertGet(axis);
        if (axis === "x" && typeof game.setInvertDragX === "function") {
          game.setInvertDragX(next);
        } else if (axis === "y" && typeof game.setInvertDragY === "function") {
          game.setInvertDragY(next);
        }
        render();
        live.textContent = label + ": " + (next ? "on" : "off");
      });
      panel.appendChild(b);
    }

    /**
     * Size / Warning / Theme — only the word is shown; tap cycles.
     * Dots stay as position marks under the word.
     */
    function renderCycle(row) {
      if (!row.len) return;
      const idx = row.get();
      const [name, meta] = row.at(idx);
      const nextName = row.at((idx + 1) % row.len)[0];

      const el = document.createElement("button");
      el.type = "button";
      el.className = "cz-cycle";
      el.setAttribute(
        "aria-label",
        row.label +
          ": " +
          name +
          (meta ? ", " + meta : "") +
          ". Activate to cycle to " +
          nextName
      );

      const lab = document.createElement("span");
      lab.className = "cz-cycle-label";
      lab.textContent = row.label;

      const dots = document.createElement("span");
      dots.className = "cz-dots";
      dots.setAttribute("aria-hidden", "true");
      for (let i = 0; i < row.len; i++) {
        const d = document.createElement("span");
        d.className = "cz-dot";
        d.dataset.on = String(i === idx);
        dots.appendChild(d);
      }

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const next = (row.get() + 1) % row.len;
        row.set(next);
        render();
        const [n, m] = row.at(row.get());
        live.textContent = row.label + ": " + n + (m ? ", " + m : "");
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          const next = (row.get() - 1 + row.len) % row.len;
          row.set(next);
          render();
        } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          const next = (row.get() + 1) % row.len;
          row.set(next);
          render();
        }
      });

      el.appendChild(lab);
      el.appendChild(dots);
      panel.appendChild(el);
    }

    function render() {
      panel.textContent = "";
      // Flyout bottom → gear: Invert · Size · Warning · Theme · Dig/Flag
      renderInvert("x", "Invert X");
      renderInvert("y", "Invert Y");
      CYCLES.forEach(renderCycle);
      renderMode();
      paintStats();
    }

    let open = false;
    function setOpen(next, restoreFocus) {
      open = next;
      btn.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("settings-open", open);
      if (open) {
        hub.hidden = false;
        if (stack) {
          stack.hidden = false;
          panel.hidden = false;
          panel.dataset.open = "true";
          render();
          requestAnimationFrame(() => {
            stack.dataset.open = "true";
            hub.dataset.open = "true";
          });
        } else {
          panel.hidden = false;
          render();
          requestAnimationFrame(() => {
            panel.dataset.open = "true";
            hub.dataset.open = "true";
          });
        }
        clearInterval(statsTimer);
        statsTimer = setInterval(paintStats, 250);
        paintStats();
      } else {
        clearInterval(statsTimer);
        statsTimer = null;
        hub.dataset.open = "false";
        hub.hidden = true;
        if (stack) {
          stack.dataset.open = "false";
          stack.hidden = true;
        }
        panel.dataset.open = "false";
        panel.hidden = true;
        live.textContent = "";
        if (restoreFocus !== false) btn.focus({ preventScroll: true });
      }
    }

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      setOpen(!open);
    });
    if (stack) stack.addEventListener("pointerdown", (e) => e.stopPropagation());
    else panel.addEventListener("pointerdown", (e) => e.stopPropagation());

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && open) {
        e.stopPropagation();
        setOpen(false);
      } else if (
        (e.key === "c" || e.key === "C") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "")
      ) {
        setOpen(!open);
      }
    });

    const GAME_KEYS = /^[stnfrSTNFR]$/;
    document.addEventListener("keyup", (e) => {
      if (!open || !GAME_KEYS.test(e.key)) return;
      render();
    });

    setOpen(false, false);
  }

  global.initDevChrome = initDevChrome;
})(window);
