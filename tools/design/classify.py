#!/usr/bin/env python3
"""Merge explicit source evidence and visual research into one record per original image."""
import argparse,json,re,collections
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--workspace',required=True);a=p.parse_args();root=Path(a.workspace)
m=json.loads((root/'manifest.json').read_text());obs={o['image_id']:o for o in json.loads(Path(__file__).with_name('classification-observations.json').read_text())}
taxonomy={'meeting_room':'Meeting room','boardroom':'Boardroom','workstations':'Workstations','cabin':'Private cabin','reception':'Reception','training_room':'Training room','cafeteria':'Cafeteria','lounge':'Breakout / lounge','wellness':'Wellness room','lactation':'Lactation room','lockers':'Locker room','washroom':'Washroom'}
rows=[];counts=collections.Counter();support=collections.Counter();sources={s['id']:s for s in m['sources']};seeds={r['id']:r for r in json.loads(Path(__file__).with_name('reviewed-index.json').read_text())['references']};out=root/'records';out.mkdir(exist_ok=True)
for image in m['images']:
 o=obs.get(image['id'])
 if not o or o.get('image_sha256')!=image['image_sha256']:
  o={'visual_category':'unknown','visible_description':'Awaiting visual/source classification for this source version.','palette':{'primary':[],'secondary':[],'accent':[]},'materials_textures':[],'furniture':[],'lighting':[],'visual_confidence':'unknown','unknowns':['visual classification','room function','reuse review']}
 source=sources[image['source_id']];caption=' | '.join(' | '.join(x.get('embedded_text',[])) for x in image['occurrences']);category=o['visual_category'];room=taxonomy.get(category);is_room=bool(room)
 if category=='meeting_room' and 'INTERVIEW ROOM' in caption.upper():room='Interview room'
 if category=='lounge':
  if 'FOCUS' in caption.upper() and 'POD' in caption.upper():room='Focus / breakout pod'
  elif 'COLLABORATION' in caption.upper():room='Collaboration zone'
  elif 'OUTDOOR LOUNGE' in caption.upper():room='Outdoor lounge'
 counts[room or category]+=1
 r={**image,'source_path':source['path'],'source_context':{'scope':'proposal/deck association; not verification of depicted built property'},'classification':{'category':room or category,'visual_category':category,'asset_kind':'room_visualization' if is_room else 'unresolved_original' if category=='unknown' else 'non_room_asset','basis':'visual review, with source-caption evidence where available','confidence':o['visual_confidence'],'room_reference_eligible':is_room},'visible_description':o['visible_description']}
 if 'Foundever' in source['path']:client,project,city='Foundever','Foundever Indore proposal','Indore';r['source_context'].update({'property_label':'Landmark by Satguru','property_evidence':'Site-study section in supplied deck; depicted room property remains unverified','city_evidence':'Deck cover embedded text LOCATION -Indore'})
 elif 'ALTRUIST' in source['path']:client,project,city='Altruist','Altruist design proposal',None
 elif 'Safegold' in source['path']:client,project,city='Safegold','Safegold office design proposal',None
 elif 'Lexvia' in source['path']:client,project,city='Lexvia.ai','Lexvia.ai supplied image collection',None
 elif 'BFL_DESIGN' in source['path']:client,project,city='Basilic Fly','Basilic Fly Whitefield proposal','Bangalore'
 elif '3D Renders - Flipkart' in source['path']:client,project,city='Flipkart','Flipkart supplied reference render deck',None
 else:client,project,city=None,None,None
 r['source_context'].update({'client':client,'project':project,'city':city,'identity_basis':'source filename/deck labels; Lexvia signage also visually observed where legible'})
 tokens={'Meeting room':['MEETING ROOM'],'Boardroom':['BOARDROOM','CONFERENCE ROOM'],'Workstations':['WORKSTATION','OPEN AREA'],'Private cabin':['PRIVATE CABIN'],'Reception':['RECEPTION'],'Training room':['TRAINING ROOM'],'Cafeteria':['CAFETERIA'],'Wellness room':['WELLNESS'],'Lactation room':['LACTATION'],'Locker room':['LOCKER'],'Washroom':['WASHROOM'],'Interview room':['INTERVIEW ROOM'],'Focus / breakout pod':['FOCUS POD','FOCUS & BREAKOUT'],'Collaboration zone':['COLLABORATION'],'Outdoor lounge':['OUTDOOR LOUNGE']}
 declared=bool(room and any(token in caption.upper() for token in tokens.get(room,[])))
 r['facts']={'project':project,'client':client,'property':None,'city':city,'room_type':room if declared else None}
 r['facts_evidence']={'project':'source container context, not as-built status','client':'source filename/deck identity','property':'unknown','city':'source deck cover context' if city else 'unknown','room_type':'explicit room slide title plus visual check' if declared else 'visual interpretation only; function requires confirmation' if room else 'not applicable or unresolved'}
 r['interpretations']={'design_language':['contemporary office'] if is_room else [],'visual_room_type':room,'palette':o['palette'],'materials_textures':o['materials_textures'],'furniture':o['furniture'],'lighting':o['lighting'],'visible_description':o['visible_description']}
 r['support_space_details']={}
 description=o['visible_description'].lower()
 if category=='reception':
  r['support_space_details']['reception']={'confidence':'high','evidence':'Visible reception counter; source heading where supplied'};support['reception']+=1
  if any(word in description for word in ['sofa','lounge seating','seating groups']):r['support_space_details']['waiting_area']={'confidence':'medium','evidence':'Visible seating adjacent to counter; formal waiting function not confirmed'};support['waiting_area_visible_or_likely']+=1
  if 'lobby' in description:r['support_space_details']['lobby_context']={'confidence':'medium','evidence':'Visual reviewer describes a reception/lobby setting; standalone lobby function unconfirmed'};support['lobby_context_inferred']+=1
  if 'entry/' in description or 'entry ' in description:r['support_space_details']['entrance_threshold']={'confidence':'low','evidence':'Visible glazed entry/partition; not confirmed as primary building entrance'};support['possible_entrance_threshold']+=1
 if room in ['Meeting room','Interview room','Boardroom','Training room']:support[room]+=1
 r['confidence']={'visual_observations':o['visual_confidence'],'source_identity':'source-container context only','room_function':'source-caption supported' if declared else 'visually interpreted, not source-confirmed' if room else 'not applicable or unresolved'}
 r['unknowns']=list(dict.fromkeys(['depicted_property','verified_dimensions','material_grades','cost','design_intent','deliverability','built_status']+(['city'] if city is None else [])+(['client','project'] if client is None else [])+o['unknowns']))
 # Source-supported presentation/view grouping is never a physical room identifier.
 r['source_views']=[]
 slide_lookup={slide['member']:slide for slide in m['slides'] if slide['source_id']==image['source_id']}
 for occurrence in image['occurrences']:
  slide=slide_lookup.get(occurrence['slide_member'],{});text=' | '.join(slide.get('text',[]));option=re.search(r'OPTION\s*(?:NO[. -]*|NUMBER\s*)?(\d+)',text,re.I);view=re.search(r'VIEW\s*(?:NO[. -]*)?(\d+)',text,re.I)
  r['source_views'].append({'member':occurrence['slide_member'],'page_number':slide.get('page_number'),'source_option':option.group(1) if option else None,'source_view':view.group(1) if view else None,'speaker_notes':slide.get('speaker_notes',[]),'identity_scope':'source presentation option/view; not a confirmed physical room'})
 r['presentation_role']='room_reference' if is_room else 'source_asset'
 if 'Safegold' in source['path'] and image['source_member'] in ['ppt/media/image3.png','ppt/media/image5.png','ppt/media/image7.png','ppt/media/image9.png','ppt/media/image11.png','ppt/media/image14.png']:
  r['presentation_role']='softened_slide_background';r['eligibility_reason']='Source PPTX uses a softened full-slide background beside a sharp foreground image. Retained as source evidence, not a separate selectable design.'
 if source['path'].endswith('.pdf') and '3D Renders - Flipkart' in source['path'] and any(oc.get('page_number') in [1,16] for oc in image['occurrences']) and is_room:
  r['presentation_role']='cover_or_contact_illustration';r['eligibility_reason']='A cover/contact-page illustration is retained, but not offered as a standalone meeting design.'
 if 'ALTRUIST' in source['path'] and image['source_member']=='ppt/media/image3.jpeg':r['presentation_role']='softened_slide_background';r['eligibility_reason']='Blurred cover/background, not a selectable standalone design.'
 r['gallery_eligible']=is_room and r['presentation_role']=='room_reference'
 r['review_status']='reviewed' if r['gallery_eligible'] else 'pending'
 r['review']={'reviewed_by':'assistant-visual-source-research','reviewed_at':'2026-11-23','scope':'Visual/source classification and tentative appearance description only. Human approval and designer validation pending.','evidence':[image['source_member']]+[x['slide_member'] for x in image['occurrences']],'permission_basis':'User supplied the offering folders for the Andheri reference library; project-scoped use only.'}
 r['allowed_projects']=['flipkart-andheri'];r['shared_library_approved']=False;r['geometry_authority']=False;r['human_approved']=False
 r['title']=(room+' · '+client+' · '+Path(image['source_member']).stem) if room else Path(image['source_member']).name
 if r['id'] in seeds:
  old=seeds[r['id']]['record'];r['title']=old.get('title',r['title']);old_i=old.get('interpretations',{});r['interpretations']['selectable_features']=list(dict.fromkeys(old_i.get('design_language',[])+sum(list(old_i.get('palette',{}).values()),[])+old_i.get('materials_textures',[])+old_i.get('furniture',[])+old_i.get('lighting',[])))
 retrieval='Training & conference' if room=='Training room' else 'Breakout' if room in ['Focus / breakout pod','Collaboration zone'] else room or 'Unknown'
 row={'id':r['id'],'record':r,'room_type':retrieval,'offering_tier':r['offering_tier'],'review_status':r['review_status'],'allowed_projects':['flipkart-andheri'],'shared_library_approved':False};rows.append(row)
 (out/(r['id']+'.json')).write_text(json.dumps(r,indent=2,ensure_ascii=False))
summary={'image_records':len(rows),'unique_image_hashes':len({r['record']['image_sha256'] for r in rows}),'original_sources':len(m['sources']),'slides':len(m['slides']),'offering_counts':dict(collections.Counter(r['offering_tier'] for r in rows)),'category_counts':dict(counts),'support_detail_counts_nonexclusive':dict(support),'room_reference_records':sum(r['record']['classification']['room_reference_eligible'] for r in rows),'gallery_eligible_records':sum(r['record']['gallery_eligible'] for r in rows),'unknown_records':counts['unknown'],'human_approved':0,'designer_validated':0,'ocr':'Embedded text extracted first. OCR not run. Unsupported originals and uncertain room functions remain explicit.','priority':'Reception, waiting/lobby/entrance details, meeting/interview/boardroom/training; then workstations and other rooms.','definitions':'Counts are source-image records, including alternate exports/crops; not a claim of unique completed designs.'}
categories=root/'categories';categories.mkdir(exist_ok=True)
for category in counts:
 ids=[r['id'] for r in rows if r['record']['classification']['category']==category];filename=re.sub(r'[^a-z0-9]+','-',category.lower()).strip('-')+'.json';(categories/filename).write_text(json.dumps({'category':category,'record_ids':ids,'records':[r['record'] for r in rows if r['id'] in ids]},indent=2,ensure_ascii=False))
for detail in ['waiting_area','lobby_context','entrance_threshold']:
 linked=[r['record'] for r in rows if detail in r['record']['support_space_details']];(categories/(detail+'.json')).write_text(json.dumps({'support_detail':detail,'nonexclusive':True,'records':linked},indent=2,ensure_ascii=False))
summary['source_inventory']=[]
for source in m['sources']:
 subset=[r for r in rows if r['record']['source_id']==source['id']]
 categories=collections.Counter(r['record']['classification']['category'] for r in subset)
 summary['source_inventory'].append({'source_path':source['path'],'image_records':len(subset),'category_counts':dict(categories),'reception_views':categories['Reception'],'unresolved_originals':categories['unknown'],'reception_note':'Available as reception references; offering eligibility still applies.' if categories['Reception'] else 'No reception classified among readable source images. Unsupported or ambiguous originals remain unresolved.'})
(root/'classified-index.json').write_text(json.dumps({'schema_version':2,'references':rows,'summary':summary},indent=2,ensure_ascii=False));(root/'classification-summary.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False));print(json.dumps(summary,indent=2))
