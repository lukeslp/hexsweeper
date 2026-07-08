# Repository Guidelines

## Product and Architecture

Hexodus is an iOS-first Vite and React 19 puzzle game shipped through
Capacitor 8. The web target is a development and fallback surface. Puzzle
truth, generation, solver deductions, win/loss state, and run progression must
remain deterministic. Foundation Models output is presentation only.

Client code lives in `client/src`:

- `game/GameApp.tsx` owns the procedural board and run UI.
- `game/lib` contains pure reducers, generation, solving, dressing, terminal
  scheduling, and their tests.
- `components/TerminalPanel.tsx` renders the terminal feed owned by `main.tsx`.
- `lib/foundationModelsPlugin.ts` wraps the native bridge and fallbacks.
- `hooks` contains canvas and touch interaction helpers.

Native iOS code lives in `ios/App`. The app-local
`FoundationModelsPlugin.swift` must stay manually registered in
`AppViewController.swift`. Build output goes to `dist/public`; never edit it.
Current operational docs live at the repository root and in `docs/`.
`docs/superpowers/specs/` contains historical design records.

## Commands

Use pnpm, matching `pnpm-lock.yaml` and the pinned `packageManager` field.

- `pnpm dev`: start Vite for the web client.
- `pnpm build`: build to `dist/public`.
- `pnpm check`: run strict TypeScript checking.
- `pnpm test`: run the default Vitest suite. The optional soak suite is
  skipped unless enabled.
- `pnpm test:soak`: run the long strided generator sweep with `SOAK=1`.
- `pnpm smoke --no-build`: run typecheck, tests, native registration, and
  source invariant checks.
- `pnpm smoke --fast`: add a Vite build and React dedupe check without syncing
  Capacitor.
- `pnpm smoke`: run all five gates and sync the iOS project.
- `pnpm cap:sync:ios`: build and sync the Capacitor iOS target.
- `pnpm cap:open`: open the iOS workspace in Xcode.
- `pnpm icons:generate`: regenerate App Icon and splash assets on macOS.
- `pnpm beta:diag-summary <file>`: summarize an exported diagnostic bundle.

## Runtime Invariants

- Never let generated text change cell truth, clues, coordinates, mistake
  accounting, iris control, or win/loss state.
- Tile dressing comes from `proceduralTileDressing.ts`. On-device generation
  supplies iris lines and terminal takeovers on the current gameplay path.
- Keep both native and JavaScript timeouts around Foundation Models calls.
- Preserve the per-run director circuit breaker: three consecutive failures
  open a 12-second cooldown. Non-iOS fallback must not count as a failure.
- Keep availability caching and foreground invalidation paired. Players can
  change Apple Intelligence availability while the app is backgrounded.
- Preserve async dressing invalidation across overlapping reveals, floor
  transitions, and run restarts.
- Keep `vite.config.ts` React dedupe entries. The smoke bundle check guards a
  known duplicate-React crash.
- Storage names with the legacy `hexpand_` prefix and the `HexpandDB` Dexie
  name are migration-sensitive. Do not rename them without a data plan.

## Style

Prettier is authoritative: 2-space indentation, semicolons, double quotes,
ES5 trailing commas, and an 80-column print width. TypeScript is strict. Use
explicit domain types for game state and bridge payloads. Import client code
through the `@/` alias when it improves clarity.

React components use PascalCase, hooks use `useCamelCase`, and utility modules
use camelCase filenames. Keep reducers and generator logic pure. Add short
comments only for non-obvious constraints.

Use `LLM`, `language model`, `on-device generation`, or the model/framework
name in prose. Avoid vague promotional terminology. Credit Luke Steuber in
published material; do not add tool or assistant attribution.

## Testing

Vitest discovers `client/src/**/*.test.ts` and `*.test.tsx`. Keep tests next to
the behavior they cover. Add focused tests for reducers, deterministic output,
bridge contracts, scheduler state, and async race handling.

Run `pnpm check` and `pnpm test` for documentation-adjacent source changes.
Run the relevant smoke mode when changing build configuration, native bridge
registration, React dependencies, async dressing wiring, or Capacitor sync.
Use `pnpm test:soak` for generator curve or solver-budget changes.

Device-only behavior still needs the checklist in `docs/DEVICE_VERIFY.md`.
Do not claim splash timing, Foundation Models availability, haptics, or touch
behavior is verified from desktop tests.

## Git and Pull Requests

Check `git status`, `git diff --stat`, and recent commits before staging. Keep
unrelated work intact and stage only intended files. Commits use short,
imperative summaries with an optional scope, such as
`docs: refresh contributor guide`. Do not add `Co-Authored-By` lines.

Pull requests should describe the user-facing effect, verification commands,
iOS or Xcode impact, and screenshots or recordings for visible UI changes.
Link the relevant project plan or design doc when implementing a tracked item.

## Documentation Maintenance

Treat `README.md`, `PROJECT_PLAN.md`, and the top-level files in `docs/` as the
current source of truth. Update them with behavior changes. Avoid phase labels
that go stale; name the concrete subsystem or invariant instead. Keep manual
device evidence and open release work explicit rather than marking it complete
from simulator or web verification.
