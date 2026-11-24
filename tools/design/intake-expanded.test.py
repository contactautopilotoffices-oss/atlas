#!/usr/bin/env python3
"""Focused proof against the supplied originals; does not mutate production records."""
import json,hashlib
from pathlib import Path
from xml.etree import ElementTree as ET
import zipfile
root=Path(__file__).resolve().parents[2];m=json.loads((root/'.atlas-design/library/manifest.json').read_text());idx=json.loads((root/'.atlas-design/library/classified-index.json').read_text())['references']
assert len(m['sources'])==6 and len(m['images'])==235 and len(m['slides'])==132
assert len(idx)==235 and len({r['id'] for r in idx})==235
for source in m['sources']:assert hashlib.sha256((root/source['path']).read_bytes()).hexdigest()==source['id']
for image in m['images']:assert hashlib.sha256(Path(image['local_object']).read_bytes()).hexdigest()==image['image_sha256']
assert sum(bool(s.get('speaker_notes')) for s in m['slides'])==17
svg=[im for im in m['images'] if im['source_member'].endswith('.svg')];assert len(svg)==17 and all(im['occurrences'] for im in svg)
wdp=[im for im in m['images'] if im['source_member'].endswith('.wdp')];assert len(wdp)==6 and sum(len(im['occurrences']) for im in wdp)==7
pdf=[s for s in m['sources'] if s['path'].endswith('.pdf')];assert sorted(s['pages'] for s in pdf)==[10,16]
meeting=[r for r in idx if r['room_type']=='Meeting room' and r['review_status']=='reviewed'];assert any(r['record']['source_path'].endswith('.pdf') and any(o.get('page_number')==8 for o in r['record']['occurrences']) for r in meeting)
assert not any(r['record']['presentation_role']=='softened_slide_background' for r in meeting)
assert all(r['record']['geometry_authority'] is False and r['record']['human_approved'] is False for r in idx)
assert any(v.get('source_option')=='1' and v.get('source_view')=='3' for r in meeting for v in r['record']['source_views'])
assert all(r['record']['facts'].get('seats') is None for r in meeting)
print('Expanded intake: six original hashes, all235 retained images,132 pages/slides,17 notes,17 SVG mappings,6 WDP alternate mappings, actual PDF meeting reference, and background exclusion passed.')
