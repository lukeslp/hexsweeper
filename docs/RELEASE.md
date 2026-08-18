# Release

## Identity

| Thing | Value |
|---|---|
| App Store name | **Hexsweeper 3D** (`Hexsweeper` and `Hexsweep` are both taken) |
| Home-screen name | **Hexsweeper** (`CFBundleDisplayName` — independent of the listing) |
| iOS bundle id | `app.hexodus.ios` (inherited; do not "fix") |
| Android application id | `app.hexodus.ios` (shared Capacitor id; unusual but valid) |
| ASC app id | `6768871973` |
| Team | `596T7J7FB6` (Bridge City Lab LLC) |

Build numbers start at 7 — builds 1–6 belong to the retired Hivescape app on
this same record. Build 43 is the latest uploaded TestFlight build and the
checked-in project matches it.

## Archive → TestFlight

```bash
KEY=7SW49BDC79
ISS=69a6de87-19da-47e3-e053-5b8c7c11a4d1

cd ios/App
xcodebuild -project App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath ~/hexsweeper-build/Hexsweeper.xcarchive \
  -allowProvisioningUpdates \
  -authenticationKeyPath ~/.appstoreconnect/private_keys/AuthKey_$KEY.p8 \
  -authenticationKeyID $KEY -authenticationKeyIssuerID $ISS archive

xcodebuild -exportArchive \
  -archivePath ~/hexsweeper-build/Hexsweeper.xcarchive \
  -exportPath ~/hexsweeper-build/export \
  -exportOptionsPlist ~/hexsweeper-build/export.plist \
  -allowProvisioningUpdates \
  -authenticationKeyPath ~/.appstoreconnect/private_keys/AuthKey_$KEY.p8 \
  -authenticationKeyID $KEY -authenticationKeyIssuerID $ISS

xcrun altool --upload-app -f ~/hexsweeper-build/export/Hexsweeper.ipa -t ios \
  --apiKey $KEY --apiIssuer $ISS
```

**`uploadSymbols` must be `false` in the export plist.** With it enabled the
dSYM copy fails and export dies with a bare "Copy failed" — the error names no
cause, so it costs an hour if you have not seen it before. Crash reports lose
symbolication as a result; upload dSYMs separately if that matters.

## Android builds

Capacitor 8 supports API 24+. Install Node 22+, Android Studio 2025.2.1+, and
an Android SDK. The build wrapper selects JDK 21 on macOS and syncs the sealed
payload before Gradle runs:

```bash
pnpm android:build:debug       # android/app/build/outputs/apk/debug/app-debug.apk
pnpm android:bundle:release    # android/app/build/outputs/bundle/release/app-release.aab
```

Current Android identity is `versionCode 4`, `versionName 1.0-test`, targeting
API 36 with minimum API 24. The direct test APK is debug-signed with the same
certificate as builds 1–3 so testers can upgrade in place. Build 4 is published
at `https://dr.eamer.dev/downloads/apps/hexsweeper/`. The release AAB remains
deliberately unsigned. Create and
retain the Play signing key outside this repository, then use Android Studio's
**Build → Generate Signed App Bundle** for the first store upload. Do not commit
keystores, passwords, `local.properties`, APKs, or AABs.

Before Google Play staging:

- Complete the Android rows in `docs/DEVICE_VERIFY.md`, including TalkBack,
  system Back, gesture insets, rotation, and process-restart persistence.
- Run the whole app in airplane mode; any in-app network request is a defect.
- Increment `versionCode` for every upload.
- Create the Play listing and complete Data safety as **no data collected**.
- Keep login, signing, upload, pricing, testing-track selection, and publication manual.

## Listing

The record was inherited but turned out to be **empty**, not wrong — every
field was null, so this was fill-in rather than cleanup.

Done (updated 2026-08-11, through the App Store Connect API):

- [x] Name **Hexsweeper 3D** — `Hexsweeper`, `Hexsweep`, `Hex Sweeper`,
      `Hex Sweep`, `Hexasweeper`, `Hivesweeper` and `Hexhive` are all taken.
      Every bare form is gone; `Hexsweeper` + any qualifier was free.
- [x] Subtitle `Hex minesweeper, flat or round` (30/30 chars — at the limit)
- [x] Description, keywords (87/100), and promotional text
- [x] Support + marketing URLs → the live web game
- [x] Privacy policy → `privacy.html`, added to the hexsweeper repo and
      deployed to Drummer
- [x] Age rating — every content question NONE, every behaviour flag false
- [x] Screenshots — five 6.9" real-device captures (1320×2868), all COMPLETE;
      preserved rather than overwritten by the four generated alternatives
- [x] Build 8 processed, validated, and attached to the 1.0 version. Nothing
      submitted for review
- [x] Build 37 uploaded to TestFlight on 2026-08-14 and processed as VALID
- [x] Build 38 uploaded to TestFlight on 2026-08-17 (three-hex launcher root;
      vendored from hexsweeper `d1f79a4`)
- [x] Build 39 uploaded to TestFlight on 2026-08-17: the app opens straight
      into Sphere, a resume gate asks about saved runs, the three-hex launcher
      sits behind the Games pill, and Mercury ships as a sphere theme
      (vendored from hexsweeper `feab6e5`)
- [x] Build 40 uploaded to TestFlight on 2026-08-17: no resume prompt at
      launch (Sphere restores its own run), and the receded dock stays
      tappable so Undo acts on the first tap (vendored from hexsweeper
      `05ef85b`)
- [x] Build 41 uploaded to TestFlight on 2026-08-18: sphere-only payload (no
      Games pill, no launcher, no Infinite/Classic), corner Menu glyph, Theme
      tile reaching Glow and Mercury, touch-sized help sheet, larger sphere on
      phones (vendored from hexsweeper `eb7b7fa`)
- [x] Build 42 uploaded to TestFlight on 2026-08-18: Stratosphere (light) and
      Amber Cells (dark) join Mercury in the flower's theme cycle, Glow drops
      out of it; their textures are sealed into the payload (vendored from
      hexsweeper `7c241e8`)
- [x] Build 43 uploaded to TestFlight on 2026-08-18: Ion Storm replaces Amber
      Cells as the dark material (payload 679KB); confirm distribution state in
      App Store Connect before widening access

Still owed:

- [ ] **App Privacy nutrition labels — must be done in the ASC web UI.** The
      API has no endpoint for them (`appPrivacyDetails` → "URL path is not
      valid"). Answer: no data collected, of any kind.
- [ ] `docs/DEVICE_VERIFY.md` signed on hardware
- [ ] **iPad screenshots (2064×2752) — blocker.** The app ships
      `TARGETED_DEVICE_FAMILY = "1,2"`, and ASC rejects an iPad-supporting
      listing that carries only iPhone screenshots. Generate with
      `python3 scripts/generate-store-screenshots.py --ipad`, or drop iPad
      support and ship iPhone-only. Set type is `APP_IPAD_PRO_3GEN_129`.
- [ ] Decide whether the generated composites replace the ASC device captures.
      The **device capture** called `02-sphere.png` lives only in ASC, not in
      this repo, and is the one that caught the HUD mid-render showing “left”
      and “s” without their numbers. The repo's `02-sphere-ink.png` is a
      different, captioned composite with no HUD and is unaffected.

Export compliance is already answered: `ITSAppUsesNonExemptEncryption = false`.

### Screenshot capture

The base iPhone 17 sim is 1206×2868 — **not** an accepted size. Create a Pro
Max, which is exactly the 6.9" requirement:

```bash
xcrun simctl create "Shots" com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max \
  com.apple.CoreSimulator.SimRuntime.iOS-26-5
xcrun simctl io <udid> screenshot shot.png      # 1320x2868
```

Upload is a three-step dance per image: reserve (`POST /v1/appScreenshots`),
PUT each `uploadOperations` chunk, then commit with the file's **MD5** in
`sourceFileChecksum`. Set type `APP_IPHONE_67` covers 6.9".
