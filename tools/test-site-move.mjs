#!/usr/bin/env node
// site-move.js contract, without a browser: the script runs in a VM with a
// stand-in location, history and storage, under each host name it can meet.
// It also checks that every served page loads the script first and that the
// app payloads never do. tools/test-site-move-browser.mjs covers real pages.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "site-move.js"), "utf8");
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  process.stdout.write(`ok - ${name}\n`);
}

function store(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    dump: () => Object.fromEntries(map),
  };
}

/** Run site-move.js once at `href` with the given storage and referrer. */
function boot(href, local = {}, session = {}, referrer = "") {
  const url = new URL(href);
  const replaced = [];
  const location = {
    href,
    protocol: url.protocol,
    hostname: url.hostname,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    replace: (to) => replaced.push(to),
  };
  const history = {
    state: null,
    replaceState(state, _title, to) {
      const next = new URL(to, location.href);
      location.pathname = next.pathname;
      location.search = next.search;
      location.hash = next.hash;
      location.href = next.href;
    },
  };
  const ctx = {
    location,
    history,
    localStorage: store(local),
    sessionStorage: store(session),
    document: { documentElement: { style: {} }, referrer },
    setTimeout: () => 0,
    TextEncoder,
    TextDecoder,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return { ctx, location, replaced, local: ctx.localStorage, session: ctx.sessionStorage, api: ctx.HexsweeperSiteMove };
}

const OLD = "https://dr.eamer.dev/games/hexsweeper";
const NEW = "https://lukesteuber.com/games/hexsweeper";
const FROM_OLD = "https://dr.eamer.dev/"; // what the browser reports after the redirect
/** Land on lukesteuber.com the way the redirect does: referred by dr.eamer.dev. */
const arrive = (url, local = {}, session = {}) => boot(url, local, session, FROM_OLD);
const best = (o) => JSON.stringify(o);
const sphereRun = (extra = {}) =>
  JSON.stringify({ v: 2, kind: "sphere", difficulty: "hard", first: false, over: false, won: false, flags: 1, mineCount: 245, time: 30, rotY: 0.4, rotX: -0.2, zoom: 1, mines: [3, 9, 40], revealed: [1, 2, 4], flagged: [3], savedAt: 1000, ...extra });
const classicRun = JSON.stringify({ v: 1, endless: false, difficulty: "medium", radius: 7, first: false, over: false, win: null, endReason: null, finish: null, cleared: 1, flags: 0, mineCount: 35, time: 5, cam: [0, 0], zoom: 1, mines: ["0,1", "-3,2"], revealed: ["0,0"], flagged: [], torn: [], kind: "classic", savedAt: 5 });
function plateCells(radius) {
  const out = [];
  for (let q = -radius; q <= radius; q++) for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) out.push(`${q},${r}`);
  return out;
}
const plateRun = (radius, extra = {}) => {
  const all = plateCells(radius);
  return JSON.stringify({ v: 1, endless: true, difficulty: "medium", density: 0.16, radius, first: false, over: false, win: null, endReason: null, finish: null, cleared: 1, flags: 0, mineCount: 9, time: 9, cam: [12.5, -3], zoom: 1, mines: all.filter((_, i) => i % 6 === 0), revealed: all.filter((_, i) => i % 6 === 1), flagged: [], torn: [], mode: "light", savedAt: 2, ...extra });
};

const oldSaves = {
  "hexsweeper-sphere-best-v1": best({ easy: { seconds: 50, at: "2026-11-01T00:00:00.000Z" }, medium: { seconds: 200, at: null }, hard: { seconds: 900, at: null } }),
  "hexsweeper-endless-best": "321",
  "hexsweeper-sphere-theme-v6": "mercury",
  "hexsweeper-sphere-size-v2": "hard",
  "hexsweeper-effects-v1": "reduced",
  "hexsweeper-sphere-invert-v6": JSON.stringify({ x: true, y: false }),
  "hexsweeper-infinite-theme-v1": "dark",
  "hexsweeper-zoom-v1": "1.25",
  "minimal-access.v1:hex-infinite": JSON.stringify({ mode: "switch", speed: "slow" }),
  // Carries the trackball's roll (rotZ); older saves without it still move.
  "hexsweeper-sphere-run-v2": sphereRun({ rotZ: 0.3 }),
  "hexsweeper-classic-run-v1": classicRun,
  "hexsweeper-endless-plate-v1": plateRun(5),
  // Not the game's, or not readable: never sent.
  "someone-else-v1": "secret",
  "hexsweeper-mode-v3": "<script>",
  "hexwheel-run-v3": "{not json",
  "hexsweeper-glitch-sphere-run-v1": sphereRun({ kind: "glitch-sphere" }),
};

function handoff(local = oldSaves, session = {}, path = "/index.html?x=1#deep") {
  const run = boot(OLD + path, local, session);
  assert.equal(run.replaced.length, 1, "dr.eamer.dev did not redirect");
  return run;
}
/** A hand-off link written by hand, as a third party could. */
function crafted(d, extra = {}) {
  const { api } = boot(OLD + "/?stay=1");
  return `${NEW}/play.html?c=1#hexsweeper-move=${api.encode(JSON.stringify({ v: 1, id: "abc-123", d, x: [], ...extra }))}`;
}
function untouched(run, before, why) {
  assert.deepEqual(run.local.dump(), before, `${why}: storage changed`);
  assert.equal(run.local.getItem(run.api.DONE_KEY), before[run.api.DONE_KEY] ?? null, `${why}: hand-off recorded`);
  assert.equal(run.location.hash, "", `${why}: fragment not stripped`);
  assert.equal(run.location.search, "?c=1", `${why}: query changed`);
  assert.equal(run.replaced.length, 0);
}

test("dr.eamer.dev redirects to the same path and query on lukesteuber.com, data in the fragment only", () => {
  const { replaced, api } = handoff();
  const to = new URL(replaced[0]);
  assert.equal(to.origin, "https://lukesteuber.com");
  assert.equal(to.pathname, "/games/hexsweeper/index.html");
  assert.equal(to.search, "?x=1", "the query must not change or carry data");
  assert.match(to.hash, /^#hexsweeper-move=[A-Za-z0-9_-]+$/);
  assert.ok(to.hash.length < api.BUDGET + 20);
  const sent = [...api.last.sent];
  for (const key of ["hexsweeper-sphere-run-v2", "hexsweeper-classic-run-v1", "hexsweeper-endless-plate-v1", "minimal-access.v1:hex-infinite"]) assert.ok(sent.includes(key), `${key} was not sent`);
  for (const key of ["someone-else-v1", "hexsweeper-mode-v3", "hexwheel-run-v3", "hexsweeper-glitch-sphere-run-v1"]) assert.ok(!sent.includes(key), `${key} was sent`);
});

test("records, settings and boards arrive; better records and existing settings survive", () => {
  const url = handoff().replaced[0];
  const existing = {
    "hexsweeper-sphere-best-v1": best({ easy: { seconds: 40, at: "keep" }, medium: { seconds: 250, at: "old" } }),
    "hexsweeper-endless-best": "999",
    "hexsweeper-sphere-theme-v6": "earth",
  };
  const run = arrive(url, existing);
  const got = run.local.dump();
  const times = JSON.parse(got["hexsweeper-sphere-best-v1"]);
  assert.deepEqual(times.easy, { seconds: 40, at: "keep" }, "a better existing time was overwritten");
  assert.equal(times.medium.seconds, 200, "a better incoming time was not taken");
  assert.equal(times.hard.seconds, 900, "a new size was not added");
  assert.equal(got["hexsweeper-endless-best"], "999", "a higher endless best was lowered");
  assert.equal(got["hexsweeper-sphere-theme-v6"], "earth", "an existing setting was overwritten");
  assert.equal(got["hexsweeper-sphere-size-v2"], "hard");
  assert.equal(got["hexsweeper-effects-v1"], "reduced");
  assert.equal(got["minimal-access.v1:hex-infinite"], oldSaves["minimal-access.v1:hex-infinite"]);
  assert.equal(got["hexsweeper-sphere-run-v2"], oldSaves["hexsweeper-sphere-run-v2"]);
  assert.equal(got["hexsweeper-classic-run-v1"], classicRun);
  assert.equal(got["hexsweeper-endless-plate-v1"], oldSaves["hexsweeper-endless-plate-v1"]);
  for (const key of ["someone-else-v1", "hexsweeper-mode-v3", "hexwheel-run-v3", "hexsweeper-glitch-sphere-run-v1"]) assert.equal(got[key], undefined, key);
  assert.equal(run.location.hash, "#deep", "the page's own fragment was not restored");
  assert.equal(run.location.search, "?x=1");
  assert.equal(run.replaced.length, 0, "lukesteuber.com must never redirect");
});

test("a hand-off without the dr.eamer.dev referrer is stripped and changes nothing", () => {
  const real = handoff().replaced[0];
  const good = crafted({ "hexsweeper-sphere-best-v1": best({ xlarge: { seconds: 12, at: null } }), "hexsweeper-sphere-run-v2": sphereRun() });
  for (const referrer of ["", "https://evil.example/", "https://dr.eamer.dev.evil.example/", "http://dr.eamer.dev/", "https://lukesteuber.com/games/hexsweeper/"]) {
    for (const url of [real.replace("index.html?x=1", "play.html?c=1"), good]) {
      const before = { "hexsweeper-effects-v1": "full" };
      const run = boot(url, before, {}, referrer);
      untouched(run, before, `referrer ${JSON.stringify(referrer)}`);
      assert.equal(run.api.last.rejected, "referrer");
    }
  }
  // A refused link leaves no trace: the real hand-off afterwards is still a first one.
  const refused = boot(good, {}, {}, "https://evil.example/").local.dump();
  const landed = arrive(real, refused);
  assert.equal(landed.api.last.recordsOnly, false);
  assert.equal(landed.local.getItem("hexsweeper-sphere-run-v2"), oldSaves["hexsweeper-sphere-run-v2"]);
});

test("a hand-off written into a dr.eamer.dev link never passes through", () => {
  const attack = new URL(crafted({ "hexsweeper-sphere-best-v1": best({ xsmall: { seconds: 2, at: null } }), "hexsweeper-sphere-run-v2": sphereRun({ difficulty: "xsmall", mines: [5] }) })).hash;
  for (const path of ["/index.html?q=1", "/play.html", ""]) {
    // Nothing to carry: the redirect must not forward the crafted fragment.
    let old = boot(OLD + path + attack, {});
    assert.equal(old.replaced.length, 1);
    assert.ok(!old.replaced[0].includes("hexsweeper-move"), `${path}: forwarded ${old.replaced[0].slice(0, 80)}`);
    let landed = arrive(old.replaced[0], {});
    assert.deepEqual(landed.local.dump(), {}, `${path}: the crafted hand-off was imported`);
    // Saves to carry: only the old host's own data arrives, and the crafted
    // fragment is not put back as the page's fragment for a reload to find.
    old = boot(OLD + path + attack, oldSaves);
    assert.ok(!old.replaced[0].includes("hexsweeper-move=" + attack.slice("#hexsweeper-move=".length)));
    landed = arrive(old.replaced[0], {});
    const times = JSON.parse(landed.local.getItem("hexsweeper-sphere-best-v1"));
    assert.equal(times.xsmall, undefined, `${path}: a crafted record arrived`);
    assert.equal(landed.local.getItem("hexsweeper-sphere-run-v2"), oldSaves["hexsweeper-sphere-run-v2"]);
    assert.equal(landed.location.hash, "", `${path}: the crafted fragment came back as ${landed.location.hash.slice(0, 40)}`);
    const reload = arrive(NEW + path + landed.location.hash, landed.local.dump());
    assert.deepEqual(reload.local.dump(), landed.local.dump());
  }
  // pack() failing or dropping everything forwards no fragment either.
  const huge = boot(OLD + "/" + attack, { "hexsweeper-endless-plate-v1": plateRun(150) });
  assert.ok(!huge.replaced[0].includes(attack.slice(1)));
  assert.deepEqual(arrive(huge.replaced[0], {}).local.dump(), {});
  // A page fragment that is itself a hand-off is refused, even from dr.eamer.dev.
  const nested = crafted({ "hexsweeper-effects-v1": "full" }, { h: attack });
  untouched(arrive(nested, {}), {}, "nested hand-off as the page fragment");
});

test("an unfinished board already on lukesteuber.com is kept, in either store", () => {
  const url = handoff().replaced[0];
  const mine = sphereRun({ savedAt: 1 });
  let run = arrive(url, { "hexsweeper-sphere-run-v2": mine });
  assert.equal(run.local.getItem("hexsweeper-sphere-run-v2"), mine);
  run = arrive(url, {}, { "hexsweeper-sphere-run-v1": mine });
  assert.equal(run.local.getItem("hexsweeper-sphere-run-v2"), null, "a board in sessionStorage was overridden");
  assert.ok(run.api.last.kept.includes("hexsweeper-sphere-run-v2"));
});

test("the fragment is stripped, and neither a reload nor the same link imports again", () => {
  const url = handoff().replaced[0];
  const first = arrive(url);
  assert.equal(first.location.hash, "#deep");
  const after = first.local.dump();
  const reload = arrive(NEW + first.location.pathname.replace("/games/hexsweeper", "") + first.location.search + first.location.hash, after);
  assert.deepEqual(reload.local.dump(), after);
  const cleared = { ...after };
  delete cleared["hexsweeper-sphere-run-v2"];
  const replay = arrive(url, cleared);
  assert.equal(replay.api.last.repeat, true);
  assert.equal(replay.local.getItem("hexsweeper-sphere-run-v2"), null, "a replayed hand-off brought back a cleared board");
  assert.equal(replay.location.hash, "#deep");
});

test("a later hand-off brings records only", () => {
  const landed = arrive(handoff().replaced[0]).local.dump();
  delete landed["hexsweeper-sphere-run-v2"]; // finished on lukesteuber.com
  delete landed["hexsweeper-infinite-theme-v1"]; // System picked again
  const faster = { ...oldSaves, "hexsweeper-sphere-best-v1": best({ medium: { seconds: 120, at: null } }) };
  const second = arrive(handoff(faster).replaced[0], landed);
  assert.equal(second.api.last.recordsOnly, true);
  assert.equal(second.local.getItem("hexsweeper-sphere-run-v2"), null);
  assert.equal(second.local.getItem("hexsweeper-infinite-theme-v1"), null);
  assert.equal(JSON.parse(second.local.getItem("hexsweeper-sphere-best-v1")).medium.seconds, 120);
});

test("one malformed part rejects the whole hand-off", () => {
  const goodBest = best({ easy: { seconds: 61, at: null } });
  const run = (extra) => sphereRun(extra);
  const bad = {
    "best time of 0 seconds": { "hexsweeper-sphere-best-v1": best({ easy: { seconds: 0, at: null } }) },
    "best time over a day": { "hexsweeper-sphere-best-v1": best({ easy: { seconds: 86400, at: null } }) },
    "fractional best time": { "hexsweeper-sphere-best-v1": best({ easy: { seconds: 1.5, at: null } }) },
    "best time as text": { "hexsweeper-sphere-best-v1": best({ easy: { seconds: "60" } }) },
    "unknown size": { "hexsweeper-sphere-best-v1": best({ easy: { seconds: 60 }, huge: { seconds: 61 } }) },
    "extra best field": { "hexsweeper-sphere-best-v1": best({ easy: { seconds: 60, at: null, cheat: 1 } }) },
    "empty best times": { "hexsweeper-sphere-best-v1": best({}) },
    "endless best of 0": { "hexsweeper-endless-best": "0" },
    "endless best past a full plate": { "hexsweeper-endless-best": "200000" },
    "face past the board": { "hexsweeper-sphere-run-v2": run({ revealed: [1, 2, 1442] }) },
    "faces out of order": { "hexsweeper-sphere-run-v2": run({ mines: [9, 3] }) },
    "face twice": { "hexsweeper-sphere-run-v2": run({ flagged: [3, 3] }) },
    "face as text": { "hexsweeper-sphere-run-v2": run({ mines: ["3"] }) },
    "unknown run field": { "hexsweeper-sphere-run-v2": run({ planted: true }) },
    "roll as text": { "hexsweeper-sphere-run-v2": run({ rotZ: "0.3" }) },
    "unknown sphere size": { "hexsweeper-sphere-run-v2": run({ difficulty: "huge" }) },
    "variant kind": { "hexsweeper-sphere-run-v2": run({ kind: "glitch-sphere" }) },
    "Classic cell off the board": { "hexsweeper-classic-run-v1": classicRun.replace('"-3,2"', '"8,0"') },
    "Classic cell with a space": { "hexsweeper-classic-run-v1": classicRun.replace('"-3,2"', '"-3, 2"') },
    "Classic cell with a leading zero": { "hexsweeper-classic-run-v1": classicRun.replace('"-3,2"', '"-03,2"') },
    "Classic cell twice": { "hexsweeper-classic-run-v1": classicRun.replace('"-3,2"', '"0,1"') },
    "plate cell past its radius": { "hexsweeper-endless-plate-v1": plateRun(5, { flagged: ["6,0"] }) },
    "plate radius past the cap": { "hexsweeper-endless-plate-v1": plateRun(5, { radius: 161 }) },
    "plate rift in an unknown phase": { "hexsweeper-endless-plate-v1": plateRun(5, { rift: { phase: "boss" } }) },
    "theme id with a space": { "hexsweeper-sphere-theme-v6": "a b" },
    "unknown effects value": { "hexsweeper-effects-v1": "max" },
    "access value it does not offer": { "minimal-access.v1:hex-classic": JSON.stringify({ mode: "switch", speed: "warp" }) },
    "access field it does not have": { "minimal-access.v1:hex-classic": JSON.stringify({ mode: "switch", extra: 1 }) },
    "Dodecahedron setting it does not have": { "hexsweeper-dodeca-settings-v1": JSON.stringify({ seams: true, more: 1 }) },
    "drag direction as numbers": { "hexsweeper-sphere-invert-v6": JSON.stringify({ x: 1, y: 0 }) },
    "a value that is not text": { "hexsweeper-effects-v1": 5 },
    "a key that is not the game's": { "evil-key": "1" },
    "two keys of one family": { "hexsweeper-sphere-theme-v6": "mercury", "hexsweeper-sphere-theme-v5": "earth" },
    "a board the move does not carry": { "hexsweeper-glitch-sphere-run-v1": run({ kind: "glitch-sphere" }) },
  };
  for (const [why, part] of Object.entries(bad)) {
    const before = { "hexsweeper-mode-v3": "fire" };
    const result = arrive(crafted({ "hexsweeper-sphere-best-v1": goodBest, ...part }), before);
    untouched(result, before, why);
    assert.equal(result.api.last.rejected, "unreadable", why);
  }
  const wrapper = {
    "dropped list naming another key": { x: ["evil-key"] },
    "page fragment without #": { h: "deep" },
    "unknown payload field": { extra: 1 },
    "id in the wrong form": { id: "<b>" },
    "version 2": { v: 2 },
  };
  for (const [why, extra] of Object.entries(wrapper)) {
    const before = {};
    untouched(arrive(crafted({ "hexsweeper-sphere-best-v1": goodBest }, extra), before), before, why);
  }
  const { api } = boot(OLD + "/?stay=1");
  const proto = JSON.stringify({ v: 1, id: "abc-123", d: { "hexsweeper-sphere-best-v1": goodBest }, x: [] }).replace('"d":{', '"d":{"__proto__":"1",');
  untouched(arrive(`${NEW}/play.html?c=1#hexsweeper-move=${api.encode(proto)}`, {}), {}, "__proto__ key");
  for (const junk of ["!!!", "", "AAAA", api.encode("[]"), api.encode('{"v":1,"id":"a-b","d":{},"x":[]}'), "A".repeat(40000)]) {
    const before = { "hexsweeper-mode-v3": "fire" };
    untouched(arrive(`${NEW}/play.html?c=1#hexsweeper-move=${junk}`, before), before, `junk ${junk.slice(0, 12)}`);
  }
  // The same parts, well formed, are accepted.
  const fine = arrive(crafted({ "hexsweeper-sphere-best-v1": goodBest, "hexsweeper-endless-plate-v1": plateRun(5, { rift: { phase: "chase", q: 1, r: -1, fq: 1.5, fr: -1, torn: ["0,0"], t0: 123.4 } }), "hexsweeper-dodeca-settings-v1": JSON.stringify({ seams: true, relief: "flush", appearanceAxes: { field: "dark" } }) }));
  assert.deepEqual([...fine.api.last.imported].sort(), ["hexsweeper-dodeca-settings-v1", "hexsweeper-endless-plate-v1", "hexsweeper-sphere-best-v1"]);
});

test("other hosts, other paths and ?stay=1 do nothing", () => {
  const { api } = boot(OLD + "/?stay=1");
  const frag = "#hexsweeper-move=" + api.encode(JSON.stringify({ v: 1, id: "z-1", d: { "hexsweeper-sphere-size-v2": "hard" }, x: [] }));
  for (const href of [
    "http://localhost:8080/index.html" + frag,
    "http://127.0.0.1:5010/games/hexsweeper/index.html" + frag,
    "file:///Users/x/hexsweeper/index.html" + frag,
    "capacitor://localhost/index.html" + frag,
    "https://www.lukesteuber.com/games/hexsweeper/" + frag,
    "https://dr.eamer.dev.example.com/games/hexsweeper/",
    "https://www.dr.eamer.dev/games/hexsweeper/",
    "https://dr.eamer.dev/games/other/",
    "https://dr.eamer.dev/games/hexsweeperx/",
    OLD + "/play.html?mode=fire&stay=1",
  ]) {
    const run = boot(href, oldSaves, {}, FROM_OLD);
    assert.equal(run.replaced.length, 0, `${href} redirected`);
    assert.deepEqual(run.local.dump(), oldSaves, `${href} touched storage`);
    assert.equal(run.location.hash, new URL(href).hash, `${href} changed the fragment`);
  }
});

test("nothing to carry is a plain redirect that keeps the page's fragment", () => {
  const run = boot(OLD + "/infinite.html?a=b#top", { "unrelated": "1" });
  assert.deepEqual(run.replaced, [NEW + "/infinite.html?a=b#top"]);
  assert.deepEqual(boot("https://dr.eamer.dev/games/hexsweeper", {}).replaced, ["https://lukesteuber.com/games/hexsweeper"]);
});

test("the newest board wins across keys and stores", () => {
  const older = sphereRun({ savedAt: 10, difficulty: "easy" });
  const newer = sphereRun({ savedAt: 20, difficulty: "xlarge" });
  const run = boot(OLD + "/", { "hexsweeper-sphere-run-v2": older }, { "hexsweeper-sphere-run-v1": newer });
  const landed = arrive(run.replaced[0]);
  assert.equal(landed.local.getItem("hexsweeper-sphere-run-v1"), newer);
  assert.equal(landed.local.getItem("hexsweeper-sphere-run-v2"), null);
});

test("an oversized hand-off keeps records and settings and drops boards in priority order", () => {
  const full = (faces, step, extra = {}) => {
    const mines = [], revealed = [];
    for (let i = 0; i < faces; i++) (i % step === 0 ? mines : revealed).push(i);
    return JSON.stringify({ v: 2, kind: "sphere", difficulty: "xlarge", first: false, over: false, won: false, flags: 0, mineCount: mines.length, time: 600, rotY: 1, rotX: 0, zoom: 1, mines, revealed, flagged: [], savedAt: 9, ...extra });
  };
  const saves = {
    ...oldSaves,
    "hexsweeper-endless-plate-v1": plateRun(150),
    "hexsweeper-sphere-run-v2": full(2252, 6),
    "hexwheel-run-v3": full(1442, 5, { v: 3, tileCount: 1442, doused: [], rescues: 0, armed: null }),
    "hexsweeper-endless-escape-v1": plateRun(40, { mode: "escape" }),
    "hexsweeper-reflection-run-v1": full(2252, 7),
  };
  const run = boot(OLD + "/", saves);
  const fragment = new URL(run.replaced[0]).hash;
  const sent = [...run.api.last.sent], dropped = [...run.api.last.dropped];
  assert.ok(fragment.length <= run.api.BUDGET + "#hexsweeper-move=".length, `fragment is ${fragment.length} characters`);
  assert.ok(run.replaced[0].length < 32 * 1024 * 0.6);
  assert.ok(dropped.includes("hexsweeper-endless-plate-v1"), "the oversized Infinite plate was not dropped");
  assert.ok(sent.includes("hexsweeper-sphere-run-v2"), "the Sphere board did not fit");
  assert.ok(sent.includes("hexsweeper-classic-run-v1"), "a small board after a dropped one was not kept");
  for (const key of ["hexsweeper-sphere-best-v1", "hexsweeper-endless-best", "hexsweeper-sphere-theme-v6", "minimal-access.v1:hex-infinite"]) {
    assert.ok(sent.includes(key), `${key} was dropped`);
  }
  const landed = arrive(run.replaced[0]);
  assert.deepEqual([...landed.api.last.dropped], dropped);
  assert.equal(landed.local.getItem("hexsweeper-endless-plate-v1"), null);
  assert.equal(landed.local.getItem("hexsweeper-sphere-run-v2"), saves["hexsweeper-sphere-run-v2"]);
  for (const key of sent) assert.ok(landed.local.getItem(key) !== null, `${key} did not land`);
  process.stdout.write(`  # ${fragment.length} characters; sent ${sent.filter((k) => /run|plate|escape/.test(k)).join(", ")}; dropped ${dropped.join(", ")}\n`);
});

test("the codec round-trips text of any kind", () => {
  const { api } = boot(OLD + "/?stay=1");
  const samples = ["", "a", "ab".repeat(70000), JSON.stringify(oldSaves), "émoji 🧭 ✓ \u0000 ￿", "x".repeat(300000)];
  for (let n = 0; n < 50; n++) {
    let s = "";
    for (let i = 0; i < n * 37; i++) s += String.fromCharCode(32 + ((i * 2654435761 + n) % 95));
    samples.push(s);
  }
  for (const s of samples) assert.equal(api.decode(api.encode(s)), s);
});

test("every served page loads site-move.js first; the app payloads never do", () => {
  const stamp = createHash("sha1").update(readFileSync(join(root, "site-move.js"))).digest("hex").slice(0, 8);
  const files = execFileSync("git", ["ls-files", "*.html"], { cwd: root, encoding: "utf8" }).trim().split("\n");
  const served = files.filter((f) => !/^(app|fdroid|tools|build)\//.test(f));
  assert.ok(served.length > 80);
  for (const file of served) {
    const html = readFileSync(join(root, file), "utf8");
    const rel = "../".repeat(posix.dirname(file) === "." ? 0 : posix.dirname(file).split("/").length);
    const tag = `<script src="${rel}site-move.js?v=${stamp}"></script>`;
    assert.equal(html.split("site-move.js").length - 1, 1, `${file} should load site-move.js once`);
    const at = html.indexOf(tag);
    assert.ok(at > 0, `${file} lacks ${tag}`);
    assert.equal(html.indexOf("<script"), at, `${file} runs a script before site-move.js`);
    assert.ok(at < html.indexOf("</head>"), `${file} loads site-move.js outside <head>`);
  }
  for (const file of files.filter((f) => /^app\//.test(f))) {
    assert.ok(!readFileSync(join(root, file), "utf8").includes("site-move"), `${file} carries site-move.js`);
  }
});

process.stdout.write(`site-move: ${passed} checks passed\n`);
