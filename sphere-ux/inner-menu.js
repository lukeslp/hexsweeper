/*
 * File Purpose: `?dock=inside` — the hex menu seated *inside* the sphere.
 *
 *   Every previous dock floated the menu over the board. The canvas is a
 *   single opaque element, so a DOM menu can only ever sit on top of it: the
 *   equator ribbon fakes depth with a synthetic sine, the face takeover clips
 *   tiles to real projected polygons but still paints above everything. None
 *   of them can be occluded by the sphere, because there is nothing for the
 *   sphere to occlude — the shell is one flat rectangle to the DOM.
 *
 *   So this menu is not DOM. Seven hexes live at radius SEAT_R inside the
 *   unit shell, as real geometry in sphere space. Each frame they are rotated
 *   and projected by the same camera the board uses and handed to sphere.js,
 *   which merges them into its one back-to-front sort. The sphere's own faces
 *   then pass in front of them as it turns, for free — no clipping, no
 *   z-index, no per-tile polygon subtraction. Turn the sphere far enough and a
 *   seat goes round the back and is gone.
 *
 *   The shell fades while the menu is open (sphere.js applies shellAlpha) so
 *   the menu reads through it. It does not vanish: seeing tiles slide over the
 *   seats is the effect, not an artefact of it.
 *
 * Primary Functions/Classes: initInnerMenu(game)
 * Inputs: the SphereSweeper API — projectLocalPoint, setInnerMenu, getState,
 *   setMenuInteraction, and the ordinary action setters.
 * Outputs: canvas-drawn seats, plus a visually hidden button per seat so the
 *   menu is operable without sight of it (canvas draws nothing a screen
 *   reader can reach; the DOM mirror is the accessible surface).
 * A11y: real <button>s in a labelled group, aria-pressed on the toggles, a
 *   polite live region for outcomes, Escape closes, focus returns to opener.
 *   Honours prefers-reduced-motion (no bloom tween, no idle drift).
 * Author: Luke Steuber <luke@lukesteuber.com>
 */
(function (global) {
  "use strict";

  /* Geometry. Angular hex radius and ring spread are locked together: six
   * hexes touch their neighbour when the ring sits at hexR * sqrt(3). */
  const SEAT_R = 0.68; // radius inside the unit shell
  const HEX_A = 0.28; // angular radius of one seat, radians
  const RING_A = HEX_A * Math.sqrt(3);
  const OPEN_MS = 420;
  const CLOSE_MS = 260;
  const SHELL_ALPHA = 0.26; // how far the shell fades back when open

  function norm(v) {
    const l = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x / l, y: v.y / l, z: v.z / l };
  }
  function scale(v, k) {
    return { x: v.x * k, y: v.y * k, z: v.z * k };
  }
  function add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }
  function cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }
  /** Any unit vector perpendicular to d, chosen to avoid the degenerate axis. */
  function perp(d) {
    const seed = Math.abs(d.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    return norm(cross(d, seed));
  }

  /**
   * Undo the renderer's Y-then-X camera rotation. Seats are placed in
   * unrotated sphere space, so "put the menu where the player is looking"
   * means projecting the view axis back through the inverse camera once, at
   * open time. After that the seats simply ride the sphere.
   */
  function unrotate(r, rotY, rotX) {
    const cx = Math.cos(rotX);
    const sx = Math.sin(rotX);
    const y1 = r.y * cx + r.z * sx;
    const z1 = -r.y * sx + r.z * cx;
    const cy = Math.cos(rotY);
    const sy = Math.sin(rotY);
    return { x: r.x * cy - z1 * sy, y: y1, z: r.x * sy + z1 * cy };
  }

  /** A hexagon of angular radius `a` around unit direction d, on radius R. */
  function hexAround(d, a, R) {
    const e1 = perp(d);
    const e2 = norm(cross(d, e1));
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const t = (Math.PI / 3) * i + Math.PI / 6;
      const off = add(scale(e1, Math.cos(t) * Math.sin(a)), scale(e2, Math.sin(t) * Math.sin(a)));
      pts.push(scale(norm(add(scale(d, Math.cos(a)), off)), R));
    }
    return pts;
  }

  const SIZES = ["xsmall", "easy", "medium", "hard", "xlarge"];

  function initInnerMenu(game) {
    if (!game || typeof game.setInnerMenu !== "function") return null;

    const reduceMotion =
      global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let open = false;
    let progress = 0; // 0 closed, 1 fully bloomed
    let lastT = 0; // paint-clock stamp, for the bloom tween
    let axis = { x: 0, y: 0, z: 1 }; // local-space direction the flower faces
    let seats = [];
    let lastProjected = [];

    /* ---- seats ------------------------------------------------------ */

    const ACTIONS = [
      {
        id: "close",
        label: () => "Close",
        run: () => close(),
      },
      {
        id: "restart",
        label: () => "Restart",
        run: () => {
          game.reset();
          say("Board restarted.");
        },
      },
      {
        id: "undo",
        label: () => "Undo",
        enabled: () => !!(game.canUndo && game.canUndo()),
        run: () => {
          if (game.canUndo && !game.canUndo()) {
            say("Nothing to undo.");
            return;
          }
          game.undo();
          say("Undone.");
        },
      },
      {
        id: "flag",
        label: () => (game.getState().flagMode ? "Flag ON" : "Flag"),
        pressed: () => !!game.getState().flagMode,
        run: () => {
          const next = !game.getState().flagMode;
          game.setFlagMode(next);
          say(next ? "Flag mode on." : "Flag mode off.");
        },
      },
      {
        id: "theme",
        label: () => {
          const t = game.getState().theme;
          return t && t.name ? t.name : "Theme";
        },
        run: () => {
          // applyTheme() wraps the index itself, so no modulo here — the
          // roster length is not exposed and hard-coding it would rot.
          const next = game.getThemeIndex() + 1;
          game.setThemeIndex(next);
          const t = game.getState().theme;
          say(`Theme ${t && t.name ? t.name : next}.`);
        },
      },
      {
        id: "size",
        label: () => {
          const n = game.getState().cells.length;
          return n ? `${n}` : "Size";
        },
        run: () => {
          const cur = game.getState().difficulty;
          const i = SIZES.indexOf(cur);
          const next = SIZES[(i < 0 ? 0 : i + 1) % SIZES.length];
          game.setSize(next);
          say(`Board size ${next}.`);
        },
      },
      {
        id: "seams",
        label: () => (game.getAppearance().seams ? "Seams ON" : "Seams"),
        pressed: () => !!game.getAppearance().seams,
        run: () => {
          const next = !game.getAppearance().seams;
          game.setSeams(next);
          say(next ? "Seams on." : "Seams off.");
        },
      },
    ];

    /** Rebuild seat geometry around the current view axis. */
    function seatGeometry() {
      const u = perp(axis);
      const v = norm(cross(axis, u));
      const dirs = [axis];
      for (let i = 0; i < 6; i++) {
        const t = (Math.PI / 3) * i;
        const off = add(
          scale(u, Math.cos(t) * Math.sin(RING_A)),
          scale(v, Math.sin(t) * Math.sin(RING_A))
        );
        dirs.push(norm(add(scale(axis, Math.cos(RING_A)), off)));
      }
      seats = dirs.map((d, i) => ({
        action: ACTIONS[i],
        dir: d,
        // Cached at full bloom; the open tween scales toward these.
        hex: hexAround(d, HEX_A, SEAT_R),
        center: scale(d, SEAT_R),
      }));
    }

    /* ---- open / close ----------------------------------------------- */

    function ease(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    /**
     * Advance the bloom off the paint clock rather than a private rAF. The
     * renderer decides when frames happen (frameNeedsPaint asks `animating()`
     * to keep the loop alive); driving progress from its timestamps keeps the
     * tween exactly in step with the frames that show it, and means a parked
     * loop can never strand the menu half-open.
     */
    function advance(now) {
      const target = open ? 1 : 0;
      if (progress === target) return;
      if (!lastT) lastT = now;
      const dt = Math.min(64, Math.max(0, now - lastT));
      lastT = now;
      const step = dt / (open ? OPEN_MS : CLOSE_MS);
      progress = open
        ? Math.min(1, progress + step)
        : Math.max(0, progress - step);
      if (!open && progress === 0) finishClose();
    }

    function animating() {
      return progress !== (open ? 1 : 0);
    }

    function opener() {
      return document.getElementById("inner-menu-open");
    }

    /**
     * `instant` skips the bloom. The frozen collection study and headless
     * capture both want the menu already up, and virtual-time headless runs
     * cannot be trusted to land mid-tween.
     */
    function show(instant) {
      if (open) return;
      const st = game.getState();
      axis = unrotate({ x: 0, y: 0, z: 1 }, st.rotY, st.rotX);
      seatGeometry();
      open = true;
      progress = reduceMotion || instant ? 1 : 0;
      game.setMenuInteraction(true);
      game.pauseTimer();
      panel.hidden = false;
      syncButtons();
      lastT = 0;
      if (game.scheduleFrame) game.scheduleFrame();
      say("Menu open inside the sphere. Turn the sphere to reach a seat.");
      const first = panel.querySelector("button");
      if (first) first.focus();
    }

    function close() {
      if (!open) return;
      open = false;
      if (reduceMotion) {
        progress = 0;
        finishClose();
        return;
      }
      lastT = 0;
      if (game.scheduleFrame) game.scheduleFrame();
    }

    function finishClose() {
      lastProjected = [];
      panel.hidden = true;
      game.setMenuInteraction(false);
      game.resumeTimer();
      const btn = opener();
      if (btn) btn.focus();
    }

    /* ---- the renderer contract --------------------------------------- */

    function isOpen() {
      return open || progress > 0.001;
    }

    function shellAlpha() {
      // Fade in step with the bloom so nothing pops.
      return 1 - (1 - SHELL_ALPHA) * progress;
    }

    /**
     * Hand sphere.js one projected polygon per seat. Shape matches the board's
     * own projected faces (center/boundary/z plus center.depth for the sort),
     * with `innerMenu` marking which branch should paint it.
     */
    function project(now) {
      advance(typeof now === "number" ? now : performance.now());
      if (!isOpen()) return null;
      const p = ease(Math.max(0, Math.min(1, progress)));
      // The flower grows out of the sphere's core rather than fading in place.
      const grow = 0.18 + 0.82 * p;
      const out = [];
      for (const seat of seats) {
        const boundary = seat.hex.map((pt) => game.projectLocalPoint(scale(pt, grow)));
        const center = game.projectLocalPoint(scale(seat.center, grow));
        let z = center.z;
        for (const b of boundary) z += b.z;
        z /= boundary.length + 1;
        out.push({
          innerMenu: true,
          seat,
          center,
          boundary,
          z,
          facing: center.z,
        });
      }
      lastProjected = out;
      return out;
    }

    function paint(ctx, proj, now) {
      const seat = proj.seat;
      const action = seat.action;
      const front = proj.facing;
      // Seats behind the sphere's core dim out; they are still drawn, because
      // watching one sink away is how the depth reads.
      const vis = Math.max(0, Math.min(1, (front + 0.62) / 1.0));
      if (vis <= 0.02) return;
      const st = game.getState();
      const dark = !(st.theme && st.theme.chrome === "light");
      const enabled = !action.enabled || action.enabled();
      const on = action.pressed && action.pressed();

      ctx.save();
      ctx.globalAlpha = (0.28 + 0.72 * vis) * Math.min(1, progress * 1.6);
      ctx.beginPath();
      proj.boundary.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
      ctx.closePath();

      const base = dark ? "12,16,22" : "252,253,255";
      const ink = dark ? "236,244,255" : "17,21,28";
      ctx.fillStyle = on
        ? `rgba(${dark ? "72,190,215" : "24,120,150"},${0.85 * vis + 0.12})`
        : `rgba(${base},${0.72 + 0.2 * vis})`;
      ctx.fill();
      ctx.lineWidth = action.id === "close" ? 2.4 : 1.6;
      ctx.strokeStyle = `rgba(${ink},${0.35 + 0.5 * vis})`;
      ctx.stroke();

      // Label: upright in screen space, never rotated with the geometry, and
      // dropped entirely once the seat is too small or too far to read.
      const w = Math.hypot(
        proj.boundary[0].x - proj.boundary[3].x,
        proj.boundary[0].y - proj.boundary[3].y
      );
      if (w > 34 && vis > 0.42) {
        const size = Math.max(9, Math.min(15, w * 0.2));
        ctx.font = `600 ${size.toFixed(1)}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = (0.4 + 0.6 * vis) * Math.min(1, progress * 1.6);
        ctx.fillStyle = on
          ? `rgba(${dark ? "6,14,18" : "250,253,255"},0.96)`
          : `rgba(${ink},${enabled ? 0.94 : 0.4})`;
        ctx.fillText(action.label(), proj.center.x, proj.center.y);
      }
      ctx.restore();
    }

    function pointIn(x, y, poly) {
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

    /**
     * Only seats on the near side answer a tap. A seat that has turned past
     * the core is visually behind the board and must not be clickable through
     * it — rotating it back to the front is the interaction.
     */
    function tap(x, y) {
      if (!open || progress < 0.6) return false;
      const hits = lastProjected
        .filter((p) => p.facing > 0.02 && pointIn(x, y, p.boundary))
        .sort((a, b) => b.facing - a.facing);
      if (!hits.length) return false;
      activate(hits[0].seat.action);
      return true;
    }

    function activate(action) {
      action.run();
      syncButtons();
      if (action.id !== "close" && action.id !== "size") seatGeometry();
    }

    /* ---- accessible mirror ------------------------------------------- */

    const panel = document.createElement("div");
    panel.className = "inner-menu-a11y";
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", "Sphere menu");
    panel.hidden = true;
    panel.style.cssText =
      "position:fixed;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;" +
      "clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0";

    const live = document.createElement("p");
    live.setAttribute("aria-live", "polite");
    live.className = "sr-only";
    live.style.cssText = panel.style.cssText;
    document.body.appendChild(live);
    function say(text) {
      live.textContent = text;
    }

    const buttons = ACTIONS.map((action) => {
      const b = document.createElement("button");
      b.type = "button";
      b.addEventListener("click", () => activate(action));
      panel.appendChild(b);
      return { action, el: b };
    });
    document.body.appendChild(panel);

    function syncButtons() {
      for (const { action, el } of buttons) {
        el.textContent = action.label();
        if (action.pressed) el.setAttribute("aria-pressed", action.pressed() ? "true" : "false");
        if (action.enabled) el.disabled = !action.enabled();
      }
    }

    /* ---- wiring ------------------------------------------------------ */

    game.setInnerMenu({ isOpen, project, paint, shellAlpha, tap, animating });

    // A tap on empty space with the menu open closes it, matching every other
    // dock. sphere.js only emits this once the menu declined the tap.
    const canvas = document.getElementById("gameCanvas");
    if (canvas) {
      canvas.addEventListener("hexsweeper:menu-background-tap", close);
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && open) {
        e.stopPropagation();
        close();
      }
    });

    return { show, close, toggle: () => (open ? close() : show()), isOpen };
  }

  global.initInnerMenu = initInnerMenu;
})(window);
