/* ---- Mira's Grove: backend glue (injected after the main script) ---- */
(function(){
const A=window.GroveAPI,q=s=>document.querySelector(s);
let ME=null,OTHERS=[],oi=0,mode='login';
const ZERO={int:0,end:0,str:0,arc:0,wis:0};
const EMPTY={id:null,n:'No one yet',lv:1,t:'Seedling',v:ZERO};
const toCH=p=>({id:p.id,n:p.name,lv:p.level,t:p.title,v:{...p.stats}});

/* toast */
const tt=document.createElement('div');tt.id='toast';document.body.appendChild(tt);let tmr;
window.groveToast=m=>{tt.textContent=m;tt.style.display='block';clearTimeout(tmr);tmr=setTimeout(()=>{tt.style.display='none'},4200)};

/* slot 0 = you, slot 1 = another player (click again to cycle) */
function apply(){CH[0]=toCH(ME);CH[1]=OTHERS[oi]?toCH(OTHERS[oi]):{...EMPTY};CUR=CH[ci];Object.assign(V,CUR.v);K.forEach(draw);STATRUN()}
async function refreshOthers(){try{OTHERS=(await A.getPlayers()).filter(p=>p.id!==ME.id)}catch(e){}}
function slotLook(){const f=q('#face');f.src=FACE[ci];f.style.top=ci?'48.5px':'27px';sel.style.top=(ci?214:147)+'px'}
window.pick=async function(i){
  if(!ME)return;
  if(i===1){const prev=OTHERS[oi]&&OTHERS[oi].id;await refreshOthers();const k=OTHERS.findIndex(p=>p.id===prev);
    oi=ci===1?(OTHERS.length?(k+1)%OTHERS.length:0):(k>=0?k:0)}
  else if(ci===0)return;
  ci=i;apply();slotLook()};
window.GroveMe=p=>{ME=p;apply()};
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
/* clicking a player card while the journal is open switches to that player's journal */
const pk=window.pick;window.pick=async function(i){await pk(i);if(jOpen())loadJ()};

/* auth panel */
function setMode(m){mode=m;q('#an').style.display=m==='register'?'block':'none';q('#ago').textContent=m==='login'?'Enter the Grove':'Create account';
  q('#asw').textContent=m==='login'?'New here? Create an account':'Have an account? Log in';q('#apw').autocomplete=m==='login'?'current-password':'new-password';q('#aerr').textContent=''}
async function enter(p){ME=p;ci=0;oi=0;await refreshOthers();apply();slotLook();q('#auth').style.display='none'}
async function submit(){const b=q('#ago');b.disabled=true;q('#aerr').textContent='';
  try{const e=q('#ae').value.trim(),pw=q('#apw').value;
    await enter(mode==='login'?await A.login(e,pw):await A.register(q('#an').value.trim(),e,pw));q('#apw').value=''}
  catch(err){q('#aerr').textContent=err.message}finally{b.disabled=false}}
q('#asw').onclick=()=>setMode(mode==='login'?'register':'login');
q('#ago').onclick=submit;
['#an','#ae','#apw'].forEach(s=>q(s).addEventListener('keydown',e=>{if(e.key==='Enter')submit()}));
(async()=>{if(A.isLoggedIn()){try{await enter(await A.me());return}catch(e){}}q('#auth').style.display='flex'})();
})();
