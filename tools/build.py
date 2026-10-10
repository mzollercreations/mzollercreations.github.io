#!/usr/bin/env python3
"""Build the mzollercreations site into docs/ (GitHub Pages).

    python3 tools/build.py

src/index.html is the template, src/i18n/<lang>.json hold the texts,
site.json the URLs and the optional contact e-mail. German is served at
the root, English under /en/.
"""
import hashlib
import html
import json
import random
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
DOCS = ROOT / "docs"
LANGS = ["de", "en"]  # first one is served at the root

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


def version():
    h = hashlib.md5()
    for p in sorted((ROOT / "assets").rglob("*")):
        if p.is_file() and p.suffix in {".css", ".js"}:
            h.update(p.read_bytes())
    return h.hexdigest()[:8]


def render(template, lang, site, v):
    t = json.loads((SRC / "i18n" / f"{lang}.json").read_text())
    root_lang = lang == LANGS[0]
    url = {l: site["url"] + ("" if l == LANGS[0] else f"{l}/") for l in LANGS}
    base = "" if root_lang else "../"
    email = site.get("email", "").strip()

    ctx = {k: v for k, v in t.items() if isinstance(v, str)}
    ctx.update(
        base=base,
        v=v,
        site_url=site["url"],
        github=site["github"],
        canonical=url[lang],
        url_de=url["de"],
        url_en=url["en"],
        href_de="./" if root_lang else "../",
        href_en="en/" if root_lang else "./",
        cur_de=' aria-current="page"' if lang == "de" else "",
        cur_en=' aria-current="page"' if lang == "en" else "",
        marquee_items="".join(f'<span class="mq-item">{html.escape(w)}</span>' for w in t["marquee"]),
        loader_letters="".join(f'<span style="--i:{i}">{c}</span>' for i, c in enumerate("mzollercreations")),
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


def main():
    site = json.loads((ROOT / "site.json").read_text())
    template = (SRC / "index.html").read_text()
    v = version()

    if DOCS.exists():
        shutil.rmtree(DOCS)
    shutil.copytree(ROOT / "assets", DOCS / "assets")
    (DOCS / ".nojekyll").write_text("")

    for lang in LANGS:
        out = DOCS / ("index.html" if lang == LANGS[0] else f"{lang}/index.html")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(render(template, lang, site, v))
        print("wrote", out.relative_to(ROOT))


if __name__ == "__main__":
    main()
