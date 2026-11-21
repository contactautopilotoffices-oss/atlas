"""Inspect Atlas's Supabase connection and optionally upload verified edited media.
Usage: python3 upload.py --env ../.env [--upload]
No database rows or source footage are deleted or overwritten.
"""
import argparse,hashlib,json,mimetypes,subprocess,urllib.request,urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
p=argparse.ArgumentParser();p.add_argument('--env',type=Path,required=True);p.add_argument('--upload',action='store_true');args=p.parse_args()
env={}
for line in args.env.read_text().splitlines():
 line=line.strip()
 if not line or line.startswith('#') or '=' not in line:continue
 k,v=line.removeprefix('export ').split('=',1);env[k.strip()]=v.strip().strip('"\'')
url=env.get('SUPABASE_URL','').rstrip('/');key=env.get('SUPABASE_SERVICE_ROLE_KEY','')
if not url or not key:raise SystemExit('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the specified env file.')
if url!='https://wjitngujojkbxzsryjnk.supabase.co':raise SystemExit('Project URL differs from the Atlas public configuration; verify the intended project before uploading.')
headers={'apikey':key,'Authorization':'Bearer '+key}
def request(path,method='GET',body=None,extra=None):
 req=urllib.request.Request(url+path,data=body,method=method,headers={**headers,**(extra or {})})
 try:return urllib.request.urlopen(req,timeout=120)
 except urllib.error.HTTPError as e:raise SystemExit(f'{method} {path.split("?")[0]} failed: HTTP {e.code}') from None
bucket=json.load(request('/storage/v1/bucket/atlas-cms'))
if not bucket.get('public'):raise SystemExit('Existing atlas-cms bucket is not public; no storage settings were changed.')
summary={'bucket':'atlas-cms','public':True,'fileSizeLimit':bucket.get('file_size_limit'),'tables':{}}
for table,col in [('atlas_links','slug'),('atlas_bundles','link_slug'),('atlas_overrides','link_slug')]:
 rows=json.load(request(f'/rest/v1/{table}?{col}=eq.flipkart-andheri-east'))
 summary['tables'][table]=[{'version':r.get('version'),'status':r.get('status'),'hasDraft':bool(r.get('draft')),'hasPublished':bool(r.get('published'))} for r in rows]
 print(table,len(rows),'matching rows')
print('Connected: expected Atlas project; existing public atlas-cms bucket.')
if not args.upload:
 print('Inspection only. Pass --upload to upload final MP4s, posters and photos.');raise SystemExit(0)
folder=ROOT/'media/flipkart-andheri-east/visits';files=sorted(folder.iterdir());remote={};uploaded=[]
for f in files:
 if f.suffix not in ['.mp4','.jpg']:continue
 data=f.read_bytes()
 if f.suffix=='.mp4':
  probe=json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_streams','-of','json',str(f)]))
  if any(s['codec_type']=='audio' for s in probe['streams']) or len(data)>20_000_000:raise SystemExit('Video must be silent and under 20 MB: '+f.name)
 digest=hashlib.sha256(data).hexdigest();object_path='flipkart-andheri-east/visits/'+digest[:12]+'/'+f.name
 mime='video/mp4' if f.suffix=='.mp4' else 'image/jpeg'
 # Content-derived paths are immutable; an identical earlier upload is reused.
 existing=request('/storage/v1/object/list/atlas-cms',method='POST',body=json.dumps({'prefix':object_path.rsplit('/',1)[0],'search':f.name,'limit':100}).encode(),extra={'Content-Type':'application/json'})
 if not any(x.get('name')==f.name for x in json.load(existing)):
  request('/storage/v1/object/atlas-cms/'+object_path,method='POST',body=data,extra={'Content-Type':mime,'Cache-Control':'max-age=31536000'}).close()
 public=url+'/storage/v1/object/public/atlas-cms/'+object_path
 with urllib.request.urlopen(urllib.request.Request(public,method='HEAD'),timeout=30) as response:
  if int(response.headers.get('Content-Length','0'))!=len(data):raise SystemExit('Uploaded size mismatch: '+f.name)
  if mime not in response.headers.get('Content-Type',''):raise SystemExit('Uploaded content type mismatch: '+f.name)
 remote[f.name]=public;uploaded.append({'file':f.name,'bytes':len(data),'sha256':digest,'url':public})
 print('Verified upload',f.name,len(data),'bytes',flush=True)
manifest=ROOT/'examples/flipkart-andheri-east.media.json';m=json.loads(manifest.read_text())
for entries in m.values():
 for entry in entries:
  for attr in ['src','poster']:
   if attr in entry:entry[attr]=remote[entry[attr].rsplit('/',1)[-1]]
manifest.write_text(json.dumps(m,indent=2)+'\n')
summary['assets']=uploaded
(ROOT/'andheri-video-edit/storage-verification.json').write_text(json.dumps(summary,indent=2)+'\n')
print('Updated media manifest with verified public storage URLs. Regenerate the Atlas bundle before review.')
