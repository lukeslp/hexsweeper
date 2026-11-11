# Hexsweeper (iOS + Android)

Native Capacitor shell for **Hexsweeper 3D** — hex minesweeper on a closed
sphere. The game is the Canvas/vanilla-JS build from
[lukeslp/hexsweeper](https://github.com/lukeslp/hexsweeper) (`sphere/`); this
repo wraps it for iOS and Android as a sealed offline payload.

The app opens straight into the sphere, which restores its own unfinished run
without asking. On a fresh native launch, a short tutorial introduces Tap,
Hold, Drag, and the controls; Play dismisses it and records that it was seen.
Returning players go straight to their board. The fixed chrome is a quiet bar:
**Undo · New sphere · Flag**
(red while armed) bottom left, **?** bottom right, and a small mines-left ·
seconds readout at the top. Everything else — theme (Light · Dark ·
Stratosphere · Mercury · Ion Storm · Aurora · Galaxy · Gilded Ribbon · Heat
Lightning), board size with your best time per size, drag inversion, effects,
the tutorial — lives behind **?**, on four tabs (Play · Themes · Board · Settings). Hold the mine count and water rises through
it — keep holding, or tap the little wave button on the sheet's Board tab —
and you drop into the **Water Wheel**, a hidden second sphere
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

The web game opens the board immediately, including on a first visit or when
browser storage is blocked. Instructions are optional: **? → Play**, then
**Show the tutorial again** for the short intro. Web and native use the same
Play · Themes · Board · Settings sheet; a Keys tab appears for keyboard users.
The native first-launch intro is the intended entry difference.

## Flip cover testing — November 4, 2026

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

## The names do not match, on purpose

| Thing | Value |
|---|---|
| Product / display name | **Hexsweeper** |
| This repo | `lukeslp/hexsweeper-app` |
| Game source | `lukeslp/hexsweeper` (`sphere/`) |
| iOS bundle id / Android application id | `app.hexodus.ios` |
| App Store Connect record | app id `6768871973` |

The bundle id is inherited. It was minted for "Hexodus", an unrelated hex
roguelike with an on-device LLM antagonist that was built here and abandoned;
its App Store Connect record was separately named "Hivescape" and holds builds
1–6, none ever submitted. Reusing the id keeps that record rather than opening a
fresh one, since its metadata had to be rewritten either way. **`CURRENT_PROJECT_VERSION`
therefore starts at 7** — anything ≤6 is rejected as a duplicate build number.

Do not "fix" the bundle id to match the product name. Changing it means a new
App Store Connect app and abandoning this one.

## Layout

| Path | Role |
|---|---|
| `www/` | The game. Vendored payload — **do not hand-edit** |
| `WWW_SOURCE.txt` | Which hexsweeper commit `www/` came from, plus checksums |
| `capacitor.config.js` | Capacitor config (`.js`, not `.ts` — see below) |
| `ios/` | Xcode project, automatic signing (set your own `DEVELOPMENT_TEAM` to build for a device) |
| `android/` | Generated Capacitor Android project, API 24–36 |
| `scripts/smoke.sh` | Payload integrity + cap sync gates |
| `scripts/android-build.sh` | JDK-21 Gradle wrapper for APK/AAB builds |
| `app-store/` | Store listing copy and screenshots |
| `licenses/`, `THIRD-PARTY-NOTICES.md` | Notices for bundled third-party material |

There is no bundler, no TypeScript, and no web test suite here. `www/index.html` is
the sealed Sphere game — one self-contained file with fonts, CSS, and all JS
(engine, WebGL material renderer, quiet chrome) inlined. `www/wheel.html` is
the sealed Water Wheel, and the help sheet's history image is under
`www/assets/`. The Wheel's Sphere pill returns to the saved sphere. One local
native plugin,
`HexShare` (in `AppDelegate.swift`, registered by `HexBridgeViewController`),
presents the finished-board card as a `UIImage` in the iOS share sheet so
image-capable apps appear; the web build's Web Share path is the fallback.
`capacitor.config` is
`.js` because `@capacitor/cli` requires a full `typescript` install purely to
read a `.ts` config, which is not worth a toolchain in a repo with no TS source.

## Updating the games

The payload is a pinned snapshot, not a live dependency. To pull in sphere
changes from a `hexsweeper` checkout:

```bash
python3 tools/export-collection.py --app     # writes build/app/
cp -R build/app/. ../hexsweeper-app/www/
```

Then refresh `WWW_SOURCE.txt` (source commit + `shasum -a 256` of each file
under `www/`) and re-run the smoke script. Normally use reviewed canonical
`main`; document any deliberately bounded maintenance snapshot and its baseline.
Push the source change before the native payload update: CI checks out
`lukeslp/hexsweeper-private-history` at the exact `WWW_SOURCE.txt` commit and
regenerates the payload, so a stale `www/` fails the build. The public source
repository is `lukeslp/hexsweeper`; `WWW_SOURCE.txt` identifies the exact
canonical commit used for this snapshot.

The current payload pins `f7d7546`, bounded focus and Help-restoration updates over `d0082f7`
(October 7, 2026): Sphere's settings
use flat theme swatches, compact board-size choices, and icon-led settings
rows. The first-launch tutorial and game behavior are unchanged. The
menu system remains an open design item in the source repository. This payload update does not create
or upload an iOS/Android release. See [release notes](docs/RELEASE.md) for the
distinction between payload checks and published builds.

## Verify

```bash
pnpm install
pnpm smoke                                          # integrity + cap sync
scripts/smoke.sh --with-source ../hexsweeper        # + matches source
pnpm cap:open:ios                                   # Xcode
pnpm cap:open:android                               # Android Studio
pnpm android:build:debug                            # debug APK
pnpm android:bundle:release                         # unsigned release AAB
```

[Capacitor 8](https://capacitorjs.com/docs/android) requires Node 22+, Android
Studio 2025.2.1+, an Android SDK, and API 24 or newer. Local Android builds
select JDK 21 automatically on macOS.
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

The direct download moved to signed `1.0.5 (30)` on October 2, 2026. It carries
web payload `7ece656`, so dragging the sphere follows the finger on both axes,
as on iPhone. The recorded Amazon submission uses `1.0.4 (29)`.

## Not in this build

**Earth and Moon globe themes are excluded.** They are the only themes that
fetch anything at runtime — `globeUrl()` in `sphere.js` only resolves textures
relatively under a `/sphere/` path, so inside a `capacitor://` WebView it falls
back to an absolute `dr.eamer.dev` URL and the theme silently degrades with no
network. Their texture provenance is recorded in the source repository's
[`sphere/assets/textures/README.md`](https://github.com/lukeslp/hexsweeper/blob/main/sphere/assets/textures/README.md).
The fourteen offline themes
(Light, Shell, Dark, Ink, Float, Card, Glow, Mercury, Stratosphere, Ion Storm,
Aurora, Galaxy, Gilded Ribbon, Heat Lightning) ship; the web build keeps all
sixteen. Mercury's mirrored body is a WebGL2 shader
with no texture asset; The textured materials carry their small
files sealed as data URIs (about 310KB together). Without WebGL each falls back to a
plain field in its own palette.

## License

MIT; see [LICENSE](LICENSE). The sealed payload in `www/` embeds the IBM Plex
Sans and IBM Plex Mono fonts under the SIL Open Font License 1.1; see
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). Capacitor is fetched by the
package managers at build time and is not checked in.
