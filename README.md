# Hexsweeper

[![Play Hexsweeper](https://img.shields.io/badge/Play-live-7c3aed?logo=gamepad&logoColor=white)](https://dr.eamer.dev/games/hexsweeper/)
[![CI](https://github.com/lukeslp/hexsweeper/actions/workflows/ci.yml/badge.svg)](https://github.com/lukeslp/hexsweeper/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2ea44f.svg)](LICENSE)
[![App Store](https://img.shields.io/badge/App_Store-iPhone_and_iPad-blue)](https://apps.apple.com/us/app/hexsweeper-3d/id6768871973)
[![Android download](https://img.shields.io/badge/Android-direct_download-34A853)](https://dr.eamer.dev/downloads/apps/hexsweeper/)
[![F-Droid repository](https://img.shields.io/badge/F--Droid-LocalType_releases_repo-1976D2)](https://dr.eamer.dev/downloads/fdroid/)
[![Pebble Appstore](https://img.shields.io/badge/Pebble-Appstore-FF4700)](https://apps.repebble.com/94e4d9abfb8e44488f419862)

The Pebble watch source is on the `pebble/all-watches` branch.

A hexagonal minesweeper in three shapes: an endless plate, a fixed classic
board, and a closed 3D sphere. The web root opens Sphere immediately; the
separate Games page offers all three boards and a centered Resume. The native
iOS and Android apps open Sphere the same way, straight onto the board. Settings
live inside each game.

**[Play Hexsweeper on dr.eamer.dev](https://dr.eamer.dev/games/hexsweeper/).**

## Run locally

Serve the repository with any static web server, then open `index.html` in a
modern browser. The generated web routes are committed, so no build is needed
to play; run the exporter after changing their source files.

```bash
python3 -m http.server 8080
```

The favicons and a few links point at the live site's `/games/hexsweeper/`
path, so a local server started at the repository root shows 404s for them.
The games still play.

## Tests

CI (`.github/workflows/ci.yml`) runs these from the repository root with
Node 22 and Python 3.12. None needs an install:

```bash
node sphere/test-neighbors.js
node sphere/test-variant-contract.js
node sphere/test-mirror-loop.js
node glitch-sphere/test-glitch-hazard.js
node glitch-sphere/test-integration.js
node flux-sphere/test-flux-pairs.js
node flux-sphere/test-integration.js
node --test tools/test-monkey-ui.mjs
node wheel/test-effects.js
node wheel/test-menu-variants.js
node polyhedron/test-campaign.js
python3 tools/export-collection.py --app     # stages build/app/ for the next check
node tools/test-web-launcher.mjs
python3 tools/export-collection.py --check   # generated pages match their sources
python3 tools/export-choices-lab.py --check
```

`node wheel/test-drowned-blast.js` also passes but is not in CI. The browser
checks (`glitch-sphere/test-browser.mjs`, `flux-sphere/test-browser.mjs`,
`tools/test-sphere-dialog-focus.mjs`, `tools/test-native-ui-session.mjs`) need
Chrome, and the last two need Playwright, found through `HEX_PLAYWRIGHT_MODULE`.
They are not in CI and are out of date: the first two stop on the favicon 404s
above, and the last two still expect the older Help sheet, with no history
image and nine themes.

The app in `app/` has its own CI job: it regenerates the sealed payload from
the commit recorded in `app/WWW_SOURCE.txt`, checks it against `app/www/`, and
builds a debug Android APK.

## Android and iOS apps

[`app/`](app/) is the Capacitor shell that builds the iOS and Android apps from
a sealed, offline export of Sphere. From a clean checkout, with Node 22 or
later, pnpm 10, JDK 21 and an Android SDK with platform 36:

```bash
cd app
pnpm install --frozen-lockfile
pnpm smoke                    # payload checksums and Capacitor sync
pnpm android:build:debug      # android/app/build/outputs/apk/debug/app-debug.apk
```

The iOS project opens with `pnpm cap:open:ios` and needs Xcode and your own
signing team. [app/README.md](app/README.md) covers the payload, release
builds, the application ids and what the app leaves out. Store listing text
for Android is in
[`fastlane/metadata/android/en-US/`](fastlane/metadata/android/en-US/).

## Privacy

The apps make no network requests and the Android app does not ask for
internet access. The web pages count visits with a self-hosted GoatCounter.
The policy is [privacy.html](privacy.html), live at
<https://dr.eamer.dev/games/hexsweeper/privacy.html>.

## Release notes

Android release notes are in
[`fastlane/metadata/android/en-US/changelogs/`](fastlane/metadata/android/en-US/changelogs/),
one file per version code. The per-version notes for the native builds are in
[app/README.md](app/README.md) and [app/docs/RELEASE.md](app/docs/RELEASE.md).
F-Droid releases are tagged `v<version>`. `v1.0.13` is the current one; `v1.0.12` was the same app with an out-of-date listing screenshot.
The F-Droid build and what is open before a catalog request are in
[docs/FDROID.md](docs/FDROID.md).

## Issues and contact

Report bugs and requests in
[GitHub issues](https://github.com/lukeslp/hexsweeper/issues), or write to
<luke@lukesteuber.com>.

## Deployment

This repository root is the deployed web root: the live site serves these
files directly. Commit and push the change, then fast-forward the production
checkout; a local commit or push alone does not establish deployed bytes. The generated
routes (`index.html`, `launcher.html`, `infinite.html`, `bounded.html`, and the
`collection/` one-pagers) are committed; run the exporter after changing their
sources and CI checks that they match. IBM Plex is self-hosted under `fonts/`
under the SIL Open Font License 1.1. The production pages use no font CDN; the dormant `lab.html` loads its fonts from Google Fonts.

## Boards (production)

| Choice | Board | Route |
|------|--------|------|
| **Infinite** | Endless Light/Dark plate; the run persists | `infinite.html` |
| **Classic** | Fixed neumorphic board; the run persists | `bounded.html` |
| **Sphere** | Closed 3D Goldberg sphere | `index.html` (root), `sphere/` (source) |

The root opens straight into Sphere, which restores its own unfinished run
without asking. A small mines-left/seconds readout sits at the top, with
**New sphere** at the upper left, **Undo, Flag** at the lower left and **?**
at the lower right. Short landscape screens put actions above Help on a right
rail. These web controls use the [shared Minimal frame](docs/control-layout-20261014.md):
square 48px targets, 24px glyphs and visible keyboard focus. Infinite uses the
same New board/Flag/? placement; Classic puts Reset above and Menu last. The
sealed native payload keeps its existing control arrangement.
When a Classic run ends, one line says "Mine hit" or "Board cleared" (a status
region, so screen readers hear it) above the frame's Play again disc; a loss
also dims the board and marks the hex that went off as a dark cell with a
light mine. On the web Sphere, a touch tap on a face that perspective has
squeezed below half its width near the rim turns that face to the front
instead of digging or flagging it; mouse clicks act directly, and the native
payload keeps acting directly until it opts in (`rimTapTurns`).
The three-hex games menu (Infinite, Classic, Sphere, with
the newest run in the center Resume tile) lives at `launcher.html`, which is
**unlinked and noindex** since 2026-10-07: it stays served only so old links
resolve. Every web game stands alone, with no Games pill; the sphere's Help
sheet ends "Also Infinite, Classic". `infinite.html` also sets `stillPlane`
(a minimal index links to it), which keeps the plate flat with no pointer
parallax. Infinite uses Sphere's black-and-white Light/Dark pair and follows the
system appearance until you pick one. Dark has black covers, white revealed
cells, dark numbers, and red flags; Light inverts the field and cells. Switching appearance preserves the same saved run;
the collection keeps its original palettes.
A mode tap on the launcher starts a fresh run using the
last used style, board size, or theme. Settings live inside each game.

Every visit opens the board immediately, with help and settings behind
**?** even on a first visit or when browser storage is blocked; there is no
welcome card and no first-visit cue on Sphere or Infinite.
The Play tab is one line of what to do plus three gesture rows, and no control
carries a `title=` tooltip (names live in aria-labels).
Saved runs restore in place. Both surfaces share Play, Themes, Board,
Settings, with a Keys tab for keyboard users.

The former five-mode flat production surface remains at `play.html` for its
distinct materials and mechanics:

| Theme | Board | Feel |
|------|--------|------|
| **Light** | Infinite | Porcelain chalk desk: bright raised covers, graphite wells (seam-only LOD when zoomed out; full extrusion when zoomed in) |
| **Dark** | Infinite | Night-iron plate: cold steel bevels, deep wells (same infinite run as Light; same zoom LOD) |
| **Fire** | Finite | Magma shaft / hell-mine well: dense viewport-filling honeycomb; drag tilts the pit (camera locked); hold to flag |
| **Plague** | Finite | Soil hive bed + living mycelial underlay + green specimen tiles + hyphal mat (seam-only LOD at extreme zoom-out) |
| **Escape** | Infinite | Opens on a patch then pulls wide; dig/flag/chord toward an offscreen finish (edge cue); rift heartbeats and reaches toward your digs |

Fire and Plague open on the **large** board; board size (S·M·L) lives in Menu and only appears for those two, since the infinite themes have no fixed board.

Sphere’s social card is a board-only capture of the whole globe, without game chrome (see [Minimal social screenshots](#minimal-social-screenshots)). Its versioned OG/Twitter image is shared by the root and Sphere entry. Theme swatches and board-size choices use flat selection marks; settings use icon-led rows with visible state. The overall menu redesign remains open.

Infinite has its own `infinite-og.png`: a board-only capture of the revealed monochrome field, separate from the older Light/Dark collection card. `tools/og-card.html` shows that reviewed capture as is, so update it by replacing the file (see [Minimal social screenshots](#minimal-social-screenshots)); metadata comes from the Infinite configuration in the exporter.

OG cards: `assets/social/<card>-og.png` for production themes (`home`, `light`, `dark`, `fire`, `plague`, `escape`), lab skins (`skin-<id>`), and `sphere`. Social **title** and **description** live in `tools/export-collection.py` (`ogTitle` / `ogDescription` on `THEMES`), `skins.json` (per lab skin), and `sphere/index.html`; `tools/og-card.html` mirrors them for PNG captions. Example plate title: *Neumorphic Hexagonal Minesweeper*. Older Fire studies stay as `fire-og-alt.png`, `fire-og-bloom.png`. Rebuild PNGs with `tools/shoot-og-cards.sh` (reads card keys from `tools/og-card.html`, shoots headless at 2×, downscales to 1200×630). Requires Chromium and Pillow; set `BASE=` to override the live URL. Cycle flat-game themes with the theme control or `T`. Deep-link `play.html?mode=light|dark|fire|plague|escape` (aliases: `white`, `minimalist`, `rift`, `magma-core`, `biolume-reef`); add `&deal=1` to open a starting patch. Legacy root query links forward to the same route. Preference key: `hexsweeper-mode-v3`.

First visit opens the board immediately; instructions are available through Help. On `infinite.html` the Menu and Help are one sheet, the same component as Sphere's (tabs Play, Look, Settings behind one Help and settings button; Play is one line plus Tap / Hold / Drag rows, Look is System / Light / Dark, Settings holds Effects and run export/import). The cells-cleared count is the top readout, and New board and Flag mode sit in the bottom bar. The page has no `title=` tooltips and shows no card or cue on a first visit. Both sheets keep one height across their tabs. On `play.html` the chrome is a lower-right **Appearance (sun/moon), Reset, Menu** row of matching icons; Appearance only on the infinite Light/Dark plate. Scores, modes, board size, flag, help, export/import, and outbound links (Luke Steuber, Data Poems) live in its Menu. Fire / Plague / Escape restyle the Menu panel to match their materials.

Fresh runs (cold load or Reset) share one `startFreshRun` path after theme chrome is applied, so Escape intro zoom and plate framing match between first paint and restart.

### Interaction

| Action | How |
|--------|-----|
| Dig | Click / tap: empty floods open outward in rings |
| Flag | Right-click, Ctrl/⌘-click, long-hold, or Menu → Flag (`F`) |
| Pan / tilt | Infinite: drag pans (view stays put on dig/flood). Fire: drag tilts the pit (hold flags). Space/middle-drag pans anywhere |
| Zoom | Scroll, pinch, `+` / `−` (persists as `hexsweeper-zoom-v1`) |
| Chord | Click a revealed number whose neighbor flags match the count |
| Restart / size | `R`, Restart, or S·M·L (finite only); each clears that lane’s autosave |
| Export / Import | Menu → Export / Import (infinite Light/Dark/Escape JSON) |

Infinite runs autosave to `localStorage` (`hexsweeper-endless-plate-v1` for Light/Dark, `hexsweeper-endless-escape-v1` for Escape).

### Profiles, materials, and effects

Flat-game choices are composed in `play.html` from four declarative axes:

- **Mode profile**: finite/endless topology, camera behavior, rules, and autosave lane.
- **Material**: the existing Canvas renderer/material record and its color tokens.
- **Cosmetic effects profile**: ambient, reveal, and flag particles. These channels can be enabled independently without changing the board or save lane.
- **Endgame profile**: mandatory semantic win/loss feedback. Infinite Light/Dark and Fire use the shared detonation; Plague uses infection; Escape uses the rift catch.

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
| `tools/app-launcher.html` | Web Games launcher source |
| `tools/export-collection.py` | Regenerates web routes and collection one-pagers |
| `sphere/` | Canonical closed 3D sphere game (Canvas projection) |
| `flux-sphere/` | **Experimental** distant paired-reveal route on the shared Sphere engine |
| `glitch-sphere/` | **Experimental** moving-hazard route on the shared Sphere engine |
| `monkey-grid/` | **Experimental** flat Catch the Monkey route-blocking game |
| `monkey-sphere/` | **Experimental** spherical Catch the Monkey portal chase |
| `choices.html` | Curated hub: production, sphere, lab links, not in theme switcher |
| `choices/lab/` | Generated redirects to `collection/skin-*.html` |
| `tools/export-choices-lab.py` | Regenerates `choices/lab/*.html` redirect stubs |
| `classic.html` | Lab baseline neumorph skin |
| `lab.html` + `skins.json` + `skins/` | Dormant visual lab, not linked from production |

## Collection (one-pagers)

Self-contained files for paste into CodePen (or anywhere HTML runs). **Copy HTML** lives on the [collection desk](collection/) only; playable pens are game-only (Reset/Menu).

| File | Theme |
|------|--------|
| [`collection/`](collection/) | Desk with **Open** + **Copy HTML** (Production + Lab + Experiments) |
| `collection/theme-plate.html` | Light / Dark, Infinite (in-file toggle; keeps the run) |
| `collection/theme-fire.html` | Fire, Finite |
| `collection/theme-plague.html` | Plague, Finite |
| `collection/theme-escape.html` | Escape, Infinite |
| `collection/skin-*.html` | Ten lab skins from `skins.json` (game-only exports; each has OG meta) |
| `collection/sphere.html` | Hexsweeper 3D: self-contained sphere one-pager (CodePen-ready) |
| `collection/water-wheel.html` | Water Wheel: self-contained dousing-game one-pager |
| `build/app/wheel.html` | The Water Wheel sealed for the native app (app-flagged: globe themes dropped; help on demand; Sphere pill home), reached by holding the mine count on the sphere or the wave button on the sheet's Board tab. The wheel **floats**: a spring–damper bob and sway forced by a two-frequency swell, churned down by spinning, hopped by a quench, slammed by a detonation (`BOB`/`tickBob` in `wheel/sphere.js`; the waterline stays anchored to the frame) |
| `collection/polyhedron.html` | Dodecahedron campaign: 12 connected panels with 19/37/61 cells per panel |
| `collection/sphere-reflection*.html` | Obsidian Mirror studies: four procedural environments plus seven image-backed surfaces, including animated storm, cloud and ink plates |
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
| `sphere/assets/textures/` | Responsive Earth 4K/2K gloss maps and the Earth and Moon 2K daymaps for the shelved globe themes |
| `collection/index.html` | Desk tile grid: sphere + takes under Experiments (Open + Copy HTML) |

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

## Web entry and native export

`python3 tools/export-collection.py --app` stages the sealed Capacitor payload in
`build/app/`. On both surfaces the root page is Sphere itself, sealed from
`sphere/` by the exporter (`export_sphere_web` / `export_sphere_app`). The
native payload contains `index.html`, the hidden Water Wheel in `wheel.html`,
and the help image. Infinite, Classic, and the launcher are web-only. On the
web the games menu is rendered from
`tools/app-launcher.html` to `launcher.html`.

The web root opens the board without an instructions modal. Sphere restores
its own autosave silently, and saved Infinite / Classic runs are reached
through the launcher's Resume tile. Sphere honors `?fresh=1` (the launcher's
"play Sphere" route) by starting a new board instead of restoring. An explicit
`?welcome=1` can preview the help sheet; ordinary visits leave it closed.

The native export sets `HEXSWEEPER_SPHERE_APP` for sealing only; it opens the
board like the web, with no first-launch tutorial. The entry-policy cases in
`node sphere/test-variant-contract.js` cover first visits, unavailable storage,
the engine's optional welcome hook, and the explicit `?welcome=1` preview. They verify engine behavior; browser checks and physical-device
acceptance remain separate evidence.

The native shell can opt into bounded Help restoration after a WebView
recreation through `window.__restoreNativeUiSession(savedBundleExists)`.
It retains Help/tab/scroll/DOM focus metadata separately from the engine's
existing autosave; fresh native cold starts clear the old UI snapshot.
[The protocol and its limits](docs/native-ui-session-20261105.md) include
real-export quiet reload checks in `tools/test-native-ui-session.mjs`.

The launcher is three hexes (**Infinite**, **Classic**, and **Sphere**) with an
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

Closed Goldberg sphere minesweeper at [`sphere/`](sphere/): https://dr.eamer.dev/games/hexsweeper/sphere/

- Canvas 2D projection of the project's own Goldberg sphere geometry (`sphere/hexasphere.js`, no Three.js)
- Dig / flag / flood over geodesic `neighborIndices`; first dig safe; win/lose
- Starts pulled back (~0.72×); scroll/pinch to zoom; drag for full 360° tumble (yaw+pitch); flag mode + long-hold; RM-safe camera
- **Heights** (highest → lowest): flagged (pure red fill, no glyph, stands proud of the shell as a pin) → covered shell → numbered clears → empty clears. Tiers only apply in numerals, rings, borderless; flush/yellow stay a flat field. Hover temporarily lifts activatable faces over their own tier, so a proud flag still lifts. Borderless drops the recessed-floor grid. **N** cycles numerals, rings, yellow, flush, borderless (`hexsweeper-sphere-countstyle-v1`)
- **Autosave:** mid-run state in `hexsweeper-sphere-run-v2` (resume on refresh, with legacy-v1 restore support); New sphere and choosing a different size replace the run immediately, without a confirmation or prior-run restore action
- Minimal help: short lede, color history tile → [CoolmathGames history](https://www.coolmathgames.com/blog/the-history-of-minesweeper) + lightbox
- Densities: **XS** = 162, **S** = 362, **M** = 1002, **L** = 1442, **XL** = 2252 (~17% mines; chosen on the sheet's Board tab)
- Flood expand: BFS ring stagger + brief flash/pop (logic opens immediately; paint catch-up; RM-safe)
- **Chrome:** `sphere/quiet-chrome.js`: no menu. A small top readout (mines left, seconds) and bare glyph buttons. On the web, `sphere/controls.js` puts **New sphere** at the upper left, **Undo** and **Flag** (red while armed) at the lower left and **?** at the lower right, as 48×48 targets with 24px glyphs; the native app keeps the older bottom bar of **Undo**, **New sphere** and **Flag** with 52×56 touch targets. Everything else lives in the ? sheet, which is the settings sheet: gesture table, **Theme** grid (eight swatches), **Board size** (XS–XL, starts a new sphere), Invert and Effects rows, Done. **Themes own the warning treatment** (`theme.warn` = count paint, relief, seams): on the Light/Dark model, Light, Dark, Aurora and Stratosphere are numbers, depth, seams; Mercury, Galaxy, Ion Storm and Heat Lightning have continuous interiors and drop the seams (Galaxy's counts are the line-based nested rings in soft white). **Interiors**: Mercury's per-face liquid-metal decal (`CORE_PROFILES` → `drawMetalCore(proj, now, "metal")`, view-locked band + a gleam that lags the rotation), recolored for Ion Storm (cobalt) and Heat Lightning (copper) since 2026-09-01, and Galaxy's whole-sphere **black hole** (`INTERIOR_EFFECTS` → `drawInteriorEffect` → `drawBlackHole`: star field pushed outward by the mass, a Keplerian accretion disc with the approaching side Doppler-bright and the far side lensed over the top and under the bottom, a breathing photon ring, the horizon at 0.16 R, a star spiraling in every ~6.5 s, painted once per frame through the union of squarely-facing cleared faces, z > 0.22, after clipping to the sphere's disc, digits repainted on top). Aurora and Stratosphere clear to **mono wells**: a single flat color with depth and seams, exactly like Light/Dark (Stratosphere's are white with dark digits and light cliff walls; Aurora's dark). The remaining palettes (`METAL_PALETTES` verdigris/light/ivory/gold) and painters (`drawAuroraCurtains`, `drawPlasmaFilaments`, `drawSkyClouds`, `drawLightningBolts`) remain in the file unmapped; one `CORE_PROFILES`/`INTERIOR_EFFECTS` entry brings any back. `interiorEffectLive` keeps the frame loop running while an effect is visible; reduced motion freezes the hole and drops the flashes and bolts. Each effect is one `INTERIOR_EFFECTS` entry and one commit, so any of them can be reverted alone. Every mirror material has its own flag sheen (`FLAG_SHEENS`; Stratosphere lacquer red, Heat Lightning steel blue); reflection themes skip the raised hover/press pass but keep the pressed face in the normal pass so a long-press flag paints during the hold. The hex-bloom flower and the on-sphere face menu (`getMenuPatch` / `focusPatch` / rotate-only mode) remain in the engine and `sphere/hex-bloom.js` for the flux/glitch variants and the studio, but the canonical sphere no longer mounts them. Legacy dev-chrome HUD pills remain for `sphere/dev/`.
- **Themes:** eight are registered, shown in the sheet and accepted by `?theme=`: Light, Dark, **Mercury** (the reflection studio's Smoked Mercury material as a theme: WebGL mirrored body from `sphere/mirror-material.js`, etched crust, liquid-metal wells, gilded flags; procedural, so it also ships offline in the app; falls back to a plain metal field without WebGL), **Stratosphere** (light chrome: a sky environment map drifting across the mirror, glass wells), **Ion Storm** (dark: a hybrid-mapped storm cloud on a lagging frame: the reflection carries inertia and trails the rotation, with a slow pulse), **Aurora** (procedural curtains, no texture), **Galaxy** (environment-mapped dust), **Heat Lightning** (hybrid, pulsing). Shell, Ink, **Float** (Light + contact shadow), **Card** (Ink + contact shadow), **Glow** (luminous dig centers) and the **Earth** / **Moon** globe maps are still defined in `sphere/sphere.js` but shelved: they are out of the cycle, and `?theme=` ignores them. Every material has a themed interior (see Chrome above) and a themed **flag sheen** in its own metal or light (`FLAG_SHEENS`). Vocabulary: faces are **cleared** (not dug); flags mark where you think a mine is. The textured ones are texture-backed: `sphere/assets/reflections/*.webp` on the web (pages outside `sphere/` set `HEXSWEEPER_REFLECTION_TEXTURE_BASE`), sealed as data URIs in the app; wells opposite the shell; stored under `hexsweeper-sphere-theme-v6`
- **Controls:** the quiet bar and ? sheet are the production controls. Themes, inversion and effects apply live without replacing the run; a different board size starts over. Share image is available on the endgame banner. The old Customize panel is retained for development surfaces.
- **Rotation:** `resize()` records the CSS size it measured; `syncCanvasSize()` runs at the top of every frame and rebuilds the backing store whenever the bitmap stops matching its element, and `resizeSoon()` re-measures over the next two frames plus 250 ms after `resize` / `orientationchange` / `visualViewport.resize`. iOS drops or mis-times the orientation resize: one event arrives with the old layout, none follows, and the board stays stretched forever. The mirror canvas carries the same guard. Contract covers portrait → landscape → portrait plus a deliberately corrupted bitmap.
- **Drag:** both axes follow the finger with Invert off, including horizontal motion after tumbling past a pole. Rotation is `0.9 / state.scale` rad per px so tracking stays consistent across zoom and screen sizes. Settings cycles Invert off / X / Y / X+Y. Sphere and Wheel use v6 inversion preference keys and drop older values; v5 had the opposite horizontal default.
- **Android rendering:** Sphere and Wheel cap their Canvas 2D backing stores at 1.1×, cache rotation terms, cull the far hemisphere before projecting boundaries, and reuse projected geometry for recessed faces. On boards of 642 faces or more, direct and ambient rotation use a compact front-hemisphere projection; direct drags also stop hit-testing once the gesture becomes a drag. Moving frames temporarily drop labels, glows and depth skirts, while Light and Dark batch same-style faces into compound paths instead of filling and stroking every tile separately. The complete detailed frame returns whenever motion stops, then the static canvas parks until input, resize, or another animation makes it dirty. Reflection themes keep their selected image plate and palette through a lighter Android shader at a 25 fps material budget; web and Apple builds retain the full atmospheric shader.
- **Settings sheet (?):** touch-sized (360px wide, 44pt controls, keyboard hints hidden on touch) and **tabbed: Play, Themes, Board, Settings** (`role=tablist`, arrow keys, last tab remembered in `hexsweeper-sphere-sheet-tab-v1`): Play holds one line of what to do and three gesture rows; Themes the eight-swatch grid; Board the size choices with best times; Settings the Invert/Effects rows (both drag axes follow the finger by default; the invert pref lives under `hexsweeper-sphere-invert-v6`, older keys are dropped on load); title, ×, Done and credits stay fixed; every choice applies live and reads pressed. **Best times** live under the size choices: `hexsweeper-sphere-best-v1` keeps the fastest clear per board size (canonical sphere only; a run revived by Undo still counts), and the win banner reads *First clear at this size*, *New best (was …)* or *Best …*. **A hidden second sphere:** hold the mine count in the top readout: water rises through it, and holding through the fill drops into the Water Wheel (`HEXSWEEPER_WHEEL_HREF`, set per surface by the exporter: `wheel/` at the web root, `wheel.html` in the app, the live URL from a pen); a visually hidden button gives screen-reader users the same door, and the sheet's Board tab carries a small sinking-hex-under-waves button (`#help-wheel-btn`, icon only, no hint sentence) that opens it too. The Wheel gets a Sphere pill home. **Every entry**, native or browser, opens the board immediately, with no card or cue on a first visit; ? holds the help. **End-of-game banner** is a labeled card in the same grammar: Share, Undo, New sphere. **Share** hands the card to the native `HexShare` plugin as an image when running in the app (full iOS share roster), else Web Share with a File, else download.
- **Endgame FX:** lose: graph-distance mine cascade + particle burst + shock ring; win: clearance pulse + confetti-lite (`prefers-reduced-motion`: instant states)

Smoke: `node sphere/test-neighbors.js` (neighbor symmetry + flood closure at
subdivisions 4, 6, 10, 12 and 15) and `node wheel/test-effects.js` (profile/event
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

[`flux-sphere/`](flux-sphere/): https://dr.eamer.dev/games/hexsweeper/flux-sphere/

Flux Sphere turns the archived “Dig one, reveal both” study into a complete
variant on the canonical Sphere engine. After the first dig, every covered face
gets a twin about 55 degrees away (never a face it touches), and twins share a
fate: both safe or both mines. Dig a face and its twin opens too (the echo), so an echo can never set
off a mine; only a face you dig yourself can. The Twin tool (button, or `E` on
the keyboard) marks a face A and its twin B without digging, so a stuck spot can
be solved from the other end. A flag on a twin holds its echo, and the twin of
every flag gets a dashed red mark.

Version 3 rules (2026-10-03) replaced the August trace-then-commit flow. That
version linked any two covered faces at opposite sides of the globe, so about
one safe dig in six echoed onto a mine out of sight and ended the run. Saved
version 1 and 2 runs are rebuilt under the new rules when they load. A later
pass the same day stopped XS boards from pairing two touching faces (about one
link in 3,000) and made a still, reduced-motion echo arc clear itself when it
expires. The share card, `flux-sphere/assets/og.png`, is the `flux-sphere`
card in `tools/og-card.html`; reshoot it with
`bash tools/shoot-og-cards.sh flux-sphere`.

The route keeps its isolated `hexsweeper-flux-sphere-run-v1` storage key. Reload
restore, exactly-once completion events, keyboard-centered dig, flag and twin
controls, live text feedback, non-color linked glyphs, and a static
reduced-motion treatment. Run `node flux-sphere/test-flux-pairs.js` and
`node flux-sphere/test-integration.js` for pair, lifecycle, semantics,
persistence, keyboard, and completion coverage, and
`node flux-sphere/test-browser.mjs` for the in-browser pass.

## Glitch Sphere (experimental)

[`glitch-sphere/`](glitch-sphere/): https://dr.eamer.dev/games/hexsweeper/glitch-sphere/

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

Flux, Glitch, the Dodecahedron and the Water Wheel follow Sphere's help
rule: play starts at once, nothing opens the sheet uninvited, Help is one line
of what to do plus Tap / Hold / Drag, and no element carries a `title=`
tooltip (the shared `initHexBloom(game, { tooltips: false })` drops the dock's
hover titles; other pages keep them). Flux, Glitch and the Dodecahedron show
one quiet cue above the bar on a first visit (`hexsweeper-flux-welcome-v3`,
`hexsweeper-glitch-welcome-v1`, `hexsweeper-dodeca-welcome-v1`).

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

[`sphere-reflection/`](sphere-reflection/): https://dr.eamer.dev/games/hexsweeper/sphere-reflection/

- Original sphere gameplay and center-bloom controls, isolated from the native app payload.
- Pointer-inert WebGL2 reflection beneath the authoritative Canvas 2D mesh.
- Eleven curated environments share one renderer and one game state: `?material=stormglass|mercury|aurora|atrium|oculus|galaxy|ion-storm|amber-tempest|heat-lightning|stratosphere|chromatic-ink`. Press **M** to cycle or choose one in Help. Retired registry slots remain internal so older saved selections do not renumber newer materials.
- The seven image-backed environments use responsive, same-origin desktop/mobile WebP plates under `sphere/assets/reflections/`; collection one-pagers embed both sizes so every surface remains self-contained. Each plate declares `environment`, `surface`, or `hybrid` mapping: surface imagery follows the rotating globe while Fresnel and studio reflections remain world-locked. Select plates opt into distinct weather drift, parallax or ink advection; reduced-motion mode freezes ambient material animation without breaking surface attachment during direct rotation.
- Mercury exposes a seamless inner layer through cleared faces: delayed liquid metal. Earth instead keeps standard readable wells beneath a responsive 4K/2K faceted map with ocean sheen and a restrained atmospheric rim.
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
waterline before it runs out. **The sea does not defuse the mine; it contains
it.** Holding the armed face under (`drownArmedMine`, after `DROWN_DWELL_MS`)
detonates it down there, and so does a fuse that simply expires below the
waterline; both route through the same `drownedBlast` in
[`wheel/sphere.js`](wheel/sphere.js). Only a fuse that runs out *above* the
waterline still ends the run. There is no longer a silent quench; the old
`quench` effect channel is kept in `effects.js` for profile compatibility but
the game no longer emits it.

An underwater detonation **chords**. `drownedBlast` resolves the mine first,
into the doused state the quench used to leave behind, and counts it as a
rescue; because a doused mine counts as accounted, every number it was touching
that was one short is satisfied the instant the sea takes it, and each of those
fires a full chord. The order *is* the mechanic. Drowned mines stay inert
across refresh, while ordinary flags wash off without revealing whether they
were correct. Satisfaction is re-read per neighbor
rather than snapshotted, so a number whose targets an earlier chord already
took simply does not fire: no face opens twice, no count goes stale mid-blast.
It is not a free pass: the chords trust the flags, not the board, so an
unflagged face that turns out to be a mine is uncovered and armed where it
stands, and only one may light across the whole blast. Undo rewinds the dig
that armed the mine, blast and all; `drownedBlast` deliberately takes no
snapshot of its own, since at that point the mine is already `revealed`.
Above the waterline the fuse still ends the run.

The chord rule lives in two shared halves: `chordTargets()` (is this face
satisfied, and what would it open) and `chordClear()` (open them, cascade
zeros, hand back the first mine without arming it), so the tap chord and the
drowned blast cannot drift apart. The
water renderer uses the existing Canvas 2D/offscreen-buffer path and keeps
refraction concentrated near the surface so the rescue face remains readable.
Its event effects are isolated in [`wheel/effects.js`](wheel/effects.js) and
catalogued in [`wheel/EFFECTS.md`](wheel/EFFECTS.md). `?fx=kinetic` is the
composed default; `?fx=calm` preserves the base treatment for comparison and
reuse. Its one action inventory also has three documented presentations in
[`wheel/MENUS.md`](wheel/MENUS.md): the centered seven-tile flower that
Sphere used before its quiet bar (Flux and Glitch still use it), a real-face takeover (`?menu=takeover`), and the same
real-face arrangement selected and styled below the waterline
(`?menu=underwater`). A short tap outside the sphere exposes the menu in all
three; the face variants use a temporary camera zoom and restore the player's
exact saved zoom when closed. The Wheel is an easter egg and opens straight
into the game; the illustrated Dig / Menu / Quench tour was removed in
`4c04cab`; the on-canvas alert line carries the rules as they come up. Help
sits in the bloom's lower-right corner seat, as on Flux and Glitch: one line
on quenching an armed mine, then Tap / Hold / Drag. Nothing opens it uninvited.

## Dodecahedron campaign (experimental)

Playable low-poly campaign at [`polyhedron/`](polyhedron/): `https://dr.eamer.dev/games/hexsweeper/polyhedron/`

- Twelve pentagonal macro-panels follow the exact dodecahedron graph: one start, five adjacent, five distance-two, one opposite.
- Every panel is fully tessellated by a bounded hex-lattice Voronoi field; P19, P37, and P61 set cells per panel without changing the outer solid.
- Clear one panel to unlock its five neighbors. Counts and floods stay panel-local; cross-panel clues are deliberately deferred.
- A mine fails only the active panel. Undo, retry, or return preserves completed campaign progress.
- Overview supports orbit and panel selection; the active panel rotates front and expands into a touch-sized play surface.

Smoke: `node polyhedron/test-campaign.js` (coverage, planarity, adjacency, 1/5/5/1 unlock topology, local failure, persistence).

## Choices hub

[`choices.html`](choices.html): https://dr.eamer.dev/games/hexsweeper/choices.html

Curated entry for the production Sphere, the complete
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
- Sphere Help keeps keyboard focus inside visible controls, isolates background
  content and returns focus to the visible Help button. Quiet browser checks are
  in `tools/test-sphere-dialog-focus.mjs`; nested-dialog coverage uses a test-only
  fixture. This does not establish TalkBack gameplay acceptance or add a tutorial.
- `prefers-reduced-motion` respected for particle / blast motion
- Touch: long-hold to flag; Fire drag tilts (camera locked); canvas uses `touch-action: none`

## Related

- Games index: https://dr.eamer.dev/games/
- Native apps (iOS, Android, Fire tablets) are built from this repository's
  `--app` export by the Capacitor shell in [`app/`](app/); the web root and the
  sealed app page are the same Sphere.

## License

MIT; see [LICENSE](LICENSE). Bundled third-party material is listed in
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) with its own terms: the IBM
Plex fonts, the Earth and Moon daymaps, the reflection photographs and the
classic Minesweeper screenshot. None of these is under the MIT license, and
the photographs and the screenshot are not under an open license either.

## Minimal social screenshots

Classic, Infinite and Sphere use 1200 × 630 board-only PNG captures, shared with
the Minimal artwork. No title, description, URL or controls are drawn over the
board. Infinite shows the revealed monochrome field; Sphere the whole globe;
Classic the raised honeycomb. Social alternative text describes the actual image.
The image URLs carry a date stamp (`board-20261009`, and `board-20261010` for
Classic) to refresh caches. The OG authoring page
shows these reviewed captures directly, so later card exports preserve them.
To update one, capture the gameplay board, crop away chrome, frame at 1200 × 630,
visually inspect, and replace its existing file in `assets/social/`.
