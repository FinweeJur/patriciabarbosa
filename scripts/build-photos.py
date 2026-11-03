"""Otimiza o acervo 'Melhores Fotos Site Pati' para a web.

Uso:
    python scripts/build-photos.py "C:\\caminho\\para\\pasta-ou-zip"

Estratégia de peso x qualidade:
    - 3 larguras em WebP (srcset): 800, 1400 e 1800 px no maior lado
    - q84 nas menores, q82 na maior (compomisso qualidade/peso)
    - thumbs de 480 px para o atlas WebGL do hero e o rastro do cursor
    - o navegador só baixa a largura de que precisa (srcset + sizes)
    - imagens exibidas fora da primeira dobra usam loading="lazy"

Gera:
    assets/photos/p01-800.webp, p01-1400.webp, p01-1800.webp ...
    assets/photos/thumb/p01.webp ...
    assets/js/photos.js (manifest com dimensões)
"""

import json
import os
import re
import sys
import zipfile
from io import BytesIO

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS_DIR = os.path.join(ROOT, "assets", "photos")
THUMB_DIR = os.path.join(PHOTOS_DIR, "thumb")
MANIFEST = os.path.join(ROOT, "assets", "js", "photos.js")

FULL_WIDTHS = (800, 1400, 1800)
FULL_QUALITY = {800: 84, 1400: 83, 1800: 82}
THUMB_EDGE = 480
THUMB_QUALITY = 82
MAX_UPSCALE = 1.0


def iter_sources(path):
    if os.path.isdir(path):
        for name in sorted(os.listdir(path)):
            full = os.path.join(path, name)
            if os.path.isfile(full) and name.lower().endswith(
                (".jpg", ".jpeg", ".png", ".webp")
            ):
                yield name, full
        return

    with zipfile.ZipFile(path) as zf:
        for info in sorted(zf.infolist(), key=lambda i: i.filename):
            if info.is_dir() or not info.filename.lower().endswith(
                (".jpg", ".jpeg", ".png", ".webp")
            ):
                continue
            yield info.filename, BytesIO(zf.read(info))


def normalize(im):
    return ImageOps.exif_transpose(im).convert("RGB")


def resized(im, width):
    """Redimensiona pela largura, sem ampliar, mantendo a proporção."""
    w, h = im.size
    scale = min(MAX_UPSCALE, width / w)
    if scale >= 1.0:
        return im.copy()
    return im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    source = sys.argv[1]
    os.makedirs(THUMB_DIR, exist_ok=True)

    manifest = []
    index = 0
    for name, handle in iter_sources(source):
        index += 1
        try:
            with Image.open(handle) as original:
                im = normalize(original)
        except Exception as exc:  # imagem corrompida não derruba o lote
            print(f"[skip] {name}: {exc}")
            index -= 1
            continue

        base = f"p{index:02d}"
        variants = []
        for width in FULL_WIDTHS:
            variant = resized(im, width)
            # não gerar variantes maiores que o original (evita arquivo inútil)
            if im.width < width and variants:
                break
            out = os.path.join(PHOTOS_DIR, f"{base}-{variant.width}.webp")
            variant.save(out, "WEBP", quality=FULL_QUALITY[width], method=6)
            variants.append(
                {"src": f"assets/photos/{base}-{variant.width}.webp", "w": variant.width}
            )

        thumb = resized(im, THUMB_EDGE)
        thumb_path = os.path.join(THUMB_DIR, base + ".webp")
        thumb.save(thumb_path, "WEBP", quality=THUMB_QUALITY, method=6)

        largest = variants[-1]
        manifest.append(
            {
                "id": base,
                "variants": variants,
                "thumb": f"assets/photos/thumb/{base}.webp",
                "w": resized(im, 1800).width,
                "h": resized(im, 1800).height,
                "thumbW": thumb.width,
                "thumbH": thumb.height,
                "ratio": round(im.width / im.height, 4),
                "alt": "Ensaio fotográfico por Patrícia Barbosa",
                "source": re.sub(r"\s+", " ", name).strip(),
            }
        )
        print(f"[{index:02d}] {name} -> {base} ({largest['w']}px)")

    body = json.dumps(manifest, ensure_ascii=False, indent=2)
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        fh.write("// Gerado por scripts/build-photos.py\n")
        fh.write("window.PORTFOLIO_PHOTOS = ")
        fh.write(body)
        fh.write(";\n")

    print(f"\n{len(manifest)} fotos processadas.")
    print(f"Manifest: {MANIFEST}")


if __name__ == "__main__":
    main()
