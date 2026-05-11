# Hexodus Plan — Technical Review

**Date:** 2026-05-10
**Status:** Self-review pass (NOT formal team:technical council — usage cap hit; re-run after May 12 if you want the four-seat version)
**Plan reviewed:** `docs/superpowers/plans/2026-05-10-hexodus-implementation-plan.md`
**Spec reviewed:** `docs/superpowers/specs/2026-05-10-hexodus-design.md`

> Caveat: this is a one-pass critical read by the same author who wrote the plan. Real `team:technical` council (architect / greybeard / safety / tester as separate adversarial agents) would surface things I'm blind to by construction. Treat this as a sanity check, not a formal review. The full review queue is parked behind the May 12 reset.

---

## Architect lens — sequencing reality check

**One real concern:** Phase 1 (solver, 5-7 days, highest risk) before Phase 2 (reducers, 2-3 days, low risk) is wrong. The reducers are a pure-logic harness for testing the solver. Building reducers FIRST gives Phase 1 a place to live — `gameState.commit()` calls solver-validated boards, which means solver bugs surface in reducer tests immediately rather than in Phase 3 rendering when they're hard to debug.

**Recommended swap:** Phase 1 ↔ Phase 2. Run reducers first (3 days), then solver (7 days). Reducers also give you concrete `BoardSeed` and `CellState` types that the solver consumes, which removes a coupling guess.

**Web Worker for solver — likely over-engineered for v1.** Generation only runs at floor transition (~once per ~2 minutes of play). A simple `await new Promise(setTimeout(0))` yield-point inside the generator is enough to keep rAF responsive. Worker adds postMessage serialization, error-boundary complexity, and bundling friction. Save the Worker for v1.1 if real-device profiling shows main-thread jank during generation. **Plan should descope Worker to "v1.1 if perf gates miss."**

**GameHexBoard scope is fine.** 6-8 days for board + iris-overlay is honest given the two demos already exist as concrete reference. Don't split — both render to canvas and need to share painter's-sort, splitting them creates a coordination problem.

**Phase 5 (meta) before Phase 4 (narrative)?** Plan claims Phase 5 can start after Phase 2 (just runState). Technically true but practically false — GameCenter integration without a playable game means you can't test it end-to-end, just unit-mocking. Recommend Phase 5 starts after Phase 3 lands, in parallel with Phase 4.

**Missing phase?** No formal "polish" phase between 5 and 6 for sound, animation tuning, transition feel. Plan implicitly folds it into Phase 3 + Phase 5; that's tight but doable. Don't add a phase; budget 2 floating days for polish to be drawn from Phases 3 and 5.

## Greybeard lens — where it breaks on real hardware

**60fps on iPhone 12 with 150 tiles is plausible but not free.** Canvas2D is fast. The risk is the iris overlay — if it's a second canvas redrawing every frame, you've doubled your work. If it's a CSS-positioned div over the canvas, it's free. Plan doesn't specify; assume the worst (second canvas) and budget accordingly. Worst-case mitigation: drop iris-overlay frame rate to 30fps when game state hasn't changed, full 60fps only during animation.

**Apple Intelligence cold-start in real conditions** — plan budgets 8s. Real risks the plan handwaves:
- Background eviction: if the user backgrounds for 20+ minutes, model gets unloaded; next call has 1-3s cold start AGAIN even with `prewarm()`. Plan should re-prewarm on `App.appStateChange("active")` event.
- Low-power mode: Apple Intelligence is throttled or unavailable; spec says "static fallback" but plan doesn't verify the low-power-mode test runs.
- iOS dot-release tightens guardrails: this WILL happen mid-season. The plan needs a server-pushed kill switch for the FoundationModels path so you can disable on-device LLM remotely without an App Store update. Currently in spec but NOT in any phase. Add to Phase 4 or a v1.1 hotfix phase.

**"No network during a floor"** — plan's right that the game itself doesn't call out, but doesn't account for: (a) Capacitor's `App` plugin internal heartbeat, (b) any Sentry-class crash reporting if added later, (c) iOS's own network reachability listeners firing whether the app uses them or not. Realistic claim: "no Hexodus-initiated network during a floor." That's defensible.

**Top-3 things this plan misses and TestFlight will surface:**
1. **VoiceOver and Dynamic Type don't work on the canvas board.** Canvas2D is invisible to assistive tech. Plan mentions accessibility skill in Phase 3 handoffs but doesn't budget actual time. App Review will flag this for an accessibility-themed app from a developer with AAC background. **Add 1-2 days to Phase 3 for SR overlay (invisible DOM mirror of cell state for VoiceOver).**
2. **Splash-to-first-board cold launch on real iPhone.** Plan optimizes splash hide via double-rAF but doesn't measure actual cold-launch time on iPhone 12. Realistic budget: 4-7s on iPhone 12, 2-3s on iPhone 16. **Add a "cold launch <5s on iPhone 12" gate to Phase 6.**
3. **Storage permissions / quota prompts on first save.** Dexie can trigger a quota warning on iOS 16+ when storage approaches limit. Plan covers QuotaExceededError but not the permission prompt. **Test with an iOS account that's near its iCloud free-tier limit.**

**6-9 week estimate honest assessment:** lower bound (6 weeks) requires zero rework + no Apple Review rejection + favorable playtester response. Upper bound (9 weeks) is realistic. **P90 is 11 weeks** if you hit one solver re-tuning loop, one Apple Review rejection, and one playtester-driven mechanic change. Plan should communicate "expect 11 weeks; aim for 9."

## Safety lens — gates vs the failure matrix

**Static-fallback path coverage is undertested.** Phase 4 verification gate is "manual smoke test by setting availabilityCache = false." That's a one-time check, not a CI gate. Risk: when fallbackText.ts gets edited in v1.1, regression goes unnoticed.

**Recommendation:** add a Phase 4 unit test that asserts `tryOnDeviceIrisLineFirst` returns null cleanly when `availabilityCache = false` AND that the calling code (HexodusBoot, FloorTransition, ToastFeed, GameOver) renders the static fallback string indexed correctly. Make it a vitest. Runs on every commit.

**Airplane-mode test** is not in any phase. Should be in Phase 5 (meta) right alongside the persistence tests. The integration shape: `start a run, complete floor 1, enable airplane mode, complete floor 2 (proves no network dependency), restart app in airplane mode, restore run, complete floor 3 (proves persistence works offline)`. Manual test, but document the script.

**AASA CDN cutover safety:** ~~plan says "very unlikely to break already-installed builds."~~ **MOOT after 2026-05-10 deconfliction commit.** Hexodus v1 ships without Universal Links / AASA entirely; Hexmind retains all 6 brand domains and `app.hexmind.ios`. Concern returns in v1.1 when Hexodus introduces its own Cloudflare Worker + new domain — recommendation preserved here for that future cutover: deploy AASA to Cloudflare first, then change bundle id (never both in the same window).

**Baked-seed path** isn't tested in Phase 1. The 30 baked seeds get loaded only when generation fails. CI never exercises that path unless you force it. **Add to Phase 1 verification: simulate generator failure and assert baked seed loads + plays correctly.**

**Backgrounding mid-floor before Phase 5 ships persistence** — plan should explicitly state Phase 3 ships to TestFlight WITHOUT mid-floor save (acceptable for internal testing) and Phase 5 lands persistence before any external TestFlight or App Store submission. Currently implicit; make it explicit.

**iOS 27 kill-switch.** Spec mentions it; plan omits. **Add to Phase 4 or Phase 5: the JS-side `tryOnDevice*` helpers should check a feature-flag fetched once per app launch from `/api/feature-flags` (or a Cloudflare-served static JSON). When `fm_enabled = false`, skip on-device entirely. Cost: 2 hours. Saves catastrophic post-launch issues.**

**Failure modes in spec but NOT in plan:**
- "App backgrounded mid-LLM-call" — plan covers backgrounding but not specifically during the LLM call. Need to test that the JS Promise.race aborts cleanly and doesn't leak.
- "Schema-parse failure" — plan covers via @Generable, but if Apple updates the framework in iOS 26.x and breaks the @Generable decoder, we have no test. Add a runtime "did this parse?" assertion as the last line of defense.

## Tester lens — verification rigor

**Real iPhone vs simulator** — plan tests on simulator throughout Phases 1-3. Apple Intelligence CANNOT be tested in simulator. So the FIRST real-iPhone Apple Intelligence test happens in Phase 4. That's late. **Recommendation: every Phase 1-3 verification gate should explicitly note "simulator-only OK for this phase" so it's clear what's deferred to real hardware. Phase 4 verification needs to ADD: timing-budget test on real device (cold start <2s, warm <500ms, p99 <8s).**

**React-dedupe regression gate** is missing. The bug landed because nothing checked the bundle invariant. **Add as a CI gate in every phase from Phase 1 forward:**
```bash
# CI test: bundle has exactly one React Internals
COUNT=$(grep -oE 'H:null,A:null' dist/public/assets/index-*.js | wc -l)
[ "$COUNT" = "1" ] || { echo "DUAL-REACT REGRESSION: $COUNT Internals in bundle"; exit 1; }
```
Bake this into the pre-TestFlight smoke command. The cost is one shell line; the saved pain is 4 hours of debugging.

**Solver fuzz determinism.** Plan says 1000 fuzz boards but doesn't specify seed reproducibility. **Recommendation: every fuzz test should accept a `FUZZ_SEED` env var that defaults to a date-derived seed, but can be pinned to reproduce a failure. When test fails on board #427, output the seed so it's reproducible.**

**LLM determinism — three-layer strategy** is missing entirely from the plan:
- Layer 1 (contract, mock-based): "calling tryOnDeviceIrisLineFirst with valid opts returns a Promise that resolves to {line: string} | null." Vitest with mocks. Phase 4.
- Layer 2 (property, fixed prompts on real device): "100 fixed prompts, every output passes structural checks (1-3 sentences, no quotation marks, no schema-placeholder leak)." Manual nightly run. Phase 4.
- Layer 3 (eval, semantic quality): "200 fixed prompts, scored by a second model as judge for in-character voice." Optional, but nice. Skip for v1, add in v1.1.

**Fun verification** — plan mentions playtesters in cross-phase but no specific phase owns the playtest loop. **Recommendation: add a "Playtest 1" gate at end of Phase 4 (5 humans, one full run each, NPS) and "Playtest 2" gate at end of Phase 5 (same humans + 5 fresh, two runs each, NPS delta). NPS-drop >15 between Playtest 1 and 2 = stop and tune before Phase 6.**

**Pre-TestFlight smoke as CI gate** — plan has the smoke command in Phase 6 verification but doesn't make it a per-commit CI gate. **Recommendation: add it to a `.github/workflows/ci.yml` (or local pre-commit hook if you're not on GitHub) that runs on every push. Five lines of config; saves "did I break something" anxiety.**

**End-to-end game loop test** — "start run → clear floor 1 → die on floor 2 → assert bestFloor = 2 → start new run → escape" — currently nowhere in the plan. **Add to Phase 5 verification: one e2e Playwright test that drives the game through this exact sequence and asserts state at each step.**

---

## Cross-seat synthesis

Four lenses, four "if you only do one thing" recommendations:

| Seat | One thing |
|---|---|
| Architect | **Swap Phase 1 ↔ Phase 2** — reducers first (3 days, gives solver a test harness), then solver (7 days). Descope Web Worker to v1.1. |
| Greybeard | **Add VoiceOver overlay to Phase 3** — invisible DOM mirror of cell state. Apple will reject without it for an accessibility-conscious developer. 1-2 day cost. |
| Safety | **Add `iOS 27 kill switch` to Phase 4** — JS-side check of `/api/feature-flags` per app launch. Lets you remotely disable on-device LLM without an App Store update. 2 hours. |
| Tester | **Add the React-dedupe bundle invariant as a CI gate from Phase 1 forward** — one shell line, prevents the entire class of bug we just lived through. |

**Single overarching recommendation if you only act on one thing across all four seats:**

**Add a single CI smoke script that runs on every commit, containing:**
1. `pnpm check && pnpm test` (correctness)
2. `pnpm cap:sync:ios` (build succeeds)
3. The React-dedupe invariant grep (regression catch)
4. The AASA payload validator (manifest hasn't drifted)
5. The `registerPluginInstance` grep (native plugin still wired)

That single script — call it `scripts/smoke.sh` — turns five separate manual gates into one automated catch-all that runs every commit. Cost: ~30 lines of bash. Saves: every regression of the classes we already know about.

Build this in Phase 1 (when CI doesn't exist yet so you set it up alongside the first real test). Reference it from every subsequent phase's verification gate as "smoke.sh green is required."

---

## What this review is NOT

- Not adversarial enough — full team:cynic + team:breaker would attack harder. Re-run after May 12 to get the kill-criteria + pre-mortem reality check.
- Not informed by the actual filesystem state inside each agent — these are pattern-based critiques, not file-level audits. Real seats would Read each phase's referenced code and surface specific concerns.
- Not sourced from external CLI second opinions — earlier in session both Codex CLI and Gemini CLI weighed in on the design; they haven't seen this plan yet. Could re-dispatch via /consensus when usage caps reset.

For now, the four single-thing recommendations are the highest-leverage fixes. Apply them in Phase 0 alongside the open decisions and the rest of the plan stands.
