/*
 * File Purpose: Guard the Water Wheel's drowned-detonation rule — a fuse that
 *   expires underwater sets off a chord on every satisfied number the mine was
 *   touching, instead of ending the run.
 * Primary Functions/Classes: lifts chordTargets/chordClear/lightChordMine/
 *   drownedBlast out of wheel/sphere.js and runs them against a stub board
 *   with injected leaf dependencies, so the real chord rule is exercised
 *   rather than a stub of it. sphere.js is a browser IIFE with no module
 *   surface, so the functions are extracted by brace balancing — renaming one
 *   fails this test loudly instead of silently skipping it.
 * Inputs: wheel/sphere.js. Outputs: process exit 0/1 plus a per-case log.
 * Run: node wheel/test-drowned-blast.js
 * Author: Luke Steuber <luke@lukesteuber.com>
 */
"use strict";

const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "sphere.js"), "utf8");

function lift(name) {
  const start = src.indexOf(`    function ${name}(`);
  if (start < 0) throw new Error(`${name}() not found in wheel/sphere.js`);
  let depth = 0;
  for (let k = src.indexOf("{", start); k < src.length; k++) {
    if (src[k] === "{") depth++;
    else if (src[k] === "}" && !--depth) return src.slice(start, k + 1);
  }
  throw new Error(`${name}() braces never close`);
}

const NAMES = [
  "chordTargets",
  "chordClear",
  "lightChordMine",
  "chordAt",
  "drownedBlast",
  "drownArmedMine",
];
const body = NAMES.map(lift).join("\n\n");

/*
 * Face 0 is the armed mine. Every neighbour is a different branch of the rule:
 *
 *   1  open "1", touches only the mine  -> satisfied ONLY once it drowns;
 *                                          clears 7 (a zero, cascades) and 8
 *   2  open "2", mine + flag 9          -> satisfied; its one target is mine 10
 *   3  open "2", mine + covered 11      -> still one short, must not fire
 *   4  covered                          -> not a chord source
 *   5  open "0"                         -> no count, not a chord source
 *   6  open "1", touches only the mine  -> satisfied; clears 12
 */
function makeBoard() {
  const cell = (o) => ({
    isMine: false,
    revealed: false,
    flagged: false,
    doused: false,
    neighborMines: 0,
    animReveal: 0,
    ...o,
  });
  const cells = [
    cell({ isMine: true, revealed: true, animReveal: 1 }), // 0 armed mine
    cell({ revealed: true, neighborMines: 1 }), //             1
    cell({ revealed: true, neighborMines: 2 }), //             2
    cell({ revealed: true, neighborMines: 2 }), //             3
    cell({ neighborMines: 1 }), //                             4 covered
    cell({ revealed: true, neighborMines: 0 }), //             5 open zero
    cell({ revealed: true, neighborMines: 1 }), //             6
    cell({ neighborMines: 0 }), //                             7 covered zero
    cell({ neighborMines: 2 }), //                             8
    cell({ flagged: true, neighborMines: 1 }), //              9 flag
    cell({ isMine: true }), //                                10 hidden mine
    cell({ neighborMines: 1 }), //                            11
    cell({ neighborMines: 1 }), //                            12
  ];
  const neighbors = [
    [1, 2, 3, 4, 5, 6],
    [0, 7, 8],
    [0, 9, 10],
    [0, 11],
    [0],
    [0],
    [0, 12],
    [1],
    [1],
    [2],
    [2],
    [3],
    [6],
  ];
  return {
    cells,
    tiles: neighbors.map((neighborIndices) => ({ neighborIndices })),
    scale: 100,
    rescueCount: 0,
    reduceMotion: true,
    isGameOver: false,
    armedMineIdx: 0,
    flagsPlaced: 1,
    mineCount: 2,
    isFirstClick: false,
  };
}

function run(state, entry, at) {
  // `at` is the argument list for the entry point (defaults to [0]).
  const calls = {
    armMine: [],
    flood: [],
    alert: [],
    revealVisual: [],
    checkWin: 0,
    persist: 0,
    ui: 0,
    bob: 0,
    clearArmed: 0,
    captureUndo: 0,
    fx: [],
  };
  const deps = {
    state,
    performance: { now: () => 1000 },
    clearArmedMine: () => {
      calls.clearArmed++;
      state.armedMineIdx = -1;
    },
    bobImpulse: () => calls.bob++,
    scheduleRevealVisual: (n) => calls.revealVisual.push(n),
    floodFrom: (n) => {
      calls.flood.push(n);
      return new Set();
    },
    armMine: (n) => {
      calls.armMine.push(n);
      state.armedMineIdx = n;
    },
    setWheelAlert: (m) => calls.alert.push(m),
    updateUI: () => calls.ui++,
    checkWin: () => calls.checkWin++,
    persistNow: () => calls.persist++,
    scheduleFrame: () => {},
    // Present so an accidental undo capture inside the blast is caught: it
    // would snapshot a revealed-but-not-doused mine and corrupt the rewind.
    captureUndo: () => calls.captureUndo++,
    wheelFx: { emit: (type, event) => calls.fx.push([type, event]) },
    surfaceYAt: () => 500,
    wheelFaceRadius: () => 20,
    Math,
    String,
    Set,
  };
  const names = Object.keys(deps);
  const make = new Function(
    ...names,
    `${body}\nreturn { drownedBlast, chordAt, drownArmedMine, chordTargets };`
  );
  const api = make(...names.map((n) => deps[n]));
  api[entry === undefined ? "drownedBlast" : entry](...(at === undefined ? [0] : at));
  return calls;
}

let failures = 0;
function ok(condition, message) {
  console.log((condition ? "  ok   " : "  FAIL ") + message);
  if (!condition) failures++;
}

console.log("drownedBlast — the mine drowns, its satisfied numbers chord");
let state = makeBoard();
let calls = run(state);
ok(
  state.cells[0].doused && state.cells[0].revealed && !state.cells[0].flagged,
  "the spent mine is left doused and open"
);
ok(state.rescueCount === 1, "the drowning counts as a rescue");
ok(calls.clearArmed === 1, "the spent fuse is cleared first");
ok(calls.captureUndo === 0, "no undo snapshot mid-blast (Undo rewinds the dig)");
ok(
  state.cells[7].revealed && state.cells[8].revealed,
  "face 1 chords once the mine drowns — it was satisfied by nothing else"
);
ok(state.cells[12].revealed, "face 6 chords too — every satisfied neighbour fires");
ok(!state.cells[11].revealed, "face 3 is still one short and does not fire");
ok(state.cells[9].flagged && !state.cells[9].revealed, "the flag is untouched");
ok(calls.flood.length === 1 && calls.flood[0] === 7, "a cleared zero cascades");
ok(calls.armMine.length === 1 && calls.armMine[0] === 10, "the uncovered mine is armed");
ok(state.cells[10].revealed, "the chained mine is uncovered");
ok(calls.checkWin === 0 && calls.alert.length === 0, "no win check or safe alert while a fuse is live");

console.log("drownedBlast — only one mine may light across the whole blast");
state = makeBoard();
state.cells[8] = { ...state.cells[8], isMine: true };
calls = run(state);
ok(calls.armMine.length === 1, "exactly one mine arms");
ok(calls.armMine[0] === 8, "it is the first the blast reaches, in neighbour order");
ok(!state.cells[10].revealed, "the second mine stays covered");

console.log("drownedBlast — a clean sweep reports the faces it opened");
state = makeBoard();
state.cells[10] = { ...state.cells[10], isMine: false, neighborMines: 1 };
calls = run(state);
ok(calls.armMine.length === 0, "nothing re-arms");
ok(state.cells[10].revealed, "the former mine slot clears as an ordinary face");
ok(calls.checkWin === 1 && calls.persist === 1, "the win is checked and the run saved");
ok(
  /BLOWN UNDER · 4 FACES CLEARED/.test(calls.alert[0] || ""),
  "the alert counts the faces: " + calls.alert[0]
);

console.log("drownedBlast — nothing satisfied means nothing fires");
state = makeBoard();
[1, 2, 6].forEach((n) => {
  state.cells[n].neighborMines = 3;
});
calls = run(state);
ok(calls.armMine.length === 0 && calls.flood.length === 0, "no chord fires");
ok(
  !state.cells[7].revealed && !state.cells[12].revealed,
  "no face opens off an unsatisfied number"
);
ok(/NOTHING TO SET OFF/.test(calls.alert[0] || ""), "the empty-blast alert is used");
ok(state.cells[0].doused && state.rescueCount === 1, "the mine is spent either way");

/*
 * chordAt() is the ordinary tap-chord and now shares chordTargets/chordClear
 * with the blast, so the refactor is guarded here too.
 */
console.log("chordAt — the tap chord still behaves");
state = makeBoard();
state.armedMineIdx = -1;
state.cells[0].doused = true; // face 1 and 6 are satisfied by the doused mine
calls = run(state, "chordAt", [1]);
ok(calls.captureUndo === 1, "a tap chord takes exactly one undo snapshot");
ok(state.cells[7].revealed && state.cells[8].revealed, "its targets clear");
ok(!state.cells[12].revealed, "only the tapped face chords, not its siblings");
ok(calls.checkWin === 1 && calls.persist === 1, "the win is checked and the run saved");

console.log("chordAt — an unsatisfied number is inert");
state = makeBoard();
state.armedMineIdx = -1;
state.cells[0].doused = true;
calls = run(state, "chordAt", [3]); // face 3 is still one short
ok(calls.captureUndo === 0, "no undo snapshot is taken");
ok(!state.cells[11].revealed, "nothing opens");

console.log("chordAt — a live fuse blocks chording");
state = makeBoard();
state.cells[0].doused = true; // armedMineIdx is still 0
calls = run(state, "chordAt", [1]);
ok(calls.captureUndo === 0 && !state.cells[7].revealed, "the chord is refused");

console.log("chordAt — a chord onto a mine lights it");
state = makeBoard();
state.armedMineIdx = -1;
state.cells[0].doused = true;
calls = run(state, "chordAt", [2]); // face 2's only target is mine 10
ok(calls.armMine.length === 1 && calls.armMine[0] === 10, "the mine arms");
ok(calls.checkWin === 0, "no win check while a fuse is live");

/*
 * drownArmedMine() is the deliberate drowning — Luke's rule that the sea
 * contains the blast rather than defusing it. It must be the same event as a
 * fuse expiring underwater, fx included.
 */
console.log("drownArmedMine — holding it under detonates it, it does not quench");
state = makeBoard();
const proj = { index: 0, center: { x: 100, y: 600 } };
calls = run(state, "drownArmedMine", [state.cells[0], 1000, proj, {}]);
ok(state.cells[0].doused, "the held mine is spent");
ok(
  state.cells[7].revealed && state.cells[8].revealed && state.cells[12].revealed,
  "it chords exactly as a fuse expiring underwater does"
);
ok(calls.fx.length === 1 && calls.fx[0][0] === "detonate", "it fires a detonation, not a quench");
ok(calls.fx[0][1].underwater === true, "the detonation is flagged underwater");
ok(
  !calls.fx.some(([type]) => type === "quench"),
  "the quench channel is no longer emitted by the game"
);

console.log("drownedBlast — a fuse expiring underwater emits the same detonation");
state = makeBoard();
calls = run(state, "drownedBlast", [0, { x: 1, y: 2, surfaceY: 3, r: 4, underwater: true }]);
ok(calls.fx.length === 1 && calls.fx[0][0] === "detonate", "one detonation is emitted");
ok(calls.fx[0][1].underwater === true, "still flagged underwater");

/*
 * The rule Luke asked after: a mine that has just gone off must count toward
 * its neighbours' totals, or nothing around it could ever be satisfied and the
 * blast would be inert. Asserted directly on chordTargets, both ways round.
 */
console.log("chordTargets — the detonated mine counts toward its neighbours");
state = makeBoard();
let api = null;
{
  const calls = { probe: true };
  // Reuse the harness purely to build the closure, then poke chordTargets.
  const deps = {
    state,
    performance: { now: () => 1000 },
    clearArmedMine: () => {},
    bobImpulse: () => {},
    scheduleRevealVisual: () => {},
    floodFrom: () => new Set(),
    armMine: () => {},
    setWheelAlert: () => {},
    updateUI: () => {},
    checkWin: () => {},
    persistNow: () => {},
    scheduleFrame: () => {},
    captureUndo: () => {},
    wheelFx: { emit: () => {} },
    surfaceYAt: () => 500,
    wheelFaceRadius: () => 20,
    Math,
    String,
    Set,
  };
  const names = Object.keys(deps);
  api = new Function(...names, `${body}\nreturn { chordTargets };`)(
    ...names.map((n) => deps[n])
  );
  void calls;
}
// Face 1 is an open "1" whose only mine neighbour is face 0.
ok(api.chordTargets(1) === null, "before it blows, face 1 is one short and cannot chord");
state.cells[0].doused = true;
const after = api.chordTargets(1);
ok(
  Array.isArray(after) && after.length === 2,
  "once it is doused the same face is satisfied and offers its two targets"
);
// Face 2 needs the flag AND the spent mine to add up.
ok(
  Array.isArray(api.chordTargets(2)),
  "a face counting one flag plus the spent mine is satisfied too"
);

if (failures) {
  console.error(`\nWater Wheel drowned-blast tests — ${failures} FAILED`);
  process.exit(1);
}
console.log("\nWater Wheel chord + drowned-blast tests — OK");
