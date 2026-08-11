# Launch checkpoint

Gate before widening TestFlight or submitting for review.

## Automated

- [x] `scripts/smoke.sh --with-source ../hexsweeper` green
- [ ] CI green on `main`
- [x] `www/` matches the hexsweeper commit recorded in `WWW_SOURCE.txt`

## Build identity

- [ ] `CURRENT_PROJECT_VERSION` is greater than the latest uploaded build 33
- [ ] `MARKETING_VERSION` set for the intended release
- [ ] Display name reads **Hexsweeper** on the home screen
- [x] Archive signs cleanly under team `596T7J7FB6`

## Hardware

- [ ] `docs/DEVICE_VERIFY.md` completed and signed on at least two devices,
      one of them small-screen (tap-target risk)
- [ ] All gates verified **in airplane mode**

## App Store Connect

The record was inherited from a different app, but it was found **empty**
rather than contaminated — every field was null, so this was fill-in.

- [x] App name set — **Hexsweeper 3D** (`Hexsweeper` itself is taken)
- [x] Description, keywords, subtitle, and promotional text written
- [x] Screenshots — five 6.9" captures from the real build
- [x] Support, marketing and privacy policy URLs set
- [x] Age rating answered — every category NONE/false
- [x] Export compliance: `ITSAppUsesNonExemptEncryption` is `false`
- [x] Build 33 uploaded to TestFlight and processed as VALID; verify distribution status before widening access
- [x] Nothing submitted for App Review
- [ ] **Privacy nutrition labels — ASC web UI only, no API.** Select
      "Data Not Collected" for every category: the app makes no network
      requests at all and the export guard enforces that at build time.

The record was found **empty**, not filled with the retired app's content —
worth knowing if you ever inherit another bundle id this way.

Before submission, replace `02-sphere.png`: its HUD was captured mid-render and
shows “left” and “s” without their numbers.

## Licensing

- [ ] Confirm no third-party assets ship without attribution. The Earth/Moon
      daymaps are **excluded from this build** for exactly this reason; if they
      are ever reinstated, their provenance and CC-BY attribution must be
      resolved first.

## Proceed only if

Automated gates pass, hardware verification is signed, the App Store Connect
record has been fully rewritten rather than inherited, and no unattributed
third-party asset is in the binary.
