#!/usr/bin/env bash
# File Purpose: Capture tools/og-card.html into assets/social/<card>-og.png at 1200x630.
# Inputs: live site at $BASE (default dr.eamer.dev). Outputs: one PNG per card.
# Note: renders at 2x then downscales, so the type stays crisp. Uses
#       --virtual-time-budget so the board's dig + reveal wave settle before capture.
# Cards: production themes, lab skins (skin-*), and sphere — see tools/og-card.html CARDS.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="${BASE:-https://dr.eamer.dev/games/hexsweeper}"
OUT="$ROOT/assets/social"
# Snap chromium is confined: it cannot write to hidden dirs like ~/.cache,
# so stage the 2x frames in a plain (gitignored) directory in the repo.
WORK="${WORK:-$ROOT/og-frames}"

mkdir -p "$OUT" "$WORK"

mapfile -t CARDS < <(
  python3 - "$ROOT/tools/og-card.html" <<'PY'
import re
import sys
from pathlib import Path

text = Path(sys.argv[1]).read_text(encoding="utf-8")
# Keys in CARDS table: home, light, dark, sphere, skin-classic, …
keys = re.findall(r'^\s{4}("?[\w-]+"?):\s*\{', text, re.M)
for key in keys:
    print(key.strip('"'))
PY
)

for card in "${CARDS[@]}"; do
  raw="$WORK/$card@2x.png"
  rm -f "$raw"
  chromium --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=2 --window-size=1200,630 \
    --virtual-time-budget=6000 \
    --screenshot="$raw" "$BASE/tools/og-card.html?card=$card" >/dev/null 2>&1 || true

  if [ ! -s "$raw" ]; then
    echo "FAILED $card (no frame captured)" >&2
    exit 1
  fi

  python3 - "$raw" "$OUT/$card-og.png" <<'PY'
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
if im.size != (2400, 1260):
    raise SystemExit(f"unexpected frame {im.size} for {src}")
im.resize((1200, 630), Image.LANCZOS).save(dst, "PNG", optimize=True)
print(f"wrote {dst}")
PY
done
