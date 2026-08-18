"""
make_landscape.py — builds 16:9 landscape slides for TV screens out of the APPROVED portrait
menu pages, without redrawing anything:

  * every element (logo/header, food photo, section text with prices, footer bar) is an exact
    pixel crop of assets/pageN_full.png, only scaled (Lanczos) and placed on a wide canvas;
  * the canvas background is built from an empty texture patch of the approved artwork itself;
  * one section per slide -> the text can be ~2x bigger than the portrait page shows on a TV.

Outputs (used by the web app automatically on landscape screens):
  assets/landscape/lN_full.png          the slide (1920x1080)
  assets/landscape/lN/{header,food,text,footer}.png   exact crops of the slide
  assets/landscape/manifest.json        pixel + percent boxes of every crop

Usage:  python tools/make_landscape.py
"""
import os, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
OUT = os.path.join(ASSETS, 'landscape')
W, H = 1920, 1080

# ---------------------------------------------------------------------------------------------
# Source pieces (page pixels of the approved 1122x1402 artwork). Boxes are the same ones the
# web app uses (see js/config.js `layout`), i.e. measured so that no box carries a sliver of a
# neighbouring element. `notch` = rectangle (page px) to remove from the piece.
# ---------------------------------------------------------------------------------------------
SRC = {
    'page1': dict(
        header=dict(box=(220, 15, 900, 432)),          # title descender + ornament end at 431, plate starts 434
        footer=dict(box=(25, 1314, 1075, 1385)),
        sections=[
            dict(key='shawarma', food=dict(box=(0, 432, 548, 882)),  text=dict(box=(515, 440, 1095, 835))),
            dict(key='arabi',    food=dict(box=(0, 882, 520, 1312)), text=dict(box=(515, 850, 1095, 1255))),
        ]),
    'page2': dict(
        header=dict(box=(220, 15, 900, 390)),
        footer=dict(box=(25, 1241, 1070, 1325)),
        sections=[
            dict(key='bashka', food=dict(box=(0, 385, 620, 812)),  text=dict(box=(620, 425, 1080, 765))),
            dict(key='plate',  food=dict(box=(0, 842, 610, 1240)), text=dict(box=(620, 835, 1080, 1195))),
        ]),
    'page3': dict(
        header=dict(box=(220, 15, 900, 424)),          # title descender + ornament end at 423, burger ring starts 424
        footer=dict(box=(25, 1268, 1070, 1345)),
        sections=[
            dict(key='burger', food=dict(box=(0, 424, 522, 874)),  text=dict(box=(500, 430, 1085, 815))),
            dict(key='extras', food=dict(box=(0, 900, 590, 1266)), text=dict(box=(590, 900, 1085, 1215))),
        ]),
}

# ---- Slide layout (landscape px) ------------------------------------------------------------
HEADER_SCALE = 0.60      # logo / title block at the top
FOOTER_SCALE = 1.25      # phone / address bar at the bottom
TEXT_SCALE_MAX = 1.62    # section text (prices) — the reason for the landscape version
FOOD_SCALE_MAX = 1.42
MARGIN_X = 70
TOP = 26
BOTTOM = 34
GAP_V = 26               # header -> section area -> footer
PAD = 34                 # texture kept around content (page px) — the feather lives here
FEATHER = 30             # px at slide scale

# ---------------------------------------------------------------------------------------------
_pages = {}
def page(p):
    if p not in _pages:
        _pages[p] = Image.open(os.path.join(ASSETS, f'{p}_full.png')).convert('RGB')
    return _pages[p]


def tight_bbox(p, box, notch=None, th=95, pad=PAD):
    """Content bounding box inside `box` (+pad), never leaving `box`."""
    arr = np.array(page(p)).astype(int)
    x0, y0, x1, y1 = box
    sub = arr[y0:y1, x0:x1].max(axis=2) > th
    for (nx0, ny0, nx1, ny1) in (notch or []):
        sub[max(0, ny0 - y0):ny1 - y0, max(0, nx0 - x0):nx1 - x0] = False
    ys, xs = np.where(sub)
    bx0, by0, bx1, by1 = xs.min() + x0, ys.min() + y0, xs.max() + x0 + 1, ys.max() + y0 + 1
    return (max(x0, bx0 - pad), max(y0, by0 - pad), min(x1, bx1 + pad), min(y1, by1 + pad)), (bx0, by0, bx1, by1)


def piece(p, spec, scale):
    """Exact crop of the approved page (with optional notch removed), scaled, with a feathered alpha
    so the texture around the content melts into the slide background. Returns (RGBA, placement info)."""
    box, content = tight_bbox(p, spec['box'], spec.get('notch'))
    x0, y0, x1, y1 = box
    im = page(p).crop(box)
    w, h = im.size
    alpha = Image.new('L', (w, h), 255)
    # feather only where there is texture margin (distance content -> box edge), never over content
    dl, dt = content[0] - x0, content[1] - y0
    dr, db = x1 - content[2], y1 - content[3]
    a = np.full((h, w), 255.0, dtype='float32')
    xs = np.arange(w, dtype='float32'); ys = np.arange(h, dtype='float32')
    F = FEATHER / scale
    def ramp(d, n):  # ramp of length min(F, d) starting at the edge
        L = max(1.0, min(F, d))
        return np.clip(n / L, 0, 1)
    a *= ramp(dl, xs)[None, :]
    a *= ramp(dr, (w - 1 - xs))[None, :]
    a *= ramp(dt, ys)[:, None]
    a *= ramp(db, (h - 1 - ys))[:, None]
    if spec.get('notch'):
        # remove notch regions and soften their inner edges a bit
        m = np.ones((h, w), dtype='float32')
        for (nx0, ny0, nx1, ny1) in spec['notch']:
            m[max(0, ny0 - y0):ny1 - y0, max(0, nx0 - x0):nx1 - x0] = 0
        m = np.array(Image.fromarray((m * 255).astype('uint8'), 'L').filter(ImageFilter.GaussianBlur(3))).astype('float32') / 255
        a *= m
    alpha = Image.fromarray(a.clip(0, 255).astype('uint8'), 'L')
    rgba = im.convert('RGBA'); rgba.putalpha(alpha)
    tw, th_ = max(1, round(w * scale)), max(1, round(h * scale))
    rgba = rgba.resize((tw, th_), Image.LANCZOS)
    # luminance of the outermost texture ring (used to match the slide background under the piece)
    lum = np.array(im.convert('L')).astype('float32')
    r = 6
    edges = dict(top=np.median(lum[:r, :], axis=0), bottom=np.median(lum[-r:, :], axis=0),
                 left=np.median(lum[:, :r], axis=1), right=np.median(lum[:, -r:], axis=1))
    return rgba, dict(src_box=box, content=content, scale=scale, edges=edges)


def coons_field(edges, tw, th_):
    """Smooth field over the piece box that matches its four edge-luminance profiles (Coons patch)."""
    def rs(v, n):
        return np.interp(np.linspace(0, len(v) - 1, n), np.arange(len(v)), v)
    top, bot = rs(edges['top'], tw), rs(edges['bottom'], tw)
    lef, rig = rs(edges['left'], th_), rs(edges['right'], th_)
    u = np.linspace(0, 1, tw)[None, :]; v = np.linspace(0, 1, th_)[:, None]
    c00, c01, c10, c11 = top[0], top[-1], bot[0], bot[-1]
    f = ((1 - v) * top[None, :] + v * bot[None, :] + (1 - u) * lef[:, None] + u * rig[:, None]
         - ((1 - u) * (1 - v) * c00 + u * (1 - v) * c01 + (1 - u) * v * c10 + u * v * c11))
    return f


def match_background(bg, placements, spread=150):
    """Raise/lower the background luminance under and around each piece so that the piece's own
    texture edge melts into it (the crops carry the approved page's local brightness, e.g. the light
    smoke top-left). Adds a smooth offset only — the texture grain itself is untouched."""
    arr = np.array(bg).astype('float32')
    base_lf = np.array(bg.convert('L').filter(ImageFilter.GaussianBlur(40))).astype('float32')
    total = np.zeros((H, W), dtype='float32'); weight = np.zeros((H, W), dtype='float32')
    for (x0, y0, x1, y1), info in placements:
        tw, th_ = x1 - x0, y1 - y0
        f = np.clip(coons_field(info['edges'], tw, th_), 0, 90)
        X0, Y0, X1, Y1 = max(0, x0 - spread), max(0, y0 - spread), min(W, x1 + spread), min(H, y1 + spread)
        ys = np.clip(np.arange(Y0, Y1) - y0, 0, th_ - 1); xs = np.clip(np.arange(X0, X1) - x0, 0, tw - 1)
        ext = f[ys][:, xs]                                   # extended outward by nearest-edge value
        dy = np.maximum(np.maximum(y0 - np.arange(Y0, Y1), np.arange(Y0, Y1) - (y1 - 1)), 0)[:, None]
        dx = np.maximum(np.maximum(x0 - np.arange(X0, X1), np.arange(X0, X1) - (x1 - 1)), 0)[None, :]
        d = np.sqrt(dx ** 2 + dy ** 2)
        wgt = np.clip(1 - d / spread, 0, 1) ** 1.6           # 1 inside the box, fading over `spread`
        total[Y0:Y1, X0:X1] += ext * wgt; weight[Y0:Y1, X0:X1] += wgt
    target = np.where(weight > 0, total / np.maximum(weight, 1e-6), 0)
    offset = (target - base_lf) * np.clip(weight, 0, 1)
    offset = np.array(Image.fromarray(np.clip(offset + 128, 0, 255).astype('uint8'), 'L')
                      .filter(ImageFilter.GaussianBlur(10))).astype('float32') - 128
    arr = arr + offset[..., None]
    return Image.fromarray(arr.clip(0, 255).astype('uint8'), 'RGB')


def background(seed=7):
    """Slide background from an empty texture patch of the approved artwork + grain + vignette + soft light."""
    patch = page('page1').crop((720, 0, 1122, 300))          # pure texture, no content
    pw, ph = patch.size
    s = max(W / pw, H / ph) * 1.02
    big = patch.resize((int(pw * s), int(ph * s)), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.2))
    bx = (big.width - W) // 2; by = (big.height - H) // 2
    bg = np.array(big.crop((bx, by, bx + W, by + H))).astype('float32')
    rng = np.random.default_rng(seed)
    grain = rng.normal(0, 3.2, (H, W, 1)).astype('float32')
    bg = bg + grain
    ys, xs = np.mgrid[0:H, 0:W].astype('float32')
    # soft light top-left like the approved pages
    light = np.exp(-(((xs - W * 0.12) / (W * 0.30)) ** 2 + ((ys - H * 0.10) / (H * 0.55)) ** 2)) * 26
    bg = bg + light[..., None]
    # vignette
    r = np.sqrt(((xs - W / 2) / (W / 2)) ** 2 + ((ys - H / 2) / (H / 2)) ** 2)
    vig = 1 - 0.38 * np.clip((r - 0.55) / 0.75, 0, 1) ** 1.5
    bg = bg * vig[..., None]
    return Image.fromarray(bg.clip(0, 255).astype('uint8'), 'RGB')


def paste(canvas, rgba, x, y):
    canvas.alpha_composite(rgba, (int(round(x)), int(round(y))))
    return (int(round(x)), int(round(y)), int(round(x)) + rgba.width, int(round(y)) + rgba.height)


def build_slide(idx, p, sec):
    bg = background(seed=idx + 3)

    header, hinfo = piece(p, SRC[p]['header'], HEADER_SCALE)
    footer, finfo = piece(p, SRC[p]['footer'], FOOTER_SCALE)
    hx, hy = (W - header.width) / 2, TOP
    fx_, fy_ = (W - footer.width) / 2, H - BOTTOM - footer.height
    area_top = int(round(hy)) + header.height + GAP_V
    area_bot = int(round(fy_)) - GAP_V
    area_h = area_bot - area_top
    avail_w = W - 2 * MARGIN_X

    # scales: as large as allowed, but fit the area
    (tb, tc) = tight_bbox(p, sec['text']['box'])
    (fb, fc) = tight_bbox(p, sec['food']['box'], sec['food'].get('notch'))
    tw, th_ = tb[2] - tb[0], tb[3] - tb[1]
    fw, fh = fb[2] - fb[0], fb[3] - fb[1]
    ts = min(TEXT_SCALE_MAX, area_h / th_)
    fs = min(FOOD_SCALE_MAX, area_h / fh)
    gap = 90
    total = tw * ts + fw * fs + gap
    if total > avail_w:
        k = (avail_w - gap) / (tw * ts + fw * fs)
        ts *= k; fs *= k

    text, tinfo = piece(p, sec['text'], ts)
    food, finfo2 = piece(p, sec['food'], fs)
    total = text.width + food.width + gap
    left = (W - total) / 2
    # RTL: food on the left, text on the right; both vertically centred in the area
    fy = area_top + (area_h - food.height) / 2
    ty = area_top + (area_h - text.height) / 2

    def box_of(x, y, im):
        x, y = int(round(x)), int(round(y))
        return (x, y, x + im.width, y + im.height)
    placements = [
        ('header', header, box_of(hx, hy, header), hinfo),
        ('food', food, box_of(left, fy, food), finfo2),
        ('text', text, box_of(left + food.width + gap, ty, text), tinfo),
        ('footer', footer, box_of(fx_, fy_, footer), finfo),
    ]
    bg = match_background(bg, [(b, i) for (_, _, b, i) in placements])
    canvas = bg.convert('RGBA')
    boxes = {}
    for name, im, b, _ in placements:
        boxes[name] = paste(canvas, im, b[0], b[1])
    return canvas.convert('RGB'), boxes, dict(text_scale=round(ts, 3), food_scale=round(fs, 3))


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = {
        'notes': 'Landscape (16:9) slides composed ONLY from exact pixel crops of the approved portrait '
                 'menu pages (assets/pageN_full.png), scaled with Lanczos and placed on a background made '
                 'from an empty texture patch of the same artwork. Nothing was redrawn or regenerated. '
                 'One menu section per slide.',
        'orientation': 'landscape',
        'pages': {},
    }
    n = 0
    for p in ('page1', 'page2', 'page3'):
        for sec in SRC[p]['sections']:
            n += 1
            key = f'l{n}'
            slide, boxes, info = build_slide(n, p, sec)
            slide.save(os.path.join(OUT, f'{key}_full.png'), optimize=True)
            os.makedirs(os.path.join(OUT, key), exist_ok=True)
            layers = {}
            for name in ('header', 'food', 'text', 'footer'):
                x0, y0, x1, y1 = boxes[name]
                # crop with a small margin so the feathered edge is inside the crop
                m = 6
                x0, y0, x1, y1 = max(0, x0 - m), max(0, y0 - m), min(W, x1 + m), min(H, y1 + m)
                slide.crop((x0, y0, x1, y1)).save(os.path.join(OUT, key, f'{name}.png'), optimize=True)
                layers[name] = {
                    'file': f'landscape/{key}/{name}.png',
                    'box_px': [x0, y0, x1, y1],
                    'x_pct': round(x0 / W * 100, 4), 'y_pct': round(y0 / H * 100, 4),
                    'w_pct': round((x1 - x0) / W * 100, 4), 'h_pct': round((y1 - y0) / H * 100, 4),
                }
            manifest['pages'][key] = {
                'full': f'landscape/{key}_full.png', 'width': W, 'height': H,
                'source': {'page': p, 'section': sec['key']}, 'scales': info, 'layers': layers,
            }
            print(f'{key}: {p}/{sec["key"]}  text x{info["text_scale"]}  food x{info["food_scale"]}')
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print('wrote', os.path.join(OUT, 'manifest.json'))


if __name__ == '__main__':
    main()
