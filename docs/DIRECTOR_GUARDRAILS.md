# Director Guardrails

## Authority boundary

- **Allowed** — `TileDressing` text, `irisLine`, optional `pacingBand` enum (`calm | ramp | spike | recovery`).
- **Forbidden** — any change to cell truth, coordinates, counts, or win/loss logic.

## Validation

- JSON-only contract with brace-balanced recovery for prose wrappers.
- Unknown tile keys dropped; enum coercion for `threatTone` / `visualHint`.
- Partial tile lists merge with deterministic `fallbackDirectorOutput` per cell.

## Circuit breaker

- Tracks consecutive null / malformed generations **per `runId`** (map of breaker state).
- After **3** failures, opens **12s** cooldown: `directExpansion` returns deterministic fallback immediately (`degradedByCircuit: true`) without calling the model.
- `resetDirectorCircuit()` clears all runs; `resetDirectorCircuit(runId)` clears one run (tests + manual recovery).

## Session HUD (`dress` counter)

The `dress` field on the `GameApp` session line increments for **every** `directExpansion` completion after `await`, including outputs that are **not** applied because the `DressingGenerationGate` invalidated the operation (stale async after `continueRun` / `restartRun` / overlapping reveals). It is a **director attempt** counter, not strictly “tiles written”. See [VERIFICATION_GATES.md](VERIFICATION_GATES.md) session diagnostics for rollout ratios vs `fb` / `circuit`.

## SLO notes (manual / future CI)

- p95 `directExpansion` latency budget: inherit native timeout (16s) with UI spinner via pending dressing keys.
- Target fallback rate under normal device conditions: **< 5%** sessions (telemetry TBD).
