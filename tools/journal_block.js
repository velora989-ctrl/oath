/* ---- backend wiring (injected) ---- */
const $j=s=>JP.querySelector(s),ta=$('#jta'),pad2=n=>String(n).padStart(2,'0');
const SN={int:'INT',str:'STR',end:'END',arc:'ARC',wis:'WIS'};
const escA=t=>String(t==null?'':t).replace(/[<>&"']/g,'');
function dKey(){const i=document.querySelector('#jdate'),m=/^\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\s*$/.exec(i?i.value:DS)||/(\d{2})\/(\d{2})\/(\d{4})/.exec(DS);return m[3]+'-'+pad2(m[2])+'-'+pad2(m[1])}
/* A task called "Unknown" keeps that name (and its neutral image) but is a NOISE task everywhere: red marker in the
   activity log, red "Noise" badge in the calendar, red part of the pie (the server counts it as noise). */
const catOf=x=>x.type==='signal'?'signal':(x.type==='necessity'?'necessity':'noise');
/* durations are shown like "30min", "1hr", "3hr 30min": "90 mins" / "1.5 h" -> "1hr 30min" (the server already sends this
   format; this also covers any old "mins" text that might still arrive) */
function mins(d){const s=String(d==null?'':d);let t=0,f=false;s.replace(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)(?![a-z])/gi,(m,n,u)=>{f=true;t+=/^h/i.test(u)?Number(n)*60:Number(n);return m});
 if(!f)return s;return fmtMin(t)}
function rowHTML(x){const sg=x.type==='signal',bk=sg?'signa':'noise',[bw,bh]=P[bk],pts=Object.keys(SN).filter(k=>x.points&&x.points[k]>0).map(k=>'+'+x.points[k]+' '+SN[k]).join(', ');
return`<div class="jr" title="${escA(pts||catOf(x))}"><img src="${escA(x.emoji)}" alt="" style="left:5px;top:4.2px;width:34px;height:34px;object-fit:contain"><span class="jn" title="${escA(x.name)}">${escA(x.name)}</span><img src="${IM[bk]}" alt="" style="left:${1036-785-bw/2}px;top:${(42.4-bh)/2}px;width:${bw}px;height:${bh}px"><span class="jt">${escA(mins(x.duration))}</span></div>`}

/* ---------- full task names ----------
   The server limits a task name to 30 characters. The name box (172px) is never cut with "...": the text is made
   smaller until it fits on one line, and if it still does not, it goes on two lines. Text is measured on a canvas, so
   it does not depend on the page zoom. */
const NCX=document.createElement('canvas').getContext('2d'),NFONT="'Patrick Hand','Comic Sans MS',cursive",NW=172,NH=41;
const tw=(t,s,ls)=>{NCX.font=s+'px '+NFONT;return NCX.measureText(t).width+ls*t.length};
function nameLines(t,s,ls){let n=1,cur='';for(const w of t.split(' ')){const c=cur?cur+' '+w:w;if(tw(c,s,ls)<=NW*.96||!cur){cur=c;if(tw(cur,s,ls)>NW*.96)return 99}else{n++;cur=w;if(tw(cur,s,ls)>NW*.96)return 99}}return n}
function fitNames(){document.querySelectorAll('#jlist .jn').forEach(el=>{const t=el.textContent.trim(),st=el.style;
 st.whiteSpace='nowrap';st.lineHeight=NH+'px';st.paddingTop='0';st.letterSpacing='.8px';
 for(let s=19;s>=15;s--){if(tw(t,s,.8)<=NW*.96){st.fontSize=s+'px';return}}
 st.whiteSpace='normal';st.letterSpacing='.3px';
 for(let s=16;s>=11;s--){const n=nameLines(t,s,.3);if(n<=2||s===11){const lh=s+2;st.fontSize=s+'px';st.lineHeight=lh+'px';st.paddingTop=Math.max(0,(NH-Math.min(n,2)*lh)/2)+'px';return}}})}
{const jl=$('#jlist');new MutationObserver(fitNames).observe(jl,{childList:true});if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fitNames)}

/* ---------- dates ---------- */
const WK=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const keyOf=(y,m,d)=>y+'-'+pad2(m+1)+'-'+pad2(d);            /* m is 0-based */
const key2in=k=>k.slice(8)+'/'+k.slice(5,7)+'/'+k.slice(0,4);   /* 2026-10-14 -> 14/10/2026 */
const todayKey=()=>{const t=new Date();return keyOf(t.getFullYear(),t.getMonth(),t.getDate())};
const longDate=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})};
function fmtMin(n){n=Math.max(0,Math.round(Number(n)||0));const h=Math.floor(n/60),m=n%60;return !h?m+'min':(m?h+'hr '+m+'min':h+'hr')}
function setKey(k){const i=document.querySelector('#jdate');if(i)i.value=key2in(k)}
function go(k){setKey(k);document.querySelector('#jdate').dispatchEvent(new Event('change',{bubbles:true}))}
function stepDay(n){const [y,m,d]=dKey().split('-').map(Number),t=new Date(y,m-1,d+n),k=keyOf(t.getFullYear(),t.getMonth(),t.getDate());if(k>todayKey())return;go(k)}

/* ---------- one journal per day ---------- */
let JS=[],WHO={id:null,name:'',mine:false},LOADING=false,busy=false;
const drafts={};                      /* unsent text per day */
const entry=()=>JS[0]||null;
function savePaint(mode){             /* open | locked | hidden */
 const img=JP.children[4],hitb=$('#jsave'),tx=$j('#jx6');
 if(!busy)T(mode==='locked'?'Entry Saved':'Save Entry',CF.SV,'#efe8d0','jx6');   /* T() resets inline styles, so style after it */
 img.style.visibility=hitb.style.visibility=tx.style.visibility=mode==='hidden'?'hidden':'visible';
 img.style.opacity=tx.style.opacity=mode==='locked'?'.5':'1';
 hitb.style.cursor=mode==='open'?'pointer':'default'}
function emptyPie(){$('#jsvg').innerHTML='<circle cx="'+P.pie[2]/2+'" cy="'+P.pie[3]/2+'" r="'+Math.min(P.pie[2],P.pie[3])/2*(P.pie[4]+.02)+'" fill="#cdbf93" opacity=".7"/>';$('#jpl1').style.display=$('#jpl2').style.display='none'}
function afterRender(){
 const k=dKey(),e=entry();
 T(k===todayKey()?'Growth Today':'Growth '+k.slice(8)+'/'+k.slice(5,7),K.growth,0,'jx4');
 if(!e)emptyPie();
 const canWrite=WHO.mine&&!e&&!LOADING&&k<=todayKey();
 savePaint(canWrite?'open':(WHO.mine&&e?'locked':'hidden'))}
const _layout=layout;layout=function(){_layout();afterRender()};   /* openJ re-runs layout(); keep our state on top */

function showDay(){
 const e=entry();
 S.ent=e?e.tasks.filter(x=>x.type!=='necessity'):[];   /* sleep (necessity) is shown in the calendar only, not in the activity log */S.g=e?{...e.points}:{int:0,str:0,end:0,arc:0,wis:0};S.ratio=e?e.signal_to_noise_ratio:.5;
 const k=dKey();
 ta.readOnly=true;
 if(LOADING){ta.value='';ta.placeholder='Loading...'}
 else if(e){ta.value='';ta.placeholder='Entry saved. Past entries are not shown.'}   /* saved text is never displayed */
 else if(WHO.mine&&k<=todayKey()){ta.readOnly=false;ta.value=drafts[k]||'';ta.placeholder='Write about your day...'}
 else{ta.value='';ta.placeholder=k>todayKey()?"That day hasn't happened yet":((WHO.name||'This player')+' wrote nothing on this day')}
 render();afterRender();const l=$('#jlist');l.scrollTop=0}
ta.addEventListener('input',()=>{if(!ta.readOnly)drafts[dKey()]=ta.value});
window.GJ={key:dKey,todayKey,setKey,go,
 who(id,name,mine){WHO={id,name,mine};if(CAL.open)calLoad()},
 /* journals: 0 or 1 entries for the selected day */
 set(journals,editable,name,loading){WHO.name=name||WHO.name;WHO.mine=!!editable;JS=journals||[];LOADING=!!loading;showDay()},
 add(j){JS=[j];LOADING=false;showDay()}};

$('#jsave').onclick=async()=>{if(busy||ta.readOnly||!WHO.mine||entry())return;const text=ta.value.trim(),key=dKey();
 if(text.length<5)return window.groveToast&&window.groveToast('Write a bit more first');
 busy=true;T('Analysing...',CF.SV,'#efe8d0','jx6');
 try{const d=await GroveAPI.submitJournal(text,key);delete drafts[key];busy=false;
  if(dKey()===key)GJ.add(d.journal);else window.groveToast&&window.groveToast('Journal saved for '+key2in(key));
  window.GroveMe&&window.GroveMe(d.player)}
 catch(e){busy=false;window.groveToast&&window.groveToast(e.message);
  document.querySelector('#jdate').dispatchEvent(new Event('change',{bubbles:true}))}   /* reload the day, e.g. if it was already saved */
 finally{busy=false;afterRender()}};

/* ---------- day arrows + calendar button ---------- */
JP.insertAdjacentHTML('beforeend',
 '<button class="jnav jfix" id="jprev" style="left:538px;top:258px;width:34px" aria-label="Previous day">&#8249;</button>'+
 '<button class="jnav jfix" id="jnext" style="left:576px;top:258px;width:34px" aria-label="Next day">&#8250;</button>'+
 '<button class="jnav jfix" id="jcalb" style="left:616px;top:258px;width:84px">Calendar</button>');
$('#jprev').onclick=()=>stepDay(-1);$('#jnext').onclick=()=>stepDay(1);

/* ---------- calendar ---------- */
const CAL={open:false,y:0,m:0,sel:null,days:{},req:0};
const cal=document.createElement('div');cal.id='jcal';cal.className='jfix';
cal.innerHTML='<div class="cl"><div class="ch"><button class="jnav" id="jcp" aria-label="Previous month">&#8249;</button><div id="jcm"></div><button class="jnav" id="jcn" aria-label="Next month">&#8250;</button></div>'+
 '<div class="cw">'+WK.map(w=>'<span>'+w+'</span>').join('')+'</div><div class="cg" id="jcg"></div><div class="ck"><i class="g"></i>Signal <i class="r"></i>Noise <u>+n</u> points gained</div></div>'+
 '<div class="cr"><div id="jcd"></div><div id="jcwho"></div><div id="jcs"></div></div><button class="jnav" id="jcx">Close</button>';
JP.appendChild(cal);
const $c=s=>cal.querySelector(s);
function calRender(){
 const {y,m}=CAL,lead=(new Date(y,m,1).getDay()+6)%7,dim=new Date(y,m+1,0).getDate(),tk=todayKey(),cells=Math.ceil((lead+dim)/7)*7;let h='';
 for(let i=0;i<cells;i++){const d=i-lead+1;if(d<1||d>dim){h+='<div class="cc out"></div>';continue}
  const k=keyOf(y,m,d),e=CAL.days[k];
  h+='<div class="cc'+(k>tk?' fut':'')+(k===tk?' today':'')+(k===CAL.sel?' sel':'')+'" data-k="'+k+'"><b>'+d+'</b>'+(e?'<u>+'+e.totalPoints+'</u><span class="rb"><i style="width:'+Math.round(e.ratio*100)+'%"></i></span>':'')+'</div>'}
 $c('#jcg').innerHTML=h;$c('#jcm').textContent=MONTHS[m]+' '+y;
 const t=new Date();$c('#jcn').disabled=y>t.getFullYear()||(y===t.getFullYear()&&m>=t.getMonth());
 calSummary()}
function calSummary(){
 const k=CAL.sel,e=k&&CAL.days[k],box=$c('#jcs');
 $c('#jcd').textContent=k?longDate(k):'Pick a day';
 $c('#jcwho').textContent=WHO.id?(WHO.mine?'Your journal':WHO.name+"'s journal"):'';
 if(!k){box.innerHTML='';return}
 let h='';
 if(!e){h+='<p class="cnone">'+(k>todayKey()?"That day hasn't happened yet.":'No journal on this day.')+'</p>'}
 else{const s=Math.round(e.ratio*100),pts=Object.keys(SN).filter(x=>e.points[x]>0).map(x=>'<span>'+SN[x]+' +'+e.points[x]+'</span>').join('');
  h+='<div class="csn"><div class="cbar"><i style="width:'+s+'%"></i></div><div class="cbl"><span>Signal '+s+'%</span><span>Noise '+(100-s)+'%</span></div><div class="cmn">'+fmtMin(e.signalMinutes)+' signal / '+fmtMin(e.noiseMinutes)+' noise'+(e.necessityMinutes>0?' &middot; '+fmtMin(e.necessityMinutes)+' sleep (not counted)':'')+'</div></div>'+
   '<div class="cpt"><b>Points gained: +'+e.totalPoints+'</b>'+(pts?'<div>'+pts+'</div>':'')+'</div>'+
   '<div class="ctl">'+e.tasks.map(t=>{const nc=t.type==='necessity',sg=!nc&&t.type==='signal',p=Object.keys(SN).filter(x=>t.points&&t.points[x]>0).map(x=>' +'+t.points[x]+' '+SN[x]).join('');
    return'<div class="ct '+(nc?'nc':sg?'sg':'nz')+'"><img src="'+escA(t.emoji)+'" alt=""><span class="cn1">'+escA(t.name)+'</span><span class="cd">'+escA(mins(t.duration))+'</span><span class="cb">'+(nc?'Necessity':sg?'Signal'+escA(p):'Noise')+'</span></div>'}).join('')+'</div>'}
 if(k<=todayKey()&&(e||WHO.mine||WHO.id))h+='<button class="jnav" id="jco">'+(e?'View this day':(WHO.mine?'Write this day':'Open this day'))+'</button>';
 box.innerHTML=h;const b=$c('#jco');if(b)b.onclick=()=>{calClose();go(k)}}
async function calLoad(){
 const id=WHO.id,rq=++CAL.req;CAL.days={};calRender();if(!id)return;
 try{const d=await GroveAPI.getCalendar(id,CAL.y+'-'+pad2(CAL.m+1));if(rq!==CAL.req)return;d.days.forEach(x=>{CAL.days[x.date]=x})}
 catch(err){if(rq!==CAL.req)return;window.groveToast&&window.groveToast(err.message)}
 calRender()}
function calOpen(){const [y,m]=dKey().split('-').map(Number);CAL.y=y;CAL.m=m-1;CAL.sel=dKey();CAL.open=true;cal.style.display='flex';calLoad()}
function calClose(){CAL.open=false;CAL.req++;cal.style.display='none'}
$('#jcalb').onclick=()=>CAL.open?calClose():calOpen();
$c('#jcx').onclick=calClose;
$c('#jcp').onclick=()=>{CAL.m--;if(CAL.m<0){CAL.m=11;CAL.y--}calLoad()};
$c('#jcn').onclick=()=>{CAL.m++;if(CAL.m>11){CAL.m=0;CAL.y++}calLoad()};
$c('#jcg').onclick=e=>{const c=e.target.closest('.cc[data-k]');if(!c||c.classList.contains('fut'))return;CAL.sel=c.dataset.k;calRender()};
$c('#jcg').ondblclick=e=>{const c=e.target.closest('.cc[data-k]');if(!c||c.classList.contains('fut'))return;calClose();go(c.dataset.k)};
$('#jback').addEventListener('click',calClose);
addEventListener('keydown',e=>{if(e.key==='Escape'&&CAL.open)calClose()});
