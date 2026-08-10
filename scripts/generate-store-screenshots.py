#!/usr/bin/env python3
"""Render App Store screenshots from the real shipped payload.

Five portrait iPhone 6.9" (1320x2868) shots into app-store/screenshots/en-US/.
Tall phone-sized headless viewports wedge this Chrome build, so each shot is
rendered as a square (the size that provably works) and composited onto the
device-size canvas with a caption band — the artwork is still the real game.

  01 sphere, Glow theme, partly played (hero)
  02 sphere, Ink theme (light), partly played
  03 infinite board
  04 bounded board
  05 the mode picker

Usage: python3 scripts/generate-store-screenshots.py  (needs Chrome + Pillow)
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[1]
OUT_DIR = REPO / "app-store/screenshots/en-US"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FONT = "/System/Library/Fonts/Supplemental/Futura.ttc"

W, H = 1320, 2868
# 1200 square is the render size that provably completes; the Glow theme's
# animation loop never lets virtual time settle headlessly, so the sphere
# shots use the stark Shell/Ink themes (which also match the app icon).
RENDER_SIZE = 1200

PLAY_HARNESS = """
<style>
  .hud-stats,.hud-actions,.hud-cluster,.legacy-hud,.customize-panel,
  .help-overlay,.help-panel,.sphere-banner,.count-style-toast,.lightbox,
  .app-back
  { display:none !important; visibility:hidden !important; }
  html,body { background:__BG__ !important; }
</style>
<script>
setTimeout(function () {
  try {
    var g = window.__shot;
    g.setThemeIndex(__THEME__);
    var st = g.getState();
    var cells = st.cells || [];
    var tiles = st.tiles || [];
    st.isFirstClick = false;
    var seed = 24601;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    var target = 0;
    try { target = g.mineTargetForDifficulty(st.difficulty) || 0; } catch (e) {}
    if (!target) target = Math.round(cells.length * 0.12);
    var placed = 0, guard = 0;
    while (placed < target && guard++ < 50000) {
      var m = Math.floor(rnd() * cells.length);
      if (!cells[m].isMine) { cells[m].isMine = true; placed++; }
    }
    for (var i = 0; i < cells.length; i++) {
      var n = 0, nbrs = tiles[i].neighborIndices || [];
      for (var k = 0; k < nbrs.length; k++) if (cells[nbrs[k]].isMine) n++;
      cells[i].neighborMines = n;
    }
    for (var j = 0; j < cells.length; j++) {
      var c = cells[j];
      if (c.isMine) continue;
      if (rnd() < 0.6) { c.revealed = true; c.animReveal = 1; c.visualDue = 0; c.pulseAt = -1e9; c.endFlash = 0; }
    }
    document.title = 'SHOT ok';
  } catch (e) { document.title = 'SHOT_ERR ' + e.message; }
}, 1200);
</script>
"""

# (filename, source, sphere theme index or None, crop-to-sphere?, canvas bg, caption fg, caption)
SHOTS = [
    ("01-sphere-shell.png", "games/sphere.html", 1, True, "#000000", "#f5f7ff", "Minesweeper, bent\naround a sphere"),
    ("02-sphere-ink.png", "games/sphere.html", 3, True, "#ffffff", "#111111", "Seven looks, light\nto lights-out"),
    ("03-infinite.png", "games/infinite.html", None, False, "#07080c", "#f5f7ff", "Endless boards when\nyou want flat"),
    ("04-bounded.png", "games/bounded.html", None, False, "#07080c", "#f5f7ff", "Classic bounded\nboards too"),
    ("05-picker.png", "index.html", None, False, "#07080c", "#f5f7ff", "Three games. Offline.\nNo accounts."),
]


def render_square(src_rel: str, theme_index, bg_css: str, out: Path) -> None:
    src_path = REPO / "www" / src_rel
    if theme_index is None:
        # No harness needed: render in place so relative assets/ resolve.
        page = src_path
        return chrome_shot(page, out)
    html = src_path.read_text(encoding="utf-8")
    if theme_index is not None:
        boot = 'initDevChrome(SphereSweeper.boot({ canvasId: "gameCanvas" }));'
        if boot not in html:
            sys.exit("boot call not found in sphere.html")
        html = html.replace(
            boot,
            'window.__shot = SphereSweeper.boot({ canvasId: "gameCanvas" }); initDevChrome(window.__shot);',
            1,
        )
        html = html.replace(
            "</body>",
            PLAY_HARNESS.replace("__THEME__", str(theme_index)).replace("__BG__", bg_css) + "</body>",
            1,
        )
    page = Path(tempfile.mkdtemp()) / src_path.name
    page.write_text(html, encoding="utf-8")
    chrome_shot(page, out)


def chrome_shot(page: Path, out: Path) -> None:
    for attempt in range(2):
        profile = Path(tempfile.mkdtemp()) / "profile"
        try:
            subprocess.run(
                [CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
                 "--disable-extensions", f"--user-data-dir={profile}",
                 "--virtual-time-budget=9000", "--timeout=30000",
                 f"--window-size={RENDER_SIZE},{RENDER_SIZE}",
                 f"--screenshot={out}", f"file://{page}"],
                check=True, capture_output=True, timeout=120,
            )
            break
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError) as exc:
            print(f"render attempt {attempt + 1} failed: {type(exc).__name__}", file=sys.stderr)
            if attempt == 1:
                raise
    if not out.is_file():
        sys.exit(f"no screenshot produced for {page}")


def crop_to_sphere(img: Image.Image, backdrop_hex: str, pad_frac: float = 0.07) -> Image.Image:
    backdrop_rgb = tuple(int(backdrop_hex[i:i + 2], 16) for i in (1, 3, 5))
    backdrop = Image.new("RGB", img.size, backdrop_rgb)
    lit = ImageChops.difference(img.convert("RGB"), backdrop).convert("L")
    box = lit.point(lambda v: 255 if v > 10 else 0).getbbox()
    if not box:
        sys.exit("render looks empty — board never drew")
    left, top, right, bottom = box
    cx, cy = (left + right) / 2, (top + bottom) / 2
    half = max(right - left, bottom - top) / 2 * (1 + pad_frac)
    side = min(half, cx, cy, img.width - cx, img.height - cy)
    return img.crop((round(cx - side), round(cy - side), round(cx + side), round(cy + side)))


def compose(art: Image.Image, bg: str, fg: str, caption: str, out: Path) -> None:
    canvas = Image.new("RGB", (W, H), bg)
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(FONT, 96)
    lines = caption.split("\n")
    y = 190
    for line in lines:
        box = draw.textbbox((0, 0), line, font=font)
        draw.text(((W - (box[2] - box[0])) / 2, y), line, font=font, fill=fg)
        y += (box[3] - box[1]) + 34
    art_side = W - 80
    art_scaled = art.resize((art_side, art_side), Image.LANCZOS)
    canvas.paste(art_scaled, ((W - art_side) // 2, y + 170))
    canvas.save(out)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for filename, src_rel, theme_index, do_crop, bg, fg, caption in SHOTS:
        if (OUT_DIR / filename).is_file():
            print(f"{filename}: exists, skipping (delete to regenerate)")
            continue
        raw = Path(tempfile.mkdtemp()) / "raw.png"
        render_square(src_rel, theme_index, bg, raw)
        img = Image.open(raw).convert("RGB")
        art = crop_to_sphere(img, bg) if do_crop else img
        compose(art, bg, fg, caption, OUT_DIR / filename)
        w, h = Image.open(OUT_DIR / filename).size
        print(f"{filename}: {w}x{h}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
