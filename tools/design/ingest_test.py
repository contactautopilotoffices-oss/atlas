import importlib.util, tempfile, json, zipfile, hashlib
from pathlib import Path
spec=importlib.util.spec_from_file_location('ingest',Path(__file__).with_name('ingest.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
with tempfile.TemporaryDirectory() as temp:
 root=Path(temp);assets=root/'assets';tier=assets/'Premium Economy';tier.mkdir(parents=True)
 source=tier/'reference.pptx'
 with zipfile.ZipFile(source,'w') as z:
  z.writestr('ppt/slides/slide1.xml','''<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><a:t>Meeting room</a:t><a:blip r:embed="rId1"/></p:sld>''')
  z.writestr('ppt/slides/_rels/slide1.xml.rels','''<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="../media/image1.png"/></Relationships>''')
  z.writestr('ppt/media/image1.png',b'source-image')
 digest=hashlib.sha256(source.read_bytes()).hexdigest()
 first=module.ingest(assets,root/'output');second=module.ingest(assets,root/'output')
 assert first==second
 assert first['offering_tiers']==['Premium Economy']
 record=first['images'][0]
 assert record['occurrences'][0]['embedded_text']==['Meeting room']
 assert record['facts']['room_type'] is None # Slide text is evidence, not automatically a reviewed fact.
 assert record['review_status']=='pending' and not record['allowed_projects']
 assert not record['geometry_authority'] and record['ocr']['status']=='not_run'
 assert hashlib.sha256(source.read_bytes()).hexdigest()==digest
 print('Ingestion: exact tiers, embedded-text relationships, deterministic provenance, unknowns, private defaults and unchanged originals passed.')
