"""Keep native geometry and image detail while serving textures separately.

No image transcoding, geometry quantization, simplification or compression.
Blender may pack scalar roughness into an 8-bit RGB map; for nonmetallic
Poly Haven materials this can restore the original 16-bit grayscale PNG.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct


def public_value(value):
    if isinstance(value, dict):
        return {k: public_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [public_value(v) for v in value]
    if isinstance(value, str):
        if value.startswith(('/Users/', '/private/', '/tmp/')):
            return Path(value).name
        if value.startswith(('{', '[')):
            try:
                return json.dumps(public_value(json.loads(value)))
            except (ValueError, TypeError):
                pass
    return value


def externalize(source, output, native_materials=None):
    raw = source.read_bytes()
    assert raw[:4] == b'glTF' and struct.unpack_from('<I', raw, 4)[0] == 2
    assert struct.unpack_from('<I', raw, 8)[0] == len(raw)
    json_size, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4e4f534a
    doc = json.loads(raw[20:20+json_size])
    bin_size, kind = struct.unpack_from('<II', raw, 20+json_size)
    assert kind == 0x004e4942 and len(doc['buffers']) == 1
    binary = memoryview(raw)[28+json_size:28+json_size+bin_size]
    old_views = doc['bufferViews']
    image_views = {i['bufferView'] for i in doc.get('images', []) if 'bufferView' in i}
    output.parent.mkdir(parents=True, exist_ok=True)
    texture_dir = output.parent / (output.stem + '-textures')
    texture_dir.mkdir(exist_ok=True)
    hashes, images, restored = {}, [], []
    for index, im in enumerate(doc.get('images', [])):
        if 'bufferView' not in im:
            continue
        view = old_views[im.pop('bufferView')]
        start = view.get('byteOffset', 0)
        payload = bytes(binary[start:start+view['byteLength']])
        match = re.fullmatch(r'(.+)_rough_2k', im.get('name', ''))
        if native_materials and match:
            native = native_materials / match.group(1) / (match.group(0)+'.png')
            users = []
            for material in doc.get('materials', []):
                pbr = material.get('pbrMetallicRoughness', {})
                texture = pbr.get('metallicRoughnessTexture')
                if texture and doc['textures'][texture['index']].get('source') == index:
                    users.append(pbr)
            if native.is_file() and users and all(m.get('metallicFactor', 1) == 0 for m in users):
                payload = native.read_bytes()
                restored.append(native.name)
        digest = hashlib.sha256(payload).hexdigest()
        if digest not in hashes:
            ext = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp'}[im['mimeType']]
            name = re.sub(r'[^a-zA-Z0-9_.-]', '-', im.get('name', 'image'))[:100]
            target = texture_dir / (f'{index:02d}-'+name+ext)
            target.write_bytes(payload)
            hashes[digest] = target.relative_to(output.parent).as_posix()
        im['uri'] = hashes[digest]
        images.append({'uri': im['uri'], 'bytes': len(payload), 'sha256': digest})
    remap, new_views, result = {}, [], bytearray()
    for index, old in enumerate(old_views):
        if index in image_views:
            continue
        result.extend(b'\0' * (-len(result) % 4))
        start, size = old.get('byteOffset', 0), old['byteLength']
        view = {**old, 'buffer': 0, 'byteOffset': len(result)}
        result.extend(binary[start:start+size])
        assert result[view['byteOffset']:view['byteOffset']+size] == binary[start:start+size]
        remap[index] = len(new_views)
        new_views.append(view)

    def reindex(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key == 'bufferView':
                    value[key] = remap[child]
                else:
                    reindex(child)
        elif isinstance(value, list):
            for child in value:
                reindex(child)

    doc.pop('bufferViews')
    reindex(doc)
    doc['bufferViews'] = new_views
    doc['buffers'] = [{'byteLength': len(result)}]
    tints = []
    for material in doc.get('materials', []):
        tint = material.get('extras', {}).get('gltf_base_color_factor')
        if isinstance(tint, list) and len(tint) == 4:
            material.setdefault('pbrMetallicRoughness', {})['baseColorFactor'] = tint
            tints.append(material.get('name'))
    doc = public_value(doc)
    js = json.dumps(doc, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    result.extend(b'\0' * (-len(result) % 4))
    packed = struct.pack('<4sII', b'glTF', 2, 28+len(js)+len(result))
    packed += struct.pack('<II', len(js), 0x4e4f534a) + js
    packed += struct.pack('<II', len(result), 0x004e4942) + result
    output.write_bytes(packed)
    report = {'source_bytes': len(raw), 'geometry_container_bytes': len(packed),
              'native_buffer_views_verified_byte_for_byte': len(new_views),
              'native_images': images, 'restored_native_16bit_roughness': restored,
              'restored_source_leaf_tints': tints, 'additional_image_compression': False,
              'geometry_compression': False, 'decimation': False, 'quantization': False}
    output.with_name(output.stem+'-export.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'native_images'}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--native-materials', type=Path)
    args = parser.parse_args()
    externalize(args.source, args.output, args.native_materials)
