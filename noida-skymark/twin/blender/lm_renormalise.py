"""Re-encode baked lightmaps from their kept float atlases (bake with --lm-keep-float) at another clip percentile,
without a re-bake; updates every object's lightMapIntensity in the baked .blend and the lightmaps manifest.
    Blender -b OUT/<t>_baked.blend --python lm_renormalise.py -- --tenant <t> --out OUT --clip 98
Then run the export stage. Reports, per atlas, the 8-bit levels used and the median code of the used texels."""
import bpy, json, math, os, sys, argparse
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import twin_lib as TL, bake_export as BE
ap = argparse.ArgumentParser(); ap.add_argument('--tenant', required=True); ap.add_argument('--out', required=True); ap.add_argument('--clip', type=float, default=98.0)
A = ap.parse_args(TL.script_args()); d = os.path.join(A.out, 'export', 'lightmaps'); mf = os.path.join(d, f'{A.tenant}_lightmaps.json'); man = json.load(open(mf))
for name, info in man['atlases'].items():
    fp = os.path.join(d, f'_{name}_float.exr')
    if not os.path.exists(fp): print('no float atlas for', name); continue
    a = BE.read_exr(fp)[..., :3]; used = a.sum(2) > 0
    p = float(np.percentile(a[used], A.clip)) if used.any() else 1.0; kk = 1.0 / max(p, 1e-6)
    enc = np.clip(a * kk, 0, 1); enc = np.where(enc <= 0.0031308, enc * 12.92, 1.055 * np.power(enc, 1 / 2.4) - 0.055)
    TL.write_png(os.path.join(d, f'{name}.png'), enc)
    q = np.round(enc * 255).astype(np.uint8)[used][:, 1]; lv = int(len(np.unique(q[q > 0]))); med = float(np.median(q))
    inten = round(math.pi / kk, 5)
    for o in bpy.data.objects:
        if o.get('lightmap') == f'{name}.png': o['lightMapIntensity'] = inten
    info.update({'lightMapIntensity': inten, 'scale_k': round(kk, 4), 'clip_pct': A.clip, 'levels_8bit': lv, 'median_code': round(med, 1)})
    print(f'{name}: clip p{A.clip} -> intensity {inten}, {lv} levels, median code {med:.0f}', flush=True)
json.dump(man, open(mf, 'w'), indent=1); bpy.ops.wm.save_mainfile(); print('saved', bpy.data.filepath)
