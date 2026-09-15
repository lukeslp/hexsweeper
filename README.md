# Hexsweeper

[![Play Hexsweeper](https://img.shields.io/badge/Play-live-7c3aed?logo=gamepad&logoColor=white)](https://dr.eamer.dev/games/hexsweeper/)
[![CI](https://github.com/lukeslp/hexsweeper/actions/workflows/ci.yml/badge.svg)](https://github.com/lukeslp/hexsweeper/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2ea44f.svg)](LICENSE)

A hexagonal minesweeper in three shapes: an endless plate, a fixed classic
board, and a closed 3D sphere. The web and native apps share one launcher:
three mode hexes around a centered Resume. Tap a mode to start with the last
used settings; each game keeps its own customize controls.

**[Play Hexsweeper on dr.eamer.dev](https://dr.eamer.dev/games/hexsweeper/).**

## Run locally

Serve the repository with any static web server, then open `index.html` in a
modern browser. The generated web routes are committed, so no build is needed
to play; run the exporter after changing their source files.

```bash
python3 -m http.server 8080
```

## Deployment

This repository root is the deployed web root: the live site serves these
files directly, so a commit on the default branch is a release. The generated
routes (`index.html`, `launcher.html`, `infinite.html`, `bounded.html`, and the
`collection/` one-pagers) are committed; run the exporter after changing their
sources and CI checks that they match. IBM Plex is self-hosted under `fonts/`
under the SIL Open Font License 1.1. No font CDN is used.

## Boards (production)

| Choice | Board | Route |
|------|--------|------|
| **Infinite** | Endless Light/Dark plate; the run persists | `infinite.html` |
| **Classic** | Fixed neumorphic board; the run persists | `bounded.html` |
| **Sphere** | Closed 3D Goldberg sphere | `index.html` (root) · `sphere/` (source) |

The root opens straight into Sphere, which restores its own unfinished run
without asking, and carries no chrome of its own beyond the sphere's two corner
glyphs (Menu, Help). The three-hex games menu — Infinite, Classic, Sphere, with
the newest run in the center Resume tile — lives at `launcher.html`, reached
from Infinite's and Classic's **‹ Games** pill or from the sphere's Help sheet
("Also Games · Infinite · Classic"). A mode tap starts a fresh run using the
last used style, board size, or theme. Settings live inside each game.

The former five-mode flat production surface remains at `play.html` for its
distinct materials and mechanics:

| Theme | Board | Feel |
|------|--------|------|
| **Light** | Infinite | Porcelain chalk desk — bright raised covers, graphite wells (seam-only LOD when zoomed out; full extrusion when zoomed in) |
| **Dark** | Infinite | Night-iron plate — cold steel bevels, deep wells (same infinite run as Light; same zoom LOD) |
| **Fire** | Finite | Magma shaft / hell-mine well — dense viewport-filling honeycomb; drag tilts the pit (camera locked); hold to flag |
| **Plague** | Finite | Soil hive bed + living mycelial underlay + green specimen tiles + hyphal mat (seam-only LOD at extreme zoom-out) |
| **Escape** | Infinite | Opens on a patch then pulls wide; dig/flag/chord toward an offscreen finish (edge cue); rift heartbeats and reaches toward your digs |

Fire and Plague open on the **large** board; board size (S·M·L) lives in Menu and only appears for those two, since the infinite themes have no fixed board.

OG cards: `assets/social/<card>-og.png` for production themes (`home`, `light`, `dark`, `fire`, `plague`, `escape`), lab skins (`skin-<id>`), and `sphere`. Social **title** and **description** live in `tools/export-collection.py` (`ogTitle` / `ogDescription` on `THEMES`), `skins.json` (per lab skin), and `sphere/index.html`; `tools/og-card.html` mirrors them for PNG captions. Example plate title: *Neumorphic Hexagonal Minesweeper*. Older Fire studies stay as `fire-og-alt.png`, `fire-og-bloom.png`. Rebuild PNGs with `tools/shoot-og-cards.sh` (reads card keys from `tools/og-card.html`, shoots headless at 2×, downscales to 1200×630). Requires Chromium + Pillow on Drummer; set `BASE=` to override the live URL. Cycle flat-game themes with the theme control or `T`. Deep-link `play.html?mode=light|dark|fire|plague|escape` (aliases: `white`, `minimalist`, `rift`, `magma-core`, `biolume-reef`); add `&deal=1` to open a starting patch. Legacy root query links forward to the same route. Preference key: `hexsweeper-mode-v3`.

First visit asks if you've played minesweeper (`hexsweeper-welcome-v1`). Chrome: lower-right **Appearance (sun/moon) · Reset · Menu** as matching icons — Appearance only on the infinite Light/Dark plate. Scores, modes, board size, flag, help, export/import, and outbound links (Luke Steuber · Data Poems) live in Menu. Fire / Plague / Escape restyle the Menu panel to match their materials.

Fresh runs (cold load or Reset) share one `startFreshRun` path after theme chrome is applied, so Escape intro zoom and plate framing match between first paint and restart.

### Interaction

| Action | How |
|--------|-----|
| Dig | Click / tap — empty floods open outward in rings |
| Flag | Right-click, Ctrl/⌘-click, long-hold, or Menu → Flag (`F`) |
| Pan / tilt | Infinite: drag pans (view stays put on dig/flood). Fire: drag tilts the pit (hold flags). Space/middle-drag pans anywhere |
| Zoom | Scroll · pinch · `+` / `−` (persists as `hexsweeper-zoom-v1`) |
| Chord | Click a revealed number whose neighbor flags match the count |
| Restart / size | `R`, Restart, or S·M·L (finite only) — each clears that lane’s autosave |
| Export / Import | Menu → Export / Import (infinite Light/Dark/Escape JSON) |

Infinite runs autosave to `localStorage` (`hexsweeper-endless-plate-v1` for Light/Dark, `hexsweeper-endless-escape-v1` for Escape).

### Profiles, materials, and effects

Flat-game choices are composed in `play.html` from four declarative axes:

- **Mode profile** — finite/endless topology, camera behavior, rules, and autosave lane.
- **Material** — the existing Canvas renderer/material record and its color tokens.
- **Cosmetic effects profile** — ambient, reveal, and flag particles. These channels can be enabled independently without changing the board or save lane.
- **Endgame profile** — mandatory semantic win/loss feedback. Infinite Light/Dark and Fire use the shared detonation; Plague uses infection; Escape uses the rift catch.

Light and Dark deliberately use the `quiet-plate` cosmetic profile: tile motion carries normal digs, while the full shared bomb detonation remains intact. **Effects: Reduced** selects the detonation's calm, non-shaking path; it never removes loss feedback. This profile seam is the supported path for promoting collection materials or effects into future skins. Material changes must not restart a run, alter rules, or change persistence lanes.

## Layout

| File | Role |
|------|------|
| `index.html` | Generated web landing: the sealed Sphere game |
| `launcher.html` | Generated three-hex games menu |
| `infinite.html` | Generated endless Light/Dark product page |
| `bounded.html` | Generated fixed Classic product page |
| `play.html` | Flat five-mode game source (Light/Dark/Fire/Plague/Escape) |
| `core.js` | Shared engine: hex grid, endless growth, input, hooks |
| `skin-chrome.css` | Shared nav / settings / overlay chrome (lab + classic) |
| `fonts/` | Self-hosted IBM Plex Sans/Mono + `OFL.txt` |
| `collection/` | Production + lab one-pagers; Copy HTML desk (CodePen-ready) |
| `tools/app-launcher.html` | Shared web/native launcher source |
| `tools/export-collection.py` | Regenerates web routes and collection one-pagers |
| `sphere/` | Canonical closed 3D sphere game (Canvas projection) |
| `flux-sphere/` | **Experimental** distant paired-reveal route on the shared Sphere engine |
| `glitch-sphere/` | **Experimental** moving-hazard route on the shared Sphere engine |
| `monkey-grid/` | **Experimental** flat Catch the Monkey route-blocking game |
| `monkey-sphere/` | **Experimental** spherical Catch the Monkey portal chase |
| `choices.html` | Curated hub: production, sphere, lab links — not in theme switcher |
| `choices/lab/` | Generated redirects to `collection/skin-*.html` |
| `tools/export-choices-lab.py` | Regenerates `choices/lab/*.html` redirect stubs |
| `classic.html` | Lab baseline neumorph skin |
| `lab.html` + `skins.json` + `skins/` | Dormant visual lab — not linked from production |

## Collection (one-pagers)

Self-contained files for paste into CodePen (or anywhere HTML runs). **Copy HTML** lives on the [collection desk](collection/) only — playable pens are game-only (Reset/Menu).

| File | Theme |
|------|--------|
| [`collection/`](collection/) | Desk with **Open** + **Copy HTML** (Production + Lab + Experiments) |
| `collection/theme-plate.html` | Light / Dark · Infinite (in-file toggle; keeps the run) |
| `collection/theme-fire.html` | Fire · Finite |
| `collection/theme-plague.html` | Plague · Finite |
| `collection/theme-escape.html` | Escape · Infinite |
| `collection/skin-*.html` | Ten lab skins from `skins.json` (game-only exports; each has OG meta) |
| `collection/sphere.html` | Hexsweeper 3D — self-contained sphere one-pager (CodePen-ready) |
| `collection/water-wheel.html` | Water Wheel — self-contained dousing-game one-pager with tutorial art |
| `build/app/wheel.html` | The Water Wheel sealed for the native app (app-flagged: globe themes dropped; its own tutorial on first visit; Sphere pill home) — reached by holding the mine count on the sphere or the wave button on the sheet's Board tab. The wheel **floats**: a spring–damper bob and sway forced by a two-frequency swell, churned down by spinning, hopped by a quench, slammed by a detonation (`BOB`/`tickBob` in `wheel/sphere.js`; the waterline stays anchored to the frame) |
| `collection/polyhedron.html` | Dodecahedron campaign — 12 connected panels with 19/37/61 cells per panel |
| `collection/sphere-reflection*.html` | Obsidian Mirror studies — five procedural environments plus fifteen image-backed surfaces, including animated storm, cloud, ink, and oil-cell plates |
| `collection/sphere-kimi.html` | Visual take: Moon Ink Orrery |
| `collection/sphere-claude.html` | Visual take: Amber Codex |
| `collection/sphere-muse.html` | Visual take: Starlit Void |
| `collection/sphere-face-takeover.html` | Control study: seven real sphere faces become the menu |
| `collection/sphere-equator-ribbon.html` | Archived V1: draggable depth-sorted equator ribbon |
| `collection/sphere-interior.html` | **Played from inside the sphere.** The chamber projection promoted from menu affordance to game mode: the concave wall is the board, `pickTile` follows draw order instead of filtering to the near hemisphere, and chrome falls back to a plain modal (`sphere-ux/interior-chrome.js`). Live at `../sphere-ux/?play=inside` |
| `collection/sphere-inside.html` | The menu inside the sphere: seats drawn as real geometry in the renderer's own depth sort, so the board's faces occlude them as it turns (`sphere-ux/inner-menu.js`, live at `../sphere-ux/?dock=inside`) |
| `collection/sphere-eggshell.html` | Spatial study V4: fast interlocking split with a renderer-native inner shell |
| `collection/sphere-chamber.html` | Spatial study V4: continuous center-out fold into a tessellated inner chamber |
| `collection/sphere-polar-capstan.html` | Rejected archive: faceted control spindle |
| `collection/sphere-polar-crown.html` | Captured prior art: reset hub with six promising geodesic petals |
| `collection/sphere-polar-drill.html` | Rejected archive: telescoping concentric controls |
| `collection/sphere-polar-lid.html` | Rejected archive: hinged 2–3–2 control panel |
| `collection/catch-monkey-garden.html` | Game study: flat route-blocking chase toward the garden rim |
| `collection/catch-monkey-orbit.html` | Game study: spherical route-blocking chase toward three portals |
| `sphere/takes/*.json` | Model design specs for the three takes |
| `sphere/assets/textures/` | Responsive Earth 4K/2K gloss maps and Moon 2K daymap (`?theme=earth\|moon`) |
| `collection/index.html` | Desk tile grid — sphere + takes under Experiments (Open + Copy HTML) |

Regenerate after production or lab skin changes:

```bash
python3 tools/export-collection.py
python3 tools/export-collection.py --check   # CI / drift guard
python3 tools/export-choices-lab.py          # choices/lab redirect stubs
```

Production exports inline `core.js`, chrome CSS, and IBM Plex (base64 woff2).
Each theme file sets `window.HEXSWEEPER_ONEPAGER` (`allowModes:
["light","dark"]` on the plate; single `mode` on the others). Lab skins boot
via `Hexsweeper.boot` in their source files. Welcome stays hidden on production
pens. The live multi-theme game remains available at `play.html`.

## Shared launcher

`python3 tools/export-collection.py --app` stages the sealed Capacitor payload in
`build/app/`. On both surfaces the root page is Sphere itself, sealed from
`sphere/` by the exporter (`export_sphere_web` / `export_sphere_app`). The
native payload is **only** that page plus the help image: Infinite, Classic,
and the launcher are web-only. On the web the games menu is rendered from
`tools/app-launcher.html` to `launcher.html`.

Nothing stands between the root and the board: Sphere restores its own
autosave silently, and saved Infinite / Classic runs are reached through the
launcher's Resume tile. Sphere honors `?fresh=1` (the launcher's "play Sphere"
route) by starting a new board instead of restoring. `tools/test-app-sphere-browser.mjs`
drives the sealed app page in headless Chrome: cold start with no prompt and no
Games chrome, corner Menu → flower on one tap, first-tap Undo, Theme tile
through to Mercury with its WebGL canvas up.

The launcher is three hexes — **Infinite**, **Classic**, and **Sphere** — with an
empty seat in the middle. Tapping a mode opens that game at once with its
last-used settings (Infinite theme from `hexsweeper-mode-v3`, Classic size from
`hexsweeper-classic-size-v1`, Sphere theme from `hexsweeper-sphere-theme-v6`);
the small caption under each name shows the value that will load. Style, size,
and theme are changed inside each game, not on the launcher. Appearance follows
`hexsweeper-appearance-v1` (system / light / dark) and is independent of
gameplay.

When an unfinished Infinite, Classic, or Sphere autosave exists, the newest run
fills the center seat as a mode-colored **Resume** hex and the status line
names it. The launcher never mutates save blobs; only the Resume route restores
one. Classic snapshots mines, reveals, flags, size, time, and view state before
the Games transition. `tools/test-web-launcher.mjs` is the contract test; it
checks the three routes, the Resume seat, and the export.

## Engine API

Skins and the production page boot via:

```js
Hexsweeper.boot({
  canvasId: "gameCanvas",
  theme: { /* colors */ },
  difficulty: "medium", // easy | medium | hard
  showStats: false,
  hooks: {
    layout, onRelayout, onReset, onExpand, onMaxRadius,
    transformPoint, hitTest, usePathHitTest, sortCells,
    cameraLock, // bool|fn — drag updates pointer tilt, not cam (Fire)
    beforeFrame, drawCell, decorateCell, afterFrame,
    onReveal, onFlag, onGameOver,
  },
});
```

Also exported: `Hexsweeper.DEFAULT_THEME`, `DEFAULT_CONFIG`, `SQRT3`.

## Sphere

Closed Goldberg sphere minesweeper at [`sphere/`](sphere/) — https://dr.eamer.dev/games/hexsweeper/sphere/

- Canvas 2D projection of vendored hexasphere math (no Three.js)
- Dig / flag / flood over geodesic `neighborIndices`; first dig safe; win/lose
- Starts pulled back (~0.72×); scroll/pinch to zoom; drag for full 360° tumble (yaw+pitch); flag mode + long-hold; RM-safe camera
- **Heights** (highest → lowest): flagged (pure red fill, no glyph, stands proud of the shell as a pin) → covered shell → numbered clears → empty clears. Tiers only apply in numerals · rings · borderless; flush/yellow stay a flat field. Hover temporarily lifts activatable faces over their own tier, so a proud flag still lifts. Borderless drops the recessed-floor grid. **N** / count button cycles numerals · rings · yellow · flush · borderless (`hexsweeper-sphere-countstyle-v1`)
- **Autosave:** mid-run state in `hexsweeper-sphere-run-v1` (resume on refresh); Reset and size changes confirm before discarding progress
- Minimal help: short lede, color history tile → [CoolmathGames history](https://www.coolmathgames.com/blog/the-history-of-minesweeper) + lightbox
- Densities: **XS** = 162 · **S** = 362 · **M** = 1002 · **L** = 1442 · **XL** = 2252 (~17% mines; size button cycles XS→XL)
- Flood expand: BFS ring stagger + brief flash/pop (logic opens immediately; paint catch-up; RM-safe)
- **Chrome:** `sphere/quiet-chrome.js` — no menu. A small top readout (mines left · seconds) and a bottom bar of bare glyphs: **Undo · New sphere · Flag** (red while armed) on the left, **?** on the right; 52×56 targets on touch. Everything else lives in the ? sheet, which is the settings sheet: gesture table, **Theme** grid (nine swatches), **Board size** (XS–XL, starts a new sphere), Invert and Effects pills, tutorial relaunch, Done. **Themes own the warning treatment** (`theme.warn` = count paint · relief · seams): on the Light/Dark model, Light, Dark, Aurora and Stratosphere are numbers · depth · seams; Mercury, Galaxy, Ion Storm, Gilded Ribbon and Heat Lightning have continuous interiors and drop the seams (Galaxy's counts are the line-based nested rings in soft white). **Interiors**: Mercury's per-face liquid-metal decal (`CORE_PROFILES` → `drawMetalCore(proj, now, "metal")`, view-locked band + a gleam that lags the rotation), recoloured for Ion Storm (cobalt), Gilded Ribbon (gold) and Heat Lightning (copper) since 2026-09-01, and Galaxy's whole-sphere **black hole** (`INTERIOR_EFFECTS` → `drawInteriorEffect` → `drawBlackHole`: star field pushed outward by the mass, a Keplerian accretion disc with the approaching side Doppler-bright and the far side lensed over the top and under the bottom, a breathing photon ring, the horizon at 0.16 R, a star spiralling in every ~6.5 s — painted once per frame through the union of squarely-facing cleared faces, z > 0.22, after clipping to the sphere's disc, digits repainted on top). Aurora and Stratosphere clear to **mono wells** — a single flat colour with depth and seams, exactly like Light/Dark (Stratosphere's are white with dark digits and light cliff walls; Aurora's dark). The remaining palettes (`METAL_PALETTES` verdigris/light/ivory) and painters (`drawAuroraCurtains`, `drawPlasmaFilaments`, `drawSkyClouds`, `drawLightningBolts`) remain in the file unmapped — one `CORE_PROFILES`/`INTERIOR_EFFECTS` entry brings any back. `interiorEffectLive` keeps the frame loop running while an effect is visible; reduced motion freezes the hole and drops the flashes and bolts. Each effect is one `INTERIOR_EFFECTS` entry and one commit, so any of them can be reverted alone. Every mirror material has its own flag sheen (`FLAG_SHEENS`; Stratosphere and Gilded Ribbon lacquer red, Heat Lightning steel blue); reflection themes skip the raised hover/press pass but keep the pressed face in the normal pass so a long-press flag paints during the hold. The hex-bloom flower and the on-sphere face menu (`getMenuPatch` / `focusPatch` / rotate-only mode) remain in the engine and `hex-bloom.js` for the flux/glitch variants and the studio, but the canonical sphere no longer mounts them. Legacy dev-chrome HUD pills remain for `sphere/dev/`.
- **Themes:** Light · Shell · Dark · Ink · **Float** (Light + contact shadow) · **Card** (Ink + contact shadow) · **Glow** (luminous dig centers) · **Earth** / **Moon** (globe-map daymaps, `?theme=earth|moon`) · **Mercury** (the reflection studio's Smoked Mercury material as a theme: WebGL mirrored body from `sphere/mirror-material.js`, etched crust, liquid-metal wells, gilded flags; procedural, so it also ships offline in the app; falls back to a plain metal field without WebGL) · **Stratosphere** (light chrome: a sky environment map drifting across the mirror, glass wells) · **Ion Storm** (dark: a hybrid-mapped storm cloud on a lagging frame — the reflection carries inertia and trails the rotation, with a slow pulse) · **Aurora** (procedural curtains, no texture) · **Galaxy** (environment-mapped dust) · **Gilded Ribbon** (surface ribbon on a lagging frame) · **Heat Lightning** (hybrid, pulsing). Every material has a themed interior (see Chrome above) and a themed **flag sheen** in its own metal or light (`FLAG_SHEENS`). Vocabulary: faces are **cleared** (not dug); flags mark where you think a mine is. The textured ones are texture-backed — `sphere/assets/reflections/*.webp` on the web (pages outside `sphere/` set `HEXSWEEPER_REFLECTION_TEXTURE_BASE`), sealed as data URIs (1024 files, ~300KB) in the app; wells opposite the shell — `hexsweeper-sphere-theme-v6`
- **Customize panel:** in-run theme/board tweaks with one-step undo; share card capture wired from the panel
- **Rotation:** `resize()` records the CSS size it measured; `syncCanvasSize()` runs at the top of every frame and rebuilds the backing store whenever the bitmap stops matching its element, and `resizeSoon()` re-measures over the next two frames plus 250 ms after `resize` / `orientationchange` / `visualViewport.resize`. iOS drops or mis-times the orientation resize — one event arrives with the old layout, none follows, and the board stays stretched forever. The mirror canvas carries the same guard. Contract covers portrait → landscape → portrait plus a deliberately corrupted bitmap.
- **Drag:** vertical follows the finger (drag down → the face under it moves down); horizontal is mirrored by default (drag right → the face moves left — Luke's call, so both axes feel like turning the same object), at ~1.3× tracking: rotation is `0.9 / state.scale` rad per px, so the feel is the same at every zoom and screen size (a fixed rad/px used to overshoot 2× on phones and 4× on desktops). Invert X/Y live on the Settings tab (Invert X gives finger-following X); Sphere and Wheel use v5 preference keys and drop the ambiguous older values so the current object-turning default wins once.
- **Android rendering:** Sphere and Wheel cap their Canvas 2D backing stores at 1.1×, cache rotation terms, cull the far hemisphere before projecting boundaries, and reuse projected geometry for recessed faces. On boards of 642 faces or more, direct and ambient rotation use a compact front-hemisphere projection; direct drags also stop hit-testing once the gesture becomes a drag. Moving frames temporarily drop labels, glows and depth skirts, while Light and Dark batch same-style faces into compound paths instead of filling and stroking every tile separately. The complete detailed frame returns whenever motion stops, then the static canvas parks until input, resize, or another animation makes it dirty. Reflection themes keep their selected image plate and palette through a lighter Android shader at a 25 fps material budget; web and Apple builds retain the full atmospheric shader.
- **Settings sheet (?):** touch-sized (360px wide, 44pt controls, keyboard hints hidden on touch) and **tabbed — Play · Themes · Board · Settings** (`role=tablist`, arrow keys, last tab remembered in `hexsweeper-sphere-sheet-tab-v1`): Play holds the gesture table, rules and tutorial relaunch; Themes the nine-swatch grid; Board the size pills with best times; Settings the Invert/Effects pills (horizontal drag is mirrored and vertical drag follows the finger by default; the invert pref lives under `hexsweeper-sphere-invert-v5`, older keys are dropped on load); title, ×, Done and credits stay fixed — every choice applies live and reads pressed. **Best times** live under the size pills: `hexsweeper-sphere-best-v1` keeps the fastest clear per board size (canonical sphere only; a run revived by Undo still counts), and the win banner reads *First clear at this size*, *New best (was …)* or *Best …*. **A hidden second sphere:** hold the mine count in the top readout — water rises through it, and holding through the fill drops into the Water Wheel (`HEXSWEEPER_WHEEL_HREF`, set per surface by the exporter: `wheel/` at the web root, `wheel.html` in the app, the live URL from a pen); a visually hidden button gives screen-reader users the same door, and the sheet's Board tab carries a small sinking-hex-under-waves button (`#help-wheel-btn`, icon only — no hint sentence) that opens it too. The Wheel gets a Sphere pill home. **First launch** shows a short tutorial sheet instead (Tap / Hold / Drag, first dig safe, where the bar and ? are; `boot({ onWelcome })`), which marks `hexsweeper-sphere-welcome-v1`; `?welcome=1` forces the sheet, `?welcome=0` skips. Pens pre-set the key; the web root and the app do not. **End-of-game banner** is a labelled card in the same grammar — Share · Undo · New sphere. **Share** hands the card to the native `HexShare` plugin as an image when running in the app (full iOS share roster), else Web Share with a File, else download.
- **Endgame FX:** lose — graph-distance mine cascade + particle burst + shock ring; win — clearance pulse + confetti-lite (`prefers-reduced-motion`: instant states)

Smoke: `node sphere/test-neighbors.js` (neighbor symmetry + flood closure at
subdivisions 6, 10, 12) and `node wheel/test-effects.js` (profile/event
contract plus drawing-surface smoke). `node wheel/test-menu-variants.js`
guards the Water Wheel menu-profile aliases and projected patch selection, and
`node wheel/test-drowned-blast.js` guards both the tap chord and the
drowned-detonation chord (it lifts `chordTargets`/`chordClear`/`lightChordMine`
/`chordAt`/`drownedBlast` straight out of `wheel/sphere.js` by brace balancing,
so renaming one fails the test rather than skipping it).

Sphere is the root; Infinite and Classic sit beside it on `launcher.html`. The
broader flat game remains at `play.html`; old root `?mode=` links forward
there, as do `?theme=` links naming a flat-only theme (fire, plague, escape and
their aliases). `?theme=` and `?deal=` otherwise belong to Sphere now.

## Flux Sphere (experimental)

[`flux-sphere/`](flux-sphere/) — https://dr.eamer.dev/games/hexsweeper/flux-sphere/

Flux Sphere turns the archived “Dig one, reveal both” study into a complete
variant on the canonical Sphere engine. After the first safe opening, every
remaining covered face—including mines—receives a deterministic distant
partner. Activate once to trace the A/B endpoints without opening them, then
activate either endpoint again to commit both inside one undo step. A flag
grounds its endpoint and holds the echo, so deductions across both
neighborhoods decide whether to take the double reveal or isolate a mine.

The route keeps its isolated `hexsweeper-flux-sphere-run-v1` storage key and
migrates the pair payload to version 2 without abandoning live runs. Reload
restore, exactly-once completion events, keyboard-centered dig and flag
controls, live text feedback, non-color linked glyphs, and a static
reduced-motion treatment. Run `node flux-sphere/test-flux-pairs.js` and
`node flux-sphere/test-integration.js` for deterministic pair, lifecycle,
semantics, persistence, keyboard, and completion coverage.

## Glitch Sphere (experimental)

[`glitch-sphere/`](glitch-sphere/) — https://dr.eamer.dev/games/hexsweeper/glitch-sphere/

Glitch Sphere reuses the canonical Sphere geometry, renderer, controls, themes,
and assets. After the first safe dig and its flood resolve, a moving Glitch
occupies one covered safe face. Revealed and flagged faces close routes: trap
the Glitch to win before it reaches a mine. The occupied face blocks direct
digs and stays identifiable through a yellow face, an exclamation marker, and
the live text status.

The canvas supports arrow-key rotation, Enter or Space to dig the centered
face, and Shift with Enter or Space to flag it. The route has isolated run
persistence, reload restore, reduced-motion treatment, and normalized
exactly-once completion events. Run the deterministic browser verification
with `node glitch-sphere/test-browser.mjs`; it exercises desktop, mobile,
reduced-motion, keyboard, reset, restore, and terminal fixtures while rejecting
console or local-resource failures. When Chrome is unavailable, the probe runs
strict static route/resource checks and exits with status 2 so an interactive
browser run is never reported as successful.

The archive's flat Glitch Sweeper and Chain Reaction pages remain archived
mechanic studies. The former label-only Flux page is now represented by the
separate production Flux Sphere route.

## Catch the Monkey (experimental)

Two playable studies reuse the hex language without inheriting Minesweeper's rules:

- [`monkey-grid/`](monkey-grid/) is the fast 2D proof. Close one pale tile per turn; the monkey advances one step along a seeded shortest route to the rim.
- [`monkey-sphere/`](monkey-sphere/) removes the natural edge. Drag to rotate the closed surface and seal all three coral portals before the monkey reaches one; a gold rim cue points toward it while it is behind the horizon.

Both studies use one full-screen, four-control shell over locally bundled jungle
art. They support seeded URLs, complete one-turn undo, mouse and touch input,
full keyboard board play (Arrow keys plus Enter or Space), visible focus,
reduced motion, forced-color fallbacks, and route-specific screenshot cards.

## Obsidian Mirror (experimental)

[`sphere-reflection/`](sphere-reflection/) — https://dr.eamer.dev/games/hexsweeper/sphere-reflection/

- Original sphere gameplay and center-bloom controls, isolated from the native app payload.
- Pointer-inert WebGL2 reflection beneath the authoritative Canvas 2D mesh.
- Sixteen curated environments share one renderer and one game state: `?material=stormglass|mercury|aurora|atrium|canopy|portoro|deco|oculus|galaxy|gilded-ribbon|ion-storm|amber-tempest|heat-lightning|stratosphere|chromatic-ink|amber-cells`. Press **M** to cycle or choose one in Help. Retired registry slots remain internal so older saved selections do not renumber newer materials.
- The twelve image-backed environments use responsive, same-origin desktop/mobile WebP plates under `sphere-reflection/assets/reflections/`; collection one-pagers embed both sizes so every surface remains self-contained. Each plate declares `environment`, `surface`, or `hybrid` mapping: surface imagery follows the rotating globe while Fresnel and studio reflections remain world-locked. Select plates opt into distinct weather drift, torsion, parallax, ink advection, or oil-cell refraction; reduced-motion mode freezes ambient material animation without breaking surface attachment during direct rotation.
- Selected materials expose a seamless inner layer through cleared faces: Amber Cells reveals a visibly drifting, breathing cell swarm; Mercury and Portoro reveal delayed liquid metal. Earth instead keeps standard readable wells beneath a responsive 4K/2K faceted map with ocean sheen and a restrained atmospheric rim.
- Trackpad Ctrl-click and right-click both flag a sphere face; Mercury flags use warm gilded metal so they remain distinct from its cool liquid shell.
- Covered faces retain the continuous mirror; cleared faces become matte wells; flags stay scarlet.
- Analytic sphere normals replace a costly raymarch, with a capped backing buffer for mobile.
- Environmental drift freezes for either operating-system reduced motion or the in-game reduced-effects setting; forced colors uses the flat black/white renderer.
- WebGL compile/context loss falls back to a static reflective field without blocking play.
- Share cards composite the reflection and game layers.

The material study credits Matthias Hurrle (`@atzedent`) for the supplied reflection premise; its shader implementation is original to this experiment.

## Water Wheel

[`wheel/`](wheel/) is the gameplay cut of the former water-theme experiment.
Clicking a mine starts a short fuse; rotate that face beneath the fixed, wavy
waterline before it runs out. **The sea does not defuse the mine — it contains
it.** Holding the armed face under (`drownArmedMine`, after `DROWN_DWELL_MS`)
detonates it down there, and so does a fuse that simply expires below the
waterline; both route through the same `drownedBlast` in
[`wheel/sphere.js`](wheel/sphere.js). Only a fuse that runs out *above* the
waterline still ends the run. There is no longer a silent quench — the old
`quench` effect channel is kept in `effects.js` for profile compatibility but
the game no longer emits it.

An underwater detonation **chords**. `drownedBlast` resolves the mine first,
into the doused state the quench used to leave behind, and counts it as a
rescue; because a doused mine counts as accounted, every number it was touching
that was one short is satisfied the instant the sea takes it, and each of those
fires a full chord. The order *is* the mechanic. Drowned mines stay inert
across refresh, while ordinary flags wash off without revealing whether they
were correct. Satisfaction is re-read per neighbour
rather than snapshotted, so a number whose targets an earlier chord already
took simply does not fire — no face opens twice, no count goes stale mid-blast.
It is not a free pass: the chords trust the flags, not the board, so an
unflagged face that turns out to be a mine is uncovered and armed where it
stands, and only one may light across the whole blast. Undo rewinds the dig
that armed the mine, blast and all — `drownedBlast` deliberately takes no
snapshot of its own, since at that point the mine is already `revealed`.
Above the waterline the fuse still ends the run.

The chord rule lives in two shared halves — `chordTargets()` (is this face
satisfied, and what would it open) and `chordClear()` (open them, cascade
zeros, hand back the first mine without arming it) — so the tap chord and the
drowned blast cannot drift apart. The
water renderer uses the existing Canvas 2D/offscreen-buffer path and keeps
refraction concentrated near the surface so the rescue face remains readable.
Its event effects are isolated in [`wheel/effects.js`](wheel/effects.js) and
catalogued in [`wheel/EFFECTS.md`](wheel/EFFECTS.md). `?fx=kinetic` is the
composed default; `?fx=calm` preserves the base treatment for comparison and
reuse. Its one action inventory also has three documented presentations in
[`wheel/MENUS.md`](wheel/MENUS.md): the production Sphere's centered
seven-tile flower, a real-face takeover (`?menu=takeover`), and the same
real-face arrangement selected and styled below the waterline
(`?menu=underwater`). A short tap outside the sphere exposes the menu in all
three; the face variants use a temporary camera zoom and restore the player's
exact saved zoom when closed. The Wheel is an easter egg and opens straight
into the game — the illustrated Dig / Menu / Quench tour was removed in
`4c04cab`; the on-canvas alert line carries the rules as they come up.

## Dodecahedron campaign (experimental)

Playable low-poly campaign at [`polyhedron/`](polyhedron/) — `https://dr.eamer.dev/games/hexsweeper/polyhedron/`

- Twelve pentagonal macro-panels follow the exact dodecahedron graph: one start, five adjacent, five distance-two, one opposite.
- Every panel is fully tessellated by a bounded hex-lattice Voronoi field; P19, P37, and P61 set cells per panel without changing the outer solid.
- Clear one panel to unlock its five neighbors. Counts and floods stay panel-local; cross-panel clues are deliberately deferred.
- A mine fails only the active panel. Undo, retry, or return preserves completed campaign progress.
- Overview supports orbit and panel selection; the active panel rotates front and expands into a touch-sized play surface.

Smoke: `node polyhedron/test-campaign.js` (coverage, planarity, adjacency, 1/5/5/1 unlock topology, local failure, persistence).

## Choices hub

[`choices.html`](choices.html) — https://dr.eamer.dev/games/hexsweeper/choices.html

Curated entry for the three-board production launcher, the complete
experimental game routes, and ten lab skins (play via `choices/lab/` redirects
or open from the collection desk). Copy HTML for lab pens is on
[`collection/`](collection/) only.
Regenerate with `python3 tools/export-collection.py` and
`python3 tools/export-choices-lab.py` after skin or engine changes. Not linked
from the production theme switcher.

## Lab (prior art)

Open `lab.html` or `choices.html` locally or by URL path. Experimental skins remain under `skins/` for technique reference; production navigation only exposes Light / Dark / Fire / Plague / Escape. Water lives on as `?mode=water` and in the collection.

## Accessibility

- Help dialog and keyboard shortcuts (`?`, `T`, difficulty keys as documented in-game)
- `prefers-reduced-motion` respected for particle / blast motion
- Touch: long-hold to flag; Fire drag tilts (camera locked); canvas uses `touch-action: none`

## Code and artwork

Original code and project artwork are by Luke Steuber under the [MIT
license](LICENSE). The Help illustration shows this project's own Classic
board; its [source notes](sphere/assets/README.md) identify the image and its
copies. Globe textures retain their [individual source and license
notices](sphere/assets/textures/README.md), and IBM Plex fonts retain the
[SIL Open Font License](fonts/OFL.txt).

## Related

- Games index: https://dr.eamer.dev/games/
- Native apps (iOS, Android, Fire TV) are built from this repository's `--app`
  export in a separate repository; the web root and the sealed app page are the
  same Sphere.
