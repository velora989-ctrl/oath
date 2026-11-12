import cv2, numpy as np, json, sys
cv2.setNumThreads(4)
D='/home/claude/players/upscayl_png_digital-art-4x_3x/'
ov=cv2.imread(D+'final bg.png',cv2.IMREAD_COLOR); OH,OW=ov.shape[:2]; print('overview',OW,OH)
sift=cv2.SIFT_create(nfeatures=6000)
og=cv2.cvtColor(ov,cv2.COLOR_BGR2GRAY); okp,ods=sift.detectAndCompute(og,None)
res={}
files={'2':'2.png','3':'3.png','4':'4.png','5':'5.png','6':'6.png','7':'7.png','8':'8.png','mid':'bg_in_middle.png'}
for key,f in files.items():
    im=cv2.imread(D+f,cv2.IMREAD_COLOR); h,w=im.shape[:2]
    f_=1920/ w if key!='mid' else 1920/w*2   # shrink to ~1920 wide (mid strip: keep a bit bigger)
    sm=cv2.resize(im,None,fx=f_,fy=f_,interpolation=cv2.INTER_AREA)
    g=cv2.cvtColor(sm,cv2.COLOR_BGR2GRAY); kp,ds=sift.detectAndCompute(g,None)
    m=cv2.BFMatcher().knnMatch(ds,ods,k=2); good=[a for a,b in m if a.distance<0.75*b.distance]
    if len(good)<8: print(key,'too few matches',len(good)); continue
    src=np.float32([kp[g_.queryIdx].pt for g_ in good])/f_   # in original detail pixel coords
    dst=np.float32([okp[g_.trainIdx].pt for g_ in good])
    M,inl=cv2.estimateAffinePartial2D(src,dst,method=cv2.RANSAC,ransacReprojThreshold=6.0,maxIters=5000,confidence=0.995)
    n=int(inl.sum()) if inl is not None else 0
    s=float(np.hypot(M[0,0],M[1,0])) if M is not None else 0
    ang=float(np.degrees(np.arctan2(M[1,0],M[0,0]))) if M is not None else 0
    corners=np.float32([[0,0],[w,0],[w,h],[0,h]])
    c=(M[:,:2]@corners.T).T+M[:,2] if M is not None else None
    print(f'{key}: size {w}x{h} matches {len(good)} inliers {n} scale(overview px per detail px)={s:.4f} -> detail px per overview px={1/s if s else 0:.2f} rot={ang:.2f}deg')
    if c is not None: print('   covers overview box x[%.0f..%.0f] y[%.0f..%.0f]'%(c[:,0].min(),c[:,0].max(),c[:,1].min(),c[:,1].max()))
    res[key]={'M':M.tolist() if M is not None else None,'inliers':n,'w':w,'h':h,'file':f}
json.dump(res,open('/home/claude/test/reg.json','w'))
