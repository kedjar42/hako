"""Entrance redesign, step 1: re-surface the real photo while keeping its light and shadow.
- walls (house, parapet, upper floor, boundary wall): smooth warm-white render
- slab edge: anthracite fascia
- column: vertical oak slats
- courtyard + porch: large-format stone-look porcelain tiles (60x120) in perspective
Usage: python3 surfaces.py before.jpg out.png
"""
import sys
import numpy as np
import cv2

src, out = sys.argv[1], sys.argv[2]
img = cv2.imread(src).astype(np.float32) / 255.0  # BGR
H, W = img.shape[:2]
B, G, R = img[..., 0], img[..., 1], img[..., 2]
L = 0.299 * R + 0.587 * G + 0.114 * B
rng = np.random.default_rng(3)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def poly(pts):
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 255)
    return m.astype(np.float32) / 255.0


def soft(m, k=3):
    return cv2.GaussianBlur(m, (0, 0), k)


def hexbgr(h):
    h = h.lstrip('#')
    return np.array([int(h[4:6], 16), int(h[2:4], 16), int(h[0:2], 16)], np.float32) / 255.0


# ---------------- protected things (keep real) ----------------
person = poly([(50, 400), (130, 395), (235, 420), (240, 520), (225, 640), (215, 770), (170, 815), (110, 810), (60, 720), (40, 560)])
car = poly([(205, 600), (215, 520), (250, 440), (300, 428), (490, 428), (520, 455), (548, 480), (550, 640), (525, 665), (470, 695), (240, 705), (205, 680)])
stool = poly([(1232, 490), (1305, 485), (1308, 612), (1232, 612)])
sat = img.max(axis=2) - img.min(axis=2)
greenery = ((G > R + 0.035) & (G > B + 0.01)).astype(np.float32)          # leaves
loose = ((G > R * 1.01) & (G > B * 0.95) & (sat > 0.05)).astype(np.float32)
rose_zone = poly([(1305, 240), (1760, 240), (1760, 620), (1305, 620)])
greenery = np.clip(greenery + loose * rose_zone + (L < 0.2) * rose_zone, 0, 1)
greenery = cv2.morphologyEx(greenery, cv2.MORPH_OPEN, np.ones((3, 3)))
flowers = ((R > 0.5) & (B > G + 0.06) & (R > G + 0.22)).astype(np.float32)  # rose / bougainvillea
plants = np.clip(cv2.dilate(greenery + flowers, np.ones((3, 3))), 0, 1)
dark = (L < 0.16).astype(np.float32)  # stems / tree trunks
keep = np.clip(person + car + stool, 0, 1)
keep = soft(cv2.dilate(keep, np.ones((5, 5))), 1.5)

result = img.copy()


def blend(layer, mask):
    global result
    m = mask[..., None]
    result = result * (1 - m) + layer * m


# ---------------- 1. render on walls ----------------
house_wall = poly([(553, 285), (1012, 290), (1012, 560), (1000, 562), (590, 585), (553, 580)])
right_wall = poly([(1300, 255), (1755, 250), (1745, 610), (1305, 615)])
porch_left = poly([(1012, 262), (1030, 262), (1030, 560), (1012, 560)])
parapet = poly([(308, 168), (930, 172), (960, 160), (1370, 160), (1372, 205), (308, 205)])
upper = poly([(1175, 60), (1215, 30), (1300, 10), (1350, 0), (1560, 0), (1700, 80), (1745, 110), (1748, 210), (1185, 205)])
boundary = poly([(0, 25), (130, 92), (300, 170), (440, 262), (556, 292), (556, 600), (210, 610), (200, 450), (0, 520)])
window_hole = poly([(795, 330), (965, 330), (965, 468), (795, 468)])
upper_opening = poly([(1262, 25), (1345, 20), (1350, 135), (1262, 140)])

brickish = ((R - G > 0.10) & (R > 0.35) & (B < G + 0.05)).astype(np.float32)
greyish = ((np.abs(R - G) < 0.10) & (np.abs(G - B) < 0.12)).astype(np.float32)
sky = ((B > R + 0.08) & (B > 0.55)).astype(np.float32)

wall_mask = np.clip(house_wall + right_wall + porch_left, 0, 1) * (1 - window_hole)
wall_mask = np.clip(wall_mask + parapet * (1 - sky), 0, 1)
wall_mask = np.clip(wall_mask + upper * (1 - upper_opening) * (1 - sky), 0, 1)
wall_mask = np.clip(wall_mask + boundary * (1 - sky) * (1 - dark), 0, 1)
wall_mask = wall_mask * (1 - plants) * (1 - keep)
wall_mask = cv2.morphologyEx(wall_mask, cv2.MORPH_CLOSE, np.ones((5, 5)))
wall_mask = soft(wall_mask, 1.0)

# light: large-scale luminance (brick joints and stains washed out), plus a little real plaster grain
Ls = cv2.GaussianBlur(L, (0, 0), 9)
light = Ls / np.percentile(Ls[wall_mask > 0.5], 80)
light = np.clip(0.3 + 0.7 * light, 0.35, 1.15)  # keep sun/shade, soften stains
real_grain = np.clip(L / (cv2.GaussianBlur(L, (0, 0), 3) + 1e-3), 0.8, 1.2)
plaster_zone = soft(np.clip(house_wall + right_wall, 0, 1), 2)
grain = 1 + 0.012 * cv2.GaussianBlur(rng.standard_normal((H, W)).astype(np.float32), (0, 0), 0.7) / 0.3
grain = grain * (1 + (real_grain - 1) * 0.45 * plaster_zone)
render = hexbgr('#ebe5da')[None, None, :] * (light * grain)[..., None]
blend(render, wall_mask)

# ---------------- 2. anthracite slab fascia + window frame ----------------
fascia = np.clip(poly([(318, 203), (935, 213), (960, 196), (1760, 205), (1848, 212), (1848, 236), (1760, 230), (960, 222), (935, 240), (318, 228)]), 0, 1)
fascia = fascia * (1 - plants)
anth = hexbgr('#2e3133')[None, None, :] * np.clip(0.75 + 0.35 * light, 0.6, 1.2)[..., None]
blend(anth, soft(fascia, 0.8))
frame = poly([(785, 322), (975, 322), (975, 478), (785, 478)]) - poly([(800, 337), (960, 337), (960, 463), (800, 463)])
blend(anth, soft(np.clip(frame, 0, 1), 0.7))
sill = poly([(775, 470), (985, 470), (988, 486), (772, 486)])
blend(hexbgr('#d9d2c4')[None, None, :] * np.ones((H, W, 1), np.float32), soft(sill, 0.7))

# ---------------- 3. oak slats on the column ----------------
col = poly([(1106, 262), (1166, 262), (1166, 640), (1104, 642)])
u = (xx - 1104) / 62.0
slat = 0.5 + 0.5 * np.cos(u * 2 * np.pi * 7)  # 7 slats
gap = np.clip((slat - 0.88) * 12, 0, 1)
woodgrain = cv2.GaussianBlur(rng.standard_normal((H, W)).astype(np.float32), (0, 0), sigmaX=0.6, sigmaY=12)
oak = hexbgr('#a7774c')[None, None, :] * (1 + 0.12 * woodgrain[..., None])
oak = oak * (1 - 0.65 * gap[..., None]) * np.clip(0.6 + 0.55 * light, 0.5, 1.25)[..., None]
blend(oak, soft(col, 0.8))

# ---------------- 4. porcelain tiles in perspective ----------------
HOR, CX, F, CAMH = 300.0, 1000.0, 1000.0, 1.6


def tiles(cam_h, tile_w=1.2, tile_d=0.6):
    dy = np.maximum(yy - HOR, 1)
    Z = F * cam_h / dy
    X = (xx - CX) * Z / F
    pxw = Z / F  # metres per pixel
    a, b = X / tile_w, (Z - 0.13) / tile_d
    row = np.floor(b)
    a = a + 0.5 * (row % 2)  # running bond
    col_i = np.floor(a)
    fa, fb = a - col_i, b - row
    ga = np.minimum(fa, 1 - fa) * tile_w / pxw
    gb = np.minimum(fb, 1 - fb) * tile_d / (pxw * F * cam_h / (Z * Z) * Z / F + 1e-6) * 0 + np.minimum(fb, 1 - fb) * tile_d / (Z * Z / (F * cam_h))
    grout = np.clip(1.8 - np.minimum(ga, gb), 0, 1) * 0.85
    tid = (col_i * 7919 + row * 104729) % 997
    var = (np.sin(tid * 12.9898) * 43758.5453) % 1
    stone = cv2.GaussianBlur(rng.standard_normal((H, W)).astype(np.float32), (0, 0), 2.2)
    veins = cv2.GaussianBlur(rng.standard_normal((H, W)).astype(np.float32), (0, 0), 7)
    base = hexbgr('#bdb6aa')[None, None, :] * (0.93 + 0.1 * var[..., None]) * (1 + 0.03 * stone[..., None] + 0.07 * veins[..., None])
    groutc = hexbgr('#9b958c')[None, None, :]
    return base * (1 - grout[..., None]) + groutc * grout[..., None], Z


ground = poly([(200, 610), (556, 590), (1000, 562), (1040, 575), (1104, 640), (1160, 645), (1310, 632), (1400, 612), (1760, 605), (2000, 620), (2000, 934), (200, 934)])
ground = np.clip(ground + poly([(0, 760), (200, 700), (200, 934), (0, 934)]), 0, 1)
ground = ground * (1 - keep)
tile, Z = tiles(CAMH)
# light on the floor: only big shadows (car, house) survive, wet stains mostly go
Lg = cv2.GaussianBlur(L, (0, 0), 28)
gl = Lg / np.percentile(Lg[ground > 0.5], 75)
gl = np.clip(0.45 + 0.55 * gl, 0.4, 1.15)
# contact shadow under the car and along the house base
cs = soft(cv2.dilate(car, np.ones((25, 25))), 18) * (1 - car)
gl = gl * (1 - 0.35 * cs)
base_line = soft(poly([(556, 585), (1000, 560), (1000, 575), (556, 600)]), 8)
gl = gl * (1 - 0.25 * base_line)
# faint reflection of the facade in the honed porcelain
refl = np.zeros_like(img)
for x0, x1, yb in [(553, 1012, 575), (1300, 1755, 612)]:
    band = result[yb - 260:yb, x0:x1][::-1]
    hgt = min(260, H - yb)
    refl[yb:yb + hgt, x0:x1] = cv2.GaussianBlur(band[:hgt], (0, 0), 6)
rmask = (refl.sum(axis=2) > 0).astype(np.float32) * np.clip(1 - (yy - 560) / 260, 0, 1) * 0.10
ao = 1 - 0.28 * soft(poly([(553, 575), (1000, 555), (1105, 640), (1310, 625), (1750, 605), (1750, 625), (1310, 650), (1105, 665), (1000, 585), (553, 605)]), 18)
fine = np.clip(L / (cv2.GaussianBlur(L, (0, 0), 2) + 1e-3), 0.85, 1.15)
floor = tile * (gl * ao)[..., None]
floor = floor * (1 - rmask[..., None]) + refl * rmask[..., None]
blend(floor, soft(ground, 1.0))
# dark plinth at the foot of the walls
plinth = poly([(553, 566), (1000, 548), (1004, 562), (553, 582)]) + poly([(1305, 598), (1745, 594), (1745, 610), (1305, 614)])
blend(anth, soft(np.clip(plinth, 0, 1), 0.7))

# porch floor (one step higher) + step nosing
porch = poly([(1030, 545), (1106, 552), (1106, 630), (1060, 575), (1030, 565)]) + poly([(1166, 568), (1302, 560), (1310, 622), (1166, 632)])
porch = np.clip(porch, 0, 1) * (1 - keep)
ptile, _ = tiles(CAMH - 0.16)
Lp = cv2.GaussianBlur(L, (0, 0), 14)
pl = np.clip(0.55 + 0.45 * Lp / np.percentile(Lp[porch > 0.5], 80), 0.45, 1.25)
blend(ptile * pl[..., None], soft(porch, 0.8))
step = poly([(1106, 630), (1310, 620), (1312, 634), (1104, 646)])
blend(hexbgr('#bdb5a8')[None, None, :] * np.ones((H, W, 1), np.float32) * 0.85, soft(step, 0.6))

# anthracite coping on the boundary wall
cv2.polylines(result, [np.array([(0, 28), (130, 95), (300, 172), (440, 264), (556, 294)], np.int32)], False, tuple(float(v) for v in hexbgr('#2e3133')), 9, cv2.LINE_AA)
# re-add the real person and car on top, untouched
blend(img, keep)
cv2.imwrite(out, np.clip(result * 255, 0, 255).astype(np.uint8))
