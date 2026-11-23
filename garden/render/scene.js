// Draws the redesigned garden as two transparent layers over the original photo (2000x934).
// "back": wall render, shed, mulch, gravel. "front": curb, plants, pots, stepping stones.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const W = 2000, H = 934;

function P(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]); ctx.closePath(); }
function lerp(a, b, t) { return a + (b - a) * t; }
// piecewise linear y on a polyline at x
function yAt(line, x) {
  for (let i = 0; i < line.length - 1; i++) {
    const [x0, y0] = line[i], [x1, y1] = line[i + 1];
    if (x >= x0 && x <= x1) return lerp(y0, y1, (x - x0) / (x1 - x0));
  }
  return x < line[0][0] ? line[0][1] : line[line.length - 1][1];
}
function speckle(ctx, rng, pts, n, colors, rMin, rMax, alpha = 1) {
  ctx.save(); P(ctx, pts); ctx.clip();
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, x1, rng()), y = lerp(y0, y1, rng());
    const persp = 0.55 + 0.75 * ((y - 300) / 634); // nearer = bigger
    ctx.fillStyle = colors[(rng() * colors.length) | 0];
    ctx.beginPath(); ctx.ellipse(x, y, lerp(rMin, rMax, rng()) * persp, lerp(rMin, rMax, rng()) * persp * 0.7, rng() * 3, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// ---------- geometry from the photo ----------
const wallBase = [[880, 298], [1100, 350], [1400, 410], [1750, 468], [2000, 494]];
const curbTop = [[838, 366], [1000, 428], [1250, 530], [1450, 585], [1650, 635], [1900, 694], [2000, 716]];
const curbH = x => lerp(34, 92, (x - 838) / 1162);
const curbBot = curbTop.map(([x, y]) => [x, y + curbH(x) + 14]);

function drawBack(ctx) {
  const rng = makeRng(7);
  // --- main wall: smooth lime render, warm sand tone
  const wall = [[790, 0], [2000, 0], ...wallBase.slice().reverse(), [880, 298], [860, 200], [820, 60]];
  const wallFix = [[790, 0], [2000, 0], [2000, 494], [1750, 468], [1400, 410], [1100, 350], [880, 298], [858, 200], [818, 60]];
  let g = ctx.createLinearGradient(800, 0, 2000, 500);
  g.addColorStop(0, '#efe3cd'); g.addColorStop(0.6, '#e8d8bd'); g.addColorStop(1, '#ddc9a8');
  ctx.fillStyle = g; P(ctx, wallFix); ctx.fill();
  speckle(ctx, rng, wallFix, 26000, ['#f6ecda', '#d9c6a6', '#e2d1b4', '#cdb894'], 0.6, 2.2, 0.55);
  // shade near the ground
  ctx.save(); P(ctx, wallFix); ctx.clip();
  g = ctx.createLinearGradient(0, 260, 0, 500); g.addColorStop(0, 'rgba(90,60,30,0)'); g.addColorStop(1, 'rgba(90,60,30,0.28)');
  ctx.fillStyle = g; ctx.fillRect(800, 0, 1200, 500);
  // terracotta coping band near the top, following the wall's perspective
  ctx.fillStyle = '#b8643c';
  P(ctx, [[800, 0], [2000, 0], [2000, 26], [800, -40]]); ctx.fill();
  ctx.fillStyle = 'rgba(70,35,15,.35)'; P(ctx, [[800, -40], [2000, 26], [2000, 34], [800, -34]]); ctx.fill();
  // wall lanterns
  for (const [x, y, s] of [[1330, 210, 1], [1830, 255, 1.25]]) {
    ctx.fillStyle = 'rgba(60,40,20,.25)'; ctx.fillRect(x - 10 * s, y + 6 * s, 26 * s, 50 * s);
    ctx.fillStyle = '#2f2a26'; ctx.fillRect(x - 13 * s, y, 26 * s, 6 * s); ctx.fillRect(x - 11 * s, y + 6 * s, 22 * s, 36 * s);
    ctx.fillStyle = '#ffd98a'; ctx.fillRect(x - 8 * s, y + 9 * s, 16 * s, 28 * s);
    ctx.fillStyle = '#2f2a26'; ctx.fillRect(x - 13 * s, y + 42 * s, 26 * s, 5 * s);
  }
  ctx.restore();

  // --- small brick shed -> same render; metal door -> sage green
  const shed = [[365, 246], [655, 108], [700, 120], [770, 340], [760, 372], [560, 505], [528, 492], [480, 420]];
  ctx.fillStyle = '#e6d4b6'; P(ctx, shed); ctx.fill();
  speckle(ctx, rng, shed, 6000, ['#f3e7d3', '#d6c19f', '#dcc9aa'], 0.6, 2, 0.6);
  ctx.save(); P(ctx, shed); ctx.clip();
  g = ctx.createLinearGradient(380, 0, 770, 0); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(80,55,30,.18)');
  ctx.fillStyle = g; ctx.fillRect(360, 100, 420, 420); ctx.restore();
  // roof edge
  ctx.fillStyle = '#7d8a7a'; P(ctx, [[360, 238], [800, 34], [806, 46], [366, 254]]); ctx.fill();
  // door
  const door = [[655, 108], [800, 42], [905, 296], [845, 336], [768, 346]];
  ctx.fillStyle = '#7f9a83'; P(ctx, door); ctx.fill();
  ctx.save(); P(ctx, door); ctx.clip();
  ctx.strokeStyle = 'rgba(40,60,45,.35)'; ctx.lineWidth = 3;
  for (let i = 0; i < 9; i++) { const t = i / 8; ctx.beginPath(); ctx.moveTo(lerp(668, 812, t), lerp(102, 40, t)); ctx.lineTo(lerp(775, 900, t), lerp(345, 300, t)); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,.12)'; P(ctx, [[655, 108], [720, 80], [800, 330], [768, 346]]); ctx.fill();
  ctx.restore();

  // --- planting bed: dark bark mulch
  const bed = [[838, 330], ...wallBase, [2000, 716], ...curbTop.slice().reverse()];
  ctx.fillStyle = '#4b3424'; P(ctx, bed); ctx.fill();
  speckle(ctx, rng, bed, 22000, ['#6b4a31', '#3a271a', '#7a5638', '#2d1f15', '#5a3d27'], 1, 4, 0.9);

  // --- gravel courtyard: warm limestone gravel
  const ground = [[0, 934], [0, 790], [120, 760], [330, 640], [470, 560], [560, 505], [760, 372], [770, 346], [845, 334], [838, 366], ...curbBot, [2000, 934]];
  g = ctx.createLinearGradient(0, 400, 0, 934); g.addColorStop(0, '#cdbb9c'); g.addColorStop(1, '#d9c9ab');
  ctx.fillStyle = g; P(ctx, ground); ctx.fill();
  speckle(ctx, rng, ground, 90000, ['#e9dcc3', '#b9a582', '#c9b391', '#a89272', '#f1e6d1', '#8f7c60'], 0.8, 3.2, 0.95);
  // soft light falloff
  ctx.save(); P(ctx, ground); ctx.clip();
  g = ctx.createRadialGradient(500, 500, 50, 900, 800, 1200); g.addColorStop(0, 'rgba(255,240,210,.18)'); g.addColorStop(1, 'rgba(60,40,20,.12)');
  ctx.fillStyle = g; ctx.fillRect(0, 380, 2000, 560); ctx.restore();
}

// ---------- plants ----------
function leaves(ctx, rng, cx, cy, rx, ry, n, cols, len, wid) {
  for (let i = 0; i < n; i++) {
    const a = rng() * 6.283, r = Math.sqrt(rng());
    const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
    const shade = (y - (cy - ry)) / (2 * ry); // darker toward bottom
    ctx.fillStyle = cols[Math.min(cols.length - 1, Math.floor(shade * cols.length * (0.7 + rng() * 0.6)))];
    ctx.save(); ctx.translate(x, y); ctx.rotate(rng() * 6.283);
    ctx.beginPath(); ctx.ellipse(0, 0, len * (0.7 + rng() * 0.6), wid, 0, 0, 7); ctx.fill(); ctx.restore();
  }
}
function shadow(ctx, x, y, rx, ry, a = .35) {
  const g = ctx.createRadialGradient(x, y, 1, x, y, rx);
  g.addColorStop(0, `rgba(30,20,10,${a})`); g.addColorStop(1, 'rgba(30,20,10,0)');
  ctx.save(); ctx.scale(1, ry / rx); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y * rx / ry, rx, 0, 7); ctx.fill(); ctx.restore();
}
function lavender(ctx, rng, x, y, s) {
  shadow(ctx, x + 8 * s, y + 4 * s, 70 * s, 18 * s);
  leaves(ctx, rng, x, y - 18 * s, 62 * s, 26 * s, 260, ['#b5c2a4', '#93a586', '#72866a', '#5a6c55'], 9 * s, 2 * s);
  for (let i = 0; i < 70; i++) {
    const bx = x + (rng() - .5) * 110 * s, by = y - 22 * s + (rng() - .5) * 18 * s;
    const ang = (bx - x) / (60 * s) * 0.5 + (rng() - .5) * .3, L = (40 + rng() * 34) * s;
    const tx = bx + Math.sin(ang) * L, ty = by - Math.cos(ang) * L;
    ctx.strokeStyle = '#8c9b78'; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    for (let k = 0; k < 7; k++) {
      const t = 1 - k * 0.06; ctx.fillStyle = ['#7a5fb0', '#9479c9', '#6a4e9c', '#a58ad6'][(rng() * 4) | 0];
      ctx.beginPath(); ctx.ellipse(lerp(bx, tx, t), lerp(by, ty, t), 2.6 * s, 4 * s, ang, 0, 7); ctx.fill();
    }
  }
}
function grassFan(ctx, rng, x, y, s, cols, n = 60, h = 110) {
  shadow(ctx, x + 6 * s, y + 3 * s, 55 * s, 14 * s);
  for (let i = 0; i < n; i++) {
    const ang = (rng() - .5) * 1.9, L = (h * .5 + rng() * h * .6) * s;
    const bend = ang * 0.6;
    ctx.strokeStyle = cols[(rng() * cols.length) | 0]; ctx.lineWidth = (2 + rng() * 2.5) * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + (rng() - .5) * 16 * s, y);
    ctx.quadraticCurveTo(x + Math.sin(ang) * L * .5, y - Math.cos(ang) * L * .7, x + Math.sin(ang + bend) * L, y - Math.cos(ang + bend) * L * .85);
    ctx.stroke();
  }
}
function agapanthus(ctx, rng, x, y, s) {
  grassFan(ctx, rng, x, y, s, ['#3f6b3a', '#4d7d44', '#2f5530', '#5d8c4f'], 45, 80);
  for (let j = 0; j < 3; j++) {
    const hx = x + (j - 1) * 26 * s + (rng() - .5) * 10 * s, hy = y - (120 + rng() * 40) * s;
    ctx.strokeStyle = '#4d7d44'; ctx.lineWidth = 2.4 * s; ctx.beginPath(); ctx.moveTo(x + (j - 1) * 8 * s, y - 10 * s); ctx.lineTo(hx, hy); ctx.stroke();
    for (let k = 0; k < 34; k++) {
      const a = rng() * 6.283, r = rng() * 19 * s;
      ctx.fillStyle = ['#5f79d4', '#7d93e3', '#4a62bf', '#a3b4f0'][(rng() * 4) | 0];
      ctx.beginPath(); ctx.ellipse(hx + Math.cos(a) * r, hy + Math.sin(a) * r * .85, 3.4 * s, 2 * s, a, 0, 7); ctx.fill();
    }
  }
}
function boxBall(ctx, rng, x, y, s) {
  shadow(ctx, x + 10 * s, y + 2 * s, 46 * s, 12 * s, .45);
  leaves(ctx, rng, x, y - 30 * s, 38 * s, 32 * s, 520, ['#7da35a', '#5f8a43', '#476f33', '#335526'], 4 * s, 2.4 * s);
}
function olive(ctx, rng, x, y, s, potted) {
  // trunk
  ctx.strokeStyle = '#6b5a48'; ctx.lineCap = 'round';
  ctx.lineWidth = 14 * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x - 10 * s, y - 80 * s, x + 18 * s, y - 140 * s, x + 4 * s, y - 210 * s); ctx.stroke();
  ctx.lineWidth = 7 * s; ctx.beginPath(); ctx.moveTo(x + 2 * s, y - 150 * s); ctx.quadraticCurveTo(x - 40 * s, y - 200 * s, x - 70 * s, y - 250 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 6 * s, y - 170 * s); ctx.quadraticCurveTo(x + 50 * s, y - 210 * s, x + 75 * s, y - 260 * s); ctx.stroke();
  const cols = ['#c3cdb0', '#a7b493', '#8e9d7b', '#6f7f60', '#56664b'];
  for (const [dx, dy, rx, ry] of [[-70, -275, 70, 50], [75, -285, 75, 52], [0, -320, 90, 60], [-20, -230, 60, 34], [40, -235, 60, 36]])
    leaves(ctx, rng, x + dx * s, y + dy * s, rx * s, ry * s, 700, cols, 8 * s, 2.3 * s);
}
function pot(ctx, x, y, w, h, color = '#b9673f') {
  shadow(ctx, x + w * .25, y + 4, w * .9, w * .22, .4);
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, '#d6855a'); g.addColorStop(.45, color); g.addColorStop(1, '#7c3f24');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x - w / 2, y - h); ctx.lineTo(x + w / 2, y - h); ctx.lineTo(x + w * .38, y); ctx.ellipse(x, y, w * .38, w * .09, 0, 0, Math.PI); ctx.closePath(); ctx.fill();
  // rim
  ctx.fillStyle = '#c4714a'; ctx.beginPath(); ctx.ellipse(x, y - h, w * .54, w * .13, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#3b2a1e'; ctx.beginPath(); ctx.ellipse(x, y - h, w * .45, w * .09, 0, 0, 7); ctx.fill();
}
function stone(ctx, rng, cx, cy, rx, ry) {
  shadow(ctx, cx + rx * .15, cy + ry * .5, rx * 1.1, ry * .9, .35);
  const pts = []; const ph = rng() * 6.283, k2 = .08 + rng() * .06, k3 = .04 + rng() * .05;
  for (let i = 0; i < 48; i++) { const a = i / 48 * 6.283; const r = 1 + k2 * Math.cos(2 * a + ph) + k3 * Math.sin(3 * a + ph * 2) + (rng() - .5) * .025; pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]); }
  // thickness
  ctx.fillStyle = '#9d907d'; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y + ry * .22) : ctx.moveTo(x, y + ry * .22)); ctx.closePath(); ctx.fill();
  const g = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry); g.addColorStop(0, '#ece3d2'); g.addColorStop(1, '#c9bca5');
  ctx.fillStyle = g; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill();
  speckle(ctx, rng, pts, Math.round(rx * ry / 40), ['#d8ccb6', '#f4ecdf', '#b9ab93'], 0.5, 1.6, .6);
}
function solarLight(ctx, x, y, s) {
  ctx.fillStyle = '#2f2a26'; ctx.fillRect(x - 1.5 * s, y - 34 * s, 3 * s, 34 * s);
  ctx.fillStyle = '#2f2a26'; ctx.fillRect(x - 7 * s, y - 48 * s, 14 * s, 4 * s);
  ctx.fillStyle = '#ffe3a3'; ctx.fillRect(x - 5.5 * s, y - 44 * s, 11 * s, 10 * s);
}

function drawFront(ctx) {
  const rng = makeRng(42);
  // climbing rose on wire supports where the old rose stands
  ctx.strokeStyle = 'rgba(70,60,50,.5)'; ctx.lineWidth = 2;
  for (const y0 of [120, 200, 280]) { ctx.beginPath(); ctx.moveTo(930, y0 - 40); ctx.lineTo(1280, y0 + 20); ctx.stroke(); }
  ctx.strokeStyle = '#5c6b3c'; ctx.lineWidth = 4;
  for (const [x1, y1] of [[980, 150], [1080, 90], [1220, 60], [1250, 200]]) { ctx.beginPath(); ctx.moveTo(1120, 360); ctx.quadraticCurveTo((1120 + x1) / 2 + 30, (360 + y1) / 2, x1, y1); ctx.stroke(); }
  for (const [x, y, rx, ry] of [[1110, 300, 80, 60], [1020, 200, 70, 55], [1090, 140, 70, 55], [1200, 110, 60, 50], [1220, 230, 55, 55], [1150, 220, 60, 50]])
    leaves(ctx, rng, x, y, rx, ry, 300, ['#3f6e35', '#335d2b', '#2a4f24', '#4d7d40'], 8, 4.5);
  for (let i = 0; i < 38; i++) {
    const x = 960 + rng() * 300, y = 80 + rng() * 260; if (Math.hypot((x - 1120) / 170, (y - 210) / 150) > 1) continue;
    const r = 7 + rng() * 5; ctx.fillStyle = ['#e46f8f', '#f08fa8', '#d65277'][(rng() * 3) | 0];
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(150,30,60,.35)'; ctx.beginPath(); ctx.arc(x + 1, y + 1, r * .45, 0, 7); ctx.fill();
  }
  // olive tree in the bed, against the wall
  olive(ctx, rng, 1470, 500, 1.15);
  // jasmine on the wall at the right
  for (let i = 0; i < 9; i++) leaves(ctx, rng, 1760 + i * 30, 160 + (i % 3) * 90, 60, 55, 220, ['#4f7d3f', '#3c6a31', '#2f5527'], 7, 3);
  for (let i = 0; i < 160; i++) { ctx.fillStyle = '#fffaf0'; const x = 1700 + rng() * 300, y = 110 + rng() * 300; for (let p = 0; p < 5; p++) { ctx.beginPath(); ctx.ellipse(x + Math.cos(p * 1.256) * 3, y + Math.sin(p * 1.256) * 3, 3, 1.6, p * 1.256, 0, 7); ctx.fill(); } }
  // bougainvillea over the shed corner
  leaves(ctx, rng, 470, 300, 95, 70, 900, ['#c2338a', '#a8246f', '#d94d9e', '#5d7d3c', '#46662f'], 7, 4);
  leaves(ctx, rng, 400, 380, 60, 70, 500, ['#c2338a', '#d94d9e', '#5d7d3c', '#46662f', '#3b5628'], 7, 4);

  // planting, back row -> front row
  agapanthus(ctx, rng, 1010, 395, .75);
  lavender(ctx, rng, 1130, 460, .85);
  agapanthus(ctx, rng, 1300, 480, .95);
  lavender(ctx, rng, 1620, 590, 1.25);
  agapanthus(ctx, rng, 1790, 600, 1.15);
  grassFan(ctx, rng, 1940, 650, 1.3, ['#c9b98b', '#b3a274', '#d8cc9f', '#9e9065'], 70, 110);
  for (const [x, y, s] of [[935, 398, .6], [1210, 500, .8], [1400, 548, .95], [1530, 588, 1.05], [1880, 680, 1.25]]) boxBall(ctx, rng, x, y, s);

  // stone curb
  const top = curbTop;
  ctx.fillStyle = '#cbbd9f';
  ctx.beginPath(); top.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); curbBot.slice().reverse().forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath(); ctx.fill();
  // cap (top face)
  ctx.fillStyle = '#e6dcc7';
  ctx.beginPath(); top.forEach(([x, y], i) => i ? ctx.lineTo(x, y - 2) : ctx.moveTo(x, y - 2)); top.slice().reverse().forEach(([x, y]) => ctx.lineTo(x, y + 12 + curbH(x) * .1)); ctx.closePath(); ctx.fill();
  speckle(ctx, rng, [...top, ...curbBot.slice().reverse()], 9000, ['#ddd1b8', '#b5a688', '#efe6d4'], .5, 1.8, .6);
  // block joints
  ctx.strokeStyle = 'rgba(80,65,45,.45)'; ctx.lineWidth = 2;
  for (let x = 880; x < 2000; x += lerp(55, 120, (x - 838) / 1162)) {
    const y = yAt(top, x); ctx.beginPath(); ctx.moveTo(x, y + 12); ctx.lineTo(x + 2, yAt(curbBot, x)); ctx.stroke();
  }
  // shadow at the curb foot
  ctx.save(); ctx.globalAlpha = .35; ctx.strokeStyle = '#3a2c1d'; ctx.lineWidth = 10; ctx.filter = 'blur(6px)';
  ctx.beginPath(); curbBot.forEach(([x, y], i) => i ? ctx.lineTo(x, y + 4) : ctx.moveTo(x, y + 4)); ctx.stroke(); ctx.restore();
  // solar lights along the curb
  for (const x of [960, 1180, 1420, 1680, 1960]) solarLight(ctx, x, yAt(top, x) + 4, lerp(.7, 1.4, (x - 838) / 1162));

  // stepping-stone path from the camera to the shed door
  for (const [cx, cy, rx, ry] of [[770, 455, 38, 11], [735, 490, 46, 14], [705, 535, 56, 17], [690, 590, 70, 21], [700, 660, 86, 26], [740, 745, 105, 32], [800, 850, 128, 40]])
    stone(ctx, rng, cx, cy, rx, ry);

  // low planter box along the left that hides the old clutter, with rosemary hedge
  const boxTop = [[575, 488], [130, 690]], boxH = [62, 120];
  ctx.fillStyle = '#7a5134';
  P(ctx, [[575, 488], [130, 690], [130, 690 + boxH[1]], [575, 488 + boxH[0]]]); ctx.fill();
  ctx.strokeStyle = 'rgba(40,22,10,.45)'; ctx.lineWidth = 2;
  for (let k = 1; k < 4; k++) { const t = k / 4; ctx.beginPath(); ctx.moveTo(575, 488 + boxH[0] * t); ctx.lineTo(130, 690 + boxH[1] * t); ctx.stroke(); }
  ctx.fillStyle = '#9a6a45'; P(ctx, [[580, 484], [125, 686], [125, 698], [580, 494]]); ctx.fill();
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, x = lerp(560, 150, t), y = lerp(492, 684, t), s = lerp(.8, 1.4, t);
    leaves(ctx, rng, x, y - 34 * s, 44 * s, 42 * s, 380, ['#8ea57f', '#6e8a5f', '#52704a', '#3d5839'], 9 * s, 1.8 * s);
  }
  for (const [x, y, s] of [[480, 520, .9], [300, 600, 1.1], [180, 660, 1.25]]) lavender(ctx, rng, x, y - 12 * s, s);

  // big pots: olive by the door, lemon tree at front right
  pot(ctx, 905, 445, 74, 80);
  olive(ctx, rng, 905, 372, .55);
  pot(ctx, 1290, 905, 130, 130);
  // lemon tree in the front pot
  ctx.strokeStyle = '#5b4a3a'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(1290, 780); ctx.lineTo(1294, 650); ctx.stroke();
  leaves(ctx, rng, 1294, 595, 100, 80, 1600, ['#6c9b45', '#4f8136', '#3a6a2a', '#2c5420'], 13, 6);
  for (let i = 0; i < 26; i++) { const a = rng() * 6.283, r = Math.sqrt(rng()); ctx.fillStyle = rng() < .5 ? '#f2cf2b' : '#e7bb17'; ctx.beginPath(); ctx.ellipse(1294 + Math.cos(a) * 88 * r, 600 + Math.sin(a) * 66 * r, 11, 8.5, a, 0, 7); ctx.fill(); }
}
window.drawBack = drawBack; window.drawFront = drawFront;
