# Hexodus

Hexodus is an iOS-first hex-grid puzzle roguelike. Floors are generated from a
seed, checked for solvability, and played as an infinite run by default. A
12-floor finite mode is also available from the boot screen.

Puzzle truth stays deterministic. Procedural code supplies tile names and
flavor, while Apple's on-device Foundation Models framework may add iris.exe
taunts and terminal takeovers. Web builds and unsupported devices use static
fallback text without changing gameplay.

## Gameplay

- Reveal safe cells and mark blocked cells from the visible clues.
- Correct moves can trigger solver-backed cascade reveals.
- Mistakes reduce the floor's error budget and increase iris control.
- Clearing a floor opens Safe, Loot, and Risk routes. The selected route salts
  the next floor seed and changes run pressure.
- Infinite runs continue through sublinear difficulty growth. Finite runs
  escape after floor 12.

## Architecture

- `client/src/main.tsx` boots the app, probes Foundation Models availability,
  selects the run mode, owns the terminal feed, and hides the native splash.
- `client/src/game/GameApp.tsx` renders the procedural board, HUD, route picker,
  diagnostics, dressing flow, and terminal takeover scheduling.
- `client/src/game/lib/gameState.ts` owns floor actions and win/loss rules.
- `client/src/game/lib/runState.ts` owns progression, routes, checkpoints, and
  deterministic floor seeds.
- `client/src/game/lib/generator.ts` and `solver.ts` generate solvable floors
  and derive safe cascade moves.
- `client/src/game/lib/proceduralTileDressing.ts` creates deterministic tile
  labels and flavor.
- `client/src/game/lib/director.ts` requests optional iris lines and protects
  the native generation path with a per-run circuit breaker.
- `client/src/game/lib/terminalLog.ts` and
  `terminalTakeoverScheduler.ts` produce presentation-only terminal events.
- `client/src/lib/foundationModelsPlugin.ts` wraps the Capacitor bridge. Native
  methods live in `ios/App/App/FoundationModelsPlugin.swift`.

Build output is written to `dist/public`. Do not edit that directory.

## Requirements

- Node.js with pnpm 10
- macOS and Xcode for the iOS target and asset generation
- iOS 26+ on supported hardware for Foundation Models output

The web build remains fully playable. It uses deterministic and static text
instead of on-device generation.

## Commands

```bash
pnpm install
pnpm dev
pnpm check
pnpm test
pnpm build
```

Additional checks and iOS tasks:

```bash
pnpm test:soak          # optional long generator sweep
pnpm smoke --no-build  # typecheck, tests, registration, source invariants
pnpm smoke --fast      # the above plus a web build and React dedupe check
pnpm smoke             # full gate, including Capacitor iOS sync
pnpm cap:sync:ios
pnpm cap:open
pnpm icons:generate
```

## Diagnostics

Append `?diag=1` to show session counters and controls for burst reveals,
forced director fallbacks, rim fallback simulation, and diagnostic export.
Starting a new run stores the prior counters in
`hexodus_session_diag_snapshots`, capped at 80 rows.

Summarize an exported file locally:

```bash
pnpm beta:diag-summary path/to/hexodus-session-diag-*.json
```

Set `VITE_VALUE_CAPTURE_STUB=1`, or use `?commerce=1` on web, to expose the
local-only supporter experiment. It does not use StoreKit.

## Project Docs

- [Project plan](PROJECT_PLAN.md)
- [Gameplay cycle](docs/GAMEPLAY_CYCLE_SPEC.md)
- [Infinite generation](docs/INFINITE_GENERATION_SPEC.md)
- [Director guardrails](docs/DIRECTOR_GUARDRAILS.md)
- [Verification gates](docs/VERIFICATION_GATES.md)
- [iOS device verification](docs/DEVICE_VERIFY.md)
- [Launch checkpoint](docs/LAUNCH_CHECKPOINT.md)

Files under `docs/superpowers/specs/` are historical design records. The docs
listed above describe the current runtime.

## iOS Assets

`scripts/generate-icon.swift` generates review variants in the ignored
`icon-variants/` directory and installs the App Icon and splash images in
`ios/App/App/Assets.xcassets/`.
