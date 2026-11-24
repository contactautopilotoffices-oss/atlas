#!/usr/bin/env python3
"""Offline provenance-first reference ingestion. Originals stay untouched; no OCR or AI guesses."""
import argparse, hashlib, json, posixpath, zipfile, io
from pathlib import Path
from xml.etree import ElementTree as ET

IMAGE_EXT = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.tif', '.tiff', '.svg', '.wdp'}
NS = {'a':'http://schemas.openxmlformats.org/drawingml/2006/main', 'p':'http://schemas.openxmlformats.org/presentationml/2006/main', 'r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
LIMIT = 512 * 1024 * 1024

def sha(b): return hashlib.sha256(b).hexdigest()
def ingest(root, output):
    root, output = Path(root).resolve(), Path(output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    (output/'objects').mkdir(exist_ok=True)
    sources, records, slides, videos = [], [], [], []
    tiers = sorted(p.name for p in root.iterdir() if p.is_dir() and p.name not in ('kit','models'))
    for tier in tiers:
        for path in sorted((root/tier).rglob('*')):
            if not path.is_file() or path.name.startswith('.'): continue
            rel = str(path.relative_to(root.parent))
            if path.suffix.lower() in ('.mp4','.mov'):
                videos.append({'path':rel,'offering_tier':tier,'role':'interface_reference_pending_review'}); continue
            if path.suffix.lower() not in {'.pptx','.zip','.pdf'} | IMAGE_EXT: continue
            data = path.read_bytes(); source_id = sha(data)
            source = {'id':source_id,'path':rel,'offering_tier':tier,'tier_basis':'source_folder','bytes':len(data)}
            sources.append(source)
            def record(member, content, occurrences):
                digest=sha(content); ext=Path(member).suffix.lower()
                dimensions=None
                try:
                    from PIL import Image
                    with Image.open(io.BytesIO(content)) as pixel_image: dimensions={'width':pixel_image.width,'height':pixel_image.height,'basis':'encoded image pixels, never physical dimensions'}
                except Exception: pass
                target=output/'objects'/(digest+ext)
                if not target.exists(): target.write_bytes(content)
                records.append({'id':sha((source_id+'!'+member).encode()),'source_id':source_id,'source_member':member,'image_sha256':digest,'image_dimensions':dimensions,'local_object':str(target), 'occurrences':occurrences,'offering_tier':tier,'review_status':'pending','allowed_projects':[], 'shared_library_approved':False,
                    'facts':{'project':None,'client':None,'property':None,'city':None,'room_type':None},
                    'interpretations':{'design_language':[],'palette':{'primary':[],'secondary':[],'accent':[]},'materials_textures':[],'furniture':[],'lighting':[]},
                    'confidence':{},'unknowns':['project','client','property','city','room_type','visual_description','reuse_permission','measured_geometry'],
                    'review':{'reviewed_by':None,'reviewed_at':None,'evidence':[]},'geometry_authority':False,
                    'ocr':{'status':'not_run','reason':'Embedded slide text extracted first; OCR only for unreadable image text if required.'}})
            if path.suffix.lower() in IMAGE_EXT: record(path.name,data,[]); continue
            if path.suffix.lower()=='.pdf':
                try: from pypdf import PdfReader
                except ImportError: raise RuntimeError('PDF intake requires pypdf and Pillow; set ATLAS_DESIGN_PYTHON to the bundled Python runtime.')
                reader=PdfReader(io.BytesIO(data)); pdf_images={}
                for page_number,page in enumerate(reader.pages,1):
                    text=(page.extract_text() or '').splitlines(); member='pdf/pages/page'+str(page_number)
                    page_record={'id':source_id+':page'+str(page_number),'source_id':source_id,'member':member,'page_number':page_number,'text':text,'text_method':'pdf_embedded_text','image_members':[]}
                    for image in page.images:
                        obj=image.indirect_reference; object_id=str(obj.idnum) if obj else sha(image.data)[:16]
                        image_member='pdf/images/object-'+object_id+Path(image.name).suffix.lower()
                        occurrence={'slide_id':page_record['id'],'slide_member':member,'page_number':page_number,'embedded_text':text,'relationship_id':'PDF object '+object_id,'association':'page resource; not object-level caption binding'}
                        pdf_images.setdefault(image_member,{'bytes':image.data,'occurrences':[]})['occurrences'].append(occurrence);page_record['image_members'].append(image_member)
                    slides.append(page_record)
                for member,image in pdf_images.items(): record(member,image['bytes'],image['occurrences'])
                source['pages']=len(reader.pages);source['extraction_method']='pypdf embedded text and decoded image objects; native page layout retained in original PDF; no OCR or physical geometry inferred'
                continue
            with zipfile.ZipFile(path) as archive:
                members=archive.infolist()
                if sum(m.file_size for m in members)>LIMIT: raise ValueError('Archive exceeds expanded limit: '+rel)
                links={}
                if path.suffix.lower()=='.pptx':
                    for m in sorted(members,key=lambda m:m.filename):
                        name=m.filename
                        if not name.startswith('ppt/slides/slide') or not name.endswith('.xml') or '/_rels/' in name: continue
                        xml=ET.fromstring(archive.read(name)); text=[e.text for e in xml.findall('.//a:t',NS) if e.text]
                        slide_id=source_id+':'+Path(name).stem
                        slide={'id':slide_id,'source_id':source_id,'member':name,'text':text,'text_method':'embedded_xml','image_members':[]}
                        rels=posixpath.join(posixpath.dirname(name),'_rels',posixpath.basename(name)+'.rels')
                        if rels in archive.namelist():
                            relation={r.attrib.get('Id'):r.attrib for r in ET.fromstring(archive.read(rels))}
                            for blip in [e for e in xml.iter() if e.tag.split('}')[-1] in ('blip','svgBlip')]:
                                r=relation.get(blip.attrib.get('{'+NS['r']+'}embed'),{})
                                if r.get('TargetMode')=='External': continue
                                target=posixpath.normpath(posixpath.join('ppt/slides',r.get('Target','')))
                                if target in archive.namelist() and Path(target).suffix.lower() in IMAGE_EXT:
                                    occurrence={'slide_id':slide_id,'slide_member':name,'embedded_text':text,'relationship_id':r.get('Id')}
                                    links.setdefault(target,[]).append(occurrence);slide['image_members'].append(target)
                                                    # HD-photo alternatives and speaker notes are source evidence, not new rooms.
                            for rid,r in relation.items():
                                target=posixpath.normpath(posixpath.join('ppt/slides',r.get('Target','')))
                                if r.get('Type','').endswith('/hdphoto') and target in archive.namelist():
                                    links.setdefault(target,[]).append({'slide_id':slide_id,'slide_member':name,'embedded_text':text,'relationship_id':rid,'association':'HD-photo alternate for this slide; not a separate view'})
                                if r.get('Type','').endswith('/notesSlide') and target in archive.namelist():
                                    slide['speaker_notes']=[e.text for e in ET.fromstring(archive.read(target)).findall('.//a:t',NS) if e.text]
                        slides.append(slide)
                for m in members:
                    if Path(m.filename).suffix.lower() in IMAGE_EXT and not m.filename.startswith('__MACOSX/'):
                        record(m.filename,archive.read(m),links.get(m.filename,[]))
    manifest={'schema_version':1,'offering_tiers':tiers,'sources':sources,'images':records,'slides':slides,'interface_videos':videos,
        'policy':'Pending assets are internal only. Folder tier is explicit; slide text is evidence, not automatically image-specific fact. No geometry, cost, grade or intent inferred.'}
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False))
    print(json.dumps({'manifest':str(output/'manifest.json'),'tiers':tiers,'sources':len(sources),'images':len(records),'slides':len(slides)}))
    return manifest
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--assets',default='assets');parser.add_argument('--output',required=True)
    args=parser.parse_args();ingest(args.assets,args.output)
