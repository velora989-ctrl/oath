import cv2, numpy as np, json, time, sys
cv2.setNumThreads(4)
D='/home/claude/players/upscayl_png_digital-art-4x_3x/'
reg=json.load(open('/home/claude/test/reg.json')); mid=json.load(open('/home/claude/test/mid_M.json')); corr=json.load(open('/home/claude/test/corr.json'))
S=8.0; CW,CH=int(round(1920*S)),int(round(1069*S))
t0=time.time(); log=lambda *a: print('[%5.1fs]'%(time.time()-t0),*a,flush=True)
spec={k:(D+reg[k]['file'],np.array(reg[k]['M'])) for k in ['2','3','4','5','6','7','8']}; spec['mid']=(D+'bg_in_middle.png',np.array(mid))
layers={}
for k,(f,M) in spec.items():
    im=cv2.imread(f,cv2.IMREAD_COLOR)
    if im.shape[2]==4: im=im[:,:,:3]
    s=float(np.hypot(M[0,0],M[1,0])); fac=s*S
    interp=cv2.INTER_AREA if fac<1 else cv2.INTER_LANCZOS4
    out=cv2.resize(im,(int(round(im.shape[1]*fac)),int(round(im.shape[0]*fac))),interpolation=interp)
    cx,cy=corr.get(k,(0,0)); ox=int(round((M[0,2]+cx)*S)); oy=int(round((M[1,2]+cy)*S))
    layers[k]=dict(img=out,ox=ox,oy=oy); log(k,'prepared',out.shape,'at',ox,oy)
    del im
ov=cv2.imread(D+'final bg.png',cv2.IMREAD_COLOR)
canvas=np.lib.format.open_memmap('/home/claude/comp/canvas.npy',mode='w+',dtype=np.uint8,shape=(CH,CW,3))
TAU=14.0; BASE_Z=3.0; FEATH=140.0
detail_keys=['2','3','4','5','6','7','8']
def dist_map(L,ya,yb):
    h,w=L['img'].shape[:2]; r0=max(ya,L['oy']); r1=min(yb,L['oy']+h); c0=max(0,L['ox']); c1=min(CW,L['ox']+w)
    if r1<=r0 or c1<=c0: return None
    ys=np.arange(r0,r1); xs=np.arange(c0,c1)
    dy=np.minimum(ys-L['oy'],L['oy']+h-1-ys).astype(np.float32); dx=np.minimum(xs-L['ox'],L['ox']+w-1-xs).astype(np.float32)
    d=np.minimum(dy[:,None],dx[None,:]); return r0,r1,c0,c1,d
STRIP=256
for ya in range(0,CH,STRIP):
    yb=min(CH,ya+STRIP); rows=yb-ya
    # base: overview upscaled (cubic) + mild unsharp
    base=cv2.warpAffine(ov,np.array([[S,0,0],[0,S,-ya]],float),(CW,rows),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
    blur=cv2.GaussianBlur(base,(0,0),6); base=np.clip(base+0.7*(base-blur),0,255)
    zmax=np.full((rows,CW),BASE_Z,np.float32)
    # pass 1: find the max z among layers for a stable softmax
    dm={}
    for k in detail_keys:
        r=dist_map(layers[k],ya,yb)
        if r is None: continue
        r0,r1,c0,c1,d=r; dm[k]=r
        sl=zmax[r0-ya:r1-ya,c0:c1]; np.maximum(sl,d/TAU,out=sl)
    num=np.exp(BASE_Z-zmax)[:,:,None]*base; den=np.exp(BASE_Z-zmax)
    for k,(r0,r1,c0,c1,d) in dm.items():
        L=layers[k]; img=L['img'][r0-L['oy']:r1-L['oy'],c0-L['ox']:c1-L['ox']].astype(np.float32)
        w=np.exp(d/TAU-zmax[r0-ya:r1-ya,c0:c1])
        num[r0-ya:r1-ya,c0:c1]+=w[:,:,None]*img; den[r0-ya:r1-ya,c0:c1]+=w
    rest=num/den[:,:,None]
    canvas[ya:yb]=np.clip(rest+0.5,0,255).astype(np.uint8)
    if (ya//STRIP)%6==0: log('strip',ya,'/',CH)
canvas.flush(); log('pass 1 done (details + base)')
# ---- pass 2: the middle strip, wherever it is at least as sharp as what is underneath ----
L=layers['mid']; h,w=L['img'].shape[:2]; oy,ox=L['oy'],L['ox']
rest=np.array(canvas[oy:oy+h,ox:ox+w]).astype(np.float32); mid=L['img'].astype(np.float32)
def sharp(img):
    g=cv2.cvtColor(img.astype(np.uint8),cv2.COLOR_BGR2GRAY).astype(np.float32)
    return cv2.GaussianBlur(np.abs(cv2.Laplacian(cv2.GaussianBlur(g,(0,0),0.8),cv2.CV_32F,ksize=3)),(0,0),22)
sm,sr=sharp(mid),sharp(rest); ratio=sm/(sr+1e-3)
a_s=np.clip((ratio-0.75)/0.45,0,1); a_s=a_s*a_s*(3-2*a_s)
ys=np.arange(h); xs=np.arange(w); d=np.minimum(np.minimum(ys[:,None],h-1-ys[:,None]),np.minimum(xs[None,:],w-1-xs[None,:])).astype(np.float32)
a_e=np.clip(d/FEATH,0,1); a_e=a_e*a_e*(3-2*a_e)
a=(a_e*a_s)[:,:,None]; log('mid used on %.0f%% of its area'%(100*float((a_s>0.5).mean())))
canvas[oy:oy+h,ox:ox+w]=np.clip(rest*(1-a)+mid*a+0.5,0,255).astype(np.uint8)
canvas.flush(); log('composite done',canvas.shape)
cv2.imwrite('/home/claude/comp/preview.jpg',cv2.resize(np.asarray(canvas),(1920,1069),interpolation=cv2.INTER_AREA),[cv2.IMWRITE_JPEG_QUALITY,90])
log('preview written')

cv2.imwrite('/home/claude/comp/world.png',np.asarray(canvas),[cv2.IMWRITE_PNG_COMPRESSION,1]); log('png written')
