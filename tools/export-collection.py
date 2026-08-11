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
# Native-app staging (gitignored build artifact, not part of the published
# collection desk and never deployed to the live site). Vendored into the
# hexsweeper-app Capacitor shell as its www/ payload.
APP_BUILD = ROOT / "build" / "app"
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
        "id": "water",
        "title": "Water",
        "ogTitle": "Tidal Hexagonal Minesweeper",
        "ogDescription": "Old school Minesweeper on a hex raft floating half under the tide, with the submerged rows rippling below a live waterline.",
        "tag": "Finite",
        "blurb": "A raft of wet stone floating on open sea — the waterline cuts across the board, and the rows below it ripple and reflect.",
        "filter": "water finite tide sea ocean raft reflection refraction caustics waterline submerged wet stone horizon",
        "swatch": ("#04202f", "#12617d", "#7fe0e8", "#ffb454"),
        "mode": "water",
        "ogImage": f"{OG}/water-og.png",
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
        "title": "Hexsweeper 3D",
        "ogTitle": "Hexsweeper 3D",
        "ogDescription": "The hex-tile take on classic Minesweeper — on a sphere. Themes, controls, and sharing.",
        "tag": "Experiment · live",
        "blurb": "Hexsweeper on a closed Goldberg sphere — six neighbors, dig/flag, rotate, themes. Riding on classic Minesweeper.",
        "filter": "sphere experiment goldberg geodesic rotate 3d closed hexsweeper codepen",
        "swatch": ("#ffffff", "#111111", "#888888", "#ff0000"),
        "file": "sphere.html",
        "href": "sphere.html",
        "liveHref": "../sphere/",
        "source": "sphere",
        "css": ["dev-chrome.css", "hex-bloom.css"],
        "scripts": ["hexasphere.js", "sphere.js", "hex-bloom.js"],
        "boot": "initHexBloom",
        "ogImage": f"{OG}/sphere-og.png",
    },
    {
        "id": "sphere-ux",
        "title": "Hexsweeper 3D · Bloom UX",
        "ogTitle": "Hexsweeper 3D — Bloom UX",
        "ogDescription": "Sphere Hexsweeper with the experimental hex-bloom chrome: three-tile dock, cycle controls, Classic axes and World packs.",
        "tag": "Experiment · UX lab",
        "blurb": "Sandbox chrome for the sphere — Restart · Menu · Help dock, hex bloom (Dig/Size/Look/Invert/Flush/Seams), Classic Bg/Shell/Dug axes plus Earth/Moon/Glow packs.",
        "filter": "sphere ux bloom dock menu chrome experiment goldberg hex-bloom lab",
        "swatch": ("#f3f1ea", "#16150f", "#e2341d", "#5ec8ff"),
        "file": "sphere-ux.html",
        "href": "sphere-ux.html",
        "liveHref": "../sphere-ux/",
        "source": "sphere-ux",
        "css": ["dev-chrome.css", "hex-bloom.css"],
        "scripts": ["hexasphere.js", "sphere.js", "hex-bloom.js"],
        "boot": "initHexBloom",
        "ogImage": f"{OG}/sphere-og.png",
    },
    {
        "id": "polyhedron",
        "title": "Hexsweeper · Dodecahedron",
        "ogTitle": "Hexsweeper — Dodecahedron Campaign",
        "ogDescription": "Twelve connected pentagonal panels, each covered by a playable Hexsweeper field.",
        "tag": "Experiment · playable campaign",
        "blurb": "A true dodecahedron becomes a 12-stage campaign: clear one tiled pentagonal panel to unlock its five neighbors.",
        "filter": "dodecahedron polyhedron panels campaign pentagon tiled voronoi connected progression experiment",
        "swatch": ("#ffffff", "#111111", "#d9d9d5", "#ffd000"),
        "file": "polyhedron.html",
        "href": "polyhedron.html",
        "liveHref": "../polyhedron/",
        "source": "polyhedron",
        "css": ["dev-chrome.css", "hex-bloom.css"],
        "scripts": [
            "hexasphere.js",
            "panel-board.js",
            "dodeca-layout.js",
            "campaign.js",
            "polyhedron-renderer.js",
            "main.js",
            "hex-bloom.js",
        ],
        "boot": "initHexBloom",
        "welcomeKey": "hexsweeper-dodeca-welcome-v1",
        "ogImage": f"{OG}/sphere-og.png",
    },
    {
        "id": "sphere-face-takeover",
        "title": "Sphere UX · Face Takeover",
        "ogTitle": "Hexsweeper 3D — Face Takeover",
        "ogDescription": "A sphere menu formed from one real projected board face and its six neighbours.",
        "tag": "Experiment · spatial chrome",
        "blurb": "The menu inhabits an actual seven-face patch of the current sphere: true projection, shared seams, direct controls.",
        "filter": "sphere ux face takeover projected board faces spatial menu experiment",
        "swatch": ("#ffffff", "#111111", "#d8d8d8", "#ffd400"),
        "file": "sphere-face-takeover.html",
        "href": "sphere-face-takeover.html",
        "liveHref": "../sphere-ux/?dock=faces",
        "source": "sphere-ux",
        "css": ["dev-chrome.css", "hex-bloom.css"],
        "scripts": ["hexasphere.js", "sphere.js", "hex-bloom.js"],
        "boot": "initHexBloom",
        "dockMode": "faces",
        "ogImage": f"{OG}/sphere-og.png",
    },
    {
        "id": "sphere-equator-ribbon",
        "title": "Sphere UX · Equator Ribbon V1",
        "ogTitle": "Hexsweeper 3D — Equator Ribbon Archive",
        "ogDescription": "Archived first study of a draggable control belt orbiting the Hexsweeper sphere.",
        "tag": "Archive · spatial chrome",
        "blurb": "Frozen first pass. The orbit made controls compete with gameplay faces, so this direction is preserved but retired.",
        "filter": "sphere ux equator ribbon archive retired spatial menu experiment",
        "swatch": ("#ffffff", "#111111", "#888888", "#18a64a"),
        "file": "sphere-equator-ribbon.html",
        "href": "sphere-equator-ribbon.html",
        "source": "sphere-ux",
        "css": ["dev-chrome.css", "hex-bloom.css"],
        "scripts": ["hexasphere.js", "sphere.js", "hex-bloom.js"],
        "boot": "initHexBloom",
        "dockMode": "equator",
        "ogImage": f"{OG}/sphere-og.png",
    },
    {
        "id": "sphere-eggshell",
        "title": "Sphere UX · Eggshell",
        "ogTitle": "Hexsweeper 3D — Eggshell",
        "ogDescription": "Two restrained Hexsweeper shell halves open around a clear control aperture.",
        "tag": "Experiment · live shell V3",
        "blurb": "Whole live 3D faces separate along one frozen interlocking seam, opening a clean aperture around the seven controls.",
        "filter": "sphere ux eggshell split crack hinge open spatial menu experiment",
        "swatch": ("#ffffff", "#111111", "#777777", "#ffd400"),
        "file": "sphere-eggshell.html",
        "href": "sphere-eggshell.html",
        "liveHref": "../sphere-ux/?dock=eggshell",
        "source": "sphere-ux",
        "css": ["dev-chrome.css", "hex-bloom.css"],
        "scripts": ["hexasphere.js", "sphere.js", "hex-bloom.js"],
        "boot": "initHexBloom",
        "dockMode": "eggshell",
        "ogImage": f"{OG}/sphere-og.png",
    },
    {
        "id": "sphere-chamber",
        "title": "Sphere UX · Inside Chamber",
        "ogTitle": "Hexsweeper 3D — Inside Chamber",
        "ogDescription": "The Hexsweeper sphere reverses into a bounded concave annulus around the player.",
        "tag": "Experiment · inverse sphere V3",
        "blurb": "The globe reverses through a long, single-eased turn into a bounded tiled bowl around a calm control aperture.",
        "filter": "sphere ux inside out chamber concave inverse projection spatial menu experiment",
        "swatch": ("#ffffff", "#111111", "#aaaaaa", "#18a64a"),
        "file": "sphere-chamber.html",
        "href": "sphere-chamber.html",
        "liveHref": "../sphere-ux/?dock=chamber",
        "source": "sphere-ux",
        "css": ["dev-chrome.css", "hex-bloom.css"],
        "scripts": ["hexasphere.js", "sphere.js", "hex-bloom.js"],
        "boot": "initHexBloom",
        "dockMode": "chamber",
        "ogImage": f"{OG}/sphere-og.png",
    },
    {
        "id": "sphere-polar-capstan",
        "title": "Sphere UX · Polar Capstan",
        "ogTitle": "Hexsweeper 3D — Polar Capstan",
        "ogDescription": "A faceted control spindle rises from the north pole of the Hexsweeper sphere.",
        "tag": "Archive · rejected polar mechanism",
        "blurb": "Rejected for this menu: the faceted spindle obscured the sphere and weakened the controls' reading order. Preserved as reviewed.",
        "filter": "sphere ux polar capstan spindle north pole archive rejected spatial menu experiment",
        "swatch": ("#ffffff", "#111111", "#bdbdbd", "#ffd400"),
        "file": "sphere-polar-capstan.html",
        "href": "sphere-polar-capstan.html",
        "source": "sphere-ux",
        "css": ["dev-chrome.css", "hex-bloom.css"],
        "scripts": ["hexasphere.js", "sphere.js", "hex-bloom.js"],
        "boot": "initHexBloom",
        "dockMode": "capstan",
        "ogImage": f"{OG}/sphere-og.png",
    },
    {
        "id": "sphere-polar-crown",
        "title": "Sphere UX · Polar Cap Petals",
        "ogTitle": "Hexsweeper 3D — Polar Cap Petals",
        "ogDescription": "A reset hub locks six control vanes into the sphere's north cap.",
        "tag": "Captured · transferable petals",
        "blurb": "Not a fit for this menu, but the six geodesic vanes are preserved as promising menu and motion prior art for other contexts.",
        "filter": "sphere ux polar cap petals crown north pole geodesic captured prior art spatial menu experiment",
        "swatch": ("#ffffff", "#111111", "#d6d6d6", "#18a64a"),
        "file": "sphere-polar-crown.html",
        "href": "sphere-polar-crown.html",
        "source": "sphere-ux",
        "css": ["dev-chrome.css", "hex-bloom.css"],
        "scripts": ["hexasphere.js", "sphere.js", "hex-bloom.js"],
        "boot": "initHexBloom",
        "dockMode": "crown",
        "ogImage": f"{OG}/sphere-og.png",
    },
    {
        "id": "sphere-polar-drill",
        "title": "Sphere UX · Polar Axis Drill",
        "ogTitle": "Hexsweeper 3D — Polar Axis Drill",
        "ogDescription": "Concentric control rings telescope into the sphere's polar axis.",
        "tag": "Archive · rejected polar mechanism",
        "blurb": "Rejected for this menu: the telescoping annuli made the controls read as decoration around a bore. Preserved as reviewed.",
        "filter": "sphere ux polar axis drill aperture rings telescope archive rejected spatial menu experiment",
        "swatch": ("#ffffff", "#111111", "#a7a7a7", "#ffd400"),
        "file": "sphere-polar-drill.html",
        "href": "sphere-polar-drill.html",
        "source": "sphere-ux",
        "css": ["dev-chrome.css", "hex-bloom.css"],
        "scripts": ["hexasphere.js", "sphere.js", "hex-bloom.js"],
        "boot": "initHexBloom",
        "dockMode": "drill",
        "ogImage": f"{OG}/sphere-og.png",
    },
    {
        "id": "sphere-polar-lid",
        "title": "Sphere UX · Polar Hex Lid",
        "ogTitle": "Hexsweeper 3D — Polar Hex Lid",
        "ogDescription": "One polar face hinges into a screen-facing Hexsweeper control panel.",
        "tag": "Archive · rejected polar mechanism",
        "blurb": "Rejected for this menu: the hinged panel became a detached object instead of part of the sphere. Preserved as reviewed.",
        "filter": "sphere ux polar hex lid hinge panel north pole archive rejected spatial menu experiment",
        "swatch": ("#ffffff", "#111111", "#c8c8c8", "#18a64a"),
        "file": "sphere-polar-lid.html",
        "href": "sphere-polar-lid.html",
        "source": "sphere-ux",
        "css": ["dev-chrome.css", "hex-bloom.css"],
        "scripts": ["hexasphere.js", "sphere.js", "hex-bloom.js"],
        "boot": "initHexBloom",
        "dockMode": "lid",
        "ogImage": f"{OG}/sphere-og.png",
    },
    # Model-authored unique takes (specs from Kimi / Claude / Muse; wired via ?take=)
    {
        "id": "sphere-kimi",
        "title": "Moon Ink Orrery",
        "ogTitle": "Hexsweeper 3D — Moon Ink Orrery",
        "ogDescription": "Hex minesweeper on a Goldberg sphere, restyled as an ink-brushed lunar orrery.",
        "tag": "Take · visual study",
        "blurb": "Paper-moon shells over indigo void, vermillion flags, and brush-weight rings that thicken with danger.",
        "filter": "sphere take moon ink orrery lunar calligraphy codepen",
        "swatch": ("#0c0f1d", "#e8e4d8", "#7dd3c0", "#c9372c"),
        "file": "sphere-kimi.html",
        "href": "sphere-kimi.html",
        "take": "kimi-moon-ink-orrery",
        "source": "sphere",
        "css": ["dev-chrome.css", "hex-bloom.css"],
        "scripts": ["hexasphere.js", "sphere.js", "hex-bloom.js"],
        "boot": "initHexBloom",
        "ogImage": f"{OG}/sphere-og.png",
    },
    {
        "id": "sphere-claude",
        "title": "Amber Codex",
        "ogTitle": "Hexsweeper 3D — Amber Codex",
        "ogDescription": "A hex-tile minesweeper on a Goldberg sphere, like a scholar's annotated globe.",
        "tag": "Take · visual study",
        "blurb": "Lacquered amber shells, parchment wells, sealing-wax flags, and an amber survey pulse.",
        "filter": "sphere take amber codex scholarly parchment codepen",
        "swatch": ("#1c1f2b", "#4a3f2f", "#d4a240", "#e8dcc8"),
        "file": "sphere-claude.html",
        "href": "sphere-claude.html",
        "take": "claude-amber-codex",
        "source": "sphere",
        "css": ["dev-chrome.css", "hex-bloom.css"],
        "scripts": ["hexasphere.js", "sphere.js", "hex-bloom.js"],
        "boot": "initHexBloom",
        "ogImage": f"{OG}/sphere-og.png",
    },
    {
        "id": "sphere-muse",
        "title": "Starlit Void",
        "ogTitle": "Hexsweeper 3D — Starlit Void",
        "ogDescription": "Hexsweeper's Goldberg sphere adrift in a soft void — a constellation to chart.",
        "tag": "Take · visual study",
        "blurb": "Brushed-slate shell in deep void, coral lighthouse flags, starlight rings, and count-tint wells.",
        "filter": "sphere take constellation void starlit cosmic codepen",
        "swatch": ("#0b1020", "#2e3a52", "#8bb8ff", "#ff8a6b"),
        "file": "sphere-muse.html",
        "href": "sphere-muse.html",
        "take": "muse-constellation-void",
        "source": "sphere",
        "css": ["dev-chrome.css", "hex-bloom.css"],
        "scripts": ["hexasphere.js", "sphere.js", "hex-bloom.js"],
        "boot": "initHexBloom",
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
    href = exp.get("href") or exp.get("file") or exp.get("liveHref", "#")
    file = exp.get("file")
    live = exp.get("liveHref")
    copy_btn = (
        f'\n          <button type="button" data-copy="{file}">Copy HTML</button>'
        if file
        else ""
    )
    live_btn = (
        f'\n          <a href="{live}" target="_blank" rel="noopener">Live</a>'
        if live
        else ""
    )
    return f"""      <article class="study" data-filter="{exp['filter']}" style="--swatch-bg:{a};--swatch-a:{b};--swatch-b:{c};--swatch-c:{d}">
        <a class="study-copy" href="{href}">
          <span class="swatch" aria-hidden="true"></span>
          <span class="study-kicker">{exp['tag']}</span>
          <span class="study-title">{exp['title']}</span>
          <p>{exp['blurb']}</p>
        </a>
        <div class="actions">
          <a href="{href}" target="_blank" rel="noopener">Open</a>{live_btn}{copy_btn}
        </div>
      </article>"""


def sphere_banner(exp: dict) -> str:
    live = exp.get("liveHref") or "../sphere/"
    if live.startswith("../"):
        live_url = "https://dr.eamer.dev/games/hexsweeper/" + live.replace("../", "")
    elif live.startswith("http"):
        live_url = live
    else:
        live_url = f"https://dr.eamer.dev/games/hexsweeper/{live.lstrip('/')}"
    return "\n".join(
        (
            "<!--",
            f"  Quick Take: {exp['ogTitle']} — {exp['blurb']}",
            "  Stack: Vanilla HTML, CSS, and JavaScript; Canvas 2D; no frameworks.",
            f"  Source: {PUBLIC_BASE}/{exp['file']}",
            f"  Live: {live_url}",
            "  License: MIT · Author: Luke Steuber",
            "  Note: Self-contained collection export for CodePen. Regenerate:",
            "        python3 tools/export-collection.py",
            "-->",
        )
    )


def export_sphere(exp: dict) -> str:
    """Inline a sphere source tree into a single CodePen-ready HTML file.

    Defaults match live sphere/ (dev-chrome). sphere-ux sets source/css/scripts/boot.
    """
    source_name = exp.get("source") or "sphere"
    source_dir = ROOT / source_name
    if not (source_dir / "index.html").is_file():
        raise SystemExit(f"export_sphere: missing {source_dir / 'index.html'}")

    css_names = exp.get("css") or ["dev-chrome.css"]
    script_names = exp.get("scripts") or [
        "hexasphere.js",
        "sphere.js",
        "dev-chrome.js",
    ]
    boot_fn = exp.get("boot") or "initDevChrome"

    markup = (source_dir / "index.html").read_text(encoding="utf-8")
    title = exp.get("ogTitle", exp["title"])
    description = exp.get("ogDescription", exp["blurb"])
    file_name = exp["file"]
    public_url = f"{PUBLIC_BASE}/{file_name}"
    history_img = (
        "https://dr.eamer.dev/games/hexsweeper/sphere/assets/classic-minesweeper.png"
    )

    # Strip existing file banner; attach collection banner.
    markup = re.sub(
        r"<!DOCTYPE html>\s*<!--.*?-->\s*<html",
        "<!DOCTYPE html>\n<html",
        markup,
        count=1,
        flags=re.S,
    )
    markup = markup.replace(
        "<!DOCTYPE html>\n<html",
        f"<!DOCTYPE html>\n{sphere_banner(exp)}\n<html",
        1,
    )
    markup = markup.replace(
        '<html lang="en">',
        '<html lang="en" class="collection-export">',
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
    # Replace social meta with collection-scoped URLs.
    markup = re.sub(r'\n?<meta property="og:[^"]+" content="[^"]*">', "", markup)
    markup = re.sub(r'\n?<meta name="twitter:[^"]+" content="[^"]*">', "", markup)
    social = "\n".join(
        [
            '<meta property="og:type" content="website">',
            f'<meta property="og:title" content="{title}">',
            f'<meta property="og:description" content="{description}">',
            f'<meta property="og:url" content="{public_url}">',
            f'<meta property="og:image" content="{exp["ogImage"]}">',
            '<meta name="twitter:card" content="summary_large_image">',
            f'<meta name="twitter:title" content="{title}">',
            f'<meta name="twitter:description" content="{description}">',
            f'<meta name="twitter:image" content="{exp["ogImage"]}">',
        ]
    )
    markup = re.sub(
        r'(<meta name="description" content="[^"]*">)',
        r"\1\n" + social,
        markup,
        count=1,
    )

    # Inline CSS: fonts (woff2 data URIs) + skin-chrome + keep sphere <style> block.
    chrome = (ROOT / "skin-chrome.css").read_text(encoding="utf-8")
    fonts_css = inline_css_urls(
        (ROOT / "fonts" / "fonts.css").read_text(encoding="utf-8"),
        ROOT / "fonts",
    )
    markup = re.sub(
        r'<link rel="stylesheet" href="\.\./fonts/fonts\.css">\s*',
        f"<style>\n/* fonts/fonts.css (woff2 inlined) */\n{fonts_css}\n</style>\n",
        markup,
        count=1,
    )
    markup = re.sub(
        r'<link rel="stylesheet" href="\.\./skin-chrome\.css">\s*',
        f"<style>\n/* skin-chrome.css */\n{chrome}\n</style>\n",
        markup,
        count=1,
    )

    # History screenshot: absolute URL (not inlined — keeps the pen under ~250KB).
    markup = markup.replace(
        'src="assets/classic-minesweeper.png"', f'src="{history_img}"'
    )
    markup = markup.replace(
        'src="../sphere/assets/classic-minesweeper.png"', f'src="{history_img}"'
    )

    for css_name in css_names:
        css_path = source_dir / css_name
        if not css_path.is_file():
            raise SystemExit(f"export_sphere: missing {css_path}")
        css_body = css_path.read_text(encoding="utf-8")
        markup = re.sub(
            rf'<link rel="stylesheet" href="{re.escape(css_name)}[^"]*">\s*',
            f"<style>\n/* {css_name} */\n{css_body}\n</style>\n",
            markup,
            count=1,
        )

    # Inline script tags in declared order; preserve trailing boot script.
    script_pattern = r"".join(
        rf'<script src="{re.escape(name)}[^"]*"></script>\s*' for name in script_names
    )
    m = re.search(script_pattern, markup)
    if not m:
        raise SystemExit(
            "export_sphere: could not find script tags for "
            + ", ".join(script_names)
            + f" under {source_name}/"
        )

    take_id = exp.get("take")
    take_line = (
        f"window.HEXSWEEPER_SPHERE_TAKE = {json.dumps(take_id)};\n" if take_id else ""
    )
    dock_mode = exp.get("dockMode")
    dock_line = (
        f"window.HEXSWEEPER_SPHERE_DOCK_MODE = {json.dumps(dock_mode)};\n"
        if dock_mode
        else ""
    )
    welcome_key = exp.get("welcomeKey") or "hexsweeper-sphere-welcome-v1"
    boot = (
        "<script>\n"
        "/* collection / CodePen boot */\n"
        "try {\n"
        f"  localStorage.setItem({welcome_key!r}, '1');\n"
        "} catch (_) {}\n"
        "window.HEXSWEEPER_SPHERE_COLLECTION = true;\n"
        f"{take_line}"
        f"{dock_line}"
        "</script>\n"
    )
    # Do not use re.sub with JS source as the replacement — backslashes break the template.
    parts = [boot]
    for name in script_names:
        body = safe_script((source_dir / name).read_text(encoding="utf-8"))
        parts.append(f"<script>\n/* {name} */\n{body}\n</script>\n")
    scripts = "".join(parts)
    markup = markup[: m.start()] + scripts + markup[m.end() :]

    # Ensure boot helper matches chrome (dev-chrome vs hex-bloom).
    markup = markup.replace(
        "initDevChrome(SphereSweeper.boot({ canvasId: \"gameCanvas\" }));",
        f"{boot_fn}(SphereSweeper.boot({{ canvasId: \"gameCanvas\" }}));",
    )
    markup = markup.replace(
        "initHexBloom(SphereSweeper.boot({ canvasId: \"gameCanvas\" }));",
        f"{boot_fn}(SphereSweeper.boot({{ canvasId: \"gameCanvas\" }}));",
    )

    # Point flat-mode links at the live site (relative ../ breaks in CodePen).
    markup = markup.replace(
        'href="../"', 'href="https://dr.eamer.dev/games/hexsweeper/"'
    )
    markup = markup.replace(
        'href="../?mode=fire"',
        'href="https://dr.eamer.dev/games/hexsweeper/?mode=fire"',
    )
    markup = markup.replace(
        'href="../?mode=plague"',
        'href="https://dr.eamer.dev/games/hexsweeper/?mode=plague"',
    )

    return markup


# Back affordance shared by every game page. Top-left on purpose: all four
# surfaces already own the bottom-right corner for their own chrome, and the
# WebView has no browser back. White-on-dark glass is the one treatment that
# stays legible over both the porcelain plate and the night-iron one.
APP_BACK_PILL = """<style>
.app-back{position:fixed;z-index:9999;
 top:max(12px,env(safe-area-inset-top));left:max(12px,env(safe-area-inset-left));
 display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 15px 0 12px;
 border-radius:999px;border:1px solid rgba(255,255,255,.22);background:rgba(18,22,30,.62);
 -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
 color:#fff;font:600 .78rem/1 "IBM Plex Sans",system-ui,sans-serif;letter-spacing:.01em;
 text-decoration:none;-webkit-tap-highlight-color:transparent}
.app-back:focus-visible{outline:3px solid #7fc4f2;outline-offset:2px}
.app-back svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.2;
 stroke-linecap:round;stroke-linejoin:round}
@media (prefers-reduced-motion: no-preference){.app-back{transition:transform .18s ease}
 .app-back:active{transform:scale(.96)}}
</style>
<a class="app-back" href="../index.html">
<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>Games</a>
"""

# Keeps the native launch screen up until the first painted frame; without it
# the storyboard drops the moment the WebView mounts and the player watches a
# blank canvas while the board builds.
APP_SPLASH_HIDE = """<script>
/* app: dismiss the native launch screen after first paint */
(function () {
  function hide() {
    var p = window.Capacitor && window.Capacitor.Plugins;
    if (p && p.SplashScreen) p.SplashScreen.hide({ fadeOutDuration: 200 });
  }
  requestAnimationFrame(function () { requestAnimationFrame(hide); });
})();
</script>
"""


def appify(markup: str, *, back: bool = True, lock_zoom: bool = True, label: str = "app page") -> str:
    """Apply the transforms every page in the native bundle needs.

    Outbound links must escape to Safari — a bare href replaces the game with a
    web page and Capacitor offers no way back. Then assert the page is sealed:
    nothing it loads may live off-device.

    lock_zoom disables WebView double-tap/pinch zoom on the game pages. They
    implement their own pinch and pan, so browser zoom only fights them — a
    mis-hit between two cells would leave the board zoomed with no way back,
    and there is no browser chrome to undo it. Applied to the app build only:
    on the web the browser is the user agent and must stay zoomable. The
    picker keeps zoom (it is a normal document, see its touch-action rule).
    """
    # GoatCounter belongs to the public web pages. Native builds are deliberately
    # sealed and offline, so remove the complete tag before the remote-asset gate.
    markup = re.sub(
        r'\s*<script\s+data-goatcounter="[^"]+"\s+async\s+src="[^"]+/count\.js"></script>',
        "",
        markup,
        flags=re.S,
    )
    if lock_zoom:
        markup = re.sub(
            r'(<meta name="viewport" content=")([^"]*)(">)',
            lambda m: m.group(1)
            + (
                m.group(2)
                if "user-scalable" in m.group(2)
                else m.group(2).rstrip() + ", maximum-scale=1.0, user-scalable=no"
            )
            + m.group(3),
            markup,
            count=1,
        )
    for host in ("https://lukesteuber.com", "https://datapoems.io"):
        markup = markup.replace(
            f'<a href="{host}" rel="noopener noreferrer">',
            f'<a href="{host}" target="_blank" rel="noopener noreferrer">',
        )
    # Any remaining outbound anchor still needs to open out-of-app.
    markup = re.sub(
        r'<a href="(https?://[^"]+)"(?! [^>]*target=)',
        r'<a href="\1" target="_blank"',
        markup,
    )
    if back:
        markup = markup.replace("</body>", f"{APP_BACK_PILL}</body>", 1)
    markup = markup.replace("</body>", f"{APP_SPLASH_HIDE}</body>", 1)

    remote = re.findall(
        r'(?:src|href)="(https?://[^"]+\.(?:png|jpe?g|gif|webp|svg|css|js|woff2?))"', markup
    )
    if remote:
        raise SystemExit(
            f"appify({label}): remote asset reference(s) survived: " + ", ".join(sorted(set(remote)))
        )
    return markup


def export_flat_app(collection_file: str, label: str) -> str:
    """Adapt an already-generated flat one-pager into a native-app game page."""
    src = COLLECTION / collection_file
    if not src.is_file():
        raise SystemExit(f"export_flat_app: {collection_file} not built yet — run without --app first")
    markup = src.read_text(encoding="utf-8")
    # The desk pens link back to the collection index, which the app has no copy of.
    markup = re.sub(r'\s*<a class="back"[^>]*>.*?</a>', "", markup, flags=re.S)
    return appify(markup, label=label)


def export_sphere_app(exp: dict) -> str:
    """Adapt the collection one-pager into the offline native-app payload.

    Builds on export_sphere so the inlining (fonts, chrome CSS, hexasphere,
    sphere, dev-chrome) stays in exactly one place. The app differs from a
    CodePen pen in four ways, all of them about being a sealed offline shell:

    1. `HEXSWEEPER_SPHERE_APP` drops the globe-map themes (see the THEMES
       filter in sphere.js) — the only themes needing a network fetch.
    2. The history screenshot is served from the app bundle, not dr.eamer.dev.
    3. Internal cross-game links have nowhere to go inside a single-game app,
       so they are removed rather than left to strand the WebView.
    4. Outbound credits open in the system browser instead of navigating the
       WebView away from the game with no way back.
    """
    markup = export_sphere(exp)

    markup = markup.replace(
        "window.HEXSWEEPER_SPHERE_COLLECTION = true;",
        "window.HEXSWEEPER_SPHERE_APP = true;",
        1,
    )

    # Sphere lives at games/sphere.html, so bundle assets are one level up.
    markup = markup.replace(
        'src="https://dr.eamer.dev/games/hexsweeper/sphere/assets/classic-minesweeper.png"',
        'src="../assets/classic-minesweeper.png"',
    )

    # Drop the "Also flat Hexsweeper · Fire · Plague" row: those modes are not
    # in this binary, and tapping them would navigate the WebView off the game.
    markup = re.sub(r'\s*<p class="help-more">.*?</p>', "", markup, count=1, flags=re.S)

    if "HEXSWEEPER_SPHERE_APP" not in markup:
        raise SystemExit("export_sphere_app: app flag not injected")

    # appify's guard checks src/href only. GLOBE_TEX_BASE still appears as a
    # string constant in the inlined sphere.js, but it is unreachable here:
    # globeUrl is only called for themes carrying `globeMap`, and the THEMES
    # filter drops every one of those under HEXSWEEPER_SPHERE_APP.
    return appify(markup, label="sphere")


def export_app_launcher() -> str:
    """The picker: three structural choices — infinite, bounded, sphere.

    Theme, board size and count style are settings inside each game, not peers
    of it, so they deliberately do not appear here.
    """
    template = (ROOT / "tools" / "app-launcher.html").read_text(encoding="utf-8")
    fonts_css = inline_css_urls(
        (ROOT / "fonts" / "fonts.css").read_text(encoding="utf-8"), ROOT / "fonts"
    )
    markup = template.replace(
        "{{FONTS}}",
        f"<style>\n/* fonts/fonts.css (woff2 inlined) */\n{fonts_css}\n</style>",
        1,
    )
    if "{{FONTS}}" in markup:
        raise SystemExit("export_app_launcher: font placeholder not replaced")
    # The launcher is the top of the stack; it has nowhere to go back to, and
    # unlike the games it stays pinch-zoomable — it is text and targets, not a
    # canvas with its own gesture handling.
    return appify(markup, back=False, lock_zoom=False, label="launcher")


# webDir layout: index.html is the picker, each mode lives under games/.
APP_GAMES = [
    ("games/infinite.html", "theme-plate.html", "infinite"),
    ("games/bounded.html", "skin-classic.html", "bounded"),
]


def write_app_build() -> list[Path]:
    """Stage the offline app payload under build/app/ and report what it wrote."""
    (APP_BUILD / "games").mkdir(parents=True, exist_ok=True)
    (APP_BUILD / "assets").mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    launcher = APP_BUILD / "index.html"
    launcher.write_text(export_app_launcher(), encoding="utf-8")
    written.append(launcher)

    sphere_exp = next(e for e in EXPERIMENTS if e["id"] == "sphere")
    sphere = APP_BUILD / "games" / "sphere.html"
    sphere.write_text(export_sphere_app(sphere_exp), encoding="utf-8")
    written.append(sphere)

    for out_name, collection_file, label in APP_GAMES:
        path = APP_BUILD / out_name
        path.write_text(export_flat_app(collection_file, label), encoding="utf-8")
        written.append(path)

    # The sphere's help lightbox reads this from the bundle, one level up.
    history = APP_BUILD / "assets" / "classic-minesweeper.png"
    history.write_bytes((ROOT / "sphere" / "assets" / "classic-minesweeper.png").read_bytes())
    written.append(history)

    return written


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
    <p class="lede">Copy-ready HTML for CodePen or local paste. Production themes, lab skins, and the Hexsweeper 3D sphere each get a self-contained one-pager — use <strong>Open</strong> to play, <strong>Copy HTML</strong> here on the desk (not on the playable page). Light and Dark share one infinite file with an in-file toggle. The live multi-theme game stays on the Play link.</p>
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
    parser.add_argument(
        "--app",
        action="store_true",
        help="Stage the offline native-app payload under build/app/ and exit.",
    )
    args = parser.parse_args()

    if args.app:
        for path in write_app_build():
            print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size:,} bytes)")
        return 0

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
    for exp in EXPERIMENTS:
        if exp.get("file"):
            planned[COLLECTION / exp["file"]] = export_sphere(exp)
    planned[COLLECTION / "index.html"] = write_index(THEMES, skins, EXPERIMENTS)

    expected_theme = {f"theme-{t['id']}.html" for t in THEMES}
    expected_skin = {f"skin-{s['id']}.html" for s in skins}
    expected_exp = {e["file"] for e in EXPERIMENTS if e.get("file")}
    expected_names = expected_theme | expected_skin | expected_exp | {"index.html"}
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
