/* ---- Mira's Grove: backend glue (injected after the main script) ---- */
(function(){
const A=window.GroveAPI,q=s=>document.querySelector(s);
let ME=null,PLAYERS=[],mode='login';
const ZERO={int:0,end:0,str:0,arc:0,wis:0};
const EMPTY={id:null,n:'No one yet',lv:1,t:'Seedling',v:ZERO,ch:null};
const toCH=p=>({id:p.id,n:p.name,lv:p.level,t:p.title,v:{...p.stats},ch:p.character||null});

/* characters: the catalogue (data/characters.json) comes from the server; every player's portrait is their own character */
let CHARS=[];const cOf=k=>CHARS.find(c=>c.key===k)||null;
async function loadChars(){try{CHARS=await A.getCharacters()}catch(e){}}
const FACEEL=q('#face'),NSLOT=6,CARD0=149,CARDSTEP=67;   /* five player cards in the right sidebar, 67px apart */
/* the design draws two cards (top 149 and 216); the other three are copies of the second one, placed below it */
{const frame=q('#stage img.ui[style*="left:1333px"][style*="top:216px"]');
 for(let i=2;i<NSLOT;i++){const c=frame.cloneNode(true);c.style.top=(CARD0+CARDSTEP*i)+'px';frame.parentNode.insertBefore(c,frame.nextSibling)}}
/* one portrait icon per card (slot 0 = you) */
document.querySelectorAll('#stage img.ui[style*="left:1376px"],#stage img.ui[style*="left:1384px"]').forEach(e=>e.remove());   /* the design's two old placeholder icons */
const IC=[];for(let i=0;i<NSLOT;i++){const e=document.createElement('img');e.className='ui';e.alt='';e.style.cssText='left:1376px;top:'+(157+CARDSTEP*i)+'px;width:55px;height:54px;object-fit:contain;visibility:hidden';q('#stage').appendChild(e);IC.push(e)}
FACEEL.style.visibility='hidden';   /* nobody is shown until the player is known */
/* portrait: as big as the frame allows (121 x 157), standing on the panel's bottom edge */
function placeFace(){const f=FACEEL,w0=f.naturalWidth,h0=f.naturalHeight;if(!w0)return;let w=121,h=w*h0/w0;if(h>157){h=157;w=h*w0/h0}f.style.width=w+'px';f.style.left=(27+(121-w)/2)+'px';f.style.top=(184-h)+'px'}
FACEEL.addEventListener('load',placeFace);

/* toast */
const tt=document.createElement('div');tt.id='toast';document.body.appendChild(tt);let tmr;
window.groveToast=m=>{tt.textContent=m;tt.style.display='block';clearTimeout(tmr);tmr=setTimeout(()=>{tt.style.display='none'},4200)};

/* five cards in a FIXED order (the same for everybody): one card per character. A card whose character nobody has chosen
   yet shows the character normally, but the mouse pointer on it is "not-allowed" and clicking does nothing. */
const ORDER=['mira','noble','dice','scholar','crimson','duchess'];
const plOf=k=>PLAYERS.find(p=>p.character===k)||null;
const myIdx=()=>Math.max(0,ORDER.indexOf(ME&&ME.character));
function apply(){for(let i=0;i<NSLOT;i++){const p=plOf(ORDER[i]);CH[i]=p?toCH(p.id===ME.id?ME:p):{...EMPTY}}CUR=CH[ci];Object.assign(V,CUR.v);K.forEach(draw);STATRUN()}
async function refreshOthers(){try{PLAYERS=await A.getPlayers()}catch(e){}if(ME&&!PLAYERS.some(p=>p.id===ME.id))PLAYERS.push(ME)}
function slotLook(){const f=FACEEL,c=cOf(CH[ci].ch);
  if(c){if(!f.src.endsWith(c.face))f.src=c.face;f.alt=c.name;f.style.visibility='visible';placeFace()}else f.style.visibility='hidden';
  sel.style.top=(CARD0-2+CARDSTEP*ci)+'px';
  /* the five cards: the icon of each character is always shown in full colour */
  const hb=[...document.querySelectorAll('#stage .hb')].filter(b=>b.style.left==='1333px').sort((a,b)=>parseFloat(a.style.top)-parseFloat(b.style.top));
  IC.forEach((e,i)=>{const k=cOf(ORDER[i]);
    if(k){e.src=k.icon;e.alt=k.name;e.style.visibility='visible';e.style.opacity='1';e.style.filter='none'}else e.style.visibility='hidden';
    if(hb[i]){hb[i].style.cursor=CH[i].id?'pointer':'not-allowed';hb[i].title=CH[i].id?CH[i].n:(k?k.name+' - nobody yet':'')}})}
window.pick=async function(i){
  if(!ME)return;
  await refreshOthers();apply();
  if(!CH[i]||!CH[i].id)return false;   /* nobody has this character yet: nothing happens */
  ci=i;apply();slotLook();return true};
window.GroveMe=p=>{ME=p;PLAYERS=PLAYERS.map(x=>x.id===p.id?p:x);apply()};window.GroveWho=()=>{const c=CH[ci];return c&&c.id?{id:c.id,name:c.n,mine:!!ME&&c.id===ME.id}:null};
window.GroveLogout=()=>{A.logout();location.reload()};

/* journal page: load the viewed player's journal for the selected day (0 or 1 entry) */
const jOpen=()=>{const e=q('#jp');return !!e&&e.style.display==='block'};
async function loadJ(){
  const p=CH[ci],mine=!!ME&&p.id===ME.id,key=GJ.key();
  GJ.who(p.id,p.n,mine);GJ.set([],mine,p.n,true);
  if(!p.id){GJ.set([],mine,p.n);return}
  try{const j=await A.getPlayerJournals(p.id,{date:key});
    if(key!==GJ.key()||p.id!==CH[ci].id)return;   /* user already moved on to another day / player */
    GJ.set(j,mine,p.n)}
  catch(e){if(key===GJ.key()&&p.id===CH[ci].id)GJ.set([],mine,p.n);window.groveToast(e.message)}}
/* opening the journal always starts on today */
const oj=window.openJ;window.openJ=function(){oj();GJ.setKey(GJ.todayKey());loadJ()};
document.addEventListener('change',e=>{if(e.target.id==='jdate'){GJ.setKey(GJ.key());loadJ()}});
document.addEventListener('keydown',e=>{if(e.target.id==='jdate'&&e.key==='Enter')e.target.blur()});
/* clicking any of the five player cards while the journal is open switches to that player's journal */
const pk=window.pick;window.pick=async function(i){const ok=await pk(i);if(ok&&jOpen())loadJ()};   /* a disabled card changes nothing, so the journal is not reloaded either */

/* auth panel */
function setMode(m){mode=m;q('#an').style.display=m==='register'?'block':'none';q('#ago').textContent=m==='login'?'Enter the Grove':'Create account';
  q('#asw').textContent=m==='login'?'New here? Create an account':'Have an account? Log in';q('#apw').autocomplete=m==='login'?'current-password':'new-password';q('#aerr').textContent=''}
/* choose a character: only the ones nobody has are clickable; this is shown once, right after registering (or at the next login if it was skipped) */
function pickChar(){return new Promise(done=>{
  const box=q('#apick'),list=q('#achars'),btn=q('#achoose'),err=q('#aperr');let sel=null;
  q('#alogin').style.display='none';box.style.display='block';q('#auth').style.display='flex';err.textContent='';
  const paint=()=>{list.innerHTML='';CHARS.forEach(c=>{const d=document.createElement('div');d.className='ach'+(c.taken?' tk':'')+(c.key===sel?' on':'');d.dataset.k=c.key;
    const im=document.createElement('img');im.src=c.face;im.alt='';const sp=document.createElement('span');sp.textContent=c.name;d.append(im,sp);
    if(c.taken){const em=document.createElement('em');em.textContent='Taken';d.appendChild(em)}list.appendChild(d)});
    const c=cOf(sel);btn.disabled=!c||c.taken;btn.textContent=c&&!c.taken?'Choose '+c.name:'Choose a character'};
  list.onclick=e=>{const d=e.target.closest('.ach');if(!d||d.classList.contains('tk'))return;sel=d.dataset.k;err.textContent='';paint()};
  btn.onclick=async()=>{btn.disabled=true;err.textContent='';
    try{ME=await A.chooseCharacter(sel);box.style.display='none';done()}
    catch(e){err.textContent=e.message;await loadChars();if(cOf(sel)&&cOf(sel).taken)sel=null;paint()}};
  paint()})}
/* choose an archetype (liberal = easy, radical = hard): shown once, right after the character (or at the next login if it was skipped).
   The descriptions come from the server (data/archetypes.json). */
async function pickArchetype(){
  let list_;try{list_=await A.getArchetypes()}catch(e){list_=[]}
  if(!list_.length)return;
  return new Promise(done=>{
  const box=q('#aarch'),list=q('#aarchs'),btn=q('#aachoose'),err=q('#aaerr');let sel=null;
  q('#alogin').style.display='none';q('#apick').style.display='none';box.style.display='block';q('#auth').style.display='flex';err.textContent='';
  const paint=()=>{list.innerHTML='';list_.forEach(a=>{const d=document.createElement('div');d.className='aac'+(a.key===sel?' on':'');d.dataset.k=a.key;
    const h=document.createElement('h3');h.textContent=a.name;const m=document.createElement('em');m.textContent=a.mode;
    const p=document.createElement('p');p.textContent=a.summary;
    const s=document.createElement('p');s.className='sg';const sb=document.createElement('b');sb.textContent='Signal: ';s.append(sb,a.signal);
    const n=document.createElement('p');n.className='nz';const nb=document.createElement('b');nb.textContent='Noise: ';n.append(nb,a.noise);
    d.append(h,m,p,s,n);list.appendChild(d)});
    const a=list_.find(x=>x.key===sel);btn.disabled=!a;btn.textContent=a?'Choose '+a.name:'Choose an archetype'};
  list.onclick=e=>{const d=e.target.closest('.aac');if(!d)return;sel=d.dataset.k;err.textContent='';paint()};
  btn.onclick=async()=>{btn.disabled=true;err.textContent='';
    try{ME=await A.chooseArchetype(sel);box.style.display='none';done()}
    catch(e){if(/already/i.test(e.message)){try{ME=await A.me()}catch(x){}box.style.display='none';done();return}err.textContent=e.message;paint()}};
  paint()})}
async function enter(p){ME=p;await loadChars();if(!ME.character){await pickChar();await loadChars()}if(!ME.archetype)await pickArchetype();await refreshOthers();ci=myIdx();apply();slotLook();q('#auth').style.display='none'}
async function submit(){const b=q('#ago');b.disabled=true;q('#aerr').textContent='';
  try{const e=q('#ae').value.trim(),pw=q('#apw').value;
    await enter(mode==='login'?await A.login(e,pw):await A.register(q('#an').value.trim(),e,pw));q('#apw').value=''}
  catch(err){q('#aerr').textContent=err.message}finally{b.disabled=false}}
q('#asw').onclick=()=>setMode(mode==='login'?'register':'login');
q('#ago').onclick=submit;
['#an','#ae','#apw'].forEach(s=>q(s).addEventListener('keydown',e=>{if(e.key==='Enter')submit()}));
(async()=>{if(A.isLoggedIn()){try{await enter(await A.me());return}catch(e){}}q('#auth').style.display='flex'})();
})();
