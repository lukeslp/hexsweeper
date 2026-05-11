# Hexodus — Implementation Plan

**Date:** 2026-05-10
**Status:** Ready for execution after open decisions resolved
**Spec:** `docs/superpowers/specs/2026-05-10-hexodus-design.md`
**Baseline commits:** `0ea2271` (cleanup) + `1923000` (@Generable port)

---

## Decisions resolved (2026-05-10)

- ✓ **Game name: Hexodus.** Working title locked; formal trademark + itch.io + App Store clearance owed before submission.
- ✓ **Bundle id: `app.hexodus.ios`.** Renamed in the deconfliction commit. Hexmind continues with `app.hexmind.ios`.
- ✓ **Cloud LLM: killed for v1.** Local Apple Foundation Models only. No `/api/generate` endpoint, no privacy nutrition disclosure for prompt-data leaving device.
- ✓ **Universal Links: deferred to v1.1.** No AASA in v1; `App.entitlements` is empty boilerplate. Cloudflare Worker recipe stays in this plan as v1.1 follow-up.

- ✓ **Mac via Designed-for-iPad: v1.0.** Already enabled in `project.pbxproj`; verification budgeted into Phase 6 (Mac screenshots + pointer/keyboard/window-resize testing add 1-2 days to that phase).

**All initial open decisions resolved.** Plan is fully unblocked for execution.

## Phase 0 status: MOSTLY DONE in deconfliction commit

The original Phase 0 scope was:
- ~~Name clearance~~ — decision locked; formal clearance moves to Phase 6 prep
- ~~Cloudflare AASA mirror~~ — moot (no Universal Links in v1)
- ~~Privacy manifest "User Content" disclosure~~ — moot (no cloud LLM)
- ~~Bundle id rename~~ — DONE in deconfliction commit
- ~~Strip applinks:hexpand.app + :hexpander.app from entitlements~~ — DONE (entitlements emptied entirely)
- ~~Dexie DB rename or accept brand-leak~~ — accepted brand-leak per "do not touch" list

**Residual Phase 0 items:**
- ✓ Flip `Info.plist` `LSApplicationCategoryType` → `public.app-category.puzzle-games` — DONE
- Apple Developer portal: register new App ID `app.hexodus.ios`, generate provisioning profile (manual browser click-through, ~5 min, see deconfliction handoff)
- Optional: rename repo dir `~/workspace/hivebreaker` → `~/workspace/hexodus` (manual shell command, ~30s, see deconfliction handoff)

**Phase 0 in code is COMPLETE.** Remaining work is the two manual steps above, both well-documented. Phase 1 (or Phase 2 per the technical review's recommended swap) can start in parallel.

---

## Plan summary

7 phases. Phase 0 is hygiene (gates submission, independent of game code). Phases 1-3 build the playable core. Phase 4 wires the on-device LLM. Phase 5 adds polish + meta. Phase 6 ships.

**Total estimate:** 28-42 person-days = 6-9 calendar weeks solo with day job (15 hrs/week productive). The brainstorming-era "2-4 weeks" was unrealistic; Manager's revised 6-8 weeks is the honest range. This plan errs slightly high (9 weeks) to leave float for Apple Review back-and-forth.

**Critical-path:** Phase 1 (solver) is the highest-risk component AND blocks Phases 2/3/4 from being playable. Land the 1000-board fuzz pass before any UI work begins. If solver slips, it slips the whole timeline.

**Parallelism opportunities:** Phase 0 hygiene can run entirely in parallel with Phases 1-3. Phase 5's GameCenter wiring can start after Phase 2 lands. Phase 6 prep (screenshots, copy) can begin during Phase 5.

---

## Phase 0 — Pre-build hygiene (gates submission)

**Why this is Phase 0:** every item below blocks App Store submission but does NOT block game development. Run in background while Phases 1-3 build the game.

### Inputs
- Open decisions 1, 3, and 4 resolved
- Cloudflare account (free tier sufficient)
- USPTO TESS access (free)

### Outputs
- Cleared game name with USPTO + itch + App Store search recorded
- AASA mirrored to Cloudflare Worker on all 6 brand domains; Apple's CDN serving the cached copy verified via `swcutil dl`
- `Info.plist` `LSApplicationCategoryType` flipped from `public.app-category.productivity` → `public.app-category.puzzle-games`
- `App.entitlements` `applinks:hexpand.app` and `applinks:hexpander.app` removed (only the game-relevant domains remain)
- Dexie DB renamed from `HexpandDB` to game-name DB (or accept the brand-leak with explicit user-visible note in Settings → Storage)
- Privacy manifest (`PrivacyInfo.xcprivacy`) updated for the chosen cloud-LLM posture (decision 3)
- Working-title-shaped strings (`Hexmind`, `Hexpand`, `iris.exe says...`) audited and cleaned where they leak to user-visible surfaces

### Verification gate
- `curl -sf https://<each-of-6-domains>/.well-known/apple-app-site-association | jq -e '.applinks.details[0].appIDs[0]'` returns `596T7J7FB6.<bundle-id>` for all 6 domains served from Cloudflare
- `swcutil dl -d <each-domain>` on a Mac confirms Apple's bot fetched successfully (next-check timestamp visible)
- `grep -E '(Hexmind|Hexpand|HexmindApp)' ios/App/App/{Info.plist,App.entitlements}` returns 0 lines for user-visible fields (bundle id may stay per decision 2)
- App Store Connect screenshot of the listing-side category is `Games > Puzzle`
- `open ios/App/App.xcworkspace` and Cmd+B succeeds against the cleaned entitlements + privacy manifest

### Estimated work
**3-5 person-days** (mostly waiting: USPTO search reflection, Cloudflare DNS propagation, Apple bot first-crawl)

### Risk callouts
- **Name clearance fails for top candidates** → cycle through alternates, may add 1-2 days. If all six alternates fail, /thinkagain on the naming axis.
- **AASA migration breaks already-installed TestFlight builds** → very unlikely (AASA only re-fetches on app update / OS update / reinstall) but worth a TestFlight tester smoke test post-cutover before submitting.
- **Cloudflare custom-domain SSL provisioning slow** → can take 30-90 min for all 6 domains. Plan for the wait, don't block on it.

### Suggested handoffs
- `/hitit` — for the actual file edits (Info.plist, entitlements, Worker deploy). Each item is small and atomic.
- `/doublecheck` — before marking the phase done, validate AASA payloads at all 6 domains and that the Apple bot fetched.
- `/legal` — already-installed skill; invoke for the privacy manifest text and any user-facing legal disclosures (privacy policy URL is mandatory at submission).

---

## Phase 1 — Constraint solver (HIGHEST RISK, gates everything else)

**Why this is Phase 1:** Marketing flagged unsolvable / trivially-solvable boards as the #1 review-killer. Without a working solver + uniqueness oracle + difficulty calibration, the game ships broken. Every other phase depends on this being solid. Land it first; the rest follows naturally.

### Inputs
- Cleanup baseline (commit `0ea2271`) ✓
- React dedupe in vite.config.ts ✓
- npm package `logic-solver` (Meteor's MiniSat-wasm port) installed
- Reference patterns from research:
  - https://www.snellman.net/blog/archive/2019-05-14-procedural-puzzle-generator/
  - https://github.com/elendiastarman/Tametsi-level-generator
  - https://github.com/polarbart/HexcellsAI

### Outputs
- `client/src/game/lib/solver.ts` — hand-rolled rule engine over axial-coord hex graph; 5 rules in difficulty order:
  1. trivial-satisfied
  2. trivial-forced
  3. pairwise-subset
  4. multi-constraint subset
  5. flower / column cardinality
- `client/src/game/lib/uniqueness.ts` — `logic-solver` wrapper; encodes board + assumption-flips each unknown; returns `{singleSolution: boolean}`
- `client/src/game/lib/generator.ts` — Snellman construct-by-deduction:
  1. random mine layout per difficulty band
  2. seed 1-2 revealed cells
  3. loop: run rule engine; if stuck, add lowest-cost hint that unblocks one deduction; repeat
  4. prune redundant hints
  5. uniqueness oracle confirms single solution; reject + retry if not
- `client/src/game/lib/difficulty.ts` — score = weighted sum of `(rule_index × times_applied)` + `max_layer_depth`; bucket into 5 bands by 500-board offline corpus percentiles
- Web Worker entry point so the solver never blocks the rAF / UI thread (when UI lands in Phase 3)
- `client/src/game/tests/solver.test.ts` — 1000 fuzz boards, every one solver-validated for single solution + difficulty band membership
- `client/src/game/tests/generator.test.ts` — property tests: every generated board passes solver.validate; difficulty-band sampling matches target distribution within ±5%
- `__fixtures__/baked-seeds.json` — ~30 hand-curated seeds (5-6 per floor band) as the fallback when generation can't hit the target band within 20 retries

### Verification gate
- `pnpm test client/src/game/tests/solver.test.ts` — all 1000 fuzz boards solver-validated, single solution confirmed by uniqueness oracle, difficulty-band assignment matches target ±5%
- Synthetic-solver win rate: ≥80% at difficulty 1, falling to ~25% at difficulty 5; reject any floor where solver wins <20% or >95% of generated seeds
- Performance: `generator.generate({floor:12, seed: random})` median <500ms on iPhone 12 sim, <1.2s p99 (measured via `performance.now()` in a Worker harness)
- Worker isolation verified: main thread `requestAnimationFrame` callback fires every 16ms while generation runs in the Worker (use a tiny test harness with a spinning canvas counter)

### Estimated work
**5-7 person-days** (per research recommendation). Days breakdown:
- Day 1-2: rule engine over axial hex graph
- Day 3: construct-by-deduction generator
- Day 4: logic-solver uniqueness oracle integration
- Day 5: difficulty calibration + 500-board offline corpus
- Day 6: floor scaling + Worker isolation
- Day 7: hardening (timeout/retry, golden-board snapshot tests, seeded RNG for reproducibility)

### Risk callouts
- **Performance budget miss** (median >500ms, p99 >1.2s on iPhone 12). Mitigations: pre-generate a per-floor pool at app launch + during gameplay idle, so the player never waits on generation. Falls back to baked seeds if pool runs dry.
- **Difficulty band collapse** — solver scores bunch in middle bands, leaving top/bottom bands empty. Fix: re-tune weights, possibly add a 6th rule for hardest tier.
- **`logic-solver` cold-load latency in WKWebView** — Meteor's package may have slow first-import. Pre-warm in the Worker on app launch.
- **NP-completeness corner cases** — pathological board layouts where uniqueness check times out. Wrap with a 1s timeout; treat timeout as "reject this candidate" and continue.

### Suggested handoffs
- `/hitit` — the implementation work itself
- `/thinkagain` — if performance gates miss after first attempt; the hybrid rule-engine + SAT-oracle approach is the considered path, but Z3-wasm or a different generator topology may be needed if the band assignment misbehaves
- `/doublecheck` — before phase progression, run the full 1000-board fuzz on real iPhone hardware (not just simulator), since WKWebView perf differs

---

## Phase 2 — Game state + run state reducers (pure logic, no rendering)

**Why this is Phase 2:** Pure TypeScript reducers are easy to test exhaustively, easy to debug, and unblock Phase 3 (rendering) without coupling rendering to state changes. Build the brain before the face.

### Inputs
- Phase 1 solver/generator complete and tested
- Reference patterns from existing `client/src/hooks/useCanvasInteraction.ts` (already in the allowlist) for state-transition shapes
- Spec data flow section (single floor, end-to-end)

### Outputs
- `client/src/game/lib/gameState.ts` — turn-level reducer
  - State: `{boardId, cells: Map<HexKey, CellState>, wrongsLeft, status: 'playing'|'won'|'lost'}`
  - Actions: `{type: 'commit', hex, decision: 'safe'|'blocked'} | {type: 'reset'}`
  - Pure function `(state, action) → newState`
- `client/src/game/lib/runState.ts` — run-level reducer
  - State: `{runId, seed, floor: 1-12, totalWrongs, status: 'active'|'escaped'|'caught', bestFloor}`
  - Actions: `{type: 'startRun'} | {type: 'completeFloor'} | {type: 'failRun'}`
  - Pure function with seed-driven floor advancement
- `client/src/game/tests/gameState.test.ts` — 100% branch coverage of reducer; vitest
- `client/src/game/tests/runState.test.ts` — permadeath property tests + seed reproducibility (same seed = same floor sequence)

### Verification gate
- `pnpm test client/src/game/tests/{gameState,runState}.test.ts` green
- Vitest coverage report shows 100% branch coverage on both reducers
- Seed reproducibility: 100 runs with same seed produce byte-identical floor sequences and outcomes
- No React imports in `client/src/game/lib/{gameState,runState}.ts` (verify via grep) — these stay pure for testability and worker-portability

### Estimated work
**2-3 person-days**

### Risk callouts
- **Off-by-one on win condition** — "all SAFE cells revealed" needs care since not every cell is SAFE; some are BLOCKED and never revealed. Test for: `cellsSafe.every(c => c.revealed)`, not `cells.every(c => c.revealed)`.
- **Wrongs-left budget reset on floor advance** — design choice: reset to floor's max each new floor, or carry over? Spec says reset (per floor scaling). Document explicitly in code.
- **Iris-breaks-tile interaction with revealed-already cells** — when iris breaks a tile, must skip already-revealed ones to avoid no-op visuals. Track `unrevealed` subset.

### Suggested handoffs
- `/hitit` — implementation
- Pair with `superpowers:test-driven-development` skill — reducers are a perfect TDD target

---

## Phase 3 — GameHexBoard.tsx Canvas2D rendering

**Why this is Phase 3:** With Phase 1 producing valid boards and Phase 2 producing valid state transitions, rendering is the layer that makes them visible + tappable. The two demo aesthetics the user provided lock the visual direction; this phase blends them.

### Inputs
- Phase 1 generator producing valid boards
- Phase 2 reducers producing valid state transitions
- Two reference Canvas2D demos (in conversation 2026-05-10): the iris pupil demo + the 3D hex landscape demo
- Existing `useCanvasInteraction.ts` (pan/zoom/pinch + tap-vs-drag) and `useTouchDrag.ts` (long-press WKWebView fix) and `haptics.ts` (full vocabulary) — all already in the allowlist

### Outputs
- `client/src/game/components/GameHexBoard.tsx` — single `<canvas>` element, single `requestAnimationFrame` loop, painter's-sort 3D hex render adapted from the 3D hex landscape demo. State-driven (reads from gameState reducer).
  - Hover-lift, tap-ripple, color-shift on tap (same primitives as the demo)
  - Tile state colors: SAFE-revealed (green), BLOCKED-revealed (red), UNREVEALED (grey), iris-broken (cracked black)
  - Number rendering for clue cells (centered, monospace, contrast-WCAG-AA)
- `client/src/game/components/IrisOverlay.tsx` — second canvas layered above (or composited) — the iris demo's pupil that "watches" the player. Iris position derived from `runState.floor` (closer = later floors).
- Touch handling integrated via the existing `useCanvasInteraction` + `useTouchDrag` hooks. No re-implementation; reuse what's proven.
- Haptic feedback wired: `haptics.success` on correct reveal, `haptics.error` on wrong, `haptics.medium` on iris tile-break.

### Verification gate
- 60fps sustained on iPhone 12 simulator with 150-tile board (worst case at floor 12). Measure via Instruments Time Profiler 60-second gameplay session; main-thread frame >16ms count <5/min.
- Memory <250MB sustained
- Touch-to-tile latency <100ms (measured via Capacitor bridge timestamp diff in console)
- No SVG nodes anywhere in the game render tree (verify via DOM inspector — only the React HUD chrome should have SVG, the board is pure canvas)
- Visual smoke test (manual, no auto-snapshot): board renders correctly at all 5 difficulty bands; iris overlay grows/closes with floor progression

### Estimated work
**6-8 person-days**

### Risk callouts
- **WKWebView Canvas2D thermal** (Greybeard's #1 worry) — long sessions on older iPhones. Mitigation: pause rAF when player is idle (no interaction for >2s), throttle iris animation to 30fps when game state hasn't changed.
- **Painter's-sort with 150 tiles** — the demo handles this fine but real game adds glow/break-animation overlays. Profile early, swap to z-buffered render if needed.
- **Iris overlay composition** — two canvases vs one with layered draws. Two canvases simpler; one canvas more performant. Start with two, optimize if needed.
- **Tap-vs-drag-vs-pan disambiguation on tightly-packed tiles** — `useCanvasInteraction` handles this for the mind-mapper but tile centers were 80px apart. Game tiles may be 40-50px on iPhone 12. Re-tune the `TAP_DISTANCE_THRESHOLD` constant.

### Suggested handoffs
- `/hitit` — implementation
- `/accessibility` — already-installed skill; invoke for color-independent state signaling (don't rely on red-green alone), 44pt minimum tap targets, VoiceOver labels for cells
- `/frontend-design` — already-installed; invoke if the cyberpunk aesthetic needs sharpening or the hover-lift/ripple physics feel off
- `/thinkagain` — only if 60fps gate misses on real device after all mitigations; alternative is a Pixi.js v8 swap (1 week, isolated to GameHexBoard) per Architect's escape hatch

---

## Phase 4 — Narrative integration (Apple Intelligence wired to gameplay)

**Why this is Phase 4:** With game playable end-to-end after Phase 3, narrative is the layer that turns a hex puzzle into Hexodus. Depends on Phases 1-3 being playable + the @Generable IrisLine + FloorFlavor port (already shipped, commit `1923000`).

### Inputs
- Phases 1-3 complete; game is playable with placeholder text
- @Generable IrisLine + FloorFlavor port shipped (commit `1923000`) ✓
- `tryOnDeviceIrisLineFirst` + `tryOnDeviceFloorFlavorFirst` JS bridge helpers wired ✓
- Apple Intelligence end-to-end on-device verification done (you'll do this when you cmd+R after the @Generable commit)

### Outputs
- `client/src/game/lib/narrative.ts` — orchestration layer:
  - `floorFlavor(runId, floor) → Promise<{name, description}>` — calls `tryOnDeviceFloorFlavorFirst` with the right system prompt; falls back to static pack
  - `tauntFor(event: 'wake'|'wrong'|'streak'|'death'|'escape', context) → Promise<string>` — calls `tryOnDeviceIrisLineFirst` with event-specific prompts; falls back
- `client/src/game/lib/fallbackText.ts` — bundled static pack:
  - ~80 floor names indexed `[band: 1-5][i: 0-15]` for stable variety
  - ~50 taunts indexed `[event][i: 0-9]`
  - All cyberpunk neuromance voice; hand-authored for tonal consistency
- `client/src/game/screens/FloorTransition.tsx` — shows generated/fallback name + description + iris taunt; tap to begin floor; fires LLM call in parallel with mount so text is there by tap time
- `client/src/game/components/ToastFeed.tsx` — subtle mid-floor stinger lines from iris.exe (rare; e.g. on 3-correct streak, on first wrong, when iris.exe gets close to ESCAPED block)
- `client/src/game/screens/GameOver.tsx` — death taunt or escape taunt, depending on outcome

### Verification gate
- On Apple-Intelligence-eligible device: `wake >_` button (already in HexodusBoot) returns parsed IrisLine in <3s; latency badge shows actual time
- On Apple-Intelligence-ineligible device (or AI off in Settings): falls back to static text within 200ms; UX identical except for the static-vs-LLM source
- 100% of static fallback strings render correctly when LLM is forced off (test by setting `availabilityCache = false` manually)
- No crash, no white screen, no silence-without-fallback when LLM throws/refuses/times out
- ` runId × floor` produces stable static-fallback variety across app restarts (deterministic indexing)

### Estimated work
**3-4 person-days**

### Risk callouts
- **Apple Intelligence guardrails refuse iris.exe taunts** (Breaker flag) — "hostile AI" framing may trip safety. Mitigation: terms like "mock", "ridicule", "contemptuous" survive; "kill", "destroy", "blood" don't. Pre-test a battery of ~20 prompts on real device before locking system prompt.
- **First-floor latency masks LLM call cost** — first generation has cold-start. Pre-warm with `session.prewarm()` at app boot (per FoundationModels research recommendation). Wire this to HexodusBoot mount.
- **Static fallback feels sterile compared to LLM output** — author the 80 + 50 strings carefully; treat them as a writing project not a placeholder list. The non-LLM path is the majority case for iOS<26 users.
- **"On-device" claim must be accurate** — App Store description and screenshots must say "on supported iPhones" or similar; can't imply Apple Intelligence is universal.

### Suggested handoffs
- `/hitit` — implementation
- `/apple-intelligence` — already-installed skill; invoke for the systemPrompt design + @Guide string tuning + prewarm wiring
- `/humanize` — already-installed; for the static fallback string authoring (cyberpunk voice; resist "AI-corporate" tone drift)
- `/doublecheck` — verify static fallback works with LLM off before marking phase done

---

## Phase 5 — Meta features (GameCenter, persistence, telemetry, share)

**Why this is Phase 5:** With the game playable + narrative wired, meta features are what turn a working app into a shippable product. Independent enough to start once Phase 2 (run state) is done; can run in parallel with Phase 4 narrative work.

### Inputs
- Phase 2 runState reducer for save format + best-run tracking
- Phase 4 narrative for share-card text generation (or static)
- Capacitor GameKit bridge — needs a thin Swift plugin (or use existing capacitor-community plugin if quality is good)

### Outputs
- `client/src/game/lib/gameCenter.ts` — JS bridge to a tiny native GameKit Swift wrapper (file: `ios/App/App/GameCenterPlugin.swift`):
  - Authenticate local player on app launch
  - Submit best-run-floor-reached to a single leaderboard
  - Award "Escaped" achievement on full-12-floor clear
  - Achievement progress for "First Floor" (5%), "Floor 6" (50%), "Escaped" (100%)
- `client/src/game/lib/persistence.ts` — Dexie schema:
  - `runs`: `{runId, seed, floorReached, completedAt, escaped: bool, totalWrongs}`
  - `currentRun`: single-record table for in-progress save (cleared on death)
  - Auto-export ring buffer (3 slots) to localStorage every 10 runs (per Safety committee)
- `client/src/game/lib/analytics.ts` — MetricKit signposts only (no third-party SDK):
  - Floor-completion latency (time from tap-Begin to floor-cleared)
  - Rage-tap detection (3 taps <500ms in same hex) → signpost event
  - Generator latency (median, p99 via metric)
- `client/src/game/screens/ShareCard.tsx` — generates a cyberpunk-styled run summary image via Canvas-to-PNG; shares via native iOS share sheet through Capacitor's Share plugin (need to add):
  - "Hexodus run #N — escaped to floor 7/12 — iris.exe says: '[taunt]'"
  - Image dimensions optimal for X / iMessage / Instagram

### Verification gate
- GameCenter login works on a Sandbox tester account; leaderboard entry visible in App Store Connect Sandbox
- Achievements unlock at correct thresholds; visible in Game Center app
- Force-quit mid-floor + relaunch restores to the exact mid-floor state (with correct wrongs-left count)
- `pnpm test client/src/game/tests/persistence.test.ts` — round-trip save/restore on 100 fuzz states
- Share card renders correctly on iPhone 12 + iPad; share sheet opens; share targets work (X, iMessage, Mail)
- MetricKit Console shows expected event fire patterns during a 10-min play session

### Estimated work
**4-6 person-days**

### Risk callouts
- **GameKit authentication fails silently** when player isn't signed into GameCenter — gracefully show "Sign into GameCenter to track your best run" affordance, don't block gameplay
- **Dexie quota exceeded** — auto-export ring buffer covers this, but the exported JSON should be human-readable enough to recover from manually
- **Capacitor Share plugin** — likely fine, but verify the share sheet works on iPad (popover positioning issue is common)
- **MetricKit signposts privacy** — they're aggregated and Apple-private, but document in App Store privacy nutrition labels just in case

### Suggested handoffs
- `/hitit` — implementation
- `/generators` — already-installed skill; has generators for telemetry wiring, share cards, state restoration
- `/swift` — already-installed; invoke for the GameCenterPlugin.swift wrapper code review

---

## Phase 6 — App Store submission prep

**Why this is Phase 6:** Last. Everything else has to be done first. This phase is mostly content + paperwork; the engineering is over. Budget for at least one App Review rejection (Apple rejects ~30% of first submissions per industry data).

### Inputs
- All Phases 0-5 complete
- Apple Developer Program active and not expiring soon
- App Store Connect API key (.p8 file) — see `app-store-connect-skill` (external) for automation
- Final game name cleared (decision 1)

### Outputs
- 6.7" + 6.5" + 5.5" iPhone screenshots (Apple's requirement: at least one set, others optional but recommended)
- 12.9" iPad screenshots (mandatory if ipad supported — yes)
- App Preview video (15-30s, H.264) showing cold launch → tap a hex → solve a small board → iris.exe taunts → floor complete
- 1024x1024 marketing icon (cyberpunk aesthetic, hex motif, no Apple Intelligence symbol — keep it puzzle-shelf-readable)
- App Store listing copy:
  - **Title:** [chosen name] (max 30 chars)
  - **Subtitle:** "Escape the AI in your phone." (max 30 chars; this is the hook)
  - **Description** (4000 chars): leads with puzzle craft; mentions on-device intelligence in the third paragraph as the diegetic story element, not the headline
  - **Keywords** (100 chars): hex puzzle logic indie offline puzzle hexcells minesweeper deduction (research with `app-store-aso-skill`)
  - **Promotional text** (170 chars): rotating hook for updates
- Age rating questionnaire: 12+ (or 17+ if Apple insists due to LLM content; fight back with "deterministic via @Generable schema constraints")
- Privacy nutrition labels: based on decision 3 (cloud LLM kept or killed)
- App Review notes (free-text field at submission): explain Apple Intelligence is on-device, schema-constrained via `@Generable`, and that the antagonist character is fictional in-game scaffolding for puzzle progression
- TestFlight external test (24-72h Apple review) with 5+ real-world testers
- Final submission

### Verification gate
- All assets pass App Store Connect validation
- TestFlight external review approves
- 5 testers play through at least one full run; no crashes; all complete escape feedback collected
- App Store submission accepted (or productively-rejected with a clear path forward)

### Estimated work
**4-6 person-days** (much of it waiting on Apple)
- Day 1-2: screenshots + App Preview video
- Day 1-2 (parallel): listing copy + keywords + ASO
- Day 1: privacy labels + age rating
- Day 1-2: TestFlight external cycle + tester wrangling
- Day 1: final submission + app review wait
- Float for Apple Review back-and-forth: 1-2 weeks calendar time at worst

### Risk callouts
- **First-submission rejection** (~30% rate). Most likely categories given our app:
  - 4.3 Spam ("another LLM wrapper")
  - 5.1.2 Data Use (must declare prompts going off-device if cloud kept)
  - 1.1 / 1.2 Objectionable content (LLM output not server-moderated; @Generable is your defense)
- **Mac via Designed-for-iPad** triggers Mac-specific testing — pointer/keyboard/window-resize. Test these explicitly before submit.
- **TestFlight external test review can take 24-72h** — submit early, before you think you're done.
- **Apple Intelligence wording in listing** — "on supported devices" is Apple's preferred phrasing; "Apple Intelligence" can appear in description but not in title.

### Suggested handoffs
- `/hitit` — for the assembly work
- `/app-store` — already-installed skill for listing copy, keywords, review responses
- `/generators` — has screenshot automation, app icon generation
- `/release-review` — already-installed; pre-submission senior review pass before submitting
- `/legal` — already-installed; privacy policy URL, age rating defense
- External: install `app-store-connect-skill` (199-biotechnologies on GitHub) for ASC API automation, `claude-skill-aso-appstore-screenshots` (adamlyttleapps) for screenshot polish

---

## Cross-phase concerns

### Sequencing & parallelism

```
Phase 0 ────────────────────────────────────────────────────────────────┐
                                                                       │
Phase 1 (solver) ───────┬─→ Phase 2 (reducers) ─┬─→ Phase 3 (render) ─┤
                        │                        │                     │
                        │                        └─→ Phase 5 (meta) ───┤
                        │                                              │
                        └──────────────────────→ Phase 4 (narrative) ──┤
                                                                       │
                                                                Phase 6 ─→ submit
```

- Phase 0 runs in parallel with Phases 1-3 (independent of game code)
- Phase 5 starts as soon as Phase 2 lands (uses runState for save schema)
- Phase 4 needs Phase 1 + 2 + 3 (need playable game to integrate narrative)
- Phase 6 needs everything

### Dependencies on already-completed work

| Already done | Unblocks |
|---|---|
| Cleanup baseline (commit `0ea2271`) | All phases |
| React dedupe in vite.config.ts | Phase 3 (rendering relies on hooks not crashing) |
| @Generable IrisLine + FloorFlavor (commit `1923000`) | Phase 4 (narrative wires to existing helpers) |
| HexodusBoot wake button | Phase 4 verification (proves the path on device before phase begins) |
| FoundationModelsPlugin Swift baseline | Phase 4 |
| Allowlisted hooks (`useCanvasInteraction`, `useTouchDrag`, `haptics`) | Phase 3 (no re-implementation) |
| AASA route in trimmed server | Phase 0 (Cloudflare migration is a copy-not-create) |

### Kill criteria (per Cynic committee)

- **Week 1 (after Phase 0+1):** if solver fuzz fails on >5% of generated boards or perf gates miss by >2x on real device, /thinkagain on the solver topology before continuing
- **Week 2 (after Phase 2+3):** if Phase 3 60fps gate misses on iPhone 12 with all mitigations applied, escalate to Pixi.js swap (1-week budget) per Architect escape hatch
- **Week 4 (after Phase 4):** if 5 humans can't articulate a positive feeling about the game after one run, sunset the project rather than push through. The game has to be fun, not just functional.
- **Week 8 (Phase 6):** if 3 App Review rejections happen in a row, pause and re-architect the LLM-content surfaces rather than keep submitting

### Skill handoff cheat-sheet

Per phase, in approximate order of value:

| Phase | Skills to invoke |
|---|---|
| 0 | `/hitit`, `/legal`, `/doublecheck` |
| 1 | `/hitit`, `/superpowers:test-driven-development`, `/thinkagain` (if perf misses) |
| 2 | `/hitit`, `/superpowers:test-driven-development` |
| 3 | `/hitit`, `/accessibility`, `/frontend-design`, `/thinkagain` (if perf misses) |
| 4 | `/hitit`, `/apple-intelligence`, `/humanize` |
| 5 | `/hitit`, `/generators`, `/swift` |
| 6 | `/hitit`, `/app-store`, `/generators`, `/release-review`, `/legal`, `/doublecheck` |

External skills worth installing (per `/enhance` research earlier in session):
- `xclaude-plugin` (iOS sim build/run automation) — install before Phase 3
- `app-store-connect-skill` (199-biotechnologies) — install before Phase 6
- `claude-skill-aso-appstore-screenshots` (adamlyttleapps) — install before Phase 6

---

## Total estimate

| Phase | Days |
|---|---|
| 0 — Hygiene | 3-5 |
| 1 — Solver | 5-7 |
| 2 — Reducers | 2-3 |
| 3 — Rendering | 6-8 |
| 4 — Narrative | 3-4 |
| 5 — Meta | 4-6 |
| 6 — Submission | 4-6 (+ 1-2 weeks Apple wait) |
| **Total dev work** | **27-39 person-days** |

Calendar weeks at 15 productive hrs/week solo with day job: **6-9 weeks**. Allow up to 2 additional weeks for Apple Review back-and-forth.

---

## Acceptance for the plan itself

This plan is "good enough to execute" when:
- [x] Open decisions are surfaced explicitly
- [x] Each phase has inputs, outputs, verification gate, estimate, risks
- [x] Sequencing dependencies are explicit
- [x] Kill criteria are documented per Cynic recommendation
- [x] Skill handoffs are specified per phase
- [x] Dependencies on already-completed work are listed

You can /doublecheck this plan, /thinkagain on any phase that feels off, or /hitit to start Phase 0 (after open decisions resolve).

---

## Assumptions

- Solo developer (Luke Steuber) with day job, ~15 productive hrs/week
- iOS-only target; Android explicitly out of scope through v2+
- macOS via Designed-for-iPad accepted at v1.0 (decision 4) or deferred to v1.1
- No cofounder, no paid contractors, no QA budget — manual playtest by 5 humans, no formal QA cycle
- Apple Developer Program membership current
- TestFlight + App Store Connect access already set up under team `596T7J7FB6`
- Bundle id `app.hexmind.ios` may be renamed (decision 2) — plan doesn't depend on it either way
- Cloud LLM proxy access via current `dr.eamer.dev` server is available if decision 3 keeps cloud fallback opt-in; killed entirely if decision 3 removes
- Cloudflare account exists and the 6 brand domains are either on Cloudflare DNS or can be migrated (Phase 0 migration cost is included)
