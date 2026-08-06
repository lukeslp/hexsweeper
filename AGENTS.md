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

After changing `index.html`, `core.js`, `skin-chrome.css`, or `fonts/`, regenerate:

```bash
python3 tools/export-collection.py
```

Do not hand-edit `collection/theme-*.html` — they are generated. The desk UI lives in `tools/export-collection.py` (`write_index`). Light/Dark ship as `theme-plate.html` with `allowModes`; do not re-split them into separate pens.

## Choices lab exports

After changing `core.js`, `skin-chrome.css`, `classic.html`, or `skins/*`, regenerate:

```bash
python3 tools/export-choices-lab.py
```

Do not hand-edit `choices/lab/*.html` — they are generated from `skins.json` + skin sources. Each page is self-contained (inlined engine + chrome) with **Copy for CodePen**; the copy strips the lab header bar.

## Safety

No new public ports. No secrets in this tree. Prefer loopback + Caddy for any future backend (none required today).
