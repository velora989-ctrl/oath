/* =====================================================================
   Bosses (the Bosses button) + Hall of Fame (the stairs). Saved per player on the server (api.js getBosses / saveBosses),
   with a copy on this device. Pictures live in boss/. Strike animations are in bossfx.js.
   ===================================================================== */
window.BUI={"panel_boss": "boss/ui/panel_boss.webp", "btn_edit": "boss/ui/btn_edit.webp", "btn_add": "boss/ui/btn_add.webp", "btn_close": "boss/ui/btn_close.webp", "btn_atk": "boss/ui/btn_atk.webp", "panel_new": "boss/ui/panel_new.webp", "in_goal": "boss/ui/in_goal.webp", "in_mini": "boss/ui/in_mini.webp", "btn_sug": "boss/ui/btn_sug.webp", "dd": "boss/ui/dd.webp", "numbox": "boss/ui/numbox.webp", "stylebox": "boss/ui/stylebox.webp", "btn_summon": "boss/ui/btn_summon.webp", "atk_box": "boss/ui/atk_box.webp", "atk_in": "boss/ui/atk_in.webp", "atk_btn": "boss/ui/atk_btn.webp", "h_head": "boss/ui/h_head.webp", "h_info": "boss/ui/h_info.webp", "h_small": "boss/ui/h_small.webp", "h_mid": "boss/ui/h_mid.webp", "card": "boss/ui/card.webp", "stylebox_on": "boss/ui/stylebox_on.webp", "h_bg": "boss/ui/h_bg.webp", "p_cat": "boss/ui/p_cat.webp", "p_green": "boss/ui/p_green.webp", "p_purple": "boss/ui/p_purple.webp"};

/* Bosses: real-life goals turned into bosses with an HP bar. Mini bosses are the daily actions; "Strike" after doing one.
   Saved per player on the server (api.js getBosses / saveBosses) with a copy on this device, like the Holidays calendar. */
(function(){
const $=s=>document.querySelector(s),stage=$('#stage');
const token=()=>{try{return localStorage.getItem('grove_token')||''}catch(e){return''}};
function who(){const t=token();if(!t)return'guest';try{const p=JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(p&&(p.id||p._id||p.sub))return String(p.id||p._id||p.sub)}catch(e){}return t.slice(-16)}
let me=who(),D={v:2,list:[],hall:[]},dirty=false,rev=0,saveT=0,saving=false,again=false,loadN=0;
/* looking at ANOTHER player's bosses: their data replaces D (read-only: nothing is saved, no strikes, no editing) and my own is kept in MYD */
let RO=false,VIEW='',VNAME='',MYD=null,viewSeq=0;
const lkey=()=>'grove_bosses_'+me;
const norm=o=>{o=o&&typeof o==='object'?o:{};return{v:2,list:Array.isArray(o.list)?o.list:[],hall:Array.isArray(o.hall)?o.hall:[]}};
function readLocal(){try{return JSON.parse(localStorage.getItem(lkey())||'null')}catch(e){return null}}
function writeLocal(){if(RO)return;try{localStorage.setItem(lkey(),JSON.stringify({dirty,v:2,list:D.list,hall:D.hall}))}catch(e){}}
async function push(){clearTimeout(saveT);saveT=0;if(RO)return;const A=window.GroveAPI;if(!A||!A.saveBosses||!token())return;
 if(saving){again=true;return}saving=true;const r=rev;
 try{await A.saveBosses({list:D.list,hall:D.hall});if(r===rev){dirty=false;writeLocal()}}catch(e){}
 saving=false;if(again){again=false;push()}}
const save=()=>{if(RO){sync();if(P.style.display==='block')render();return}rev++;dirty=true;writeLocal();clearTimeout(saveT);saveT=setTimeout(push,700);sync();if(P.style.display==='block')render()};
const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0'),dk=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today=()=>dk(new Date()),yest=()=>{const d=new Date();d.setDate(d.getDate()-1);return dk(d)};
const toast=m=>window.groveToast&&window.groveToast(m);
const PH=['Dormant','Enraged','Final Form'],FL=['none','none','none'],SC=[1,1,1];
const phase=b=>{const p=b.hp/b.max;return p>.66?0:p>.33?1:2};
const curS=b=>b.last===today()||b.last===yest()?b.streak:0;
const left=b=>Math.ceil((b.created+b.days*864e5-Date.now())/864e5);
let view='list',ask=null,err='',dr=null,testOn=false,bi=0;
const P=document.createElement('div');P.id='bp';stage.appendChild(P);
const st=document.createElement('style');st.textContent=`#bp{left:400px;top:36px;width:900px;height:684px;display:none;box-sizing:border-box;padding:18px 24px;border:1.5px solid #20180d;border-radius:10px;background:#eee0c6;box-shadow:inset 0 0 0 1.5px #fdfae7,inset 0 0 0 2.5px #cdbd9c,1px 2px 0 rgba(0,0,0,.35),0 12px 40px rgba(0,0,0,.5);color:#000;font-family:'Patrick Hand','Comic Sans MS',cursive;z-index:7;overflow-y:auto;user-select:text;scrollbar-width:thin;scrollbar-color:#8a6a3c transparent}
#bp h2{margin:0;font:400 34px 'Patrick Hand',cursive;-webkit-text-stroke:.4px #000}#bp .top{display:flex;gap:8px;align-items:center;margin-bottom:12px}#bp .top h2{flex:1}
#bp .bcd{display:flex;gap:18px;padding:12px;margin-bottom:12px;border:1.5px solid rgba(88,68,40,.55);border-radius:8px;background:#f7edd6}
#bp .bl{flex:none;width:206px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;padding:0 8px}#bp .bl img{height:150px;object-fit:contain;transition:.4s}
#bp .br{flex:1;min-width:0}#bp h3{margin:0;font:400 26px 'Patrick Hand',cursive;-webkit-text-stroke:.3px #000}#bp .sub{font-size:17px;color:#5a4a2c;margin:2px 0 8px}
#bp .hpb{position:relative;height:22px;border:1.5px solid #20180d;border-radius:11px;background:#5b2a22;overflow:hidden;margin-bottom:10px}#bp .hpb i{display:block;height:100%;background:#c1614d;transition:width .5s}#bp .hpb span{position:absolute;inset:0;text-align:center;font-size:16px;line-height:20px;color:#fff}
#bp .mr{display:flex;align-items:center;gap:10px;min-height:42px;border-top:1px solid rgba(88,68,40,.35);font-size:19px}#bp .mr img{width:34px;height:40px;object-fit:contain;flex:none}#bp .mr .mn{flex:1;min-width:0;overflow-wrap:anywhere}#bp .mr.dn{color:#5a4a2c}#bp .mr.dn .mn{text-decoration:line-through}
#bp input,#bp select{box-sizing:border-box;padding:6px 9px;border:1.5px solid #20180d;border-radius:6px;background:#f7edd6;font:19px 'Patrick Hand',cursive;color:#2b2a26;outline:0}#bp input.n{width:70px}
#bp .fr{display:flex;gap:10px;margin:0 0 10px;align-items:center;font-size:20px}#bp .fr label{width:130px}#bp .fr input.w{flex:1}
#bp .berr{color:#a12a1b;font-size:18px;min-height:22px}#bp .hf{padding:8px 12px;border-bottom:1px solid rgba(88,68,40,.4);font-size:20px}#bp .bnone{font-size:21px;color:#5a4a2c;margin:30px 0;text-align:center}
#bp .jnav{white-space:nowrap}`;document.head.appendChild(st);
/* a mini boss is measured one of three ways: time (minutes), count (a target number) or done / not done */
const KIND=m=>m&&(m.k==='count'||m.k==='done')?m.k:'time';
const meas=m=>KIND(m)==='time'?m.t+' min':KIND(m)==='count'?'target '+m.t:'done / not done';
function dmgBase(m,amt){if(KIND(m)==='done')return 5;return Math.min(15,Math.max(1,Math.floor(5*amt/m.t+1e-9)))}
function strike(b,i,mins){
 const t=today();if(!b.td||b.td.d!==t)b.td={d:t,k:[],dmg:0,m:{}};
 if(b.td.k.includes(i)||b.hp<=0)return;
 if(b.last!==t){b.streak=b.last===yest()?b.streak+1:1;b.last=t}
 let d=dmgBase(b.minis[i],mins);
 b.td.k.push(i);
 b.td.dmg+=d;b.td.m[i]=d;const p0=phase(b);b.hp=Math.max(0,b.hp-d);
 toast('-'+d+' HP');
 {const eM=ENT.find(e=>e.k==='mini'&&e.i===i&&e.bs===b.id),eC=ENT.find(e=>e.k==='cat'&&e.bs===b.id);window.FX&&FX.attack({style:b.style|0,d,hp0:b.hp+d,hp1:b.hp,max:b.max,defeated:b.hp<=0,mini:eM&&eM.o,main:eC&&eC.o,ents:ENT.filter(e=>e.bs===b.id).map(e=>e.o)})}
 if(b.hp<=0){b.done=t;D.hall.unshift({style:b.style|0,name:b.name,months:b.months,start:dk(new Date(b.created)),end:t,days:Math.max(1,Math.round((Date.now()-b.created)/864e5)),minis:b.minis.map(m=>m.n)});D.list=D.list.filter(x=>x.id!==b.id);toast('BOSS DEFEATED: '+b.name+'!')}

 save()}
function setHP(b,v){v=Math.max(0,Math.min(b.max,Math.round(v)));const p0=phase(b);b.hp=v;
 if(v<=0){window.FX&&FX.defeat({style:b.style|0,main:(ENT.find(e=>e.k==='cat'&&e.bs===b.id)||{}).o,ents:ENT.filter(e=>e.bs===b.id).map(e=>e.o)});D.hall.unshift({style:b.style|0,name:b.name,months:b.months,start:dk(new Date(b.created)),end:today(),days:Math.max(1,Math.round((Date.now()-b.created)/864e5)),minis:b.minis.map(m=>m.n)});D.list=D.list.filter(x=>x.id!==b.id);toast('BOSS DEFEATED: '+b.name+'!')}

 save()}
function listV(){
 const nb=D.list.length;bi=nb?((bi%nb)+nb)%nb:0;
 let h='<div class="bpn"><div class="ttl">Bosses</div>'+(RO?'<div class="bwho"><button type="button" data-a="pprev" aria-label="Previous player">&lsaquo;</button><span><b>'+esc(VNAME)+'</b><small>read-only</small></span><button type="button" data-a="pnext" aria-label="Next player">&rsaquo;</button></div>':'<button class="bb b-e" data-a="edit"'+(nb?'':' disabled')+'>Edit</button><button class="bb b-n" data-a="new"'+(nb>=3?' disabled':'')+'>+ New Boss</button>')+'<button class="bb b-c" data-a="close">Close</button><div class="card">';
 if(!nb)h+='<div class="none">No bosses yet.'+(RO?'':'<button class="bb" data-a="new">+ New Boss</button>')+'</div>';
 else{const b=D.list[bi],t=today(),td=b.td&&b.td.d===t?b.td:{k:[],m:{}},dl=left(b);
  h+=`<div class="art"><img src="${bImg(b)}" alt=""></div><div class="nm">${esc(b.name)}</div><div class="dl">${dl>=0?dl+' day'+(dl===1?'':'s')+' left':'overdue by '+(-dl)+' day'+(dl===-1?'':'s')}${nb>1?' &middot; '+(bi+1)+' / '+nb:''}</div><div class="hp"><i style="width:${b.hp/b.max*100}%"></i><span>${b.hp} / ${b.max}</span></div>`;
  b.minis.forEach((m,i)=>{const dn=td.k.includes(i),as=ask&&ask.b===b.id&&ask.i===i,d=KIND(m);
   h+=`<div class="mrow${dn?' dn':''}" style="top:${390+i*64}px"><img class="ic" src="${mImg(b,i)}" alt=""><div class="mnm"${as?' style="width:100px"':''}>${esc(m.n)}</div><div class="msb"${as?' style="display:none"':''}>${meas(m)}</div>`+
   (dn?`<div class="md">-${td.m[i]}</div>`:RO?'':d==='done'?`<button class="bb ab1" data-a="hit" data-b="${b.id}" data-i="${i}">Done</button>`:as?`<div class="ab2"><span class="ai"><input id="bm" type="number" min="1" value="${m.t}"></span><span class="un">${d==='count'?'pts':'min'}</span><button class="atk2" data-a="hit" data-b="${b.id}" data-i="${i}">Attack</button></div>`:`<button class="bb ab1" data-a="ask" data-b="${b.id}" data-i="${i}">Attack</button>`)+'</div>'})}
 h+='</div>';
 if(nb>1)h+='<button class="bb nav" style="left:190px" data-a="bprev">&lsaquo;</button><button class="bb nav" style="left:726px" data-a="bnext">&rsaquo;</button>';
 return h+'<div class="berr">'+esc(err)+'</div></div>'}
function readDraft(){return{n:$('#bnm').value,mo:+$('#bdur').value,st:+($('#bsty')&&$('#bsty').value)||0,raw:[0,1,2].map(i=>({n:$('#mn'+i).value,t:$('#mt'+i)?$('#mt'+i).value:1,k:$('#mk'+i).value}))}}
function newV(){
 const ph=['e.g. Learn new words','e.g. Send DMs','e.g. Workout'],d=dr||{n:'',mo:1,raw:[{n:'',t:30,k:'time'},{n:'',t:30,k:'time'},{n:'',t:30,k:'time'}]};
 let h='<div class="bpn nb"><div class="ttl">New Boss</div><div class="nbf"><div class="fr r1"><span class="lb">Goal (boss)</span><span class="inp g"><input id="bnm" maxlength="40" value="'+esc(d.n)+'" placeholder="e.g. Get good at English"></span><button type="button" class="sgb" data-f="bnm">Suggest</button></div>'
 +'<div class="fr r2"><span class="lb">Duration</span><span class="dd"><select id="bdur">'+[...Array(12)].map((_,i)=>`<option value="${i+1}"${d.mo==i+1?' selected':''}>${i+1} month${i?'s':''}</option>`).join('')+'</select></span></div>'+styRow(d.st|0);
 for(let i=0;i<3;i++){const r=d.raw[i],k=KIND(r);
  h+=`<div class="fr rm ${'abc'[i]}"><span class="lb">Mini boss ${i+1}${i?'<br>(Optional)':''}</span><span class="inp m"><input id="mn${i}" maxlength="40" value="${esc(r.n)}" placeholder="${ph[i]}"></span><button type="button" class="sgb" data-f="mn${i}">Suggest</button><span class="dd k"><select class="mk" id="mk${i}"><option value="time"${k==='time'?' selected':''}>Time</option><option value="count"${k==='count'?' selected':''}>Count</option><option value="done"${k==='done'?' selected':''}>Done</option></select></span>`+(k==='done'?'':`<span class="num"><input id="mt${i}" type="number" min="1" value="${esc(r.t)}"></span><span class="un">${k==='count'?'target':'min'}</span>`)+'</div>'}
 return h+'<div class="nbb"><button class="bb sm" data-a="create">Summon boss</button><button class="bb cn" data-a="back">Cancel</button><div class="berr">'+esc(err)+'</div></div></div></div>'}
function hallV(){
 let h='<div class="top"><h2>Hall of Fame</h2><button class="jnav" data-a="back">Back</button></div>';
 if(!D.hall.length)return h+'<p class="bnone">No boss defeated yet.</p>';
 return h+D.hall.map(x=>`<div class="hf"><b>${esc(x.name)}</b> &middot; ${x.months}-month goal defeated in ${x.days} day${x.days>1?'s':''}<br><small>${x.start} to ${x.end} &middot; ${x.minis.map(esc).join(', ')}</small></div>`).join('')}
/* ---- The Summoning Ritual: one calm step between the Bosses list and the New Boss form ---- */
const RIT=[{g:'Run 10 km in 12 weeks',m:'5 km by week 6',w:'3 runs a week',d:'20 minutes today'},
 {g:'Pass my exam in 3 months',m:'Finish the syllabus by month 2',w:'5 study sessions a week',d:'1 hour of practice today'},
 {g:'Publish 30 videos in 2 months',m:'1 video finished every 2 days',w:'4 scripts a week',d:'Write 1 script today'}];
const rit={ex:RIT[0],p:0,hold:false,raf:0,tm:[],done:false,lt:0,tk:0,rot:0};
const ritSfx=k=>{try{window.FX&&FX.AU&&FX.AU[k]&&FX.AU[k]()}catch(_){}};
const ritRM=()=>{try{return matchMedia('(prefers-reduced-motion:reduce)').matches}catch(_){return false}};
function ritStop(){cancelAnimationFrame(rit.raf);rit.raf=0;rit.tm.forEach(clearTimeout);rit.tm=[];rit.hold=false;rit.p=0;rit.done=false}
function ritV(){
 const e=rit.ex;
 const flag='<svg class="rt-fl" viewBox="0 0 16 16" width="17" height="17" aria-hidden="true"><path d="M4 14V2M4 3h9l-2 3 2 3H4" fill="#e3d3aa" stroke="#20180d" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/></svg>';
 const ar='<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M7 1v10M3 8l4 4 4-4" fill="none" stroke="#5a4a2c" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 const rows=[['Goal',e.g],['Milestone',e.m],['Weekly rhythm',e.w],['Daily action',e.d]];
 let l='';rows.forEach((r,i)=>{if(i)l+='<div class="rt-a rt-in" style="--i:'+(2+i*2)+'">'+ar+'</div>';
  l+='<div class="rt-l rt-in" style="--i:'+(3+i*2)+'"><span class="k">'+r[0]+(i?'':flag)+'</span><span class="v">'+esc(r[1])+'</span></div>'});
 /* ritual circle: tick marks + rune glyphs (rotate while holding) */
 let tk='';for(let i=0;i<36;i++){const a=i/36*Math.PI*2,r2=57,r1=r2-(i%3?3:6);tk+='M'+(60+r1*Math.cos(a)).toFixed(1)+' '+(60+r1*Math.sin(a)).toFixed(1)+'L'+(60+r2*Math.cos(a)).toFixed(1)+' '+(60+r2*Math.sin(a)).toFixed(1)}
 const gl=['M0-49l3.6 4.6L0-39.8l-3.6-4.6z','M-3.4-48.5h6.8l-3.4 8.6z','M-3.6-46a4.2 4.2 0 1 1 7.2 0 3 3 0 1 0-7.2 0z','M-3.5-44.5h7M0-48.2v7.4'];
 let rn='';for(let i=0;i<12;i++)rn+='<path transform="rotate('+i*30+')" d="'+gl[i%4]+'"/>';
 /* melted wax edge */
 let wx='';for(let i=0;i<32;i++){const a=i/32*Math.PI*2,r=35+(i%2?1.8:0)+1.6*Math.sin(i*2.1)+1.2*Math.cos(i*3.7);wx+=(i?'L':'M')+(50+r*Math.cos(a)).toFixed(1)+' '+(50+r*Math.sin(a)).toFixed(1)}wx+='Z';
 const seal='<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="rtwx" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="#f09a82"/><stop offset=".45" stop-color="#c9473b"/><stop offset="1" stop-color="#7d2a1f"/></radialGradient></defs>'
  +'<path d="M30 74q-3 12 3 15 5-2 3-14zM62 76q-2 11 4 13 5-3 2-13zM47 80q-1 8 3 9 3-2 1-9z" fill="#a8392c" stroke="#4a1a10" stroke-width="1.6" stroke-linejoin="round"/>'
  +'<path d="'+wx+'" fill="url(#rtwx)" stroke="#4a1a10" stroke-width="2" stroke-linejoin="round"/>'
  +'<circle cx="50" cy="50" r="27" fill="none" stroke="rgba(70,12,6,.5)" stroke-width="2.4"/><circle cx="50" cy="50" r="25" fill="none" stroke="rgba(255,205,185,.38)" stroke-width="1.2"/>'
  +'<path d="M50 33l3.6 9.4 9.9-2-5.7 8.4 8.4 5.7-9.9-2L50 62l-3.6-9.5-9.9 2 5.7-8.4-8.4-5.7 9.9 2z" fill="rgba(255,222,200,.14)" stroke="rgba(255,228,208,.8)" stroke-width="1.4" stroke-linejoin="round"/>'
  +'<path d="M50 62V46" stroke="rgba(255,236,218,.95)" stroke-width="1.8" stroke-linecap="round"/><path d="M50 53c-8 0-11-6-11-10 7 0 11 4 11 10zM50 49c8 0 11-6 11-10-7 0-11 4-11 10z" fill="rgba(255,236,218,.92)" stroke="rgba(120,30,20,.5)" stroke-width=".8" stroke-linejoin="round"/>'
  +'<path d="M25 40a27 27 0 0 1 15-14" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="3.2" stroke-linecap="round"/></svg>';
 const ring='<svg class="rt-rg" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="58.5" fill="none" stroke="rgba(74,55,28,.8)" stroke-width="1.8"/><circle cx="60" cy="60" r="52" fill="none" stroke="rgba(74,55,28,.6)" stroke-width="1.4" stroke-dasharray="1.5 4"/><path d="'+tk+'" stroke="rgba(74,55,28,.75)" stroke-width="1.4" fill="none"/>'
  +'<circle cx="60" cy="60" r="57" fill="none" stroke="rgba(88,68,40,.3)" stroke-width="4"/><circle class="rt-pr" cx="60" cy="60" r="57" fill="none" stroke="#dc4a2e" stroke-width="3.6" stroke-linecap="round" transform="rotate(-90 60 60)" stroke-dasharray="358.14" stroke-dashoffset="358.14"/>'
  +'<g class="rt-rn" transform="translate(60 60)"><g class="rt-rg2" fill="none" stroke="#7d2a1f" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round">'+rn+'</g></g></svg>';
 return '<div class="bpn rt"><div class="rt-glow"></div><div class="ttl">The Summoning Ritual</div>'
 +'<svg class="rt-ul" viewBox="0 0 250 12" width="250" height="12" aria-hidden="true"><path pathLength="100" d="M3 7C45 2 90 10 130 6S210 3 247 7" fill="none" stroke="#17120b" stroke-width="2.4" stroke-linecap="round"/></svg>'
 +'<div class="rt-sheet"><div class="rt-body">'
 +'<div class="rt-s rt-in" style="--i:0"><i class="n">1</i><div class="t"><b>Gather your notebook and pen.</b><span>Put the screen down for a moment.</span></div></div>'
 +'<div class="rt-s rt-in" style="--i:1"><i class="n">2</i><div class="t"><b>Write your goal and the time you give yourself.</b><span class="rt-ex">Example: <em>'+esc(e.g)+'</em></span></div></div>'
 +'<div class="rt-s rt-in" style="--i:2"><i class="n">3</i><div class="t"><b>Work backwards.</b><span>Break the goal down until you reach something small enough to do every day.</span></div></div>'
 +'<div class="rt-lad">'+l+'<div class="rt-tag rt-in" style="--i:10"><svg viewBox="0 0 16 10" width="16" height="10" aria-hidden="true"><path d="M15 5H2M5 1L1 5l4 4" fill="none" stroke="#5a4a2c" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>this becomes a mini boss</div></div>'
 +'<div class="rt-s rt-s4 rt-in" style="--i:11"><i class="n">4</i><div class="t"><b>Seal it.</b><span>Hold the wax seal to begin.</span></div>'
 +'<div class="rt-sc"><div class="rt-sw">'+ring+'<button type="button" class="rt-seal" aria-label="Hold to seal and continue">'+seal+'</button></div><div class="rt-hint">Hold to seal</div></div></div>'
 +'</div></div><div class="rt-live" aria-live="polite"></div></div>'}
function ritInit(){
 const sw=P.querySelector('.rt-sw'),sb=P.querySelector('.rt-seal'),pr=P.querySelector('.rt-pr'),rn=P.querySelector('.rt-rg2'),live=P.querySelector('.rt-live');if(!sb)return;
 const C=358.14,paint=()=>{pr.style.strokeDashoffset=(C*(1-rit.p)).toFixed(2);sw.style.setProperty('--p',rit.p.toFixed(3));rn.setAttribute('transform','rotate('+rit.rot.toFixed(1)+')')};
 const finish=()=>{rit.done=true;rit.hold=false;rit.p=1;paint();sw.classList.remove('hold');sw.classList.add('fin');sb.classList.add('st');ritSfx('click');live.textContent='Sealed. Opening the new boss form.';
  rit.tm.push(setTimeout(()=>{if(view==='ritual'){view='new';render()}},300))};
 const loop=t=>{rit.raf=0;if(rit.done)return;const dt=Math.max(0,Math.min(.05,(t-rit.lt)/1000));rit.lt=t;
  if(rit.hold){rit.p=Math.min(1,rit.p+dt/1);if(!ritRM())rit.rot+=dt*(30+300*rit.p);if(t-rit.tk>150){rit.tk=t;ritSfx('tick')}}else rit.p=Math.max(0,rit.p-dt/.4);
  paint();if(rit.hold&&rit.p>=1){finish();return}if(rit.hold||rit.p>0)rit.raf=requestAnimationFrame(loop)};
 const kick=()=>{if(!rit.raf){rit.lt=performance.now();rit.raf=requestAnimationFrame(loop)}};
 const start=()=>{if(rit.done||rit.hold)return;rit.hold=true;sw.classList.add('hold');kick()};
 const stop=()=>{if(!rit.hold)return;rit.hold=false;sw.classList.remove('hold');if(!rit.done)kick()};
 sb.addEventListener('pointerdown',e=>{if(e.button>0)return;e.preventDefault();start()});
 ['pointerup','pointercancel','pointerleave','blur'].forEach(n=>sb.addEventListener(n,stop));
 const isK=e=>e.key==='Enter'||e.key===' '||e.key==='Spacebar';
 sb.addEventListener('keydown',e=>{if(!isK(e))return;e.preventDefault();if(!e.repeat)start()});
 sb.addEventListener('keyup',e=>{if(!isK(e))return;e.preventDefault();stop()});
 sb.addEventListener('contextmenu',e=>e.preventDefault());sb.addEventListener('selectstart',e=>e.preventDefault());
 ritSfx('flip')}
function render(){
 if(view==='ritual'&&P.querySelector('.bpn.rt'))return; /* a background sync must not restart the ritual */
 ritStop();P.innerHTML=view==='new'?newV():view==='hall'?hallV():view==='ritual'?ritV():listV();if(view==='ritual')ritInit()}
P.addEventListener('click',e=>{const a=e.target.closest('[data-a]');if(!a||a.disabled)return;const k=a.dataset.a;err='';
 if(k==='pprev'||k==='pnext'){if(window.GroveCycle)window.GroveCycle(k==='pprev'?-1:1);return}
 if(RO&&!['close','bprev','bnext','hall','back','map'].includes(k))return;   /* somebody else's bosses can only be looked at */
 if(k==='close'){P.style.display='none';return}
 if(k==='edit'){startEdit();return}
 if(k==='map'){P.style.display='none';if(window.openMuseum)window.openMuseum();return}
 if(k==='new'){dr=null;rit.ex=RIT[(Math.random()*RIT.length)|0];view='ritual'}else if(k==='hall')view=k;else if(k==='back')view='list';
 else if(k==='test')testOn=!testOn;
 else if(k==='hp'||k==='hpset'||k==='reset'){const b=D.list.find(x=>String(x.id)===a.dataset.b);if(b){if(k==='hp')setHP(b,b.hp+Number(a.dataset.d));else if(k==='hpset'){const v=parseFloat($('#th'+b.id).value);if(isFinite(v))setHP(b,v)}else{b.td=null;save()}}}
 else if(k==='bprev')bi--;else if(k==='bnext')bi++;
 else if(k==='ask')ask={b:+a.dataset.b,i:+a.dataset.i};else if(k==='no')ask=null;
 else if(k==='hit'){const b=D.list.find(x=>x.id==a.dataset.b),m=b.minis[+a.dataset.i],amt=KIND(m)==='done'?1:parseFloat($('#bm').value);if(!(amt>0)){err=KIND(m)==='count'?'Enter how many you did (more than 0).':'Enter how many minutes you did (more than 0).'}else{strike(b,+a.dataset.i,amt);ask=null}}
 else if(k==='create'){const n=$('#bnm').value.trim(),mo=+$('#bdur').value,raw=[0,1,2].map(i=>{const k=$('#mk'+i).value,t=k==='done'?1:parseFloat($('#mt'+i).value);return{n:$('#mn'+i).value.trim(),t:k==='count'?Math.round(t):t,k}}),minis=raw.filter(m=>m.n);
  if(!n||!raw[0].n||minis.some(m=>!(m.t>0))){err='Name the goal and at least mini boss 1, and give each timed or counted mini boss a number above 0.';dr={n,mo,raw,st:+($('#bsty')&&$('#bsty').value)||0}}
  else{const days=mo*30,max=Math.round(days*minis.length*5*.7);D.list.push({id:Date.now(),slot:[0,1,2].find(z=>!D.list.some(x=>x.slot===z)),name:n,style:+($('#bsty')&&$('#bsty').value)||0,months:mo,days,created:Date.now(),max,hp:max,minis,streak:0,last:null,td:null});fixOverlap(D.list[D.list.length-1]);save();view='list';{const nb=D.list[D.list.length-1];window.FX&&FX.summon(ENT.filter(e=>e.bs===nb.id).map(e=>e.o),nb.style|0)}}}
 render()});
P.addEventListener('click',e=>{const c=e.target.closest('.stc');if(!c)return;P.querySelectorAll('.stc').forEach(x=>x.classList.toggle('on',x===c));$('#bsty').value=c.dataset.s});
P.addEventListener('change',e=>{if(e.target.classList.contains('mk')){dr=readDraft();render()}});
const BS=[{c:[0,2],m:[[2,-4],[5,-2],[3,-3]]},{c:[3,3],m:[[4,3],[3,4],[2,3]]},{c:[-1,1],m:[[-1,0],[-1,-1],[0,-1]]}];let sel=null,pick=null,ENT=[],lastNear='';
const card=document.createElement('div');card.id='bcard';
const flip=document.createElement('div'),fin=document.createElement('div');flip.id='bflip';fin.className='bf-in';{const p2=$('#p2');if(p2)fin.appendChild(p2)}fin.appendChild(card);flip.appendChild(fin);stage.appendChild(flip);
const st2=document.createElement('style');st2.textContent=`#bcard,#bsw{display:none;z-index:6;font-family:'Patrick Hand','Comic Sans MS',cursive;color:#000}
#bcard{left:420px;top:560px;width:350px;box-sizing:border-box;padding:12px 16px;border:1.5px solid #20180d;border-radius:10px;background:#eee0c6;box-shadow:inset 0 0 0 1.5px #fdfae7,inset 0 0 0 2.5px #cdbd9c,1px 2px 0 rgba(0,0,0,.35),0 8px 24px rgba(0,0,0,.45)}
#bcard h3{margin:0 30px 0 0;font:400 24px 'Patrick Hand',cursive;-webkit-text-stroke:.3px #000;overflow-wrap:anywhere}#bcard .x{position:absolute;right:8px;top:8px;width:28px;height:28px;padding:0}#bcard .sub{font-size:17px;color:#5a4a2c;margin:2px 0 8px}
#bcard .hpb{position:relative;height:22px;border:1.5px solid #20180d;border-radius:11px;background:#5b2a22;overflow:hidden;margin-bottom:8px}#bcard .hpb i{display:block;height:100%;background:#c1614d}#bcard .hpb span{position:absolute;inset:0;text-align:center;font-size:16px;line-height:20px;color:#fff}
#bcard input{width:70px;box-sizing:border-box;padding:5px 8px;border:1.5px solid #20180d;border-radius:6px;background:#f7edd6;font:19px 'Patrick Hand',cursive;outline:0}#bcard .row{display:flex;align-items:center;gap:8px;font-size:19px}
#bsw{left:420px;top:14px;align-items:center;gap:8px;font-size:20px;padding:3px 8px;border-radius:8px;background:rgba(238,224,198,.92);border:1.5px solid #20180d}`;st2.textContent+=`
#bflip{left:16px;top:202px;width:154px;height:41px;perspective:700px;z-index:5}
#bflip .bf-in{position:absolute;inset:0;transform-style:preserve-3d;transform-origin:77px 50%;transition:transform .6s cubic-bezier(.3,.7,.3,1)}
#bflip.on .bf-in{transform:rotateY(180deg)}
#bflip #p2{position:absolute;left:0;top:0;width:154px;height:41px;backface-visibility:hidden;-webkit-backface-visibility:hidden}
#bflip #bcard{position:absolute;left:0;top:0;width:154px;height:41px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:4px;padding:3px 6px;border-radius:10px;transform:rotateY(180deg);backface-visibility:hidden;-webkit-backface-visibility:hidden;pointer-events:none}
#bflip.on #bcard{pointer-events:auto}
#bflip #bcard .bh-l{font-size:16px;white-space:nowrap}#bflip #bcard input{width:44px;height:28px;padding:0 3px;font-size:17px}#bflip #bcard .jnav{font-size:16px;padding:2px 6px;margin:0}`;document.head.appendChild(st2);
const SPR_DATA={"g_main": {"u": "boss/art/spr_g_main.webp", "ar": 0.5028}, "g_m0": {"u": "boss/art/spr_g_m0.webp", "ar": 0.5816}, "g_m1": {"u": "boss/art/spr_g_m1.webp", "ar": 0.6132}, "g_m2": {"u": "boss/art/spr_g_m2.webp", "ar": 0.7711}, "p_main": {"u": "boss/art/spr_p_main.webp", "ar": 1.4126}, "p_m0": {"u": "boss/art/spr_p_m0.webp", "ar": 1.0526}, "p_m1": {"u": "boss/art/spr_p_m1.webp", "ar": 0.6447}, "p_m2": {"u": "boss/art/spr_p_m2.webp", "ar": 0.8605}};
const PORT={"g_main": {"u": "boss/art/por_g_main.webp", "n": "Sylvaris the Elder"}, "g_m0": {"u": "boss/art/por_g_m0.webp", "n": "Mossveil the Hooded"}, "g_m1": {"u": "boss/art/por_g_m1.webp", "n": "Orbael the Sage"}, "g_m2": {"u": "boss/art/por_g_m2.webp", "n": "Rootbloom the Rider"}, "p_main": {"u": "boss/art/por_p_main.webp", "n": "Queen Nyssara"}, "p_m0": {"u": "boss/art/por_p_m0.webp", "n": "Cinderveil"}, "p_m1": {"u": "boss/art/por_p_m1.webp", "n": "Umbra"}, "p_m2": {"u": "boss/art/por_p_m2.webp", "n": "Lunareth"}};
const SIM={};Object.keys(SPR_DATA).forEach(k=>{const i=new Image();i.src=SPR_DATA[k].u;SIM[k]=i});
const STYLES=[{n:'Classic'},{n:'Green',p:'g'},{n:'Purple',p:'p'}];
function STY(b,kind,i){const s=STYLES[b.style|0];if(!s||!s.p)return null;const key=kind==='main'?s.p+'_main':s.p+'_m'+((i|0)%3),d=SPR_DATA[key],BIG=s.p==='p'?(kind==='main'?[200,250]:[165,165]):(kind==='main'?[215,140]:[175,150]),H=BIG[0],W=BIG[1];let h=H,w=h*d.ar;if(w>W){w=W;h=w/d.ar}return{img:SIM[key],w,h,src:d.u}}
const bImg=b=>{const s=STY(b,'main');return s?s.src:CI.src},mImg=(b,i)=>{const s=STY(b,'mini',i);return s?s.src:MI.src};
function styRow(st){const cards=STYLES.map((s,k)=>{const im=s.p?[s.p+'_main',s.p+'_m0',s.p+'_m1',s.p+'_m2'].map(x=>SPR_DATA[x].u):[CI.src,MI.src,MI.src,MI.src];
 return '<button type="button" class="stc'+(st==k?' on':'')+'" data-s="'+k+'"><span class="sti">'+im.map(u=>'<img src="'+u+'" alt="">').join('')+'</span><span class="stn">'+s.n+'</span></button>'}).join('');
 return '<div class="fr r3"><span class="lb">Style</span>'+cards+'<input type="hidden" id="bsty" value="'+(st|0)+'"></div>'}
const selB=()=>D.list[0]||null,bOf=id=>D.list.find(b=>b.id===id)||null;
const tdOf=b=>b.td&&b.td.d===today()?b.td:{k:[],m:{}};
function near(en){if(path.length)return false;return Math.max(Math.abs(en.t[0]-cur[0]),Math.abs(en.t[1]-cur[1]))<=1}
const nearEnt=()=>ENT.find(e=>e.k==='mini'&&!e.o.dim&&near(e))||null;
function sync(){OBJ.length=0;SH.length=0;ENT=[];
 D.list.forEach(b=>{if(!(b.slot>=0&&b.slot<3)||D.list.some(x=>x!==b&&x.slot===b.slot))b.slot=[0,1,2].find(z=>!D.list.some(x=>x!==b&&x.slot===z))});
 D.list.forEach(b=>{const S=lay(b),td=tdOf(b),ph=phase(b),c=cc(...S.c),w=60.1*SC[ph],h=86.7*SC[ph],fx=c[0]-12,fy=c[1]+2,sp=STY(b,'main');let o;
  if(sp){const w2=sp.w*SC[ph],h2=sp.h*SC[ph],fy2=c[1]+8;o={i:sp.img,x:c[0]-w2/2,y:fy2-h2,w:w2,h:h2,b:fy2,f:ph?FL[ph]:''};SH.push([c[0],fy2-4,Math.min(46,w2*.38),9])}
  else{o={i:CI,x:fx-w/2,y:fy+4-h,w,h,b:fy+4,f:ph?FL[ph]:''};SH.push([fx,fy,34,9])}
  o.id=b.id+':c';o.st=b.style|0;OBJ.push(o);ENT.push({k:'cat',t:S.c,o,bs:b.id});
  b.minis.forEach((m,i)=>{const dead=td.k.includes(i);if(dead&&!editing)return;const c2=cc(...S.m[i]),x=c2[0],y=c2[1]+8,sm=STY(b,'mini',i);let o2;if(sm){const f3=c2[1]+8;o2={i:sm.img,x:x-sm.w/2,y:f3-sm.h,w:sm.w,h:sm.h,b:f3,dim:dead};SH.push([x,f3-4,Math.min(40,sm.w*.36),8])}else{o2={i:MI,x:x-35.25,y:y+4-83,w:70.5,h:83,b:y+4,dim:dead};SH.push([x,y,30,8])}o2.id=b.id+':m'+i;o2.st=b.style|0;OBJ.push(o2);ENT.push({k:'mini',i,t:S.m[i],o:o2,bs:b.id})})});
 if(pick&&!bOf(pick.b))pick=null;
 drawCard()}
function drawCard(){const en=editing||RO?null:nearEnt();flip.classList.toggle('on',!!en);if(!en)return;
 const b=bOf(en.bs),mm=b.minis[en.i],kd=KIND(mm),d='data-c="hit" data-b="'+b.id+'" data-i="'+en.i+'"';card.className='bh-strike';
 card.innerHTML='<div class="ab">'+(kd==='done'?'<button class="atk2 only" '+d+'>Attack</button>':'<span class="ai"><input id="cm" type="number" min="1" value="'+mm.t+'"></span><span class="un">'+(kd==='count'?'pts':'min')+'</span><button class="atk2" '+d+'>Attack</button>')+'</div>'}
/* ---- Edit mode: move any boss / mini boss to any free walkable tile ---- */
let editing=false,esel=null,eh=null,emsg='',eDel=0,eTest=false,tSel=0,eKill=0;
const eb=document.createElement('div');eb.id='bedit';stage.appendChild(eb);
const st3=document.createElement('style');st3.textContent=`#bedit{display:none;left:400px;top:10px;width:900px;box-sizing:border-box;padding:6px 12px 8px;border:1.5px solid #20180d;border-radius:10px;background:#eee0c6;box-shadow:inset 0 0 0 1.5px #fdfae7,inset 0 0 0 2.5px #cdbd9c,1px 2px 0 rgba(0,0,0,.35),0 8px 24px rgba(0,0,0,.45);color:#000;font-family:'Patrick Hand','Comic Sans MS',cursive;z-index:7;user-select:none}
#bedit .be-h{display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:19px}#bedit .be-h b{font-size:24px;font-weight:400;-webkit-text-stroke:.3px #000;white-space:nowrap}#bedit .be-m{flex:1;min-width:0;font-size:16px;color:#5a4a2c;line-height:17px}
#bedit .be-r{display:flex;align-items:center;gap:6px;min-height:34px;border-top:1px solid rgba(88,68,40,.35);flex-wrap:wrap;padding:2px 0}#bedit .be-n{width:130px;flex:none;font-size:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#bedit button{display:inline-flex;align-items:center;gap:5px;padding:2px 10px;border:1.5px solid #20180d;border-radius:6px;background:#f7edd6;font:17px 'Patrick Hand','Comic Sans MS',cursive;color:#2b2a26;cursor:pointer}#bedit button:hover{background:#fff6dc}
#bedit .be-c img{height:24px;width:auto;object-fit:contain}#bedit .be-c.on{background:#ffd23c;box-shadow:0 0 0 2px #20180d}#bedit .be-c.dn{opacity:.6}#bedit .be-bar{margin-left:auto}#bedit .be-mb{margin-left:0}#bedit .be-del{background:#f3d5cc;border-color:#7a2a1c;color:#7a2a1c}#bedit .be-del:hover{background:#eab9ac}#bedit .be-del.sure{background:#b5412f;color:#fff}#bedit .be-kill{background:#e9b3a6;border-color:#4a1a10;color:#4a1a10;font-weight:700}#bedit .be-kill:hover{background:#dd9a8a}#bedit .be-kill.sure{background:#8f1f12;color:#fff}`;document.head.appendChild(st3);
const tp=document.createElement('div');tp.id='btest';stage.appendChild(tp);
const st4=document.createElement('style');st4.textContent=`#btest{display:none;left:1096px;top:526px;width:344px;box-sizing:border-box;padding:8px 12px 12px;border:1.5px solid #20180d;border-radius:10px;background:#eee0c6;box-shadow:inset 0 0 0 1.5px #fdfae7,inset 0 0 0 2.5px #cdbd9c,1px 2px 0 rgba(0,0,0,.35),0 8px 24px rgba(0,0,0,.45);color:#000;font-family:'Patrick Hand','Comic Sans MS',cursive;z-index:7;user-select:none}
#btest .bt-h{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px}#btest .bt-h b{font-size:24px;font-weight:400;-webkit-text-stroke:.3px #000}#btest .bt-h span{font-size:14px;color:#6a5a3a}
#btest .bt-s{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px}
#btest button{padding:3px 8px;border:1.5px solid #20180d;border-radius:6px;background:#f7edd6;font:18px 'Patrick Hand','Comic Sans MS',cursive;color:#2b2a26;cursor:pointer}#btest button:hover{background:#fff6dc}#btest button:active{transform:translateY(1px)}
#btest .bt-c{font-size:16px;padding:1px 8px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#btest .bt-c.on{background:#ffd23c;box-shadow:0 0 0 2px #20180d}
#btest .bt-hp{position:relative;height:26px;border:1.5px solid #20180d;border-radius:7px;background:#cfc0a0;overflow:hidden;margin-bottom:8px}#btest .bt-hp i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(#a6e84a,#5aa82c);transition:width .25s}#btest .bt-hp span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:19px;color:#14240b;text-shadow:0 1px 0 rgba(255,255,255,.6)}
#btest .bt-g{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:6px}#btest .bt-d{background:#f3d5cc;border-color:#7a2a1c;color:#7a2a1c}#btest .bt-d:hover{background:#eab9ac}#btest .bt-u{background:#d9edc0;border-color:#2f5a1f;color:#2f5a1f}#btest .bt-u:hover{background:#c6e3a4}
#btest .bt-f{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}#btest .bt-f button{font-size:17px;padding:3px 4px}#btest .bt-k{background:#f3d5cc;border-color:#7a2a1c;color:#7a2a1c}#btest .bt-k:hover{background:#eab9ac}#btest .bt-k.on{background:#c4442f;color:#fff}#bedit .be-tb{background:#d9edc0;border-color:#2f5a1f;color:#2f5a1f}#bedit .be-tb.on{background:#8ed23c;box-shadow:0 0 0 2px #20180d;color:#0f2a08}`;document.head.appendChild(st4);
/* ---- Kill boss early: close every tab / overlay so the KO animation plays on a clear screen ---- */
function closeAll(){
 const call=f=>{try{if(typeof window[f]==='function')window[f]()}catch(e){}};
 const vis=q=>{const e=document.querySelector(q);return e&&e.offsetParent!==null?e:null};
 call('closeMuseum');call('closeCalendar');call('closeWorldMap');call('closeBoard');   /* Media Log, holidays, world map, Canvas (each ignores the call when it is not open) */
 {const x=vis('#jcx');if(x)x.click()}{const x=vis('#jback');if(x)x.click()}              /* Journal calendar, then the Journal */
 ['#tabpg','#imgpg'].forEach(q=>{const e=document.querySelector(q);if(e)e.style.display='none'});
 if(HP.style.display==='block'){closeHall();stage.classList.remove('hall-ready')}        /* Hall of Fame */
 ritStop();view='list';ask=null;err='';dr=null;pick=null;sel=null;P.style.display='none'; /* Bosses panel, ritual, New Boss form */
 try{const a=document.activeElement;if(a&&a.blur)a.blur()}catch(e){}}
function killBoss(id){eKill=0;eDel=0;closeAll();stopEdit(false);setTimeout(()=>{const x=bOf(id);if(x)setHP(x,0)},450)}
function renderTest(){if(!editing||!eTest||!D.list.length){tp.style.display='none';return}
 if(!bOf(tSel))tSel=D.list[0].id;const b=bOf(tSel);
 let h='<div class="bt-h"><b>Test HP</b><span>only for testing animations</span></div>';
 if(D.list.length>1)h+='<div class="bt-s">'+D.list.map(x=>'<button class="bt-c'+(x.id===tSel?' on':'')+'" data-t="pick" data-b="'+x.id+'">'+esc(x.name)+'</button>').join('')+'</div>';
 h+='<div class="bt-hp"><i style="width:'+(b.hp/b.max*100)+'%"></i><span>'+b.hp+' / '+b.max+'</span></div>';
 h+='<div class="bt-g">'+[-5,-25,-100].map(d=>'<button class="bt-d" data-t="th" data-d="'+d+'">'+d+'</button>').join('')+[5,25,100].map(d=>'<button class="bt-u" data-t="th" data-d="'+d+'">+'+d+'</button>').join('')+'</div>';
 h+='<div class="bt-f"><button class="bt-u" data-t="full">Full heal</button><button data-t="ko">KO preview</button><button class="bt-k'+(eKill===b.id?' on':'')+'" data-t="kill" title="Really defeat this boss: the Edit tab closes and the KO animation plays on a clear screen">'+(eKill===b.id?'Sure?':'Kill boss')+'</button></div>';
 tp.innerHTML=h;tp.style.display='block'}
function testAct(k,b,d){const ent=ENT.find(e=>e.k==='cat'&&e.bs===b.id);if(!ent||!window.FX)return;const st=b.style|0,ents=ENT.filter(e=>e.bs===b.id).map(e=>e.o);
 if(k==='th'&&d<0){const dm=Math.min(-d,b.hp-1);if(dm<=0){emsg=b.name+' is at 1 HP. Heal it, or use KO preview.';return}b.hp-=dm;FX.bossHit({style:st,d:dm,main:ent.o,ents});emsg='Hit '+b.name+' for -'+dm+' HP.';save()}
 else if(k==='th'||k==='full'){const am=Math.min(k==='full'?b.max:d,b.max-b.hp);if(am<=0){emsg=b.name+' is already at full HP.';return}b.hp+=am;FX.heal({style:st,amt:am,main:ent.o});emsg='Healed '+b.name+' +'+am+' HP.';save()}
 else if(k==='ko'){FX.previewDefeat({style:st,main:ent.o,ents});emsg='KO preview: nothing is deleted, the boss comes back in a moment.'}
 else if(k==='kill'){if(eKill!==b.id){eKill=b.id;emsg='Press Sure? to really defeat '+b.name+'. The Edit tab closes and the KO plays on a clear screen (the boss goes to the Hall of Fame).';return}
  killBoss(b.id)}}
tp.addEventListener('click',e=>{const a=e.target.closest('[data-t]');if(!a)return;const k=a.dataset.t;if(k!=='kill')eKill=0;if(k==='pick')tSel=+a.dataset.b;else{const b=bOf(tSel);if(b)testAct(k,b,+a.dataset.d)}renderEdit()});
function okT(t){return Array.isArray(t)&&t.length===2&&TWK.has(t+'')}
function lay(b){const S=BS[b.slot]||BS[0],p=b.pos||{};return{c:okT(p.c)?p.c:S.c,m:b.minis.map((_,i)=>okT(p.m&&p.m[i])?p.m[i]:S.m[i])}}
function entAt(t){const k=t+'';for(const b of D.list){const L=lay(b);if(L.c+''===k)return{k:'cat',b:b.id};for(let i=0;i<L.m.length;i++)if(L.m[i]+''===k)return{k:'mini',b:b.id,i}}return null}
function fixOverlap(b){const L=lay(b),mine=[L.c,...L.m],used=new Set();
 D.list.forEach(x=>{if(x!==b){const l=lay(x);[l.c,...l.m].forEach(t=>used.add(t+''))}});
 const out=mine.map(t=>{if(!used.has(t+'')){used.add(t+'');return t}let best=null,bd=1e9;
  TWL.forEach(c=>{if(used.has(c+''))return;const d=Math.abs(c[0]-t[0])+Math.abs(c[1]-t[1]);if(d<bd){bd=d;best=c}});
  if(best)used.add(best+'');return best||t});
 if(out.some((t,i)=>t!==mine[i]))b.pos={c:out[0].slice(),m:out.slice(1).map(t=>t.slice())}}
function setPos(b,o,t){const L=lay(b);b.pos={c:L.c.slice(),m:L.m.map(x=>x.slice())};if(o.k==='cat')b.pos.c=t.slice();else b.pos.m[o.i]=t.slice();save()}
const selIs=(k,id,i)=>!!esel&&esel.k===k&&esel.b===id&&(k==='cat'||esel.i===i);
const enm=o=>{const b=bOf(o.b);return b?(o.k==='cat'?b.name:b.minis[o.i].n):''};
function renderEdit(){
 let h='<div class="be-h"><b>Edit positions</b><span class="be-m">'+esc(emsg||'Pick a boss or mini boss (here, or on the map), then click a green tile to move it. "HP bar" switches the bar above a boss.')+'</span><button data-e="reset">Reset all</button><button data-e="done">Done</button></div>';
 D.list.forEach(b=>{const td=tdOf(b);
  h+='<div class="be-r"><span class="be-n">'+esc(b.name)+'</span><button class="be-c'+(selIs('cat',b.id)?' on':'')+'" data-e="sel" data-k="cat" data-b="'+b.id+'"><img src="'+bImg(b)+'" alt="">Boss</button>';
  b.minis.forEach((m,i)=>{h+='<button class="be-c'+(selIs('mini',b.id,i)?' on':'')+(td.k.includes(i)?' dn':'')+'" data-e="sel" data-k="mini" data-b="'+b.id+'" data-i="'+i+'"><img src="'+mImg(b,i)+'" alt="">'+esc(m.n)+'</button>'});
  h+='<button class="be-bar" data-e="bar" data-b="'+b.id+'" title="Change the HP bar shown above this boss on the map">HP bar: '+(b.bar==='classic'?'Classic':'New')+'</button><button class="be-bar be-mb" data-e="mbar" data-b="'+b.id+'" title="Change the HP bar shown above this boss\'s mini bosses">Mini bar: '+(b.mbar==='classic'?'Classic':'New')+'</button><button class="be-del be-kill'+(eKill===b.id?' sure':'')+'" data-e="kill" data-b="'+b.id+'" title="Defeat this boss now: every tab closes and the KO animation plays on a clear screen">'+(eKill===b.id?'Sure? Kill':'Kill boss')+'</button><button class="be-del'+(eDel===b.id?' sure':'')+'" data-e="del" data-b="'+b.id+'">'+(eDel===b.id?'Sure? Remove':'Remove boss')+'</button></div>'});
 eb.innerHTML=h;renderTest()}
function startEdit(){if(RO||!D.list.length)return;editing=true;esel=null;eh=null;pick=null;emsg='';P.style.display='none';eb.style.display='block';sync();renderEdit()}
function stopEdit(open){editing=false;eKill=0;tp.style.display='none';esel=null;eh=null;eb.style.display='none';sync();if(open){view='list';ask=null;P.style.display='block';render()}}
eb.addEventListener('click',e=>{const a=e.target.closest('[data-e]');if(!a)return;const k=a.dataset.e;
 if(k!=='kill')eKill=0;
 if(k==='kill'){const id=+a.dataset.b,b=bOf(id);if(b){eDel=0;if(eKill!==id){eKill=id;emsg='Press Sure? Kill to defeat '+b.name+' now. Every tab closes and the KO animation plays (the boss goes to the Hall of Fame).'}else{killBoss(id);return}}}
 else if(k==='done'){stopEdit(true);return}
 else if(k==='reset'){D.list.forEach(b=>{delete b.pos});emsg='Everyone is back on the default tiles.';save()}
 else if(k==='del'){const id=+a.dataset.b,b=bOf(id);if(b){if(eDel!==id){eDel=id;emsg='Click again to remove '+b.name+' for good.'}else{eDel=0;D.list=D.list.filter(x=>x.id!==id);if(esel&&esel.b===id)esel=null;if(pick&&pick.b===id)pick=null;emsg='Removed '+b.name+'.';save();if(!D.list.length){stopEdit(true);return}}}}
 else if(k==='mbar'){const b=bOf(+a.dataset.b);if(b){b.mbar=b.mbar==='classic'?'new':'classic';emsg='Mini boss bar of '+b.name+': '+(b.mbar==='classic'?'Classic':'New')+'.';save()}}
 else if(k==='bar'){const b=bOf(+a.dataset.b);if(b){b.bar=b.bar==='classic'?'new':'classic';emsg='HP bar of '+b.name+': '+(b.bar==='classic'?'Classic':'New')+'.';save()}}
 else if(k==='test'){eTest=!eTest;emsg=eTest?'Test panel is open (bottom right). Hit or heal a boss to see its animations.':''}
 else if(k==='sel'){esel=a.dataset.k==='cat'?{k:'cat',b:+a.dataset.b}:{k:'mini',b:+a.dataset.b,i:+a.dataset.i};emsg=''}
 renderEdit()});
const toXY=e=>{const r=cvs.getBoundingClientRect();return[(e.clientX-r.left)/r.width*1472,(e.clientY-r.top)/r.height*832]};
const tileAt=(x,y)=>{for(const c of TWL)if(inP(x,y,cq(...c)))return c;return null};
stage.addEventListener('click',e=>{if(!editing||e.target!==cvs)return;e.stopImmediatePropagation();e.preventDefault();
 const[x,y]=toXY(e),t=tileAt(x,y);
 if(t){const o=entAt(t);
  if(o){esel=o;emsg=''}
  else if(esel){const b=bOf(esel.b);if(b){setPos(b,esel,t);emsg='Moved '+enm(esel)+'.'}}
  else emsg='Pick a boss or mini boss first.'}
 else{let f=null;ENT.forEach(en=>{const o=en.o;if(x>=o.x&&x<=o.x+o.w&&y>=o.y&&y<=o.y+o.h)f=en});
  if(f){esel=f.k==='cat'?{k:'cat',b:f.bs}:{k:'mini',b:f.bs,i:f.i};emsg=''}}
 renderEdit()},true);
stage.addEventListener('mousemove',e=>{if(!editing)return;if(e.target!==cvs){eh=null;return}const[x,y]=toXY(e);eh=tileAt(x,y)});
function drawEdit(g){if(!editing)return;
 g.save();g.lineJoin='round';
 TWL.forEach(t=>{const q=cq(...t),o=entAt(t),sl=!!o&&selIs(o.k,o.b,o.i),hv=!!eh&&eh+''===t+'';
  g.beginPath();q.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();
  g.fillStyle=sl?'rgba(255,210,60,.45)':o?'rgba(220,90,70,.22)':hv&&esel?'rgba(90,230,120,.6)':'rgba(90,220,120,.22)';g.fill();
  g.lineWidth=sl?3:hv?2.5:1.5;g.strokeStyle=sl?'#ffd23c':hv?'#fff':'rgba(255,255,255,.65)';g.stroke()});
 g.font="bold 13px 'Patrick Hand','Segoe UI',sans-serif";g.textAlign='center';g.lineWidth=3;g.strokeStyle='rgba(0,0,0,.8)';g.fillStyle='#fff';
 ENT.forEach(en=>{const b=bOf(en.bs);if(!b)return;let n=en.k==='cat'?b.name:b.minis[en.i].n;if(n.length>16)n=n.slice(0,15)+'…';const c=cc(...en.t);g.strokeText(n,c[0],c[1]+20);g.fillText(n,c[0],c[1]+20)});
 g.restore()}
stage.addEventListener('click',e=>{if(e.target!==cvs)return;const r=cvs.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*1472,y=(e.clientY-r.top)/r.height*832;let f=null;
 ENT.forEach(en=>{const o=en.o;if(x>=o.x&&x<=o.x+o.w&&y>=o.y&&y<=o.y+o.h||inP(x,y,cq(...en.t)))f=en});if(!f){if(pick){pick=null;drawCard()}return}
 e.stopImmediatePropagation();e.preventDefault();pick=f.k==='cat'?{k:'cat',b:f.bs}:{k:'mini',i:f.i,b:f.bs};
 if(false&&f.k==='mini'&&!near(f)){const from=path.length?path[path.length-1]:cur,occ=ENT.map(z=>z.t+'');let best=null;
  TWL.forEach(t=>{if(Math.max(Math.abs(t[0]-f.t[0]),Math.abs(t[1]-f.t[1]))>1||occ.includes(t+''))return;const p=t+''===from+''?[]:bfs(from,t);if(!best||p.length<best.length)best=p});
  if(best&&best.length){hist.push(from);path=path.concat(best)}}
 lastNear=null;drawCard()},true);
function onC(e){if(RO)return;const a=e.target.closest('[data-c]');if(!a)return;
 if(a.dataset.c==='hit'){const b=bOf(+a.dataset.b),i=+a.dataset.i,m=b&&b.minis[i],amt=m&&KIND(m)==='done'?1:parseFloat(($('#cm')||{}).value);if(b&&m&&amt>0){pick=null;strike(b,i,amt);drawCard()}}}
card.addEventListener('click',onC);
let lastDay=today();setInterval(()=>{if(today()!==lastDay){lastDay=today();sync()}
 {const en=nearEnt(),n=en?en.bs+':'+en.i:'';if(n!==lastNear){lastNear=n;drawCard()}}},200);

window.__boss={drawEdit,sel:()=>pick?bOf(pick.b):null,get:bOf,ent:()=>ENT,pick:()=>pick,mi:()=>MI.src,cur:()=>cur,near:e=>near(e),pt:(b,kind,i)=>{const s=STYLES[b.style|0];if(!s||!s.p)return null;return PORT[kind==='main'?s.p+'_main':s.p+'_m'+((i|0)%3)]||null}};
const SEED_NAMES={name:'Land 3 Clients',months:3,minis:[{n:'Send 12 DMs',t:12,k:'count'},{n:'Polish Portfolio',t:45,k:'time'},{n:'Post a Short',t:1,k:'done'}]};
function seedBoss(){const days=SEED_NAMES.months*30,max=Math.round(days*SEED_NAMES.minis.length*5*.7);
 return{id:Date.now(),slot:0,name:SEED_NAMES.name,months:SEED_NAMES.months,days,created:Date.now(),max,hp:max,minis:SEED_NAMES.minis.map(m=>({...m})),streak:0,last:null,td:null}}
async function reload(){const n=++loadN;me=who();RO=false;VIEW='';MYD=null;viewSeq++;let loc=readLocal();
 if(!loc){try{const lg=JSON.parse(localStorage.getItem('grove_bosses_v1')||'null');if(lg&&(lg.list||lg.hall)){loc=lg;if(!lg.v){lg.list=(lg.list||[]).map(b=>{const f=5/9,m=Math.round(b.max*f);return{...b,hp:Math.max(1,Math.round(b.hp*f)),max:m}})}loc.dirty=true;localStorage.removeItem('grove_bosses_v1')}}catch(e){}}
 D=norm(loc);dirty=!!(loc&&loc.dirty);sel=null;pick=null;ask=null;if(editing)stopEdit(false);sync();if(P.style.display==='block')render();
 const A=window.GroveAPI;if(!A||!A.getBosses||!token())return;
 try{const s=norm(await A.getBosses());if(n!==loadN)return;
  if(dirty){if(RO)MYD=s;else push();return}
  if(!s.list.length&&!s.hall.length){if(D.list.length||D.hall.length)push();return}
  if(RO){MYD=s;return}
  D=s;writeLocal();sel=null;pick=null;sync();if(P.style.display==='block')render()}catch(e){}}
reload();setInterval(()=>{if(who()!==me)reload()},1000);
/* the Bosses follow the player card that is selected on the right: pick someone else and their bosses (names, HP, mini bosses, Hall of Fame) show up, read-only; pick your own card to come back */
function leaveView(){viewSeq++;RO=false;VIEW='';VNAME='';if(MYD)D=MYD;MYD=null;editing=false;sel=null;pick=null;ask=null;sync();if(P.style.display==='block')render();if(dirty)push()}
async function enterView(w){const my=++viewSeq;if(!RO)MYD=D;RO=true;VIEW=w.id;VNAME=w.name||'Player';D=norm({});view='list';ask=null;pick=null;if(editing)stopEdit(false);sync();if(P.style.display==='block')render();
 const A=window.GroveAPI;let r=null;try{r=A&&A.getPlayerBosses?await A.getPlayerBosses(w.id):null}catch(e){if(my===viewSeq)toast('Could not load '+VNAME+'’s bosses.')}
 if(my!==viewSeq||!RO)return;D=norm(r||{});sync();if(P.style.display==='block')render()}
setInterval(()=>{const w=window.GroveWho&&window.GroveWho();if(!w||!token())return;if(w.mine){if(RO)leaveView()}else if(!RO||VIEW!==w.id)enterView(w)},350);
{const sv=document.createElement('style');sv.textContent=`#bp .bwho{position:absolute;left:275px;top:117px;width:296px;height:50px;display:flex;align-items:center;justify-content:space-between;gap:6px}
#bp .bwho button{width:52px;height:46px;padding:0;border:2px solid #20180d;border-radius:9px;background:linear-gradient(#fbf3de,#eadcb8);box-shadow:0 2px 0 #b89f6c;font:700 30px/1 'Patrick Hand',cursive;color:#2b2a26;cursor:pointer}
#bp .bwho button:hover{background:#fff6dc}#bp .bwho span{flex:1;display:flex;flex-direction:column;align-items:center;line-height:1.05;min-width:0}
#bp .bwho b{font:400 26px 'Patrick Hand',cursive;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;-webkit-text-stroke:.5px #17120b}#bp .bwho small{font-size:15px;color:#6a5a3a}`;document.head.appendChild(sv)}
/* ---- restyled Bosses tab (centered, card layout) ---- */
const st5=document.createElement('style');st5.textContent=`
#bp{left:286px;top:56px;width:900px;height:720px;padding:22px 28px 26px;border-radius:14px;background:linear-gradient(180deg,#f4e9d0 0%,#e9d9b8 100%);border:2px solid #20180d;box-shadow:inset 0 0 0 2px #fdfae7,inset 0 0 0 4px #c9b58a,inset 0 0 60px rgba(120,90,40,.18),0 18px 60px rgba(0,0,0,.6)}
#bp .bhd{text-align:center;margin-bottom:16px}
#bp .bhd h2{font-size:46px;letter-spacing:3px;-webkit-text-stroke:.5px #1c1409;line-height:1.05}
#bp .orn{display:flex;align-items:center;justify-content:center;gap:12px;margin:6px auto 14px;width:300px}
#bp .orn i{flex:1;height:2px;background:linear-gradient(90deg,transparent,#8a6a3c,transparent)}
#bp .orn b{width:11px;height:11px;transform:rotate(45deg);background:#8a6a3c;box-shadow:0 0 0 3px #eadcbc,0 0 0 4.5px #8a6a3c}
#bp .bbar{display:flex;gap:12px;justify-content:center}
#bp .jnav{padding:6px 18px;font-size:19px;border:1.5px solid #20180d;border-radius:8px;background:linear-gradient(#fbf3de,#eadcb8);box-shadow:0 2px 0 #b89f6c,0 3px 5px rgba(0,0,0,.25);cursor:pointer;transition:transform .12s,box-shadow .12s}
#bp .jnav:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 3px 0 #b89f6c,0 6px 8px rgba(0,0,0,.28)}#bp .jnav:disabled{opacity:.45;cursor:default}
#bp .bgrid{display:flex;justify-content:center;align-items:flex-start;gap:18px;flex-wrap:wrap}
#bp .bcd{display:block;width:262px;padding:14px 14px 10px;margin:0;border:1.5px solid rgba(88,68,40,.6);border-radius:12px;background:linear-gradient(#fbf4e0,#f4e8cc);box-shadow:0 4px 12px rgba(60,40,10,.22),inset 0 0 0 1px #fffaf0;text-align:center}
#bp .bl{display:flex;align-items:flex-end;justify-content:center;width:auto;height:215px;padding:0;margin-bottom:8px;border-radius:10px;background:radial-gradient(ellipse at 50% 92%,rgba(97,140,70,.38),rgba(97,140,70,0) 68%)}
#bp .bl img{height:auto;width:auto;max-height:205px;max-width:226px;object-fit:contain;filter:drop-shadow(0 4px 4px rgba(40,30,10,.3))}
#bp .bcd h3{font-size:27px;line-height:1.15;overflow-wrap:anywhere}
#bp .bcd .sub{font-size:16px;margin:1px 0 9px;letter-spacing:.5px}
#bp .hpb{height:20px;margin:0 0 10px;border-radius:10px;background:#4e241d}#bp .hpb i{background:linear-gradient(#d4725d,#b0523f)}#bp .hpb span{line-height:18px;font-size:15px;letter-spacing:.5px}
#bp .ml{text-align:left}
#bp .mr{flex-wrap:wrap;gap:8px;min-height:44px;padding:3px 0;font-size:18px}#bp .mr .mn{line-height:1.1}#bp .mr small{display:block;font-size:13px;color:#7a6743}
#bp .mr .jnav{padding:3px 12px;font-size:16px}#bp .mdm{color:#7a6743;font-size:17px}
#bp .ma{display:flex;align-items:center;gap:6px;width:100%;padding:0 0 6px 44px;box-sizing:border-box;font-size:16px}#bp .ma .jnav{padding:3px 10px;font-size:16px}
#bp .bnew{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:262px;height:300px;margin-top:20px;border:2px dashed #8a6a3c;border-radius:12px;background:rgba(255,250,235,.55);font:24px 'Patrick Hand',cursive;color:#5a4a2c;cursor:pointer}
#bp .bnew span{font-size:60px;line-height:1}#bp .bnew:hover{background:rgba(255,250,235,.9)}
#bp .top h2{text-align:center}
#hallpg{position:absolute;inset:0;display:none;z-index:40;font-family:'Patrick Hand','Comic Sans MS',cursive;color:#2b1d08;background:radial-gradient(ellipse at 50% 0%,rgba(255,214,110,.28),rgba(0,0,0,0) 55%),linear-gradient(#0f1d11,#08100a);overflow-y:auto;scrollbar-width:thin;scrollbar-color:#8a6a3c transparent}
#hallpg .hp-in{width:1100px;margin:0 auto;padding:34px 0 50px;text-align:center}
#hallpg h1{margin:4px 0 0;font:400 64px 'Patrick Hand',cursive;letter-spacing:6px;color:#f6e4ab;text-shadow:0 2px 0 #5a3c0e,0 0 24px rgba(255,200,80,.5)}
#hallpg .orn{display:flex;align-items:center;justify-content:center;gap:14px;margin:10px auto 34px;width:420px}
#hallpg .orn i{flex:1;height:2px;background:linear-gradient(90deg,transparent,#d9b45c,transparent)}#hallpg .orn b{width:12px;height:12px;transform:rotate(45deg);background:#d9b45c;box-shadow:0 0 0 3px #12200f,0 0 0 4.5px #d9b45c}
#hallpg svg.tr{width:84px;height:84px;filter:drop-shadow(0 0 14px rgba(255,200,80,.55))}
#hallpg .hp-g{display:flex;flex-wrap:wrap;justify-content:center;gap:22px}
#hallpg .hc{position:relative;width:330px;padding:16px 16px 18px;border:2px solid #c9a24d;border-radius:14px;background:linear-gradient(#f8eed3,#ead9b0);box-shadow:0 10px 30px rgba(0,0,0,.55),inset 0 0 0 2px #fff6dc,inset 0 0 0 4px #d9c18a}
#hallpg .hc .rk{position:absolute;left:14px;top:12px;min-width:34px;height:34px;line-height:34px;border-radius:50%;background:#c9a24d;color:#fff8e0;font-size:19px;box-shadow:0 2px 4px rgba(0,0,0,.35)}
#hallpg .hc .pi{height:230px;display:flex;align-items:flex-end;justify-content:center;background:radial-gradient(ellipse at 50% 92%,rgba(255,206,100,.45),rgba(255,206,100,0) 68%)}
#hallpg .hc .pi img{max-height:222px;max-width:290px;object-fit:contain;filter:drop-shadow(0 5px 5px rgba(40,30,10,.35))}
#hallpg .hc h3{margin:8px 0 2px;font:400 29px 'Patrick Hand',cursive;overflow-wrap:anywhere}
#hallpg .hc .dd{font-size:18px;color:#6a5426}#hallpg .hc .dt{font-size:15px;color:#8a7440;margin-top:2px}
#hallpg .hc .ch{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:10px}#hallpg .hc .ch span{padding:2px 10px;border:1px solid #b79c5c;border-radius:12px;background:rgba(255,250,230,.8);font-size:15px}
#hallpg .hp-e{margin-top:60px;font-size:26px;color:#cdb77a}`;st5.textContent+=`
.jnav.atk{background:linear-gradient(#e0806a,#b04a35)!important;color:#fff8ee!important;border:1.5px solid #4a1a10!important;text-shadow:0 1px 0 rgba(60,15,5,.6);box-shadow:inset 0 1px 0 rgba(255,220,200,.55),0 2px 0 #6f2a1c,0 3px 5px rgba(0,0,0,.3)!important;letter-spacing:.4px}
.jnav.atk:hover{background:linear-gradient(#ea8d77,#bd5540)!important}.jnav.atk:active{transform:translateY(1px)}
#bflip #bcard{background:linear-gradient(#f7ecd2,#e6d4aa);border:1.5px solid #20180d;box-shadow:inset 0 0 0 1.5px #fdfae7,inset 0 0 0 2.5px #cdbd9c,1px 2px 0 rgba(0,0,0,.35),0 6px 16px rgba(0,0,0,.4)}
#bflip #bcard input{border:1.5px solid #8a6a3c;border-radius:7px;background:#fffaf0;box-shadow:inset 0 1px 3px rgba(90,60,20,.25);color:#2b1d08;text-align:center;font-size:17px}
#bflip #bcard .bh-l{color:#5a4a2c;font-style:normal}
#bflip #bcard .jnav{padding:2px 8px;border-radius:7px;font-size:16px;line-height:22px}`;document.head.appendChild(st5);
const U=k=>'url('+BUI[k]+')';
const st6=document.createElement('style');st6.textContent=`
#bp{left:0!important;top:0!important;width:1669px!important;height:942px!important;transform:scale(.882);transform-origin:0 0;padding:0!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;overflow:visible!important;pointer-events:none;font-family:'Patrick Hand','Comic Sans MS',cursive;color:#17120b}
#bp *{box-sizing:border-box}#bp button{font-family:inherit}
#bp .bpn{position:absolute;left:350px;top:53px;width:972px;height:831px;background:${U('panel_boss')} 0 0/100% 100% no-repeat;pointer-events:auto}
#bp .bpn.nb{left:321px;top:71px;width:1060px;height:780px;background-image:${U('panel_new')}}
#bp .ttl{position:absolute;left:308px;top:25px;width:362px;height:74px;line-height:74px;text-align:center;font-size:48px;letter-spacing:1px;-webkit-text-stroke:1.2px #17120b}
#bp .nb .ttl{left:0;top:26px;width:1038px;height:56px;line-height:56px;font-size:46px}
#bp .bb{position:absolute;border:0;background:transparent 0 0/100% 100% no-repeat;font-size:30px;line-height:1;color:#17120b;-webkit-text-stroke:.8px #17120b;cursor:pointer;padding:0;transition:transform .12s,filter .12s}
#bp .bb:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.06)}#bp .bb:active:not(:disabled){transform:translateY(1px)}#bp .bb:disabled{opacity:.45;cursor:default}
#bp .b-e{left:275px;top:117px;width:100px;height:50px;background-image:${U('btn_edit')}}#bp .b-n{left:395px;top:117px;width:176px;height:50px;background-image:${U('btn_add')}}#bp .b-c{left:590px;top:117px;width:112px;height:50px;background-image:${U('btn_close')}}
#bp .card{position:absolute;left:270px;top:179px;width:439px;height:604px;background:${U('card')} 0 0/100% 100% no-repeat}
#bp .card .art{position:absolute;left:20px;top:22px;width:399px;height:262px;display:flex;align-items:flex-end;justify-content:center}
#bp .card .art img{height:250px;max-width:370px;width:auto;object-fit:contain;filter:drop-shadow(0 6px 5px rgba(40,30,10,.3))}
#bp .card .nm{position:absolute;left:20px;width:399px;top:280px;text-align:center;font-size:36px;line-height:42px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;-webkit-text-stroke:.9px #17120b}
#bp .card .dl{position:absolute;left:0;width:439px;top:324px;line-height:26px;text-align:center;font-size:23px;color:#5a4a2c;-webkit-text-stroke:.3px #5a4a2c}
#bp .card .hp{position:absolute;left:28px;top:352px;width:383px;height:32px;border:3px solid #20180d;border-radius:16px;background:#7a2f26;overflow:hidden}
#bp .card .hp i{display:block;height:100%;background:linear-gradient(#e8806c,#c4463c);transition:width .5s}#bp .card .hp span{position:absolute;inset:0;text-align:center;line-height:26px;font-size:22px;color:#fff;-webkit-text-stroke:.6px #fff;text-shadow:0 1px 1px rgba(60,10,5,.6)}
#bp .mrow{position:absolute;left:22px;width:395px;height:64px}
#bp .mrow .ic{position:absolute;left:20px;top:7px;width:38px;height:50px;object-fit:contain}
#bp .mrow .mnm{position:absolute;left:68px;top:5px;width:215px;font-size:28px;line-height:32px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;-webkit-text-stroke:.7px #17120b}
#bp .mrow .msb{position:absolute;left:68px;top:38px;font-size:19px;line-height:20px;color:#6b5a3a;-webkit-text-stroke:.2px #6b5a3a}
#bp .mrow.dn .mnm{text-decoration:line-through;color:#6b5a3a;-webkit-text-stroke:0}
#bp .mrow .ab1{position:absolute;left:293px;top:5px;width:97px;height:52px;background-image:${U('btn_atk')};font-size:25px}
#bp .mrow .md{position:absolute;right:16px;top:16px;font-size:26px;color:#6b5a3a}
#bp .ab2,#bflip .ab{background:${U('atk_box')} 0 0/100% 100% no-repeat}
#bp .ab2{position:absolute;left:170px;top:0;width:224px;height:64px}
#bp .ab2 .ai,#bflip .ab .ai{position:absolute;background:${U('atk_in')} 0 0/100% 100% no-repeat}
#bp .ab2 .ai{left:8.5%;top:18%;width:28%;height:65%}
#bp .ab2 input{position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;text-align:center;font:400 22px 'Patrick Hand',cursive;color:#17120b;outline:0;padding:0;-moz-appearance:textfield}
#bp .ab2 input::-webkit-outer-spin-button,#bp .ab2 input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
#bp .ab2 .un{position:absolute;left:37%;width:17%;top:0;height:100%;display:flex;align-items:center;justify-content:center;font-size:19px;color:#17120b;white-space:nowrap}
#bp .atk2,#bflip .atk2{position:absolute;left:55%;top:13%;width:36.7%;height:75%;border:0;background:${U('atk_btn')} 0 0/100% 100% no-repeat;color:#fff;font-family:'Patrick Hand',cursive;font-size:21px;line-height:1;cursor:pointer;padding:0;text-shadow:0 1px 1px rgba(60,10,5,.7);-webkit-text-stroke:.4px #fff}
#bp .atk2:hover{filter:brightness(1.1)}#bp .atk2:active{transform:translateY(1px)}
#bp .nav{position:absolute;top:420px;width:56px;height:64px;font-size:46px;line-height:56px;background-image:${U('btn_close')}}
#bp .none{position:absolute;left:30px;top:170px;width:379px;text-align:center;font-size:30px;color:#5a4a2c}#bp .none .bb{position:static;display:block;margin:24px auto 0;width:176px;height:50px;background-image:${U('btn_add')}}
#bp .berr{color:#a12a1b;font-size:22px;line-height:24px}
#bp .bpn:not(.nb) .berr{position:absolute;left:270px;width:439px;top:790px;text-align:center}
/* New Boss form */
#bp .nbf{position:absolute;left:0;top:127px;width:1060px}
#bp .fr{position:relative;display:block;margin:0}
#bp .fr .lb{position:absolute;left:67px;top:0;height:100%;width:165px;display:flex;align-items:center;font-size:28px;line-height:29px;-webkit-text-stroke:.5px #17120b}
#bp .fr .inp{position:absolute;left:234px;top:0;height:100%;background:0 0/100% 100% no-repeat}
#bp .fr .inp input{position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;padding:0 18px;font:400 26px 'Patrick Hand',cursive;color:#17120b;outline:0}
#bp .fr .inp input::placeholder{color:#9b8f78;opacity:1}
#bp .fr .inp.g{width:643px;background-image:${U('in_goal')}}#bp .fr .inp.m{width:347px;background-image:${U('in_mini')}}
#bp .fr .sgb{position:absolute;padding:0;border:0;border-radius:0;box-shadow:none;height:100%;background:${U('btn_sug')} 0 0/100% 100% no-repeat;font:400 25px/1 'Patrick Hand',cursive;color:#17120b;-webkit-text-stroke:.6px #17120b;cursor:pointer}
#bp .fr .sgb:hover{background:${U('btn_sug')} 0 0/100% 100% no-repeat;filter:brightness(1.06)}
#bp .fr .dd{position:absolute;top:0;height:100%;background:${U('dd')} 0 0/100% 100% no-repeat}
#bp .fr .dd select{position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;padding:0 28px 0 14px;font:400 25px 'Patrick Hand',cursive;color:#17120b;outline:0;appearance:none;-webkit-appearance:none;cursor:pointer}
#bp .fr .dd::after{content:'';position:absolute;right:13px;top:50%;width:8px;height:8px;margin-top:-7px;border:solid #17120b;border-width:0 2.5px 2.5px 0;transform:rotate(45deg);pointer-events:none}
#bp .fr .dd.k select{color:#8f8470}
#bp .fr .num{position:absolute;left:887px;top:0;width:72px;height:100%;background:${U('numbox')} 0 0/100% 100% no-repeat}
#bp .fr .num input{position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;text-align:center;font:400 26px 'Patrick Hand',cursive;color:#17120b;outline:0;padding:0;-moz-appearance:textfield}
#bp .fr .num input::-webkit-outer-spin-button,#bp .fr .num input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
#bp .fr .un{position:absolute;left:972px;top:0;height:100%;display:flex;align-items:center;font-size:27px;-webkit-text-stroke:.5px #17120b}
#bp .fr.r1{height:56px;margin-bottom:14px}#bp .fr.r1 .sgb{left:892px;top:0;width:115px}
#bp .fr.r2{height:54px;margin-bottom:16px}#bp .fr.r2 .dd{left:234px;width:171px}
#bp .fr.r3{height:140px;margin-bottom:21px}
#bp .fr.rm{height:49px}#bp .fr.rm .sgb{left:599px;width:108px}#bp .fr.rm .dd{left:724px;width:147px}
#bp .nbf .fr.rm.a{margin-bottom:23px}#bp .nbf .fr.rm.b{margin-bottom:28px}#bp .nbf .fr.rm.c{margin-bottom:31px}
#bp .stc{position:absolute;top:0;height:140px;width:244px;border:0;padding:0;background:${U('stylebox')} 0 0/100% 100% no-repeat;cursor:pointer;font-family:inherit;color:#17120b}
#bp .stc.on{background-image:${U('stylebox_on')}}#bp .stc:hover{filter:brightness(1.05)}
#bp .stc:nth-of-type(1){left:234px}#bp .stc:nth-of-type(2){left:495px}#bp .stc:nth-of-type(3){left:755px}
#bp .stc .sti{position:absolute;left:8px;right:8px;top:16px;height:84px;display:flex;align-items:flex-end;justify-content:center;gap:4px}
#bp .stc .sti img{height:46px;width:auto;max-width:56px;object-fit:contain}#bp .stc .sti img:first-child{height:76px;max-width:96px}
#bp .stc .stn{position:absolute;left:0;right:0;bottom:12px;text-align:center;font-size:24px;line-height:26px;-webkit-text-stroke:.5px #17120b}
#bp .sg{position:absolute;left:234px;z-index:6;display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0;padding:8px 12px;border:2px solid #20180d;border-radius:12px;background:#f3e5c4;box-shadow:0 6px 14px rgba(0,0,0,.35);max-width:760px}
#bp .sgc{height:36px;font-size:22px;border-radius:18px}#bp .sgm{font-size:21px}
#bp .nbb{position:relative;height:62px}
#bp .nbb .bb{top:0}#bp .nbb .sm{left:84px;width:227px;height:62px;background-image:${U('btn_summon')};font-size:28px}#bp .nbb .cn{left:332px;top:1px;width:160px;height:59px;background-image:${U('btn_close')};font-size:28px}
#bp .nbb .berr{position:absolute;left:520px;top:18px;width:500px}
/* strike box on the flip button */
#bflip{width:154px;height:41px}
#bflip #bcard{left:5px!important;width:144px!important;height:41px!important;padding:0!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;display:block!important}
#bflip .ab{position:absolute;inset:0}
#bflip .ab .ai{left:8.5%;top:18%;width:28%;height:65%}
#bflip .ab .ai input{position:absolute;inset:0;width:100%!important;height:100%!important;border:0!important;background:transparent!important;box-shadow:none!important;text-align:center;font:400 15px 'Patrick Hand',cursive!important;color:#17120b;outline:0;padding:0!important;-moz-appearance:textfield}
#bflip .ab .ai input::-webkit-outer-spin-button,#bflip .ab .ai input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
#bflip .ab .un{position:absolute;left:37%;width:17%;top:0;height:100%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#17120b}
#bflip{pointer-events:none}#bflip.on #bcard{pointer-events:auto}
#bflip .atk2{font-size:14px;-webkit-text-stroke:.2px #fff}#bflip .atk2.only{left:28%;width:44%}
/* Hall of Fame */
#hallpg{inset:0!important;background:#f3e7d3 ${U('h_bg')} center/100% 100% no-repeat!important;overflow:hidden!important;font-family:'Lora','Cormorant Garamond',Georgia,'Times New Roman',serif;color:#2b1d12}
#hallpg .hd{position:absolute;left:0;top:0;width:1669px;height:942px;transform:scale(.882);transform-origin:0 0}
#hallpg .hd>*{position:absolute}
#hallpg .hh{left:435px;top:24px;width:801px;height:183px}
#hallpg .fm{background:0 0/100% 100% no-repeat}#hallpg .fm.s{width:319px;height:380px;background-image:${U('h_small')}}#hallpg .fm.m{width:414px;height:417px;background-image:${U('h_mid')}}
#hallpg .pt{background:#e7d9bd center/cover no-repeat}
#hallpg .ib{height:159px;background:${U('h_info')} 0 0/100% 100% no-repeat;text-align:center}
#hallpg .ib>*{position:absolute;left:14px;right:14px}
#hallpg .ib .n{top:15px;font-size:27px;line-height:32px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#hallpg .ib .d1,#hallpg .ib .d2{font-size:21px;line-height:24px}#hallpg .ib .d1{top:49px}#hallpg .ib .d2{top:73px}
#hallpg .ib .ms{top:120px;font-size:20px;line-height:24px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#hallpg .hp-e{left:0;top:760px;width:1669px;text-align:center;font-size:32px;color:#6a4f35}
#hallpg .hpn{top:830px;width:70px;height:60px;border:0;background:${U('btn_close')} 0 0/100% 100% no-repeat;font-size:44px;line-height:50px;color:#3a2a1a;cursor:pointer;padding:0}
#hallpg .hpn:disabled{opacity:.35;cursor:default}`;document.head.appendChild(st6);

/* ---- full-page Hall of Fame (Mira walks up the stairs to open it) ---- */
const HP=document.createElement('div');HP.id='hallpg';stage.appendChild(HP);
const TROPHY='<svg class="tr" viewBox="0 0 64 64"><defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9a0"/><stop offset="1" stop-color="#c8902a"/></linearGradient></defs><path d="M18 8h28v14c0 9-6 16-14 16S18 31 18 22z" fill="url(#hg)" stroke="#5a3c0e" stroke-width="2"/><path d="M18 12H8c0 9 4 15 11 16M46 12h10c0 9-4 15-11 16" fill="none" stroke="#c8902a" stroke-width="3"/><rect x="29" y="38" width="6" height="9" fill="url(#hg)" stroke="#5a3c0e" stroke-width="2"/><rect x="21" y="47" width="22" height="8" rx="2" fill="url(#hg)" stroke="#5a3c0e" stroke-width="2"/></svg>';
let hpg=0;
function hallPage(){
 const L=D.hall,pages=Math.max(1,Math.ceil(L.length/3));hpg=Math.min(Math.max(0,hpg),pages-1);
 const fd=s=>{const p=String(s||'').split('-').map(Number);return p.length===3&&p[0]?new Date(p[0],p[1]-1,p[2]):null},mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 const rng=(a,b)=>{const x=fd(a),y=fd(b);if(!x||!y)return esc(a)+' - '+esc(b);const f=d=>mo[d.getMonth()]+' '+d.getDate();return x.getFullYear()===y.getFullYear()?f(x)+' - '+f(y)+', '+y.getFullYear():f(x)+', '+x.getFullYear()+' - '+f(y)+', '+y.getFullYear()};
 const PIC=['p_cat','p_green','p_purple'];
 const slots=[{it:L[hpg*3+1],t:'s',fx:190,fy:259,wx:38,wy:63,ww:244,wh:276,bx:196,bw:306},{it:L[hpg*3],t:'m',fx:629,fy:221,wx:41,wy:66,ww:332,wh:310,bx:643,bw:386},{it:L[hpg*3+2],t:'s',fx:1162,fy:259,wx:38,wy:63,ww:244,wh:276,bx:1168,bw:306}];
 let h='<div class="hd"><img class="hh" src="'+BUI.h_head+'" alt="Hall of Fame">';
 slots.forEach((s,si)=>{const x=s.it;
  h+=`<div class="cd" style="--i:${si};--r:${[-3,2.5,3][si]}deg;transform-origin:${s.fx+(s.t==='s'?160:207)}px ${s.fy+(s.t==='s'?190:209)}px"><div class="pt" style="left:${s.fx+s.wx}px;top:${s.fy+s.wy}px;width:${s.ww}px;height:${s.wh}px;${x?`background-image:url(${BUI[PIC[x.style|0]||'p_cat']})`:'opacity:.55'}"></div><div class="fm ${s.t}" style="left:${s.fx}px;top:${s.fy}px"></div><div class="gl" style="left:${s.fx+s.wx}px;top:${s.fy+s.wy}px;width:${s.ww}px;height:${s.wh}px;--i:${si}"><i></i></div>`;
  h+=`<div class="ib" style="left:${s.bx}px;top:634px;width:${s.bw}px">`+(x?`<div class="n">${esc(x.name)}</div><div class="d1">Defeated in ${x.days} day${x.days>1?'s':''}</div><div class="d2">${rng(x.start,x.end)}</div><div class="ms">${(x.minis||[]).map(esc).join(' &middot; ')}</div>`:`<div class="n" style="top:50px;color:#8a7358">Empty</div>`)+'</div></div>'});
 if(pages>1)h+=`<button class="hpn" data-p="-1" style="left:760px"${hpg?'':' disabled'}>&lsaquo;</button><button class="hpn" data-p="1" style="left:840px"${hpg<pages-1?'':' disabled'}>&rsaquo;</button>`;
 if(!L.length)h+='<div class="hp-e">No boss has fallen yet.</div>';
 HP.innerHTML=h+'</div>'}
window.openHall=function(){hpg=0;P.style.display='none';hallPage();HP.style.display='block';HP.scrollTop=0};
const closeHall=()=>{HP.style.display='none'};window.closeHall=closeHall;
/* leaving the Hall is Esc-only (no Leave button, no backdrop click); Esc plays the reverse trapdoor sequence */
let turning=false;
function turnPage(d){if(turning)return;turning=true;const hd=HP.querySelector('.hd'),F=window.FX,T=F?F.CONFIG.trap.hall.turn:.28;
 if(F&&F.AU.fwip)F.AU.fwip();
 if(!hd||(F&&F.CONFIG.reducedMotion)){hpg+=d;hallPage();turning=false;return}
 hd.style.setProperty('--d',d);hd.style.setProperty('--tt',T+'s');hd.classList.add('tout');
 setTimeout(()=>{hpg+=d;hallPage();const h2=HP.querySelector('.hd');if(h2){h2.style.setProperty('--d',d);h2.style.setProperty('--tt',T+'s');h2.classList.add('tin')}
  setTimeout(()=>{const h3=HP.querySelector('.hd');if(h3)h3.classList.remove('tin');turning=false},T*500)},T*500)}
HP.addEventListener('click',e=>{const n=e.target.closest('.hpn');if(n&&!n.disabled)turnPage(+n.dataset.p)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&HP.style.display==='block'){if(window.exitHall)window.exitHall();else closeHall()}});

const st7=document.createElement('style');st7.textContent=`
#bp .rt .ttl{font-size:35px;letter-spacing:.5px;-webkit-text-stroke:.9px #17120b;white-space:nowrap}
#bp .rt .rt-ul{position:absolute;left:364px;top:82px;pointer-events:none}
#bp .rt .rt-ul path{stroke-dasharray:100;stroke-dashoffset:100;animation:rtdraw .6s ease-out .1s forwards}
#bp .rt .rt-glow{position:absolute;left:30px;top:30px;width:300px;height:300px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(255,196,104,.38),rgba(255,196,104,0) 68%);animation:rtglow 3.4s ease-in-out infinite alternate}
/* a plain, clean sheet: no texture, nothing behind the writing */
#bp .rt .rt-sheet{position:absolute;left:108px;top:122px;width:756px;height:668px;border:1.5px solid #20180d;border-radius:12px;background:#fbf5e4;box-shadow:inset 0 0 0 1.5px #fffdf4,inset 0 0 0 3px #d9c9a4,1px 2px 0 rgba(0,0,0,.35)}
#bp .rt .rt-body{position:absolute;inset:0;padding:16px 40px 0 44px}
#bp .rt .rt-s{position:relative;display:flex;gap:14px;margin-bottom:8px}
#bp .rt .rt-s .n{flex:none;width:30px;font:400 46px/40px 'Patrick Hand',cursive;font-style:normal;color:#17120b;-webkit-text-stroke:.7px #17120b}
#bp .rt .rt-s .t{flex:1;min-width:0}
#bp .rt .rt-s .t b{display:block;font-weight:400;font-size:29px;line-height:32px;color:#17120b;-webkit-text-stroke:.6px #17120b}
#bp .rt .rt-s .t span{display:block;margin-top:2px;font-size:22px;line-height:25px;color:#4a3d24;-webkit-text-stroke:.2px #4a3d24}
#bp .rt .rt-s .t em{font-style:normal;color:#17120b}
#bp .rt .rt-lad{margin:0 0 10px 44px}
#bp .rt .rt-l{display:flex;gap:10px;align-items:baseline;min-height:32px;border-bottom:1px solid rgba(88,68,40,.32)}
#bp .rt .rt-l .k{flex:none;width:170px;display:flex;align-items:center;gap:6px;white-space:nowrap;font-size:21px;line-height:32px;color:#4a3d24}
#bp .rt .rt-l .v{flex:1;min-width:0;font-size:24px;line-height:28px;color:#17120b;-webkit-text-stroke:.35px #17120b}
#bp .rt .rt-a{height:14px;display:flex;padding-left:10px;align-items:center}
#bp .rt .rt-tag{display:flex;align-items:center;gap:7px;margin-top:5px;justify-content:flex-end;font-size:19px;color:#4a3d24}
#bp .rt .rt-s4{align-items:center;margin-bottom:0}
#bp .rt .rt-sc{flex:none;width:136px;display:flex;flex-direction:column;align-items:center;margin-right:6px}
#bp .rt .rt-sw{position:relative;width:128px;height:128px;border-radius:50%;box-shadow:0 0 calc(4px + 34px*var(--p,0)) calc(1px + 6px*var(--p,0)) rgba(230,110,70,calc(.1 + .6*var(--p,0)))}
#bp .rt .rt-sw.fin{animation:rtburst .6s ease-out}
#bp .rt .rt-rg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
#bp .rt .rt-pr{filter:drop-shadow(0 0 3px rgba(255,110,60,.9))}
#bp .rt .rt-rn{opacity:calc(.7 + .3*var(--p,0))}
#bp .rt .rt-seal{position:absolute;left:17px;top:17px;width:94px;height:94px;padding:0;border:0;border-radius:50%;background:none;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;transition:transform .15s,filter .3s;filter:drop-shadow(0 3px 3px rgba(60,15,5,.45)) brightness(calc(1 + .18*var(--p,0)))}
#bp .rt .rt-seal svg{display:block;width:100%;height:100%;overflow:visible;pointer-events:none}
#bp .rt .rt-sw.hold .rt-seal{transform:scale(.96)}
#bp .rt .rt-seal:focus-visible{outline:3px solid #3f5a2e;outline-offset:4px}
#bp .rt .rt-seal.st{animation:rtstamp .3s ease-out}
#bp .rt .rt-hint{margin-top:4px;font-size:20px;line-height:22px;color:#4a3d24;-webkit-text-stroke:.2px #4a3d24}
#bp .rt .rt-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
#bp .rt .rt-in{opacity:0;animation:rtin .35s cubic-bezier(.34,1.4,.64,1) forwards;animation-delay:calc(var(--i)*60ms + 650ms)}
#bp .rt .rt-ex{opacity:0;animation:rtfade .6s ease 1.1s forwards}
@keyframes rtdraw{to{stroke-dashoffset:0}}
@keyframes rtin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes rtfade{from{opacity:0}to{opacity:1}}
@keyframes rtglow{from{opacity:.7}to{opacity:1}}
@keyframes rtstamp{0%{transform:scale(1.2)}60%{transform:scale(.92)}100%{transform:scale(1)}}
@keyframes rtburst{0%{box-shadow:0 0 0 0 rgba(230,110,70,.75),0 0 40px 8px rgba(230,110,70,.7)}100%{box-shadow:0 0 0 44px rgba(230,110,70,0),0 0 40px 8px rgba(230,110,70,.5)}}
@media (prefers-reduced-motion:reduce){#bp .rt .rt-in{animation-name:rtfade;animation-timing-function:ease}#bp .rt .rt-glow{animation:none}#bp .rt .rt-ul path{animation-duration:.01s}#bp .rt .rt-seal.st,#bp .rt .rt-sw.fin{animation:none}#bp .rt .rt-sw.hold .rt-seal{transform:none}}`;document.head.appendChild(st7);
window.openBosses=function(){view='list';ask=null;err='';P.style.display='block';render()};
addEventListener('keydown',e=>{if(e.key==='Escape'){if(editing)stopEdit(false);if(view==='ritual'&&P.style.display==='block'){err='';view='list';render();return}P.style.display='none'}});
})();

/* ---- top-left info panel for the picked boss, and the HP bars on the map ---- */
(function(){
const $=s=>document.querySelector(s),stage=$('#stage');
const IMG={cat:"boss/art/cat.png",green:"boss/art/green.png",red:"boss/art/red.png",redmap:"boss/art/redmap.png"};
const RNG={green:[0.01, 0.99],red:[0.0133, 0.9867],redmap:[0.0625, 0.9406]};
/* ---- top-left info panel: shows the picked boss / mini boss instead of Mira's stats ---- */
const BAR={hp:"boss/art/hpbar.png",mp:"boss/art/mpbar.png"};
const TITLE=['The Green Rider','The Grove Warden','The Thorn Knight'],MINI_TITLE=['Sporeling','Puffcap','Mossback'];
const info=document.createElement('div');info.id='binfo';
const bar2=(c,k)=>'<div class="bi-b '+c+'"><img class="bi-e" alt="" src="'+BAR[k]+'"><img class="bi-f" alt="" src="'+BAR[k]+'"></div>';
info.innerHTML='<img class="bi-pt" alt=""><div class="bi-nm"></div>'
 +'<div class="bi-lv"><span class="l1">Lv.</span><span class="l2"></span><span class="l3"></span></div>'
 +'<div class="bi-r bi-h"><span class="bi-k">HP</span><span class="bi-v bi-hv"></span></div>'+bar2('bi-hb','hp')
 +'<div class="bi-r bi-m"><span class="bi-k">MP</span><span class="bi-v">0/0</span></div>'+bar2('bi-mb','mp');
stage.appendChild(info);
const sty=document.createElement('style');sty.textContent=`#binfo{left:15px;top:14px;width:365px;height:182px;display:none;z-index:3;pointer-events:none;font-family:'Patrick Hand','Comic Sans MS',cursive;font-weight:400;color:#000;-webkit-text-stroke:.5px #000;text-rendering:geometricPrecision;-webkit-font-smoothing:antialiased;letter-spacing:.6px}
#binfo>*{position:absolute}
#binfo .bi-pt{left:6px;top:6px;width:142px;height:166px;object-fit:contain;object-position:center bottom;filter:drop-shadow(0 2px 2px rgba(60,40,10,.25))}
#binfo .bi-nm{left:160px;top:14px;width:187px;height:24px;line-height:26px;font-size:23px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#binfo .bi-lv{left:160px;top:51px;width:187px;height:20px;display:flex;align-items:center;font-size:15px;font-weight:400;line-height:20px;white-space:nowrap}
#binfo .bi-lv .l1{flex:none;width:31px}#binfo .bi-lv .l2{flex:none;width:31px}#binfo .bi-lv .l3{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
#binfo .bi-r{left:160px;width:187px;height:22px;display:flex;align-items:center;justify-content:space-between;font-size:16.5px;line-height:22px;white-space:nowrap}#binfo .bi-v{font-size:16px}
#binfo .bi-h{top:85px}#binfo .bi-m{top:132px}
#binfo .bi-b{left:159.5px;width:189px;height:14.5px}#binfo .bi-hb{top:107.5px}#binfo .bi-mb{top:154px}
#binfo .bi-b img{position:absolute;inset:0;width:100%;height:100%}
#binfo .bi-e{filter:grayscale(1) brightness(.62) contrast(.9)}#binfo .bi-f{transition:clip-path .45s}`;document.head.appendChild(sty);
const q1=s=>info.querySelector(s),eH=q1('.bi-hb .bi-f'),eP=q1('.bi-pt'),cx=document.createElement('canvas').getContext('2d');
const STATS=()=>[...stage.querySelectorAll('#face,#nm,#lv,.em,.lb,.vl')];
let key='';
/* shrink a text a little when it is too wide (never below 13px), the rest is cut with an ellipsis */
function fitT(el,txt,max,fs,wt){el.textContent=txt;el.style.fontSize=fs+'px';cx.font=wt+' '+fs+'px '+getComputedStyle(el).fontFamily;const w=cx.measureText(txt).width;if(w>max)el.style.fontSize=Math.max(13,fs*max/w).toFixed(2)+'px'}
function setInfo(d){const k=[d.img,d.t1,d.t2,d.lv,d.txt,d.r].join('|');if(k===key)return;key=k;
 eP.src=d.img;fitT(q1('.bi-nm'),d.t1,187,23,400);
 const lv=q1('.bi-lv');lv.children[1].textContent=d.lv;fitT(lv.children[2],d.t2,187-62,15,400);
 q1('.bi-hv').textContent=d.txt;
 const a=.012,b=.988;eH.style.clipPath=d.r>=1?'inset(0 0 0 0)':'inset(0 '+((1-(a+(b-a)*Math.max(0,d.r)))*100).toFixed(2)+'% 0 0)'}
function tick(){
 const B=window.__boss,b=B&&B.sel(),pk=B&&B.pick(),show=!!(b&&pk);
 info.style.display=show?'block':'none';STATS().forEach(e=>{e.style.display=show?'none':''});
 if(!show){key='';return}
 const p=b.hp/b.max,lv=p>.66?1:p>.33?2:3;
 if(pk.k==='cat'){const pt=B.pt(b,'main');setInfo({img:pt?pt.u:IMG.cat,t1:pt?pt.n:(TITLE[b.slot]||TITLE[0]),t2:b.name,lv,txt:b.hp+'/'+b.max,r:p})}
 else{const m=b.minis[pk.i],en=B.ent().find(e=>e.k==='mini'&&e.i===pk.i&&e.bs===b.id),dead=!en;
  const pt=B.pt(b,'mini',pk.i);setInfo({img:pt?pt.u:IMG.cat,t1:pt?pt.n:(MINI_TITLE[pk.i]||MINI_TITLE[0]),t2:m.n,lv,txt:(dead?0:1)+'/1',r:dead?0:1})}
}
setInterval(tick,60);tick();
/* make sure Lexend is really loaded before the first measure (a hidden element never triggers the download) */
if(document.fonts){const rf=()=>{key=''};Promise.all([document.fonts.load('500 17px Lexend'),document.fonts.load('600 19px Lexend')]).then(rf,rf);document.fonts.ready.then(rf)}
/* ---------- on-tile HP bars: green = main boss, red = mini bosses ---------- */
const TILE_BAR="boss/art/tilebar.png";IMG.tile=TILE_BAR;
const pic={};['green','redmap','tile'].forEach(k=>{const i=new Image();i.src=IMG[k];pic[k]=i});
function bar(g,k,cx,y,r,w,h){
 const im=pic[k];if(!im.complete||!im.naturalWidth)return;
 const x=cx-w/2,[a,b]=RNG[k];
 g.save();g.filter='grayscale(1) brightness(.6)';g.drawImage(im,x,y,w,h);g.restore();
 if(r>0){g.save();g.beginPath();g.rect(x,y-2,r>=1?w:w*(a+(b-a)*r),h+4);g.clip();g.drawImage(im,x,y,w,h);g.restore()}
}
/* new main-boss bar: green band = HP (empties from the right), blue band is decoration. Source 951x148: green y .10-.64, inner x .0158-.98 */
function tileBar(g,cx,y,r,w,h,red){
 const im=pic.tile;if(!im.complete||!im.naturalWidth)return;const x=cx-w/2,a=.0158,b=.98;
 g.drawImage(im,x,y,w,h);
 if(red&&r>0){g.save();g.beginPath();g.rect(x+w*a,y+h*.095,w*(b-a)*Math.min(1,r),h*.56);g.clip();g.filter='hue-rotate(-92deg) saturate(2.6) brightness(.82)';g.drawImage(im,x,y,w,h);g.restore()}
 if(r<1){g.save();g.beginPath();g.rect(x+w*(a+(b-a)*Math.max(0,r)),y+h*.095,w,h*.56);g.clip();g.filter='grayscale(1) brightness(.55) contrast(.9)';g.drawImage(im,x,y,w,h);g.restore()}
}
window.bossDraw=g=>{
 const B=window.__boss;if(!B)return;
 if(B.drawEdit)B.drawEdit(g);
 B.ent().forEach(e=>{const b=B.get(e.bs);if(!b)return;const o=e.o,cx=o.x+o.w/2,isCat=e.k==='cat',w=64,h=11;
  const rr=isCat?(window.FX?FX.hp(b):b.hp/b.max):1;
  if(isCat&&b.bar!=='classic'){const tw=84,th=tw*148/951+.5,y0=o.y-5-th;tileBar(g,cx,y0,rr,tw,th);if(window.FX)FX.ghostBar(g,b.id,cx-tw/2+tw*.0158,y0+th*.095,tw*(.98-.0158),th*.56)}
  else if(!isCat&&b.mbar!=='classic'){const tw=66,th=tw*148/951+.5;tileBar(g,cx,o.y-5-th,o.dim?0:1,tw,th,true)}
  else{const y0=o.y-5-h;bar(g,isCat?'green':'redmap',cx,y0,isCat?rr:(o.dim?0:1),w,h);if(isCat&&window.FX){const q=RNG.green;FX.ghostBar(g,b.id,cx-w/2+w*q[0],y0+h*.2,w*(q[1]-q[0]),h*.6)}}});
};
})();


;

/* ---------- AI name suggestions (Groq) for the boss and mini boss names ---------- */
(function(){
const P=document.querySelector('#bp');if(!P)return;
const SYSTEM=`You turn a goal into short, simple names. Suggest exactly 3 different names for it.

Rules:
- 2 to 4 words, under 22 characters.
- Plain everyday English. No fantasy, no jokes, no fancy words.
- Say what the goal is, like a clear title.
- Start with an action word when it fits (Land, Send, Post, Finish, Get).
- Title Case. No emojis, quotes or punctuation.
- Give 3 different ways to say it, not 3 copies of the same name.

Reply with JSON only: {"names":["","",""]}

Examples:
Goal: I want to get 3 new clients this month -> {"names":["Land 3 Clients","Get New Clients","Win 3 Clients"]}
Goal: send a message to 12 people on instagram -> {"names":["Send 12 DMs","Message 12 People","DM 12 Leads"]}
Goal: reach ten thousand subscribers on youtube -> {"names":["Reach 10k Subs","Hit 10k Subscribers","Grow To 10k"]}`;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const st=document.createElement('style');
st.textContent=`#bp .sgb{flex:none;height:30px;box-sizing:border-box;padding:0 12px;border:1.5px solid #20180d;border-radius:6px;background:#eee0c6;box-shadow:inset 0 0 0 1.5px #fdfae7,inset 0 0 0 2.5px #cdbd9c,1px 2px 0 rgba(0,0,0,.35);font:17px/1 'Patrick Hand','Comic Sans MS',cursive;color:#17120b;cursor:pointer;white-space:nowrap}
#bp .sgb:hover{background:#e3d3aa}#bp .sgb:disabled{opacity:.5;cursor:default}
#bp .sg{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:-4px 0 10px 140px;font-family:'Patrick Hand','Comic Sans MS',cursive}
#bp .sgc{height:30px;box-sizing:border-box;padding:0 14px;border:1.5px solid #20180d;border-radius:15px;background:#f7edd2;box-shadow:1px 1px 0 rgba(0,0,0,.3);font:18px/1 'Patrick Hand','Comic Sans MS',cursive;color:#17120b;cursor:pointer;white-space:nowrap}
#bp .sgc:hover{background:#cfe3b4}#bp .sgm{font-size:16px;color:#5a4a2c}`;
document.head.appendChild(st);
const clean=a=>{const seen=new Set(),out=[];(Array.isArray(a)?a:[]).forEach(x=>{const s=String(x).replace(/["'.!?,:;]/g,'').replace(/\s+/g,' ').trim().slice(0,30),k=s.toLowerCase();if(s&&!seen.has(k)){seen.add(k);out.push(s)}});if(!out.length)throw new Error('No names came back, try again');return out.slice(0,3)};
async function suggest(goal){
 /* 1) same-origin proxy (server.js keeps GROQ_API_KEY in .env) */
 try{const r=await fetch('/api/names',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({goal})});if(r.ok)return clean((await r.json()).names)}catch(e){}
 /* 2) direct call, the key stays in this browser only */
 let key=window.GROQ_API_KEY||localStorage.getItem('groq_api_key');
 if(!key){key=(prompt('Paste your Groq API key (it is saved only in this browser):')||'').trim();if(!key)throw new Error('A Groq API key is needed');localStorage.setItem('groq_api_key',key)}
 const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
  body:JSON.stringify({model:window.GROQ_MODEL||'openai/gpt-oss-20b',temperature:.7,max_completion_tokens:500,reasoning_effort:'low',messages:[{role:'system',content:SYSTEM},{role:'user',content:'Goal: '+goal}]})});
 if(r.status===401){localStorage.removeItem('groq_api_key');throw new Error('Groq rejected the key, press Suggest to enter it again')}
 if(!r.ok)throw new Error('Groq error '+r.status+(r.status===404?' (model not found, check the model name)':''));
 const j=await r.json();let o;try{o=JSON.parse(String(j.choices[0].message.content||'').match(/\{[\s\S]*\}/)[0])}catch(e){throw new Error('Could not read the answer, try again')}
 return clean(o.names);
}
P.addEventListener('click',async e=>{
 const c=e.target.closest('.sgc');
 if(c){const box=c.closest('.sg'),inp=document.getElementById(box.dataset.f);if(inp){inp.value=c.textContent;inp.focus()}box.remove();return}
 const b=e.target.closest('.sgb');if(!b)return;
 const f=b.dataset.f,inp=document.getElementById(f),goal=(inp&&inp.value||'').trim(),row=b.closest('.fr');
 const old=P.querySelector('.sg[data-f="'+f+'"]');if(old)old.remove();
 const box=document.createElement('div');box.className='sg';box.dataset.f=f;row.after(box);
 if(!goal){box.innerHTML='<span class="sgm">Type your goal first, then press Suggest.</span>';return}
 b.disabled=true;box.innerHTML='<span class="sgm">Thinking...</span>';
 try{const names=await suggest(goal);if(!box.isConnected)return;box.innerHTML='<span class="sgm">Pick one:</span>'+names.map(n=>'<button type="button" class="sgc">'+esc(n)+'</button>').join('')}
 catch(err){if(box.isConnected)box.innerHTML='<span class="sgm">'+esc(err.message||'Something went wrong')+'</span>'}
 finally{b.disabled=false}
});
})();
