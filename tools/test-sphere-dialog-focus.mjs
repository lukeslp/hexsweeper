#!/usr/bin/env node
// Quiet authored-source checks. No screen reader, speech, native export or installation.
// Reuse an available Playwright module via HEX_PLAYWRIGHT_MODULE; no npm install.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.HEX_PLAYWRIGHT_MODULE || "playwright");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mime = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png" };
const server = createServer(async (request, response) => {
  try {
    const relative = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = resolve(root, "." + relative);
    if (!file.startsWith(root + sep)) throw new Error("outside source root");
    response.setHeader("Content-Type", mime[extname(file)] || "application/octet-stream");
    response.end(await readFile(file));
  } catch (_) { response.writeHead(404).end(); }
});
let browser;
try {
  await new Promise(resolveListen => server.listen(0, "127.0.0.1", resolveListen));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const [width, height] of [[379, 336], [399, 353], [598, 530]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
    await context.addInitScript(() => { window.HEXSWEEPER_SPHERE_APP = true; });
    // Authored web source includes analytics; never let this local probe send it.
    await context.route("**/*", route => route.request().url().startsWith(origin)
      || route.request().url().startsWith("data:") ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    await page.goto(`${origin}/sphere/index.html`);
    await page.waitForFunction(() => window.HEXSWEEPER_SPHERE_GAME && !document.getElementById("tutorial-overlay").hidden);
    await page.waitForTimeout(50);
    assert.equal(await page.locator("#quiet-chrome").evaluate(node => node.inert), true,
      "late-created quiet chrome must join tutorial isolation");
    await page.keyboard.press("F");
    assert.equal(await page.evaluate(() => HEXSWEEPER_SPHERE_GAME.getState().flagMode), false,
      "tutorial keys must not activate background game shortcuts");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.id), "tutorial-play-btn");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.id), "tutorial-play-btn");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => document.activeElement.id), "tutorial-play-btn");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("tutorial-overlay").hidden);
    assert.equal(await page.evaluate(() => localStorage.getItem("hexsweeper-sphere-welcome-v1")), "1");
    assert.equal(await page.evaluate(() => document.activeElement.id), "qc-help");
    assert.equal(await page.locator("#quiet-chrome").evaluate(node => node.inert), false);

    // Programmatic activation from body catches the hidden legacy Help fallback.
    await page.evaluate(() => { document.activeElement.blur(); document.getElementById("qc-help").click(); });
    await page.waitForFunction(() => document.getElementById("help-overlay").classList.contains("open"));
    assert.equal(await page.locator("#quiet-chrome").evaluate(node => node.inert), true);
    assert.equal(await page.locator(".canvas-container").evaluate(node => node.inert), true);
    await page.locator("#help-tab-themes").click();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => {
        const node = document.activeElement;
        return document.getElementById("help-overlay").contains(node)
          && !node.closest("[hidden], [inert]") && !!node.getClientRects().length;
      }), true, "Tab must remain in the visible active sheet");
    }
    const focusBeforeResize = await page.evaluate(() => document.activeElement.id);
    await page.setViewportSize({ width: 412, height: 915 });
    await page.setViewportSize({ width, height });
    assert.equal(await page.evaluate(() => document.activeElement.id), focusBeforeResize);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.getElementById("help-overlay").hidden);
    assert.equal(await page.evaluate(() => document.activeElement.id), "qc-help");

    await page.locator("#qc-help").click();
    await page.locator("#help-tab-play").click();
    await page.locator("#help-history-btn").click();
    await page.waitForFunction(() => document.getElementById("history-lightbox").classList.contains("open"));
    assert.equal(await page.locator("#history-lightbox").evaluate(node => node.inert), false);
    assert.equal(await page.locator("#help-overlay").evaluate(node => node.inert), true);
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.id), "lightbox-close-btn");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.getElementById("history-lightbox").hidden);
    assert.equal(await page.locator("#help-overlay").evaluate(node => node.inert), false);
    assert.equal(await page.locator("#quiet-chrome").evaluate(node => node.inert), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), "help-history-btn");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.getElementById("help-overlay").hidden);
    assert.equal(await page.evaluate(() => document.activeElement.id), "qc-help");

    for (let i = 0; i < 2; i++) {
      await page.locator("#qc-help").click();
      await page.locator("#help-tutorial-btn").click();
      await page.waitForFunction(() => !document.getElementById("tutorial-overlay").hidden);
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement.id), "tutorial-play-btn");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.getElementById("tutorial-overlay").hidden);
      assert.equal(await page.evaluate(() => document.activeElement.id), "qc-help");
    }

    await page.evaluate(() => {
      const prior = document.createElement("div"); prior.id = "prior-isolated";
      prior.inert = true; prior.setAttribute("aria-hidden", "true"); document.body.appendChild(prior);
      document.getElementById("qc-help").click();
      const late = document.createElement("button"); late.id = "late-background"; document.body.appendChild(late);
    });
    await page.waitForFunction(() => document.getElementById("late-background").inert);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.getElementById("help-overlay").hidden);
    assert.deepEqual(await page.evaluate(() => ({
      priorInert: document.getElementById("prior-isolated").inert,
      priorAria: document.getElementById("prior-isolated").getAttribute("aria-hidden"),
      lateInert: document.getElementById("late-background").inert,
      lateAria: document.getElementById("late-background").getAttribute("aria-hidden"),
      pristine: HEXSWEEPER_SPHERE_GAME.getState().isFirstClick,
    })), { priorInert: true, priorAria: "true", lateInert: false, lateAria: null, pristine: true });
    assert.deepEqual(errors, []);
    console.log(`${width}×${height}: native tutorial trap/seen marker, visible Help return, hidden-tab exclusion, nested modal restore, resize continuity, replay cleanup, prior/late inert state — passed`);
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
