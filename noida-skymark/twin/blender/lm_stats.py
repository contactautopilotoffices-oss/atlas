"""Lightmap statistics from the kept float atlases, written into <t>_lightmaps.json: per atlas the 8-bit levels and the
median code of the LIT texels (above 1 % of the atlas key; faces buried in walls or under furniture stay black and are
never seen, so they do not count).
    Blender -b --python lm_stats.py -- --tenant <t> --out OUT"""
import json, os, sys, argparse
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import twin_lib as TL, bake_export as BE
ap = argparse.ArgumentParser(); ap.add_argument('--tenant', required=True); ap.add_argument('--out', required=True)
A = ap.parse_args(TL.script_args()); d = os.path.join(A.out, 'export', 'lightmaps'); mf = os.path.join(d, f'{A.tenant}_lightmaps.json'); man = json.load(open(mf))
for name, info in man['atlases'].items():
    fp = os.path.join(d, f'_{name}_float.exr')
    if not os.path.exists(fp): continue
    a = BE.read_exr(fp)[..., :3]; L = a.mean(2); kk = info.get('scale_k') or 1.0
    x = np.clip(L * kk, 0, 1); lit = x[x > 0.01]
    enc = np.round(np.where(lit <= 0.0031308, lit * 12.92, 1.055 * np.power(lit, 1 / 2.4) - 0.055) * 255)
    info.update({'lit_frac': round(float(lit.size) / max(1, int((L > 0).sum())), 3), 'levels_8bit_lit': int(len(np.unique(enc))), 'median_code_lit': round(float(np.median(enc)), 1) if enc.size else 0.0})
    print(name, info['lit_frac'], info['levels_8bit_lit'], info['median_code_lit'], flush=True)
json.dump(man, open(mf, 'w'), indent=1)
