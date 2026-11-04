"""Gera as variações do retrato usado no card "Sobre" (sem ampliar o original).

Uso:
    python scripts/build-retrato.py "C:\\caminho\\retrato.jpg"
"""

import os
import sys

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "photos")
WIDTHS = (800, 1066)
QUALITY = {800: 84, 1066: 82}

# Cache-bust: os arquivos publicados são servidos com Cache-Control immutable.
# Ao trocar o retrato, aumente o sufixo (v2 -> v3) e ajuste assets/js/app.js.
PREFIX = "retrato-patricia-v2"


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    src = sys.argv[1]
    os.makedirs(OUT_DIR, exist_ok=True)

    with Image.open(src) as original:
        im = ImageOps.exif_transpose(original).convert("RGB")

    w, _ = im.size
    made = []
    for width in WIDTHS:
        if width > w:
            continue  # nunca ampliar
        scale = width / w
        variant = im.resize((width, round(im.height * scale)), Image.LANCZOS)
        name = f"retrato-patricia-{variant.width}.webp"
        variant.save(os.path.join(OUT_DIR, name), "WEBP", quality=QUALITY.get(width, 82), method=6)
        made.append((name, variant.size))

    for name in made:
        print(name)
    print("Fontes usadas em assets/js/app.js (bloco RETRATO).")


if __name__ == "__main__":
    main()
