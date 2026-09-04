# Amazon Appstore — Hexsweeper (Fire tablet)

**Priority:** Fire tablet. There is no Fire TV build; the sphere is drag-driven
and has no D-pad model.

## Package

| | |
|---|---|
| Application ID | `app.hexodus.ios` |
| Version | `1.0.2 (27)` |
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

Build 26 is the first signed with a real release identity, and build 27 keeps
that identity:

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
  Hexsweeper-1.0.2-27-release.apk
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
   ./gradlew :app:clean :app:lintRelease :app:assembleRelease'
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

### Current device evidence — 2026-09-03

- **KFRASWI** (`raspite`), Fire OS 8.0 / Android 11 (API 30), 800×1280 native,
  213 dpi, arm64-v8a. Real multitouch (`touchscreen.multitouch.jazzhand`).
- Signed `1.0.2 (27)` installed over USB ADB and launched; `MainActivity` took
  and held focus. Package flags confirm it is not debuggable. No FATAL, no ANR,
  and no AndroidRuntime errors appeared in logcat.
- True immersive full-screen passes in portrait and landscape: neither the
  status bar nor the navigation bar consumes app space, and the controls remain
  inside the display bounds.
- Horizontal drag follows the finger by default after the versioned preference
  migration. The Invert X control still lets a player choose the old direction.
- Tutorial card renders and dismisses via **Play**.
- Tap cleared a region with correct flood-fill and 1/2/3 neighbour counts;
  the timer started on that first clear; drag spun the sphere; Undo enabled
  itself after the first move.
- The **?** sheet opens and all four tabs (Play · Themes · Board · Settings)
  are reachable. All nine themes are listed; switching to Aurora applied
  immediately and survived Done.
- **Rotation passes.** Forced to portrait (`accelerometer_rotation 0`,
  `user_rotation 0`) the window resized 1280×800 → 800×1280, the board state
  and the running timer both survived, and the bottom bar and **?** stayed
  reachable. Note: an earlier portrait attempt appeared to fail only because
  `accelerometer_rotation` had been re-enabled and the sensor was holding
  landscape — the app itself never locks orientation (`mOrientation=-1`).
- **Sleep/wake passes.** The revealed board and running timer remained intact
  through screen-off, wake, and unlock; animation resumed without an error.
- A representative 1,002-face board with Heat Lightning and automatic effects
  sustained about 29 animation callbacks per second during repeated drags;
  reduced effects sustained about 32. Android frame statistics recorded zero
  missed-vsync and zero frame-deadline events. Before the Fire-specific renderer
  work, the same interaction was roughly 9 fps.
- Listing screenshots were recaptured from this exact signed build at native
  1280×800 and 800×1280, both Amazon-accepted sizes.

Open: a long-run soak (30+ min) and a frame-rate measurement on
the largest 2,252-face board. The representative medium-board result clears
Amazon's 25 fps floor, but the largest-board check remains a release gate.

### Note on portrait layout

In portrait the sphere occupies roughly the middle half of the screen with
large empty bands above and below. The app window still fills the display, so
Amazon's 80%-of-screen criterion is met, but the composition is loose. Worth a
look before leaning on portrait screenshots in the listing.

## Listing pack state

`../app-store/amazon/` already holds icons, copy, and a feature graphic:

| Amazon field | File | State |
|---|---|---|
| Small icon | `images/icon-114.png` | ready, 114×114 |
| App icon | `images/icon-512.png` | ready, 512×512 |
| Promotional image | `images/feature-1024x500.png` | ready, 1024×500 |
| Copy | `en-US/*.txt` | ready, all within limits |
| Screenshots | `screenshots/*.png` | ready — 4 native Fire tablet captures |

`en-US/feature_bullets.txt` contains **five** bullets, within Amazon's three-to-
five limit.

The frames in `app-store/screenshots/en-US/` are iPhone and iPad sizes and match
no Amazon-accepted dimension; they are not reused. The four in
`app-store/amazon/screenshots/` were captured from the signed 1.0.2 (27) build
on the KFRASWI tablet:

| File | Size | Shows |
|---|---|---|
| `01_sphere-light-1280x800.png` | 1280×800 | fresh sphere, Light theme |
| `02_cleared-light-1280x800.png` | 1280×800 | flood-fill clear with neighbour counts |
| `03_heat-lightning-1280x800.png` | 1280×800 | Heat Lightning theme, mid-game |
| `04_portrait-800x1280.png` | 800×1280 | portrait reflow |

Amazon takes landscape or portrait, but mixing both in one listing reads
inconsistently. The three landscape frames already meet the 3-shot minimum;
treat the portrait one as optional.

## Console sequence (human only)

1. Amazon Developer Console → create app **Hexsweeper**
2. Upload `Hexsweeper-1.0.2-27-release.apk`; confirm the **Fire tablet** device
   family and review the auto-generated supported-device list
3. Paste the copy from `app-store/amazon/en-US/`
4. Upload icons, feature graphic, and screenshots
5. Content rating, audience, privacy URL
6. Submit only after the device gate above is filled in

This repo never logs into Amazon for you.
