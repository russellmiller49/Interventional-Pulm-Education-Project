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
        if item.get('colors'):
            # Linear RGBA per vertex; the material's base colour multiplies it.
            primitive['attributes']['COLOR_0'] = accessor(item['colors'], 4, 'f', 'VEC4')
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


def organic(vertices, faces, thickness=0.0, levels=2):
    """Round an authored control mesh: optional wall thickness, then subdivision."""
    mesh = bpy.data.meshes.new('authored')
    mesh.from_pydata([tuple(v) for v in vertices], [], [tuple(f) for f in faces])
    obj = bpy.data.objects.new('authored', mesh)
    bpy.context.collection.objects.link(obj)
    if thickness:
        solid = obj.modifiers.new('Thickness', 'SOLIDIFY')
        solid.thickness, solid.offset = thickness, 0
    if levels:
        obj.modifiers.new('Rounded', 'SUBSURF').levels = levels
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    result = evaluated.to_mesh()
    bm = bmesh.new()
    bm.from_mesh(result)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.verts.index_update()
    out = ([tuple(v.co) for v in bm.verts], [tuple(v.index for v in f.verts) for f in bm.faces])
    bm.free()
    evaluated.to_mesh_clear()
    bpy.data.objects.remove(obj)
    return out


def sheet(point, nu, nv):
    """A grid surface from point(u, v), u and v in 0..1."""
    vertices = [point(i / (nu - 1), j / (nv - 1)) for j in range(nv) for i in range(nu)]
    faces = [(j * nu + i, j * nu + i + 1, (j + 1) * nu + i + 1, (j + 1) * nu + i)
             for j in range(nv - 1) for i in range(nu - 1)]
    return vertices, faces


def tube(points, radii, sides=10, flatten=1.0):
    """A capped, rounded tube along a polyline, with a radius at each point.

    `flatten` scales the section across the model's long axis, for a bar that is taller than thick.
    """
    points = [Vector(p) for p in points]
    vertices, faces = [], []
    long_axis = Vector((0, 0, 1))
    for i, point in enumerate(points):
        tangent = (points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]).normalized()
        reference = long_axis if abs(tangent.dot(long_axis)) < 0.9 else Vector((0.31, 0.95, 0))
        side = tangent.cross(reference).normalized()
        up = side.cross(tangent)
        for k in range(sides):
            a = 2 * math.pi * k / sides
            vertices.append(tuple(point + (side * math.cos(a) * flatten + up * math.sin(a)) * radii[i]))
    for i in range(len(points) - 1):
        for k in range(sides):
            a, b = i * sides + k, i * sides + (k + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    for index, flip in ((0, True), (len(points) - 1, False)):
        centre = len(vertices)
        vertices.append(tuple(points[index]))
        for k in range(sides):
            tri = (index * sides + k, index * sides + (k + 1) % sides, centre)
            faces.append(tri[::-1] if flip else tri)
    return organic(vertices, faces, levels=1)


def hull(points):
    """The convex hull of a few points, as a control mesh to round."""
    bm = bmesh.new()
    verts = [bm.verts.new(p) for p in points]
    bmesh.ops.convex_hull(bm, input=verts)
    bm.verts.index_update()
    out = ([tuple(v.co) for v in bm.verts], [tuple(v.index for v in f.verts) for f in bm.faces])
    bm.free()
    return out


def larynx_framework(radii, relief):
    """The laryngeal skeleton, authored for this model: no supplied mesh is read or reused.

    Coordinates are the larynx model's own: x toward the patient's left, y anterior, z the distance
    down the scope's path in millimetres (the glottis is at 30, the model's exit at 45). The
    cartilages are placed round the authored mucosal tube. Their overall proportions were checked
    against the owner's own head-and-neck CT segmentation (thyroid cartilage about 46 mm wide,
    cricoid about 35 by 32 mm, hyoid about 41 mm wide); a published larynx model was looked at for
    the shapes and none of its geometry is used. Presentation values for a teaching model, not
    measurements of a patient.
    """
    def smooth(t):
        t = max(0.0, min(1.0, t))
        return t * t * (3 - 2 * t)

    # Thyroid cartilage: two laminae meeting in front at the laryngeal prominence, with the notch
    # above it; one sheet across both sides, creased on the midline.
    def thyroid_edge(u):
        # The upper border climbs from the notch to the superior tubercle and runs back to the horn;
        # the lower border dips at the inferior tubercle.
        top = 21.0 - 10.5 * smooth(u / 0.24) + 1.4 * smooth((u - 0.4) / 0.5)
        bottom = 38.0 + 1.8 * math.exp(-((u - 0.62) / 0.16) ** 2) - 1.2 * math.exp(-((u - 0.25) / 0.18) ** 2)
        return top, bottom

    def thyroid_point(w, v):
        u = abs(w)
        top, bottom = thyroid_edge(u)
        depth = top + (bottom - top) * v
        prominence = 1.6 * math.exp(-(u / 0.16) ** 2) * math.exp(-((depth - 25) / 6) ** 2)
        x = 21.8 * u ** 0.8 * (1 + 0.05 * math.sin(math.pi * v))
        return (math.copysign(x, w) if u > 1e-9 else 0.0, 13.0 - 25.5 * u ** 1.12 + prominence, depth)

    thyroid = [organic(*sheet(lambda a, b: thyroid_point(2 * a - 1, b), 33, 13), thickness=2.4, levels=2)]
    back = thyroid_point(1, 0.5)
    for sign in (1, -1):
        x, y = sign * back[0], back[1]
        thyroid.append(tube([(x, y + 1.0, 16), (x + sign * 0.4, y - 0.8, 9), (x, y - 2.2, 3), (x - sign * 1.2, y - 2.8, -0.5)],
                            [2.0, 1.7, 1.4, 1.2]))
        thyroid.append(tube([(x, y + 1.0, 36.5), (x - sign * 2.4, y + 1.6, 41.5), (x - sign * 7.8, y + 3.6, 45.0)],
                            [2.0, 1.8, 1.7]))

    # Cricoid: a signet ring, a low arch in front and a tall lamina behind.
    def cricoid_ring(theta):
        behind = smooth((-math.sin(theta) - 0.1) / 0.7)
        wall = 3.0 + 1.2 * behind
        ix, iy = 8.6 * math.cos(theta), -0.5 + 9.2 * math.sin(theta)
        ox, oy = (8.6 + wall) * math.cos(theta), -0.5 + (9.2 + wall) * math.sin(theta)
        top, bottom = 42.5 - 15.0 * behind, 48.5 + 0.8 * behind
        return [(ix, iy, top), (ox, oy, top), (ox, oy, bottom), (ix, iy, bottom)]

    count = 48
    ring_vertices, ring_faces = [], []
    for i in range(count):
        ring_vertices.extend(cricoid_ring(2 * math.pi * i / count))
    for i in range(count):
        for k in range(4):
            a, b = i * 4 + k, i * 4 + (k + 1) % 4
            c, d = ((i + 1) % count) * 4 + (k + 1) % 4, ((i + 1) % count) * 4 + k
            ring_faces.append((d, c, b, a))
    cricoid = organic(ring_vertices, ring_faces, levels=2)

    # Arytenoids: a pyramid on each shoulder of the cricoid lamina, vocal process forward,
    # muscular process out to the side, with the corniculate cartilage on its apex.
    arytenoids = {}
    for side, sign in (('L', 1), ('R', -1)):
        body = organic(*hull([(sign * 3.6, -4.6, 29.6), (sign * 10.4, -9.6, 28.4), (sign * 3.4, -11.2, 27.8),
                              (sign * 4.6, -10.0, 16.8), (sign * 7.4, -7.4, 27.0), (sign * 6.2, -11.6, 24.5),
                              (sign * 3.2, -9.2, 22)]), levels=2)
        tip = primitive_mesh('sphere', (sign * 4.2, -10.6, 15.8), (1.4, 1.5, 1.7))
        arytenoids[side] = [body, tip]

    # Epiglottis: a leaf standing on its stalk inside the thyroid angle, lying on the front wall of
    # the vestibule and rising above the inlet behind the hyoid. Its edges turn backward.
    def front_wall(depth):
        return radii(max(depth, 0))[1] - relief(math.pi / 2, max(depth, 0))

    def epiglottis_point(a, b):
        w = 2 * a - 1
        depth = 24 - 37 * b
        lean = 0.02 * depth * depth if depth < 0 else 0.0
        centre = front_wall(depth) + 1.3 - lean
        # A narrow stalk inside the thyroid angle, widening only above the cartilage's upper border.
        half = 1.3 + 7.9 * smooth((b - 0.14) / 0.42) * (1 - 0.4 * smooth((b - 0.72) / 0.28))
        return (w * half, centre - 4.4 * w * w * (half / 9.2), depth)

    epiglottis = organic(*sheet(epiglottis_point, 13, 25), thickness=1.8, levels=2)

    # Hyoid: a flattened body in front, the greater horns running back, the lesser horns on the joins.
    arc = [math.radians(48 + 84 * i / 10) for i in range(11)]
    bar = [(17.5 * math.cos(a), -1.0 + 17.5 * math.sin(a), -4.5) for a in arc]
    hyoid = [tube(bar, [2.6, 3.3] + [3.9] * 7 + [3.3, 2.6], sides=12, flatten=0.5)]
    for sign in (1, -1):
        start = (sign * abs(bar[0][0]), bar[0][1], -4.5)
        hyoid.append(tube([start, (sign * 16.0, 6.5, -5.0), (sign * 19.6, -3.0, -6.0), (sign * 21.4, -12.0, -7.0),
                           (sign * 21.8, -15.5, -7.6)], [2.5, 2.3, 1.9, 1.6, 1.9], sides=12, flatten=0.65))
        hyoid.append(tube([start, (sign * 12.8, 11.2, -8.6), (sign * 12.2, 10.0, -11.2)], [1.5, 1.2, 0.6]))

    # The first tracheal rings below the cricoid: C-shaped, open behind.
    rings = []
    for depth in (52.6, 57.6, 62.6):
        angles = [math.radians(-52 + 284 * i / 24) for i in range(25)]
        rings.append(tube([(8.6 * math.cos(a), -0.3 + 8.6 * math.sin(a), depth) for a in angles],
                          [2.0] * 25, flatten=0.5))

    # The tracheal wall the rings sit on, for the outside view only: the scope view draws the
    # case's own trachea below the model's exit.
    def trachea(a, b):
        radius = 6.9 + 0.6 * smooth(b / 0.4)
        return (radius * math.cos(2 * math.pi * a), -0.3 * b + radius * math.sin(2 * math.pi * a), 45 + 21 * b)

    # Membranes: the thyrohyoid membrane hanging from the hyoid to the thyroid cartilage's upper
    # border, and the median cricothyroid ligament between that cartilage and the cricoid arch.
    def thyrohyoid(a, b):
        w = 2 * a - 1
        u = abs(w)
        if u < 0.42:
            angle = math.radians(90 - 100 * w)
            upper = (17.5 * math.cos(angle), -1.0 + 17.5 * math.sin(angle), -2.2)
        else:
            t = (u - 0.42) / 0.58
            sign = 1 if w > 0 else -1
            upper = (sign * (11.7 + 8.6 * t), 12.0 - 25.0 * t ** 1.1, -2.6 - 3.2 * t)
        lower = thyroid_point(w, 0.0)
        # It bows a little forward over the fat in front of the epiglottis.
        bow = 1.0 * math.sin(math.pi * b) * (1 - u) ** 2
        return tuple(upper[k] + (lower[k] - upper[k]) * b + (bow if k == 1 else 0) for k in range(3))

    def cricothyroid(a, b):
        w = (2 * a - 1) * 0.3
        upper = thyroid_point(w, 1.0)
        theta = math.radians(90 - 110 * w)
        lower = (11.4 * math.cos(theta), -0.5 + 12.0 * math.sin(theta), 42.6)
        return tuple(upper[k] + (lower[k] - upper[k]) * b for k in range(3))

    return {
        'UA_thyroid': thyroid,
        'UA_cricoid': [cricoid],
        'UA_arytenoid_L': arytenoids['L'],
        'UA_arytenoid_R': arytenoids['R'],
        'UA_epiglottis': [epiglottis],
        'UA_hyoid': hyoid,
        'UA_tracheal_rings': rings,
        'UA_trachea_wall': [organic(*sheet(trachea, 33, 8), levels=1)],
        'UA_thyrohyoid_membrane': [organic(*sheet(thyrohyoid, 25, 5), levels=1)],
        'UA_cricothyroid_ligament': [organic(*sheet(cricothyroid, 9, 4), levels=1)],
    }


def build_larynx():
    """Author the model larynx: mucosal wall, folds and the laryngeal skeleton round them.

    Every mesh is authored here. No supplied model is read.
    The wall shells are watertight, with patent luminal end rings. They are display geometry,
    not an air-volume collider; the existing engine scripts glottic passage.
    Source-inlet preservation is enforced; the junction remains explicitly pending.
    """
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

    stations = [(0, 12, 11), (10, 10.5, 10), (22, 9.2, 9), (30, 8.4, 8.1),
                (36, 6.8, 6.8), (45, 6.11, 6.11)]

    def radii(s):
        for a, b in zip(stations, stations[1:]):
            if s <= b[0]:
                t = max(0, (s - a[0]) / (b[0] - a[0]))
                t = t * t * (3 - 2 * t)
                return a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t
        return stations[-1][1:]

    def bump(theta, s, theta0, s0, dtheta, ds, height):
        d = math.atan2(math.sin(theta - theta0), math.cos(theta - theta0))
        return height * math.exp(-0.5 * ((d / dtheta) ** 2 + ((s - s0) / ds) ** 2))

    def relief(theta, s):
        """Mucosal relief moulded into the wall, in mm toward the lumen.

        Theta runs from the patient's left (0) through anterior (90 degrees). The posterior wall
        carries the two arytenoid mounds with the interarytenoid notch between them, each with its
        corniculate tubercle, and an aryepiglottic ridge sweeping up and forward from each mound
        with the cuneiform tubercle on it. The anterior wall carries the epiglottic tubercle.
        Presentation values for this teaching model, not measurements.
        """
        posterior = -math.pi / 2
        height = 0.0
        for side in (1, -1):
            height += bump(theta, s, posterior + side * math.radians(31), 21.0, math.radians(23), 5.0, 5.8)
            height += bump(theta, s, posterior + side * math.radians(24), 16.4, math.radians(10), 1.9, 1.8)
            for k in range(7):
                u = k / 6
                height += bump(theta, s, posterior + side * math.radians(48 + 50 * u), 18 - 9 * u,
                               math.radians(11), 2.3, 1.5 * (1 - 0.55 * u))
            height += bump(theta, s, posterior + side * math.radians(60), 14.4, math.radians(9), 1.8, 1.3)
        height += bump(theta, s, math.pi / 2, 18, math.radians(30), 4.5, 2.4)
        return height

    def sleeve(start, end):
        count, radial = round((end - start) * 2), 96
        vertices, faces = [], []
        for layer in range(2):
            for i in range(count + 1):
                s = start + (end - start) * i / count
                rx, ry = radii(s)
                for j in range(radial):
                    theta = 2 * math.pi * j / radial
                    # The relief is on the luminal face only; the outer face stays a plain shell.
                    inward = relief(theta, s) if layer == 0 else 0
                    vertices.append(((rx + layer * 0.75 - inward) * math.cos(theta),
                                     (ry + layer * 0.75 - inward) * math.sin(theta), s))
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

    def wall_x(s, y):
        """The wall's distance from the midline at this depth and this front-to-back position."""
        rx, ry = radii(s)
        return rx * math.sqrt(max(0.02, 1 - (y / ry) ** 2)) + 0.5

    PEARL = (0.88, 0.8, 0.66)
    MUCOSA = (0.6, 0.33, 0.27)

    def fold(sign, true):
        """One vocal fold as a rounded band lofted from front to back.

        A true fold runs from the anterior commissure, where the two almost meet, back to the vocal
        process, where they stand apart: the glottis is a triangle with its apex in front. In
        section the fold rises from the ventricle in a soft curve, rolls over a rounded free edge
        and falls away into the subglottis. It is pearly at the free edge and takes the colour of
        the mucosa toward the wall. Its adduction target brings the free edge to the midline. A
        false fold is a thicker, softer cushion above and just outside it, and does not move.
        """
        front, back = (7.0, -5.6) if true else (6.6, -5.0)
        ys = [front * (1 - i / 20) for i in range(21)] + [back * i / 16 for i in range(1, 17)]
        level = 30.0 if true else 24.0
        edge = 1.0 if true else 2.0
        arc = [math.radians(a) for a in (-80, -60, -40, -20, 0, 20, 40, 60, 80)]

        def true_gap(y):
            return 0.12 + 4.1 * ((7.0 - y) / 12.6) ** 0.95

        def gap(y):
            # The false fold stands outside the true one, leaving its pearly edge in view.
            return true_gap(y) if true else true_gap(min(y, 7.0)) + 2.3

        def section(y, closed):
            half = gap(y)
            shift = half if closed else 0.0
            centre = half + edge
            if true:
                top, bottom = 27.6, 35.6
                # Up from the free edge in a soft curve to the floor of the ventricle.
                lead = [(centre + d, 29.05 - 0.95 * (1 - math.exp(-d / 1.5))) for d in (4.6, 3.3, 2.2, 1.3, 0.6)]
                tail = [(centre + d, 31.0 + 1.05 * d) for d in (0.5, 1.2, 2.0, 3.0)]
            else:
                top, bottom = 19.2, 27.3
                lead = [(centre + d, 22.1 - 1.5 * (1 - math.exp(-d / 1.6))) for d in (4.4, 3.0, 1.8, 0.8)]
                tail = [(centre + d, 25.9 + 0.5 * d) for d in (0.8, 1.8, 2.8)]
            points = [(wall_x(top, y), top, False)]
            points += [(x, depth, True) for x, depth in lead]
            points += [(centre - edge * math.cos(a), level + edge * math.sin(a), True) for a in arc]
            points += [(x, depth, True) for x, depth in tail]
            points.append((wall_x(bottom, y), bottom, False))
            # A false fold melts into the wall at its two ends; it has no cut face to show.
            along = (front - y) / (front - back)
            melt = 1.0 if true else min(1.0, along / 0.3, (1 - along) / 0.22)
            melt = melt * melt * (3 - 2 * melt)
            ring, tint = [], []
            for x, depth, moves in points:
                if moves:
                    # Never outside the wall the fold grows from, open or closed.
                    wall = wall_x(depth, y)
                    x = min(x, wall - 0.05)
                    x = wall - (wall - x) * max(melt, 0.02)
                # Pearly within two millimetres of the free edge on top, sooner underneath.
                reach = max(0.0, x - half)
                fade = (1.6, 4.2) if depth <= level + 0.6 else (0.9, 2.4)
                k = 1.0 if not moves else min(1.0, max(0.0, (reach - fade[0]) / (fade[1] - fade[0])))
                k = k * k * (3 - 2 * k)
                tint.append(tuple(PEARL[c] * (1 - k) + MUCOSA[c] * k for c in range(3)) + (1.0,))
                ring.append((sign * (x - shift if moves else x), y, depth))
            return ring, tint

        sections = [section(y, False) for y in ys]
        rings = [ring for ring, _ in sections]
        closed = [section(y, True)[0] for y in ys]
        n = len(rings[0])
        vertices = [p for ring in rings for p in ring]
        colors = [c for _, tint in sections for c in tint]
        morph = [p for ring in closed for p in ring]
        faces = []
        for i in range(len(rings) - 1):
            for j in range(n):
                a_, b_ = i * n + j, i * n + (j + 1) % n
                quad = (a_, b_, b_ + n, a_ + n)
                if sign < 0:
                    quad = quad[::-1]
                faces.extend([(quad[0], quad[1], quad[2]), (quad[0], quad[2], quad[3])])
        # Close the two ends with a fan round each end's own centre.
        for index, flip in ((0, True), (len(rings) - 1, False)):
            ring = rings[index]
            centre = tuple(sum(p[k] for p in ring) / n for k in range(3))
            closed_centre = tuple(sum(p[k] for p in closed[index]) / n for k in range(3))
            c = len(vertices)
            vertices.append(centre)
            colors.append(MUCOSA + (1.0,))
            morph.append(closed_centre)
            for j in range(n):
                tri = (index * n + j, index * n + (j + 1) % n, c)
                if flip != (sign < 0):
                    tri = tri[::-1]
                faces.append(tri)
        return vertices, faces, morph, colors

    objects = []
    for name, a, b in [('UA_lumen', 0, 32), ('UA_subglottis', 32, 45)]:
        objects.append(join_meshes(name, [sleeve(a, b)],
                                   extras={'geometrySemantics': 'watertight mucosal wall shell; patent end rings; not an air-volume collider'}))
    for side, sign in [('L', 1), ('R', -1)]:
        for true in [True, False]:
            v, f, morph, colors = fold(sign, true)
            obj = join_meshes(f'UA_fold_{"true" if true else "false"}_{side}', [(v, f)],
                              color=[1, 1, 1, 1] if true else [0.7, 0.33, 0.3, 1])
            if true:
                obj['colors'] = colors
                obj['morph'] = morph
                obj['extras'] = {'morphStates': {'abducted': 0, 'narrowing': 0.5, 'adducted': 1}}
            objects.append(obj)
    # The laryngeal skeleton. The scope view hides it; the outside view draws it.
    looks = {'UA_thyroid': [0.86, 0.84, 0.74, 1], 'UA_cricoid': [0.86, 0.84, 0.74, 1],
             'UA_arytenoid_L': [0.86, 0.84, 0.74, 1], 'UA_arytenoid_R': [0.86, 0.84, 0.74, 1],
             'UA_epiglottis': [0.9, 0.8, 0.56, 1], 'UA_hyoid': [0.92, 0.89, 0.8, 1],
             'UA_tracheal_rings': [0.86, 0.84, 0.74, 1], 'UA_trachea_wall': [0.8, 0.5, 0.45, 1],
             'UA_thyrohyoid_membrane': [0.8, 0.62, 0.55, 1], 'UA_cricothyroid_ligament': [0.8, 0.62, 0.55, 1]}
    for name, pieces in larynx_framework(radii, relief).items():
        objects.append(join_meshes(name, pieces, color=looks[name],
                                   extras={'defaultVisible': False, 'structure': 'laryngeal framework',
                                           'origin': 'authored for this model'}))
    for obj in objects:
        obj['vertices'] = [to_lps(p) for p in obj['vertices']]
        if obj.get('morph'):
            obj['morph'] = [to_lps(p) for p in obj['morph']]
        obj['extras'] = {**obj.get('extras', {}), 'coordinateSystem': 'LPS', 'numberClass': 'authored-for-simulation'}
    write_glb(CACHE / 'larynx.raw.glb', objects,
              {'clinicalReviewStatus': 'pending', 'numberClass': 'authored-for-simulation'})
    ring = [to_lps((6.11 * math.cos(2 * math.pi * i / 96), 6.11 * math.sin(2 * math.pi * i / 96), 45)) for i in range(96)]
    larynx = {'schema': 'bronchoscopy_foundations_larynx/v1', 'units': 'mm', 'coordinateSystem': 'LPS',
              'numberClass': 'authored-for-simulation', 'authoredDate': '2026-11-11',
              'pathLps': [list(to_lps((0, 0, i * 0.5))) for i in range(91)], 'glottisMm': 30, 'exitMm': 45,
              'exitRingLps': ring, 'frameLps': {'forward': list(forward), 'left': list(left), 'anterior': list(anterior)},
              'skeleton': {'origin': 'Authored for this model. No supplied mesh is read or reused.',
                           'proportions': "Checked against the owner's head-and-neck CT segmentation: thyroid cartilage about 46 mm wide, hyoid about 41 mm wide. The cricoid is sized to this model's airway.",
                           'nodes': ['UA_thyroid', 'UA_cricoid', 'UA_arytenoid_L', 'UA_arytenoid_R', 'UA_epiglottis',
                                     'UA_hyoid', 'UA_tracheal_rings', 'UA_trachea_wall', 'UA_thyrohyoid_membrane',
                                     'UA_cricothyroid_ligament']},
              'authoredParameters': {'radialSegments': 96, 'longitudinalSpacingMm': 0.5, 'wallThicknessMm': 0.75,
                                     'lumenStationsMm': stations,
                                     'trueFolds': 'Rounded bands lofted from the anterior commissure to the vocal process; triangular glottis, free edge at 30 mm.',
                                     'falseFolds': 'Rounded bands above the true folds, free edge at 24.2 mm.',
                                     'mucosalRelief': 'Arytenoid mounds with corniculate tubercles, aryepiglottic ridges with cuneiform tubercles and an epiglottic tubercle, moulded into the luminal face of the wall.',
                                     'subglottisStartMm': 32, 'morphWeights': [0, 0.5, 1]},
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
    args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
    CACHE.mkdir(parents=True, exist_ok=True)
    if args.part == 'lumen':
        if not args.source_lumen:
            p.error('--source-lumen is required; the reviewed reference is read-only')
        build_lumen(args.source_lumen)
    elif args.part == 'accessories':
        build_accessories()
    elif args.part == 'larynx':
        build_larynx()
