# Project Plan

## Current Objectives

- Ship an **infinite roguelike run loop** (default) with optional **finite** escape (`finiteProgression(n)`).
- Preserve **deterministic puzzle truth** while layering route choice, pressure meters, and guarded AI dressing.

## Architecture Snapshot

- `client/src/game/lib/generator.ts` — seeded floors, epochs, post-12 difficulty curves, solver gate.
- `client/src/game/lib/gameState.ts` — reveal/mark/break reducer + win/loss.
- `client/src/game/lib/runState.ts` — run progression, route salt, pressure clocks, checkpoints.
- `client/src/game/lib/cycleOrchestrator.ts` — post-win advance + next floor factory.
- `client/src/game/lib/director.ts` — JSON-validated dressing + **per-runId circuit breaker** + optional `pacingBand`.
- `client/src/game/lib/dressingOrchestrator.ts` — pure `tryDressFloor` pipeline (unit-tested races + invalidation).
- `client/src/game/GameApp.tsx` — HUD, inter-floor route UI, dressing requests, **async dressing commit gate**, **session diagnostics** (dress/fb/circuit/rim counts), **rim-fallback** HUD hint, **`?diag=1` dev panel**, long-press mark on touch.

## Design Docs

- [docs/GAMEPLAY_CYCLE_SPEC.md](docs/GAMEPLAY_CYCLE_SPEC.md)
- [docs/INFINITE_GENERATION_SPEC.md](docs/INFINITE_GENERATION_SPEC.md)
- [docs/DIRECTOR_GUARDRAILS.md](docs/DIRECTOR_GUARDRAILS.md)
- [docs/VERIFICATION_GATES.md](docs/VERIFICATION_GATES.md)
- [docs/DEVICE_VERIFY.md](docs/DEVICE_VERIFY.md)

## Active Tasks

- [x] Phase 7.1: dressing orchestrator tests, `?diag=1` panel, smoke greps, touch long-press mark, HIG-safe HUD padding, app icon + splash assets, Capacitor splash colors, device checklist doc.
- [ ] Device playtest: follow [docs/DEVICE_VERIFY.md](docs/DEVICE_VERIFY.md) on hardware (cold launch, icon, long-press mark, `?diag=1`).
