"""after = surfaces + front layer (softened slightly so it sits in the photo) + light grain"""
import sys
import numpy as np
from PIL import Image, ImageFilter
surf, front, out = sys.argv[1:4]
base = Image.open(surf).convert('RGBA')
f = Image.open(front).convert('RGBA').filter(ImageFilter.GaussianBlur(0.6))
img = np.asarray(Image.alpha_composite(base, f).convert('RGB')).astype(np.float32)
img += np.random.default_rng(1).normal(0, 2.2, img.shape)  # camera grain to unify drawn and real parts
Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(out, quality=88)
