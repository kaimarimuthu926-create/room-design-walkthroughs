(function(){
'use strict';
const V3=THREE.Vector3,V2=THREE.Vector2;
const $=id=>document.getElementById(id);
const stage=$('stage'),canvas=$('c');
const coarse=matchMedia('(pointer: coarse)').matches;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const CFG=window.SITE_CONFIG||{};
const IN_CLAUDE=!!(window.claude&&window.claude.use);
const MODE=IN_CLAUDE?'artifact':(CFG.repo?'github':'local');
const store={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};

const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
const camera=new THREE.PerspectiveCamera(42,1,.05,600);camera.rotation.order='YXZ';
const controls=new THREE.OrbitControls(camera,canvas);
controls.enableDamping=true;controls.maxPolarAngle=Math.PI/2-.03;controls.minDistance=.8;controls.maxDistance=90;

/* ---------- designs ---------- */
const D1={key:'relax',zones:[
 {id:'relax',name:'Relaxation',color:'#6f8a52',x0:.85,x1:6.0,z0:.5,z1:4.85,lx:5.3,lz:2.0},
 {id:'game',name:'TV and gaming',color:'#4f7fbf',x0:7.0,x1:9.85,z0:2.0,z1:5.0,lx:8.3,lz:4.8},
 {id:'social',name:'Eating / study',color:'#d9b98a',x0:2.0,x1:4.4,z0:5.6,z1:7.9,norug:true,lx:3.2,lz:6.1}]};
const D2={key:'zones',zones:[
 {id:'relax',name:'Relaxation',color:'#6f8a52',x0:0.85,x1:5.25,z0:0.6,z1:3.85,lx:4.4,lz:1.9},
 {id:'game',name:'Gaming',color:'#4f7fbf',x0:6.5,x1:9.85,z0:0.15,z1:3.3,lx:8.15,lz:2.9},
 {id:'social',name:'Social / eating',color:'#d9b98a',x0:4.9,x1:9.3,z0:3.85,z1:6.9,lx:7.1,lz:6.55},
 {id:'study',name:'Study',color:'#8f86ad',x0:0.8,x1:4.0,z0:4.85,z1:7.95,lx:3.55,lz:6.3},
 {id:'store',name:'Storage',color:'#4a4d52',x0:6.4,x1:9.85,z0:7.0,z1:7.95,lx:9.15,lz:7.2}]};
const D3={key:'flex',zones:[
 {id:'relax',name:'Lounge',color:'#6f8a52',x0:.8,x1:4.4,z0:.55,z1:3.4,lx:3.7,lz:2.9},
 {id:'game',name:'Gaming',color:'#4f7fbf',circle:true,cx:8.3,cz:3.5,r:1.35,lx:8.3,lz:4.7},
 {id:'open',name:'Open central space',color:'#b9ad9c',x0:4.7,x1:6.6,z0:.9,z1:3.0,norug:true,lx:5.7,lz:3.1},
 {id:'social',name:'Moveable tables',color:'#d9b98a',x0:.9,x1:6.5,z0:3.7,z1:7.4,norug:true,lx:3.2,lz:5.6},
 {id:'store',name:'Storage units',color:'#4a4d52',x0:6.45,x1:9.75,z0:7.15,z1:7.98,lx:8.1,lz:7.3}]};
const planOf=d=>d.zones.map(z=>z.circle?{c:[z.cx,z.cz,z.r],col:z.color}:{r:[z.x0,z.z0,z.x1,z.z1],col:z.color,dash:z.norug});
const SPACES=[{key:'common',folder:'common-room',name:'Student common room',sub:'10 × 8 m'},{key:'music',folder:'music-studio',name:'Music practice studio',sub:'20 × 12 m'}];
const BUILTIN=[
 {id:'common-1',space:'common',title:'Design 1',sub:'Relaxation focus',kind:'3d',W:10,D:8,plan:planOf(D1),build:s=>buildCommon(s,renderer,D1)},
 {id:'common-2',space:'common',title:'Design 2',sub:'Activity zones · final design',kind:'3d',W:10,D:8,plan:planOf(D2),build:s=>buildCommon(s,renderer,D2)},
 {id:'common-3',space:'common',title:'Design 3',sub:'Flexible layout',kind:'3d',W:10,D:8,plan:planOf(D3),build:s=>buildCommon(s,renderer,D3)},
 {id:'music-1',space:'music',title:'Studio layout',sub:'Instrument corners and booths',kind:'3d',W:20,D:12,
  plan:[{c:[0,0,5],col:'#b98a5a'},{c:[0,12,5],col:'#c49a6c'},{r:[14.5,.2,19.9,4.8],col:'#d8cfc0'},{r:[14.4,8.1,19.9,11.9],col:'#38393c'},{r:[6.4,.1,13.6,3.4],col:'#3c3e43'},{r:[6.1,9,14.1,11.9],col:'#7b8088'},{c:[10,6.15,1.9],col:'#c9c1b4'}],
  build:s=>buildMusic(s,renderer)}];
const DEFAULT='common-2';
let uploads=[],locals=[],canEdit=false,assets=null,db=null,dataReady=false,pendingId=null;
function allItems(){return BUILTIN.concat(uploads,locals);}
function byId(id){return allItems().find(i=>i.id===id);}
function spaceList(){const out=SPACES.slice();uploads.concat(locals).forEach(u=>{if(!out.find(s=>s.key===u.space))out.push({key:u.space,folder:u.space.replace(/^x-/,''),name:u.spaceName||'Other space',sub:'',custom:true});});return out;}
function spaceOf(key){return spaceList().find(s=>s.key===key)||{key,name:'',folder:key.replace(/^x-/,'')};}
function slug(s){return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'space';}

/* ---------- index ---------- */
const NS='http://www.w3.org/2000/svg';
function thumbFor(item){const box=document.createElement('span');box.className='thumb';
  if(item.kind==='image'){const im=document.createElement('img');im.alt='';im.loading='lazy';im.src=item.url;box.appendChild(im);return box;}
  const svg=document.createElementNS(NS,'svg');
  if(item.kind==='model'){svg.setAttribute('viewBox','0 0 34 26');svg.innerHTML='<path d="M17 3 L29 9 L29 19 L17 25 L5 19 L5 9 Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 9 L17 15 L29 9 M17 15 L17 25" fill="none" stroke="currentColor" stroke-width="1.6"/>';box.style.color='var(--accent)';box.appendChild(svg);return box;}
  svg.setAttribute('viewBox','0 0 '+item.W+' '+item.D);
  const el=(t,a)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);svg.appendChild(e);return e;};
  el('rect',{width:item.W,height:item.D,fill:'#d9bb92'});
  item.plan.forEach(p=>{const e=p.c?el('circle',{cx:p.c[0],cy:p.c[1],r:p.c[2]}):el('rect',{x:p.r[0],y:p.r[1],width:p.r[2]-p.r[0],height:p.r[3]-p.r[1]});e.setAttribute('fill',p.col);if(p.dash)e.setAttribute('opacity','.45');});
  el('rect',{width:item.W,height:item.D,fill:'none',stroke:'#3a2c22','stroke-width':item.W/22});
  box.appendChild(svg);return box;}
function renderList(){const nav=$('list');nav.textContent='';
  spaceList().forEach(sp=>{const items=allItems().filter(i=>i.space===sp.key);if(!items.length&&sp.custom)return;
    const sec=document.createElement('section');sec.className='space';
    const h=document.createElement('h2');h.textContent=sp.name;if(sp.sub){const s=document.createElement('span');s.textContent=sp.sub;h.appendChild(s);}sec.appendChild(h);
    const ul=document.createElement('ul');
    items.forEach(it=>{const li=document.createElement('li');li.className='row';
      const b=document.createElement('button');b.className='item';b.dataset.id=it.id;
      const tx=document.createElement('span');tx.style.minWidth='0';const t=document.createElement('b');t.textContent=it.title;const s=document.createElement('small');s.textContent=it.sub;tx.append(t,s);
      const tag=document.createElement('span');tag.className='tag';tag.textContent=it.local?'Preview':it.kind==='image'?'Board':it.kind==='model'?'Model':'3D walk';
      b.append(thumbFor(it),tx,tag);b.onclick=()=>{openItem(it);closeSide();};li.appendChild(b);
      if(it.docId&&canEdit&&db){const del=document.createElement('button');del.className='del';del.textContent='Delete';del.setAttribute('aria-label','Delete '+it.title);del.onclick=e=>{e.stopPropagation();askDelete(li,it);};li.appendChild(del);}
      ul.appendChild(li);});
    sec.appendChild(ul);nav.appendChild(sec);});
  markActive();}
function askDelete(li,it){if(li.querySelector('.confirm'))return;const c=document.createElement('div');c.className='confirm';
  const msg=document.createElement('span');msg.textContent='Delete "'+it.title+'" for everyone?';
  const yes=document.createElement('button');yes.className='btn danger small';yes.textContent='Delete';
  const no=document.createElement('button');no.className='btn small';no.textContent='Keep';no.onclick=()=>c.remove();
  yes.onclick=async()=>{yes.disabled=true;try{await db.doc('designs/'+it.docId).delete();if(assets&&it.assetId)assets.delete(it.assetId).catch(()=>{});toast('Deleted "'+it.title+'"');}catch(e){yes.disabled=false;toast('Could not delete this design. Check that you have edit access.');}};
  c.append(msg,yes,no);li.appendChild(c);no.focus();}
function markActive(id){id=id||(boardOpen&&boardOpen.id)||(cur&&cur.item.id);document.querySelectorAll('.item').forEach(b=>b.dataset.id===id?b.setAttribute('aria-current','true'):b.removeAttribute('aria-current'));}
const side=$('side');
function closeSide(){side.classList.remove('open');}
$('btn-menu').onclick=()=>side.classList.add('open');$('close-side').onclick=closeSide;

let toastT=0;function toast(msg){const t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,4000);}
function showLoading(msg){$('loading-text').textContent=msg;$('loading').hidden=false;}
function hideLoading(){$('loading').hidden=true;}

/* ---------- scene lifecycle ---------- */
let cur=null,mode='overview',eve=false,labelsOn=true,boardOpen=null;
function stageColor(){return getComputedStyle(document.documentElement).getPropertyValue('--stage').trim()||'#e2ded7';}
function setBg(){if(cur)cur.scene.background=new THREE.Color(stageColor());}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',setBg);
new MutationObserver(setBg).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
function disposeScene(scene){const seen=new Set();scene.traverse(o=>{if(o.geometry&&!seen.has(o.geometry)){seen.add(o.geometry);o.geometry.dispose();}
  const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];ms.forEach(m=>{if(seen.has(m))return;seen.add(m);for(const k in m){const v=m[k];if(v&&v.isTexture&&!seen.has(v)){seen.add(v);v.dispose();}}m.dispose();});});}
let loadToken=0;
async function openItem(item){
  if(!item)return;
  if(item.kind==='image'){openBoard(item);setHash(item.id);return;}
  closeBoard(true);
  if(cur&&cur.item.id===item.id){setHash(item.id);return;}
  const tok=++loadToken;stand(true);
  showLoading(item.kind==='model'?'Loading the 3D model':'Building '+item.title.toLowerCase());
  await new Promise(r=>setTimeout(r,50));
  let scene,info;
  try{if(item.kind==='model'){const r=await buildModel(item);scene=r.scene;info=r.info;}else{scene=new THREE.Scene();info=item.build(scene);}}
  catch(e){console.error(e);if(tok!==loadToken)return;toast(item.kind==='model'?'This model could not be opened. Try exporting it again as a .glb file.':'This design could not be built.');
    if(cur)hideLoading();else openItem(byId(DEFAULT));return;}
  if(tok!==loadToken){disposeScene(scene);return;}
  if(cur){clearOverlays();disposeScene(cur.scene);}
  cur={item,scene,info};scene.background=new THREE.Color(stageColor());
  if(innerWidth<700&&info.sun)info.sun.shadow.mapSize.set(1024,1024);
  prepPhysics();buildOverlays();renderZones();buildMinimap();
  $('now-title').textContent=item.title+(item.sub?' · '+item.sub:'');
  $('now-sub').textContent=spaceOf(item.space).name+' · '+info.W.toFixed(1)+' × '+info.D.toFixed(1)+' m · '+(info.W*info.D).toFixed(0)+' m²';
  info.setLight(eve);markActive();
  setMode(mode,true);hideLoading();setHash(item.id);
}

/* ---------- uploaded and previewed models ---------- */
function b64ToBytes(b64){const s=atob(b64),n=s.length,u=new Uint8Array(n);for(let i=0;i<n;i++)u[i]=s.charCodeAt(i);return u;}
function bytesToB64(u8){let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s);}
function jsonToGlb(json){json=JSON.parse(JSON.stringify(json));let bin=null;
  if(json.buffers&&json.buffers.length){if(json.buffers.length>1)throw new Error('multi-buffer');const u=json.buffers[0].uri;
    if(u){if(!u.startsWith('data:'))throw new Error('external buffer');bin=b64ToBytes(u.slice(u.indexOf(',')+1));delete json.buffers[0].uri;json.buffers[0].byteLength=bin.length;}}
  const js=new TextEncoder().encode(JSON.stringify(json)),jp=(4-js.length%4)%4,bp=bin?(4-bin.length%4)%4:0;
  const total=12+8+js.length+jp+(bin?8+bin.length+bp:0),ab=new ArrayBuffer(total),dv=new DataView(ab),u8=new Uint8Array(ab);
  dv.setUint32(0,0x46546C67,true);dv.setUint32(4,2,true);dv.setUint32(8,total,true);
  dv.setUint32(12,js.length+jp,true);dv.setUint32(16,0x4E4F534A,true);u8.set(js,20);for(let i=0;i<jp;i++)u8[20+js.length+i]=0x20;
  if(bin){const o=20+js.length+jp;dv.setUint32(o,bin.length+bp,true);dv.setUint32(o+4,0x004E4942,true);u8.set(bin,o+8);}return ab;}
function glbToJson(ab){const dv=new DataView(ab);if(ab.byteLength<20||dv.getUint32(0,true)!==0x46546C67)throw new Error('This file is not a .glb model.');
  let off=12,json=null,bin=null;while(off+8<=ab.byteLength){const len=dv.getUint32(off,true),type=dv.getUint32(off+4,true);const chunk=new Uint8Array(ab,off+8,len);
    if(type===0x4E4F534A)json=JSON.parse(new TextDecoder().decode(chunk));else if(type===0x004E4942)bin=chunk;off+=8+len;}
  if(!json)throw new Error('This file is not a .glb model.');
  if(bin){json.buffers=json.buffers&&json.buffers.length?json.buffers:[{byteLength:bin.length}];json.buffers[0].uri='data:application/octet-stream;base64,'+bytesToB64(bin);}return json;}
function checkModel(json){if(!json||!json.asset)throw new Error('This file is not a glTF 3D model.');
  if((json.extensionsRequired||[]).some(e=>/draco|meshopt/i.test(e)))throw new Error('This model is compressed (Draco or Meshopt). Export it again with compression turned off.');}
function checkSingleFile(json){if((json.buffers||[]).length>1||(json.buffers||[]).some(b=>b.uri&&!b.uri.startsWith('data:'))||(json.images||[]).some(i=>i.uri&&!i.uri.startsWith('data:')))
  throw new Error('This .gltf points to separate files. Export it as a single .glb file instead.');}
async function modelData(item){
  if(item.local)return {data:item.data,path:''};
  const res=await fetch(item.url);if(!res.ok)throw new Error('fetch '+res.status);
  if(item.store==='artifact')return {data:jsonToGlb(await res.json()),path:''};
  if(/\.gltf$/i.test(item.path||''))return {data:await res.text(),path:item.url.slice(0,item.url.lastIndexOf('/')+1)};
  return {data:await res.arrayBuffer(),path:''};}
async function buildModel(item){
  const {data,path}=await modelData(item);
  const gltf=await new Promise((ok,err)=>new THREE.GLTFLoader().parse(data,path,ok,err));
  const scene=new THREE.Scene(),root=gltf.scene;
  root.scale.setScalar({m:1,cm:.01,mm:.001,in:.0254,ft:.3048}[item.units]||1);root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(root);if(box.isEmpty())throw new Error('empty model');
  root.position.sub(box.min);root.updateMatrixWorld(true);
  const size=box.getSize(new V3());root.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;}});scene.add(root);
  const s=Math.max(size.x,size.z,4);
  const hemi=new THREE.HemisphereLight(0xffffff,0xb5a58c,.8);scene.add(hemi);
  const fill=new THREE.DirectionalLight(0xdfe8ff,.3);fill.position.set(-s,s,s*1.4);scene.add(fill);
  const sun=new THREE.DirectionalLight(0xfff1dc,.9);sun.position.set(size.x/2+s*.8,s*1.3,size.z/2-s*.5);sun.target.position.set(size.x/2,0,size.z/2);scene.add(sun.target);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-s,right:s,top:s,bottom:-s,near:.5,far:s*4});sun.shadow.bias=-.0004;sun.shadow.normalBias=.02;scene.add(sun);
  const lamp=new THREE.PointLight(0xffd9a0,0,s*1.5,2);lamp.position.set(size.x/2,Math.max(2.2,size.y*.85),size.z/2);scene.add(lamp);
  const g=new THREE.Mesh(new THREE.PlaneGeometry(s*10,s*10),new THREE.MeshStandardMaterial({color:'#9fb98a',roughness:1}));g.rotation.x=-Math.PI/2;g.position.set(size.x/2,-.004,size.z/2);g.receiveShadow=true;scene.add(g);
  function setLight(e){hemi.intensity=e?.2:.8;fill.intensity=e?.05:.3;sun.intensity=e?0:.9;lamp.intensity=e?1.6:0;}
  return {scene,info:{W:size.x,D:size.z,H:size.y,T:0,isModel:true,model:root,sides:null,zones:[],inter:[],anim:[],setLight,spawn:{x:size.x/2,z:size.z/2,yaw:0}}};}

/* ---------- labels & dimensions ---------- */
let overlays=[];
function clearOverlays(){overlays.forEach(o=>o.el.remove());overlays=[];}
function buildOverlays(){clearOverlays();const i=cur.info;
  i.zones.forEach(z=>{const d=document.createElement('div');d.className='lbl';d.textContent=z.name;const s=document.createElement('small');s.textContent=(z.sub?z.sub+' · ':'')+z.area+' m²';d.appendChild(s);stage.appendChild(d);overlays.push({el:d,p:z.pos});});
  const T=i.T||0,W=i.W,D=i.D,H=i.H,s=Math.max(W,D),k=s/12,dm=new THREE.MeshBasicMaterial({color:'#2a2622'}),grp=new THREE.Group();grp.userData.dims=true;cur.scene.add(grp);cur.dims=grp;
  const between=(a,b,r)=>{const A=new V3(...a),B=new V3(...b),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,A.distanceTo(B),8),dm);m.position.copy(A).add(B).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new V3(0,1,0),B.clone().sub(A).normalize());grp.add(m);};
  const line=(a,b,off)=>{const A=new V3(...a).add(off),B=new V3(...b).add(off),dir=B.clone().sub(A).normalize();between(A.toArray(),B.toArray(),.012*k);
    [[A,dir.clone().negate()],[B,dir]].forEach(([P,d])=>{const c=new THREE.Mesh(new THREE.ConeGeometry(.07*k,.25*k,12),dm);c.position.copy(P).addScaledVector(d,-.12*k);c.quaternion.setFromUnitVectors(new V3(0,1,0),d);grp.add(c);});};
  const o=.9*k;
  line([-T,.04,D+T],[W+T,.04,D+T],new V3(0,0,o));line([-T,.04,-T],[-T,.04,D+T],new V3(-o,0,0));line([-T,0,D+T],[-T,H,D+T],new V3(-o*.55,0,o*.55));
  [[W.toFixed(1)+' m',[W/2,.06,D+T+o]],[D.toFixed(1)+' m',[-T-o,.06,D/2]],[H.toFixed(1)+' m high',[-T-o*.55,H/2,D+T+o*.55]]].forEach(([t,p])=>{const d=document.createElement('div');d.className='dim';d.textContent=t;stage.appendChild(d);overlays.push({el:d,p});});}
function renderZones(){const ul=$('zones');ul.textContent='';const zs=cur.info.zones;$('b-zones').hidden=!zs.length;if(!zs.length)togglePop(false);
  zs.forEach(z=>{const li=document.createElement('li'),b=document.createElement('button');const sw=document.createElement('span');sw.className='sw';sw.style.background=z.color;
    const n=document.createElement('span');n.textContent=z.name;const a=document.createElement('span');a.className='area';a.textContent=z.area+' m²';b.append(sw,n,a);b.onclick=()=>{togglePop(false);focusZone(z);};li.appendChild(b);ul.appendChild(li);});}
function togglePop(on){$('zones-pop').hidden=!on;$('b-zones').setAttribute('aria-expanded',on);if(on)$('help').hidden=true;}
$('b-zones').onclick=()=>togglePop($('zones-pop').hidden);
$('b-labels').onclick=()=>{labelsOn=!labelsOn;stage.classList.toggle('labels-off',!labelsOn);$('b-labels').setAttribute('aria-pressed',labelsOn);if(cur&&cur.dims)cur.dims.visible=labelsOn&&mode!=='walk';};

/* ---------- physics ---------- */
const R=.22,EYE=1.62,ray=new THREE.Raycaster();
const P={x:0,z:0,floor:0,yaw:0,pitch:0,vx:0,vz:0,bob:0};
let colliders=[],steps=[],seated=null,seatPrev=null;
function prepPhysics(){colliders=[];steps=[];const i=cur.info,sideSet=new Set(i.sides?Object.values(i.sides):[]);
  if(i.isModel){steps=[i.model];return;}
  const push=o=>{const b=new THREE.Box3().setFromObject(o);if(b.isEmpty())return;
    if(b.max.y-b.min.y<.08&&b.max.y<.12)return;if(b.min.y>1.55||b.max.y<.2)return;if(b.max.x-b.min.x>8||b.max.z-b.min.z>8)return;
    colliders.push({x0:b.min.x,x1:b.max.x,z0:b.min.z,z1:b.max.z,y0:b.min.y,y1:b.max.y});};
  const deep=o=>{if(o.isLight||o.userData.door||o.userData.noCollide)return;if(o.isMesh)push(o);o.children.forEach(deep);};
  cur.scene.children.forEach(o=>{if(sideSet.has(o)||o.isLight||o.userData.dims||o.userData.roof||o.userData.noCollide)return;if(o.userData.step){steps.push(o);return;}if(o.userData.cc){o.children.forEach(deep);return;}push(o);});}
function floorAt(x,z,from){if(!steps.length)return 0;ray.layers.set(0);ray.set(new V3(x,from,z),new V3(0,-1,0));ray.far=from+5;
  const hits=ray.intersectObjects(steps,true);const lim=P.floor+.45;for(const h of hits){if(h.point.y<=lim)return h.point.y;}return cur.info.isModel?(hits.length?P.floor:0):0;}
function blockedAt(x,z){const lo=P.floor+.25,hi=P.floor+1.5;for(const c of colliders){if(c.y0<hi&&c.y1>lo&&x>c.x0-R&&x<c.x1+R&&z>c.z0-R&&z<c.z1+R)return true;}return false;}
function rayBlocked(dx,dz){const len=Math.hypot(dx,dz);if(!len)return false;const dir=new V3(dx/len,0,dz/len);
  for(const h of [.35,1.3]){ray.set(new V3(P.x,P.floor+h,P.z),dir);ray.far=R+len;if(ray.intersectObject(cur.info.model,true).length)return true;}return false;}
function bounds(){const i=cur.info;return i.isModel?[-3,i.W+3,-3,i.D+3]:[R,i.W-R,R,i.D-R];}
function tryMove(dx,dz){const [x0,x1,z0,z1]=bounds();const nx=Math.min(x1,Math.max(x0,P.x+dx)),nz=Math.min(z1,Math.max(z0,P.z+dz));
  if(cur.info.isModel){if(rayBlocked(nx-P.x,nz-P.z))return false;}else if(blockedAt(nx,nz)&&!blockedAt(P.x,P.z))return false;
  P.x=nx;P.z=nz;return true;}
function freeSpotNear(x,z){if(cur.info.isModel)return [x,z];for(let r=0;r<=1.2;r+=.15)for(let a=0;a<Math.PI*2;a+=Math.PI/8){const px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;const [x0,x1,z0,z1]=bounds();
  if(px<x0||px>x1||pz<z0||pz>z1)continue;if(!blockedAt(px,pz))return [px,pz];if(r===0)break;}return null;}

/* ---------- input ---------- */
const keys={};
function inField(t){return t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT');}
function modalOpen(){return !$('board').hidden||!$('upload').hidden;}
addEventListener('keydown',e=>{if(inField(e.target)||modalOpen())return;const k=e.key.toLowerCase();
  if(mode==='walk'){if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(k)){keys[k]=true;if(k.startsWith('arrow'))e.preventDefault();}
    if(k==='e'&&!e.repeat){if(seated&&!aim)stand();else if(aim)activate(aim);}}});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});
const joy={x:0,y:0,id:null};
(function(){const el=$('joy'),kn=$('knob');
  const upd=e=>{const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy;const m=r.width/2-12,l=Math.hypot(dx,dy);if(l>m){dx*=m/l;dy*=m/l;}joy.x=dx/m;joy.y=dy/m;kn.style.transform='translate('+dx+'px,'+dy+'px)';};
  el.addEventListener('pointerdown',e=>{e.stopPropagation();joy.id=e.pointerId;el.setPointerCapture(e.pointerId);upd(e);});
  el.addEventListener('pointermove',e=>{if(e.pointerId===joy.id)upd(e);});
  const end=e=>{if(e.pointerId!==joy.id)return;joy.id=null;joy.x=joy.y=0;kn.style.transform='';};
  el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);})();
let locked=false,lockOK=!coarse&&'requestPointerLock' in canvas;
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;updateHud();});
document.addEventListener('pointerlockerror',()=>{lockOK=false;updateHud();});
document.addEventListener('mousemove',e=>{if(!locked||mode!=='walk')return;P.yaw-=e.movementX*.0022;P.pitch=Math.max(-1.35,Math.min(1.35,P.pitch-e.movementY*.0022));});
function requestLock(){try{const r=canvas.requestPointerLock();if(r&&r.catch)r.catch(()=>{lockOK=false;updateHud();});}catch(e){lockOK=false;updateHud();}}
let down=null,mouse=null;
canvas.addEventListener('pointerdown',e=>{down={id:e.pointerId,x:e.clientX,y:e.clientY,lx:e.clientX,ly:e.clientY,t:performance.now(),moved:0};
  if(mode==='walk'&&!locked){canvas.setPointerCapture(e.pointerId);}});
canvas.addEventListener('pointermove',e=>{mouse={x:e.clientX,y:e.clientY};if(!down||e.pointerId!==down.id)return;
  const dx=e.clientX-down.lx,dy=e.clientY-down.ly;down.lx=e.clientX;down.ly=e.clientY;down.moved+=Math.abs(dx)+Math.abs(dy);
  if(mode==='walk'&&!locked){const k=e.pointerType==='touch'?.006:.004;P.yaw+=dx*k;P.pitch=Math.max(-1.35,Math.min(1.35,P.pitch+dy*k));}});
canvas.addEventListener('pointerleave',()=>{mouse=null;});
canvas.addEventListener('pointerup',e=>{if(!down||e.pointerId!==down.id)return;const click=down.moved<8&&performance.now()-down.t<600;down=null;if(!click||!cur)return;
  if(mode==='walk'){if(locked){if(aim)activate(aim);else if(seated)stand();return;}
    if(lockOK&&!coarse){requestLock();return;}
    const t=pickAt(e.clientX,e.clientY,3);if(t)activate(t);return;}
  const t=pickAt(e.clientX,e.clientY,400);if(t)activate(t);});

/* ---------- interaction ---------- */
let aim=null,aimT=0;
function owner(o){while(o){if(o.userData&&(o.userData.seat||o.userData.toggle))return o;o=o.parent;}return null;}
function pick(ndc,far){if(!cur)return null;ray.layers.set(0);ray.setFromCamera(ndc,camera);ray.near=0;ray.far=far;const hits=ray.intersectObject(cur.scene,true);
  for(const h of hits){const m=h.object.material;if(m&&m.transparent&&m.opacity<.6)continue;if(h.object.userData.dims||h.object.parent&&h.object.parent.userData.dims)return null;const o=owner(h.object);return o?{obj:o,point:h.point}:null;}return null;}
function pickAt(cx,cy,far){const r=canvas.getBoundingClientRect();return pick(new V2((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1),far);}
function labelFor(t){if(!t)return '';const u=t.obj.userData;if(u.seat)return 'Sit on the '+u.seat.name;const g=u.toggle;
  if(g.type==='play')return 'Play the '+g.name;if(g.type==='door')return (g.on?'Close':'Open')+' the '+g.name;return 'Turn '+(g.on?'off':'on')+' the '+g.name;}
function activate(t){const u=t.obj.userData;
  if(u.seat){if(mode!=='walk')setMode('walk',true);sit(t.obj,t.point);return;}
  const g=u.toggle;if(g.type==='play'){playInstrument(g.instrument);toast('Playing the '+g.name);return;}
  g.set(!g.on);if(g.type==='door')toast(g.on?'Doors opened':'Doors closed');else toast((g.on?'Turned on the ':'Turned off the ')+g.name);aim=null;}
function sit(obj,point){const s=obj.userData.seat;obj.updateMatrixWorld(true);
  let lx=0;if(s.spots&&point){const lp=obj.worldToLocal(point.clone());lx=s.spots.reduce((a,b)=>Math.abs(b-lp.x)<Math.abs(a-lp.x)?b:a,s.spots[0]);}
  const dz=s.dz||0,base=obj.localToWorld(new V3(lx,0,dz));let yaw=P.yaw;
  if(s.face){const f=obj.localToWorld(new V3(lx,0,dz+s.face)).sub(base);yaw=Math.atan2(-f.x,-f.z);}
  if(!seated)seatPrev={x:P.x,z:P.z,floor:P.floor};
  seated={eye:base.y+s.h+.72,name:s.name};P.x=base.x;P.z=base.z;P.yaw=yaw;P.pitch=-.12;P.vx=P.vz=0;aim=null;updateHud();toast('Sitting on the '+s.name+'. Move or press E to stand up.');}
function stand(silent){if(!seated)return;seated=null;if(seatPrev){P.x=seatPrev.x;P.z=seatPrev.z;P.floor=seatPrev.floor;}updateHud();}

/* ---------- sound ---------- */
let AC=null,chordI=0;
function ac(){if(!AC){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;AC=new C();}if(AC.state==='suspended')AC.resume();return AC;}
function note(c,f,t,dur,type,vol){const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.008);g.gain.exponentialRampToValueAtTime(.0008,t+dur);o.connect(g).connect(c.destination);o.start(t);o.stop(t+dur+.05);}
function noise(c,t,dur,hp,vol){const b=c.createBuffer(1,Math.floor(c.sampleRate*dur),c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=b;f.type='highpass';f.frequency.value=hp;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f).connect(g).connect(c.destination);s.start(t);}
function pluck(c,f,t,vol){const sr=c.sampleRate,n=Math.floor(sr*1.8),N=Math.max(2,Math.round(sr/f)),b=c.createBuffer(1,n,sr),d=b.getChannelData(0);
  for(let i=0;i<N;i++)d[i]=Math.random()*2-1;for(let i=N;i<n;i++)d[i]=.996*.5*(d[i-N]+d[i-N+1]);
  const s=c.createBufferSource(),g=c.createGain();g.gain.value=vol;s.buffer=b;s.connect(g).connect(c.destination);s.start(t);}
function playInstrument(kind){const c=ac();if(!c)return;const t=c.currentTime+.02;
  const chords=[[261.6,329.6,392,523.3],[349.2,440,523.3,698.5],[392,493.9,587.3,784],[220,261.6,329.6,440]];
  if(kind==='piano'||kind==='grand'){const ch=chords[chordI++%4];ch.forEach((f,i)=>{note(c,f,t+i*.06,kind==='grand'?2.6:1.8,'triangle',.16);note(c,f*2,t+i*.06,1.2,'sine',.05);});note(c,ch[0]/2,t,2.4,'sine',.12);}
  else if(kind==='drums'){for(let i=0;i<8;i++){const tt=t+i*.18;if(i%4===0||i===5){const o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(140,tt);o.frequency.exponentialRampToValueAtTime(45,tt+.25);g.gain.setValueAtTime(.7,tt);g.gain.exponentialRampToValueAtTime(.001,tt+.3);o.connect(g).connect(c.destination);o.start(tt);o.stop(tt+.32);}
    if(i%4===2){noise(c,tt,.18,1200,.45);note(c,190,tt,.12,'triangle',.2);}noise(c,tt,.04,7000,.14);}}
  else if(kind==='guitar'){[98,123.5,146.8,196,246.9,392].forEach((f,i)=>pluck(c,f,t+i*.03,.25));}
  else if(kind==='violin'){[[440,0],[523.3,.7],[659.3,1.4]].forEach(([f,d])=>{const o=c.createOscillator(),lp=c.createBiquadFilter(),g=c.createGain(),lfo=c.createOscillator(),lg=c.createGain();
    o.type='sawtooth';o.frequency.value=f;lfo.frequency.value=5.6;lg.gain.value=f*.006;lfo.connect(lg).connect(o.frequency);lp.type='lowpass';lp.frequency.value=2600;
    const s=t+d;g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(.09,s+.18);g.gain.setValueAtTime(.09,s+.55);g.gain.linearRampToValueAtTime(0,s+.8);
    o.connect(lp).connect(g).connect(c.destination);o.start(s);lfo.start(s);o.stop(s+.85);lfo.stop(s+.85);});}}

/* ---------- walking ---------- */
function walkStep(dt){
  let f=0,s=0,turn=0;
  if(keys.w||keys.arrowup)f+=1;if(keys.s||keys.arrowdown)f-=1;if(keys.d)s+=1;if(keys.a)s-=1;if(keys.arrowleft)turn+=1;if(keys.arrowright)turn-=1;
  f-=joy.y;s+=joy.x;P.yaw+=turn*1.9*dt;
  const l=Math.hypot(f,s);if(l>1){f/=l;s/=l;}
  if(seated){if(l>.25)stand();else{camera.position.set(P.x,seated.eye,P.z);camera.rotation.set(P.pitch,P.yaw,0);return;}}
  const speed=keys.shift?3.0:1.45,sy=Math.sin(P.yaw),cy=Math.cos(P.yaw);
  const tx=(-sy*f+cy*s)*speed,tz=(-cy*f-sy*s)*speed,acc=Math.min(1,dt*(l>.02?9:12));
  P.vx+=(tx-P.vx)*acc;P.vz+=(tz-P.vz)*acc;
  if(Math.abs(P.vx)+Math.abs(P.vz)>.01){if(!tryMove(P.vx*dt,0))P.vx=0;if(!tryMove(0,P.vz*dt))P.vz=0;}
  const sp=Math.hypot(P.vx,P.vz);P.bob+=sp*dt*5.5;
  const fl=floorAt(P.x,P.z,P.floor+1.2);P.floor+=(fl-P.floor)*Math.min(1,dt*12);
  const bob=reduce?0:Math.sin(P.bob)*.025*Math.min(1,sp/1.4);
  camera.position.set(P.x,P.floor+EYE+bob,P.z);camera.rotation.set(P.pitch,P.yaw,0);}

/* ---------- minimap ---------- */
const mm=$('mm'),mctx=mm.getContext('2d');let mmBase=null,mmScale=1,mmPad=6;
function buildMinimap(){const i=cur.info,W=i.W,D=i.D;const maxW=coarse?150:180,maxH=coarse?120:150;mmScale=Math.min((maxW-2*mmPad)/W,(maxH-2*mmPad)/D);
  const w=Math.round(W*mmScale+2*mmPad),h=Math.round(D*mmScale+2*mmPad),dpr=Math.min(2,devicePixelRatio);
  mm.width=w*dpr;mm.height=h*dpr;mm.style.width=w+'px';mm.style.height=h+'px';
  const c=document.createElement('canvas');c.width=mm.width;c.height=mm.height;const x=c.getContext('2d');x.scale(dpr,dpr);
  x.fillStyle=i.isModel?'#cfd8c4':'#e3c9a2';x.fillRect(mmPad,mmPad,W*mmScale,D*mmScale);
  i.zones.forEach(z=>{if(z.rect){x.fillStyle=z.color;x.globalAlpha=.35;x.fillRect(mmPad+z.rect[0]*mmScale,mmPad+z.rect[1]*mmScale,(z.rect[2]-z.rect[0])*mmScale,(z.rect[3]-z.rect[1])*mmScale);x.globalAlpha=1;}});
  x.fillStyle='rgba(60,42,28,.55)';colliders.forEach(b=>{if(b.y1<.25)return;x.fillRect(mmPad+b.x0*mmScale,mmPad+b.z0*mmScale,Math.max(1,(b.x1-b.x0)*mmScale),Math.max(1,(b.z1-b.z0)*mmScale));});
  x.strokeStyle='#2a2622';x.lineWidth=2.5;x.strokeRect(mmPad,mmPad,W*mmScale,D*mmScale);mmBase={c,dpr,w,h};}
function drawMinimap(){if(!mmBase)return;const {c,dpr,w,h}=mmBase;mctx.setTransform(1,0,0,1,0,0);mctx.clearRect(0,0,mm.width,mm.height);mctx.drawImage(c,0,0);mctx.setTransform(dpr,0,0,dpr,0,0);
  const px=mmPad+P.x*mmScale,pz=mmPad+P.z*mmScale,fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw);
  mctx.fillStyle='rgba(135,86,42,.28)';mctx.beginPath();mctx.moveTo(px,pz);const a0=Math.atan2(fz,fx);mctx.arc(px,pz,26,a0-.55,a0+.55);mctx.closePath();mctx.fill();
  mctx.fillStyle='#87562a';mctx.strokeStyle='#fff';mctx.lineWidth=2;mctx.beginPath();mctx.arc(px,pz,5,0,7);mctx.fill();mctx.stroke();}
mm.addEventListener('click',e=>{if(!cur||mode!=='walk')return;const r=mm.getBoundingClientRect();const x=(e.clientX-r.left-mmPad)/mmScale,z=(e.clientY-r.top-mmPad)/mmScale;
  const spot=freeSpotNear(x,z);if(!spot){toast('Something is in the way there. Try a nearby spot.');return;}stand(true);seated=null;P.x=spot[0];P.z=spot[1];P.vx=P.vz=0;P.floor=floorAt(P.x,P.z,P.floor+1.2);updateHud();});

/* ---------- modes & HUD ---------- */
let anim=null;
function flyTo(p,t){anim={p0:camera.position.clone(),t0:controls.target.clone(),p1:new V3(...p),t1:new V3(...t),s:performance.now(),dur:reduce?1:950};}
function views(){const i=cur.info,W=i.W,D=i.D,s=Math.max(W,D,4);return {overview:[[W/2+s*.45,s*.75+i.H*.3,D+s*.72],[W/2,0,D/2]],plan:[[W/2,s*1.45+i.H,D/2+.01],[W/2,0,D/2]]};}
function helpItems(){return coarse?[['Left stick','Walk'],['Drag the view','Look around'],['Tap something','Sit on it, switch it on or off, or play it'],['Big button','Uses whatever you are looking at'],['Map','Tap to move there']]
  :[['Click the view','Look around with the mouse (Esc to stop)'],['W A S D','Walk · arrow keys also work'],['Shift','Walk faster'],['E or click','Sit on a seat, switch a lamp, TV or door, play an instrument'],['Map','Click to move there']];}
function renderHelp(){const ul=$('help-list');ul.textContent='';helpItems().forEach(([k,v])=>{const li=document.createElement('li');const a=document.createElement('span');
  const parts=/^[A-Z](?: [A-Z])+$/.test(k)?k.split(' '):[k];parts.forEach(p=>{const kb=document.createElement('kbd');kb.textContent=p;a.appendChild(kb);});
  const b=document.createElement('span');b.textContent=v;li.append(a,b);ul.appendChild(li);});}
function showHelp(on){$('help').hidden=!on;if(on){togglePop(false);renderHelp();}}
$('help-ok').onclick=()=>{showHelp(false);store.set('rw-help','1');canvas.focus({preventScroll:true});};
$('b-help').onclick=()=>showHelp($('help').hidden);
function updateHud(){const w=mode==='walk';
  stage.classList.toggle('walking',w);$('minimap').hidden=!w;$('joy').hidden=!(w&&coarse);$('lockhint').hidden=!(w&&lockOK&&!locked&&!coarse&&$('help').hidden);
  $('cross').hidden=!w||coarse;
  const act=$('act');const lab=seated&&!aim?'Stand up':aim?labelFor(aim):'';act.hidden=!(w&&coarse&&lab);act.textContent=lab;
  const pr=$('prompt');const show=!coarse&&(w?(locked||!lockOK)&&(aim||seated):!!aim);
  if(show){pr.textContent='';if(w){const k=document.createElement('kbd');k.textContent='E';pr.appendChild(k);}else{const k=document.createElement('kbd');k.textContent='Click';pr.appendChild(k);}
    pr.appendChild(document.createTextNode(aim?labelFor(aim):'Stand up'));}
  pr.hidden=!show||!$('help').hidden||!$('zones-pop').hidden;$('cross').classList.toggle('on',!!aim);}
function setMode(m,instant){if(m!=='walk'&&seated)stand(true);if(m!=='walk'&&locked)document.exitPointerLock();
  mode=m;['walk','overview','plan'].forEach(k=>$('m-'+k).setAttribute('aria-pressed',k===m));anim=null;aim=null;
  if(cur){if(cur.dims)cur.dims.visible=labelsOn&&m!=='walk';overlays.forEach(o=>o.el.hidden=m==='walk');
    if(cur.info.roof)cur.info.roof.traverse(o=>o.layers.set(m==='walk'?0:2));}
  if(m==='walk'){controls.enabled=false;camera.fov=coarse?72:68;camera.updateProjectionMatrix();
    if(cur){const sp=cur.info.spawn;P.x=sp.x;P.z=sp.z;P.yaw=sp.yaw;P.pitch=0;P.vx=P.vz=0;P.floor=0;
      if(cur.info.isModel){ray.layers.set(0);ray.set(new V3(P.x,1.7,P.z),new V3(0,-1,0));ray.far=10;const h=ray.intersectObject(cur.info.model,true)[0];P.floor=h?h.point.y:0;}
      else P.floor=floorAt(P.x,P.z,1.7);
      camera.position.set(P.x,P.floor+EYE,P.z);camera.rotation.set(0,P.yaw,0);}
    if(!store.get('rw-help'))showHelp(true);canvas.focus({preventScroll:true});updateHud();return;}
  showHelp(false);controls.enabled=true;camera.fov=innerWidth<700?55:42;camera.updateProjectionMatrix();
  if(cur){const [p,t]=views()[m];if(instant){camera.position.set(...p);controls.target.set(...t);camera.lookAt(...t);}else{if(camera.position.y<3)camera.position.set(p[0],p[1]*.6,p[2]);flyTo(p,t);}}
  updateHud();}
['walk','overview','plan'].forEach(k=>$('m-'+k).onclick=()=>setMode(k));
function focusZone(z){if(mode!=='overview')setMode('overview',true);const [x,,zz]=z.pos;const s=Math.max(cur.info.W,cur.info.D);flyTo([x+s*.12,s*.4,zz+s*.45],[x,.5,zz]);}
$('b-eve').onclick=()=>{eve=!eve;$('b-eve').setAttribute('aria-pressed',eve);if(cur)cur.info.setLight(eve);};
$('b-full').hidden=!document.fullscreenEnabled;
$('b-full').onclick=()=>{try{if(document.fullscreenElement)document.exitFullscreen();else{const r=$('app').requestFullscreen();if(r&&r.catch)r.catch(()=>toast('Full screen is not available here.'));}}catch(e){toast('Full screen is not available here.');}};
$('act').onclick=()=>{if(seated&&!aim)stand();else if(aim)activate(aim);};

/* ---------- boards ---------- */
let boardReturn=null;
async function openBoard(item){boardOpen=item;boardReturn=document.activeElement;$('board-title').textContent=item.title;$('board-space').textContent=spaceOf(item.space).name+' · design board';
  const img=$('board-img');img.src=item.url;img.alt=item.title;$('board-notes').textContent=item.notes||'';$('board').hidden=false;$('board-close').focus();markActive(item.id);
  if(!item.notes&&item.notesUrl){try{const r=await fetch(item.notesUrl);if(r.ok){item.notes=(await r.text()).slice(0,1200);if(boardOpen===item)$('board-notes').textContent=item.notes;}}catch(e){}}}
function closeBoard(silent){if($('board').hidden)return;$('board').hidden=true;boardOpen=null;markActive();if(!silent&&cur)setHash(cur.item.id);if(boardReturn&&boardReturn.focus)boardReturn.focus();}
$('board-close').onclick=()=>closeBoard();$('board').addEventListener('click',e=>{if(e.target.id==='board')closeBoard();});
addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('upload').hidden)closeUpload();else if(!$('board').hidden)closeBoard();else if(!$('help').hidden)showHelp(false);else if(!$('zones-pop').hidden)togglePop(false);else closeSide();}});

/* ---------- hash routing ---------- */
function setHash(id){if(location.hash.slice(1)!==id){try{history.replaceState(null,'','#'+id);}catch(e){location.hash=id;}}}
function routeTo(id){const it=byId(id);if(it){openItem(it);return true;}return false;}
addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(id&&!routeTo(id)&&!dataReady)pendingId=id;});

/* ---------- add a design ---------- */
function fillSpaces(){const sel=$('up-space');sel.textContent='';spaceList().forEach(s=>{const o=document.createElement('option');o.value=s.key;o.textContent=s.name;sel.appendChild(o);});
  const n=document.createElement('option');n.value='__new';n.textContent='New space…';sel.appendChild(n);sel.value=cur?cur.item.space:'common';$('newspace-wrap').hidden=true;}
let upReturn=null;
function openUpload(){upReturn=document.activeElement;$('up-form').reset();$('drop-name').textContent='Choose a file or drop it here';setStatus('');fillSpaces();$('units-wrap').hidden=false;
  const art=MODE==='artifact'&&canEdit&&assets&&db;
  $('up-go').hidden=!art;$('up-preview').hidden=art;$('publish').hidden=MODE!=='github';
  $('up-sub').textContent=art?'Everyone who opens this page will see it.':MODE==='github'?'Preview a file here, then publish it to the site through GitHub.':'Preview a file here. It is not saved.';
  updatePublish();$('upload').hidden=false;closeSide();$('up-file').focus();}
function closeUpload(){$('upload').hidden=true;if(upReturn&&upReturn.focus)upReturn.focus();}
$('btn-add').onclick=openUpload;$('up-close').onclick=closeUpload;$('upload').addEventListener('click',e=>{if(e.target.id==='upload')closeUpload();});
function setStatus(m,err){const s=$('up-status');s.textContent=m;s.classList.toggle('err',!!err);}
function kindOf(f){const ext=(f.name.split('.').pop()||'').toLowerCase();if(ext==='glb'||ext==='gltf')return 'model';if(/^image\/(png|jpeg|webp)$/.test(f.type)||['png','jpg','jpeg','webp'].includes(ext))return 'image';return null;}
function chosenSpace(){let key=$('up-space').value,name=spaceOf(key).name,folder=spaceOf(key).folder;
  if(key==='__new'){name=$('up-newspace').value.trim();if(!name)return null;folder=slug(name);const ex=spaceList().find(s=>s.name.toLowerCase()===name.toLowerCase()||s.folder===folder);key=ex?ex.key:'x-'+folder;if(ex)folder=ex.folder;}
  return {key,name,folder};}
function siteFileName(){const f=$('up-file').files[0];if(!f)return '';const ext=f.name.split('.').pop().toLowerCase();const t=($('up-title').value.trim()||f.name.replace(/\.[^.]+$/,'')).replace(/[\\/:*?"<>|#%]+/g,' ').replace(/\s+/g,' ').trim();
  const u=kindOf(f)==='model'&&$('up-units').value!=='m'?' ('+$('up-units').value+')':'';return t+u+'.'+ext;}
function updatePublish(){if(MODE!=='github')return;const sp=chosenSpace();const folder=sp?sp.folder:'your-space';const br=CFG.branch||'main';
  $('gh-folder').textContent='designs/'+folder+'/'+(siteFileName()||'');$('gh-link').href='https://github.com/'+CFG.repo+'/upload/'+br+'/designs/'+encodeURIComponent(folder);}
['up-space','up-title','up-units','up-newspace'].forEach(id=>$(id).addEventListener('input',updatePublish));
$('up-space').onchange=()=>{$('newspace-wrap').hidden=$('up-space').value!=='__new';updatePublish();};
function onFile(){const f=$('up-file').files[0];if(!f)return;$('drop-name').textContent=f.name+' · '+(f.size/1048576).toFixed(1)+' MB';
  const k=kindOf(f);$('units-wrap').hidden=k!=='model';if(!$('up-title').value)$('up-title').value=f.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').slice(0,80);
  setStatus(k?'':'Choose a .glb model or a PNG, JPG or WebP image.',!k);updatePublish();}
$('up-file').addEventListener('change',onFile);
const drop=$('drop');
['dragenter','dragover'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.add('over');}));
['dragleave','drop'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.remove('over');}));
drop.addEventListener('drop',e=>{const f=e.dataTransfer&&e.dataTransfer.files[0];if(!f)return;try{const dt=new DataTransfer();dt.items.add(f);$('up-file').files=dt.files;}catch(_){}onFile();});
function download(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);}
$('dl-files').onclick=()=>{const f=$('up-file').files[0];if(!f){setStatus('Choose a file first.',true);return;}const name=siteFileName();download(name,f);
  const notes=$('up-notes').value.trim();if(notes)setTimeout(()=>download(name.replace(/\.[^.]+$/,'')+'.txt',new Blob([notes],{type:'text/plain'})),400);setStatus('Downloaded. Now open the GitHub upload page.');};
async function readModelFile(f){const ext=f.name.split('.').pop().toLowerCase();let json;
  if(ext==='glb'){const ab=await f.arrayBuffer();json=glbToJson(ab);checkModel(json);return {ab,json};}
  json=JSON.parse(await f.text());checkModel(json);checkSingleFile(json);return {ab:jsonToGlb(json),json};}
$('up-preview').onclick=async()=>{const f=$('up-file').files[0];if(!f){setStatus('Choose a file first.',true);return;}const kind=kindOf(f);if(!kind){setStatus('Choose a .glb model or a PNG, JPG or WebP image.',true);return;}
  const sp=chosenSpace();if(!sp){setStatus('Give the new space a name.',true);return;}
  try{const item={id:'local-'+(locals.length+1),local:true,space:sp.key,spaceName:sp.name,title:$('up-title').value.trim()||f.name,sub:'Preview · only you can see this',kind,units:$('up-units').value,notes:$('up-notes').value.trim()};
    if(kind==='image')item.url=URL.createObjectURL(f);else item.data=(await readModelFile(f)).ab;
    locals.push(item);renderList();if(MODE!=='github')closeUpload();else setStatus('Preview added to the list. Publish it with the steps below.');openItem(item);}
  catch(err){setStatus(err.message||'This file could not be read.',true);}};
const ERR={too_large:'This file is too big. Keep it under about 15 MB.',unsupported_type:'This file type can\'t be stored. Use a .glb model or a PNG, JPG or WebP image.',rate_limited:'Too many uploads in a row. Wait a minute and try again.',quota_or_state:'Storage for this page is full. Delete an older design first.',not_uploader:'Only editors of this page can upload designs.',not_granted:'Uploading was not allowed. Check this page\'s permissions.'};
$('up-form').addEventListener('submit',async e=>{e.preventDefault();if(MODE!=='artifact'){$('up-preview').click();return;}const go=$('up-go');
  const f=$('up-file').files[0];if(!f){setStatus('Choose a file first.',true);return;}const kind=kindOf(f);if(!kind){setStatus('Choose a .glb model or a PNG, JPG or WebP image.',true);return;}
  const sp=chosenSpace();if(!sp){setStatus('Give the new space a name.',true);$('up-newspace').focus();return;}
  const title=$('up-title').value.trim()||f.name,notes=$('up-notes').value.trim(),units=$('up-units').value;go.disabled=true;
  try{let blob=f,opts;if(kind==='model'){setStatus('Reading the model…');const {json}=await readModelFile(f);if(f.name.toLowerCase().endsWith('.glb'))checkSingleFile(json);blob=new Blob([JSON.stringify(json)],{type:'application/json'});opts={type:'application/json'};}
    if(blob.size>20*1048576)throw {code:'too_large'};
    setStatus('Uploading…');const up=await assets.upload(blob,opts);setStatus('Saving…');
    const row={title,space:sp.key,spaceName:sp.name,kind,assetId:up.id,notes,createdAt:Date.now()};if(kind==='model')row.units=units;
    const ref=await db.collection('designs').add(row);const item=fromRow(ref.id,row);if(!uploads.find(u=>u.id===item.id)){uploads.push(item);renderList();}
    closeUpload();toast('Added "'+title+'"');openItem(item);}
  catch(err){console.error(err);setStatus((err&&err.code&&ERR[err.code])||(err&&err.message&&!err.code?err.message:'The upload did not go through. Try again.'),true);}finally{go.disabled=false;}});

/* ---------- design sources ---------- */
function fromRow(id,d){return {id:'d-'+id,docId:id,store:'artifact',space:String(d.space||'other'),spaceName:String(d.spaceName||''),title:String(d.title||'Untitled design'),
  sub:d.kind==='image'?'Design board':'Uploaded 3D model',kind:d.kind,assetId:String(d.assetId||''),url:'/_blob/'+d.assetId,notes:String(d.notes||''),units:d.units||'m',createdAt:+d.createdAt||0};}
function fromPath(path,urlFor,all){const parts=path.split('/');if(parts.length!==3||parts[0]!=='designs')return null;const folder=parts[1],file=parts[2];
  const ext=(file.split('.').pop()||'').toLowerCase();const kind=['glb','gltf'].includes(ext)?'model':['png','jpg','jpeg','webp'].includes(ext)?'image':null;if(!kind)return null;
  const base=file.replace(/\.[^.]+$/,'');const um=base.match(/\((m|cm|mm|in|ft)\)\s*$/i);const title=base.replace(/\((m|cm|mm|in|ft)\)\s*$/i,'').replace(/[_]+/g,' ').trim()||base;
  const sp=SPACES.find(s=>s.folder===folder);const notesPath='designs/'+folder+'/'+base+'.txt';
  return {id:'g-'+slug(folder)+'-'+slug(base),store:'github',path,space:sp?sp.key:'x-'+folder,spaceName:sp?sp.name:folder.replace(/[-_]+/g,' ').replace(/^./,c=>c.toUpperCase()),
    title,sub:kind==='image'?'Design board':'Uploaded 3D model',kind,url:urlFor(path),notesUrl:all.has(notesPath)?urlFor(notesPath):null,units:um?um[1].toLowerCase():'m'};}
async function loadGithub(){const br=CFG.branch||'main';const enc=p=>p.split('/').map(encodeURIComponent).join('/');let paths=null,urlFor;
  try{const c=sessionStorage.getItem('rw-tree');if(c){const o=JSON.parse(c);if(Date.now()-o.t<180000)paths=o.p;}}catch(e){}
  if(!paths){try{const r=await fetch('https://api.github.com/repos/'+CFG.repo+'/git/trees/'+br+'?recursive=1');if(r.ok){const j=await r.json();paths=j.tree.filter(t=>t.type==='blob'&&t.path.startsWith('designs/')).map(t=>t.path);try{sessionStorage.setItem('rw-tree',JSON.stringify({t:Date.now(),p:paths}));}catch(e){}}}catch(e){}}
  if(paths)urlFor=p=>'https://raw.githubusercontent.com/'+CFG.repo+'/'+br+'/'+enc(p);
  else{const raw='https://raw.githubusercontent.com/'+CFG.repo+'/'+br+'/';for(const [src,mk] of [[raw+'designs/manifest.json',p=>raw+enc(p)],['designs/manifest.json',p=>enc(p)]]){try{const r=await fetch(src,{cache:'no-store'});if(r.ok){paths=(await r.json()).files||[];urlFor=mk;break;}}catch(e){}}}
  const all=new Set(paths||[]);uploads=(paths||[]).map(p=>fromPath(p,urlFor,all)).filter(Boolean).sort((a,b)=>(a.kind===b.kind?0:a.kind==='image'?-1:1)||a.title.localeCompare(b.title));}
async function initData(){
  if(MODE==='github'){await loadGithub();dataReady=true;renderList();resolvePending();return;}
  if(MODE!=='artifact'){dataReady=true;resolvePending();return;}
  const [d,u,a]=await Promise.all([claude.use('db'),claude.use('user'),claude.use('assets')]);
  db=d;assets=a;canEdit=u?await u.canEdit().catch(()=>false):false;
  if(!db){dataReady=true;resolvePending();renderList();return;}
  const t=setTimeout(()=>{dataReady=true;resolvePending();},10000);
  db.collection('designs').onSnapshot(snap=>{clearTimeout(t);
    uploads=snap.docs.map(doc=>fromRow(doc.id,doc.data()||{})).filter(r=>r.assetId&&(r.kind==='image'||r.kind==='model')).sort((a,b)=>a.createdAt-b.createdAt);
    dataReady=true;renderList();resolvePending();
    if(cur&&cur.item.docId&&!uploads.find(x=>x.id===cur.item.id))openItem(byId(DEFAULT));
    if(boardOpen&&boardOpen.docId&&!uploads.find(x=>x.id===boardOpen.id))closeBoard();},()=>{clearTimeout(t);dataReady=true;resolvePending();});}
function resolvePending(){if(pendingId){const id=pendingId;pendingId=null;routeTo(id);}}

/* ---------- loop ---------- */
function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(stage);resize();
const v=new V3();let last=performance.now();
function loop(t){requestAnimationFrame(loop);const dt=Math.min(.05,(t-last)/1000);last=t;if(!cur)return;const i=cur.info;
  if(mode==='walk'){walkStep(dt);drawMinimap();}
  else{if(anim){let k=Math.min(1,(t-anim.s)/anim.dur);k=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;camera.position.lerpVectors(anim.p0,anim.p1,k);controls.target.lerpVectors(anim.t0,anim.t1,k);if(k>=1)anim=null;}controls.update();}
  (i.anim||[]).forEach(g=>{const d=g.userData.rt-g.rotation.y;if(Math.abs(d)>.001)g.rotation.y+=d*Math.min(1,dt*5);});
  if(t-aimT>110){aimT=t;let na=null;
    if(mode==='walk'){if(locked||coarse||!lockOK)na=(locked||coarse)?pick(new V2(0,0),2.8):(mouse?pickAt(mouse.x,mouse.y,3):pick(new V2(0,0),2.8));}
    else if(mouse&&!down)na=pickAt(mouse.x,mouse.y,400);
    if((na&&na.obj)!==(aim&&aim.obj))aim=na;else if(na)aim.point=na.point;else aim=null;
    stage.classList.toggle('pointing',mode!=='walk'&&!!aim);updateHud();}
  if(i.sides){const c=camera.position,top=c.y>Math.max(i.W,i.D)*.95,walk=mode==='walk';const hide={back:c.z<-.1,front:c.z>i.D+.1,left:c.x<-.1,right:c.x>i.W+.1};
    for(const n in i.sides){const h=!walk&&hide[n]&&!top,g=i.sides[n];if(g.userData.hidden!==h){g.userData.hidden=h;g.traverse(o=>o.layers.set(h?1:0));}}}
  if(mode!=='walk'&&labelsOn){const w=stage.clientWidth,h=stage.clientHeight;
    overlays.forEach(o=>{v.set(...o.p).project(camera);if(v.z>1||Math.abs(v.x)>1.05||Math.abs(v.y)>1.05){o.el.style.opacity=0;return;}o.el.style.opacity=1;o.el.style.left=((v.x+1)/2*w)+'px';o.el.style.top=((1-v.y)/2*h)+'px';});}
  renderer.render(cur.scene,camera);}
requestAnimationFrame(loop);


/* ---------- test hook (read-only helpers for automated checks) ---------- */
window.__rw={state:()=>({mode,seated:seated&&seated.name,aim:labelFor(aim),x:P.x,z:P.z,floor:P.floor,item:cur&&cur.item.id,designs:allItems().map(i=>i.id),inter:cur?cur.info.inter.length:0,colliders:colliders.length}),
  open:id=>openItem(byId(id)),mode:m=>setMode(m),
  use:(pred)=>{const o=cur.info.inter.find(pred);if(!o)return 'none';const p=new V3();o.getWorldPosition(p);activate({obj:o,point:p});return labelFor({obj:o});}};
/* ---------- start ---------- */
renderList();updateHud();
const first=location.hash.slice(1);
if(first&&byId(first)&&byId(first).kind!=='image')openItem(byId(first));else{openItem(byId(DEFAULT));if(first&&first!==DEFAULT)pendingId=first;}
initData();
})();
