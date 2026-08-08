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

## Status (2026-08-08)

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
- [ ] App icon + splash from a live sphere render
- [ ] Simulator verification: render, touch input, safe-area insets
- [ ] Device verification (`docs/DEVICE_VERIFY.md`)
- [ ] Rename the ASC record Hivescape → Hexsweeper, **pending name availability**
- [ ] Rewrite ASC metadata: privacy labels, age rating, description, screenshots
      (all currently describe an on-device-LLM roguelike)

## Outstanding decisions

- **"Hexsweeper" may not be available on the App Store.** It is a generic
  compound and unverified. Check before building further identity around it; a
  fallback (e.g. "Hexsweeper 3D") may be needed.
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
