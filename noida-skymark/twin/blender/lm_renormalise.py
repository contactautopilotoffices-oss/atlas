"""Re-encode baked lightmaps from their kept float atlases (bake with --lm-keep-float) at another clip percentile,
without a re-bake; updates every object's lightMapIntensity in the baked .blend and the lightmaps manifest.
    Blender -b OUT/<t>_baked.blend --python lm_renormalise.py -- --tenant <t> --out OUT --clip 98
Then run the export stage. Reports, per atlas, the 8-bit levels used and the median code of the used texels."""
import bpy, json, math, os, sys, argparse
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import twin_lib as TL, bake_export as BE
ap = argparse.ArgumentParser(); ap.add_argument('--tenant', required=True); ap.add_argument('--out', required=True); ap.add_argument('--clip', type=float, default=98.0); ap.add_argument('--smooth-layers', default='', help='e.g. FLOOR: island-masked gaussian on atlases holding these layers'); ap.add_argument('--sigma', type=float, default=2.5)
A = ap.parse_args(TL.script_args()); d = os.path.join(A.out, 'export', 'lightmaps'); mf = os.path.join(d, f'{A.tenant}_lightmaps.json'); man = json.load(open(mf))
for name, info in man['atlases'].items():
    fp = os.path.join(d, f'_{name}_float.exr')
    if not os.path.exists(fp): print('no float atlas for', name); continue
    a = BE.read_exr(fp)[..., :3]; used = a.sum(2) > 0
    lays = {o.get('twin_layer') for o in bpy.data.objects if o.get('lightmap') == f'{name}.png'}
    if A.smooth_layers and lays & set(A.smooth_layers.split(',')):
        # bake noise on a dark carpet comes out of OIDN as soft blotches: an island-masked gaussian (empty texels do not bleed in)
        def g1(x, ax):
            r = int(3 * A.sigma); k = np.exp(-0.5 * (np.arange(-r, r + 1) / A.sigma) ** 2); k /= k.sum(); out = np.zeros_like(x)
            for i, w in enumerate(k): out += w * np.roll(x, i - r, axis=ax)
            return out
        m = used.astype(np.float32); num = g1(g1(a * m[..., None], 0), 1); den = g1(g1(m, 0), 1)[..., None]
        a = np.where(used[..., None], num / np.maximum(den, 1e-6), 0.0).astype(np.float32); info['smoothed_sigma_px'] = A.sigma
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
