# Hexsweeper (iOS + Android) — project plan

## Objective

Ship Hexsweeper's sphere board as native iOS and Android apps: a thin
Capacitor shell around a sealed, offline Canvas + WebGL payload, reusing
the App Store Connect record already held under `app.hexodus.ios`.

## Architecture

Prebuilt payload, not a build. `www/index.html` (the sphere, sealed) arrives
fully inlined from hexsweeper's `export-collection.py --app`; this repo adds
only the native shell. Infinite, Classic, and the launcher left the payload
on 2026-08-17 (sphere-only front door). `www/wheel.html` joined on
2026-08-18: the Water Wheel sealed the same way, reachable only by holding
the mine count on the sphere.
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
- [x] Optimized the signed Amazon Fire-tablet build's 2,252-face XL board:
      `1.0.3 (28)` cleared direct rotation at 10 ms median portrait / 7 ms
      landscape, then its long soak exposed a separate 53 ms idle-spin path;
      `1.0.4 (29)` moves ambient rotation onto the compact renderer, parks
      static frames, and passes final stress at 13 ms median / 18 ms p90
- [x] Screenshot pipeline parameterised per device family (2026-08-11);
      `05-picker` generated, closing the set the script always declared
- [x] iPad screenshots (2064×2752) generated and uploaded 2026-08-18 alongside a
      new 6.9" iPhone set — six per family, real captures of the sealed sphere
      (`scripts/store-shots.mjs` + `scripts/generate-store-screenshots.py`)
- [ ] App Privacy nutrition labels — no API endpoint, must be clicked through
      in the ASC web UI. Answer is "Data Not Collected" throughout
- [ ] Device verification (`docs/DEVICE_VERIFY.md`) — 21 gates, none filled in
- [ ] Capacitor 8.3.1 → 8.5.0 available (splash-screen 8.0.1 → 8.0.2). Minor
      bump; regenerates native projects, so it wants its own build + smoke run

### Screenshot pipeline (rewritten 2026-08-18)

`scripts/store-shots.mjs` boots the sealed `www/index.html` in headless Chrome
with SwiftShader WebGL at exact device metrics (6.9" iPhone 440×956@3,
13" iPad 1032×1376@2), seeds a deterministic mid-game (mines, a connected dug
patch, a few flags, a fixed rotation) per shot, sets the theme, and captures the
full frame — the flower shot opens the menu first. `generate-store-screenshots.py`
runs it per family and lays a Futura Bold caption band over the empty field
above the sphere. Every pixel is the shipped game; nothing is mocked. The old
square-render + virtual-time approach and its timeouts are gone. Toasts and
live regions are hidden by injected CSS so stills stay clean. `--recompose`
re-captions existing raws without re-rendering.

Shots: 01 Mercury (hero) · 02 Stratosphere · 03 Light with the flower open ·
04 Ion Storm · 05 Heat Lightning · 06 Dark. Same set for both families.
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

The sphere renders and is playable in the native shell with no
network; the corner Menu opens the flower and its Theme tile reaches Mercury; dig, flag, chord, pan, and camera drag work by touch where applicable;
safe-area insets are respected on a notched device; launch screen hands off to
the first painted frame without a blank gap; smoke gates are green; build
number exceeds the latest uploaded build.
