"""Decupează fundalul negru din characters/<nume>.jpeg și scrie characters/<nume>.png cu fundal transparent.

Se rulează doar când se schimbă o poză (jocul folosește PNG-urile, nu JPEG-urile):
    pip install pillow
    python tools/decupeaza_poze.py

Originalele .jpeg nu se modifică. Dacă o poză are păr foarte închis și iese ciuntit, scade pragul ei în THRESH.
"""
import collections
import os
import sys

from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAMES = ['bucur', 'bianca', 'madalina', 'costi', 'andrei', 'ovidiu']
OUT_H = 220                  # înălțimea PNG-ului final (px)
DEFAULT_THRESH = 26          # sub acest nivel (max din R,G,B), un pixel legat de margine e fundal
THRESH = {'madalina': 12}    # păr negru: prag mai mic, ca să nu fie tăiat


def cut(name):
    thresh = THRESH.get(name, DEFAULT_THRESH)
    im = Image.open(os.path.join(ROOT, 'characters', name + '.jpeg')).convert('RGB')
    scale = 480 / max(im.size)
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    w, h = im.size
    px = im.load()
    bg = bytearray(w * h)
    dq = collections.deque()

    def seed(x, y):
        if max(px[x, y]) < thresh and not bg[y * w + x]:
            bg[y * w + x] = 1
            dq.append((x, y))

    for x in range(w):
        seed(x, 0); seed(x, h - 1)
    for y in range(h):
        seed(0, y); seed(w - 1, y)
    while dq:
        x, y = dq.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not bg[ny * w + nx] and max(px[nx, ny]) < thresh:
                bg[ny * w + nx] = 1
                dq.append((nx, ny))

    alpha = Image.new('L', (w, h), 255)
    ap = alpha.load()
    for y in range(h):
        for x in range(w):
            if bg[y * w + x]:
                ap[x, y] = 0
    # eroziune de 1 px (scoate halo-ul negru) + estompare mică
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.0))
    im.putalpha(alpha)
    im = im.crop(alpha.point(lambda v: 255 if v > 40 else 0).getbbox())
    k = OUT_H / im.height
    im = im.resize((max(1, round(im.width * k)), OUT_H), Image.LANCZOS)
    out = os.path.join(ROOT, 'characters', name + '.png')
    im.save(out, optimize=True)
    return out


if __name__ == '__main__':
    for n in (sys.argv[1:] or NAMES):
        print('scris', cut(n))
