# Hexsweeper

Hexagonal minesweeper for [dr.eamer.dev](https://dr.eamer.dev/games/hexsweeper/).

**Live path:** `/home/coolhand/www/dr.eamer.dev/games/hexsweeper/`  
**Public URL:** https://dr.eamer.dev/games/hexsweeper/

Edits on Drummer are live static deploys (same pattern as `/clocks/`). This folder is its own nested Git worktree (`lukeslp/hexsweeper`). Beast mirror: `/Users/luke/workspace/hexsweeper`. Typography is self-hosted IBM Plex under `fonts/` (SIL OFL 1.1 — see `fonts/OFL.txt`; no Google Fonts CDN).

## Modes (production)

| Theme | Board | Feel |
|------|--------|------|
| **Light** | Infinite | Porcelain chalk desk — bright raised covers, graphite wells (seam-only LOD at default zoom-out; idle throttle + offscreen RAF pause) |
| **Dark** | Infinite | Night-iron plate — cold steel bevels, deep wells (same infinite run as Light) |
| **Fire** | Finite | Magma shaft / hell-mine well — dense viewport-filling honeycomb; drag tilts the pit (camera locked); hold to flag |
| **Plague** | Finite | Soil hive bed + living mycelial underlay + green specimen tiles + hyphal mat (seam-only LOD at extreme zoom-out) |
| **Escape** | Infinite | Opens on a patch then pulls wide; dig/flag/chord toward an offscreen finish (edge cue); rift heartbeats and reaches toward your digs |

Fire and Plague open on the **large** board; board size (S·M·L) lives in Menu and only appears for those two, since the infinite themes have no fixed board.

OG cards: `assets/social/<home|light|dark|fire|plague|escape>-og.png`, each a real board under a title and one-line description (older Fire studies stay as `fire-og-alt.png`, `fire-og-bloom.png`). Rebuild them with `tools/shoot-og-cards.sh`, which shoots `tools/og-card.html` headless at 2x and downscales to 1200x630. Cycle themes with the theme control or `T`. Deep-link with `?mode=light|dark|fire|plague|escape` (aliases: `white`, `minimalist`, `rift`, `magma-core`, `biolume-reef`); add `?deal=1` to open a starting patch in any mode. Preference key: `hexsweeper-mode-v3`.

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

## Layout

| File | Role |
|------|------|
| `index.html` | Production game (modes, renderer, HUD, help) |
| `core.js` | Shared engine: hex grid, endless growth, input, hooks |
| `skin-chrome.css` | Shared nav / settings / overlay chrome (lab + classic) |
| `fonts/` | Self-hosted IBM Plex Sans/Mono + `OFL.txt` |
| `collection/` | Theme one-pagers + Copy HTML desk (CodePen-ready) |
| `tools/export-collection.py` | Regenerates `collection/theme-*.html` + index |
| `sphere/` | **Experimental** closed hex sphere minesweeper (Canvas projection) |
| `choices.html` | Curated hub: production, sphere, lab one-pagers — not in theme switcher |
| `choices/lab/` | Generated self-contained lab skins + **Copy for CodePen** |
| `tools/export-choices-lab.py` | Regenerates `choices/lab/*.html` from `skins.json` |
| `classic.html` | Lab baseline neumorph skin |
| `lab.html` + `skins.json` + `skins/` | Dormant visual lab — not linked from production |

## Collection (one-pagers)

Four self-contained files for paste into CodePen (or anywhere HTML runs):

| File | Theme |
|------|--------|
| [`collection/`](collection/) | Desk with **Open** + **Copy HTML** |
| `collection/theme-plate.html` | Light / Dark · Infinite (in-file toggle; keeps the run) |
| `collection/theme-fire.html` | Fire · Finite |
| `collection/theme-plague.html` | Plague · Finite |
| `collection/theme-escape.html` | Escape · Infinite |

Regenerate after production changes:

```bash
python3 tools/export-collection.py
python3 tools/export-collection.py --check   # CI / drift guard
```

Exports inline `core.js`, chrome CSS, and IBM Plex (base64 woff2). Each file sets `window.HEXSWEEPER_ONEPAGER` (`allowModes: ["light","dark"]` on the plate; single `mode` on the others). Welcome stays hidden; Fire/Plague/Escape hide the theme switch. The live multi-theme game remains `index.html`.

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
- Drag to rotate; flag mode + long-hold; RM-safe camera (no lerp when reduced motion)
- Densities: **S** = 42 faces · 8 mines · **M** = 162 · 28 · **L** = 362 · 62 (~17–19% mine density)

Smoke: `node sphere/test-neighbors.js` (neighbor symmetry + flood closure at subdivisions 2, 4, 6).

Flat game remains the default at `index.html`.

## Choices hub

[`choices.html`](choices.html) — https://dr.eamer.dev/games/hexsweeper/choices.html

Curated entry for production play, the sphere experiment, and ten lab one-pagers under `choices/lab/`. Each lab page is playable in-browser and includes **Copy for CodePen** (full self-contained HTML). Regenerate with `python3 tools/export-choices-lab.py` after skin or engine changes. Not linked from the production theme switcher.

## Lab (prior art)

Open `lab.html` or `choices.html` locally or by URL path. Experimental skins remain under `skins/` for technique reference; production navigation only exposes Light / Dark / Fire / Plague / Escape.

## Accessibility

- Help dialog and keyboard shortcuts (`?`, `T`, difficulty keys as documented in-game)
- `prefers-reduced-motion` respected for particle / blast motion
- Touch: long-hold to flag; Fire drag tilts (camera locked); canvas uses `touch-action: none`

## Related

- Games index: `/games/` (icon: `/games/icons/hexsweeper.svg`)
- Three-mode cut plan: `~/craft/reports/by-date/2026-07-26/discuss-hexsweeper-three-modes.md`
- Screenshots (home): `~/hexsweeper-{light,dark,fire,plague,escape,white,mobile-*}.png`
