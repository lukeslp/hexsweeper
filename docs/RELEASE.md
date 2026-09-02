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
this same record. Build 60 is the latest uploaded TestFlight build, attached to 1.0, and the
checked-in project matches it. (App Store Connect enforces a per-app daily
upload cap — error 90382 after ~15 uploads on 2026-08-18; it cleared within
the hour.)

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

Current Android identity is `versionCode 19`, `versionName 1.0-test`, targeting
API 36 with minimum API 24. The direct test APK is debug-signed with the same
certificate as builds 1–15 so testers can upgrade in place. Build 19 (2026-08-19,
payload `4c04cab`) is published at `https://dr.eamer.dev/downloads/apps/hexsweeper/`
(APK served from `/home/coolhand/html/downloads/android/hexsweeper/` on Drummer;
17 and 16 stay as fallbacks). There is no 18: `versionCode` 18 was bumped for
build 62 but no APK was cut before 19 superseded it. The curated download page
and `catalog.json` are patched in place, never regenerated — see
`downloads/CURATED_DO_NOT_REGENERATE.md` on Drummer; each publish leaves an
`index.html.bak-before-…` beside the page. The release AAB remains
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
- [x] Subtitle `Minesweeper on a sphere` (was `Hex minesweeper, flat or round`)
- [x] Description, keywords (94/100), and promotional text — rewritten 2026-08-18
      for the sphere-only app (nine looks, undo, autosave, offline)
- [x] Support + marketing URLs → the live web game
- [x] Privacy policy → `privacy.html`, added to the hexsweeper repo and
      deployed to Drummer
- [x] Age rating — every content question NONE, every behaviour flag false
- [x] Screenshots — replaced 2026-08-18 with six 6.9" iPhone (1320×2868) and
      six 13" iPad (2064×2752) captures of the sealed sphere, captioned;
      the old picker-era device captures are gone from ASC
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
      Cells as the dark material (payload 679KB)
- [x] Build 44 uploaded to TestFlight on 2026-08-18: Aurora, Galaxy, Gilded
      Ribbon, Heat Lightning join the flower cycle (nine themes; payload
      857KB)
- [x] Build 45 uploaded 2026-08-18: launch image is now a still of the Light
      sphere at first-frame size (was a dug Infinite plate); payload unchanged
- [x] Build 46 uploaded and attached to 1.0 on 2026-08-18: the flower sits
      below the sphere (beside it in landscape) with no scrim blur, so theme
      taps preview on the live board (vendored from hexsweeper `e7585a0`).
      Screenshot 03 regenerated to match. ASC has no What's New on a first
      version; release notes stay drafted in app-store/metadata
- [x] Build 47 uploaded and attached to 1.0 on 2026-08-18: the menu is seated
      on the sphere's own faces (Face Takeover, productionised — labelled,
      finger-sized, board rotatable while open); vendored from hexsweeper
      `8a8e925`. Screenshot 03 recaptioned "The menu lives on the sphere"
- [x] Build 48 uploaded and attached to 1.0 on 2026-08-18: legible labels on
      the face-menu tiles and a nine-swatch Theme grid in the Help sheet
      (vendored from hexsweeper `008e18b`)
- [x] Build 49 uploaded and attached to 1.0 on 2026-08-18: the sphere zooms
      in when the menu opens (real faces at finger size, labelled) and Theme
      fans nine swatch faces across the surrounding ring; zoom restores on
      close (vendored from hexsweeper `184058d`)
- [x] Build 50 uploaded and attached to 1.0 on 2026-08-18: the hex menu is
      gone — quiet bar (Undo · New sphere · Flag · ?) plus the ? settings
      sheet (theme, size, warnings, invert, effects, tutorial relaunch);
      themed dig cores and flag sheens on every material; first-launch
      tutorial; end-of-game banner as a labelled card; Share hands the card
      to the native HexShare plugin as an image (vendored from hexsweeper
      `ac4b869`)
- [x] Build 51 uploaded and attached to 1.0 on 2026-08-18: interiors turn
      with the shell (solid metals / nuclei) or open into it (hollow shells:
      Stratosphere, Aurora, Galaxy); themes own depth/seams/marks and the
      Warnings group leaves the sheet; long-press flag paints during the hold
      on mirror themes; "clear" replaces "dig" (vendored from hexsweeper
      `8579d79`). **Regressed on device:** Mercury's interior painter had
      been deleted, so the first clear threw inside the frame loop and the
      sphere stopped answering touch.
- [x] Build 52 uploaded and attached to 1.0 on 2026-08-18: Mercury interior
      restored (grain follows the shell) and the frame loop survives a
      painter exception; the app contract clears/flags/drags on every theme
      with uncaught exceptions captured, and a Playwright WebKit probe covers
      the engine iOS runs; best times per board size (sheet + win banner);
      the Water Wheel ships as a hidden second sphere (`www/wheel.html`, hold
      the mine count) — the payload is now three files (vendored from
      hexsweeper `12f9cec`). **On device Mercury's cleared faces had lost
      their liquid-metal wells** — the interiors pass had replaced every
      mirror core, not just fixed the crash.
- [x] Build 53 uploaded and attached to 1.0 on 2026-08-18: theme rendering
      rolled back to build 50's dig cores (Mercury liquid metal, sky glass,
      plasma, curtains, star field, gold, magma — the reference); the ?
      sheet is tabbed Play · Themes · Board · Settings (vendored from
      hexsweeper `f32a0b2`)
- [x] Build 54 uploaded and attached to 1.0 on 2026-08-18: only Mercury
      (liquid metal) and Galaxy (star field) keep a dig core; Stratosphere,
      Ion Storm, Aurora, Gilded Ribbon and Heat Lightning clear to matte
      wells with depth + seams; Gilded Ribbon flags are red, Heat Lightning
      flags blue (vendored from hexsweeper `027d005`)
- [x] Build 55 uploaded and attached to 1.0 on 2026-08-18: interiors —
      Stratosphere porcelain, Ion Storm cobalt, Gilded Ribbon gold, Heat
      Lightning ivory (all seamless decals with depth); Galaxy's black hole
      seen through the cleared faces; Heat Lightning's bolts (vendored from
      hexsweeper `5a2a2e5`). **On device the black hole bled past the rim
      while spinning** (edge-on windows).
- [x] Build 56 uploaded and attached to 1.0 on 2026-08-18: interiors round
      two — Galaxy black hole larger, no star arcs, an infalling star, B&W
      ring counts; Aurora curtains; Ion Storm plasma filaments over cobalt;
      Stratosphere sky + clouds; Heat Lightning cloud deck lit by sheet
      flashes; interior effects clip to the sphere disc and only use faces
      with z > 0.22 (rim bleed fixed). Water Wheel floats (bob/sway
      physics), its tutorial page-2 art redrawn, and the sheet's Board tab
      carries a wave button that opens it (vendored from hexsweeper
      `0da1e04`)
- [x] Build 57 uploaded and attached to 1.0 on 2026-08-18: Stratosphere
      flags red; Ion Storm (cobalt), Aurora (verdigris) and Heat Lightning
      (copper) back to plain seamless metals with depth — their interior
      effects unmapped; Galaxy's black hole and Stratosphere's sky stay
      (vendored from hexsweeper `77ec5ed`)
- [x] Build 58 uploaded and attached to 1.0 on 2026-08-18: drag
      sensitivity follows the sphere's screen size (~1.3× finger tracking;
      direction unchanged — the face follows the finger on both axes),
      same in the Wheel (vendored from hexsweeper `fd781ee`)
- [x] Build 59 uploaded and attached to 1.0 on 2026-08-18 (after the daily
      cap cleared): Aurora, Ion Storm, Gilded Ribbon, Heat Lightning,
      Stratosphere clear to mono wells with depth + seams on the Light/Dark
      model; only Mercury's liquid metal and Galaxy's black hole remain as
      interiors; horizontal drag mirrored by default (Invert X = finger-
      following; stored prefs migrate v1→v2); the Board-tab Wheel door is
      icon-only (vendored from hexsweeper `c5a8a9c`)
- [x] Build 60 uploaded and attached to 1.0 on 2026-08-18: rotation fix —
      the canvas backing store now heals itself whenever it stops matching
      its element, so a landscape trip no longer leaves the board stretched
      in portrait (iOS drops or mis-times the orientation resize); the
      mirror canvas carries the same guard (vendored from hexsweeper
      `9db1a58`)
- [x] Build 61 uploaded and attached to 1.0 on 2026-08-19: theme roster
      converges on the canonical nine (Shell/Ink/Float/Card/Earth/Moon/Glow
      shelved from the cycle); help sheet documents the real keys (T, S/M/L;
      dead C removed) (vendored from hexsweeper `da4194e`). Android test 17
      ships the same payload. Archived, exported and uploaded from a local
      terminal — the SSH login-keychain lock (`errSecInternalComponent` on
      codesign) does not apply there, so no unlock was needed. Processing
      took ~40 minutes. Screenshots regenerated at 61 and uploaded (six 6.9"
      iPhone, six iPad 13"), replacing the build-51 sets; description,
      keywords and promotional text pushed. No What's New — App Store
      Connect has no such field for a first release.
- [x] Build 62 uploaded and attached to 1.0 on 2026-08-19: chording on the
      sphere — double-tap a number whose flags are all placed and the rest of
      its neighbours clear at once. Matches the flat game: it goes by the
      flags, not the board, so a misplaced one detonates and the mine that
      blows becomes the detonator. Zeros cascade through the flood, and the
      whole chord is one undo step. Help sheet documents it under Play
      (vendored from hexsweeper `d0a91f7`). Android versionCode 18 ships the
      same payload. Processed in ~3 minutes. Screenshots unchanged — chording
      alters no visuals. Supersedes 61.
- [x] Build 63 uploaded and attached to 1.0 on 2026-08-19 — release candidate:
      chording on both spheres and in flag mode, since a flag on an open face
      does nothing and flags-then-clear is the sequence it exists for. On the
      Wheel a chord onto a bad flag arms the mine instead of ending the run,
      and drowned mines count alongside flags because they cannot be flagged.
      The Wheel drops its tutorial entirely — it is an easter egg. Fixes a
      native-bundle escape: the bloom's Home did a bare `location.href = '../'`,
      which from the payload root stranded the WebView with no way back; Home
      now reads `HEXSWEEPER_HOME_HREF` and the exporter refuses to ship a bare
      climb (vendored from hexsweeper `4c04cab`). Android test 19 ships the
      same payload. Screenshots unchanged. Supersedes 62.
- [x] 1.0 (63) approved and Ready for Sale on 2026-09-01 after 13 days in
      Waiting for Review; an expedited-review request was filed that evening
      through the App Review contact form, and a pending program agreement had
      been accepted the same day.
- [x] Build 64 (1.0.1) uploaded 2026-09-01 and attached to the new 1.0.1
      version (What's New set from `app-store/metadata/en-US/release_notes.txt`;
      not submitted). Invert prefs move to a v4 key with no migration so every
      device starts finger-following on both axes; Ion Storm, Gilded Ribbon and
      Heat Lightning clear to seamless cobalt, gold and copper cores; Stratosphere
      keeps porcelain wells and its cliff walls take the light fill; app icon is
      a straight crop of an Ion Storm TestFlight screenshot (vendored from
      hexsweeper `d9a75aa`). Android test 20 (versionName 1.0.1-test) ships the
      same payload and is live at dr.eamer.dev/downloads/apps/hexsweeper/.
      Screenshots unchanged.
- [x] Build 65 (1.0.1) uploaded 2026-09-01 and attached to 1.0.1 in place of
      64: same payload, new icon — a tight surface crop of the Gilded Ribbon
      board (`scripts/generate-icon.py --source` plus a full-bleed 1024 for the
      iOS slots). Android versionCode 21 (not published; test 20 stays on the
      download page). App Previews rendered with `scripts/store-preview.mjs`
      (24 s, 886x1920 and 1200x1600, H.264 30 fps) from the sealed payload.
- [x] Build 66 (1.0.1) uploaded 2026-09-02 and attached to 1.0.1 in place of
      65: icon is now the Dark-theme board sitting low in the frame, earthrise
      style (`scratch: earth-dark-b-rise`; composed from a `store-shots` render,
      not `generate-icon.py`'s own render). Android versionCode 22, unpublished.
      Previews for both families are uploaded and processed on 1.0.1 with the
      poster frame at 13 s.
- [x] Build 67 (1.0.1) uploaded 2026-09-02 and attached to 1.0.1 in place of
      66: same earthrise icon, limb raised to the top third with a red flag in
      frame (`scratch: earth-dark-a-third`). Promotional text refreshed for
      1.0.1. Android versionCode 23, unpublished.
- [x] Build 68 (1.0.1) uploaded 2026-09-02 and attached to 1.0.1 in place of
      67: icon is a centred 78% crop of the Heat Lightning board (copper metal
      core, blue flag) — the mono earthrise reads too austere. Android
      versionCode 24, unpublished.
- [x] **1.0 submitted for App Store review on 2026-08-19** with build 63
      attached. ASC reports `WAITING_FOR_REVIEW`, release type
      `AFTER_APPROVAL`. What is live on dr.eamer.dev and what is in the
      submitted binary are the same payload, hexsweeper `4c04cab`.

Still owed:

- [ ] **App Privacy nutrition labels — must be done in the ASC web UI.** The
      API has no endpoint for them (`appPrivacyDetails` → "URL path is not
      valid"). Answer: no data collected, of any kind. Apple gates submission
      on this section, so 1.0 reaching `WAITING_FOR_REVIEW` implies it was
      answered; the API cannot confirm it, so this box stays for a human to
      tick after checking the web UI.
- [ ] `docs/DEVICE_VERIFY.md` signed on hardware
- [x] iPad screenshots — done 2026-08-18 (six at 2064×2752, uploaded)
- [x] The ASC device capture `02-sphere.png` (HUD caught mid-render) is gone
      with the old set

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

## Amazon Appstore (Fire tablets)

Assets staged under `app-store/amazon/`:

- `images/icon-512.png` and `images/icon-114.png` — resized from the App
  Store master icon.
- `images/feature-1024x500.png` — landscape crop of the Mercury store
  capture (real gameplay, no text overlay).
- `en-US/` — listing copy adapted from the iOS metadata. The plain name
  "Hexsweeper" is expected to be available on Amazon; the "3D" suffix was
  an Apple name-collision workaround only.

Submission checklist (all manual, in the Amazon developer console):

- Build the store APK with `cd android && ./gradlew assembleRelease` —
  Amazon re-signs uploads, so the unsigned release APK is correct; do not
  submit the debug-signed direct-download APK. Bump `versionName` from
  `1.0-test` to `1.0` first.
- Complete the IARC content-rating questionnaire (no known blockers).
- Data collection: none (same answers as the iOS privacy manifest).
- Sideload-verify on a Fire tablet or emulator per `docs/DEVICE_VERIFY.md`
  before publishing.
