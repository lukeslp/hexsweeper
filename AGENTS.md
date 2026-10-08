# Hexsweeper — agent notes

## Workspace

Canonical (live): the checkout on the production host is the served web root.  
Development mirror: the build machine's checkout · remote `lukeslp/hexsweeper`

Saved edits on Drummer are live on the public site. Prefer: edit → verify locally or via public URL → commit → push → `git pull` on Drummer so disk matches git.

## Product surface

The public root `index.html` is the Sphere game, sealed from `sphere/` by the
exporter; the native app ships its offline export plus the hidden Water Wheel
and history image. `launcher.html` is
generated from `tools/app-launcher.html` and offers the three structural boards: **Infinite**,
**Classic**, and **Sphere**. It is **unlinked and noindex** (Luke, 2026-10-07):
no game carries a Games pill or links to it; don't re-add either. `infinite.html` and `bounded.html` are generated
product pages; `sphere/` is authored in place (Mercury's WebGL renderer is
`sphere/mirror-material.js`, shared with the reflection studio). The former flat
production surface lives at `play.html` with Light / Dark / Fire / Plague /
Escape. Old root `?mode=` links, and `?theme=` links naming flat-only themes,
are forwarded there by the root page. Water remains a renderer/deep-link archive.
Do not re-expose the skin lab from production chrome.

Every Sphere entry (web root, `sphere/`, pens and the native payload) opens
the board at once: there is no welcome card and no first-launch tutorial, and
nothing opens the sheet uninvited, including when storage is blocked. A first
visit gets one quiet status cue above the bar (the count-style toast) and that
marks `hexsweeper-sphere-welcome-v1`; `?welcome=1` still previews the sheet.
Help lives behind ? only: the Play tab is one line of what to do plus three
gesture rows (Tap / Hold / Drag), no paragraphs, and no `title=` tooltips
anywhere on the page (aria-labels carry the names). Keep it that way.

Infinite (`infinite.html`) follows the same rule and shares Sphere's sheet. The
exporter's `minimal_flat_help` replaces play.html's Menu and Help with one
Sphere-style sheet (Play · Look · Settings), copies Sphere's CSS between the
`sheet:begin` / `sheet:end` markers in `sphere/index.html` verbatim (restyle the
sheet there, for both pages), drops the welcome card and strips every `title=`.
Tab panels share one grid cell, so neither sheet changes height between tabs.
Its chrome follows the minimal brief (`game-riffs/docs/design/minimal-brief.md`):
the exporter swaps play.html's glass pill for `INFINITE_CHROME` (CSS between
`chrome:begin` / `chrome:end`): a top readout of cells cleared (an endless board
has no honest "mines left") and a bottom bar of bare `.ib` icons, New board ·
Flag mode on the left and Help and settings on the right, which becomes a 64px
right rail on landscape phones. The score and Flag mode are not repeated in the
sheet. Look offers System · Light · Dark: System (the default) follows
`prefers-color-scheme` live; a Light or Dark pick is kept under
`hexsweeper-infinite-theme-v1`, and System clears it. T cycles the three. `"minimalHelp": true`
in its one-pager config turns on a quiet first-visit cue (the theme toast,
marks `hexsweeper-infinite-welcome-v1`) and keeps runtime titles off
(`Hexsweeper.boot({ tooltips: false })`). play.html, its theme pens and
Classic keep their own sheets and tooltips.

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
Pass card names to shoot only those (`bash tools/shoot-og-cards.sh flux-sphere`) and `BASE=http://127.0.0.1:<port>`
to shoot a local checkout. The `flux-sphere` card writes `flux-sphere/assets/og.png`; it stages its own scene
(seeded deal, an echo) with autosave suspended. Snap Chromium cannot write under `/tmp` or hidden dirs, so
point `WORK=` at a plain directory in `$HOME` when shooting from a worktree outside the repo.

## Frame loop (sphere variants)

`sphere/sphere.js` parks its frame loop when `frameNeedsPaint()` says nothing moves, which is always the case
under reduced motion once the camera settles. A variant that draws something time-limited must ask for the
frame that removes it: Flux's still echo arc books one repaint for its expiry (`scheduleEchoClear` in
`flux-sphere/flux-sphere.js`) instead of calling `requestDraw()` every frame.

## Native app payload

`python3 tools/export-collection.py --app` stages `build/app/` (gitignored, never
deployed) for the **hexsweeper-app** Capacitor shell — `lukeslp/hexsweeper-app`,
bundle `app.hexodus.ios`. It reuses `export_sphere` and then seals the page for
offline use: sets `HEXSWEEPER_SPHERE_APP`, serves the history tile from the
bundle, drops the cross-game links, sends credits to the system browser, and
hides the native launch screen after first paint. It seals `wheel.html` as
the hidden second sphere; like the web, it has no first-launch tutorial.

`HEXSWEEPER_SPHERE_APP` also drops the **Earth / Moon** globe themes (the THEMES
filter in `sphere.js`): these themes fetch textures over the network. Texture
provenance and attribution are recorded in [the texture source notes](sphere/assets/textures/README.md);
Earth gloss is project artwork and the older daymaps carry Solar System Scope
attribution through Orrery. The engine includes sixteen web themes and
fourteen offline themes; the production Themes tab exposes nine choices.

Export from canonical main, after checking the source branch; an older
feature checkout may not match shipped behavior. After any sphere payload
change, re-run `--app` and re-vendor into hexsweeper-app's
`www/`; that repo's smoke gate regenerates this payload and fails on drift.

## Choices lab redirects

After changing `skins.json` or collection lab pens, regenerate redirect stubs:

```bash
python3 tools/export-choices-lab.py
```

Do not hand-edit `choices/lab/*.html` — they redirect to `collection/skin-*.html`. Canonical playable + copy-ready HTML lives in `collection/`.

## Safety

No new public ports. No secrets in this tree. Prefer loopback + Caddy for any future backend (none required today).
