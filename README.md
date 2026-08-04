# Hexsweeper

Hexagonal minesweeper for [dr.eamer.dev](https://dr.eamer.dev/games/hexsweeper/).

**Live path:** `/home/coolhand/www/dr.eamer.dev/games/hexsweeper/`  
**Public URL:** https://dr.eamer.dev/games/hexsweeper/

Edits on Drummer are live static deploys (same pattern as `/clocks/`). This folder is its own nested Git worktree (`lukeslp/hexsweeper`). Beast mirror: `/Users/luke/workspace/hexsweeper`. Typography is self-hosted IBM Plex under `fonts/` (SIL OFL 1.1 — see `fonts/OFL.txt`; no Google Fonts CDN).

## Modes (production)

| Theme | Board | Feel |
|------|--------|------|
| **Light** | Infinite | Flat minimal field; default at bare URL |
| **Dark** | Infinite | Flat minimal field, night |
| **Fire** | Finite | Magma pit — large fill, bowl tilt, boiling center |
| **Plague** | Finite | Green specimen tiles (irregular faces) + hyphal mat |
| **Escape** | Infinite | Calm slate plate → classic dig/flag/chord; a glacial rift seeps toward your digs |

Fire and Plague open on the **large** board; board size (S·M·L) lives in Settings and only appears for those two, since the infinite themes have no fixed board.

Cycle with the theme control or `T`. Deep-link with `?mode=light|dark|fire|plague|escape` (aliases: `white`, `minimalist`, `rift`, `magma-core`, `biolume-reef`). Preference key: `hexsweeper-mode-v3`.

First visit asks if you've played minesweeper (`hexsweeper-welcome-v1`). Chrome: lower-right **Light/Dark · Reset · Menu** (hex icon). Scores, modes, board size, flag, help, export/import, and outbound links (Luke Steuber · Data Poems) live in Menu. Fire / Plague / Escape restyle the Menu panel to match their materials.

### Interaction

| Action | How |
|--------|-----|
| Dig | Click / tap — empty floods open outward in rings |
| Flag | Right-click, Ctrl/⌘-click, long-hold, or Settings → Flag mode (`F`) |
| Pan | Drag · Space-drag · middle-drag |
| Zoom | Scroll · pinch · `+` / `−` (persists as `hexsweeper-zoom-v1`) |
| Chord | Click a revealed number whose neighbor flags match the count |
| Restart / size | `R`, Restart, or S·M·L (finite only) — each clears that lane’s autosave |
| Export / Import | Settings → Export run / Import run (infinite Light/Dark/Escape JSON) |

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
    beforeFrame, drawCell, decorateCell, afterFrame,
    onReveal, onFlag, onGameOver,
  },
});
```

Also exported: `Hexsweeper.DEFAULT_THEME`, `DEFAULT_CONFIG`, `SQRT3`.

## Lab (prior art)

Open `lab.html` locally or by URL path. Experimental skins remain under `skins/` for technique reference; production navigation only exposes Light / Dark / Fire / Plague / Escape.

## Accessibility

- Help dialog and keyboard shortcuts (`?`, `T`, difficulty keys as documented in-game)
- `prefers-reduced-motion` respected for particle / blast motion
- Touch: long-hold to flag; canvas uses `touch-action: none`

## Related

- Games index: `/games/` (icon: `/games/icons/hexsweeper.svg`)
- Three-mode cut plan: `~/craft/reports/by-date/2026-07-26/discuss-hexsweeper-three-modes.md`
- Screenshots (home): `~/hexsweeper-{light,dark,fire,plague,escape,white,mobile-*}.png`
