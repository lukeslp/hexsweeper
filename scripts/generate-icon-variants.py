#!/usr/bin/env python3
"""Render light + dark app-icon CANDIDATES from the real Hexsweeper 3D sphere.

Adapted from hexsweeper-app/scripts/generate-icon.py. Does NOT touch the repo
asset catalog — writes two standalone 1024x1024 PNGs into this directory.

Variants (theme indices in the app payload, where globe themes are filtered):
  light -> theme 3 "Ink"   (black covered cells on a white field, white wells)
  dark  -> theme 1 "Shell" (white covered cells on a black field, black wells)

Both are the game's own stark mono themes: flat fills, no float shadow, so the
sphere silhouette crops cleanly against a pure background.
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops

REPO = Path("/Users/luke/workspace/hexsweeper-app")
OUT_DIR = Path(__file__).resolve().parent

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

VARIANTS = [
    # (slug, theme index, background RGB)
    ("light", 3, (255, 255, 255)),  # Ink: black shell on white field
    ("dark", 1, (0, 0, 0)),         # Shell: white shell on black field
]

# The shipped script's floodFrom() approach never places mines (placement
# happens on the first real reveal()), so a fresh board floods entirely open
# with zero numbers. reveal() is not on the boot API, so instead we mutate
# state directly: seed mines deterministically, recount neighborMines from
# tile adjacency, and mark most safe cells revealed with animReveal=1 so
# wells and digits draw on the next frame. Background is forced to the
# variant's field colour so the screenshot edge matches the crop backdrop.
RENDER_HARNESS = """
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
    var g = window.__iconShot;
    g.setThemeIndex(__THEME__);
    var st = g.getState();
    var cells = st.cells || [];
    var tiles = st.tiles || [];
    st.isFirstClick = false;

    // Deterministic LCG so both variants get the same board.
    var seed = 1337;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

    // Place the difficulty's own mine count.
    var target = 0;
    try { target = g.mineTargetForDifficulty(st.difficulty) || 0; } catch (e) {}
    if (!target) target = Math.round(cells.length * 0.12);
    var placed = 0, guard = 0;
    while (placed < target && guard++ < 50000) {
      var m = Math.floor(rnd() * cells.length);
      if (!cells[m].isMine) { cells[m].isMine = true; placed++; }
    }
    for (var i = 0; i < cells.length; i++) {
      var n = 0;
      var nbrs = tiles[i].neighborIndices || [];
      for (var k = 0; k < nbrs.length; k++) if (cells[nbrs[k]].isMine) n++;
      cells[i].neighborMines = n;
    }

    // Reveal ~72% of safe cells: wells + digits show, but leftover covered
    // tiles keep the hex shell readable — same partly-played intent as the
    // shipped Glow icon.
    for (var j = 0; j < cells.length; j++) {
      var c = cells[j];
      if (c.isMine) continue;
      if (rnd() < 0.72) {
        c.revealed = true;
        c.animReveal = 1;
        c.visualDue = 0;
        c.pulseAt = -1e9;
        c.endFlash = 0;
      }
    }
    document.title = 'SHOT ok';
  } catch (e) { document.title = 'SHOT_ERR ' + e.message; }
}, 1200);
</script>
"""


def render_game(out: Path, theme_index: int, bg_css: str, size: int = 1200) -> Path:
    src = (REPO / "www/games/sphere.html").read_text(encoding="utf-8")
    boot = 'initDevChrome(SphereSweeper.boot({ canvasId: "gameCanvas" }));'
    if boot not in src:
        sys.exit("generate-variants: boot call not found in www/games/sphere.html")
    src = src.replace(
        boot,
        'window.__iconShot = SphereSweeper.boot({ canvasId: "gameCanvas" }); initDevChrome(window.__iconShot);',
        1,
    )
    harness_html = RENDER_HARNESS.replace("__THEME__", str(theme_index)).replace("__BG__", bg_css)
    harness = Path(tempfile.mkdtemp()) / "shot.html"
    harness.write_text(src.replace("</body>", harness_html + "</body>", 1), encoding="utf-8")

    # Chrome occasionally wedges in headless screenshot mode; isolate each run
    # in its own profile dir and retry once on a hang.
    for attempt in range(2):
        profile = Path(tempfile.mkdtemp()) / "profile"
        try:
            subprocess.run(
                [CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
                 "--disable-extensions", f"--user-data-dir={profile}",
                 "--virtual-time-budget=9000", "--timeout=30000",
                 f"--window-size={size},{size}",
                 f"--screenshot={out}", f"file://{harness}"],
                check=True, capture_output=True, timeout=90,
            )
            break
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError) as exc:
            print(f"render attempt {attempt + 1} failed: {type(exc).__name__}", file=sys.stderr)
            if attempt == 1:
                raise
    if not out.is_file():
        sys.exit("generate-variants: Chrome produced no screenshot")
    return out


def crop_to_sphere(img: Image.Image, backdrop_rgb: tuple, pad_frac: float = 0.08) -> Image.Image:
    """Square-crop to the sphere against the variant's own field colour.

    Slightly more pad than the shipped script (0.08 vs 0.06): rim cells that
    are revealed wells share the field colour, so the bbox can run a touch
    tight on the played side.
    """
    backdrop = Image.new("RGB", img.size, backdrop_rgb)
    lit = ImageChops.difference(img.convert("RGB"), backdrop).convert("L")
    box = lit.point(lambda v: 255 if v > 10 else 0).getbbox()
    if not box:
        sys.exit("generate-variants: render looks empty — sphere never drew")

    left, top, right, bottom = box
    cx, cy = (left + right) / 2, (top + bottom) / 2
    half = max(right - left, bottom - top) / 2 * (1 + pad_frac)
    side = min(half, cx, cy, img.width - cx, img.height - cy)
    return img.crop((round(cx - side), round(cy - side), round(cx + side), round(cy + side)))


def write_icon(sphere: Image.Image, backdrop_rgb: tuple, out: Path) -> None:
    # Same inset as the shipped icon script: iOS mask-crops the 1024 square,
    # so keep the sphere at 84% and let the mask trim field, not rim.
    icon = Image.new("RGB", (1024, 1024), backdrop_rgb)
    art = round(1024 * 0.84)
    icon.paste(sphere.resize((art, art), Image.LANCZOS), ((1024 - art) // 2, (1024 - art) // 2))
    icon.save(out)
    print(f"wrote {out} (1024x1024)")


def main() -> int:
    for slug, theme_index, bg in VARIANTS:
        bg_css = "#%02x%02x%02x" % bg
        render = Path(tempfile.mkdtemp()) / f"render-{slug}.png"
        render_game(render, theme_index, bg_css)
        sphere = crop_to_sphere(Image.open(render).convert("RGB"), bg)
        print(f"{slug}: cropped sphere {sphere.width}x{sphere.height}")
        write_icon(sphere, bg, OUT_DIR / f"hexsweeper-{slug}-1024.png")
        # Keep the raw render beside the icon for inspection.
        Image.open(render).save(OUT_DIR / f"raw-{slug}.png")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
