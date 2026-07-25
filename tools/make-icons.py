# Generates icons/icon-192.png and icons/icon-512.png for the PWA manifest.
# Design: raspberry heart on warm cream, matching css/theme.css tokens.
# Run: python tools/make-icons.py

from PIL import Image, ImageDraw
import os

CREAM = (251, 243, 235, 255)
ROSE = (217, 87, 110, 255)
ROSE_DEEP = (178, 58, 82, 255)


def heart_mask(size, ss=4):
    """Point-in-heart via the classic implicit curve (x^2+y^2-1)^3 - x^2*y^3 <= 0."""
    n = size * ss
    img = Image.new("L", (n, n), 0)
    px = img.load()
    for j in range(n):
        for i in range(n):
            x = (i / n) * 3.0 - 1.5
            y = 1.35 - (j / n) * 2.9
            v = (x * x + y * y - 1) ** 3 - x * x * y ** 3
            if v <= 0:
                px[i, j] = 255
    return img.resize((size, size), Image.LANCZOS)


def make_icon(size, path):
    img = Image.new("RGBA", (size, size), CREAM)
    d = ImageDraw.Draw(img)
    m = int(size * 0.04)
    d.rounded_rectangle([m, m, size - m, size - m], radius=int(size * 0.22),
                        outline=ROSE, width=max(2, size // 96))
    heart_px = int(size * 0.62)
    mask = heart_mask(heart_px)
    heart = Image.new("RGBA", (heart_px, heart_px), ROSE)
    shadow = Image.new("RGBA", (heart_px, heart_px), ROSE_DEEP)
    ox = (size - heart_px) // 2
    oy = int(size * 0.21)
    img.paste(shadow, (ox + size // 90, oy + size // 90), mask)
    img.paste(heart, (ox, oy), mask)
    img.save(path)
    print(f"wrote {path} ({size}x{size})")


if __name__ == "__main__":
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    icons = os.path.join(here, "icons")
    os.makedirs(icons, exist_ok=True)
    make_icon(192, os.path.join(icons, "icon-192.png"))
    make_icon(512, os.path.join(icons, "icon-512.png"))
