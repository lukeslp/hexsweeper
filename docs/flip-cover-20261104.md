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
The wrapper recomputes its padding from the actual window size, visible system
bars and window-local cutout rectangles. It passes cleared bar/cutout insets to
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
Native device checks, App Tray selection and a data-preserving signed update
remain a separate runtime gate. Napoleon’s Keychain copy was unavailable; the
existing encrypted signing vault on Beast supplied the credential in memory to
the local build. No key or Keychain item was created or replaced. This change was not
published or installed by this workstream.

Signed local candidate: `android/app/build/outputs/apk/release/app-release.apk`
(1.0.7 / versionCode 32), SHA-256
`c1e373e949d284b7d57dea841f6eab01305330cf7124d9c2d6417a7d5b5154e2`.
Its certificate SHA-256 matches installed 1.0.6:
`404fd13d59f95b59fb9342e20e5953b15603832dda8ca75181c959b41fb5d592`.
No public catalog or store release was performed.

Initial debug artifact:
`android/app/build/outputs/apk/debug/app-debug.apk` (1.0.6 / versionCode 31),
SHA-256 `8dc5b4bbc5e57a87c9e53c08d30e0d48f33634e31b9ce1bd4a9f6ee0492ecc0e`.
This is the default debug signature; the parent handles compatibility with any
existing installation without clearing game data.

## Remaining evidence and rollback

Verify the native wrapper on the actual Flip in both Samsung wide-frame and
full-panel modes, then unfold/refold with an unfinished run and an open sheet.
Confirm camera clearance, current WebView safe-area behavior, touch alignment,
and no ADB command required to launch from the cover App Tray. Model fallback
must be revisited if Samsung changes that window geometry.

Rollback removes `GameViewport`, `GameViewportBounds` and their test and restores
the previous `MainActivity`. The generated game and persisted runs are untouched
by either direction. Retain this dated evidence when reverting the implementation.
