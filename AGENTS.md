# Hexsweeper — agent notes

## Workspace

Canonical (live): `/home/coolhand/www/dr.eamer.dev/games/hexsweeper/`  
(`~/dr.eamer.dev` → `~/www/dr.eamer.dev`)

Beast mirror: `/Users/luke/workspace/hexsweeper` · remote `lukeslp/hexsweeper`

Saved edits on Drummer are live on the public site. Prefer: edit → verify locally or via public URL → commit → push → `git pull` on Drummer so disk matches git.

## Product surface

Production is **only** Light / Dark / Fire / Plague / Escape in `index.html`. Do not re-expose the skin lab from the main game chrome. Lab files stay for technique reference.

## Docs to keep in sync

- `README.md` — install-free usage, layout, API
- `PROJECT_PLAN.md` — objectives and outstanding work
- File banners on `core.js`, `skin-chrome.css`, and other code entrypoints

## Collection exports

After changing `index.html`, `core.js`, `skin-chrome.css`, `fonts/`, `classic.html`, or `skins/*`, regenerate:

```bash
python3 tools/export-collection.py
python3 tools/export-collection.py --check   # drift guard
```

Do not hand-edit `collection/theme-*.html`, `collection/skin-*.html`, or `collection/sphere.html` — they are generated. The desk UI lives in `tools/export-collection.py` (`write_index`): **Open** + **Copy HTML** on `collection/index.html` only (not on playable pens). Light/Dark ship as `theme-plate.html` with `allowModes`; lab skins ship as `skin-*.html` (game-only: Reset/Menu, no skin nav or Copy bar). **Hexsweeper 3D** ships as `collection/sphere.html` (CodePen-ready inline of `sphere/`) and is listed under Experiments.

After changing OG card keys in `tools/og-card.html`, regenerate PNGs: `bash tools/shoot-og-cards.sh` (Chromium + Pillow on Drummer).

## Choices lab redirects

After changing `skins.json` or collection lab pens, regenerate redirect stubs:

```bash
python3 tools/export-choices-lab.py
```

Do not hand-edit `choices/lab/*.html` — they redirect to `collection/skin-*.html`. Canonical playable + copy-ready HTML lives in `collection/`.

## Safety

No new public ports. No secrets in this tree. Prefer loopback + Caddy for any future backend (none required today).
