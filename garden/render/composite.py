"""Composite: photo + back layer, then put the real rose bush back, then front layer -> after.jpg"""
import sys
from PIL import Image, ImageFilter
import numpy as np

before, layers, out = sys.argv[1], sys.argv[2], sys.argv[3]
photo = Image.open(before).convert("RGBA")
back = Image.open(f"{layers}/back.png").convert("RGBA")
front = Image.open(f"{layers}/front.png").convert("RGBA")

img = Image.alpha_composite(photo, back)

# Keep the existing rose: foliage (green-dominant) and the pink flower, above the wall base.
a = np.asarray(photo).astype(int)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
h, w = r.shape
yy, xx = np.mgrid[0:h, 0:w]
region = (xx > 885) & (xx < 1275) & (yy < 300 + (xx - 880) * 0.24 - 6)
foliage = (g > r + 4) & (g >= b - 10)
pink = (r > 190) & (b > 140) & (g < r - 40)
mask = ((foliage | pink) & region).astype(np.uint8) * 255
m = Image.fromarray(mask).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.2))

img = Image.alpha_composite(img, front)
img.convert("RGB").save(out, quality=84)
