#!/usr/bin/env python3
"""Draw the app icons and the 1200x630 share card into docs/. Needs Pillow."""
import math, os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), '..', 'docs')
INDIGO, CREAM, INK, BLUE, BLUE_D = '#3b3f9c', '#f6f3ec', '#1b1a17', '#2a78d6', '#1c5cab'
SS = 4  # supersample

def worm_points(cx, cy, w, amp, waves=1.5, n=160):
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append((cx - w / 2 + w * t, cy + amp * math.sin(2 * math.pi * waves * t + math.pi)))
    return pts

def draw_worm(d, pts, width, color, eye=None):
    r = width / 2
    for x, y in pts:
        d.ellipse([x - r, y - r, x + r, y + r], fill=color)
    if eye:
        d.ellipse([eye[0] - eye[2], eye[1] - eye[2], eye[0] + eye[2], eye[1] + eye[2]], fill=eye[3])

def icon(size, rounded=True):
    s = size * SS
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    k = s / 512
    if rounded:
        d.rounded_rectangle([0, 0, s, s], radius=112 * k, fill=INDIGO)
    else:
        d.rectangle([0, 0, s, s], fill=INDIGO)
    pts = [(x * k, y * k) for x, y in worm_points(256, 256, 292, 64)]
    draw_worm(d, pts, 46 * k, CREAM, (pts[-1][0] - 2 * k, pts[-1][1] - 8 * k, 9 * k, INDIGO))
    return im.resize((size, size), Image.LANCZOS)

def write_svg():
    pts = worm_points(256, 256, 292, 64, n=60)
    path = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)
    ex, ey = pts[-1][0] - 2, pts[-1][1] - 8
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="{INDIGO}"/>'
           f'<path d="{path}" fill="none" stroke="{CREAM}" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>'
           f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="9" fill="{INDIGO}"/></svg>\n')
    open(os.path.join(OUT, 'icon.svg'), 'w').write(svg)

def font(size, bold=False):
    for path, idx in (('/System/Library/Fonts/Avenir Next.ttc', 8 if bold else 7), ('/System/Library/Fonts/HelveticaNeue.ttc', 1 if bold else 0)):
        try:
            return ImageFont.truetype(path, size, index=idx)
        except Exception:
            pass
    return ImageFont.load_default()

def card():
    W, H = 1200, 630
    s = SS
    im = Image.new('RGB', (W * s, H * s), CREAM)
    d = ImageDraw.Draw(im)
    # bar chart on the right
    heights = [3, 5, 2, 6, 4, 8, 5, 3, 7, 9, 6, 4, 7, 5]
    x0, base, bw, gap, unit = 646, 520, 26, 8, 36
    d.rounded_rectangle([612 * s, 90 * s, 1140 * s, 560 * s], radius=28 * s, fill='#fffdf8', outline='#cfc8b8', width=2 * s)
    for i, h in enumerate(heights):
        x = (x0 + i * (bw + gap)) * s
        top = (base - h * unit * 0.78) * s
        d.rounded_rectangle([x, top, x + bw * s, base * s], radius=8 * s, fill=BLUE if h < 8 else BLUE_D)
    d.line([(620 * s, base * s), (1110 * s, base * s)], fill='#cfc8b8', width=2 * s)
    # worm above the bars
    pts = [(x * s, y * s) for x, y in worm_points(876, 160, 400, 24, waves=2.5)]
    draw_worm(d, pts, 22 * s, INDIGO, (pts[-1][0] - 2 * s, pts[-1][1] - 4 * s, 7 * s, CREAM))
    im = im.resize((W, H), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    d.text((70, 170), 'Earworm', font=font(104, True), fill=INDIGO)
    d.text((70, 280), 'Log', font=font(104, True), fill=INDIGO)
    d.text((72, 430), 'The song stuck in your head,', font=font(36), fill='#4d4a43')
    d.text((72, 478), 'written down and charted.', font=font(36), fill='#4d4a43')
    d.text((72, 548), 'English and Thai', font=font(28), fill='#625e55')
    im.save(os.path.join(OUT, 'card.jpg'), quality=90, optimize=True)

if __name__ == '__main__':
    write_svg()
    icon(192).save(os.path.join(OUT, 'icon-192.png'))
    icon(512).save(os.path.join(OUT, 'icon-512.png'))
    icon(512, rounded=False).save(os.path.join(OUT, 'icon-maskable-512.png'))
    bg = Image.new('RGB', (180, 180), INDIGO)
    ic = icon(180, rounded=False).convert('RGB'); ic.save(os.path.join(OUT, 'apple-touch-icon.png'))
    card()
    print('ok')
