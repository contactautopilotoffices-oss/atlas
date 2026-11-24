import tempfile,json,subprocess,sys
from pathlib import Path
with tempfile.TemporaryDirectory() as folder:
 root=Path(folder);source={'id':'unseen-source','path':'assets/Premium Economy/new-client-image.zip','offering_tier':'Premium Economy'}
 image={'id':'new-image-id','source_id':source['id'],'source_member':'new-room.png','image_sha256':'new-hash','offering_tier':'Premium Economy','occurrences':[],'local_object':'/private/placeholder.png','review_status':'pending','facts':{},'unknowns':[]}
 (root/'manifest.json').write_text(json.dumps({'sources':[source],'images':[image],'slides':[]}))
 subprocess.run([sys.executable,str(Path(__file__).with_name('classify.py')),'--workspace',str(root)],check=True,stdout=subprocess.DEVNULL)
 data=json.loads((root/'classified-index.json').read_text());record=data['references'][0]['record']
 assert record['classification']['category']=='unknown'
 assert record['facts']['client'] is None and record['facts']['project'] is None
 assert not record['classification']['room_reference_eligible'] and not record['human_approved']
 assert (root/'records'/'new-image-id.json').exists()
 print('Classification: new source versions stay unknown; positional index reuse cannot mislabel another client or room.')
