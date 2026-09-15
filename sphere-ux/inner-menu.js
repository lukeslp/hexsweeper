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
 *   So this menu is not DOM. Seven hexes live on a plane through the middle
 *   of the shell, as real geometry in sphere space. Each frame they are rotated
 *   and projected by the same camera the board uses and handed to sphere.js,
 *   which merges them into its one back-to-front sort. The sphere's own faces
 *   then pass in front of them as it turns, for free — no clipping, no
 *   z-index, no per-tile polygon subtraction. Turn the sphere far enough and a
 *   seat goes round the back and is gone.
 *
 *   The shell is NOT faded, dimmed or made translucent. That was the first cut
 *   and it was wrong for exactly the reason the DOM docks are wrong: it
 *   destroys the shell in order to show the menu. Here the shell stays fully
 *   opaque and simply *splits* — the menu drives setChromeShell("eggshell") as
 *   it blooms — so the seats are revealed through the cavity and the shell
 *   halves occlude whatever still sits behind them. The shell hides the menu,
 *   never the other way round.
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

  /* Geometry — hex-bloom's seven-hex flower, taken verbatim.
   *
   *      [NW]  [NE]
   *   [W] [centre] [E]
   *      [SW]  [SE]
   *
   * Pointy-top hexes (the same silhouette as --hex-clip in hex-bloom.css:
   * polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)), six of
   * them on one perfect ring at sqrt(3) x the circumradius, which is exactly
   * where regular hexes share a flat side.
   *
   * Crucially the cluster is FLAT — a plane through the sphere's centre, not
   * a patch of an inner sphere. The first cut curved each seat onto an inner
   * shell so every hex tilted to face outward, which is the "weird tilt".
   * A plane keeps all seven coplanar and square to the camera at open time,
   * so it reads as the same menu the other docks use; it still rotates with
   * the sphere, and the shell still occludes it. */
  const HEX_R = 0.2; // circumradius, sphere radius = 1
  const RING_R = HEX_R * Math.sqrt(3); // centre-to-centre of touching hexes
  const PLANE_Z = 0; // camera-space depth: the sphere's own centre
  const OPEN_MS = 420;
  const CLOSE_MS = 260;
  // How far the shell is allowed to split. Deliberately short of a full
  // eggshell open: the point is that the rims still overlap the flower, so the
  // shell visibly eats into the seats nearest it. Open it all the way and the
  // menu sits in clear air, which is the flat DOM dock again with extra steps.
  const SPLIT_MAX = 0.62;

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
  /**
   * A pointy-top hexagon of circumradius R centred at `c`, lying in the plane
   * spanned by u and v. Vertices start at +90 degrees so a point faces "up"
   * along v, matching hex-bloom's clip path.
   */
  function hexPlanar(c, u, v, R) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const t = Math.PI / 2 + (Math.PI / 3) * i;
      pts.push(add(c, add(scale(u, Math.cos(t) * R), scale(v, Math.sin(t) * R))));
    }
    return pts;
  }

  /*
   * hex-bloom's icon glyphs, copied verbatim from its ICONS table
   * (sphere-ux/hex-bloom.js:268) so this dock reads as the same menu.
   *
   * Copied, not imported: hex-bloom keeps ICONS private inside its IIFE and
   * exports only initHexBloom. The duplication is deliberate and the two are
   * cross-referenced — if you restyle a glyph there, restyle it here. This is
   * the price of the menu living in the canvas, which is the one place the
   * sphere can occlude it.
   *
   * 24x24 viewBox, and hex-bloom's wrapper supplies the defaults these rely
   * on: fill="none" stroke="currentColor" stroke-width="2.15", round caps and
   * joins. Per-element fill/stroke attributes override that.
   */
  const ICONS = {
    reset:
      '<path d="M3.5 12a8.5 8.5 0 0 1 14.3-6.2L20 8"/><path d="M20 3.5V8h-4.5"/>' +
      '<path d="M20.5 12a8.5 8.5 0 0 1-14.3 6.2L4 16"/><path d="M4 20.5V16h4.5"/>',
    undo: '<path d="M4 4v5h5"/><path d="M4.8 8.2A8.3 8.3 0 1 1 4 16"/>',
    flag: '<path d="M6 21.2V3.6"/><path d="M6 4.4h11.6l-2.9 4 2.9 4H6"/>',
    close: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
    size:
      '<path d="M12 3 4.5 7.5v9L12 21l7.5-4.5v-9L12 3Z"/>' +
      '<path d="M12 8 8.5 10v4L12 16l3.5-2v-4L12 8Z"/>',
    seamsOn:
      '<path d="m7.2 5.5 4.8 2.75v5.5L7.2 16.5l-4.8-2.75v-5.5L7.2 5.5Z"/>' +
      '<path d="m16.8 5.5 4.8 2.75v5.5l-4.8 2.75-4.8-2.75v-5.5l4.8-2.75Z"/>',
    seamsOff:
      '<path d="M7.2 5.5h9.6l4.8 2.75v5.5l-4.8 2.75H7.2l-4.8-2.75v-5.5L7.2 5.5Z"/>',
    dayNightLight:
      '<circle cx="12" cy="12" r="9" fill="#000" stroke="#000"/>' +
      '<path d="M12 3a9 9 0 0 1 0 18Z" fill="#fff" stroke="none"/>' +
      '<circle cx="12" cy="12" r="4.7" fill="#000" stroke="none"/>' +
      '<path d="M12 7.3a4.7 4.7 0 0 0 0 9.4Z" fill="#fff" stroke="none"/>' +
      '<circle cx="12" cy="12" r="9" fill="none" stroke="#000"/>',
    dayNightDark:
      '<circle cx="12" cy="12" r="9" fill="#fff" stroke="#000"/>' +
      '<path d="M12 3a9 9 0 0 0 0 18Z" fill="#000" stroke="none"/>' +
      '<circle cx="12" cy="12" r="4.7" fill="#fff" stroke="none"/>' +
      '<path d="M12 7.3a4.7 4.7 0 0 1 0 9.4Z" fill="#000" stroke="none"/>' +
      '<circle cx="12" cy="12" r="9" fill="none" stroke="#000"/>',
  };

  // hex-bloom.css:518-528 — the two glyphs that carry colour.
  const ICON_RESET = "#ffd400";
  const ICON_UNDO = "#18a64a";
  const ICON_FLAG_ON = "#ff2200";

  /**
   * Compile one SVG fragment into Path2D ops. Only the three element kinds the
   * table actually uses are handled; anything else would silently vanish, so
   * keep this in step if a copied glyph gains a new primitive.
   */
  const iconCache = new Map();
  function iconOps(name) {
    if (iconCache.has(name)) return iconCache.get(name);
    const markup = ICONS[name] || "";
    const ops = [];
    const re = /<(path|circle|line)\b([^>]*)>/g;
    let m;
    while ((m = re.exec(markup))) {
      const kind = m[1];
      const attrs = m[2];
      const at = (k) => {
        const g = attrs.match(new RegExp(k + '="([^"]*)"'));
        return g ? g[1] : null;
      };
      const num = (k) => Number(at(k)) || 0;
      let path;
      if (kind === "path") {
        path = new Path2D(at("d") || "");
      } else if (kind === "circle") {
        path = new Path2D();
        path.arc(num("cx"), num("cy"), num("r"), 0, Math.PI * 2);
      } else {
        path = new Path2D();
        path.moveTo(num("x1"), num("y1"));
        path.lineTo(num("x2"), num("y2"));
      }
      ops.push({ path, fill: at("fill"), stroke: at("stroke") });
    }
    iconCache.set(name, ops);
    return ops;
  }

  /** Paint a compiled glyph centred at (cx, cy), `size` px across. */
  function drawIcon(ctx, name, cx, cy, size, ink) {
    const ops = iconOps(name);
    if (!ops.length) return;
    ctx.save();
    ctx.translate(cx, cy);
    // The viewBox is 24 wide and its origin is the top-left, so scale then
    // shift by half. Scaling also scales stroke-width, exactly as SVG does.
    ctx.scale(size / 24, size / 24);
    ctx.translate(-12, -12);
    ctx.lineWidth = 2.15;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const op of ops) {
      const fill = op.fill == null ? "none" : op.fill;
      const stroke = op.stroke == null ? "currentColor" : op.stroke;
      if (fill !== "none") {
        ctx.fillStyle = fill === "currentColor" ? ink : fill;
        ctx.fill(op.path);
      }
      if (stroke !== "none") {
        ctx.strokeStyle = stroke === "currentColor" ? ink : stroke;
        ctx.stroke(op.path);
      }
    }
    ctx.restore();
  }

  const SIZES = ["xsmall", "easy", "medium", "hard", "xlarge"];

  function initInnerMenu(game) {
    if (!game || typeof game.setInnerMenu !== "function") return null;

    const reduceMotion =
      global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let open = false;
    let progress = 0; // 0 closed, 1 fully bloomed
    let lastT = 0; // paint-clock stamp, for the bloom tween
    let seats = [];
    let lastProjected = [];

    /* ---- seats ------------------------------------------------------ */

    const ACTIONS = [
    /*
     * Seat order follows hex-bloom's own map, so muscle memory carries over:
     *
     *        [Theme] [Size]            NW  NE
     *   [Undo] [Restart] [Flag]      W  centre  E
     *        [Seams] [Close]           SW  SE
     *
     * Listed centre-first, then the ring anticlockwise from due east, which is
     * the order seatGeometry() builds.
     */
      {
        id: "restart",
        label: () => "Restart",
        run: () => {
          game.reset();
          say("Board restarted.");
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
        id: "seams",
        label: () => (game.getAppearance().seams ? "Seams ON" : "Seams"),
        pressed: () => !!game.getAppearance().seams,
        run: () => {
          const next = !game.getAppearance().seams;
          game.setSeams(next);
          say(next ? "Seams on." : "Seams off.");
        },
      },
      {
        id: "close",
        label: () => "Close",
        run: () => close(),
      },
    ];

    /**
     * Lay the seven seats out in CAMERA space, on the plane through the
     * sphere's centre.
     *
     * Camera space, not sphere space, is the whole point of this revision.
     * Seats fixed to the mesh turned away with it, so the menu foreshortened
     * to slivers and eventually vanished round the back — unreadable exactly
     * when you were moving the camera to look at it. Chamber's menu is DOM and
     * therefore always square-on; this matches that. The seats keep facing the
     * viewer while the shell turns behind them, and because they are still
     * geometry at a real depth they still sort against that shell, so it still
     * occludes them.
     *
     * Seat order is hex-bloom's: centre first, then the ring anticlockwise
     * from due east, so the same action lands in the same place it does on
     * every other dock.
     */
    const CAM_U = { x: 1, y: 0, z: 0 };
    const CAM_V = { x: 0, y: 1, z: 0 };
    function seatGeometry() {
      const centers = [{ x: 0, y: 0, z: PLANE_Z }];
      for (let i = 0; i < 6; i++) {
        const t = (Math.PI / 3) * i;
        centers.push({
          x: Math.cos(t) * RING_R,
          y: Math.sin(t) * RING_R,
          z: PLANE_Z,
        });
      }
      seats = centers.map((c, i) => ({
        action: ACTIONS[i],
        center: c,
        hex: hexPlanar(c, CAM_U, CAM_V, HEX_R),
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
      splitShell();
      if (!open && progress === 0) finishClose();
    }

    /**
     * Open the shell itself rather than fading it. setChromeShell partitions
     * the live mesh into two rigid halves about the current view and moves
     * them apart — the eggshell study's geometry, reused here as the aperture
     * the menu is seen through.
     */
    function splitShell() {
      if (!game.setChromeShell) return;
      const p = ease(Math.max(0, Math.min(1, progress)));
      game.setChromeShell("eggshell", p * SPLIT_MAX);
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
      seatGeometry();
      open = true;
      progress = reduceMotion || instant ? 1 : 0;
      game.setMenuInteraction(true);
      game.pauseTimer();
      panel.hidden = false;
      syncButtons();
      syncOpener();
      lastT = 0;
      splitShell();
      if (game.scheduleFrame) game.scheduleFrame();
      say("Menu open inside the sphere. The shell has split to show it.");
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

    function syncOpener() {
      const btn = opener();
      if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function finishClose() {
      lastProjected = [];
      syncOpener();
      if (game.setChromeShell) game.setChromeShell(null, 0);
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
        const boundary = seat.hex.map((pt) => game.projectCameraPoint(scale(pt, grow)));
        const center = game.projectCameraPoint(scale(seat.center, grow));
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

    /**
     * Glyph and tint per seat, mirroring hex-bloom's icon menu. Note that the
     * plate itself never changes: hex-bloom.css:515 is explicit that "state
     * lives in the glyphs only", so Flag going red and Seams changing shape is
     * the whole of the state readout.
     */
    function seatGlyph(action) {
      const t = game.getState().theme || {};
      const dark = t.chrome !== "light";
      switch (action.id) {
        case "restart":
          return { name: "reset", tint: ICON_RESET };
        case "undo":
          return { name: "undo", tint: ICON_UNDO };
        case "flag":
          return { name: "flag", tint: action.pressed() ? ICON_FLAG_ON : null };
        case "size":
          return { name: "size", tint: null };
        case "theme":
          return { name: dark ? "dayNightDark" : "dayNightLight", tint: null };
        case "seams":
          return { name: action.pressed() ? "seamsOn" : "seamsOff", tint: null };
        default:
          return { name: "close", tint: null };
      }
    }

    function paint(ctx, proj, now) {
      const seat = proj.seat;
      const action = seat.action;
      // Solid, not translucent. The seats used to dim by facing, which made
      // sense when they were curved onto an inner sphere and each one turned
      // away independently — on a flat coplanar cluster it just washed the
      // whole menu out to ~70%, which is the "obscured" complaint again from
      // the other side. Depth now comes from two honest places: the shell
      // occluding the seats, and the plane foreshortening as it turns.
      const vis = 1;
      const st = game.getState();
      const dark = !(st.theme && st.theme.chrome === "light");
      const enabled = !action.enabled || action.enabled();

      ctx.save();
      // Bloom fade only — nothing else touches seat opacity.
      ctx.globalAlpha = Math.min(1, progress * 1.6);
      ctx.beginPath();
      proj.boundary.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
      ctx.closePath();

      const base = dark ? "12,16,22" : "252,253,255";
      const ink = dark ? "236,244,255" : "17,21,28";
      ctx.fillStyle = `rgba(${base},${0.72 + 0.2 * vis})`;
      ctx.fill();
      ctx.lineWidth = action.id === "close" ? 2.4 : 1.6;
      ctx.strokeStyle = `rgba(${ink},${0.35 + 0.5 * vis})`;
      ctx.stroke();

      // Glyph, upright in screen space — never rotated with the geometry, and
      // dropped once the seat is too small for it to mean anything. hex-bloom
      // sizes its primary icon near 0.34 of the tile height; across * 0.42 of
      // the point-to-point width lands in the same place.
      const across = Math.hypot(
        proj.boundary[0].x - proj.boundary[3].x,
        proj.boundary[0].y - proj.boundary[3].y
      );
      if (across > 18) {
        const glyph = seatGlyph(action);
        drawIcon(
          ctx,
          glyph.name,
          proj.center.x,
          proj.center.y,
          across * 0.42,
          glyph.tint || (enabled ? `rgb(${ink})` : `rgba(${ink},0.4)`)
        );
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
      // No facing gate any more: the cluster is billboarded, so it is always
      // square to the viewer and always hittable. (The old per-seat z > 0.02
      // test rejected all seven once the seats became coplanar at z = 0, which
      // made every click read as a background tap and close the menu.)
      const hits = lastProjected
        .filter((p) => pointIn(x, y, p.boundary))
        // Nearest wins if the projection ever overlaps two seats.
        .sort((a, b) => b.center.depth - a.center.depth);
      if (!hits.length) return false;
      activate(hits[0].seat.action);
      return true;
    }

    function activate(action) {
      action.run();
      syncButtons();
      // Re-apply the split after every action, not just some.
      //
      // Size (and anything else that rebuilds the board) replaces state.tiles,
      // which invalidates the shell's two-group partition. setChromeShell
      // rebuilds that partition when the tile count changes — but only when it
      // is called, and advance() is a no-op once the bloom has settled, so
      // nothing was calling it. The stale array then read `undefined || 1` for
      // every new tile, dropping the whole mesh into one half: the sphere
      // moved as a single lump and the dock looked broken.
      splitShell();
      if (game.scheduleFrame) game.scheduleFrame();
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

    game.setInnerMenu({ isOpen, project, paint, tap, animating });

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

    /*
     * Tapping off the sphere opens the menu, exactly as chamber does — the
     * same guard hex-bloom uses at hex-bloom.js:2845, so the two docks answer
     * the same gesture and can be toggled between without relearning anything:
     * a quick, stationary pointerup outside the sphere's own disk.
     *
     * Capture phase, and real controls are excluded, so the opener pill and
     * the HUD keep their own handlers instead of being swallowed here.
     */
    let downAt = 0;
    let downX = 0;
    let downY = 0;
    document.addEventListener(
      "pointerdown",
      (e) => {
        downAt = Date.now();
        downX = e.clientX;
        downY = e.clientY;
      },
      true
    );
    document.addEventListener(
      "pointerup",
      (e) => {
        if (open) return;
        if (Date.now() - downAt > 350) return;
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) return;
        if (
          e.target &&
          e.target.closest &&
          e.target.closest("button, a, input, select, [role='button']")
        ) {
          return;
        }
        const disc = game.getSphereScreen ? game.getSphereScreen() : null;
        if (disc && Math.hypot(e.clientX - disc.cx, e.clientY - disc.cy) <= disc.r) {
          return;
        }
        show();
      },
      true
    );

    return { show, close, toggle: () => (open ? close() : show()), isOpen };
  }

  global.initInnerMenu = initInnerMenu;
})(window);
