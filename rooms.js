function buildCommon(scene,renderer,design){
'use strict';
const W=10, D=8, H=2.6, T=0.15;
const V2=THREE.Vector2, V3=THREE.Vector3;
const maxAniso=renderer.capabilities.getMaxAnisotropy();

const INTER=[],ANIM=[],LAMPS=[];
function seatOn(o,s){o.userData.seat=s;INTER.push(o);return o;}
function toggleOn(o,t){o.userData.toggle=t;INTER.push(o);return o;}
function regLamp(g,light,bm,name,pow){if(light)light.userData.reg=true;const t={type:'switch',name,on:false,set(on){this.on=on;if(light)light.intensity=on?pow:0;if(bm)bm.emissiveIntensity=on?2.2:.25;}};LAMPS.push(t);toggleOn(g,t);return t;}
let doorT=null;const DOORS=[];
function doorReg(g,openR,closedR){g.userData.noCollide=true;g.userData.rt=openR;ANIM.push(g);DOORS.push({g,openR,closedR});
  if(!doorT)doorT={type:'door',name:'doors',on:true,set(on){this.on=on;DOORS.forEach(d=>d.g.userData.rt=on?d.openR:d.closedR);}};toggleOn(g,doorT);}
let seed=11; function rnd(){seed=(seed*16807)%2147483647;return seed/2147483647;}
function rr(a,b){return a+rnd()*(b-a);}

/* ---------- procedural textures ---------- */
function cv(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')];}
function tex(c,rx=1,ry=1){const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.encoding=THREE.sRGBEncoding;t.anisotropy=maxAniso;return t;}
function speck(x,w,h,n,a){for(let i=0;i<n;i++){x.fillStyle=(rnd()<.5?'rgba(255,255,255,':'rgba(0,0,0,')+(rnd()*a).toFixed(3)+')';x.fillRect(rnd()*w,rnd()*h,1+rnd()*1.5,1+rnd()*1.5);}}
function shade(hex,amt){const c=new THREE.Color(hex),h={};c.getHSL(h);c.setHSL(h.h,h.s,Math.max(0,Math.min(1,h.l+amt)));return '#'+c.getHexString();}

const TX={};
{ // fabric weave (greyscale, tinted by material colour)
  const [c,x]=cv(256,256);x.fillStyle='#ececec';x.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=2){x.fillStyle='rgba(0,0,0,'+(0.05+rnd()*0.04)+')';x.fillRect(0,y,256,1);}
  for(let i=0;i<256;i+=3){x.fillStyle='rgba(255,255,255,'+(0.05+rnd()*0.05)+')';x.fillRect(i,0,1,256);}
  speck(x,256,256,9000,0.12);TX.fabric=tex(c,5,5);}
{ // wood grain
  const [c,x]=cv(512,512);x.fillStyle='#e2e2e2';x.fillRect(0,0,512,512);
  for(let i=0;i<180;i++){const y0=rnd()*512,amp=2+rnd()*6,f=0.004+rnd()*0.01,ph=rnd()*6;x.strokeStyle=rnd()<.6?'rgba(0,0,0,'+(0.04+rnd()*0.1)+')':'rgba(255,255,255,'+(0.05+rnd()*0.1)+')';x.lineWidth=0.6+rnd()*2.2;x.beginPath();for(let px=0;px<=512;px+=8){const py=y0+Math.sin(px*f+ph)*amp;px?x.lineTo(px,py):x.moveTo(px,py);}x.stroke();}
  for(let k=0;k<3;k++){const kx=rnd()*512,ky=rnd()*512;for(let r=2;r<16;r+=2){x.strokeStyle='rgba(0,0,0,.08)';x.beginPath();x.ellipse(kx,ky,r*2.6,r,0,0,7);x.stroke();}}
  speck(x,512,512,4000,0.05);TX.wood=tex(c,1.2,1.2);}
{ // plaster
  const [c,x]=cv(256,256);x.fillStyle='#f4f4f4';x.fillRect(0,0,256,256);speck(x,256,256,14000,0.045);
  for(let i=0;i<40;i++){x.fillStyle='rgba(0,0,0,0.012)';x.beginPath();x.arc(rnd()*256,rnd()*256,8+rnd()*30,0,7);x.fill();}TX.plaster=tex(c,0.8,0.8);}
{ // rattan / basket weave
  const [c,x]=cv(128,128);x.fillStyle='#d8d8d8';x.fillRect(0,0,128,128);
  for(let by=0;by<128;by+=16)for(let bx=0;bx<128;bx+=16){const hz=((bx+by)/16)%2;x.fillStyle='rgba(0,0,0,.18)';for(let k=0;k<16;k+=4){hz?x.fillRect(bx,by+k,16,1.5):x.fillRect(bx+k,by,1.5,16);}}
  speck(x,128,128,1500,0.15);TX.weave=tex(c,8,8);}
{ // brushed metal
  const [c,x]=cv(256,64);x.fillStyle='#d0d0d0';x.fillRect(0,0,256,64);for(let y=0;y<64;y++){x.fillStyle='rgba(255,255,255,'+(rnd()*0.15)+')';x.fillRect(0,y,256,1);}TX.metal=tex(c,2,2);}
{ // ceramic speckle
  const [c,x]=cv(128,128);x.fillStyle='#efefef';x.fillRect(0,0,128,128);speck(x,128,128,900,0.3);TX.ceramic=tex(c,3,3);}

/* ---------- materials ---------- */
const MC={};
function std(o){const k=JSON.stringify(o,(k,v)=>v&&v.isTexture?v.uuid:v);return MC[k]||(MC[k]=new THREE.MeshStandardMaterial(Object.assign({roughness:.8,metalness:0},o)));}
const M={
  fabric:c=>std({color:c,map:TX.fabric,bumpMap:TX.fabric,bumpScale:0.004,roughness:.97}),
  wood:c=>std({color:c,map:TX.wood,bumpMap:TX.wood,bumpScale:0.0015,roughness:.55}),
  plastic:c=>std({color:c,roughness:.4}),
  metal:c=>std({color:c,map:TX.metal,roughness:.35,metalness:.7}),
  ceramic:c=>std({color:c,map:TX.ceramic,roughness:.45}),
  weave:c=>std({color:c,map:TX.weave,bumpMap:TX.weave,bumpScale:0.006,roughness:.9}),
  plain:c=>std({color:c})
};

/* ---------- geometry helpers ---------- */
const GC={};
function rboxGeo(w,h,d,r){r=Math.max(0.002,Math.min(r,w/2-0.002,h/2-0.002,d/2-0.002));const k='rb'+[w,h,d,r].map(v=>v.toFixed(3));if(GC[k])return GC[k];
  const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
  const g=new THREE.ExtrudeGeometry(s,{depth:Math.max(0.001,d-2*r),bevelEnabled:true,bevelThickness:r,bevelSize:r*0.98,bevelOffset:-r*0.98,bevelSegments:3,curveSegments:5});g.center();return GC[k]=g;}
function add(geo,m,x,y,z,p=scene,sh=true){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=sh;o.receiveShadow=true;p.add(o);return o;}
function rb(w,h,d,r,m,x,y,z,p){return add(rboxGeo(w,h,d,r),m,x,y,z,p);}
function bx(w,h,d,m,x,y,z,p){return add(new THREE.BoxGeometry(w,h,d),m,x,y,z,p);}
function cy(rt,rb_,h,m,x,y,z,p,seg=28){return add(new THREE.CylinderGeometry(rt,rb_,h,seg),m,x,y,z,p);}
function sp(r,m,x,y,z,p,sx=1,sy=1,sz=1){const o=add(new THREE.SphereGeometry(r,24,16),m,x,y,z,p);o.scale.set(sx,sy,sz);return o;}
function grp(x,z,ry=0,p=scene,y=0){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ry;p.add(g);return g;}
function tube(pts,r,m,p=scene,seg=40){const c=new THREE.CatmullRomCurve3(pts.map(a=>new V3(...a)));return add(new THREE.TubeGeometry(c,seg,r,8,false),m,0,0,0,p);}
function lathe(pts,m,x,y,z,p,seg=32){return add(new THREE.LatheGeometry(pts.map(a=>new V2(a[0],a[1])),seg),m,x,y,z,p);}
function between(a,b,r,m,p){const A=new V3(...a),B=new V3(...b),L=A.distanceTo(B);const o=add(new THREE.CylinderGeometry(r,r,L,10),m,0,0,0,p);o.position.copy(A).add(B).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new V3(0,1,0),B.clone().sub(A).normalize());return o;}

/* ---------- lights ---------- */
const hemi=new THREE.HemisphereLight(0xffffff,0xb5a58c,0.72);scene.add(hemi);
const fill=new THREE.DirectionalLight(0xdfe8ff,0.25);fill.position.set(-6,10,14);scene.add(fill);
const sun=new THREE.DirectionalLight(0xfff1dc,0.95);
sun.position.set(W/2+10,13,D/2-4);sun.target.position.set(W/2,0,D/2);scene.add(sun.target);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:1,far:45});
sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.02;sun.shadow.camera.layers.enable(1);scene.add(sun);
const lamps=[];const bulbs=[];
function lampLight(p,x,y,z,color=0xffd9a0,dist=5){const l=new THREE.PointLight(color,0,dist,2);l.position.set(x,y,z);p.add(l);lamps.push(l);return l;}
const bulbMat=new THREE.MeshStandardMaterial({color:'#fff6e0',emissive:'#ffd58a',emissiveIntensity:.25});

/* ---------- floor ---------- */
{
  const [c,x]=cv(1024,1024);const tones=['#d6b68a','#cfab7c','#dcbf96','#c9a473','#d3b285','#ddc39c'];
  for(let r=0;r<16;r++){let px=-rnd()*400;while(px<1024){const len=260+rnd()*320,base=tones[Math.floor(rnd()*tones.length)];
    x.save();x.beginPath();x.rect(px,r*64,len,64);x.clip();x.fillStyle=base;x.fillRect(px,r*64,len,64);
    for(let k=0;k<14;k++){const y0=r*64+rnd()*64,amp=1+rnd()*4,f=.005+rnd()*.012,ph=rnd()*6;x.strokeStyle=rnd()<.6?'rgba(90,55,25,'+(0.06+rnd()*.1)+')':'rgba(255,240,215,'+(0.05+rnd()*.1)+')';x.lineWidth=.6+rnd()*1.8;x.beginPath();for(let q=0;q<=len;q+=10){const yy=y0+Math.sin(q*f+ph)*amp;q?x.lineTo(px+q,yy):x.moveTo(px,yy);}x.stroke();}
    if(rnd()<.25){const kx=px+rnd()*len,ky=r*64+10+rnd()*44;x.fillStyle='rgba(80,45,20,.25)';x.beginPath();x.ellipse(kx,ky,6,3,0,0,7);x.fill();}
    x.restore();x.fillStyle='rgba(70,45,25,.55)';x.fillRect(px,r*64,len,1.5);x.fillRect(px+len-1.5,r*64,1.5,64);px+=len;}}
  speck(x,1024,1024,20000,0.05);
  const ft=tex(c,5,4);
  const fl=add(new THREE.PlaneGeometry(W,D),new THREE.MeshStandardMaterial({map:ft,bumpMap:ft,bumpScale:.003,roughness:.55}),W/2,0,D/2,scene,false);fl.rotation.x=-Math.PI/2;
  const gr=add(new THREE.PlaneGeometry(W+7,D+7),M.ceramic('#c4beb4'),W/2,-0.012,D/2,scene,false);gr.rotation.x=-Math.PI/2;
  // outdoor path at entrance
  const pv=add(new THREE.PlaneGeometry(2.2,2.4),M.ceramic('#b9b4ab'),5.15,-0.006,D+1.35,scene,false);pv.rotation.x=-Math.PI/2;
}

/* ---------- walls: one group per side; local x along wall, +z into the room ---------- */
const sides={};
function side(name,x,z,ry,L){const g=grp(x,z,ry);g.userData={name,L};sides[name]=g;return g;}
side('back',0,0,0,W);side('right',W,0,-Math.PI/2,D);side('front',W,D,Math.PI,W);side('left',0,D,Math.PI/2,D);
const wallMat=std({color:'#f2eee7',map:TX.plaster,bumpMap:TX.plaster,bumpScale:.002,roughness:.92});
const trimMat=M.plain('#ffffff');
function buildWall(g,holes,door){const L=g.userData.L;const s=new THREE.Shape();s.moveTo(-T,0);
  if(door){s.lineTo(door[0],0);s.lineTo(door[0],door[2]);s.lineTo(door[1],door[2]);s.lineTo(door[1],0);}
  s.lineTo(L+T,0);s.lineTo(L+T,H);s.lineTo(-T,H);s.lineTo(-T,0);
  holes.forEach(([cx,cy_,w,h])=>{const p=new THREE.Path();p.moveTo(cx-w/2,cy_-h/2);p.lineTo(cx-w/2,cy_+h/2);p.lineTo(cx+w/2,cy_+h/2);p.lineTo(cx+w/2,cy_-h/2);p.lineTo(cx-w/2,cy_-h/2);s.holes.push(p);});
  add(new THREE.ExtrudeGeometry(s,{depth:T,bevelEnabled:false}),wallMat,0,0,-T,g);
  bx(L+2*T,.035,T+.01,M.plain('#3a3f45'),L/2,H+.017,-T/2,g);
  const skirt=(a,b)=>rb(b-a,.1,.02,.004,trimMat,(a+b)/2,.05,.01,g);
  if(door){skirt(0,door[0]);skirt(door[1],L);}else skirt(0,L);
  holes.forEach(h=>windowUnit(g,...h));}
const frameMat=M.plain('#f7f7f5'),glassMat=new THREE.MeshStandardMaterial({color:'#cfe3f1',roughness:.05,metalness:.1,transparent:true,opacity:.28});
const curtainGeo=(()=>{const g=new THREE.PlaneGeometry(.42,2.35,40,1);const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i);p.setZ(i,Math.sin(x*42)*.028+Math.sin(x*17)*.01);}g.computeVertexNormals();return g;})();
const curtainMat=std({color:'#c8cfc2',map:TX.fabric,roughness:.95,side:THREE.DoubleSide});
function windowUnit(g,cx,cy_,w,h){const b=.055,dz=-T/2;
  bx(w,b,T+.02,frameMat,cx,cy_+h/2-b/2,dz,g);bx(w,b,T+.02,frameMat,cx,cy_-h/2+b/2,dz,g);
  bx(b,h,T+.02,frameMat,cx-w/2+b/2,cy_,dz,g);bx(b,h,T+.02,frameMat,cx+w/2-b/2,cy_,dz,g);
  bx(.04,h,.06,frameMat,cx,cy_,dz,g);bx(w,.04,.06,frameMat,cx,cy_+h*.18,dz,g);
  const gl=add(new THREE.PlaneGeometry(w-.05,h-.05),glassMat,cx,cy_,dz,g,false);
  rb(w+.16,.04,.24,.012,trimMat,cx,cy_-h/2-.02,.05,g);
  [-1,1].forEach(s=>{const c=add(curtainGeo,curtainMat,cx+s*(w/2+.2),1.27,.13,g);});
  cy(.012,.012,w+.9,M.metal('#3b3f45'),cx,2.46,.13,g).rotation.z=Math.PI/2;
  [-1,1].forEach(s=>sp(.025,M.metal('#3b3f45'),cx+s*(w/2+.45),2.46,.13,g));}
buildWall(sides.back,[[2.0,1.5,1.5,1.1],[5.2,1.5,1.5,1.1]]);
buildWall(sides.right,[[1.6,1.5,1.5,1.1],[5.4,1.5,1.5,1.1]]);
buildWall(sides.left,[]);
buildWall(sides.front,[],[W-5.9,W-4.4,2.15]);

/* door: frame, glass leaves, exit sign, mat */
{const f=sides.front,a=W-5.9,b=W-4.4;
  bx(.06,2.18,T+.04,frameMat,a-.03,1.09,-T/2,f);bx(.06,2.18,T+.04,frameMat,b+.03,1.09,-T/2,f);bx(1.62,.07,T+.04,frameMat,(a+b)/2,2.17,-T/2,f);
  function leaf(hx,dir){const g=grp(hx,D);g.rotation.y=dir*1.15;doorReg(g,dir*1.15,0);const off=-dir*.36;
    rb(.72,2.1,.045,.01,M.plain('#e9ecef'),off,1.05,0,g);
    add(new THREE.PlaneGeometry(.56,1.75),glassMat,off,1.12,.025,g,false);
    bx(.025,.3,.04,M.metal('#9aa1a9'),off-dir*.27,1.05,.05,g);}
  leaf(4.42,1);leaf(5.88,-1);
  rb(.36,.14,.03,.01,M.plain('#1f9a52'),(a+b)/2,2.36,.02,f);
  bx(.22,.06,.005,std({color:'#ffffff',emissive:'#ffffff',emissiveIntensity:.6}),(a+b)/2,2.36,.036,f);
  rb(.08,.12,.015,.004,trimMat,b+.3,1.1,.01,f);
  rb(1.4,.012,.8,.004,M.weave('#55524c'),5.15,.007,D+.55);
  rb(1.3,.01,.7,.004,M.fabric('#4a4d52'),5.15,.006,D-.5);
}

/* ---------- rugs ---------- */
const zones=design.zones.map(z=>Object.assign({},z));
function rugTexture(z){const w=z.x1-z.x0,d=z.z1-z.z0,cw=1024,ch=Math.round(1024*d/w);const [c,x]=cv(cw,ch);
  if(z.circle){x.fillStyle=z.color;x.fillRect(0,0,cw,ch);for(let r=40;r<512;r+=34){x.strokeStyle=(r/34)%2?shade(z.color,.1):shade(z.color,-.08);x.lineWidth=12;x.beginPath();x.arc(512,512,r,0,7);x.stroke();}x.strokeStyle=shade(z.color,-.15);x.lineWidth=26;x.beginPath();x.arc(512,512,498,0,7);x.stroke();speck(x,cw,ch,cw*ch/12,.12);return tex(c);}
  const base=z.color;x.fillStyle=base;x.fillRect(0,0,cw,ch);
  if(z.id==='relax'){x.strokeStyle=shade(base,-.07);x.lineWidth=3;for(let i=-ch;i<cw+ch;i+=46){x.beginPath();x.moveTo(i,0);x.lineTo(i+ch,ch);x.stroke();x.beginPath();x.moveTo(i,ch);x.lineTo(i+ch,0);x.stroke();}
    x.strokeStyle=shade(base,-.12);x.lineWidth=26;x.strokeRect(13,13,cw-26,ch-26);x.strokeStyle=shade(base,.18);x.lineWidth=5;x.strokeRect(40,40,cw-80,ch-80);}
  if(z.id==='game'){x.strokeStyle=shade(base,.12);x.lineWidth=4;for(let y=30;y<ch;y+=38){x.beginPath();for(let px=0;px<=cw;px+=24){x.lineTo(px,y+((px/24)%2?10:-10));}x.stroke();}
    x.strokeStyle=shade(base,-.12);x.lineWidth=20;x.strokeRect(10,10,cw-20,ch-20);}
  if(z.id==='social'){for(let by=0;by<ch;by+=24)for(let bx_=0;bx_<cw;bx_+=24){const hz=((bx_+by)/24)%2;x.fillStyle='rgba(90,60,25,.16)';for(let k=2;k<24;k+=6)hz?x.fillRect(bx_,by+k,24,2.2):x.fillRect(bx_+k,by,2.2,24);}
    x.strokeStyle=shade(base,-.14);x.lineWidth=18;x.strokeRect(9,9,cw-18,ch-18);}
  if(z.id==='study'){for(let px=0;px<cw;px+=36){x.fillStyle=(px/36)%2?shade(base,.05):shade(base,-.04);x.fillRect(px,0,36,ch);}
    x.strokeStyle=shade(base,-.12);x.lineWidth=18;x.strokeRect(9,9,cw-18,ch-18);}
  if(z.id==='store'){x.fillStyle=shade(base,-.06);for(let y=6;y<ch;y+=14)for(let px=6;px<cw;px+=14){x.beginPath();x.arc(px,y,3,0,7);x.fill();}}
  speck(x,cw,ch,cw*ch/12,z.id==='store'?.05:.12);return tex(c);}
function fringeTex(){const [c,x]=cv(64,512);for(let y=0;y<512;y+=5){x.strokeStyle='rgba(240,232,215,'+(0.7+rnd()*.3)+')';x.lineWidth=2.4;x.beginPath();x.moveTo(0,y);x.lineTo(56+rnd()*8,y+rr(-2,2));x.stroke();}const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;}
const fr=fringeTex();
zones.forEach(z=>{if(z.circle){z.x0=z.cx-z.r;z.x1=z.cx+z.r;z.z0=z.cz-z.r;z.z1=z.cz+z.r;}
  const w=z.x1-z.x0,d=z.z1-z.z0;z.area=(z.circle?Math.PI*z.r*z.r:w*d).toFixed(1);
  if(z.lx==null){z.lx=(z.x0+z.x1)/2;z.lz=(z.z0+z.z1)/2;}
  if(z.norug)return;const t=rugTexture(z);
  z.mat=new THREE.MeshStandardMaterial({map:t,bumpMap:t,bumpScale:.004,roughness:.98});
  if(z.circle){const m=add(new THREE.CircleGeometry(z.r,72),z.mat,z.cx,.008,z.cz,scene,false);m.rotation.x=-Math.PI/2;return;}
  z.rug=bx(w,.014,d,z.mat,(z.x0+z.x1)/2,.007,(z.z0+z.z1)/2);z.rug.castShadow=false;
  if(z.fringe!==false&&z.id!=='store'&&z.id!=='game'){[-1,1].forEach(s=>{const f=add(new THREE.PlaneGeometry(.07,d),new THREE.MeshStandardMaterial({map:fr,transparent:true,alphaTest:.3,roughness:1,side:THREE.DoubleSide}),(z.x0+z.x1)/2+s*(w/2+.035),.009,(z.z0+z.z1)/2,scene,false);f.rotation.x=-Math.PI/2;if(s<0)f.rotation.z=Math.PI;});}});
/* ---------- furniture builders ---------- */
const legWood=M.wood('#5b3f28');
function sofa(x,z,len,ry,col='#7f838b'){const g=grp(x,z,ry),fab=M.fabric(col),fab2=M.fabric(shade(col,-.06));{const n=Math.max(2,Math.round((len-.34)/.72)),cw=(len-.36)/n;seatOn(g,{h:.44,face:1,dz:.1,name:'sofa',spots:Array.from({length:n},(_,i)=>-len/2+.18+(i+.5)*cw)});}
  [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([a,b])=>cy(.022,.016,.08,legWood,a*(len/2-.1),.04,b*.34,g,10));
  rb(len,.2,.86,.04,fab2,0,.18,0,g);
  rb(len-.04,.5,.18,.06,fab2,0,.52,-.34,g);
  [-1,1].forEach(s=>rb(.17,.32,.86,.07,fab2,s*(len/2-.085),.44,0,g));
  const n=Math.max(2,Math.round((len-.34)/.72)),cw=(len-.36)/n;
  for(let i=0;i<n;i++){const cx=-len/2+.18+(i+.5)*cw;
    rb(cw-.02,.15,.66,.07,fab,cx,.355,.08,g);
    const bc=rb(cw-.03,.42,.2,.09,fab,cx,.6,-.22,g);bc.rotation.x=-.16;}
  return g;}
function pillow(g,x,y,z,col,rz=0,ry=0){const p=sp(.2,M.fabric(col),x,y,z,g,1,.95,.32);p.rotation.set(-.25,ry,rz);return p;}
const shellMat=c=>std({color:c,roughness:.42,side:THREE.DoubleSide});
const backGeo=new THREE.CylinderGeometry(.28,.25,.3,28,1,true,Math.PI-.78,1.56);
function chair(x,z,ry,col='#2f3a4f'){const g=grp(x,z,ry),m=shellMat(col);seatOn(g,{h:.47,face:1,name:'chair'});
  rb(.46,.035,.44,.016,m,0,.45,.02,g);
  add(backGeo,m,0,.66,.08,g).rotation.x=-.08;
  rb(.36,.03,.04,.012,m,0,.81,-.17,g);
  [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([a,b])=>{const l=cy(.011,.017,.46,M.wood('#c9a678'),a*.17,.225,b*.16,g,10);l.rotation.z=-a*.07;l.rotation.x=b*.07;});
  between([-.18,.13,-.16],[.18,.13,.16],.004,M.metal('#2c2f34'),g);between([.18,.13,-.16],[-.18,.13,.16],.004,M.metal('#2c2f34'),g);
  return g;}
function table(x,z,w,d,top='#b07a45'){const g=grp(x,z),tm=M.wood(top);
  rb(w,.045,d,.015,tm,0,.75,0,g);
  rb(w-.18,.07,.03,.01,tm,0,.69,d/2-.1,g);rb(w-.18,.07,.03,.01,tm,0,.69,-d/2+.1,g);
  [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([a,b])=>{const l=cy(.032,.022,.72,M.wood(shade(top,-.12)),a*(w/2-.11),.36,b*(d/2-.1),g,14);l.rotation.z=a*.04;l.rotation.x=-b*.04;});
  return g;}
function coffee(x,z,r,h,top){const g=grp(x,z),tm=M.wood(top);
  cy(r,r,.035,tm,0,h,0,g,40);add(new THREE.TorusGeometry(r,.018,8,48),tm,0,h,0,g).rotation.x=Math.PI/2;
  for(let i=0;i<3;i++){const a=i/3*Math.PI*2+.4;const l=between([Math.cos(a)*r*.55,h-.01,Math.sin(a)*r*.55],[Math.cos(a)*r*.8,0,Math.sin(a)*r*.8],.016,legWood,g);}
  cy(r*.55,r*.55,.015,tm,0,h*.38,0,g,32);return g;}
function bookcase(x,z,w,h,d,ry,rows,fillFn){const g=grp(x,z,ry),wm=M.wood('#a77749');
  rb(w,h,.02,.006,M.wood('#8a5f38'),0,h/2,-d/2+.01,g);
  [-1,1].forEach(s=>rb(.03,h,d,.008,wm,s*(w/2-.015),h/2,0,g));
  for(let r=0;r<=rows;r++)rb(w,.028,d,.008,wm,0,r*(h-.028)/rows+.014,0,g);
  for(let r=0;r<rows;r++)(fillFn||books)(g,-w/2+.04,w/2-.04,r*(h-.028)/rows+.028,(h-.028)/rows-.03,d);
  return g;}
const bookCols=['#9c3b31','#2f5d8a','#d8a93f','#4d7a4a','#6e4c86','#cf7337','#ebe4d2','#33373d','#7a8f9a','#b55d6e'];
function books(g,x0,x1,y,hmax,d){let x=x0;while(x<x1-.06){const r=rnd();
  if(r<.1){x+=.06+rnd()*.08;continue;}
  if(r<.18){const n=2+Math.floor(rnd()*3);for(let k=0;k<n;k++)rb(.2,.03,d*.75,.004,M.plain(bookCols[Math.floor(rnd()*bookCols.length)]),Math.min(x+.11,x1-.11),y+.015+k*.032,0,g);x+=.24;continue;}
  if(r<.23&&hmax>.25){potPlant(g,x+.07,y,0,.06,'#e8e2d6','succ');x+=.16;continue;}
  const bw=.022+rnd()*.035,bh=Math.min(hmax,hmax*(.6+rnd()*.35)),c=bookCols[Math.floor(rnd()*bookCols.length)];
  const b=rb(bw,bh,d*.78,.003,M.plain(c),x+bw/2,y+bh/2,.02,g);
  if(rnd()<.35)bx(bw+.002,.012,d*.78,M.plain(shade(c,.25)),x+bw/2,y+bh*.75,.021,g);
  if(rnd()<.06&&x>x0+.05){b.rotation.z=-.22;b.position.x+=.02;}
  x+=bw+.003;}}
const gameCols=['#c0392b','#2e86c1','#f1c40f','#27ae60','#8e44ad','#e67e22','#16a085'];
function gameBoxes(g,x0,x1,y,hmax,d){let x=x0+.02;let k=0;while(x<x1-.3){const n=1+Math.floor(rnd()*Math.min(4,hmax/.075));for(let i=0;i<n;i++){const c=gameCols[(k++)%gameCols.length];rb(.3,.065,d*.8,.006,M.plain(c),x+.15,y+.035+i*.07,.01,g);bx(.3,.012,d*.8+.002,M.plain('#f3efe6'),x+.15,y+.04+i*.07,.01,g);}x+=.34;}}

/* ---------- plants ---------- */
const greens=['#3b7a39','#4d8f42','#2f6a35','#5b9c4a'].map(c=>std({color:c,roughness:.55,side:THREE.DoubleSide}));
const stemMat=std({color:'#4c6b33',roughness:.8}),trunkMat=std({color:'#6b5038',roughness:.9});
function leafGeo(len,wid,bend,curl=.3){const k='lf'+[len,wid,bend,curl].map(v=>v.toFixed(3));if(GC[k])return GC[k];
  const s=new THREE.Shape();s.moveTo(0,0);s.bezierCurveTo(wid*.62,len*.18,wid*.58,len*.72,0,len);s.bezierCurveTo(-wid*.58,len*.72,-wid*.62,len*.18,0,0);
  const g=new THREE.ShapeGeometry(s,10),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),t=y/len;p.setZ(i,bend*t*t*len+Math.abs(x)*curl);}g.computeVertexNormals();return GC[k]=g;}
function monsteraGeo(sz){const k='mo'+sz;if(GC[k])return GC[k];const L=sz,Wd=sz*1.05,s=new THREE.Shape();
  s.moveTo(0,0);s.bezierCurveTo(Wd*.25,-.12*L,Wd*.62,.05*L,Wd*.55,.45*L);s.bezierCurveTo(Wd*.5,.8*L,Wd*.15,L,0,L);s.bezierCurveTo(-Wd*.15,L,-Wd*.5,.8*L,-Wd*.55,.45*L);s.bezierCurveTo(-Wd*.62,.05*L,-Wd*.25,-.12*L,0,0);
  for(let i=0;i<4;i++)[-1,1].forEach(sd=>{const t=.2+i*.17,hx=sd*Wd*(.18+.06*Math.sin(i)),h=new THREE.Path();h.absellipse(hx,t*L,Wd*.09,L*.025,0,Math.PI*2,false,sd*-.5);s.holes.push(h);});
  const g=new THREE.ShapeGeometry(s,10),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),t=y/L;p.setZ(i,.35*t*t*L+Math.abs(x)*.25);}g.computeVertexNormals();return GC[k]=g;}
function placeLeaf(p,geo,pos,ry,tilt,mat){const piv=new THREE.Group();piv.position.set(...pos);piv.rotation.order='YXZ';piv.rotation.y=ry;piv.rotation.x=tilt;p.add(piv);const m=new THREE.Mesh(geo,mat);m.castShadow=true;piv.add(m);return piv;}
function pot(g,r,h,col,style){const m=style==='terra'?M.ceramic(col):std({color:col,map:TX.ceramic,roughness:.35});
  const pts=style==='terra'?[[0,0],[r*.7,0],[r*.72,.01],[r*.92,h*.82],[r*1.06,h*.84],[r*1.06,h],[r*.96,h],[r*.95,h*.92]]:[[0,0],[r*.8,0],[r*.84,.015],[r*.98,h*.5],[r,h*.97],[r*.97,h],[r*.92,h],[r*.92,h*.92]];
  lathe(pts,m,0,0,0,g,32);cy(r*.93,r*.93,.01,M.plain('#3a2a1d'),0,h*.9,0,g,24);
  if(style==='terra')cy(r*.95,r*.85,.03,M.ceramic(col),0,.015,0,g,24);}
function plant(type,x,z,s,potCol,parent=scene,y=0){const g=grp(x,z,rnd()*6,parent,y);g.scale.setScalar(s);g.userData.potR=({fiddle:.2,snake:.15,monstera:.24,palm:.21,pothos:.09,succ:.07}[type]||.2)*s*1.05;
  if(type==='fiddle'){pot(g,.2,.36,potCol,'terra');
    const tp=[[0,.3,0],[.03,.7,.02],[-.02,1.05,-.01],[.01,1.38,.02]];tube(tp,.018,trunkMat,g);
    const cur=new THREE.CatmullRomCurve3(tp.map(a=>new V3(...a)));
    for(let i=0;i<26;i++){const t=.3+.7*i/25,p=cur.getPoint(t);placeLeaf(g,leafGeo(.28+rnd()*.06,.24,.12,.18),[p.x,p.y,p.z],i*2.4,.5+rnd()*.6-(t>.95?.4:0),greens[i%3]);}}
  if(type==='snake'){pot(g,.15,.3,potCol,'modern');
    for(let i=0;i<13;i++){const a=rnd()*6.28,r=rnd()*.07;placeLeaf(g,leafGeo(.5+rnd()*.45,.09,.05,.05),[Math.cos(a)*r,.27,Math.sin(a)*r],a,.05+rnd()*.28,i%2?greens[2]:greens[0]);}}
  if(type==='monstera'){pot(g,.24,.34,potCol,'modern');
    for(let i=0;i<9;i++){const a=i*.7+rnd()*.3,k=.4+rnd()*.6,end=[Math.cos(a)*.3*k,.55+.45*k,Math.sin(a)*.3*k];
      tube([[0,.3,0],[end[0]*.4,end[1]*.75,end[2]*.4],end],.008,stemMat,g,16);
      placeLeaf(g,monsteraGeo(.34+rnd()*.1),end,-a+Math.PI/2,1.0+rnd()*.35,greens[i%4]);}}
  if(type==='palm'){pot(g,.21,.36,potCol,'terra');
    for(let i=0;i<8;i++){const fr=new THREE.Group();fr.position.y=.32;fr.rotation.order='YXZ';fr.rotation.y=i*.8+rnd()*.3;fr.rotation.x=.15+rnd()*.35;g.add(fr);
      const L=.9+rnd()*.35,pts=[];for(let t=0;t<=1.0001;t+=.25)pts.push([0,L*t*(1-.3*t),L*.55*t*t]);tube(pts,.007,stemMat,fr,20);
      const cur=new THREE.CatmullRomCurve3(pts.map(a=>new V3(...a)));
      for(let j=2;j<16;j++){const t=j/16,p=cur.getPoint(t),lg=leafGeo(.2*(1-t*.45),.035,.15,.02);
        [-1,1].forEach(sd=>{const piv=new THREE.Group();piv.position.copy(p);piv.rotation.set(.5*t,0,sd*(Math.PI/2-.35));fr.add(piv);const m=new THREE.Mesh(lg,greens[(j+i)%4]);m.castShadow=true;piv.add(m);});}}}
  if(type==='pothos'){pot(g,.09,.13,potCol,'modern');
    for(let v=0;v<4;v++){const a=v*1.6+rnd(),pts=[[0,.12,0],[Math.cos(a)*.12,.14,Math.sin(a)*.12],[Math.cos(a)*.2,-.05,Math.sin(a)*.2],[Math.cos(a)*.22,-.35-rnd()*.2,Math.sin(a)*.22]];
      tube(pts,.003,stemMat,g,16);const cur=new THREE.CatmullRomCurve3(pts.map(q=>new V3(...q)));
      for(let j=0;j<8;j++){const p=cur.getPoint(.1+j*.11);placeLeaf(g,leafGeo(.065,.06,.05,.1),[p.x,p.y,p.z],a+j*1.3,1.4+rnd()*.6,greens[(j+v)%4]);}}
    for(let j=0;j<7;j++)placeLeaf(g,leafGeo(.07,.065,.05,.1),[0,.12,0],j*.9,.6+rnd()*.4,greens[j%4]);}
  if(type==='succ'){pot(g,.07,.07,potCol,'modern');
    for(let ring=0;ring<3;ring++)for(let j=0;j<8;j++)placeLeaf(g,leafGeo(.05-ring*.01,.026,.0,.12),[0,.065,0],j*.785+ring*.4,1.25-ring*.4,std({color:['#7fa77a','#93b98a','#a9c9a0'][ring],roughness:.5,side:THREE.DoubleSide}));}
  return g;}
function potPlant(g,x,y,z,s,col,type){return plant(type,x,z,s/.07*.5,col,g,y);}


function arcLamp(px,pz,ry=0){
  const g=grp(px,pz,ry),mm=M.metal('#2a2d31');g.userData.potR=.19;
  cy(.17,.19,.04,std({color:'#e8e6e2',map:TX.ceramic,roughness:.2}),0,.02,0,g,40);
  tube([[0,.04,0],[0,1.2,0],[-.25,1.95,.15],[-1.0,2.08,.55],[-1.68,1.82,.9]],.014,mm,g,60);
  const sh=lathe([[.02,.17],[.08,.16],[.15,.1],[.2,0]],std({color:'#2a2d31',roughness:.4,metalness:.5,side:THREE.DoubleSide}),-1.7,1.62,.92,g,32);
  const bm=bulbMat.clone();sp(.04,bm,-1.7,1.65,.92,g);regLamp(g,lampLight(g,-1.7,1.55,.92,0xffcf8a,5),bm,'floor lamp',1.35);}
function sideboard(px,pz,ry=0){
  const g=grp(px,pz,ry),wm=M.wood('#9a6b3f');rb(1.3,.7,.42,.015,wm,0,.43,0,g);
  [-1,1].forEach(s=>{rb(.63,.6,.02,.008,M.wood('#8a5f38'),s*.32,.43,.215,g);cy(.008,.008,.12,M.metal('#2a2d31'),s*.05,.5,.235,g,8);});
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>cy(.015,.012,.08,legWood,a*.58,.04,b*.17,g,8));
  plant('pothos',-.4,0,1,'#e8e2d6',g,.78);gameBoxes(g,0,.6,.78,.25,.3);
  sp(.06,M.ceramic('#3f7f7a'),.42,.88,.05,g,1,1.4,1);}
function tvUnit(px,pz,ry=0){ const g=grp(px,pz,ry),wm=M.wood('#3e322a'),fm=M.wood('#2f2620');
  rb(2.1,.42,.46,.015,wm,0,.29,0,g);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>cy(.02,.015,.08,M.metal('#1c1c1c'),a*1,.04,b*.19,g,8));
  [-.7,.7].forEach(x=>{rb(.66,.36,.02,.006,fm,x,.29,.232,g);for(let k=-3;k<=3;k++)bx(.004,.3,.004,M.plain('#241d18'),x+k*.08,.29,.243,g);});
  bx(.7,.02,.4,wm,0,.29,.02,g);
  rb(.32,.06,.24,.02,M.plastic('#f0f0f0'),0,.35,.02,g);bx(.2,.004,.004,std({color:'#7fb4ff',emissive:'#5a9cff',emissiveIntensity:1}),0,.35,.142,g);
  rb(.3,.05,.22,.015,M.plastic('#202327'),0,.15,.02,g);
  [-.9,.9].forEach(x=>{rb(.14,.26,.16,.02,M.plastic('#1c1e22'),x,.63,0,g);cy(.045,.045,.01,M.plain('#3a3d42'),x,.66,.081,g).rotation.x=Math.PI/2;cy(.025,.025,.01,M.plain('#3a3d42'),x,.56,.081,g).rotation.x=Math.PI/2;});
  // TV
  cy(.02,.02,.14,M.metal('#202226'),0,.57,-.05,g,10);rb(.42,.02,.2,.008,M.metal('#202226'),0,.51,-.03,g);
  rb(1.52,.88,.05,.012,M.plastic('#121418'),0,1.08,-.08,g);
  const [c,x]=cv(768,432);
  {const sky=x.createLinearGradient(0,0,0,432);sky.addColorStop(0,'#2b2e6b');sky.addColorStop(.55,'#d0628a');sky.addColorStop(1,'#f2b26b');x.fillStyle=sky;x.fillRect(0,0,768,432);
   x.fillStyle='#ffe2a6';x.beginPath();x.arc(560,250,70,0,7);x.fill();
   x.fillStyle='#3b2b5c';x.beginPath();x.moveTo(0,330);for(let i=0;i<=768;i+=48)x.lineTo(i,300-Math.abs(Math.sin(i*.013))*90);x.lineTo(768,432);x.lineTo(0,432);x.fill();
   x.fillStyle='#1d1838';x.fillRect(0,360,768,72);for(let i=0;i<768;i+=48){x.fillStyle=i%96?'#2a2350':'#352c63';x.fillRect(i,360,46,10);}
   x.fillStyle='#f6c945';[[180,280],[228,280],[276,280]].forEach(([a,b])=>{x.fillRect(a,b,40,40);x.fillStyle='#b8862a';x.fillRect(a+14,b+12,12,16);x.fillStyle='#f6c945';});
   x.fillStyle='#e8eef7';x.fillRect(110,318,26,42);x.fillStyle='#4fd1c5';x.fillRect(106,306,34,18);
   x.fillStyle='rgba(0,0,0,.45)';x.fillRect(20,18,230,40);x.fillStyle='#fff';x.font='bold 24px monospace';x.fillText('LEVEL 3  ★ 0042',32,46);}
  const st=tex(c);const scr=add(new THREE.PlaneGeometry(1.46,.82),new THREE.MeshBasicMaterial({map:st}),0,1.08,-.052,g,false);
  const glow=add(new THREE.PlaneGeometry(2.1,1.3),new THREE.MeshBasicMaterial({color:'#5a86ff',transparent:true,opacity:.0,blending:THREE.AdditiveBlending,depthWrite:false}),0,1.08,-.245,g,false);
  glow.userData.glow=true;scene.userData.glow=glow;lampLight(g,0,1.08,.4,0x6b8dff,4);
  // floating shelf
  rb(1.4,.03,.2,.008,M.wood('#3e322a'),0,1.82,-.13,g);
  [-.5,-.2,.35].forEach((x,i)=>rb(.05+i*.02,.12+i*.03,.05,.012,M.plastic(['#e74c3c','#f1c40f','#4fd1c5'][i]),x,1.9+i*.015,-.13,g));
  plant('pothos',.6,-.13,.9,'#2f3237',g,1.835);
  toggleOn(g,{type:'switch',name:'TV',on:true,set(on){this.on=on;scr.material.color.set(on?'#ffffff':'#070707');if(scene.userData.glow)scene.userData.glow.visible=on;}});}
function beanGeo(){if(GC.bean)return GC.bean;const g=new THREE.SphereGeometry(.5,56,36),p=g.attributes.position,v=new V3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);let y=v.y*.6;
    if(v.y>-.1)y+=Math.max(0,v.z)*.55*Math.min(1,(v.y+.1)/.4);
    const r=Math.hypot(v.x,v.z+.08);if(v.y>.15&&v.z<.12)y-=.1*Math.max(0,1-r/.38);
    if(y<-.22)y=-.22-(y+.22)*.08;
    const wr=.013*Math.sin(v.x*21+v.y*15)*Math.sin(v.z*17-v.y*9)+.006*Math.sin(v.x*47+v.z*33);
    p.setXYZ(i,v.x*1.06+wr,y+wr,v.z*1.06+wr);}g.computeVertexNormals();return GC.bean=g;}
function cubeUnit(px,pz,ry=Math.PI){ const g=grp(px,pz,ry),wm=std({color:'#f2f0ec',roughness:.6});const n=4,rows=2,t=.02,w=1.42,h=.74,y0=.04,pw=(w-t)/n,ph=(h-t)/rows;
  for(let i=0;i<=n;i++)rb(t,h,.38,.005,wm,-w/2+t/2+pw*i,y0+h/2,0,g);
  for(let r=0;r<=rows;r++)rb(w,t,.38,.005,wm,0,y0+t/2+ph*r,0,g);
  bx(w,h,.01,std({color:'#e4e1da',roughness:.9}),0,y0+h/2,-.185,g);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>cy(.015,.015,.04,M.plain('#cfccc5'),a*(w/2-.04),.02,b*.15,g,8));
  const cw=pw-t;
  for(let i=0;i<n;i++)for(let r=0;r<rows;r++){const cx=-w/2+t/2+pw*(i+.5),cy_=y0+t/2+ph*(r+.5);
    const k=(i+r*3)%4;if(k===0)rb(cw-.05,cw-.07,.32,.02,M.weave('#c9a87a'),cx,cy_-.01,.02,g);
    else if(k===1){rb(cw-.06,cw-.1,.3,.01,M.plastic(gameCols[(i+r)%7]),cx,cy_-.025,.02,g);}
    else if(k===2){sp(.11,std({color:'#d9762e',roughness:.75}),cx,cy_-.05,.03,g);}
    else gameBoxes(g,cx-cw/2+.005,cx+cw/2+.2,cy_-cw/2+.01,cw-.04,.3);}
  // balls on top
  const [c,x]=cv(256,128);x.fillStyle='#f4f4f4';x.fillRect(0,0,256,128);x.fillStyle='#1f1f1f';for(let i=0;i<6;i++){x.beginPath();const a=i*44+10,b=i%2?40:88;for(let k=0;k<5;k++)x.lineTo(a+Math.cos(k*1.256)*14,b+Math.sin(k*1.256)*14);x.fill();}
  sp(.11,std({map:tex(c),roughness:.6}),-.4,h+.15,.0,g);
  const [c2,x2]=cv(256,128);x2.fillStyle='#d9762e';x2.fillRect(0,0,256,128);x2.strokeStyle='#2a1a10';x2.lineWidth=3;x2.beginPath();x2.moveTo(0,64);x2.lineTo(256,64);[64,192].forEach(a=>{x2.moveTo(a,0);x2.lineTo(a,128);});x2.stroke();speck(x2,256,128,3000,.2);
  sp(.12,std({map:tex(c2),roughness:.8}),.05,h+.16,0,g);
  plant('succ',.5,0,1,'#2f3237',g,h+.04);}
function clock(cx=6.65){ const g=sides.back;const [c,x]=cv(256,256);x.fillStyle='#fbfaf7';x.beginPath();x.arc(128,128,124,0,7);x.fill();x.fillStyle='#1d2733';
  for(let i=0;i<60;i++){x.save();x.translate(128,128);x.rotate(i*Math.PI/30);x.fillRect(-1.5,-118,3,i%5?8:18);x.restore();}
  x.lineCap='round';x.strokeStyle='#1d2733';x.lineWidth=7;x.beginPath();x.moveTo(128,128);x.lineTo(128+Math.cos(-.9)*60,128+Math.sin(-.9)*60);x.stroke();x.lineWidth=4;x.beginPath();x.moveTo(128,128);x.lineTo(128+Math.cos(2.4)*95,128+Math.sin(2.4)*95);x.stroke();
  x.strokeStyle='#c0392b';x.lineWidth=2;x.beginPath();x.moveTo(128,128);x.lineTo(128+Math.cos(.6)*100,128+Math.sin(.6)*100);x.stroke();
  const cl=cy(.2,.2,.04,M.plain('#1d2733'),cx,2.08,.02,g,40);cl.rotation.x=Math.PI/2;
  add(new THREE.CircleGeometry(.18,40),std({map:tex(c),roughness:.4}),cx,2.08,.041,g,false);}
function art(g,cx,cy_,w,h,pal){const [c,x]=cv(400,Math.round(400*h/w));const H_=c.height;x.fillStyle=pal[0];x.fillRect(0,0,400,H_);
  for(let i=0;i<7;i++){x.fillStyle=pal[1+(i%(pal.length-1))];x.globalAlpha=.85;const t=rnd();if(t<.4){x.beginPath();x.arc(rnd()*400,rnd()*H_,30+rnd()*90,0,7);x.fill();}else if(t<.7){x.fillRect(rnd()*300,rnd()*H_*.8,40+rnd()*160,20+rnd()*120);}else{x.beginPath();x.arc(rnd()*400,rnd()*H_,60+rnd()*80,0,Math.PI);x.fill();}}
  x.globalAlpha=1;speck(x,400,H_,3000,.06);
  rb(w,h,.035,.006,M.wood('#2a2421'),cx,cy_,.02,g);bx(w-.06,h-.06,.002,M.plain('#f6f4ef'),cx,cy_,.038,g);
  add(new THREE.PlaneGeometry(w-.14,h-.14),std({map:tex(c),roughness:.85}),cx,cy_,.04,g,false);}
function radiator(g,cx){for(let i=0;i<18;i++)rb(.045,.5,.07,.012,M.plain('#f1f1f1'),cx-.42+i*.05,.45,.08,g);cy(.015,.015,.95,M.plain('#e6e6e6'),cx,.2,.08,g,8).rotation.z=Math.PI/2;}
function beanbag(x,z,ry,col='#25447e'){const b=add(beanGeo(),M.fabric(col),x,.23,z);b.rotation.y=ry;seatOn(b,{h:.12,face:-1,name:'beanbag'});return b;}
function pendant(x,z){const g=grp(x,z),sm=std({color:'#2a5d55',roughness:.45,metalness:.3,side:THREE.DoubleSide});
  cy(.005,.005,.7,M.plain('#1c1c1c'),0,2.25,0,g,6);cy(.04,.04,.03,M.plain('#1c1c1c'),0,2.585,0,g,12);
  lathe([[.015,.2],[.06,.19],[.14,.11],[.19,0]],sm,0,1.7,0,g,40);
  const bm=bulbMat.clone();sp(.035,bm,0,1.72,0,g);regLamp(g,lampLight(g,0,1.6,0,0xffd29a,4.5),bm,'pendant light',1.35);}
function cafeTable(x,z,n,col='#2f3a4f'){const g=grp(x,z),tm=M.wood('#c49762'),mm=M.metal('#2c3138');
  cy(.42,.42,.035,tm,0,.74,0,g,48);add(new THREE.TorusGeometry(.42,.012,8,48),tm,0,.74,0,g).rotation.x=Math.PI/2;
  cy(.028,.028,.7,mm,0,.37,0,g,12);cy(.22,.25,.03,mm,0,.015,0,g,32);
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2+.5;chair(x+Math.cos(a)*.78,z+Math.sin(a)*.78,Math.atan2(-Math.cos(a),-Math.sin(a)),col);}
  plant('succ',.1,-.05,.9,'#e8e2d6',g,.76);return g;}
function squareCoffee(x,z,s,top){const g=grp(x,z),tm=M.wood(top);rb(s,.045,s,.015,tm,0,.4,0,g);rb(s-.08,.02,s-.08,.006,tm,0,.12,0,g);
  [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([a,b])=>cy(.022,.018,.4,legWood,a*(s/2-.06),.2,b*(s/2-.06),g,10));
  rb(.26,.02,.19,.004,M.plain('#ebe4d2'),-.1,.43,-.05,g);rb(.24,.015,.18,.004,M.plain('#2f5d8a'),-.09,.448,-.04,g).rotation.y=.2;
  cy(.04,.035,.09,M.ceramic('#f1ece2'),.18,.47,.12,g,20);plant('succ',.15,-.15,.8,'#e8e2d6',g,.42);return g;}
function ottoman(x,z,len,col){const g=grp(x,z);seatOn(g,{h:.43,face:0,name:'ottoman'});rb(len,.36,.48,.08,M.fabric(col),0,.25,0,g);
  [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([a,b])=>cy(.02,.015,.08,legWood,a*(len/2-.08),.04,b*.17,g,8));return g;}
function lowStorage(x,z,ry){const g=grp(x,z,ry),wm=M.wood('#a77749');rb(1.5,.62,.4,.015,wm,0,.37,0,g);
  for(let i=0;i<3;i++){rb(.44,.24,.3,.02,M.weave(['#c9a87a','#b98f5f','#d3b68a'][i]),-.5+i*.5,.25,.06,g);rb(.44,.22,.02,.006,M.wood('#8a5f38'),-.5+i*.5,.52,.2,g);}
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>cy(.015,.012,.06,legWood,a*.68,.03,b*.17,g,8));gameBoxes(g,-.7,.2,.68,.25,.3);return g;}

/* ---------- outside: sky, grass, trees, campus; inside: ceiling, roof, ceiling lights ---------- */
function buildEnv(o){
  const cx=W/2,cz=D/2,big=Math.max(W,D);
  function skyTex(eve){const [c,x]=cv(1024,512);const g=x.createLinearGradient(0,0,0,512);
    if(eve){g.addColorStop(0,'#0c1430');g.addColorStop(.38,'#27315c');g.addColorStop(.47,'#7d5670');g.addColorStop(.5,'#e7976a');g.addColorStop(.52,'#5b4840');g.addColorStop(1,'#2c2a26');}
    else{g.addColorStop(0,'#3f7fc9');g.addColorStop(.36,'#8dbbe6');g.addColorStop(.49,'#e2edf3');g.addColorStop(.52,'#c9d3c2');g.addColorStop(1,'#b8c2ae');}
    x.fillStyle=g;x.fillRect(0,0,1024,512);
    if(eve){for(let i=0;i<260;i++){x.fillStyle='rgba(255,255,255,'+(.3+rnd()*.6)+')';x.fillRect(rnd()*1024,rnd()*190,1.2,1.2);}}
    else{for(let k=0;k<26;k++){const px=rnd()*1024,py=60+rnd()*150,s=20+rnd()*45;for(let j=0;j<7;j++){const ox=px+(j-3)*s*.55+rr(-8,8),oy=py+rr(-s*.18,s*.18),r=s*(.45+rnd()*.4);
      const gr=x.createRadialGradient(ox,oy,0,ox,oy,r);gr.addColorStop(0,'rgba(255,255,255,.75)');gr.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=gr;x.beginPath();x.arc(ox,oy,r,0,7);x.fill();}}}
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;}
  const dayT=skyTex(false),eveT=skyTex(true);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(160,40,24),new THREE.MeshBasicMaterial({map:dayT,side:THREE.BackSide,depthWrite:false,fog:false}));
  sky.position.set(cx,-8,cz);sky.renderOrder=-1;sky.userData.noCollide=true;scene.add(sky);
  {const [c,x]=cv(256,256);x.fillStyle='#6f9a4f';x.fillRect(0,0,256,256);for(let i=0;i<9000;i++){x.fillStyle=['#5f8b44','#7aa85a','#648f47','#86b064'][i%4];x.fillRect(rnd()*256,rnd()*256,1.5,2.5);}
    const t=tex(c,90,90);const g=add(new THREE.PlaneGeometry(320,320),std({color:'#ffffff',map:t,roughness:1}),cx,-.03,cz,scene,false);g.rotation.x=-Math.PI/2;}
  const pv=(()=>{const [c,x]=cv(256,256);x.fillStyle='#bdb7ad';x.fillRect(0,0,256,256);x.strokeStyle='#a39d93';x.lineWidth=3;
    for(let y=0;y<256;y+=32){x.beginPath();x.moveTo(0,y);x.lineTo(256,y);x.stroke();for(let px=((y/32)%2)*32;px<256;px+=64){x.beginPath();x.moveTo(px,y);x.lineTo(px,y+32);x.stroke();}}speck(x,256,256,6000,.1);return tex(c,1,1);})();
  const dx=o.door.dir[0],dz=o.door.dir[1];
  {const len=34,p=add(new THREE.PlaneGeometry(dx?len:2.4,dx?2.4:len),std({color:'#ffffff',map:pv,roughness:.95}),o.door.x+dx*len/2,-.02,o.door.z+dz*len/2,scene,false);p.rotation.x=-Math.PI/2;
    p.material.map=pv.clone();p.material.map.needsUpdate=true;p.material.map.repeat.set(dx?len/2:1.2,dx?1.2:len/2);}
  const trunk=std({color:'#6b5038',roughness:.95});
  const fol=['#3f7a37','#4c8a3e','#5c9a45','#3a6e33'].map(c=>std({color:c,roughness:.85,flatShading:true}));
  const icoGeo=new THREE.IcosahedronGeometry(1,1);
  function tree(x,z,s,near){const g=grp(x,z,rnd()*6);g.userData.noCollide=true;const tr=cy(.11*s,.17*s,2.4*s,trunk,0,1.2*s,0,g,8);tr.castShadow=near;
    const n=3+Math.floor(rnd()*3);for(let i=0;i<n;i++){const m=new THREE.Mesh(icoGeo,fol[(i+Math.floor(x))%4&3]);const r=(.9+rnd()*.7)*s;m.scale.set(r,r*(.85+rnd()*.3),r);
      m.position.set(rr(-.7,.7)*s,(2.5+rnd()*1.3)*s,rr(-.7,.7)*s);m.castShadow=near;m.receiveShadow=true;g.add(m);}return g;}
  function onPath(x,z){if(dz)return Math.abs(x-o.door.x)<3.2&&z>D;return Math.abs(z-o.door.z)<3.2&&x>W;}
  let made=0,tries=0;while(made<54&&tries<400){tries++;const a=rnd()*Math.PI*2,r=big*.62+5+Math.pow(rnd(),.8)*48;const x=cx+Math.cos(a)*r*1.1,z=cz+Math.sin(a)*r;
    if(onPath(x,z)||(x>-4&&x<W+4&&z>-4&&z<D+4))continue;tree(x,z,.85+rnd()*.7,r<big*.6+16);made++;}
  for(let i=0;i<22;i++){const sd=Math.floor(rnd()*4),t=rnd();let x,z;if(sd===0){x=t*W;z=-1.1;}else if(sd===1){x=W+1.1;z=t*D;}else if(sd===2){x=t*W;z=D+1.1;}else{x=-1.1;z=t*D;}
    if(onPath(x,z)||(dz&&Math.abs(x-o.door.x)<2&&z>D)||(dx&&Math.abs(z-o.door.z)<2&&x>W))continue;
    const b=new THREE.Mesh(icoGeo,fol[i%4]);const r=.45+rnd()*.35;b.scale.set(r*1.2,r,r);b.position.set(x,r*.7,z);b.castShadow=true;b.userData.noCollide=true;scene.add(b);}
  {const [c,x]=cv(256,256);x.fillStyle='#d9d2c6';x.fillRect(0,0,256,256);for(let y=10;y<256;y+=32)for(let px=8;px<256;px+=24){x.fillStyle=rnd()<.25?'#f3dca0':'#4c5a68';x.fillRect(px,y,14,18);}
    const bt=tex(c,1,1),cols=['#d9d2c6','#cbbfae','#e2ddd3','#b9a58c'];
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2+rnd()*.4,r=78+rnd()*30,bw=14+rnd()*14,bh=8+rnd()*12,bd=10+rnd()*8;
      const m=new THREE.MeshStandardMaterial({color:cols[i%4],map:bt.clone(),roughness:.9});m.map.needsUpdate=true;m.map.repeat.set(bw/8,bh/8);
      const b=add(new THREE.BoxGeometry(bw,bh,bd),m,cx+Math.cos(a)*r,bh/2,cz+Math.sin(a)*r,scene,false);b.rotation.y=-a+Math.PI/2;b.userData.noCollide=true;}}
  const postHeads=[];const headMat=std({color:'#fff4d6',emissive:'#ffcf7a',emissiveIntensity:.1});
  for(let i=0;i<4;i++){const d=9+i*7.5,px=o.door.x+dx*d+(dz?1.8:0),pz=o.door.z+dz*d+(dx?1.8:0);const g=grp(px,pz);g.userData.noCollide=true;
    cy(.05,.07,3.2,M.metal('#2b2d30'),0,1.6,0,g,10);sp(.16,headMat,0,3.3,0,g);cy(.2,.2,.04,M.metal('#2b2d30'),0,3.44,0,g,16);}
  /* ceiling + roof */
  const roof=new THREE.Group();roof.userData.roof=true;scene.add(roof);
  const [cc,cx2]=cv(256,256);cx2.fillStyle='#f3f1ec';cx2.fillRect(0,0,256,256);speck(cx2,256,256,5000,.05);cx2.strokeStyle='#d3cec5';cx2.lineWidth=3;
  for(let i=0;i<=256;i+=128){cx2.beginPath();cx2.moveTo(i,0);cx2.lineTo(i,256);cx2.stroke();cx2.beginPath();cx2.moveTo(0,i);cx2.lineTo(256,i);cx2.stroke();}
  const ceil=add(new THREE.PlaneGeometry(W,D),std({color:'#ffffff',map:tex(cc,W/1.2,D/1.2),roughness:.95}),cx,H-.004,cz,roof,true);ceil.rotation.x=Math.PI/2;
  bx(W+2*T+.5,.26,D+2*T+.5,std({color:'#77716a',roughness:.92}),cx,H+.13,cz,roof);
  [[W+2*T+.5,.32,.12,cx,-T-.19],[W+2*T+.5,.32,.12,cx,D+T+.19],[.12,.32,D+2*T+.5,-T-.19,cz],[.12,.32,D+2*T+.5,W+T+.19,cz]].forEach(([a,b,c,x,z])=>bx(a,b,c,std({color:'#8a837b',roughness:.9}),x,H+.42,z,roof));
  rb(1.4,.7,1.0,.04,M.metal('#b9bec4'),W*.7,H+.61,D*.3,roof);rb(.9,.5,.9,.04,M.metal('#a9aeb4'),W*.25,H+.51,D*.65,roof);
  const panelMat=std({color:'#ffffff',emissive:'#fff3dd',emissiveIntensity:1,roughness:.4});const cl=[];
  o.ceil.forEach(([x,z])=>{rb(.66,.02,.66,.005,M.plain('#dcd8d0'),x,H-.012,z,roof);rb(.58,.012,.58,.004,panelMat,x,H-.022,z,roof);
    const l=new THREE.PointLight(0xfff2dc,0,o.reach||7,2);l.position.set(x,H-.4,z);scene.add(l);cl.push(l);});
  const ceilT={type:'switch',name:'ceiling lights',on:true,set(on){this.on=on;cl.forEach(l=>l.intensity=on?(o.pow||.6):0);panelMat.emissiveIntensity=on?1:.02;}};ceilT.set(true);
  const sw=rb(.085,.13,.018,.004,M.plain('#f6f5f2'),o.sw.lx,o.sw.y,.012,sides[o.sw.side]);bx(.03,.055,.012,M.plain('#e3e1dc'),o.sw.lx,o.sw.y,.024,sides[o.sw.side]).userData.part=1;toggleOn(sw,ceilT);
  return {roof,ceilT,setEve(e){sky.material.map=e?eveT:dayT;headMat.emissiveIntensity=e?2.2:.1;}};
}

const ENV=buildEnv({ceil:[[2.5,2.1],[7.5,2.1],[2.5,5.9],[7.5,5.9]],pow:.55,sw:{side:'front',lx:W-4.08,y:1.15},door:{x:5.15,z:D,dir:[0,1]}});
const LAYOUTS={
relax(){
/* ===== Design 1: relaxation focus ===== */
const sA=sofa(3.4,.95,3.6,0),sB=sofa(1.25,2.72,2.3,Math.PI/2),sC=sofa(3.75,4.3,2.7,Math.PI);
pillow(sA,-1.5,.6,-.1,'#d9a441',.25);pillow(sA,-1.15,.6,-.08,'#c4663f',.1,.2);pillow(sA,1.5,.6,-.1,'#3f7f7a',-.25);
pillow(sB,.85,.6,-.1,'#e7dcc6',-.2);pillow(sC,-1.0,.6,-.1,'#d9a441',.2);pillow(sC,1.0,.6,-.1,'#3f7f7a',-.2);
coffee(3.5,2.6,.52,.42,'#b9874f');coffee(4.45,2.95,.3,.34,'#8e6238');
{const mug=(x,y,z,c)=>{cy(.04,.035,.09,M.ceramic(c),x,y+.045,z,scene,20);add(new THREE.TorusGeometry(.026,.008,8,16),M.ceramic(c),x+.045,y+.05,z);};
 mug(3.3,.44,2.45,'#f1ece2');mug(3.75,.44,2.7,'#2f5d8a');plant('succ',3.55,2.85,.9,'#e8e2d6',scene,.44);
 rb(.26,.02,.19,.004,M.plain('#ebe4d2'),3.2,.455,2.75);}
arcLamp(5.55,1.25,0);
tvUnit(9.74,3.5,-Math.PI/2);
beanbag(7.65,2.95,-Math.PI/2+.35);beanbag(7.65,4.15,-Math.PI/2-.35);
sideboard(7.6,.23,0);
table(3.2,6.75,1.9,.9,'#b07a45');[2.7,3.7].forEach(x=>{chair(x,5.9,0);chair(x,7.6,Math.PI);});pendant(3.2,6.75);
{const y=.775;rb(1.5,.004,.3,.002,M.fabric('#e9e2d4'),3.2,y,6.75);lathe([[0,0],[.1,.005],[.14,.07],[.135,.07]],M.wood('#8e6238'),3.2,y,6.75,scene,32);
 [['#e8963a',.04],['#c0392b',.038],['#8db33a',.036]].forEach(([c,r],i)=>sp(r,M.plain(c),3.2+Math.cos(i*2.1)*.05,y+.06,6.75+Math.sin(i*2.1)*.05));}
const bk=bookcase(.17,5.6,1.2,1.9,.32,Math.PI/2,5);plant('pothos',.3,0,1.1,'#e8e2d6',bk,1.9);
clock(6.65);
art(sides.back,3.6,1.55,.62,.82,['#e9e1d3','#2f5d8a','#d9a441','#c4663f','#3f7f7a']);
art(sides.right,7.15,1.65,.9,.6,['#1d2733','#4f7fbf','#e6eaef','#c0392b']);
art(sides.left,D-3.0,1.6,.75,.95,['#efe8dc','#6f8a52','#d9a441','#1d2733']);
radiator(sides.right,1.6);radiator(sides.right,5.4);
[['fiddle',.45,.45,1.15,'#c97b4f'],['snake',6.25,.38,.9,'#2f3237'],['palm',9.5,.55,1.0,'#c97b4f'],
 ['monstera',.5,7.5,1.05,'#2f3237'],['snake',9.55,7.5,1.0,'#efe9df'],['monstera',9.5,6.6,.9,'#efe9df'],['fiddle',6.4,7.55,.95,'#efe9df']
].forEach(([t,x,z,s,c])=>plant(t,x,z,s,c));
},
zones(){/* ---------- RELAXATION ---------- */
const sofaA=sofa(2.65,1.0,3.5,0);
const sofaB=sofa(1.35,2.42,1.84,Math.PI/2);
const sofaC=sofa(3.15,3.36,1.9,Math.PI);
pillow(sofaA,-1.45,.6,-.1,'#d9a441',.25);pillow(sofaA,-1.12,.6,-.08,'#3f7f7a',.1,.2);pillow(sofaA,1.42,.6,-.1,'#c4663f',-.25);
pillow(sofaB,.72,.6,-.1,'#e7dcc6',-.2);pillow(sofaC,-.7,.6,-.1,'#3f7f7a',.2);pillow(sofaC,.72,.6,-.1,'#d9a441',-.2);
{ // knitted throw over the left sofa arm
  const g=new THREE.PlaneGeometry(.55,.95,10,20),p=g.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i),x=p.getX(i);const t=(y+.475)/.95;p.setZ(i,Math.sin(t*Math.PI)*.18+Math.sin(x*30)*.008);}g.computeVertexNormals();
  const th=add(g,std({color:'#c9b79a',map:TX.weave,bumpMap:TX.weave,bumpScale:.008,roughness:.98,side:THREE.DoubleSide}),1.35,.5,3.25);th.rotation.set(-Math.PI/2,0,.1);}
coffee(2.85,2.1,.42,.42,'#b9874f');coffee(3.52,2.32,.34,.36,'#8e6238');
{ // coffee table props
  rb(.26,.02,.19,.004,M.plain('#ebe4d2'),2.72,.455,2.0);rb(.24,.015,.18,.004,M.plain('#2f5d8a'),2.73,.473,2.01).rotation.y=.2;
  const mug=(x,y,z,c)=>{cy(.04,.035,.09,M.ceramic(c),x,y+.045,z,scene,20);add(new THREE.TorusGeometry(.026,.008,8,16),M.ceramic(c),x+.045,y+.05,z).rotation.y=0;};
  mug(3.05,.44,2.2,'#f1ece2');mug(3.6,.38,2.35,'#c4663f');
  plant('succ',2.95,1.85,.9,'#e8e2d6',scene,.44);
  rb(.16,.02,.05,.01,M.plain('#1f2226'),3.45,.39,2.22);
}
arcLamp(4.85,1.15,0);
sideboard(5.2,.23,0);

/* ---------- GAMING ---------- */
tvUnit(8.2,.26,0);

[[7.3,2.35,-.35],[9.05,2.3,.35]].forEach(([x,z,r])=>beanbag(x,z,r));
{ const g=grp(8.17,1.6);cy(.3,.3,.04,M.wood('#2b4d8c'),0,.42,0,g,40);cy(.28,.24,.4,M.fabric('#1d3566'),0,.2,0,g,40);
  const ctl=(x,z,ry,c)=>{const q=grp(x,z,ry,g,.44);rb(.13,.028,.07,.013,M.plastic(c),0,.014,0,q);[-1,1].forEach(s=>{const h=cy(.022,.017,.06,M.plastic(c),s*.05,.0,.03,q,12);h.rotation.x=Math.PI/2+.4;});cy(.01,.01,.008,M.plain('#111'),-.025,.03,0,q,10);cy(.01,.01,.008,M.plain('#111'),.025,.03,0,q,10);};
  ctl(-.08,-.05,.3,'#f3f3f3');ctl(.1,.06,-.4,'#1e1e22');
  const hs=add(new THREE.TorusGeometry(.075,.011,8,24,Math.PI),M.plastic('#2a2d33'),.05,.45,-.12,g);hs.rotation.set(-Math.PI/2,0,.5);
  lathe([[0,0],[.08,.005],[.1,.05],[.095,.05]],M.ceramic('#d9a441'),-.12,.44,.12,g,24);
  for(let i=0;i<5;i++)sp(.022,M.plain(['#e7c36a','#d99a3a'][i%2]),-.12+rr(-.04,.04),.49,.12+rr(-.04,.04),g,1,.5,1);}

/* ---------- SOCIAL / EATING ---------- */
table(7.15,4.9,3.4,1.2,'#b07a45');
[5.9,6.7,7.6,8.4].forEach((x,i)=>{chair(x,4.03,0);chair(x,5.78,Math.PI);});
{ const y=.775;
  rb(2.6,.004,.34,.002,M.fabric('#e9e2d4'),7.15,y,4.9);
  const planter=grp(7.15,4.9,0,scene,y);rb(.5,.08,.13,.02,M.ceramic('#efe9df'),0,.04,0,planter);
  [-.15,0,.15].forEach(x=>plant('succ',x,0,.9,'#efe9df',planter,.02));
  [[5.9,4.5],[6.7,4.5],[7.6,5.3],[8.4,5.3]].forEach(([x,z])=>{cy(.12,.1,.015,M.ceramic('#f4f1ea'),x,y+.008,z,scene,32);});
  [[6.05,4.6,'#2f5d8a'],[8.25,5.2,'#f4f1ea']].forEach(([x,z,c])=>{cy(.04,.035,.09,M.ceramic(c),x,y+.045,z,scene,20);add(new THREE.TorusGeometry(.026,.008,8,16),M.ceramic(c),x+.045,y+.05,z);});
  lathe([[0,0],[.1,.005],[.14,.07],[.135,.07]],M.wood('#8e6238'),6.35,y,5.05,scene,32);
  [['#e8963a',.04],['#c0392b',.038],['#8db33a',.036],['#e8963a',.04]].forEach(([c,r],i)=>sp(r,M.plain(c),6.35+Math.cos(i*1.6)*.05,y+.06,5.05+Math.sin(i*1.6)*.05));
  rb(.22,.03,.3,.004,M.plain('#c0392b'),8.0,y+.015,4.65).rotation.y=.3;}
[6.2,7.15,8.1].forEach(x=>pendant(x,4.9));

/* ---------- STUDY ---------- */
table(2.3,5.75,1.9,.8,'#c49762');table(2.3,7.3,1.9,.8,'#c49762');
[1.8,2.8].forEach(x=>{chair(x,5.12,0,'#3a3360');chair(x,6.67,0,'#3a3360');});
function screenTex(kind){const [c,x]=cv(256,170);x.fillStyle=kind?'#1e2430':'#f5f7fa';x.fillRect(0,0,256,170);
  if(kind){const cols=['#8db6e3','#e5c07b','#98c379','#c678dd','#abb2bf'];for(let i=0;i<14;i++){x.fillStyle=cols[i%5];x.fillRect(12+(i%3)*10,12+i*11,40+rnd()*130,5);}}
  else{x.fillStyle='#2f5d8a';x.fillRect(16,14,140,10);x.fillStyle='#b8c2cc';for(let i=0;i<10;i++)x.fillRect(16,36+i*12,200-rnd()*60,5);x.fillStyle='#d9a441';x.fillRect(170,40,70,50);}
  return tex(c);}
function laptop(x,z,kind){const g=grp(x,z);rb(.33,.016,.23,.006,M.metal('#a9b0b8'),0,.783,0,g);bx(.28,.002,.1,M.plain('#2a2d33'),0,.792,-.02,g);
  const hinge=grp(0,.11,0,g,.79);hinge.rotation.x=.28;rb(.33,.22,.012,.006,M.metal('#a9b0b8'),0,.11,0,hinge);
  add(new THREE.PlaneGeometry(.3,.19),new THREE.MeshBasicMaterial({map:screenTex(kind)}),0,.112,-.007,hinge,false).rotation.y=Math.PI;}
laptop(1.8,5.65,1);laptop(2.8,5.68,0);laptop(1.8,7.2,0);
function deskLamp(x,z,ry){const g=grp(x,z,ry),m=M.metal('#2c3138');
  cy(.07,.08,.02,m,0,.785,0,g,24);between([0,.79,0],[-.08,1.07,0],.009,m,g);sp(.016,m,-.08,1.07,0,g);between([-.08,1.07,0],[.13,1.15,0],.008,m,g);
  const hd=add(new THREE.ConeGeometry(.065,.11,24,1,true),std({color:'#d9a441',roughness:.4,side:THREE.DoubleSide}),.15,1.1,0,g);hd.rotation.z=-.5;
  const bm=bulbMat.clone();sp(.022,bm,.165,1.07,0,g);regLamp(g,lampLight(g,.18,.98,0,0xffdca8,2.5),bm,'desk lamp',1.3);}
deskLamp(3.05,5.85,Math.PI);deskLamp(3.05,7.4,Math.PI);
{ // desk props
  const nb=(x,z,c,r)=>{const o=rb(.21,.012,.28,.004,M.plain(c),x,.781,z);o.rotation.y=r;};nb(2.3,5.62,'#2f5d8a',.1);nb(2.32,5.64,'#ebe4d2',.05);nb(2.75,7.25,'#b55d6e',-.2);nb(1.4,7.35,'#ebe4d2',.3);
  cy(.035,.035,.1,M.ceramic('#3a3360'),1.45,.825,5.85,scene,16);[[0,.015,'#c0392b'],[.012,-.01,'#2f5d8a'],[-.01,0,'#222']].forEach(([a,b,c])=>{const p=cy(.004,.004,.15,M.plain(c),1.45+a,.9,5.85+b,scene,6);p.rotation.z=a*8;});
  plant('succ',2.45,7.45,.85,'#e8e2d6',scene,.775);
  [[2.25,7.35],[2.3,7.38]].forEach(([x,z],i)=>rb(.16,.04,.24,.004,M.plain(bookCols[i+3]),x,.8+i*.04,z));}
{ // whiteboard + cabinet on the left wall (local x = D - z)
  const g=sides.left;rb(1.6,.95,.03,.01,M.metal('#c7ccd2'),D-6.05,1.5,.02,g);
  const [c,x]=cv(800,460);x.fillStyle='#fbfcfd';x.fillRect(0,0,800,460);x.lineCap='round';x.lineWidth=5;
  x.strokeStyle='#2f5d8a';x.font='bold 44px "Comic Sans MS", cursive';x.fillStyle='#2f5d8a';x.fillText('Exam week plan',40,70);
  x.strokeStyle='#c0392b';[[60,130,180,70],[320,130,180,70],[580,130,170,70]].forEach(([a,b,w,h])=>x.strokeRect(a,b,w,h));
  x.beginPath();x.moveTo(240,165);x.lineTo(320,165);x.moveTo(500,165);x.lineTo(580,165);x.stroke();
  x.fillStyle='#c0392b';x.font='30px "Comic Sans MS", cursive';x.fillText('revise',90,175);x.fillText('practice',340,175);x.fillText('rest!',620,175);
  x.strokeStyle='#27ae60';x.beginPath();for(let i=0;i<5;i++){x.moveTo(60,260+i*38);x.lineTo(60+200+rnd()*300,260+i*38);}x.stroke();
  add(new THREE.PlaneGeometry(1.52,.87),std({map:tex(c),roughness:.25}),D-6.05,1.5,.037,g,false);
  rb(1.3,.03,.06,.01,M.metal('#9aa1a9'),D-6.05,1.02,.05,g);[['#c0392b',-.3],['#2f5d8a',-.2],['#27ae60',-.1]].forEach(([cl,o])=>{cy(.01,.01,.12,M.plastic(cl),D-6.05+o,1.045,.05,g,8).rotation.z=Math.PI/2;});
  const cab=grp(.22,6.05,Math.PI/2),wm=M.wood('#a77749');rb(1.6,.72,.42,.015,wm,0,.44,0,cab);
  [-.4,.4].forEach(s=>{rb(.76,.64,.02,.008,M.wood('#8a5f38'),s,.44,.215,cab);rb(.14,.02,.02,.008,M.metal('#2a2d31'),s*.2,.62,.235,cab);});
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>cy(.015,.012,.08,legWood,a*.72,.04,b*.17,cab,8));
  plant('pothos',-.5,0,1.1,'#2f3237',cab,.8);
  [0,.1,.2].forEach((o,i)=>rb(.08,.3,.26,.006,M.plain(['#2f5d8a','#33373d','#d8a93f'][i]),.25+o,.95,0,cab));}
{ // notice board on the front wall (local x = W - x)
  const g=sides.front;const [c,x]=cv(600,360);x.fillStyle='#b9895a';x.fillRect(0,0,600,360);speck(x,600,360,9000,.25);
  const papers=[['#fff7c2',30,30,160,120],['#ffffff',220,20,140,180],['#cfe8ff',390,40,170,110],['#ffd6d6',60,190,150,130],['#ffffff',400,180,170,150]];
  papers.forEach(([cl,a,b,w,h])=>{x.save();x.translate(a+w/2,b+h/2);x.rotate(rr(-.06,.06));x.fillStyle='rgba(0,0,0,.2)';x.fillRect(-w/2+4,-h/2+4,w,h);x.fillStyle=cl;x.fillRect(-w/2,-h/2,w,h);x.fillStyle='rgba(40,50,70,.55)';for(let i=0;i<5;i++)x.fillRect(-w/2+12,-h/2+20+i*16,w*.6+rnd()*w*.2,5);x.fillStyle='#c0392b';x.beginPath();x.arc(0,-h/2+8,6,0,7);x.fill();x.restore();});
  rb(1.24,.82,.03,.008,M.wood('#7a5230'),W-2.15,1.55,.016,g);add(new THREE.PlaneGeometry(1.16,.74),std({map:tex(c),roughness:.95}),W-2.15,1.55,.033,g,false);}

/* ---------- STORAGE ---------- */
bookcase(7.35,7.78,1.6,1.45,.36,Math.PI,4,(g,x0,x1,y,h,d)=>rnd()<.5?books(g,x0,x1,y,h,d):gameBoxes(g,x0,x1,y,h,d));
cubeUnit(8.95,7.77,Math.PI);

/* ---------- LEFT WALL SHELVES, CLOCK, ART, RADIATORS ---------- */
const bcA=bookcase(.17,2.2,1.4,1.9,.32,Math.PI/2,5);plant('pothos',.35,0,1.1,'#e8e2d6',bcA,1.9);
const bcB=bookcase(.17,4.1,.9,1.9,.32,Math.PI/2,5);plant('succ',-.2,0,1,'#c97b4f',bcB,1.9);
clock(6.65);

art(sides.back,3.6,1.55,.62,.82,['#e9e1d3','#2f5d8a','#d9a441','#c4663f','#3f7f7a']);
art(sides.right,2.98,1.6,.55,.75,['#efe8dc','#6f8a52','#d9a441','#1d2733']);
art(sides.right,7.15,1.9,.9,.6,['#1d2733','#4f7fbf','#e6eaef','#c0392b']);

radiator(sides.right,1.6);radiator(sides.right,5.4);

/* ---------- FLOOR PLANTS (corners and edges, clear of walkways) ---------- */
[['fiddle',0.45,0.45,1.15,'#c97b4f'],
 ['snake',6.75,0.36,0.9,'#2f3237'],
 ['snake',9.6,0.42,1.05,'#efe9df'],
 ['monstera',4.72,3.55,0.95,'#efe9df'],
 ['fiddle',9.58,3.78,1.0,'#efe9df'],
 ['palm',9.45,6.85,0.9,'#c97b4f'],
 ['monstera',0.5,7.5,1.05,'#2f3237'],
 ['snake',4.05,7.62,0.9,'#7c8b74']
].forEach(([t,x,z,s,c])=>plant(t,x,z,s,c));},
flex(){
/* ===== Design 3: flexible layout ===== */
const sA=sofa(2.6,1.0,3.0,0),sB=sofa(1.35,2.25,1.5,Math.PI/2);
pillow(sA,-1.2,.6,-.1,'#d9a441',.25);pillow(sA,1.15,.6,-.1,'#3f7f7a',-.25);pillow(sB,.45,.6,-.1,'#c4663f',-.2);
squareCoffee(2.75,2.25,.82,'#b9874f');
arcLamp(4.65,1.0,0);
ottoman(5.6,1.55,1.2,'#8f86ad');ottoman(5.6,2.35,.6,'#d9a441');
tvUnit(9.74,3.5,-Math.PI/2);
beanbag(7.8,2.95,-Math.PI/2+.3);beanbag(7.8,4.05,-Math.PI/2-.3);
table(5.3,4.95,1.0,2.4,'#b07a45');[4.15,4.95,5.75].forEach(z=>{chair(4.45,z,Math.PI/2);chair(6.15,z,-Math.PI/2);});
pendant(5.3,4.35);pendant(5.3,5.55);
{const y=.775;rb(.3,.004,2.0,.002,M.fabric('#e9e2d4'),5.3,y,4.95);[4.4,5.5].forEach(z=>plant('succ',5.3,z,.9,'#efe9df',scene,y));}
cafeTable(1.75,4.6,3);cafeTable(1.85,6.7,2,'#3a3360');cafeTable(8.3,6.0,3,'#2f3a4f');
cubeUnit(7.25,7.77,Math.PI);lowStorage(8.95,7.75,Math.PI);
clock(6.65);
art(sides.back,3.6,1.55,.62,.82,['#efe8dc','#4f7fbf','#d9a441','#1d2733']);
art(sides.left,D-5.6,1.6,.9,.6,['#1d2733','#6f8a52','#e6eaef','#d9a441']);
art(sides.right,7.15,1.65,.75,.95,['#e9e1d3','#2f5d8a','#c4663f','#3f7f7a']);
radiator(sides.right,1.6);radiator(sides.right,5.4);
[['fiddle',.45,.45,1.15,'#c97b4f'],['snake',4.55,.38,.85,'#2f3237'],['palm',9.5,.55,1.0,'#c97b4f'],
 ['monstera',.5,7.5,1.05,'#2f3237'],['snake',9.6,6.75,1.0,'#efe9df'],['fiddle',3.85,7.55,.95,'#efe9df'],['snake',.45,3.6,.85,'#c97b4f']
].forEach(([t,x,z,s,c])=>plant(t,x,z,s,c));
}};
LAYOUTS[design.key]();
function setLight(eve){hemi.intensity=eve?.16:.72;hemi.color.set(eve?'#8fa0c8':'#ffffff');fill.intensity=eve?.06:.25;sun.intensity=eve?0:.95;
  lamps.forEach(l=>{if(!l.userData.reg)l.intensity=eve?(l.color.b>l.color.r?1.2:1.35):0;});LAMPS.forEach(t=>t.set(eve));ENV.setEve(eve);bulbMat.emissiveIntensity=eve?2.2:.25;
  if(scene.userData.glow)scene.userData.glow.material.opacity=eve?.35:0;glassMat.color.set(eve?'#24324a':'#cfe3f1');glassMat.opacity=eve?.7:.28;}
return {W,D,H,T,sides,setLight,sun,inter:INTER,anim:ANIM,roof:ENV.roof,spawn:{x:5.15,z:7.0,yaw:0},
  zones:zones.map(z=>({name:z.name,color:z.color,area:z.area,pos:[z.lx,1.05,z.lz]}))};
}

function buildMusic(scene,renderer){
'use strict';
const W=20, D=12, H=3.2, T=0.2;
const V2=THREE.Vector2, V3=THREE.Vector3;
const maxAniso=renderer.capabilities.getMaxAnisotropy();

const INTER=[],ANIM=[],LAMPS=[];
function seatOn(o,s){o.userData.seat=s;INTER.push(o);return o;}
function toggleOn(o,t){o.userData.toggle=t;INTER.push(o);return o;}
function regLamp(g,light,bm,name,pow){if(light)light.userData.reg=true;const t={type:'switch',name,on:false,set(on){this.on=on;if(light)light.intensity=on?pow:0;if(bm)bm.emissiveIntensity=on?2.2:.25;}};LAMPS.push(t);toggleOn(g,t);return t;}
let doorT=null;const DOORS=[];
function doorReg(g,openR,closedR){g.userData.noCollide=true;g.userData.rt=openR;ANIM.push(g);DOORS.push({g,openR,closedR});
  if(!doorT)doorT={type:'door',name:'doors',on:true,set(on){this.on=on;DOORS.forEach(d=>d.g.userData.rt=on?d.openR:d.closedR);}};toggleOn(g,doorT);}
let seed=11; function rnd(){seed=(seed*16807)%2147483647;return seed/2147483647;}
function rr(a,b){return a+rnd()*(b-a);}

/* ---------- procedural textures ---------- */
function cv(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')];}
function tex(c,rx=1,ry=1){const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.encoding=THREE.sRGBEncoding;t.anisotropy=maxAniso;return t;}
function speck(x,w,h,n,a){for(let i=0;i<n;i++){x.fillStyle=(rnd()<.5?'rgba(255,255,255,':'rgba(0,0,0,')+(rnd()*a).toFixed(3)+')';x.fillRect(rnd()*w,rnd()*h,1+rnd()*1.5,1+rnd()*1.5);}}
function shade(hex,amt){const c=new THREE.Color(hex),h={};c.getHSL(h);c.setHSL(h.h,h.s,Math.max(0,Math.min(1,h.l+amt)));return '#'+c.getHexString();}

const TX={};
{ // fabric weave (greyscale, tinted by material colour)
  const [c,x]=cv(256,256);x.fillStyle='#ececec';x.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=2){x.fillStyle='rgba(0,0,0,'+(0.05+rnd()*0.04)+')';x.fillRect(0,y,256,1);}
  for(let i=0;i<256;i+=3){x.fillStyle='rgba(255,255,255,'+(0.05+rnd()*0.05)+')';x.fillRect(i,0,1,256);}
  speck(x,256,256,9000,0.12);TX.fabric=tex(c,5,5);}
{ // wood grain
  const [c,x]=cv(512,512);x.fillStyle='#e2e2e2';x.fillRect(0,0,512,512);
  for(let i=0;i<180;i++){const y0=rnd()*512,amp=2+rnd()*6,f=0.004+rnd()*0.01,ph=rnd()*6;x.strokeStyle=rnd()<.6?'rgba(0,0,0,'+(0.04+rnd()*0.1)+')':'rgba(255,255,255,'+(0.05+rnd()*0.1)+')';x.lineWidth=0.6+rnd()*2.2;x.beginPath();for(let px=0;px<=512;px+=8){const py=y0+Math.sin(px*f+ph)*amp;px?x.lineTo(px,py):x.moveTo(px,py);}x.stroke();}
  for(let k=0;k<3;k++){const kx=rnd()*512,ky=rnd()*512;for(let r=2;r<16;r+=2){x.strokeStyle='rgba(0,0,0,.08)';x.beginPath();x.ellipse(kx,ky,r*2.6,r,0,0,7);x.stroke();}}
  speck(x,512,512,4000,0.05);TX.wood=tex(c,1.2,1.2);}
{ // plaster
  const [c,x]=cv(256,256);x.fillStyle='#f4f4f4';x.fillRect(0,0,256,256);speck(x,256,256,14000,0.045);
  for(let i=0;i<40;i++){x.fillStyle='rgba(0,0,0,0.012)';x.beginPath();x.arc(rnd()*256,rnd()*256,8+rnd()*30,0,7);x.fill();}TX.plaster=tex(c,0.8,0.8);}
{ // rattan / basket weave
  const [c,x]=cv(128,128);x.fillStyle='#d8d8d8';x.fillRect(0,0,128,128);
  for(let by=0;by<128;by+=16)for(let bx=0;bx<128;bx+=16){const hz=((bx+by)/16)%2;x.fillStyle='rgba(0,0,0,.18)';for(let k=0;k<16;k+=4){hz?x.fillRect(bx,by+k,16,1.5):x.fillRect(bx+k,by,1.5,16);}}
  speck(x,128,128,1500,0.15);TX.weave=tex(c,8,8);}
{ // brushed metal
  const [c,x]=cv(256,64);x.fillStyle='#d0d0d0';x.fillRect(0,0,256,64);for(let y=0;y<64;y++){x.fillStyle='rgba(255,255,255,'+(rnd()*0.15)+')';x.fillRect(0,y,256,1);}TX.metal=tex(c,2,2);}
{ // ceramic speckle
  const [c,x]=cv(128,128);x.fillStyle='#efefef';x.fillRect(0,0,128,128);speck(x,128,128,900,0.3);TX.ceramic=tex(c,3,3);}

/* ---------- materials ---------- */
const MC={};
function std(o){const k=JSON.stringify(o,(k,v)=>v&&v.isTexture?v.uuid:v);return MC[k]||(MC[k]=new THREE.MeshStandardMaterial(Object.assign({roughness:.8,metalness:0},o)));}
const M={
  fabric:c=>std({color:c,map:TX.fabric,bumpMap:TX.fabric,bumpScale:0.004,roughness:.97}),
  wood:c=>std({color:c,map:TX.wood,bumpMap:TX.wood,bumpScale:0.0015,roughness:.55}),
  plastic:c=>std({color:c,roughness:.4}),
  metal:c=>std({color:c,map:TX.metal,roughness:.35,metalness:.7}),
  ceramic:c=>std({color:c,map:TX.ceramic,roughness:.45}),
  weave:c=>std({color:c,map:TX.weave,bumpMap:TX.weave,bumpScale:0.006,roughness:.9}),
  plain:c=>std({color:c})
};

/* ---------- geometry helpers ---------- */
const GC={};
function rboxGeo(w,h,d,r){r=Math.max(0.002,Math.min(r,w/2-0.002,h/2-0.002,d/2-0.002));const k='rb'+[w,h,d,r].map(v=>v.toFixed(3));if(GC[k])return GC[k];
  const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
  const g=new THREE.ExtrudeGeometry(s,{depth:Math.max(0.001,d-2*r),bevelEnabled:true,bevelThickness:r,bevelSize:r*0.98,bevelOffset:-r*0.98,bevelSegments:3,curveSegments:5});g.center();return GC[k]=g;}
function add(geo,m,x,y,z,p=scene,sh=true){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=sh;o.receiveShadow=true;p.add(o);return o;}
function rb(w,h,d,r,m,x,y,z,p){return add(rboxGeo(w,h,d,r),m,x,y,z,p);}
function bx(w,h,d,m,x,y,z,p){return add(new THREE.BoxGeometry(w,h,d),m,x,y,z,p);}
function cy(rt,rb_,h,m,x,y,z,p,seg=28){return add(new THREE.CylinderGeometry(rt,rb_,h,seg),m,x,y,z,p);}
function sp(r,m,x,y,z,p,sx=1,sy=1,sz=1){const o=add(new THREE.SphereGeometry(r,24,16),m,x,y,z,p);o.scale.set(sx,sy,sz);return o;}
function grp(x,z,ry=0,p=scene,y=0){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ry;p.add(g);return g;}
function tube(pts,r,m,p=scene,seg=40){const c=new THREE.CatmullRomCurve3(pts.map(a=>new V3(...a)));return add(new THREE.TubeGeometry(c,seg,r,8,false),m,0,0,0,p);}
function lathe(pts,m,x,y,z,p,seg=32){return add(new THREE.LatheGeometry(pts.map(a=>new V2(a[0],a[1])),seg),m,x,y,z,p);}
function between(a,b,r,m,p){const A=new V3(...a),B=new V3(...b),L=A.distanceTo(B);const o=add(new THREE.CylinderGeometry(r,r,L,10),m,0,0,0,p);o.position.copy(A).add(B).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new V3(0,1,0),B.clone().sub(A).normalize());return o;}

/* ---------- plants ---------- */
const greens=['#3b7a39','#4d8f42','#2f6a35','#5b9c4a'].map(c=>std({color:c,roughness:.55,side:THREE.DoubleSide}));
const stemMat=std({color:'#4c6b33',roughness:.8}),trunkMat=std({color:'#6b5038',roughness:.9});
function leafGeo(len,wid,bend,curl=.3){const k='lf'+[len,wid,bend,curl].map(v=>v.toFixed(3));if(GC[k])return GC[k];
  const s=new THREE.Shape();s.moveTo(0,0);s.bezierCurveTo(wid*.62,len*.18,wid*.58,len*.72,0,len);s.bezierCurveTo(-wid*.58,len*.72,-wid*.62,len*.18,0,0);
  const g=new THREE.ShapeGeometry(s,10),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),t=y/len;p.setZ(i,bend*t*t*len+Math.abs(x)*curl);}g.computeVertexNormals();return GC[k]=g;}
function monsteraGeo(sz){const k='mo'+sz;if(GC[k])return GC[k];const L=sz,Wd=sz*1.05,s=new THREE.Shape();
  s.moveTo(0,0);s.bezierCurveTo(Wd*.25,-.12*L,Wd*.62,.05*L,Wd*.55,.45*L);s.bezierCurveTo(Wd*.5,.8*L,Wd*.15,L,0,L);s.bezierCurveTo(-Wd*.15,L,-Wd*.5,.8*L,-Wd*.55,.45*L);s.bezierCurveTo(-Wd*.62,.05*L,-Wd*.25,-.12*L,0,0);
  for(let i=0;i<4;i++)[-1,1].forEach(sd=>{const t=.2+i*.17,hx=sd*Wd*(.18+.06*Math.sin(i)),h=new THREE.Path();h.absellipse(hx,t*L,Wd*.09,L*.025,0,Math.PI*2,false,sd*-.5);s.holes.push(h);});
  const g=new THREE.ShapeGeometry(s,10),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),t=y/L;p.setZ(i,.35*t*t*L+Math.abs(x)*.25);}g.computeVertexNormals();return GC[k]=g;}
function placeLeaf(p,geo,pos,ry,tilt,mat){const piv=new THREE.Group();piv.position.set(...pos);piv.rotation.order='YXZ';piv.rotation.y=ry;piv.rotation.x=tilt;p.add(piv);const m=new THREE.Mesh(geo,mat);m.castShadow=true;piv.add(m);return piv;}
function pot(g,r,h,col,style){const m=style==='terra'?M.ceramic(col):std({color:col,map:TX.ceramic,roughness:.35});
  const pts=style==='terra'?[[0,0],[r*.7,0],[r*.72,.01],[r*.92,h*.82],[r*1.06,h*.84],[r*1.06,h],[r*.96,h],[r*.95,h*.92]]:[[0,0],[r*.8,0],[r*.84,.015],[r*.98,h*.5],[r,h*.97],[r*.97,h],[r*.92,h],[r*.92,h*.92]];
  lathe(pts,m,0,0,0,g,32);cy(r*.93,r*.93,.01,M.plain('#3a2a1d'),0,h*.9,0,g,24);
  if(style==='terra')cy(r*.95,r*.85,.03,M.ceramic(col),0,.015,0,g,24);}
function plant(type,x,z,s,potCol,parent=scene,y=0){const g=grp(x,z,rnd()*6,parent,y);g.scale.setScalar(s);g.userData.potR=({fiddle:.2,snake:.15,monstera:.24,palm:.21,pothos:.09,succ:.07}[type]||.2)*s*1.05;
  if(type==='fiddle'){pot(g,.2,.36,potCol,'terra');
    const tp=[[0,.3,0],[.03,.7,.02],[-.02,1.05,-.01],[.01,1.38,.02]];tube(tp,.018,trunkMat,g);
    const cur=new THREE.CatmullRomCurve3(tp.map(a=>new V3(...a)));
    for(let i=0;i<26;i++){const t=.3+.7*i/25,p=cur.getPoint(t);placeLeaf(g,leafGeo(.28+rnd()*.06,.24,.12,.18),[p.x,p.y,p.z],i*2.4,.5+rnd()*.6-(t>.95?.4:0),greens[i%3]);}}
  if(type==='snake'){pot(g,.15,.3,potCol,'modern');
    for(let i=0;i<13;i++){const a=rnd()*6.28,r=rnd()*.07;placeLeaf(g,leafGeo(.5+rnd()*.45,.09,.05,.05),[Math.cos(a)*r,.27,Math.sin(a)*r],a,.05+rnd()*.28,i%2?greens[2]:greens[0]);}}
  if(type==='monstera'){pot(g,.24,.34,potCol,'modern');
    for(let i=0;i<9;i++){const a=i*.7+rnd()*.3,k=.4+rnd()*.6,end=[Math.cos(a)*.3*k,.55+.45*k,Math.sin(a)*.3*k];
      tube([[0,.3,0],[end[0]*.4,end[1]*.75,end[2]*.4],end],.008,stemMat,g,16);
      placeLeaf(g,monsteraGeo(.34+rnd()*.1),end,-a+Math.PI/2,1.0+rnd()*.35,greens[i%4]);}}
  if(type==='palm'){pot(g,.21,.36,potCol,'terra');
    for(let i=0;i<8;i++){const fr=new THREE.Group();fr.position.y=.32;fr.rotation.order='YXZ';fr.rotation.y=i*.8+rnd()*.3;fr.rotation.x=.15+rnd()*.35;g.add(fr);
      const L=.9+rnd()*.35,pts=[];for(let t=0;t<=1.0001;t+=.25)pts.push([0,L*t*(1-.3*t),L*.55*t*t]);tube(pts,.007,stemMat,fr,20);
      const cur=new THREE.CatmullRomCurve3(pts.map(a=>new V3(...a)));
      for(let j=2;j<16;j++){const t=j/16,p=cur.getPoint(t),lg=leafGeo(.2*(1-t*.45),.035,.15,.02);
        [-1,1].forEach(sd=>{const piv=new THREE.Group();piv.position.copy(p);piv.rotation.set(.5*t,0,sd*(Math.PI/2-.35));fr.add(piv);const m=new THREE.Mesh(lg,greens[(j+i)%4]);m.castShadow=true;piv.add(m);});}}}
  if(type==='pothos'){pot(g,.09,.13,potCol,'modern');
    for(let v=0;v<4;v++){const a=v*1.6+rnd(),pts=[[0,.12,0],[Math.cos(a)*.12,.14,Math.sin(a)*.12],[Math.cos(a)*.2,-.05,Math.sin(a)*.2],[Math.cos(a)*.22,-.35-rnd()*.2,Math.sin(a)*.22]];
      tube(pts,.003,stemMat,g,16);const cur=new THREE.CatmullRomCurve3(pts.map(q=>new V3(...q)));
      for(let j=0;j<8;j++){const p=cur.getPoint(.1+j*.11);placeLeaf(g,leafGeo(.065,.06,.05,.1),[p.x,p.y,p.z],a+j*1.3,1.4+rnd()*.6,greens[(j+v)%4]);}}
    for(let j=0;j<7;j++)placeLeaf(g,leafGeo(.07,.065,.05,.1),[0,.12,0],j*.9,.6+rnd()*.4,greens[j%4]);}
  if(type==='succ'){pot(g,.07,.07,potCol,'modern');
    for(let ring=0;ring<3;ring++)for(let j=0;j<8;j++)placeLeaf(g,leafGeo(.05-ring*.01,.026,.0,.12),[0,.065,0],j*.785+ring*.4,1.25-ring*.4,std({color:['#7fa77a','#93b98a','#a9c9a0'][ring],roughness:.5,side:THREE.DoubleSide}));}
  return g;}
function potPlant(g,x,y,z,s,col,type){return plant(type,x,z,s/.07*.5,col,g,y);}


/* ---------- lights ---------- */
const hemi=new THREE.HemisphereLight(0xffffff,0xb5a58c,0.72);scene.add(hemi);
const fill=new THREE.DirectionalLight(0xdfe8ff,0.25);fill.position.set(-10,20,30);scene.add(fill);
const sun=new THREE.DirectionalLight(0xfff1dc,0.9);
sun.position.set(W/2+9,15,D/2-6);sun.target.position.set(W/2,0,D/2);scene.add(sun.target);
sun.castShadow=true;const smap=Math.min(4096,renderer.capabilities.maxTextureSize);sun.shadow.mapSize.set(smap,smap);
Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:1,far:50});
sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.03;sun.shadow.camera.layers.enable(1);scene.add(sun);
const lamps=[];
function lampLight(p,x,y,z,color=0xffd9a0,dist=6,pow=1.3){const l=new THREE.PointLight(color,0,dist,2);l.position.set(x,y,z);l.userData.on=pow;p.add(l);lamps.push(l);return l;}
const bulbMat=new THREE.MeshStandardMaterial({color:'#fff6e0',emissive:'#ffd58a',emissiveIntensity:.3});
const ledMat=new THREE.MeshStandardMaterial({color:'#ffe6b8',emissive:'#ffc874',emissiveIntensity:.5});

/* ---------- floor ---------- */
{ const [c,x]=cv(1024,1024);const tones=['#d2ae80','#caa574','#d8b88d','#c49d6b','#cfab7e','#d9bd95'];
  for(let r=0;r<16;r++){let px=-rnd()*400;while(px<1024){const len=280+rnd()*340,base=tones[Math.floor(rnd()*tones.length)];
    x.save();x.beginPath();x.rect(px,r*64,len,64);x.clip();x.fillStyle=base;x.fillRect(px,r*64,len,64);
    for(let k=0;k<14;k++){const y0=r*64+rnd()*64,amp=1+rnd()*4,f=.005+rnd()*.012,ph=rnd()*6;x.strokeStyle=rnd()<.6?'rgba(90,55,25,'+(0.06+rnd()*.1)+')':'rgba(255,240,215,'+(0.05+rnd()*.1)+')';x.lineWidth=.6+rnd()*1.8;x.beginPath();for(let q=0;q<=len;q+=10){const yy=y0+Math.sin(q*f+ph)*amp;q?x.lineTo(px+q,yy):x.moveTo(px,yy);}x.stroke();}
    x.restore();x.fillStyle='rgba(70,45,25,.5)';x.fillRect(px,r*64,len,1.5);x.fillRect(px+len-1.5,r*64,1.5,64);px+=len;}}
  speck(x,1024,1024,20000,0.05);const ft=tex(c,W/2.4,D/2.4);
  const fl=add(new THREE.PlaneGeometry(W,D),new THREE.MeshStandardMaterial({map:ft,bumpMap:ft,bumpScale:.003,roughness:.55}),W/2,0,D/2,scene,false);fl.rotation.x=-Math.PI/2;
  const gr=add(new THREE.PlaneGeometry(W+7,D+7),M.ceramic('#c4beb4'),W/2,-0.012,D/2,scene,false);gr.rotation.x=-Math.PI/2;
  const pv=add(new THREE.PlaneGeometry(3,3.4),M.ceramic('#b9b4ab'),W+1.6,-0.006,6,scene,false);pv.rotation.x=-Math.PI/2;}

/* ---------- walls ---------- */
const sides={};
function side(name,x,z,ry,L){const g=grp(x,z,ry);g.userData={name,L};sides[name]=g;return g;}
side('back',0,0,0,W);side('right',W,0,-Math.PI/2,D);side('front',W,D,Math.PI,W);side('left',0,D,Math.PI/2,D);
const wallMat=std({color:'#ece7df',map:TX.plaster,bumpMap:TX.plaster,bumpScale:.002,roughness:.92});
const trimMat=M.plain('#2b2a28');
function buildWall(g,door,holes=[]){const L=g.userData.L;const s=new THREE.Shape();s.moveTo(-T,0);
  if(door){s.lineTo(door[0],0);s.lineTo(door[0],door[2]);s.lineTo(door[1],door[2]);s.lineTo(door[1],0);}
  s.lineTo(L+T,0);s.lineTo(L+T,H);s.lineTo(-T,H);s.lineTo(-T,0);
  holes.forEach(([cx,cy_,w,h])=>{const p=new THREE.Path();p.moveTo(cx-w/2,cy_-h/2);p.lineTo(cx-w/2,cy_+h/2);p.lineTo(cx+w/2,cy_+h/2);p.lineTo(cx+w/2,cy_-h/2);p.lineTo(cx-w/2,cy_-h/2);s.holes.push(p);});
  add(new THREE.ExtrudeGeometry(s,{depth:T,bevelEnabled:false}),wallMat,0,0,-T,g);
  bx(L+2*T,.05,T+.01,M.plain('#2b2a28'),L/2,H+.025,-T/2,g);
  const skirt=(a,b)=>rb(b-a,.1,.02,.004,trimMat,(a+b)/2,.05,.01,g);
  if(door){skirt(0,door[0]);skirt(door[1],L);}else skirt(0,L);
  bx(L,.03,.03,ledMat,L/2,H-.035,.03,g);holes.forEach(h=>mWindow(g,...h));}
const winGlass=new THREE.MeshStandardMaterial({color:'#cfe3f1',roughness:.05,metalness:.1,transparent:true,opacity:.25,depthWrite:false});
function mWindow(g,cx,cy_,w,h){const fm=M.metal('#25272b'),b=.05,dz=-T/2;bx(w,b,T+.02,fm,cx,cy_+h/2-b/2,dz,g);bx(w,b,T+.02,fm,cx,cy_-h/2+b/2,dz,g);bx(b,h,T+.02,fm,cx-w/2+b/2,cy_,dz,g);bx(b,h,T+.02,fm,cx+w/2-b/2,cy_,dz,g);const n=Math.max(1,Math.round(w/1.1));for(let i=1;i<n;i++)bx(.035,h,.05,fm,cx-w/2+i*w/n,cy_,dz,g);add(new THREE.PlaneGeometry(w-.04,h-.04),winGlass,cx,cy_,dz,g,false);if(h>1)rb(w+.14,.035,.22,.01,M.plain('#efede8'),cx,cy_-h/2-.02,.05,g);}
buildWall(sides.back,null,[[3.2,2.92,4.2,.4],[10,2.92,6.4,.4],[17.2,2.92,4.4,.4]]);buildWall(sides.right,[5.0,7.0,2.4]);buildWall(sides.left,null,[[D-2.8,1.75,2.2,1.5]]);buildWall(sides.front,null,[[2.8,2.92,4.2,.4],[10,2.92,6.4,.4],[16.8,2.92,4.4,.4]]);
const glassMat=new THREE.MeshStandardMaterial({color:'#d6e6ee',roughness:.04,metalness:.1,transparent:true,opacity:.2,depthWrite:false});
{ // entrance double door on the right wall (built in the wall's own frame: local x = world z, +z into the room)
  const f=sides.right,a=5.0,b=7.0,fm=M.metal('#25272b');
  bx(.08,2.44,T+.04,fm,a-.04,1.22,-T/2,f);bx(.08,2.44,T+.04,fm,b+.04,1.22,-T/2,f);bx(b-a+.16,.08,T+.04,fm,(a+b)/2,2.44,-T/2,f);
  [[a,-1.1,1],[b,1.1,-1]].forEach(([h,rot,s])=>{const g=grp(h,0,rot,f);doorReg(g,rot,0);const off=s*.5;
    rb(.98,2.36,.05,.01,fm,off,1.18,0,g);add(new THREE.PlaneGeometry(.8,2.16),glassMat,off,1.2,.03,g,false);
    bx(.03,.5,.05,M.metal('#b8bec5'),off+s*.4,1.1,.06,g);});
  rb(.42,.16,.03,.01,M.plain('#1f9a52'),(a+b)/2,2.66,.02,f);bx(.26,.07,.005,std({color:'#ffffff',emissive:'#ffffff',emissiveIntensity:.6}),(a+b)/2,2.66,.036,f);
  rb(1.2,.012,2.0,.004,M.fabric('#3d3a36'),W-.8,.006,6);}

/* ---------- textures specific to the studio ---------- */
{ const [c,x]=cv(256,256);x.fillStyle='#bdbdbd';x.fillRect(0,0,256,256);const n=8,s=256/n;
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){const x0=i*s,y0=j*s,cx=x0+s/2,cy_=y0+s/2;
    [['#ffffff',[x0,y0],[x0+s,y0]],['#7a7a7a',[x0,y0+s],[x0+s,y0+s]],['#d8d8d8',[x0,y0],[x0,y0+s]],['#9a9a9a',[x0+s,y0],[x0+s,y0+s]]].forEach(([cl,a,b])=>{x.fillStyle=cl;x.beginPath();x.moveTo(...a);x.lineTo(...b);x.lineTo(cx,cy_);x.fill();});}
  speck(x,256,256,5000,.1);TX.foam=tex(c,2,2);}
const foamMat=std({color:'#3c3e43',map:TX.foam,bumpMap:TX.foam,bumpScale:.02,roughness:1});
const panelMat=c=>std({color:c,map:TX.fabric,bumpMap:TX.fabric,bumpScale:.004,roughness:.97});
function sheetTex(){const [c,x]=cv(256,340);x.fillStyle='#fbf8f1';x.fillRect(0,0,256,340);x.fillStyle='#222';x.font='bold 16px serif';x.fillText('Étude No. '+(1+Math.floor(rnd()*12)),70,26);
  for(let st=0;st<6;st++){const y0=50+st*48;x.strokeStyle='#333';x.lineWidth=1;for(let l=0;l<5;l++){x.beginPath();x.moveTo(16,y0+l*6);x.lineTo(240,y0+l*6);x.stroke();}
    for(let n=0;n<10;n++){const nx=40+n*20,ny=y0+Math.floor(rnd()*9)*3-3;x.beginPath();x.ellipse(nx,ny,4,3,-.4,0,7);x.fill();x.fillRect(nx+3,ny-16,1.3,16);}
    x.fillRect(120,y0,1,24);}return tex(c);}
const sheetMats=[0,1,2,3].map(()=>std({map:sheetTex(),roughness:.9,side:THREE.DoubleSide}));

/* ---------- builders ---------- */
const legWood=M.wood('#5b3f28'),blackM=M.plastic('#17181a'),steel=M.metal('#2a2c30'),chrome=std({color:'#c9ced4',map:TX.metal,roughness:.25,metalness:.9});
const shellMat=c=>std({color:c,roughness:.42,side:THREE.DoubleSide});
const backGeo=new THREE.CylinderGeometry(.28,.25,.3,28,1,true,Math.PI-.78,1.56);
function chair(x,z,ry,col='#232427',y=0,p=scene){const g=grp(x,z,ry,p,y),m=shellMat(col);seatOn(g,{h:.47,face:1,name:'chair'});
  rb(.46,.035,.44,.016,m,0,.45,.02,g);add(backGeo,m,0,.66,.08,g).rotation.x=-.08;rb(.36,.03,.04,.012,m,0,.81,-.17,g);
  [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([a,b])=>{const l=cy(.011,.015,.46,steel,a*.17,.225,b*.16,g,10);l.rotation.z=-a*.07;l.rotation.x=b*.07;});return g;}
function musicStand(x,z,ry,y=0,p=scene){const g=grp(x,z,ry,p,y);
  for(let i=0;i<3;i++){const a=i/3*Math.PI*2+.5;between([0,.42,0],[Math.cos(a)*.26,0,Math.sin(a)*.26],.008,steel,g);}
  cy(.011,.011,.75,steel,0,.78,0,g,10);
  const d=grp(0,0,0,g,1.15);d.rotation.x=-.42;rb(.5,.34,.012,.004,steel,0,0,0,d);rb(.5,.03,.05,.004,steel,0,-.17,.025,d);
  add(new THREE.PlaneGeometry(.21,.28),sheetMats[Math.floor(rnd()*4)],-.11,.01,.009,d,false);add(new THREE.PlaneGeometry(.21,.28),sheetMats[Math.floor(rnd()*4)],.11,.01,.009,d,false);
  return g;}
// guitar & violin bodies (extruded outlines with sound hole)
function guitarGeo(){if(GC.gtr)return GC.gtr;const s=new THREE.Shape();s.moveTo(0,0);s.bezierCurveTo(.25,0,.26,.24,.135,.3);s.bezierCurveTo(.2,.36,.19,.5,0,.5);s.bezierCurveTo(-.19,.5,-.2,.36,-.135,.3);s.bezierCurveTo(-.26,.24,-.25,0,0,0);
  const h=new THREE.Path();h.absarc(0,.335,.045,0,Math.PI*2,true);s.holes.push(h);
  return GC.gtr=new THREE.ExtrudeGeometry(s,{depth:.08,bevelEnabled:true,bevelThickness:.012,bevelSize:.01,bevelSegments:3,curveSegments:24});}
function violinGeo(){if(GC.vln)return GC.vln;const s=new THREE.Shape();s.moveTo(0,0);s.bezierCurveTo(.11,0,.12,.1,.075,.14);s.bezierCurveTo(.055,.16,.055,.19,.07,.21);s.bezierCurveTo(.11,.25,.1,.355,0,.355);s.bezierCurveTo(-.1,.355,-.11,.25,-.07,.21);s.bezierCurveTo(-.055,.19,-.055,.16,-.075,.14);s.bezierCurveTo(-.12,.1,-.11,0,0,0);
  return GC.vln=new THREE.ExtrudeGeometry(s,{depth:.03,bevelEnabled:true,bevelThickness:.012,bevelSize:.008,bevelSegments:4,curveSegments:24});}
const strMat=new THREE.LineBasicMaterial({color:'#d9d4c8'});
function strings(g,n,y0,y1,z,sp){const pts=[];for(let i=0;i<n;i++){const x=(i-(n-1)/2)*sp;pts.push(new V3(x,y0,z),new V3(x*.75,y1,z));}const ls=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),strMat);g.add(ls);}
const guitarCols=['#d9a35e','#7a3d1d','#c98a4a','#1d1d1f','#e0b77c','#8c4a24','#b5733b'];
function guitar(p,x,y,z,col,rz=0){const g=new THREE.Group();toggleOn(g,{type:'play',instrument:'guitar',name:'guitar'});g.position.set(x,y,z);g.rotation.z=rz;p.add(g);
  const b=new THREE.Mesh(guitarGeo(),std({color:col,map:TX.wood,roughness:.3}));b.castShadow=true;g.add(b);
  cy(.046,.046,.075,M.plain('#120c08'),0,.335,.045,g,24).rotation.x=Math.PI/2;
  add(new THREE.TorusGeometry(.052,.006,6,32),M.plain('#efe4cc'),0,.335,.093,g);
  rb(.13,.022,.014,.005,M.plain('#2a1a10'),0,.13,.095,g);
  rb(.052,.5,.03,.008,M.wood('#6a4428'),0,.74,.06,g);rb(.048,.48,.008,.003,M.plain('#2a1a10'),0,.74,.078,g);
  for(let f=1;f<10;f++)bx(.048,.003,.003,chrome,0,.52+f*.045,.083,g);
  rb(.09,.17,.025,.012,M.plain('#2a1a10'),0,1.065,.06,g);
  [-1,1].forEach(s=>{for(let i=0;i<3;i++){cy(.008,.008,.035,chrome,s*.06,1.02+i*.045,.06,g,8).rotation.z=Math.PI/2;}});
  strings(g,6,.13,1.0,.098,.011);return g;}
function violin(p,x,y,z,rz=0,rx=0){const g=new THREE.Group();toggleOn(g,{type:'play',instrument:'violin',name:'violin'});g.position.set(x,y,z);g.rotation.set(rx,0,rz);p.add(g);
  const b=new THREE.Mesh(violinGeo(),std({color:'#8a3f1c',map:TX.wood,roughness:.25}));b.castShadow=true;g.add(b);
  rb(.025,.15,.018,.006,M.wood('#7a3a19'),0,.42,.035,g);rb(.024,.26,.008,.003,blackM,0,.33,.052,g);
  const sc=add(new THREE.TorusGeometry(.016,.007,8,16,Math.PI*1.6),M.wood('#7a3a19'),0,.52,.035,g);sc.rotation.y=Math.PI/2;
  rb(.06,.012,.008,.003,M.plain('#e9dcc0'),0,.15,.054,g);rb(.05,.04,.02,.008,blackM,-.035,.03,.05,g);
  strings(g,4,.06,.48,.058,.008);return g;}
// digital piano: white keys textured, black keys instanced
const keysTex=(()=>{const [c,x]=cv(1040,64);x.fillStyle='#f7f5f0';x.fillRect(0,0,1040,64);x.fillStyle='#b7b2a8';for(let i=0;i<=52;i++)x.fillRect(i*20,0,1.5,64);return tex(c);})();
function blackKeys(g,L,kw,y,z){const idx=[];for(let i=0;i<51;i++){const n='ABCDEFG'[i%7];if('ACDFG'.includes(n))idx.push(i);}
  const im=new THREE.InstancedMesh(new THREE.BoxGeometry(kw*.58,.018,.09),blackM,idx.length);const m=new THREE.Matrix4();
  idx.forEach((i,k)=>{m.makeTranslation(-L/2+(i+1)*kw,y,z);im.setMatrixAt(k,m);});im.castShadow=true;g.add(im);}
function dpiano(x,z,ry,p=scene,y=0,stand){const g=grp(x,z,ry,p,y);toggleOn(g,{type:'play',instrument:'piano',name:'keyboard'});const L=1.24,kw=L/52;
  if(stand==='x'){between([-.45,0,-.2],[.45,.72,.1],.016,steel,g);between([.45,0,-.2],[-.45,.72,.1],.016,steel,g);between([-.45,0,.1],[.45,.72,-.2],.016,steel,g);between([.45,0,.1],[-.45,.72,-.2],.016,steel,g);
    rb(1.34,.1,.32,.03,blackM,0,.78,-.02,g);}
  else{[-1,1].forEach(s=>rb(.05,.72,.36,.01,blackM,s*.67,.36,-.04,g));rb(1.34,.5,.02,.006,blackM,0,.45,-.2,g);rb(1.4,.12,.4,.02,blackM,0,.78,-.02,g);
    rb(.3,.04,.08,.01,blackM,0,.04,.05,g);[-.06,0,.06].forEach(o=>rb(.04,.015,.08,.006,chrome,o,.07,.08,g));}
  bx(L,.022,.15,new THREE.MeshStandardMaterial({map:keysTex,roughness:.35}),0,.85,.08,g);blackKeys(g,L,kw,.868,.05);
  rb(1.34,.035,.1,.012,blackM,0,.87,-.12,g);
  add(new THREE.PlaneGeometry(.16,.04),std({color:'#0b1622',emissive:'#5bc0ff',emissiveIntensity:.5}),.2,.89,-.069,g,false).rotation.x=-.5;
  for(let i=0;i<6;i++)cy(.008,.008,.01,chrome,-.4+i*.05,.89,-.12,g,10);
  // headphones on a side hook
  const hp=grp(.72,.02,Math.PI/2,g,.75);add(new THREE.TorusGeometry(.085,.012,8,24,Math.PI),blackM,0,0,0,hp);
  [-1,1].forEach(s=>{const e=cy(.04,.04,.03,M.fabric('#2a2a2c'),s*.085,-.02,0,hp,20);e.rotation.z=Math.PI/2;});
  return g;}
function bench(x,z,ry,p=scene,y=0){const g=grp(x,z,ry,p,y);seatOn(g,{h:.54,face:-1,name:'piano bench'});rb(.62,.07,.32,.03,M.fabric('#1d1d1f'),0,.5,0,g);
  [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([a,b])=>cy(.018,.014,.46,steel,a*.26,.23,b*.12,g,10));between([-.26,.12,0],[.26,.12,0],.008,steel,g);return g;}
// electronic drum kit, drummer sits at +z
function drumKit(x,z,ry,p=scene,y=0){const g=grp(x,z,ry,p,y);toggleOn(g,{type:'play',instrument:'drums',name:'drum kit'});const pad=std({color:'#202124',roughness:.95,map:TX.fabric}),rim=M.plastic('#2f3135');
  [-.6,.6].forEach(sx=>{cy(.02,.02,1.05,steel,sx,.52,-.15,g,12);between([sx,0,-.15],[sx,0,.1],.02,steel,g);});
  between([-.6,.95,-.15],[.6,.95,-.15],.02,steel,g);between([-.6,.7,-.15],[-.6,.7,.25],.018,steel,g);between([.6,.7,-.15],[.6,.7,.25],.018,steel,g);
  const drum=(dx,dy,dz,r,tilt,ty=0)=>{const q=grp(dx,dz,ty,g,dy);q.rotation.x=tilt;cy(r,r,.06,rim,0,0,0,q,32);cy(r*.94,r*.94,.005,pad,0,.032,0,q,32);return q;};
  drum(-.3,.62,.15,.17,.2);drum(-.22,.98,-.12,.14,.45);drum(.2,.98,-.12,.14,.45);drum(.5,.68,.2,.16,.25);
  rb(.28,.42,.18,.03,rim,0,.24,-.2,g);cy(.1,.1,.02,pad,0,.28,-.11,g,24).rotation.x=Math.PI/2;
  rb(.12,.02,.26,.01,steel,0,.02,.06,g);rb(.12,.02,.26,.01,steel,-.55,.02,.18,g);
  const cym=(cx,cyy,cz,r,tilt)=>{cy(.008,.008,cyy,steel,cx,cyy/2,cz,g,8);const c=lathe([[0,.025],[.04,.02],[r,0],[r,-.006],[.04,.012],[0,.017]],std({color:'#1b1c1e',roughness:.8,side:THREE.DoubleSide}),cx,cyy+.01,cz,g,40);c.rotation.x=tilt;return c;};
  cym(-.62,.95,.25,.17,.1);cym(-.7,1.3,-.35,.2,.3);cym(.75,1.25,-.25,.22,.25);cym(.15,1.4,-.45,.18,.35);
  rb(.24,.14,.05,.02,M.plastic('#2b2d31'),-.6,1.08,-.08,g).rotation.x=-.4;add(new THREE.PlaneGeometry(.1,.05),std({color:'#05121c',emissive:'#4fd1c5',emissiveIntensity:.6}),-.6,1.095,-.052,g,false).rotation.x=-.4;
  const st=grp(0,.62,0,g);seatOn(st,{h:.62,face:-1,name:'drum stool'});cy(.19,.19,.08,M.fabric('#1d1d1f'),0,.56,0,st,28);cy(.02,.02,.45,steel,0,.3,0,st,10);
  for(let i=0;i<3;i++){const a=i/3*Math.PI*2;between([0,.12,0],[Math.cos(a)*.26,0,Math.sin(a)*.26],.012,steel,st);}
  [[-.1,.04],[.1,-.04]].forEach(([dx,r])=>{const s=cy(.006,.008,.4,M.wood('#d8b98a'),dx,.68,.3,g,8);s.rotation.set(1.2,0,r);});
  return g;}
function amp(x,z,ry,p=scene,y=0){const g=grp(x,z,ry,p,y);rb(.5,.42,.26,.02,blackM,0,.21,0,g);rb(.44,.3,.01,.01,M.fabric('#2c2c2e'),0,.18,.13,g);rb(.46,.06,.01,.005,M.plastic('#c9a26b'),0,.38,.13,g);
  for(let i=0;i<5;i++)cy(.012,.012,.02,M.plain('#e9e9e9'),-.16+i*.07,.38,.14,g,10).rotation.x=Math.PI/2;return g;}
function pouf(x,z,r,h,col){const pts=[[0,0],[r-.05,0],[r,.04],[r+.01,h*.5],[r,h-.06],[r-.06,h],[0,h]];const o=lathe(pts,M.fabric(col),x,0,z,scene,48);seatOn(o,{h,face:0,name:'pouf'});
  cy(r*.25,r*.25,.006,M.fabric(shade(col,-.08)),x,h+.002,z,scene,20);return o;}
function acoustic(g,cx,cyy,w,h,col){rb(w,h,.06,.02,panelMat(col),cx,cyy,.03,g);}

/* ---------- raised platforms (quarter ellipses) ---------- */
function platform(cx,cz,rx,rz,sz,col){const s=new THREE.Shape(),N=40,pts=[];
  for(let i=0;i<=N;i++){const t=i/N*Math.PI/2;pts.push([cx+rx*Math.cos(t),cz+sz*rz*Math.sin(t)]);}
  s.moveTo(cx,-cz);pts.forEach(([x,z])=>s.lineTo(x,-z));s.lineTo(cx,-cz);
  const m=add(new THREE.ExtrudeGeometry(s,{depth:.28,bevelEnabled:true,bevelThickness:.015,bevelSize:.015,bevelSegments:2,curveSegments:24}),std({color:col,map:TX.wood,bumpMap:TX.wood,bumpScale:.002,roughness:.5}),0,0,0);
  m.rotation.x=-Math.PI/2;m.userData.step=true;
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x,z])=>new V3(x,.29,z))),120,.018,6,false),ledMat,0,0,0,scene,false);
  return m;}
platform(0,0,6,4.2,1,'#b98a5a');
platform(0,D,5.5,4.5,-1,'#b98a5a');
const PY=.295;

/* ---------- VIOLIN AREA ---------- */
{ const g=sides.back;acoustic(g,2.9,1.85,5.0,1.6,'#5a4a3c');
  for(let i=0;i<4;i++){const x=1.1+i*1.2;cy(.01,.01,.08,chrome,x,2.42,.04,g,8).rotation.x=Math.PI/2;violin(g,x,1.9,.075,0,0);
    const bw=grp(x+.25,.1,0,g,1.9);cy(.004,.004,.72,M.wood('#5a2e14'),0,.36,0,bw,6);}
  [[1.6,2.4,-.15],[3.0,2.2,.05],[4.5,1.5,.25]].forEach(([x,z,r])=>{musicStand(x,z,r,PY);chair(x,z+.85,Math.PI+r,'#232427',PY);});
  const s=grp(5.15,.9,-.4,scene,PY);for(let i=0;i<3;i++){const a=i/3*Math.PI*2;between([0,.25,0],[Math.cos(a)*.14,0,Math.sin(a)*.14],.006,steel,s);}
  cy(.008,.008,.3,steel,0,.32,0,s,8);rb(.18,.02,.06,.01,steel,0,.46,.02,s);violin(s,0,.47,0,0,-.15);}

/* ---------- GUITAR AREA ---------- */
{ const g=sides.left;acoustic(g,D-9.8,1.95,4.4,1.9,'#4a3d33');
  for(let i=0;i<5;i++){const lx=D-11.4+i*.8;rb(.06,.06,.08,.01,M.wood('#3a2c22'),lx,2.36,.05,g);guitar(g,lx,PY+1.12,.09,guitarCols[i%guitarCols.length],0);}
  [[1.8,9.0],[2.6,10.0],[3.1,11.1]].forEach(([x,z],i)=>chair(x,z,-Math.PI/2+(i-1)*.15,'#232427',PY));
  amp(.9,8.3,Math.PI/2+.4,scene,PY);
  const st=grp(4.0,10.6,-.9,scene,PY);for(let i=0;i<3;i++){const a=i/3*Math.PI*2;between([0,.02,0],[Math.cos(a)*.2,.02,Math.sin(a)*.2],.01,steel,st);}cy(.01,.01,.6,steel,0,.32,-.05,st,8);
  guitar(st,0,.05,0,'#1d1d1f',0).rotation.x=-.18;}

/* ---------- LEFT WALL MEDIA CORNER ---------- */
{ const g=sides.left,lx=D-6;const [c,x]=cv(512,288);x.fillStyle='#14161b';x.fillRect(0,0,512,288);x.fillStyle='#d9a46a';x.font='bold 30px sans-serif';x.fillText('Practice schedule',28,52);
  const rows=[['09:00','Violin ensemble'],['11:00','Piano lab'],['13:30','Guitar circle'],['15:00','Drum workshop']];x.font='22px sans-serif';rows.forEach(([t,n],i)=>{x.fillStyle='#8a8f98';x.fillText(t,28,100+i*44);x.fillStyle='#ece7e1';x.fillText(n,120,100+i*44);});
  rb(1.5,.86,.05,.012,blackM,lx,1.7,.03,g);add(new THREE.PlaneGeometry(1.44,.8),new THREE.MeshBasicMaterial({map:tex(c)}),lx,1.7,.057,g,false);
  const cr=grp(.3,6,Math.PI/2);rb(1.8,.55,.46,.02,M.wood('#2f2621'),0,.36,0,cr);[-1,0,1].forEach(s=>rb(.56,.42,.02,.008,M.wood('#3d322b'),s*.59,.36,.235,cr));
  [[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([a,b])=>cy(.015,.012,.08,steel,a*.8,.04,b*.18,cr,8));
  [-.68,.68].forEach(s=>{rb(.16,.28,.18,.02,blackM,s,.78,0,cr);cy(.05,.05,.01,M.plain('#3a3d42'),s,.8,.091,cr,20).rotation.x=Math.PI/2;});}

/* ---------- PRACTICE BOOTHS (group booths on the back wall face the individual booths on the front wall) ---------- */
const BH=2.5,frameM=M.metal('#202226');
function glassRun(g,L,doorAt){const n=Math.max(2,Math.round(L/1.3)),p=L/n;
  for(let i=0;i<=n;i++)rb(.06,BH,.08,.008,frameM,i*p,BH/2,0,g);
  rb(L+.06,.08,.1,.01,frameM,L/2,BH-.04,0,g);rb(L+.06,.06,.1,.01,frameM,L/2,.03,0,g);
  for(let i=0;i<n;i++){const cx=(i+.5)*p;const gp=add(new THREE.PlaneGeometry(p-.06,BH-.14),glassMat,cx,BH/2,0,g,false);
    if(i===doorAt){gp.userData.door=true;rb(.035,.6,.05,.015,chrome,cx+p/2-.18,1.05,.06,g);rb(.035,.6,.05,.015,chrome,cx+p/2-.18,1.05,-.06,g);bx(p-.08,.02,.012,frameM,cx,2.1,.03,g);}}}
function booth(x0,z0,x1,z1,glass){const g=grp(0,0),t=.09;g.userData.cc=true;
  bx(x1-x0-.06,.02,z1-z0-.06,M.fabric('#34363a'),(x0+x1)/2,.01,(z0+z1)/2,g).castShadow=false;
  const sw=(cx,cz,w,d)=>rb(w,BH,d,.012,foamMat,cx,BH/2,cz,g);
  sw(x0+t/2,(z0+z1)/2,t,z1-z0);sw(x1-t/2,(z0+z1)/2,t,z1-z0);
  if(glass==='front'){sw((x0+x1)/2,z0+t/2,x1-x0,t);glassRun(grp(x0,z1,0,g),x1-x0,1);bx(x1-x0-.3,.03,.04,ledMat,(x0+x1)/2,BH-.1,z0+.12,g);}
  else{sw((x0+x1)/2,z1-t/2,x1-x0,t);glassRun(grp(x0,z0,0,g),x1-x0,0);bx(x1-x0-.3,.03,.04,ledMat,(x0+x1)/2,BH-.1,z1-.12,g);}
  regLamp(g,lampLight(g,(x0+x1)/2,BH-.3,(z0+z1)/2,0xffe2b0,4.5,1.1),null,'booth light',1.1);return g;}
// group booths, back wall
booth(6.4,.12,9.9,3.4,'front');booth(10.1,.12,13.6,3.4,'front');
dpiano(7.4,.95,0);bench(7.4,1.7,0);musicStand(9.0,2.2,0);chair(9.0,2.95,Math.PI);plant('snake',9.45,.55,.75,'#2f3237');
drumKit(11.85,1.5,0);amp(10.6,.55,.3);amp(13.1,.55,-.3);
// individual booths, front wall, glass facing the group booths
[[6.1,8.7],[8.8,11.4],[11.5,14.1]].forEach(([a,b],i)=>{booth(a,9.0,b,11.88,'back');const cx=(a+b)/2;
  if(i!==1){dpiano(cx,11.45,Math.PI);bench(cx,10.7,Math.PI);if(i===2)violin(scene,b-.35,1.25,11.8,0,0).rotation.y=Math.PI;}
  else{const tb=grp(cx,11.45,Math.PI);rb(1.3,.04,.6,.012,M.wood('#b98a5a'),0,.75,0,tb);[[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([s,t])=>cy(.02,.02,.73,steel,s*.6,.365,t*.25,tb,10));
    rb(.33,.016,.23,.006,M.metal('#a9b0b8'),.35,.78,-.05,tb);musicStand(cx-.4,10.95,Math.PI);chair(cx,10.35,0);
    guitar(scene,a+.32,.05,11.7,guitarCols[2],0).rotation.set(.12,Math.PI,0);}});

/* ---------- grand piano ---------- */
const gloss=std({color:'#0e0e10',roughness:.14,metalness:.15});
function grandShape(){const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(1.5,0);s.lineTo(1.5,.45);s.bezierCurveTo(1.5,.85,1.0,.85,.9,1.25);s.bezierCurveTo(.8,1.75,.45,1.82,.12,1.82);s.lineTo(0,1.82);s.lineTo(0,0);return s;}
function grand(x,z,ry){const g=grp(x,z,ry);toggleOn(g,{type:'play',instrument:'grand',name:'grand piano'});
  const body=add(new THREE.ExtrudeGeometry(grandShape(),{depth:.3,bevelEnabled:true,bevelThickness:.01,bevelSize:.01,bevelSegments:2,curveSegments:24}),gloss,0,.64,0,g);body.rotation.x=-Math.PI/2;
  const inner=add(new THREE.ExtrudeGeometry(grandShape(),{depth:.01,bevelEnabled:false,curveSegments:24}),M.wood('#c9a36a'),0,.9,0,g,false);inner.rotation.x=-Math.PI/2;inner.scale.set(.96,.96,1);inner.position.set(.03,.9,-.03);
  for(let i=0;i<14;i++)between([.15+i*.08,.915,-.25],[.25+i*.06,.915,-1.35+i*.02*(i>8?3:0)],.0015,chrome,g);
  const piv=grp(0,0,0,g,.95);piv.rotation.z=.5;const lid=add(new THREE.ExtrudeGeometry(grandShape(),{depth:.02,bevelEnabled:false,curveSegments:24}),gloss,0,0,0,piv);lid.rotation.x=-Math.PI/2;
  between([1.42,.95,-.7],[1.42*Math.cos(.5)-.0,.95+1.42*Math.sin(.5)-.02,-.7],.008,gloss,g);
  bx(1.24,.022,.16,new THREE.MeshStandardMaterial({map:keysTex,roughness:.35}),.75,.74,.08,g);blackKeys(g,1.24,1.24/52,.758,.05);
  [-.0,1.5].forEach(sx=>rb(.06,.14,.2,.01,gloss,sx===0?.06:1.44,.73,.07,g));rb(1.5,.06,.06,.01,gloss,.75,.66,.15,g);
  const desk=rb(.8,.3,.02,.008,gloss,.75,1.08,-.22,g);desk.rotation.x=-.25;add(new THREE.PlaneGeometry(.22,.28),sheetMats[1],.63,1.08,-.205,g,false).rotation.x=-.25;add(new THREE.PlaneGeometry(.22,.28),sheetMats[2],.87,1.08,-.205,g,false).rotation.x=-.25;
  [[.15,-.12],[1.35,-.12],[.7,-1.55]].forEach(([lx,lz])=>{cy(.05,.04,.62,gloss,lx,.31,lz,g,16);cy(.04,.04,.04,chrome,lx,.02,lz,g,12);});
  rb(.22,.42,.04,.01,gloss,.75,.25,-.1,g);rb(.3,.04,.12,.01,gloss,.75,.04,-.05,g);[-.05,0,.05].forEach(o=>rb(.03,.012,.09,.005,chrome,.75+o,.07,.02,g));
  return g;}

/* ---------- PIANO CORNER (back-right) ---------- */
{ const [c,x]=cv(256,512);x.fillStyle='#2b2724';x.fillRect(0,0,256,512);speck(x,256,512,4000,.08);x.strokeStyle='#c9a26b';x.lineWidth=10;x.lineCap='round';
  x.beginPath();x.moveTo(140,470);x.bezierCurveTo(100,470,100,420,140,420);x.lineTo(140,60);x.bezierCurveTo(140,20,200,40,180,100);x.bezierCurveTo(160,160,70,200,70,280);x.bezierCurveTo(70,360,200,370,200,290);x.bezierCurveTo(200,230,110,230,115,300);x.stroke();
  const clef=std({map:tex(c),roughness:.9});
  const [c2,x2]=cv(512,512);x2.fillStyle='#d8cfc0';x2.fillRect(0,0,512,512);for(let i=0;i<512;i+=32){x2.fillStyle='rgba(90,75,55,.12)';x2.fillRect(i,0,14,512);}x2.strokeStyle='#b7a88f';x2.lineWidth=16;x2.strokeRect(8,8,496,496);speck(x2,512,512,12000,.1);
  bx(5.4,.014,4.7,new THREE.MeshStandardMaterial({map:tex(c2),roughness:1}),17.25,.007,2.5).castShadow=false;
  [15.2,16.8,18.4].forEach(px=>{dpiano(px,.55,0);bench(px,1.3,0);acoustic(sides.back,px,1.95,1.4,1.05,'#3a3532');add(new THREE.PlaneGeometry(.34,.68),clef,px,1.95,.062,sides.back,false);});
  [2.5,4.0].forEach(pz=>{dpiano(19.45,pz,-Math.PI/2);bench(18.72,pz,-Math.PI/2);acoustic(sides.right,pz,1.95,1.3,1.05,'#3a3532');});
  grand(15.6,2.05,-Math.PI/2);bench(14.85,2.8,-Math.PI/2);}

/* ---------- DRUMS CORNER (front-right) ---------- */
{ const [c,x]=cv(512,360);x.fillStyle='#38393c';x.fillRect(0,0,512,360);for(let y=0;y<360;y+=6){x.fillStyle='rgba(0,0,0,.12)';x.fillRect(0,y,512,2);}speck(x,512,360,12000,.12);
  x.strokeStyle='#55575b';x.lineWidth=10;x.strokeRect(5,5,502,350);
  bx(5.6,.016,3.9,new THREE.MeshStandardMaterial({map:tex(c),roughness:1}),17.1,.008,9.98).castShadow=false;
  [15.25,17.15,19.0].forEach(px=>drumKit(px,10.45,0));
  amp(14.6,8.5,-.6);amp(19.5,8.4,.5);
  const g=sides.front;[W-15.25,W-17.15,W-19.0].forEach(lx=>acoustic(g,lx,1.9,1.5,1.05,'#2c2d30'));
  const rack=grp(16.2,8.45,0);rb(.9,.6,.4,.02,M.wood('#2f2621'),0,.3,0,rack);for(let i=0;i<4;i++){const p=cy(.008,.01,.4,M.wood('#d8b98a'),-.3+i*.05,.62,0,rack,8);p.rotation.z=Math.PI/2;}
  cy(.18,.18,.12,std({color:'#c9c1b4',roughness:.6}),.22,.66,0,rack,28);}

/* ---------- LOUNGE ---------- */
{ const [c,x]=cv(512,512);x.fillStyle='#c9c1b4';x.beginPath();x.arc(256,256,254,0,7);x.fill();for(let r=40;r<250;r+=24){x.strokeStyle='rgba(90,80,65,.12)';x.lineWidth=6;x.beginPath();x.arc(256,256,r,0,7);x.stroke();}speck(x,512,512,15000,.1);
  const t=tex(c);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
  const rg=add(new THREE.CircleGeometry(1.9,64),new THREE.MeshStandardMaterial({map:t,transparent:true,roughness:1}),10,.005,6.15,scene,false);rg.rotation.x=-Math.PI/2;
  [[8.8,5.4,.42,.42,'#4a4d52'],[10.4,4.85,.36,.4,'#5b5e64'],[11.35,6.15,.44,.42,'#45484d'],[8.9,6.95,.38,.4,'#cdbb9f'],[10.5,7.35,.46,.42,'#3f4247']].forEach(a=>pouf(...a));
  const ct=grp(9.95,6.15);lathe([[0,0],[.26,0],[.28,.02],[.28,.36],[.26,.38],[0,.38]],M.wood('#a77749'),0,0,0,ct,48);
  plant('succ',0,0,1.2,'#efe9df',ct,.38);rb(.22,.02,.3,.004,sheetMats[0],-.1,.39,-.04,ct).rotation.y=.4;}

/* ---------- floor plants (walls and corners) ---------- */
[['snake',14.05,.5,.75,'#efe9df'],['snake',5.8,11.6,.8,'#2f3237'],['snake',19.45,7.45,.85,'#c97b4f'],
 ['fiddle',.55,4.7,1.0,'#efe9df'],['snake',.45,7.35,.85,'#c97b4f'],['palm',19.3,4.7+.0001,0,'#fff']
].filter(p=>p[3]>0).forEach(([t,x,z,s,c])=>plant(t,x,z,s,c));


/* ---------- outside: sky, grass, trees, campus; inside: ceiling, roof, ceiling lights ---------- */
function buildEnv(o){
  const cx=W/2,cz=D/2,big=Math.max(W,D);
  function skyTex(eve){const [c,x]=cv(1024,512);const g=x.createLinearGradient(0,0,0,512);
    if(eve){g.addColorStop(0,'#0c1430');g.addColorStop(.38,'#27315c');g.addColorStop(.47,'#7d5670');g.addColorStop(.5,'#e7976a');g.addColorStop(.52,'#5b4840');g.addColorStop(1,'#2c2a26');}
    else{g.addColorStop(0,'#3f7fc9');g.addColorStop(.36,'#8dbbe6');g.addColorStop(.49,'#e2edf3');g.addColorStop(.52,'#c9d3c2');g.addColorStop(1,'#b8c2ae');}
    x.fillStyle=g;x.fillRect(0,0,1024,512);
    if(eve){for(let i=0;i<260;i++){x.fillStyle='rgba(255,255,255,'+(.3+rnd()*.6)+')';x.fillRect(rnd()*1024,rnd()*190,1.2,1.2);}}
    else{for(let k=0;k<26;k++){const px=rnd()*1024,py=60+rnd()*150,s=20+rnd()*45;for(let j=0;j<7;j++){const ox=px+(j-3)*s*.55+rr(-8,8),oy=py+rr(-s*.18,s*.18),r=s*(.45+rnd()*.4);
      const gr=x.createRadialGradient(ox,oy,0,ox,oy,r);gr.addColorStop(0,'rgba(255,255,255,.75)');gr.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=gr;x.beginPath();x.arc(ox,oy,r,0,7);x.fill();}}}
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;}
  const dayT=skyTex(false),eveT=skyTex(true);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(160,40,24),new THREE.MeshBasicMaterial({map:dayT,side:THREE.BackSide,depthWrite:false,fog:false}));
  sky.position.set(cx,-8,cz);sky.renderOrder=-1;sky.userData.noCollide=true;scene.add(sky);
  {const [c,x]=cv(256,256);x.fillStyle='#6f9a4f';x.fillRect(0,0,256,256);for(let i=0;i<9000;i++){x.fillStyle=['#5f8b44','#7aa85a','#648f47','#86b064'][i%4];x.fillRect(rnd()*256,rnd()*256,1.5,2.5);}
    const t=tex(c,90,90);const g=add(new THREE.PlaneGeometry(320,320),std({color:'#ffffff',map:t,roughness:1}),cx,-.03,cz,scene,false);g.rotation.x=-Math.PI/2;}
  const pv=(()=>{const [c,x]=cv(256,256);x.fillStyle='#bdb7ad';x.fillRect(0,0,256,256);x.strokeStyle='#a39d93';x.lineWidth=3;
    for(let y=0;y<256;y+=32){x.beginPath();x.moveTo(0,y);x.lineTo(256,y);x.stroke();for(let px=((y/32)%2)*32;px<256;px+=64){x.beginPath();x.moveTo(px,y);x.lineTo(px,y+32);x.stroke();}}speck(x,256,256,6000,.1);return tex(c,1,1);})();
  const dx=o.door.dir[0],dz=o.door.dir[1];
  {const len=34,p=add(new THREE.PlaneGeometry(dx?len:2.4,dx?2.4:len),std({color:'#ffffff',map:pv,roughness:.95}),o.door.x+dx*len/2,-.02,o.door.z+dz*len/2,scene,false);p.rotation.x=-Math.PI/2;
    p.material.map=pv.clone();p.material.map.needsUpdate=true;p.material.map.repeat.set(dx?len/2:1.2,dx?1.2:len/2);}
  const trunk=std({color:'#6b5038',roughness:.95});
  const fol=['#3f7a37','#4c8a3e','#5c9a45','#3a6e33'].map(c=>std({color:c,roughness:.85,flatShading:true}));
  const icoGeo=new THREE.IcosahedronGeometry(1,1);
  function tree(x,z,s,near){const g=grp(x,z,rnd()*6);g.userData.noCollide=true;const tr=cy(.11*s,.17*s,2.4*s,trunk,0,1.2*s,0,g,8);tr.castShadow=near;
    const n=3+Math.floor(rnd()*3);for(let i=0;i<n;i++){const m=new THREE.Mesh(icoGeo,fol[(i+Math.floor(x))%4&3]);const r=(.9+rnd()*.7)*s;m.scale.set(r,r*(.85+rnd()*.3),r);
      m.position.set(rr(-.7,.7)*s,(2.5+rnd()*1.3)*s,rr(-.7,.7)*s);m.castShadow=near;m.receiveShadow=true;g.add(m);}return g;}
  function onPath(x,z){if(dz)return Math.abs(x-o.door.x)<3.2&&z>D;return Math.abs(z-o.door.z)<3.2&&x>W;}
  let made=0,tries=0;while(made<54&&tries<400){tries++;const a=rnd()*Math.PI*2,r=big*.62+5+Math.pow(rnd(),.8)*48;const x=cx+Math.cos(a)*r*1.1,z=cz+Math.sin(a)*r;
    if(onPath(x,z)||(x>-4&&x<W+4&&z>-4&&z<D+4))continue;tree(x,z,.85+rnd()*.7,r<big*.6+16);made++;}
  for(let i=0;i<22;i++){const sd=Math.floor(rnd()*4),t=rnd();let x,z;if(sd===0){x=t*W;z=-1.1;}else if(sd===1){x=W+1.1;z=t*D;}else if(sd===2){x=t*W;z=D+1.1;}else{x=-1.1;z=t*D;}
    if(onPath(x,z)||(dz&&Math.abs(x-o.door.x)<2&&z>D)||(dx&&Math.abs(z-o.door.z)<2&&x>W))continue;
    const b=new THREE.Mesh(icoGeo,fol[i%4]);const r=.45+rnd()*.35;b.scale.set(r*1.2,r,r);b.position.set(x,r*.7,z);b.castShadow=true;b.userData.noCollide=true;scene.add(b);}
  {const [c,x]=cv(256,256);x.fillStyle='#d9d2c6';x.fillRect(0,0,256,256);for(let y=10;y<256;y+=32)for(let px=8;px<256;px+=24){x.fillStyle=rnd()<.25?'#f3dca0':'#4c5a68';x.fillRect(px,y,14,18);}
    const bt=tex(c,1,1),cols=['#d9d2c6','#cbbfae','#e2ddd3','#b9a58c'];
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2+rnd()*.4,r=78+rnd()*30,bw=14+rnd()*14,bh=8+rnd()*12,bd=10+rnd()*8;
      const m=new THREE.MeshStandardMaterial({color:cols[i%4],map:bt.clone(),roughness:.9});m.map.needsUpdate=true;m.map.repeat.set(bw/8,bh/8);
      const b=add(new THREE.BoxGeometry(bw,bh,bd),m,cx+Math.cos(a)*r,bh/2,cz+Math.sin(a)*r,scene,false);b.rotation.y=-a+Math.PI/2;b.userData.noCollide=true;}}
  const postHeads=[];const headMat=std({color:'#fff4d6',emissive:'#ffcf7a',emissiveIntensity:.1});
  for(let i=0;i<4;i++){const d=9+i*7.5,px=o.door.x+dx*d+(dz?1.8:0),pz=o.door.z+dz*d+(dx?1.8:0);const g=grp(px,pz);g.userData.noCollide=true;
    cy(.05,.07,3.2,M.metal('#2b2d30'),0,1.6,0,g,10);sp(.16,headMat,0,3.3,0,g);cy(.2,.2,.04,M.metal('#2b2d30'),0,3.44,0,g,16);}
  /* ceiling + roof */
  const roof=new THREE.Group();roof.userData.roof=true;scene.add(roof);
  const [cc,cx2]=cv(256,256);cx2.fillStyle='#f3f1ec';cx2.fillRect(0,0,256,256);speck(cx2,256,256,5000,.05);cx2.strokeStyle='#d3cec5';cx2.lineWidth=3;
  for(let i=0;i<=256;i+=128){cx2.beginPath();cx2.moveTo(i,0);cx2.lineTo(i,256);cx2.stroke();cx2.beginPath();cx2.moveTo(0,i);cx2.lineTo(256,i);cx2.stroke();}
  const ceil=add(new THREE.PlaneGeometry(W,D),std({color:'#ffffff',map:tex(cc,W/1.2,D/1.2),roughness:.95}),cx,H-.004,cz,roof,true);ceil.rotation.x=Math.PI/2;
  bx(W+2*T+.5,.26,D+2*T+.5,std({color:'#77716a',roughness:.92}),cx,H+.13,cz,roof);
  [[W+2*T+.5,.32,.12,cx,-T-.19],[W+2*T+.5,.32,.12,cx,D+T+.19],[.12,.32,D+2*T+.5,-T-.19,cz],[.12,.32,D+2*T+.5,W+T+.19,cz]].forEach(([a,b,c,x,z])=>bx(a,b,c,std({color:'#8a837b',roughness:.9}),x,H+.42,z,roof));
  rb(1.4,.7,1.0,.04,M.metal('#b9bec4'),W*.7,H+.61,D*.3,roof);rb(.9,.5,.9,.04,M.metal('#a9aeb4'),W*.25,H+.51,D*.65,roof);
  const panelMat=std({color:'#ffffff',emissive:'#fff3dd',emissiveIntensity:1,roughness:.4});const cl=[];
  o.ceil.forEach(([x,z])=>{rb(.66,.02,.66,.005,M.plain('#dcd8d0'),x,H-.012,z,roof);rb(.58,.012,.58,.004,panelMat,x,H-.022,z,roof);
    const l=new THREE.PointLight(0xfff2dc,0,o.reach||7,2);l.position.set(x,H-.4,z);scene.add(l);cl.push(l);});
  const ceilT={type:'switch',name:'ceiling lights',on:true,set(on){this.on=on;cl.forEach(l=>l.intensity=on?(o.pow||.6):0);panelMat.emissiveIntensity=on?1:.02;}};ceilT.set(true);
  const sw=rb(.085,.13,.018,.004,M.plain('#f6f5f2'),o.sw.lx,o.sw.y,.012,sides[o.sw.side]);bx(.03,.055,.012,M.plain('#e3e1dc'),o.sw.lx,o.sw.y,.024,sides[o.sw.side]).userData.part=1;toggleOn(sw,ceilT);
  return {roof,ceilT,setEve(e){sky.material.map=e?eveT:dayT;headMat.emissiveIntensity=e?2.2:.1;}};
}

const ENV=buildEnv({ceil:[[3.5,3.2],[10,3.2],[16.5,3.2],[3.5,8.8],[10,8.8],[16.5,8.8],[10,6]],pow:.65,reach:8,sw:{side:'right',lx:4.55,y:1.15},door:{x:W,z:6,dir:[1,0]}});
const zones=[
 {id:'violin',name:'Violin corner',sub:'raised platform',color:'#b98a5a',cx:3.0,cz:2.0,area:'19.8',ly:2.8},
 {id:'piano',name:'Piano corner',sub:'grand + 5 keyboards',color:'#d8cfc0',cx:17.2,cz:2.5,area:'25.4',ly:2.2},
 {id:'guitar',name:'Guitar corner',sub:'raised platform',color:'#c49a6c',cx:2.4,cz:9.9,area:'19.4',ly:2.6},
 {id:'drums',name:'Drums corner',sub:'3 electronic kits',color:'#38393c',cx:17.1,cz:10.0,area:'21.8',ly:2.0},
 {id:'group',name:'Group practice booths',sub:'keyboard + drums',color:'#3c3e43',cx:10.0,cz:1.8,area:'23.0',ly:3.0},
 {id:'solo',name:'Individual booths',sub:'≈ 3 m × 3 m each',color:'#7b8088',cx:10.1,cz:10.4,area:'22.2',ly:3.0},
 {id:'lounge',name:'Lounge',sub:'poufs',color:'#c9c1b4',cx:10.0,cz:6.15,area:'11.3',ly:1.2}
];
function setLight(eve){hemi.intensity=eve?.18:.72;hemi.color.set(eve?'#8fa0c8':'#ffffff');fill.intensity=eve?.06:.25;sun.intensity=eve?0:.9;
  lamps.forEach(l=>{if(!l.userData.reg)l.intensity=eve?l.userData.on:0;});LAMPS.forEach(t=>t.set(eve));ENV.setEve(eve);bulbMat.emissiveIntensity=eve?2.2:.3;ledMat.emissiveIntensity=eve?2.4:.5;}
return {W,D,H,T,sides,setLight,sun,inter:INTER,anim:ANIM,roof:ENV.roof,spawn:{x:18.7,z:6.0,yaw:Math.PI/2},
  zones:zones.map(z=>({name:z.name,sub:z.sub,color:z.color,area:z.area,pos:[z.cx,z.ly,z.cz]}))};
}
