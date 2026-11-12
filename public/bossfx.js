/* Boss strike animations + sounds (attack styles, summon, defeat, HP bar drain). Written for the Bosses feature: it only draws on the map and reacts to
   bosses.js. The site's own fx.js still does the general game feel, so music, ambience, the speaker button and button sounds are left out here. */
/* =====================================================================
   MIRA'S GROVE - ANIMATION + SOUND LAYER
   Purely visual / audio. It reads the game, it never changes game data.
   Blocks: CONFIG, helpers, Particles, Effects, Attack styles, Audio, Hooks
   ===================================================================== */
(function(){
'use strict';

/* =====================================================================
   CONFIG - every tunable lives here
   ===================================================================== */
const CONFIG={
  reducedMotion:false,                 // auto-on when the OS asks for reduced motion (less shake / flash / slow-mo)
  idle:{amp:1.7,miniAmp:1.3,speed:1.5,breathe:.014},   // boss float (px), float speed, breathing scale
  mira:{breathe:.012,squashStart:.11,squashStop:.13,dust:3},  // idle breathing, start/stop squash (sec), dust puffs per step
  hitStop:{min:.06,max:.09},           // seconds the action freezes on impact (scaled by damage)
  shake:{base:1.6,perDmg:.5,max:8,dur:.30},            // camera shake px: base + perDmg*damage
  slowmo:{scale:.28,dur:.8},           // main boss defeat slow motion
  flash:{alpha:.5,dur:.35},            // full-screen flash
  particles:{max:720,ambient:22},      // hard cap for effect particles / ambient motes
  attack:{windup:.13,ghost:.6},        // seconds before the hit lands, seconds the hit target lingers
  dmgText:{base:24,perDmg:1.5,life:1.0},               // floating damage number
  hp:{ghostHold:.5,ghostSpeed:.8,smooth:12},           // HP bar: ghost delay, ghost drain speed (bar/sec), smoothing
  audio:{master:.8,sfx:.9,ambient:.32,music:.2,musicOn:false,duck:.4},  // volumes 0-1, duck = music level under big hits
  trap:{                                // trapdoor + Hall of Fame: every tunable lives here
    at:[0,.25,.8,1.5,1.8,2.5,3.2,4.4],  // phase starts (s): press, rumble, slide open, hang, fall, teleport, arrival, end
    skipAfter:.8, reduced:.4,           // Esc/Space skips after this long; reduced-motion total fade
    sink:3, dark:.35, shake:3,          // press sink px, press darkening, rumble shake px
    pit:22, thick:6, slide:1,           // pit depth px, tile side thickness px, slide distance (tiles)
    fallDrop:118, fallScale:.35, spin:.55, bang:[38,26], duckLP:700,
    iris:{maxR:1150,hallR:950,closeR:1600,closeFrom:.3,openTime:.6},
    land:{delay:.2,drop:.42,squash:.22,shake:3},
    out:{close:.35,open:.3,pop:.4,rise:.38,hang:.14,shut:.82,shutT:.43,land:1.25,light:.9,hop:38,total:1.6},
    hall:{introMs:1700,cardDelay:.35,cardGap:.06,burstAt:.6,turn:.28,motes:30},
    partCap:120,
    col:{seam:'255,216,130',dust:'226,212,186',pitTop:'#08061c',pitBot:'#1d1648',floorA:'#4b3a8c',floorB:'#2a2062',floorC:'#120d33',wallA:'#6a5590',wallA2:'#7a6296',wallB:'#2a2058',wallC:'#140f33',rim:'rgba(255,214,130,.55)'},
    vol:{thunk:1,rumble:1,grind:1,shimmer:1,uhoh:1,whistle:1,sweep:1,thump:1,boing:1,clack:1,plink:1,fwip:1,whoosh:1,die:1,hall:.5}
  }
};
try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)CONFIG.reducedMotion=true}catch(e){}
const RM=()=>CONFIG.reducedMotion;

/* =====================================================================
   Helpers + tween functions
   ===================================================================== */
const R=(a,b)=>a+Math.random()*(b-a),RI=(a,b)=>Math.floor(R(a,b+1)),CL=(v,a,b)=>Math.max(a,Math.min(b,v)),
 LP=(a,b,t)=>a+(b-a)*t,eo3=t=>1-Math.pow(1-t,3),eoB=t=>{const c=1.70158;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)},
 hash=s=>{let h=0;s=String(s);for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h)};
const $=s=>document.querySelector(s);
let now=0,fxT=0,dtR=.016,dtS=.016,tsv=1,hitUntil=0,slowFrom=0,slowUntil=0,frameNo=0;
const sched=[];const later=(sec,fn)=>sched.push({at:now+sec,fn});
const schedF=[];const laterFx=(sec,fn)=>schedF.push({at:fxT+sec,fn});   // like later(), but follows slow motion
const STYLE_NAMES=['classic','green','purple'];

/* =====================================================================
   Particles (pooled, capped)
   ===================================================================== */
const PS=[];
function addP(p){if(PS.length>=CONFIG.particles.max)PS.shift();p.a=0;p.vx=p.vx||0;p.vy=p.vy||0;p.ax=p.ax||0;p.ay=p.ay||0;p.r=p.r||0;p.vr=p.vr||0;p.dr=p.dr==null?1:p.dr;p.s=p.s||4;PS.push(p);return p}
function updP(dt){for(let i=PS.length-1;i>=0;i--){const p=PS[i];p.a+=dt;if(p.a>=p.l){PS.splice(i,1);continue}if(p.a<0)continue;
 if(p.orb){const q=p.orb;q.ang+=q.va*dt;q.rad+=q.vr*dt;p.x=q.cx+Math.cos(q.ang)*q.rad;p.y=q.cy+Math.sin(q.ang)*q.rad*.5-p.a*q.rise;p.r+=p.vr*dt;continue}
 if(p.imp&&p.a>p.imp.t&&!p.imp.done){p.imp.done=1;const d=Math.hypot(p.x-p.imp.cx,p.y-p.imp.cy)||1,sp=R(220,420);p.vx=(p.x-p.imp.cx)/d*sp;p.vy=(p.y-p.imp.cy)/d*sp-60;p.ax=0;p.ay=260;p.dr=.985;p.vr=R(-9,9)}
 const k=Math.pow(p.dr,dt*60);p.vx=(p.vx+p.ax*dt)*k;p.vy=(p.vy+p.ay*dt)*k;p.x+=p.vx*dt;p.y+=p.vy*dt;p.r+=p.vr*dt;if(p.sway)p.x+=Math.sin(p.a*p.sway+p.ph)*.35}}
function star(g,s,pts,inner){g.beginPath();for(let i=0;i<pts*2;i++){const r=i%2?s*inner:s,a=i*Math.PI/pts-Math.PI/2;i?g.lineTo(Math.cos(a)*r,Math.sin(a)*r):g.moveTo(Math.cos(a)*r,Math.sin(a)*r)}g.closePath()}
function drawP(g,p){if(p.a<0)return;const k=p.a/p.l,al=p.fadeIn?Math.min(1,p.a/p.fadeIn)*(1-Math.pow(k,2)):(k<.6?1:1-(k-.6)/.4);if(al<=0)return;
 g.save();g.globalAlpha=al*(p.al==null?1:p.al);g.translate(p.x,p.y);g.rotate(p.r);
 switch(p.k){
  case'star':{const s=p.s*(p.grow?1+k*p.grow:1-k*.4);g.fillStyle=p.c;g.strokeStyle='rgba(60,40,10,.7)';g.lineWidth=1.2;star(g,s,5,.45);g.fill();g.stroke();break}
  case'dot':{const s=p.s*(p.grow?1+k*p.grow:1);g.globalCompositeOperation=p.add?'lighter':'source-over';const gr=g.createRadialGradient(0,0,0,0,0,s);gr.addColorStop(0,p.c);gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.beginPath();g.arc(0,0,s,0,7);g.fill();break}
  case'smoke':{const s=p.s*(1+k*(p.grow||1.6));g.globalAlpha=al*(p.al==null?.5:p.al)*(1-k*.4);const gr=g.createRadialGradient(0,0,0,0,0,s);gr.addColorStop(0,p.c);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.beginPath();g.arc(0,0,s,0,7);g.fill();break}
  case'leaf':{g.fillStyle=p.c;g.strokeStyle='rgba(20,50,15,.6)';g.lineWidth=.9;const s=p.s,fl=Math.abs(Math.cos(p.a*(p.flip||3)+p.ph));g.scale(1,.35+.65*fl);g.beginPath();g.moveTo(-s,0);g.quadraticCurveTo(0,-s*.75,s,0);g.quadraticCurveTo(0,s*.75,-s,0);g.fill();g.stroke();g.beginPath();g.moveTo(-s*.8,0);g.lineTo(s*.8,0);g.stroke();break}
  case'flower':{const s=p.s*Math.min(1,eoB(Math.min(1,p.a/.28)));flower(g,s,p.c);break}
  case'spark':{g.globalCompositeOperation='lighter';const sp=Math.hypot(p.vx,p.vy)||1,len=p.s*(1-k*.6);g.rotate(Math.atan2(p.vy,p.vx)-p.r);g.strokeStyle=p.c;g.lineCap='round';g.lineWidth=2;g.beginPath();g.moveTo(-len,0);g.lineTo(len*.3,0);g.stroke();break}
  case'shard':{g.fillStyle=p.c;g.strokeStyle='rgba(255,230,255,.8)';g.lineWidth=1;const s=p.s;g.beginPath();g.moveTo(0,-s);g.lineTo(s*.45,s*.6);g.lineTo(-s*.5,s*.4);g.closePath();g.fill();g.stroke();break}
  case'conf':{g.fillStyle=p.c;const fl=Math.cos(p.a*9+p.ph);g.scale(1,fl);g.fillRect(-p.s,-p.s*.55,p.s*2,p.s*1.1);break}
  case'cross':{g.globalCompositeOperation='lighter';g.fillStyle=p.c;const s=p.s*(1-k*.3);g.fillRect(-s,-s*.28,s*2,s*.56);g.fillRect(-s*.28,-s,s*.56,s*2);break}
  case'petal':{const s=p.s,fl=Math.cos(p.a*(p.flip||3)+p.ph);g.scale(1,.28+.72*Math.abs(fl));g.fillStyle=p.c;g.strokeStyle='rgba(120,30,75,.45)';g.lineWidth=.8;petalPath(g,s);g.fill();g.stroke();g.strokeStyle='rgba(255,255,255,.55)';g.beginPath();g.moveTo(0,s*.7);g.lineTo(0,-s*.4);g.stroke();break}
  case'bloom':{const s=p.s*Math.min(1,eoB(Math.min(1,p.a/.25)));sakura(g,s,p.c,'#ffe58a');break}
  case'sparkle':{g.globalCompositeOperation='lighter';const s=p.s*(1+.25*Math.sin(p.a*14+p.ph))*(1-k*.3);g.fillStyle=p.c;g.beginPath();g.moveTo(0,-s);g.quadraticCurveTo(s*.14,-s*.14,s,0);g.quadraticCurveTo(s*.14,s*.14,0,s);g.quadraticCurveTo(-s*.14,s*.14,-s,0);g.quadraticCurveTo(-s*.14,-s*.14,0,-s);g.fill();const gl=g.createRadialGradient(0,0,0,0,0,s*1.6);gl.addColorStop(0,'rgba(255,255,255,.35)');gl.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gl;g.beginPath();g.arc(0,0,s*1.6,0,7);g.fill();break}
  case'pc':{g.drawImage(p.im,p.sx,p.sy,p.sw,p.sh,-p.w/2,-p.h/2,p.w,p.h);break}
 }g.restore()}
function flower(g,s,c){g.fillStyle=c;g.strokeStyle='rgba(60,30,40,.55)';g.lineWidth=.9;for(let i=0;i<5;i++){g.save();g.rotate(i*Math.PI*2/5);g.beginPath();g.ellipse(0,-s*.55,s*.36,s*.55,0,0,7);g.fill();g.stroke();g.restore()}g.fillStyle='#ffd65a';g.beginPath();g.arc(0,0,s*.28,0,7);g.fill();g.stroke()}

/* =====================================================================
   Timed effects (rune circles, vines, slashes, POW, damage numbers ...)
   ===================================================================== */
const EF=[],GH=[],ST={};   // effects, ghost sprites (targets that vanish when the game re-syncs), per-sprite state
const addE=e=>{e.t0=fxT;EF.push(e);return e};
const COL={classic:['#ffd23c','#fff3b0','#ffffff'],green:['#ff8fb8','#ffc0d8','#ffffff'],purple:['#9b5cff','#d3a6ff','#ff9bf0']};

function drawUnder(g){for(const e of EF){const k=(fxT-e.t0)/e.dur;if(k<0||k>1)continue;
 if(e.k==='rune'){g.save();g.translate(e.x,e.y);g.scale(1,.5);const a=k<.15?k/.15:1-(k-.15)/.85,rot=k*2.2;
  const gr=g.createRadialGradient(0,0,0,0,0,e.r*1.25);gr.addColorStop(0,'rgba(155,92,255,'+.45*a+')');gr.addColorStop(1,'rgba(155,92,255,0)');g.fillStyle=gr;g.beginPath();g.arc(0,0,e.r*1.25,0,7);g.fill();
  g.rotate(rot);g.lineWidth=3;g.strokeStyle='rgba(211,166,255,'+a+')';g.beginPath();g.arc(0,0,e.r,0,7);g.stroke();g.lineWidth=1.6;g.beginPath();g.arc(0,0,e.r*.74,0,7);g.stroke();
  for(let i=0;i<8;i++){g.save();g.rotate(i*Math.PI/4);g.beginPath();g.moveTo(e.r*.76,0);g.lineTo(e.r*.98,0);g.moveTo(e.r*.86,-6);g.lineTo(e.r*.86,6);g.stroke();g.restore()}
  g.beginPath();for(let i=0;i<6;i++){const an=i*Math.PI/3,x=Math.cos(an)*e.r*.7,y=Math.sin(an)*e.r*.7;i?g.lineTo(x,y):g.moveTo(x,y)}g.closePath();g.stroke();g.restore()}
 else if(e.k==='glow'){const a=Math.sin(Math.PI*k)*e.a,gr=g.createRadialGradient(e.x,e.y-e.up,0,e.x,e.y-e.up,e.r*(.6+k*.5));gr.addColorStop(0,e.c.replace('A',a));gr.addColorStop(1,e.c.replace('A',0));g.fillStyle=gr;g.beginPath();g.arc(e.x,e.y-e.up,e.r*1.2,0,7);g.fill()}
 else if(e.k==='ring'){g.save();g.translate(e.x,e.y);g.scale(1,.5);g.globalAlpha=(1-k)*.8;g.strokeStyle=e.c;g.lineWidth=e.lw*(1-k*.6);g.beginPath();g.arc(0,0,e.r*eo3(k),0,7);g.stroke();g.restore()}
 else if(e.k==='bed'){const a=k<.75?1:1-(k-.75)/.25;e.fl.forEach(f=>{const s=CL((fxT-e.t0-f.d)/.3,0,1);if(s<=0)return;g.save();g.globalAlpha=a;g.translate(e.x+f.x,e.y+f.y);const sc=f.s*eoB(s);g.fillStyle='rgba(0,0,0,.18)';g.beginPath();g.ellipse(0,2,sc*.8,sc*.3,0,0,7);g.fill();g.strokeStyle='#3d7a2c';g.lineWidth=2;g.beginPath();g.moveTo(0,0);g.lineTo(0,-sc*.9);g.stroke();g.translate(0,-sc*.9);flower(g,sc*.8,f.c);g.restore()})}
 else if(e.k==='pillar'){const a=k<.2?k/.2:1-(k-.2)/.8,w=e.w*(.6+.4*eo3(Math.min(1,k*3)));g.save();g.globalCompositeOperation='lighter';const gr=g.createLinearGradient(0,e.y-e.h,0,e.y);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.5,e.c.replace('A',.5*a));gr.addColorStop(1,e.c.replace('A',.85*a));g.fillStyle=gr;g.fillRect(e.x-w/2,e.y-e.h,w,e.h);const gr2=g.createRadialGradient(e.x,e.y,0,e.x,e.y,w*1.3);gr2.addColorStop(0,e.c.replace('A',.7*a));gr2.addColorStop(1,e.c.replace('A',0));g.fillStyle=gr2;g.beginPath();g.ellipse(e.x,e.y,w*1.3,w*.5,0,0,7);g.fill();g.restore()}
 else if(e.k==='mandala'){const hd=e.hold||.72,a=k<.08?k/.08:k>hd?Math.max(0,1-(k-hd)/(1-hd)):1;g.save();g.translate(e.x,e.y);g.scale(1,.5);g.globalAlpha=a;
  const gr=g.createRadialGradient(0,0,0,0,0,e.r*1.3);gr.addColorStop(0,'rgba(255,200,225,.6)');gr.addColorStop(.7,'rgba(255,170,205,.2)');gr.addColorStop(1,'rgba(255,170,205,0)');g.fillStyle=gr;g.beginPath();g.arc(0,0,e.r*1.3,0,7);g.fill();
  g.rotate(k*(e.spin||.6));
  for(let ring=0;ring<2;ring++){const n=e.n,rr=e.r*(ring?.64:1);for(let i=0;i<n;i++){const sc=eoB(CL((fxT-e.t0-i*.04-ring*.14)/.34,0,1));if(sc<=0)continue;g.save();g.rotate(i*Math.PI*2/n+(ring?Math.PI/n:0));g.scale(sc,sc);lotus(g,rr,ring);g.restore()}}
  const cg=g.createRadialGradient(0,0,0,0,0,e.r*.22);cg.addColorStop(0,'#fff6c0');cg.addColorStop(1,'rgba(255,210,120,0)');g.fillStyle=cg;g.beginPath();g.arc(0,0,e.r*.22,0,7);g.fill();g.restore()}
 else if(e.k==='garland'){const a=k<.15?k/.15:k>.8?(1-k)/.2:1,gr=e.grow?eo3(Math.min(1,k*3)):1;drawGarland(g,e.x,e.y,e.r*gr,k*(e.spin||1.2),a,e.n||18,e.sz||8)}
 else if(e.k==='implode'){const a=Math.sin(Math.PI*Math.min(1,k*1.2));g.save();g.translate(e.x,e.y);const rr=e.r*(1-.85*eo3(Math.min(1,k/.55)));const gr=g.createRadialGradient(0,0,0,0,0,rr);gr.addColorStop(0,'rgba(10,0,25,'+.9*a+')');gr.addColorStop(.7,'rgba(70,20,130,'+.6*a+')');gr.addColorStop(1,'rgba(155,92,255,0)');g.fillStyle=gr;g.beginPath();g.arc(0,0,rr,0,7);g.fill();g.restore()}
 }}
function drawOver(g){for(const e of EF){const k=(fxT-e.t0)/e.dur;if(k<0||k>1)continue;try{drawOne(g,e,k)}catch(err){if(!e.err){e.err=1;console.error('FX over '+e.k+': '+err.message)}}}}
function drawOne(g,e,k){
 if(e.k==='pow'){const sc=eoB(Math.min(1,k*4))*(1-Math.max(0,k-.6)*1.5);if(sc<=0)return;g.save();g.translate(e.x,e.y);g.rotate(e.rot);g.scale(sc,sc);g.globalAlpha=k>.7?1-(k-.7)/.3:1;g.fillStyle=e.c1||'#fffbe8';g.strokeStyle=e.oc||'#3a2810';g.lineWidth=3;star(g,e.r,10,.55);g.fill();g.stroke();
  g.fillStyle=e.c2||'#ffd23c';g.beginPath();g.arc(0,0,e.r*.5,0,7);g.fill();g.rotate(-e.rot);g.font="900 "+Math.round(e.r*(e.tx?.42:.62))+"px 'Patrick Hand','Comic Sans MS',cursive";g.textAlign='center';g.textBaseline='middle';g.lineWidth=4;g.strokeStyle=e.oc||'#3a2810';g.fillStyle='#fff';g.strokeText(e.tx||'POW',0,1);g.fillText(e.tx||'POW',0,1);g.restore()}
 else if(e.k==='slash'){const a=k<.25?k/.25:1-(k-.25)/.75,p=CL(k/.2,0,1);g.save();g.globalCompositeOperation='lighter';g.lineCap='round';const x1=LP(e.x0,e.x1,p),y1=LP(e.y0,e.y1,p);
  g.strokeStyle='rgba(155,92,255,'+.9*a+')';g.lineWidth=9*a+2;g.beginPath();g.moveTo(e.x0,e.y0);g.lineTo(x1,y1);g.stroke();g.strokeStyle='rgba(255,240,255,'+a+')';g.lineWidth=2.6*a+.6;g.beginPath();g.moveTo(e.x0,e.y0);g.lineTo(x1,y1);g.stroke();g.restore()}
 else if(e.k==='dmg'){const T=fxT-e.t0,pop=eoB(CL(T/.18,0,1)),al=k<.65?1:1-(k-.65)/.35,x=e.x+e.vx*T,y=e.y+e.vy*T+.5*e.g*T*T,tx=(e.sg||'-')+e.d,hs=Math.round(e.fs*.5),F=n=>"900 "+n+"px 'Patrick Hand','Comic Sans MS',cursive";
  g.save();g.globalAlpha=al;g.translate(x,y);g.scale(pop,pop);g.textBaseline='middle';g.lineJoin='round';g.font=F(e.fs);const w1=g.measureText(tx).width;g.font=F(hs);const w2=g.measureText('HP').width,x0=-(w1+6+w2)/2;
  g.textAlign='left';g.lineWidth=Math.max(4,e.fs*.2);g.strokeStyle='rgba(30,20,10,.9)';g.fillStyle=e.c;g.font=F(e.fs);g.strokeText(tx,x0,0);g.fillText(tx,x0,0);g.font=F(hs);g.lineWidth=3;g.strokeText('HP',x0+w1+6,e.fs*.14);g.fillText('HP',x0+w1+6,e.fs*.14);g.restore()}
 else if(e.k==='bigflower'){const sc=eoB(Math.min(1,k*4.5))*(1-Math.max(0,k-.55)*1.6);if(sc<=0)return;g.save();g.translate(e.x,e.y);g.rotate(e.rot+k*.6);g.scale(sc,sc);g.globalAlpha=k>.65?1-(k-.65)/.35:1;
  g.globalCompositeOperation='lighter';const gg=g.createRadialGradient(0,0,0,0,0,e.r*1.8);gg.addColorStop(0,'rgba(255,190,220,.75)');gg.addColorStop(1,'rgba(255,190,220,0)');g.fillStyle=gg;g.beginPath();g.arc(0,0,e.r*1.8,0,7);g.fill();g.globalCompositeOperation='source-over';
  if(e.leaf)for(const an of[-2.35,-.8]){g.save();g.rotate(an);g.translate(e.r*.62,0);const L=e.r*.9;g.lineJoin='round';g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(L*.5,-L*.4,L,0);g.quadraticCurveTo(L*.5,L*.4,0,0);g.strokeStyle='#fff';g.lineWidth=6;g.stroke();g.fillStyle='#6fcf4a';g.fill();g.strokeStyle='rgba(25,85,25,.8)';g.lineWidth=1.4;g.stroke();g.beginPath();g.moveTo(L*.08,0);g.lineTo(L*.85,0);g.stroke();g.restore()}
  sakura(g,e.r,e.c||'#ff9fc4','#ffe58a',true);g.restore()}
 else if(e.k==='shine'){const a=Math.sin(Math.PI*Math.min(1,k*1.1)),n=e.n;g.save();g.translate(e.x,e.y);g.globalCompositeOperation='lighter';g.rotate(k*.8+e.ph);
  for(let i=0;i<n;i++){g.rotate(Math.PI*2/n);const sh=i%2?.6:1,L=e.r*(.4+.6*eo3(Math.min(1,k*3)))*sh,gr=g.createLinearGradient(0,0,L,0);gr.addColorStop(0,e.c.replace('A',.8*a));gr.addColorStop(1,e.c.replace('A',0));g.fillStyle=gr;g.beginPath();g.moveTo(0,-3);g.lineTo(L,-L*.06*sh-1.5);g.lineTo(L,L*.06*sh+1.5);g.lineTo(0,3);g.closePath();g.fill()}g.restore()}
 else if(e.k==='sigil'){const a=k<.15?k/.15:k>.85?(1-k)/.15:1,R0=e.r*(1-.8*eo3(CL((k-e.sh0)/e.shd,0,1)));g.save();g.translate(e.x,e.y);g.scale(1,.3);g.globalCompositeOperation='lighter';g.rotate(k*e.spin);g.strokeStyle='rgba(205,160,255,'+.9*a+')';g.lineWidth=3;g.beginPath();g.arc(0,0,R0,0,7);g.stroke();g.lineWidth=1.4;g.beginPath();g.arc(0,0,R0*.88,0,7);g.stroke();
  for(let i=0;i<24;i++){g.save();g.rotate(i*Math.PI/12);g.beginPath();if(i%3===0){g.moveTo(R0*.9,0);g.lineTo(R0*1.1,0);g.moveTo(R0,-8);g.lineTo(R0,8)}else{g.moveTo(R0*.92,0);g.lineTo(R0*.98,0)}g.stroke();g.restore()}g.restore()}
 else if(e.k==='bolt'){const a=k<.2?1:Math.max(0,1-(k-.2)/.8),fl=.6+.4*Math.sin(k*60);g.save();g.globalCompositeOperation='lighter';g.lineJoin='round';g.lineCap='round';
  for(let pass=0;pass<2;pass++){g.strokeStyle=pass?'rgba(255,245,255,'+a*fl+')':'rgba(170,110,255,'+.8*a*fl+')';g.lineWidth=pass?1.4:4.5;g.beginPath();e.p.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));g.stroke()}g.restore()}
 else if(e.k==='orb'){const q=eo3(CL(k/.85,0,1)),r=e.r*(.18+.82*q),a=k>.9?Math.max(0,1-(k-.9)/.1):1;g.save();g.translate(e.x,e.y);g.globalAlpha=a;g.globalCompositeOperation='lighter';
  let gr=g.createRadialGradient(0,0,r*.6,0,0,r*2.4);gr.addColorStop(0,'rgba(190,130,255,.75)');gr.addColorStop(1,'rgba(190,130,255,0)');g.fillStyle=gr;g.beginPath();g.arc(0,0,r*2.4,0,7);g.fill();
  g.save();g.rotate(k*3.5);g.scale(1,.28);g.lineWidth=Math.max(2,r*.14);for(let i=0;i<3;i++){g.strokeStyle='rgba('+(i?255:215)+','+(i?170:190)+',255,'+(.6-.15*i)+')';g.beginPath();g.arc(0,0,r*(1.5+i*.45),0,7);g.stroke()}g.restore();
  g.globalCompositeOperation='source-over';gr=g.createRadialGradient(0,0,0,0,0,r);gr.addColorStop(0,'rgba(6,0,16,1)');gr.addColorStop(.8,'rgba(30,6,60,.98)');gr.addColorStop(1,'rgba(90,40,160,.9)');g.fillStyle=gr;g.beginPath();g.arc(0,0,r,0,7);g.fill();
  g.globalCompositeOperation='lighter';g.strokeStyle='rgba(235,200,255,.95)';g.lineWidth=Math.max(1.6,r*.09);g.beginPath();g.arc(0,0,r*1.02,0,7);g.stroke();g.restore()}
 else if(e.k==='shock'){g.save();g.translate(e.x,e.y);g.scale(1,.55);g.globalAlpha=(1-k)*.9;g.strokeStyle=e.c;g.lineWidth=e.lw*(1-k);g.beginPath();g.arc(0,0,e.r*eo3(k),0,7);g.stroke();g.restore()}
 }
const sweepEF=()=>{for(let i=EF.length-1;i>=0;i--)if(fxT-EF[i].t0>EF[i].dur)EF.splice(i,1)};

/* =====================================================================
   GREEN BOSS = BLOSSOM. Pink petals, flowers, sparkles and pastel light.
   PURPLE BOSS KO = VOID COLLAPSE. Both KO sequences live at the end of this block.
   ===================================================================== */
const PINKS=['#ff7fae','#ff9fc4','#ffc0d8','#ffe0ec'],GCOL=['#ff8fb8','#ffc0d8','#ffffff','#d9a8ff','#ffe58a','#ff9fc4'];
const pick=a=>a[RI(0,a.length-1)],GREENS=['#5fbf3c','#8be06a','#b9ee7a','#3f9a2e'];
function bloomCol(){const r=Math.random();return r<.55?PINKS[RI(0,3)]:r<.7?'#ffffff':r<.82?'#d9a8ff':r<.92?'#ffe58a':'#a8f0d0'}
function petalPath(g,s){g.beginPath();g.moveTo(0,s);g.bezierCurveTo(s*.95,s*.5,s*.8,-s*.7,s*.12,-s);g.lineTo(0,-s*.78);g.lineTo(-s*.12,-s);g.bezierCurveTo(-s*.8,-s*.7,-s*.95,s*.5,0,s)}
function sakura(g,s,c,cc,sticker){g.lineJoin='round';
 const pet=()=>{g.beginPath();g.moveTo(0,0);g.bezierCurveTo(-s*.62,-s*.2,-s*.58,-s*.95,-s*.14,-s);g.lineTo(0,-s*.84);g.lineTo(s*.14,-s);g.bezierCurveTo(s*.58,-s*.95,s*.62,-s*.2,0,0)};
 if(sticker){g.fillStyle='#fff';g.strokeStyle='#fff';g.lineWidth=Math.max(4,s*.2);for(let i=0;i<5;i++){g.save();g.rotate(i*Math.PI*2/5);pet();g.fill();g.stroke();g.restore()}}
 g.strokeStyle='rgba(120,30,75,.6)';g.lineWidth=Math.max(.8,s*.06);
 for(let i=0;i<5;i++){g.save();g.rotate(i*Math.PI*2/5);pet();const gr=g.createLinearGradient(0,0,0,-s);gr.addColorStop(0,'#fff6fa');gr.addColorStop(.35,c);gr.addColorStop(1,c);g.fillStyle=gr;g.fill();g.stroke();g.restore()}
 g.fillStyle=cc||'#ffd65a';g.beginPath();g.arc(0,0,s*.2,0,7);g.fill();
 if(s>9){g.strokeStyle='rgba(200,70,110,.85)';g.lineWidth=Math.max(.7,s*.045);for(let i=0;i<8;i++){const a=i/8*6.283+.2;g.beginPath();g.moveTo(Math.cos(a)*s*.14,Math.sin(a)*s*.14);g.lineTo(Math.cos(a)*s*.4,Math.sin(a)*s*.4);g.stroke();g.fillStyle='#ffd65a';g.beginPath();g.arc(Math.cos(a)*s*.42,Math.sin(a)*s*.42,s*.045,0,7);g.fill()}}}
function lotus(g,r,w2){const W=r*.3,gr=g.createLinearGradient(0,-r*.1,0,-r);gr.addColorStop(0,w2?'#ffffff':'#fff1f7');gr.addColorStop(.55,w2?'#ffd6e6':'#ffb8d2');gr.addColorStop(1,w2?'#ff9fc4':'#ff7fae');
 g.fillStyle=gr;g.strokeStyle='rgba(150,40,90,.65)';g.lineWidth=2.2;g.lineJoin='round';g.beginPath();g.moveTo(0,-r*.1);g.bezierCurveTo(W*1.1,-r*.3,W*.95,-r*.78,0,-r);g.bezierCurveTo(-W*.95,-r*.78,-W*1.1,-r*.3,0,-r*.1);g.closePath();g.fill();g.stroke();
 g.strokeStyle='rgba(255,255,255,.6)';g.lineWidth=1.4;g.beginPath();g.moveTo(0,-r*.2);g.lineTo(0,-r*.8);g.stroke()}
/* a ring of little flowers lying on the ground (perspective squashed) */
function drawGarland(g,x,y,rx,rot,a,n,sz){g.save();g.translate(x,y);g.scale(1,.5);
 g.globalAlpha=a*.5;g.strokeStyle='rgba(255,205,225,1)';g.lineWidth=2;g.beginPath();g.arc(0,0,rx,0,7);g.stroke();g.globalAlpha=a;
 for(let i=0;i<n;i++){const an=rot+i*Math.PI*2/n;g.save();g.translate(Math.cos(an)*rx,Math.sin(an)*rx);g.scale(1,2);
  if(i%3===0){const c=GCOL[(i/3|0)%GCOL.length];sakura(g,sz,c==='#ffffff'?'#ffd0e2':c,'#ffe58a')}
  else{g.rotate(an+1.3);g.fillStyle=GCOL[(i*2+1)%GCOL.length];g.strokeStyle='rgba(120,30,75,.5)';g.lineWidth=.8;petalPath(g,sz*.75);g.fill();g.stroke()}
  g.restore()}
 g.restore()}
/* colour sampling of a sprite so the petals it turns into carry its own colours */
const SMP=new WeakMap();
function sampleCol(img,u,v){let s=SMP.get(img);if(!s){const w=40,h=Math.max(8,Math.round(40*((img.naturalHeight||40)/(img.naturalWidth||40)))),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});try{x.drawImage(img,0,0,w,h);s={w,h,d:x.getImageData(0,0,w,h).data}}catch(e){s={w,h,d:null}}SMP.set(img,s)}
 if(!s.d)return null;for(let n=0;n<6;n++){const xx=CL(Math.floor((u+R(-.06,.06))*s.w),0,s.w-1),yy=CL(Math.floor((v+R(-.05,.05))*s.h),0,s.h-1),i=(yy*s.w+xx)*4;if(s.d[i+3]>140)return'rgb('+s.d[i]+','+s.d[i+1]+','+s.d[i+2]+')'}return null}
const nz=(i,sd)=>{const x=Math.sin((i+1)*12.9898+sd*78.233)*43758.5453;return x-Math.floor(x)};
function mkBolt(x0,y0,x1,y1,n,j){const p=[[x0,y0]],dx=x1-x0,dy=y1-y0,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;for(let i=1;i<n;i++){const t=i/n,o=R(-j,j);p.push([x0+dx*t+nx*o,y0+dy*t+ny*o])}p.push([x1,y1]);return p}

/* always-on aura of a green boss: a garland of flowers on the ground, drifting petals and twinkles */
function auraBloom(g,o,main){if(RM())return;const id=o.id,S=ST[id]||(ST[id]={}),cx=o.x+o.w/2,fy=o.y+o.h,f=main?1:.62;
 g.save();g.filter='none';drawGarland(g,cx,fy-2,(main?o.w*.58+22:o.w*.46+10),fxT*(main?.3:.42),.8*f,main?16:11,main?7:5.5);g.restore();
 if(fxT-(S.au||0)>(main?.22:.55)&&PS.length<CONFIG.particles.max*.7){S.au=fxT;
  addP({k:'petal',x:cx+R(-o.w*.45,o.w*.45),y:fy-R(o.h*.3,o.h*1),vx:R(-10,16),vy:R(8,22),ay:2,dr:.995,s:R(3.5,5.5),l:R(2.2,3.6),c:bloomCol(),ph:R(0,6),flip:R(2,4),sway:R(3,6),r:R(0,6),vr:R(-2,2)});
  if(Math.random()<(main?.5:.25))addP({k:'sparkle',x:cx+R(-o.w*.5,o.w*.5),y:fy-R(0,o.h*.9),vx:R(-6,6),vy:-R(6,20),dr:.99,s:R(3,6),l:R(.9,1.5),c:pick(['#ffffff','#ffe0ec','#fff3b0']),ph:R(0,6)});
  if(!main&&Math.random()<.45)addP({k:'leaf',x:cx+R(-o.w*.45,o.w*.45),y:fy-R(o.h*.3,o.h),vx:R(-10,14),vy:R(8,20),ay:2,dr:.995,s:R(2.6,4),l:R(2,3.2),c:pick(GREENS),ph:R(0,6),flip:R(2,4),sway:R(3,6),r:R(0,6),vr:R(-2,2)})}}
/* green hit: flower mandala, a big blossom pops, petal burst, sparkles, petal cyclone */
function bloomImpact(I,k,tx,ty,tm,mc,bodyY){
 const big=CL(I.d/60,0,1),hh=tm?tm.h:80,rw=Math.max(50,Math.min(100,(tm?tm.w:80)*.5)),mini=!!tm&&tm!==mc;
 addE({k:'mandala',x:tx,y:ty,r:rw+22+k*14,n:8,dur:1.0,spin:.6});
 addE({k:'glow',x:tx,y:ty,up:tm?tm.h*.4:30,r:105,a:.75,c:'rgba(255,160,200,A)',dur:.55});
 addE({k:'ring',x:tx,y:ty,r:rw+24,lw:6,c:'rgba(255,170,205,.95)',dur:.5});later(.08,()=>addE({k:'ring',x:tx,y:ty,r:rw+66,lw:4,c:'rgba(255,255,255,.9)',dur:.6}));later(.18,()=>addE({k:'ring',x:tx,y:ty,r:rw+110+40*big,lw:3,c:'rgba(215,168,255,.7)',dur:.75}));
 addE({k:'bigflower',x:tx,y:bodyY-hh*.05,r:26+k*12+big*8,rot:R(-.3,.3),dur:.62,c:pick(['#ff9fc4','#ff8fb8']),leaf:mini});
 const np=34+Math.round(22*big);for(let i=0;i<np;i++){const a=R(0,6.28),sp=R(110,330);addP({k:'petal',x:tx,y:bodyY,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp*.7-60,ay:90,dr:.935,s:R(5,9),l:R(1.1,1.9),c:bloomCol(),ph:R(0,6),flip:R(3,7),r:R(0,6),vr:R(-6,6),sway:R(3,7)})}
 for(let i=0;i<9;i++){const a=R(0,6.28),sp=R(90,220);addP({k:'bloom',x:tx,y:bodyY,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp*.7-90,ay:200,dr:.94,s:R(7,11),l:R(.9,1.4),c:pick(PINKS),r:R(0,6),vr:R(-5,5)})}
 for(let i=0;i<16;i++)addP({k:'sparkle',x:tx+R(-45,45),y:bodyY+R(-50,35),vx:R(-20,20),vy:R(-50,-10),dr:.97,s:R(5,10),l:R(.5,1),c:pick(['#ffffff','#ffe8f2','#fff3b0','#ffd0e8']),ph:R(0,6)});
 for(let i=0;i<22;i++)addP({k:'petal',x:tx,y:bodyY,s:R(4,7),l:R(1,1.6),c:bloomCol(),ph:R(0,6),flip:R(3,6),r:R(0,6),vr:R(-5,5),orb:{cx:tx,cy:bodyY+hh*.12,ang:i/22*6.28,rad:R(14,28),va:R(5,9),vr:R(50,95),rise:R(25,70)}});
 if(mini){ /* mini boss hits: little green leaves, fresh sprouts of light and a green ring join the petals */
  for(let i=0;i<22;i++){const a=R(0,6.28),sp=R(100,300);addP({k:'leaf',x:tx,y:bodyY,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp*.7-60,ay:110,dr:.94,s:R(3.5,6),l:R(1,1.8),c:pick(GREENS),ph:R(0,6),flip:R(3,7),r:R(0,6),vr:R(-6,6),sway:R(3,6)})}
  for(let i=0;i<14;i++)addP({k:'leaf',x:tx,y:bodyY,s:R(3,5),l:R(1,1.6),c:pick(GREENS),ph:R(0,6),flip:R(3,6),r:R(0,6),vr:R(-5,5),orb:{cx:tx,cy:bodyY+hh*.12,ang:i/14*6.28+.2,rad:R(18,32),va:R(5,9),vr:R(45,85),rise:R(25,70)}});
  for(let i=0;i<12;i++)addP({k:'sparkle',x:tx+R(-45,45),y:bodyY+R(-50,35),vx:R(-24,24),vy:R(-60,-10),dr:.97,s:R(4,8),l:R(.6,1.1),c:pick(['#b8ff9a','#8ff06a','#e6ffc8']),ph:R(0,6)});
  for(let i=0;i<10;i++)addP({k:'dot',x:tx+R(-30,30),y:ty-R(0,hh*.7),vx:R(-18,18),vy:-R(40,110),dr:.99,s:R(3,6),l:R(.8,1.4),c:'#b9ff9a',add:1});
  later(.14,()=>addE({k:'ring',x:tx,y:ty,r:rw+84,lw:3,c:'rgba(140,235,100,.85)',dur:.7}))}
 flash('rgba(255,205,225,1)',.14+k*.14+big*.08,.3);if(big>.3)shake(3,.3)}
function bloomSummon(o,i){const cx=o.x+o.w/2,fy=o.y+o.h,rw=Math.max(44,o.w*.55);
 addE({k:'garland',x:cx,y:fy-2,r:rw+(i?8:30),n:i?12:22,sz:i?6:8,grow:1,spin:1.6,dur:1.6});
 if(!i)addE({k:'mandala',x:cx,y:fy,r:rw+30,n:8,dur:1.4,spin:.5});
 for(let j=0;j<(i?10:30);j++){const a=R(0,6.28),sp=R(40,140);addP({k:'petal',x:cx+Math.cos(a)*rw*.3,y:fy-R(0,20),vx:Math.cos(a)*sp,vy:-R(120,300),ay:260,dr:.985,s:R(4,7),l:R(1.2,2),c:bloomCol(),ph:R(0,6),flip:R(3,6),r:R(0,6),vr:R(-5,5),sway:R(3,6)})}
 for(let j=0;j<(i?6:16);j++)addP({k:'sparkle',x:cx+R(-rw,rw),y:fy-R(0,o.h*.8),vx:R(-10,10),vy:-R(20,60),dr:.98,s:R(4,8),l:R(.8,1.4),c:pick(['#ffffff','#ffe0ec','#fff3b0']),ph:R(0,6)})}

/* ---------- KO: the boss dissolves into petals from the feet up, then a giant blossom opens ---------- */
function koBloom(mc){const cx=mc.x+mc.w/2,cy=mc.y+mc.h*.5,fy=mc.y+mc.h,rw=Math.max(70,mc.w*.62),K={s:.3,d:1.8};
 slowmo(.3,.5);flash('rgba(255,215,232,1)',.38,.45);shake(7,.5);AU.duck(.3,3.6);AU.koBloom(0);
 const G=addGhost(mc,1,fxT,6,true);if(!G)return;G.ko={style:1,s:K.s,d:K.d,acc:0};G.life=K.s+K.d+.25;
 addE({k:'garland',x:cx,y:fy-2,r:rw+34,n:24,sz:9,grow:1,spin:1,dur:K.s+K.d+1.2});
 addE({k:'glow',x:cx,y:fy,up:mc.h*.45,r:170,a:.8,c:'rgba(255,170,205,A)',dur:1.2});
 addE({k:'mandala',x:cx,y:fy,r:rw+10,n:8,dur:K.s+K.d,spin:.5,hold:.82});
 for(let i=0;i<22;i++)addP({k:'sparkle',x:cx+R(-mc.w*.6,mc.w*.6),y:fy-R(0,mc.h),vx:R(-10,10),vy:-R(10,40),dr:.98,s:R(4,8),l:R(.8,1.5),c:pick(['#fff','#ffe0ec','#fff3b0']),ph:R(0,6)});
 laterFx(K.s,()=>AU.koBloom(1));laterFx(K.s+K.d-.15,()=>bloomFinale(mc,cx,cy,fy,rw))}
function bloomFinale(mc,cx,cy,fy,rw){AU.koBloom(2);flash('rgba(255,225,238,1)',.34,.5);shake(5,.5);
 addE({k:'mandala',x:cx,y:fy,r:rw+90,n:10,dur:2.4,spin:.4,hold:.7});
 addE({k:'shine',x:cx,y:cy,r:260,n:14,ph:R(0,6),c:'rgba(255,215,235,A)',dur:1.1});
 addE({k:'pillar',x:cx,y:fy,w:mc.w*.9+40,h:460,c:'rgba(255,205,228,A)',dur:1.5});
 for(let i=0;i<3;i++)laterFx(i*.12,()=>addE({k:'shock',x:cx,y:fy,r:160+i*80,lw:7-i*2,c:i===1?'rgba(255,255,255,.9)':'rgba(255,170,205,.9)',dur:.8}));
 for(let i=0;i<80;i++){const a=R(-1.1,1.1),sp=R(120,420);addP({k:'petal',x:cx+R(-20,20),y:fy-R(0,mc.h*.4),vx:Math.sin(a)*sp,vy:-Math.cos(a)*sp*R(.9,1.5),ay:210,dr:.97,s:R(5,9.5),l:R(2,3.4),c:bloomCol(),ph:R(0,6),flip:R(3,7),r:R(0,6),vr:R(-6,6),sway:R(3,7)})}
 for(let i=0;i<16;i++){const a=R(-1.2,1.2),sp=R(140,340);addP({k:'bloom',x:cx,y:fy-R(0,mc.h*.4),vx:Math.sin(a)*sp,vy:-Math.cos(a)*sp*R(.9,1.4),ay:240,dr:.96,s:R(8,13),l:R(1.6,2.6),c:pick(PINKS),r:R(0,6),vr:R(-4,4)})}
 for(let i=0;i<36;i++)addP({k:'petal',x:cx,y:cy,s:R(5,8),l:R(1.6,2.4),c:bloomCol(),ph:R(0,6),flip:R(3,6),r:R(0,6),vr:R(-5,5),orb:{cx,cy:cy+mc.h*.2,ang:R(0,6.28),rad:R(10,40),va:R(4,9),vr:R(40,110),rise:R(70,170)}});
 for(let i=0;i<40;i++)addP({k:'sparkle',x:cx+R(-180,180),y:fy-R(0,mc.h*1.2),vx:R(-14,14),vy:-R(10,60),dr:.99,s:R(4,9),l:R(1,2.2),c:pick(['#fff','#ffe0ec','#fff3b0','#ffd0e8']),ph:R(0,6)});
 [0,.4,.8,1.2].forEach(dl=>laterFx(dl,()=>{for(let i=0;i<24;i++)addP({k:'petal',x:cx+R(-330,330),y:cy-R(230,380),vx:R(-24,24),vy:R(30,80),ay:12,dr:.998,s:R(4,7.5),l:R(2.6,4),c:bloomCol(),ph:R(0,6),flip:R(2,5),sway:R(3,7),r:R(0,6),vr:R(-3,3)})}));
 const fl=[];for(let i=0;i<16;i++)fl.push({x:R(-170,170),y:R(-14,26),s:R(11,18),d:.2+i*.06,c:pick(PINKS.concat(['#ffffff','#ffe58a','#d9a8ff']))});addE({k:'bed',x:cx,y:fy,fl,dur:3.8})}
function koBloomDraw(g,G,t){const T=fxT-G.t0,K=G.ko,p=CL((T-K.s)/K.d,0,1),e=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;if(p>=1)return;
 const I=idle(G.id,t,true),r=react(1,T,1.1);let sx=I.sx,sy=I.sy,ox=0,oy=I.oy,tn=0;if(r){sx*=r.sx;sy*=r.sy;ox=r.ox;oy+=r.oy;tn=r.tint||0}
 oy-=e*16;const Wc=G.w+40,Hc=G.h+40;
 if(!G._c){G._c=document.createElement('canvas');G._c.width=Wc*2;G._c.height=Hc*2;G._x=G._c.getContext('2d')}
 const x=G._x,ly=G.h+20-G.h*e*1.06;
 x.setTransform(2,0,0,2,0,0);x.globalCompositeOperation='source-over';x.filter='none';x.clearRect(0,0,Wc,Hc);
 x.save();x.translate(Wc/2,G.h+20);drawSprite(x,G.i,G.w,G.h,0);x.restore();
 x.globalCompositeOperation='source-atop';let gr=x.createLinearGradient(0,ly-34,0,ly+2);gr.addColorStop(0,'rgba(255,170,205,0)');gr.addColorStop(.7,'rgba(255,190,220,.75)');gr.addColorStop(1,'rgba(255,255,255,.95)');x.fillStyle=gr;x.fillRect(0,0,Wc,Hc);
 x.globalCompositeOperation='destination-in';gr=x.createLinearGradient(0,ly-24,0,ly);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gr;x.fillRect(0,0,Wc,Hc);
 g.save();g.translate(G.x+G.w/2+ox,G.y+G.h+oy);g.scale(sx*(1-.04*e),sy*(1-.04*e));if(tn>.01)g.filter='brightness('+(1+tn*1.1).toFixed(2)+') saturate('+(1+tn*.8).toFixed(2)+')';g.drawImage(G._c,-Wc/2,-(G.h+20),Wc,Hc);g.restore();
 /* petals + twinkles lift off along the dissolve edge */
 const fyw=G.y+G.h+oy,front=fyw-G.h*e*1.06*sy;K.acc+=dtS*100*Math.sin(Math.PI*p);
 while(K.acc>=1){K.acc-=1;const u=R(.22,.78),v=CL(1-e*1.06+R(-.03,.05),0,1),px=G.x+G.w*u+ox,py=front+R(-4,6),col=(Math.random()<.45&&sampleCol(G.i,u,v))||bloomCol();
  addP({k:'petal',x:px,y:py,vx:R(35,150),vy:-R(25,120),ay:-14,dr:.985,s:R(4.5,8.5),l:R(1.7,3),c:col,ph:R(0,6),flip:R(3,7),r:R(0,6),vr:R(-5,5),sway:R(3,7)});
  if(Math.random()<.3)addP({k:'sparkle',x:px,y:py,vx:R(10,60),vy:-R(20,60),dr:.98,s:R(3.5,6.5),l:R(.7,1.2),c:'#fff',ph:R(0,6)})}}

/* ---------- KO: the purple boss destabilises (glitch + lightning in a rune cage), collapses into a black hole and detonates ---------- */
function koVoid(mc){const cx=mc.x+mc.w/2,cy=mc.y+mc.h*.5,fy=mc.y+mc.h,rw=Math.max(70,mc.w*.6),K={s:.25,dA:.95,dB:.5},D=K.s+K.dA+K.dB;
 slowmo(.3,.5);flash('rgba(110,60,210,1)',.38,.45);chroma(.5);shake(8,.6);AU.duck(.3,3.4);AU.koVoid(0);
 const G=addGhost(mc,2,fxT,6,true);if(!G)return;G.ko={style:2,s:K.s,dA:K.dA,dB:K.dB,acc:0};G.life=D+.1;
 addE({k:'rune',x:cx,y:fy,r:rw+44,dur:D+.6});
 [[.32,2.6],[0,-2.2],[-.32,3]].forEach(([hy,sp],i)=>addE({k:'sigil',x:cx,y:cy+mc.h*hy,r:rw*1.05+i*5,spin:sp,sh0:(K.s+K.dA-.1)/D,shd:.6/D,dur:D}));
 for(let i=0;i<11;i++)laterFx(K.s+i*.08,()=>{const a=R(0,6.28),x0=cx+Math.cos(a)*(rw+30),y0=fy+Math.sin(a)*(rw+30)*.5;addE({k:'bolt',p:mkBolt(x0,y0,cx+R(-mc.w*.3,mc.w*.3),cy+R(-mc.h*.4,mc.h*.3),9,16),dur:.2})});
 laterFx(K.s,()=>AU.koVoid(1));
 laterFx(K.s+K.dA-.05,()=>{AU.koVoid(2);addE({k:'orb',x:cx,y:cy,r:44,dur:K.dB+.2});
  for(let i=0;i<54;i++){const rad=R(70,170),vr=-R(120,220),kd=pick(['dot','sparkle','shard']);addP({k:kd,x:cx,y:cy,s:kd==='shard'?R(4,8):R(4,8),l:rad/-vr,c:pick(['#b98cff','#e2c4ff','#ff9bf0','#ffffff']),add:1,ph:R(0,6),r:R(0,6),vr:R(-8,8),orb:{cx,cy,ang:R(0,6.28),rad,va:R(6,12)*(Math.random()<.5?1:-1),vr,rise:0}})}});
 laterFx(D,()=>voidBoom(mc,cx,cy,fy,rw))}
function voidBoom(mc,cx,cy,fy,rw){AU.koVoid(3);flash('rgba(215,185,255,1)',.45,.5);chroma(.35);shake(9,.7);
 for(let i=0;i<3;i++)laterFx(i*.1,()=>addE({k:'shock',x:cx,y:fy,r:150+i*85,lw:8-i*2,c:i===1?'rgba(255,255,255,.9)':'rgba(185,140,255,.9)',dur:.8}));
 addE({k:'pillar',x:cx,y:fy,w:90,h:540,c:'rgba(190,140,255,A)',dur:1.3});addE({k:'pillar',x:cx,y:fy,w:34,h:600,c:'rgba(255,240,255,A)',dur:.9});
 addE({k:'glow',x:cx,y:cy,up:0,r:210,a:.9,c:'rgba(210,170,255,A)',dur:.5});addE({k:'shine',x:cx,y:cy,r:250,n:14,ph:R(0,6),c:'rgba(215,180,255,A)',dur:.7});
 for(let i=0;i<40;i++){const a=R(0,6.28),sp=R(200,520);addP({k:'shard',x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-60,ay:200,dr:.95,s:R(6,13),l:R(.9,1.6),c:pick(['#7a3cff','#b98cff','#e2c4ff']),r:R(0,6),vr:R(-9,9)})}
 for(let i=0;i<14;i++){const an=i/14*6.283,x0=cx+Math.cos(an)*(rw+44),y0=fy+Math.sin(an)*(rw+44)*.5;addP({k:'shard',x:x0,y:y0,vx:Math.cos(an)*R(120,260),vy:Math.sin(an)*R(60,140)-R(40,120),ay:230,dr:.97,s:R(8,13),l:R(1,1.7),c:'#d3a6ff',r:an,vr:R(-6,6)})}
 for(let i=0;i<34;i++)addP({k:'sparkle',x:cx+R(-120,120),y:cy+R(-90,70),vx:R(-24,24),vy:-R(10,70),dr:.99,s:R(4,9),l:R(1,2.2),c:pick(['#ffffff','#e2c4ff','#ff9bf0','#b98cff']),ph:R(0,6)});
 for(let i=0;i<26;i++)addP({k:'dot',x:cx+R(-90,90),y:fy-R(0,mc.h*.9),vx:R(-14,14),vy:-R(20,70),dr:.995,s:R(4,8),l:R(2,3.4),c:pick(['#e2c4ff','#ff9bf0','#b98cff']),add:1});
 for(let i=0;i<12;i++)addP({k:'smoke',x:cx+R(-40,40),y:cy+R(-20,30),vx:R(-50,50),vy:R(-60,-10),dr:.96,s:R(14,24),l:R(1,1.7),c:'rgba(80,30,150,1)',al:.5,grow:1.8});
 [0,.35,.7].forEach(dl=>laterFx(dl,()=>{for(let i=0;i<20;i++)addP({k:'sparkle',x:cx+R(-300,300),y:cy-R(240,360),vx:R(-12,12),vy:R(30,80),dr:.998,s:R(3.5,7),l:R(2.2,3.6),c:pick(['#ffffff','#e2c4ff','#ff9bf0']),ph:R(0,6)})}))}
function koVoidDraw(g,G,t){const T=fxT-G.t0,K=G.ko,iw=G.i.naturalWidth||G.w,ih=G.i.naturalHeight||G.h,pA=CL((T-K.s)/K.dA,0,1),pB=CL((T-K.s-K.dA)/K.dB,0,1);if(pB>=1)return;
 const I=idle(G.id,t,true),hr=react(2,T,1.2);let ox=0,oy=I.oy;if(hr){ox=hr.ox;oy+=hr.oy}
 const q=pB*pB*pB,sc=1-.96*q,ch=-G.h*.52,N=14,sh=G.h/N,sy=ih/N,amp=pA*(1-pB),rgb=amp*9+pB*5,step=Math.floor(T*18);
 g.save();g.translate(G.x+G.w/2+ox,G.y+G.h+oy);g.translate(0,ch);g.rotate(q*.9);g.scale(sc*(1-.25*q),sc*(1+.9*q));g.translate(0,-ch);
 g.globalAlpha=(Math.sin(T*47)>(.92-1.4*pA)?.35:1)*(1-Math.max(0,pB-.8)/.2);
 const strip=(i,o)=>{const sy0=i*sy,hh=Math.min(sy+.5,ih-sy0);g.drawImage(G.i,0,sy0,iw,hh,-G.w/2+o,-G.h+i*sh,G.w,hh/ih*G.h+.1)};
 if(amp>.03){for(const [dx,flt] of [[-1,'hue-rotate(150deg) saturate(3) brightness(1.3)'],[1,'hue-rotate(300deg) saturate(3) brightness(1.3)']]){g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=.45;g.filter=flt;for(let i=0;i<N;i++)strip(i,(nz(i,step)-.5)*2*amp*16+dx*rgb);g.restore()}}
 g.filter='brightness('+(1+pB*1.6+pA*.15).toFixed(2)+') saturate('+(1+pB).toFixed(2)+')';
 for(let i=0;i<N;i++){const n=nz(i,step);strip(i,n>.62?(n-.62)/.38*amp*34*(i%2?1:-1):0)}
 g.restore();
 K.acc+=dtS*45*pA*(1-pB);while(K.acc>=1){K.acc-=1;const a=R(0,6.28),dir=Math.random()<.5?-1:1;addP({k:'shard',x:G.x+G.w/2+R(-G.w*.3,G.w*.3),y:G.y+G.h-R(0,G.h),vx:dir*R(60,200),vy:R(-80,40),ay:80,dr:.96,s:R(3,7),l:R(.5,.9),c:pick(['#b98cff','#e2c4ff','#ff9bf0']),r:a,vr:R(-8,8)})}}
function koDraw(g,G,t){if(G.ko.style===1)koBloomDraw(g,G,t);else koVoidDraw(g,G,t)}
/* test helpers used by the Edit tab */
function bossHit(I){const mc=I.main;if(!mc)return;const s=I.style|0,k=CL(I.d/15,0,1),tx=mc.x+mc.w/2,ty=mc.y+mc.h-6,J={...I,defeated:false,test:true,amp:I.amp||(s===1?1.05:.8)};AU.windup(s);later(CONFIG.attack.windup,()=>impact(J,s,k,tx,ty,mc,mc))}
function heal(I){const mc=I.main;if(!mc)return;const s=I.style|0,cx=mc.x+mc.w/2,fy=mc.y+mc.h,cy=mc.y+mc.h*.5,c=COL[STYLE_NAMES[s]];if(AU.heal)AU.heal(s);
 if(s===1){addE({k:'garland',x:cx,y:fy-2,r:Math.max(60,mc.w*.62),n:20,sz:8,grow:1,spin:1.6,dur:1.3});addE({k:'mandala',x:cx,y:fy,r:Math.max(56,mc.w*.5),n:8,dur:1.1,spin:.5});
  for(let i=0;i<16;i++)addP({k:'petal',x:cx+R(-mc.w*.4,mc.w*.4),y:fy-R(0,mc.h*.4),vx:R(-20,20),vy:-R(60,150),ay:-10,dr:.985,s:R(4,7),l:R(1.2,2),c:bloomCol(),ph:R(0,6),flip:R(3,6),r:R(0,6),vr:R(-4,4),sway:R(3,6)});
  for(let i=0;i<14;i++)addP({k:'sparkle',x:cx+R(-mc.w*.5,mc.w*.5),y:fy-R(0,mc.h),vx:R(-8,8),vy:-R(20,70),dr:.98,s:R(4,8),l:R(.9,1.5),c:pick(['#fff','#ffe0ec','#fff3b0']),ph:R(0,6)})}
 else if(s===2)addE({k:'rune',x:cx,y:fy,r:Math.max(56,mc.w*.5),dur:1.0});
 addE({k:'ring',x:cx,y:fy,r:70,lw:5,c:c[1],dur:.6});later(.15,()=>addE({k:'ring',x:cx,y:fy,r:105,lw:4,c:c[0],dur:.7}));
 addE({k:'pillar',x:cx,y:fy,w:mc.w*.7+16,h:300,c:s===1?'rgba(255,200,225,A)':s===2?'rgba(190,130,255,A)':'rgba(255,236,160,A)',dur:1.0});
 for(let i=0;i<22;i++)addP({k:'dot',x:cx+R(-mc.w*.4,mc.w*.4),y:fy-R(0,mc.h*.5),vx:R(-10,10),vy:-R(50,130),dr:.99,s:R(3,7),l:R(.9,1.6),c:c[2],add:1});
 for(let i=0;i<9;i++)addP({k:'cross',x:cx+R(-mc.w*.4,mc.w*.4),y:fy-R(0,mc.h*.4),vx:R(-12,12),vy:-R(60,120),dr:.99,s:R(5,8),l:R(.9,1.5),c:c[1]});
 addE({k:'dmg',x:cx,y:cy-mc.h*.3,vx:0,vy:-90,g:60,d:I.amt,fs:30,c:s===1?'#ffc0d8':'#9dff7a',dur:1.1,sg:'+'});flash(s===1?'rgba(255,205,225,1)':s===2?'rgba(190,150,255,1)':'rgba(255,240,190,1)',.1,.3)}
function previewDefeat(I){const mc=I.main;if(!mc)return;const s=I.style|0,id=mc.id;ST[id]={...(ST[id]||{}),hide:true};defeatMain(s,mc,I.ents||[]);later(s===1?6.4:5.4,()=>{if(ST[id])ST[id].hide=false;summon([mc],s)})}


/* =====================================================================
   Sprite idle / hit reactions
   ===================================================================== */
function idle(id,t,main){const h=hash(id),off=(h%628)/100,sp=CONFIG.idle.speed*(.85+(h%7)/20),k=RM()?.3:1,fl=Math.sin(t*sp+off),br=Math.sin(t*sp*1.35+off*1.7);
 const amp=(main?CONFIG.idle.amp:CONFIG.idle.miniAmp)*k,sy=1+br*CONFIG.idle.breathe*k;return{oy:-fl*amp-amp,sx:1-(sy-1)*.6,sy,fl}}
function react(style,dt,amp){amp=amp==null?1:amp;if(dt<0)return null;
 if(style===0){if(dt>.9)return null;const v=Math.sin(dt*22)*Math.exp(-dt*6.5);return{sx:1+.3*v*amp,sy:1-.32*v*amp,rot:0,ox:0,oy:-Math.abs(Math.sin(dt*13))*Math.exp(-dt*5)*10*amp,glitch:0}}
 if(style===1){if(dt>1.1)return null;const e=Math.exp(-dt*5.2),w=Math.sin(dt*22)*e*amp;return{sx:1+.16*w,sy:1-.16*w,rot:Math.sin(dt*14)*e*.12*amp,ox:Math.sin(dt*14+1)*e*6*amp,oy:-Math.abs(Math.sin(dt*9))*Math.exp(-dt*4)*8*amp,glitch:0,tint:Math.max(0,1-dt/.22)*Math.min(1,amp+.3)}}
 if(dt>.9)return null;const gl=dt<.3?1:0,tr=Math.exp(-dt*8)*amp;return{sx:1,sy:1,rot:0,ox:(Math.random()-.5)*8*tr,oy:(Math.random()-.5)*3*tr,glitch:gl}}
function drawSprite(g,img,w,h,gl){if(gl&&!RM()){const iw=img.naturalWidth||w,ih=img.naturalHeight||h,band=Math.random()<.5;
  if(band){for(let i=0;i<4;i++){const off=(Math.random()-.5)*14;g.drawImage(img,0,i*ih/4,iw,ih/4,-w/2+off,-h+i*h/4,w,h/4)}g.save();g.globalAlpha*=.4;g.globalCompositeOperation='lighter';g.filter='hue-rotate(250deg) saturate(3)';g.drawImage(img,-w/2+5,-h,w,h);g.restore()}
  else{g.save();g.globalAlpha*=.55;g.drawImage(img,-w/2-6,-h,w,h);g.filter='hue-rotate(160deg) saturate(3)';g.drawImage(img,-w/2+6,-h,w,h);g.restore();g.globalAlpha*=.7;g.drawImage(img,-w/2,-h,w,h)}}
 else g.drawImage(img,-w/2,-h,w,h)}
function obj(g,o,t){const id=o.id;if(!id){g.drawImage(o.i,o.x,o.y,o.w,o.h);return}
 const main=id.slice(-2)===':c',I=idle(id,t,main),S=ST[id];let sx=I.sx,sy=I.sy,rot=0,ox=0,oy=I.oy,gl=0,tn=0;
 if(S&&S.hide)return;
 if(o.st===1&&!o.dim)auraBloom(g,o,main);
 if(S){if(S.sum!==undefined){const k=CL((fxT-S.sum)/.75,0,1);g.globalAlpha*=eo3(k);const sc=.55+.45*eoB(k);sx*=sc;sy*=sc;oy+=(1-k)*16;if(k>=1)S.sum=undefined}
  if(S.hit!==undefined){const r=react(S.style,fxT-S.hit,S.amp);if(r){sx*=r.sx;sy*=r.sy;rot+=r.rot;ox+=r.ox;oy+=r.oy;gl=r.glitch;tn=r.tint||0}else if(fxT-S.hit>1.3)S.hit=undefined}}
 g.translate(o.x+o.w/2+ox,o.y+o.h+oy);g.rotate(rot);g.scale(sx,sy);if(tn>.01)g.filter=(g.filter&&g.filter!=='none'?g.filter+' ':'')+'brightness('+(1+tn*1.1).toFixed(2)+') saturate('+(1+tn*.8).toFixed(2)+')';drawSprite(g,o.i,o.w,o.h,gl)}
const shk=(si,t)=>{const o=typeof OBJ!=='undefined'&&OBJ[si];if(!o||!o.id)return 1;return 1-idle(o.id,t,o.id.slice(-2)===':c').fl*.07};

/* ghosts: the hit mini boss / defeated bosses stay on screen a moment so the effect can play */
function addGhost(o,style,hitAt,life,main){if(!o||!o.i)return null;const G={i:o.i,x:o.x,y:o.y,w:o.w,h:o.h,b:o.b,id:o.id||'g',t0:fxT,hitAt,style,life,main:!!main};GH.push(G);return G}
function ghostItems(it,g,t){for(let i=GH.length-1;i>=0;i--){const G=GH[i],T=fxT-G.t0;if(T>G.life){GH.splice(i,1);continue}
 it.push([G.b+.1,()=>{if(G.ko){koDraw(g,G,t);return}g.save();const I=idle(G.id,t,G.main);let sx=I.sx,sy=I.sy,rot=0,ox=0,oy=I.oy,gl=0,al=1,tn=0;const dh=fxT-G.hitAt;
  if(dh>=0){const r=react(G.style,dh,G.main?.6:1);if(r){sx*=r.sx;sy*=r.sy;rot=r.rot;ox=r.ox;oy+=r.oy;gl=r.glitch;tn=r.tint||0}
   if(!G.main||G.fade){const f=CL((dh-(G.fade?0:.26))/(G.fade?.34:.34),0,1);al=1-f;const sc=1-.18*f;sx*=sc;sy*=sc;oy-=f*10}}
  g.globalAlpha=al;g.translate(G.x+G.w/2+ox,G.y+G.h+oy);g.rotate(rot);g.scale(sx,sy);if(tn>.01)g.filter='brightness('+(1+tn*1.1).toFixed(2)+') saturate('+(1+tn*.8).toFixed(2)+')';drawSprite(g,G.i,G.w,G.h,gl);g.restore()}])}}

/* =====================================================================
   Mira: breathing, bob, squash, dust, footsteps, attack lunge
   ===================================================================== */
const MI={x:0,y:0,mv:false,wasMv:false,sq:0,sqT:-9,stepN:0,lunge:null,ground:null};
function groundAt(x,y){ /* sample the baked tile art under Mira's feet: pale = path/stone, else grass */
 try{if(!MI.ground){const im=$('#tl');if(!im||!im.naturalWidth)return 0;const c=document.createElement('canvas');c.width=1472;c.height=832;const x2=c.getContext('2d',{willReadFrequently:true});x2.drawImage(im,0,0,1472,832);MI.ground=x2}
  const d=MI.ground.getImageData(CL(Math.round(x),0,1471),CL(Math.round(y),0,831),1,1).data;return(d[0]>d[1]*1.02&&d[0]>150)?1:0}catch(e){return 0}}
function nearStairs(){try{if(typeof HALL==='undefined'||typeof cur==='undefined')return false;return Math.max(Math.abs(cur[0]-HALL[0]),Math.abs(cur[1]-HALL[1]))<=1}catch(e){return false}}
function mira(g,img,px,py,hop,t,mv,gt){const fx=px-6.5,fy=py+10;MI.x=fx;MI.y=fy;
 if(mv!==MI.wasMv){MI.sq=mv?CONFIG.mira.squashStart:CONFIG.mira.squashStop;MI.sqT=fxT;MI.sqDir=mv?1:-1;MI.wasMv=mv}
 if(mv){const n=Math.floor(t*14/Math.PI);if(n!==MI.stepN){MI.stepN=n;footfall(fx,fy)}}
 let sx=1,sy=1,ox=0,oy=0,rot=0;
 if(!mv){const b=Math.sin(t*2.2);sy=1+b*CONFIG.mira.breathe*(RM()?.3:1);sx=1-(sy-1)*.7}
 const sqk=CL((fxT-MI.sqT)/MI.sq,0,1);if(MI.sq&&sqk<1){const v=Math.sin(sqk*Math.PI)*.1*(RM()?.4:1);if(MI.sqDir>0){sy-=v;sx+=v*.8}else{sy+=v*.6;sx-=v*.5}}
 if(mv){sx+=Math.abs(Math.sin(t*14))*.012;rot=Math.sin(t*7)*.018}
 if(gt){sy*=1-gt.sq;sx*=1+gt.sq*.55;rot=gt.lean}   /* climbing the stairs: lean into each step, squash as the foot lands */
 const L=MI.lunge;if(L){const e=fxT-L.t0,W=CONFIG.attack.windup,a=L.amt;let off=0;
  if(e<W)off=-7*a*eo3(e/W);else if(e<W+.09)off=LP(-7*a,18*a,eo3((e-W)/.09));else if(e<W+.35)off=LP(18*a,0,eo3((e-W-.09)/.26));else MI.lunge=null;
  ox+=L.ux*off;oy+=L.uy*off*.6;if(L.s===1)oy-=Math.sin(CL(e/.5,0,1)*Math.PI)*7;if(L.s===2)rot+=-L.ux*Math.sin(CL(e/.5,0,1)*Math.PI)*.07;
  if(e>=W&&e<W+.12){sx*=1+.08*a;sy*=1-.08*a}}
 g.translate(fx+ox,fy-hop+oy);g.rotate(rot);g.scale(sx,sy);g.drawImage(img,-34,-153,68,153)}
function footfall(x,y){return;const st=nearStairs(),stone=!st&&groundAt(x,y)===1;AU.step(st?'stairs':stone?'stone':'grass');if(RM())return;
 for(let i=0;i<CONFIG.mira.dust;i++)addP({k:'smoke',x:x+R(-7,7),y:y+R(-1,2),vx:R(-14,14),vy:R(-14,-4),dr:.94,s:R(4,7),l:R(.35,.55),c:stone?'rgba(220,210,190,1)':'rgba(190,200,150,1)',al:.35,grow:1.4})}

/* =====================================================================
   Shake, flash, hit-stop, chromatic split
   ===================================================================== */
const SK={amp:0,t0:0,dur:0,on:false},SHK_EL=[];
function shake(amp,dur){if(RM())amp*=.25;if(amp<.3)return;SK.amp=Math.max(SK.on?SK.amp*Math.max(0,1-(now-SK.t0)/SK.dur):0,Math.min(amp,CONFIG.shake.max));SK.t0=now;SK.dur=dur||CONFIG.shake.dur;SK.on=true}
function applyShake(){if(!SHK_EL.length){['#tl','#oc','#cv'].forEach(s=>{const e=$(s);if(e)SHK_EL.push(e)})}
 if(!SK.on)return;const k=1-(now-SK.t0)/SK.dur;if(k<=0){SK.on=false;SHK_EL.forEach(e=>e.style.translate='');if(SK.bg){SK.bg=false;bgShift(0,0)}return}
 const a=SK.amp*k*k,x=(Math.random()*2-1)*a,y=(Math.random()*2-1)*a;SHK_EL.forEach(e=>e.style.translate=x.toFixed(2)+'px '+y.toFixed(2)+'px');if(SK.bg)bgShift(x,y)}
function bgShift(x,y){const s=$('#stage');if(!s)return;if(!x&&!y){s.style.backgroundPosition='';s.style.backgroundRepeat='';return}s.style.backgroundRepeat='no-repeat';s.style.backgroundPosition=x.toFixed(2)+'px '+y.toFixed(2)+'px'}
let flashEl=null;
function flash(color,alpha,dur){if(!flashEl){flashEl=document.createElement('div');flashEl.id='fxflash';(($('#stage'))||document.body).appendChild(flashEl)}
 alpha*=RM()?.3:1;flashEl.style.transition='none';flashEl.style.background=color;flashEl.style.opacity=alpha;void flashEl.offsetWidth;flashEl.style.transition='opacity '+(dur||CONFIG.flash.dur)+'s ease-out';flashEl.style.opacity=0}
function chroma(dur){if(RM())return;const c=$('#cv');if(!c)return;c.style.filter='drop-shadow(4px 0 0 rgba(255,40,140,.6)) drop-shadow(-4px 0 0 rgba(40,220,255,.6))';later(dur,()=>{c.style.filter=''})}
function hitStop(sec){if(RM())return;hitUntil=Math.max(hitUntil,now+sec)}
function slowmo(sc,dur){if(RM())return;slowFrom=now;slowUntil=now+dur;slowScale=sc}
let slowScale=1;

/* =====================================================================
   HP bars: smooth drain + delayed ghost
   ===================================================================== */
const HPS={};
function hp(b){const id=b.id,tg=CL(b.hp/b.max,0,1);let s=HPS[id];if(!s){s=HPS[id]={d:tg,g:tg,t:-9,f:-1,last:tg};return tg}
 if(s.f!==frameNo){s.f=frameNo;if(tg<s.last-1e-6)s.t=now;s.last=tg;s.d+=(tg-s.d)*(1-Math.exp(-dtR*CONFIG.hp.smooth));if(Math.abs(tg-s.d)<.0006)s.d=tg;
  if(tg>s.g)s.g=s.d;else if(now-s.t>CONFIG.hp.ghostHold)s.g=Math.max(s.d,s.g-CONFIG.hp.ghostSpeed*dtR)}
 return s.d}
function ghostBar(g,id,x,y,w,h){const s=HPS[id];if(!s||s.g<=s.d+.002)return;g.save();g.fillStyle='rgba(255,236,170,.92)';g.beginPath();g.rect(x+w*s.d,y,w*(s.g-s.d),h);g.fill();g.restore()}

/* =====================================================================
   Attack sequences, one per boss style
   ===================================================================== */
function attack(I){const s=I.style|0,k=CL(I.d/15,0,1),W=CONFIG.attack.windup,tm=I.mini,mc=I.main;
 const tx=tm?tm.x+tm.w/2:MI.x,ty=tm?tm.y+tm.h-4:MI.y,dx=tx-MI.x,dy=ty-MI.y,dist=Math.hypot(dx,dy)||1,ux=dx/dist,uy=dy/dist;
 MI.lunge={t0:fxT,ux,uy,s,amt:s===0?1:.4};
 const hitAt=fxT+W,ents=I.ents||[];
 if(tm)addGhost(tm,s,hitAt,W+CONFIG.attack.ghost+.4,false);
 if(I.defeated){ents.forEach(o=>{if(o===tm||o===mc)return;const G=addGhost(o,s,hitAt+.1,.6,false);if(G)G.fade=1})}
 AU.windup(s);
 later(W,()=>impact(I,s,k,tx,ty,tm,mc))}
function impact(I,s,k,tx,ty,tm,mc){const bodyY=ty-(tm?tm.h*.5:40),d=I.d;
 hitStop(LP(CONFIG.hitStop.min,CONFIG.hitStop.max,k));shake(CONFIG.shake.base+CONFIG.shake.perDmg*d,CONFIG.shake.dur);AU.hit(s,k);AU.duck(.5,.8);
 const col=COL[STYLE_NAMES[s]];
 if(s===0){addE({k:'pow',x:tx,y:bodyY-6,r:30+k*14,rot:R(-.25,.25),dur:.5});
  for(let i=0;i<8;i++){const a=i/8*6.28+R(-.2,.2),sp=R(110,230);addP({k:'star',x:tx,y:bodyY,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-40,ay:260,dr:.95,s:R(5,9),l:R(.5,.8),c:'#ffd23c',vr:R(-6,6)})}
  for(let i=0;i<9;i++)addP({k:'smoke',x:tx+R(-14,14),y:ty+R(-3,3),vx:R(-60,60),vy:R(-30,-6),dr:.93,s:R(6,11),l:R(.4,.7),c:'rgba(230,215,185,1)',al:.55,grow:1.8});
  addE({k:'ring',x:tx,y:ty,r:50+k*22,lw:5,c:'#fff3b0',dur:.35})}
 else if(s===1){bloomImpact(I,k,tx,ty,tm,mc,bodyY)}
  else{addE({k:'rune',x:tx,y:ty,r:56,dur:.8});addE({k:'glow',x:tx,y:ty,up:tm?tm.h*.45:30,r:90,a:.6,c:'rgba(155,92,255,A)',dur:.5});
  for(let i=0;i<3;i++){const y0=bodyY+R(-30,20),yo=R(-34,34);addE({k:'slash',x0:tx-R(34,52),y0:y0-yo,x1:tx+R(34,52),y1:y0+yo,dur:.45})}
  for(let i=0;i<16;i++){const a=R(0,6.28),sp=R(110,260);addP({k:'spark',x:tx,y:bodyY,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-30,dr:.93,ay:80,s:R(6,12),l:R(.35,.7),c:['#b98cff','#e2c4ff','#ff9bf0'][RI(0,2)]})}
  for(let i=0;i<7;i++)addP({k:'smoke',x:tx+R(-18,18),y:ty-R(0,20),vx:R(-14,14),vy:R(-60,-28),dr:.97,s:R(10,16),l:R(.7,1.1),c:'rgba(90,40,160,1)',al:.55,grow:1.5});
  flash('rgba(150,90,255,1)',.28+k*.2,.3);chroma(.22)}
 /* floating damage number */
 const fs=CONFIG.dmgText.base+CONFIG.dmgText.perDmg*I.d;addE({k:'dmg',x:tx,y:bodyY-(tm?tm.h*.25:20),vx:R(-18,18),vy:-110,g:150,d:I.d,fs,c:col[0===s?0:1],dur:CONFIG.dmgText.life});
 if(mc&&!I.defeated)ST[mc.id]={hit:fxT+.06,style:s,amp:I.amp||(s===1?.9:.55)};
 if(I.defeated)later(.22,()=>defeatMain(s,mc,I.ents));else if(!I.test)later(.34,()=>AU.done());
 }
function defeat(I){if(!I)return;const s=I.style|0;(I.ents||[]).forEach(o=>{if(o===I.main)return;const G=addGhost(o,s,fxT,.55,false);if(G)G.fade=1});defeatMain(s,I.main,I.ents)}
function defeatMain(s,mc,ents){if(mc&&mc.i){if(s===1){koBloom(mc);return}if(s===2){koVoid(mc);return}}
 slowmo(CONFIG.slowmo.scale,CONFIG.slowmo.dur);flash('rgba(255,248,220,1)',CONFIG.flash.alpha,CONFIG.flash.dur+.15);shake(7,.5);AU.fanfare(s);AU.duck(.3,2.4);
 if(!mc||!mc.i)return;const cx=mc.x+mc.w/2,cy=mc.y+mc.h/2,fy=mc.y+mc.h;
 /* hold the boss sprite for a beat, then it breaks into pieces */
 const G=addGhost(mc,s,fxT,6,true);
 later(.28,()=>{{const gi=GH.indexOf(G);if(gi>=0)GH.splice(gi,1)}const img=mc.i,iw=img.naturalWidth||mc.w,ih=img.naturalHeight||mc.h,cols=7,rows=9,pw=iw/cols,ph=ih/rows,w=mc.w/cols,h=mc.h/rows;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const px=mc.x+(c+.5)*w,py=mc.y+(r+.5)*h,a=Math.atan2(py-cy,px-cx),sp=R(70,220);
   addP({k:'pc',im:img,sx:c*pw,sy:r*ph,sw:pw,sh:ph,w:w+.6,h:h+.6,x:px,y:py,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-R(40,150),ay:320,dr:.985,vr:R(-5,5),l:R(.9,1.5),fadeIn:0})}
  const cl=['#ff7a7a','#ffd23c','#7ad7ff','#9be36a','#ff9bf0','#fff'];for(let i=0;i<46;i++)addP({k:'conf',x:cx+R(-50,50),y:cy-R(20,90),vx:R(-90,90),vy:R(-170,-30),ay:170,dr:.985,s:R(3,5.5),l:R(1.3,2.1),c:cl[RI(0,cl.length-1)],ph:R(0,6),vr:R(-7,7)});
  for(let i=0;i<12;i++){const a=i/12*6.28;addP({k:'star',x:cx,y:cy,vx:Math.cos(a)*R(120,260),vy:Math.sin(a)*R(120,260)-60,ay:260,dr:.95,s:R(6,11),l:R(.7,1.1),c:'#ffd23c',vr:R(-6,6)})}
  addE({k:'ring',x:cx,y:fy,r:130,lw:6,c:'#fff3b0',dur:.6})})}

/* boss summon: light pillar and fade/scale-in */
function summon(os,style){const s=style|0;if(!os||!os.length)return;os.forEach(o=>{if(o&&o.id)ST[o.id]={...(ST[o.id]||{}),sum:fxT}});
 const m=os[0];if(!m)return;const c=s===1?'rgba(170,255,120,A)':s===2?'rgba(190,130,255,A)':'rgba(255,236,160,A)';
 os.forEach((o,i)=>{if(!o)return;addE({k:'pillar',x:o.x+o.w/2,y:o.y+o.h,w:o.w*.8+20,h:260,c,dur:1.1+i*.05});if(s===1)bloomSummon(o,i);
  for(let j=0;j<(i?5:10);j++)addP({k:'dot',x:o.x+o.w/2+R(-24,24),y:o.y+o.h-R(0,20),vx:R(-10,10),vy:-R(50,120),dr:.99,s:R(3,6),l:R(.8,1.4),c:'#fff6c0',add:1})});
 AU.summon(s);flash(s===2?'rgba(160,100,255,1)':s===1?'rgba(200,255,160,1)':'rgba(255,245,200,1)',.28,.5)}

/* =====================================================================
   Ambient motes (leaves, pollen, fireflies) - subtle, capped
   ===================================================================== */
const AM=[];let amT=0;
function spawnAmb(){const r=Math.random(),k=r<.45?'leaf':r<.8?'pollen':'fly';AM.push({k,x:R(0,1472),y:k==='leaf'?R(-30,300):R(180,780),vx:R(-8,8),vy:k==='leaf'?R(10,22):R(-6,6),ph:R(0,6),s:k==='leaf'?R(3.5,5):k==='fly'?R(3,4.5):R(1.5,2.4),l:R(9,16),a:0,c:k==='leaf'?['#8bc34a','#c2d86a','#d9a84a'][RI(0,2)]:k==='fly'?'#e6ff8a':'#fff3c0'})}
function ambient(g,dt){if(RM()&&AM.length>6)AM.length=6;const cap=RM()?5:CONFIG.particles.ambient;amT-=dt;if(AM.length<cap&&amT<=0){spawnAmb();amT=R(.2,.8)}
 for(let i=AM.length-1;i>=0;i--){const m=AM[i];m.a+=dt;if(m.a>m.l){AM.splice(i,1);continue}const k=m.a/m.l,al=Math.min(1,m.a/1.2)*(k>.85?(1-k)/.15:1);
  m.x+=(m.vx+Math.sin(m.a*(m.k==='fly'?1.4:.9)+m.ph)*(m.k==='leaf'?14:8))*dt;m.y+=(m.vy+(m.k==='fly'?Math.cos(m.a*1.1+m.ph)*8:0))*dt;
  g.save();g.translate(m.x,m.y);if(m.k==='leaf'){g.globalAlpha=al*.55;g.rotate(m.a*1.3+m.ph);g.scale(1,.4+.6*Math.abs(Math.cos(m.a*1.7+m.ph)));g.fillStyle=m.c;g.beginPath();g.ellipse(0,0,m.s*1.5,m.s*.8,0,0,7);g.fill()}
  else{const tw=m.k==='fly'?.45+.55*Math.abs(Math.sin(m.a*2.3+m.ph)):1;g.globalAlpha=al*tw*(m.k==='fly'?.85:.5);g.globalCompositeOperation='lighter';const gr=g.createRadialGradient(0,0,0,0,0,m.s*(m.k==='fly'?3.2:2));gr.addColorStop(0,m.c);gr.addColorStop(1,'rgba(255,255,200,0)');g.fillStyle=gr;g.beginPath();g.arc(0,0,m.s*(m.k==='fly'?3.2:2),0,7);g.fill()}
  g.restore()}}

/* =====================================================================
   AUDIO - all synthesised with Web Audio (no files)
   ===================================================================== */
const AU=(function(){
 let ctx=null,master,sfx,amb,mus,duckG,musLP,hamb=null,comp,noiseBuf,muted=false,vol=CONFIG.audio.master,musicTimer=0,nextNote=0,chordAt=0,chordI=0,ambOn=false;
 try{muted=localStorage.getItem('grove_mute')==='1';const v=parseFloat(localStorage.getItem('grove_vol'));if(v>=0&&v<=1)vol=v}catch(e){}
 const ok=()=>ctx&&ctx.state==='running'&&!muted;
 function init(){if(ctx)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;try{ctx=new AC()}catch(e){ctx=null;return}
  comp=ctx.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=4;comp.attack.value=.004;comp.release.value=.2;
  master=ctx.createGain();master.gain.value=muted?0:vol;sfx=ctx.createGain();sfx.gain.value=CONFIG.audio.sfx;amb=ctx.createGain();amb.gain.value=CONFIG.audio.ambient;mus=ctx.createGain();mus.gain.value=CONFIG.audio.musicOn?CONFIG.audio.music:0;duckG=ctx.createGain();
  sfx.connect(master);amb.connect(master);musLP=ctx.createBiquadFilter();musLP.type='lowpass';musLP.frequency.value=20000;mus.connect(musLP);musLP.connect(duckG);duckG.connect(master);master.connect(comp);comp.connect(ctx.destination);
  noiseBuf=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);const d=noiseBuf.getChannelData(0);let b0=0;for(let i=0;i<d.length;i++){const w=Math.random()*2-1;b0=.97*b0+.03*w;d[i]=(w*.5+b0*6)*.6}
  }
 function unlock(){init();if(ctx&&ctx.state==='suspended')ctx.resume()}
 function env(g,t,a,d,pk){g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0003,pk),t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d)}
 function tone(o){if(!ok())return;const t=o.t||ctx.currentTime,a=o.a||.005,d=o.d||.2,osc=ctx.createOscillator(),g=ctx.createGain();osc.type=o.type||'sine';osc.frequency.setValueAtTime(o.f,t);if(o.f2)osc.frequency.exponentialRampToValueAtTime(o.f2,t+(o.fd||a+d));if(o.det)osc.detune.value=o.det;
  let n=osc;if(o.lp){const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(o.lp,t);if(o.lp2)f.frequency.exponentialRampToValueAtTime(o.lp2,t+a+d);osc.connect(f);n=f}
  env(g,t,a,d,o.v==null?.2:o.v);n.connect(g);g.connect(o.bus||sfx);osc.start(t);osc.stop(t+a+d+.06);osc.onended=()=>{try{g.disconnect();osc.disconnect();if(n!==osc)n.disconnect()}catch(e){}}}
 function noise(o){if(!ok())return;const t=o.t||ctx.currentTime,a=o.a||.005,d=o.d||.15,src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();src.buffer=noiseBuf;f.type=o.type||'bandpass';f.Q.value=o.q||.8;f.frequency.setValueAtTime(o.f||1000,t);if(o.f2)f.frequency.exponentialRampToValueAtTime(o.f2,t+a+d);
  if(o.rev){g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0003,o.v||.2),t+d);g.gain.exponentialRampToValueAtTime(.0001,t+d+.04)}else env(g,t,a,d,o.v==null?.2:o.v);
  src.connect(f);f.connect(g);g.connect(o.bus||sfx);src.start(t,Math.random()*1.8);src.stop(t+a+d+.08);src.onended=()=>{try{g.disconnect();f.disconnect();src.disconnect()}catch(e){}}}
 const T0=()=>ctx.currentTime,NOTE=n=>440*Math.pow(2,(n-69)/12);
 /* ----- UI ----- */
 const last={tick:0,click:0};
 const api={
  unlock,get muted(){return muted},
  setMuted(m){muted=!!m;try{localStorage.setItem('grove_mute',muted?'1':'0')}catch(e){}if(ctx){master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(muted?0:vol,ctx.currentTime,.05)}},
  setVolume(v){vol=CL(v,0,1);try{localStorage.setItem('grove_vol',vol)}catch(e){}if(ctx&&!muted)master.gain.setTargetAtTime(vol,ctx.currentTime,.05)},
  tick(){if(!ok()||performance.now()-last.tick<70)return;last.tick=performance.now();tone({f:1900,type:'sine',a:.002,d:.03,v:.035})},
  click(){if(!ok()||performance.now()-last.click<40)return;last.click=performance.now();tone({f:620,f2:380,type:'triangle',a:.002,d:.07,v:.12});noise({type:'highpass',f:3000,a:.001,d:.015,v:.05})},
  panel(open){if(!ok())return;noise({f:open?380:1500,f2:open?1700:380,q:.9,a:.03,d:.2,v:.1});tone({f:open?330:440,f2:open?523:262,type:'sine',a:.01,d:.18,v:.05})},
  flip(){if(!ok())return;noise({f:600,f2:2200,q:1,a:.02,d:.16,v:.07})},
  step(kind){if(!ok())return;const p=R(.85,1.2),v=kind==='stairs'?.5:1;
   if(kind==='stone'){noise({type:'bandpass',f:2200*p,q:1.1,a:.001,d:.045,v:.17*v});tone({f:260*p,f2:170*p,type:'sine',a:.001,d:.05,v:.1*v})}
   else{noise({type:'lowpass',f:1000*p,q:.5,a:.002,d:.075,v:.2*v});noise({type:'highpass',f:3600,a:.001,d:.03,v:.04*v});if(kind==='stairs')tone({f:190*p,f2:120*p,type:'triangle',a:.001,d:.07,v:.09})}},
  /* ----- attacks ----- */
  windup(s){if(!ok())return;if(s===0)tone({f:300,f2:520,type:'sine',a:.01,d:.1,v:.05});else if(s===1)noise({f:700,f2:2400,q:1.2,a:.04,d:.13,v:.09});else{tone({f:90,f2:220,type:'sawtooth',lp:500,lp2:1500,a:.1,d:.06,v:.07,det:6});tone({f:92,f2:224,type:'sawtooth',lp:500,lp2:1500,a:.1,d:.06,v:.05,det:-6})}},
  hit(s,k){if(!ok())return;const t=T0(),v=.55+.45*k,p=1-.12*k;
   if(s===0){tone({f:230*p,f2:85,type:'sine',a:.002,d:.14,v:.5*v,t});noise({f:900,q:1.4,a:.001,d:.05,v:.22*v,t});tone({f:200,f2:620,type:'sine',a:.01,d:.07,v:.14*v,t:t+.03});tone({f:620,f2:240,type:'sine',a:.01,d:.2,v:.12*v,t:t+.1});
    tone({f:NOTE(79),type:'triangle',a:.004,d:.12,v:.12*v,t:t+.06});tone({f:NOTE(84),type:'triangle',a:.004,d:.18,v:.1*v,t:t+.12})}
   else if(s===1){tone({f:520*p,f2:900,type:'sine',a:.003,d:.12,v:.35*v,t});tone({f:200*p,f2:90,type:'sine',a:.003,d:.2,v:.4*v,t});noise({type:'bandpass',f:3200,f2:1800,q:1.5,a:.003,d:.2,v:.14*v,t});noise({type:'highpass',f:6000,a:.002,d:.25,v:.07*v,t:t+.02});
    [NOTE(84),NOTE(88),NOTE(91),NOTE(96)].forEach((f,i)=>tone({f,type:'sine',a:.004,d:.45,v:.085*v,t:t+.03+i*.05}));tone({f:NOTE(72),type:'triangle',lp:1400,a:.01,d:.5,v:.06*v,t:t+.02})}
   else{tone({f:110,f2:330,type:'sawtooth',lp:400,lp2:2400,a:.12,d:.05,v:.1*v,t:t-.06,det:7});noise({type:'highpass',f:500,f2:6000,a:.001,d:.12,v:.14*v,t:t-.1,rev:1});
    tone({f:2200,f2:180,type:'sawtooth',lp:5000,a:.001,d:.13,v:.22*v,t});noise({type:'bandpass',f:2800,f2:900,q:3,a:.001,d:.1,v:.2*v,t});tone({f:58*p,f2:36,type:'sine',a:.004,d:.55,v:.7*v,t});
    [NOTE(88),NOTE(91),NOTE(95)].forEach((f,i)=>tone({f,type:'sine',a:.005,d:.9,v:.06*v,t:t+.1+i*.05,det:i*5}))}},
  heal(s){if(!ok())return;const t=T0();[67,72,76,79,84,88].forEach((n,i)=>tone({f:NOTE(n),type:s===2?'sine':'triangle',a:.006,d:.5,v:.09,t:t+i*.06}));tone({f:NOTE(55),type:'triangle',lp:900,a:.2,d:.9,v:.07,t});noise({type:'highpass',f:5200,a:.02,d:.3,v:.05,t:t+.1})},
  koBloom(n){if(!ok())return;const t=T0();
   if(n===0){tone({f:NOTE(52),type:'sine',a:.25,d:1.2,v:.08,t});tone({f:NOTE(59),type:'sine',a:.3,d:1.2,v:.05,t:t+.05});[84,88,91].forEach((m,i)=>tone({f:NOTE(m),type:'sine',a:.004,d:.5,v:.06,t:t+.05+i*.09}))}
   else if(n===1){noise({type:'bandpass',f:900,f2:3600,q:.9,a:.5,d:1.3,v:.06,t});[0,4,7,12,4,7,12,16].forEach((o,i)=>tone({f:NOTE(79+o),type:'sine',a:.004,d:.55,v:.05,t:t+i*.17}))}
   else{tone({f:70,f2:38,type:'sine',a:.01,d:1.1,v:.4,t});noise({type:'highpass',f:3000,f2:8000,a:.1,d:.7,v:.06,t});[60,64,67,71,74,79].forEach((m,i)=>tone({f:NOTE(m+12),type:'triangle',a:.006,d:1.4,v:.07,t:t+i*.05}));[84,88,91,96,100].forEach((m,i)=>tone({f:NOTE(m),type:'sine',a:.004,d:.9,v:.05,t:t+.12+i*.07}));for(let i=0;i<10;i++)tone({f:NOTE(88+RI(0,12)),type:'sine',a:.003,d:.35,v:.03,t:t+.3+i*.09})}},
  koVoid(n){if(!ok())return;const t=T0();
   if(n===0){tone({f:48,f2:70,type:'sawtooth',lp:200,lp2:600,a:.3,d:1,v:.12,t});tone({f:NOTE(45),type:'sine',a:.2,d:1.4,v:.1,t})}
   else if(n===1){for(let i=0;i<9;i++){noise({type:'highpass',f:2000+i*300,a:.002,d:.04+((i*7)%3)*.02,v:.08,t:t+i*.1+((i*13)%5)*.012});tone({f:200+((i*97)%7)*140,type:'square',lp:2500,a:.002,d:.05,v:.03,t:t+i*.1})}tone({f:55,f2:110,type:'sawtooth',lp:300,lp2:900,a:.4,d:.6,v:.1,t})}
   else if(n===2){tone({f:90,f2:1700,type:'sine',a:.45,d:.1,v:.16,t});noise({type:'highpass',f:400,f2:7000,a:.45,d:.1,v:.15,t,rev:1});tone({f:140,f2:2200,type:'sawtooth',lp:1200,lp2:4000,a:.45,d:.08,v:.05,t})}
   else{tone({f:52,f2:30,type:'sine',a:.004,d:1,v:.75,t});noise({type:'lowpass',f:900,f2:200,a:.002,d:.7,v:.35,t});tone({f:2400,f2:200,type:'sawtooth',lp:6000,a:.001,d:.3,v:.2,t});[88,91,95,100,103].forEach((m,i)=>tone({f:NOTE(m),type:'sine',a:.004,d:1.1,v:.06,t:t+.1+i*.06,det:i*4}));for(let i=0;i<8;i++)tone({f:NOTE(96+RI(0,10)),type:'sine',a:.003,d:.4,v:.03,t:t+.4+i*.1})}},
  done(){if(!ok())return;const t=T0();[72,76,79].forEach((n,i)=>tone({f:NOTE(n),type:'triangle',a:.004,d:.22,v:.1,t:t+i*.07}));tone({f:NOTE(84),type:'sine',a:.01,d:.5,v:.06,t:t+.2})},
  fanfare(s){if(!ok())return;const t=T0();
   if(s===0){[[60,0],[64,.1],[67,.2],[72,.32]].forEach(([n,dx])=>tone({f:NOTE(n),type:'square',lp:2200,a:.006,d:.28,v:.07,t:t+dx}));[72,76,79,84].forEach((n,i)=>tone({f:NOTE(n),type:'triangle',a:.01,d:.9,v:.09,t:t+.45+i*.02}));noise({type:'highpass',f:5000,a:.01,d:.25,v:.07,t:t+.1})}
   else if(s===1){tone({f:62,f2:32,type:'sine',a:.01,d:1.0,v:.5,t});noise({type:'lowpass',f:400,f2:2600,a:.35,d:.9,v:.13,t});[64,67,69,72,76,79,84].forEach((n,i)=>tone({f:NOTE(n),type:'sine',a:.01,d:.5,v:.09,t:t+i*.075}));tone({f:NOTE(52),type:'triangle',lp:800,a:.3,d:1.6,v:.08,t:t+.1});tone({f:NOTE(59),type:'triangle',lp:800,a:.3,d:1.6,v:.06,t:t+.1,det:8});
    for(let i=0;i<5;i++){const b=t+.5+i*R(.12,.3),f0=R(2600,3600);tone({f:f0,f2:f0*1.4,type:'sine',a:.005,d:.08,v:.035,t:b});tone({f:f0*1.2,f2:f0*.9,type:'sine',a:.005,d:.08,v:.03,t:b+.09})}}
   else{tone({f:NOTE(33),type:'sawtooth',lp:300,lp2:900,a:.5,d:1.2,v:.12,t});tone({f:NOTE(33),type:'sawtooth',lp:300,lp2:900,a:.5,d:1.2,v:.1,t,det:9});[81,79,76,72].forEach((n,i)=>tone({f:NOTE(n),type:'triangle',a:.01,d:.3,v:.07,t:t+.1+i*.1,det:-12*(3-i)}));
    tone({f:NOTE(36),f2:NOTE(24),type:'sine',a:.01,d:.7,v:.5,t:t+.35});[88,91,95,100].forEach((n,i)=>tone({f:NOTE(n),type:'sine',a:.005,d:1.2,v:.05,t:t+.5+i*.08}))}},
  summon(s){if(!ok())return;const t=T0();tone({f:130,f2:880,type:'sawtooth',lp:500,lp2:4000,a:.3,d:.55,v:.1,t});tone({f:131,f2:884,type:'sawtooth',lp:500,lp2:4000,a:.3,d:.55,v:.07,t,det:10});noise({type:'highpass',f:800,f2:7000,a:.1,d:.7,v:.08,t});
   [72,79,84,88].forEach((n,i)=>tone({f:NOTE(n+(s===2?-1:0)),type:'sine',a:.005,d:.8,v:.07,t:t+.55+i*.06}))},
  hall(){if(!ok())return;const t=T0();[84,88,91,96,100,103].forEach((n,i)=>tone({f:NOTE(n),type:'sine',a:.01,d:1.1,v:.06,t:t+i*.09}));tone({f:NOTE(60),type:'triangle',lp:900,a:.4,d:1.8,v:.06,t});tone({f:NOTE(67),type:'triangle',lp:900,a:.4,d:1.8,v:.05,t})},
  /* ----- trapdoor + Hall of Fame presets (all synthesised; CONFIG.trap.vol scales each) ----- */
  thunk(){if(!ok())return;const t=T0(),v=CONFIG.trap.vol.thunk;tone({f:150,f2:48,type:'sine',a:.002,d:.2,v:.6*v,t});noise({type:'lowpass',f:700,f2:200,q:.7,a:.002,d:.12,v:.3*v,t});tone({f:2600,f2:1700,type:'square',lp:4200,a:.001,d:.045,v:.07*v,t:t+.1});noise({type:'highpass',f:4500,a:.001,d:.02,v:.12*v,t:t+.1})},
  rumble(sec){if(!ok())return;const t=T0(),v=CONFIG.trap.vol.rumble;noise({type:'lowpass',f:110,f2:260,q:.8,a:sec,d:.3,v:.5*v,t});tone({f:45,type:'sine',a:sec,d:.35,v:.55*v,t});tone({f:52,f2:40,type:'triangle',lp:200,a:sec,d:.3,v:.2*v,t,det:7})},
  grind(sec){if(!ok())return;const t=T0(),v=CONFIG.trap.vol.grind,src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain(),l=ctx.createOscillator(),lg=ctx.createGain();
   src.buffer=noiseBuf;f.type='bandpass';f.Q.value=2.2;f.frequency.setValueAtTime(260,t);f.frequency.exponentialRampToValueAtTime(620,t+sec);
   g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.32*v,t+.12);g.gain.setValueAtTime(.32*v,t+Math.max(.13,sec-.15));g.gain.exponentialRampToValueAtTime(.0001,t+sec);
   l.frequency.value=6;lg.gain.value=.12*v;l.connect(lg);lg.connect(g.gain);src.connect(f);f.connect(g);g.connect(sfx);src.start(t,Math.random()*1.8);src.stop(t+sec+.05);l.start(t);l.stop(t+sec+.05);
   tone({f:62,f2:48,type:'sawtooth',lp:180,a:.1,d:Math.max(.1,sec-.1),v:.18*v,t});
   src.onended=()=>{try{g.disconnect();f.disconnect();src.disconnect();l.disconnect();lg.disconnect()}catch(e){}}},
  shimmer(){if(!ok())return;const t=T0(),v=CONFIG.trap.vol.shimmer;[76,79,84].forEach((n,i)=>{tone({f:NOTE(n),type:'sine',a:.01,d:.7,v:.1*v,t:t+i*.12});tone({f:NOTE(n+12),type:'triangle',a:.01,d:.5,v:.035*v,t:t+i*.12+.01,det:6})});noise({type:'highpass',f:5000,f2:9000,a:.2,d:.3,v:.04*v,t})},
  uhoh(){if(!ok())return;const t=T0(),v=CONFIG.trap.vol.uhoh;tone({f:NOTE(69),f2:NOTE(67),type:'triangle',lp:2200,a:.01,d:.14,v:.2*v,t});tone({f:NOTE(64),f2:NOTE(58),type:'triangle',lp:1800,a:.01,d:.24,v:.22*v,t:t+.2})},
  whistle(){if(!ok())return;const t=T0(),v=CONFIG.trap.vol.whistle,d=CONFIG.trap.at[5]-CONFIG.trap.at[4];tone({f:900,f2:150,type:'sine',a:.03,d:d-.03,v:.2*v,t,fd:d});tone({f:1800,f2:300,type:'sine',a:.03,d:d-.03,v:.03*v,t,fd:d});noise({type:'bandpass',f:500,f2:1500,q:.6,a:.1,d:d-.1,v:.1*v,t})},
  sweep(){if(!ok())return;const t=T0(),v=CONFIG.trap.vol.sweep,O=[0,2,4,7,9,12,14,16,19];for(let i=0;i<9;i++)tone({f:NOTE(72+O[i]),type:'sine',a:.004,d:.18,v:.07*v,t:t+i*.06});tone({f:NOTE(91),type:'sine',a:.005,d:.9,v:.1*v,t:t+.55});tone({f:NOTE(91)*2.76,type:'sine',a:.003,d:.4,v:.03*v,t:t+.55})},
  thump(){if(!ok())return;const t=T0(),v=CONFIG.trap.vol.thump;tone({f:140,f2:42,type:'sine',a:.002,d:.22,v:.65*v,t});noise({type:'lowpass',f:500,f2:150,a:.002,d:.14,v:.3*v,t})},
  boing(){if(!ok())return;const t=T0(),v=CONFIG.trap.vol.boing;tone({f:200,f2:640,type:'triangle',lp:2500,a:.005,d:.14,v:.2*v,t,fd:.12});tone({f:640,f2:240,type:'triangle',lp:2500,a:.005,d:.26,v:.18*v,t:t+.13,fd:.24})},
  clack(){if(!ok())return;const t=T0(),v=CONFIG.trap.vol.clack;noise({type:'bandpass',f:2400,q:1.2,a:.001,d:.05,v:.28*v,t});tone({f:320,f2:150,type:'square',lp:1800,a:.001,d:.07,v:.14*v,t});tone({f:90,f2:50,type:'sine',a:.002,d:.18,v:.5*v,t})},
  plink(i){if(!ok())return;const v=CONFIG.trap.vol.plink,n=[79,81,84,86,88,91][Math.min(5,i|0)];tone({f:NOTE(n),type:'sine',a:.003,d:.32,v:.1*v});tone({f:NOTE(n+12),type:'sine',a:.003,d:.18,v:.03*v})},
  fwip(){if(!ok())return;const v=CONFIG.trap.vol.fwip;noise({f:1600,f2:5200,q:.9,a:.012,d:.13,v:.1*v});noise({type:'highpass',f:6500,a:.001,d:.03,v:.05*v,t:T0()+.12})},
  whoosh(up){if(!ok())return;const v=CONFIG.trap.vol.whoosh;noise({f:up?400:2400,f2:up?2600:350,q:.8,a:.05,d:.3,v:.14*v})},
  lightDie(){if(!ok())return;const t=T0(),v=CONFIG.trap.vol.die;[84,79,72].forEach((n,i)=>tone({f:NOTE(n),type:'sine',a:.005,d:.35,v:.06*v,t:t+i*.1}))},
  hallAmb(on){if(!ctx)return;
   if(on){if(hamb||!ok())return;const g=ctx.createGain();g.gain.value=.0001;g.connect(amb);const src=[],s=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),ng=ctx.createGain();
    s.buffer=noiseBuf;s.loop=true;bp.type='bandpass';bp.frequency.value=1100;bp.Q.value=.4;ng.gain.value=.25;s.connect(bp);bp.connect(ng);ng.connect(g);s.start();src.push(s);
    [NOTE(48),NOTE(55),NOTE(64)].forEach((n,i)=>{const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),og=ctx.createGain();o.type='triangle';o.frequency.value=n;o.detune.value=i*5-5;f.type='lowpass';f.frequency.value=600;og.gain.value=.12;o.connect(f);f.connect(og);og.connect(g);o.start();src.push(o)});
    g.gain.setTargetAtTime(CONFIG.trap.vol.hall,ctx.currentTime,.7);hamb={g,src}}
   else if(hamb){const h=hamb;hamb=null;h.g.gain.setTargetAtTime(.0001,ctx.currentTime,.35);setTimeout(()=>{h.src.forEach(x=>{try{x.stop()}catch(e){}});try{h.g.disconnect()}catch(e){}},1800)}},
  duck(level,sec,lp){if(!ctx)return;const t=ctx.currentTime;duckG.gain.cancelScheduledValues(t);duckG.gain.setTargetAtTime(CONFIG.audio.duck*level+(1-level)*1,t,.03);duckG.gain.setTargetAtTime(1,t+sec,.5);
   if(lp&&musLP){musLP.frequency.cancelScheduledValues(t);musLP.frequency.setTargetAtTime(lp,t,.12);musLP.frequency.setTargetAtTime(20000,t+sec,.4)}}

 };
 /* ----- ambient forest bed: wind, birds, crickets ----- */
 function startAmbient(){if(ambOn)return;ambOn=true;
  const src=ctx.createBufferSource();src.buffer=noiseBuf;src.loop=true;const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=480;bp.Q.value=.6;const wg=ctx.createGain();wg.gain.value=.35;
  src.connect(bp);bp.connect(wg);wg.connect(amb);src.start();
  const lfo=ctx.createOscillator(),lg=ctx.createGain();lfo.frequency.value=.07;lg.gain.value=.22;lfo.connect(lg);lg.connect(wg.gain);lfo.start();
  const lfo2=ctx.createOscillator(),lg2=ctx.createGain();lfo2.frequency.value=.05;lg2.gain.value=180;lfo2.connect(lg2);lg2.connect(bp.frequency);lfo2.start();
  const chirp=()=>{if(ok()){const n=RI(2,4),b0=R(2600,4200),t=T0();for(let i=0;i<n;i++){const f=b0*R(.9,1.15);tone({f,f2:f*R(1.15,1.5),type:'sine',a:.004,d:.07,v:.05,t:t+i*.11,bus:amb});}}setTimeout(chirp,R(3500,9500))};setTimeout(chirp,2500);
  const cricket=()=>{if(ok()){const t=T0(),o=ctx.createOscillator(),g=ctx.createGain(),l=ctx.createOscillator(),lgn=ctx.createGain();o.frequency.value=R(4100,4600);l.frequency.value=R(26,34);l.type='square';lgn.gain.value=.5;g.gain.value=.0001;l.connect(lgn);lgn.connect(g.gain);
   const env2=ctx.createGain();env2.gain.setValueAtTime(.0001,t);env2.gain.linearRampToValueAtTime(.018,t+.3);env2.gain.setValueAtTime(.018,t+1.1);env2.gain.linearRampToValueAtTime(.0001,t+1.6);o.connect(g);g.connect(env2);env2.connect(amb);o.start(t);l.start(t);o.stop(t+1.7);l.stop(t+1.7);o.onended=()=>{try{o.disconnect();g.disconnect();env2.disconnect();l.disconnect();lgn.disconnect()}catch(e){}}}setTimeout(cricket,R(4000,8500))};setTimeout(cricket,4000)}
 /* ----- gentle procedural music: pentatonic harp + soft pad (follows the mute button) ----- */
 const SC=[57,60,62,64,67,69,72,74,76,79],CH=[[45,52,57],[41,48,53],[48,55,60],[43,50,55]];
 function startMusic(){if(musicTimer)return;nextNote=ctx.currentTime+1;chordAt=ctx.currentTime;
  musicTimer=setInterval(()=>{if(!ctx||ctx.state!=='running')return;if(muted||!CONFIG.audio.musicOn){nextNote=ctx.currentTime+1;return}const now2=ctx.currentTime;
   if(now2>=chordAt){const ch=CH[chordI++%CH.length];ch.forEach((n,i)=>{const t=now2+.05,o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();o.type='triangle';o.frequency.value=NOTE(n);o.detune.value=i*4-4;f.type='lowpass';f.frequency.value=700;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.045,t+2.2);g.gain.linearRampToValueAtTime(.0001,t+7.5);o.connect(f);f.connect(g);g.connect(mus);o.start(t);o.stop(t+7.6);o.onended=()=>{try{o.disconnect();f.disconnect();g.disconnect()}catch(e){}}});chordAt=now2+7.5}
   while(nextNote<now2+.6){const n=SC[RI(0,SC.length-1)];tone({f:NOTE(n),type:'triangle',lp:2400,a:.004,d:1.5,v:.07,t:nextNote,bus:mus});if(Math.random()<.25)tone({f:NOTE(n+12),type:'sine',a:.004,d:1,v:.025,t:nextNote+.01,bus:mus});nextNote+=R(.9,2.4)}},250)}
 document.addEventListener('visibilitychange',()=>{if(!ctx)return;if(document.hidden)ctx.suspend();else ctx.resume()});
 return api})();

/* =====================================================================
   Hooks: panels, buttons, speaker, hall, CSS
   ===================================================================== */
const CSS=`
@keyframes fxPanel{from{opacity:0;translate:0 14px;scale:.97}to{opacity:1;translate:0 0;scale:1}}
@keyframes fxFade{from{opacity:0}to{opacity:1}}
@keyframes fxCard{from{opacity:0;translate:0 26px;scale:.94}to{opacity:1;translate:0 0;scale:1}}
@keyframes fxHalo{0%,100%{opacity:.55;scale:.95}50%{opacity:1;scale:1.06}}
@keyframes fxTw{0%,100%{opacity:0;scale:.3}50%{opacity:1;scale:1}}
@keyframes fxSway{from{transform:skewX(-.28deg)}to{transform:skewX(.28deg)}}
.fx-in{animation:fxPanel .3s cubic-bezier(.2,.8,.25,1)}
#hallpg.fx-in{animation:fxFade .45s ease-out}
#hallpg .hc{animation:fxCard .6s cubic-bezier(.2,.8,.25,1) both}
${[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>'#hallpg .hc:nth-child('+n+'){animation-delay:'+(.25+n*.09).toFixed(2)+'s}').join('\n')}
#hallpg .hc:nth-child(n+13){animation-delay:1.4s}
#hallpg .hp-in{position:relative}#hallpg .tr{position:relative;z-index:1}
.fx-halo{position:absolute;left:50%;top:-4px;width:260px;height:210px;margin-left:-130px;pointer-events:none;z-index:0}
.fx-halo:before{content:'';position:absolute;inset:0;background:radial-gradient(closest-side,rgba(255,226,140,.6),rgba(255,226,140,0));animation:fxHalo 4s ease-in-out infinite}
.fx-halo i{position:absolute;width:9px;height:9px;background:#fff3b8;clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);animation:fxTw 2.4s ease-in-out infinite;opacity:0}
.bi-f{transition:clip-path .5s ease-out}
#bp .jnav,#bp .sgb,#bp .sgc,#bp .stc,#bp .bnew,#bedit button,#bcard .jnav,#eb,#ago{transition:transform .12s ease,filter .12s ease,box-shadow .12s ease}
#bp .jnav:hover:not(:disabled),#bp .sgb:hover:not(:disabled),#bp .sgc:hover,#bp .stc:hover,#bp .bnew:hover,#bedit button:hover,#bcard .jnav:hover,#eb:hover,#ago:hover{transform:translateY(-1px);filter:brightness(1.06)}
#bp .jnav:active:not(:disabled),#bp .sgb:active:not(:disabled),#bp .sgc:active,#bp .stc:active,#bp .bnew:active,#bedit button:active,#bcard .jnav:active,#eb:active,#ago:active{transform:translateY(1px) scale(.97);filter:brightness(.96)}
#fxflash{position:absolute;inset:0;pointer-events:none;opacity:0;z-index:90}
@media (prefers-reduced-motion:reduce){.fx-in,#hallpg .hc,.fx-halo:before,.fx-halo i{animation:none!important}}
`;
const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);

const isVis=el=>el.id==='bflip'?el.classList.contains('on'):getComputedStyle(el).display!=='none';
function watch(sel,onOpen,onClose){const el=$(sel);if(!el||el.__fxw)return;el.__fxw=1;let was=isVis(el);
 new MutationObserver(()=>{const v=isVis(el);if(v&&!was)onOpen(el);else if(!v&&was)onClose&&onClose(el);was=v}).observe(el,{attributes:true,attributeFilter:['style','class']})}
function easeIn(el){if(RM())return;el.classList.remove('fx-in');void el.offsetWidth;el.classList.add('fx-in')}
function hallFx(el){const hi=el.querySelector('.hp-in');if(hi&&!hi.querySelector('.fx-halo')){const h=document.createElement('div');h.className='fx-halo';for(let i=0;i<11;i++){const s=document.createElement('i');s.style.left=(8+Math.random()*84)+'%';s.style.top=(4+Math.random()*88)+'%';const z=5+Math.random()*8;s.style.width=s.style.height=z+'px';s.style.animationDelay=(Math.random()*2.4).toFixed(2)+'s';s.style.animationDuration=(1.8+Math.random()*1.8).toFixed(2)+'s';h.appendChild(s)}hi.insertBefore(h,hi.firstChild)}
 easeIn(el);AU.hall();hallIntro(el)}
function wirePanels(){
 watch('#bp',el=>{easeIn(el);AU.panel(true)},()=>AU.panel(false));
 watch('#bedit',el=>{easeIn(el);AU.panel(true)},()=>AU.panel(false));
 watch('#jp',el=>{easeIn(el);AU.panel(true)},()=>AU.panel(false));
 watch('#hallpg',hallFx,hallGone);
 watch('#bflip',()=>AU.flip(),()=>AU.flip())}
function wireUI(){
 const sel='button,.stc,.hb,[data-a],[data-c],[data-e]';let lastEl=null;
 document.addEventListener('mouseover',e=>{const b=e.target.closest&&e.target.closest(sel);if(b&&b!==lastEl&&!b.disabled)AU.tick();lastEl=b||null},true);
 document.addEventListener('pointerdown',()=>AU.unlock(),true);document.addEventListener('keydown',()=>AU.unlock(),true);
 document.addEventListener('click',e=>{AU.unlock();const b=e.target.closest&&e.target.closest(sel);if(!b||b.disabled)return;if(b.id==='fxsnd')return;if(b.classList.contains('atk')||(b.dataset&&(b.dataset.c==='hit'||b.dataset.a==='hit')))return;AU.click()},true);
 /* the speaker button: mute / unmute (saved) */
 const stage=$('#stage')||document.body,btn=document.createElement('button');btn.id='fxsnd';btn.type='button';btn.setAttribute('aria-label','Sound on / off');btn.title='Sound on / off';stage.appendChild(btn);
 const icon=m=>'<svg viewBox="0 0 24 24" fill="none" stroke="#2b2a26" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="#d9c79c"/>'+(m?'<path d="M16 9.5l5 5M21 9.5l-5 5"/>':'<path d="M15.5 9a4 4 0 0 1 0 6M18 6.6a7.5 7.5 0 0 1 0 10.8"/>')+'</svg>';
 const upd=()=>{btn.innerHTML=icon(AU.muted)};upd();
 btn.addEventListener('click',e=>{e.stopPropagation();AU.unlock();AU.setMuted(!AU.muted);upd();if(!AU.muted)AU.click()})}

/* =====================================================================
   TRAPDOOR + HALL OF FAME   (every tunable: CONFIG.trap)
   Mira steps on the HALL tile -> press, rumble, tile slides open, hang, fall,
   teleport (iris) -> Hall of Fame. Esc in the Hall plays the reverse.
   Reuses: AU, addP particles, shake, flash, RM(), the FX.under/mira/over hooks.
   ===================================================================== */
const TC=CONFIG.trap;
const TR={st:'idle',t:0,ck:0,lock:false,vis:false,ft:null,fast:false,wait:0,skipping:false,ev:[],tm:[],acc:0,acc2:0,rmDone:0,
 s:{open:0,sink:0,dark:0,seam:0,light:0,shadow:0,shR:20,ring:-1,ring2:-1,bang:-1,mv:false,hide:false,clip:false,my:0,ms:1,msx:1,msy:1,mr:0},
 irisOn:false,icx:-1,icy:-1,hs:{on:false,amp:0,t0:0,dur:0},introT:0,readyT:0};
const TS={ready:false,busy:false,tile:null,nb:null,pit:null,glow:null,shaft:null,Q:null,C:null,V:null,QP:null,clipV:null,seamCol:''};
let EL=null;
const eio=k=>k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2,seg=(t,a,b)=>CL((t-a)/(b-a),0,1);
const trTm=(fn,ms)=>{TR.tm.push(setTimeout(fn,ms))},trClrTm=()=>{TR.tm.forEach(clearTimeout);TR.tm.length=0};
const tp=o=>PS.length>=TC.partCap?null:addP(o);
const hallOpen=()=>{const h=$('#hallpg');return !!h&&h.style.display==='block'};
try{matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{CONFIG.reducedMotion=e.matches})}catch(e){}

/* ---------- sprites: the HALL tile and its neighbour, cropped from the painted background ---------- */
function trCrop(im,Q,thick){const S=2;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const p of Q){x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1])}
 const x=Math.floor(x0)-2,y=Math.floor(y0)-2,w=Math.ceil(x1-x0)+4,h=Math.ceil(y1-y0)+thick+4,c=document.createElement('canvas');c.width=w*S;c.height=h*S;
 const g=c.getContext('2d');g.scale(S,S);g.translate(-x,-y);g.beginPath();
 for(const dy of [0,thick]){Q.forEach((p,i)=>i?g.lineTo(p[0],p[1]+dy):g.moveTo(p[0],p[1]+dy));g.closePath()}
 g.clip();const k=im.naturalWidth/1472;g.drawImage(im,x*k,y*k,w*k,h*k,x,y,w,h);return{c,x,y,w,h}}
function trPath(pts){const p=new Path2D();pts.forEach((q,i)=>i?p.lineTo(q[0],q[1]):p.moveTo(q[0],q[1]));p.closePath();return p}
function trBuildPit(Q){const S=2,K=TC.col,D=TC.pit;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const p of Q){x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1])}
 const x=Math.floor(x0)-2,y=Math.floor(y0)-2,w=Math.ceil(x1-x0)+4,h=Math.ceil(y1-y0)+4,c=document.createElement('canvas');c.width=w*S;c.height=h*S;
 const g=c.getContext('2d'),[p0,p1,p2,p3]=Q,cx=(p1[0]+p3[0])/2,cy=(p0[1]+p2[1])/2;g.scale(S,S);g.translate(-x,-y);g.clip(trPath(Q));
 let gr=g.createLinearGradient(0,p0[1],0,p2[1]);gr.addColorStop(0,K.pitTop);gr.addColorStop(1,K.pitBot);g.fillStyle=gr;g.fillRect(x,y,w,h);
 /* floor (the pit bottom, D px lower) */
 gr=g.createRadialGradient(cx,cy+D,2,cx,cy+D,62);gr.addColorStop(0,K.floorA);gr.addColorStop(.6,K.floorB);gr.addColorStop(1,K.floorC);g.fillStyle=gr;g.fill(trPath(Q.map(p=>[p[0],p[1]+D])));
 /* the two back walls going down from the NW and NE rims */
 const wall=(a,b,c1,c2,c3)=>{const lg=g.createLinearGradient(0,Math.min(a[1],b[1]),0,Math.max(a[1],b[1])+D);lg.addColorStop(0,c1);lg.addColorStop(.55,c2);lg.addColorStop(1,c3);g.fillStyle=lg;g.fill(trPath([a,b,[b[0],b[1]+D],[a[0],a[1]+D]]));
  g.lineWidth=1;for(const f of [.34,.68]){g.strokeStyle='rgba(8,4,24,.42)';g.beginPath();g.moveTo(a[0],a[1]+D*f);g.lineTo(b[0],b[1]+D*f);g.stroke();g.strokeStyle='rgba(255,214,150,.10)';g.beginPath();g.moveTo(a[0],a[1]+D*f+1);g.lineTo(b[0],b[1]+D*f+1);g.stroke()}};
 wall(p0,p1,K.wallA,K.wallB,K.wallC);wall(p0,p3,K.wallA2,K.wallB,K.wallC);
 /* depth: dark creases where wall meets floor, soft shade under the front rims, warm lip light on the back rims */
 g.lineJoin='round';g.strokeStyle='rgba(4,2,16,.6)';g.lineWidth=2;g.beginPath();g.moveTo(p1[0],p1[1]+D);g.lineTo(p0[0],p0[1]+D);g.lineTo(p3[0],p3[1]+D);g.stroke();
 g.strokeStyle='rgba(2,1,10,.55)';g.lineWidth=11;g.beginPath();g.moveTo(p1[0],p1[1]);g.lineTo(p2[0],p2[1]);g.lineTo(p3[0],p3[1]);g.stroke();
 g.strokeStyle=K.rim;g.lineWidth=1.3;g.beginPath();g.moveTo(p1[0],p1[1]);g.lineTo(p0[0],p0[1]);g.lineTo(p3[0],p3[1]);g.stroke();
 return{c,x,y,w,h}}
function trSprites(){let c=document.createElement('canvas');c.width=c.height=64;let g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);
 gr.addColorStop(0,'rgba(255,236,176,1)');gr.addColorStop(.35,'rgba(255,214,120,.55)');gr.addColorStop(1,'rgba(255,200,90,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);TS.glow=c;
 c=document.createElement('canvas');c.width=64;c.height=128;g=c.getContext('2d');gr=g.createLinearGradient(0,0,0,128);gr.addColorStop(0,'rgba(255,226,150,0)');gr.addColorStop(.55,'rgba(255,222,140,.28)');gr.addColorStop(1,'rgba(255,214,120,.7)');
 g.fillStyle=gr;g.beginPath();g.moveTo(22,0);g.lineTo(42,0);g.lineTo(62,128);g.lineTo(2,128);g.closePath();g.fill();g.globalCompositeOperation='destination-in';
 gr=g.createLinearGradient(0,0,64,0);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(.3,'rgba(0,0,0,1)');gr.addColorStop(.7,'rgba(0,0,0,1)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,64,128);TS.shaft=c}
function trBuild(im){const a=HALL[0],b=HALL[1],Q=cq(a,b),NQ=cq(a,b+1);   /* neighbour (a,b+1) = the flat paved top-stair landing south-west of the hole */
 TS.Q=Q;TS.C=cc(a,b);TS.V=[NQ[0][0]-Q[0][0],NQ[0][1]-Q[0][1]];TS.QP=trPath(Q);TS.seamCol='rgb('+TC.col.seam+')';
 TS.clipV=trPath([[Q[1][0]-90,Q[1][1]],Q[1],Q[2],Q[3],[Q[3][0]+90,Q[3][1]],[Q[3][0]+90,-300],[Q[1][0]-90,-300]]);
 TS.tile=trCrop(im,Q,TC.thick);TS.nb=trCrop(im,NQ,TC.thick);TS.pit=trBuildPit(Q);trSprites()}
function trPrep(){if(TS.ready||TS.busy)return;TS.busy=true;
 try{const m=/url\(["']?(data:[^"')]+)["']?\)/.exec(getComputedStyle($('#stage')).backgroundImage);if(!m){TS.busy=false;return}
  const im=new Image();im.onload=()=>{try{trBuild(im);TS.ready=true}catch(e){console.error('trap prep',e)}TS.busy=false};im.onerror=()=>{TS.busy=false};im.src=m[1]}catch(e){TS.busy=false}}

/* ---------- DOM: iris, Hall light shafts + motes, Mira in the Hall, "Esc to leave" ---------- */
function trEls(){if(EL)return EL;const st=$('#stage'),mk=(tag,id,cls)=>{const e=document.createElement(tag);if(id)e.id=id;if(cls)e.className=cls;return e};
 const iris=mk('div','triris'),fx=mk('div','hallfx'),mira=mk('div','trmira'),dust=mk('div','trdust'),img=new Image();img.alt='';img.src=SPR.src;mira.appendChild(img);
 [[60,260,-9],[610,320,5],[1090,270,12]].forEach(([x,w,a],i)=>{const s=mk('i',0,'sh');s.style.cssText='left:'+x+'px;width:'+w+'px;--a:'+a+'deg;animation-delay:'+(-i*2.7)+'s,'+(.4+i*.15)+'s';fx.appendChild(s)});
 for(let i=0;i<TC.hall.motes;i++){const m=mk('i',0,'mo'),z=R(3,7),d=R(7,14);m.style.cssText='left:'+R(1,98).toFixed(1)+'%;top:'+R(4,96).toFixed(1)+'%;width:'+z.toFixed(1)+'px;height:'+z.toFixed(1)+'px;--dx:'+R(-60,60).toFixed(0)+'px;--dy:'+R(-90,40).toFixed(0)+'px;--dur:'+d.toFixed(1)+'s;--tw:'+R(2.5,5).toFixed(1)+'s;--dl:'+(-R(0,d)).toFixed(1)+'s';fx.appendChild(m)}
 const add=(cls,css,html)=>{const e=mk('i',0,cls);if(css)e.style.cssText=css;if(html)e.innerHTML=html;fx.appendChild(e)};
 add('vg');add('gr');add('hb');add('hs','','<b></b>');
 [[92,236],[1367,236]].forEach(([x,y],i)=>{add('fl','left:'+x+'px;top:'+y+'px;animation-delay:'+(-i*.8)+'s');for(let k=0;k<6;k++)add('em','left:'+(x+R(-9,9)).toFixed(0)+'px;top:'+(y+8)+'px;--dx:'+R(-26,26).toFixed(0)+'px;animation-duration:'+R(2.4,3.8).toFixed(1)+'s;animation-delay:'+(-R(0,3.5)).toFixed(2)+'s')});
 [[305,252],[729,222],[1153,252]].forEach(([x,y],i)=>add('gm','left:'+x+'px;top:'+y+'px;animation-delay:'+(-i*1.2)+'s'));
 st.appendChild(fx);st.appendChild(dust);st.appendChild(mira);st.appendChild(iris);
 st.appendChild(mk('div','hallesc')).textContent='Esc to leave'; /* delete this line (and the #hallesc CSS) to remove the hint */
 return EL={iris,fx,mira,dust}}
function trIris(r,cx,cy){const I=EL.iris;if(r==null){if(TR.irisOn){I.style.display='none';TR.irisOn=false}return}
 if(!TR.irisOn){I.classList.remove('rm');I.style.opacity='';I.style.display='block';TR.irisOn=true}
 I.style.setProperty('--r',r.toFixed(1)+'px');if(cx!==TR.icx||cy!==TR.icy){I.style.setProperty('--cx',cx+'px');I.style.setProperty('--cy',cy+'px');TR.icx=cx;TR.icy=cy}}
function hallShake(a,d){TR.hs.on=true;TR.hs.amp=a;TR.hs.t0=TR.ck;TR.hs.dur=d}
function trShake(a){shake(a,.09);if(SK.on)SK.bg=true}

/* ---------- Hall of Fame intro / idle (CSS does the work; this only adds classes + a few timers) ---------- */
function hallIntro(el){const E=trEls(),H=TC.hall,stg=$('#stage');E.fx.classList.add('on');AU.hallAmb(true);clearTimeout(TR.introT);clearTimeout(TR.readyT);trClrTm();
 if(RM()){el.classList.add('rm');E.fx.classList.add('rm');TR.readyT=setTimeout(()=>stg.classList.add('hall-ready'),400);return}
 el.classList.remove('rm');E.fx.classList.remove('rm');el.classList.add('intro');TR.introT=setTimeout(()=>el.classList.remove('intro'),H.introMs);
 el.querySelectorAll('.cd').forEach((_,i)=>trTm(()=>{if(hallOpen())AU.plink(i)},(H.cardDelay+i*H.cardGap)*1000));
 trTm(()=>{if(!hallOpen())return;for(let i=0;i<14;i++){const b=document.createElement('i'),a=R(0,6.283),d=R(60,170);b.className='bs';b.style.left='736px';b.style.top='96px';b.style.setProperty('--dx',(Math.cos(a)*d).toFixed(0)+'px');b.style.setProperty('--dy',(Math.sin(a)*d*.6).toFixed(0)+'px');b.style.animationDelay=(i*.012).toFixed(2)+'s';E.fx.appendChild(b);setTimeout(()=>b.remove(),1200)}},H.burstAt*1000);
 TR.readyT=setTimeout(()=>stg.classList.add('hall-ready'),H.introMs+200)}
function hallGone(){AU.panel(false);AU.hallAmb(false);clearTimeout(TR.introT);clearTimeout(TR.readyT);trClrTm();$('#stage').classList.remove('hall-ready');const h=$('#hallpg');if(h)h.classList.remove('intro');if(EL)EL.fx.classList.remove('on')}

/* ---------- visual state (pure function of time) ---------- */
function stIn(t){const A=TC.at,s=TR.s,C=TS.C,pk=seg(t,A[0],A[1]),rk=seg(t,A[1],A[2]),sk=eio(seg(t,A[2],A[3])),hk=seg(t,A[3],A[4]),fk=seg(t,A[4],A[5]);
 s.open=sk;s.sink=TC.sink*eo3(pk);s.dark=TC.dark*eo3(pk)*(1-sk);
 s.seam=t<A[1]?0:t<A[3]?(.35+.65*rk)*(.6+.4*Math.sin(t*34))*(1-sk*.7):0;
 s.light=eo3(seg(t,A[2]+.1,A[3]));
 s.mv=true;s.hide=t>=A[5];s.clip=fk>0;s.ms=1;s.mr=0;
 const press=eo3(pk)*(1-.6*sk);s.msx=1+.05*press+(t>=A[1]&&t<A[2]?Math.sin(t*61)*.008:0);s.msy=1-.07*press;
 s.my=s.sink;
 if(hk>0&&hk<1){s.mr=Math.sin(t*42)*.07;s.my-=4*Math.sin(Math.min(1,hk*3)*Math.PI);s.msx=1+Math.sin(t*37)*.02}
 if(fk>0){s.my=s.sink+TC.fallDrop*fk*fk;s.ms=1+(TC.fallScale-1)*fk;s.mr=TC.spin*fk;s.msx=s.msy=1}
 s.shadow=t>=A[2]+.3?.5*sk*(1-fk):0;s.shR=22*(1-.8*fk);
 s.bang=t>=A[3]&&t<A[4]+.15?t-A[3]:-1;
 s.ring=t>=A[5]?seg(t,A[5],A[5]+.45):-1;s.ring2=t>=A[5]+.2?seg(t,A[5]+.2,A[5]+.65):-1;
 let r=null,cx=C[0],cy=C[1];
 if(t<A[6]){const ik=seg(t,A[5]+TC.iris.closeFrom,A[6]);if(ik>0)r=ik>=1?-8:TC.iris.maxR*(1-eio(ik))}
 else{cx=736;cy=416;const ok=seg(t,A[6],A[6]+TC.iris.openTime);r=ok>=1?null:-8+(TC.iris.hallR+8)*eo3(ok)}
 trIris(r,cx,cy)}
function stHall(){const s=TR.s;s.open=1;s.sink=TC.sink;s.dark=0;s.seam=0;s.light=1;s.mv=true;s.hide=true;s.clip=false;s.shadow=0;s.ring=s.ring2=s.bang=-1}
function stOut(t){const O=TC.out,s=TR.s,C=TS.C,H=TC.hall;
 const rk=eo3(seg(t,O.pop,O.pop+O.rise)),fk=seg(t,O.pop+O.rise+O.hang,O.land),sk=eio(seg(t,O.shut,O.shut+O.shutT)),lt=t-O.land;
 s.open=1-sk;s.sink=TC.sink*(1-eo3(seg(t,O.land,O.land+.15)));s.dark=0;s.seam=0;s.light=1-eo3(seg(t,O.light,O.light+.55));
 s.mv=true;s.hide=t<O.close;s.clip=true;s.shadow=0;s.ring=s.ring2=s.bang=-1;
 s.ms=LP(TC.fallScale,1,rk);s.mr=TC.spin*(1-rk);s.msx=1-.1*(1-rk);s.msy=1+.12*(1-rk);
 const up=TC.fallDrop*(1-rk)-O.hop*rk;      /* from deep in the pit, up to the hop peak */
 s.my=t<O.pop+O.rise+O.hang?up:LP(-O.hop,TC.sink,fk*fk);
 if(fk>0&&fk<1){s.msx=1;s.msy=1}
 if(lt>=0){const v=Math.exp(-lt*10)*Math.cos(lt*24);s.msy=1-.18*v;s.msx=1+.18*v;s.my=s.sink;s.ms=1;s.mr=0}
 let r=null,cx=C[0],cy=C[1];
 if(t<O.close){cx=95;cy=730;r=-8+(TC.iris.closeR+8)*(1-eio(seg(t,0,O.close)))}
 else{const ok=seg(t,O.close,O.close+O.open);r=ok>=1?null:-8+(TC.iris.maxR+8)*eo3(ok)}
 trIris(r,cx,cy)}

/* ---------- little emitters ---------- */
function trDust(n){const Q=TS.Q,C=TS.C;for(let i=0;i<n;i++){const e=RI(0,3),a=Q[e],b=Q[(e+1)%4],u=Math.random(),x=a[0]+(b[0]-a[0])*u,y=a[1]+(b[1]-a[1])*u,dx=x-C[0],dy=y-C[1],l=Math.hypot(dx,dy)||1;
 tp({k:'smoke',x,y,vx:dx/l*R(10,26),vy:dy/l*R(4,12)-R(6,16),dr:.93,s:R(5,9),l:R(.5,.85),c:'rgba('+TC.col.dust+',1)',al:.5,grow:1.5})}}
function trPebble(){const Q=TS.Q,e=RI(0,3),a=Q[e],b=Q[(e+1)%4],u=Math.random();tp({k:'dot',x:a[0]+(b[0]-a[0])*u,y:a[1]+(b[1]-a[1])*u-1,vx:R(-12,12),vy:R(-70,-30),ay:320,dr:.99,s:R(1.4,2.4),l:R(.28,.45),c:'rgba(150,130,100,1)'})}
function trSpark(){const Q=TS.Q,u=Math.random(),v=Math.random(),x=Q[0][0]+u*(Q[3][0]-Q[0][0])+v*(Q[1][0]-Q[0][0]),y=Q[0][1]+u*(Q[3][1]-Q[0][1])+v*(Q[1][1]-Q[0][1]);
 tp({k:'dot',add:1,x,y,vx:R(-8,8),vy:R(-90,-35),s:R(2.5,5.5),l:R(.8,1.4),c:'rgba(255,226,150,1)',dr:.995,ph:R(0,6),sway:R(3,6)})}
function trEmit(dt,t){const A=TC.at,s=TR.s,C=TS.C;
 if(t>=A[1]&&t<A[2]){TR.acc+=dt*28;while(TR.acc>=1){TR.acc--;trPebble()}trShake(TC.shake*seg(t,A[1],A[2]))}
 else if(t>=A[2]&&t<A[3]){TR.acc+=dt*34;while(TR.acc>=1){TR.acc--;trSpark()}TR.acc2+=dt*12;while(TR.acc2>=1){TR.acc2--;trDust(1)}trShake(TC.shake*.5*(1-.6*s.open))}
 else if(t>=A[3]&&t<A[6]){TR.acc+=dt*22;while(TR.acc>=1){TR.acc--;trSpark()}
  if(t>=A[4]&&t<A[5]){TR.acc2+=dt*18;while(TR.acc2>=1){TR.acc2--;tp({k:'spark',x:C[0]+R(-22,22),y:C[1]-R(0,60),vx:0,vy:R(-300,-220),s:R(10,16),l:R(.22,.32),c:'#fff1c4'})}}}}

/* ---------- Mira in the Hall (DOM sprite that drops in from the top) ---------- */
function trLand(t){const A=TC.at,L=TC.land,m=EL.mira,ld=t-(A[6]+L.delay);if(ld<0){m.style.display='none';return}
 m.style.display='block';m.classList.remove('idle');
 if(ld<L.drop){const k=ld/L.drop;m.style.transform='translateY('+(-835*(1-k*k)).toFixed(1)+'px) scale(.93,1.1)';return}
 const lt=ld-L.drop;if(lt>.55){m.style.transform='';m.classList.add('idle');return}
 const v=Math.exp(-lt*8)*Math.cos(lt*20);m.style.transform='scale('+(1+L.squash*v).toFixed(3)+','+(1-L.squash*v).toFixed(3)+')'}
function trLandFx(){AU.thump();AU.boing();hallShake(TC.land.shake,.28);const d=EL.dust;d.classList.remove('go');void d.offsetWidth;d.classList.add('go')}

/* ---------- state machine ---------- */
function trEvents(list,t){for(const e of list){if(!e.f&&t>=e.t){e.f=1;if(!TR.skipping||e.logic){try{e.fn()}catch(err){console.error('trap event',err)}}}}}
function trReset(){const s=TR.s;s.open=s.sink=s.dark=s.seam=s.light=s.shadow=0;s.ring=s.ring2=s.bang=-1;s.mv=s.hide=s.clip=false;s.my=s.mr=0;s.ms=s.msx=s.msy=1;TR.ft=null;TR.fast=false;if(EL)trIris(null,0,0)}
function trFinish(){TR.st='idle';TR.lock=false;TR.vis=false;trReset();if(EL){EL.mira.style.display='none'}const hp=$('#hallpg');if(hp)hp.style.translate=''}
function finishIn(){TR.st='hall';TR.lock=false;stHall();trIris(null,0,0);if(EL){EL.mira.style.transform='';EL.mira.style.display='block';EL.mira.classList.add('idle')}}
function trSkip(){if(TR.st!=='in'||TR.t<TC.skipAfter||TR.fast)return;TR.fast=true;const A=TC.at;
 if(TR.t<A[6]){TR.skipping=true;TR.t=A[6];trEvents(TR.ev,TR.t);TR.skipping=false}}
window.startTrap=function(){
 if(TR.st!=='idle')return;
 if(RM()){trEls();TR.st='rm';TR.t=0;TR.rmDone=0;TR.lock=true;AU.thunk();return}
 if(!TS.ready){trPrep();if(++TR.wait<40){setTimeout(window.startTrap,100);return}TR.wait=0;window.openHall&&window.openHall();return}
 TR.wait=0;trEls();const A=TC.at,C=TS.C;
 TR.st='in';TR.t=0;TR.lock=true;TR.vis=true;TR.ft=null;TR.fast=false;TR.acc=TR.acc2=0;
 const ev=(t,fn,logic)=>({t,fn,logic:!!logic,f:0});
 TR.ev=[ev(.02,()=>{AU.thunk();trDust(10)}),
  ev(A[1],()=>{AU.rumble(A[2]-A[1]+.05);AU.duck(1,A[7]-A[1]+.3,TC.duckLP)}),
  ev(A[2],()=>AU.grind(A[3]-A[2])),
  ev(A[3]-.4,()=>AU.shimmer()),
  ev(A[3],()=>AU.uhoh()),
  ev(A[4],()=>{AU.whistle()}),
  ev(A[5],()=>{AU.sweep();flash('rgba(255,236,170,1)',.22,.3);for(let i=0;i<14;i++)tp({k:'dot',add:1,x:C[0]+R(-24,24),y:C[1]+R(-8,10),vx:R(-30,30),vy:R(-170,-80),s:R(3,6),l:R(.5,.9),c:'rgba(255,230,160,1)',dr:.97})}),
  ev(A[5]+.25,()=>{AU.whoosh(false)}),
  ev(A[6],()=>{window.openHall&&window.openHall()},true),
  ev(A[6]+TC.land.delay+TC.land.drop,trLandFx),
  ev(A[7],finishIn,true)]}
window.exitHall=function(){const hp=$('#hallpg');if(!hp||hp.style.display!=='block')return;
 if(TR.st==='in'||TR.st==='out'||TR.st==='rm'||TR.st==='rm-out')return;
 if(RM()){trEls();TR.st='rm-out';TR.t=0;TR.rmDone=0;TR.lock=true;AU.thunk();AU.hallAmb(false);$('#stage').classList.remove('hall-ready');return}
 if(!TR.vis||!TS.ready){window.closeHall&&window.closeHall();return}
 const O=TC.out,C=TS.C;trEls();TR.st='out';TR.t=0;TR.lock=true;TR.acc=TR.acc2=0;AU.hallAmb(false);$('#stage').classList.remove('hall-ready');
 const ev=(t,fn,logic)=>({t,fn,logic:!!logic,f:0});
 TR.ev=[ev(0,()=>AU.whoosh(false)),
  ev(O.close,()=>{window.closeHall&&window.closeHall();EL.mira.style.display='none';EL.mira.style.transform='';AU.whoosh(true)},true),
  ev(O.pop,()=>{AU.boing();for(let i=0;i<10;i++)tp({k:'dot',add:1,x:C[0]+R(-20,20),y:C[1]+R(-6,12),vx:R(-24,24),vy:R(-140,-60),s:R(3,5),l:R(.5,.9),c:'rgba(255,230,160,1)',dr:.97})}),
  ev(O.shut,()=>AU.grind(O.shutT)),
  ev(O.light,()=>AU.lightDie()),
  ev(O.land,()=>{AU.clack();trDust(12);trShake(2.2)}),
  ev(O.total,trFinish,true)]}
function tickRM(){const d=TC.reduced/2,t=TR.t,I=EL.iris;if(!TR.irisOn){I.classList.add('rm');I.style.display='block';TR.irisOn=true}
 if(t<d)I.style.opacity=(t/d).toFixed(2);
 else{if(!TR.rmDone){TR.rmDone=1;if(TR.st==='rm')window.openHall&&window.openHall();else window.closeHall&&window.closeHall()}I.style.opacity=Math.max(0,1-(t-d)/d).toFixed(2)}
 if(t>=2*d){TR.irisOn=false;I.style.display='none';I.classList.remove('rm');I.style.opacity='';if(TR.st==='rm'){TR.st='hall';TR.lock=false}else trFinish()}}
function trapTick(dt){if(TR.st==='idle')return;TR.ck+=dt;
 if(TR.hs.on){const hp=$('#hallpg'),k=1-(TR.ck-TR.hs.t0)/TR.hs.dur;if(k<=0||!hp){TR.hs.on=false;if(hp)hp.style.translate=''}else{const a=TR.hs.amp*k*k;hp.style.translate=((Math.random()*2-1)*a).toFixed(1)+'px '+((Math.random()*2-1)*a).toFixed(1)+'px'}}
 if(TR.st==='rm'||TR.st==='rm-out'){TR.t+=dt;tickRM();return}
 if(!TS.ready)return;
 if(TR.st==='in'){TR.t+=dt*(TR.fast&&TR.t>=TC.at[6]?3:1);const t=TR.t;stIn(t);trEvents(TR.ev,t);trEmit(dt,t);trLand(t)}
 else if(TR.st==='out'){TR.t+=dt;const t=TR.t,O=TC.out;stOut(t);trEvents(TR.ev,t);
  if(t>=O.pop&&t<O.pop+O.rise){TR.acc+=dt*30;while(TR.acc>=1){TR.acc--;trSpark()}}
  if(t>=O.light&&t<O.land+.1&&TR.st==='out'){TR.acc2+=dt*14;while(TR.acc2>=1){TR.acc2--;trSpark()}}}
 else if(TR.st==='hall'){stHall()}}

/* ---------- drawing (called from FX.under / FX.mira / FX.over) ---------- */
function trapUnder(g){if(!TR.vis||!TS.ready)return;const s=TR.s,Q=TS.Q,C=TS.C,V=TS.V,T=TS.tile,P=TS.pit,t=TR.ck,lp=s.light;
 g.drawImage(P.c,P.x,P.y,P.w,P.h);
 g.save();g.clip(TS.QP);
 if(lp>.01){const fx=C[0],fy=C[1]+TC.pit*.55;g.globalCompositeOperation='lighter';
  for(let i=0;i<3;i++){const a=t*1.3+i*2.094,r=15+i*3,sz=20+i*4;g.globalAlpha=.34*lp*(.7+.3*Math.sin(t*3+i));g.drawImage(TS.glow,fx+Math.cos(a)*r-sz,fy+Math.sin(a)*r*.5-sz,sz*2,sz*2)}
  g.globalAlpha=.5*lp*(.8+.2*Math.sin(t*4));g.drawImage(TS.glow,fx-30,fy-22,60,44);g.globalCompositeOperation='source-over'}
 if(s.shadow>.01){g.globalAlpha=s.shadow;g.fillStyle='#05030f';g.beginPath();g.ellipse(C[0],C[1]+TC.pit*.55,s.shR,s.shR*.5,0,0,6.2832);g.fill()}
 g.restore();g.globalAlpha=1;
 g.drawImage(T.c,T.x+V[0]*s.open*TC.slide,T.y+V[1]*s.open*TC.slide+s.sink,T.w,T.h);
 if(s.dark>.005&&s.open<.02){g.save();g.translate(0,s.sink);g.globalAlpha=s.dark;g.fillStyle='#120a22';g.fill(TS.QP);g.restore()}
 if(s.seam>.01){g.save();g.translate(0,s.sink);g.globalCompositeOperation='lighter';g.lineJoin='round';g.strokeStyle=TS.seamCol;g.globalAlpha=.35*s.seam;g.lineWidth=5;g.stroke(TS.QP);g.globalAlpha=.9*s.seam;g.lineWidth=1.3;g.stroke(TS.QP);g.restore()}
 if(s.open>.01){g.save();g.clip(TS.QP);g.strokeStyle='#05030f';g.globalAlpha=.22;g.lineWidth=16;g.beginPath();g.moveTo(Q[1][0],Q[1][1]);g.lineTo(Q[2][0],Q[2][1]);g.stroke();g.globalAlpha=.3;g.lineWidth=8;g.stroke();g.restore();
  const N=TS.nb;g.drawImage(N.c,N.x,N.y,N.w,N.h)}
 if(lp>.01){g.save();g.globalCompositeOperation='lighter';
  for(let i=0;i<3;i++){const h=(96+i*14)*(.85+.15*Math.sin(t*2.1+i*1.7)),w=34+i*9;g.save();g.translate(C[0]+(i-1)*17,C[1]+6);g.rotate((i-1)*.12+Math.sin(t*1.1+i*2)*.06);g.globalAlpha=lp*(.5+.25*Math.sin(t*1.7+i*2.2));g.drawImage(TS.shaft,-w/2,-h,w,h);g.restore()}
  g.globalAlpha=.32*lp;g.drawImage(TS.glow,C[0]-70,C[1]-52,140,100);g.restore()}}
function trapMira(g,img,pos,hop,t,mv,gait){const s=TR.s;
 if(!TR.vis||!s.mv||!TS.ready){mira(g,img,pos[0],pos[1],hop,t,mv,gait);return}
 if(s.hide)return;if(TR.ft==null)TR.ft=t;
 const C=TS.C,fx=pos[0]-6.5,fy=pos[1]+10;if(s.clip)g.clip(TS.clipV);
 g.translate(C[0],C[1]+s.my);g.rotate(s.mr);g.scale(s.ms,s.ms);g.translate(-C[0],-C[1]);
 if(s.msx!==1||s.msy!==1){g.translate(fx,fy);g.scale(s.msx,s.msy);g.translate(-fx,-fy)}
 mira(g,img,pos[0],pos[1],0,TR.ft,false)}
function trRing(g,k,C){if(k<=0||k>=1)return;const r=22+150*eo3(k),a=1-k;g.save();g.translate(C[0],C[1]);g.scale(1,.55);g.globalCompositeOperation='lighter';g.strokeStyle=TS.seamCol;
 g.globalAlpha=a*.9;g.lineWidth=4*a+1;g.beginPath();g.arc(0,0,r,0,6.2832);g.stroke();g.globalAlpha=a*.25;g.lineWidth=14*a+2;g.stroke();g.restore()}
function trapOver(g){if(!TR.vis||!TS.ready)return;const s=TR.s,C=TS.C;
 trRing(g,s.ring,C);trRing(g,s.ring2,C);
 if(s.bang>=0&&s.bang<.45){const k=eoB(CL(s.bang/.14,0,1)),fade=s.bang>.3?1-(s.bang-.3)/.15:1;g.save();g.globalAlpha=CL(fade,0,1);g.translate(C[0]+TC.bang[0],C[1]+TC.bang[1]);g.scale(k,k);g.rotate(-.12);
  g.fillStyle='#fff3cf';g.strokeStyle='#2a1c0c';g.lineWidth=2.5;g.lineJoin='round';g.beginPath();g.ellipse(0,0,11,14,0,0,6.2832);g.fill();g.stroke();
  g.beginPath();g.moveTo(-7,9);g.lineTo(-13,19);g.lineTo(-1,13);g.closePath();g.fill();g.stroke();
  g.fillStyle='#d8452a';g.fillRect(-2.6,-9,5.2,10);g.beginPath();g.arc(0,5.5,2.8,0,6.2832);g.fill();g.restore()}}

/* ---------- input lock (canvas, hotbar, Undo / End Turn ...). The speaker button stays usable. ---------- */
['click','dblclick','mousedown','mouseup','pointerdown','pointerup','touchstart','touchend','contextmenu'].forEach(n=>document.addEventListener(n,e=>{
 if(!TR.lock)return;if(e.target.closest&&e.target.closest('#fxsnd'))return;e.stopImmediatePropagation();if(e.cancelable&&n.indexOf('touch')<0)e.preventDefault()},true));
document.addEventListener('keydown',e=>{if(!TR.lock)return;
 if((e.key==='Escape'||e.key===' '||e.code==='Space')&&TR.st==='in')trSkip();
 e.stopImmediatePropagation();e.preventDefault()},true);
/* Esc / Space skip works from the first frame too: the lock swallows them before 0.8s */

const trCSS=document.createElement('style');trCSS.textContent=`
#triris{position:absolute;inset:0;z-index:60;background:#000;pointer-events:none;display:none;--cx:736px;--cy:416px;--r:-8px;
 -webkit-mask:radial-gradient(circle at var(--cx) var(--cy),transparent var(--r),#000 calc(var(--r) + 6px));mask:radial-gradient(circle at var(--cx) var(--cy),transparent var(--r),#000 calc(var(--r) + 6px))}
#triris.rm{-webkit-mask:none;mask:none}
#fxsnd{z-index:46}
#hallfx{position:absolute;inset:0;z-index:41;pointer-events:none;overflow:hidden;display:none}
#hallfx.on{display:block}
#hallfx .sh{position:absolute;top:-80px;height:980px;background:linear-gradient(rgba(255,238,178,.34),rgba(255,238,178,.12) 55%,rgba(255,238,178,0));clip-path:polygon(34% 0,66% 0,100% 100%,0 100%);mix-blend-mode:screen;transform-origin:50% 0;transform:rotate(var(--a));opacity:0;animation:trSway 9s ease-in-out infinite alternate,trShIn 1.6s ease-out forwards}
@keyframes trSway{from{transform:rotate(calc(var(--a) - 1.6deg))}to{transform:rotate(calc(var(--a) + 1.6deg))}}
@keyframes trShIn{to{opacity:1}}
#hallfx .mo{position:absolute;border-radius:50%;background:radial-gradient(circle,rgba(255,244,196,.95),rgba(255,226,140,0) 70%);opacity:0;animation:trDrift var(--dur) ease-in-out var(--dl) infinite alternate,trTw var(--tw) ease-in-out var(--dl) infinite}
@keyframes trDrift{from{transform:translate(0,0)}to{transform:translate(var(--dx),var(--dy))}}
@keyframes trTw{0%,100%{opacity:0}50%{opacity:.9}}
#hallfx .bs{position:absolute;width:12px;height:12px;margin:-6px;background:#ffe9a0;clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);opacity:0;animation:trBurst .9s cubic-bezier(.15,.7,.3,1) forwards}
@keyframes trBurst{0%{opacity:1;transform:translate(0,0) scale(.3) rotate(0)}70%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1) rotate(160deg)}}
#hallpg.intro .hh{animation:trHead .8s cubic-bezier(.2,.8,.25,1) .05s both}
@keyframes trHead{0%{opacity:0;transform:translateY(-190px)}45%{opacity:1;transform:translateY(14px)}65%{transform:translateY(-6px)}82%{transform:translateY(3px)}100%{opacity:1;transform:none}}
#hallpg .cd{left:0;top:0;width:1669px;height:942px;pointer-events:none}
#hallpg .cd>*{position:absolute}
#hallpg.intro .cd{animation:trPop .55s cubic-bezier(.2,.9,.3,1.15) calc(.35s + var(--i)*.06s) both}
@keyframes trPop{0%{opacity:0;transform:scale(.85) rotate(var(--r))}55%{opacity:1;transform:scale(1.045) rotate(calc(var(--r)*-.35))}100%{opacity:1;transform:none}}
#hallpg .gl{overflow:hidden;pointer-events:none;border-radius:6px}
#hallpg .gl i{position:absolute;top:-30%;left:0;width:38%;height:160%;background:linear-gradient(100deg,rgba(255,250,225,0),rgba(255,250,225,.5),rgba(255,250,225,0));transform:translateX(-160%) skewX(-18deg);animation:trGloss 6.5s ease-in-out infinite;animation-delay:calc(2s + var(--i)*1.4s)}
@keyframes trGloss{0%{transform:translateX(-160%) skewX(-18deg)}24%,100%{transform:translateX(330%) skewX(-18deg)}}
#hallpg .hp-e{animation:trFloat 4.2s ease-in-out infinite}
@keyframes trFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
#hallpg .hd.tout{animation:trOut calc(var(--tt,.28s)/2) ease-in forwards}
#hallpg .hd.tin{animation:trIn2 calc(var(--tt,.28s)/2) ease-out both}
@keyframes trOut{from{transform:scale(.882) translateX(834px) perspective(1500px) rotateY(0) translateX(-834px);opacity:1}to{transform:scale(.882) translateX(834px) perspective(1500px) rotateY(calc(var(--d)*-24deg)) translateX(-834px);opacity:0}}
@keyframes trIn2{from{transform:scale(.882) translateX(834px) perspective(1500px) rotateY(calc(var(--d)*24deg)) translateX(-834px);opacity:0}to{transform:scale(.882) translateX(834px) perspective(1500px) rotateY(0) translateX(-834px);opacity:1}}
#trmira{position:absolute;z-index:45;display:none;left:61px;top:652px;width:68px;height:153px;pointer-events:none;transform-origin:50% 100%}
#trmira img{display:block;width:68px;height:153px}
#trmira:before{content:'';position:absolute;left:6px;right:6px;bottom:-5px;height:12px;border-radius:50%;background:radial-gradient(rgba(60,40,20,.38),rgba(60,40,20,0) 70%);z-index:-1}
#trmira.idle{animation:trBreathe 4.4s ease-in-out infinite}
@keyframes trBreathe{0%,100%{transform:none}50%{transform:scale(.99,1.013)}}
#trdust{position:absolute;z-index:44;left:95px;top:802px;width:70px;height:26px;margin:-13px 0 0 -35px;border-radius:50%;border:3px solid rgba(255,244,220,.75);opacity:0;pointer-events:none}
#trdust.go{animation:trRing .6s ease-out}
@keyframes trRing{0%{opacity:.9;transform:scale(.2)}100%{opacity:0;transform:scale(2.3)}}
#hallesc{position:absolute;left:0;right:0;bottom:11px;z-index:44;text-align:center;font:500 14px/1 'Lora',Georgia,serif;letter-spacing:.6px;color:#5b4430;opacity:0;transition:opacity 1.1s ease;pointer-events:none;user-select:none}
#stage.hall-ready #hallesc{opacity:.5}
#hallpg.rm .hh,#hallpg.rm .cd,#hallpg.rm .gl i,#hallpg.rm .hp-e,#hallpg.rm .hd{animation:none!important}
#hallfx .vg{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 52%,rgba(80,38,14,.38) 100%);mix-blend-mode:multiply}
#hallfx .gr{position:absolute;inset:0;background:linear-gradient(rgba(255,205,140,.12),rgba(255,170,110,.07));mix-blend-mode:soft-light}
#hallfx .fl{position:absolute;width:280px;height:280px;margin:-140px;border-radius:50%;background:radial-gradient(circle,rgba(150,215,255,.42),rgba(110,170,255,.15) 40%,rgba(110,170,255,0) 70%);mix-blend-mode:screen;animation:trFlick 1.7s ease-in-out infinite}
@keyframes trFlick{0%,100%{opacity:.75;transform:scale(1)}20%{opacity:1;transform:scale(1.07)}45%{opacity:.68;transform:scale(.95)}70%{opacity:.95;transform:scale(1.04)}}
#hallfx .em{position:absolute;width:3px;height:3px;border-radius:50%;background:#d4efff;box-shadow:0 0 6px 2px rgba(150,210,255,.7);opacity:0;animation:trEmber 3s ease-out infinite}
@keyframes trEmber{0%{opacity:0;transform:translate(0,0)}15%{opacity:.95}100%{opacity:0;transform:translate(var(--dx),-140px)}}
#hallfx .hb{position:absolute;left:400px;top:10px;width:672px;height:190px;background:radial-gradient(ellipse,rgba(255,226,150,.38),rgba(255,226,150,0) 70%);mix-blend-mode:screen;animation:trBloom 5s ease-in-out infinite}
@keyframes trBloom{0%,100%{opacity:.45}50%{opacity:1}}
#hallfx .hs{position:absolute;left:440px;top:48px;width:585px;height:118px;overflow:hidden;border-radius:14px}
#hallfx .hs b{position:absolute;top:-20%;left:0;width:22%;height:140%;background:linear-gradient(100deg,rgba(255,250,225,0),rgba(255,250,225,.6),rgba(255,250,225,0));mix-blend-mode:screen;transform:translateX(-150%) skewX(-18deg);animation:trHs 7s ease-in-out 2.5s infinite}
@keyframes trHs{0%{transform:translateX(-150%) skewX(-18deg)}22%,100%{transform:translateX(560%) skewX(-18deg)}}
#hallfx .gm{position:absolute;width:26px;height:26px;margin:-13px;background:#fff6d0;clip-path:polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%);mix-blend-mode:screen;opacity:0;animation:trGem 3.6s ease-in-out infinite}
@keyframes trGem{0%,68%,100%{opacity:0;transform:scale(.2) rotate(0)}80%{opacity:1;transform:scale(1) rotate(45deg)}92%{opacity:0;transform:scale(.5) rotate(90deg)}}
#hallfx.rm .fl,#hallfx.rm .em,#hallfx.rm .hb,#hallfx.rm .hs b,#hallfx.rm .gm{animation:none!important}
#hallfx.rm .sh,#hallfx.rm .mo{animation:none!important;display:none}
@media (prefers-reduced-motion:reduce){#hallpg .hh,#hallpg .cd,#hallpg .gl i,#hallpg .hp-e,#hallpg .hd,#hallfx .sh,#hallfx .mo,#hallfx .fl,#hallfx .em,#hallfx .hb,#hallfx .hs b,#hallfx .gm,#trmira{animation:none!important}#hallfx .sh{opacity:1}}
`;document.head.appendChild(trCSS);
(function trWarm(){trPrep();if(!TS.ready)setTimeout(trWarm,400)})();   /* crop the tile sprites as soon as the background has decoded */



/* =====================================================================
   Public API used by the small hooks in the game code
   ===================================================================== */
const FX={CONFIG,AU,
 begin(dt,t){frameNo++;dtR=dt;now+=dt;if(now<hitUntil)tsv=0;else if(now<slowUntil){const k=(now-slowFrom)/(slowUntil-slowFrom);tsv=slowScale+(1-slowScale)*Math.pow(k,3)}else tsv=1;dtS=dt*tsv;fxT+=dtS;
  for(let i=schedF.length-1;i>=0;i--)if(fxT>=schedF[i].at){const f=schedF[i].fn;schedF.splice(i,1);try{f()}catch(e){console.error(e)}}
  for(let i=sched.length-1;i>=0;i--)if(now>=sched[i].at){const f=sched[i].fn;sched.splice(i,1);try{f()}catch(e){}}
  trapTick(dt);applyShake();updP(dtS);sweepEF()},
 ts(){return tsv},
 under(g,t){drawUnder(g);trapUnder(g)},
 shk,mira,obj,trapMira,_trap:()=>({st:TR.st,t:TR.t,lock:TR.lock,vis:TR.vis}),
 items(it,g,t){ghostItems(it,g,t)},
 over(g,t){for(const p of PS)drawP(g,p);drawOver(g);trapOver(g)},
 hp,ghostBar,
 attack,defeat,summon,bossHit,heal,previewDefeat,
 /* handy for tuning / testing from the console */
 _state:()=>({particles:PS.length,effects:EF.length,ghosts:GH.length,ambient:AM.length})};
window.FX=FX;window.GroveAU=AU;
/* only what the boss screens need: wake the audio engine on the first touch, follow the site's own mute (grove.mute), play the panel sounds */
document.addEventListener('pointerdown',()=>AU.unlock(),true);document.addEventListener('keydown',()=>AU.unlock(),true);
const siteMuted=()=>{try{return localStorage.getItem('grove.mute')==='1'}catch(e){return false}};
setInterval(()=>{const m=siteMuted();if(m!==AU.muted)AU.setMuted(m)},400);
let tries=0;(function boot(){wirePanels();if(++tries<8)setTimeout(boot,600)})();
})();
