# Release

## Identity

| Thing | Value |
|---|---|
| App Store name | **Hexsweeper 3D** (`Hexsweeper` and `Hexsweep` are both taken) |
| Home-screen name | **Hexsweeper** (`CFBundleDisplayName` — independent of the listing) |
| Bundle id | `app.hexodus.ios` (inherited; do not "fix") |
| ASC app id | `6768871973` |
| Team | `596T7J7FB6` (Bridge City Lab LLC) |

Build numbers start at 7 — builds 1–6 belong to the retired Hivescape app on
this same record. Build 9 is the current TestFlight build; build 8 remains
attached to the 1.0 App Store version. Increment `CURRENT_PROJECT_VERSION` for
every upload.

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

## Listing

The record was inherited but turned out to be **empty**, not wrong — every
field was null, so this was fill-in rather than cleanup.

Done (updated 2026-08-10, through the App Store Connect API):

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
- [x] Build 9 uploaded and processed as `VALID` for TestFlight on 2026-08-10;
      delivery `1993371e-0f97-4f66-b2de-3de65b8dc49e`

Still owed:

- [ ] **App Privacy nutrition labels — must be done in the ASC web UI.** The
      API has no endpoint for them (`appPrivacyDetails` → "URL path is not
      valid"). Answer: no data collected, of any kind.
- [ ] `docs/DEVICE_VERIFY.md` signed on hardware
- [ ] Re-shoot `02-sphere.png`. The current capture caught the HUD mid-render
      and shows “left” and “s” without their numbers. Four generated alternatives
      live under `app-store/screenshots/en-US/` for comparison.

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
