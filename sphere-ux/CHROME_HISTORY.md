# Sphere UX chrome — experiment log

Working notes for `sphere-ux/` only. Live `sphere/` is unchanged.
These iterations are kept on purpose: each is a valid chrome idea; not every one fits this product forever.

| Date / commit | Idea | Keep? |
|---------------|------|--------|
| Early | Gear + settings stack (dev-chrome) | Live sphere still uses a form of this |
| Polar fan bloom | Loose arc of hexes from bottom seed | Superseded by axial grid |
| clex axial ring | Full 6-neighbour honeycomb mid-screen | Great for center-stage menus; clipped at bottom |
| Nested Look pile-up | Axes + packs + counts + reset + help in one fan | Too dense (see CleanShot 18.54.13) |
| Cycle primaries | Dig / Size / Invert / Flush / Seams flip on click | **Keep** — low friction |
| Classic axes + World packs | Bg/Shell/Dug + Earth/Moon/Glow under Look | **Keep** — appearance model |
| Independent relief/seams | Surface ≠ count paint | **Keep** |
| Flag = hover height | Flagged tiles match hover extrusion | **Keep** |
| Attention fade dock | Hide chrome while on the board | **Keep** (tune band/threshold anytime) |
| Three-tile dock | Restart · Menu · Help always reachable | **Keep** |
| Bloom-sized dock | Dock tiles match primary hex size | Refined: idle smaller, open full size |
| Upward fan from Menu | No south petals; origin = activation node | **Keep** |
| Idle side tiles borderless + center icon | Quiet chrome; grow/rise with bloom | **Keep** |
| Idle dock smaller/lower → grow+lift with bloom | Restart/? borderless until open; Menu hex icon; open restores borders + full size + lift | Current |
| Petal layout mid-grow (broken) | Live `getBoundingClientRect` during dock size/lift stacked Dig/Size under dock | Fixed: final open geometry from CSS tokens (`--tile-h`, dock `--dock-rise`) |

## Journey assumptions (2026-08)

1. Spin globe  
2. Dig  
3. Open menu  
4. Help once  
5. Restart often  

## External reviews (summaries)

- **Codex Sol / Claude Opus:** three-tile dock preferred; depth ≤ 2; Dig/Restart outside “settings”; Earth/Moon as World presets under Look (not Help easter eggs only).

## Regenerate collection one-pagers

```bash
python3 tools/export-collection.py
```

Live lab: `https://dr.eamer.dev/games/hexsweeper/sphere-ux/`  
Collection desk: `https://dr.eamer.dev/games/hexsweeper/collection/` (includes Bloom UX export)

## 2026-08-09 — flatten, swap, dome (session log)

| Date / commit | Idea | Keep? |
|---------------|------|--------|
| `720f9ed` | Water theme: half-submerged globe, waterline slider, `?water=` | **Keep** — liked |
| `bb010de` | Earth/Moon/Water as Surface swatch row in the ? modal; Glow deleted | **Keep** — "subtle fun ones" placement is right |
| 2026-08-10 | Water removed from the `sphere-ux` product surface and theme cycle | **Shelved** — renderer preserved in `collection/theme-water.html` and the `wheel/` prototype; do not spend product time on the mode yet |
| `128f04f` | No sub-bloom: Look flattened to 9 cycle primaries (`PRIMARY_SLOTS` seats / `LEAF_RING` fans split) | **Keep the split**; tile count is still wrong (see below) |
| `128f04f` | Indicators = one rotation (123 → Mark → Rings); dedicated glyph (the `numerals` icon read as "1s") | **Keep** |
| `17a1dd6` | Seat swap: Invert to the notch right of Dig, Indicators up by 3D | **Keep** |
| `16c9bf5` | Dome: per-tile hinge tilt toward viewer + translateZ + 1/cos gap compensation | **No** — reverted in `edcd9c5`. Revive with `git revert edcd9c5` |
| variant A | `?dock=split` — bloom = Dig · Size · Invert only; appearance as Look pills in the ? modal | **Retired 2026-08-10** — Luke: "it's the same w/o themes, basically?" The modal settings were invisible enough that the variant read as the default minus features. Default dock wins. |
| 2026-08-10 | Dock trio = Restart · Menu · **Flag**; Help moves to its own corner seat (lower right, idle-sized, fades with chrome) | **Keep** — flag is the most-flipped switch on mobile and was two taps deep |
| 2026-08-10 | Bloom minimized to six: Dig/Flag tile out (Flag lives on the dock), Bg/Shell/Dug collapsed to one **Light/Dark** cycle (sun/moon). Axis machinery kept for a future three-adjusts variant | **Current default** |
| 2026-08-10 | `?dock=center` — the clex axial ring returns at viewport center over the blurred sphere. It shares the contextual variant's austere, icon-only layout: yellow Reset in the middle, yellow Home west, stateful Flag east. The former Size seat is now a Theme-style parent that blooms Size, Seams, and Indicators on hover (activate on touch/keyboard). Background tap opens and outside click / Escape closes. No dock; corner ? stays. | **Trial** — fixed-center counterpart to contextual placement |
| 2026-08-10 | Center flower fills its lower ring: Undo takes the west seat, Home moves southwest, and Settings sits southeast. Settings blooms the existing Invert, Effects, and Help controls; both Theme and Settings open on hover or activation. | **Current center layout** |
| 2026-08-10 | Center controls adopt conventional glyphs: green counter-clockwise Undo, paintbrush Theme, and horizontal-slider Settings. | **Keep** — quicker recognition without labels |
| 2026-08-10 | Invert leaf becomes a four-state monochrome disk: white (off), vertical split (X), horizontal split (Y), black (X+Y). Pointer parallax and per-tile Z lift are now dome-only so the standard flower cannot drift visually off-axis while operating branches. | **Keep** |
| 2026-08-10 | Upper-right parent changes from paintbrush Theme to `!` Indicators. Its three binary leaves are Numerals/Inner Hex, Seams/Seamless, and 3D/Flush; each leaf carries a distinct stateful glyph. | **Current center layout** |
| 2026-08-10 | Icon-only center controls gain concise custom tooltips on hover and keyboard focus. Toggle tooltips carry their live state and sit outside the clipped hex faces. | **Keep** — preserves the austere surface without making glyph recall a prerequisite |
| 2026-08-10 | `?dock=context` — fast, icon-only flower follows the background-canvas click and clamps around viewport/HUD edges. Mobile keeps a substantially larger footprint; the faces use the sphere's austere white-and-hairline material. Reset moves to the yellow center; its west seat becomes yellow Home; east is a persistent flag glyph that turns red only while flag mode is active. | **Trial** — contextual alternative to fixed center |
| 2026-08-10 | **Four-tile row** (discuss --debate verdict): Theme · Size · Surface (3D/Flat/Ink curated 3-state) · Marks; Invert + Effects (new Auto/Full/Reduced) moved to ? modal Controls pills; seed icon = hex-nut settings. Center mode = true 7-hex flower | **Current default** |
| 2026-08-10 | `?dome=1` — dome retry on the center flower; inverted to a **bowl** per Luke (center recessed, rim rolled toward the player, larger: 24°/72px) | **Trial** |
| 2026-08-10 | Harness note: under `--virtual-time-budget` the compositor can go idle and **starve every queued rAF** (bloom renders schedule via rAF) — a pump can't bootstrap itself either. When headless captures come up empty but the code is sound, verify on a live browser; Luke's device screenshots are the ground truth channel | **Process** |
| 2026-08-10 | `?seed=bare` — idle dock is three naked glyphs; hex faces appear on activation | **Trial** |
| 2026-08-10 | All variants integrated into the **uxperiments harness**: `dr.eamer.dev/uxperiments/hexdock/` — live builds + frozen archives (nine-tile, dome, split) + shelved concepts. New experiments should land there even when they are not the chosen candidate | **Process** |

### What Luke is asking for (intent thread, in his words + readings)

1. **Fewer tiles.** "That should reduce tiles considerably" — the stated goal of the whole redesign. Flattening removed the sub-bloom but went 6+10 → 9 primaries: flatter, not smaller.
2. **Everything a rotation.** No fan-outs, no submenus — tap cycles state, the label carries the state.
3. **Novelty themes are easter eggs, not controls.** Earth/Moon/Water in the ? modal, "little subtle fun ones," not dock citizens.
4. **Seats matter spatially.** "the notch right of dig," "swap mark and invert" — he places tiles deliberately; keep seating hand-tunable (PRIMARY_SLOTS does this).
5. **Depth/delight, tied to the sphere.** "like the opposite of the sphere… blooming out and towards" — the *instinct* stands; the per-tile hinge-tilt execution read wrong. Don't drop the idea, drop the technique.
6. **Never lose an experiment.** "commit first I don't want to lose anything" — commit before trying anything speculative.

### Open problem — the menu still isn't right

Current 9-tile bloom, suspected reasons it doesn't sit well:

- **Count**: 9 primaries when the goal was reduction; play control (Dig/Flag) mixed into an appearance cluster.
- **Shape**: 2-3-4 trapezoid, lopsided; not a honeycomb form worth staring at.
- **Grammar mix**: labeled-icon tiles vs icon-only swatches vs fixed dock, three vocabularies in one cluster.
- **Labels**: "Off" (invert of *what*?), "3D", "S" badge — cryptic at a glance.
- Prior external review (above) already said: Dig/Restart outside "settings," depth ≤ 2.

### Variant menu (next things to try)

- **A. Split play/settings** — dock = Dig/Flag · Restart · Help (maybe Size); *all* appearance moves into the ? modal next to the Surface row (that pattern already landed and was liked). Bloom shrinks to 3–4 tiles or disappears. **Built 2026-08-09 behind `?dock=split`** — flip the flag to compare; promoting it to default would also let the dead sub-bloom machinery (addSubmenu / leafOffsets / LEAF_RING, unused since the flatten) be deleted.
- **B. True flower** — exactly 6 primaries on the ring-1 hexagon around the seed; symmetric bloom. Needs merges: Bg/Shell/Dug → one "Ink" rotation (or tap = shell, long-press = bg), Seams+3D → one "Surface" rotation.
- **C. 3-3 symmetric rows** — halfway house if 6 is too aggressive.
- **D. Depth, other techniques** (dome retry list):
  - whole-cluster tilt: one `rotateX` on the stage, not per-tile hinges — no gaps, no scale compensation;
  - concave bowl: continue the sphere's curvature instead of inverting it;
  - hover-only lift: depth as motion (tile comes toward you on hover), flat at rest;
  - fake depth: ring-graded scale + shadow, zero 3D transforms;
  - open animation arrives from behind the dock toward the viewer, settles flat.
- **E. Arc dock** — seat tiles along the sphere's lower rim arc so chrome and board share geometry.
- **F. Bottom sheet** — conventional grouped settings panel; hexes survive only as swatches. Least hexy, most legible.
