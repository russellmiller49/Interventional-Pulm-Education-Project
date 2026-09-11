"""Build teaching geometry with Blender's bundled Python; all inputs are read-only.

Use --background --factory-startup --python this-file -- --part lumen --source-lumen INPUT.
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
from mathutils import Matrix, Quaternion, Vector
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
    bm.edges.index_update()
    boundary = set(e for e in bm.edges if e.is_boundary)
    # The cut rims are boundary loops on the unchanged triangulated source surface.
    cap_layer = bm.faces.layers.int.new('authored_cap')
    cap_count = 0
    while boundary:
        # Stable cut order makes geometry bytes reproducible across Blender processes.
        edge = min(boundary, key=lambda e: e.index)
        boundary.remove(edge)
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


def primitive_mesh(kind, center, size, rotation_y=0):
    bm = bmesh.new()
    if kind == 'sphere':
        bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=1)
    else:
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=24,
                             radius1=1, radius2=0 if kind == 'cone' else 1, depth=2)
    matrix = Matrix.Translation(Vector(center)) @ Matrix.Rotation(rotation_y, 4, 'Y') @ Matrix.Diagonal((*size, 1))
    bmesh.ops.transform(bm, matrix=matrix, verts=list(bm.verts))
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bm.verts.index_update()
    vertices = [tuple(v.co) for v in bm.verts]
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    return vertices, faces


def join_meshes(name, pieces, **properties):
    vertices, faces = [], []
    for v, f in pieces:
        offset = len(vertices)
        vertices.extend(v)
        faces.extend(tuple(k + offset for k in face) for face in f)
    return {'name': name, 'vertices': vertices, 'faces': faces, **properties}


def build_accessories():
    objects = []
    states = [('forceps-closed', 'ACC_forceps_closed'), ('forceps-open', 'ACC_forceps_open'),
              ('brush-sheathed', 'ACC_brush_sheathed'), ('brush-exposed', 'ACC_brush_exposed'),
              ('needle-sheathed', 'ACC_needle_sheathed'), ('needle-exposed', 'ACC_needle_exposed')]
    for state, name in states:
        kind = state.split('-')[0]
        protected = state.endswith(('closed', 'sheathed'))
        pieces = []
        if kind == 'forceps':
            pieces.append(primitive_mesh('cylinder', (0, 0, -8), (0.8, 0.8, 4)))
            pieces.append(primitive_mesh('sphere', (0, 0, -3.8), (0.8, 0.8, 0.5)))
            for sign in [-1, 1]:
                pieces.append(primitive_mesh('sphere', (sign * (0.4 if protected else 1.45), 0, -1.8),
                                             (0.42, 0.75, 1.8), sign * (0 if protected else 0.62)))
        else:
            sheath_end = 0 if protected else (-5.5 if kind == 'brush' else -4)
            pieces.append(primitive_mesh('cylinder', (0, 0, (-12 + sheath_end) / 2),
                                         (0.7, 0.7, (12 + sheath_end) / 2)))
            if not protected and kind == 'needle':
                pieces.append(primitive_mesh('cylinder', (0, 0, -2.6), (0.26, 0.26, 1.4)))
                pieces.append(primitive_mesh('cone', (0, 0, -0.6), (0.26, 0.26, 0.6)))
            if not protected and kind == 'brush':
                pieces.append(primitive_mesh('cylinder', (0, 0, -2.8), (0.18, 0.18, 2.8)))
                for row in range(10):
                    z = -5 + row * 0.5
                    for i in range(12):
                        angle = 2 * math.pi * (i / 12 + row / 48)
                        # Radial bristles are actual geometry so silhouettes distinguish states.
                        direction = Vector((math.cos(angle), math.sin(angle), 0.1)).normalized()
                        v, f = primitive_mesh('cylinder', (0, 0, 0), (0.045, 0.045, 0.7))
                        q = Vector((0, 0, 1)).rotation_difference(direction)
                        center = Vector((0, 0, z)) + direction * 0.8
                        pieces.append(([tuple(center + q @ Vector(p)) for p in v], f))
        obj = join_meshes(name, pieces, color=[0.7, 0.72, 0.75, 1], metallic=0.6, roughness=0.32,
                          extras={'numberClass': 'authored-for-simulation', 'coordinateSystem': 'accessory-local',
                                  'forwardAxis': '+Z', 'origin': 'distal-most tip', 'state': state, 'protected': protected})
        # All states share a distal-tip origin; scene offsets have exactly one interpretation.
        max_z = max(v[2] for v in obj['vertices'])
        obj['vertices'] = [(x, y, z - max_z) for x, y, z in obj['vertices']]
        if kind == 'brush' and not protected:
            obj['color'] = [0.76, 0.62, 0.33, 1]
            obj['metallic'] = 0.15
        objects.append(obj)
    write_glb(CACHE / 'accessories.raw.glb', objects,
              {'numberClass': 'authored-for-simulation', 'units': 'mm', 'clinicalReviewStatus': 'pending'})
    devices = {'schema': 'bronchoscopy_foundations_devices/v1', 'units': 'mm',
               'numberClass': 'authored-for-simulation', 'source': 'scope asset brief and authored geometric model',
               'authoredDate': '2026-09-11', 'clinicalReviewStatus': 'pending',
               'interpretation': 'Teaching geometry only. Dimensions and offsets are not manufacturer specifications or compatibility claims.',
               'coordinateConvention': {'forwardAxis': '+Z', 'origin': 'distal-most accessory point',
                                        'placement': 'Place the named node origin at the specified distance beyond the scope tip; rotate +Z along the scope forward axis.'},
               'tubes': [{'id': f'ett-{id_mm:.1f}', 'kind': 'ett', 'idMm': id_mm, 'odMm': od_mm,
                          'lengthMm': 35, 'startMm': 35, 'tipMm': 70, 'edgeId': 0,
                          'lengthMeaning': 'Authored visible tracheal segment, not total device length',
                          'numberClass': 'authored-for-simulation'}
                         for id_mm, od_mm in [(7.0, 9.4), (7.5, 10.0), (8.0, 10.7)]],
               'accessories': [{'kind': kind, 'tipOffsetBeyondScopeTipMm': {'at-tip': 2.5, 'extended': 10},
                                'inChannelVisible': False, 'numberClass': 'authored-for-simulation',
                                'states': [{'state': state, 'node': name,
                                            'protected': state.endswith(('closed', 'sheathed'))}
                                           for state, name in states if state.startswith(kind)]}
                               for kind in ['forceps', 'brush', 'needle']]}
    output = ASSETS / 'devices/devices.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(devices, indent=2) + '\n')
    print('Built six authored accessory states and device dimensions.')


def build_larynx(source):
    """Author a wall shell around a registered cartilage/ligament reference.

    The shell is watertight, with patent luminal end rings. It is display geometry,
    not an air-volume collider; the existing engine scripts glottic passage.
    Source-inlet preservation is enforced; the junction remains explicitly pending.
    """
    source_doc, access = read_glb(source)
    flattened = {}

    def visit(index, parent):
        node = source_doc['nodes'][index]
        if 'matrix' in node:
            values = node['matrix']
            local = Matrix([values[i::4] for i in range(4)])
        else:
            q = node.get('rotation', [0, 0, 0, 1])
            local = Matrix.LocRotScale(Vector(node.get('translation', [0, 0, 0])),
                                       Quaternion((q[3], *q[:3])), Vector(node.get('scale', [1, 1, 1])))
        world = parent @ local
        if 'mesh' in node:
            pieces = []
            for primitive in source_doc['meshes'][node['mesh']]['primitives']:
                verts = [tuple(world @ Vector(p)) for p in access(primitive['attributes']['POSITION'])]
                indices = [p[0] for p in access(primitive['indices'])]
                pieces.append((verts, list(zip(indices[::3], indices[1::3], indices[2::3]))))
            flattened[node['name']] = join_meshes(node['name'], pieces)
        for child in node.get('children', []):
            visit(child, world)

    for index in source_doc['scenes'][source_doc.get('scene', 0)]['nodes']:
        visit(index, Matrix.Identity(4))
    vocal = flattened['Vocal_Ligament']['vertices'] + flattened['Vical_Ligament01']['vertices']
    center = sum((Vector(v) for v in vocal), Vector()) / len(vocal)
    cricoid = flattened['Cricoid_cartilage']['vertices']
    epiglottis = flattened['Epoglottis']['vertices']
    scales = [18 / (max(p[0] for p in cricoid) - min(p[0] for p in cricoid)),
              25 / (max(p[1] for p in epiglottis) - center.y),
              16 / (max(p[2] for p in cricoid) - min(p[2] for p in cricoid))]
    # Use the engine's two-millimetre proximal tangent, avoiding rounded 0.01 mm samples.
    root = Vector(next(n for n in GRAPH['graph']['nodes'] if n['id'] == 0)['lps'])
    points = [Vector(p) for p in next(e for e in GRAPH['graph']['edges'] if e['id'] == 0)['pointsLps']]
    remaining, ahead = 2.0, points[0]
    for a, b in zip(points, points[1:]):
        length = (b - a).length
        if length >= remaining:
            ahead = a.lerp(b, remaining / length)
            break
        remaining -= length
    forward = (ahead - root).normalized()
    left = (Vector((1, 0, 0)) - forward * forward.x).normalized()
    anterior = forward.cross(left).normalized()

    def to_lps(p):
        return tuple(root + left * p[0] + anterior * p[1] + forward * (p[2] - 45))

    def register(p):
        return ((p[0] - center.x) * scales[0], (p[2] - center.z) * scales[2],
                30 - (p[1] - center.y) * scales[1])

    stations = [(0, 12, 11), (10, 10.5, 10), (22, 9.2, 9), (30, 8.4, 8.1),
                (36, 6.8, 6.8), (45, 6.11, 6.11)]

    def radii(s):
        for a, b in zip(stations, stations[1:]):
            if s <= b[0]:
                t = max(0, (s - a[0]) / (b[0] - a[0]))
                t = t * t * (3 - 2 * t)
                return a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t
        return stations[-1][1:]

    def sleeve(start, end):
        count, radial = round((end - start) * 2), 96
        vertices, faces = [], []
        for layer in range(2):
            for i in range(count + 1):
                s = start + (end - start) * i / count
                rx, ry = radii(s)
                for j in range(radial):
                    theta = 2 * math.pi * j / radial
                    vertices.append(((rx + layer * 0.75) * math.cos(theta),
                                     (ry + layer * 0.75) * math.sin(theta), s))
        width = (count + 1) * radial
        for layer in range(2):
            for i in range(count):
                for j in range(radial):
                    a = layer * width + i * radial + j
                    b = layer * width + i * radial + (j + 1) % radial
                    quad = (a, b, b + radial, a + radial)
                    if layer == 0:
                        quad = quad[::-1]
                    faces.extend([(quad[0], quad[1], quad[2]), (quad[0], quad[2], quad[3])])
        for i in [0, count]:
            for j in range(radial):
                a, b = i * radial + j, i * radial + (j + 1) % radial
                q = (a, b, b + width, a + width)
                if i == count:
                    q = q[::-1]
                faces.extend([(q[0], q[1], q[2]), (q[0], q[2], q[3])])
        return vertices, faces

    def fold(sign, true):
        outline, inner_indices = [], []
        count = 48
        for i in range(count + 1):
            t = i / count
            y = -8 + 16 * t
            x = (3.9 * math.sin(math.pi * t) * (1 - 0.45 * t) if true
                 else 6.1 * math.sqrt(max(0.005, 1 - (y / 8.15) ** 2)))
            outline.append((sign * x, y))
            inner_indices.append(i)
        for i in range(count, -1, -1):
            y = -8 + 16 * i / count
            x = (8.3 if true else 9.1) * math.sqrt(max(0.005, 1 - (y / 8.15) ** 2)) + 0.05
            outline.append((sign * x, y))
        s = 30 if true else 25
        thickness = 1.6 if true else 2.4
        vertices = [(x, y, s + dz) for dz in [-thickness / 2, thickness / 2] for x, y in outline]
        n = len(outline)
        mesh = bpy.data.meshes.new('authored_fold')
        quads = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
        quads.extend((i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n))
        mesh.from_pydata(vertices, [], quads)
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.triangulate(bm, faces=list(bm.faces))
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.verts.index_update()
        faces = [tuple(v.index for v in f.verts) for f in bm.faces]
        bm.free()
        morph = list(vertices)
        for i in inner_indices:
            for layer in [0, 1]:
                index = i + layer * n
                _, y, z = vertices[index]
                morph[index] = (0, y, z)
        return vertices, faces, morph

    objects = []
    for name, a, b in [('UA_lumen', 0, 32), ('UA_subglottis', 32, 45)]:
        objects.append(join_meshes(name, [sleeve(a, b)],
                                   extras={'geometrySemantics': 'watertight mucosal wall shell; patent end rings; not an air-volume collider'}))
    for side, sign in [('L', 1), ('R', -1)]:
        for true in [True, False]:
            v, f, morph = fold(sign, true)
            obj = join_meshes(f'UA_fold_{"true" if true else "false"}_{side}', [(v, f)],
                              color=[0.92, 0.81, 0.66, 1] if true else [0.7, 0.33, 0.3, 1])
            if true:
                obj['morph'] = morph
                obj['extras'] = {'morphStates': {'abducted': 0, 'narrowing': 0.5, 'adducted': 1}}
            objects.append(obj)
    reused = {'Epoglottis': 'UA_epiglottis', 'Left_Arytenoid_cartilage': 'UA_arytenoid_L',
              'Right_Arytenoid_cartilage': 'UA_arytenoid_R'}
    for old, new in reused.items():
        src = flattened[old]
        objects.append(join_meshes(new, [([register(p) for p in src['vertices']], src['faces'])],
                                  extras={'origin': 'registered cartilage reference; authored mucosal appearance'}))
    # Cartilage and ligament framework is optional and hidden by the eventual scene by default.
    skeleton = [([register(p) for p in obj['vertices']], obj['faces']) for name, obj in flattened.items()
                if name not in reused and name != 'Trachea']
    objects.append(join_meshes('UA_skeleton', skeleton, color=[0.67, 0.77, 0.76, 1],
                               extras={'defaultVisible': False, 'origin': 'registered cartilage and ligament reference'}))
    for obj in objects:
        obj['vertices'] = [to_lps(p) for p in obj['vertices']]
        if obj.get('morph'):
            obj['morph'] = [to_lps(p) for p in obj['morph']]
        obj['extras'] = {**obj.get('extras', {}), 'coordinateSystem': 'LPS', 'numberClass': 'authored-for-simulation'}
    write_glb(CACHE / 'larynx.raw.glb', objects,
              {'clinicalReviewStatus': 'pending', 'numberClass': 'authored-for-simulation'})
    ring = [to_lps((6.11 * math.cos(2 * math.pi * i / 96), 6.11 * math.sin(2 * math.pi * i / 96), 45)) for i in range(96)]
    larynx = {'schema': 'bronchoscopy_foundations_larynx/v1', 'units': 'mm', 'coordinateSystem': 'LPS',
              'numberClass': 'authored-for-simulation', 'authoredDate': '2026-09-11',
              'pathLps': [list(to_lps((0, 0, i * 0.5))) for i in range(91)], 'glottisMm': 30, 'exitMm': 45,
              'exitRingLps': ring, 'frameLps': {'forward': list(forward), 'left': list(left), 'anterior': list(anterior)},
              'sourceSha256': hashlib.sha256(Path(source).read_bytes()).hexdigest(),
              'registration': {'method': 'Authored nonrigid reference placement: paired vocal-ligament centroid at the 30 mm glottis, cricoid reference 18 mm lateral by 16 mm anteroposterior, epiglottis superior edge at 5 mm.',
                               'sourceVocalCentroid': list(center), 'sourceToModelAxisScales': scales},
              'authoredParameters': {'radialSegments': 96, 'longitudinalSpacingMm': 0.5, 'wallThicknessMm': 0.75,
                                     'lumenStationsMm': stations, 'trueFoldThicknessMm': 1.6, 'falseFoldThicknessMm': 2.4,
                                     'falseFoldsMm': 25, 'subglottisStartMm': 32, 'morphWeights': [0, 0.5, 1]},
              'geometrySemantics': 'Watertight wall shells with open luminal end rings. The engine scripts glottic passage; this is not an air-volume collider.',
              'junction': {'status': 'pending-source-inlet-decision', 'pathEndpointGapMm': 0,
                           'limitation': 'The unchanged case-001 source is capped at graph node 0; path alignment does not establish a continuous full-size opening.'},
              'clinicalReviewStatus': 'pending'}
    # Preserve the exact JSON coordinate at the handoff, independently of floating-point basis math.
    larynx['pathLps'][-1] = next(n['lps'] for n in GRAPH['graph']['nodes'] if n['id'] == 0)
    output = ASSETS / 'larynx/larynx.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(larynx, indent=2) + '\n')
    print('Built authored larynx and three-state true folds; source inlet decision remains pending.')


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--part', required=True, choices=['lumen', 'accessories', 'larynx'])
    p.add_argument('--source-lumen', type=Path)
    p.add_argument('--source-larynx', type=Path)
    args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
    CACHE.mkdir(parents=True, exist_ok=True)
    if args.part == 'lumen':
        if not args.source_lumen:
            p.error('--source-lumen is required; the reviewed reference is read-only')
        build_lumen(args.source_lumen)
    elif args.part == 'accessories':
        build_accessories()
    elif args.part == 'larynx':
        if not args.source_larynx:
            p.error('--source-larynx is required; the reference is read-only')
        build_larynx(args.source_larynx)
