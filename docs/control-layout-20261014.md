# Minimal control layout

I use the same control frame across the Minimal games so a familiar action stays easy to find. I am Luke Steuber. This is a presentation change: rules, keyboard shortcuts, save keys, meaningful state colors and current catalog choices stay intact.

## Scope and source

The October 14 audit covers the thirteen game destinations on Minimal and the three new builds. Harmonies is a navigation hub; Simple Machines has no visible puzzle toolbar. Neither gets decorative puzzle controls. Push, Stack and Cut remain unlisted local builds unless separately released.

The current Akari editions retain their reciprocal appearance links and shared progress. Publication uses each live edition's actual baseline, preserving newer changes, retained assets and routing; a changed baseline stops that swap.

## Position and order

- Restart occupies the upper-left slot. A New board/New sphere action can use that slot with its accurate name and existing behavior. Erase progress remains inside Settings.
- Actions occupy the lower left: **Undo, Hint, then any input tool or other game-mode control**. Omit functions the game does not implement; no placeholders. Hint is immediately beside Undo when both exist.
- Settings followed by Help occupy the lower right. Help is last. Existing combined Help/Settings and Menu implementations may retain their combined function in the final metadata slot; this work does not split or conflate their behavior.
- At short landscape sizes, actions move to the top of the right rail, metadata to its bottom. Restart stays upper left. Order is unchanged.
- The completion actions for ordinary puzzles use a centered region just above the lower controls, or near the lower center in landscape. Existing modal win/loss banners and local game-piece controls retain their distinct purposes.

## Appearance and implementation boundary

Main controls use square 48×48 CSS px targets, 24px SVGs with a 1.6px stroke, a visible 2px focus outline, and consistent close glyphs. Keep labels and pressed/disabled state. Preserve meaningful active-state inversion and existing red flag state; these are not decoration to erase.

Use a small local presentation adapter where older engines own their toolbar nodes: reorder/move the existing nodes without replacing their handlers or changing gameplay. Reuse an existing Restart implementation if exposing it in the header. The adapter must never alter a board, write storage, fetch data or attach new gameplay keyboard/pointer handlers. It must be idempotent and must not poll or observe the animated playfield indefinitely. Each standalone release carries its own presentation assets; there is no new runtime dependency across games or CDN.

The shared source pattern is first-party browser code. Existing fonts and licenses remain unchanged. Pure engines and their runtime bytes are preserved where this patch is deployed as a presentation overlay. Generated Hexsweeper pages must come from their authoritative exporter rather than hand edits.

## Verification and release

Check actual layout at desk 1440×900, phone 390×844, landscape 844×390 and 320px width, with both system themes and both Akari routes. Verify Hint adjacency, order, exact target/icon dimensions, focus, pressed state, no hitbox overlap or new page overflow, conditional controls, and Help/Settings operation. Exercise real inputs through the existing handlers and compare settled game/save state with the prior engine or existing tests; a presentation change needs no new rules solver. Preserve large-text and reduced-motion behavior.

Commit named files and push the isolated branch throughout. Before a live swap, capture the current target and all changed-file hashes; apply only the intended presentation files, retain everything else, record the exact source/layout commit, and compare served bytes and rendered controls. No Caddy or service changes are needed.
