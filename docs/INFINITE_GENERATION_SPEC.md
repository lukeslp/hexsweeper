# Infinite Generation Spec

## Principles

- **Solver-first** — every standard floor passes `isSolverSolvable` within `GENERATOR_BUDGET` attempts (currently **200** in `generator.ts`).
- **Deterministic** — RNG keyed by `${seed}:floor:${floor}:attempt:${attempt}` in `generator.ts`.
- **Sublinear post-12 growth** — `effectiveDifficultyStep` slows parameter explosion for deep runs.

## Curves

| Parameter | Source |
|-----------|--------|
| `radius` | `radiusForStep(step)` capped to avoid oversized disks. |
| `blockedRate` | Density step capped at 15 + epoch bump, hard max `0.46`. |
| `maxWrongs` | `max(2, 7 - ceil(step/2))` — slightly more forgiving than legacy at early floors. |
| `clueRate` | Decays with density + epoch; floor `0.30`. |
| `startRadius` | 1 / 2 / 3 by step bands (pre-revealed foothold zone). |

## Epochs

`regionEpoch(floor, span=6)` bumps blocked/clue pressure every six floors without breaking the solver budget.

## Route salt

`floorSeed` includes `route:${run.routeSalt}` so inter-floor choices diverge subsequent boards while staying reproducible for a fixed run + choices.
