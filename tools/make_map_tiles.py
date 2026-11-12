#!/usr/bin/env python3
"""Cut a big map picture into small tiles for the in-game World Map (public/worldmap.js).

    python3 tools/make_map_tiles.py path/to/map.png            (needs:  pip install pillow)
    python3 tools/make_map_tiles.py map.png --quality 88

Writes public/map/meta.json and public/map/<level>/<x>_<y>.jpg.  Level 0 is the full-size picture,
level 1 is half size, level 2 a quarter, and so on until the smallest level is about 1000 px wide.
The page only loads the tiles it is showing, so a huge picture opens fast and stays sharp.
Use any size of picture: the page reads the real size from meta.json."""
import argparse, json, math, os, shutil, sys, time
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
TILE = 512

ap = argparse.ArgumentParser()
ap.add_argument('src')
ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'public', 'map'))
ap.add_argument('--quality', type=int, default=90)
a = ap.parse_args()

im = Image.open(a.src)
if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
    im = im.convert('RGBA')
    bg = Image.new('RGB', im.size, (15, 36, 16))          # transparent parts become dark green
    bg.paste(im, mask=im.split()[3]); im = bg
else:
    im = im.convert('RGB')
W, H = im.size
levels = 1
while max(W, H) / (2 ** (levels - 1)) > 1000: levels += 1

out = os.path.abspath(a.out)
if os.path.isdir(out): shutil.rmtree(out)
os.makedirs(out)
total = 0
for L in range(levels):
    lw, lh = math.ceil(W / 2 ** L), math.ceil(H / 2 ** L)
    img = im if L == 0 else im.resize((lw, lh), Image.LANCZOS)
    os.makedirs(os.path.join(out, str(L)))
    cols, rows = math.ceil(lw / TILE), math.ceil(lh / TILE)
    for y in range(rows):
        for x in range(cols):
            t = img.crop((x * TILE, y * TILE, min(lw, (x + 1) * TILE), min(lh, (y + 1) * TILE)))
            t.save(os.path.join(out, str(L), f'{x}_{y}.jpg'), 'JPEG', quality=a.quality, optimize=True, progressive=True)
            total += 1
    print(f'level {L}: {lw}x{lh}  {cols}x{rows} tiles')
json.dump({'w': W, 'h': H, 'tile': TILE, 'levels': levels, 'ext': 'jpg', 'v': int(time.time())}, open(os.path.join(out, 'meta.json'), 'w'))
size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(out) for f in fs)
print(f'{total} tiles, {size / 1e6:.1f} MB in {out}')
