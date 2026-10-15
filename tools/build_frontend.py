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

# 3b. keep the player cards (top right) visible on the journal page so you can switch to another player's journal
s = lit1("((x<400&&y<290)||(x>1195&&y<145))", "((x<400&&y<290)||(x>1195&&y<290))", s)

# 4. auth panel, styles, api client, glue
s = lit1('</style></head>', (here / 'auth.css').read_text(encoding='utf-8') + '</style></head>', s)
tail = '</script></body></html>'
if not s.rstrip().endswith(tail):
    sys.exit('Patch failed: unexpected end of file')
i = s.rstrip().rfind(tail)
s = (s[:i] + '</script>\n' + (here / 'auth.html').read_text(encoding='utf-8')
     + '<script src="api.js"></script>\n<script>\n' + (here / 'glue.js').read_text(encoding='utf-8')
     + '</script></body></html>\n')

out.write_text(s, encoding='utf-8')
print(f'wrote {out} ({len(s)/1e6:.1f} MB)')
