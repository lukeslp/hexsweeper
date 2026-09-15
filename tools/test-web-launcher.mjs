#!/usr/bin/env node
// Static contract for the generated web surface: Sphere at the root, the
// three-hex launcher at launcher.html, and their destinations.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const rootPage = read("index.html");
const launcher = read("launcher.html");
const appRoot = read("build/app/index.html");
const template = read("tools/app-launcher.html");
const core = read("core.js");
const infinite = read("infinite.html");
const bounded = read("bounded.html");
const sphere = read("sphere/index.html");
const play = read("play.html");

for (const [label, href] of [
  ["Infinite", "infinite.html"],
  ["Classic", "bounded.html"],
  ["Sphere", "index.html"],
]) {
  expect(launcher.includes(href), `launcher is missing the ${label} route (${href})`);
}

// Root is Sphere itself: sealed engine, Mercury available, Games pill down to
// the launcher, and no prompt in the way — Sphere restores its own autosave.
expect(rootPage.includes("HEXSWEEPER_SPHERE_GAME"), "root Sphere does not expose the game");
expect(!rootPage.includes("resume-gate"), "root Sphere still carries a resume prompt");
expect(!rootPage.includes('class="app-back"'), "root Sphere grew a Games pill; the sphere is the front door");
expect(rootPage.includes('id: "mercury"') && rootPage.includes("global.MirrorMaterial = {"), "root Sphere is missing the Mercury theme or its renderer");
expect(rootPage.includes('<link rel="stylesheet" href="fonts/fonts.css">'), "root Sphere inlines fonts instead of linking them");
expect(rootPage.includes('rel="canonical" href="https://dr.eamer.dev/games/hexsweeper/"'), "root canonical is wrong");
expect(rootPage.includes('location.replace("play.html" + location.search + location.hash)'), "legacy ?mode= root queries do not forward to play.html");
expect(!rootPage.includes("user-scalable=no"), "root Sphere disables browser zoom");
expect(rootPage.includes('data-goatcounter="https://stats.dr.eamer.dev/count"'), "root analytics tag is missing");
expect(rootPage.includes('name: "Mercury"') && sphere.includes('src="mirror-material.js?v='), "Sphere page does not load the reflection renderer");

// App payload is Sphere and nothing else: no launcher, no flat games, no pill.
expect(appRoot.includes("window.HEXSWEEPER_SPHERE_APP = true;"), "app root is not the sealed Sphere");
expect(!appRoot.includes("resume-gate"), "app root still carries a resume prompt");
expect(!appRoot.includes('class="app-back"'), "app root grew a Games pill");
expect(!existsSync(join(root, "build/app/games")), "app payload still ships games/ (launcher, Infinite, Classic)");
expect(appRoot.includes('id: "mercury"') && appRoot.includes("global.MirrorMaterial = {"), "app root is missing Mercury or its renderer");
expect(appRoot.includes("initQuietChrome") && !appRoot.includes("initHexBloom("), "app root does not boot the quiet chrome");
expect(appRoot.includes('id="help-theme-grid"') && appRoot.includes('id="help-size-grid"') && !appRoot.includes('id="help-warn-grid"'), "settings sheet should carry theme + size and no warnings group (themes own it)");
expect(appRoot.includes("HEXSWEEPER_REFLECTION_TEXTURES = (function(){") && appRoot.includes("data:image/webp;base64,"), "app root does not seal the reflection textures");
expect(!appRoot.includes("HEXSWEEPER_REFLECTION_TEXTURE_BASE = "), "app root still assigns a texture URL base");
expect(rootPage.includes('HEXSWEEPER_REFLECTION_TEXTURE_BASE = "sphere/"'), "web root does not point reflection textures at sphere/");
for (const id of ["stratosphere", "ion-storm", "aurora", "galaxy", "gilded-ribbon", "heat-lightning"]) {
  expect(rootPage.includes(`id: "${id}"`), `root Sphere is missing the ${id} theme`);
}
for (const id of ["stratosphere", "ion-storm", "galaxy", "gilded-ribbon", "heat-lightning"]) {
  expect(appRoot.includes(`"${id}":{desktop:t`), `app root does not seal the ${id} texture`);
}
expect(existsSync(join(root, "sphere/assets/reflections/stratosphere-1024.webp")) && existsSync(join(root, "sphere/assets/reflections/ion-storm-768.webp")), "reflection textures are not under sphere/assets/reflections");
expect(!appRoot.includes("https://stats.dr.eamer.dev"), "app root leaks analytics");

for (const [label, selector] of [
  ["Infinite mode", 'id="infinite-game" href="infinite.html?mode=light&amp;fresh=1" data-mode="infinite" data-branch="infinite" data-q="0" data-r="-1"'],
  ["Classic mode", 'id="classic-game" href="bounded.html?size=medium&amp;new=1" data-mode="bounded" data-branch="classic" data-q="1" data-r="0"'],
  ["Sphere mode", 'id="sphere-game" href="index.html?theme=light&amp;fresh=1" data-mode="sphere" data-branch="sphere" data-q="-1" data-r="1"'],
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
  launcher.includes('rel="canonical" href="https://dr.eamer.dev/games/hexsweeper/launcher.html"'),
  "launcher canonical is wrong",
);
expect(
  template.includes('href: "{{SPHERE_HREF}}?resume=1"'),
  "Sphere resume route does not skip the root gate",
);
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
  expect(page.includes('class="app-back" href="launcher.html"'), `${label} has no Games return`);
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

expect(sphere.includes('class="web-games-back" href="../launcher.html"'), "Sphere has no Games return");
expect(sphere.includes("window.HEXSWEEPER_SPHERE_GAME = sphereGame;"), "Sphere page no longer exposes the game");
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
