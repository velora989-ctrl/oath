/* ---- backend wiring (injected) ---- */
const $j=s=>JP.querySelector(s),ta=$('#jta'),pad2=n=>String(n).padStart(2,'0');
const SN={int:'INT',str:'STR',end:'END',arc:'ARC',wis:'WIS'};
const escA=t=>String(t==null?'':t).replace(/[<>&"']/g,'');
function dKey(){const i=document.querySelector('#jdate'),m=/^\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\s*$/.exec(i?i.value:DS)||/(\d{2})\/(\d{2})\/(\d{4})/.exec(DS);return m[3]+'-'+pad2(m[2])+'-'+pad2(m[1])}
/* three kinds of rows: signal (a task), necessity (sleep, no bar) and noise (everything else) */
function rowHTML(x){const sg=x.type==='signal',nc=x.type==='necessity',bk=sg?'signa':'noise',[bw,bh]=P[bk],pts=Object.keys(SN).filter(k=>x.points&&x.points[k]>0).map(k=>'+'+x.points[k]+' '+SN[k]).join(', ');
return`<div class="jr" title="${escA(pts||(sg?'signal':nc?'necessity':'noise'))}"><img src="${escA(x.emoji)}" alt="" style="left:5px;top:4.2px;width:34px;height:34px;object-fit:contain"><span class="jn">${escA(x.name)}</span>${nc?'':`<img src="${IM[bk]}" alt="" style="left:${1036-785-bw/2}px;top:${(42.4-bh)/2}px;width:${bw}px;height:${bh}px">`}<span class="jt">${escA(x.duration)}</span></div>`}

/* ---------- dates ---------- */
const WK=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const keyOf=(y,m,d)=>y+'-'+pad2(m+1)+'-'+pad2(d);            /* m is 0-based */
const key2in=k=>k.slice(8)+'/'+k.slice(5,7)+'/'+k.slice(0,4);   /* 2026-10-14 -> 14/10/2026 */
const todayKey=()=>{const t=new Date();return keyOf(t.getFullYear(),t.getMonth(),t.getDate())};
const longDate=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})};
const fmtMin=n=>{n=Math.round(n);const h=Math.floor(n/60),r=n%60;return h?(r?h+'h '+r+'m':h+'h'):r+'m'};
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
 S.ent=e?e.tasks:[];S.g=e?{...e.points}:{int:0,str:0,end:0,arc:0,wis:0};S.ratio=e?e.signal_to_noise_ratio:.5;
 const k=dKey();
 ta.readOnly=true;
 if(LOADING){ta.value='';ta.placeholder='Loading...'}
 else if(e){ta.value=e.rawText}
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
  h+='<div class="csn"><div class="cbar"><i style="width:'+s+'%"></i></div><div class="cbl"><span>Signal '+s+'%</span><span>Noise '+(100-s)+'%</span></div><div class="cmn">'+fmtMin(e.signalMinutes)+' signal / '+fmtMin(e.noiseMinutes)+' noise'+(e.necessityMinutes?' / '+fmtMin(e.necessityMinutes)+' sleep':'')+'</div></div>'+
   '<div class="cpt"><b>Points gained: +'+e.totalPoints+'</b>'+(pts?'<div>'+pts+'</div>':'')+'</div>'+
   '<div class="ctl">'+e.tasks.map(t=>{const sg=t.type==='signal',nc=t.type==='necessity',p=Object.keys(SN).filter(x=>t.points&&t.points[x]>0).map(x=>' +'+t.points[x]+' '+SN[x]).join('');
    return'<div class="ct '+(sg?'sg':nc?'nc':'nz')+'"><img src="'+escA(t.emoji)+'" alt=""><span class="cn1">'+escA(t.name)+'</span><span class="cd">'+escA(t.duration)+'</span><span class="cb">'+(sg?'Signal'+escA(p):nc?'Necessity':'Noise')+'</span></div>'}).join('')+'</div>'}
 if(k<=todayKey()&&(e||WHO.mine||WHO.id))h+='<button class="jnav" id="jco">'+(e?'Open this journal':(WHO.mine?'Write this day':'Open this day'))+'</button>';
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
