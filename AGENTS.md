# Hexsweeper — agent notes

## Workspace

Canonical root: `/home/coolhand/www/dr.eamer.dev/games/hexsweeper/`  
(`~/dr.eamer.dev` → `~/www/dr.eamer.dev`)

Saved edits are live on the public site. Prefer small, verified changes; probe `https://dr.eamer.dev/games/hexsweeper/` after UI work.

## Product surface

Production is **only** Light / Dark / Fire / Plague / Escape in `index.html`. Do not re-expose the skin lab from the main game chrome. Lab files stay for technique reference.

## Docs to keep in sync

- `README.md` — install-free usage, layout, API
- `PROJECT_PLAN.md` — objectives and outstanding work
- File banners on `core.js`, `skin-chrome.css`, and other code entrypoints

## Safety

No new public ports. No secrets in this tree. Prefer loopback + Caddy for any future backend (none required today).
