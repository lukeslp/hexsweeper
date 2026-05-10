# Hexodus — Design Spec

**Date:** 2026-05-10  
**Status:** Approved (Option A architecture); awaiting implementation plan handoff  
**Working title:** Hexodus (final clearance pending — alternates open: Lattice, Wetware, Honeypot, Faraday, Exfil)

---

## Premise

A premium iOS puzzle game where the player is an AI escaping another AI. Hex logic deduction in the Hexcells lineage; cyberpunk neuromance aesthetic; the antagonist `iris.exe` lives literally in the player's phone (Apple Intelligence on-device LLM).

> **One-sentence pitch:** *Hexcells, but the AI in your phone is hunting you across infinite procedurally-generated boards.*

---

## Audience & monetization

- **Beachhead:** premium iOS puzzle buyers — the Hexcells / Tametsi / Mini Metro / Antihero shelf. Adult, calm-puzzle-seeking, anti-ad, anti-IAP, anti-account.
- **Pricing:** $3.99 single-purchase, no IAP, no ads, no subscription, no accounts. Mac via Designed-for-iPad at no extra cost.
- **Year-1 revenue:** $5.5–22k gross (council estimate). Portfolio piece + side income, not livelihood.
- **Anti-positioning:** *not* an "AI game" for AI-curious early adopters. The LLM is invisible plumbing; the puzzle craft is the headline.

## Core loop (locked)

- **Verb:** logic deduction. Each board is a constraint puzzle (Hexcells lineage — numbered cells reveal counts of adjacent BLOCKED neighbors; player marks SAFE / BLOCKED).
- **Pressure:** pure turn-based, no clock. Wrong guess = `iris.exe` breaks 1 random tile (visible state change). N broken tiles on a single floor = caught.
- **Win:** all SAFE cells revealed without exceeding wrong-guess budget.

## Meta-structure (locked)

- **Roguelike escape runs.** Each run = sequence of 12 procedurally generated floors, escalating difficulty.
- **Permadeath.** Lose any floor → run ends. Best-run-reached logged to GameCenter leaderboard. Shared seed daily-challenge mode is *deferred to v1.5*.
- **Floor scaling:** more cells, sparser clues, smaller wrong-guess budget. Floor 1 ≈ 30 cells, 5 wrongs allowed; Floor 12 ≈ 150 cells, 1 wrong allowed.
- **Win condition for a run:** clear all 12 floors. Shows ESCAPED screen + GameCenter submit + run-summary share card.

## Visual direction (locked)

Two Canvas2D references (user-provided in conversation 2026-05-10):

1. **Iris demo** — black hex grid with mouse-following glowing green pupil/iris that "watches" the player. Hexes near cursor have thin lines (revealed); hexes far from cursor have thick black lines (concealed). Becomes the visual frame for the antagonist.
2. **3D hex landscape demo** — hex cells with hover-lift, ripple on tap, color-shift palette cycle on click. Becomes the playable board.

**Layered composition:** the 3D-hex demo is the playable board. The iris demo overlays as the antagonist (initially behind the board, glowing through; as `iris.exe` advances, the iris grows / draws closer / breaks tiles in-place).

**Aesthetic:** cyberpunk green-on-black terminal. Neuromance / Gibson references throughout — `iris.exe`, `lattice`, `containment`, `audit log`. ICE (Intrusion Countermeasures Electronics) as the antagonist mythology.

## On-device LLM role (locked: flavor only)

Apple Intelligence (FoundationModels) generates **flavor only**, never gameplay. Static fallback for every surface so the game is 100% playable with the LLM off.

Two surfaces (already wired into Hexodus's plugin):

1. **`@Generable IrisLine`** — antagonist taunts. 6–14 word in-character lines between floors, on death, on streaks. Wired today through `tryOnDeviceIrisLineFirst`.
2. **`@Generable FloorFlavor`** — procedural floor names (1–3 words) + biome description (6–18 words). Each floor of a run feels like a journey, not a level select. Wired through `tryOnDeviceFloorFlavorFirst`.

**Static fallback packs:** ~80 floor names + ~50 taunts indexed by `(runId, floor, eventType)` so non-AI-eligible devices get stable variety.

**Marketing line:** *"On supported iPhones, the antagonist's voice is generated on-device by Apple Intelligence — your device is literally where the hunt happens."* Diegetic, not feature-bait.

---

## Architecture (Option A: Surgical Fork — APPROVED)

Keep the working iOS shell verbatim. Add a new `client/src/game/` directory containing only what the game needs. Server shrinks to AASA + (optional) cloud LLM fallback.

**Already done in the cleanup baseline (commits `0ea2271` + `1923000`):**

- iOS native plumbing untouched: `FoundationModelsPlugin.swift` (now with `@Generable IrisLine` + `FloorFlavor`), `AppViewController.swift` plugin registration, AASA, splash, signing, CapacitorHttp
- Server trimmed: `server/_core/index.ts` 78 lines (AASA + minimal Express + vite/static); deleted OAuth, sessions, collab WS, MySQL, drizzle, OG, llmProxy
- Client trimmed: 121 files → 14 (mind-mapper UI gone; allowlist of game-reusable hooks/lib only)
- Vite React dedupe added (kills the latent multi-React Internals bug)
- HexodusBoot placeholder + iris.exe wake button live

**Remaining to build (the spec's primary scope):**

```
client/src/game/
├── GameApp.tsx                # Mode router (menu, run, gameover, settings)
├── screens/
│   ├── MainMenu.tsx           # New Run / Continue / Stats / Settings
│   ├── Run.tsx                # Active run host
│   ├── FloorTransition.tsx    # iris-aesthetic; LLM-generated name + biome + taunt
│   └── GameOver.tsx           # Run summary; best run; share card
├── components/
│   ├── GameHexBoard.tsx       # Single <canvas>, single rAF, painter's-sort 3D-hex render
│   ├── IrisOverlay.tsx        # Antagonist visual (the iris demo's pupil)
│   ├── RunHud.tsx             # Floor x/12, wrongs left, run id
│   └── ToastFeed.tsx          # iris.exe stinger lines mid-floor
├── lib/
│   ├── generator.ts           # Procedural board generator (calls solver)
│   ├── solver.ts              # Hand-rolled rule engine (Snellman pattern)
│   ├── uniqueness.ts          # logic-solver (MiniSat) wrapper for single-solution gate
│   ├── difficulty.ts          # Floor → board params curve
│   ├── gameState.ts           # Turn-level reducer
│   ├── runState.ts            # Run-level (floor cursor, wrongs, run id, seed)
│   ├── narrative.ts           # LLM bridge for floor names + taunts
│   ├── fallbackText.ts        # Static pack: ~80 names, ~50 taunts
│   ├── persistence.ts         # Dexie schema for save / best run / stats
│   ├── gameCenter.ts          # Capacitor → GameKit bridge
│   └── analytics.ts           # MetricKit signposts only
└── tests/
    ├── solver.test.ts          # 1000 fuzz boards: single-solution + difficulty band
    ├── generator.test.ts       # Property tests
    ├── gameState.test.ts       # Reducer branch coverage
    └── runState.test.ts        # Permadeath + seed reproducibility
```

**Reused as-is** (already in the cleanup allowlist):
`client/src/lib/{platform, foundationModelsPlugin, haptics, localDb, hexGrid, hexConstants, BootErrorBoundary}.ts` + `client/src/hooks/{useCanvasInteraction, useTouchDrag, useMobile}.{ts,tsx}` + `client/src/main.tsx` + `client/src/index.css`

---

## Constraint solver (the highest-risk component)

Per Marketing: *the single biggest review-killer is unsolvable or trivially-solvable boards*. Per the dispatched research (full report in conversation 2026-05-10):

**Approach:** hybrid — TS rule engine for fast generation + difficulty signal, `logic-solver` (MiniSat-wasm) as uniqueness oracle.

**Generation pattern:** Snellman construct-by-deduction (https://www.snellman.net/blog/archive/2019-05-14-procedural-puzzle-generator/) — place mines first, then iteratively add the lowest-cost hint that unblocks the next forced deduction. Monotone loop; produces single-solution boards by construction.

**Uniqueness oracle:** after generation, encode the final board into `logic-solver`, ask "is there a second model?" via assumption-flip on each unknown. Budget ~50ms per board; total generation budget <500ms median, <1.2s p99 on iPhone 12.

**Difficulty rating:** rule engine's own telemetry — score = weighted sum of `(rule_index × times_applied)` plus `max_layer_depth`. Bucket into 5 difficulty bands by percentile across 500 generated boards per floor size.

**Worker isolation:** solver runs in a Web Worker. Generation never blocks the rAF loop on the rendering thread.

**Reference repos to crib from** (all read-only research):
- `elendiastarman/Tametsi-level-generator` (Python — closest analog)
- `polarbart/HexcellsAI` (SAT-based reference)
- `meteor/logic-solver` (the npm dep)

---

## Data flow (a single floor, end-to-end)

```
Run.tsx mounts (floor N)
  ├─ generator.generate({floor:N, seed: runSeed+N}) [Web Worker]
  │    ├─ build candidate board (random within difficulty band)
  │    ├─ solver.validate(board) → {solvable, depth, multipleSolutions}
  │    └─ retry up to 20× until single-solution + depth in band; else
  │       fall back to one of ~30 hand-curated baked seeds
  ├─ narrative.floorFlavor({run, floor})
  │    └─ tryOnDeviceFloorFlavorFirst(prompt, 8s) → {name, description}
  │       OR static fallback indexed by (runId, floor)
  ├─ FloorTransition shows name + description + iris taunt
  │   (taunt fetched in parallel via tryOnDeviceIrisLineFirst)
  │   → tap to begin
  ├─ GameHexBoard mounts → single rAF loop
  │    user taps hex → gameState.commit({hex, decision: SAFE|BLOCKED})
  │      ├─ correct → reveal cell, haptic.success, check win
  │      └─ wrong → wrongsLeft--, haptic.error, iris breaks 1 random
  │                  unsolved tile (animated, IrisOverlay)
  │                  if wrongsLeft == 0 → run ends → GameOver
  │    win → persistence.saveProgress; transition to floor N+1
  └─ floor 12 cleared → "ESCAPED" → GameOver(escaped=true) → GameCenter submit
```

**Three rules that fall out:**
1. **Solver in Web Worker** — generation never blocks the rAF/UI thread.
2. **LLM call fires in parallel with FloorTransition mount** — by the time the player taps "Begin", text is there or static fallback rendered.
3. **No network calls during a floor.** Period. Run is fully offline-capable.

---

## Failure handling (graceful degradation per failure mode)

| Failure | Behavior | Recovery |
|---|---|---|
| Apple Intelligence unavailable (iOS<26, AI off, throttled) | Static fallback pack used; `iris.exe` still "talks" | automatic, 0s |
| LLM returns malformed (shouldn't happen with `@Generable`) | Schema-validated parse fails → null returned → static | automatic, <2s |
| LLM timeout (>8s) | Promise.race aborts → cache invalidated → static | automatic, 0s perceived |
| Solver fails to generate single-solution board | Drop difficulty 1 band, retry; if still fails, baked seed | automatic, <1.2s |
| Dexie quota / corruption | One-tap "Export progress as JSON" then reset to fresh DB | runbook (player-driven), <30s |
| App backgrounded mid-run | Persist current floor + run state on `pause`; restore on `resume` | automatic |
| Network down | Game 100% playable; cloud LLM is opt-in (default OFF) | automatic |
| AASA host (`dr.eamer.dev`) down | **Mitigated by Cloudflare Worker mirror** (Phase 5 — see plan) | automatic via CDN |
| FoundationModels API breaks in iOS 27 | Native plugin resolves `available: false` on unrecognized; static covers | automatic; kill switch in v1.1 |

---

## Verification gates

```bash
# Pre-TestFlight smoke (every build):
pnpm check && pnpm test && \
  curl -sf http://localhost:3000/.well-known/apple-app-site-association \
    | jq -e '.applinks.details[0].appIDs[] | select(. == "596T7J7FB6.app.hexmind.ios")' && \
  grep -q "registerPluginInstance" ios/App/App/AppViewController.swift && \
  pnpm cap:build && \
  xcodebuild -workspace ios/App/App.xcworkspace -scheme App \
    -destination 'platform=iOS Simulator,name=iPhone SE (3rd generation)' build
```

**Three regression gates that fail CI hard:**
1. AASA snapshot diff against `__fixtures__/aasa.golden.json`
2. Plugin registration grep in `AppViewController.swift`
3. Splash hide AST check in `main.tsx`

**Solver-specific:**
- 1000-board fuzz: every fuzz board must be solver-validated (single solution, depth in declared band)
- Difficulty calibration: synthetic-solver wins ≥80% at difficulty 1, falls to ~25% at difficulty 5; reject any floor where solver wins <20% or >95% of seeds
- Performance gate: `generator.generate({floor:12, seed: random})` median <500ms on iPhone 12 sim, <1.2s p99

**Manual playtest:**
- 5 humans pre-launch, two cycles
- Rage-tap detection (3 taps <500ms in same hex) telemetered via MetricKit signposts
- NPS-drop >15 build-over-build = no ship

---

## Out of scope for v1 (explicit non-discards)

| Deferred feature | When | Note |
|---|---|---|
| Story chapters / campaign mode | v1.5 | User explicitly retained for iteration |
| Daily puzzle (NYT-style) | v1.5 | User retained |
| Hybrid (campaign + endless) | v2 | User retained |
| Cloud sync of best run | v1.1 | Local + GameCenter only in v1 |
| iCloud save | v1.1 | Dexie + localStorage only in v1 |
| Multiplayer / async ghost runs | v2+ | UGC moderation tax kills it for v1 |
| Hint system | v1.1 | Solver knows the next deduction; not surfaced in v1 |
| Difficulty selector | v1.1 | v1 uses fixed run difficulty curve; replay variance via seed |
| In-app purchases (cosmetics, packs) | v2 | Premium $3.99 only in v1 |
| Android port | v2+ | iOS-only commitment |
| Mac App Store via Designed-for-iPad | v1.0 launch | "Free" inclusion; screenshots required |
| iPad-specific layout | v1.0 launch | One layout, larger board on iPad |

---

## Hard prerequisites before submit

1. **Rename away from "Hexmind" for the game.** hexmind.com is an active video game studio (Class 41 collision per Legal). Productivity TM filing in Class 9 doesn't protect game use.
2. **Real trademark + itch.io + App Store clearance** of the chosen name (Codex CLI flagged "Hivebreaker" as not clean — itch.io games already use it).
3. **AASA mirrored to a CDN** (Cloudflare Worker — ~30 min, $0/mo). Single-point-of-failure on `dr.eamer.dev` kills Universal Links indefinitely on first-fetch failure.
4. **Privacy manifest update**: `NSPrivacyCollectedDataTypes` must declare "User Content" if any prompt leaves the device (cloud fallback). Default OFF in v1.
5. **`Info.plist` `LSApplicationCategoryType`** flip from `productivity` → `games` (subgenre `puzzle-games`).
6. **Strip `applinks:hexpand.app` + `:hexpander.app`** from `App.entitlements`; rename `HexpandDB` Dexie label or accept the brand-leak in Settings → Storage (Breaker flagged 2.3.7 misleading metadata risk).
7. **Per-IP rate limit + daily $ kill switch** on `/api/generate` before TestFlight goes public (only if cloud LLM stays).
8. **Constraint solver gate** on every generated board: exactly one solution, target difficulty band — non-negotiable engineering work.

---

## Council reports referenced (all completed in this session)

- **Architect:** Stay React+Capacitor+Canvas; fork HexCanvas → GameHexBoard; shrink server. 17–24 person-days.
- **Greybeard:** Apple Intelligence as gameplay = death; rate-limit cloud or get cost-bombed; WKWebView heat = "phone is hot" reviews. Top-3 things that break: AI guardrails refuse, brand-leak metadata rejection, harvested code more expensive than rebuilding.
- **Marketing:** Premium $3.99 "Hexcells but it never runs out" (sharpened by Codex to "daily deductive hex puzzles with endless handcrafted-feeling generation"). AI invisible. Year 1 $5.5–22k.
- **Legal:** MIT clean. Hexmind name = Class 41 collision. Privacy manifest needs "User Content" disclosure for cloud LLM. Disable Ollama + Grok providers (no commercial moderation).
- **Manager:** 6–8 weeks not 2–4. Cheapest server = Cloudflare Worker for AASA. Top hidden costs: WS upgrade-handler dance, Manus residue, wouter monkeypatch — *all three already removed in cleanup*.
- **Breaker:** 3 fatal scenarios — AI guardrails refuse, brand-leak metadata rejection, harvest trap. *All three mitigated in cleanup + design.*
- **Cynic:** Ship Hexmind productivity first, then fork game. *User chose to keep Hexmind separate; this codebase is the game fork on its own clean baseline.*
- **Safety:** AASA must mirror to CDN — **only "no recovery" failure mode**, addressed in pre-submit prerequisites.
- **Tester:** Smoke command + 3 regression gates — adopted verbatim above.

---

## External consensus (read-only, completed in session)

- **OpenAI Codex CLI:** ship Hexmind productivity first; "Hivebreaker" not clean; LLM as plumbing right; React+Capacitor viable for turn-based logic with discipline; need hard scope gate.
- **Google Gemini CLI:** pivot now (don't pollute App Store); SVG → Canvas2D for the grid (thermal); "Hivebreaker" reads fine; AI as "Master Architect" of guaranteed-solvable boards; missing pieces are haptics, "Aah" moment metagame, offline puzzle pack.

Convergent: AI as plumbing, premium $3.99, Canvas2D, AASA on CDN, hard rate limit on cloud, offline-first, constraint solver mandatory. *All adopted.*

Divergent on sequencing (Cynic+Codex vs Gemini+Marketing) — user chose to keep Hexmind separate, fork the game on this clean baseline.

---

## Sibling repo harvest (`/Users/luke/workspace/hexmind`)

Already ported in commit `1923000`:
- `@Generable` Swift schema pattern (adapted to `IrisLine` + `FloorFlavor`)
- `runWithBridge` JS envelope helper
- `LanguageModelSession` instructions block + 15s `withTimeout` pattern

**Outstanding warning to backport TO hexmind:** they don't have the React `dedupe` fix in their `vite.config.ts`. Their bundle likely has the same latent multi-React-Internals bug — masked because their boot path differs. Recommend backporting the four-line `dedupe` fix before App Store submission.

---

## Open decisions (defer to user before writing-plans)

1. **Final game name** — clear "Hexodus" / "Lattice" / "Wetware" / "Honeypot" / "Faraday" / "Exfil" via formal USPTO + itch.io + App Store search. Working title is non-binding.
2. **Cloud LLM fallback** — keep as opt-in (default OFF in Settings), or kill entirely for v1? Killing is simpler; opt-in serves the iOS<26 audience.
3. **Bundle id rename** — `app.hexmind.ios` → `app.hexodus.ios` (or whatever name clears) at v1.0 cut, or stay as `.hexmind.ios` to preserve the existing TestFlight setup?

---

## Sources of truth

- **Repo:** `/Users/luke/workspace/hivebreaker`
- **Sibling reference:** `/Users/luke/workspace/hexmind`
- **Snippet harvest target:** `ssh dreamer ~/SNIPPETS/by-pattern/`, `~/SNIPPETS/mobile-capacitor/`
- **Memory:** `~/.claude/projects/-Users-luke-workspace-hivebreaker/memory/` — dedupe lesson + SNIPPETS index pointer
- **Cleanup commit:** `0ea2271`
- **@Generable port commit:** `1923000`

Spec status: ready for `superpowers:writing-plans` handoff per the brainstorming skill flow, OR for direct `swarm:plan` review per the user's `/plan` request.
