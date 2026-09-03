# Amazon Appstore — Hexsweeper (Fire tablet)

**Priority:** Fire tablet. There is no Fire TV build; the sphere is drag-driven
and has no D-pad model.

## Package

| | |
|---|---|
| Application ID | `app.hexodus.ios` |
| Version | `1.0.1 (26)` |
| minSdk / targetSdk | 24 / 36 |
| Permissions | `app.hexodus.ios.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` only (Capacitor-generated, self-scoped) |
| Native code | none — universal APK, pure WebView |
| Listing pack | `../app-store/amazon/` |

`supports-screens` covers small, normal, large, and xlarge. minSdk 24 excludes
Fire OS 5 devices (API 22); Amazon filters those out automatically.

Google Play Services is **not** linked. The `com.google.gms.google-services`
plugin only applies when `app/google-services.json` exists, and it does not, so
the APK carries no Play dependency — which is what makes it safe on Fire OS.

## The signing key changed — read this before shipping

Builds 16 through 20, published on dr.eamer.dev, were signed with the generic
**Android debug key** (`CN=Android Debug`). Amazon rejects debug-signed APKs.

Build 26 is the first signed with a real release identity:

```
CN=Hexsweeper Android Release, OU=Android, O=Luke Steuber, C=US
SHA-256 40:4F:D1:3D:59:F9:5B:59:FB:93:42:E2:0E:59:53:B1:56:03:83:2D:DA:8C:A7:51:81:C9:59:B4:1F:B5:D5:92
```

Consequences:

- Anyone with a sideloaded test build installed **cannot update in place**.
  They have to uninstall first. Say so on the download page when 26 goes up.
- There is no Play App Signing enrolment, so this key *is* the signature the
  device checks. It cannot be rotated later without the same break.
- The key is backed up in the sops vault as `android/hexsweeper.yaml`
  (restore verified 2026-09-03) and in the login Keychain under toolkit
  profile `hexsweeper`.

## Staged artifacts

```
android/dist/release/
  Hexsweeper-1.0.1-26-release.apk
  SHA256SUMS.txt
  PROVENANCE.txt
```

## Build signed release

```sh
cd /Users/luke/workspace/android-release-toolkit
scripts/android-release with-signing --profile hexsweeper -- /bin/sh -c \
  'cd /Users/luke/workspace/hexsweeper-app/android && \
   export JAVA_HOME=$(/usr/libexec/java_home -v 21) && \
   export ANDROID_HOME="$HOME/Library/Android/sdk" && \
   ./gradlew :app:assembleRelease'
```

Without those environment variables Gradle silently produces an **unsigned**
release APK — `hasReleaseSigning` in `app/build.gradle` gates the config.

## Device gate (Fire tablet)

Record model + Fire OS version, then verify:

1. Install the signed APK over ADB and launch it
2. The app opens straight into the sphere and restores an unfinished run
3. Drag to rotate the sphere; tap to clear; long-press or Flag to arm a flag
4. Undo, New sphere, and the mines-left / seconds readout all work
5. Open **?** and walk all four tabs (Play · Themes · Board · Settings)
6. Switch several of the nine themes; change board size and confirm the
   per-size best time follows
7. Hold the mine count until the water rises, reach the Water Wheel, and
   return via the Sphere pill with the run intact
8. **Rotate the tablet** — Amazon test criteria require both orientations to
   stay functional and require respecting an orientation lock. The manifest
   sets no `screenOrientation`, so the sphere will reflow; confirm the bottom
   bar and the **?** sheet are still reachable in both
9. Confirm the app fills at least 80% of the screen, centered
10. Frame rate: Amazon wants 25 fps minimum, 55–60 preferred. The sphere is the
    heaviest thing here — watch the largest board size on the weakest tablet
11. Home → resume; sleep/wake; a long run without a crash

Capture 3–5 listing screenshots at an Amazon-accepted size from this exact
signed build.

### Current device evidence

None. No Fire tablet has been attached yet. Do not submit until this section
records a real model, Fire OS version, and pass/fail per step above.

## Listing pack state

`../app-store/amazon/` already holds icons, copy, and a feature graphic:

| Amazon field | File | State |
|---|---|---|
| Small icon | `images/icon-114.png` | ready, 114×114 |
| App icon | `images/icon-512.png` | ready, 512×512 |
| Promotional image | `images/feature-1024x500.png` | ready, 1024×500 |
| Copy | `en-US/*.txt` | ready, all within limits |
| Screenshots | — | **pending device capture** |

`en-US/feature_bullets.txt` currently lists **six** bullets; Amazon asks for
three to five. Drop one before submitting.

The frames in `app-store/screenshots/en-US/` are iPhone and iPad sizes and match
no Amazon-accepted dimension. They cannot be reused.

## Console sequence (human only)

1. Amazon Developer Console → create app **Hexsweeper**
2. Upload `Hexsweeper-1.0.1-26-release.apk`; confirm the **Fire tablet** device
   family and review the auto-generated supported-device list
3. Paste the copy from `app-store/amazon/en-US/`
4. Upload icons, feature graphic, and screenshots
5. Content rating, audience, privacy URL
6. Submit only after the device gate above is filled in

This repo never logs into Amazon for you.
