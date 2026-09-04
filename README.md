# Hexsweeper (iOS + Android)

Native Capacitor shell for **Hexsweeper 3D** — hex minesweeper on a closed
sphere. The game is the Canvas/vanilla-JS build from
[lukeslp/hexsweeper](https://github.com/lukeslp/hexsweeper) (`sphere/`); this
repo wraps it for iOS and Android as one sealed offline page.

The app opens straight into the sphere, which restores its own unfinished run
without asking. The fixed chrome is a quiet bar: **Undo · New sphere · Flag**
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

Web version: <https://dr.eamer.dev/games/hexsweeper/>

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
| `ios/` | Xcode project, team `596T7J7FB6`, automatic signing |
| `android/` | Generated Capacitor Android project, API 24–36 |
| `scripts/smoke.sh` | Payload integrity + cap sync gates |
| `scripts/android-build.sh` | JDK-21 Gradle wrapper for APK/AAB builds |

There is no bundler, no TypeScript, and no web test suite here. `www/index.html` is
the sealed Sphere game — one self-contained file with fonts, CSS, and all JS
(engine, WebGL material renderer, quiet chrome) inlined; the only other asset is
the help sheet's history image under `www/assets/`. There is nothing to
navigate to and no back affordance to need. One local native plugin,
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
under `www/`) and re-run the smoke script. CI checks out `hexsweeper` and
regenerates the payload, so a stale `www/` fails the build.

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
release identity managed by the Android release toolkit; its staged artifact
and device evidence are documented in
[`android/AMAZON-RELEASE.md`](android/AMAZON-RELEASE.md). Signed `1.0.4 (29)`
uses the Fire-tuned path for both direct and ambient XL rotation. See
[`docs/RELEASE.md`](docs/RELEASE.md).

## Not in this build

**Earth and Moon globe themes are excluded.** They are the only themes that
fetch anything at runtime — `globeUrl()` in `sphere.js` only resolves textures
relatively under a `/sphere/` path, so inside a `capacitor://` WebView it falls
back to an absolute `dr.eamer.dev` URL and the theme silently degrades with no
network. Their daymap provenance is also unrecorded. The fourteen offline themes
(Light, Shell, Dark, Ink, Float, Card, Glow, Mercury, Stratosphere, Ion Storm,
Aurora, Galaxy, Gilded Ribbon, Heat Lightning) ship; the web build keeps all
sixteen. Mercury's mirrored body is a WebGL2 shader
with no texture asset; The textured materials carry their small
files sealed as data URIs (about 310KB together). Without WebGL each falls back to a
plain field in its own palette.
