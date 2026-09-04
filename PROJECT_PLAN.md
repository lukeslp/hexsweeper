# Hexsweeper — project plan

## Objective

Ship a polished hexagonal minesweeper as a live static game on dr.eamer.dev,
opening through three structural boards — Infinite, Classic, and Sphere — while
preserving the five-mode flat game and the skin lab as deeper product surfaces.

## Architecture

- **Static artifact** under `www/dr.eamer.dev/games/hexsweeper/` (symlink: `~/dr.eamer.dev`).
- **`core.js`**: axial hex map, finite + endless modes, input (mouse/touch), flood reveal, flags, RAF loop, skin hooks.
- **`sphere/` → `index.html`**: the root is Sphere itself, sealed by the exporter; no prompt in the way.
- **`tools/app-launcher.html` → `launcher.html`**: web three-hex games menu (Infinite, Classic, Sphere, centered Resume). The native app is sphere-only.
- **`infinite.html` / `bounded.html`**: generated web product pages from the plate and Classic collection exports.
- **`play.html`**: production flat-game chrome + declarative profiles over custom Canvas rendering. Mode, material identity, cosmetic particle channels, and endgame feedback are separate axes.
- **Lab tree**: `lab.html`, `classic.html`, `skins/*`, `skins.json` — not linked from production UI.

## Current status (2026-09-04)

- [x] Reworked dense Android drag frames after the physical Fire-tablet XL
  gate exposed an 11–13 fps path: front-hemisphere projection now skips
  retained lift/pick geometry, Light/Dark faces paint in compound style
  batches, hit-testing stops after touch becomes a drag, and full-detail
  rendering returns when motion settles.
- [x] The 30-minute candidate soak exposed the same full-detail cost during
  automatic XL idle spin and needless static redraws (53 ms median across
  10,077 frames). Ambient motion now shares the compact projection and
  batching path; once motion stops, the detailed resting frame paints once
  and the loop parks until input, resize, or animation makes it dirty.
- [x] The native-payload browser contract now runs with a Fire-like Android
  user agent and explicitly drags the full 2,252-face XL sphere before checking
  the settled frame.
- [x] Re-vendored in native commit `79b6c0e`, signed as `1.0.3 (28)`, and
  measured on KFRASWI: XL is 10 ms median portrait and 7 ms median landscape;
  the representative 1,002-face board is 8 ms median. The 25 fps physical
  device gate passes; its 31-minute process/lifecycle soak had no crash or ANR
  and exposed the ambient/static rendering follow-up below.
- [x] Final native `1.0.4 (29)` includes the ambient/static-loop follow-up.
  XL automatic motion is 6 ms median / 9 ms p90; a five-minute, 55-drag stress
  pass is 13 ms median / 18 ms p90 with no missed vsync, crash, or ANR. The
  installed APK bytes match the staged release hash.

## Current status (2026-08-18)

- [x] **Rolled back the interiors pass** (`7938944`): Mercury's liquid-metal wells and the other six mirror cores are the build-50 reference again; hollow shells and lat/lon interiors are gone. Themes still own count/relief/seams (mirror materials depth + no seams; Light/Dark depth + seams).
- [x] The ? sheet is tabbed — Play · Themes · Board · Settings (`f32a0b2`).
- [x] Interiors, round two (`1f90542`…`d432cde`, one commit per theme for individual rollback): Galaxy black hole grown to 0.16 R with no star arcs, an infalling star, B&W ring counts; Aurora curtains; Ion Storm plasma filaments over cobalt; Stratosphere sky + clouds over porcelain; Heat Lightning cloud deck lit by sheet flashes + bolts. Interior effects clip to the sphere disc and only use faces with z > 0.22 (fixed the build-55 rim bleed). Grok (xai/grok-4.5) consulted via /craft:ask; local qwen3.8:27b-mlx stood in for the missing cloud tag.
- [x] Drag X default flipped (drag right → face moves left; Invert X = finger-following), both engines; v5 resets ambiguous older prefs to that default. The Board-tab Wheel door is icon-only.
- [x] Fire tablet performance pass: Android-only Canvas resolution budget, cached/cullable sphere projection, interaction detail levels for dense boards, and a texture-preserving lightweight reflection shader; full detail returns at rest and the web/Apple renderer is unchanged.
- [x] Interiors settled (`HEAD`): only Mercury (liquid metal) and Galaxy (black hole) keep one; Aurora, Ion Storm, Gilded Ribbon, Heat Lightning, Stratosphere are mono wells with depth + seams on the Light/Dark model (Stratosphere white). Unmapped painters/palettes kept for a one-line revert.
- [x] Drag sensitivity validated and made scale-aware (`0.9/scale` rad/px ≈ 1.3× tracking) in both engines; vertical follows the finger and horizontal uses the object-turning mirrored default.
- [x] Follow-up: Stratosphere flags red; Ion Storm (cobalt), Aurora (verdigris), Heat Lightning (copper) back to plain seamless metals with depth — their effects unmapped, painters kept.
- [x] Water Wheel floats (buoyant bob/sway; waterline fixed to the frame); tutorial page-2 art redrawn; a wave button on the Board tab opens the Wheel beside the mine-count hold.

- [x] Regression fixed: TestFlight 51's Mercury called a deleted interior painter; the first clear threw inside `draw()`, the frame loop died and the sphere stopped answering touch. `drawMetalFace` (grain by lat/lon, view-locked gleam) replaces it; `loop()` survives a painter exception; the app contract now clears, flags and drags on every theme with uncaught exceptions captured, and a Playwright WebKit probe covers the engine iOS actually runs.
- [x] Best times per board size (`hexsweeper-sphere-best-v1`): win banner + size pills on the settings sheet.
- [x] The Water Wheel as a hidden second sphere: hold the mine count (water rises), the app payload ships `wheel.html` (sealed, app-flagged, own tutorial, Sphere pill home); web root points at `wheel/`.

## Current status (2026-08-14)

- [x] Shared launcher promoted to the public web root: three mode hexes plus a centered Resume; last-used settings launch each game.
- [x] Infinite, Classic, and Sphere route to first-class web game pages.
- [x] Infinite/Classic/Sphere Resume and per-mode stateful launch settings retained.
- [x] Former root `?mode=`, `?theme=`, and `?deal=` links forward to `play.html`.
- [x] Generated Infinite/Classic and canonical Sphere expose a 44px Games return.
- [x] Root launcher retains native links, keyboard focus, reduced motion, forced colors, and a no-script fallback.

## Current status (2026-08-13)

- [x] Flux Sphere implements the archived “Dig one, reveal both” promise as
      deterministic distant safe-face pairs on the shared Sphere engine.
- [x] Linked reveals use one reveal-scoped engine API, stay inside canonical
      flood, undo, persistence, and win handling, and never echo from mines.
- [x] Flux has isolated save/run identity, keyboard controls, live text,
      non-color endpoint glyphs, reduced-motion behavior, and normalized
      exactly-once completion events.
- [x] Flux pair, route, and Sphere lifecycle contracts cover deterministic
      pairing, malformed restore rejection, held flagged echoes, first-dig
      undo regeneration, safe linked floods, and canonical regressions.

- [x] Glitch Sphere experimental route reuses the canonical Sphere engine with
      an isolated moving-hazard state machine and save lane.
- [x] Deterministic state-machine and integration tests verify eligible spawn,
      one-second movement, route blocking, trap win, mine loss, occupied-face
      admission, pause/resume timing, persistence validation, keyboard wiring,
      and same-origin completion forwarding.
- [x] Desktop and mobile Chrome verification exercises first dig, active hazard,
      keyboard rotation/dig/flag, reset, reload restore, deterministic win/loss
      fixtures, and one completion event per terminal run with no console or
      local-resource failures.
- [x] Reduced-motion Chrome verification keeps the occupied-face marker and
      movement cadence while removing transition motion.
- [x] Glitch Sphere is discoverable from the README and Choices hub without
      entering the five-theme production switcher.
- [ ] Deployment: re-vendor the regenerated offline Sphere payload into the
      separate `hexsweeper-app` repository after this web change is integrated.

## Current status (2026-08-10)

- [x] Product profile seam separates structural mode behavior, material identity, optional ambient/reveal/flag effects, and mandatory endgame feedback.
- [x] Infinite Light/Dark normal digs are particle-quiet without losing the shared mine detonation.
- [x] Reduced Effects retains the calm readable detonation path (no shake or shards) instead of suppressing loss feedback.
- [ ] Future: compatibility metadata and UI for promoting selected collection materials/effects as skins. Do not treat Fire, Plague, Water, or Escape mechanics as cosmetic skins.

## Current status (2026-08-08)

- [x] Sphere Customize panel + undo (in-run theme/board tweaks, one-step undo)
- [x] Sphere share card that works — real capture, wired from Customize panel
- [x] Sphere Glow theme — luminous dig centers
- [x] Sphere Mercury theme — reflection studio material ported into the canonical engine (`sphere/mirror-material.js`), ships offline
- [x] Flower Theme tile (Light → Dark → Stratosphere → Mercury → Ion Storm → Aurora → Galaxy → Gilded Ribbon → Heat Lightning), corner Menu glyph, touch-sized help sheet, larger sphere on portrait phones
- [x] Stratosphere, Ion Storm, Aurora, Galaxy, Gilded Ribbon, Heat Lightning ported from the reflection studio as canonical themes (Amber Cells was tried and swapped out); textures moved to `sphere/assets/reflections/` and sealed into the app
- [x] Sphere Earth / Moon globe-map themes (`?theme=earth|moon`); Earth uses responsive 4K/2K multi-sample gloss rendering, with textures tracked in `sphere/assets/textures/`
- [x] Three archived model-authored visual studies on the collection desk — Kimi / Claude / Muse (`collection/sphere-kimi.html`, `-claude.html`, `-muse.html`); design specs in `sphere/takes/*.json`
- [x] Free 360° drag tumble (was constrained camera)
- [x] Autosave discard confirms; red-only flags
- [x] `sphere/dev/` dev-chrome overlay (grid/debug HUD) alongside prod `sphere/index.html`

## Current status (2026-08-05)

- [x] **Plate perf** — Light/Dark: seam-only Soft UI LOD when zoomed out (0.87 enter / 0.91 exit hysteresis; landing zoom 0.72); full extrusion when zoomed in; Escape keeps its own seam LOD; frustum cull @ 80 cells in LOD / 220 full; IntersectionObserver + iframe blur + idle RAF throttle in `core.js`
- [x] **No dig auto-pan** — `core.js` no longer calls `focusOnCell` on dig/chord; Escape intro zoom on Reset unchanged
- [x] **Lab → collection** — `export-collection.py` exports `collection/skin-*.html`; desk lists Production + Lab with Open + Copy HTML (copy on index only)
- [x] **Choices lab redirects** — `choices/lab/*.html` redirect to collection pens; playable pages are game-only (no Copy bar)
- [x] **Choices hub** — `choices.html` points re-eval/copy to collection desk (curated; not in production theme switcher)
- [x] Sphere MVP — boards XS–XL (162/362/1002/1442/2252 faces), flood expand FX, backface cull, idle RAF throttle
- [x] Sphere smoke — `node sphere/test-neighbors.js` (neighbor symmetry + flood closure at subdivisions 4, 6, 10, 12, 15)
- [x] Sphere polish — trimmed icon help, size-cycle fix, endgame FX, no theme toast
- [x] Sphere framing — initial zoom pulled back (~0.72×)
- [x] Sphere on collection desk — Experiments tile with CodePen one-pager (`collection/sphere.html`, Open + Copy HTML)
- [x] Sphere autosave — `hexsweeper-sphere-run-v1` resume on refresh; confirm before Reset / size change
- [x] Sphere flags — pure red fill only (no tile glyph)
- [x] Sphere valley — four height tiers (flagged → covered → numbered → empty); borderless seamless basin floor
- [x] Flags stand proud of the shell as pins (extruded count styles only)
- [x] Sphere mono pairings — Light · Shell · Dark · Ink · Float · Card (Float/Card = light-field + contact shadow)
- [x] OG social cards — production themes, ten lab skins (`skin-*-og.png`), and `sphere-og.png`; wired on collection pens + `sphere/index.html`

## Current status (2026-08-04)

Five-theme production cut is **landed**, plus chrome/UX polish:

- [x] Fire mobile/desktop: `cameraLock` — drag tilts at zoom 1; zoom in → clamped pan (zoom slack + no dig-focus steal); hold = flag
- [x] Infinite Light/Dark distinct materials: porcelain chalk desk vs night-iron plate (desk field + bevel language)

- [x] Public themes: Light / Dark / Fire / Plague / Escape (Water demoted 2026-08-10)
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
- [x] Soft UI / Escape LOD: Light/Dark + Escape seam-only paint when zoomed out / huge map; hysteresis at crossover; RAF pauses on hidden tabs, offscreen canvas (IntersectionObserver), and throttles idle zoomed-out endless pens (including collection embeds)
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
- [x] Docs / `skins.json` production surface aligned to six themes
- [x] Collection one-pagers: `collection/theme-*.html` + `collection/skin-*.html` + Copy HTML desk + `tools/export-collection.py`
- [x] Production `HEXSWEEPER_ONEPAGER` (strict single theme, or scoped `allowModes` for Light/Dark plate)
- [x] Light/Dark collection cut is one file (`theme-plate.html`) with in-file toggle
- [x] Production chrome: BR Appearance · Reset · Menu (scores/modes/links inside Menu)
- [x] Lab skins + classic: same BR Reset · Menu; scores + outbound links in Menu (no BL rail / gear)
- [x] CI (`.github/workflows/ci.yml`): sphere neighbor smoke + Wheel effect-profile contract + `export-collection.py --check` + `export-choices-lab.py --check` on every push/PR to `main` — catches export drift before it ships (this is what would have caught the dev-chrome inlining gap)
- [ ] Optional: prune or archive lab skins that no longer inform the renderer
- [ ] Optional: add browser probes to CI — Glitch Sphere has a local deterministic desktop/mobile/reduced-motion probe; the wider visual surface remains manual
- [ ] Phase next: full / comprehensive / impressive cut beyond the collection scaffold

### Water Wheel — water as a mechanic, not a theme (Luke, 2026-08-10)

The Water theme was demoted as decoration, but its original intent is now
gameplay at **`wheel/`**: the sphere is a water wheel and the equatorial
waterline is its fixed trough. Clicking a mine arms it instead of ending the
run immediately. Rotate the armed face below the rendered surface and hold it
there briefly to quench it before the fuse expires. Quenched mines remain
revealed, inert, and persisted; they do not participate in the later loss
cascade.

The mechanic deliberately avoids turning flags into a mine oracle. Any normal
flag that dwells below the surface washes away identically, whether it was
right or wrong. Each rescue shortens the next fuse (3.0s → 2.2s → 1.6s) and
makes the sea retreat, adding rotation cost. Help, the hex menu, and app
backgrounding pause an active fuse; keyboard arrows rotate the wheel. Reduced
motion uses a static surface and a 5s assist fuse.

The renderer shares one wavy surface function between painting and gameplay.
Refraction and reflection are limited to the shallow rescue band; depth haze
intentionally obscures the submerged back half. The implementation stays on
the existing Canvas 2D/offscreen-buffer path with no new runtime dependency.
Cosmetic events live in `wheel/effects.js`: the default `kinetic` profile
composes wakes, bubbles, pigment wash, caustics, fuse atmosphere, underwater
detonation, and win ripples; `calm` preserves the base renderer. Effects remain
independent channels so later skins can recombine them without changing game
state or picking.
Menu presentation follows the same separation: `wheel/menu-variants.js`
selects only chrome treatment. Every profile now uses the production Sphere's
seven-action arrangement — Reset centered inside Appearance / Warning,
Undo / Flag, and Invert / Size — and a short tap outside the sphere exposes it.
`?menu=base` renders the exact centered flower; `?menu=takeover` maps that
arrangement onto a fixed real-face patch; `?menu=underwater` chooses the patch
below the shared water surface and adds depth material. The face profiles use
a transient, non-persisted camera zoom and leave gameplay, saves, effects, and
the action inventory alone. A three-step illustrated Dig / Menu / Quench tour
replaces the old introductory modal without hiding the surface-pack choice.
The archived decorative theme remains at `collection/theme-water.html` and
`?theme=water` on the sphere. The finished gameplay variant is linked from
`choices.html`, the parent games catalog, and the generated collection desk;
`collection/water-wheel.html` keeps its three tutorial illustrations inline.

## Risks

- Live static path — bad deploys are immediate; prefer commit → push → `git pull` on Drummer.
- Mode switch resets the run (infinite vs finite topology).
- Lab `skins.json` catalog is prior art only; do not promote lab skins into production nav without a deliberate product decision.
- Beast and Drummer can drift; Drummer remains canonical for the public URL.

## Acceptance (production)

Bare root is Sphere, restoring its own run silently. `launcher.html` is the
three-hex menu (Infinite, Classic, Sphere)
with Resume in the center when a run is waiting; each mode opens its game with
last-used settings and returns through Games; newest valid Infinite, Classic, or Sphere saves can resume;
launcher appearance follows system light/dark and is independent of gameplay;
old flat-game deep links retain their behavior at `play.html`; keyboard, touch,
forced colors, reduced motion, safe areas, and no-script navigation remain
usable. The flat game retains its five-theme acceptance contract: Light / Dark /
Escape infinite, Fire / Plague finite, matching chrome, persistence, and effects.
