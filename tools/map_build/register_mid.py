import cv2, numpy as np, json
D='/home/claude/players/upscayl_png_digital-art-4x_3x/'
ov=cv2.imread(D+'final bg.png',cv2.IMREAD_COLOR); og=cv2.cvtColor(ov,cv2.COLOR_BGR2GRAY)
sift=cv2.SIFT_create(nfeatures=8000); okp,ods=sift.detectAndCompute(og,None)
mid=cv2.imread(D+'bg_in_middle.png',cv2.IMREAD_COLOR); H,W=mid.shape[:2]
out={}
for name,x0,x1 in [('midL',0,5760),('midR',5760,11520),('midC',2880,8640)]:
    part=mid[:,x0:x1]
    for fs in (1/3,1/4,1/6):
        sm=cv2.resize(part,None,fx=fs,fy=fs,interpolation=cv2.INTER_AREA); g=cv2.cvtColor(sm,cv2.COLOR_BGR2GRAY)
        kp,ds=sift.detectAndCompute(g,None); m=cv2.BFMatcher().knnMatch(ds,ods,k=2); good=[a for a,b in m if a.distance<0.8*b.distance]
        if len(good)<8: print(name,fs,'few',len(good)); continue
        src=np.float32([kp[q.queryIdx].pt for q in good])/fs; dst=np.float32([okp[q.trainIdx].pt for q in good])
        M,inl=cv2.estimateAffinePartial2D(src,dst,method=cv2.RANSAC,ransacReprojThreshold=8.0,maxIters=8000,confidence=0.995)
        n=int(inl.sum()) if inl is not None else 0; s=float(np.hypot(M[0,0],M[1,0])) if M is not None else 0
        c=(M[:,:2]@np.float32([[0,0],[5760,0],[5760,3240],[0,3240]]).T).T+M[:,2] if M is not None else None
        print(name,'fs=%.3f'%fs,'matches',len(good),'inliers',n,'scale %.4f (1/s=%.2f)'%(s,1/s if s else 0), 'box x[%.0f..%.0f] y[%.0f..%.0f]'%(c[:,0].min()+0,c[:,0].max(),c[:,1].min(),c[:,1].max()) if c is not None else '')
        if n>=25: out[name]={'M':M.tolist(),'inliers':n,'x0':x0,'x1':x1}; break
json.dump(out,open('/home/claude/test/reg_mid.json','w'))
