"""Re-bake single lightmap atlases of a baked .blend on their existing 'lightmap' UVs (e.g. one that came back black).
    Blender -b OUT/<t>_baked.blend --python rebake_atlas.py -- --tenant <t> --out OUT --atlases lm25,lm26 [--samples 64] [--clip 98]
Same passes as the bake stage (diffuse direct+indirect, albedo and normal guides, OIDN), same encoding; updates the
objects' lightMapIntensity, the float atlas, the PNG and the manifest, then saves the .blend. Run the export stage after."""
import bpy, json, math, os, sys, time, argparse
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import twin_lib as TL, bake_export as BE
ap = argparse.ArgumentParser(); ap.add_argument('--tenant', required=True); ap.add_argument('--out', required=True); ap.add_argument('--atlases', required=True)
ap.add_argument('--samples', type=int, default=64); ap.add_argument('--clip', type=float, default=98.0); ap.add_argument('--res', type=int, default=1024); ap.add_argument('--device', default='GPU'); ap.add_argument('--unwrap', action='store_true'); ap.add_argument('--pad-px', type=int, default=20)
A = ap.parse_args(TL.script_args()); sc = bpy.context.scene; d = os.path.join(A.out, 'export', 'lightmaps')
mf = os.path.join(d, f'{A.tenant}_lightmaps.json'); man = json.load(open(mf))
TL.setup_cycles(sc, A.samples, A.device, denoise=False); sc.render.bake.margin = 16; sc.render.bake.use_clear = True; sc.render.bake.target = 'IMAGE_TEXTURES'
for short in A.atlases.split(','):
    name = short if short.startswith(A.tenant) else f'{A.tenant}_{short}'
    objs = [o for o in bpy.data.objects if o.get('lightmap') == f'{name}.png']
    if not objs: print('no objects for', name); continue
    if A.unwrap:
        sc['twin_lm_pad_px'] = A.pad_px; sc['twin_lm_res'] = A.res; BE.unwrap(objs)
    for o in objs:
        o.data.uv_layers.active = o.data.uv_layers['lightmap']
    img = bpy.data.images.new(name, A.res, A.res, alpha=False, float_buffer=True); nodes = []
    for m in {m for o in objs for m in o.data.materials if m}:
        n = m.node_tree.nodes.new('ShaderNodeTexImage'); n.image = img; m.node_tree.nodes.active = n; nodes.append((m, n))
    for o in sc.objects: o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; t0 = time.time()
    for attempt in range(3):
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=16, use_clear=True)
        px = np.empty(len(img.pixels), np.float32); img.pixels.foreach_get(px)
        if float(px.reshape(-1, 4)[:, :3].max()) > 0: break
        print(name, 'black again, retrying', flush=True)
    raw = os.path.join(d, f'_{name}.exr'); img.filepath_raw = raw; img.file_format = 'OPEN_EXR'; img.save()
    keep = sc.cycles.samples; sc.cycles.samples = 4
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, margin=16, use_clear=True); alb = os.path.join(d, f'_{name}_alb.exr'); img.filepath_raw = alb; img.save()
    sc.render.bake.normal_space = 'OBJECT'; bpy.ops.object.bake(type='NORMAL', margin=16, use_clear=True); nrm = os.path.join(d, f'_{name}_nrm.exr'); img.filepath_raw = nrm; img.save()
    sc.cycles.samples = keep
    na = BE.read_exr(nrm); na[..., :3] = na[..., :3] * 2 - 1; BE.TL_write_exr(nrm, na)
    for m, n in nodes: m.node_tree.nodes.remove(n)
    bpy.data.images.remove(img)
    den = os.path.join(d, f'_{name}_dn.exr'); ok = BE.denoise(raw, den, A.res, alb, nrm)
    a = BE.read_exr(den if ok else raw)[..., :3]; BE.TL_write_exr(os.path.join(d, f'_{name}_float.exr'), a)
    used = a.sum(2) > 0; p = float(np.percentile(a[used], A.clip)) if used.any() else 1.0; kk = 1.0 / max(p, 1e-6)
    enc = np.clip(a * kk, 0, 1); enc = np.where(enc <= 0.0031308, enc * 12.92, 1.055 * np.power(enc, 1 / 2.4) - 0.055)
    TL.write_png(os.path.join(d, f'{name}.png'), enc)
    for f_ in (raw, den, alb, nrm):
        if os.path.exists(f_): os.remove(f_)
    q = np.round(enc * 255).astype(np.uint8)[used][:, 1] if used.any() else np.zeros(1, np.uint8)
    inten = round(math.pi / kk, 5)
    for o in objs:
        o['lightMapIntensity'] = inten; o.data.uv_layers.active = o.data.uv_layers['UVMap']
    man['atlases'][name].update({'lightMapIntensity': inten, 'scale_k': round(kk, 4), 'clip_pct': A.clip, 'levels_8bit': int(len(np.unique(q[q > 0]))), 'median_code': round(float(np.median(q)), 1), 'rebaked': True, 'samples': A.samples})
    print(f'{name}: re-baked {len(objs)} objects in {time.time() - t0:.0f} s, max {float(a.max()):.3f}, intensity {inten}, levels {man["atlases"][name]["levels_8bit"]}', flush=True)
json.dump(man, open(mf, 'w'), indent=1); bpy.ops.wm.save_mainfile(); print('saved', bpy.data.filepath)
