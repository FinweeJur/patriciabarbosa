"""Adiciona uma foto avulsa ao acervo já processado, sem renumerar as demais.

Uso:
    python scripts/add-photo.py "C:\\caminho\\foto.jpg"
"""

import json
import os
import re
import sys

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS_DIR = os.path.join(ROOT, "assets", "photos")
THUMB_DIR = os.path.join(PHOTOS_DIR, "thumb")
MANIFEST = os.path.join(ROOT, "assets", "js", "photos.js")

FULL_WIDTHS = (800, 1400, 1800)
FULL_QUALITY = {800: 84, 1400: 83, 1800: 82}
THUMB_EDGE = 480
THUMB_QUALITY = 82


def resized(im, width):
    w, h = im.size
    scale = min(1.0, width / w)
    if scale >= 1.0:
        return im.copy()
    return im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    source = sys.argv[1]
    with open(MANIFEST, encoding="utf-8") as fh:
        raw = fh.read()
    payload = raw[raw.index("[") : raw.rindex("]") + 1]
    manifest = json.loads(payload)

    base = f"p{len(manifest) + 1:02d}"

    with Image.open(source) as original:
        im = ImageOps.exif_transpose(original).convert("RGB")

    variants = []
    targets = [w for w in FULL_WIDTHS if w <= im.width] or [im.width]
    if im.width < FULL_WIDTHS[-1] and targets[-1] < im.width:
        targets.append(im.width)  # variante nativa, sem ampliar
    for width in targets:
        variant = resized(im, width)
        variant.save(
            os.path.join(PHOTOS_DIR, f"{base}-{variant.width}.webp"),
            "WEBP",
            quality=FULL_QUALITY.get(width, 82),
            method=6,
        )
        variants.append({"src": f"assets/photos/{base}-{variant.width}.webp", "w": variant.width})

    thumb = resized(im, THUMB_EDGE)
    thumb.save(
        os.path.join(THUMB_DIR, base + ".webp"), "WEBP", quality=THUMB_QUALITY, method=6
    )

    full = resized(im, 1800)
    manifest.append(
        {
            "id": base,
            "variants": variants,
            "thumb": f"assets/photos/thumb/{base}.webp",
            "w": full.width,
            "h": full.height,
            "thumbW": thumb.width,
            "thumbH": thumb.height,
            "ratio": round(im.width / im.height, 4),
            "alt": "Retrato de Patrícia Barbosa",
            "source": re.sub(r"\s+", " ", os.path.basename(source)).strip(),
        }
    )

    body = json.dumps(manifest, ensure_ascii=False, indent=2)
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        fh.write("// Gerado por scripts/build-photos.py\n")
        fh.write("window.PORTFOLIO_PHOTOS = ")
        fh.write(body)
        fh.write(";\n")

    print(f"{base} adicionada ({variants[-1]['w']}px). Total: {len(manifest)} fotos.")


if __name__ == "__main__":
    main()
