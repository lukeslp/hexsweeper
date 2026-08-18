#!/usr/bin/env python3
"""Compose App Store screenshots from real captures of the sealed payload.

scripts/store-shots.mjs drives the shipped www/index.html in headless Chrome
(SwiftShader WebGL) at exact device metrics and writes one raw frame per shot;
this script lays a caption band over the empty field above the sphere. Every
pixel of the artwork is the game as it ships — no mockups, no device frames.

Both families are required while the app declares TARGETED_DEVICE_FAMILY
"1,2": App Store Connect rejects an iPad-supporting listing that carries only
iPhone screenshots. Apple downscales the largest size per family, so exactly
two sets are needed: 6.9-inch iPhone (1320×2868) and 13-inch iPad (2064×2752).

Usage:
  python3 scripts/generate-store-screenshots.py            # iPhone 6.9"
  python3 scripts/generate-store-screenshots.py --ipad     # iPad 13"
  python3 scripts/generate-store-screenshots.py --all      # both
  add --recompose to re-caption existing raw captures without re-rendering
Outputs land in app-store/screenshots/en-US/ (iPad files carry -ipad).
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[1]
OUT_DIR = REPO / "app-store/screenshots/en-US"
RAW_DIR = REPO / "build/store-shots"
FONT = "/System/Library/Fonts/Supplemental/Futura.ttc"

DEVICES = {
    "iphone": ((1320, 2868), ""),
    "ipad": ((2064, 2752), "-ipad"),
}

# (raw file stem, caption, caption ink, shadow ink or None)
# Ink follows each theme's field: dark fields take near-white type; Light and
# the flower shot take near-black; Stratosphere's deep-blue top takes white
# with a soft shadow.
SHOTS = [
    ("01-mercury", "Minesweeper on a\nmirrored sphere", "#f4fbff", "#000000"),
    ("02-stratosphere", "Every face has six\nneighbors. No edges.", "#ffffff", "#0b3a5c"),
    ("03-flower", "One tap: undo, flag,\nsize, theme, reset", "#111111", None),
    ("04-ion-storm", "Long-press to flag.\nUndo a bad tap.", "#f1e8ff", "#000000"),
    ("05-heat-lightning", "Nine looks, from\npaper to storm", "#fff2e2", "#000000"),
    ("06-dark", "Offline. No account,\nno ads, no tracking.", "#ffffff", None),
]


def caption(img: Image.Image, text: str, ink: str, shadow: str | None) -> Image.Image:
    width, height = img.size
    scale = width / 1320
    draw = ImageDraw.Draw(img)
    size = int(96 * scale) if width < 1500 else int(96 * scale * 0.8)
    font = ImageFont.truetype(FONT, size, index=2)  # Futura Bold
    lines = text.split("\n")
    line_h = int(size * 1.18)
    total = line_h * len(lines)
    top = int(height * (0.075 if width < 1500 else 0.06))
    for i, line in enumerate(lines):
        w = draw.textlength(line, font=font)
        x = (width - w) / 2
        y = top + i * line_h
        if shadow:
            for dx, dy in ((0, 3), (2, 2), (-2, 2), (0, 5)):
                draw.text((x + dx * scale, y + dy * scale), line, font=font, fill=shadow)
        draw.text((x, y), line, font=font, fill=ink)
    return img


def main() -> None:
    args = set(sys.argv[1:])
    families = ["iphone", "ipad"] if "--all" in args else (["ipad"] if "--ipad" in args else ["iphone"])
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for family in families:
        (size, suffix) = DEVICES[family]
        raw = RAW_DIR / family
        if "--recompose" not in args or not raw.is_dir():
            subprocess.run(["node", str(REPO / "scripts/store-shots.mjs"), family, str(raw)], check=True, cwd=REPO)
        for stem, text, ink, shadow in SHOTS:
            img = Image.open(raw / f"{stem}.png").convert("RGB")
            if img.size != size:
                raise SystemExit(f"{stem}: captured {img.size}, expected {size}")
            out = OUT_DIR / f"{stem}{suffix}.png"
            caption(img, text, ink, shadow).save(out, optimize=True)
            print(f"wrote {out.relative_to(REPO)} {size}")


if __name__ == "__main__":
    main()
