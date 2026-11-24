"""Make a variant rules file: rules.json with a few values changed (a 'what if' for one rule).
    python -I variant.py <patch.json> <out_rules.json>
patch.json: {"set": {"defaults.door_head_m": 2.4, "overrides.0.enabled": true}, "why": "..."}"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import ROOT
r = json.load(open(os.path.join(ROOT, 'rules.json'))); patch = json.load(open(sys.argv[1]))
for path, v in patch['set'].items():
    o = r; keys = path.split('.')
    for k in keys[:-1]:
        o = o[int(k)] if isinstance(o, list) else o[k]
    last = keys[-1]
    old = o[int(last)] if isinstance(o, list) else o.get(last)
    if isinstance(o, list): o[int(last)] = v
    else: o[last] = v
    print(f'variant: {path}: {old} -> {v}')
r['variant'] = patch
json.dump(r, open(sys.argv[2], 'w'), indent=1)
