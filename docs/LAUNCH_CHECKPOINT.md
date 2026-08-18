# Launch checkpoint

Gate before widening TestFlight or submitting for review.

## Automated

- [x] `scripts/smoke.sh --with-source ../hexsweeper` green
- [ ] CI green on `main`
- [x] `www/` matches the hexsweeper commit recorded in `WWW_SOURCE.txt`

## Build identity

- [x] `CURRENT_PROJECT_VERSION` is 48 for the release candidate (splash + sphere-only payload + on-sphere face menu with labels + Help theme grid)
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
- [x] Description, keywords, subtitle, and promotional text rewritten 2026-08-18 for the sphere-only app
- [x] Screenshots — six 6.9" iPhone + six 13" iPad captures of the sealed sphere, uploaded 2026-08-18
- [x] Support, marketing and privacy policy URLs set
- [x] Age rating answered — every category NONE/false
- [x] Export compliance: `ITSAppUsesNonExemptEncryption` is `false`
- [x] Build 37 uploaded to TestFlight and processed as VALID; nothing submitted for review
- [x] Build 38 uploaded to TestFlight 2026-08-17 with the three-hex launcher at the root
- [x] Build 39 uploaded to TestFlight 2026-08-17: Sphere-first root, launcher behind Games, Mercury theme
- [x] Build 40 uploaded to TestFlight 2026-08-17: no launch prompt, dock first-tap fix
- [x] Build 41 uploaded to TestFlight 2026-08-18: sphere-only, corner Menu, Theme tile → Mercury, touch help sheet
- [x] Build 42 uploaded to TestFlight 2026-08-18: Stratosphere + Amber Cells themes (textures sealed), Glow out of the cycle
- [x] Build 43 uploaded to TestFlight 2026-08-18: Ion Storm replaces Amber Cells
- [x] Build 44 uploaded to TestFlight 2026-08-18: nine-theme flower cycle (Aurora, Galaxy, Gilded Ribbon, Heat Lightning added)
- [x] Build 45 uploaded 2026-08-18: sphere launch image
- [x] Build 46 uploaded 2026-08-18: flower off the sphere, no scrim blur
- [x] Build 47 uploaded 2026-08-18: menu on the sphere's faces (Face Takeover)
- [x] Build 48 uploaded 2026-08-18: face-tile labels, Help theme grid; attached to 1.0 as the release candidate
- [x] Nothing submitted for App Review
- [ ] **Privacy nutrition labels — ASC web UI only, no API.** Select
      "Data Not Collected" for every category: the app makes no network
      requests at all and the export guard enforces that at build time.

The record was found **empty**, not filled with the retired app's content —
worth knowing if you ever inherit another bundle id this way.

Screenshots (iPhone 6.9" and iPad 13") and copy were fully replaced on
2026-08-18; the mid-render `02-sphere.png` device capture is gone with them.

**What is left before Submit for Review is yours alone:** the App Privacy
labels in the ASC web UI (Data Not Collected throughout), and the Submit
button. Everything else — build, metadata, screenshots, What's New — is
staged.

## Licensing

- [ ] Confirm no third-party assets ship without attribution. The Earth/Moon
      daymaps are **excluded from this build** for exactly this reason; if they
      are ever reinstated, their provenance and CC-BY attribution must be
      resolved first.

## Proceed only if

Automated gates pass, hardware verification is signed, the App Store Connect
record has been fully rewritten rather than inherited, and no unattributed
third-party asset is in the binary.
