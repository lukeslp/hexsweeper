# Repository Guidelines

## Project Structure & Module Organization

This is a Vite + React client with a Capacitor iOS target. Client code lives in
`client/src`: gameplay in `client/src/game`, hooks in `client/src/hooks`, and
platform/game helpers in `client/src/lib`. Shared TypeScript contracts live in
`shared`. Native iOS code is under `ios/App`, including the
`FoundationModelsPlugin` bridge. Build output goes to `dist/public`; do not edit
generated files there. Design and planning notes live in `docs/`.

## Build, Test, and Development Commands

Use pnpm, matching `pnpm-lock.yaml` and the `packageManager` field.

- `pnpm dev` starts the Vite dev server for the web client.
- `pnpm build` builds the client into `dist/public`.
- `pnpm check` runs strict TypeScript checking without emitting files.
- `pnpm test` runs Vitest; it currently allows an empty test suite.
- `pnpm smoke` runs the pre-commit/pre-TestFlight smoke gates.
- `pnpm smoke --fast` skips Capacitor sync but verifies the web build.
- `pnpm cap:sync:ios` builds and syncs the iOS Capacitor project.
- `pnpm cap:open` opens the iOS project in Xcode.

## Coding Style & Naming Conventions

Prettier is authoritative: 2-space indentation, semicolons, double quotes,
trailing commas where valid in ES5, and 80-column print width. TypeScript is
strict; prefer explicit domain types for game state and bridge payloads. Use
aliases: `@/` for `client/src` and `@shared/` for `shared`. React components use
PascalCase, hooks use `useCamelCase`, and utility modules use camelCase
filenames.

## Testing Guidelines

Vitest is configured for `client/src/**/*.test.ts` plus server patterns. Place
tests next to the behavior they cover and name them `*.test.ts` or `*.spec.ts`.
Add focused tests for shared logic and pure game rules. Use `pnpm smoke` before
handing off changes that touch build, iOS bridge registration, React bundling,
or Capacitor sync.

## Commit & Pull Request Guidelines

Recent commits use short, imperative summaries, often with a scope prefix, for
example `docs: mark Hexodus decisions resolved` or
`scripts/smoke.sh: 5-gate pre-commit smoke`. Keep commits narrowly scoped.
Pull requests should include the user-facing change, commands run, any iOS/Xcode
impact, and screenshots or recordings for visible UI changes. Link related plans,
issues, or docs when the change implements a tracked phase.

## Agent-Specific Instructions

Before editing, check `git status` and preserve unrelated work. Prefer local
patterns over new abstractions. For frontend work, verify text fits on mobile
and desktop; for native bridge work, run `pnpm check` and the relevant smoke
mode.
