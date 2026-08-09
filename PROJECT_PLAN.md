# Hexsweeper (iOS) — project plan

## Objective

Ship hexsweeper's 3D sphere minesweeper as a native iOS app: a thin Capacitor
shell around a sealed, offline Canvas game, reusing the App Store Connect record
already held under `app.hexodus.ios`.

## Architecture

Prebuilt payload, not a build. `www/index.html` arrives fully inlined from
hexsweeper's `export-collection.py --app`; this repo adds only the native shell.
That keeps the game single-source in hexsweeper and this repo dependency-light
(4 runtime packages).

## Status (2026-08-09)

- [x] Retired the previous product here: React client, Foundation Models bridge,
      `iris` antagonist, and the React/Radix/Tailwind toolchain all removed
- [x] `FoundationModelsPlugin.swift` + `AppViewController.swift` deleted;
      `Main.storyboard` back to stock `CAPBridgeViewController`
- [x] `www/` vendored from hexsweeper `6704bca`, provenance in `WWW_SOURCE.txt`
- [x] Display name / `PRODUCT_NAME` → Hexsweeper; bundle id retained
- [x] `CURRENT_PROJECT_VERSION` 1 → 7 (ASC holds builds 1–6)
- [x] `capacitor.config` → `.js`; `CapacitorHttp` dropped; payload proven to make
      no network calls
- [x] Smoke gates rewritten: payload checksum integrity + `cap sync`, plus an
      optional cross-repo gate that regenerates from hexsweeper and diffs
- [x] CI checks out public `lukeslp/hexsweeper` and runs the cross-repo gate
- [x] App icon + splash from a live sphere render
- [x] Simulator verification (iPhone 17, iOS 26.5): builds clean with zero
      warnings, launches, sphere renders, tap digs and flood-reveals, drag
      tumbles the camera without stray digs and without losing the run, the
      Customize panel opens and steps themes live
- [x] Fixed via simulator: HUD drew on top of the status bar because the
      viewport meta lacked `viewport-fit=cover`, so every
      `env(safe-area-inset-*)` resolved to 0 (hexsweeper `5a363f5`)
- [x] ASC record renamed — `Hexsweeper` was taken, so the listing is
      **Hexsweeper 3D**; the home screen still reads Hexsweeper
- [x] Listing filled in: subtitle, description, keywords, support/marketing
      URLs, privacy policy, age rating, five 6.9" screenshots. The record was
      **empty**, not contaminated — every field was null
- [x] **First TestFlight build up: 1.0 (7), VALID, IN_BETA_TESTING**
- [ ] App Privacy nutrition labels — no API endpoint, must be clicked through
      in the ASC web UI. Answer is "Data Not Collected" throughout
- [ ] Device verification (`docs/DEVICE_VERIFY.md`) — tap-target size at XL is
      the gate most likely to fail
- [ ] Better screenshots before any real launch push; the current five are
      correctly sized but sparse

## Outstanding decisions

- **Name is settled: the listing is "Hexsweeper 3D".** Every bare form is
  taken — `Hexsweeper`, `Hexsweep`, `Hex Sweeper`, `Hex Sweep`, `Hexasweeper`,
  `Hivesweeper`, `Hexhive` — but `Hexsweeper` plus any qualifier was free.
  `CFBundleDisplayName` stays `Hexsweeper`, so the home screen is unaffected.
- **Tap-target size is unmeasured.** `pickTile` does exact polygon hit-testing
  with no hit-radius padding. The XL board is 2252 faces; on a phone those cells
  may be too small to tap reliably. Consider capping board size on small screens.

## Risks

- The payload is a pinned copy. Sphere fixes do not reach players until someone
  re-vendors; CI catches divergence but only once hexsweeper's change is pushed.
- Bundle id and product name will never match. Documented in README and AGENTS;
  do not let a future cleanup "fix" it.

## Acceptance

Game renders and is playable in the native shell with no network; dig, flag,
chord, and camera drag all work by touch; safe-area insets respected on a
notched device; launch screen hands off to the first painted frame without a
blank gap; smoke gates green; build number exceeds 6.
