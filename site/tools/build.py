#!/usr/bin/env python3
"""Build the Glyde website into site/public.

Each file in site/content/ starts with a small header, then a line of three dashes, then HTML:

    title: Privacy Policy
    description: One sentence for search engines.
    slug: legal/privacy
    ---
    <h1>...</h1>

The page is wrapped in the shared header and footer. Placeholders such as {{OPERATOR}} are
filled in from the PLACEHOLDERS table below, so details are changed in one place.
Run:  python3 site/tools/build.py
"""
import html
import re
import shutil
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
CONTENT = SITE / "content"
STATIC = SITE / "static"
OUT = SITE / "public"

UPDATED = "14 October 2026"

# Details to fill in before the browser is released. They show highlighted on the page.
FILL = {}  # Details still to fill in show highlighted on the page. None at the moment.

# Contact addresses, shown as links.
EMAILS = {
    "EMAIL": "legal@teamcirkle.co.uk",  # legal, licence and trademark questions, terms
    "PRIVACY_EMAIL": "mydata@teamcirkle.co.uk",  # data protection requests
    "SUPPORT_EMAIL": "help@glyde.teamcirkle.co.uk",  # help, abuse and security reports
    "ORG_EMAIL": "info@teamcirkle.co.uk",  # Cirkle Development Group, general
}

PLACEHOLDERS = {k: f'<mark class="fill">{html.escape(v)}</mark>' for k, v in FILL.items()}
PLACEHOLDERS.update({k: f'<a href="mailto:{v}">{v}</a>' for k, v in EMAILS.items()})
PLACEHOLDERS["OPERATOR"] = "Cirkle Development Group"
PLACEHOLDERS["ORG_SITE"] = '<a href="https://teamcirkle.co.uk">teamcirkle.co.uk</a>'
PLACEHOLDERS["UPDATED"] = UPDATED
PLACEHOLDERS["DRAFT"] = ""

MOZ = "Built on Mozilla open source technology. Not officially associated with Mozilla or its products."

LEGAL = [
    ("legal/privacy", "Privacy Policy"),
    ("legal/terms-of-service", "Terms of Service"),
    ("legal/terms-of-use", "Terms of Use"),
    ("legal/cookies", "Cookie Policy"),
    ("legal/acceptable-use", "Acceptable Use Policy"),
    ("legal/age-and-young-users", "Age and Young Users"),
    ("legal/open-source", "Open Source and Trademarks"),
]

TEMPLATE = """<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<meta name="theme-color" content="#0e7c70">
<link rel="icon" href="/logo.svg" type="image/svg+xml">
<link rel="stylesheet" href="/site.css">
<script src="/cookie.js" defer></script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <a class="brand" href="/"><img src="/logo.svg" alt="" width="30" height="30"><span>Glyde</span></a>
  <nav aria-label="Main">
    <a href="/#features">Features</a>
    <a href="/#download">Download</a>
    <a href="/legal">Legal</a>
  </nav>
</header>
<main id="main" class="{cls}">
{body}
</main>
<footer class="foot">
  <div class="foot-in">
    <p class="moz">{moz}</p>
    <ul>{links}</ul>
    <p class="small">&copy; 2026 {operator} (<a href="https://teamcirkle.co.uk">teamcirkle.co.uk</a>, <a href="mailto:info@teamcirkle.co.uk">info@teamcirkle.co.uk</a>). Glyde is for people aged 13 and over.</p>
  </div>
</footer>
</body>
</html>
"""


def parse(path):
    raw = path.read_text(encoding="utf-8")
    head, sep, body = raw.partition("\n---\n")
    if not sep:
        raise SystemExit(f"{path.name}: missing a line of three dashes after the header")
    meta = {}
    for line in head.strip().splitlines():
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip()
    for need in ("title", "description", "slug"):
        if need not in meta:
            raise SystemExit(f"{path.name}: header is missing '{need}'")
    return meta, body.strip()


def fill(text):
    return re.sub(r"\{\{(\w+)\}\}", lambda m: PLACEHOLDERS.get(m.group(1), m.group(0)), text)


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    for f in STATIC.iterdir():
        shutil.copy(f, OUT / f.name)
    links = "".join(f'<li><a href="/{slug}">{html.escape(name)}</a></li>' for slug, name in LEGAL)
    count = 0
    for path in sorted(CONTENT.glob("*.html")):
        meta, body = parse(path)
        slug = meta["slug"]
        is_home = slug == "index"
        page = TEMPLATE.format(
            title=html.escape(meta["title"] if is_home else f'{meta["title"]} | Glyde'),
            description=html.escape(meta["description"]),
            body=fill(body),
            links=links,
            moz=MOZ,
            operator=PLACEHOLDERS["OPERATOR"],
            cls="home" if is_home else "doc",
        )
        target = OUT / f"{slug}.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(page, encoding="utf-8")
        count += 1
    leftovers = [p.name for p in OUT.rglob("*.html") if re.search(r"\{\{\w+\}\}", p.read_text(encoding="utf-8"))]
    if leftovers:
        raise SystemExit(f"Unfilled placeholders in: {leftovers}")
    print(f"Built {count} pages into {OUT}")


if __name__ == "__main__":
    main()
