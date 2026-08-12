#!/usr/bin/env node
"use strict";

const assert = require("assert");
const variants = require("./menu-variants.js");

assert.strictEqual(variants.resolve("").id, "base");
assert.strictEqual(variants.resolve("?menu=base").id, "base");
assert.strictEqual(variants.resolve("?menu=takeover").id, "takeover");
assert.strictEqual(variants.resolve("?menu=underwater").id, "underwater");
assert.strictEqual(variants.resolve("?dock=faces").id, "takeover");
assert.strictEqual(variants.resolve("?dock=faces-water").id, "underwater");
assert.strictEqual(variants.resolve("?menu=nope").id, "base");
assert.strictEqual(variants.resolve("?menu=base", "faces-water").id, "underwater");
assert.ok(Object.isFrozen(variants.PROFILES));
assert.ok(Object.isFrozen(variants.PROFILES.takeover));
assert.strictEqual(variants.ARRANGEMENT, "sphere-center-v1");
assert.deepStrictEqual(variants.RING_ACTIONS, [
  "lightdark",
  "warnings",
  "undo",
  "flagmode",
  "invert",
  "size",
]);
assert.strictEqual(variants.CENTER_ACTION, "reset");
for (const profile of Object.values(variants.PROFILES)) {
  assert.strictEqual(profile.arrangement, variants.ARRANGEMENT);
  assert.strictEqual(profile.anchor === "dock", false);
}

function face(index, x, y, z = 1) {
  return { index, sides: 6, z, center: { x, y } };
}

function patch(index, x, y, ringY = y) {
  return {
    center: face(index, x, y),
    ring: Array.from({ length: 6 }, (_, i) =>
      face(index * 10 + i + 1, x + (i - 2.5) * 4, ringY)
    ),
  };
}

const center = patch(1, 50, 50);
const lowPartial = patch(2, 50, 82, 58);
const lowComplete = patch(3, 54, 88, 76);
const nonHex = patch(4, 50, 50);
nonHex.ring[2].sides = 5;
assert.strictEqual(variants.isHexPatch(center), true);
assert.strictEqual(variants.isHexPatch(nonHex), false);
assert.strictEqual(
  variants.choosePatch([nonHex, center], { x: 50, y: 50 }).center.index,
  1
);
assert.strictEqual(variants.choosePatch([nonHex], { x: 50, y: 50 }), null);
assert.strictEqual(
  variants.choosePatch([lowComplete, center], { x: 50, y: 50 }).center.index,
  1
);
assert.strictEqual(
  variants.choosePatch([center, lowPartial, lowComplete], {
    x: 50,
    y: 80,
    belowY: 70,
  }).center.index,
  3
);
assert.strictEqual(
  variants.choosePatch([center, lowPartial], {
    x: 50,
    y: 80,
    belowY: 70,
  }).center.index,
  2
);
assert.strictEqual(variants.choosePatch([], { x: 0, y: 0 }), null);

console.log("Water Wheel menu variant tests — OK");
