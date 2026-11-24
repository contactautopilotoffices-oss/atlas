#!/usr/bin/env python3
"""Build the transparent Autopilot and Flipkart logo files for the Andheri experience.

Sources (see SOURCES.md):
  official/flipkart-header-2026.svg   flipkart.com header logo (vector "Flipkart" wordmark, #2A55E5)
  official/flipkart-app-icon-lite.png Flipkart app icon (2048 px): the blue "f", traced with potrace
  airoli-rtp/brand/autopilot-wordmark-white.png  approved Autopilot wordmark, traced with potrace

Run from the repository root:  python3 media/flipkart-andheri/brand/build_logos.py
Needs potrace (brew install potrace) and Pillow.
"""
import os, re, subprocess, tempfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
BLUE, YELLOW = '#2A55E5', '#FFC200'


def trace(img_1bit, extra=()):
    """potrace a 1-bit PIL image; return (viewBox w, h, group transform, path data list)."""
    with tempfile.TemporaryDirectory() as t:
        pbm, svg = os.path.join(t, 'a.pbm'), os.path.join(t, 'a.svg')
        img_1bit.save(pbm)
        subprocess.run(['potrace', pbm, '-s', '-o', svg, '--tight', '-a', '1.0', *extra], check=True)
        s = open(svg).read()
    w, h = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', s).groups()
    tr = re.search(r'<g transform="([^"]+)"', s).group(1)
    paths = re.findall(r'<path d="([^"]+)"', s)
    return float(w), float(h), tr, [' '.join(p.split()) for p in paths]


def autopilot():
    im = Image.open(os.path.join(ROOT, 'airoli-rtp/brand/autopilot-wordmark-white.png')).convert('RGBA')
    a = im.split()[3].resize((im.width * 4, im.height * 4), Image.LANCZOS)
    w, h, tr, paths = trace(a.point(lambda v: 0 if v > 127 else 255).convert('1'), ('-t', '8', '-O', '0.3'))
    body = ''.join(f'<path d="{d}"/>' for d in paths)
    for name, fill in (('autopilot-white.svg', '#FFFFFF'), ('autopilot-dark.svg', '#0B0B0C')):
        open(os.path.join(HERE, name), 'w').write(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w/10:g}" height="{h/10:g}" role="img" aria-label="Autopilot">'
            f'<title>Autopilot</title><g transform="{tr}" fill="{fill}">{body}</g></svg>\n')
    # raster versions for video and documents (transparent PNG, 1760 px wide)
    white = im.resize((1760, 224), Image.LANCZOS)
    white.save(os.path.join(HERE, 'autopilot-white.png'))
    r, g, b, alpha = white.split()
    dark = Image.merge('RGBA', (r.point(lambda v: 11), g.point(lambda v: 11), b.point(lambda v: 12), alpha))
    dark.save(os.path.join(HERE, 'autopilot-dark.png'))
    return w / h


def flipkart_f():
    im = Image.open(os.path.join(HERE, 'official/flipkart-app-icon-lite.png')).convert('RGB')
    bw = Image.new('1', im.size, 1)
    px, out = im.load(), bw.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = px[x, y]
            if b > 120 and r < 120 and g < 140:
                out[x, y] = 0
    return trace(bw, ('-t', '10', '-O', '0.4'))


def wordmark_path():
    s = open(os.path.join(HERE, 'official/flipkart-header-2026.svg')).read()
    for attrs in re.findall(r'<path([^>]*)/?>', s):
        if 'fill="#2A55E5"' in attrs:
            return re.search(r' d="([^"]+)"', attrs).group(1)
    raise SystemExit('Wordmark path not found in the official header SVG')


# The "Flipkart" wordmark occupies x 69.0..157.0, y 2.0..25.6 of the 159 x 40 header artboard
# (measured with getBBox in Chrome); the Explore Plus line below it is not used.
WM_BOX = (69.0, 2.0, 88.0, 23.585)


def bag(fw, fh, ftr, fpaths, uid):
    """The Flipkart shopping bag in a 100 x 101 box: back panel, gussets, front panel, rope handle, blue f."""
    f_scale = 85.2 / fw                    # the f spans the bag's width, from speed-line tip to hook
    f_body = ''.join(f'<path d="{d}"/>' for d in fpaths)
    return f'''<defs>
<linearGradient id="{uid}-front" x1="0" y1="15" x2="0" y2="101" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFC200"/><stop offset="1" stop-color="#FFD41F"/></linearGradient>
<clipPath id="{uid}-clip"><path d="M0 15.2H100V96.6A4.4 4.4 0 0 1 95.6 101H4.4A4.4 4.4 0 0 1 0 96.6Z"/></clipPath>
</defs>
<path d="M8.6 0H91.4A1.6 1.6 0 0 1 93 1.6V15.2H7V1.6A1.6 1.6 0 0 1 8.6 0Z" fill="#F29A1F"/>
<circle cx="29.2" cy="7.4" r="2.3" fill="#C9A92B"/><circle cx="70.8" cy="7.4" r="2.3" fill="#C9A92B"/>
<path d="M7 5.6L0 15.2H7Z" fill="#FFD84A"/><path d="M93 5.6L100 15.2H93Z" fill="#FFD84A"/>
<path d="M0 15.2H100V96.6A4.4 4.4 0 0 1 95.6 101H4.4A4.4 4.4 0 0 1 0 96.6Z" fill="url(#{uid}-front)"/>
<path d="M0 15.2H100V16.2H0Z" fill="#FFF3B0" opacity=".85"/>
<path d="M27 21.4C27.6 46.2 72.4 46.2 73 21.4" fill="none" stroke="#C99300" stroke-opacity=".38" stroke-width="5" stroke-linecap="round"/>
<path d="M27 19.6C27.6 44.4 72.4 44.4 73 19.6" fill="none" stroke="#FFFFFF" stroke-width="5.2" stroke-linecap="round"/>
<path d="M27 19.6C27.6 44.4 72.4 44.4 73 19.6" fill="none" stroke="#C8CDD6" stroke-width="5.2" stroke-dasharray=".9 2.3"/>
<g clip-path="url(#{uid}-clip)"><g transform="translate(7.4 38.6) scale({f_scale:.6f})"><g transform="{ftr}" fill="{BLUE}">{f_body}</g></g></g>'''


def flipkart(f):
    fw, fh, ftr, fpaths = f
    wm = wordmark_path()
    x0, y0, ww, wh = WM_BOX
    # Lockup: wordmark then bag; the bag stands 2.05x the wordmark height, the wordmark sits on the bag's optical centre.
    bag_h = 101.0
    wm_scale = (bag_h / 2.05) / wh
    wm_w = ww * wm_scale
    gap = 15.0
    W, H = wm_w + gap + 100, bag_h
    wm_y = (H - wh * wm_scale) / 2 + 4.5
    def lockup(word_fill, uid):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.2f} {H:.2f}" width="{W*2:.0f}" height="{H*2:.0f}" role="img" aria-label="Flipkart">'
                f'<title>Flipkart</title>'
                f'<g transform="translate(0 {wm_y:.3f}) scale({wm_scale:.5f}) translate({-x0} {-y0})"><path d="{wm}" fill="{word_fill}"/></g>'
                f'<g transform="translate({wm_w + gap:.3f} 0)">{bag(fw, fh, ftr, fpaths, uid)}</g></svg>\n')
    open(os.path.join(HERE, 'flipkart-logo.svg'), 'w').write(lockup(BLUE, 'fk'))
    open(os.path.join(HERE, 'flipkart-logo-reverse.svg'), 'w').write(lockup('#FFFFFF', 'fkr'))
    open(os.path.join(HERE, 'flipkart-bag.svg'), 'w').write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 101" width="200" height="202" role="img" aria-label="Flipkart">'
        f'<title>Flipkart</title>{bag(fw, fh, ftr, fpaths, "fkb")}</svg>\n')
    return W / H


if __name__ == '__main__':
    ap = autopilot()
    fk = flipkart(flipkart_f())
    print(f'autopilot aspect {ap:.3f}, flipkart lockup aspect {fk:.3f}')
