/*
 * File Purpose: chrome for `?play=inside` — standing inside the sphere and
 *   playing the wall.
 *
 *   Interior play runs without hex-bloom, because a spatial dock makes no
 *   sense when the board has swallowed the viewport: there is no "off the
 *   sphere" left to bloom from. Luke's call was to fall back to the plain
 *   modal shape the shipping sphere uses, so this is deliberately the same
 *   grammar as sphere/quiet-chrome.js — a readout at the top, bare glyphs at
 *   the bottom, everything else behind the existing Help sheet.
 *
 *   sphere-ux's own HUD already supplies Help, Reset and Customize and is
 *   wired by sphere.js, so this adds only what hex-bloom used to and that mode
 *   would otherwise lose: the visible mines/time readout (index.html's copy is
 *   sr-only), an Undo, and a Flag toggle.
 *
 * Primary Functions/Classes: initInteriorChrome(game)
 * Inputs: the SphereSweeper API. Outputs: DOM chrome, polled once a second.
 * A11y: real buttons, 44px targets, aria-pressed on Flag, aria-disabled on
 *   Undo, and the readout is aria-hidden because index.html already carries a
 *   live-region copy for screen readers — announcing it twice is worse than
 *   not announcing it here.
 * Author: Luke Steuber <luke@lukesteuber.com>
 */
(function (global) {
  "use strict";

  // Copied from hex-bloom's ICONS table (hex-bloom.js:268), same as
  // inner-menu.js does and for the same reason: hex-bloom keeps them private.
  const GLYPH = {
    undo: '<path d="M4 4v5h5"/><path d="M4.8 8.2A8.3 8.3 0 1 1 4 16"/>',
    flag: '<path d="M6 21.2V3.6"/><path d="M6 4.4h11.6l-2.9 4 2.9 4H6"/>',
    reset:
      '<path d="M3.5 12a8.5 8.5 0 0 1 14.3-6.2L20 8"/><path d="M20 3.5V8h-4.5"/>' +
      '<path d="M20.5 12a8.5 8.5 0 0 1-14.3 6.2L4 16"/><path d="M4 20.5V16h4.5"/>',
    sliders:
      '<path d="M4 6h5M13 6h7M4 12h10M18 12h2M4 18h2M10 18h10"/>' +
      '<path d="M9 3v6M14 9v6M10 15v6"/>',
    help:
      '<circle cx="12" cy="12" r="9"/>' +
      '<path d="M9.2 9.2a2.8 2.8 0 1 1 3.9 2.6c-.9.5-1.6 1.1-1.6 2.2"/>' +
      '<path d="M12 17.2h.01"/>',
  };

  function svg(name) {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" style="width:24px;height:24px;display:block">' +
      GLYPH[name] +
      "</svg>"
    );
  }

  function initInteriorChrome(game) {
    if (!game) return null;

    const style = document.createElement("style");
    style.textContent = [
      ".ip-readout{position:fixed;top:max(10px,env(safe-area-inset-top,0px));",
      "left:50%;transform:translateX(-50%);z-index:42;display:flex;gap:18px;",
      "font:600 15px/1 ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;",
      "letter-spacing:.06em;pointer-events:none;color:#111;",
      "background:rgba(255,255,255,.9);padding:7px 14px;border-radius:999px;",
      "box-shadow:0 1px 6px rgba(0,0,0,.28)}",
      ".ip-bar{position:fixed;left:50%;transform:translateX(-50%);",
      "bottom:max(14px,env(safe-area-inset-bottom,0px));z-index:42;display:flex;gap:10px}",
      // The board now fills the whole viewport, so chrome cannot inherit the
      // page colour and hope: a transparent control lands on white tiles or
      // black ones with equal likelihood. Everything here carries its own
      // plate and its own ink.
      ".ip-btn{min-width:44px;min-height:44px;display:grid;place-items:center;",
      "border:1px solid rgba(0,0,0,.22);border-radius:999px;padding:0 12px;",
      "background:rgba(255,255,255,.92);color:#111;cursor:pointer;",
      "box-shadow:0 1px 6px rgba(0,0,0,.28)}",
      ".ip-btn[aria-pressed='true']{background:#111;border-color:#111}",
      ".ip-btn[aria-pressed='true'] svg{stroke:#ff2200}",
      ".ip-btn[aria-disabled='true']{opacity:.35;cursor:default}",
      ".ip-btn:focus-visible{outline:2px solid currentColor;outline-offset:3px}",
    ].join("");
    document.head.appendChild(style);

    const readout = document.createElement("div");
    readout.className = "ip-readout";
    // index.html already has an aria-live copy of these numbers; a second
    // announcement would just talk over it.
    readout.setAttribute("aria-hidden", "true");
    const mines = document.createElement("span");
    const time = document.createElement("span");
    readout.append(mines, time);

    const bar = document.createElement("div");
    bar.className = "ip-bar";
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "Board controls");

    function button(label, glyph) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ip-btn";
      b.setAttribute("aria-label", label);
      b.title = label;
      b.innerHTML = svg(glyph);
      bar.appendChild(b);
      return b;
    }

    /*
     * Reset, Customize and Help are relocated, not reimplemented.
     *
     * They exist already in index.html's corner HUD and are wired by
     * sphere.js — but out at the viewport edges they were unreachable in this
     * mode, and they looked nothing like the bar. Rather than duplicate their
     * behaviour (and the bugs that would drift between two copies), these
     * buttons forward a click to the originals, and the originals are hidden.
     * One implementation, one set of handlers, moved inboard and restyled to
     * match Undo and Flag.
     */
    function forward(id) {
      const el = document.getElementById(id);
      if (el) el.click();
    }

    const undo = button("Undo", "undo");
    const flag = button("Flag mode", "flag");
    const reset = button("Reset", "reset");
    const customize = button("Customize board", "sliders");
    const help = button("Help", "help");

    reset.addEventListener("click", () => {
      forward("reset-btn");
      paint();
    });
    customize.addEventListener("click", () => forward("customize-btn"));
    help.addEventListener("click", () => forward("help-btn"));

    // Hide the corner originals now that the bar carries them.
    const hide = document.createElement("style");
    hide.textContent =
      "body[data-interior-play='true'] .hud-cluster," +
      "body[data-interior-play='true'] .hud-help-fixed{display:none !important}";
    document.head.appendChild(hide);

    undo.addEventListener("click", () => {
      if (game.canUndo && !game.canUndo()) return;
      game.undo();
      paint();
    });
    flag.addEventListener("click", () => {
      const next = !game.getState().flagMode;
      game.setFlagMode(next);
      paint();
    });

    function paint() {
      const st = game.getState();
      // Pre-first-dig the mine count is still 0, so show the planned total
      // rather than a dead 00 (same trick the other readouts use).
      const left = st.isFirstClick && !st.mineCount
        ? game.mineTargetForDifficulty(st.cells.length || 362)
        : Math.max(0, st.mineCount - st.flagsPlaced);
      mines.textContent = String(left).padStart(2, "0") + " left";
      time.textContent = String(Math.max(0, st.timeElapsed | 0)).padStart(3, "0") + "s";
      const can = !game.canUndo || game.canUndo();
      undo.setAttribute("aria-disabled", can ? "false" : "true");
      flag.setAttribute("aria-pressed", st.flagMode ? "true" : "false");
    }

    document.body.append(readout, bar);
    paint();
    // The engine owns the clock; a one-second poll is enough for a readout and
    // costs nothing next to the render loop.
    setInterval(paint, 1000);
    document.addEventListener("pointerup", () => setTimeout(paint, 0), true);

    return { paint };
  }

  global.initInteriorChrome = initInteriorChrome;
})(window);
