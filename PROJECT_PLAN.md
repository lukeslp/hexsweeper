# Hexsweeper — project plan

## Objective

Ship a polished hexagonal minesweeper as a live static game on dr.eamer.dev, with a clear three-mode product surface and a retained skin lab as dormant prior art.

## Architecture

- **Static artifact** under `www/dr.eamer.dev/games/hexsweeper/` (symlink: `~/dr.eamer.dev`).
- **`core.js`**: axial hex map, finite + endless modes, input (mouse/touch), flood reveal, flags, RAF loop, skin hooks.
- **`index.html`**: production chrome + five-theme model + custom Canvas rendering (neumorph Light/Dark/Escape, Fire magma pit, mycelium Plague).
- **Lab tree**: `lab.html`, `classic.html`, `skins/*`, `skins.json` — not linked from production UI.

## Current status (2026-08-04)

Five-theme production cut is **landed**, plus chrome/UX polish:

- [x] Public themes: Light / Dark / Fire / Plague / Escape
- [x] Theme selector + `T` shortcut
- [x] Biolume recast as Plague (flat, hyphae, spores)
- [x] Fire magma pit (viewport-fit board, pit tilt, boiling center, contact shadows; no streak rain)
- [x] Shared detonation FX
- [x] Escape rift chase (grace → awaken → tear/chase → catch burst)
- [x] Help / metadata describe modes, not the skin lab
- [x] Bare URL opens infinite Light
- [x] Light↔Dark keeps the run (cosmetic swap)
- [x] First-visit welcome: “Have you played minesweeper?” + refresher
- [x] Chrome triad: stats lower-left · themes center-bottom · controls lower-right (+ glass, esp. Light)
- [x] Blast cycle settle resets alphas/shards/particles (no broken corpses)
- [x] Plague specimen: Verdigris / Moss / Copper verdigris materials language
- [x] Plague specimen slide underlay — soft, edge-free field (no hex-shaped halo)
- [x] Plague colony field: low-frequency growth banding + clustered copper fruiting
- [x] Escape legibility pass: own cool bloom (was inheriting Soft White's white glow),
      muted digit palette, calmer bevels, one digit reading channel (ticks/glow dropped)
- [x] Finite themes open on the large board; size row hidden for infinite themes
- [x] Plague board radii +4 (easy 8 / medium 10 / hard 12)
- [x] Project README + this plan + file banners
- [x] Drag pan · wheel/pinch zoom (persisted) · flag mode in settings
- [x] Light/Dark lattice seams readable when zoomed out
- [x] Infinite autosave + JSON export/import (plate + Escape lanes)
- [x] Fresh-run contract: R / Restart / S·M·L all clear the active autosave lane
- [x] Chord on satisfied numbers · `R` restart · quiet score rail
- [x] Fire/Plague full-bleed · Fire void underlay + center boil · Plague digit ticks
- [x] Plague Moss/mycelium-network visual pass
- [x] Blast settle + full FX reset on restart

## Outstanding

- [x] Nested git repo for production folder (commit/push history)
- [ ] Optional: prune or archive lab skins that no longer inform the renderer
- [ ] Optional: automated smoke (desktop/mobile) in CI — currently manual / browser probes

## Risks

- Live static path with no dedicated worktree — bad deploys are immediate.
- Mode switch resets the run (infinite vs finite topology).
- Lab `skins.json` still points some entries at experimental files; do not promote them into production nav without a deliberate product decision.

## Acceptance (production)

Five themes reachable; Light/Dark/Escape infinite; Fire fits the viewport with a living center boil; Plague reads as a specimen slide with distinguishable tiles; Escape is calm and legible at full-field density; finite themes default to the large board and only they show the size row; welcome once; chrome triad (stats / themes / controls); settings holds everything but themes; input and reduced-motion still work.
