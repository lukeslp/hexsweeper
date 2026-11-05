#!/usr/bin/env node
// Quiet reload checks against the real --app export; no device or speech.
// Run the exporter first. Reuse Playwright via HEX_PLAYWRIGHT_MODULE; no install.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.HEX_PLAYWRIGHT_MODULE || "playwright");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = "hexsweeper-sphere-native-ui-v1";
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
const server = createServer(async (request, response) => {
  try {
    const file = resolve(root, "." + decodeURIComponent(new URL(request.url, "http://localhost").pathname));
    if (!file.startsWith(root + sep)) throw new Error("outside source root");
    response.setHeader("Content-Type", mime[extname(file)] || "application/octet-stream");
    response.end(await readFile(file));
  } catch (_) { response.writeHead(404).end(); }
});
let browser;
let origin;
const boot = (page, restore) => page.evaluate(value => window.__restoreNativeUiSession?.(value), restore);
const ready = page => page.waitForFunction(() => !!window.HEXSWEEPER_SPHERE_GAME);
const isOpen = page => page.evaluate(() => {
  const help = document.getElementById("help-overlay");
  return !help.hidden && help.classList.contains("open");
});
const snapshot = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
async function reload(page, restore) {
  await page.reload();
  await ready(page);
  await boot(page, restore);
  await page.waitForTimeout(80);
}
async function contextFor(width, height, init) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
  await context.route("**/*", route => route.request().url().startsWith(origin)
    || route.request().url().startsWith("data:") ? route.continue() : route.abort());
  if (init) await context.addInitScript(init);
  return context;
}
try {
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: "chrome", headless: true });
  let scrollFixtures = 0;
  for (const [width, height] of [[379, 336], [399, 353], [598, 530]]) {
    const context = await contextFor(width, height, () => {
      localStorage.setItem("hexsweeper-sphere-welcome-v1", "1");
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    await page.goto(`${origin}/build/app/index.html`);
    await ready(page);
    await page.locator("#qc-help").click();
    await page.locator("#help-tab-themes").click();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), KEY), null,
      "ordinary page use must not write a native UI snapshot before bootstrap");
    await boot(page, false);
    await page.evaluate(() => {
      document.querySelector('[data-theme="heat-lightning"]').focus({ preventScroll: true });
      document.getElementById("help-tabstack").scrollTop = 180;
    });
    await page.waitForTimeout(80);
    const before = await page.locator("#help-tabstack").evaluate(node => node.scrollTop);
    if (before > 0) scrollFixtures++;
    assert.deepEqual(Object.keys(await snapshot(page)).sort(), ["focus", "open", "scroll", "tab", "version"],
      "UI snapshot contains only bounded metadata, never DOM or game state");
    await reload(page, true);
    assert.equal(await isOpen(page), true, "native recreation must reopen the previously open Help");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.theme), "heat-lightning");
    assert.ok(Math.abs(await page.locator("#help-tabstack").evaluate(node => node.scrollTop) - before) <= 1);
    assert.equal(await page.locator("#quiet-chrome").evaluate(node => node.inert), true);
    assert.equal(await page.evaluate(() => document.querySelector('.help-tab[aria-selected="true"]').dataset.tab), "themes");

    // Preserve a real existing setting control's focus without activating it.
    await page.locator("#help-tab-themes").click();
    await page.locator('[data-theme="dark"]').focus();
    await reload(page, true);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.theme), "dark");
    assert.equal(await page.locator("#help-panel-themes").evaluate(node => node.hidden), false);
    // A duplicate native callback must not add listeners or reopen a closed sheet.
    await boot(page, true);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(230);
    assert.equal(await page.evaluate(() => document.activeElement.id), "qc-help");
    assert.equal((await snapshot(page)).open, false);
    await reload(page, true);
    assert.equal(await isOpen(page), false, "closed Help must remain closed across recreation");

    for (const close of ["#help-close-btn", "#help-done-btn", "Escape"]) {
      await page.locator("#qc-help").click();
      if (close === "Escape") await page.keyboard.press("Escape");
      else await page.locator(close).click();
      await page.waitForTimeout(230);
      assert.equal((await snapshot(page)).open, false, `${close} must snapshot dismissal`);
      await reload(page, true);
      assert.equal(await isOpen(page), false, `${close} must not resurrect Help`);
    }

    await page.locator("#qc-help").click();
    await page.locator("#help-overlay").click({ position: { x: 1, y: 1 } });
    assert.equal(await isOpen(page), true, "outside Help tap must preserve the existing non-dismissal behavior");
    assert.equal((await snapshot(page)).open, true);
    await reload(page, true);
    assert.equal(await isOpen(page), true);
    assert.equal(await page.locator("#tutorial-overlay, #history-lightbox, #help-tutorial-btn").count(), 0,
      "maintenance-only tutorial/history must not be reintroduced to current main");
    assert.equal(await page.evaluate(() => HEXSWEEPER_SPHERE_GAME.getState().isFirstClick), true);

    // Fresh cold native bootstrap clears old UI state rather than reopening it.
    await page.waitForTimeout(30);
    await reload(page, false);
    assert.equal(await isOpen(page), false);
    assert.equal((await snapshot(page)).open, false);
    assert.deepEqual(errors, []);
    console.log(`${width}×${height}: gated metadata, repeated Help/tab/inner-scroll/focus reload, Close/Done/Escape, unchanged outside behavior, preserved main entry and fresh-cold reset — passed`);
    await context.close();
  }
  assert.ok(scrollFixtures > 0, "at least one real current-main cover fixture must exercise nonzero inner scrolling");

  const first = await contextFor(399, 353);
  const firstPage = await first.newPage();
  await firstPage.goto(`${origin}/build/app/index.html`);
  await ready(firstPage);
  const welcomeBefore = await firstPage.evaluate(() => localStorage.getItem("hexsweeper-sphere-welcome-v1"));
  await boot(firstPage, false);
  assert.equal(await isOpen(firstPage), false, "fresh native main entry must stay on the board");
  assert.equal(await firstPage.locator("#tutorial-overlay, #history-lightbox").count(), 0);
  assert.equal(await firstPage.locator("#quiet-chrome").evaluate(node => node.inert), false);
  assert.equal(await firstPage.evaluate(() => localStorage.getItem("hexsweeper-sphere-welcome-v1")), welcomeBefore,
    "UI bootstrap must not change current main's existing welcome marker");
  assert.equal((await snapshot(firstPage)).open, false);
  await first.close();

  const web = await contextFor(399, 353, () => localStorage.setItem("hexsweeper-sphere-welcome-v1", "1"));
  const webPage = await web.newPage();
  await webPage.goto(`${origin}/build/app/index.html`);
  await ready(webPage);
  await webPage.evaluate(key => {
    window.HEXSWEEPER_SPHERE_APP = false;
    localStorage.setItem(key, "untouched");
  }, KEY);
  await boot(webPage, false);
  await webPage.locator("#qc-help").click();
  assert.equal(await webPage.evaluate(key => localStorage.getItem(key), KEY), "untouched",
    "native hook must not read/reset/write UI state outside the native surface");
  await web.close();

  // Malformed or future-version records must not change the native entry policy.
  for (const invalid of ["{broken", '{"version":99,"open":true}', '{"version":1,"open":"yes","tab":"play"}']) {
    const context = await contextFor(399, 353, () => localStorage.setItem("hexsweeper-sphere-welcome-v1", "1"));
    const page = await context.newPage();
    await page.goto(`${origin}/build/app/index.html`);
    await ready(page);
    await page.evaluate(({ key, invalid }) => localStorage.setItem(key, invalid), { key: KEY, invalid });
    await boot(page, true);
    assert.equal(await isOpen(page), false);
    assert.equal((await snapshot(page)).open, false);
    await context.close();
  }
  const blocked = await contextFor(399, 353, () => {
    for (const name of ["getItem", "setItem", "removeItem"]) {
      Storage.prototype[name] = () => { throw new DOMException("blocked", "SecurityError"); };
    }
  });
  const page = await blocked.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  await page.goto(`${origin}/build/app/index.html`);
  await ready(page);
  await boot(page, true);
  await page.waitForTimeout(80);
  assert.equal(await isOpen(page), false, "blocked storage must preserve current main's immediate board entry");
  await page.locator("#qc-help").click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(230);
  assert.equal(await page.locator("#quiet-chrome").evaluate(node => node.inert), false);
  assert.deepEqual(errors, []);
  await blocked.close();
  console.log("main immediate-entry policy, non-native guard, corrupt/future storage and blocked storage — passed");
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
