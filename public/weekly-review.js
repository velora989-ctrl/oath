/* Weekly review reminder: shown from the Journal button every Sunday (and later that week) until "I did it" / "Ignore".
   Local only (localStorage, per player). */
(function(){
const pad=n=>String(n).padStart(2,'0'),ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
/* week key = local date of the most recent Sunday on or before the given date */
function weekKey(d){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-x.getDay());return ymd(x)}
/* pure decision: reviewDue(date, record) -> {show, record} */
function reviewDue(today,rec){const wk=weekKey(today);
 if(!rec||typeof rec!=='object'||typeof rec.week!=='string'||!['pending','done','ignored'].includes(rec.status))return{show:false,record:{week:wk,status:'ignored'}};
 if(rec.week!==wk)return{show:true,record:{week:wk,status:'pending'}};
 return{show:rec.status==='pending',record:rec}}
window.reviewDue=reviewDue;
const who=()=>{let t='';try{t=localStorage.getItem('grove_token')||''}catch(e){}if(!t)return'guest';try{const p=JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(p&&(p.id||p._id||p.sub))return String(p.id||p._id||p.sub)}catch(e){}return t.slice(-12)};
const key=()=>'grove_weeklyreview_'+who();
const load=()=>{try{const r=JSON.parse(localStorage.getItem(key())||'null');return r&&typeof r==='object'?r:null}catch(e){return null}};
const save=r=>{try{r?localStorage.setItem(key(),JSON.stringify(r)):localStorage.removeItem(key())}catch(e){}};
const now=()=>new Date();
const JP=document.getElementById('jp');if(!JP)return;
const au=n=>{try{window.GroveAU&&window.GroveAU[n]&&window.GroveAU[n]()}catch(e){}};
const rm=()=>{try{return matchMedia('(prefers-reduced-motion:reduce)').matches}catch(e){return false}};
let note=null,timers=[];
const later=(f,ms)=>{const t=setTimeout(()=>{timers=timers.filter(x=>x!==t);f()},ms);timers.push(t)};
function hide(){timers.forEach(clearTimeout);timers=[];if(note){note.remove();note=null}}
function show(today){hide();const sun=today.getDay()===0;
 const n=document.createElement('div');n.id='wrn';n.setAttribute('role','region');n.setAttribute('aria-label','Weekly review reminder');n.setAttribute('aria-live','polite');
 n.innerHTML='<svg class="wd" viewBox="0 0 42 44" aria-hidden="true"><rect x="4" y="8" width="26" height="32" rx="3" fill="#8a5a34" stroke="#20180d" stroke-width="1.5"/><rect x="9" y="8" width="21" height="32" rx="2" fill="#f7edd6" stroke="#20180d" stroke-width="1.2"/><path d="M13 17h13M13 23h13M13 29h9" stroke="#8a6a3c" stroke-width="1.4" stroke-linecap="round"/><path d="M30 34l8-17 3 1.5-8 17-4 1.6z" fill="#3f5a2e" stroke="#20180d" stroke-width="1.1" stroke-linejoin="round"/></svg>'
  +'<h4>'+(sun?'Sunday review':'Weekly review')+'</h4><p>'+(sun?'It’s review time. Open your notebook and write your weekly review.':'Your weekly review is still waiting. Open your notebook and write it.')+'</p>'
  +'<div class="wb"><button type="button" class="jnav wp">I did it</button><button type="button" class="jnav wq">Ignore</button></div>'
  +'<span class="wt" aria-hidden="true"><svg viewBox="0 0 34 26" width="34" height="26"><path d="M3 14l8 8L28 4"/></svg><i></i></span>';
 JP.appendChild(n);note=n;au('flip');requestAnimationFrame(()=>requestAnimationFrame(()=>{if(note===n)n.classList.add('on')}));
 const choose=st=>{const r=load()||{};const rec={week:weekKey(now()),status:st};save(rec);
  if(st==='done'){n.classList.add('ok');au('done');later(()=>{n.classList.remove('on');n.classList.add('off');later(hide,320)},rm()?200:650)}
  else{n.classList.remove('on');n.classList.add('fade');later(hide,380)}};
 n.querySelector('.wp').onclick=()=>choose('done');n.querySelector('.wq').onclick=()=>choose('ignored')}
/* single trigger: called whenever the Journal opens (Journal button, key J, bottom bar) */
function check(){const t=now(),r=reviewDue(t,load());save(r.record);r.show?show(t):hide();return r.show}
const oj=window.openJ;if(typeof oj==='function')window.openJ=function(){const v=oj.apply(this,arguments);try{check()}catch(e){}return v};
/* closing the journal / Escape / clicking elsewhere never counts as a choice: just remove the note */
new MutationObserver(()=>{if(JP.style.display==='none')hide()}).observe(JP,{attributes:true,attributeFilter:['style']});
/* a choice made in another tab hides the note here */
addEventListener('storage',e=>{if(e.key===key()&&note){const r=load();if(r&&r.week===weekKey(now())&&r.status!=='pending')hide()}});

})();
