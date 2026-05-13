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
- `client/src/game/hooks/useSessionDiagnostics.ts` — session HUD counters (dress/fb/circuit) + reset; consumed by `GameApp`.
- `client/src/game/GameApp.tsx` — HUD, inter-floor route UI, dressing requests, **async dressing commit gate**, **session diagnostics** + **localStorage append on New Run**, **rim-fallback** HUD hint, **`?diag=1` dev panel** (incl. export), long-press mark on touch.

## Design Docs

- [docs/GAMEPLAY_CYCLE_SPEC.md](docs/GAMEPLAY_CYCLE_SPEC.md)
- [docs/INFINITE_GENERATION_SPEC.md](docs/INFINITE_GENERATION_SPEC.md)
- [docs/DIRECTOR_GUARDRAILS.md](docs/DIRECTOR_GUARDRAILS.md)
- [docs/VERIFICATION_GATES.md](docs/VERIFICATION_GATES.md)
- [docs/DEVICE_VERIFY.md](docs/DEVICE_VERIFY.md)
- [docs/LAUNCH_CHECKPOINT.md](docs/LAUNCH_CHECKPOINT.md)

## Active Tasks

- [x] Phase 7.1: dressing orchestrator tests, `?diag=1` panel, smoke greps, touch long-press mark, HIG-safe HUD padding, app icon + splash assets, Capacitor splash colors, device checklist doc.
- [x] Post–7.1 slice: session diag persistence + export, `pnpm beta:diag-summary`, FM bridge contract tests, foreground availability cache invalidation, commerce stub flag, `useSessionDiagnostics` seam, dual-device template + launch go/no-go doc.
- [ ] Device playtest: complete the **dual-device beta log** in [docs/DEVICE_VERIFY.md](docs/DEVICE_VERIFY.md) on hardware and attach evidence to the build.
