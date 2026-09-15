# Flux Sphere and Games Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the archived Flux Sphere promise as a tested entangled-pairs game and publish direct games-index links to all eight intentional Hexsweeper experiments.

**Architecture:** Add a DOM-free deterministic pair engine and bind it to the existing Sphere variant lifecycle through one reveal-scoped safe-face API. Reuse all canonical Sphere UI and rendering. Treat the root games catalog as a separately backed-up static deployment artifact because no repository owns it.

**Tech Stack:** Static HTML/CSS, Canvas 2D, browser JavaScript, Node.js tests, vendored Hexasphere geometry, Chromium CDP smoke tests, Caddy-served static deployment.

**Spec:** `docs/superpowers/specs/2026-08-13-flux-sphere-worlds-design.md`

## Global Constraints

- Preserve canonical Sphere behavior and storage when `opts.variant` is absent.
- Flux uses `hexsweeper-flux-sphere-run-v1` and run kind `flux-sphere`.
- Never duplicate `sphere.js`, hand-edit generated collection exports, change Caddy, add a backend, or expose a port.
- Pair identities stay hidden until a reveal resolves; Flux must not disclose covered safe faces.
- Use test-driven development and capture the expected RED before production edits.
- Credit Luke Steuber in public artifacts and do not publish internal workflow terminology.
- Before every commit inspect `git log --oneline -3`, `git diff --stat`, and `git status`; stage only named paths.
- Deploy Hexsweeper by pinned Git SHA and the root catalog by explicit path backup plus hash manifest.

---

### Task 1: Deterministic Flux pair engine

**Files:**
- Create: `flux-sphere/flux-pairs.js`
- Create: `flux-sphere/test-flux-pairs.js`

**Interfaces:**
- Consumes: Sphere-like `cells[]` and `tiles[].centerPoint` arrays.
- Produces: `createFluxPairs({ cells, tiles })` with `activate()`, `partnerFor(index)`, `exportState()`, `restore(saved)`, and `reset()`.

- [ ] Write tests for stable farthest pairing, symmetry, safe/covered eligibility, odd eligible counts, partner lookup, reset, round-trip restore, and malformed mapping rejection.
- [ ] Run `node flux-sphere/test-flux-pairs.js`; confirm RED because the module does not exist.
- [ ] Implement the minimum DOM-free UMD pair engine with no randomness or storage access.
- [ ] Run the focused test and confirm GREEN.
- [ ] Inspect commit preflight and commit only the pair engine and test as `feat(flux-sphere): add deterministic pair engine`.

### Task 2: Reveal-scoped Sphere variant API

**Files:**
- Modify: `sphere/sphere.js`
- Modify: `sphere/test-variant-contract.js`

**Interfaces:**
- Consumes: variant `reveal(context)` notifications.
- Produces: `context.revealSafeFaces(indices) -> number[]`, callable only during an accepted direct-reveal notification.

- [ ] Add contract tests proving the wished-for API opens a safe partner and its zero flood inside the same undo snapshot, rejects mines/flags/invalid indexes, is inert outside the reveal notification, does not recurse into `variant.reveal`, and is unavailable to canonical no-variant behavior.
- [ ] Run `node sphere/test-variant-contract.js`; confirm the new tests fail because `revealSafeFaces` is missing.
- [ ] Implement the reveal-window guard and safe target helper, reusing `scheduleRevealVisual`, `floodFrom({notify:false})`, and canonical win/persistence ordering.
- [ ] Run `node sphere/test-variant-contract.js && node sphere/test-neighbors.js && node glitch-sphere/test-integration.js`; confirm GREEN.
- [ ] Regenerate Sphere collection exports with `python3 tools/export-collection.py`.
- [ ] Inspect commit preflight and commit the engine, tests, and generated exports as `feat(sphere): support linked variant reveals`.

### Task 3: Flux route, adapter, and accessible feedback

**Files:**
- Create: `flux-sphere/index.html`
- Create: `flux-sphere/flux-sphere.js`
- Create: `flux-sphere/flux-sphere.css`
- Create: `flux-sphere/test-integration.js`

**Interfaces:**
- Consumes: `FluxPairs`, `SphereSweeper.boot`, `initHexBloom`, and `context.revealSafeFaces`.
- Produces: `FluxSphere.boot(options)`, isolated save/run identity, live status, keyboard adapter, transient endpoint drawing, and completion forwarding.

- [ ] Write integration tests for metadata, canonical assets, named focusable canvas, instructions, live status, reduced motion, isolated boot options, first-dig activation, safe echo, mined-dig suppression, flagged-partner hold, undo/restore, terminal copy, keyboard control, and same-origin completion forwarding.
- [ ] Run `node flux-sphere/test-integration.js`; confirm RED because the route modules do not exist.
- [ ] Implement the adapter, page, and CSS by following the Glitch route’s validated shell without copying the Sphere engine.
- [ ] Run Flux pair/integration tests plus Sphere variant/neighbors and Glitch integration regressions.
- [ ] Inspect commit preflight and commit the named Flux files as `feat(flux-sphere): add entangled pairs route`.

### Task 4: Discovery, docs, CI, and browser evidence

**Files:**
- Modify: `README.md`
- Modify: `PROJECT_PLAN.md`
- Modify: `choices.html`
- Modify: `.github/workflows/ci.yml`
- Create: `flux-sphere/test-browser.mjs`

**Interfaces:**
- Consumes: the complete Flux route and existing static-export pipeline.
- Produces: project discovery, CI gates, and deterministic desktop/mobile browser evidence.

- [ ] Add a browser test that initially fails because Flux fixtures and expected route discovery are absent.
- [ ] Add Flux to the experimental choices flow and evidence-led documentation; add its Node suites to CI.
- [ ] Exercise canonical Sphere and Flux at desktop/mobile/reduced-motion sizes: first dig, echo, keyboard, undo, restore, deterministic win/loss, exactly-once completion, console errors, and local-resource failures.
- [ ] Run all Node suites, JS syntax checks, `export-collection.py --check`, `export-choices-lab.py --check`, `export-collection.py --app`, and `git diff --check`.
- [ ] Re-vendor the ignored app payload into a clean `lukeslp/hexsweeper-app` checkout and pass that repository’s smoke/drift gate.
- [ ] Inspect commit preflight and commit named docs, CI, and browser files as `docs(hexsweeper): publish Flux Sphere experiment`.

### Task 5: Root games catalog and social metadata

**Files:**
- Create: `/Users/luke/workshop/solarwar-comparison-deploy/test-games-index-links.mjs`
- Modify: `/Users/luke/workshop/solarwar-comparison-deploy/games-index.html`
- Deploy: `/home/coolhand/www/dr.eamer.dev/games/index.html`
- Deploy: `/home/coolhand/www/dr.eamer.dev/games/social-card.png`

**Interfaces:**
- Consumes: eight verified public Hexsweeper routes and `assets/social/home-og.png`.
- Produces: eight semantic catalog cards and valid Open Graph/Twitter image metadata.

- [ ] Write a catalog test asserting the exact eight approved paths, unique card headings, semantic row structure, and the social-card metadata/file contract.
- [ ] Run it against the current artifact and confirm RED for the eight missing links and absent social asset.
- [ ] Insert the eight cards immediately after Hexsweeper using the catalog’s existing `article` pattern and decorative icon semantics.
- [ ] Copy the reviewed 1200×630 Hexsweeper social image into the deployment artifact as `social-card.png`; run the test and confirm GREEN.
- [ ] Validate every catalog href and asset through a local static server before deployment.

### Task 6: Repository reconciliation and production deployment

**Files:** No additional planned source files.

**Interfaces:**
- Consumes: reviewed Hexsweeper commits and catalog artifacts.
- Produces: pinned public deployment with reversible backups and verified HTTP/browser state.

- [ ] Re-run PR/upstream checks for Hexsweeper, hexsweeper-app, and every separately owned current catalog project; record unrelated open work without merging it.
- [ ] Run the full fresh release verification, inspect the complete diff from `91a856b`, and confirm both worktrees are clean.
- [ ] Push the reviewed Hexsweeper SHA and wait for required GitHub checks.
- [ ] On Drummer, capture timestamped SHA/status/diff/untracked manifests; fast-forward only if the live Hexsweeper worktree has no overlapping paths.
- [ ] Back up the live games index and record absence/presence plus hashes for `social-card.png`; copy only the reviewed catalog artifacts.
- [ ] Verify all 28 catalog card destinations/actions, all assets, `/sphere/`, `/flux-sphere/`, `/glitch-sphere/`, desktop/mobile/reduced-motion browser behavior, public hashes, and no console/resource errors.
- [ ] Record exact rollback paths, deployed SHAs, checks, and any unrelated repository-health findings.
