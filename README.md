# Hexsweeper (iOS)

Native iOS shell for **Hexsweeper** — hex minesweeper in three shapes. The games
are Canvas/vanilla-JS builds from
[lukeslp/hexsweeper](https://github.com/lukeslp/hexsweeper); this repo wraps them
in Capacitor and ships them to the App Store.

The app opens on a picker offering the three choices that are actually
structural. Everything else — theme, board size, count style — is a setting
inside a game, not a peer of it, so it does not appear in the picker.

| Mode | Board | Source |
|---|---|---|
| **Infinite** | Grows as you dig; Light/Dark keeps the run | `collection/theme-plate.html` |
| **Bounded** | Fixed hex board, neumorph | `collection/skin-classic.html` |
| **Sphere** | Closed Goldberg sphere, 3D | `sphere/` |

Web version: <https://dr.eamer.dev/games/hexsweeper/sphere/>

## The names do not match, on purpose

| Thing | Value |
|---|---|
| Product / display name | **Hexsweeper** |
| This repo | `lukeslp/hexsweeper-app` |
| Game source | `lukeslp/hexsweeper` (`sphere/`) |
| Bundle id | `app.hexodus.ios` |
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
| `scripts/smoke.sh` | Payload integrity + cap sync gates |

There is no bundler, no TypeScript, and no test suite here. `www/index.html` is
the picker and each `www/games/*.html` is one self-contained file with fonts,
CSS, and all JS already inlined; the only shared asset is the sphere help
screen's history image under `www/assets/`. Navigation between them is plain
links, and every game carries a top-left **‹ Games** pill — the WebView has no
browser back, and the bottom-right corner is already spoken for by each game's
own chrome. `capacitor.config` is
`.js` because `@capacitor/cli` requires a full `typescript` install purely to
read a `.ts` config, which is not worth a toolchain in a repo with no TS source.

## Updating the games

The payload is a pinned snapshot, not a live dependency. To pull in changes to
any of the three games, or to the picker, from a `hexsweeper` checkout:

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
pnpm cap:open                                       # Xcode
```

## Not in this build

**Earth and Moon globe themes are excluded.** They are the only themes that
fetch anything at runtime — `globeUrl()` in `sphere.js` only resolves textures
relatively under a `/sphere/` path, so inside a `capacitor://` WebView it falls
back to an absolute `dr.eamer.dev` URL and the theme silently degrades with no
network. Their daymap provenance is also unrecorded. The seven offline themes
(Light, Shell, Dark, Ink, Float, Card, Glow) ship; the web build keeps all nine.
