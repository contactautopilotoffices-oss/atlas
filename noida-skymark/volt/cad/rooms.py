import json,collections,csv
I=json.load(open('inst.json'))
X=lambda px:2996000+(px-18)*1.0746; Y=lambda py:-3365200-(py-16)*1.0757
PX={ # room: (px0,py0,px1,py1) read off seatmap.png; converted to drawing inches below
 'Cafeteria':(176,115,336,292),'Phone booths PH-05 to 07':(336,115,487,160),'Collab area 02':(336,160,487,255),
 '18 seater conference room':(487,115,808,242),'Staff room':(808,115,940,217),'Finance room':(940,115,1123,217),
 '06 seater meeting room':(1123,115,1255,217),'Lounge area (north)':(1255,115,1388,262),'Director cabin 01':(1388,115,1490,262),
 '04 seater meeting room 03':(1085,262,1210,364),'Lounge area (south)':(1210,262,1342,364),'Director cabin 02':(1342,262,1490,364),
 'Control room / command centre':(176,292,357,600),'Open workstations':(357,292,1003,553),
 'Sales office':(176,600,578,780),'Calling room':(578,600,683,780),'Collab area 01':(820,600,978,795),
 '04 seater meeting room 01':(978,600,1085,700),'Phone booths PH-01 to 04':(885,740,1090,790),
 'Atrium-side lounge':(1210,364,1490,402),'Reception':(1075,795,1305,960),'Autopilot cabin':(1305,795,1410,945),'06 seater meeting room (east)':(1410,795,1525,945)}
R={k:(X(a),Y(d),X(c),Y(b)) for k,(a,b,c,d) in PX.items()}
KIND={'A$C136922d8':'task chair','A$Cd2419d53':'meeting chair','A$Caa80c39f':'cafe chair','A$C445ca927':'cafe stool',
 'A$Cc5b0ed80':'visitor chair','A$Cee30255b':'director chair','Staff Chair - Staff Chair_1-171-Level 1':'staff chair',
 'A$Cd18c31fc':'lounge armchair','*U52':'lounge tub chair','*U53':'lounge tub chair','*U54':'lounge tub chair','*U55':'2-seat sofa',
 'A$C897f58da':'3-seat sofa','A$C9b980f9b':'lounge chair','*U22':'lounge chair'}
PLACES={'2-seat sofa':2,'3-seat sofa':3}
DESK={'A$C779abbf3':"4'x2' workstation",'WS-3\'X2\'':"3'x2' workstation",'A$C62789d74':"3'x2' workstation"}
def room(o):
    for k,(a,b,c,d) in R.items():
        if a<=o['cx']<=c and b<=o['cy']<=d: return k
    return 'UNASSIGNED'
rows=[]; n=0
for o in sorted(I,key=lambda o:(-o['cy'],o['cx'])):
    k=KIND.get(o['name'])
    if not k: continue
    for s in range(PLACES.get(k,1)):
        n+=1; rows.append(dict(seat=n,room=room(o),kind=k,at_desk=DESK.get(o['parent'],'') if k=='task chair' else '',block=o['name'],parent_block=o['parent'] or '',x_in=round(o['cx'],1),y_in=round(o['cy'],1),handle=o['id']))
with open('seats.csv','w',newline='') as f: w=csv.DictWriter(f,fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
json.dump({'rooms_in':R,'rows':rows},open('seats.json','w'))
t=collections.defaultdict(collections.Counter)
for r in rows: t[r['room']][r['kind']+(' @'+r['at_desk'] if r['at_desk'] else '')]+=1
for k in PX.keys()|{'UNASSIGNED'}:
    if t[k]: print(k, sum(t[k].values()), dict(t[k]))
print('TOTAL',len(rows)); print(collections.Counter(r['kind'] for r in rows))
desk=[r for r in rows if r['kind']=='task chair']; print('task chairs',len(desk), collections.Counter(r['at_desk'] or 'no desk in block' for r in desk))
