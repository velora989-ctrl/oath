/* Bottom hotbar (Journal / Media Log / Canvas / Calendar / Bosses) + the Undo and End Turn buttons.
   The hotbar buttons just call the site's own openers through window.act():
     j = Journal, a = Media Log (the world map with the circular levels -> Creators Museum), r = Canvas (the board),
     u = Calendar, e = Bosses. */
(function(){
document.querySelectorAll('.hbi').forEach(b=>b.addEventListener('click',()=>{
  const k=b.dataset.k;
  if(window.act)window.act(k)}));
/* Undo: walks Mira back to her default tile [1,1] */
const un=document.querySelector('#undob');
if(un)un.addEventListener('click',()=>{
  const d=[1,1],c=cur.slice();hist.length=0;
  path=(c+''===d+'')?[d.slice()]:[c].concat(bfs(c,d))});
/* End Turn: does nothing */
const en=document.querySelector('#endb');
if(en)en.addEventListener('click',()=>{});
})();
