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
