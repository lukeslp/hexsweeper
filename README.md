# Hexsweeper (iOS)

Native iOS shell for **Hexsweeper 3D** — hex minesweeper on a closed Goldberg
sphere. The game is a Canvas/vanilla-JS build from
[lukeslp/hexsweeper](https://github.com/lukeslp/hexsweeper); this repo wraps it
in Capacitor and ships it to the App Store.

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
a single self-contained file with fonts, CSS, and all JS already inlined; the
only sibling asset is the help screen's history image. `capacitor.config` is
`.js` because `@capacitor/cli` requires a full `typescript` install purely to
read a `.ts` config, which is not worth a toolchain in a repo with no TS source.

## Updating the game

The payload is a pinned snapshot, not a live dependency. To pull in sphere
changes, from a `hexsweeper` checkout:

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
