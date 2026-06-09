# Director Guardrails

## Authority boundary

- **Allowed** — `TileDressing` text, `irisLine`, optional `pacingBand` enum (`calm | ramp | spike | recovery`).
- **Forbidden** — any change to cell truth, coordinates, counts, or win/loss logic.

## Validation

- **Generable-first** — on iOS, `directExpansion` calls `tryOnDeviceTileDressingFirst` → Swift `generateTileDressing` with grammar-constrained `TileDressingBatch`. No free-form JSON parse or brace-recovery path.
- `validateDirectorOutput` clamps titles (hash-pick from `FALLBACK_TITLES` when >4 words or >22 chars), drops unknown keys, coerces enums.
- Partial tile lists merge with deterministic `fallbackDirectorOutput` per cell.
- **Web / non-iOS** — `platformUnavailable: true` immediate fallback; does **not** increment the circuit breaker.

## Circuit breaker

- Tracks consecutive null / malformed generations **per `runId`** (map of breaker state).
- After **3** failures, opens **12s** cooldown: `directExpansion` returns deterministic fallback immediately (`degradedByCircuit: true`) without calling the model.
- `resetDirectorCircuit()` clears all runs; `resetDirectorCircuit(runId)` clears one run (tests + manual recovery).
- **Terminal takeovers** (`tryOnDeviceTerminalTakeoverFirst`) share the same per-run circuit: when the director circuit is open, the game appends static iris takeover lines instead of calling the bridge (see `isDirectorCircuitOpen` in `director.ts`).

## Cascade batching

- `GameApp.requestDressing` chunks `newCells` into batches of **12** (`MAX_DRESSING_BATCH`) so `@Generable` output stays within token budget.
- Terminal `[map]` lines are deterministic chunk progress only (no raw model JSON).

## Session HUD (`dress` counter)

The `dress` field on the `GameApp` session line increments for **every** `directExpansion` completion after `await`, including outputs that are **not** applied because the `DressingGenerationGate` invalidated the operation (stale async after `continueRun` / `restartRun` / overlapping reveals). It is a **director attempt** counter, not strictly “tiles written”. See [VERIFICATION_GATES.md](VERIFICATION_GATES.md) for `dress` / `fb` / `plat` / `circuit` semantics.

## SLO notes (manual / future CI)

- p95 `directExpansion` latency budget: inherit native timeout (16s) with UI spinner via pending dressing keys.
- Target fallback rate under normal device conditions: **< 5%** sessions (telemetry TBD); split **platform** (`plat`) from true FM failures (`fb`).
