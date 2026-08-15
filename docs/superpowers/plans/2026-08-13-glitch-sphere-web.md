# Glitch Sphere Web Implementation Plan

> **For Luke Steuber:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task by task.

**Goal:** Ship a tested, accessible Glitch Sphere experiment at `/games/hexsweeper/glitch-sphere/` without forking the canonical Sphere engine or changing its default behavior.

**Architecture:** Add a narrow optional variant lifecycle to `sphere/sphere.js`. Implement the deterministic hazard as a DOM-free UMD module and bind it through a Glitch-specific adapter and page that reuse the canonical Sphere assets. Keep save data isolated and emit a normalized completion payload exactly once.

**Tech Stack:** Static HTML/CSS, Canvas 2D, browser JavaScript, Node.js smoke/unit tests, vendored Hexasphere geometry, Chromium browser probes.

**Spec:** `docs/superpowers/specs/2026-08-13-glitch-sphere-web-design.md`

## Global Constraints

- Preserve canonical Sphere behavior when `opts.variant` is absent.
- Do not copy or maintain a second `sphere.js` fork.
- Do not hand-edit generated `collection/*.html` files.
- Do not touch Caddy, add dependencies, add a backend, or expose a new port.
- Glitch saves use `hexsweeper-glitch-sphere-run-v1`; canonical Sphere keeps its existing keys.
- Public content credits Luke Steuber and does not mention internal workflows.
- Follow test-driven development: each behavior starts with a failing focused test.
- Stage and commit only named task files after checking `git log --oneline -3`, `git diff --stat`, and `git status`.

### Task 1: Deterministic hazard state machine

**Files:**
- Create: `glitch-sphere/glitch-hazard.js`
- Create: `glitch-sphere/test-glitch-hazard.js`

**Step 1: Write failing tests**

Cover deterministic spawn selection, eligible spawn filtering, one-second movement cadence, revealed/flagged route blocking, trap result, mine result, occupied-face reveal rejection, export with remaining delay, valid restore, and invalid restore rejection.

**Step 2: Run the test and confirm RED**

Run: `node glitch-sphere/test-glitch-hazard.js`

Expected: failure because `glitch-hazard.js` does not exist or exports no engine.

**Step 3: Implement the minimum state machine**

Export a UMD global/CommonJS factory with injected `random`, `moveIntervalMs`, and `now`. Keep DOM, Canvas, storage, and Sphere internals out of this module. Return explicit results: `idle`, `waiting`, `moved`, `trapped`, `mine`, or `blocked`.

**Step 4: Run the focused test and confirm GREEN**

Run: `node glitch-sphere/test-glitch-hazard.js`

**Step 5: Commit**

Commit message: `feat(glitch-sphere): add deterministic hazard engine`

### Task 2: Optional Sphere variant lifecycle and completion contract

**Files:**
- Modify: `sphere/sphere.js`
- Create: `sphere/test-variant-contract.js`

**Step 1: Write failing contract tests**

Test the pure completion payload builder and static lifecycle contract: isolated storage/run kind, exact payload fields, stable run ID across save/restore, completion emitted once, variant save field, direct/flood reveal admission, undo snapshot participation, and no changed default key/kind when no variant exists.

**Step 2: Run the test and confirm RED**

Run: `node sphere/test-variant-contract.js`

**Step 3: Add the minimum lifecycle seam**

Support optional hooks for reset, reveal admission, first resolved dig, reveal, flag, tick, draw, undo capture/restore, export/import, default-win policy, and terminal copy. Add variant storage/run-kind options, `digAt`, `flagAt`, and exactly-once `onRunComplete`. Keep every default path byte-for-behavior compatible.

**Step 4: Run focused and regression tests**

Run:

```bash
node sphere/test-variant-contract.js
node sphere/test-neighbors.js
```

**Step 5: Commit**

Commit message: `feat(sphere): add optional variant lifecycle`

### Task 3: Glitch Sphere adapter and public route

**Files:**
- Create: `glitch-sphere/index.html`
- Create: `glitch-sphere/glitch-sphere.js`
- Create: `glitch-sphere/glitch-sphere.css`
- Create: `glitch-sphere/test-integration.js`

**Step 1: Write the failing integration test**

Assert the page has the Glitch title/metadata, shared Sphere asset references, a focusable and named canvas, polite status region, reduced-motion CSS, Glitch help/rules, and boot options for isolated storage, run kind, hazard adapter, and completion forwarding.

**Step 2: Run and confirm RED**

Run: `node glitch-sphere/test-integration.js`

**Step 3: Build the adapter and page**

Bind the Task 1 engine to Task 2 hooks. Spawn after the first resolved dig; block direct/flood reveal of the occupied face; treat revealed and flagged neighbors as closed; end on trap or mine; persist/restore the remaining delay; pause while hidden; paint a non-color-only `!` marker; update a restrained live region; add focus/arrow/Enter/Shift+Enter board controls; forward completion only to same-origin parent frames.

Reuse `../sphere/hexasphere.js`, `../sphere/sphere.js`, `../sphere/hex-bloom.js`, Sphere CSS/assets, and shared fonts. Do not duplicate Sphere engine files.

**Step 4: Run focused and regression tests**

Run:

```bash
node glitch-sphere/test-glitch-hazard.js
node glitch-sphere/test-integration.js
node sphere/test-variant-contract.js
node sphere/test-neighbors.js
```

**Step 5: Commit**

Commit message: `feat(glitch-sphere): add production web route`

### Task 4: Discovery, documentation, and browser verification

**Files:**
- Modify: `README.md`
- Modify: `PROJECT_PLAN.md`
- Modify: `choices.html`
- Create: `glitch-sphere/test-browser.mjs`

**Step 1: Add a failing browser smoke probe**

Serve the worktree statically and use the available Chromium automation to assert no local resource failures or console errors, then exercise first dig, active hazard, keyboard input, reset, restore, deterministic win/loss fixtures, reduced motion, and one completion event per terminal run at desktop and mobile viewports.

**Step 2: Update discovery and evidence-led docs**

Add Glitch Sphere under experimental routes in README and the choices hub. Record only behavior verified by tests in PROJECT_PLAN. Name the other archive variants as archived studies, not shipped features.

**Step 3: Run all project checks**

Run:

```bash
node glitch-sphere/test-glitch-hazard.js
node glitch-sphere/test-integration.js
node sphere/test-variant-contract.js
node sphere/test-neighbors.js
node wheel/test-effects.js
node wheel/test-menu-variants.js
python3 tools/export-collection.py --check
python3 tools/export-choices-lab.py --check
```

Run the browser probe and inspect captured desktop/mobile/reduced-motion states.

**Step 4: Commit**

Commit message: `docs(hexsweeper): publish Glitch Sphere experiment`

### Task 5: Review, deploy, and postflight

**Files:** No planned source edits.

**Step 1: Review the whole branch**

Generate a full diff package from the merge base and obtain a final architecture/code/accessibility review. Resolve every load-bearing finding and re-run affected checks.

**Step 2: Verify release state**

Confirm the feature worktree is clean, the live server commit and dirty-file inventory are understood, and the feature commit is on the canonical remote. Never stage the server's unrelated modifications or untracked experiments.

**Step 3: Deploy idempotently**

Update Drummer through Git using the reviewed commit. If a clean fast-forward cannot preserve the existing unrelated worktree exactly, use a temporary clean checkout and copy only the reviewed path set with a manifest and backup, then reconcile the live nested repository without staging unrelated paths.

**Step 4: Verify production**

Check HTTP 200, metadata, local resource responses, browser console, a playable first dig, visible/text Glitch status, reset, mobile viewport, reduced motion, and canonical Sphere regression at:

- `https://dr.eamer.dev/games/hexsweeper/glitch-sphere/`
- `https://dr.eamer.dev/games/hexsweeper/sphere/`

Record deployment commit, timestamp, public URL, checks, and rollback commit.
