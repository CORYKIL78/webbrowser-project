#!/usr/bin/env python3
"""Draw the side picture for the Windows installer (164 x 314, the size the installer pages expect).
Usage: make-installer-art.py <output folder>"""
import importlib.util
import pathlib
import sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("make_branding", HERE / "make-branding.py")
mb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mb)

out = pathlib.Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
w, h = 164, 314
img = mb.two_tone(w, h)
mark = mb.render(96)
img.alpha_composite(mark, ((w - 96) // 2, 70))
img.convert("RGB").save(out / "side.bmp", format="BMP")
print("wrote", out / "side.bmp")
