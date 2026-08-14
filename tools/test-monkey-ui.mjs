#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(route, file) {
  return fs.readFileSync(path.join(root, route, file), "utf8");
}

function pngSize(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.toString("ascii", 1, 4), "PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

for (const route of ["monkey-grid", "monkey-sphere"]) {
  test(`${route} uses the shared minimalist game surface`, () => {
    const html = read(route, "index.html");
    const css = `${read(".", "monkey-shell.css")}\n${read(route, "game.css")}`;

    assert.doesNotMatch(html, /class="masthead"|class="eyebrow"|class="gesture-hint"/);
    assert.match(html, /class="game-hud"/);
    assert.match(html, /class="status-capsule"[^>]*role="status"/);
    assert.match(html, /class="control-rail"/);
    assert.match(css, /#game-canvas\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/s);
    assert.match(css, /\.game-hud\s*\{[^}]*pointer-events:\s*none/s);
  });

  test(`${route} ships four named icon controls with coherent local SVG`, () => {
    const html = read(route, "index.html");
    for (const id of ["back-link", "undo-button", "new-button", "help-button"]) {
      const control = html.match(new RegExp(`<(?:a|button)\\b[^>]*id="${id}"[^>]*>[\\s\\S]*?<\\/(?:a|button)>`));
      assert.ok(control, `missing ${id}`);
      assert.match(control[0], /aria-label="[^"]+"/);
      assert.match(control[0], /<svg\b[^>]*class="action-icon"[^>]*viewBox="0 0 24 24"/);
      assert.match(control[0], /<title>/, `${id} icon needs an SVG title`);
    }
    assert.equal((html.match(/class="control-label"/g) || []).length, 0, "icon rail should not carry visible labels");
  });

  test(`${route} bundles jungle art and preserves readable focus/reduced-motion states`, () => {
    const html = read(route, "index.html");
    const css = `${read(".", "monkey-shell.css")}\n${read(route, "game.css")}`;
    assert.match(html, /<link\b[^>]*rel="preload"[^>]*as="image"[^>]*jungle-[^"]+\.webp/);
    assert.match(css, /url\("assets\/jungle-[^"]+\.webp"\)/);
    assert.match(css, /:focus-visible\s*\{[^}]*outline:/s);
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    assert.match(css, /@media\s*\(forced-colors:\s*active\)/);
    const asset = html.match(/href="(assets\/jungle-[^"]+\.webp)"/);
    assert.ok(asset && fs.statSync(path.join(root, route, asset[1])).size > 1000, "missing bundled jungle texture");
  });

  test(`${route} exposes a full keyboard board action`, () => {
    const html = read(route, "index.html");
    const js = read(route, "game.js");
    assert.match(html, /id="board-instructions"/);
    assert.match(html, /Arrow keys/i);
    assert.match(html, /Enter/i);
    assert.match(html, /aria-describedby="board-instructions"/);
    assert.match(js, /event\.key\s*===\s*"Arrow/);
    assert.match(js, /event\.key\s*===\s*"Enter"/);
    assert.match(js, /keyboardSelected/);
  });

  test(`${route} publishes a route-specific screenshot card`, () => {
    const html = read(route, "index.html");
    assert.match(html, new RegExp(`<link rel="canonical" href="https://dr\\.eamer\\.dev/games/hexsweeper/${route}/">`));
    assert.match(html, new RegExp(`<meta property="og:image" content="https://dr\\.eamer\\.dev/games/hexsweeper/${route}/assets/og-card\\.png">`));
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
    assert.deepEqual(pngSize(path.join(root, route, "assets", "og-card.png")), { width: 1200, height: 630 });
  });
}
