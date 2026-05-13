# Hexodus

Hex-grid strategy/puzzle prototype with deterministic floor generation, infinite-run progression (default), and AI-assisted tile dressing guarded by a circuit breaker.

## Features

- **Infinite runs** by default (`runState.defaultProgression()`); use `finiteProgression(12)` for a legacy-style capped escape.
- **Inter-floor routes** — Safe / Loot / Risk lanes salt the next board seed and nudge pressure meters.
- **Director** — On-device or fallback dressing; optional `pacingBand`; automatic **12s** circuit cooldown after 3 consecutive failures.

## Core Runtime

- `client/src/game/GameApp.tsx` — Board UI, HUD, route picker, **async dressing gate**, **session diagnostics**, **`?diag=1` dev panel**, long-press mark (touch); requires `progressionPolicy` prop from boot.
- `client/src/game/lib/cycleOrchestrator.ts` — `advanceRunAfterFloorWin`, `createNextFloorState`.
- `client/src/game/lib/generator.ts` — Deterministic floors + `regionEpoch` / `effectiveDifficultyStep`.
- `client/src/game/lib/runState.ts` — Progression policy, `floorSeed` (includes route salt).
- `client/src/game/lib/director.ts` — `directExpansion`, `resetDirectorCircuit(runId?)` (per-run circuit map; omit `runId` to clear all).
- `client/src/game/lib/dressingOrchestrator.ts` — pure `tryDressFloor` (unit-tested async commit path used by `GameApp`).

## Design Docs

- [docs/GAMEPLAY_CYCLE_SPEC.md](docs/GAMEPLAY_CYCLE_SPEC.md)
- [docs/INFINITE_GENERATION_SPEC.md](docs/INFINITE_GENERATION_SPEC.md)
- [docs/DIRECTOR_GUARDRAILS.md](docs/DIRECTOR_GUARDRAILS.md)
- [docs/VERIFICATION_GATES.md](docs/VERIFICATION_GATES.md)
- [docs/DEVICE_VERIFY.md](docs/DEVICE_VERIFY.md)
- [docs/LAUNCH_CHECKPOINT.md](docs/LAUNCH_CHECKPOINT.md)

## Verify

```bash
pnpm check
pnpm test
# Optional long strided generator sweep (SOAK=1; long timeout):
pnpm test:soak
# Regenerate iOS app icon + splash PNGs (macOS + Swift; writes Assets.xcassets):
pnpm icons:generate
```

## Dev diagnostics

Append **`?diag=1`** to the loaded URL to show the amber diagnostics strip (burst reveal, forced director nulls, simulated rim banner, **Export diag log**). Each **New Run** appends the prior session HUD counters to `localStorage` (`hexodus_session_diag_snapshots`, last 80 rows). Summarize an export on your machine:

```bash
pnpm beta:diag-summary path/to/hexodus-session-diag-*.json
```

### Commerce stub (economics experiments)

Set **`VITE_VALUE_CAPTURE_STUB=1`** (or append **`?commerce=1`** on web) to show a boot-time **Grant stub unlock** control (localStorage only; no IAP). See [docs/LAUNCH_CHECKPOINT.md](docs/LAUNCH_CHECKPOINT.md).

See [docs/DEVICE_VERIFY.md](docs/DEVICE_VERIFY.md) for a full on-device checklist.

## iOS assets

Source script: `scripts/generate-icon.swift`. Reviewable PNG variants are written to `icon-variants/` (gitignored); installed assets live in `ios/App/App/Assets.xcassets/`.
