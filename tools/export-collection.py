#!/usr/bin/env python3
# File Purpose: Build CodePen-ready Hexsweeper one-pagers under collection/.
# Primary Functions/Classes: export_theme, export_skin, inline_assets, write_collection_index.
# Inputs: ../index.html, ../core.js, ../skin-chrome.css, ../fonts/*, ../skins.json, ../skins/*.
# Outputs: collection/theme-*.html, collection/skin-*.html + regenerates collection/index.html.

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
OG = "https://dr.eamer.dev/games/hexsweeper/assets/social"

# Four pasteable files: Light/Dark share one infinite run, toggled in-file.
THEMES = [
    {
        "id": "plate",
        "title": "Light / Dark",
        "ogTitle": "Neumorphic Hexagonal Minesweeper",
        "ogDescription": "A minimalist take on old school Minesweeper, with soft porcelain and night iron plates that keep growing as you dig.",
        "tag": "Infinite · toggle",
        "blurb": "Two materials on one infinite run — porcelain chalk desk with graphite wells, or night-iron plate with brushed grain.",
        "filter": "light dark infinite soft ui neumorph honeycomb plate night toggle porcelain chalk graphite iron steel watermark",
        "swatch": ("#d4dce8", "#10151d", "#1d4ed8", "#60a5fa"),
        "mode": "light",
        "allowModes": ["light", "dark"],
        "ogImage": f"{OG}/light-og.png",
    },
    {
        "id": "fire",
        "title": "Fire",
        "ogTitle": "Magma Hexagonal Minesweeper",
        "ogDescription": "Classic Minesweeper in a molten honeycomb pit where burns rise upward and drag tilts the shaft instead of panning it.",
        "tag": "Finite",
        "blurb": "Magma shaft / hell-mine — dense honeycomb, rising burns, molten digs; drag tilts the pit instead of panning it.",
        "filter": "fire finite magma pit boil bowl hell mine tilt parallax camera lock",
        "swatch": ("#1c120c", "#ff6400", "#ffd24a", "#ff3c14"),
        "mode": "fire",
        "ogImage": f"{OG}/fire-og.png",
    },
    {
        "id": "plague",
        "title": "Plague",
        "ogTitle": "Mycelium Hexagonal Minesweeper",
        "ogDescription": "Old school Minesweeper on a culture dish, with verdigris faces and a hyphal mat creeping between the hexes.",
        "tag": "Finite",
        "blurb": "Specimen slide; irregular verdigris faces and hyphal mat.",
        "filter": "plague finite specimen verdigris mycelium",
        "swatch": ("#141e1c", "#7ec8a8", "#d4a08c", "#8fd4b0"),
        "mode": "plague",
        "ogImage": f"{OG}/plague-og.png",
    },
    {
        "id": "escape",
        "title": "Escape",
        "ogTitle": "Rift Chase Hexagonal Minesweeper",
        "ogDescription": "Dig toward an offscreen exit on slate while a glacial rift seeps after your clears, with six neighbors instead of eight.",
        "tag": "Infinite",
        "blurb": "Minesweeper on slate — dig toward an offscreen exit while a glacial rift seeps toward your digs.",
        "filter": "escape infinite rift chase slate crawl finish exit",
        "swatch": ("#0e1218", "#263a50", "#7fd8c4", "#9dc4dd"),
        "mode": "escape",
        "ogImage": f"{OG}/escape-og.png",
    },
]

TAG_SWATCH: dict[str, tuple[str, str, str, str]] = {
    "baseline": ("#e0e5ec", "#4a5568", "#a0aec0", "#718096"),
    "particles": ("#080a0f", "#ff6400", "#ffd24a", "#7eb8ff"),
    "lensing": ("#0a1420", "#7eb8ff", "#a78bfa", "#34d399"),
    "depth": ("#1c120c", "#ff6400", "#3d2818", "#ffd24a"),
    "materials": ("#141820", "#c9a86c", "#7eb8ff", "#e8dcc8"),
    "organic": ("#141e1c", "#7ec8a8", "#d4a08c", "#5a8f78"),
}
EXPERIMENTS = [
    {
        "id": "sphere",
        "title": "Hex Sphere",
        "ogTitle": "Hexagonal Minesweeper on a Sphere",
        "ogDescription": "Classic Minesweeper wrapped around a Goldberg sphere you rotate to dig, flag, and clear every face.",
        "tag": "Experiment · Open only",
        "blurb": "Minesweeper on a closed Goldberg sphere — drag to rotate, dig, flag, and clear the geodesic board.",
        "filter": "sphere experiment goldberg geodesic rotate 3d closed",
        "swatch": ("#0c1018", "#7eb8ff", "#34d399", "#c8d4e8"),
        "href": "../sphere/",
        "ogImage": f"{OG}/sphere-og.png",
    },
]

DEFAULT_LAB_SWATCH = ("#080a0f", "#7eb8ff", "#34d399", "#fbbf24")


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


def load_skins() -> list[dict]:
    data = json.loads((ROOT / "skins.json").read_text(encoding="utf-8"))
    skins = data.get("skins", [])
    if not skins:
        raise SystemExit("skins.json has no skins")
    return skins


def skin_swatch(skin: dict) -> tuple[str, str, str, str]:
    return TAG_SWATCH.get(skin.get("tag", ""), DEFAULT_LAB_SWATCH)


def strip_skin_nav(markup: str) -> str:
    """Remove lab navigation chrome; keep in-game Reset/Menu and modal menu-links."""
    markup = re.sub(
        r'<nav class="skin-nav"[^>]*>.*?</nav>\s*',
        "",
        markup,
        count=1,
        flags=re.S,
    )
    markup = re.sub(
        r"// keyboard prev/next\s*\(function\(\)\{.*?\}\)\(\);\s*",
        "",
        markup,
        count=1,
        flags=re.S,
    )
    markup = markup.replace(
        "Menu holds scores · Reset on the board · ← → skins",
        "Menu holds scores · Reset on the board",
    )
    return markup


def inline_skin_assets(markup: str) -> str:
    chrome = (ROOT / "skin-chrome.css").read_text(encoding="utf-8")
    markup = re.sub(
        r'<link rel="stylesheet" href="\.\./skin-chrome\.css">\s*',
        f"<style>\n/* skin-chrome.css */\n{chrome}\n</style>\n",
        markup,
        count=1,
    )
    markup = re.sub(
        r'<link rel="stylesheet" href="skin-chrome\.css">\s*',
        f"<style>\n/* skin-chrome.css */\n{chrome}\n</style>\n",
        markup,
        count=1,
    )
    core = safe_script((ROOT / "core.js").read_text(encoding="utf-8"))
    markup = re.sub(
        r'<script src="\.\./core\.js"></script>\s*',
        f"<script>\n/* core.js */\n{core}\n</script>\n",
        markup,
        count=1,
    )
    markup = re.sub(
        r'<script src="core\.js"></script>\s*',
        f"<script>\n/* core.js */\n{core}\n</script>\n",
        markup,
        count=1,
    )
    return markup


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


def skin_banner(skin: dict) -> str:
    name = skin["name"]
    tag = skin.get("tag", "lab")
    blurb = skin.get("blurb", "")
    techniques = ", ".join(skin.get("techniques", []))
    return "\n".join(
        (
            "<!--",
            f"  Quick Take: Hexsweeper lab — {name} ({tag}). {blurb}",
            f"  Techniques: {techniques or 'visual study'}.",
            "  Stack: Vanilla HTML, CSS, and JavaScript; Canvas 2D; no external libraries.",
            f"  Source: {PUBLIC_BASE}/skin-{skin['id']}.html",
            "  License: MIT · Author: Luke Steuber",
            "  Note: Self-contained collection export. Regenerate: python3 tools/export-collection.py",
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
    title = theme.get("ogTitle", theme["title"])
    description = theme.get("ogDescription", theme["blurb"])

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

    # Drop production OG/Twitter tags, then attach theme cards when provided.
    markup = re.sub(r'\n?<meta property="og:[^"]+" content="[^"]*">', "", markup)
    markup = re.sub(r'\n?<meta name="twitter:[^"]+" content="[^"]*">', "", markup)
    og = theme.get("ogImage")
    if og:
        social = "\n".join(
            [
                '<meta property="og:type" content="website">',
                f'<meta property="og:title" content="{title}">',
                f'<meta property="og:description" content="{description}">',
                f'<meta property="og:url" content="{PUBLIC_BASE}/theme-{theme["id"]}.html">',
                f'<meta property="og:image" content="{og}">',
                '<meta name="twitter:card" content="summary_large_image">',
                f'<meta name="twitter:title" content="{title}">',
                f'<meta name="twitter:description" content="{description}">',
                f'<meta name="twitter:image" content="{og}">',
            ]
        )
        markup = re.sub(
            r'(<meta name="description" content="[^"]*">)',
            r"\1\n" + social,
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


def export_skin(skin: dict) -> str:
    src_path = ROOT / skin["file"]
    markup = src_path.read_text(encoding="utf-8")
    markup = re.sub(
        r"<!DOCTYPE html>\s*<!--.*?-->\s*<html",
        "<!DOCTYPE html>\n<html",
        markup,
        count=1,
        flags=re.S,
    )
    markup = markup.replace(
        "<!DOCTYPE html>\n<html",
        f"<!DOCTYPE html>\n{skin_banner(skin)}\n<html",
        1,
    )
    title = skin.get("ogTitle", skin["name"])
    description = skin.get("ogDescription", skin.get("blurb", ""))
    markup = re.sub(r"<title>.*?</title>", f"<title>{title}</title>", markup, count=1, flags=re.S)
    if re.search(r'<meta name="description"', markup):
        markup = re.sub(
            r'<meta name="description" content="[^"]*">',
            f'<meta name="description" content="{description}">',
            markup,
            count=1,
        )
    else:
        markup = re.sub(
            r'(<meta name="viewport"[^>]*>)',
            rf'\1\n<meta name="description" content="{description}">',
            markup,
            count=1,
        )
    markup = strip_skin_nav(markup)
    markup = inline_skin_assets(markup)
    og = f"{OG}/skin-{skin['id']}-og.png"
    social = "\n".join(
        [
            '<meta property="og:type" content="website">',
            f'<meta property="og:title" content="{title}">',
            f'<meta property="og:description" content="{description}">',
            f'<meta property="og:url" content="{PUBLIC_BASE}/skin-{skin["id"]}.html">',
            f'<meta property="og:image" content="{og}">',
            '<meta name="twitter:card" content="summary_large_image">',
            f'<meta name="twitter:title" content="{title}">',
            f'<meta name="twitter:description" content="{description}">',
            f'<meta name="twitter:image" content="{og}">',
        ]
    )
    if re.search(r'<meta name="description"', markup):
        markup = re.sub(
            r'(<meta name="description" content="[^"]*">)',
            r"\1\n" + social,
            markup,
            count=1,
        )
    else:
        markup = re.sub(
            r'(<title>[^<]*</title>)',
            r"\1\n" + social,
            markup,
            count=1,
        )
    markup = markup.replace('<html lang="en">', '<html lang="en" class="collection-export">', 1)
    return markup


def tile_html(theme: dict, *, prefix: str = "theme") -> str:
    a, b, c, d = theme["swatch"]
    file = f"{prefix}-{theme['id']}.html"
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


def skin_tile_html(skin: dict) -> str:
    swatch = skin_swatch(skin)
    a, b, c, d = swatch
    tag = skin.get("tag", "lab")
    techniques = skin.get("techniques", [])
    filter_terms = " ".join(
        [skin["id"], tag, skin["name"].lower(), "lab skin"] + [t.lower() for t in techniques]
    )
    file = f"skin-{skin['id']}.html"
    return f"""      <article class="study" data-filter="{filter_terms}" style="--swatch-bg:{a};--swatch-a:{b};--swatch-b:{c};--swatch-c:{d}">
        <a class="study-copy" href="{file}">
          <span class="swatch" aria-hidden="true"></span>
          <span class="study-kicker">Lab · {tag}</span>
          <span class="study-title">{skin['name']}</span>
          <p>{skin.get('blurb', '')}</p>
        </a>
        <div class="actions">
          <a href="{file}" target="_blank" rel="noopener">Open</a>
          <button type="button" data-copy="{file}">Copy HTML</button>
        </div>
      </article>"""


def experiment_tile_html(exp: dict) -> str:
    a, b, c, d = exp["swatch"]
    href = exp["href"]
    return f"""      <article class="study" data-filter="{exp['filter']}" style="--swatch-bg:{a};--swatch-a:{b};--swatch-b:{c};--swatch-c:{d}">
        <a class="study-copy" href="{href}">
          <span class="swatch" aria-hidden="true"></span>
          <span class="study-kicker">{exp['tag']}</span>
          <span class="study-title">{exp['title']}</span>
          <p>{exp['blurb']}</p>
        </a>
        <div class="actions">
          <a href="{href}" target="_blank" rel="noopener">Open</a>
        </div>
      </article>"""


def write_index(themes: list[dict], skins: list[dict], experiments: list[dict] | None = None) -> str:
    theme_tiles = "\n".join(tile_html(t) for t in themes)
    skin_tiles = "\n".join(skin_tile_html(s) for s in skins)
    exp_tiles = "\n".join(experiment_tile_html(e) for e in (experiments or []))
    experiments_section = ""
    if exp_tiles:
        experiments_section = f"""
  <section class="section" aria-labelledby="experiments-heading">
    <h2 id="experiments-heading">Experiments</h2>
    <div class="grid">
{exp_tiles}
    </div>
  </section>"""
    return f"""<!DOCTYPE html>
<!--
  File Purpose: Hexsweeper Collection desk — Open + Copy HTML for theme and lab one-pagers.
  Primary Functions/Classes: Tile grid; data-copy clipboard fetch (Choice One-Pagers pattern).
  Inputs: theme-*.html, skin-*.html siblings. Outputs: browsable index + clipboard full HTML.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Standalone Hexsweeper theme and lab one-pagers with copy-ready HTML by Luke Steuber.">
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
.section{{margin-top:2.2rem}}
.section h2{{margin:0 0 .85rem;font:700 .72rem var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}}
#status{{min-height:1.4rem;margin:.75rem 0 0;color:var(--status);font:600 .75rem var(--mono)}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,14rem),1fr));gap:.7rem;margin-top:.4rem}}
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
    <p class="lede">Copy-ready HTML for CodePen or local paste. Production themes and lab skins each get a self-contained one-pager — use <strong>Open</strong> to play, <strong>Copy HTML</strong> here on the desk (not on the playable page). Light and Dark share one infinite file with an in-file toggle. The live multi-theme game stays on the Play link.</p>
    <p id="status" role="status" aria-live="polite"></p>
  </header>
  <!-- generated-hexsweeper-collection:begin -->
  <section class="section" aria-labelledby="production-heading">
    <h2 id="production-heading">Production themes</h2>
    <div class="grid">
{theme_tiles}
    </div>
  </section>
  <section class="section" aria-labelledby="lab-heading">
    <h2 id="lab-heading">Lab skins</h2>
    <div class="grid">
{skin_tiles}
    </div>
  </section>{experiments_section}
  <!-- generated-hexsweeper-collection:end -->
  <footer>By <a href="https://lukesteuber.com">Luke Steuber</a> · <a href="../LICENSE">MIT</a> · IBM Plex under <a href="../fonts/OFL.txt">OFL</a> · <a href="../choices.html">Choices hub</a></footer>
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
  }};
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

    skins = load_skins()
    COLLECTION.mkdir(parents=True, exist_ok=True)
    planned: dict[Path, str] = {}
    for theme in THEMES:
        path = COLLECTION / f"theme-{theme['id']}.html"
        planned[path] = export_theme(theme, source)
    for skin in skins:
        path = COLLECTION / f"skin-{skin['id']}.html"
        planned[path] = export_skin(skin)
    planned[COLLECTION / "index.html"] = write_index(THEMES, skins, EXPERIMENTS)

    expected_theme = {f"theme-{t['id']}.html" for t in THEMES}
    expected_skin = {f"skin-{s['id']}.html" for s in skins}
    expected_names = expected_theme | expected_skin | {"index.html"}
    orphans = sorted(
        p
        for p in COLLECTION.glob("*.html")
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
