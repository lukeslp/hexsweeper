#!/usr/bin/env python3
"""Build native icons from the game and mirror the committed splash to Android.

The icon is the game, not an illustration of it: this drives the real sphere in
headless Chrome (Glow theme on near-black), crops to the sphere itself, and
writes both native platforms' icon slots. The designed iOS splash is preserved
unless --replace-splash is explicit; Android receives aspect-fill variants of it.

Usage:
    python3 scripts/generate-icon.py [--source path/to/render.png]

With no --source it renders the sphere game from the shipped payload, so the
icon is the real board — partly played — rather than an illustration of it.
Requires Chrome and Pillow.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageOps

REPO = Path(__file__).resolve().parents[1]
ICON_SET = REPO / "ios/App/App/Assets.xcassets/AppIcon.appiconset"
SPLASH_SET = REPO / "ios/App/App/Assets.xcassets/Splash.imageset"
ANDROID_RES = REPO / "android/app/src/main/res"

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BACKDROP = (7, 8, 12)  # matches the render backdrop and LaunchScreen storyboard

# Filenames are fixed by Contents.json; only the pixel size varies per slot.
SPLASH_SLOTS = [("splash-2732x2732-2.png", 2732), ("splash-2732x2732-1.png", 5464), ("splash-2732x2732.png", 8196)]
ANDROID_ICON_SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}

# Glow renders its luminous centres on *cleared* cells, so the board has to be
# played before it looks like anything. Open every safe cell: the icon is then
# a fully-lit sphere rather than a plain grey shell.
RENDER_HARNESS = """
<style>
  .hud-stats,.hud-actions,.hud-cluster,.legacy-hud,.customize-panel,
  .help-overlay,.help-panel,.sphere-banner,.count-style-toast,.lightbox,
  .app-back
  { display:none !important; visibility:hidden !important; }
  html,body { background:#07080c !important; }
</style>
<script>
setTimeout(function () {
  try {
    var g = window.__iconShot;
    g.setThemeIndex(6);                       // glow
    var st = g.getState();
    var cells = st.cells || [];
    // Open most of the board, not all of it: Glow only lights cleared cells, but
    // a fully-cleared sphere makes each leftover covered tile read as a blemish.
    // A partly-played board is both truer to the game and cleaner as artwork.
    var budget = Math.floor(cells.length * 0.72);
    for (var i = 0; i < cells.length && budget > 0; i++) {
      if (!cells[i].isMine && !cells[i].revealed) {
        try { g.floodFrom(i); } catch (e) {}
        budget--;
      }
    }
    document.title = 'SHOT ok';
  } catch (e) { document.title = 'SHOT_ERR ' + e.message; }
}, 1200);
</script>
"""


def render_game(out: Path, size: int = 1200) -> Path:
    """Screenshot the shipped sphere with chrome hidden and Glow applied."""
    src = (REPO / "www/games/sphere.html").read_text(encoding="utf-8")
    boot = 'initDevChrome(SphereSweeper.boot({ canvasId: "gameCanvas" }));'
    if boot not in src:
        sys.exit("generate-icon: boot call not found in www/games/sphere.html")
    src = src.replace(
        boot,
        'window.__iconShot = SphereSweeper.boot({ canvasId: "gameCanvas" }); initDevChrome(window.__iconShot);',
        1,
    )
    harness = Path(tempfile.mkdtemp()) / "shot.html"
    harness.write_text(src.replace("</body>", RENDER_HARNESS + "</body>", 1), encoding="utf-8")

    subprocess.run(
        [CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
         "--virtual-time-budget=9000", f"--window-size={size},{size}",
         f"--screenshot={out}", f"file://{harness}"],
        check=True, capture_output=True,
    )
    if not out.is_file():
        sys.exit("generate-icon: Chrome produced no screenshot")
    return out


def crop_to_sphere(img: Image.Image, pad_frac: float = 0.06) -> Image.Image:
    """Square-crop to the rendered sphere, keeping it centred with a little air."""
    backdrop = Image.new("RGB", img.size, BACKDROP)
    lit = ImageChops.difference(img.convert("RGB"), backdrop).convert("L")
    box = lit.point(lambda v: 255 if v > 10 else 0).getbbox()
    if not box:
        sys.exit("generate-icon: render looks empty — sphere never drew")

    left, top, right, bottom = box
    cx, cy = (left + right) / 2, (top + bottom) / 2
    half = max(right - left, bottom - top) / 2 * (1 + pad_frac)
    side = min(half, cx, cy, img.width - cx, img.height - cy)
    return img.crop((round(cx - side), round(cy - side), round(cx + side), round(cy + side)))


def write_icon(sphere: Image.Image) -> None:
    ICON_SET.mkdir(parents=True, exist_ok=True)
    # App icons are mask-cropped by iOS and may not carry alpha. Inset the
    # sphere so the rounded-rect mask trims backdrop, not the sphere's rim.
    icon = Image.new("RGB", (1024, 1024), BACKDROP)
    art = round(1024 * 0.84)
    icon.paste(sphere.resize((art, art), Image.LANCZOS), ((1024 - art) // 2, (1024 - art) // 2))
    icon.save(ICON_SET / "AppIcon-512@2x.png")
    print(f"wrote {(ICON_SET / 'AppIcon-512@2x.png').relative_to(REPO)} (1024x1024)")


def write_splash(sphere: Image.Image) -> None:
    SPLASH_SET.mkdir(parents=True, exist_ok=True)
    for name, size in SPLASH_SLOTS:
        canvas = Image.new("RGB", (size, size), BACKDROP)
        # The splash is scaleAspectFill on every device, so keep the sphere small
        # and centred — the edges get cropped away on anything but a square screen.
        art = round(size * 0.34)
        canvas.paste(sphere.resize((art, art), Image.LANCZOS), ((size - art) // 2, (size - art) // 2))
        canvas.save(SPLASH_SET / name)
        print(f"wrote {(SPLASH_SET / name).relative_to(REPO)} ({size}x{size})")


def _sphere_disc(sphere: Image.Image, size: int) -> Image.Image:
    """Return the sphere as a circular RGBA layer with transparent corners."""
    art = sphere.resize((size, size), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    from PIL import ImageDraw

    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    art.putalpha(mask)
    return art


def write_android_assets(
    sphere: Image.Image,
    framed_icon: Image.Image | None = None,
    splash_art: Image.Image | None = None,
) -> None:
    """Write legacy/adaptive launchers and native splash bitmaps."""
    if not ANDROID_RES.is_dir():
        print("android assets skipped (android platform not present)")
        return

    for density, icon_size in ANDROID_ICON_SIZES.items():
        out = ANDROID_RES / f"mipmap-{density}"
        out.mkdir(parents=True, exist_ok=True)

        if framed_icon is not None:
            legacy = framed_icon.convert("RGB").resize((icon_size, icon_size), Image.LANCZOS)
        else:
            legacy = Image.new("RGB", (icon_size, icon_size), BACKDROP)
            art_size = round(icon_size * 0.84)
            legacy.paste(
                sphere.resize((art_size, art_size), Image.LANCZOS),
                ((icon_size - art_size) // 2, (icon_size - art_size) // 2),
            )
        legacy.save(out / "ic_launcher.png")
        legacy.save(out / "ic_launcher_round.png")

        foreground_size = round(icon_size * 2.25)  # 108dp at mdpi
        foreground = Image.new("RGBA", (foreground_size, foreground_size), (0, 0, 0, 0))
        disc_size = round(foreground_size * (0.82 if framed_icon is not None else 0.66))
        disc_source = framed_icon if framed_icon is not None else sphere
        foreground.alpha_composite(
            _sphere_disc(disc_source, disc_size),
            ((foreground_size - disc_size) // 2, (foreground_size - disc_size) // 2),
        )
        foreground.save(out / "ic_launcher_foreground.png")
        print(f"wrote Android {density} launcher assets")

    splash_paths = sorted(ANDROID_RES.glob("drawable*/splash.png"))
    for path in splash_paths:
        with Image.open(path) as existing:
            width, height = existing.size
        if splash_art is not None:
            canvas = ImageOps.fit(
                splash_art.convert("RGB"),
                (width, height),
                method=Image.LANCZOS,
                centering=(0.5, 0.5),
            )
        else:
            canvas = Image.new("RGB", (width, height), BACKDROP)
            art_size = round(min(width, height) * (0.42 if framed_icon is not None else 0.34))
            splash_source = framed_icon if framed_icon is not None else sphere
            canvas.paste(
                splash_source.convert("RGB").resize((art_size, art_size), Image.LANCZOS),
                ((width - art_size) // 2, (height - art_size) // 2),
            )
        canvas.save(path)
    print(f"wrote {len(splash_paths)} Android splash assets")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", type=Path, help="Use an existing render instead of driving Chrome.")
    ap.add_argument(
        "--android-only",
        action="store_true",
        help="Generate Android assets from the committed iOS icon without rerendering the game.",
    )
    ap.add_argument(
        "--replace-splash",
        action="store_true",
        help="Replace the committed designed splash with a sphere-on-dark render.",
    )
    args = ap.parse_args()

    if args.android_only:
        icon_path = ICON_SET / "AppIcon-512@2x.png"
        if not icon_path.is_file():
            sys.exit(f"generate-icon: missing source icon {icon_path.relative_to(REPO)}")
        framed = Image.open(icon_path).convert("RGB")
        splash_path = SPLASH_SET / SPLASH_SLOTS[0][0]
        splash_art = Image.open(splash_path).convert("RGB") if splash_path.is_file() else None
        write_android_assets(framed, framed_icon=framed, splash_art=splash_art)
        return 0

    if args.source:
        render = args.source
    else:
        render = Path(tempfile.mkdtemp()) / "render.png"
        render_game(render)

    sphere = crop_to_sphere(Image.open(render).convert("RGB"))
    print(f"cropped sphere: {sphere.width}x{sphere.height}")
    write_icon(sphere)
    if args.replace_splash:
        write_splash(sphere)
    splash_path = SPLASH_SET / SPLASH_SLOTS[0][0]
    splash_art = Image.open(splash_path).convert("RGB") if splash_path.is_file() else None
    write_android_assets(sphere, splash_art=splash_art)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
