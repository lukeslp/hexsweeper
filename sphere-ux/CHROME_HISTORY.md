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
| 2026-08-10 | Indicator leaves share one optical box and quieter state grammar: larger `123`, nested filled hex, one silhouette for seams on/off, and flat/extruded versions of one depth form. Branch emphasis now dims glyphs only; tile faces stay opaque over the sphere. | **Keep** — recognition and hierarchy without visual noise |
| 2026-08-10 | `?dock=context` — fast, icon-only flower follows the background-canvas click and clamps around viewport/HUD edges. Mobile keeps a substantially larger footprint; the faces use the sphere's austere white-and-hairline material. Reset moves to the yellow center; its west seat becomes yellow Home; east is a persistent flag glyph that turns red only while flag mode is active. | **Trial** — contextual alternative to fixed center |
| 2026-08-10 | **Four-tile row** (discuss --debate verdict): Theme · Size · Surface (3D/Flat/Ink curated 3-state) · Marks; Invert + Effects (new Auto/Full/Reduced) moved to ? modal Controls pills; seed icon = hex-nut settings. Center mode = true 7-hex flower | **Current default** |
| 2026-08-10 | `?dome=1` — dome retry on the center flower; inverted to a **bowl** per Luke (center recessed, rim rolled toward the player, larger: 24°/72px) | **Trial** |
| 2026-08-10 | Harness note: under `--virtual-time-budget` the compositor can go idle and **starve every queued rAF** (bloom renders schedule via rAF) — a pump can't bootstrap itself either. When headless captures come up empty but the code is sound, verify on a live browser; Luke's device screenshots are the ground truth channel | **Process** |
| 2026-08-10 | `?seed=bare` — idle dock is three naked glyphs; hex faces appear on activation | **Trial** |
| 2026-08-10 | All variants integrated into the **uxperiments harness**: `dr.eamer.dev/uxperiments/hexdock/` — live builds + frozen archives (nine-tile, dome, split) + shelved concepts. New experiments should land there even when they are not the chosen candidate | **Process** |
| 2026-08-10 | Default and `?seed=bare` now share the centered flower's current control hierarchy and icon/tooltips, but bloom as a dock-rooted 2-over-3 crown; domed-flower keeps spherical seating. Glyphs scale with tile size, Invert exposes its axes, and Effects uses stateful ripple density instead of sparkles | **Current trial** |
| 2026-08-10 | Toggle glyphs are now state families: reversed positive/negative rings for day/night, opposing arrows with two binary markers for the four invert modes, and into-well versus solid plate for depth. All SVG strokes are optically heavier; the dock's font `×` became a centered SVG and open Reset/Close/Flag now share the bloom's icon box | **Current trial** |
| 2026-08-10 | The flower is reduced to seven outcome-level controls: Reset center; Theme/Warning above; Undo/Flag across; Invert/Size below. Warning cycles four curated combinations (numbers with depth, flush seamless numbers, black-and-white with depth, yellow seamless); independent Seams and Depth controls and all sub-blooms are gone. | **Current** — one tap per player intent |
| 2026-08-10 | `?dome=1` is rebuilt as a convex cap rather than the former concave bowl: Reset rides forward, the ring recedes and tilts to spherical normals, and a static oblique camera makes the shape legible before pointer motion and under reduced motion. | **Current trial** — unmistakably domed at rest |
| 2026-08-10 | `?seed=bare` enlarges all three idle dock glyphs and promotes Undo to the left shortcut; Reset remains available after opening the flower. | **Current** — stronger idle affordances without redundant reset actions |
| 2026-08-10 | Base and bottom-dome chrome collapse to one black half-hidden horizon seed. Hover/tap raises a contiguous Undo · Close · Flag keel and a five-tile settings crown; Reset moves into the crown. Bottom-dome seats that crown on a shallow spherical cap, while center-dome retains the complete sphere-centered cap. Invert returns to its empty/half/full disk, Size physically scales its hex, and Warning depth uses one raised numbered face. Detonation recovery reuses the same green Undo and yellow Reset glyphs; Share is win-only. | **Current** — one persistent affordance, one recovery grammar |
| 2026-08-10 | Size gains a stable diagonal expansion cue and lets XL grow beyond the normal icon box. Invert's four disk states gain a neutral dotted X/Y cross, so the control reads as axial inversion rather than an unexplained circle. | **Keep** — state changes without losing the control's identity |
| 2026-08-10 | Center-dome settles at a restrained 23.6° rim angle, removes face enlargement, and slightly lowers the center. The oblique camera supplies the dome read while the shallower cap reduces the regular-hex angular deficit to clean hairline seams. | **Keep** — still a cap, without triangular gaps or intersecting-card flaps |
| 2026-08-10 | Invert breaks its dotted axes into four perimeter stubs so it no longer reads as a crosshair. Size keeps arrows wholly outside XS–M, brings outward arrows inside L, then reverses them inward inside XL to preview the cycle wrapping back to XS. | **Keep** — controls describe both current state and next action |
| 2026-08-10 | Invert drops the reticle entirely for the established mirrored-panel flip silhouette. Empty/right/top/full panel fills preserve the four black/white states without a second symbol competing with them. | **Keep** — flip convention and state become one glyph |
| 2026-08-10 | Base center flower gains a restrained whole-cluster pointer tilt and shared lift shadow; dome keeps its stronger oblique camera. The corner `?` moves onto a 10–14px safe inset after its stroked circle clipped at a 2px bottom offset. | **Keep** — depth without reopening seams; reference control stays reachable |
| 2026-08-10 | `?dock=faces` turns a centered seven-face patch of the rendered sphere into the control surface itself. The buttons inherit the exact projected polygons, skew, and seams of those live board faces. | **Trial** — the strongest integration concept; deliberately compact at dense sizes |
| 2026-08-10 | `?dock=equator` places Reset plus the six outcome controls on a draggable geodesic belt. Front controls grow and sharpen while the back arc recedes, fades, and stops intercepting input. | **Archived V1** — controls competed with live faces and lost a stable reading order |
| 2026-08-10 | `?dock=eggshell` V3 partitions the live rotated mesh into two frozen sets of whole faces. Each half moves as rigid 3D geometry, so the opening follows exact shared tile edges and the menu remains inside the interlocking aperture. | **Promising retry** — structurally correct shell break; desktop and mobile fit |
| 2026-08-10 | `?dock=chamber` V3 keeps the bounded concave projection but lengthens the turn to 920ms open / 680ms close and removes double easing. The renderer now receives linear progress and supplies the one smoothstep. | **Promising retry** — enough legible frames to sell the inversion |
| 2026-08-10 | `?dock=eggshell` V4 cuts the open to 260ms and paints rear-facing faces from the lower shell as its actual inner bowl. The former circular CSS stand-in is removed; the visible interior now shares the shell's exact tessellation and motion. | **Keep** — immediate response with a structurally honest inside surface |
| 2026-08-10 | `?dock=chamber` V4 replaces the global two-step inversion with a shared-vertex, center-out fold wave. The front seven faces dissolve into a real aperture, the rear hemisphere becomes a shaded tessellated wall, and the decorative gray veil/rim are gone. | **Keep testing** — one continuous enclosure gesture with a readable settled chamber |
| 2026-08-11 | Face Takeover, Eggshell, and Inside Chamber keep sphere rotation live while their menus are open. Drag and arrow keys rotate the shell without permitting dig, flag, long-press, pinch, or wheel-zoom side effects; a stationary background tap still closes. | **Current** — spatial chrome remains a manipulable object instead of freezing into a modal illustration |
| 2026-08-21 | **`?play=inside` is not a dock at all** — it is the chamber promoted from menu affordance to game mode. The concave projection simply stays on, so the tessellated wall *is* the board: you stand inside the sphere and clear what surrounds you. `pickTile` had to stop filtering to the near hemisphere, because inside the chamber the surface you are looking at is the far one — it now walks the draw order backwards, so whatever was painted last at a point is what you hit. No spatial dock (there is no "off the sphere" left to bloom from); chrome falls back to the plain modal shape the shipping sphere uses — readout on top, Undo/Flag glyphs at the bottom, Help/Reset/Customize from the existing HUD. | **Trial** — verified clickable (25/25 sampled screen points hit 25 distinct faces); the open question is orientation, since inside there is no silhouette or horizon to navigate by |
| 2026-08-21 | `?dock=inside` stops pretending. The menu is no longer DOM at all: seven seats live at radius 0.68 inside the shell as real geometry, are projected by the game camera every frame, and are merged into the renderer's one back-to-front sort. The board's own faces therefore occlude them for free — turn the sphere and the tiles swallow the flower, edge-on seats show their extruded sides, and a far seat is simply gone. The shell fades to 26% while it is open so the menu reads through, and only near-side seats accept a tap: rotating one to the front *is* the interaction. | **Trial** — the first dock with true depth against the board; answers the long-standing "depth tied to the sphere" note above without the per-tile hinge tilt that read wrong |
| 2026-08-10 | `?dock=capstan` raises a faceted three-tier control spindle from the north pole, with Reset stamped into its top. | **Rejected; archived V1** — obscures the sphere and loses control order |
| 2026-08-10 | `?dock=crown` locks Reset and six geodesic vanes into one polar cap. | **Captured prior art; archived V1** — petals have promise for other menus and visuals, not this one |
| 2026-08-10 | `?dock=drill` telescopes three concentric control annuli toward a polar aperture. | **Rejected; archived V1** — reads as decoration around a bore |
| 2026-08-10 | `?dock=lid` hinges one polar face into a shallow screen-facing 2–3–2 control panel, with its tether kept visible. | **Rejected; archived V1** — detached panel breaks the sphere/menu relationship |

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
- **D. Depth, other techniques** (dome retry list) — **partly answered 2026-08-21 by
  `?dock=inside`**, which drops the CSS-depth family entirely and puts the seats in
  the renderer, where the sphere can occlude them. The items below remain the
  options for any dock that must stay in the DOM:
  - whole-cluster tilt: one `rotateX` on the stage, not per-tile hinges — no gaps, no scale compensation;
  - concave bowl: continue the sphere's curvature instead of inverting it;
  - hover-only lift: depth as motion (tile comes toward you on hover), flat at rest;
  - fake depth: ring-graded scale + shadow, zero 3D transforms;
  - open animation arrives from behind the dock toward the viewer, settles flat.
- **E. Arc dock** — seat tiles along the sphere's lower rim arc so chrome and board share geometry.
- **F. Bottom sheet** — conventional grouped settings panel; hexes survive only as swatches. Least hexy, most legible.
