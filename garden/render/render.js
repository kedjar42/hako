// Usage: node render.js <before.jpg> <outdir>  -> writes back.png and front.png
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const [, , , outdir] = process.argv;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<canvas id="b" width="2000" height="934"></canvas><canvas id="f" width="2000" height="934"></canvas>');
  await page.addScriptTag({ path: path.join(__dirname, 'scene.js') });
  const out = await page.evaluate(() => {
    const b = document.getElementById('b'), f = document.getElementById('f');
    drawBack(b.getContext('2d')); drawFront(f.getContext('2d'));
    return [b.toDataURL('image/png'), f.toDataURL('image/png')];
  });
  ['back', 'front'].forEach((n, i) => fs.writeFileSync(path.join(outdir, n + '.png'), Buffer.from(out[i].split(',')[1], 'base64')));
  await browser.close();
})();
