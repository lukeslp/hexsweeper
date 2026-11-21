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

/** Run site-move.js once at `href` with the given storage. */
function boot(href, local = {}, session = {}) {
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
    document: { documentElement: { style: {} } },
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
const best = (o) => JSON.stringify(o);
const sphereRun = (extra = {}) =>
  JSON.stringify({ v: 2, kind: "sphere", difficulty: "hard", mines: [3, 9, 40], revealed: [1, 2, 4], flagged: [3], savedAt: 1000, ...extra });
const classicRun = JSON.stringify({ v: 1, kind: "classic", endless: false, difficulty: "medium", first: false, over: false, mines: ["0,1"], revealed: ["0,0"], flagged: [], savedAt: 5 });

const oldSaves = {
  "hexsweeper-sphere-best-v1": best({ easy: { seconds: 50, at: "2026-11-01T00:00:00Z" }, medium: { seconds: 200, at: null }, hard: { seconds: 900, at: null } }),
  "hexsweeper-endless-best": "321",
  "hexsweeper-sphere-theme-v6": "mercury",
  "hexsweeper-sphere-size-v2": "hard",
  "hexsweeper-effects-v1": "reduced",
  "hexsweeper-sphere-invert-v6": JSON.stringify({ x: true, y: false }),
  "hexsweeper-infinite-theme-v1": "dark",
  "hexsweeper-zoom-v1": "1.25",
  "minimal-access.v1:hex-infinite": JSON.stringify({ mode: "switch", speed: "slow" }),
  "hexsweeper-sphere-run-v2": sphereRun(),
  "hexsweeper-classic-run-v1": classicRun,
  // Not the game's, or not readable: never sent.
  "someone-else-v1": "secret",
  "hexsweeper-mode-v3": "<script>",
  "hexwheel-run-v3": "{not json",
};

function handoff(local = oldSaves, session = {}, path = "/index.html?x=1#deep") {
  const run = boot(OLD + path, local, session);
  assert.equal(run.replaced.length, 1, "dr.eamer.dev did not redirect");
  return run;
}

test("dr.eamer.dev redirects to the same path and query on lukesteuber.com, data in the fragment only", () => {
  const { replaced, api } = handoff();
  const to = new URL(replaced[0]);
  assert.equal(to.origin, "https://lukesteuber.com");
  assert.equal(to.pathname, "/games/hexsweeper/index.html");
  assert.equal(to.search, "?x=1", "the query must not change or carry data");
  assert.match(to.hash, /^#hexsweeper-move=[A-Za-z0-9_-]+$/);
  assert.ok(to.hash.length < api.BUDGET + 20);
  assert.ok(api.last.sent.includes("hexsweeper-sphere-run-v2"));
  assert.ok(!api.last.sent.includes("someone-else-v1"));
  assert.ok(!api.last.sent.includes("hexsweeper-mode-v3"), "a malformed setting was sent");
  assert.ok(!api.last.sent.includes("hexwheel-run-v3"), "a malformed board was sent");
});

test("records, settings and boards arrive; better records and existing settings survive", () => {
  const url = handoff().replaced[0];
  const existing = {
    "hexsweeper-sphere-best-v1": best({ easy: { seconds: 40, at: "keep" }, medium: { seconds: 250, at: "old" } }),
    "hexsweeper-endless-best": "999",
    "hexsweeper-sphere-theme-v6": "earth",
  };
  const run = boot(url, existing);
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
  assert.equal(got["someone-else-v1"], undefined);
  assert.equal(got["hexsweeper-mode-v3"], undefined);
  assert.equal(got["hexwheel-run-v3"], undefined);
  assert.equal(run.location.hash, "#deep", "the page's own fragment was not restored");
  assert.equal(run.location.search, "?x=1");
  assert.equal(run.replaced.length, 0, "lukesteuber.com must never redirect");
});

test("an unfinished board already on lukesteuber.com is kept, in either store", () => {
  const url = handoff().replaced[0];
  const mine = sphereRun({ savedAt: 1 });
  let run = boot(url, { "hexsweeper-sphere-run-v2": mine });
  assert.equal(run.local.getItem("hexsweeper-sphere-run-v2"), mine);
  run = boot(url, {}, { "hexsweeper-sphere-run-v1": mine });
  assert.equal(run.local.getItem("hexsweeper-sphere-run-v2"), null, "a board in sessionStorage was overridden");
  assert.ok(run.api.last.kept.includes("hexsweeper-sphere-run-v2"));
});

test("the fragment is stripped, and neither a reload nor the same link imports again", () => {
  const url = handoff().replaced[0];
  const first = boot(url);
  assert.equal(first.location.hash, "#deep");
  const after = first.local.dump();
  // Reload: the address no longer has the hand-off.
  const reload = boot(NEW + first.location.pathname.replace("/games/hexsweeper", "") + first.location.search + first.location.hash, after);
  assert.deepEqual(reload.local.dump(), after);
  // The same hand-off link opened again after the player cleared a board.
  const cleared = { ...after };
  delete cleared["hexsweeper-sphere-run-v2"];
  const replay = boot(url, cleared);
  assert.equal(replay.api.last.repeat, true);
  assert.equal(replay.local.getItem("hexsweeper-sphere-run-v2"), null, "a replayed hand-off brought back a cleared board");
  assert.equal(replay.location.hash, "#deep");
});

test("a later hand-off brings records only", () => {
  const firstUrl = handoff().replaced[0];
  const landed = boot(firstUrl).local.dump();
  delete landed["hexsweeper-sphere-run-v2"]; // finished on lukesteuber.com
  delete landed["hexsweeper-infinite-theme-v1"]; // System picked again
  const faster = { ...oldSaves, "hexsweeper-sphere-best-v1": best({ medium: { seconds: 120, at: null } }) };
  const second = boot(handoff(faster).replaced[0], landed);
  assert.equal(second.api.last.recordsOnly, true);
  assert.equal(second.local.getItem("hexsweeper-sphere-run-v2"), null);
  assert.equal(second.local.getItem("hexsweeper-infinite-theme-v1"), null);
  assert.equal(JSON.parse(second.local.getItem("hexsweeper-sphere-best-v1")).medium.seconds, 120);
});

test("malformed hand-offs are ignored and still stripped", () => {
  const { api } = boot(OLD + "/?stay=1");
  const payload = {
    v: 1,
    id: "abc-123",
    d: {
      "hexsweeper-sphere-best-v1": best({ easy: { seconds: "1" }, medium: { seconds: -5 } }),
      "hexsweeper-endless-best": "1e9",
      "hexsweeper-sphere-theme-v6": "a b",
      "hexsweeper-sphere-invert-v6": JSON.stringify({ x: 1, y: 0 }),
      "hexsweeper-sphere-run-v2": JSON.stringify({ kind: "sphere", difficulty: "hard", mines: ["1"] }),
      "hexsweeper-classic-run-v1": JSON.stringify([1, 2]),
      "minimal-access.v1:hex-classic": "x".repeat(3000),
      "hexsweeper-effects-v1": 5,
      "evil-key": "1",
      constructor: "1",
    },
  };
  const text = JSON.stringify(payload).replace('"d":{', '"d":{"__proto__":"1",');
  const bad = boot(`${NEW}/play.html#hexsweeper-move=${api.encode(text)}`);
  assert.deepEqual(bad.local.dump(), { [api.DONE_KEY]: bad.local.getItem(api.DONE_KEY) });
  assert.equal(bad.api.last.imported.length, 0);
  assert.equal(bad.location.hash, "");
  for (const junk of ["!!!", "", "AAAA", api.encode('{"v":2,"id":"x","d":{}}'), api.encode("[]"), "A".repeat(40000)]) {
    const run = boot(`${NEW}/play.html?q=2#hexsweeper-move=${junk}`, { "hexsweeper-mode-v3": "fire" });
    assert.deepEqual(run.local.dump(), { "hexsweeper-mode-v3": "fire" });
    assert.equal(run.location.hash, "");
    assert.equal(run.location.search, "?q=2");
  }
});

test("other hosts, other paths and ?stay=1 do nothing", () => {
  const { api } = boot(OLD + "/?stay=1");
  const frag = "#hexsweeper-move=" + api.encode(JSON.stringify({ v: 1, id: "z", d: { "hexsweeper-sphere-size-v2": "hard" } }));
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
    const run = boot(href, oldSaves);
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
  const landed = boot(run.replaced[0]);
  assert.equal(landed.local.getItem("hexsweeper-sphere-run-v1"), newer);
  assert.equal(landed.local.getItem("hexsweeper-sphere-run-v2"), null);
});

test("an oversized hand-off keeps records and settings and drops boards in priority order", () => {
  const cells = (n) => Array.from({ length: n }, (_, i) => `${(i * 7919) % 2003},${(i * 104729) % 1999}`);
  const plate = JSON.stringify({ v: 1, endless: true, mines: cells(9000), revealed: cells(30000), flagged: cells(400), savedAt: 3 });
  const xl = (seed) => {
    const mines = [], revealed = [];
    for (let i = 0; i < 1442; i++) ((i * seed) % 7 === 0 ? mines : revealed).push(i);
    return JSON.stringify({ v: 2, kind: "sphere", difficulty: "xlarge", mines, revealed, flagged: [], savedAt: seed });
  };
  const saves = { ...oldSaves, "hexsweeper-endless-plate-v1": plate, "hexsweeper-sphere-run-v2": xl(3), "hexwheel-run-v3": xl(5), "hexsweeper-reflection-run-v1": xl(11), "hexsweeper-glitch-sphere-run-v1": JSON.stringify({ ...JSON.parse(xl(13)), kind: "glitch-sphere" }), "hexsweeper-flux-sphere-run-v1": JSON.stringify({ ...JSON.parse(xl(17)), kind: "flux-sphere" }) };
  const run = boot(OLD + "/", saves);
  const fragment = new URL(run.replaced[0]).hash;
  assert.ok(fragment.length <= run.api.BUDGET + "#hexsweeper-move=".length, `fragment is ${fragment.length} characters`);
  assert.ok(run.replaced[0].length < 32 * 1024 * 0.6);
  assert.ok(run.api.last.dropped.includes("hexsweeper-endless-plate-v1"), "the oversized Infinite plate was not dropped");
  assert.ok(run.api.last.sent.includes("hexsweeper-sphere-run-v2"), "the Sphere board did not fit");
  assert.ok(run.api.last.sent.includes("hexsweeper-classic-run-v1"), "a small board after a dropped one was not kept");
  assert.ok(run.api.last.dropped.includes("hexsweeper-flux-sphere-run-v1"), "the last board in priority order was kept past the budget");
  for (const key of ["hexsweeper-sphere-best-v1", "hexsweeper-endless-best", "hexsweeper-sphere-theme-v6", "minimal-access.v1:hex-infinite"]) {
    assert.ok(run.api.last.sent.includes(key), `${key} was dropped`);
  }
  const landed = boot(run.replaced[0]);
  assert.deepEqual([...landed.api.last.dropped], [...run.api.last.dropped]);
  assert.equal(landed.local.getItem("hexsweeper-endless-plate-v1"), null);
  assert.equal(landed.local.getItem("hexsweeper-sphere-run-v2"), saves["hexsweeper-sphere-run-v2"]);
  process.stdout.write(`  # ${fragment.length} characters; dropped ${run.api.last.dropped.join(", ")}\n`);
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
