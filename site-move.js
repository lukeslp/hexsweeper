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
 * Merge rules: records keep the better value (Sphere best times keep the lower
 * seconds per size; the endless best keeps the higher count). Settings and
 * unfinished boards only fill keys lukesteuber.com does not have. Only the keys
 * listed in FAMILIES are accepted, each checked for shape. A hand-off imports
 * once: its id is remembered, and once one hand-off has landed, a later one
 * (an old link opened again) brings records only, so a finished or cleared
 * board cannot come back.
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
  var SIZES = ["xsmall", "easy", "medium", "hard", "xlarge"];

  // ---- shapes ------------------------------------------------------------

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
  function token(v) {
    return typeof v === "string" && /^[A-Za-z0-9_.:-]{1,40}$/.test(v);
  }
  function flag(v) {
    return v === "0" || v === "1";
  }
  function zoom(v) {
    return typeof v === "string" && /^\d{1,2}(\.\d{1,6})?$/.test(v) && +v > 0;
  }
  function count(v) {
    return typeof v === "string" && /^\d{1,9}$/.test(v);
  }
  function invert(v) {
    var d = parse(v);
    return isObj(d) && typeof d.x === "boolean" && typeof d.y === "boolean";
  }
  function prefs(v) {
    return typeof v === "string" && v.length <= 2000 && isObj(parse(v));
  }
  function bestEntry(e) {
    return isObj(e) && typeof e.seconds === "number" && isFinite(e.seconds) &&
      e.seconds >= 0 && e.seconds < 1e7 && (e.at == null || (typeof e.at === "string" && e.at.length <= 40));
  }
  function bestTimes(v) {
    var d = parse(v);
    if (!isObj(d)) return false;
    for (var i = 0; i < SIZES.length; i++) if (bestEntry(d[SIZES[i]])) return true;
    return false;
  }
  function list(a) {
    return Array.isArray(a);
  }
  function ints(a) {
    if (!list(a)) return false;
    for (var i = 0; i < a.length; i++) if (typeof a[i] !== "number" || a[i] < 0 || a[i] % 1) return false;
    return true;
  }
  function sphereRun(v) {
    var d = parse(v);
    return isObj(d) && d.kind === "sphere" && token(d.difficulty) && ints(d.mines) &&
      (d.revealed === undefined || ints(d.revealed)) && (d.flagged === undefined || ints(d.flagged));
  }
  function variantRun(v) {
    var d = parse(v);
    return isObj(d) && token(d.kind) && token(d.difficulty) && ints(d.mines) && ints(d.revealed) && ints(d.flagged);
  }
  function endlessRun(v) {
    var d = parse(v);
    return isObj(d) && d.v === 1 && d.endless === true && list(d.mines) && list(d.revealed) && list(d.flagged);
  }
  function classicRun(v) {
    var d = parse(v);
    return isObj(d) && d.v === 1 && d.kind === "classic" && d.endless === false && list(d.mines) && list(d.revealed) && list(d.flagged);
  }
  function dodecaRun(v) {
    var d = parse(v);
    return isObj(d) && d.v === 1 && d.kind === "dodeca-campaign" && list(d.panels);
  }

  // ---- merges for records -------------------------------------------------
  // Each returns the value to write, or null to leave lukesteuber.com alone.

  function mergeBest(current, incoming) {
    var have = parse(current);
    if (!isObj(have)) have = {};
    var add = parse(incoming), changed = false;
    SIZES.forEach(function (size) {
      var next = add[size], old = have[size];
      if (!bestEntry(next)) return;
      if (bestEntry(old) && old.seconds <= next.seconds) return;
      have[size] = { seconds: next.seconds | 0, at: typeof next.at === "string" ? next.at : null };
      changed = true;
    });
    return changed ? JSON.stringify(have) : null;
  }
  function mergeMax(current, incoming) {
    return count(current) && +current >= +incoming ? null : incoming;
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
    fam(R, ["hexsweeper-endless-best"], count, { merge: mergeMax }),

    // Shared by every board
    fam(S, ["hexsweeper-effects-v1"], token),
    fam(S, ["hexsweeper-zoom-v1"], zoom),
    // Sphere (root page, sphere/, sphere-ux/)
    fam(S, ["hexsweeper-sphere-theme-v6", "hexsweeper-sphere-theme-v5", "hexsweeper-sphere-theme-v4", "hexsweeper-sphere-theme-v3"], token),
    fam(S, ["hexsweeper-sphere-size-v2", "hexsweeper-sphere-size-v1"], token),
    fam(S, ["hexsweeper-sphere-countstyle-v1"], token),
    fam(S, ["hexsweeper-sphere-nest-v1"], flag),
    fam(S, ["hexsweeper-sphere-invert-v6"], invert),
    fam(S, ["hexsweeper-sphere-sheet-tab-v1"], token),
    fam(S, ["hexsweeper-sphere-welcome-v1"], flag),
    fam(S, ["hexsweeper-sphere-effects-v1"], token),
    fam(S, ["hexsweeper-sphere-invert-v1"], invert),
    // Infinite, play.html themes, Classic, the Games page
    fam(S, ["hexsweeper-infinite-theme-v1"], token),
    fam(S, ["hexsweeper-infinite-sheet-tab-v1"], token),
    fam(S, ["hexsweeper-mode-v3"], token),
    fam(S, ["hexsweeper-minimalist-tone-v1"], token),
    fam(S, ["hexsweeper-welcome-v1"], flag),
    fam(S, ["hexsweeper-classic-size-v1"], token),
    fam(S, ["hexsweeper-appearance-v1"], token),
    fam(S, ["minimal-access.v1:hex-infinite"], prefs),
    fam(S, ["minimal-access.v1:hex-classic"], prefs),
    // Water Wheel
    fam(S, ["hexwheel-theme-v6", "hexwheel-theme-v5", "hexwheel-theme-v4", "hexwheel-theme-v3"], token),
    fam(S, ["hexwheel-size-v2", "hexwheel-size-v1"], token),
    fam(S, ["hexwheel-countstyle-v1"], token),
    fam(S, ["hexwheel-nest-v1"], flag),
    fam(S, ["hexwheel-invert-v6"], invert),
    fam(S, ["hexwheel-tutorial-v1"], flag),
    // Reflection studio
    fam(S, ["hexsweeper-reflection-theme-v1"], token),
    fam(S, ["hexsweeper-reflection-size-v1"], token),
    fam(S, ["hexsweeper-reflection-countstyle-v1"], token),
    fam(S, ["hexsweeper-reflection-nest-v1"], flag),
    fam(S, ["hexsweeper-reflection-invert-v1"], invert),
    fam(S, ["hexsweeper-reflection-material-v1"], token),
    fam(S, ["hexsweeper-reflection-welcome-v1"], flag),
    // Collection experiments
    fam(S, ["hexsweeper-dodeca-size-v1"], token),
    fam(S, ["hexsweeper-dodeca-settings-v1"], prefs),
    fam(S, ["hexsweeper-dodeca-welcome-v1"], flag),
    fam(S, ["hexsweeper-glitch-welcome-v1"], flag),
    fam(S, ["hexsweeper-flux-welcome-v3"], flag),
    fam(S, ["catch-monkey-garden-welcome-v1"], flag),
    fam(S, ["catch-monkey-orbit-welcome-v1"], flag),

    // Unfinished boards, most valuable first
    fam(B, ["hexsweeper-sphere-run-v2", "hexsweeper-sphere-run-v1"], sphereRun, { session: true }),
    fam(B, ["hexsweeper-endless-plate-v1"], endlessRun),
    fam(B, ["hexsweeper-classic-run-v1"], classicRun),
    fam(B, ["hexwheel-run-v3", "hexwheel-run-v2", "hexwheel-run-v1"], sphereRun, { session: true }),
    fam(B, ["hexsweeper-endless-escape-v1"], endlessRun),
    fam(B, ["hexsweeper-reflection-run-v1", "hexsweeper-reflection-run-v0"], sphereRun, { session: true }),
    fam(B, ["hexsweeper-glitch-sphere-run-v1"], variantRun, { session: true }),
    fam(B, ["hexsweeper-flux-sphere-run-v1"], variantRun, { session: true }),
    fam(B, ["hexsweeper-dodeca-campaign-v1"], dodecaRun),
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

  function savedAt(v) {
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
          var t = savedAt(v);
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
    if (hash && hash !== "#") payload.h = hash;
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

  function unpack(text) {
    if (text.length > BUDGET * 2) return null;
    var d = parse(decode(text));
    if (!isObj(d) || d.v !== 1 || typeof d.id !== "string" || !/^[a-z0-9-]{1,40}$/.test(d.id) || !isObj(d.d)) {
      return null;
    }
    return d;
  }
  function readDone() {
    var d = parse(read("localStorage", DONE_KEY));
    if (!isObj(d) || !list(d.ids)) return null;
    return { first: typeof d.first === "number" ? d.first : Date.now(), ids: d.ids.filter(token).slice(-20) };
  }
  function short(key) {
    return String(key).slice(0, 60);
  }
  /** Apply one hand-off to this origin's storage; returns what happened. */
  function merge(data) {
    var report = { id: data.id, repeat: false, recordsOnly: false, imported: [], kept: [], ignored: [], dropped: [] };
    if (list(data.x)) report.dropped = data.x.filter(token).slice(0, 50).map(short);
    var done = readDone();
    if (done && done.ids.indexOf(data.id) >= 0) {
      report.repeat = true;
      return report;
    }
    report.recordsOnly = !!done;
    Object.keys(data.d).slice(0, 200).forEach(function (key) {
      var f = Object.prototype.hasOwnProperty.call(BY_KEY, key) ? BY_KEY[key] : null;
      var value = data.d[key];
      if (!f || typeof value !== "string" || !f.ok(value)) {
        if (report.ignored.length < 50) report.ignored.push(short(key));
        return;
      }
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
    var hash = loc.hash || "";
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
    var data = null;
    try {
      data = unpack(loc.hash.slice(PARAM.length + 1));
    } catch (_) {}
    var keep = data && typeof data.h === "string" && data.h.charAt(0) === "#" && data.h.length <= 2000 ? data.h : "";
    try {
      global.history.replaceState(global.history.state, "", loc.pathname + loc.search + keep);
    } catch (_) {}
    if (data) {
      try {
        api.last = merge(data);
      } catch (_) {}
    } else {
      api.last = { ignored: ["(unreadable hand-off)"] };
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
