# Trapdoor + Hall of Fame animation — how to add it to the single-file game (`index.html`)

Paste this whole file to another LLM together with your `index.html`. It contains (1) what the feature does, (2) how the game code is organised, (3) the exact edits, and (4) the complete code. The result is an `index.html` that behaves the same as the one built in this chat.

## 1. What the feature does
When Mira's walk ends on the HALL tile (`HALL=[-2,-5]`, top of the stairs), instead of opening the Hall instantly:
1. PRESS 0–.25s tile sinks 3px and darkens, dust puffs, stone thunk + click.
2. RUMBLE .25–.8s shake ramps to 3px (also shakes the stage background), pebbles, gold light pulses along the tile seams, low rumble, music ducked to 40% with a low-pass.
3. SLIDE .8–1.5s the tile (a sprite cropped from the painted background) slides one tile south-west under the paved stair landing (tile -2,-4), revealing a dark-indigo pit with walls, swirling glow, gold light shafts and rising sparkles. Grinding sound, then a 3-note shimmer.
4. HANG 1.5–1.8s Mira wobbles, a "!" bubble pops, "uh-oh" sound.
5. FALL 1.8–2.5s gravity drop, scale 1→.35, spin, clipped by the front rim of the hole, speed lines, slide-whistle.
6. TELEPORT 2.5–3.2s light rings, then a circular iris closes to black (DOM overlay with a radial-gradient mask).
7. ARRIVAL 3.2–4.4s the Hall opens under the iris, Mira (a DOM sprite) drops from the top into the bottom-left corner, squash/stretch landing, dust ring, small shake, ambience fades in.
Esc/Space after 0.8s skips to the Hall. All input is locked during it (the speaker button still works).
**Leaving the Hall:** no Leave button and no backdrop click; only **Esc**, which plays a ~1.6s reverse (iris, Mira pops out, tile slides shut with a clack, input unlocks, Mira stays on HALL; it re-triggers only after she steps off and on, via the existing `hallSeen` flag).
**Hall of Fame intro/idle (CSS only):** header drops with a bounce and gold sparkle burst, cards pop in 60ms apart with a "plink" each, light shafts, ~30 drifting motes, gloss sweep on each frame, book-style page turn (~280ms, rotateY) with a paper "fwip", floating empty-state text, a faint "Esc to leave" hint. Extra polish: flickering torch glow + embers, golden header bloom and shimmer, twinkling frame gems, warm colour grade and vignette.
Reduced motion (`RM()`): replaced by a 0.4s fade and one thunk. Mute is honoured (all sound goes through `AU`, synthesised, no files). Particles are capped at 120 (`CONFIG.trap.partCap`).

## 2. Assumptions about the existing game code
- `#stage` is 1472x832; its CSS background is one painted JPEG (2208x1248) shown at 1472x832. Canvas `#cv` is drawn in 1472x832 coordinates.
- Globals used: `cq(a,b)` (4 tile corners: top,left,bottom,right), `cc(a,b)` (tile centre), `HALL`, `cur`, `pos`, `path`, `hist`, `SPR` (Mira's Image), `hallSeen`.
- An existing `FX` IIFE contains `CONFIG`, `AU` (WebAudio with `tone()`, `noise()`, `ok()`, `T0()`, `NOTE()`), particles (`addP`, `PS`, kinds `dot/smoke/spark`), `shake()`/`SK`/`applyShake()`, `flash()`, `RM()`, helpers `$`, `R`, `RI`, `CL`, `LP`, `eo3`, `eoB`, and hooks `FX.begin/under/over/mira`, plus `hallFx` and `watch('#hallpg',...)`.
- The Hall page is built by `hallPage()` inside `#hallpg` (z-index 40) with `openHall()`; Esc previously called `closeHall()`.

## 3. How to apply
**Easiest and exact:** run the Python script in Appendix A (`patch.py`) next to the original `index.html` (edit the input path at the top), and then `patch2.py` (Appendix B). They perform each find/replace with an assertion that the anchor occurs exactly once, so if the anchors differ in your file the script tells you which one failed. Appendices C and D are the two big code files that `patch.py` reads (`au_add.js`, `trap_module.js`) — save them with those exact names in the same folder.

If you instead apply by hand, each `rep(old,new)` call in `patch.py` is one edit: find `old` in index.html, replace with `new`. In summary:
1. **Hall markup/CSS:** delete the `.hp-x` Leave button markup and all `.hp-x` CSS (including in transition selector lists).
2. **`hallPage()` template:** wrap each card slot in `<div class="cd" style="--i;--r;transform-origin">…</div>` and add a `.gl` gloss element after the frame. Needed for the pop-in and gloss CSS.
3. **Hall script:** expose `window.closeHall`; add `turnPage()` (page turn animation + fwip); the arrow click uses it; remove backdrop close; Esc calls `window.exitHall()`.
4. **`frame()`:** the HALL trigger calls `window.startTrap()` (fallback `openHall`); Mira's draw calls `FX.trapMira(gx,SPR,pos,hop,t,mv)`.
5. **FX CONFIG:** add the `trap:{…}` block (every tunable: timings, shake, sink, colours, volumes).
6. **AU:** add a `musLP` low-pass between `mus` and `duckG`; give `duck()` a third `lp` argument; add the new SFX presets (Appendix C).
7. **Shake:** `applyShake` optionally shifts the stage background (`SK.bg`, `bgShift()`) so the pit and the background rumble together.
8. **FX hooks:** `begin` calls `trapTick(dt)` before `applyShake()`; `under` calls `trapUnder(g)`; `over` calls `trapOver(g)`; the FX object exports `trapMira`; `hallFx` also calls `hallIntro(el)`; `watch('#hallpg',hallFx,hallGone)`.
9. **Insert the module** (Appendix D) just before the `Public API` banner comment of the FX IIFE.
10. **Polish** (Appendix B) adds extra Hall decor elements and CSS.

## 4. How the module works (read before editing)
- **Sprites:** `trPrep()` reads the stage background data-URL, decodes it, and `trCrop()` cuts the HALL quad plus 6px side thickness (and the neighbour tile) into cached 2x offscreen canvases. `trBuildPit()` pre-renders the pit walls/floor once; glow and light-shaft sprites are pre-rendered so nothing is allocated per frame.
- **State machine:** `TR.st` is `idle | in | hall | out | rm | rm-out`. Visual state is a pure function of time (`stIn(t)`, `stOut(t)`, `stHall()`); one-shot sounds/particles are an event list (`trEvents`) so skipping never replays them (events flagged `logic` such as opening the Hall always run).
- **Drawing:** `trapUnder` draws pit → glow → tile (sunk/slid) → seam light → neighbour sprite with shadow → light shafts, all below Mira. `trapMira` wraps Mira's draw with translate/rotate/scale/squash and clips to the area above the hole's front rim so she disappears inside. `trapOver` draws rings and the "!" bubble.
- **Iris:** `#triris` black overlay (z 60) with a CSS radial-gradient mask whose `--r/--cx/--cy` custom properties are driven each frame; r=-8px means fully black.
- **Input lock:** capture-phase listeners on `document` stop clicks/pointer/keys while `TR.lock` (except `#fxsnd`), and Esc/Space triggers `trSkip()`.
- **Hall decor:** `trEls()` builds `#hallfx` (shafts, motes, torch glow, embers, bloom, gems), Mira's DOM sprite `#trmira`, the dust ring, the iris, and the single `#hallesc` hint element (delete that one line + its CSS to remove the hint). Intro animations are CSS keyframes switched on by the `.intro` class that `hallIntro()` adds for `CONFIG.trap.hall.introMs`.
- **Tuning:** everything lives in `CONFIG.trap` (`at` = phase start times, `sink`, `shake`, `pit`, `fallDrop`, `iris`, `land`, `out`, `hall`, `col`, `vol`).
- **Choosing the slide neighbour:** the neighbour is tile `(HALL[0],HALL[1]+1)` = the flat paved top-stair landing. Verify by cropping the background; the other neighbours are grass, bushes and an arch.

## Appendix A — `patch.py` (exact edits)
~~~~python
import re
src=open('/mnt/user-data/uploads/index__20_.html',encoding='utf-8').read()
def rep(old,new,cnt=1):
    global src
    n=src.count(old)
    assert n==cnt,(n,old[:80])
    src=src.replace(old,new)
# ---- Hall: remove Leave button + CSS
rep("#hallpg .hp-x{position:absolute;right:34px;top:26px;padding:7px 20px;font:21px 'Patrick Hand',cursive;color:#2b1d08;border:1.5px solid #20180d;border-radius:9px;background:linear-gradient(#fbf3de,#eadcb8);box-shadow:0 2px 0 #b89f6c;cursor:pointer}\n","")
i=src.index("#hallpg .hp-x{left:1225px");j=src.index("#hallpg .hp-x:hover{filter:brightness(1.05)}\n")+len("#hallpg .hp-x:hover{filter:brightness(1.05)}\n")
src=src[:i]+src[j:]
rep("#bcard .jnav,.hp-x,#eb,#ago{","#bcard .jnav,#eb,#ago{")
rep("#bcard .jnav:hover,.hp-x:hover,#eb:hover","#bcard .jnav:hover,#eb:hover")
rep("#bcard .jnav:active,.hp-x:active,#eb:active","#bcard .jnav:active,#eb:active")
rep("""let h='<button class="hp-x" type="button">Leave</button><div class="hd">""","""let h='<div class="hd">""")
rep("slots.forEach(s=>{const x=s.it;","slots.forEach((s,si)=>{const x=s.it;")
rep("""  h+=`<div class="pt" style="left:${s.fx+s.wx}px;""","""  h+=`<div class="cd" style="--i:${si};--r:${[-3,2.5,3][si]}deg;transform-origin:${s.fx+(s.t==='s'?160:207)}px ${s.fy+(s.t==='s'?190:209)}px"><div class="pt" style="left:${s.fx+s.wx}px;""")
rep("""<div class="fm ${s.t}" style="left:${s.fx}px;top:${s.fy}px"></div>`;""","""<div class="fm ${s.t}" style="left:${s.fx}px;top:${s.fy}px"></div><div class="gl" style="left:${s.fx+s.wx}px;top:${s.fy+s.wy}px;width:${s.ww}px;height:${s.wh}px;--i:${si}"><i></i></div>`;""")
rep("""Empty</div>`)+'</div>'});""","""Empty</div>`)+'</div></div>'});""")
rep("""const closeHall=()=>{HP.style.display='none'};
HP.addEventListener('click',e=>{const n=e.target.closest('.hpn');if(n){if(!n.disabled){hpg+=+n.dataset.p;hallPage()}return}if(e.target.closest('.hp-x')||e.target===HP)closeHall()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&HP.style.display==='block')closeHall()});""",
"""const closeHall=()=>{HP.style.display='none'};window.closeHall=closeHall;
/* leaving the Hall is Esc-only (no Leave button, no backdrop click); Esc plays the reverse trapdoor sequence */
let turning=false;
function turnPage(d){if(turning)return;turning=true;const hd=HP.querySelector('.hd'),F=window.FX,T=F?F.CONFIG.trap.hall.turn:.28;
 if(F&&F.AU.fwip)F.AU.fwip();
 if(!hd||(F&&F.CONFIG.reducedMotion)){hpg+=d;hallPage();turning=false;return}
 hd.style.setProperty('--d',d);hd.style.setProperty('--tt',T+'s');hd.classList.add('tout');
 setTimeout(()=>{hpg+=d;hallPage();const h2=HP.querySelector('.hd');if(h2){h2.style.setProperty('--d',d);h2.style.setProperty('--tt',T+'s');h2.classList.add('tin')}
  setTimeout(()=>{const h3=HP.querySelector('.hd');if(h3)h3.classList.remove('tin');turning=false},T*500)},T*500)}
HP.addEventListener('click',e=>{const n=e.target.closest('.hpn');if(n&&!n.disabled)turnPage(+n.dataset.p)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&HP.style.display==='block'){if(window.exitHall)window.exitHall();else closeHall()}});""")
# ---- frame()
rep("if(on&&!hallSeen){hallSeen=true;window.openHall&&window.openHall()}","if(on&&!hallSeen){hallSeen=true;if(window.startTrap)window.startTrap();else window.openHall&&window.openHall()}")
rep("FX.mira(gx,SPR,pos[0],pos[1],hop,t,mv);gx.restore()}else","FX.trapMira?FX.trapMira(gx,SPR,pos,hop,t,mv):FX.mira(gx,SPR,pos[0],pos[1],hop,t,mv);gx.restore()}else")
# ---- CONFIG
cfg="""musicOn:true,duck:.4},  // volumes 0-1, duck = music level under big hits
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
  }"""
rep("musicOn:true,duck:.4}  // volumes 0-1, duck = music level under big hits",cfg)
# ---- AU
rep("mus,duckG,comp,noiseBuf","mus,duckG,musLP,hamb=null,comp,noiseBuf")
rep("mus.connect(duckG);","musLP=ctx.createBiquadFilter();musLP.type='lowpass';musLP.frequency.value=20000;mus.connect(musLP);musLP.connect(duckG);")
old=re.search(r"  duck\(level,sec\)\{.*?setTargetAtTime\(1,t\+sec,\.5\)\}\n",src,re.S).group(0)
rep(old,open('au_add.js').read())
# ---- shake bg
rep("if(k<=0){SK.on=false;SHK_EL.forEach(e=>e.style.translate='');return}","if(k<=0){SK.on=false;SHK_EL.forEach(e=>e.style.translate='');if(SK.bg){SK.bg=false;bgShift(0,0)}return}")
rep("SHK_EL.forEach(e=>e.style.translate=x.toFixed(2)+'px '+y.toFixed(2)+'px')}","SHK_EL.forEach(e=>e.style.translate=x.toFixed(2)+'px '+y.toFixed(2)+'px');if(SK.bg)bgShift(x,y)}\nfunction bgShift(x,y){const s=$('#stage');if(!s)return;if(!x&&!y){s.style.backgroundPosition='';s.style.backgroundRepeat='';return}s.style.backgroundRepeat='no-repeat';s.style.backgroundPosition=x.toFixed(2)+'px '+y.toFixed(2)+'px'}")
# ---- FX hooks
rep("  applyShake();updP(dtS);sweepEF()},","  trapTick(dt);applyShake();updP(dtS);sweepEF()},")
rep("under(g,t){drawUnder(g)},","under(g,t){drawUnder(g);trapUnder(g)},")
rep("drawOver(g);ambient(g,dtR)},","drawOver(g);ambient(g,dtR);trapOver(g)},")
rep(" shk,mira,obj,"," shk,mira,obj,trapMira,_trap:()=>({st:TR.st,t:TR.t,lock:TR.lock,vis:TR.vis}),")
rep("easeIn(el);AU.hall()}","easeIn(el);AU.hall();hallIntro(el)}")
rep("watch('#hallpg',hallFx,()=>AU.panel(false));","watch('#hallpg',hallFx,hallGone);")
# ---- module
banner="/* =====================================================================\n   Public API used by the small hooks in the game code"
rep(banner,open('trap_module.js').read()+"\n"+banner)
open('index.html','w',encoding='utf-8').write(src)
print(len(src))

~~~~

## Appendix B — `patch2.py` (extra Hall polish)
~~~~python
s=open('index.html',encoding='utf-8').read()
def rep(a,b):
    global s
    assert s.count(a)==1,a[:60]; s=s.replace(a,b)
rep(" st.appendChild(fx);st.appendChild(dust);",""" const add=(cls,css,html)=>{const e=mk('i',0,cls);if(css)e.style.cssText=css;if(html)e.innerHTML=html;fx.appendChild(e)};
 add('vg');add('gr');add('hb');add('hs','','<b></b>');
 [[92,236],[1367,236]].forEach(([x,y],i)=>{add('fl','left:'+x+'px;top:'+y+'px;animation-delay:'+(-i*.8)+'s');for(let k=0;k<6;k++)add('em','left:'+(x+R(-9,9)).toFixed(0)+'px;top:'+(y+8)+'px;--dx:'+R(-26,26).toFixed(0)+'px;animation-duration:'+R(2.4,3.8).toFixed(1)+'s;animation-delay:'+(-R(0,3.5)).toFixed(2)+'s')});
 [[305,252],[729,222],[1153,252]].forEach(([x,y],i)=>add('gm','left:'+x+'px;top:'+y+'px;animation-delay:'+(-i*1.2)+'s'));
 st.appendChild(fx);st.appendChild(dust);""")
css="""#hallfx .vg{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 52%,rgba(80,38,14,.38) 100%);mix-blend-mode:multiply}
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
"""
rep("#hallfx.rm .sh,#hallfx.rm .mo{animation:none!important;display:none}",css+"#hallfx.rm .sh,#hallfx.rm .mo{animation:none!important;display:none}")
rep("#hallfx .sh,#hallfx .mo,#trmira{animation:none!important}","#hallfx .sh,#hallfx .mo,#hallfx .fl,#hallfx .em,#hallfx .hb,#hallfx .hs b,#hallfx .gm,#trmira{animation:none!important}")
open('index.html','w',encoding='utf-8').write(s)

~~~~

## Appendix C — `au_add.js` (audio presets spliced into the `AU` api object)
~~~~js
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

~~~~

## Appendix D — `trap_module.js` (the main module, inserted before the Public API banner)
~~~~js
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
function trapMira(g,img,pos,hop,t,mv){const s=TR.s;
 if(!TR.vis||!s.mv||!TS.ready){mira(g,img,pos[0],pos[1],hop,t,mv);return}
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
#hallfx.rm .sh,#hallfx.rm .mo{animation:none!important;display:none}
@media (prefers-reduced-motion:reduce){#hallpg .hh,#hallpg .cd,#hallpg .gl i,#hallpg .hp-e,#hallpg .hd,#hallfx .sh,#hallfx .mo,#trmira{animation:none!important}#hallfx .sh{opacity:1}}
`;document.head.appendChild(trCSS);
(function trWarm(){trPrep();if(!TS.ready)setTimeout(trWarm,400)})();   /* crop the tile sprites as soon as the background has decoded */


~~~~

## 5. Test checklist (Playwright)
Walk Mira onto HALL; screenshot at ~0.1, 0.6, 1.2, 1.65, 2.1, 2.8, 3.6s and after finish. Confirm: no console errors (a Google Fonts failure offline is expected); clicks/Undo/End Turn do nothing during the sequence; backdrop click does not close the Hall; Esc after 0.8s skips; Esc in the Hall plays the exit; Mira ends on HALL; re-entry works only after stepping off and on; Undo works afterwards. `FX._trap()` returns `{st,t,lock,vis}` for polling.
