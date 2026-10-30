# -*- coding: utf-8 -*-
"""《三生万物》图标：三个字体版本 + 对比图。宣纸质底、直角、无水印，输出 600x600 PNG。"""
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SS = 1600
FINAL = 600
FONTS = [
    ("楷体", "C:/Windows/Fonts/STKAITI.TTF"),
    ("行楷", "C:/Windows/Fonts/STXINGKA.TTF"),
    ("隶书", "C:/Windows/Fonts/STLITI.TTF"),
]


def make_paper(seed):
    random.seed(seed)
    paper = Image.new("RGB", (SS, SS), (238, 230, 211))
    px = paper.load()

    small = Image.effect_noise((48, 48), 30).convert("L").resize((SS, SS), Image.BICUBIC)
    sm = small.load()
    for y in range(SS):
        for x in range(SS):
            n = (sm[x, y] - 128) * 0.055
            r, g, b = px[x, y]
            px[x, y] = (int(r + n), int(g + n * 0.94), int(b + n * 0.85))

    for _ in range(SS * SS // 22):
        x = random.randrange(SS); y = random.randrange(SS)
        d = random.randint(-4, 4)
        r, g, b = px[x, y]
        px[x, y] = (max(0, min(255, r + d)), max(0, min(255, g + d)), max(0, min(255, b + d)))

    fib = ImageDraw.Draw(paper, "RGBA")
    for _ in range(220):
        x = random.randrange(SS); y = random.randrange(SS)
        ln = random.randint(8, 52)
        x2 = x + ln * random.choice([1, -1]) * 0.92
        y2 = y + ln * random.uniform(-0.45, 0.45)
        fib.line([(x, y), (x2, y2)],
                 fill=(155 + random.randint(-15, 15), 142, 116, random.randint(6, 16)), width=1)

    vig = Image.new("L", (SS, SS), 0)
    ImageDraw.Draw(vig).ellipse([-SS * 0.2, -SS * 0.2, SS * 1.2, SS * 1.2], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(SS // 7))
    return Image.composite(paper, Image.new("RGB", (SS, SS), (222, 209, 184)), vig)


def draw_glyph(paper, font_path, width_ratio=0.66):
    ink = Image.new("L", (SS, SS), 0)
    d = ImageDraw.Draw(ink)
    target = int(SS * width_ratio)
    size = 100
    while size < 1500:
        f = ImageFont.truetype(font_path, size)
        bb = d.textbbox((0, 0), "三", font=f)
        if (bb[2] - bb[0]) >= target:
            break
        size += 4
    f = ImageFont.truetype(font_path, size)
    bb = d.textbbox((0, 0), "三", font=f)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((SS - w) / 2 - bb[0], (SS - h) / 2 - bb[1] - SS * 0.012), "三", font=f, fill=255)

    ink = ink.filter(ImageFilter.GaussianBlur(SS // 600))
    noise = Image.effect_noise((SS, SS), 22).convert("L")
    ink = Image.composite(ink, Image.new("L", (SS, SS), 0), noise.point(lambda v: 255 if v > 88 else 0))
    ink = ink.filter(ImageFilter.GaussianBlur(SS // 1000))
    paper.paste(Image.new("RGB", (SS, SS), (26, 22, 18)), (0, 0), ink)
    return paper


outs = []
for i, (name, path) in enumerate(FONTS):
    img = draw_glyph(make_paper(30 + i), path)
    fn = f"icon_{i+1}_{name}.png"
    img.resize((FINAL, FINAL), Image.LANCZOS).save(fn, "PNG")
    outs.append((name, fn))

# 对比图
sheet = Image.new("RGB", (FINAL * 3 + 40, FINAL + 60), (250, 248, 243))
dd = ImageDraw.Draw(sheet)
try:
    lf = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 30)
except Exception:
    lf = None
for i, (name, fn) in enumerate(outs):
    sheet.paste(Image.open(fn), (i * (FINAL + 20), 40))
    dd.text((i * (FINAL + 20) + 12, 6), name, fill=(60, 55, 48), font=lf)
sheet.save("icon_compare.png", "PNG")
print([f for _, f in outs], "icon_compare.png")
