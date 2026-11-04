"""Acha fotos quase repetidas no acervo usando assinatura perceptual (dHash).

Uso:
    python scripts/find-dupes.py            # relatório dos grupos
    python scripts.find-dupes.py --remover p03,p15   # tira do acervo e regrava o manifest
"""

import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "assets", "js", "photos.js")
PHOTOS_DIR = os.path.join(ROOT, "assets", "photos")
THUMB_DIR = os.path.join(PHOTOS_DIR, "thumb")
DIST_LIMITE = 8  # 0 = idêntica, até 8 em 64 bits já parece "a mesma foto"


def carregar_manifest():
    raw = open(MANIFEST, encoding="utf-8").read()
    return json.loads(raw[raw.index("[") : raw.rindex("]") + 1])


def dhash(path, tam=8):
    im = Image.open(path).convert("L").resize((tam + 1, tam), Image.LANCZOS)
    px = list(im.getdata())
    bits = 0
    for row in range(tam):
        for col in range(tam):
            bits = (bits << 1) | int(px[row * (tam + 1) + col] > px[row * (tam + 1) + col + 1])
    return bits


def hamming(a, b):
    return bin(a ^ b).count("1")


def grupos(fotos):
    assinaturas = []
    for f in fotos:
        caminho = os.path.join(THUMB_DIR, f["id"] + ".webp")
        assinaturas.append((f["id"], dhash(caminho)))

    visitado = set()
    saida = []
    for i, (id_a, hash_a) in enumerate(assinaturas):
        if id_a in visitado:
            continue
        grupo = [id_a]
        for j in range(i + 1, len(assinaturas)):
            id_b, hash_b = assinaturas[j]
            if id_b in visitado:
                continue
            if hamming(hash_a, hash_b) <= DIST_LIMITE:
                grupo.append(id_b)
                visitado.add(id_b)
        if len(grupo) > 1:
            saida.append(grupo)
    return saida


def remover(ids):
    fotos = carregar_manifest()
    sobram = [f for f in fotos if f["id"] not in ids]
    corpo = json.dumps(sobram, ensure_ascii=False, indent=2)
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        fh.write("// Gerado por scripts/build-photos.py\nwindow.PORTFOLIO_PHOTOS = ")
        fh.write(corpo)
        fh.write(";\n")
    apago = 0
    for foto in fotos:
        if foto["id"] not in ids:
            continue
        caminhos = [os.path.join(THUMB_DIR, foto["id"] + ".webp"), os.path.join(ROOT, foto["thumb"])]
        caminhos += [os.path.join(ROOT, v["src"]) for v in foto["variants"]]
        for c in caminhos:
            if os.path.exists(c):
                os.remove(c)
                apago += 1
    print(f"{len(ids)} fotos removidas, {apago} arquivos apagados, {len(sobram)} no acervo.")


def main():
    fotos = carregar_manifest()
    if "--remover" in sys.argv:
        alvo = sys.argv[sys.argv.index("--remover") + 1]
        remover(set(alvo.split(",")))
        return

    print(f"acervo: {len(fotos)} fotos")
    for grupo in grupos(fotos):
        nomes = {f["id"]: f["source"] for f in fotos}
        print("  " + ", ".join(f"{i} ({nomes[i]})" for i in grupo))


if __name__ == "__main__":
    main()
