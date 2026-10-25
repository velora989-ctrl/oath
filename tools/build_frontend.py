#!/usr/bin/env python3
"""Patch the exported Mira's Grove HTML so it talks to this backend.

Usage:  python3 tools/build_frontend.py "path/to/Mira's Grove.html"
Output: public/index.html

Re-run this whenever you re-export the design. Every edit is anchored on the
original code and the script stops loudly if an anchor is missing.
"""
import re, sys, pathlib

here = pathlib.Path(__file__).parent
src = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
out = pathlib.Path(here.parent / 'public' / 'index.html')

def sub1(pattern, repl, s, flags=0):
    new, n = re.subn(pattern, lambda m: repl(m) if callable(repl) else repl, s, count=0, flags=flags)
    if n != 1:
        sys.exit(f'Patch failed: expected 1 match, got {n} for {pattern[:70]!r}')
    return new

def lit1(old, new, s):
    if s.count(old) != 1:
        sys.exit(f'Patch failed: expected 1 occurrence, got {s.count(old)} of {old[:70]!r}')
    return s.replace(old, new)

s = src
# 1. "Edit Stats" button + panel removed; the button slot becomes "Log out"
s = lit1('<button id="eb">Edit Stats</button><div id="ed"></div>', '<button id="eb">Log out</button>', s)
s = sub1(r"\$\('#ed'\)\.innerHTML=[^\n]*\n", '', s)
s = sub1(r"function setS\(k,v\)\{[^\n]*\n", '', s)
s = sub1(r"function draw\(k\)\{[^\n]*\n",
         "function draw(k){const v=V[k];$('#v'+k).textContent='+'+v;{const b=$('#b'+k);b.style.width=(93*Math.min(v,24)/24)+'px';b.style.visibility=v?'visible':'hidden'}}\n", s)
s = sub1(r"\$\('#eb'\)\.onclick=[^\n]*\n", "$('#eb').onclick=()=>window.GroveLogout&&window.GroveLogout();\n", s)
s = lit1("const K=['int','end','str','arc','wis'],V={int:7,end:7,str:7,arc:7,wis:7};",
         "const K=['int','end','str','arc','wis'],V={int:0,end:0,str:0,arc:0,wis:0};", s)

# 2. characters: real player data replaces the hard-coded Mira / Pip
z = "v:{int:0,end:0,str:0,arc:0,wis:0}"
s = lit1("let CUR={n:'Mira',lv:6,t:'Wanderer'};", "let CUR={n:'',lv:1,t:'Seedling'};", s)
s = sub1(r"const CH=\[\{n:'Mira'.*?\}\}\],FACE=\[",
         "let CH=[{id:null,n:'',lv:1,t:'Seedling'," + z + "},{id:null,n:'',lv:1,t:'Seedling'," + z + "}],FACE=[", s)
s = lit1("else pg.style.display='flex'}", "else{pg.textContent='Hi, '+CUR.n;pg.style.display='flex'}}", s)

# 2b. Reminders / Achievements tabs show a static picture (public/ui/*.png) instead of the "Hi" page
s = lit1("else{pg.textContent='Hi, '+CUR.n;pg.style.display='flex'}}", "else if(k==='r'&&window.openBoard)window.openBoard(window.GroveWho&&window.GroveWho());else if(k==='r'||k==='a')showImg(k);else{pg.textContent='Hi, '+CUR.n;pg.style.display='flex'}}", s)
s = lit1("window.act=function(k){", 'const ip=document.createElement(\'div\');ip.id=\'imgpg\';ip.innerHTML=\'<img alt="">\';document.body.appendChild(ip);const closeImg=()=>{ip.style.display=\'none\'};ip.onclick=closeImg;addEventListener(\'keydown\',e=>{if(e.key===\'Escape\')closeImg()});const showImg=k=>{const m=ip.firstChild;m.src=k===\'r\'?\'ui/reminders.png\':\'ui/achievements.png\';m.alt=k===\'r\'?\'Reminders\':\'Achievements\';ip.style.display=\'flex\'};\n' + "window.act=function(k){", s)
s = lit1('</style></head>', '#imgpg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#0b0d12;z-index:100;cursor:pointer}#imgpg img{max-width:100vw;max-height:100vh;width:auto;height:auto;object-fit:contain;display:block;user-select:none;-webkit-user-drag:none}\n' + '</style></head>', s)

# 3. journal page: fake local state -> real data
s = sub1(r"const BASE=.*?noi:BASE\.noi\+nz\}\}\n",
         "const fresh=()=>({ent:[],g:{int:0,str:0,end:0,arc:0,wis:0},ratio:.5});\nlet S=fresh();\n"
         "function stats(){return{int:S.g.int,str:S.g.str,end:S.g.end,arc:S.g.arc,wis:S.g.wis,sig:S.ratio,noi:1-S.ratio}}\n",
         s, flags=re.S)
s = sub1(r"l\.innerHTML=S\.ent\.map\(x=>\{.*?\}\)\.join\(''\);", "l.innerHTML=S.ent.map(rowHTML).join('');", s)
s = sub1(r"\$\('#jtest'\)\.innerHTML=[^\n]*\n", '', s)
s = sub1(r"\$\('#jtest'\)\.onclick=[^\n]*\n", '', s)
s = sub1(r"\$\('#jsave'\)\.onclick=[^\n]*\n", '', s)
block = (here / 'journal_block.js').read_text(encoding='utf-8')
s = lit1("$('#jback').onclick=closeJ;\n})();", "$('#jback').onclick=closeJ;\n" + block + "\n})();", s)

# 3a. End Turn button -> full screen toggle (like F11)
s = lit1("else if(k==='e'){turn++;hist=[];TXA[2][0]='Turn  '+turn;RUNTX()}",
         "else if(k==='e'){const d=document,el=d.documentElement;if(d.fullscreenElement||d.webkitFullscreenElement){(d.exitFullscreen||d.webkitExitFullscreen).call(d)}else{const r=el.requestFullscreen||el.webkitRequestFullscreen;if(r)Promise.resolve(r.call(el)).catch(()=>window.groveToast&&window.groveToast('Your browser blocked full screen. Press F11 instead.'))}}", s)

# 3b. keep the player cards (top right) visible on the journal page so you can switch to another player's journal
s = lit1("((x<400&&y<290)||(x>1195&&y<145))", "((x<400&&y<290)||(x>1195&&y<560))", s)

# 4. auth panel, styles, api client, glue
s = lit1('</style></head>', (here / 'auth.css').read_text(encoding='utf-8') + '</style></head>', s)
tail = '</script></body></html>'
if not s.rstrip().endswith(tail):
    sys.exit('Patch failed: unexpected end of file')
i = s.rstrip().rfind(tail)
s = (s[:i] + '</script>\n' + (here / 'auth.html').read_text(encoding='utf-8')
     + '<script src="api.js"></script>\n<script>\n' + (here / 'glue.js').read_text(encoding='utf-8')
     + '</script></body></html>\n')

# 5. quote panel + fullscreen button (tools/frontend_patches.py)
sys.path.insert(0, str(here))
import frontend_patches
s = frontend_patches.apply(s)
import frontend_cards
s = frontend_cards.apply(s)

# 6. game feel: animations (public/fx.css) + synthesized sounds and particles (public/fx.js), loaded last
s = lit1('</style></head>', '</style>\n<link rel="stylesheet" href="fx.css">\n<link rel="stylesheet" href="board.css"></head>', s)
s = lit1('</script></body></html>', '</script>\n<script src="fx.js"></script>\n<script src="board.js"></script></body></html>', s)

# 7. start screen ("Press Any Button"): public/title.css, title.js, title.jpg
s = lit1('<head>', '<head>' + '<link rel="preload" as="image" href="title.jpg"><link rel="stylesheet" href="title.css">', s)
s = lit1('<body>', '<body>' + '<div id="title" role="button" aria-label="Oath - press any button to start"><div class="tgo"><div class="tzoom"><div class="tpar"><img class="tbg" src="title.jpg" alt="Oath" decoding="async" fetchpriority="high"><div class="tglow"></div><div class="tshine"></div></div></div></div><canvas></canvas><div class="tvig"></div><div class="tbot"><div class="tprompt"><span class="tload">Loading<i class="td"></i><i class="td"></i><i class="td"></i></span><span class="tpress">Press Any Button</span></div><div class="tbar"><i></i></div></div><div class="tflash"></div><div class="tblack"></div></div>\n<script src="title.js"></script>', s)

out.write_text(s, encoding='utf-8')
print(f'wrote {out} ({len(s)/1e6:.1f} MB)')
