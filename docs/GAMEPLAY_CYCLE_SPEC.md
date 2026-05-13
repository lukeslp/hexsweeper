# Hexodus Gameplay Cycle Spec

## Loop

1. **Boot** — player starts a run (`RunState` + `FloorState`).
2. **Probe** — reveal/mark hex cells; deterministic puzzle truth resolves in `gameState.ts`.
3. **Dress** — `directExpansion` labels tiles + `irisLine` (never mutates truth).
4. **Resolve floor** — win = all safe revealed + blocked handled; loss = wrongs or iris pressure.
5. **Branch** — player picks **Safe / Loot / Risk** lane (`setRouteChoice`) which salts the next floor seed and nudges pressure meters.
6. **Advance** — `advanceRunAfterFloorWin` increments run floor (infinite by default) and checkpoints.
7. **Repeat** — new `FloorState` from `createNextFloorState`.

## Clocks

| Clock | Storage | Role |
|-------|---------|------|
| Local mistakes | `FloorState.wrongsLeft`, `irisControl` | Immediate tactical failure pressure. |
| Regional tempo | `RunState.regionalPressure` | Anti-grind / route tension (0–1). |
| Campaign entropy | `RunState.campaignEntropy` | Long-horizon escalation (0–1). |

## Progression policy

- **Infinite (default)** — `completeFloor` never sets `escaped` except via future optional endgame flags.
- **Finite** — `finiteProgression(n)` mirrors legacy escape after clearing floor `n`.

## Milestones

`milestoneBand(floor)` → `shallow | mid | deep | abyss | endless` for HUD + telemetry.
