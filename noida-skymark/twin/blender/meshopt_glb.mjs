// Compress a GLB's geometry with EXT_meshopt_compression (what `gltf-transform meshopt` does, without quantization),
// using the meshoptimizer npm package's encoder. Images and everything else are copied as they are.
// three.js r169 reads it with GLTFLoader.setMeshoptDecoder(MeshoptDecoder).
//   node meshopt_glb.mjs in.glb out.glb [path/to/node_modules/meshoptimizer]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2); const INSTANCE = argv.includes('--instance'); const pos = argv.filter((a) => !a.startsWith('--'));
const [inp, outp, mdir = process.env.MESHOPT_DIR || '/Users/lohit/Autopilot-Website/autopilot-web/node_modules/meshoptimizer'] = pos;
const { MeshoptEncoder } = await import(pathToFileURL(path.join(mdir, 'index.js')).href);
await MeshoptEncoder.ready;

const glb = fs.readFileSync(inp);
const jsonLen = glb.readUInt32LE(12); const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString());
const binStart = 20 + jsonLen + 8; const binLen = glb.readUInt32LE(20 + jsonLen); let bin = glb.subarray(binStart, binStart + binLen);
// --instance: root nodes that share one mesh (and carry no lightmap) become one node with EXT_mesh_gpu_instancing.
// Each instance keeps its identity: extras.instance_names[i] is the CAD block object of instance i.
let instanced = 0, instNodes = 0;
if (INSTANCE) {
  const scene = json.scenes[json.scene || 0]; const roots = scene.nodes; const byMesh = new Map();
  for (const ni of roots) {
    const n = json.nodes[ni];
    if (n.mesh === undefined || n.children || n.matrix || n.extras?.lightmap || n.extras?.collision) continue;
    if (!byMesh.has(n.mesh)) byMesh.set(n.mesh, []); byMesh.get(n.mesh).push(ni);
  }
  const extra = []; let extraLen = 0; const base = bin.length + ((4 - (bin.length % 4)) % 4);
  const addAcc = (arr, type) => {
    const buf = Buffer.from(new Float32Array(arr).buffer); const off = base + extraLen; extra.push(buf); extraLen += buf.length;
    json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: buf.length });
    json.accessors.push({ bufferView: json.bufferViews.length - 1, componentType: 5126, count: arr.length / (type === 'VEC4' ? 4 : 3), type });
    return json.accessors.length - 1;
  };
  const drop = new Set();
  for (const [mesh, list] of byMesh) {
    if (list.length < 2) continue;
    const T = [], R = [], S = [], names = [];
    for (const ni of list) { const n = json.nodes[ni]; T.push(...(n.translation || [0, 0, 0])); R.push(...(n.rotation || [0, 0, 0, 1])); S.push(...(n.scale || [1, 1, 1])); names.push(n.name); drop.add(ni); }
    const first = json.nodes[list[0]];
    json.nodes.push({ name: `${json.meshes[mesh].name}_x${list.length}`, mesh, extras: { ...(first.extras || {}), instances: list.length, instance_names: names },
      extensions: { EXT_mesh_gpu_instancing: { attributes: { TRANSLATION: addAcc(T, 'VEC3'), ROTATION: addAcc(R, 'VEC4'), SCALE: addAcc(S, 'VEC3') } } } });
    scene.nodes.push(json.nodes.length - 1); instanced += list.length; instNodes++;
  }
  scene.nodes = scene.nodes.filter((ni) => !drop.has(ni));
  // the dropped nodes stay in the array (indices must not shift) but are no longer in the scene
  for (const ni of drop) { const n = json.nodes[ni]; delete n.mesh; n.extras = { ...(n.extras || {}), instanced_into: true }; }
  if (extra.length) bin = Buffer.concat([bin, Buffer.alloc(base - bin.length), ...extra]);
  json.extensionsUsed = [...new Set([...(json.extensionsUsed || []), 'EXT_mesh_gpu_instancing'])];
}
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }; const CB = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const useOf = new Map();          // bufferView -> {mode, count, stride}
json.meshes.forEach((m) => m.primitives.forEach((p) => {
  for (const [sem, a] of Object.entries(p.attributes)) { const acc = json.accessors[a]; useOf.set(acc.bufferView, { mode: 'ATTRIBUTES', count: acc.count, stride: SIZE[acc.type] * CB[acc.componentType], acc, sem }); }
  if (p.indices !== undefined) { const acc = json.accessors[p.indices]; useOf.set(acc.bufferView, { mode: 'TRIANGLES', count: acc.count, stride: CB[acc.componentType], acc }); }
}));
const chunks = []; let off = 0; const pad4 = () => { const p = (4 - (off % 4)) % 4; if (p) { chunks.push(Buffer.alloc(p)); off += p; } };
const fallbackIndex = json.buffers.length; let fallbackLen = 0; let saved = 0, n = 0;
json.bufferViews.forEach((bv, i) => {
  const src = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
  const u = useOf.get(i);
  const ok = u && u.stride % 4 === 0 && (!bv.byteStride || bv.byteStride === u.stride) && !(u.acc.byteOffset) &&
             (u.mode === 'ATTRIBUTES' || (u.count % 3 === 0 && (u.stride === 2 || u.stride === 4)));
  const okIdx = u && u.mode === 'TRIANGLES' && u.count % 3 === 0 && (u.stride === 2 || u.stride === 4) && !(u.acc.byteOffset);
  if (ok || okIdx) {
    let data = new Uint8Array(src.buffer, src.byteOffset, src.byteLength); let filter;
    // EXPONENTIAL filter (still float32 for the loader): positions 15 bits (~2 mm at 60 m), normals 8, UVs 12 bits
    const bits = { POSITION: 15, NORMAL: 8, TEXCOORD_0: 12, TEXCOORD_1: 12 }[u.sem];
    if (u.mode === 'ATTRIBUTES' && bits && u.acc.componentType === 5126) {
      const f = new Float32Array(Uint8Array.from(data).buffer);
      data = MeshoptEncoder.encodeFilterExp(f, u.count, u.stride, bits, u.sem === 'POSITION' ? 'SharedVector' : 'Separate'); filter = 'EXPONENTIAL';
    }
    const enc = u.mode === 'TRIANGLES' ? MeshoptEncoder.encodeGltfBuffer(data, u.count, u.stride, 'TRIANGLES') : MeshoptEncoder.encodeGltfBuffer(data, u.count, u.stride, 'ATTRIBUTES');
    pad4(); const start = off; chunks.push(Buffer.from(enc)); off += enc.length;
    bv.extensions = { EXT_meshopt_compression: { buffer: 0, byteOffset: start, byteLength: enc.length, byteStride: u.stride, count: u.count, mode: u.mode, ...(filter ? { filter } : {}) } };
    bv.buffer = fallbackIndex; bv.byteOffset = fallbackLen; fallbackLen += bv.byteLength; fallbackLen += (4 - (fallbackLen % 4)) % 4;
    if (u.mode === 'ATTRIBUTES') bv.byteStride = bv.byteStride || undefined;
    saved += src.byteLength - enc.length; n++;
  } else {
    pad4(); bv.byteOffset = off; chunks.push(Buffer.from(src)); off += src.byteLength; bv.buffer = 0;
  }
});
pad4();
const newBin = Buffer.concat(chunks); json.buffers[0].byteLength = newBin.length;
json.buffers.push({ byteLength: Math.max(4, fallbackLen), extensions: { EXT_meshopt_compression: { fallback: true } } });
json.extensionsUsed = [...new Set([...(json.extensionsUsed || []), 'EXT_meshopt_compression'])];
json.extensionsRequired = [...new Set([...(json.extensionsRequired || []), 'EXT_meshopt_compression'])];
let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + newBin.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(newBin.length, 0); bh.writeUInt32LE(0x004E4942, 4);
fs.writeFileSync(outp, Buffer.concat([head, jh, js, bh, newBin]));
let tris = 0, draws = 0;
for (const ni of json.scenes[json.scene || 0].nodes) { const n = json.nodes[ni]; if (n.mesh === undefined) continue; const k = n.extras?.instances || 1;
  for (const p of json.meshes[n.mesh].primitives) { draws++; const a = json.accessors[p.indices ?? p.attributes.POSITION]; tris += k * a.count / 3; } }
console.log(JSON.stringify({ instanced_nodes_from: instanced, instanced_into: instNodes, draw_calls: draws, triangles: Math.round(tris), in_mb: +(glb.length / 1e6).toFixed(2), out_mb: +(fs.statSync(outp).size / 1e6).toFixed(2), compressed_views: n, saved_mb: +(saved / 1e6).toFixed(2) }));
