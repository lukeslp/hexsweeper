# Director Guardrails

## Authority boundary

- **Procedural (deterministic)** — per-cell `TileDressing` (title, flavor, threatTone, visualHint) from `floorSeed` + cell key + public cell context via `proceduralTileDressing.ts`. Never calls Foundation Models.
- **On-device LLM** — `irisLine` only (`tryOnDeviceIrisLineFirst` → `generateIrisLine`). Optional `pacingBand` is derived procedurally from `irisControl` + `recentEvents`.
- **Forbidden** — any change to cell truth, coordinates, counts, or win/loss logic.

## Validation

- Iris lines clamped to 80 chars in `directExpansion`; null / timeout increments per-run circuit breaker (tiles still apply procedurally).
- `generateTileDressing` / `TileDressingBatch` remain in the Swift plugin for now but are **not** on the GameApp hot path.

## Platform short-circuit

- On non-iOS (`getPlatform() !== "ios"`), `directExpansion` returns fallback immediately with `platformUnavailable: true` and **does not** increment the circuit breaker.

## Circuit breaker

- Tracks consecutive null / failed validations **per `runId`** (map of breaker state).
- After **3** iris failures, opens **12s** cooldown: `directExpansion` skips FM for iris only (`degradedByCircuit: true`); tiles still dress procedurally.
- `resetDirectorCircuit()` clears all runs; `resetDirectorCircuit(runId)` clears one run (tests + manual recovery).
- **Terminal takeovers** (`tryOnDeviceTerminalTakeoverFirst`) share the same per-run circuit: when the director circuit is open, the game appends static iris takeover lines instead of calling the bridge (see `isDirectorCircuitOpen` in `director.ts`).

## Cascade batching

- `GameApp.requestDressing` chunks `newCells` into batches of **12** (`MAX_DRESSING_BATCH`) so `@Generable` output stays within token budget.
- Terminal `[map]` lines are deterministic chunk progress only (no raw model JSON).

## Session HUD (`dress` counter)

The `dress` field on the `GameApp` session line increments for **every** `directExpansion` completion after `await`, including outputs discarded by `DressingGenerationGate` (stale async after `continueRun` / `restartRun` / overlapping reveals). It is a **director attempt** counter. Compare `fb` (iris fallback), `plat`, and `circuit` to `dress` — see [VERIFICATION_GATES.md](VERIFICATION_GATES.md).

## Playability

- Procedural tiles commit synchronously in `tryDressFloor` (or via `deferIris` in GameApp) before FM iris work; pending dressing keys clear when tiles land, not when iris returns.

## SLO notes (manual / future CI)

- p95 iris latency budget: inherit native timeout (16s); tile labels do not wait on FM.
- Target fallback rate under normal device conditions: **< 5%** sessions on iOS (telemetry TBD).
- **`plat`** (platform fallback) on web is expected and must not trip the circuit-breaker SLO.
