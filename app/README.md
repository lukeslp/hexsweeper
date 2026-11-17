# Hexsweeper (iOS + Android)

Native Capacitor shell for **Hexsweeper 3D**: hex minesweeper on a closed
sphere. The game is the Canvas/vanilla-JS build at the root of this
repository (`sphere/`); this folder wraps it for iOS and Android as a sealed
offline payload.

The app opens straight into the sphere, which restores its own unfinished run
without asking. Nothing opens by itself on launch, including the first one.
The short tutorial (Tap, Hold, Drag) is behind **?**, under **Show the
tutorial**. The fixed chrome is a quiet bar:
**Undo, New sphere, Flag**
(red while armed) bottom left, **?** bottom right, and a small mines-left,
seconds readout at the top. Everything else lives behind **?**, on four tabs
(Play, Themes, Board, Settings): theme (Light, Dark, Mercury,
Ion Storm, Aurora, Galaxy, Heat Lightning), board
size with your best time per size, drag inversion, effects and the tutorial.
Hold the mine count and water rises through it. Keep holding, or tap the
little wave button on the sheet's Board tab, and you drop into the **Water Wheel**, a hidden second sphere
(`www/wheel.html`) where armed mines have to be spun beneath the waterline;
its Sphere pill brings you back and the run resumes. Infinite and Classic are
web-only; they are not in this binary.

## Where to get it

- Web: <https://dr.eamer.dev/games/hexsweeper/>
- iPhone and iPad: **Hexsweeper 3D** on the App Store,
  <https://apps.apple.com/app/id6768871973>
- Android (direct download): <https://dr.eamer.dev/downloads/apps/hexsweeper/>

This repository holds two platforms: the iOS shell under `ios/` and the
Android shell under `android/`. Build steps for both are under
[Verify](#verify).

The web game also opens the board immediately, including on a first visit or
when browser storage is blocked, but it has no tutorial: its Play tab is one
line plus Tap / Hold / Drag. Web and native use the same
Play, Themes, Board, Settings sheet; a Keys tab appears for keyboard users.

## Flip cover testing, November 4, 2026

The local Android 1.0.9 (34) candidate retains the safe native cover viewport,
dialog focus fixes and bounded Help restoration after native WebView recreation.
It passed native saved-state restart and Wheel → Sphere re-entry checks. See the
[initial viewport evidence](docs/flip-cover-20261104.md) and
[quiet-focus follow-up](docs/flip-cover-quiet-checks-20261104.md), then the
[current native restoration receipt](docs/native-ui-restoration-20261105.md).
Later quiet return: build34 Help Keys retained on inner resume, and the owner
confirmed the apps work. The final refold/no-touch-Escape pair is not independently
completed; TalkBack remains skipped/off. The native restoration receipt records
these separate scopes.
This candidate has not been publicly released.

## Android 1.0.10 (35) candidate, November 12, 2026

Prepared for a first Google Play release; not released, and not signed in this
repository. It is the 1.0.9 (34) candidate plus: a working Share button, the
cutout strip matched to the theme, system Back that closes sheets before it
leaves the app, backup turned off, seven themes, a Licenses page, and a sheet that holds up at large system text. Checked on
phone and tablet emulators only. 34 was installed on a test phone, so this
candidate takes the next code.

**The Google Play build has its own application id.** `pnpm android:bundle:play`
(or `./gradlew -Pplay :app:bundleRelease`) builds with the id in the one
property `hexsweeperPlayApplicationId` in `android/gradle.properties`. It is
set to `app.hexodus.hexsweeper`, a placeholder until the owner confirms it:
a Play application id is permanent after the first upload. Every other build
keeps `app.hexodus.ios`, so the direct download and Amazon installs keep
updating. Android treats the two ids as two apps. They install side by side,
neither updates the other, and a saved board, best times and settings do not
move between them. The FileProvider authority and the Share plugin follow the
id; the app has no deep links or asset links to follow it.

## Android 1.0.12 (37), F-Droid build, November 16, 2026

The first build made for F-Droid, from the `www-fdroid/` payload: four themes
(Light, Dark, Mercury, Aurora) and no history picture in Help. Version 37
belongs to this build alone; the next direct or store build takes 38 or
higher. Build steps and what is open are in
[docs/FDROID.md](../docs/FDROID.md). Not yet in the F-Droid catalog, and not
run on a phone.

## Android 1.0.11 (36), November 13, 2026

1.0.10 (35) plus one change: Android backup carries best times, theme and
settings to a new phone (see the backup paragraph under Layout). It is the
build on the direct download page, dated November 14, 2026; it is not signed
in this repository. Checked on an emulator with the local backup transport:
back up, uninstall, reinstall, restore.

## The names do not match, on purpose

| Thing | Value |
|---|---|
| Product / display name | **Hexsweeper** |
| Repository | `lukeslp/hexsweeper`, in this folder (`app/`) |
| Game source | the repository root (`sphere/`) |
| iOS bundle id / Android application id | `app.hexodus.ios` (the Google Play build: see the 1.0.10 note above) |
| App Store Connect record | app id `6768871973` |

The bundle id is inherited. It was minted for "Hexodus", an unrelated hex
roguelike with an on-device LLM antagonist that was built here and abandoned;
its App Store Connect record was separately named "Hivescape" and holds builds
1–6, none ever submitted. Reusing the id keeps that record rather than opening a
fresh one, since its metadata had to be rewritten either way. **`CURRENT_PROJECT_VERSION`
therefore starts at 7**: anything ≤6 is rejected as a duplicate build number.

Do not "fix" the bundle id to match the product name. Changing it means a new
App Store Connect app and abandoning this one.

## Layout

| Path | Role |
|---|---|
| `www/` | The game. Vendored payload: **do not hand-edit** |
| `WWW_SOURCE.txt` | Which hexsweeper commit `www/` came from, plus checksums |
| `capacitor.config.js` | Capacitor config (`.js`, not `.ts`; see below) |
| `ios/` | Xcode project, automatic signing (set your own `DEVELOPMENT_TEAM` to build for a device) |
| `android/` | Generated Capacitor Android project, API 24–36 |
| `scripts/smoke.sh` | Payload integrity + cap sync gates |
| `scripts/android-build.sh` | JDK-21 Gradle wrapper for APK/AAB builds |
| `app-store/` | Store listing copy and screenshots |
| `licenses/`, `THIRD-PARTY-NOTICES.md` | Notices for bundled third-party material |
| `www/notices.html` | The same notices as a page inside the app (**?**, then **Licenses**) |

There is no bundler, no TypeScript, and no web test suite here. `www/index.html` is
the sealed Sphere game: one self-contained file with fonts, CSS, and all JS
(engine, WebGL material renderer, quiet chrome) inlined. `www/wheel.html` is
the sealed Water Wheel, and the help sheet's history image is under
`www/assets/`. The Wheel's Sphere pill returns to the saved sphere. One local
native plugin,
`HexShare` (in `AppDelegate.swift`, registered by `HexBridgeViewController`),
presents the finished-board card as a `UIImage` in the iOS share sheet so
image-capable apps appear; the web build's Web Share path is the fallback.
Android has the same plugin name (`HexSharePlugin.java`): it writes the card to
the app's cache folder and opens the system share sheet through the app's
FileProvider. A second Android plugin, `HexBackdrop`, takes the page's
background color for the strip beside a camera cutout. System Back closes an
open sheet, returns from the Licenses page or the Water Wheel to the board,
and leaves the app only from the bare board.

Android backup is on from 1.0.11, for one small file. The game keeps
everything in the WebView's local storage, which a backup cannot take in
part, so the shell copies six values into `shared_prefs/hexsweeper_backup.xml`
whenever the board page loads or the app leaves the screen: best times
(`hexsweeper-sphere-best-v1`), theme (`hexsweeper-sphere-theme-v6`), board
size (`hexsweeper-sphere-size-v2`), drag inversion
(`hexsweeper-sphere-invert-v6`), effects (`hexsweeper-effects-v1`) and count
style (`hexsweeper-sphere-countstyle-v1`). The backup rules
(`res/xml/data_extraction_rules.xml`, and `full_backup_content.xml` before
Android 12) include that file and nothing else. The unfinished board, sheet
state, the tutorial marker, WebView caches and the share picture stay on the
device. On the first launch of a new install the restored values are written
into the page where it has none, and the page reloads once. The list of keys
is `TravelingData.KEYS`; a new setting travels only if it is added there.
`capacitor.config` is
`.js` because `@capacitor/cli` requires a full `typescript` install purely to
read a `.ts` config, which is not worth a toolchain in a repo with no TS source.

## Updating the games

The payload is a pinned snapshot, not a live dependency. To pull in sphere
changes, from the repository root:

```bash
python3 tools/export-collection.py --app     # writes build/app/
cp -R build/app/. app/www/
```

Then refresh `WWW_SOURCE.txt` (source commit + `shasum -a 256` of each file
under `www/`) and re-run the smoke script. Normally use reviewed canonical
`main`; document any deliberately bounded maintenance snapshot and its baseline.
Commit the source change before the native payload update: CI checks out
the exact `WWW_SOURCE.txt` commit of this repository and regenerates the
payload, so a stale `www/` fails the build. `WWW_SOURCE.txt` identifies the
exact commit used for this snapshot.

The current payload pins `42a1ae6`, a bounded maintenance line on the
`c91cd20` snapshot (the October 7, 2026 baseline with the focus fixes, opening
straight to the board). It adds, and nothing else:
Help keeps the classic Minesweeper screenshot, as on the web (a swap to the
project's own board was tried on this line and reverted at the owner's
instruction on November 12, 2026).

- the reflection materials with no known source are gone (the change main
  took in #13), and so is Stratosphere, pulled at the owner's instruction on
  November 12, 2026. The Themes tab shows seven themes;
- the gesture fixes main took in #15;
- a Licenses page (`www/notices.html`) linked from the foot of the sheet;
- each page reports its background color to the Android shell, which paints
  the strip beside a camera cutout to match;
- plain punctuation in Help and the tutorial, and a sheet that does not clip
  at large system text.
- the share card has a solid background on the photo themes.

This payload update does not create or upload an iOS or Android release. See
[release notes](docs/RELEASE.md) for the distinction between payload checks
and published builds.

## Verify

```bash
pnpm install
pnpm smoke                                          # integrity + cap sync
scripts/smoke.sh --with-source ..                   # + matches source
pnpm cap:open:ios                                   # Xcode
pnpm cap:open:android                               # Android Studio
pnpm android:build:debug                            # debug APK
pnpm android:bundle:release                         # unsigned release AAB, app.hexodus.ios
pnpm android:bundle:play                            # unsigned release AAB with the Play application id
```

The iOS shell uses the UIScene life cycle (`ios/App/App/SceneDelegate.swift` and
`UIApplicationSceneManifest` in `Info.plist`). Keep both: UIKit refuses to
launch an app built with the iOS 27 SDK without them (Apple TN3187). To check
a build, launch it on an iOS 27 simulator and confirm the log has no
"UIScene life cycle is required" line.

[Capacitor 8](https://capacitorjs.com/docs/android) requires Node 22+, Android
Studio 2025.2.1+, an Android SDK, and API 24 or newer. Building from the
command line needs JDK 21 and the Android SDK platform 36 (CI also installs
build-tools 36.0.0). `scripts/android-build.sh` picks JDK 21 through
`/usr/libexec/java_home` on macOS; on Linux, or when JDK 21 is not registered
there (a Homebrew install, for example), set `JAVA_HOME` yourself.
Generated artifacts live under `android/app/build/outputs/` and remain
gitignored. The shell requests no sensitive permissions and deliberately omits
`android.permission.INTERNET`; outbound credits open in the system browser.

The Android AAB is intentionally unsigned until a Play signing key is created
and stored outside this repository. The Amazon Fire-tablet APK uses a separate
release identity supplied through the `HEXSWEEPER_ANDROID_*` environment
variables that `android/app/build.gradle` reads; its staged artifact
and device evidence are documented in
[`android/AMAZON-RELEASE.md`](android/AMAZON-RELEASE.md). Signed `1.0.4 (29)`
uses the Fire-tuned path for both direct and ambient XL rotation. See
[`docs/RELEASE.md`](docs/RELEASE.md). The recorded September 4 submission
was accepted for review at 08:54 AM PDT. That historical receipt does not
establish the current Amazon review state.

The direct download page serves signed `1.0.11 (36)`, dated November 14,
2026; before that it served `1.0.6 (31)`, dated November 3. The download moved to `1.0.5 (30)` on October 2, 2026 with web payload
`7ece656`, so dragging the sphere follows the finger on both axes, as on
iPhone. The recorded Amazon submission uses `1.0.4 (29)`.

## Not in this build

**Earth and Moon globe themes are excluded** (the web has shelved them too).
They are the only themes that
fetch anything at runtime: `globeUrl()` in `sphere.js` only resolves textures
relatively under a `/sphere/` path, so inside a `capacitor://` WebView it falls
back to an absolute `dr.eamer.dev` URL and the theme silently degrades with no
network. Their texture provenance is recorded in this repository's
[`sphere/assets/textures/README.md`](../sphere/assets/textures/README.md).
The Themes tab
exposes seven themes: Light, Dark, Mercury, Ion Storm, Aurora, Galaxy and
Heat Lightning. The web build registers eight, the same seven plus
Stratosphere. Mercury's mirrored body is a WebGL2 shader with no texture
asset; Galaxy, Ion Storm and Heat Lightning carry their 768px images sealed
as data URIs (about 160KB of base64 together). Without WebGL each falls back to a
plain field in its own palette.

## License

MIT; see [LICENSE](LICENSE). The sealed payload in `www/` embeds the IBM Plex
Sans and IBM Plex Mono fonts under the SIL Open Font License 1.1; see
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). Capacitor is fetched by the
package managers at build time and is not checked in.
