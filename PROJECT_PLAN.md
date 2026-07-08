# Project Plan

## Current Objectives

- Ship an **infinite roguelike run loop** (default) with optional **finite** escape (`finiteProgression(n)`).
- Preserve **deterministic puzzle truth** while layering route choice, pressure meters, procedural tile dressing, and guarded on-device iris output.

## Architecture Snapshot

- `client/src/game/lib/generator.ts` — seeded floors, epochs, post-12 difficulty curves, solver gate.
- `client/src/game/lib/gameState.ts` — reveal/mark/break reducer + win/loss.
- `client/src/game/lib/runState.ts` — run progression, route salt, pressure clocks, checkpoints.
- `client/src/game/lib/cycleOrchestrator.ts` — post-win advance + next floor factory.
- `client/src/game/lib/director.ts` — JSON-validated dressing + **per-runId circuit breaker** + optional `pacingBand`.
- `client/src/game/lib/dressingOrchestrator.ts` — pure `tryDressFloor` pipeline (unit-tested races + invalidation).
- `client/src/game/lib/terminalLog.ts` + `terminalTakeoverScheduler.ts` — deterministic event feed and presentation-only iris takeovers.
- `client/src/game/hooks/useSessionDiagnostics.ts` — session HUD counters (dress/fb/circuit) + reset; consumed by `GameApp`.
- `client/src/game/GameApp.tsx` — HUD, inter-floor route UI, dressing requests, **async dressing commit gate**, **session diagnostics** + **localStorage append on New Run**, **rim-fallback** HUD hint, **`?diag=1` dev panel** (incl. export), long-press mark on touch.

## Design Docs

- [docs/GAMEPLAY_CYCLE_SPEC.md](docs/GAMEPLAY_CYCLE_SPEC.md)
- [docs/INFINITE_GENERATION_SPEC.md](docs/INFINITE_GENERATION_SPEC.md)
- [docs/DIRECTOR_GUARDRAILS.md](docs/DIRECTOR_GUARDRAILS.md)
- [docs/VERIFICATION_GATES.md](docs/VERIFICATION_GATES.md)
- [docs/DEVICE_VERIFY.md](docs/DEVICE_VERIFY.md)
- [docs/LAUNCH_CHECKPOINT.md](docs/LAUNCH_CHECKPOINT.md)

## Delivery Status

- [x] Async dressing guards, procedural tile dressing, and per-run director circuit breaker.
- [x] Terminal event feed and scheduled on-device/static iris takeovers.
- [x] `?diag=1` controls, session persistence/export, and `pnpm beta:diag-summary`.
- [x] Touch long-press marking, HUD safe-area padding, app icon, and splash assets.
- [x] Foundation Models bridge contract tests and foreground availability cache invalidation.
- [x] Local-only value-capture experiment behind a build or query flag.
- [ ] Device playtest: complete the **dual-device beta log** in [docs/DEVICE_VERIFY.md](docs/DEVICE_VERIFY.md) on hardware and attach evidence to the build.
