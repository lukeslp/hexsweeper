#!/usr/bin/env node
// Static contract for the generated playable launcher and its three destinations.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const launcher = read("index.html");
const template = read("tools/app-launcher.html");
const core = read("core.js");
const infinite = read("infinite.html");
const bounded = read("bounded.html");
const sphere = read("sphere/index.html");
const play = read("play.html");

for (const [label, href] of [
  ["Infinite", "infinite.html"],
  ["Classic", "bounded.html"],
  ["Sphere", "sphere/"],
]) {
  expect(launcher.includes(`href="${href}`), `launcher is missing the ${label} route (${href})`);
}

for (const [label, selector] of [
  ["Infinite mode", 'id="infinite-game" type="button" data-mode="infinite" data-branch="infinite" data-out-q="0" data-out-r="-1" data-q="0" data-r="-1"'],
  ["Classic mode", 'id="classic-game" type="button" data-mode="bounded" data-branch="classic" data-out-q="1" data-out-r="0" data-q="1" data-r="0"'],
  ["Sphere mode", 'id="sphere-game" type="button" data-mode="sphere" data-branch="sphere" data-out-q="-1" data-out-r="1" data-q="-1" data-r="1"'],
]) {
  expect(launcher.includes(selector), `launcher lost ${label}`);
}
expect(
  launcher.includes('id="resume-game"') && launcher.includes('data-q="0" data-r="0"'),
  "Resume is no longer centered",
);
expect(
  launcher.includes('id="launcher-canvas"') && launcher.includes('role="application"'),
  "launcher is no longer a keyboard-addressable playable board",
);
expect(
  launcher.includes("Hexsweeper.boot({") && launcher.includes("endless: true"),
  "launcher no longer boots the real endless Hexsweeper engine",
);
expect(
  core.includes("function isProtectedCell(cell)") && core.includes("hooks.onCellAction"),
  "core lost the protected-preset or embedded-cell activation seam",
);
expect(
  template.includes("function layoutChoiceSeats()") && template.includes("choice.dataset.layoutIndex"),
  "launcher choices are no longer assigned connected seats from branch data",
);
expect(
  template.includes("protectedKeys.has(key(cell.q, cell.r))") && template.includes("api.dig(cell)"),
  "preset cells are not guaranteed safe or revealed through the game engine",
);
expect(
  template.includes("function drawDangerRings(") && template.includes("cell.neighborMines = 0"),
  "launcher brought numeric count glyphs back instead of nested danger hexes",
);
expect(
  template.includes("touch-action: none") && launcher.includes("const panThreshold = digSession.forcePan || state.endless ? 8 : 18"),
  "launcher lost drag-vs-dig input handling",
);
expect(
  launcher.includes("Long-press flags on touch") && launcher.includes("floodFrom(startCell)"),
  "launcher lost real flag or zero-flood behavior from core",
);
expect(
  template.includes('LAUNCHER_ZOOM_KEY = "hexsweeper-launcher-zoom-v1"') &&
    template.includes("zoomStorageKey: LAUNCHER_ZOOM_KEY") &&
    template.includes('id="zoom-out-tool"') &&
    template.includes('id="zoom-in-tool"'),
  "launcher zoom is not explicit, persistent, or isolated from game lanes",
);
expect(
  !template.includes("function fitLayout()") && !template.includes("theme-hub"),
  "launcher brought back the fixed fitted flower menu",
);

expect(
  launcher.includes('location.replace("play.html" + location.search + location.hash)'),
  "legacy root queries do not forward to play.html",
);
for (const key of ["mode", "theme", "deal"]) {
  expect(launcher.includes(`params.has("${key}")`), `legacy ${key} query is not preserved`);
}
expect(
  launcher.includes('class="launcher-fallback"') && launcher.includes("<noscript>"),
  "launcher has no no-script route fallback",
);
expect(
  launcher.includes('data-goatcounter="https://stats.dr.eamer.dev/count"'),
  "launcher analytics tag is missing",
);
expect(!/\{\{[A-Z_]+\}\}/.test(launcher), "generated launcher contains an unresolved placeholder");

for (const [label, page, canonical] of [
  ["Infinite", infinite, "/infinite.html"],
  ["Classic", bounded, "/bounded.html"],
]) {
  expect(page.includes('class="app-back" href="index.html"'), `${label} has no Games return`);
  expect(page.includes(`rel="canonical" href="https://dr.eamer.dev/games/hexsweeper${canonical}"`), `${label} canonical is wrong`);
}

for (const [label, page] of [
  ["Infinite", infinite],
  ["Classic", bounded],
  ["Sphere", sphere],
]) {
  expect(!page.includes("user-scalable=no"), `${label} disables browser zoom`);
  expect(!page.includes("maximum-scale=1"), `${label} caps browser zoom`);
}

expect(sphere.includes('class="web-games-back" href="../"'), "Sphere has no Games return");
expect(play.includes("ONEPAGER_MODES") && play.includes('id="gameCanvas"'), "play.html no longer contains the flat game source");

for (const placeholder of [
  "{{CORE_JS}}",
  "{{INFINITE_HREF}}",
  "{{BOUNDED_HREF}}",
  "{{SPHERE_HREF}}",
  "{{PLATFORM_HEAD}}",
  "{{PLATFORM_TAIL}}",
]) {
  expect(template.includes(placeholder), `shared launcher template lost ${placeholder}`);
}

if (failures.length) {
  console.error(`web launcher contract failed (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("web launcher contract: ok");
