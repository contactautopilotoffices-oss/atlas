import json,collections
d=json.load(open('flat.json'))['rec']
B=(2996000,2997800,-3366400,-3365200)
ins={r['id']:r for r in d if r['t']=='INS'}
bb=collections.defaultdict(lambda:[1e18,1e18,-1e18,-1e18])
for r in d:
    if r['t']!='INS' and 'p' in r and isinstance(r['p'][0],list):
        for i in r['ch']:
            b=bb[i]
            for x,y in r['p']: b[0]=min(b[0],x);b[1]=min(b[1],y);b[2]=max(b[2],x);b[3]=max(b[3],y)
out=[]
for i,r in ins.items():
    if i not in bb: continue
    b=bb[i]; c=((b[0]+b[2])/2,(b[1]+b[3])/2)
    if not(B[0]<c[0]<B[1] and B[2]<c[1]<B[3]): continue
    par=ins[r['ch'][-1]]['name'] if r['ch'] else None
    out.append(dict(id=i,name=r['name'],L=r['L'],depth=r['depth'],parent=par,cx=c[0],cy=c[1],w=b[2]-b[0],h=b[3]-b[1],rot=r['rot']))
json.dump(out,open('inst.json','w'))
c=collections.Counter((o['name'],o['parent']) for o in out)
for k,v in c.most_common(60): print(v,k)
