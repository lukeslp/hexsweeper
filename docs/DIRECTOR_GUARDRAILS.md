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

## SLO notes (manual / future CI)

- p95 `directExpansion` latency budget: inherit native timeout (16s) with UI spinner via pending dressing keys.
- Target fallback rate under normal device conditions: **< 5%** sessions (telemetry TBD).
