# Glitch Sphere Web Design

## Summary

Glitch Sphere is a production-ready experimental route built on the canonical Hexsweeper Sphere engine. A single moving hazard occupies one covered safe face. The player wins by closing every route around it with revealed or flagged faces; the player loses if the hazard reaches a mine or the player detonates a mine.

Public route: `https://dr.eamer.dev/games/hexsweeper/glitch-sphere/`

The route reuses the canonical `sphere/` geometry, renderer, chrome, controls, themes, and assets. It does not ship the archive's 4,000-line `sphere_glitch.js` fork.

## Provenance

- Canonical base: `sphere/index.html` and `sphere/sphere.js` in `lukeslp/hexsweeper`.
- Mechanic study: `sphere_glitch.js` and `variant4_glitch_sphere.html` from `game prototypes .zip`.
- Newly authored production code: the variant engine, adapter, route, tests, and documentation described here.

The archive also contains flat Glitch Sweeper and Chain Reaction studies, plus a Flux Sphere page whose claimed mechanic is not present in its loaded engine. They are not part of this release.

## Game Rules

1. The first dig remains safe and resolves its normal Minesweeper flood before the hazard appears.
2. The hazard spawns on a covered, unflagged, non-mine face after that first dig.
3. Once per second, while the page is visible and the game is active, the hazard chooses one adjacent face from the routes that are neither revealed nor flagged.
4. Revealed faces and flagged faces close routes. Flood reveal must not pass through or reveal the occupied face.
5. A direct dig on the occupied face is blocked and announced in text. It never silently removes the hazard.
6. When no open adjacent route remains, the hazard is trapped and the player wins immediately.
7. If the chosen destination is a mine, the player loses.
8. Ordinary mine detonation also loses the run. Ordinary Sphere "all safe faces revealed" does not bypass the Glitch trap objective.
9. Reset, board-size changes, undo, reload, and completed-run restore preserve coherent hazard state.
10. Backgrounding the page pauses movement; returning resumes from the saved remaining delay rather than applying catch-up moves.

## Architecture

`sphere/sphere.js` gains a narrow optional variant lifecycle. With no variant supplied, canonical Sphere behavior and storage remain unchanged. The lifecycle supports:

- reveal admission for direct digs and flood expansion;
- first-dig, reveal, flag, reset, undo, tick, draw, export, import, and terminal hooks;
- a variant-specific storage key and run kind;
- an exactly-once run-completion callback;
- public `digAt` and `flagAt` controls for an accessible route-local keyboard adapter.

`glitch-sphere/glitch-hazard.js` contains the deterministic, DOM-free state machine. `glitch-sphere/glitch-sphere.js` adapts it to the Sphere lifecycle, paints the occupied face, updates text status, provides keyboard board controls, and forwards the normalized completion payload.

The route loads shared assets from `../sphere/` and `../fonts/`; only Glitch-specific files live in `glitch-sphere/`.

## Persistence

Glitch Sphere uses `hexsweeper-glitch-sphere-run-v1`, never the canonical Sphere save key. Its payload includes:

- the normal Sphere board, camera, timing, and run fields;
- `runId` and whether completion was already emitted;
- hazard active state, occupied face index, and milliseconds remaining until its next move.

Imports reject an active hazard whose index is invalid, revealed, flagged, or a mine. A completed run restores its banner and board without emitting a second completion event.

## Completion Contract

Each terminal state emits exactly once:

```json
{
  "type": "hexsweeper:run-complete",
  "schemaVersion": 1,
  "runId": "unique run identifier",
  "variant": "glitch-sphere",
  "outcome": "win or loss",
  "elapsedSeconds": 0,
  "safeFacesRevealed": 0,
  "mineCount": 0,
  "difficulty": "xsmall, easy, medium, hard, or xlarge",
  "completedAt": "ISO-8601 timestamp"
}
```

The route dispatches a same-window custom event and, only when embedded, posts the payload to its same-origin parent.

## Accessibility and Interaction

- The hazard uses shape, label, and text status in addition to color.
- The status region announces spawn, blocked dig, movement, trap, and loss without announcing every animation frame.
- Reduced-motion mode removes pulse and interpolation but retains the occupied-face marker and movement cadence.
- The canvas is focusable. Arrow keys rotate the sphere; Enter or Space digs the centered face; Shift+Enter or Shift+Space flags it. Existing `F`, `R`, `N`, `T`, `?`, and menu controls remain.
- Mouse, touch, long-hold, zoom, reset, help focus behavior, 44-pixel controls, and high-contrast fallbacks inherit the canonical Sphere implementation.
- Help copy states the Glitch objective and keyboard controls.

## Acceptance Criteria

- Existing Sphere neighbor/flood tests pass unchanged.
- Deterministic unit tests cover spawn eligibility, movement, flagged/revealed route blocking, direct-dig blocking, trap win, mine loss, persistence validation, and pause/resume timing.
- A static server loads both `/sphere/` and `/glitch-sphere/` with no missing local resources or console errors.
- Desktop and mobile browser smoke tests cover first dig, active hazard, keyboard control, reset, reload restore, win, loss, reduced motion, and exactly-once completion.
- The public route returns HTTP 200 and exposes the expected title, description, scripts, accessible canvas name, status region, and help text.
- Deployment changes only the reviewed Git paths and leaves the live worktree's unrelated files untouched.

## Explicit Non-Goals

- Authentication, database score persistence, anti-cheat verification, or the incomplete React Labs shell.
- Flux Sphere, spatial audio, ambient hazard hum, Chain Reaction, or flat Glitch Sweeper.
- Caddy edits, a backend, a new port, or changes to the production Light/Dark/Fire/Plague/Escape surface.
