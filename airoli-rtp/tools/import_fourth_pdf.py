"""Import the requested fourth-floor PDF sheet, retaining its original artwork.

Usage: python import_fourth_pdf.py source.pdf
Requires PyMuPDF. PDF coordinates are display coordinates, never metre measurements.
"""
import hashlib
import json
import re
import sys
from pathlib import Path
import pymupdf

source = Path(sys.argv[1])
root = Path(__file__).resolve().parents[1] / 'demo'
doc = pymupdf.open(source)
page = doc[0]
text = page.get_text()
assert 'RTP_4TH_FLOOR' in text and '11382' in text and '137 SEAT' in text
crop = pymupdf.Rect(397, 26, 1628, 1615)
spans = [s for b in page.get_text('dict')['blocks'] if b['type'] == 0
         for line in b['lines'] for s in line['spans'] if s['bbox'][0] < 1718]

def find(value):
    return [s for s in spans if s['text'].strip() == value]

def anchor(s):
    x0,y0,x1,y1 = s['bbox']
    return [round((x0+x1)/2-crop.x0, 2), round(crop.y0-(y0+y1)/2, 2)]

def item(s, name, group, seats=None, color='#3b7dd8', kind='room', **extra):
    return dict(id=f'pdf-1-{round(s["bbox"][0])}-{round(s["bbox"][1])}', name=name,
                group=group, kind=kind, color=color, label=anchor(s), seats=seats,
                seat_basis='Seats marked (PDF)', pdf_label=s['text'].strip(),
                source_page=1, source_bbox=[round(v,2) for v in s['bbox']],
                d=None, dims_m=None, area_m2=None, area_sqft=None,
                area_basis='Room area not dimensioned in supplied PDF', **extra)

zones = []
for label, name, seats, required, desk in [
    ('NEW RAMP','New Ramp',137,260,'3′ × 2′'),
    ('CORPORATE','Corporate',28,30,'3′6″ × 2′')]:
    zones.append(item(find(label)[0],name,name,seats,'#2e9d94',kind='process',
                      sheet_required=required,sheet_achieved=seats,desk=desk))
training = [s for s in spans if re.fullmatch(r'(20|17)\+1 - \d\d',s['text'].strip())]
assert len(training) == 8
for s in training:
    trainees, number = map(int,re.fullmatch(r'(20|17)\+1 - (\d\d)',s['text'].strip()).groups())
    name=f'Training room {number:02}'
    note=f'{trainees} trainees + 1 trainer, as labelled in the PDF.'
    if number == 7:
        name += ' · upper' if s['bbox'][1] < 800 else ' · lower'
        note += ' The source repeats room number 07; both labels are retained.'
    zones.append(item(s,name,'Training room',trainees+1,note=note))
for n,s in enumerate(sorted(find('4 SEATER')+find('04 SEATER'),key=lambda s:(s['bbox'][1],s['bbox'][0])),1):
    zones.append(item(s,f'4-seat meeting {n:02}','Meeting room',4,'#8e6fd1'))
zones.append(item(find('10 SEATER')[0],'Conference room','Conference room',10,'#8e6fd1',
                  brief_capacity='12 people',brief_capacity_count=12,
                  note='The drawing marks 10 seats; the schedule lists a 12-person conference room (2 required, 1 achieved).'))
for s in [s for s in spans if re.fullmatch(r'CABIN_\d\d',s['text'].strip())]:
    number=int(s['text'].strip()[-2:])
    name=f'Corporate cabin {number:02}' if s['bbox'][1]>750 else 'Cabin 01'
    zones.append(item(s,name,'Cabin',color='#587dbe'))
for label,name,group,color in [('ADMIN ROOM','Admin room','Admin room','#e8c13a'),
    ('HR ROOM','HR room','HR room','#5aa64a'),('IT ROOM','IT room & storage','IT room','#e2753e'),
    ('RECEPTION','Reception & waiting','Reception & waiting','#2fb4d6')]:
    zones.append(item(find(label)[0],name,group,color=color))
for n,s in enumerate(sorted(find('INTERVIEW'),key=lambda s:s['bbox'][0],reverse=True),1):
    zones.append(item(s,f'Interview room {n:02}','Interview room',color='#2e9ba6'))
assert len(zones)==27 and len({z['id'] for z in zones})==27
assert sum(z['seats'] or 0 for z in zones)==360
others=[]
for label,name,kind in [('SERVER ROOM','Server room','service'),('STORE','Store','service'),
    ('STORAGE','Storage','service'),('LOCKER','Lockers','service'),('LOCKERS','Lockers','service'),
    ('HIS','Gents washroom','wc'),('HER','Ladies washroom','wc'),('LOBBY','Lobby','core'),
    ('PASSAGE WIDE 4\'6"','Passage · 4′6″','core'),("PASSAGE WIDE 5'",'Passage · 5′','core')]:
    for n,s in enumerate(find(label),1):
        others.append(item(s,name+(f' {n}' if len(find(label))>1 else ''),name,color='#8c8680',kind=kind,seats_applicable=False))

# Export original vectors, text outlines and embedded images, cropped to sheet 1's
# floor plan. No traced/reconstructed walls and no geometry from another revision.
page.set_cropbox(crop)
asset=root/'data/rtp4-source.svg'
asset.write_text(page.get_svg_image(text_as_path=True))
brief={'source':{'file':source.name,'page':3},
       'totals':{'required':340,'achieved':165,'unit':'workstations'},
       'processes':[{'name':'Corporate','required':30,'achieved':28},
                    {'name':'Other','required':50,'achieved':0},
                    {'name':'New Ramp','required':260,'achieved':137}],
       'scope_note':'Fourth-floor process totals only. Shared-floor room rows and sixth-floor figures are not reassigned. The training schedule is labelled 3rd floor in the source; the fourth-floor drawing itself shows eight training rooms.'}
result={'id':'rtp4-suite','level':4,'title':'4th floor · proposed layout',
        'bounds':[0,-crop.height,crop.width,0],'plate':'','plate_sqft':11382,
        'cad':dict.fromkeys(['walls','glass','doors','furn','hatch'],''),
        'source_plan':{'url':'data/rtp4-source.svg','width':crop.width,'height':crop.height},
        'marker_radius':12,'zones':zones,'others':others,
        'totals':{'work_seats':165,'all_seats':None,'marked_seats':360},'brief':brief,
        'source_note':'20 Oct 2026 PDF · 137 New Ramp + 28 Corporate workstations. Sheet area: 11,382 sq ft. Room areas are not dimensioned; unmarked chair counts are not assumed.',
        'source':{'file':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
                  'page':1,'revision':'R4','date':'2026-10-20','coordinate_units':'PDF points, display only',
                  'crop_points':list(crop),'reported_area_sqft':11382,
                  'room_areas_verified':False}}
(root/'data/plan_rtp4-suite.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
print(json.dumps({'primary_spaces':len(zones),'supporting_spaces':len(others),'workstations':165,
                  'training_rooms':len(training),'svg_bytes':asset.stat().st_size}))
