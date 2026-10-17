#!/usr/bin/env python3
"""Turn a folder of emoji images into the app's emoji catalogue.

Usage:  python3 tools/build_emojis.py "path/to/emojis_renamed"
Needs:  pip install pillow

Name every source file after what it shows. One image can serve several activities:

    gym, calisthenics, physical exercise.png
    study_school, homework, tuition.png
    making notes(Except academics)   <- text in (...) is shown to the AI, but not used for matching

The FIRST name becomes the image's key (lower-case, spaces -> "_"), e.g. "gym.png".
For every image the script:
  1. trims the empty space around the icon and makes it square (the activity log shows it at ~34px, so an
     icon floating in a big transparent frame would be tiny),
  2. resizes it to 256x256 (transparent PNG) and saves it as public/emojis/<key>.png,
  3. writes data/emojis.json (key, names, keywords, url).

Re-run it whenever you add or rename images. Images that are not in the folder any more stay in public/emojis
but disappear from the catalogue.
"""
import json, pathlib, re, sys

try:
    from PIL import Image, ImageFilter
except ImportError:
    sys.exit('This script needs Pillow:  pip install pillow')

root = pathlib.Path(__file__).resolve().parent.parent
src = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
if not src or not src.is_dir():
    sys.exit(__doc__)

SIZE = 256            # output size (square)
MARGIN = 0.04         # empty border kept around the icon, as a share of its size
ALPHA_MIN = 96        # pixels fainter than this are treated as background haze when trimming
DEFAULT_KEY = 'project'   # used when nothing better matches (a neutral checklist icon)
PRIVATE_KEYS = {'unknown'}  # never offered to the AI and never picked by keyword: the server uses it for Unknown activities

out_dir = root / 'public' / 'emojis'
out_dir.mkdir(parents=True, exist_ok=True)


def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')


def tidy_name(n):                       # "making notes(Except academics)" -> "making notes (Except academics)"
    n = re.sub(r'\s*\(', ' (', n.strip())
    return re.sub(r'\s+', ' ', n)


def keyword(n):                         # what the keyword matcher looks for: no (notes), no underscores
    n = re.sub(r'\(.*?\)', '', n)
    return re.sub(r'\s+', ' ', n.replace('_', ' ')).strip().lower()


def prepare(path):
    im = Image.open(path).convert('RGBA')
    mask = im.getchannel('A').point(lambda a: 255 if a >= ALPHA_MIN else 0)
    # Shrinking the mask first drops tiny stray specks (background-remover leftovers) so they cannot stretch the
    # crop; the box is then grown back by the same amount so the icon's outline is not clipped.
    box = mask.filter(ImageFilter.MinFilter(7)).getbbox() or mask.getbbox()
    if box:
        box = (max(0, box[0] - 3), max(0, box[1] - 3), min(im.width, box[2] + 3), min(im.height, box[3] + 3))
        im = im.crop(box)
    w, h = im.size
    side = int(max(w, h) * (1 + 2 * MARGIN))
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - w) // 2, (side - h) // 2), im)
    return sq.resize((SIZE, SIZE), Image.LANCZOS)


items, seen = [], set()
for f in sorted(src.glob('*.png')):
    names = [tidy_name(n) for n in f.stem.split(',') if n.strip()]
    if not names:
        continue
    key = slug(names[0])
    if key in seen:
        sys.exit(f'Two images would both get the key "{key}" ({f.name}). Give one of them a different first name.')
    seen.add(key)
    prepare(f).save(out_dir / f'{key}.png', optimize=True)
    item = {
        'key': key,
        'name': ', '.join(names),
        'names': names,
        'keywords': sorted({k for k in (keyword(n) for n in names) if k}),
        'url': f'/emojis/{key}.png',
    }
    if key in PRIVATE_KEYS:
        item['private'] = True
    items.append(item)

if not items:
    sys.exit(f'No .png files found in {src}')
default = DEFAULT_KEY if DEFAULT_KEY in seen else next((i['key'] for i in items if not i.get('private')), items[0]['key'])
for i in items:
    if i['key'] == default:
        i['default'] = True

(root / 'data' / 'emojis.json').write_text(json.dumps(items, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(f'{len(items)} images written to {out_dir} and data/emojis.json (default: {default})')

# every image an activity points to must exist
acts = json.loads((root / 'data' / 'activities.json').read_text(encoding='utf-8'))['activities']
urls = {i['url'] for i in items}
for a in acts:
    if a.get('image') and a['image'] not in urls:
        print(f'WARNING: activity "{a["id"]}" uses {a["image"]}, which is not in the catalogue')
for a in acts:
    if not a.get('image') and a['journal'] != 'Unknown':
        print(f'note: activity "{a["id"]}" has no fixed image, so the AI / keywords pick one')
