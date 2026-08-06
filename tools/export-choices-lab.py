#!/usr/bin/env python3
# File Purpose: Build self-contained CodePen-ready lab one-pagers under choices/lab/.
# Primary Functions/Classes: export_skin, strip_lab_chrome, inline_assets, main.
# Inputs: ../skins.json, ../classic.html, ../skins/*.html, ../core.js, ../skin-chrome.css.
# Outputs: choices/lab/*.html (generated — do not hand-edit).

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAB = ROOT / "choices" / "lab"
PUBLIC_BASE = "https://dr.eamer.dev/games/hexsweeper/choices/lab"


def safe_script(text: str) -> str:
    return text.replace("</script", "<\\/script")


def banner(skin: dict) -> str:
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
            f"  Source: {PUBLIC_BASE}/{skin['id']}.html",
            "  License: MIT · Author: Luke Steuber",
            "  Note: Generated export. Regenerate: python3 tools/export-choices-lab.py",
            "-->",
        )
    )


def strip_lab_chrome(markup: str) -> str:
    markup = re.sub(
        r'<nav class="skin-nav"[^>]*>.*?</nav>\s*',
        "",
        markup,
        count=1,
        flags=re.S,
    )
    markup = re.sub(
        r"<nav class=\"menu-links\"[^>]*>.*?</nav>\s*",
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


LAB_BAR_CSS = """
/* lab one-pager chrome (stripped on Copy for CodePen) */
.lab-onepager-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  width: 100%;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
  z-index: 20;
  flex-shrink: 0;
}
.lab-onepager-meta { flex: 1; min-width: 12rem; }
.lab-kicker {
  display: block;
  font: 600 10px/1.2 ui-monospace, monospace;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.65;
}
.lab-title { font: 700 1rem/1.2 system-ui, sans-serif; }
.lab-copy-btn {
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  background: rgba(126, 184, 255, 0.2);
  color: #dbeafe;
  font: 600 13px ui-monospace, monospace;
  cursor: pointer;
}
.lab-copy-btn:hover, .lab-copy-btn:focus-visible {
  background: rgba(126, 184, 255, 0.32);
  outline: 2px solid rgba(126, 184, 255, 0.55);
  outline-offset: 2px;
}
.lab-copy-status {
  width: 100%;
  margin: 0;
  font: 600 11px ui-monospace, monospace;
  color: #6ee7b7;
  min-height: 1.2em;
}
body.lab-onepager {
  height: 100vh;
  height: 100dvh;
  min-height: 0;
}
body.lab-onepager .canvas-container { flex: 1; min-height: 0; }
@media (prefers-reduced-motion: reduce) {
  .lab-copy-btn { transition: none; }
}
"""


def lab_header(skin: dict) -> str:
    tag = skin.get("tag", "lab")
    name = skin["name"]
    techniques = skin.get("techniques", [])
    tech_html = ""
    if techniques:
        chips = "".join(f"<li>{t}</li>" for t in techniques)
        tech_html = f'<ul class="lab-tech" aria-label="Techniques">{chips}</ul>'
    return f"""
<header class="lab-onepager-bar lab-chrome" id="lab-bar">
  <div class="lab-onepager-meta">
    <span class="lab-kicker">Lab · {tag}</span>
    <strong class="lab-title">{name}</strong>
    {tech_html}
  </div>
  <button type="button" id="copy-html-btn" class="lab-copy-btn lab-chrome">Copy for CodePen</button>
  <p id="copy-status" class="lab-copy-status lab-chrome" role="status" aria-live="polite"></p>
</header>
"""


COPY_SCRIPT = """
<script class="lab-chrome">
(function () {
  const btn = document.getElementById("copy-html-btn");
  const status = document.getElementById("copy-status");
  if (!btn) return;
  const copyText = async (value) => {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(value);
    }
    const field = document.createElement("textarea");
    field.value = value;
    document.body.append(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  };
  btn.addEventListener("click", async () => {
    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Copying…";
    try {
      const root = document.documentElement.cloneNode(true);
      root.querySelectorAll(".lab-chrome").forEach((el) => el.remove());
      const html = "<!DOCTYPE html>\\n" + root.outerHTML;
      await copyText(html);
      btn.textContent = "Copied";
      if (status) status.textContent = "Full HTML copied — paste into CodePen or a .html file.";
    } catch (_err) {
      btn.textContent = "Copy failed";
      if (status) status.textContent = "Select View Source and copy manually.";
    }
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = old;
      if (status) status.textContent = "";
    }, 2200);
  });
})();
</script>
"""


def inject_lab_chrome(markup: str, skin: dict) -> str:
    markup = markup.replace("<body>", '<body class="lab-onepager">', 1)
    markup = markup.replace(
        "</head>",
        f"<style>{LAB_BAR_CSS}\n.lab-tech {{ display:flex; flex-wrap:wrap; gap:6px; margin:6px 0 0; padding:0; list-style:none; }}\n"
        f".lab-tech li {{ font: 600 10px ui-monospace,monospace; padding:3px 8px; border-radius:999px; "
        f"background:rgba(255,255,255,0.08); opacity:0.85; }}</style>\n</head>",
        1,
    )
    markup = markup.replace("<body class=\"lab-onepager\">", f"<body class=\"lab-onepager\">\n{lab_header(skin)}", 1)
    markup = markup.replace("</body>", f"{COPY_SCRIPT}\n</body>", 1)
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
        f"<!DOCTYPE html>\n{banner(skin)}\n<html",
        1,
    )
    title = f"{skin['name']} — Hexsweeper Lab"
    markup = re.sub(r"<title>.*?</title>", f"<title>{title}</title>", markup, count=1, flags=re.S)
    markup = strip_lab_chrome(markup)
    markup = inline_skin_assets(markup)
    markup = inject_lab_chrome(markup, skin)
    markup = markup.replace("<html lang=\"en\">", '<html lang="en" class="choices-lab-export">', 1)
    return markup


def load_skins() -> list[dict]:
    data = json.loads((ROOT / "skins.json").read_text(encoding="utf-8"))
    skins = data.get("skins", [])
    if not skins:
        raise SystemExit("skins.json has no skins")
    return skins


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
        planned[path] = export_skin(skin)

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
