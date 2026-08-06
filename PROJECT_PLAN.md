# Hexsweeper — project plan

## Objective

Ship a polished hexagonal minesweeper as a live static game on dr.eamer.dev, with a clear five-theme product surface (Light / Dark / Fire / Plague / Escape) and a retained skin lab as dormant prior art.

## Architecture

- **Static artifact** under `www/dr.eamer.dev/games/hexsweeper/` (symlink: `~/dr.eamer.dev`).
- **`core.js`**: axial hex map, finite + endless modes, input (mouse/touch), flood reveal, flags, RAF loop, skin hooks.
- **`index.html`**: production chrome + five-theme model + custom Canvas rendering (Soft UI Light/Dark, Escape neumorph, Fire magma pit, mycelium Plague).
- **Lab tree**: `lab.html`, `classic.html`, `skins/*`, `skins.json` — not linked from production UI.

## Current status (2026-08-05)

- [x] **Sphere MVP** — `sphere/` experimental closed hex minesweeper (Canvas projection, hexasphere math, dig/flag/flood, first-dig safe, RM-safe camera)
- [x] **Choices hub** — `choices.html` + `choices/lab/*` one-pagers (curated; not in production theme switcher)
- [x] Sphere smoke — `node sphere/test-neighbors.js` (neighbor symmetry + flood closure at subdivisions 1–2)

## Current status (2026-08-04)

Five-theme production cut is **landed**, plus chrome/UX polish:

- [x] Fire mobile/desktop: `cameraLock` — drag tilts at zoom 1; zoom in → clamped pan (zoom slack + no dig-focus steal); hold = flag
- [x] Infinite Light/Dark distinct materials: porcelain chalk desk vs night-iron plate (desk field + bevel language)

- [x] Public themes: Light / Dark / Fire / Plague / Escape
- [x] Theme selector + `T` shortcut
- [x] Biolume recast as Plague (flat, hyphae, spores)
- [x] Fire magma pit (viewport-fit board, pit tilt, boiling center, contact shadows; no streak rain)
- [x] Fire shaft camera: hover sinks crust, innie polarity (rim with-tilt / deep floor counter-shear), center-smaller scale, richer rim lip + lava underglow, spite vents up (PRM: static bowl + shading)
- [x] Fire volcano-mine pass: darker lamp well → center ember, rising heat motes in pit (PRM static), gooier overlapping boil blobs (canvas only; digits stay legible)
- [x] Fire hell-mine burn: bottom magma river, ~40 rising burn columns (CSS-burn carve+halo), ember tongues in letterbox void, denser ash rain outside honeycomb (PRM-safe; canvas only)
- [x] Fire hover: crust thins / boil wakes / neighbor heat bleed + spite ember orbit & burp (PRM-safe)
- [x] Shared detonation FX (Fire + Light/Dark plates)
- [x] Plague / Escape organic lose: hex-graph seep (infection bloom / lens swallow) — no shards
- [x] Escape rift chase (grace → awaken → continuous crawl → catch)
- [x] Escape MS-first rethink: dig/flag/chord primary; rift is glacial secondary threat (no dig-budget hex hops)
- [x] Escape finish tile: offscreen exit hex + edge direction cue; win on reveal (autosaved)
- [x] Escape rift polish: heartbeat pulse, intake motes, hunt arms; introZoom pull-back; RM-safe cues
- [x] Soft UI / Escape LOD: seam-only paint when zoomed out / huge map; RAF pauses on hidden tabs
- [x] Help / metadata describe modes, not the skin lab
- [x] Bare URL opens infinite Light
- [x] Light↔Dark keeps the run (cosmetic swap)
- [x] First-visit welcome: “Have you played minesweeper?” + refresher
- [x] Chrome: BR Appearance (sun/moon) · Reset · Menu; scores/modes/help inside Menu
- [x] Help copy cut to a short dig sheet; Menu stripped of UX blurb / section labels
- [x] Menu `[hidden]` flex override: Fire/Plague hide Export/Import + infinite hide S·M·L (`display: none !important`)
- [x] BR Appearance: one icon via CSS `body[data-mode]` (SVG `[hidden]` was showing both)
- [x] Menu theme chrome for Fire / Plague / Escape + outbound links (lukesteuber.com · datapoems.io)
- [x] Blast cycle settle resets alphas/shards/particles (no broken corpses)
- [x] Plague specimen: Verdigris / Moss / Copper verdigris materials language
- [x] Plague specimen slide underlay — soft, edge-free field (no hex-shaped halo)
- [x] Plague colony field: low-frequency growth banding + clustered copper fruiting
- [x] Escape legibility pass: own cool bloom (was inheriting Soft White's white glow),
      muted digit palette, calmer bevels, one digit reading channel (ticks/glow dropped)
- [x] Self-hosted IBM Plex (no Google Fonts CDN); fixed font URLs + distinct weights
- [x] Fire opens large and fills ~98% of the viewport so the pit reads as one composition
- [x] Fire viewport fill: no chrome-stolen padding / cellSize cap; innie shaft recentered (no letterbox gaps)
- [x] Fire dense honeycomb: face pack ~0.96–0.99 of spacing (was ~0.48–0.90 via aggressive `_depthScale`); whisper bowl; zoom floor 1 on Fire apply
- [x] Plague full-field culture-slide slime (blooms / filaments / beads under the lattice)
- [x] Progressive empty-cell flood: BFS rings open outward to the numbered boundary
- [x] Plague irregular face scale + off-center shading; green-forward grid with rose-copper complements
- [x] Plague board radii +4 (easy 8 / medium 10 / hard 12)
- [x] Project README + this plan + file banners
- [x] Drag pan · wheel/pinch zoom (persisted) · flag mode in settings
- [x] Light/Dark lattice seams readable when zoomed out
- [x] Light/Dark Soft UI neumorph (raised covered / inset revealed; Escape paint at lower intensity)
- [x] Fire OG social cards under `assets/social/fire-og*.png`
- [x] Playtest pass: warmer Fire letterbox hell walls; Soft UI wells/bevel contrast tuned
- [x] Infinite autosave + JSON export/import (plate + Escape lanes)
- [x] Fresh-run contract: R / Restart / S·M·L all clear the active autosave lane
- [x] Chord on satisfied numbers · `R` restart · quiet score rail
- [x] Fire/Plague full-bleed · Fire void underlay + center boil · Plague digit ticks
- [x] Plague Moss/mycelium-network visual pass
- [x] Plague hive underlay: seeded mycelial graph, nutrient pulses, fruiting nodes, LOD + PRM
- [x] Plague specimen LOD: seam-only faces + throttled hyphae/particles at extreme zoom-out (full bacteria at normal play; hive underlay throttles at LOD 1)
- [x] Blast settle + full FX reset on restart
- [x] Cold load / Reset parity: applyTheme before startFreshRun so full-bleed canvas matches

## Outstanding

- [x] Nested git repo for production folder (commit/push history)
- [x] Self-hosted fonts committed (`fonts/` + OFL) so GitHub clones match live typography
- [x] Docs / `skins.json` production surface aligned to five themes
- [x] Collection one-pagers: `collection/theme-*.html` + Copy HTML desk + `tools/export-collection.py`
- [x] Production `HEXSWEEPER_ONEPAGER` (strict single theme, or scoped `allowModes` for Light/Dark plate)
- [x] Light/Dark collection cut is one file (`theme-plate.html`) with in-file toggle
- [x] Production chrome: BR Appearance · Reset · Menu (scores/modes/links inside Menu)
- [x] Lab skins + classic: same BR Reset · Menu; scores + outbound links in Menu (no BL rail / gear)
- [ ] Optional: prune or archive lab skins that no longer inform the renderer
- [ ] Optional: automated smoke (desktop/mobile) in CI — sphere neighbor test exists (`sphere/test-neighbors.js`); browser probes still manual
- [ ] Optional: `export-collection.py --check` in CI; CodePen push via codepen-prefill when published
- [ ] Phase next: full / comprehensive / impressive cut beyond the collection scaffold

## Risks

- Live static path — bad deploys are immediate; prefer commit → push → `git pull` on Drummer.
- Mode switch resets the run (infinite vs finite topology).
- Lab `skins.json` catalog is prior art only; do not promote lab skins into production nav without a deliberate product decision.
- Beast and Drummer can drift; Drummer remains canonical for the public URL.

## Acceptance (production)

Five themes reachable; Light/Dark/Escape infinite; Fire fits the viewport with a living center boil; Plague reads as a specimen slide with distinguishable tiles; Escape is calm and legible at full-field density with an offscreen finish + edge cue (win on reveal); finite themes default to the large board and only they show the size row; welcome once; BR chrome is Appearance sun/moon (Light/Dark only) · Reset · Menu as matching icon buttons; Menu holds scores, modes, play aids, and outbound links; Fire/Plague/Escape Menu panels match theme materials; input and reduced-motion still work.
