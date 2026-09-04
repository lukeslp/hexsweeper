# Amazon Appstore — Hexsweeper (Fire tablet)

**Priority:** Fire tablet. There is no Fire TV build; the sphere is drag-driven
and has no D-pad model.

## Package

| | |
|---|---|
| Application ID | `app.hexodus.ios` |
| Version | `1.0.4 (29)` |
| minSdk / targetSdk | 24 / 36 |
| Permissions | `app.hexodus.ios.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` only (Capacitor-generated, self-scoped) |
| Native code | none — universal APK, pure WebView |
| Listing pack | `../app-store/amazon/` |

`supports-screens` covers small, normal, large, and xlarge. minSdk 24 excludes
Fire OS 5 devices (API 22); Amazon filters those out automatically.

Google Play Services is **not** linked. The `com.google.gms.google-services`
plugin only applies when `app/google-services.json` exists, and it does not, so
the APK carries no Play dependency — which is what makes it safe on Fire OS.

Track state: **submitted to Amazon; under review**. Amazon accepted the
submission at 08:54 AM PDT on 2026-09-04 and estimates approval before
09:00 AM PDT on 2026-09-09. Package signing, device targeting, copy, icons,
screenshots, functional checks, direct XL rotation, ambient XL rotation, and
the final stress/soak gates pass on KFRASWI.

## Amazon console

| | |
|---|---|
| App ID | `amzn1.devportal.mobileapp.4903bf85d6ce408d88c447445269c591` |
| Release ID | `amzn1.devportal.apprelease.38019068174844b79d7da61fc00e1268` |
| SKU | `hexsweeper-fire` |
| Category | Games > Brain & Puzzle |
| Refinements | Indie, Casual |
| Language | English |
| Devices | 12 Fire tablet models; no Fire TV or Automotive targets |
| Availability / price | All Amazon Appstore countries and regions / Free |
| State | Under Review — submitted 08:54 AM PDT on 2026-09-04 |
| Estimated approval | Before 09:00 AM PDT on 2026-09-09 |

## The signing key changed — read this before shipping

Builds 16 through 20, published on dr.eamer.dev, were signed with the generic
**Android debug key** (`CN=Android Debug`). Amazon rejects debug-signed APKs.

Build 26 is the first signed with a real release identity; builds 27 through 29
keep that identity:

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
  Hexsweeper-1.0.4-29-release.apk
  SHA256SUMS.txt
  PROVENANCE.txt
```

APK SHA-256:
`297299ddda7630c15e0049711015c327b4624c0299f93d5ae515bc76310ae8d3`.

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

### Current device evidence — 2026-09-04

- **KFRASWI** (`raspite`), Fire OS 8.0 / Android 11 (API 30), 800×1280 native,
  213 dpi, arm64-v8a. Real multitouch (`touchscreen.multitouch.jazzhand`).
- Signed `1.0.4 (29)` installed over USB ADB and launched; `MainActivity` took
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
- The listing screenshots remain the native signed-`1.0.2 (27)` captures at
  1280×800 and 800×1280. Candidate 28 changes only the transient drag path;
  its settled Light frame was checked on-device against those captures.

- **Largest-board gate passes in `1.0.4 (29)`.** Automatic motion on the XL
  2,252-face Light board produced 574 frames in 12 seconds at a 6 ms median,
  9 ms 90th percentile, and no missed vsync. Direct XL rotation then produced
  208 frames at a 7 ms median and 11 ms 90th percentile.
- A five-minute foreground-guarded XL stress pass issued 55 repeated drags and
  produced 2,271 frames at a 13 ms median, 18 ms 90th percentile, and 20 ms
  95th percentile, with no missed vsync, crash, ANR, or process restart.
- Candidate 28 supplied a separate 31-minute process/lifecycle soak (an
  8-minute foreground interval, background/resume, then 22 continuously
  foregrounded minutes) with no crash, ANR, restart, or missed vsync. It also
  exposed the idle-rendering issue that candidate 29 fixes.
- The APK pulled back from `/data/app` after the final stress pass hashes to
  `297299ddda7630c15e0049711015c327b4624c0299f93d5ae515bc76310ae8d3`,
  exactly matching the staged candidate.
- The failed `1.0.2 (27)` baseline was 89 ms median portrait and 77 ms median
  landscape on XL. The fix removes the full retained hit-test projection from
  touch-move events after a gesture becomes a drag; the compact batched drag
  renderer is now the only projection painted during direct rotation.
- Candidate 28's soak also showed that the stopped sphere kept repainting an
  unchanged full-detail canvas. Candidate 29 gives ambient motion the compact
  renderer and parks the static frame loop until input, resize, or animation;
  two screen captures two seconds apart were byte-identical after motion ended.

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
| Reviewer instructions | `en-US/reviewer_instructions.txt` | ready |
| Screenshots | `screenshots/*.png` | ready — 5 native Fire tablet captures |

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
| `05_stratosphere-1280x800.png` | 1280×800 | candidate 29, XL Stratosphere theme |

Amazon takes landscape or portrait, but mixing both in one listing reads
inconsistently. Use `01`, `03`, and `05` for the strongest consistent landscape
set. The old cleared-Light frame (`02`) is accurate but visually busy at the
sphere rim; treat it and the portrait frame as optional.

## Amazon submission receipt

Amazon accepted the complete submission at 08:54 AM PDT on 2026-09-04. The
console reports **UNDER REVIEW** with estimated approval before 09:00 AM PDT
on 2026-09-09. The submitted release contains the verified
`Hexsweeper-1.0.4-29-release.apk`, the English listing, three landscape Fire
tablet screenshots (`01`, `03`, and `05`), both icons, the promotional image,
the completed content rating and privacy answers, reviewer instructions, and
the accepted export-compliance certification.
