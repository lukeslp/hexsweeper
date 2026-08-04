# Hexsweeper

Hexagonal minesweeper for [dr.eamer.dev](https://dr.eamer.dev/games/hexsweeper/).

**Live path:** `/home/coolhand/www/dr.eamer.dev/games/hexsweeper/`  
**Public URL:** https://dr.eamer.dev/games/hexsweeper/

Edits here are live static deploys (same pattern as `/clocks/`). This folder is its own nested Git worktree.

## Modes (production)

| Theme | Board | Feel |
|------|--------|------|
| **Light** | Infinite | Soft neumorph plate; default at bare URL |
| **Dark** | Infinite | Same endless plate, dark tone |
| **Fire** | Finite | Magma / basalt with inset parallax |
| **Plague** | Finite | Larger mycelium specimen; hyphae + digit ticks |
| **Escape** | Infinite | Dark plate → cyan rift chase; dig ahead or get torn |

Cycle with the theme control or `T`. Deep-link with `?mode=light|dark|fire|plague|escape` (aliases: `white`, `minimalist`, `rift`, `magma-core`, `biolume-reef`). Preference key: `hexsweeper-mode-v3`.

First visit asks if you've played minesweeper (`hexsweeper-welcome-v1`). Chrome outside the board is the five themes + settings gear; score sits bottom-left.

### Interaction

| Action | How |
|--------|-----|
| Dig | Click / tap |
| Flag | Right-click, Ctrl/⌘-click, long-hold, or Settings → Flag mode (`F`) |
| Pan | Drag · Space-drag · middle-drag |
| Zoom | Scroll · pinch · `+` / `−` (persists as `hexsweeper-zoom-v1`) |
| Chord | Click a revealed number whose neighbor flags match the count |
| Restart | `R` or Settings → restart |

## Layout

| File | Role |
|------|------|
| `index.html` | Production game (modes, renderer, HUD, help) |
| `core.js` | Shared engine: hex grid, endless growth, input, hooks |
| `skin-chrome.css` | Shared nav / settings / overlay chrome |
| `classic.html` | Lab baseline neumorph skin |
| `lab.html` + `skins.json` + `skins/` | Dormant visual lab — not linked from production |

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

Open `lab.html` locally or by URL path. Ten experimental skins remain under `skins/` for technique reference; production navigation only exposes Light / Dark / Fire / Plague.

## Accessibility

- Help dialog and keyboard shortcuts (`?`, `T`, difficulty keys as documented in-game)
- `prefers-reduced-motion` respected for particle / blast motion
- Touch: long-hold to flag; canvas uses `touch-action: none`

## Related

- Games index: `/games/` (icon: `/games/icons/hexsweeper.svg`)
- Three-mode cut plan: `~/craft/reports/by-date/2026-07-26/discuss-hexsweeper-three-modes.md`
- Screenshots (home): `~/hexsweeper-{white,fire,plague,mobile-*}.png`
