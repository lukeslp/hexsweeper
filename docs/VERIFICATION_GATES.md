# Verification & Rollout Gates

## Automated (Vitest)

| Suite | Intent |
|---------|--------|
| `generator.test.ts` | Solvability budget floors 1–12, **depth sweep 1..500** (one seed per floor), deep multi-seed smoke. |
| `generator.soak.test.ts` | **Optional** strided deep sweep when `SOAK=1` (see `pnpm test:soak`). |
| `solver.test.ts` | Solver correctness on generated boards. |
| `runState.test.ts` | Infinite vs finite progression + route salt + milestones. |
| `director.test.ts` | JSON validation, merge rules, **per-runId circuit breaker**. |
| `cycleOrchestrator.test.ts` | Deterministic advance + next floor seed wiring + run/floor index sync. |
| `replayVerification.test.ts` | Replay parity + cohort solvability sample. |
| `dressingGenerationGate.test.ts` | Async dressing generation token semantics. |
| `asyncDressing.integration.test.ts` | Run/floor index sync + async dressing gate pattern used by `GameApp`. |

## Session diagnostics (runtime)

`GameApp` HUD includes a **session** line: dressing call count, director fallback count, circuit-degraded count, and **rim fallback** floors (`FloorState.usedRimFallback`). Use these to operationalize rollout triggers below without extra telemetry plumbing.

## Commands

```bash
pnpm check
pnpm test
pnpm test:soak   # SOAK=1 strided generator sweep (long-running)
```

## Soak / perf (manual gate)

- 24h idle headless session: watch memory + repeated `generateFloor`/`reduceFloor` loops (script TBD).
- Target: no monotonic heap growth; crash-free.
- Strided generator soak: `pnpm test:soak` (optional nightly).

## Rollout stop triggers

- Solvability null rate > baseline in `replayVerification` cohort test.
- Circuit breaker open > **25%** of dressing calls in a session (compare `circuit` to `dress` counts on the HUD session line; investigate model/provider).
- Director fallback rate > **25%** of dressing calls (`fb` / `dress`) sustained across a session — treat as infra failure.
- Rim fallback floors > **0.1%** of floors in a long session (`rim` / floors played) — investigate generator curve regression.
- Player-reported softlocks / impossible boards: freeze generator curve changes.
