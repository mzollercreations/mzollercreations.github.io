#!/usr/bin/env python3
"""Build the Sapphire Creators site into docs/ (GitHub Pages).

    python3 tools/build.py

src/<page>.html are the templates ({{> name}} pulls in src/partials/name.html),
src/i18n/<lang>.json hold the texts, site.json the brand name, URLs and the
optional contact e-mail. German is served at the root, English under /en/.
"""
import hashlib
import html
import json
import posixpath
import random
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
DOCS = ROOT / "docs"
LANGS = ["de", "en"]  # first one is served at the root
# page → template + output path per language (relative to the site root)
PAGES = {
    "index": {"de": "", "en": "en/"},
    "projects": {"de": "projekte/", "en": "en/projects/"},
}

TOKEN = re.compile(
    r'(?P<c>//.*$)|(?P<s>"[^"]*")|(?P<k>\b(?:const|let|return)\b)'
    r'|(?P<b>\b(?:true|false|null)\b)|(?P<n>\b\d+\b)'
    r'|(?P<p>\b[A-Za-z_]\w*(?=\s*:))|(?P<f>\b[A-Za-z_]\w*(?=\())'
)


def highlight(code):
    lines = []
    for line in code.split("\n"):
        out, pos = [], 0
        for m in TOKEN.finditer(line):
            out.append(html.escape(line[pos:m.start()], quote=False))
            out.append(f'<span class="tk-{m.lastgroup}">{html.escape(m.group(), quote=False)}</span>')
            pos = m.end()
        out.append(html.escape(line[pos:], quote=False))
        lines.append(f'<span class="ln">{"".join(out)}</span>')
    return "".join(lines)


def wave_bars(n=36):
    rnd = random.Random(7)
    return "".join(
        f'<i style="--d:{rnd.uniform(0, 1.2):.2f}s;--s:{rnd.uniform(.25, 1):.2f}"></i>' for _ in range(n)
    )


def wordmark(name, letters=False):
    """'Sapphire Creators' → 'Sapphire <em>Creators</em>' (second word in the serif italic)."""
    first, _, rest = name.partition(" ")
    if not letters:
        return f"{html.escape(first)} <em>{html.escape(rest)}</em>"
    i = 0
    out = []
    for word, tag in ((first, "b"), (rest, "em")):
        chars = []
        for c in word:
            chars.append(f'<span style="--i:{i}">{html.escape(c)}</span>')
            i += 1
        out.append(f"<{tag}>{''.join(chars)}</{tag}>")
    return " ".join(out)


def version():
    h = hashlib.md5()
    for p in sorted((ROOT / "assets").rglob("*")):
        if p.is_file() and p.suffix in {".css", ".js"}:
            h.update(p.read_bytes())
    return h.hexdigest()[:8]


def rel(frm, to):
    """Relative link between two site paths ('' = root, 'en/projects/' …)."""
    r = posixpath.relpath(to or ".", frm or ".")
    return "./" if r == "." else r + "/"


def render(template, page, lang, site, v):
    t = json.loads((SRC / "i18n" / f"{lang}.json").read_text())
    paths = PAGES[page]
    here = paths[lang]
    home = PAGES["index"][lang]
    email = site.get("email", "").strip()

    ctx = {k: v for k, v in t.items() if isinstance(v, str)}
    meta = "" if page == "index" else "pj_"
    ctx.update(
        page_title=t[meta + "meta_title"],
        page_desc=t[meta + "meta_desc"],
        og_image=site["url"] + ("assets/img/og.png" if page == "index" else f"assets/img/og-projects-{lang}.png"),
        base="" if here == "" else rel(here, ""),
        home="" if here == home else rel(here, home),
        href_projects=rel(here, PAGES["projects"][lang]),
        cur_projects=' aria-current="page"' if page == "projects" else "",
        v=v,
        site_url=site["url"],
        github=site["github"],
        canonical=site["url"] + here,
        url_de=site["url"] + paths["de"],
        url_en=site["url"] + paths["en"],
        href_de=rel(here, paths["de"]),
        href_en=rel(here, paths["en"]),
        cur_de=' aria-current="page"' if lang == "de" else "",
        cur_en=' aria-current="page"' if lang == "en" else "",
        brand=html.escape(site["name"]),
        wordmark=wordmark(site["name"]),
        marquee_items="".join(f'<span class="mq-item">{html.escape(w)}</span><i class="mq-gem"></i>' for w in t["marquee"]),
        loader_letters=wordmark(site["name"], letters=True),
        code_html=highlight(t["code"]),
        wave_bars=wave_bars(),
        contact_href=(f"mailto:{email}" if email else site["github"]),
        contact_target=("" if email else ' target="_blank" rel="noopener"'),
        contact_btn=(t["contact_btn_mail"] if email else t["contact_btn_github"]),
    )

    def sub(m):
        key = m.group(1)
        if key not in ctx:
            raise KeyError(f"{lang}: missing text '{key}'")
        return ctx[key]

    return re.sub(r"{{\s*(\w+)\s*}}", sub, template)


def include(template):
    return re.sub(r"{{>\s*(\w+)\s*}}", lambda m: (SRC / "partials" / f"{m.group(1)}.html").read_text().rstrip("\n"), template)


def main():
    site = json.loads((ROOT / "site.json").read_text())
    v = version()

    if DOCS.exists():
        shutil.rmtree(DOCS)
    shutil.copytree(ROOT / "assets", DOCS / "assets")
    (DOCS / ".nojekyll").write_text("")

    for page, paths in PAGES.items():
        template = include((SRC / f"{page}.html").read_text())
        for lang in LANGS:
            out = DOCS / paths[lang] / "index.html"
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(render(template, page, lang, site, v))
            print("wrote", out.relative_to(ROOT))


if __name__ == "__main__":
    main()
