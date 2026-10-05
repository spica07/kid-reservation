"""PWA 아이콘: 둥근 달력 + 종 모양. 실행: py tools/make_icons.py"""
import pathlib
from PIL import Image, ImageDraw

OUT = pathlib.Path(__file__).resolve().parents[1] / 'assets' / 'icons'
OUT.mkdir(parents=True, exist_ok=True)

def draw(size):
    s = size / 512
    im = Image.new('RGBA', (size, size), (255, 229, 241, 255))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([96*s, 120*s, 416*s, 420*s], radius=48*s, fill=(255, 255, 255, 255), outline=(107, 91, 149, 255), width=int(18*s))
    d.rectangle([96*s, 120*s, 416*s, 200*s], fill=(255, 138, 91, 255))
    for x in (176, 336):
        d.rounded_rectangle([(x-14)*s, 84*s, (x+14)*s, 156*s], radius=14*s, fill=(107, 91, 149, 255))
    d.ellipse([206*s, 236*s, 306*s, 336*s], fill=(255, 138, 91, 255))
    d.polygon([(236*s, 286*s), (256*s, 250*s), (276*s, 286*s), (256*s, 322*s)], fill=(255, 255, 255, 255))
    return im

for name, size in [('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180), ('favicon-64.png', 64)]:
    draw(size).save(OUT / name)
print('아이콘 4개 생성:', OUT)
