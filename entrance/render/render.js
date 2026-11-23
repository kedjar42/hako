// node render.js <outdir> -> front.png
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.setContent('<canvas id="f" width="2000" height="934"></canvas>');
await p.addScriptTag({path:path.join(__dirname,'front.js')});
const d=await p.evaluate(()=>{const c=document.getElementById('f');drawFront(c.getContext('2d'));return c.toDataURL('image/png');});
fs.writeFileSync(path.join(process.argv[2],'front.png'),Buffer.from(d.split(',')[1],'base64'));await b.close();})();
