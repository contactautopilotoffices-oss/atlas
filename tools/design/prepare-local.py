#!/usr/bin/env python3
"""Join reviewed metadata to locally extracted originals, checking content hashes."""
import argparse,json,hashlib
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--workspace',required=True);a=p.parse_args();root=Path(a.workspace).resolve()
manifest=json.loads((root/'manifest.json').read_text());review=json.loads((Path(__file__).parent/'reviewed-index.json').read_text());images={i['id']:i for i in manifest['images']}
for row in review['references']:
 image=images[row['id']];target=Path(image['local_object']);digest=hashlib.sha256(target.read_bytes()).hexdigest()
 if digest!=row['record']['image_sha256']:raise ValueError('Source image changed; re-review required')
 row['record']['local_object']=str(target)
(root/'reviewed-index.json').write_text(json.dumps(review,indent=2));print(root/'reviewed-index.json')
