# Flip cover viewport — November 4, 2026

Development source: `lukeslp/hexsweeper-app`, isolated branch
`codex/flip-cover-20261104`, based on canonical `origin/main` at `ae38970`.
Work was performed on Luke's Mac in `/Users/luke/workspace/hexsweeper-flip-cover`.
The original `android-builds/appcat-20261103/hexsweeper-app` checkout was not edited.
The sealed game remains the `d0082f7` source snapshot recorded in `WWW_SOURCE.txt`;
no `www/` bytes, save schema, app identity or permissions were changed. The
local Android candidate advances to 1.0.7 (32). Its existing release signing
profile is required for an update over the installed 1.0.6 (31).

## Reproduction and change

Before editing, headless Chromium rendered the existing payload at 399×441 and
379×336 CSS pixels with touch enabled. At 399×441, Help occupied
x337–389/y377–433, inside the Flip's camera strip. The wide 379×336 compatibility
frame already fit the existing controls and scrollable sheets. Giving the
unchanged game a 399×352 safe viewport kept all four 52×56 controls inside it and
the sphere circular. The game already handles window and visual-viewport resize,
including a canvas-size guard, so no canonical game-source change was necessary.

`MainActivity` now wraps the existing Capacitor view tree in `GameViewport`,
clears `FLAG_LAYOUT_NO_LIMITS`, and requests fresh insets after configuration,
resume and focus changes. The WebView is retained; folding does not reload it.
The wrapper computes its padding from the incoming window measure specs before
`FrameLayout` measures the existing Capacitor tree. Visible system bars and
window-local cutout rectangles determine the safe rectangle. Inset changes
request measurement; a changed window origin queues a fresh pass outside layout.
It passes cleared bar/cutout insets to
Capacitor so the same safe area is not applied twice. IME insets remain available
to Capacitor.

`GameViewportBounds` clips reported cutouts to the app window and selects the
largest clear rectangle. Thus Samsung's measured 1422×1259 compatibility window
does not lose another camera strip when its reported cutout begins at y1259.
Reported cutout bounds always win. Only when there are no reported bounds,
manufacturer is Samsung, model starts `SM-F766` or `SM-F776`, and the portrait
window matches 948:1048 within 3%, a conservative lower strip is reserved from
y839/1048. Other model families, inner/tall screens and wide frames receive no
model fallback. This geometry comes from the Ambient Time workstream's physical
Flip8 evidence in `ambient-time/docs/reviews/flip-cover-launch-20261104.md`;
the fallback is an estimate, not a Samsung API guarantee.

## Native resize correction

Actual Flip testing passed wide-frame board visibility, tap reveal, Undo and
drag. A subsequent warm wide → tall → full-panel transition exposed a native
measurement gap that browser viewport tests did not cover: padding was applied
during layout after the child had already been measured. The full-height sphere
then remained centered at physical y524, and the lower controls were clipped
below the safe block ending around y839. This was clipping without a WebView
viewport resize.

The wrapper now computes padding in `onMeasure` before calling
`FrameLayout.onMeasure`, so the game receives the safe child dimensions. The same
correction was physically verified in the Attractive shell, which shares this
native policy: a full-panel root of 1422×1572 and bottom padding 314 now produces
a child measured/actual size of 1422×1258, with settled DOM inner size 598×529.
Its wide window remains 1422×1259 with no padding, and its tall window remains
885×1572 with no padding. Samsung's retained physical WebView DPR of 2.375 can
differ from the Activity compatibility density of 3.0; native, CSS and physical
pixel dimensions must be recorded separately. Attractive therefore keeps its
toolbar scrollable in all windows up to 640 CSS pixels wide, including tall
phones, and uses its top-right compact HUD only when also at most 600 CSS pixels
high. Hexsweeper needs no CSS or generated-game change.
The shared-policy evidence does not replace a final Hexsweeper signed-artifact
resize check. Local Attractive proof is
`/tmp/attractive-fixed-resize-metrics.log` and
`/tmp/attractive-fixed-full-toolbar.png`.

## Checks

- `pnpm smoke`: all three payload-integrity and Capacitor sync gates passed.
  Generated host-local dependency paths were restored after sync.
- `pnpm android:build:debug`: passed using JDK 21 at
  `/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home` and SDK at
  `/Users/luke/Library/Android/sdk`. The machine's Java launcher did not discover
  that JDK automatically, so `JAVA_HOME` was supplied explicitly.
- `./android/gradlew --project-dir android :app:testDebugUnitTest :app:lintDebug`:
  eight geometry tests passed; lint passed with warnings concerning unchanged
  icons, resources, appCategory and dependency/tool versions, and no errors.
- Touch-enabled Chromium: first native tutorial dismisses and its seen marker
  survives reload; tap reveals, drag rotates, Flag and Undo work; Play, Themes,
  Board and Settings tabs remain reachable; saved cell state survives repeated
  412×915 → 379×336 → 399×352 transitions, reload and a Water Wheel roundtrip.
  Canvas backing dimensions follow the viewport; all four controls stay inside
  it. No page errors or off-device requests were observed.
- `aapt2 dump permissions`: no `INTERNET` or sensitive permission; only AndroidX's
  app-local `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` remains.
- `git diff --check`: passed.

Browser scripts and screenshots are local evidence under
`/tmp/hexsweeper-cover-20261104*`; they are not physical Android validation.
The native observations above are separate from those browser checks. The final
corrected Hexsweeper artifact still needs repeated resize and cover-control
verification. Napoleon’s Keychain copy was unavailable; the
existing encrypted signing vault on Beast supplied the credential in memory to
the local build. No key or Keychain item was created or replaced. No public
catalog or store publication was performed.

Previous signed local candidate, before the native measurement correction:
`android/app/build/outputs/apk/release/app-release.apk`
(1.0.7 / versionCode 32), SHA-256
`c1e373e949d284b7d57dea841f6eab01305330cf7124d9c2d6417a7d5b5154e2`.
Its certificate SHA-256 matches installed 1.0.6:
`404fd13d59f95b59fb9342e20e5953b15603832dda8ca75181c959b41fb5d592`.
No public catalog or store release was performed. Rebuild and record a fresh
signed checksum for the corrected source before using that path as the final
candidate. The local debug build is suitable for compilation checks and does not
replace the installed release certificate.

## Native measurement regression — coordinating device run

The corrected signed local APK is SHA-256
`4cd018ad8d2d986e0b001e1e07be38441c224ae92f4386495bb6e7a9696677e4`
(version 1.0.7 / code 32), retaining certificate
`404fd13d59f95b59fb9342e20e5953b15603832dda8ca75181c959b41fb5d592`.
It was installed in place on the Flip without removing the game.

`GameViewportLayoutTest` adds two native Android regression cases using the
existing AndroidX instrumentation dependencies. An unattached viewport and
plain MATCH_PARENT child receive synthetic bottom cutouts on the main thread.
The tests assert both measured and laid-out dimensions through full → wide →
full, preserve the same child, and change the cutout at unchanged window size.
These are actual `FrameLayout` measurements, not just the pure rectangle math.
No Activity, WebView, game state or file is opened by either case.

Both cases passed on the connected SM-F776U1 against the installed signed
release (`OK (2 tests)`). The test APK was signed with the same existing app
certificate for that run; the default-debug base APK was not installed over the
release. Only `app.hexodus.ios.test` was removed afterward. The local execution
receipt is `/tmp/hex-cover-native-layout-tests-20261104.log`. This component proof
is separate from the remaining final-artifact visual/fold check below.

## Remaining evidence and rollback

Verify the native wrapper on the actual Flip in both Samsung wide-frame and
full-panel modes, then unfold/refold with an unfinished run and an open sheet.
Confirm camera clearance, current WebView safe-area behavior, touch alignment,
and no ADB command required to launch from the cover App Tray. Model fallback
must be revisited if Samsung changes that window geometry.

Rollback removes `GameViewport`, `GameViewportBounds` and their test and restores
the previous `MainActivity`. The generated game and persisted runs are untouched
by either direction. Retain this dated evidence when reverting the implementation.
