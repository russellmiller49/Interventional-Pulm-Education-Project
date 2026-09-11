#!/usr/bin/env python3
"""Package an existing public 8-bit CT derivative; never reads a raw clinical source.

Run from the website checkout with Python 3 and its installed Prettier.
No third-party Python dependencies.
Output is idempotent and confined to public/branch-tracing/preview-v1.
The original published case, private authoring inputs and Slicer scene are unchanged.
"""
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import zlib

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'public/fluoroview/cases/patient-new'
OUT = ROOT / 'public/branch-tracing/preview-v1'
EXPECTED_CT = '322ca5cfec3a6edaf40756d822be64243db1e9d19bdf2fa470dd4ee3956cf700'
EXPECTED_SURFACE = 'bfad25b4a0baf07cc16f27cda8fd8287346eb29ef03d84c47b1fc1205343d65d'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def repository_json(value, path):
    # Match the pre-commit hook before hashing: it formats all staged JSON.
    return subprocess.run(
        [str(ROOT / 'node_modules/.bin/prettier'), '--stdin-filepath', str(path)],
        input=(json.dumps(value) + '\n').encode(), stdout=subprocess.PIPE,
        check=True, cwd=ROOT,
    ).stdout


def png_gray(size, pixels):
    def chunk(name, payload):
        return struct.pack('>I', len(payload)) + name + payload + struct.pack('>I', zlib.crc32(name + payload) & 0xffffffff)
    rows = b''.join(b'\x00' + pixels[y * size:(y + 1) * size] for y in range(size))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 0, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b'')


def main():
    source = (SOURCE / 'ct/ct_preview_uint8.raw').read_bytes()
    if len(source) != 256 ** 3 or sha(source) != EXPECTED_CT:
        raise SystemExit('Source preview changed. Review correspondence before regenerating.')
    meta = json.loads((SOURCE / 'ct/ct_preview_metadata.json').read_text())
    graph_raw = (SOURCE / 'metadata/airway_graph.json').read_bytes()
    graph = json.loads(graph_raw)
    manifest = json.loads((SOURCE / 'case_manifest.json').read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'axial').mkdir(exist_ok=True)
    # Fixed contrast export from the quantized public volume. This does not restore source HU.
    low = (-1000 + 1144) / 4095 * 255
    high = (-300 + 1144) / 4095 * 255
    lut = bytes(round(max(0, min(255, (v - low) / (high - low) * 255))) for v in range(256))
    assets = []
    for k in range(256):
        name = f'axial/{k:03}.png'
        image = png_gray(256, source[k * 65536:(k + 1) * 65536].translate(lut))
        (OUT / name).write_bytes(image)
        assets.append({'path': name, 'bytes': len(image), 'sha256': sha(image)})
    # Preserve the compressed complete-surface geometry byte-for-byte, but omit all
    # named branch nodes/meshes/materials. No anatomical labels enter this package.
    surface_source = (SOURCE / 'airway_segments.glb').read_bytes()
    if sha(surface_source) != EXPECTED_SURFACE:
        raise SystemExit('Source surface changed. Review before repackaging.')
    json_size = struct.unpack_from('<I', surface_source, 12)[0]
    gltf = json.loads(surface_source[20:20 + json_size])
    original_node = next(n for n in gltf['nodes'] if n.get('name') == 'Complete_airway')
    node = {k: v for k, v in original_node.items() if k in ['matrix', 'translation', 'rotation', 'scale']}
    node.update({'name': 'Complete_airway', 'mesh': 0})
    primitives = [{k: v for k, v in p.items() if k != 'material'} for p in gltf['meshes'][original_node['mesh']]['primitives']]
    clean = {'asset': {'version': '2.0', 'generator': 'Branch tracing preview packager'},
             'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [node],
             'meshes': [{'primitives': primitives}],
             'buffers': gltf['buffers'], 'bufferViews': gltf['bufferViews'],
             'accessors': [{k: v for k, v in a.items() if k not in ['name', 'extras']} for a in gltf['accessors']],
             'extensionsUsed': gltf.get('extensionsUsed', []),
             'extensionsRequired': gltf.get('extensionsRequired', [])}
    encoded = json.dumps(clean, separators=(',', ':')).encode()
    encoded += b' ' * ((-len(encoded)) % 4)
    binary_chunk = surface_source[20 + json_size:]
    surface = struct.pack('<4sII', b'glTF', 2, 20 + len(encoded) + len(binary_chunk)) + struct.pack('<I4s', len(encoded), b'JSON') + encoded + binary_chunk
    (OUT / 'airway.glb').write_bytes(surface)
    assets.append({'path': 'airway.glb', 'bytes': len(surface), 'sha256': sha(surface)})
    # No candidate names, source curve filenames, spreadsheet cells or target routes.
    geometry = {
        'frame': 'LPS-mm',
        'rootNodeId': graph['rootNodeId'],
        'edges': [{k: e[k] for k in ['id', 'startNodeId', 'endNodeId', 'pointsLps']} for e in graph['edges']],
    }
    geometry_bytes = repository_json(geometry, OUT / 'geometry.json')
    (OUT / 'geometry.json').write_bytes(geometry_bytes)
    assets.append({'path': 'geometry.json', 'bytes': len(geometry_bytes), 'sha256': sha(geometry_bytes)})
    result = {
        'schema': 'branch-tracing-preview/v1', 'version': 'preview-v1',
        'sourceCaseCount': 1, 'sourceCtSha256': manifest['provenance']['ctSourceSha256'],
        'sourcePreviewSha256': EXPECTED_CT, 'sourceGraphSha256': sha(graph_raw),
        'frame': 'LPS-mm', 'sizeXyz': meta['sizeXyz'], 'spacingXyzMm': meta['spacingXyzMm'],
        'originLps': meta['originLps'], 'directionLps': meta['directionLps'],
        'sliceCount': 256, 'window': 'Fixed lung contrast exported from the existing quantized 8-bit CT preview; not source HU.',
        'capabilities': {'hasContinuousCtStack': True, 'hasSourceIntensityVolume': False, 'hasReviewedSubsegmentLabels': False, 'hasReviewedJunctionPoses': False, 'hasActualBronchoscopyVideo': False},
        'review': 'Existing public teaching derivative. Ungraded exploration only; new clinical checkpoints require physician review.',
        'airway': {'url': '/branch-tracing/preview-v1/airway.glb', 'sha256': sha(surface), 'sourceSha256': EXPECTED_SURFACE, 'meshName': 'Complete_airway', 'sceneScale': 1000, 'rotationDeg': [90, 0, 0], 'positionOffsetMm': [0, 0, 0]},
        'assets': assets,
    }
    (OUT / 'manifest.json').write_bytes(repository_json(result, OUT / 'manifest.json'))
    print(json.dumps({'slices': 256, 'bytes': sum(a['bytes'] for a in assets), 'clinicalAssessmentEligible': False}))


if __name__ == '__main__':
    main()
