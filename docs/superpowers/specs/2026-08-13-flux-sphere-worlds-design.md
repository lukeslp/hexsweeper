# Flux Sphere and Games Index Design

## Summary

Flux Sphere turns the archived “Dig one, reveal both” label into a complete
Hexsweeper Sphere variant. After the first safe opening resolves, Flux links
every still-covered safe face to a distant safe face. Digging either face opens
its partner through the canonical Sphere reveal engine.

Public route: `https://dr.eamer.dev/games/hexsweeper/flux-sphere/`

The central games catalog gains direct entries for the eight intentional
Hexsweeper experiments: Sphere, Flux Sphere, Glitch Sphere, Catch the Monkey
Garden, Catch the Monkey Orbit, Obsidian Mirror, Water Wheel, and the
Dodecahedron Campaign. Generated collection pens, dormant skins, redirect
stubs, and developer routes remain unlisted.

## Provenance

- Canonical engine and renderer: `sphere/` in `lukeslp/hexsweeper`.
- Archive concept: `variant3_flux.html` from `game prototypes .zip`.
- The archive contains only the title and “Entangled tiles: Dig one, reveal
  both!” copy; it loads the unchanged Sphere engine and has no Flux mechanic.
- Newly authored production code: the pair state machine, lifecycle adapter,
  route, tests, documentation, and one narrow canonical reveal API.

## Game Rules

1. The first dig remains safe and resolves the normal Sphere flood.
2. After that opening, Flux links every still-covered, unflagged, non-mine face
   with a distant eligible face. When the eligible count is odd, one face has no
   partner.
3. Pairing is deterministic for a given board and geometry. It uses geometric
   separation with stable index tie-breaking, not ambient randomness.
4. A direct safe dig reveals its partner in the same undoable move. A zero-count
   partner performs the normal safe flood from that face.
5. A mine never receives a partner and a mined direct dig never triggers an
   echo.
6. A flagged or already revealed partner is not forced open. The status tells
   the player that the echo was held or already resolved.
7. Pair identities remain visually latent while both faces stay covered so they
   do not disclose which faces are safe. After an echo, both endpoints receive
   a short shape-and-glyph highlight and the live status identifies the result.
8. The canonical all-safe-faces rule wins the game. Reset, size change, undo,
   reload, and completed-run restore keep board and pair state coherent.

## Architecture

`flux-sphere/flux-pairs.js` is a DOM-free UMD state machine. It creates and
validates symmetric pair mappings, resolves a partner for a direct reveal, and
serializes the mapping.

`sphere/sphere.js` adds one variant-only context method:

```js
revealSafeFaces(indices) -> number[]
```

The engine enables this method only while it notifies a variant about an
accepted direct reveal. The method validates every index, refuses mines and flags,
reveals accepted faces, runs canonical zero floods without recursive variant
notifications, and returns every face opened by the echo. Without a variant,
all canonical code paths and storage behavior remain unchanged.

`flux-sphere/flux-sphere.js` adapts the pair engine to the existing optional
variant lifecycle. It creates pairs after `firstResolvedDig`, invokes
`revealSafeFaces` from the `reveal` hook, paints transient paired glyphs,
announces results, persists pair state, participates in undo, and forwards the
normalized completion payload.

`flux-sphere/index.html` and `flux-sphere/flux-sphere.css` reuse the canonical
Sphere geometry, renderer, menu, chrome, fonts, and assets.

The root `/games/index.html` is a manual production file with no Git owner. Its
deployment therefore uses an explicit byte backup and manifest. The exact
byte-identical local deployment artifact is
`/Users/luke/workshop/solarwar-comparison-deploy/games-index.html`.

## Persistence and Completion

Flux uses `hexsweeper-flux-sphere-run-v1` and run kind `flux-sphere`. Its
variant payload contains a versioned symmetric `pairFor` array. Imports reject
wrong lengths, out-of-range partners, self-pairs, asymmetric pairs, and mine
pairs. Revealed endpoints remain valid because ordinary play reveals them after
activation.

Terminal runs use the existing version-1 `hexsweeper:run-complete` envelope and
exactly-once guard, with `variant: "flux-sphere"`. Restore never re-emits a
completion.

## Accessibility and Interaction

- The canvas is focusable and named. Arrow keys rotate; Enter or Space digs the
  centered face; Shift plus Enter or Space flags it.
- Echo endpoints use a linked glyph and outline as well as cyan/amber color.
- A polite atomic status reports activation, successful echo, held echo, reset,
  restore, win, and loss without announcing animation frames.
- Reduced motion removes pulsing and animated link travel while retaining both
  endpoint glyphs and all text feedback.
- Pointer, touch, long-hold, zoom, menu, reset, help focus, and contrast behavior
  inherit the canonical Sphere implementation.
- The central games index keeps semantic `article`, heading, link, and landmark
  structure; its existing decorative icons retain empty alternatives.

## Games Index Publication

Insert these cards immediately after Hexsweeper:

1. Hexsweeper Sphere → `/games/hexsweeper/sphere/`
2. Flux Sphere → `/games/hexsweeper/flux-sphere/`
3. Glitch Sphere → `/games/hexsweeper/glitch-sphere/`
4. Catch the Monkey: Garden → `/games/hexsweeper/monkey-grid/`
5. Catch the Monkey: Orbit → `/games/hexsweeper/monkey-sphere/`
6. Obsidian Mirror → `/games/hexsweeper/sphere-reflection/`
7. Water Wheel → `/games/hexsweeper/wheel/`
8. Dodecahedron Campaign → `/games/hexsweeper/polyhedron/`

Repair the catalog’s existing broken `og:image` and `twitter:image` by
publishing the reviewed 1200×630 Hexsweeper social image at
`/games/social-card.png`.

## Verification and Acceptance

- Pair state-machine tests cover deterministic far pairing, symmetry, odd
  counts, partner resolution, export/restore, and malformed-state rejection.
- Sphere contract tests prove the reveal API is absent from canonical behavior,
  active only during the reveal notification, safe-only, flag-respecting,
  flood-aware, atomic with undo, and persistence-compatible.
- Flux integration tests cover page semantics, isolated storage/run kind,
  first-dig activation, direct echo, mine suppression, held flagged echo, undo,
  restore, completion, keyboard controls, status, and reduced motion.
- Browser smoke covers canonical Sphere plus Flux desktop, mobile, keyboard,
  reduced motion, first dig, echo, undo, restore, win, loss, console errors, and
  missing resources.
- Regenerate all Sphere exports and the offline app payload, then pass their
  drift checks and re-vendor the companion `hexsweeper-app` payload.
- The updated catalog contains exactly the eight approved additions and every
  primary/secondary target returns HTTP 200 after deployment.
- Push and deploy Hexsweeper by pinned SHA. Keep timestamped server backups and
  exact rollback bytes for the manual catalog and social asset.

## Non-Goals

- No spatial audio, ambient hum, score database, authentication, anti-cheat, or
  React Labs shell.
- No visible pre-reveal pair map, mirrored flags, timer mechanic, or new Sphere
  theme.
- No Caddy change, backend, dependency, public port, generated collection card,
  or exposure of dormant skins and developer pages.
