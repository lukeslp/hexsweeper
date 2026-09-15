# Water Wheel effects

`effects.js` is a visual-only event layer. It receives projected screen-space
coordinates from `sphere.js`; it never changes board state, fuse timing,
projection, or picking.

## Profiles

- `kinetic` — default composition: submerged caustics, surface wakes, quench
  bubbles, dissolving flag pigment, fuse atmosphere, water-aware detonation,
  and win ripples.
- `calm` — the underlying Wheel renderer without the event layer. This keeps
  the previous treatment available for comparison or quieter applications.

Select a profile with `?fx=kinetic` or `?fx=calm`. A host can also call
`game.setWheelEffects(id)` and read `game.getWheelEffects()`.
Applications that need only selected channels can use
`WheelEffects.composeProfile("calm", overrides)` and pass the result to
`WheelEffects.create({ profile })`.

## Event vocabulary

The engine currently preserves these independent channels:

- `surfaceCross` — armed face enters or leaves the water.
- `dousedCross` — an inert mine crosses the surface later.
- `quench` — paired surface ripples, a cool flash, and a bubble plume.
  **No longer emitted by the game** as of 2026-08-21: drowning a mine is now a
  detonation, not a defusal, so the drowning fires `detonate` instead. The
  channel and its profile weight are kept so existing profiles stay valid and
  a host can still compose it.
- `wash` — a small wake and dissolving red pigment; identical for every flag.
- `detonate` — a cavitation flash, bubble column, and surface slap when the
  armed mine expires underwater; the original sphere explosion remains intact.
  The underwater branch is now also the *survivable* one, and the common one:
  both a deliberate drowning (`drownArmedMine`) and a fuse expiring below the
  waterline route through `drownedBlast`, which spends the mine and chords its
  satisfied neighbours rather than ending the run. The effect layer is still
  visual-only — it neither decides nor learns the outcome.
- `win` — broad settling ripples across the waterline.

Fuse atmosphere is updated continuously while a visible armed face remains
above the water. Reduced motion retains static/fading confirmation marks and
suppresses moving particles and caustic sweeps.

## Sources retained

- `skins/particle-bloom.html` — small capped particle emitter.
- `skins/caustic-lens.html` — underwater caustic and lensing language.
- `collection/theme-water.html` — material-aware blast and win-ripple ideas.

Add future experiments as named profile channels or new profiles rather than
replacing these definitions. Keep all effects cosmetic and particle-bounded.
