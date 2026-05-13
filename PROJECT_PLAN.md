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
- `client/src/game/GameApp.tsx` — HUD, inter-floor route UI, dressing requests, **async dressing commit gate**, **session diagnostics** (dress/fb/circuit/rim counts), **rim-fallback** HUD hint.

## Design Docs

- [docs/GAMEPLAY_CYCLE_SPEC.md](docs/GAMEPLAY_CYCLE_SPEC.md)
- [docs/INFINITE_GENERATION_SPEC.md](docs/INFINITE_GENERATION_SPEC.md)
- [docs/DIRECTOR_GUARDRAILS.md](docs/DIRECTOR_GUARDRAILS.md)
- [docs/VERIFICATION_GATES.md](docs/VERIFICATION_GATES.md)

## Active Tasks

- [x] Uncap run progression + milestone HUD.
- [x] Infinite generator curves + deep-floor solvability smoke tests.
- [x] Cycle orchestrator extraction + tests.
- [x] Route lanes + pressure + sidegrade hooks.
- [x] Director circuit breaker + pacing field.
- [x] Replay + fairness sampling tests + verification doc.
- [x] Phase 7 hardening: async dressing gate, per-run director breaker, finite mode on boot, session HUD metrics, soak script, tests.
- [ ] Device playtest: readability of new HUD + route controls.
