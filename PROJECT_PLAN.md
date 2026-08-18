# Hexsweeper (iOS + Android) — project plan

## Objective

Ship Hexsweeper's Infinite, Classic, and Sphere boards as native iOS and Android
apps: a thin Capacitor shell around a sealed, offline Canvas payload, reusing
the App Store Connect record already held under `app.hexodus.ios`.

## Architecture

Prebuilt payload, not a build. `www/index.html` (Sphere)
and `www/games/*` arrive fully inlined from hexsweeper's
`export-collection.py --app`; this repo adds only the native shell.
That keeps the game single-source in hexsweeper and this repo dependency-light
(4 runtime packages).

## Status (2026-08-10)

- [x] Retired the previous product here: React client, Foundation Models bridge,
      `iris` antagonist, and the React/Radix/Tailwind toolchain all removed
- [x] `FoundationModelsPlugin.swift` + `AppViewController.swift` deleted;
      `Main.storyboard` back to stock `CAPBridgeViewController`
- [x] `www/` vendored from hexsweeper `0db0f2b`, provenance in `WWW_SOURCE.txt`
- [x] Display name / `PRODUCT_NAME` → Hexsweeper; bundle id retained
- [x] `CURRENT_PROJECT_VERSION` 1 → 9 (ASC holds builds 1–6; build 7 was the
      first TestFlight binary, build 8 is attached to 1.0, and build 9 carries
      the centered app launcher)
- [x] `capacitor.config` → `.js`; `CapacitorHttp` dropped; payload proven to make
      no network calls
- [x] Smoke gates rewritten: payload checksum integrity + `cap sync`, plus an
      optional cross-repo gate that regenerates from hexsweeper and diffs
- [x] CI checks out public `lukeslp/hexsweeper` and runs the cross-repo gate
- [x] Light, dark, and tinted app icons generated from a real played board;
      splash remains sourced from a live sphere render
- [x] Simulator verification (iPhone 17, iOS 26.5): builds clean with zero
      warnings, launches, sphere renders, tap digs and flood-reveals, drag
      tumbles the camera without stray digs and without losing the run, the
      Customize panel opens and steps themes live
- [x] Fixed via simulator: HUD drew on top of the status bar because the
      viewport meta lacked `viewport-fit=cover`, so every
      `env(safe-area-inset-*)` resolved to 0 (hexsweeper `5a363f5`)
- [x] ASC record renamed — `Hexsweeper` was taken, so the listing is
      **Hexsweeper 3D**; the home screen still reads Hexsweeper
- [x] Listing filled in: subtitle, description, keywords, promotional text,
      support/marketing URLs, privacy policy, and age rating
- [x] Five existing real-device 6.9" screenshots preserved. Four generated
      alternatives and their reproducible pipeline are committed, but were not
      uploaded over the device captures
- [x] **Release candidate attached: 1.0 (8), VALID**; nothing submitted for review
- [x] **TestFlight through 1.0 (33)**, CI green on every push
- [x] Launcher auto-digs a safe opening into clearly labeled Infinite,
      Classic, and Sphere choices with Endless, Fixed, and 3D qualifiers
- [x] Android native build added (`versionCode 1`, unsigned, never uploaded)
- [x] Screenshot pipeline parameterised per device family (2026-08-11);
      `05-picker` generated, closing the set the script always declared
- [ ] **iPad screenshots (2064×2752) — submission blocker.**
      `TARGETED_DEVICE_FAMILY = "1,2"` claims iPad support, and App Store
      Connect rejects an iPad-supporting listing that carries only iPhone
      screenshots. Either generate the set
      (`python3 scripts/generate-store-screenshots.py --ipad`) **or** drop to
      `TARGETED_DEVICE_FAMILY = 1` and ship iPhone-only. Not previously tracked
      anywhere.
- [ ] App Privacy nutrition labels — no API endpoint, must be clicked through
      in the ASC web UI. Answer is "Data Not Collected" throughout
- [ ] Device verification (`docs/DEVICE_VERIFY.md`) — 21 gates, none filled in
- [ ] Capacitor 8.3.1 → 8.5.0 available (splash-screen 8.0.1 → 8.0.2). Minor
      bump; regenerates native projects, so it wants its own build + smoke run

### Screenshot pipeline: what it can and cannot do

Verified 2026-08-11. Every render is a ~2-minute headless-Chrome gamble against
a fixed `--virtual-time-budget`, with no signal that the page has actually
settled. Consequences, all reproduced:

- **Sphere shots render reliably.** Both iPhone and iPad sets come from these.
- **`infinite.html` now times out** (120s × 2 attempts) under payload
  `466709c`. The committed phone shots were rendered 2026-08-10 against
  `0db0f2b`, so this is a regression in renderability, not a config problem.
  `bounded.html` is untested since the run never reaches it.
- **`05-picker` has never rendered at all** — the opening auto-dig never
  settles.
- **A faint `?` (`#help-btn`) survives into every sphere shot.** CSS
  `display:none !important` does not suppress it, and `crop_to_sphere` then
  widens the crop box to include it. Removing the node in JS *does* clear it
  but stops the page settling, so the render times out — strictly worse. Left
  in deliberately; a slightly blemished screenshot beats none.

The real fix is settle-detection — wait on a concrete DOM or canvas signal
instead of a fixed time budget — which would likely unblock the flat games and
the picker together. Until then, treat asset regeneration as unreliable and
never delete a good screenshot before its replacement exists.

### Screenshot naming, clarified

The repo holds **generated marketing shots** — `01-sphere-shell`,
`02-sphere-ink`, `03-infinite`, `04-bounded`, `05-picker` — all captioned
composites at 1320×2868. The **device captures uploaded to ASC are a separate,
older set that does not live in this repo.** The long-standing "re-shoot
`02-sphere.png`" note refers to one of *those*, not to `02-sphere-ink.png`
here, which has no HUD at all and is fine. Whether to replace the ASC device
captures with these generated ones is still an open call.

## Outstanding decisions

- **Name is settled: the listing is "Hexsweeper 3D".** Every bare form is
  taken — `Hexsweeper`, `Hexsweep`, `Hex Sweeper`, `Hex Sweep`, `Hexasweeper`,
  `Hivesweeper`, `Hexhive` — but `Hexsweeper` plus any qualifier was free.
  `CFBundleDisplayName` stays `Hexsweeper`, so the home screen is unaffected.
- **Tap-target size is unmeasured.** `pickTile` does exact polygon hit-testing
  with no hit-radius padding. The XL board is 2252 faces; on a phone those cells
  may be too small to tap reliably. Consider capping board size on small screens.

## Risks

- The payload is a pinned copy. Game fixes do not reach players until someone
  re-vendors; CI catches divergence but only once hexsweeper's change is pushed.
- Bundle id and product name will never match. Documented in README and AGENTS;
  do not let a future cleanup "fix" it.

## Acceptance

Launcher and all three games render and are playable in the native shell with no
network; dig, flag, chord, pan, and camera drag work by touch where applicable;
safe-area insets are respected on a notched device; launch screen hands off to
the first painted frame without a blank gap; smoke gates are green; build
number exceeds the latest uploaded build.
