// Entrance redesign, step 2: planters, plants and lights drawn as a transparent layer (2000x934).
function makeRng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
const lerp=(a,b,t)=>a+(b-a)*t;
function shadow(ctx,x,y,rx,ry,a=.35){ctx.save();ctx.translate(x,y);ctx.scale(1,ry/rx);const g=ctx.createRadialGradient(0,0,1,0,0,rx);g.addColorStop(0,`rgba(25,20,15,${a})`);g.addColorStop(1,'rgba(25,20,15,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,rx,0,7);ctx.fill();ctx.restore();}
function leaves(ctx,rng,cx,cy,rx,ry,n,cols,len,wid){for(let i=0;i<n;i++){const a=rng()*6.283,r=Math.sqrt(rng());const x=cx+Math.cos(a)*rx*r,y=cy+Math.sin(a)*ry*r;const sh=(y-(cy-ry))/(2*ry)+(x-cx)/(rx*4);ctx.fillStyle=cols[Math.max(0,Math.min(cols.length-1,Math.floor(sh*cols.length*(.75+rng()*.5))))];ctx.save();ctx.translate(x,y);ctx.rotate(rng()*6.283);ctx.beginPath();ctx.ellipse(0,0,len*(.7+rng()*.6),wid,0,0,7);ctx.fill();ctx.restore();}}
function grasses(ctx,rng,x0,x1,y,h,n,cols,plume){
  for(let i=0;i<n;i++){const x=lerp(x0,x1,rng());const ang=(rng()-.5)*1.3,L=h*(.55+rng()*.5);const bend=ang*.8;
    ctx.strokeStyle=cols[(rng()*cols.length)|0];ctx.lineWidth=1+rng()*1.6;ctx.lineCap='round';
    const tx=x+Math.sin(ang+bend)*L,ty=y-Math.cos(ang+bend)*L*.9;
    ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+Math.sin(ang)*L*.4,y-L*.6,tx,ty);ctx.stroke();
    if(plume&&rng()<.22){ctx.fillStyle=plume[(rng()*plume.length)|0];ctx.save();ctx.translate(tx,ty);ctx.rotate(ang+bend);ctx.beginPath();ctx.ellipse(0,6,3.2,13,0,0,7);ctx.fill();ctx.restore();}}
}
function boxPlanter(ctx,x0,x1,yTop,h,depth){ // long rectangular planter, slight top face
  shadow(ctx,(x0+x1)/2,yTop+h+3,(x1-x0)*.6,14,.35);
  let g=ctx.createLinearGradient(0,yTop,0,yTop+h);g.addColorStop(0,'#3b3f42');g.addColorStop(1,'#25282a');
  ctx.fillStyle=g;ctx.fillRect(x0,yTop,x1-x0,h);
  ctx.fillStyle='#4a4e51';ctx.beginPath();ctx.moveTo(x0,yTop);ctx.lineTo(x0+depth*.3,yTop-depth);ctx.lineTo(x1-depth*.3,yTop-depth);ctx.lineTo(x1,yTop);ctx.closePath();ctx.fill();
  ctx.fillStyle='#2a1f17';ctx.beginPath();ctx.moveTo(x0+5,yTop-1);ctx.lineTo(x0+depth*.3+4,yTop-depth+3);ctx.lineTo(x1-depth*.3-4,yTop-depth+3);ctx.lineTo(x1-5,yTop-1);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.07)';ctx.fillRect(x0,yTop,x1-x0,3);
}
function tallPlanter(ctx,x,yb,w,h){
  shadow(ctx,x+w*.15,yb+2,w*.85,w*.2,.4);
  const g=ctx.createLinearGradient(x-w/2,0,x+w/2,0);g.addColorStop(0,'#45494c');g.addColorStop(.35,'#34383a');g.addColorStop(1,'#1e2022');
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-w/2,yb-h);ctx.lineTo(x+w/2,yb-h);ctx.lineTo(x+w*.44,yb);ctx.ellipse(x,yb,w*.44,w*.08,0,0,Math.PI);ctx.closePath();ctx.fill();
  ctx.fillStyle='#4d5154';ctx.beginPath();ctx.ellipse(x,yb-h,w/2,w*.1,0,0,7);ctx.fill();
  ctx.fillStyle='#2b2018';ctx.beginPath();ctx.ellipse(x,yb-h,w*.44,w*.075,0,0,7);ctx.fill();
}
function olive(ctx,rng,x,y,s){
  ctx.strokeStyle='#5e5245';ctx.lineCap='round';
  ctx.lineWidth=9*s;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x-8*s,y-70*s,x+14*s,y-120*s,x+3*s,y-180*s);ctx.stroke();
  ctx.lineWidth=5*s;ctx.beginPath();ctx.moveTo(x+2*s,y-130*s);ctx.quadraticCurveTo(x-35*s,y-170*s,x-55*s,y-215*s);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x+5*s,y-145*s);ctx.quadraticCurveTo(x+40*s,y-180*s,x+60*s,y-225*s);ctx.stroke();
  const cols=['#b9c3a6','#9fac8b','#869673','#6c7b5c','#55634a','#465340'];
  for(const [dx,dy,rx,ry] of [[-55,-235,58,42],[60,-245,60,44],[0,-280,75,52],[-15,-200,50,30],[35,-205,50,32]]) leaves(ctx,rng,x+dx*s,y+dy*s,rx*s,ry*s,900,cols,6.5*s,1.9*s);
}
function wallLight(ctx,x,y){ // cylinder up/down light with soft warm wash
  for(const dir of [-1,1]){const g=ctx.createLinearGradient(x,y,x,y+dir*120);g.addColorStop(0,'rgba(255,214,150,.38)');g.addColorStop(1,'rgba(255,214,150,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-7,y+dir*14);ctx.lineTo(x-34,y+dir*120);ctx.lineTo(x+34,y+dir*120);ctx.lineTo(x+7,y+dir*14);ctx.closePath();ctx.fill();}
  shadow(ctx,x+3,y+2,14,30,.25);
  ctx.fillStyle='#232527';ctx.fillRect(x-7,y-16,14,32);ctx.fillStyle='#3a3d40';ctx.fillRect(x-7,y-16,4,32);
  ctx.fillStyle='rgba(255,226,170,.9)';ctx.fillRect(x-5,y-17,10,2);ctx.fillRect(x-5,y+15,10,2);
}
window.drawFront=function(ctx){
  const rng=makeRng(11);
  // warm LED line under the slab edge
  ctx.save();ctx.filter='blur(3px)';ctx.strokeStyle='rgba(255,210,140,.55)';ctx.lineWidth=4;
  ctx.beginPath();ctx.moveTo(330,232);ctx.lineTo(935,243);ctx.stroke();ctx.beginPath();ctx.moveTo(960,226);ctx.lineTo(1760,234);ctx.stroke();ctx.restore();
  // wall lights
  wallLight(ctx,700,395);wallLight(ctx,993,392);wallLight(ctx,1345,400);
  wallLight(ctx,250,300);wallLight(ctx,470,330);
  // long planter along the right wall with grasses + lavender, rose stays behind it
  boxPlanter(ctx,1440,1745,555,58,14);
  grasses(ctx,rng,1450,1735,548,120,520,['#b7a77a','#a39466','#c9bc8f','#8e8258','#d6cba3'],['#e5dcc0','#d8caa4','#cdbb92']);
  for(const x of [1500,1610,1700]){leaves(ctx,rng,x,530,32,18,240,['#a5b08f','#8a9877','#6d7d5f'],7,1.6);
    for(let i=0;i<40;i++){const bx=x+(rng()-.5)*60,by=535,L=30+rng()*28,a=(bx-x)/80;ctx.strokeStyle='#8a9878';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+Math.sin(a)*L,by-L);ctx.stroke();
      for(let k=0;k<6;k++){ctx.fillStyle=['#7a62b3','#9480c8','#6a54a0'][(rng()*3)|0];ctx.beginPath();ctx.ellipse(bx+Math.sin(a)*L*(1-k*.06),by-L*(1-k*.06),2.2,3.3,a,0,7);ctx.fill();}}}
  // tall planter with olive tree between car and window
  tallPlanter(ctx,650,612,70,105);olive(ctx,rng,650,505,.9);
  // slim planter with upright grass by the door
  tallPlanter(ctx,982,585,42,70);
  grasses(ctx,rng,968,996,516,95,160,['#4f6b3c','#5f7c47','#3f5a31','#6d8a52'],null);
  // planter by the porch column on the right
  tallPlanter(ctx,1335,648,58,82);
  grasses(ctx,rng,1314,1356,566,110,240,['#b7a77a','#a39466','#c9bc8f','#8e8258'],['#e5dcc0','#d8caa4']);
  // modern doormat at the porch step
  ctx.fillStyle='rgba(20,20,20,.25)';ctx.beginPath();ctx.moveTo(1180,648);ctx.lineTo(1290,644);ctx.lineTo(1300,664);ctx.lineTo(1172,668);ctx.closePath();ctx.fill();
  ctx.fillStyle='#3a3530';ctx.beginPath();ctx.moveTo(1180,644);ctx.lineTo(1290,640);ctx.lineTo(1298,658);ctx.lineTo(1174,662);ctx.closePath();ctx.fill();
};
