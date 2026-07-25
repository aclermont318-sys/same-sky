# Builds icons/same-sky.ico (multi-size) from icons/icon-512.png, for the
# Windows desktop / Start Menu shortcut. Run: python tools/make-ico.py

import os
from PIL import Image

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(HERE, "icons", "icon-512.png")
OUT = os.path.join(HERE, "icons", "same-sky.ico")
SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

if __name__ == "__main__":
    img = Image.open(SRC).convert("RGBA")
    img.save(OUT, format="ICO", sizes=SIZES)
    print(f"wrote {OUT} ({len(SIZES)} sizes)")
