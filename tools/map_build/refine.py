import cv2, numpy as np, json, itertools
D='/home/claude/players/upscayl_png_digital-art-4x_3x/'
reg=json.load(open('/home/claude/test/reg.json')); mid=json.load(open('/home/claude/test/mid_M.json'))
S=3.0; CW,CH=int(1920*S),int(1069*S)
L={k:(D+reg[k]['file'],np.array(reg[k]['M'])) for k in ['2','3','4','5','6','7','8']}; L['mid']=(D+'bg_in_middle.png',np.array(mid))
def warp(f,M):
    im=cv2.imread(f,cv2.IMREAD_COLOR); 
    # downscale first with INTER_AREA to avoid aliasing, then place
    sc=np.hypot(M[0,0],M[1,0])*S
    sm=cv2.resize(im,None,fx=sc,fy=sc,interpolation=cv2.INTER_AREA)
    A=np.array([[1,0,M[0,2]*S],[0,1,M[1,2]*S]],float)
    w=cv2.warpAffine(sm,A,(CW,CH),flags=cv2.INTER_LINEAR); m=cv2.warpAffine(np.full(sm.shape[:2],255,np.uint8),A,(CW,CH),flags=cv2.INTER_NEAREST)>0
    return cv2.GaussianBlur(cv2.cvtColor(w,cv2.COLOR_BGR2GRAY),(0,0),0.8),m
W={k:warp(*v) for k,v in L.items()}
names=list(W); idx={k:i for i,k in enumerate(names)}
rows=[];rhs=[];wts=[]
def shifts():
    out={}
    for a,b in itertools.combinations(names,2):
        o=W[a][1]&W[b][1]; ys,xs=np.where(o)
        if len(ys)<150000: continue
        y0,y1,x0,x1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
        A=W[a][0][y0:y1,x0:x1].astype(np.float32); B=W[b][0][y0:y1,x0:x1].astype(np.float32)
        win=cv2.createHanningWindow((A.shape[1],A.shape[0]),cv2.CV_32F); (dx,dy),r=cv2.phaseCorrelate(A,B,win)
        out[(a,b)]=(dx,dy,r,len(ys))
    return out
sh=shifts()
for (a,b),(dx,dy,r,n) in sh.items(): print(f'{a:>3}-{b:>3} dx={dx:+.2f} dy={dy:+.2f} resp={r:.2f} n={n//1000}k')
# least squares: e_b - e_a = s_ab (placement error of each layer), plus weak anchor e_k ~ 0 so the whole frame stays tied to the overview
n=len(names); A_=[];B_=[]
for (a,b),(dx,dy,r,cnt) in sh.items():
    if r<0.3: continue
    wgt=min(1,cnt/600000)
    for c,v in ((0,dx),(1,dy)):
        row=np.zeros(n); row[idx[b]]=1; row[idx[a]]=-1; A_.append((row*wgt,c)); B_.append(v*wgt)
for k in names:
    for c in (0,1):
        row=np.zeros(n); row[idx[k]]=1; A_.append((row*0.15,c)); B_.append(0)
E=np.zeros((n,2))
for c in (0,1):
    Ac=np.array([r for r,cc in A_ if cc==c]); Bc=np.array([b for (r,cc),b in zip(A_,B_) if cc==c]); E[:,c]=np.linalg.lstsq(Ac,Bc,rcond=None)[0]
corr={k:(-E[idx[k],0]/S,-E[idx[k],1]/S) for k in names}      # overview px to ADD to each layer's tx,ty
for k,v in corr.items(): print(k,'correction (overview px): dx=%+.3f dy=%+.3f'%v)
json.dump(corr,open('/home/claude/test/corr.json','w'))
