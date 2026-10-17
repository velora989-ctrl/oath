"""Design-level frontend patches applied by build_frontend.py AFTER the earlier patches.

1. "End Turn" button -> Fullscreen button (YouTube-style four-corner icon, real fullscreen toggle).
2. A fullscreen button on the login screen too, so fullscreen works before logging in.
(The Victory Conditions panel is the original design again.)

Every edit is anchored; the script stops loudly if the design export changed too much.
"""
import sys


def lit1(old, new, s):
    if s.count(old) != 1:
        sys.exit(f'Patch failed: expected 1 occurrence, got {s.count(old)} of {old[:70]!r}')
    return s.replace(old, new)


CSS = """
/* fullscreen button icon */
#fsi{position:absolute;left:1348px;top:768px;width:107px;height:47px;display:flex;align-items:center;justify-content:center;pointer-events:none}
#fsi svg{width:27px;height:27px;display:block;fill:none;stroke:#20180d;stroke-width:2.6;stroke-linecap:square;stroke-linejoin:miter}
"""

JS = r"""/* fullscreen button (stage + login screen) */
(function(){const st=document.querySelector('#stage');
const ICON={enter:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',exit:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M4 15h5v5M20 15h-5v5"/></svg>'};
const fi=document.createElement('div');fi.id='fsi';st.appendChild(fi);
const btn=document.querySelector('.hb[aria-label="Fullscreen"]')||document.querySelector('.hb[aria-label="Exit fullscreen"]');
/* the login-screen button (#afs) is created later, so it is found at sync time and clicks are delegated */
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('#afs'))window.groveFS()});
const isFS=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
function sync(){const on=isFS();fi.innerHTML=on?ICON.exit:ICON.enter;const ab=document.querySelector('#afs');if(ab){ab.innerHTML=on?ICON.exit:ICON.enter;ab.title=on?'Exit fullscreen':'Fullscreen';ab.setAttribute('aria-label',ab.title)}if(btn){const t=on?'Exit fullscreen':'Fullscreen';btn.title=t;btn.setAttribute('aria-label',t);btn.setAttribute('aria-pressed',on?'true':'false')}}
window.groveFS=function(){const d=document,el=d.documentElement;
 if(isFS()){const x=d.exitFullscreen||d.webkitExitFullscreen;if(x)Promise.resolve(x.call(d)).catch(()=>{})}
 else{const r=el.requestFullscreen||el.webkitRequestFullscreen;
  if(!r){window.groveToast&&window.groveToast("Fullscreen isn't supported in this browser.");return}
  Promise.resolve(r.call(el)).catch(()=>window.groveToast&&window.groveToast('Your browser blocked fullscreen. Press F11 instead.'))}};
/* keeps the icon right when fullscreen is left with Esc or the browser's own controls */
['fullscreenchange','webkitfullscreenchange'].forEach(e=>document.addEventListener(e,sync));
sync()})();
"""


def apply(s):
    # 1. the "End Turn" label leaves the text-overlay list (the button frame itself is part of the design)
    s = lit1(', ["End Turn", 1368, 1428, 796, 10]],cx=', '],cx=', s)

    # 2. fullscreen: button label, click handler
    s = lit1("e:'End Turn'", "e:'Fullscreen'", s)
    start = s.index("else if(k==='e'){const d=document,el=d.documentElement;")
    end = s.index("else if(k==='s'||k==='t')", start)
    s = s[:start] + "else if(k==='e'){window.groveFS()}" + s[end:]

    # 3. styles + the new elements, placed right before the journal page code
    s = lit1('</style></head>', CSS + '</style></head>', s)
    js = JS
    s = lit1('/* journal page */\n(function(){\nconst IM=', js + '/* journal page */\n(function(){\nconst IM=', s)
    return s
