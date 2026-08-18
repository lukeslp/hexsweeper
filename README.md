# Hexsweeper (iOS + Android)

Native Capacitor shell for **Hexsweeper** — hex minesweeper in three shapes. The games
are Canvas/vanilla-JS builds from
[lukeslp/hexsweeper](https://github.com/lukeslp/hexsweeper); this repo wraps them
for iOS and Android from the same sealed offline payload.

The app opens straight into **Sphere**. If an unfinished Infinite, Classic, or
Sphere run is saved, a small dialog asks first: resume it, or play Sphere. The
**‹ Games** pill opens the three-hex launcher — **Infinite**, **Classic**,
**Sphere**, each captioned with the setting it will load, with the newest saved
run in the center as a mode-colored **Resume** hex. Style, size, and theme are
changed inside each game.

| Mode | Board | Source |
|---|---|---|
| **Infinite** | Endless flat board; Light/Dark keeps the run | `collection/theme-plate.html` |
| **Classic** | Fixed flat board, neumorph | `collection/skin-classic.html` |
| **Sphere** | Closed 3D Goldberg sphere | `sphere/` |

Internal filenames keep `bounded` for compatibility; that is not a user-facing
mode name. Classic snapshots mines, reveals, flags, size, time, and view state
before the Games transition; only the centered Resume route restores it.

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
the sealed Sphere game (with the resume gate); `www/games/launcher.html` is the
three-hex launcher, and each `www/games/*.html` is one self-contained file with fonts,
CSS, and all JS already inlined; the only shared asset is the sphere help
screen's history image under `www/assets/`. Navigation between them is plain
links, and every game carries a top-left **‹ Games** pill — the WebView has no
browser back, and the bottom-right corner is already spoken for by each game's
own chrome. `capacitor.config` is
`.js` because `@capacitor/cli` requires a full `typescript` install purely to
read a `.ts` config, which is not worth a toolchain in a repo with no TS source.

## Updating the games

The payload is a pinned snapshot, not a live dependency. To pull in changes to
any of the three games, or to the launcher, from a `hexsweeper` checkout:

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
and stored outside this repository. Google Play listing creation, signing,
upload, pricing, and publication remain manual release steps. See
[`docs/RELEASE.md`](docs/RELEASE.md).

## Not in this build

**Earth and Moon globe themes are excluded.** They are the only themes that
fetch anything at runtime — `globeUrl()` in `sphere.js` only resolves textures
relatively under a `/sphere/` path, so inside a `capacitor://` WebView it falls
back to an absolute `dr.eamer.dev` URL and the theme silently degrades with no
network. Their daymap provenance is also unrecorded. The eight offline themes
(Light, Shell, Dark, Ink, Float, Card, Glow, Mercury) ship; the web build keeps
all ten. Mercury's mirrored body is a WebGL2 shader with no texture asset, so it
seals offline; without WebGL it falls back to a plain metal field.
