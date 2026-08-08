# Launch checkpoint

Gate before widening TestFlight or submitting for review.

## Automated

- [ ] `scripts/smoke.sh --with-source ../hexsweeper` green
- [ ] CI green on `main`
- [ ] `www/` matches the hexsweeper commit recorded in `WWW_SOURCE.txt`

## Build identity

- [ ] `CURRENT_PROJECT_VERSION` exceeds every build in App Store Connect (≥7)
- [ ] `MARKETING_VERSION` set for the intended release
- [ ] Display name reads **Hexsweeper** on the home screen
- [ ] Archive signs cleanly under team `596T7J7FB6`

## Hardware

- [ ] `docs/DEVICE_VERIFY.md` completed and signed on at least two devices,
      one of them small-screen (tap-target risk)
- [ ] All gates verified **in airplane mode**

## App Store Connect — inherited record, needs a full rewrite

This record was created for a different app. Nothing on it can be assumed
correct.

- [ ] App name changed from "Hivescape" to the final name
- [ ] **Name availability confirmed** — "Hexsweeper" is unverified and generic
- [ ] Privacy nutrition labels rewritten (previous entries described on-device
      LLM use; this build collects nothing and makes no network calls)
- [ ] Age rating re-answered
- [ ] Description, keywords, subtitle rewritten
- [ ] Screenshots replaced — any existing ones show the old game
- [ ] Support and marketing URLs point at Hexsweeper
- [ ] Export compliance: `ITSAppUsesNonExemptEncryption` is already `false`

## Licensing

- [ ] Confirm no third-party assets ship without attribution. The Earth/Moon
      daymaps are **excluded from this build** for exactly this reason; if they
      are ever reinstated, their provenance and CC-BY attribution must be
      resolved first.

## Proceed only if

Automated gates pass, hardware verification is signed, the App Store Connect
record has been fully rewritten rather than inherited, and no unattributed
third-party asset is in the binary.
