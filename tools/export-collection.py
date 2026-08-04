#!/usr/bin/env python3
# File Purpose: Build CodePen-ready Hexsweeper theme one-pagers under collection/.
# Primary Functions/Classes: export_theme, inline_assets, write_collection_index.
# Inputs: ../index.html, ../core.js, ../skin-chrome.css, ../fonts/*; CLI --check.
# Outputs: collection/theme-*.html + regenerates collection/index.html.

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COLLECTION = ROOT / "collection"
PUBLIC_BASE = "https://dr.eamer.dev/games/hexsweeper/collection"

# Four pasteable files: Light/Dark share one infinite plate with an in-file toggle.
THEMES = [
    {
        "id": "plate",
        "title": "Light / Dark",
        "tag": "Infinite · toggle",
        "blurb": "One infinite plate — Light and Dark swap cosmetics and keep the run.",
        "filter": "light dark infinite pale honeycomb plate night toggle",
        "swatch": ("#e8eaee", "#0f1115", "#1d4ed8", "#60a5fa"),
        "mode": "light",
        "allowModes": ["light", "dark"],
    },
    {
        "id": "fire",
        "title": "Fire",
        "tag": "Finite",
        "blurb": "Magma pit — large fill, bowl tilt, boiling center.",
        "filter": "fire finite magma pit boil bowl",
        "swatch": ("#1c120c", "#ff6400", "#ffd24a", "#ff3c14"),
        "mode": "fire",
    },
    {
        "id": "plague",
        "title": "Plague",
        "tag": "Finite",
        "blurb": "Specimen slide; irregular verdigris faces and hyphal mat.",
        "filter": "plague finite specimen verdigris mycelium",
        "swatch": ("#141e1c", "#7ec8a8", "#d4a08c", "#8fd4b0"),
        "mode": "plague",
    },
    {
        "id": "escape",
        "title": "Escape",
        "tag": "Infinite",
        "blurb": "Minesweeper on slate — a glacial rift wakes and seeps toward your digs.",
        "filter": "escape infinite rift chase slate crawl",
        "swatch": ("#0e1218", "#263a50", "#7fd8c4", "#9dc4dd"),
        "mode": "escape",
    },
]


def data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{payload}"


def inline_css_urls(css: str, base: Path) -> str:
    def replace(match: re.Match[str]) -> str:
        quote, reference = match.group(1), match.group(2).strip()
        if reference.startswith(("data:", "http://", "https://", "//", "#")):
            return match.group(0)
        candidate = (base / reference).resolve()
        try:
            candidate.relative_to(ROOT.resolve())
        except ValueError:
            return match.group(0)
        if not candidate.is_file():
            return match.group(0)
        return f"url({quote}{data_uri(candidate)}{quote})"

    return re.sub(r"url\(\s*(['\"]?)(.*?)\1\s*\)", replace, css, flags=re.I)


def safe_script(text: str) -> str:
    return text.replace("</script", "<\\/script")


def banner(theme: dict) -> str:
    return "\n".join(
        (
            "<!--",
            f"  Quick Take: Hexsweeper — {theme['title']} ({theme['tag']}). {theme['blurb']}",
            "  Stack: Vanilla HTML, CSS, and JavaScript; Canvas 2D; no external libraries.",
            f"  Source: {PUBLIC_BASE}/theme-{theme['id']}.html",
            "  License: MIT",
            "  Author: Luke Steuber",
            "  Note: Self-contained collection export. Live multi-theme game:",
            "        https://dr.eamer.dev/games/hexsweeper/",
            "-->",
        )
    )


def onepager_boot(theme: dict) -> str:
    payload = {
        "mode": theme["mode"],
        "skipWelcome": True,
    }
    if theme.get("allowModes"):
        payload["allowModes"] = list(theme["allowModes"])
    body = json.dumps(payload, indent=2)
    return (
        "<script>\n"
        f"window.HEXSWEEPER_ONEPAGER = {body};\n"
        "window.HEXSWEEPER_COLLECTION_EXPORT = true;\n"
        "</script>\n"
    )


def export_theme(theme: dict, source: str) -> str:
    title = f"Hexsweeper — {theme['title']}"
    description = f"Hexagonal minesweeper one-pager: {theme['title']} — {theme['blurb']}"

    markup = source
    markup = re.sub(
        r"<!DOCTYPE html>\s*<!--.*?-->\s*<html",
        "<!DOCTYPE html>\n<html",
        markup,
        count=1,
        flags=re.S,
    )
    markup = markup.replace(
        "<!DOCTYPE html>\n<html",
        f"<!DOCTYPE html>\n{banner(theme)}\n<html",
        1,
    )
    markup = re.sub(
        r"<title>.*?</title>",
        f"<title>{title}</title>",
        markup,
        count=1,
        flags=re.S,
    )
    markup = re.sub(
        r'<meta name="description" content="[^"]*">',
        f'<meta name="description" content="{description}">',
        markup,
        count=1,
    )

    chrome = (ROOT / "skin-chrome.css").read_text(encoding="utf-8")
    fonts_css = inline_css_urls(
        (ROOT / "fonts" / "fonts.css").read_text(encoding="utf-8"),
        ROOT / "fonts",
    )
    markup = re.sub(
        r'<link rel="stylesheet" href="skin-chrome\.css">\s*',
        f"<style>\n/* skin-chrome.css */\n{chrome}\n</style>\n",
        markup,
        count=1,
    )
    markup = re.sub(
        r'<link rel="stylesheet" href="fonts/fonts\.css">\s*',
        f"<style>\n/* fonts/fonts.css (woff2 inlined) */\n{fonts_css}\n</style>\n",
        markup,
        count=1,
    )

    core = safe_script((ROOT / "core.js").read_text(encoding="utf-8"))
    markup = re.sub(
        r'<script src="core\.js"></script>\s*',
        f"{onepager_boot(theme)}<script>\n/* core.js */\n{core}\n</script>\n",
        markup,
        count=1,
    )
    markup = markup.replace('<html lang="en">', '<html lang="en" class="collection-export">', 1)
    return markup


def tile_html(theme: dict) -> str:
    a, b, c, d = theme["swatch"]
    file = f"theme-{theme['id']}.html"
    return f"""      <article class="study" data-filter="{theme['filter']}" style="--swatch-bg:{a};--swatch-a:{b};--swatch-b:{c};--swatch-c:{d}">
        <a class="study-copy" href="{file}">
          <span class="swatch" aria-hidden="true"></span>
          <span class="study-kicker">{theme['tag']}</span>
          <span class="study-title">{theme['title']}</span>
          <p>{theme['blurb']}</p>
        </a>
        <div class="actions">
          <a href="{file}" target="_blank" rel="noopener">Open</a>
          <button type="button" data-copy="{file}">Copy HTML</button>
        </div>
      </article>"""


def write_index() -> str:
    tiles = "\n".join(tile_html(t) for t in THEMES)
    return f"""<!DOCTYPE html>
<!--
  File Purpose: Hexsweeper Collection desk — Open + Copy HTML for theme one-pagers.
  Primary Functions/Classes: Tile grid; data-copy clipboard fetch (Choice One-Pagers pattern).
  Inputs: theme-*.html siblings. Outputs: browsable index + clipboard full HTML.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Standalone Hexsweeper theme one-pagers with copy-ready HTML by Luke Steuber.">
<meta name="author" content="Luke Steuber">
<meta name="theme-color" content="#e8eaee">
<link rel="canonical" href="{PUBLIC_BASE}/">
<title>Hexsweeper Collection</title>
<style>
*,*::before,*::after{{box-sizing:border-box}}
:root{{
  color-scheme:light;
  --bg:#e8eaee;
  --bg-wash:radial-gradient(ellipse 70% 45% at 50% -8%,#f4f6f9,transparent 42rem),linear-gradient(180deg,#e8eaee,#dce2ea);
  --panel:rgba(255,255,255,.62);
  --ink:#1a1d23;
  --muted:#6b7280;
  --line:rgba(26,29,35,.14);
  --accent:#1d4ed8;
  --status:#047857;
  --display:"IBM Plex Sans","Source Sans 3",system-ui,sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,monospace;
  --touch:44px;
}}
body{{margin:0;min-height:100vh;background:var(--bg-wash),var(--bg);color:var(--ink);font-family:var(--display)}}
main{{width:min(1100px,100%);margin:auto;padding:max(1rem,env(safe-area-inset-top)) clamp(1rem,4vw,2rem) max(3rem,env(safe-area-inset-bottom))}}
.back{{display:inline-flex;align-items:center;min-height:var(--touch);color:var(--muted);font:600 .78rem var(--mono);text-decoration:none}}
.back:hover,.back:focus-visible{{color:var(--accent)}}
header{{margin:2.4rem 0 1.6rem}}
h1{{margin:0;font:800 clamp(2.4rem,8vw,4.6rem)/.9 var(--display);letter-spacing:-.04em}}
.lede{{max-width:40rem;margin:.85rem 0 0;color:var(--muted);line-height:1.55}}
#status{{min-height:1.4rem;margin:.75rem 0 0;color:var(--status);font:600 .75rem var(--mono)}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,14rem),1fr));gap:.7rem;margin-top:1.4rem}}
.study{{display:flex;min-height:12.5rem;flex-direction:column;border:1px solid var(--line);background:var(--panel)}}
.study-copy{{display:grid;gap:.4rem;flex:1;padding:1rem;text-decoration:none;color:inherit}}
.study-copy:hover{{background:rgba(255,255,255,.55)}}
.study-copy:focus-visible,.actions a:focus-visible,.actions button:focus-visible,.back:focus-visible{{outline:2px solid var(--accent);outline-offset:2px}}
.swatch{{display:block;height:2.4rem;border:1px solid var(--line);background:
  linear-gradient(90deg,var(--swatch-bg) 0 25%,var(--swatch-a) 25% 50%,var(--swatch-b) 50% 75%,var(--swatch-c) 75% 100%)}}
.study-kicker{{color:var(--muted);font:700 .66rem var(--mono);letter-spacing:.08em;text-transform:uppercase}}
.study-title{{font:750 1.45rem/1 var(--display)}}
.study p{{margin:0;color:var(--muted);font-size:.78rem;line-height:1.4}}
.actions{{display:flex;gap:.4rem;padding:0 1rem 1rem}}
.actions a,.actions button{{min-height:var(--touch);flex:1;border:1px solid var(--line);background:#fff;color:var(--ink);padding:.55rem;text-align:center;text-decoration:none;font:700 .66rem var(--mono);cursor:pointer}}
.actions a:hover,.actions button:hover{{border-color:var(--accent)}}
footer{{margin-top:2.8rem;color:var(--muted);font-size:.74rem;text-align:center}}
footer a{{color:var(--accent)}}
@media (prefers-reduced-motion:reduce){{*{{transition:none!important;animation:none!important}}}}
</style>
</head>
<body>
<main>
  <a class="back" href="../">&lsaquo; Play Hexsweeper</a>
  <header>
    <h1>Hexsweeper Collection</h1>
    <p class="lede">Four copy-ready HTML files for CodePen or local paste. Light and Dark share one infinite plate with an in-file toggle; Fire, Plague, and Escape each stand alone. The live multi-theme game stays on the Play link.</p>
    <p id="status" role="status" aria-live="polite"></p>
  </header>
  <!-- generated-hexsweeper-collection:begin -->
  <div class="grid">
{tiles}
  </div>
  <!-- generated-hexsweeper-collection:end -->
  <footer>By <a href="https://lukesteuber.com">Luke Steuber</a> · <a href="../LICENSE">MIT</a> · IBM Plex under <a href="../fonts/OFL.txt">OFL</a></footer>
</main>
<script>
(function () {{
  const status = document.querySelector("#status");
  const copyText = async (value) => {{
    if (navigator.clipboard && window.isSecureContext) {{
      return navigator.clipboard.writeText(value);
    }}
    const field = document.createElement("textarea");
    field.value = value;
    document.body.append(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }};
  document.addEventListener("click", async (event) => {{
    const btn = event.target.closest("[data-copy]");
    if (!btn) return;
    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Copying…";
    try {{
      const response = await fetch(btn.dataset.copy, {{ cache: "no-store" }});
      if (!response.ok) throw new Error("fetch failed");
      await copyText(await response.text());
      btn.textContent = "Copied";
      if (status) status.textContent = "Copied " + btn.dataset.copy + ".";
    }} catch (error) {{
      btn.textContent = "Copy failed";
      if (status) status.textContent = "Open the page and copy its source directly.";
    }}
    setTimeout(() => {{
      btn.disabled = false;
      btn.textContent = old;
    }}, 1600);
  }});
}})();
</script>
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
    source = (ROOT / "index.html").read_text(encoding="utf-8")
    if "allowModes" not in source or "ONEPAGER_MODES" not in source:
        print("error: index.html missing HEXSWEEPER_ONEPAGER allowModes support", file=sys.stderr)
        return 2

    COLLECTION.mkdir(parents=True, exist_ok=True)
    planned: dict[Path, str] = {}
    for theme in THEMES:
        path = COLLECTION / f"theme-{theme['id']}.html"
        planned[path] = export_theme(theme, source)
    planned[COLLECTION / "index.html"] = write_index()

    expected_names = {p.name for p in planned}
    orphans = sorted(
        p
        for p in COLLECTION.glob("theme-*.html")
        if p.name not in expected_names
    )

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
