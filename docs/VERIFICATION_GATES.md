# Verification & Rollout Gates

## Smoke (`scripts/smoke.sh`)

Five steps (typecheck, tests, FoundationModels plugin registration, **Phase 7 grep invariants** in `GameApp` / `director` / `types`, then Vite build + React dedupe unless `--no-build`):

```bash
pnpm smoke              # full: includes cap:sync:ios
pnpm smoke --fast       # vite build + gates, skip cap sync
pnpm smoke --no-build   # typecheck + tests + greps + plugin line only
```

## Automated (Vitest)

| Suite                               | Intent                                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `generator.test.ts`                 | Solvability budget floors 1–12, **depth sweep 1..500** (one seed per floor), deep multi-seed smoke.                     |
| `generator.soak.test.ts`            | **Optional** strided deep sweep when `SOAK=1` (see `pnpm test:soak`).                                                   |
| `solver.test.ts`                    | Solver correctness on generated boards.                                                                                 |
| `runState.test.ts`                  | Infinite vs finite progression + route salt + milestones.                                                               |
| `director.test.ts`                  | JSON validation, merge rules, **per-runId circuit breaker**.                                                            |
| `cycleOrchestrator.test.ts`         | Deterministic advance + next floor seed wiring + run/floor index sync.                                                  |
| `replayVerification.test.ts`        | Replay parity + cohort solvability sample.                                                                              |
| `dressingGenerationGate.test.ts`    | Async dressing generation token semantics.                                                                              |
| `asyncDressing.integration.test.ts` | Run/floor index sync + async dressing gate pattern used by `GameApp`.                                                   |
| `dressingOrchestrator.test.ts`      | Stale-guard + rapid-reveal races for `tryDressFloor` (pure async dressing pipeline).                                    |
| `foundationModelsPlugin.test.ts`    | Mocked FM bridge: cached-unavailable short-circuit, timeout → availability re-probe, non-timeout errors preserve cache. |

## Session diagnostics (runtime)

`GameApp` HUD includes a **session** line: dressing call count (`dress`), director fallback count (`fb`), circuit-degraded count (`circuit`), and **rim fallback** floors (`rim`, from `FloorState.usedRimFallback`). Use these to operationalize rollout triggers below without extra telemetry plumbing.

**Persistence:** each **New Run** appends the prior session counters to `localStorage` under `hexodus_session_diag_snapshots` (ring buffer, last 80 rows). With `?diag=1`, **Export diag log** downloads JSON (`stored` array + `current`). Summarize exports locally:

```bash
pnpm beta:diag-summary path/to/hexodus-session-diag-*.json
```

Pre-launch checklist: [LAUNCH_CHECKPOINT.md](LAUNCH_CHECKPOINT.md). Device procedure: [DEVICE_VERIFY.md](DEVICE_VERIFY.md).

**`dress` counts completed director calls** (including responses that were **discarded** after `await` because the async dressing gate invalidated — e.g. floor transition). It measures _attempts / bridge traffic_, not only tiles that were committed to state. Compare `fb` and `circuit` to `dress` when triaging Apple Intelligence vs UI races.

## Commands

```bash
pnpm check
pnpm test
pnpm test:soak   # SOAK=1 strided generator sweep (long-running)
pnpm icons:generate   # macOS: Swift script → AppIcon + Splash PNGs
```

## Soak / perf (manual gate)

- 24h idle headless session: watch memory + repeated `generateFloor`/`reduceFloor` loops (script TBD).
- Target: no monotonic heap growth; crash-free.
- Strided generator soak: `pnpm test:soak` (optional nightly).

## Rollout stop triggers

- Solvability null rate > baseline in `replayVerification` cohort test.
- Circuit breaker open > **25%** of dressing calls in a session (compare `circuit` to `dress` counts on the HUD session line; investigate model/provider).
- Director fallback rate > **25%** of dressing calls (`fb` / `dress`) sustained across a session — treat as infra failure.
- Rim fallback: **any `rim` count > 0 in a session is sev-2** — investigate generator curve regression or a bad deploy (the depth sweep in CI expects zero rim in normal seeds; a non-zero `rim` means a floor exhausted `GENERATOR_BUDGET` and used the rim fallback board).
- Player-reported softlocks / impossible boards: freeze generator curve changes.
