/*
 * site-move.js: carries a player's Hexsweeper saves from dr.eamer.dev to
 * lukesteuber.com.
 *
 * Browsers keep localStorage per origin, so the one folder served on both
 * hosts holds two separate sets of saves. Every served page loads this file
 * first in <head>, before any game script, and it acts on the host name alone:
 *
 *   dr.eamer.dev     Packs the game's own keys into the URL fragment (never the
 *                    query, so nothing reaches a server or the Referer) and
 *                    replaces the page with the same path and query on
 *                    lukesteuber.com. ?stay=1 skips the move, for debugging.
 *   lukesteuber.com  Imports a hand-off fragment, then strips it. Never
 *                    redirects, so no loop is possible.
 *   anywhere else    Does nothing: the apps, file://, localhost.
 *
 * Trust: anyone can write a link with a hand-off fragment, so lukesteuber.com
 * imports one only when the page was reached from dr.eamer.dev, which the
 * browser reports as document.referrer "https://dr.eamer.dev/" (the default
 * strict-origin-when-cross-origin policy; Hexsweeper's pages set no other).
 * Without it the fragment is stripped and nothing else happens. A hand-off is
 * also rejected whole if any part fails its schema: only the keys in FAMILIES,
 * each value in its exact shape, board cells inside the board, and records
 * inside plausible bounds (a best time of 1 second to under a day).
 *
 * Merge rules: records keep the better value (Sphere best times keep the lower
 * seconds per size; the endless best keeps the higher count). Settings and
 * unfinished boards only fill keys lukesteuber.com does not have. A hand-off
 * imports once: its id is remembered, and once one hand-off has landed, a
 * later one (an old link opened again) brings records only, so a finished or
 * cleared board cannot come back.
 *
 * Size: the packed fragment stays under BUDGET characters. Records and
 * settings always fit; unfinished boards go in FAMILIES order while they fit,
 * and the rest are listed as dropped (they stay on dr.eamer.dev, reachable
 * with ?stay=1). The README's "Moving from dr.eamer.dev" section has the list.
 */
(function (global) {
  "use strict";

  var OLD_HOST = "dr.eamer.dev";
  var NEW_HOST = "lukesteuber.com";
  var NEW_ORIGIN = "https://lukesteuber.com";
  var PATH = "/games/hexsweeper";
  var PARAM = "hexsweeper-move=";
  var BUDGET = 16000; // characters of packed payload; URLs stay far below 32 KB
  var DONE_KEY = "hexsweeper-move-v1"; // on lukesteuber.com: hand-offs already imported
  var OLD_REFERRER = "https://dr.eamer.dev/";
  var SIZES = ["xsmall", "easy", "medium", "hard", "xlarge"];
  var DAY = 86400;

  // ---- shapes ------------------------------------------------------------
  // Each check takes the stored string (or a parsed value) and says whether
  // it is exactly what the game writes. Ids that come from long theme lists
  // are format-checked; the games ignore an id they do not know.

  function isObj(d) {
    return !!d && typeof d === "object" && !Array.isArray(d);
  }
  function parse(v) {
    try {
      return JSON.parse(v);
    } catch (_) {
      return undefined;
    }
  }
  function own(d, k) {
    return Object.prototype.hasOwnProperty.call(d, k);
  }
  function token(v) {
    return typeof v === "string" && /^[a-z0-9][a-z0-9-]{0,39}$/.test(v);
  }
  function oneOf(list) {
    return function (v) {
      return typeof v !== "object" && list.indexOf(v) >= 0;
    };
  }
  function int(lo, hi) {
    return function (v) {
      return typeof v === "number" && v % 1 === 0 && v >= lo && v <= hi;
    };
  }
  function num(lo, hi) {
    return function (v) {
      return typeof v === "number" && isFinite(v) && v >= lo && v <= hi;
    };
  }
  function bool(v) {
    return typeof v === "boolean";
  }
  function maybe(check) {
    return function (v) {
      return v === null || check(v);
    };
  }
  /** An object with only the keys in spec, each passing its check; `need` lists required keys. */
  function exact(d, spec, need) {
    if (!isObj(d)) return false;
    for (var k in d) if (!own(d, k) || !own(spec, k) || !spec[k](d[k], d)) return false;
    for (var i = 0; i < need.length; i++) if (!own(d, need[i])) return false;
    return true;
  }
  function json(check) {
    return function (v) {
      return typeof v === "string" && v.length <= 400000 && check(parse(v));
    };
  }
  function str(check) {
    return function (v) {
      return typeof v === "string" && check(v);
    };
  }
  var flag = oneOf(["0", "1"]);
  var effects = oneOf(["auto", "full", "reduced"]);
  var size = oneOf(SIZES);
  var countStyle = oneOf(["numerals", "rings", "yellow", "flush", "borderless"]);
  var lightDark = oneOf(["light", "dark"]);
  var savedAt = num(0, 4102444800000); // before 2100
  function zoom(v) {
    return typeof v === "string" && /^\d(\.\d{1,6})?$/.test(v) && +v >= 0.1 && +v <= 5;
  }
  var invert = json(function (d) {
    return exact(d, { x: bool, y: bool }, ["x", "y"]);
  });

  // Access settings, as tools/control-frame writes them.
  var ACCESS = {
    mode: oneOf(["off", "switch", "look"]),
    speed: oneOf(["normal", "slow", "fast"]),
    scan: oneOf(["groups", "keys"]),
    press: oneOf([0, 200, 500, 1000]),
    release: oneOf([300, 600, 1000, 1500]),
    long: oneOf([0, 1000, 1500, 2000]),
    rest: oneOf([0, 2, 4, 8]),
    highlight: oneOf(["invert", "outline"]),
    brake: oneOf(["off", "on"]),
    look: oneOf(["head", "eyes", "pointer", "tracker"]),
    hold: oneOf([800, 600, 1000, 1400]),
  };
  var access = json(function (d) {
    return exact(d, ACCESS, []);
  });
  var dodecaSettings = json(function (d) {
    return exact(d, {
      countStyle: countStyle,
      relief: oneOf(["extruded", "flush"]),
      seams: bool,
      appearanceAxes: function (a) {
        return exact(a, { field: lightDark, shell: lightDark, well: lightDark }, []);
      },
      invertDragX: bool,
      invertDragY: bool,
      effectsMode: effects,
    }, []);
  });

  // Records: known sizes only, a best time from 1 second to under a day.
  var bestTimes = json(function (d) {
    var spec = {}, any = false;
    SIZES.forEach(function (id) {
      spec[id] = function (e) {
        return exact(e, { seconds: int(1, DAY - 1), at: maybe(str(function (t) {
          return /^[0-9T:.+Z-]{10,40}$/.test(t);
        })) }, ["seconds"]);
      };
    });
    if (!exact(d, spec, [])) return false;
    for (var k in d) any = true;
    return any;
  });
  // Cells cleared on the endless plate: at most every cell of a full plate.
  var endlessBest = str(function (v) {
    return /^[1-9]\d{0,5}$/.test(v) && +v <= 100000;
  });

  // ---- boards --------------------------------------------------------------

  /** Face indices on a sphere of n faces: whole numbers below n, each once, ascending. */
  function faces(n) {
    return function (a) {
      if (!Array.isArray(a) || a.length > n) return false;
      for (var i = 0; i < a.length; i++) {
        var x = a[i];
        if (typeof x !== "number" || x % 1 !== 0 || x < 0 || x >= n || (i && x <= a[i - 1])) return false;
      }
      return true;
    };
  }
  /** Hex cell keys "q,r" within radius r of the center, each once. */
  function cells(radius) {
    return function (a) {
      if (!Array.isArray(a) || a.length > 3 * radius * (radius + 1) + 1) return false;
      var seen = {};
      for (var i = 0; i < a.length; i++) {
        if (!cell(radius)(a[i]) || seen[a[i]]) return false;
        seen[a[i]] = 1;
      }
      return true;
    };
  }
  function cell(radius) {
    return function (v) {
      var m = typeof v === "string" && /^(0|-?[1-9]\d{0,2}),(0|-?[1-9]\d{0,2})$/.exec(v);
      if (!m) return false;
      var q = +m[1], r = +m[2];
      return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= radius;
    };
  }

  // Faces per size: the canonical engine (Sphere, the reflection studio;
  // sphere-ux shares Sphere's key with fewer faces) and the Water Wheel.
  var SPHERE_FACES = { xsmall: 162, easy: 362, medium: 1002, hard: 1442, xlarge: 2252 };
  var WHEEL_FACES = { xsmall: 162, easy: 362, medium: 642, hard: 1002, xlarge: 1442 };
  function sphereRun(table, versions, wheel) {
    return json(function (d) {
      if (!isObj(d) || !size(d.difficulty)) return false;
      var n = table[d.difficulty];
      if (own(d, "tileCount")) {
        if (!int(1, n)(d.tileCount)) return false;
        n = d.tileCount;
      }
      var spec = {
        v: oneOf(versions),
        kind: oneOf(["sphere"]),
        difficulty: size,
        tileCount: int(1, table[d.difficulty]),
        first: bool,
        over: bool,
        won: bool,
        flags: int(0, n),
        mineCount: int(0, n),
        time: int(0, 1e7),
        rotY: num(-1e6, 1e6),
        rotX: num(-1e6, 1e6),
        // Roll about the line of sight (trackball drag, 2026-11-21); optional.
        rotZ: num(-1e6, 1e6),
        zoom: num(0, 100),
        mines: faces(n),
        revealed: faces(n),
        flagged: faces(n),
        savedAt: savedAt,
      };
      if (wheel) {
        spec.doused = faces(n);
        spec.rescues = int(0, n);
        spec.armed = maybe(function (a) {
          return exact(a, { idx: int(0, n - 1), duration: int(0, 1e7), remaining: int(0, 1e7) }, ["idx", "duration", "remaining"]);
        });
      }
      return exact(d, spec, ["v", "kind", "difficulty", "mines", "revealed", "flagged"]);
    });
  }
  var RIFT_PHASES = ["idle", "awaken", "chase", "catch", "grace"];
  var CLASSIC_RADIUS = { easy: 4, medium: 7, hard: 10 };
  var ENDLESS_RADIUS = 160; // core.js ENDLESS_MAX_RADIUS
  /** A flat board as core.js exports it: Classic (kind "classic") or an endless plate. */
  function flatRun(endless) {
    return json(function (d) {
      if (!isObj(d)) return false;
      var radius;
      if (endless) {
        if (!int(1, ENDLESS_RADIUS)(d.radius)) return false;
        radius = d.radius;
      } else {
        if (!own(CLASSIC_RADIUS, d.difficulty)) return false;
        radius = CLASSIC_RADIUS[d.difficulty];
      }
      var key = cell(radius), keys = cells(radius), big = 3 * radius * (radius + 1) + 1;
      var spec = {
        v: oneOf([1]),
        endless: oneOf([endless]),
        difficulty: endless ? token : oneOf(["easy", "medium", "hard"]),
        density: maybe(num(0, 1)),
        radius: int(0, endless ? ENDLESS_RADIUS : radius),
        first: bool,
        over: bool,
        win: maybe(bool),
        endReason: maybe(token),
        finish: maybe(key),
        cleared: int(0, big),
        flags: int(0, big),
        mineCount: int(0, big),
        time: int(0, 1e7),
        cam: function (c) {
          return Array.isArray(c) && c.length === 2 && num(-1e7, 1e7)(c[0]) && num(-1e7, 1e7)(c[1]);
        },
        zoom: num(0, 100),
        mines: keys,
        revealed: keys,
        flagged: keys,
        torn: keys,
        savedAt: savedAt,
      };
      if (endless) {
        spec.mode = token;
        spec.rift = maybe(function (b) {
          return exact(b, {
            phase: oneOf(RIFT_PHASES),
            digClicks: int(0, 1e7),
            exposed: int(0, 1e7),
            q: int(-radius, radius),
            r: int(-radius, radius),
            fq: num(-radius - 1, radius + 1),
            fr: num(-radius - 1, radius + 1),
            firstKey: maybe(key),
            lastDigKey: maybe(key),
            torn: keys,
            intensity: num(0, 1e3),
            radius: num(0, 1e3),
            t0: num(0, 1e13),
          }, ["phase"]);
        });
      } else {
        spec.kind = oneOf(["classic"]);
      }
      return exact(d, spec, endless ? ["v", "endless", "radius", "mines", "revealed", "flagged"] : ["v", "kind", "endless", "difficulty", "mines", "revealed", "flagged"]);
    });
  }

  // ---- merges for records -------------------------------------------------
  // Each returns the value to write, or null to leave lukesteuber.com alone.

  function mergeBest(current, incoming) {
    var have = parse(current);
    if (!isObj(have)) have = {};
    var add = parse(incoming), changed = false;
    SIZES.forEach(function (id) {
      if (!own(add, id)) return;
      var next = add[id], old = own(have, id) ? have[id] : null;
      if (isObj(old) && typeof old.seconds === "number" && old.seconds >= 0 && old.seconds <= next.seconds) return;
      have[id] = { seconds: next.seconds, at: typeof next.at === "string" ? next.at : null };
      changed = true;
    });
    return changed ? JSON.stringify(have) : null;
  }
  function mergeMax(current, incoming) {
    return /^\d{1,9}$/.test(current || "") && +current >= +incoming ? null : incoming;
  }

  // ---- the game's own keys ------------------------------------------------
  // One family per thing the game remembers: its current key first, then the
  // older keys it still reads. Records first, settings next, boards last in
  // the order they are kept when a hand-off would be too large.

  var R = "record", S = "setting", B = "board";
  function fam(type, keys, ok, extra) {
    var f = { type: type, keys: keys, ok: ok, session: false, merge: null };
    for (var k in extra || {}) f[k] = extra[k];
    return f;
  }
  var FAMILIES = [
    fam(R, ["hexsweeper-sphere-best-v1"], bestTimes, { merge: mergeBest }),
    fam(R, ["hexsweeper-endless-best"], endlessBest, { merge: mergeMax }),

    // Shared by every board
    fam(S, ["hexsweeper-effects-v1"], effects),
    fam(S, ["hexsweeper-zoom-v1"], zoom),
    // Sphere (root page, sphere/, sphere-ux/)
    fam(S, ["hexsweeper-sphere-theme-v6", "hexsweeper-sphere-theme-v5", "hexsweeper-sphere-theme-v4", "hexsweeper-sphere-theme-v3"], token),
    fam(S, ["hexsweeper-sphere-size-v2", "hexsweeper-sphere-size-v1"], size),
    fam(S, ["hexsweeper-sphere-countstyle-v1"], countStyle),
    fam(S, ["hexsweeper-sphere-nest-v1"], flag),
    fam(S, ["hexsweeper-sphere-invert-v6"], invert),
    fam(S, ["hexsweeper-sphere-sheet-tab-v1"], oneOf(["play", "themes", "board", "settings", "keys"])),
    fam(S, ["hexsweeper-sphere-welcome-v1"], flag),
    fam(S, ["hexsweeper-sphere-effects-v1"], effects),
    fam(S, ["hexsweeper-sphere-invert-v1"], invert),
    // Infinite, play.html themes, Classic, the Games page
    fam(S, ["hexsweeper-infinite-theme-v1"], lightDark),
    fam(S, ["hexsweeper-infinite-sheet-tab-v1"], oneOf(["play", "look", "settings"])),
    fam(S, ["hexsweeper-mode-v3"], token),
    fam(S, ["hexsweeper-minimalist-tone-v1"], lightDark),
    fam(S, ["hexsweeper-welcome-v1"], flag),
    fam(S, ["hexsweeper-classic-size-v1"], oneOf(["easy", "medium", "hard"])),
    fam(S, ["hexsweeper-appearance-v1"], oneOf(["system", "light", "dark"])),
    fam(S, ["minimal-access.v1:hex-infinite"], access),
    fam(S, ["minimal-access.v1:hex-classic"], access),
    // Water Wheel
    fam(S, ["hexwheel-theme-v6", "hexwheel-theme-v5", "hexwheel-theme-v4", "hexwheel-theme-v3"], token),
    fam(S, ["hexwheel-size-v2", "hexwheel-size-v1"], size),
    fam(S, ["hexwheel-countstyle-v1"], countStyle),
    fam(S, ["hexwheel-nest-v1"], flag),
    fam(S, ["hexwheel-invert-v6"], invert),
    fam(S, ["hexwheel-tutorial-v1"], flag),
    // Reflection studio
    fam(S, ["hexsweeper-reflection-theme-v1"], token),
    fam(S, ["hexsweeper-reflection-size-v1"], size),
    fam(S, ["hexsweeper-reflection-countstyle-v1"], countStyle),
    fam(S, ["hexsweeper-reflection-nest-v1"], flag),
    fam(S, ["hexsweeper-reflection-invert-v1"], invert),
    fam(S, ["hexsweeper-reflection-material-v1"], oneOf(["stormglass", "mercury", "aurora", "atrium", "oculus", "galaxy", "ion-storm", "amber-tempest", "heat-lightning", "stratosphere", "chromatic-ink"])),
    fam(S, ["hexsweeper-reflection-welcome-v1"], flag),
    // Collection experiments
    fam(S, ["hexsweeper-dodeca-size-v1"], oneOf(["pocket", "standard", "deep"])),
    fam(S, ["hexsweeper-dodeca-settings-v1"], dodecaSettings),
    fam(S, ["hexsweeper-dodeca-welcome-v1"], flag),
    fam(S, ["hexsweeper-glitch-welcome-v1"], flag),
    fam(S, ["hexsweeper-flux-welcome-v3"], flag),
    fam(S, ["catch-monkey-garden-welcome-v1"], flag),
    fam(S, ["catch-monkey-orbit-welcome-v1"], flag),

    // Unfinished boards, most valuable first. Glitch, Flux and the
    // Dodecahedron campaign keep their boards on dr.eamer.dev: their saves
    // carry engine state that cannot be checked here.
    fam(B, ["hexsweeper-sphere-run-v2", "hexsweeper-sphere-run-v1"], sphereRun(SPHERE_FACES, [1, 2]), { session: true }),
    fam(B, ["hexsweeper-endless-plate-v1"], flatRun(true)),
    fam(B, ["hexsweeper-classic-run-v1"], flatRun(false)),
    fam(B, ["hexwheel-run-v3", "hexwheel-run-v2", "hexwheel-run-v1"], sphereRun(WHEEL_FACES, [1, 2, 3], true), { session: true }),
    fam(B, ["hexsweeper-endless-escape-v1"], flatRun(true)),
    fam(B, ["hexsweeper-reflection-run-v1", "hexsweeper-reflection-run-v0"], sphereRun(SPHERE_FACES, [1, 2]), { session: true }),
  ];
  var BY_KEY = {};
  FAMILIES.forEach(function (f) {
    f.keys.forEach(function (key) {
      BY_KEY[key] = f;
    });
  });

  // ---- storage (blocked storage throws on access; treat it as empty) ------

  function read(store, key) {
    try {
      return global[store].getItem(key);
    } catch (_) {
      return null;
    }
  }
  function write(key, value) {
    try {
      global.localStorage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }
  function stores(f) {
    return f.session ? ["sessionStorage", "localStorage"] : ["localStorage"];
  }
  function present(f) {
    return f.keys.some(function (key) {
      return stores(f).some(function (store) {
        return read(store, key) !== null;
      });
    });
  }

  // ---- packing: LZW over UTF-8, written six bits to a URL-safe character --

  var ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  var END = 256, FIRST = 257, MAX_CODES = 65536, MAX_OUT = 4000000;
  function widthFor(k) {
    var top = Math.min(FIRST + k, MAX_CODES) - 1, w = 9;
    while (1 << w <= top) w++;
    return w;
  }
  function encode(text) {
    var bytes = new TextEncoder().encode(text);
    var out = [], acc = 0, bits = 0, k = 0;
    function emit(code) {
      for (var i = 0, w = widthFor(k++); i < w; i++) {
        acc |= ((code >> i) & 1) << bits;
        if (++bits === 6) {
          out.push(ALPHA.charAt(acc));
          acc = bits = 0;
        }
      }
    }
    var dict = new Map(), next = FIRST, w = -1;
    for (var i = 0; i < bytes.length; i++) {
      var c = bytes[i];
      if (w < 0) {
        w = c;
        continue;
      }
      var hit = dict.get(w * 256 + c);
      if (hit !== undefined) {
        w = hit;
        continue;
      }
      emit(w);
      if (next < MAX_CODES) dict.set(w * 256 + c, next++);
      w = c;
    }
    if (w >= 0) emit(w);
    emit(END);
    if (bits) out.push(ALPHA.charAt(acc));
    return out.join("");
  }
  function decode(s) {
    var pos = 0, acc = 0, bits = 0, k = 0;
    function readCode() {
      for (var i = 0, w = widthFor(k++), code = 0; i < w; i++) {
        if (!bits) {
          if (pos >= s.length) throw new Error("site-move: cut short");
          acc = ALPHA.indexOf(s.charAt(pos++));
          if (acc < 0) throw new Error("site-move: bad character");
          bits = 6;
        }
        code |= (acc & 1) << i;
        acc >>= 1;
        bits--;
      }
      return code;
    }
    var dict = [], next = FIRST, prev = null, parts = [], size = 0;
    for (var i = 0; i < 256; i++) dict[i] = String.fromCharCode(i);
    for (;;) {
      var code = readCode(), entry;
      if (code === END) break;
      if (code < 256 || (code >= FIRST && code < next)) entry = dict[code];
      else if (code === next && prev !== null) entry = prev + prev.charAt(0);
      else throw new Error("site-move: bad code");
      if ((size += entry.length) > MAX_OUT) throw new Error("site-move: too large");
      parts.push(entry);
      if (prev !== null && next < MAX_CODES) dict[next++] = prev + entry.charAt(0);
      prev = entry;
    }
    var bin = parts.join(""), bytes = new Uint8Array(bin.length);
    for (var j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  // ---- dr.eamer.dev: gather and pack --------------------------------------

  function stampOf(v) {
    var d = parse(v);
    return isObj(d) && typeof d.savedAt === "number" && isFinite(d.savedAt) ? d.savedAt : 0;
  }
  /** The game's own keys on this origin, one value per family, in FAMILIES order. */
  function gather() {
    var items = [];
    FAMILIES.forEach(function (f) {
      var pick = null, at = -1;
      f.keys.forEach(function (key) {
        stores(f).forEach(function (store) {
          var v = read(store, key);
          if (v === null || !f.ok(v)) return;
          if (f.type !== B) {
            if (!pick) pick = { key: key, value: v };
            return;
          }
          // Boards: the newest save across keys and stores, as the games pick.
          var t = stampOf(v);
          if (t > at) {
            at = t;
            pick = { key: key, value: v };
          }
        });
      });
      if (pick) items.push({ key: pick.key, value: pick.value, type: f.type });
    });
    return items;
  }
  function newId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
  /** Pack items in order, dropping any that would push the payload past BUDGET. */
  function pack(items, hash, id) {
    var payload = { v: 1, id: id || newId(), d: {}, x: [] };
    if (hash && hash !== "#" && hash.length <= 2000) payload.h = hash;
    var text = encode(JSON.stringify(payload));
    items.forEach(function (item) {
      // A board far larger than the budget cannot fit; skip packing it at all.
      if (item.value.length > BUDGET * 40) {
        payload.x.push(item.key);
        return;
      }
      payload.d[item.key] = item.value;
      var next = encode(JSON.stringify(payload));
      if (next.length <= BUDGET) {
        text = next;
        return;
      }
      delete payload.d[item.key];
      payload.x.push(item.key);
    });
    if (payload.x.length) text = encode(JSON.stringify(payload));
    return { text: text, payload: payload };
  }

  // ---- lukesteuber.com: unpack and merge ----------------------------------

  /** Decode a hand-off and check every part; any mismatch rejects it whole. */
  function unpack(text) {
    if (text.length > BUDGET * 2) return null;
    var d = parse(decode(text)), n = 0;
    var ok = exact(d, {
      v: oneOf([1]),
      id: str(function (t) {
        return /^[a-z0-9]{1,12}-[a-z0-9]{1,12}$/.test(t);
      }),
      d: isObj,
      x: function (x) {
        return Array.isArray(x) && x.length <= FAMILIES.length && x.every(function (k) {
          return typeof k === "string" && own(BY_KEY, k);
        });
      },
      // The page's own fragment, put back after the import: never another
      // hand-off, which a reload (same referrer) would otherwise import.
      h: str(function (h) {
        return h.charAt(0) === "#" && h.length <= 2000 && h.indexOf(PARAM.slice(0, -1)) < 0;
      }),
    }, ["v", "id", "d", "x"]);
    if (!ok) return null;
    var families = [];
    for (var key in d.d) {
      if (!own(d.d, key)) continue;
      var f = own(BY_KEY, key) ? BY_KEY[key] : null;
      // One key per family, the game's own, in the shape the game writes.
      if (!f || families.indexOf(f) >= 0 || typeof d.d[key] !== "string" || !f.ok(d.d[key])) return null;
      families.push(f);
      n++;
    }
    return n ? d : null;
  }
  function readDone() {
    var d = parse(read("localStorage", DONE_KEY));
    if (!isObj(d) || !Array.isArray(d.ids)) return null;
    return { first: typeof d.first === "number" ? d.first : Date.now(), ids: d.ids.filter(token).slice(-20) };
  }
  /** Apply one checked hand-off to this origin's storage; returns what happened. */
  function merge(data) {
    var report = { id: data.id, repeat: false, recordsOnly: false, imported: [], kept: [], dropped: data.x.slice() };
    var done = readDone();
    if (done && done.ids.indexOf(data.id) >= 0) {
      report.repeat = true;
      return report;
    }
    report.recordsOnly = !!done;
    Object.keys(data.d).forEach(function (key) {
      var f = BY_KEY[key], value = data.d[key];
      if (f.type === R) {
        var next = f.merge(read("localStorage", key), value);
        if (next !== null && write(key, next)) report.imported.push(key);
        else report.kept.push(key);
        return;
      }
      if (report.recordsOnly || present(f)) {
        report.kept.push(key);
        return;
      }
      if (write(key, value)) report.imported.push(key);
    });
    var ids = done ? done.ids : [];
    ids.push(data.id);
    write(DONE_KEY, JSON.stringify({ v: 1, first: done ? done.first : Date.now(), ids: ids.slice(-20) }));
    return report;
  }

  // ---- run ------------------------------------------------------------------

  var api = {
    BUDGET: BUDGET,
    DONE_KEY: DONE_KEY,
    families: FAMILIES.map(function (f) {
      return { type: f.type, keys: f.keys.slice() };
    }),
    encode: encode,
    decode: decode,
    gather: gather,
    pack: pack,
    unpack: unpack,
    merge: merge,
    last: null,
  };
  global.HexsweeperSiteMove = api;

  var loc = global.location;
  if (!loc) return;
  var host = loc.hostname;
  var onPath = loc.pathname === PATH || loc.pathname.indexOf(PATH + "/") === 0;

  if (host === OLD_HOST && onPath) {
    if (/(?:^|&)stay=1(?:&|$)/.test(loc.search.slice(1))) return;
    var target = NEW_ORIGIN + loc.pathname + loc.search;
    // Only a hand-off built here, from this origin's own storage, may carry
    // PARAM. An incoming fragment that mentions it (a crafted link to
    // dr.eamer.dev) is dropped on every path, or lukesteuber.com would see
    // it arrive from dr.eamer.dev and trust it.
    var hash = loc.hash || "";
    if (hash.indexOf(PARAM.slice(0, -1)) >= 0) hash = "";
    var items = [];
    try {
      items = gather();
    } catch (_) {}
    var url = target + hash;
    if (items.length) {
      try {
        var packed = pack(items, hash);
        api.last = { sent: Object.keys(packed.payload.d), dropped: packed.payload.x, size: packed.text.length };
        url = target + "#" + PARAM + packed.text;
      } catch (_) {}
    }
    // Hide the old page for the moment it takes to leave; show it again if
    // the move somehow does not happen.
    try {
      var style = global.document.documentElement.style;
      style.visibility = "hidden";
      global.setTimeout(function () {
        style.visibility = "";
      }, 4000);
    } catch (_) {}
    loc.replace(url);
    return;
  }

  if (host === NEW_HOST && loc.hash.indexOf("#" + PARAM) === 0) {
    var referrer = "";
    try {
      referrer = String(global.document.referrer || "");
    } catch (_) {}
    // Only a page on dr.eamer.dev can hand saves over; a link from anywhere
    // else is stripped with no other effect.
    var data = null;
    if (referrer.indexOf(OLD_REFERRER) === 0) {
      try {
        data = unpack(loc.hash.slice(PARAM.length + 1));
      } catch (_) {}
    }
    try {
      global.history.replaceState(global.history.state, "", loc.pathname + loc.search + (data && data.h ? data.h : ""));
    } catch (_) {}
    if (!data) {
      api.last = { rejected: referrer.indexOf(OLD_REFERRER) === 0 ? "unreadable" : "referrer" };
    } else {
      try {
        api.last = merge(data);
      } catch (_) {}
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
