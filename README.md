# Hexodus

Hex-grid strategy/puzzle prototype with deterministic floor generation, infinite-run progression (default), and AI-assisted tile dressing guarded by a circuit breaker.

## Features

- **Infinite runs** by default (`runState.defaultProgression()`); use `finiteProgression(12)` for a legacy-style capped escape.
- **Inter-floor routes** — Safe / Loot / Risk lanes salt the next board seed and nudge pressure meters.
- **Director** — On-device or fallback dressing; optional `pacingBand`; automatic **12s** circuit cooldown after 3 consecutive failures.

## Core Runtime

- `client/src/game/GameApp.tsx` — Board UI, HUD, route picker, **async dressing gate**, **session diagnostics**; requires `progressionPolicy` prop from boot.
- `client/src/game/lib/cycleOrchestrator.ts` — `advanceRunAfterFloorWin`, `createNextFloorState`.
- `client/src/game/lib/generator.ts` — Deterministic floors + `regionEpoch` / `effectiveDifficultyStep`.
- `client/src/game/lib/runState.ts` — Progression policy, `floorSeed` (includes route salt).
- `client/src/game/lib/director.ts` — `directExpansion`, `resetDirectorCircuit(runId?)` (per-run circuit map; omit `runId` to clear all).

## Design Docs

- [docs/GAMEPLAY_CYCLE_SPEC.md](docs/GAMEPLAY_CYCLE_SPEC.md)
- [docs/INFINITE_GENERATION_SPEC.md](docs/INFINITE_GENERATION_SPEC.md)
- [docs/DIRECTOR_GUARDRAILS.md](docs/DIRECTOR_GUARDRAILS.md)
- [docs/VERIFICATION_GATES.md](docs/VERIFICATION_GATES.md)

## Verify

```bash
pnpm check
pnpm test
# Optional long strided generator sweep (SOAK=1; long timeout):
pnpm test:soak
```
