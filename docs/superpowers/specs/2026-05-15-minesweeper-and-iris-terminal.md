# Minesweeper auto-deduce + iris.exe terminal (2026-05-15)

Canonical design for two additive features shipped together: **(1)** deterministic
constraint-propagation after player reveals/marks, plus mine-tier visuals and
cascade animation; **(2)** a persistent iris.exe terminal fed by deterministic
event lines and optional on-device takeover lines.

## Part 1 — Engine

- **`deriveDeductions(cells)`** (`solver.ts`) — single-step + fixed-point
  propagation using only `view === "revealed"` **and** `clueVisible === true`
  clues, plus player marks as known mines. Returns `provablySafe` and
  informational `provablyMine` (gameplay does **not** auto-mark mines).
- **`applyCascadeDeductions(state, triggerKey)`** (`gameState.ts`) — loops
  deductions and reveals all provably safe unknowns; groups new keys into
  `lastCascade` rings by axial distance from the trigger for UI stagger.
  Preserves the player’s `lastEvent` (`correct-reveal` / `correct-mark`);
  cascade is indicated by `lastCascade` and optional terminal lines.
- **`clearCascade`** — clears `lastCascade` after animation (reduced motion:
  immediate).
- **Warm start** — `generateFloor` accepts `warmStartDeductionCap` (default
  **80**). Pass **0** in unit tests that require unknown safe cells. Production
  uses the default so the first screen reflects one bounded deduction pass.
- **`cellVariant` 0..3** on blocked cells from adjacent blocked-among-blocked
  density (`generator.ts`).
- **Deferred (v1.1):** Approach C — iris “hint glow” on deducible mines (see
  gameplay spec).

## Part 2 — Terminal

- **`terminalLog.ts`** — `reduceTerminalLog` ring buffer (~300 lines),
  `floorEventToTerminalLines` for deterministic `[evt]` lines.
- **`terminalTakeoverScheduler.ts`** — when to ask for an iris takeover (wrong,
  floor end, iris brackets, heartbeat), rate limits, static fallback pack.
- **`tryOnDeviceTerminalTakeoverFirst`** — Swift `@Generable` `TerminalTakeover`
  (`{ line }`), mirrored in `FoundationModelsPlugin.swift`.
- **Boot continuity** — `TerminalFeedProvider` + `TerminalPanel` (`boot` →
  `strip`); `begin run` appends `[evt] RUN begin…` and keeps the same log.

## Sequencing

Cascade engine landed first; terminal is presentation-only and never writes
puzzle truth.
