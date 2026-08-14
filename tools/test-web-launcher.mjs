#!/usr/bin/env node
// Static contract for the generated web launcher and its three destinations.

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
const infinite = read("infinite.html");
const bounded = read("bounded.html");
const sphere = read("sphere/index.html");
const play = read("play.html");

for (const [label, href] of [
  ["Infinite", "infinite.html"],
  ["Classic", "bounded.html"],
  ["Sphere", "sphere/"],
]) {
  expect(
    launcher.includes(`href="${href}"`),
    `launcher is missing the ${label} route (${href})`,
  );
}

for (const [label, selector] of [
  ["Infinite mode at the top of the ring", 'id="infinite-game" href="infinite.html?mode=light" data-base-href="infinite.html" data-mode="infinite" data-q="0" data-r="-1"'],
  ["Classic mode at the lower-right of the ring", 'id="classic-game" href="bounded.html?size=medium" data-base-href="bounded.html" data-mode="bounded" data-q="1" data-r="0"'],
  ["Sphere mode at the lower-left of the ring", 'data-mode="sphere" data-q="-1" data-r="1"'],
  ["Infinite settings outside its mode", 'id="infinite-toggle" type="button" data-branch="infinite" data-q="0" data-r="-2"'],
  ["Classic settings outside its mode", 'id="size-toggle" type="button" data-branch="size" data-q="2" data-r="0"'],
  ["Sphere settings outside its mode", 'id="style-toggle" type="button" data-branch="style" data-q="-2" data-r="2"'],
]) {
  expect(launcher.includes(selector), `launcher lost ${label}`);
}
expect(
  launcher.includes('id="resume-game"') && launcher.includes('data-q="0" data-r="0"'),
  "Resume is no longer centered",
);
expect(
  !launcher.includes('data-branch="settings"'),
  "launcher brought back a shared settings tile instead of per-mode settings",
);
for (const branch of ["infinite", "size", "style"]) {
  expect(
    launcher.includes(`data-open-branch="${branch}"`) || template.includes(`data-open-branch="${branch}"`),
    `launcher is missing the ${branch} settings bloom`,
  );
}

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
expect(!launcher.includes("{{"), "generated launcher contains an unresolved placeholder");

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

expect(
  sphere.includes('class="web-games-back" href="../"'),
  "Sphere has no Games return",
);
expect(
  play.includes("ONEPAGER_MODES") && play.includes('id="gameCanvas"'),
  "play.html no longer contains the flat game source",
);

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
