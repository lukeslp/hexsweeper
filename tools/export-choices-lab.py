#!/usr/bin/env python3
# File Purpose: Regenerate choices/lab/*.html as redirects to collection/skin-*.html.
# Primary Functions/Classes: redirect_stub, main.
# Inputs: ../skins.json; canonical pens live in ../collection/ (export-collection.py).
# Outputs: choices/lab/*.html redirect stubs — do not hand-edit.

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAB = ROOT / "choices" / "lab"
COLLECTION_PUBLIC = "https://dr.eamer.dev/games/hexsweeper/collection"


def load_skins() -> list[dict]:
    data = json.loads((ROOT / "skins.json").read_text(encoding="utf-8"))
    skins = data.get("skins", [])
    if not skins:
        raise SystemExit("skins.json has no skins")
    return skins


def redirect_stub(skin: dict) -> str:
    rel = f"../collection/skin-{skin['id']}.html"
    canonical = f"{COLLECTION_PUBLIC}/skin-{skin['id']}.html"
    name = skin["name"]
    return f"""<!DOCTYPE html>
<!--
  File Purpose: Redirect stub — playable lab skin lives in collection/skin-{skin['id']}.html.
  Regenerate: python3 tools/export-choices-lab.py (after export-collection.py).
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0;url={rel}">
<link rel="canonical" href="{canonical}">
<title>{name} — Hexsweeper Lab</title>
</head>
<body>
<p><a href="{rel}">{name}</a> — open the collection lab pen. Copy HTML lives on <a href="../collection/">collection desk</a>.</p>
</body>
</html>
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit 1 if generated files differ from disk (no writes).",
    )
    args = parser.parse_args()
    skins = load_skins()
    LAB.mkdir(parents=True, exist_ok=True)

    planned: dict[Path, str] = {}
    for skin in skins:
        path = LAB / f"{skin['id']}.html"
        planned[path] = redirect_stub(skin)

    expected = {p.name for p in planned}
    orphans = sorted(p for p in LAB.glob("*.html") if p.name not in expected)

    dirty = False
    for path, body in planned.items():
        if args.check:
            if not path.is_file() or path.read_text(encoding="utf-8") != body:
                print(f"stale: {path.relative_to(ROOT)}")
                dirty = True
            continue
        path.write_text(body, encoding="utf-8")
        print(f"wrote {path.relative_to(ROOT)} ({len(body):,} bytes)")

    for orphan in orphans:
        if args.check:
            print(f"orphan: {orphan.relative_to(ROOT)}")
            dirty = True
            continue
        orphan.unlink()
        print(f"removed {orphan.relative_to(ROOT)}")

    if args.check:
        return 1 if dirty else 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
