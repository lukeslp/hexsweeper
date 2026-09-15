# Hexsweeper — agent notes

## Workspace

Canonical (live): the checkout on the production host is the served web root.  
Development mirror: the build machine's checkout · remote `lukeslp/hexsweeper`

Saved edits on Drummer are live on the public site. Prefer: edit → verify locally or via public URL → commit → push → `git pull` on Drummer so disk matches git.

## Product surface

The public root `index.html` is the Sphere game, sealed from `sphere/` by the
exporter; the native app ships that page and nothing else. `launcher.html` is
generated from `tools/app-launcher.html` and offers the three structural boards: **Infinite**,
**Classic**, and **Sphere**. `infinite.html` and `bounded.html` are generated
product pages; `sphere/` is authored in place (Mercury's WebGL renderer is
`sphere/mirror-material.js`, shared with the reflection studio). The former flat
production surface lives at `play.html` with Light / Dark / Fire / Plague /
Escape. Old root `?mode=` links, and `?theme=` links naming flat-only themes,
are forwarded there by the root page. Water remains a renderer/deep-link archive.
Do not re-expose the skin lab from production chrome.

## Docs to keep in sync

- `README.md` — install-free usage, launcher/routes, layout, API
- `PROJECT_PLAN.md` — objectives and outstanding work
- File banners on `core.js`, `skin-chrome.css`, and other code entrypoints

## Collection exports

After changing `play.html`, `tools/app-launcher.html`, `core.js`,
`skin-chrome.css`, `fonts/`, `classic.html`, or `skins/*`, regenerate:

```bash
python3 tools/export-collection.py
python3 tools/export-collection.py --check   # drift guard
```

Do not hand-edit root `index.html`, `launcher.html`, `infinite.html`, `bounded.html`,
`collection/theme-*.html`, `collection/skin-*.html`, or
`collection/sphere.html` — they are generated. The desk UI lives in
`tools/export-collection.py` (`write_index`): **Open** + **Copy HTML** on
`collection/index.html` only (not on playable pens). Light/Dark ship as
`theme-plate.html` with `allowModes`; lab skins ship as `skin-*.html`
(game-only: Reset/Menu, no skin nav or Copy bar). **Hexsweeper 3D** ships as
`collection/sphere.html` (CodePen-ready inline of `sphere/`) and is listed
under Experiments.

After changing OG card keys in `tools/og-card.html`, regenerate PNGs: `bash tools/shoot-og-cards.sh` (Chromium + Pillow on Drummer).

## Native app payload

`python3 tools/export-collection.py --app` stages `build/app/` (gitignored, never
deployed) for the **hexsweeper-app** Capacitor shell — `lukeslp/hexsweeper-app`,
bundle `app.hexodus.ios`. It reuses `export_sphere` and then seals the page for
offline use: sets `HEXSWEEPER_SPHERE_APP`, serves the history tile from the
bundle, drops the cross-game links, sends credits to the system browser, and
hides the native launch screen after first paint.

`HEXSWEEPER_SPHERE_APP` also drops the **Earth / Moon** globe themes (the THEMES
filter in `sphere.js`): these themes fetch textures over the network. Texture
provenance and attribution are recorded in [the texture source notes](sphere/assets/textures/README.md);
Earth gloss is project artwork and the older daymaps carry Solar System Scope
attribution through Orrery. The web build keeps all nine.

After any sphere change, re-run `--app` and re-vendor into hexsweeper-app's
`www/`; that repo's smoke gate regenerates this payload and fails on drift.

## Choices lab redirects

After changing `skins.json` or collection lab pens, regenerate redirect stubs:

```bash
python3 tools/export-choices-lab.py
```

Do not hand-edit `choices/lab/*.html` — they redirect to `collection/skin-*.html`. Canonical playable + copy-ready HTML lives in `collection/`.

## Safety

No new public ports. No secrets in this tree. Prefer loopback + Caddy for any future backend (none required today).
