"""Validate the assembly file against schema.json. Exit code 1 on any error.
    python -I validate.py <assemblies.json>"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import jsonschema
from lib import ROOT
doc = json.load(open(sys.argv[1])); schema = json.load(open(os.path.join(ROOT, 'schema.json')))
v = jsonschema.Draft202012Validator(schema)
errs = sorted(v.iter_errors(doc), key=lambda e: list(e.path))
for e in errs[:20]:
    print('INVALID', '/'.join(map(str, e.path)), e.message[:200])
n_attr = 0; by_src = {}
def walk(o):
    global n_attr
    if isinstance(o, dict):
        if 'source' in o and 'confidence' in o and 'value' in o:
            n_attr += 1; by_src[o['source']] = by_src.get(o['source'], 0) + 1
        for x in o.values(): walk(x)
    elif isinstance(o, list):
        for x in o: walk(x)
walk(doc)
print('schema:', 'OK' if not errs else f'{len(errs)} errors', '| attributes with source:', n_attr, by_src)
sys.exit(1 if errs else 0)
