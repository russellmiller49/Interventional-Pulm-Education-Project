"""Build teaching geometry with Blender's bundled Python; all inputs are read-only.

Use --background --factory-startup --python this-file -- --part lumen.
Outputs are confined to this checkout. Compression and runtime review are separate steps.
All modelling dimensions and trimming choices are authored simulation values.
"""
import argparse
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'public/bronchoscopy-foundations/anatomy'
PROFILE = 'adult-teaching-combined-left-basal-v1'
CACHE = ROOT / 'artifacts/scope-assets'
GRAPH = json.loads((ASSETS / PROFILE / 'graph.json').read_text())


def read_glb(filename):
    data = Path(filename).read_bytes()
    size = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + size])
    binary = data[28 + size:]

    def accessor(index):
        a = doc['accessors'][index]
        v = doc['bufferViews'][a['bufferView']]
        code = {5126: 'f', 5125: 'I', 5123: 'H', 5121: 'B'}[a['componentType']]
        width = {'VEC3': 3, 'VEC2': 2, 'VEC4': 4, 'SCALAR': 1}[a['type']]
        fmt = '<' + code * width
        offset = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = v.get('byteStride', struct.calcsize(fmt))
        return [struct.unpack_from(fmt, binary, offset + i * stride) for i in range(a['count'])]

    return doc, accessor


def write_glb(filename, objects, extras=None):
    """Write patient coordinates directly: no implicit DCC axis or unit conversion."""
    doc = {'asset': {'version': '2.0', 'generator': 'scope-assets authored geometry builder'},
           'scene': 0, 'scenes': [{'nodes': list(range(len(objects)))}],
           'nodes': [], 'meshes': [], 'materials': [], 'accessors': [], 'bufferViews': []}
    if extras:
        doc['extras'] = extras
    binary = bytearray()

    def accessor(values, width, code, kind):
        while len(binary) % 4:
            binary.append(0)
        start = len(binary)
        for value in values:
            binary.extend(struct.pack('<' + code * width, *value))
        view = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': start, 'byteLength': len(binary) - start})
        a = {'bufferView': view, 'componentType': {'f': 5126, 'I': 5125}[code],
             'count': len(values), 'type': kind}
        if kind == 'VEC3':
            a['min'] = [min(v[k] for v in values) for k in range(3)]
            a['max'] = [max(v[k] for v in values) for k in range(3)]
        index = len(doc['accessors'])
        doc['accessors'].append(a)
        return index

    for i, item in enumerate(objects):
        verts, faces = item['vertices'], item['faces']
        normals = [Vector((0, 0, 0)) for _ in verts]
        for face in faces:
            a, b, c = (Vector(verts[k]) for k in face)
            n = (b - a).cross(c - a)
            for k in face:
                normals[k] += n
        normals = [tuple(n.normalized()) for n in normals]
        primitive = {'attributes': {'POSITION': accessor(verts, 3, 'f', 'VEC3'),
                                    'NORMAL': accessor(normals, 3, 'f', 'VEC3')},
                     'indices': accessor([(k,) for face in faces for k in face], 1, 'I', 'SCALAR'),
                     'material': i}
        doc['materials'].append({'name': item['name'] + '_material', 'doubleSided': True,
                                'pbrMetallicRoughness': {'baseColorFactor': item.get('color', [0.66, 0.29, 0.25, 1]),
                                                        'metallicFactor': item.get('metallic', 0),
                                                        'roughnessFactor': item.get('roughness', 0.62)}})
        mesh = {'name': item['name'], 'primitives': [primitive]}
        if item.get('morph'):
            delta = [tuple(Vector(b) - Vector(a)) for a, b in zip(verts, item['morph'])]
            primitive['targets'] = [{'POSITION': accessor(delta, 3, 'f', 'VEC3')}]
            mesh['extras'] = {'targetNames': ['adduct']}
            mesh['weights'] = [0]
        doc['meshes'].append(mesh)
        doc['nodes'].append({'name': item['name'], 'mesh': i,
                             'extras': {'units': 'mm', **item.get('extras', {})}})
    while len(binary) % 4:
        binary.append(0)
    doc['buffers'] = [{'byteLength': len(binary)}]
    js = json.dumps(doc, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    out = struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(binary))
    out += struct.pack('<II', len(js), 0x4E4F534A) + js
    out += struct.pack('<II', len(binary), 0x004E4942) + binary
    filename.parent.mkdir(parents=True, exist_ok=True)
    filename.write_bytes(out)


def build_lumen(source):
    doc, access = read_glb(source)
    primitive = doc['meshes'][0]['primitives'][0]
    vertices = access(primitive['attributes']['POSITION'])
    indices = [x[0] for x in access(primitive['indices'])]
    faces = list(zip(indices[::3], indices[1::3], indices[2::3]))
    original = BVHTree.FromPolygons(vertices, faces, all_triangles=True)
    source_graph = json.loads((ROOT / 'public/airway-anatomy/case-001/metadata/airway_graph.json').read_text())
    labels = json.loads((ROOT / 'public/airway-anatomy/case-001/metadata/centerline_labels.json').read_text())['edgeLabels']
    edges = {e['id']: e for e in source_graph['edges']}
    nodes = {n['id']: n for n in source_graph['nodes']}
    segments = {'RB' + str(i) for i in range(1, 11)} | {'LB1+2', 'LB3', 'LB4', 'LB5', 'LB6', 'LB7+8', 'LB9', 'LB10'}
    depth = {}

    def walk(edge_id, parent_depth):
        label = labels.get(str(edge_id), {}).get('abbreviatedLabel')
        d = (0 if label in segments else None) if parent_depth is None else parent_depth + 1
        depth[edge_id] = d
        for child in nodes[edges[edge_id]['endNodeId']]['childEdgeIds']:
            walk(child, d)

    for edge_id in nodes[source_graph['rootNodeId']]['childEdgeIds']:
        walk(edge_id, None)
    # Half of the second daughter generation remains beyond a segmental origin.
    # Dense source centerline ownership limits trimming to the distal surface.
    samples, keep = [], []
    for edge in source_graph['edges']:
        pts = [Vector(p) for p in edge['pointsLps']]
        total = sum((b - a).length for a, b in zip(pts, pts[1:]))
        distance = 0
        for a, b in zip(pts, pts[1:]):
            length = (b - a).length
            count = max(1, math.ceil(length / 0.5))
            for i in range(count):
                t = i / count
                d = depth[edge['id']]
                samples.append(a.lerp(b, t))
                keep.append(d is None or d < 2 or (d == 2 and distance + length * t <= total * 0.5))
            distance += length
    tree = KDTree(len(samples))
    for i, p in enumerate(samples):
        tree.insert(p, i)
    tree.balance()
    mesh = bpy.data.meshes.new('source_lumen')
    mesh.from_pydata(vertices, [], faces)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    remove = [v for v in bm.verts if not keep[tree.find(v.co)[1]]]
    bmesh.ops.delete(bm, geom=remove, context='VERTS')
    # Retain only the connected component containing the proximal source lumen.
    remaining = set(bm.verts)
    components = []
    while remaining:
        seed = remaining.pop()
        component, stack = {seed}, [seed]
        while stack:
            current = stack.pop()
            for edge in current.link_edges:
                other = edge.other_vert(current)
                if other in remaining:
                    remaining.remove(other)
                    component.add(other)
                    stack.append(other)
        components.append(component)
    largest = max(components, key=len)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v not in largest], context='VERTS')
    bmesh.ops.delete(bm, geom=[e for e in bm.edges if e.is_wire], context='EDGES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_edges], context='VERTS')
    # Remove one-vertex bridges at the cut so each rim is a simple cycle.
    for _ in range(20):
        singular = [v for v in bm.verts if sum(e.is_boundary for e in v.link_edges) > 2]
        if not singular:
            break
        bmesh.ops.delete(bm, geom=singular, context='VERTS')
        bmesh.ops.delete(bm, geom=[e for e in bm.edges if e.is_wire], context='EDGES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_edges], context='VERTS')
    boundary = set(e for e in bm.edges if e.is_boundary)
    # The cut rims are boundary loops on the unchanged triangulated source surface.
    cap_layer = bm.faces.layers.int.new('authored_cap')
    cap_count = 0
    while boundary:
        edge = boundary.pop()
        start, current = edge.verts
        loop = [start, current]
        while current != start:
            candidates = [e for e in current.link_edges if e in boundary]
            assert len(candidates) == 1, 'Cut rim is not a simple cycle'
            edge = candidates[0]
            boundary.remove(edge)
            current = edge.other_vert(current)
            if current != start:
                loop.append(current)
        center = bm.verts.new(sum((v.co for v in loop), Vector()) / len(loop))
        for a, b in zip(loop, loop[1:] + loop[:1]):
            face = bm.faces.new((a, b, center))
            face[cap_layer] = 1
        cap_count += 1
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.normal_update()
    bm.verts.index_update()
    out_verts = [tuple(v.co) for v in bm.verts]
    out_faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    cap_indices = [i for i, f in enumerate(bm.faces) if f[cap_layer]]
    nonmanifold = sum(not e.is_manifold for e in bm.edges)
    assert nonmanifold == 0, f'{nonmanifold} non-manifold edges'
    assert len(out_faces) <= 250000, f'{len(out_faces)} triangles; decimation needed'
    assert bm.calc_volume(signed=True) > 0, 'Normals must face outward'
    path = CACHE / 'lumen.raw.glb'
    write_glb(path, [{'name': 'PatientLpsLumen', 'vertices': out_verts, 'faces': out_faces,
                     'extras': {'coordinateSystem': 'LPS', 'surface': 'case-001 derived; distal caps authored'}}])
    report = {'schema': 'bronchoscopy_foundations_surface_build/v1',
              'sourceSha256': hashlib.sha256(Path(source).read_bytes()).hexdigest(),
              'sourceTriangles': len(faces), 'triangles': len(out_faces), 'vertices': len(out_verts),
              'connectedComponents': 1, 'nonManifoldEdges': nonmanifold, 'outwardNormals': True,
              'authoredCaps': cap_count, 'authoredCapTriangles': len(cap_indices), 'removedDisconnectedComponents': len(components) - 1,
              'trimming': 'Source centerline ownership; retain through half the second generation beyond segmental origins; close simple cut rims with triangle fans.',
              'decimation': 'None: retained source vertices and triangles are unchanged before Draco.',
              'authoredParameters': {'centerlineSampleSpacingMm': 0.5, 'maxGenerationBeyondSegmentalOrigin': 2, 'lastGenerationFraction': 0.5}}
    (CACHE / 'lumen-build.json').write_text(json.dumps(report, indent=2) + '\n')
    # Kept only in the disposable build cache for post-compression deviation measurements.
    (CACHE / 'lumen-caps.json').write_text(json.dumps({'triangles': [[out_verts[k] for k in out_faces[i]] for i in cap_indices]}))
    print(json.dumps(report))
    bm.free()


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--part', required=True, choices=['lumen'])
    p.add_argument('--source-lumen', type=Path, default=ROOT / 'public/airway-anatomy/case-001/lumen-v2.glb')
    args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
    CACHE.mkdir(parents=True, exist_ok=True)
    if args.part == 'lumen':
        build_lumen(args.source_lumen)
