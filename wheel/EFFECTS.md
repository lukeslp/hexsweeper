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
- `wash` — a small wake and dissolving red pigment; identical for every flag.
- `detonate` — a cavitation flash, bubble column, and surface slap when the
  armed mine expires underwater; the original sphere explosion remains intact.
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
