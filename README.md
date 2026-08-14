# Hexsweeper

Hexagonal minesweeper for [dr.eamer.dev](https://dr.eamer.dev/games/hexsweeper/).

**Live path:** `/home/coolhand/www/dr.eamer.dev/games/hexsweeper/`  
**Public URL:** https://dr.eamer.dev/games/hexsweeper/

Edits on Drummer are live static deploys (same pattern as `/clocks/`). This folder is its own nested Git worktree (`lukeslp/hexsweeper`). Beast mirror: `/Users/luke/workspace/hexsweeper`. Typography is self-hosted IBM Plex under `fonts/` (SIL OFL 1.1 — see `fonts/OFL.txt`; no Google Fonts CDN).

## Modes (production)

| Theme | Board | Feel |
|------|--------|------|
| **Light** | Infinite | Porcelain chalk desk — bright raised covers, graphite wells (seam-only LOD when zoomed out; full extrusion when zoomed in) |
| **Dark** | Infinite | Night-iron plate — cold steel bevels, deep wells (same infinite run as Light; same zoom LOD) |
| **Fire** | Finite | Magma shaft / hell-mine well — dense viewport-filling honeycomb; drag tilts the pit (camera locked); hold to flag |
| **Plague** | Finite | Soil hive bed + living mycelial underlay + green specimen tiles + hyphal mat (seam-only LOD at extreme zoom-out) |
| **Escape** | Infinite | Opens on a patch then pulls wide; dig/flag/chord toward an offscreen finish (edge cue); rift heartbeats and reaches toward your digs |

Fire and Plague open on the **large** board; board size (S·M·L) lives in Menu and only appears for those two, since the infinite themes have no fixed board.

OG cards: `assets/social/<card>-og.png` for production themes (`home`, `light`, `dark`, `fire`, `plague`, `escape`), lab skins (`skin-<id>`), and `sphere`. Social **title** and **description** live in `tools/export-collection.py` (`ogTitle` / `ogDescription` on `THEMES`), `skins.json` (per lab skin), and `sphere/index.html`; `tools/og-card.html` mirrors them for PNG captions. Example plate title: *Neumorphic Hexagonal Minesweeper*. Older Fire studies stay as `fire-og-alt.png`, `fire-og-bloom.png`. Rebuild PNGs with `tools/shoot-og-cards.sh` (reads card keys from `tools/og-card.html`, shoots headless at 2×, downscales to 1200×630). Requires Chromium + Pillow on Drummer; set `BASE=` to override the live URL. Cycle themes with the theme control or `T`. Deep-link with `?mode=light|dark|fire|plague|escape` (aliases: `white`, `minimalist`, `rift`, `magma-core`, `biolume-reef`); add `?deal=1` to open a starting patch in any mode. Preference key: `hexsweeper-mode-v3`.

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

Production choices are composed in `index.html` from four declarative axes:

- **Mode profile** — finite/endless topology, camera behavior, rules, and autosave lane.
- **Material** — the existing Canvas renderer/material record and its color tokens.
- **Cosmetic effects profile** — ambient, reveal, and flag particles. These channels can be enabled independently without changing the board or save lane.
- **Endgame profile** — mandatory semantic win/loss feedback. Infinite Light/Dark and Fire use the shared detonation; Plague uses infection; Escape uses the rift catch.

Light and Dark deliberately use the `quiet-plate` cosmetic profile: tile motion carries normal digs, while the full shared bomb detonation remains intact. **Effects: Reduced** selects the detonation's calm, non-shaking path; it never removes loss feedback. This profile seam is the supported path for promoting collection materials or effects into future skins. Material changes must not restart a run, alter rules, or change persistence lanes.

## Layout

| File | Role |
|------|------|
| `index.html` | Production game (modes, renderer, HUD, help) |
| `core.js` | Shared engine: hex grid, endless growth, input, hooks |
| `skin-chrome.css` | Shared nav / settings / overlay chrome (lab + classic) |
| `fonts/` | Self-hosted IBM Plex Sans/Mono + `OFL.txt` |
| `collection/` | Production + lab one-pagers; Copy HTML desk (CodePen-ready) |
| `tools/export-collection.py` | Regenerates `collection/theme-*.html`, `skin-*.html`, and index |
| `sphere/` | **Experimental** closed hex sphere minesweeper (Canvas projection) |
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
| `collection/polyhedron.html` | Dodecahedron campaign — 12 connected panels with 19/37/61 cells per panel |
| `collection/sphere-reflection*.html` | Obsidian Mirror studies — five procedural environments plus fifteen image-backed surfaces, including animated storm, cloud, ink, and oil-cell plates |
| `collection/sphere-kimi.html` | Visual take: Moon Ink Orrery |
| `collection/sphere-claude.html` | Visual take: Amber Codex |
| `collection/sphere-muse.html` | Visual take: Starlit Void |
| `collection/sphere-face-takeover.html` | Control study: seven real sphere faces become the menu |
| `collection/sphere-equator-ribbon.html` | Archived V1: draggable depth-sorted equator ribbon |
| `collection/sphere-eggshell.html` | Spatial study V4: fast interlocking split with a renderer-native inner shell |
| `collection/sphere-chamber.html` | Spatial study V4: continuous center-out fold into a tessellated inner chamber |
| `collection/sphere-polar-capstan.html` | Rejected archive: faceted control spindle |
| `collection/sphere-polar-crown.html` | Captured prior art: reset hub with six promising geodesic petals |
| `collection/sphere-polar-drill.html` | Rejected archive: telescoping concentric controls |
| `collection/sphere-polar-lid.html` | Rejected archive: hinged 2–3–2 control panel |
| `collection/catch-monkey-garden.html` | Game study: flat route-blocking chase toward the garden rim |
| `collection/catch-monkey-orbit.html` | Game study: spherical route-blocking chase toward three portals |
| `sphere/takes/*.json` | Model design specs for the three takes |
| `sphere/assets/textures/` | Earth & Moon 2k daymaps for globe themes (`?theme=earth\|moon`) |
| `collection/index.html` | Desk tile grid — sphere + takes under Experiments (Open + Copy HTML) |

Regenerate after production or lab skin changes:

```bash
python3 tools/export-collection.py
python3 tools/export-collection.py --check   # CI / drift guard
python3 tools/export-choices-lab.py          # choices/lab redirect stubs
```

Production exports inline `core.js`, chrome CSS, and IBM Plex (base64 woff2). Each theme file sets `window.HEXSWEEPER_ONEPAGER` (`allowModes: ["light","dark"]` on the plate; single `mode` on the others). Lab skins boot via `Hexsweeper.boot` in their source files. Welcome stays hidden on production pens. The live multi-theme game remains `index.html`.

## Native launcher

`python3 tools/export-collection.py --app` stages the sealed Capacitor payload in
`build/app/`. The launcher opens a safe patch into the three structural modes.
Its covered **Theme** face blooms into System / Light / Dark choices for the
launcher itself; gameplay materials remain owned by each game. When an unfinished
Infinite or Sphere autosave exists, the newest run rises as a mode-colored
**Resume** face in the center. Classic is omitted from Resume until its finite
board has a real persistence contract.

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

## Sphere (experimental)

Closed Goldberg sphere minesweeper at [`sphere/`](sphere/) — https://dr.eamer.dev/games/hexsweeper/sphere/

- Canvas 2D projection of vendored hexasphere math (no Three.js)
- Dig / flag / flood over geodesic `neighborIndices`; first dig safe; win/lose
- Starts pulled back (~0.72×); scroll/pinch to zoom; drag for full 360° tumble (yaw+pitch); flag mode + long-hold; RM-safe camera
- **Heights** (highest → lowest): flagged (pure red fill, no glyph, stands proud of the shell as a pin) → covered shell → numbered clears → empty clears. Tiers only apply in numerals · rings · borderless; flush/yellow stay a flat field. Hover temporarily lifts activatable faces over their own tier, so a proud flag still lifts. Borderless drops the recessed-floor grid. **N** / count button cycles numerals · rings · yellow · flush · borderless (`hexsweeper-sphere-countstyle-v1`)
- **Autosave:** mid-run state in `hexsweeper-sphere-run-v1` (resume on refresh); Reset and size changes confirm before discarding progress
- Minimal help: short lede, color history tile → [CoolmathGames history](https://www.coolmathgames.com/blog/the-history-of-minesweeper) + lightbox
- Densities: **XS** = 162 · **S** = 362 · **M** = 1002 · **L** = 1442 · **XL** = 2252 (~17% mines; size button cycles XS→XL)
- Flood expand: BFS ring stagger + brief flash/pop (logic opens immediately; paint catch-up; RM-safe)
- **Chrome:** three BR glass pills — Reset·Size·Theme | Flag | Help; size/theme icons morph per state (no corner badges)
- **Themes:** Light · Shell · Dark · Ink · **Float** (Light + contact shadow) · **Card** (Ink + contact shadow) · **Glow** (luminous dig centers) · **Earth** / **Moon** (globe-map daymaps, `?theme=earth|moon`); wells opposite the shell — `hexsweeper-sphere-theme-v6`
- **Customize panel:** in-run theme/board tweaks with one-step undo; share card capture wired from the panel
- **First visit:** short icon help modal (`hexsweeper-sphere-welcome-v1`); `?welcome=1` forces, `?welcome=0` skips
- **Endgame FX:** lose — graph-distance mine cascade + particle burst + shock ring; win — clearance pulse + confetti-lite (`prefers-reduced-motion`: instant states)

Smoke: `node sphere/test-neighbors.js` (neighbor symmetry + flood closure at
subdivisions 6, 10, 12) and `node wheel/test-effects.js` (profile/event
contract plus drawing-surface smoke). `node wheel/test-menu-variants.js`
guards the Water Wheel menu-profile aliases and projected patch selection.

Flat game remains the default at `index.html`.

## Catch the Monkey (experimental)

Two playable studies reuse the hex language without inheriting Minesweeper's rules:

- [`monkey-grid/`](monkey-grid/) is the fast 2D proof. Close one pale tile per turn; the monkey advances one step along a seeded shortest route to the rim.
- [`monkey-sphere/`](monkey-sphere/) removes the natural edge. Drag to rotate the closed surface and seal all three coral portals before the monkey reaches one; a gold rim cue points toward it while it is behind the horizon.

Both studies support seeded URLs, complete one-turn undo, mouse and touch input, keyboard shortcuts, reduced motion, and self-contained collection exports.

## Obsidian Mirror (experimental)

[`sphere-reflection/`](sphere-reflection/) — https://dr.eamer.dev/games/hexsweeper/sphere-reflection/

- Original sphere gameplay and center-bloom controls, isolated from the native app payload.
- Pointer-inert WebGL2 reflection beneath the authoritative Canvas 2D mesh.
- Twenty reflected environments share one renderer and one game state: `?material=stormglass|studio|mercury|aurora|atrium|canopy|salon|paisley|portoro|deco|oculus|galaxy|night-cabin|gilded-ribbon|ion-storm|amber-tempest|heat-lightning|stratosphere|chromatic-ink|amber-cells`. Press **M** to cycle or choose one in Help.
- The fifteen image-backed environments use responsive, same-origin desktop/mobile WebP plates under `sphere-reflection/assets/reflections/`; collection one-pagers embed both sizes so every surface remains self-contained. Each plate declares `environment`, `surface`, or `hybrid` mapping: surface imagery follows the rotating globe while Fresnel and studio reflections remain world-locked. Select plates also opt into weather drift, ink advection, or oil-cell refraction; reduced-motion mode freezes material animation without breaking surface attachment during direct rotation.
- Covered faces retain the continuous mirror; cleared faces become matte wells; flags stay scarlet.
- Analytic sphere normals replace a costly raymarch, with a capped backing buffer for mobile.
- Environmental drift freezes for either operating-system reduced motion or the in-game reduced-effects setting; forced colors uses the flat black/white renderer.
- WebGL compile/context loss falls back to a static reflective field without blocking play.
- Share cards composite the reflection and game layers.

The material study credits Matthias Hurrle (`@atzedent`) for the supplied reflection premise; its shader implementation is original to this experiment.

## Water Wheel

[`wheel/`](wheel/) is the gameplay cut of the former water-theme experiment.
Clicking a mine starts a short fuse; rotate that face beneath the fixed,
wavy waterline to quench it. Quenched mines stay inert across refresh, while
ordinary flags wash off without revealing whether they were correct. The
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
exact saved zoom when closed. A three-step illustrated Dig / Menu / Quench
tour replaces the former introductory modal.

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

Curated entry for production play, the sphere experiment, and ten lab skins (play via `choices/lab/` redirects or open from the collection desk). Copy HTML for lab pens is on [`collection/`](collection/) only. Regenerate with `python3 tools/export-collection.py` and `python3 tools/export-choices-lab.py` after skin or engine changes. Not linked from the production theme switcher.

## Lab (prior art)

Open `lab.html` or `choices.html` locally or by URL path. Experimental skins remain under `skins/` for technique reference; production navigation only exposes Light / Dark / Fire / Plague / Escape. Water lives on as `?mode=water` and in the collection.

## Accessibility

- Help dialog and keyboard shortcuts (`?`, `T`, difficulty keys as documented in-game)
- `prefers-reduced-motion` respected for particle / blast motion
- Touch: long-hold to flag; Fire drag tilts (camera locked); canvas uses `touch-action: none`

## Related

- Games index: `/games/` (icon: `/games/icons/hexsweeper.svg`)
- Three-mode cut plan: `~/craft/reports/by-date/2026-07-26/discuss-hexsweeper-three-modes.md`
- Screenshots (home): `~/hexsweeper-{light,dark,fire,plague,escape,white,mobile-*}.png`
