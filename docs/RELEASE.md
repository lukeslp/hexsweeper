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
this same record. Increment `CURRENT_PROJECT_VERSION` for every upload.

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

## Still owed before external testers or submission

The App Store Connect record was created for a different app. Nothing on it can
be trusted:

- [ ] Privacy nutrition labels — currently describe on-device LLM use. This
      build collects nothing and makes no network calls.
- [ ] Age rating — re-answer from scratch
- [ ] Description, subtitle, keywords. ASO note: the name does not have to
      carry "minesweeper"; the subtitle and the 100-character keyword field are
      what Apple indexes, so accuracy in the name costs nothing in search.
- [ ] Screenshots — any existing ones show the retired game
- [ ] Support / marketing URLs
- [ ] `docs/DEVICE_VERIFY.md` signed on hardware

Export compliance is already answered: `ITSAppUsesNonExemptEncryption = false`.
