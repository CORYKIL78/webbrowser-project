#!/usr/bin/env python3
"""Create Glyde branding inside an unpacked Firefox source tree.

It copies Firefox's own template branding folder (browser/branding/unofficial), then:
  * redraws every image at the SAME size it already has, using the Glyde logo
  * rewrites the product name in the text files that carry it

Working from the template's own files means we do not depend on remembering exact file
names, which can change between Firefox versions. Every change is printed so a failed
build can be traced back.

Usage: make-branding.py <firefox source dir>
Needs: pip install pillow
"""
import json
import re
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
CFG = json.loads((ROOT / "browser" / "glyde.json").read_text())
NAME = CFG["name"]
BG = tuple(int(CFG["colours"]["background"].lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
FG = tuple(int(CFG["colours"]["foreground"].lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
LOGO_SVG = (ROOT / "pwa" / "logo.svg").read_text()

# The "G" with a wavy top, in the logo's 512 unit grid (the 100 unit drawing in logo.svg times 5.12).
K0 = 5.12
_G = [((76, 33), (69, 25), (61, 39), (53, 31)),
      ((53, 31), (46, 24), (37, 26), (31, 35)),
      ((31, 35), (25, 44), (25, 58), (31, 66)),
      ((31, 66), (39, 77), (58, 77), (67, 70)),
      ((67, 70), (75, 64), (76, 57), (74, 50)),
      ((74, 50), (68, 50), (60, 50), (53, 50))]
SEGMENTS = [tuple((x * K0, y * K0) for x, y in seg) for seg in _G]
SKY = (0x12, 0xa0, 0x8f, 255)
GROUND = (0x0a, 0x5c, 0x53, 255)
STROKE_R = 5 * K0


def curve_points(n=300):
    pts = []
    for p0, p1, p2, p3 in SEGMENTS:
        for i in range(n + 1):
            t = i / n
            u = 1 - t
            pts.append((u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                        u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]))
    return pts


def two_tone(w, h):
    img = Image.new("RGBA", (w, h), SKY)
    ImageDraw.Draw(img).rectangle([0, h // 2, w, h], fill=GROUND)
    return img


POINTS = curve_points()


def render(size, rounded=True, inset=1.0):
    """The Glyde mark as a square RGBA image of the given size."""
    size = max(int(size), 1)
    scale = 4 if size < 512 else 2
    s = size * scale
    k = s / 512
    img = two_tone(s, s)
    if rounded:
        mask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(112 * k), fill=255)
        img.putalpha(mask)
    layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    r = STROKE_R * k
    for x, y in POINTS:
        d.ellipse([x * k - r, y * k - r, x * k + r, y * k + r], fill=FG)
    if inset != 1.0:
        n = int(s * inset)
        layer = layer.resize((n, n), Image.LANCZOS)
        pad = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        pad.paste(layer, ((s - n) // 2, (s - n) // 2))
        layer = pad
    img.alpha_composite(layer)
    return img.resize((size, size), Image.LANCZOS)


def render_wide(w, h):
    """For non square images (installer banners, wide tiles): brand colour with a centred mark."""
    img = two_tone(w, h)
    side = int(min(w, h) * 0.6)
    mark = render(side, rounded=False, inset=1.0)
    img.alpha_composite(mark, ((w - side) // 2, (h - side) // 2))
    return img


log = []


def note(msg):
    log.append(msg)
    print(msg)


def replace_images(dest):
    for path in sorted(dest.rglob("*")):
        if not path.is_file():
            continue
        ext = path.suffix.lower()
        try:
            if ext == ".png":
                with Image.open(path) as im:
                    w, h = im.size
                out = render(w) if w == h else render_wide(w, h)
                out.save(path)
                note(f"png  {path.relative_to(dest)} {w}x{h}")
            elif ext == ".ico":
                with Image.open(path) as im:
                    sizes = sorted(im.info.get("sizes") or {(16, 16), (32, 32), (48, 48), (256, 256)})
                render(256).save(path, format="ICO", sizes=sizes)
                note(f"ico  {path.relative_to(dest)} {sizes}")
            elif ext == ".icns":
                render(1024).save(path, format="ICNS")
                note(f"icns {path.relative_to(dest)}")
            elif ext == ".bmp":
                with Image.open(path) as im:
                    w, h = im.size
                render_wide(w, h).convert("RGB").save(path, format="BMP")
                note(f"bmp  {path.relative_to(dest)} {w}x{h}")
            elif ext == ".svg":
                path.write_text(LOGO_SVG)
                note(f"svg  {path.relative_to(dest)} (placeholder: logo used in place of any wordmark)")
        except Exception as exc:  # keep going, report at the end
            note(f"WARN could not redraw {path.relative_to(dest)}: {exc}")


TRADEMARK = f"{NAME} is built on Mozilla open source technology and is not officially associated with Mozilla or its products."


def rewrite_text(dest):
    for path in sorted(dest.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in {".ftl", ".dtd", ".properties", ".sh", ".nsi", ".js"}:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        before = text
        ext = path.suffix.lower()
        if ext == ".ftl":
            # -brand-short-name = Nightly   ->   -brand-short-name = Glyde
            text = re.sub(r"^(-[\w-]*(?:brand|vendor|product)[\w-]*name[\w-]*\s*=\s*).*$",
                          lambda m: m.group(1) + NAME, text, flags=re.M | re.I)
            text = re.sub(r"^(trademarkInfo[\w.-]*\s*=\s*).*$",
                          lambda m: m.group(1) + TRADEMARK, text, flags=re.M | re.I)
        elif ext == ".dtd":
            text = re.sub(r'(<!ENTITY\s+(?:brand|vendor)\w*Name\w*\s+")[^"]*(")',
                          lambda m: m.group(1) + NAME + m.group(2), text, flags=re.I)
            text = re.sub(r'(<!ENTITY\s+trademarkInfo[\w.-]*\s+")[^"]*(")',
                          lambda m: m.group(1) + TRADEMARK + m.group(2), text, flags=re.I)
        elif ext == ".properties":
            text = re.sub(r"^((?:brand|vendor)\w*Name\w*\s*=\s*).*$",
                          lambda m: m.group(1) + NAME, text, flags=re.M | re.I)
            text = re.sub(r"^(trademarkInfo[\w.-]*\s*=\s*).*$",
                          lambda m: m.group(1) + TRADEMARK, text, flags=re.M | re.I)
        elif ext == ".sh":
            text = re.sub(r"^(MOZ_APP_DISPLAYNAME=).*$", lambda m: m.group(1) + NAME, text, flags=re.M)
            text = re.sub(r"^(MOZ_MACBUNDLE_NAME=).*$", lambda m: m.group(1) + NAME + ".app", text, flags=re.M)
        elif ext == ".nsi":
            text = re.sub(r'(!define\s+(?:BrandShortName|BrandFullName|BrandFullNameInternal|CompanyName)\s+")[^"]*(")',
                          lambda m: m.group(1) + NAME + m.group(2), text)
        if text != before:
            path.write_text(text, encoding="utf-8")
            note(f"text {path.relative_to(dest)}")


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1]).resolve()
    template = src / "browser" / "branding" / "unofficial"
    if not template.is_dir():
        sys.exit(f"Template branding not found at {template}. Firefox layout may have changed.")
    dest = src / CFG["brandingDir"]
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(template, dest)
    note(f"Copied {template.name} to {dest.relative_to(src)}")
    replace_images(dest)
    rewrite_text(dest)
    warnings = [m for m in log if m.startswith("WARN")]
    print(f"\nDone. {len(log)} changes, {len(warnings)} warnings.")
    if not any(m.startswith("png") for m in log):
        sys.exit("No images were redrawn, so the template looks unusual. Stopping.")


if __name__ == "__main__":
    main()
