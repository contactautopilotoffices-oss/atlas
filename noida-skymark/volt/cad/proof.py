import json,collections,csv
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from matplotlib.patches import Rectangle
d=json.load(open('flat.json'))['rec']; J=json.load(open('seats.json')); rows=J['rows']; R=J['rooms_in']
WORK_ROOMS=['Open workstations','Sales office','Control room / command centre','Calling room','Finance room','Staff room','Director cabin 01','Director cabin 02']
OPER=['Autopilot cabin','Reception']
def group(r):
    if r['room'] in OPER: return 'O'
    if r['kind'] in('task chair','director chair') and r['room'] in WORK_ROOMS: return 'W'
    if r['kind']=='meeting chair': return 'M'
    if r['room']=='Cafeteria': return 'C'
    return 'L'
NAMES={'W':'Work seats (desk + chair)','M':'Meeting room seats','C':'Cafeteria seats','L':'Lounge, collab and visitor seats','O':'Operator (Autopilot cabin, reception)'}
COL={'W':'#d6452b','M':'#2b62d6','C':'#1f9a55','L':'#d68a1f','O':'#8a8a8a'}
order={k:i for i,k in enumerate(list(R.keys()))}
for r in rows: r['grp']=group(r)
rows.sort(key=lambda r:('WMCLO'.index(r['grp']),order.get(r['room'],99),-round(r['y_in']/6),r['x_in']))
cnt=collections.Counter()
for r in rows: cnt[r['grp']]+=1; r['seat_id']=f"{r['grp']}{cnt[r['grp']]}"
with open('volt_seats.csv','w',newline='') as f:
    F=['seat_id','group','room','kind','at_desk','block','parent_block','x_in','y_in','instance']
    w=csv.writer(f); w.writerow(F)
    for r in rows: w.writerow([r['seat_id'],NAMES[r['grp']],r['room'],r['kind'],r['at_desk'],r['block'],r['parent_block'],r['x_in'],r['y_in'],r['handle']])
by=collections.defaultdict(collections.Counter)
for r in rows: by[r['grp']][r['room']]+=1
summary={NAMES[g]:{'total':sum(by[g].values()),'rooms':dict(by[g])} for g in 'WMCLO'}
json.dump(summary,open('summary.json','w'),indent=1); print(json.dumps(summary,indent=1))
# ---- figure
x0,x1,y0,y1=2996150,2997640,-3366330,-3365270
inb=lambda p: x0<p[0]<x1 and y0<p[1]<y1
WALL={'AR WALL','AR-WALL','WS-WALL-PRTN','WS-WALL','L-WALL','WS-GLAZ-GLAS','STR. GLAZING','AR-WINDOW','column','RCC COLUMN','AR-WINCILL'}
walls=[r['p'] for r in d if r['t']!='INS' and 'p' in r and isinstance(r['p'][0],list) and r['L'] in WALL and any(inb(p) for p in r['p'])]
furn=[r['p'] for r in d if r['t']!='INS' and 'p' in r and isinstance(r['p'][0],list) and r['L'] not in WALL and r['L']!='0' or (r['t']!='INS' and 'p' in r and isinstance(r['p'][0],list) and r['L']=='0' and r['ch'])]
furn=[p for p in furn if any(inb(q) for q in p)]
fig=plt.figure(figsize=(30,19.5),dpi=110); ax=fig.add_axes([0.01,0.02,0.72,0.92]); tx=fig.add_axes([0.74,0.02,0.25,0.92]); tx.axis('off')
ax.add_collection(LineCollection(furn,lw=0.35,color='#b9b4ad')); ax.add_collection(LineCollection(walls,lw=1.4,color='#222'))
for r in rows:
    c=COL[r['grp']]; ax.plot(r['x_in'],r['y_in'],'o',ms=13,color=c,alpha=.92,mec='white',mew=.8)
seen=collections.defaultdict(list)
for r in rows: seen[(r['x_in'],r['y_in'])].append(r['seat_id'])
for (x,y),ids in seen.items():
    lab=ids[0] if len(ids)==1 else ids[0]+'-'+ids[-1][1:]
    ax.text(x,y,lab,fontsize=5.2 if len(ids)==1 else 4.4,color='white',ha='center',va='center',weight='bold')
for k,(a,b,c,e) in R.items():
    n=collections.Counter(r['grp'] for r in rows if r['room']==k)
    ax.add_patch(Rectangle((a,b),c-a,e-b,fill=False,ls=':',lw=.6,ec='#777'))
    ax.text(a+3,e-4,k.upper(),fontsize=6.5,va='top',color='#333',weight='bold')
ax.set_xlim(x0,x1); ax.set_ylim(y0,y1); ax.set_aspect('equal'); ax.axis('off')
W=summary[NAMES['W']]
L=[("VOLT  |  FIRST FLOOR  |  SKYMARK F-1, NOIDA",16,'bold','#111'),("Seat count read from the drawing itself",11,'normal','#444'),
   ("20260915_SKY_MARK_NOIDA_1ST_VOLT_ENERGY_R16.dwg, furniture layout copy",8.5,'normal','#666'),("",6,'normal','k'),
   (f"{W['total']} work seats",30,'bold',COL['W']),("a desk and a task chair each, in Volt's own rooms",10,'normal','#444'),("",6,'normal','k')]
for k,v in sorted(W['rooms'].items(),key=lambda kv:-kv[1]): L.append((f"   {v:>3}   {k}",11,'normal','#222'))
L.append(("",8,'normal','k'))
for g in 'MCLO':
    s=summary[NAMES[g]]; L.append((f"{s['total']:>4}   {NAMES[g]}",12,'bold',COL[g]))
    import textwrap
    for ln in textwrap.wrap(", ".join(f"{k} {v}" for k,v in s['rooms'].items()),62): L.append(("      "+ln,8,'normal','#555'))
L+= [("",8,'normal','k'),(f"{len(rows)} seats of every kind on the plan",12,'bold','#111'),("",8,'normal','k'),
   ("How it was counted",11,'bold','#111'),
   ("Every chair in the drawing is a CAD block. Each block instance was",8.5,'normal','#333'),
   ("read with its position, exploded, and placed in a room box. Labels",8.5,'normal','#333'),
   ("in the drawing agree with the blocks: WORKSTATION 48 NOS, SALES",8.5,'normal','#333'),
   ("OFFICE 33 NOS, CALLING ROOM 09, FINANCE 7, STAFF 4, CONTROL ROOM",8.5,'normal','#333'),
   ("12 NOS (+1 at the room's door end), 18 SEATER CONFERENCE.",8.5,'normal','#333'),
   ("Seat IDs match volt_seats.csv (W = work, M = meeting, C = cafe,",8.5,'normal','#333'),
   ("L = lounge, O = operator). Autopilot cabin and reception are not",8.5,'normal','#333'),("counted as Volt's.",8.5,'normal','#333')]
y=0.99
for t,s,wt,c in L: tx.text(0,y,t,fontsize=s,weight=wt,color=c,va='top',family='DejaVu Sans Mono' if t.startswith('   ') and not t.startswith('      ') else 'DejaVu Sans'); y-=s/560+0.006
plt.savefig('volt_seat_plan.png',facecolor='white'); print('ok')
