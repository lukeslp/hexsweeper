#!/usr/bin/env node
// Static contract for the generated three-hex launcher and its destinations.

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
  expect(launcher.includes(href), `launcher is missing the ${label} route (${href})`);
}

for (const [label, selector] of [
  ["Infinite mode", 'id="infinite-game" href="infinite.html?mode=light&amp;fresh=1" data-mode="infinite" data-branch="infinite" data-q="0" data-r="-1"'],
  ["Classic mode", 'id="classic-game" href="bounded.html?size=medium&amp;new=1" data-mode="bounded" data-branch="classic" data-q="1" data-r="0"'],
  ["Sphere mode", 'id="sphere-game" href="sphere/?theme=light&amp;fresh=1" data-mode="sphere" data-branch="sphere" data-q="-1" data-r="1"'],
]) {
  expect(launcher.includes(selector), `launcher lost ${label}`);
}
expect(
  launcher.includes('id="resume-game"') && launcher.includes('data-q="0" data-r="0"'),
  "Resume is no longer centered",
);
expect(
  template.includes('class="triad"') &&
    template.includes('id="infinite-game"') &&
    template.includes('id="classic-game"') &&
    template.includes('id="sphere-game"') &&
    template.includes('id="resume-game"') &&
    template.includes('style="--q:0;--r:-1"') &&
    template.includes('style="--q:1;--r:0"') &&
    template.includes('style="--q:-1;--r:1"') &&
    template.includes('style="--q:0;--r:0"'),
  "launcher is no longer a three-hex picker with a centered Resume",
);
expect(
  !template.includes("Hexsweeper.boot") &&
    !template.includes('id="launcher-canvas"') &&
    !template.includes("function openBloom(") &&
    !template.includes("function layoutChoiceSeats("),
  "launcher kept the playable-board menu or settings blooms",
);
expect(
  core.includes("exportRunState()") && core.includes("applyRunState(data)"),
  "core no longer exposes topology-safe run persistence",
);
expect(
  bounded.includes('CLASSIC_RUN_KEY = "hexsweeper-classic-run-v1"') &&
    bounded.includes("classicGame.applyRunState(savedClassicRun)") &&
    launcher.includes("hexsweeper-classic-run-v1"),
  "Classic active runs no longer feed the centered Resume tile",
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
