"""Five player cards in the right sidebar (build_frontend.py runs this after frontend_patches).

The design has two cards (slots 0 and 1). The glue (tools/glue.js) clones the second frame for slots 2-4 and creates all
the portrait icons; this file only adds what has to be baked into the design code: the numbers 3-5, the click areas and
(the 'keep visible while the journal is open' range is changed in build_frontend.py, step 3b).
"""
import sys


def lit1(old, new, s):
    if s.count(old) != 1:
        sys.exit(f'Patch failed: expected 1 occurrence, got {s.count(old)} of {old[:70]!r}')
    return s.replace(old, new)


def apply(s):
    s = lit1('["2", 1347, 1358, 254, 16],', '["2", 1347, 1358, 254, 16], ["3", 1347, 1358, 321, 16], ["4", 1347, 1358, 388, 16], ["5", 1347, 1358, 455, 16],', s)
    s = lit1("[1333,216,117,65,'t']]", "[1333,216,117,65,'t'],[1333,283,117,65,'c'],[1333,350,117,65,'d'],[1333,417,117,65,'f']]", s)
    s = lit1("{j:'Journal',r:'Reminders',a:'Achievements',u:'Undo',e:'Fullscreen',s:'Mira',t:'Pip'}[k]",
             "{j:'Journal',r:'Reminders',a:'Achievements',u:'Undo',e:'Fullscreen',s:'Player 1',t:'Player 2',c:'Player 3',d:'Player 4',f:'Player 5'}[k]", s)
    s = lit1("else if(k==='s'||k==='t')pick(k==='s'?0:1)", "else if('stcdf'.indexOf(k)>=0)pick('stcdf'.indexOf(k))", s)
    return s
