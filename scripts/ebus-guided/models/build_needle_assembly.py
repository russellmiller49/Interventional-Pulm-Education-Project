"""Course-authored TBNA needle assembly and EBUS scope tip for the needle lab.

Replaces the primitive-built `ebus-needle-assembly.glb`. The handle follows the part layout of a
current EBUS-TBNA needle (scope adaptor, sheath adjuster and lock knob, depth scale and stopper,
needle adjuster, needle slider, aspiration port, stylet knob) at true scale; the distal end is a
convex-probe scope tip with the needle leaving the channel at 20 degrees to the tip axis. It is a
teaching model drawn from published photographs, not manufacturer CAD, and carries no maker's mark.

The needle axis, outlet and retracted tip are read from `model-contract.json` and are not changed:
the lab's state, schematic and evidence depend on them. Authored in "web mm" (x distal, y toward
the airway wall, z toward the viewer); the GLB is in metres and the runtime scales it once.

Run: Blender --background --factory-startup --python-exit-code 1 \
       --python scripts/ebus-guided/models/build_needle_assembly.py [-- --preview DIR] [--out DIR]
Then: node scripts/ebus-guided/models/optimize-additional.mjs ebus-needle-assembly.glb
      Blender ... --python scripts/ebus-guided/models/validate_additional.py
      node scripts/ebus-guided/models/validate-additional-runtime.mjs
"""
import bpy
import bmesh
import hashlib
import json
import math
import sys
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[3]
CASE = ROOT / 'EBUS-course/apps/web/public/simulator/case-001'
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(flag):
    return ARGS[ARGS.index(flag) + 1] if flag in ARGS else None
OUT = Path(arg('--out')) if arg('--out') else CASE / 'models/guided-v2'
PREVIEW = Path(arg('--preview')) if arg('--preview') else None
NAME = 'ebus-needle-assembly'
NOTES = ('True-scale teaching model of a TBNA needle handle, sheath and dimpled bevel needle with a '
         'convex-probe scope tip, drawn from published photographs; not device CAD and unbranded. '
         'Scope length between port and insertion tube is not shown. Needle axis, outlet and tip '
         'come from the model contract. No prescribed extension, force, or puncture safety result.')

contract = json.loads((CASE / 'models/guided-v2/model-contract.json').read_text())['needle']
D = Vector(contract['axis'])
SHEATH_END = Vector(contract['outlet'])
RETRACTED_TIP = Vector(contract['retractedTip'])
A = SHEATH_END - D * 8                      # fixed entry of the displayed needle shaft
assert (RETRACTED_TIP - (SHEATH_END - D)).length < 1e-4 and abs(D.length - 1) < 1e-6
Z = Vector((0, 0, 1))

# --- materials -------------------------------------------------------------------------------
def srgb(hexcode):
    c = [int(hexcode[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)

MATERIALS = {
    # name: (sRGB hex, roughness, metallic, emission strength)
    'plastic_white': ('#d8dad5', .42, 0, 0), 'plastic_scale': ('#cdd0c9', .52, 0, 0),
    'plastic_grey': ('#a4abb1', .45, 0, 0), 'port_white': ('#e2e6e4', .28, 0, 0),
    'ring_blue': ('#1b3f9c', .30, 0, 0), 'badge_navy': ('#15224f', .35, 0, 0),
    'mark_white': ('#f4f5f3', .45, 0, 0), 'mark_dark': ('#3b4046', .55, 0, 0),
    'steel_knurl': ('#c9ccd0', .34, 1, 0), 'steel_needle': ('#d5d8dc', .24, 1, 0),
    'steel_stylet': ('#9a9ea4', .38, 1, 0), 'sheath_green': ('#16865a', .46, 0, 0),
    'scope_black': ('#17191c', .50, 0, 0), 'scope_rubber': ('#0f1012', .64, 0, 0),
    'scope_tip': ('#1d1f23', .34, .25, 0), 'scope_collar': ('#3a3d42', .32, .8, 0),
    'scope_inner': ('#2b2e33', .7, 0, 0), 'cut_face': ('#6f757c', .72, 0, 0),
    'channel_liner': ('#aab6c4', .42, 0, 0), 'fiber_bundle': ('#d9cfa6', .5, 0, 0),
    'cable_blue': ('#33415c', .5, 0, 0), 'wire_steel': ('#8d9197', .4, 1, 0),
    'transducer_lens': ('#3a3f4a', .16, 0, 0), 'lens_glass': ('#0b1626', .05, 0, 0),
    'light_guide': ('#fff3cf', .3, 0, 1.6), 'bore_dark': ('#08090a', .8, 0, 0),
    'valve_rubber': ('#33363a', .7, 0, 0), 'port_metal': ('#565a60', .38, .7, 0),
    'mucosa': ('#d98678', .42, 0, 0), 'wall_cut': ('#dc9d8f', .6, 0, 0),
    'cartilage': ('#f3f0e6', .5, 0, 0), 'node': ('#c9d36a', .5, 0, 0),
    'node_cut': ('#e2e8a6', .62, 0, 0), 'vessel': ('#d8625c', .4, 0, 0),
    'vessel_cut': ('#eba59d', .55, 0, 0), 'blood': ('#7d1620', .22, 0, 0),
}
_materials = {}
def material(name):
    if name not in _materials:
        colour, rough, metal, emit = MATERIALS[name]
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        p = m.node_tree.nodes.get('Principled BSDF')
        rgb = srgb(colour)
        p.inputs['Base Color'].default_value = (*rgb, 1)
        p.inputs['Roughness'].default_value = rough
        p.inputs['Metallic'].default_value = metal
        if emit:
            p.inputs['Emission Color'].default_value = (*rgb, 1)
            p.inputs['Emission Strength'].default_value = emit
        m.diffuse_color = (*rgb, 1)
        _materials[name] = m
    return _materials[name]

# --- geometry helpers (all in web mm) ----------------------------------------------------------
def W(p):
    return Vector((p[0] / 1000, -p[2] / 1000, p[1] / 1000))
def unW(p):
    return Vector((p[0] * 1000, p[2] * 1000, -p[1] * 1000))

def chunk(verts, faces, mat, **flags):
    return {'verts': [Vector(v) for v in verts], 'faces': list(faces),
            'mats': [mat] * len(faces) if isinstance(mat, str) else list(mat), **flags}

def fillet(points, radius=.5, steps=4):
    """Round every corner of a 2D profile; near-straight joins are left alone."""
    out = [tuple(points[0])]
    for i in range(1, len(points) - 1):
        p0, p1, p2 = (Vector(points[j]) for j in (i - 1, i, i + 1))
        a, b = p0 - p1, p2 - p1
        la, lb = a.length, b.length
        if la < 1e-6 or lb < 1e-6:
            out.append(tuple(p1)); continue
        a, b = a / la, b / lb
        angle = math.acos(max(-1, min(1, a.dot(b))))
        if angle > math.radians(168) or angle < math.radians(12):
            out.append(tuple(p1)); continue
        r, t = radius, radius / math.tan(angle / 2)
        limit = .45 * min(la, lb)
        if t > limit:
            t, r = limit, limit * math.tan(angle / 2)
        centre = p1 + (a + b).normalized() * (r / math.sin(angle / 2))
        va, vb = p1 + a * t - centre, p1 + b * t - centre
        a0 = math.atan2(va.y, va.x)
        sweep = math.atan2(vb.y, vb.x) - a0
        sweep = (sweep + math.pi) % (2 * math.pi) - math.pi
        for k in range(steps + 1):
            ang = a0 + sweep * k / steps
            out.append((centre.x + r * math.cos(ang), centre.y + r * math.sin(ang)))
    out.append(tuple(points[-1]))
    return out

def spline(points, per=8):
    """Catmull-Rom through the control points."""
    pts = [Vector(p) for p in points]
    ext = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    out = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1:i + 3]
        for k in range(per):
            t = k / per
            out.append(tuple(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                                   + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)))
    out.append(tuple(pts[-1]))
    return out

def lathe(profile, origin, axis, ref, mat, seg=64, modulate=None, **flags):
    """Revolve (station, radius) pairs about an axis. Radius 0 closes the surface."""
    axis, ref, origin = Vector(axis).normalized(), Vector(ref).normalized(), Vector(origin)
    ref2 = axis.cross(ref)
    verts, faces, rings = [], [], []
    for a, r in profile:
        if r <= 1e-6:
            rings.append([len(verts)]); verts.append(origin + axis * a); continue
        ring = []
        for k in range(seg):
            phi = 2 * math.pi * k / seg
            rr = r if modulate is None else modulate(a, r, phi)
            ring.append(len(verts))
            verts.append(origin + axis * a + (ref * math.cos(phi) + ref2 * math.sin(phi)) * rr)
        rings.append(ring)
    for p, q in zip(rings, rings[1:]):
        if len(p) == 1 and len(q) == 1:
            continue
        for k in range(seg):
            k2 = (k + 1) % seg
            if len(p) == 1: faces.append((p[0], q[k], q[k2]))
            elif len(q) == 1: faces.append((p[k], q[0], p[k2]))
            else: faces.append((p[k], q[k], q[k2], p[k2]))
    return chunk(verts, faces, mat, **flags)

def box(centre, size, mat, bevel=.6, segs=3, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=segs, profile=.5, affect='EDGES')
    bm.verts.ensure_lookup_table()
    rot = rot or Matrix.Identity(3)
    verts = [rot @ v.co + Vector(centre) for v in bm.verts]
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    return chunk(verts, faces, mat)

def ball(centre, radius, mat, u=20, v=12):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=radius)
    bm.verts.ensure_lookup_table()
    verts = [v.co + Vector(centre) for v in bm.verts]
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    return chunk(verts, faces, mat)

def grid(points, mat, close_u=False, **flags):
    """Quads over a rows x columns array of points."""
    rows, cols = len(points), len(points[0])
    verts = [p for row in points for p in row]
    faces = []
    for i in range(rows - 1):
        for j in range(cols if close_u else cols - 1):
            j2 = (j + 1) % cols
            faces.append((i * cols + j, (i + 1) * cols + j, (i + 1) * cols + j2, i * cols + j2))
    return chunk(verts, faces, mat, **flags)

def cylinder_shell(x_stations, centre_yz, r_in, r_out, removed, mats, seg=48):
    """A straight tube along x whose wall is built cell by cell, so a window leaves real cut faces.
    `removed(i, k)` says whether the wall cell between stations i, i+1 and angles k, k+1 is absent."""
    outer_mat, inner_mat, cut_mat = mats
    cy, cz = centre_yz
    def point(x, r, k):
        psi = 2 * math.pi * k / seg
        return Vector((x, cy + r * math.sin(psi), cz + r * math.cos(psi)))
    index, verts, faces, face_mats = {}, [], [], []
    def vid(i, layer, k):
        key = (i, layer, k % seg)
        if key not in index:
            index[key] = len(verts)
            verts.append(point(x_stations[i], r_out if layer else r_in, k))
        return index[key]
    def quad(a, b, c, d, mat):
        faces.append((a, b, c, d)); face_mats.append(mat)
    n = len(x_stations) - 1
    solid = lambda i, k: 0 <= i < n and not removed(i, k % seg)
    for i in range(n):
        for k in range(seg):
            if not solid(i, k):
                continue
            quad(vid(i, 1, k), vid(i + 1, 1, k), vid(i + 1, 1, k + 1), vid(i, 1, k + 1), outer_mat)
            quad(vid(i, 0, k), vid(i, 0, k + 1), vid(i + 1, 0, k + 1), vid(i + 1, 0, k), inner_mat)
            if not solid(i - 1, k):
                quad(vid(i, 0, k), vid(i, 1, k), vid(i, 1, k + 1), vid(i, 0, k + 1), cut_mat)
            if not solid(i + 1, k):
                quad(vid(i + 1, 0, k), vid(i + 1, 0, k + 1), vid(i + 1, 1, k + 1), vid(i + 1, 1, k), cut_mat)
            if not solid(i, k - 1):
                quad(vid(i, 0, k), vid(i + 1, 0, k), vid(i + 1, 1, k), vid(i, 1, k), cut_mat)
            if not solid(i, k + 1):
                quad(vid(i, 0, k + 1), vid(i, 1, k + 1), vid(i + 1, 1, k + 1), vid(i + 1, 0, k + 1), cut_mat)
    return chunk(verts, faces, face_mats)

def boolean_difference(target, cutter, cut_mat):
    """Exact boolean on two closed chunks; faces left by the cutter take `cut_mat`."""
    objects = []
    for ch, mat in ((target, target['mats'][0]), (cutter, cut_mat)):
        mesh = bpy.data.meshes.new('tmp')
        mesh.from_pydata([W(v) for v in ch['verts']], [], ch['faces'])
        bm = bmesh.new(); bm.from_mesh(mesh)
        bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=2e-7)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        bm.to_mesh(mesh); bm.free()
        mesh.materials.append(material(mat))
        o = bpy.data.objects.new('tmp', mesh)
        bpy.context.collection.objects.link(o)
        objects.append(o)
    a, b = objects
    mod = a.modifiers.new('cut', 'BOOLEAN')
    mod.operation, mod.solver, mod.object = 'DIFFERENCE', 'EXACT', b
    mod.material_mode = 'TRANSFER'
    bpy.context.view_layer.objects.active = a
    bpy.ops.object.modifier_apply(modifier=mod.name)
    names = [slot.material.name for slot in a.material_slots]
    result = chunk([unW(v.co) for v in a.data.vertices], [tuple(p.vertices) for p in a.data.polygons],
                   [names[p.material_index] for p in a.data.polygons])
    for o in objects:
        mesh = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.meshes.remove(mesh)
    return result

SOURCE = ('course-authored teaching model after published photographs of a current EBUS-TBNA '
          'needle and scope tip; not manufacturer CAD')
def semantic(o, name, label, role):
    o.name = name
    for target in (o, o.data) if o.type == 'MESH' else (o,):
        target['semanticId'], target['label'], target['role'] = name, label, role
        target['sourceType'], target['reviewStatus'] = SOURCE, 'faculty review pending'
    return o

def make(name, label, chunks, parent=None, origin=None, sharp=38, role='structure'):
    """One labelled mesh from several single- or multi-material chunks."""
    shift = W(origin) if origin else Vector()
    bm, slots = bmesh.new(), []
    for ch in chunks:
        vs = [bm.verts.new(W(v) - shift) for v in ch['verts']]
        fs = []
        for face, mat in zip(ch['faces'], ch['mats']):
            if len(set(face)) < 3:
                continue
            try:
                f = bm.faces.new([vs[i] for i in face])
            except ValueError:
                continue
            if mat not in slots:
                slots.append(mat)
            f.material_index = slots.index(mat)
            fs.append(f)
        bmesh.ops.remove_doubles(bm, verts=vs, dist=2e-7)
        fs = [f for f in fs if f.is_valid]
        want = ch.get('orient')
        if ch.get('away') is not None:
            want = lambda c, ref=Vector(ch['away']): c - ref
        if ch.get('toward') is not None:
            want = lambda c, ref=Vector(ch['toward']): ref - c
        if want is not None:
            # Open patches (decals, cut faces, lumens): each face is given the side it shows.
            bm.normal_update()
            flip = [f for f in fs if f.normal.dot(W(want(unW(f.calc_center_median() + shift)))) < 0]
            if flip:
                bmesh.ops.reverse_faces(bm, faces=flip)
        else:
            bmesh.ops.recalc_face_normals(bm, faces=fs)
            centre = sum((f.calc_center_median() for f in fs), Vector()) / max(1, len(fs))
            if sum(f.calc_area() * f.normal.dot(f.calc_center_median() - centre) for f in fs) < 0:
                bmesh.ops.reverse_faces(bm, faces=fs)
    limit = math.radians(sharp)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        e.smooth = len(e.link_faces) == 2 and e.calc_face_angle(0) < limit
    mesh = bpy.data.meshes.new(name + '_mesh')
    bm.to_mesh(mesh); bm.free()
    for slot in slots:
        mesh.materials.append(material(slot))
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    o.location = shift
    if parent:
        o.parent = parent
    return semantic(o, name, label, role)

def pivot(name, label, parent=None):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    if parent:
        o.parent = parent
    return semantic(o, name, label, 'pivot')

# --- scope tip frame ---------------------------------------------------------------------------
EXIT = math.radians(20)                               # needle to tip axis
TIP_ANGLE = math.atan2(D.y, D.x) - EXIT               # tip axis above +x
U = Vector((math.cos(TIP_ANGLE), math.sin(TIP_ANGLE), 0))
N = Vector((-math.sin(TIP_ANGLE), math.cos(TIP_ANGLE), 0))
R_TIP = 3.45                                           # 6.9 mm distal end
VIEW = math.radians(35)                                # forward-oblique optics: the face normal
FACE_S, FACE_H, T_FACE = -1.0, 1.9, 4.0                # where the needle axis crosses that face
O_TIP = A + D * T_FACE - U * FACE_S - N * FACE_H
def tip(s, h, z=0):
    return O_TIP + U * s + N * h + Z * z
S_FACE_TOP = FACE_S - (R_TIP - FACE_H) * math.tan(VIEW)
SHELF_H = .2
S_FACE_BOTTOM = FACE_S + (FACE_H - SHELF_H) * math.tan(VIEW)
S_PROX, S_NOSE0 = -9.5, 7.0
TR_S, TR_H, TR_R, TR_HALF_WIDTH = FACE_S + 7.5, FACE_H - 3.66, 4.8, 2.55  # transducer arc, lens half-width
def lens_arc(s):
    return TR_H + math.sqrt(max(0, TR_R ** 2 - (s - TR_S) ** 2))
S_LENS0 = TR_S - math.sqrt(TR_R ** 2 - (SHELF_H - TR_H) ** 2)   # the shelf ends where the arc rises through it
S_NOSE = TR_S + math.sqrt(TR_R ** 2 - TR_H ** 2)                 # and the nose where it returns to the axis
BEND_R = 12.0
S_BEND = tip(S_PROX, 0)
O_BEND = S_BEND + N * BEND_R
Y0, X_BEND0 = O_BEND.y - BEND_R, O_BEND.x              # insertion-tube axis
R_TUBE, X_BREAK, XW0, XW1 = 3.15, -60.0, -52.0, -27.0
CHANNEL_Y = Y0 + .75
X_PORT0 = -74.0
X_H0 = X_PORT0 - 14.0                                  # handle: q = 0 at the nose, increasing proximally
H_ORIGIN, H_AXIS = Vector((X_H0, Y0, 0)), Vector((-1, 0, 0))
def hpt(q, r, psi):
    """Handle surface point: psi is measured from the viewer's side toward the top of the screen."""
    return Vector((X_H0 - q, Y0 - r * math.sin(psi), r * math.cos(psi)))
def hlathe(profile, mat, seg=56, **kw):
    return lathe(profile, H_ORIGIN, H_AXIS, Z, mat, seg=seg, **kw)
def wrap_patch(q0, q1, half_angle, radius_at, mat, lift, rows=8, cols=2, centre_psi=0):
    pts = [[hpt(q0 + (q1 - q0) * j / cols, radius_at(q0 + (q1 - q0) * j / cols) + lift,
                centre_psi - half_angle + 2 * half_angle * i / rows) for j in range(cols + 1)]
           for i in range(rows + 1)]
    return grid(pts, mat, away=Vector((X_H0 - (q0 + q1) / 2, Y0, 0)))

def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for item in list(block):
            block.remove(item)
    _materials.clear()

# --- handle ------------------------------------------------------------------------------------
def build_handle():
    assembly = pivot('handle_assembly', 'Needle handle assembly')
    make('mount_connector', 'Scope adaptor', [
        hlathe(fillet([(0, 0), (0, 3.3), (.5, 3.75), (6, 3.75), (6, 7.5), (25, 7.5), (25, 0)], .7), 'plastic_white'),
        box((X_H0 - 15.5, Y0 + 2.5, 0), (8.5, 27, 10.5), 'plastic_white', bevel=1.3),
        box((X_H0 - 15.5, Y0 + 13.2, 0), (10.5, 6, 12), 'plastic_white', bevel=1.2),
        *[box((X_H0 - 15.5, Y0 - 11.15, z), (6.8, .8, 1.1), 'plastic_grey', bevel=.3, segs=2) for z in (-2.6, 0, 2.6)],
    ], assembly)

    body = pivot('handle_body_motion', 'Handle body, moves with the sheath', assembly)
    make('sheath_adjuster', 'Sheath adjuster', [
        hlathe(fillet([(22, 0), (22, 5.5), (28, 5.5), (28, 7.15), (52.5, 7.15), (52.5, 8.5), (55.5, 8.5),
                       (55.5, 4.75), (72, 4.75), (72, 0)], .6), 'plastic_white'),
        lathe(fillet([(5.5, 0), (5.5, 5.6), (8.4, 5.6), (8.4, 0)], .35), (X_H0 - 40, Y0, 0), Z, (1, 0, 0), 'plastic_white', seg=48),
    ], body)

    knob_origin = Vector((X_H0 - 40, Y0, 11.6))
    def knurl(a, r, phi):
        return r * (1 - .045 * (.5 + .5 * math.cos(40 * phi))) if r > 4.6 else r
    make('sheath_lock', 'Sheath lock', [
        lathe(fillet([(8.4, 0), (8.4, 2.2), (9.3, 2.2), (9.3, 5.0), (14.8, 5.0), (15.15, 4.2), (15.15, 0)], .32, 3),
              (X_H0 - 40, Y0, 0), Z, (1, 0, 0), 'steel_knurl', seg=120, modulate=knurl),
        box((X_H0 - 40, Y0, 15.17), (7.4, 1.0, .12), 'mark_dark', bevel=0),
    ], body, origin=knob_origin, sharp=50)

    def scale_radius(_q):
        return 4.0
    ticks = []
    for i, q in enumerate(range(74, 140, 2)):
        ticks.append(wrap_patch(q - .16, q + .16, math.radians(30 if i % 5 == 0 else 17), scale_radius,
                                'mark_dark', .03, rows=6, cols=1))
    make('depth_scale', 'Depth scale', [
        hlathe([(70, 0), (70, 4.0), (141, 4.0), (141, 0)], 'plastic_scale', seg=48),
        hlathe(fillet([(78.4, 3.9), (78.4, 5.75), (80.9, 5.75), (80.9, 3.9)], .45), 'plastic_grey', seg=48),
        *ticks,
    ], body)

    tilt = Matrix.Rotation(math.radians(-7), 3, 'Z')
    make('extension_stop', 'Needle extension stop', [
        hlathe(fillet([(81.4, 3.95), (81.4, 8.4), (96, 8.4), (96, 3.95)], 1.0), 'plastic_white'),
        box((X_H0 - 88.7, Y0 - 9.0, 0), (10, 4.6, 9.5), 'plastic_white', bevel=1.0),
        box((X_H0 - 88.9, Y0 - 12.1, 0), (11.5, 1.7, 6.6), 'plastic_grey', bevel=.6, rot=tilt),
        box((X_H0 - 88.7, Y0 + 9.2, 0), (7, 3.4, 8), 'plastic_white', bevel=.9),
    ], body)

    slide = pivot('handle_motion', 'Needle slider, moves with the needle', body)
    ribs = [p for i in range(6) for q in [124 + 2.2 * i]
            for p in ((q, 6.45), (q + .3, 6.95), (q + 1.0, 6.95), (q + 1.3, 6.45))]
    barrel = spline([(137.5, 6.5), (146, 7.5), (158, 8.0), (172, 7.9), (186, 7.3), (196, 6.6), (198.4, 6.4)])
    profile = fillet([(121, 4.3), (118, 4.3), (118, 6.0), (122.6, 6.0), (123.2, 6.45)] + ribs + barrel
                     + [(198.6, 6.2), (204, 6.2), (204, 0)], .22, 3)
    def slider_radius(q):
        for (q0, r0), (q1, r1) in zip(profile, profile[1:]):
            if q0 <= q <= q1 and q1 > q0:
                return r0 + (r1 - r0) * (q - q0) / (q1 - q0)
        return 7.5
    # Gauge badge on the viewer's side: a pill, then the numerals raised on it.
    badge_q, badge_half, rows = 183.0, 4.0, 14
    pill = []
    for i in range(rows + 1):
        y = -3.0 + 6.0 * i / rows
        half = badge_half + math.sqrt(max(0, 9 - y * y))
        pill.append([hpt(badge_q + half * (2 * j / 16 - 1), slider_radius(badge_q + half * (2 * j / 16 - 1)) + .07,
                         y / slider_radius(badge_q)) for j in range(17)])
    text = []
    bpy.ops.object.text_add()
    t = bpy.context.object
    t.data.body, t.data.align_x, t.data.align_y, t.data.size = '22G', 'CENTER', 'CENTER', 4.2
    bpy.ops.object.convert(target='MESH')
    r_badge = slider_radius(badge_q)
    text.append(chunk([hpt(badge_q + v.co.x, slider_radius(badge_q + v.co.x) + .12, v.co.y / r_badge) for v in t.data.vertices],
                      [tuple(p.vertices) for p in t.data.polygons], 'mark_white',
                      away=Vector((X_H0 - badge_q, Y0, 0))))
    mesh = t.data
    bpy.data.objects.remove(t, do_unlink=True)
    bpy.data.meshes.remove(mesh)
    make('needle_handle', 'Needle handle', [
        hlathe(profile, 'plastic_white', seg=72),
        hlathe(fillet([(199.1, 6.15), (199.1, 6.45), (203.9, 6.45), (203.9, 6.15)], .2, 3), 'ring_blue', seg=72),
        grid(pill, 'badge_navy', away=Vector((X_H0 - badge_q, Y0, 0))),
        *text,
    ], slide)
    make('suction_connection', 'Aspiration port', [
        hlathe(fillet([(203.5, 0), (203.5, 3.3), (204.6, 3.8), (210.3, 3.8), (210.3, 4.25), (211.5, 4.25),
                       (211.5, 2.3), (210.2, 2.3)], .25, 3), 'port_white', seg=48),
        *[box((X_H0 - 210.9, Y0 + s * 4.7, 0), (1.3, 1.5, 2.8), 'port_white', bevel=.3, segs=2) for s in (-1, 1)],
    ], slide)
    make('stylet', 'Stylet knob, stylet seated', [
        hlathe(fillet([(210.6, 0), (210.6, 2.1), (212.3, 2.1), (212.3, 5.6), (214.0, 5.6), (216.3, 3.3),
                       (220.5, 3.3), (222.6, 5.6), (224.4, 5.6), (225.4, 3.9), (225.6, 0)], .5), 'plastic_white', seg=56),
    ], slide)
    return assembly

# --- scope -------------------------------------------------------------------------------------
def build_scope():
    # The instrument port the adaptor locks onto, then the length that is not drawn.
    make('scope_port', 'Scope instrument port', [
        lathe(fillet([(0, 0), (0, 4.5), (10.2, 4.5), (10.2, 0)], .2, 2), (X_PORT0, Y0, 0), (-1, 0, 0), Z, 'port_metal', seg=48),
        lathe(fillet([(10, 0), (10, 6.25), (15.4, 6.25), (15.9, 5.4), (15.9, 2.2), (14.6, 2.2)], .5),
              (X_PORT0, Y0, 0), (-1, 0, 0), Z, 'valve_rubber', seg=48),
        lathe([(-.02, 0), (-.02, 4.5)], (X_PORT0, Y0, 0), (-1, 0, 0), Z, 'cut_face', seg=48, away=Vector((X_PORT0 - 5, Y0, 0))),
    ])
    make('scope_length_break', 'Scope length not shown',
         [ball((x, Y0, 0), .85, 'cut_face') for x in (-63.6, -67.0, -70.4)])

    seg = 48
    window = range(-11, 12)                                   # the viewer's side of the tube
    stations = [X_BREAK, XW0, XW1, X_BEND0]
    cutaway = [
        cylinder_shell(stations, (Y0, 0), 2.55, R_TUBE, lambda i, k: i == 1 and ((k + seg // 2) % seg - seg // 2) in window,
                       ('scope_black', 'scope_inner', 'cut_face'), seg),
        # Working-channel liner, halved through the window so the sheath inside it shows.
        cylinder_shell([XW0 - .8, XW1 + .8], (CHANNEL_Y, 0), 1.08, 1.3,
                       lambda i, k: ((k + 16) % 32 - 16) in range(-8, 8), ('channel_liner',) * 3, 32),
        lathe([(0, 0), (0, .8), (X_BEND0 - X_BREAK, .8), (X_BEND0 - X_BREAK, 0)], (X_BREAK, Y0 - 1.25, .55), (1, 0, 0), Z, 'cable_blue', seg=20),
        lathe([(0, 0), (0, .45), (X_BEND0 - X_BREAK, .45), (X_BEND0 - X_BREAK, 0)], (X_BREAK, Y0 + .1, -1.65), (1, 0, 0), Z, 'fiber_bundle', seg=16),
        lathe([(0, 0), (0, .45), (X_BEND0 - X_BREAK, .45), (X_BEND0 - X_BREAK, 0)], (X_BREAK, Y0 - .2, 1.75), (1, 0, 0), Z, 'fiber_bundle', seg=16),
        *[lathe([(0, 0), (0, .16), (X_BEND0 - X_BREAK, .16), (X_BEND0 - X_BREAK, 0)], (X_BREAK, Y0 + s * 2.25, 0), (1, 0, 0), Z, 'wire_steel', seg=10)
          for s in (-1, 1)],
        lathe([(.5, 0), (.5, 2.55)], (X_BREAK, Y0, 0), (1, 0, 0), Z, 'bore_dark', seg=seg, away=Vector((X_BREAK + 5, Y0, 0))),
    ]
    make('working_channel_cutaway', 'Cutaway working channel', cutaway)
    make('protected_needle_in_channel', 'Sheath and needle inside the channel', [
        lathe([(0, 0), (0, .95), (X_BEND0 - X_BREAK + .3, .95), (X_BEND0 - X_BREAK + .3, 0)], (X_BREAK - .3, CHANNEL_Y, 0), (1, 0, 0), Z, 'sheath_green', seg=24),
    ])

    # Bending section: an arc from the insertion-tube axis up to the tip axis.
    steps, rings = 26, []
    for i in range(steps + 1):
        phi = (TIP_ANGLE) * i / steps
        centre = O_BEND + Vector((math.sin(phi), -math.cos(phi), 0)) * BEND_R
        normal = Vector((-math.sin(phi), math.cos(phi), 0))
        radius = R_TUBE + .08 + (R_TIP - .1 - R_TUBE - .08) * i / steps
        rings.append([centre + (normal * math.cos(2 * math.pi * k / seg) + Z * math.sin(2 * math.pi * k / seg)) * radius for k in range(seg)])
    def collar(centre, axis, r, length):
        return lathe(fillet([(-length / 2, r - .3), (-length / 2, r), (length / 2, r), (length / 2, r - .3)], .12, 2),
                     centre, axis, Z, 'scope_collar', seg=seg)
    make('scope_bending_section', 'Bending section', [
        grid(rings, 'scope_rubber', close_u=True),
        collar(Vector((X_BEND0 + .2, Y0, 0)), (1, 0, 0), R_TUBE + .16, 1.8),
        collar(tip(S_PROX + .2, 0), U, R_TIP + .04, 1.3),
    ])

    # Rigid distal end: a round body cut by the oblique optics face and a short shelf; past the
    # shelf its upper half follows the transducer arc, so the lens is the head's own surface.
    def face_top(s):
        if s <= S_FACE_TOP: return 99
        if s < S_FACE_BOTTOM: return R_TIP + (SHELF_H - R_TIP) * (s - S_FACE_TOP) / (S_FACE_BOTTOM - S_FACE_TOP)
        return SHELF_H
    def radius(s):
        return R_TIP if s <= S_NOSE0 else R_TIP * math.sqrt(max(0, 1 - ((s - S_NOSE0) / (S_NOSE - S_NOSE0)) ** 2))
    def head(s, phi, lift=0):
        r = radius(s) + lift
        if s < S_LENS0 or math.sin(phi) < 0:
            return tip(s, min(r * math.sin(phi), face_top(s)), r * math.cos(phi))
        return tip(s, min(r, lens_arc(s) + lift) * math.sin(phi), r * math.cos(phi))
    marks = sorted({S_PROX, S_FACE_TOP, S_FACE_BOTTOM, S_LENS0, S_NOSE0, *[S_PROX + 1.0 * i for i in range(8)],
                    *[S_FACE_TOP - .3 + .25 * i for i in range(int((S_NOSE - S_FACE_TOP + .3) / .25))],
                    *[S_NOSE - .5 * (1 - math.cos(math.pi * i / 16)) for i in range(1, 8)]})
    body_seg, verts, faces, rows = 56, [], [], []
    verts.append(tip(S_PROX, 0)); rows.append([0])
    for s in marks:
        row = []
        for k in range(body_seg):
            row.append(len(verts)); verts.append(head(s, 2 * math.pi * k / body_seg))
        rows.append(row)
    rows.append([len(verts)]); verts.append(tip(S_NOSE, 0))
    for p, q in zip(rows, rows[1:]):
        for k in range(body_seg):
            k2 = (k + 1) % body_seg
            if len(p) == 1: faces.append((p[0], q[k], q[k2]))
            elif len(q) == 1: faces.append((p[k], q[0], p[k2]))
            else: faces.append((p[k], q[k], q[k2], p[k2]))
    bore = lathe([(-4.5, 0), (-4.5, 1.2), (T_FACE + 3.5, 1.2), (T_FACE + 3.5, 0)], A, D, Z, 'bore_dark', seg=32)
    body = boolean_difference(chunk(verts, faces, 'scope_tip'), bore, 'bore_dark')
    make('scope_distal_end', 'Scope distal end', [dict(body, away=None)], sharp=32)

    face_normal = U * math.cos(VIEW) + N * math.sin(VIEW)
    def on_face(h, z):
        return tip(FACE_S - math.tan(VIEW) * (h - FACE_H), h, z)
    optics = []
    for z, glass in ((1.95, 'lens_glass'), (-1.95, 'light_guide')):
        centre = on_face(2.05, z)
        optics.append(lathe(fillet([(-.2, 0), (-.2, .68), (.05, .68), (.05, .5), (.02, .5)], .04, 2), centre, face_normal, Z, 'scope_collar', seg=28))
        optics.append(lathe([(.03, 0), (.03, .5)], centre, face_normal, Z, glass, seg=28, away=centre - face_normal))
    make('scope_optics', 'Objective lens and light guide', optics)
    outlet_centre = A + D * T_FACE
    make('channel_outlet', 'Working-channel outlet', [
        lathe(fillet([(-.5, 1.2), (.05, 1.2), (.05, 1.45), (-.25, 1.45)], .05, 2), outlet_centre, face_normal, Z, 'scope_collar', seg=40),
    ])

    # Convex transducer: the acoustic lens, a rounded patch standing just proud of the head.
    s0, s1 = S_LENS0 + .55, S_NOSE - .3
    def lens_row(s, lift):
        r = radius(s)
        half = min(TR_HALF_WIDTH * max(0, 1 - abs(2 * (s - (s0 + s1) / 2) / (s1 - s0)) ** 6) ** (1 / 6), .84 * r)
        pts = []
        for j in range(25):
            z = half * (2 * j / 24 - 1)
            pts.append(tip(s, (lens_arc(s) + lift) * math.sqrt(max(0, 1 - (z / (r + lift)) ** 2)), z))
        return pts
    stations = [s0 + (s1 - s0) * i / 64 for i in range(65)]
    lens, sunk = [lens_row(s, .07) for s in stations], [lens_row(s, -.06) for s in stations]
    outward = lambda c: c - tip(TR_S, TR_H)
    make('transducer', 'Transducer', [
        grid(lens, 'transducer_lens', orient=outward),
        *[grid([[row[j] for row in lens], [row[j] for row in sunk]], 'transducer_lens', orient=outward) for j in (0, 24)],
    ], sharp=60)

# --- sheath and needle -------------------------------------------------------------------------
def build_needle():
    sheath_motion = pivot('sheath_motion', 'Sheath, moves with the sheath adjuster')
    profile = [(-4.0, 0)] + [(t / 10, .93 + .02 * math.sin(2 * math.pi * (t / 10) / .42)) for t in range(-40, 76)]
    profile += fillet([(7.6, .95), (8.0, .95), (8.0, .52), (7.1, .5)], .14, 3) + [(7.1, 0)]
    make('sheath', 'Sheath', [lathe(profile, A, D, Z, 'sheath_green', seg=28)], sheath_motion, sharp=50)

    needle_motion = pivot('needle_motion', 'Needle, moves with the needle slider')
    mid = (A + RETRACTED_TIP) / 2
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=.33 / 1000, depth=(RETRACTED_TIP - A).length / 1000, location=W(mid))
    shaft = bpy.context.object
    shaft.rotation_mode = 'QUATERNION'
    shaft.rotation_quaternion = (W(RETRACTED_TIP) - W(A)).to_track_quat('Z', 'Y')
    shaft.data.name = 'needle_shaft_mesh'
    shaft.data.materials.append(material('steel_needle'))
    for p in shaft.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    shaft.parent = needle_motion
    semantic(shaft, 'needle_shaft', 'Needle shaft', 'structure')
    shaft['fixedBaseWebMm'] = list(A)
    shaft['spanMm'] = (RETRACTED_TIP - A).length

    # Rigid echogenic tip: a single bevel, the stylet seated in the lumen, and rows of dimples.
    back, side = -D, -Z                                       # the long point is on the far side: the bevel faces the viewer
    radius, bevel, length, seg = .36, 2.2, 12.0, 32
    rows_at = [3.1 + .6 * i for i in range(15)]
    def wall(l, phi):
        r = radius
        if 2.8 < l < 11.8:
            row = min(range(len(rows_at)), key=lambda i: abs(rows_at[i] - l))
            offset = (math.pi / 6) if row % 2 else 0
            dphi = (phi - offset + math.pi / 6) % (math.pi / 3) - math.pi / 6
            d = math.hypot(l - rows_at[row], radius * dphi)
            if d < .15:
                r -= .045 * (.5 + .5 * math.cos(math.pi * d / .15))
        return r
    def at(l, r, phi):
        return RETRACTED_TIP + back * l + (side * math.cos(phi) + side.cross(back) * math.sin(phi)) * r
    start = lambda phi: bevel * (1 - math.cos(phi)) / 2
    rings = []
    for a in range(7):
        rings.append([at(start(phi) + (bevel + .3 - start(phi)) * a / 6, radius, phi) for phi in (2 * math.pi * k / seg for k in range(seg))])
    l = bevel + .3
    while l < length:
        l += .07
        rings.append([at(l, wall(l, phi), phi) for phi in (2 * math.pi * k / seg for k in range(seg))])
    inner = [[at(start(phi) * (.2 / radius) + bevel * (1 - .2 / radius) / 2 + depth, .2, phi) for phi in (2 * math.pi * k / seg for k in range(seg))]
             for depth in (0, .16)]
    plug_centre = RETRACTED_TIP + back * (bevel / 2 + .1)
    tip_object = make('needle_tip', 'True needle tip (teaching view)', [
        grid(rings, 'steel_needle', close_u=True, away=RETRACTED_TIP + back * 6),
        grid([rings[0], inner[0]], 'steel_needle', close_u=True, away=RETRACTED_TIP + back * 3),
        grid(inner, 'bore_dark', close_u=True, toward=plug_centre),
        chunk(inner[1] + [plug_centre], [(k, (k + 1) % seg, seg) for k in range(seg)], 'steel_stylet', away=plug_centre + back * 2),
    ], needle_motion, origin=RETRACTED_TIP, sharp=30)
    return sheath_motion, needle_motion, shaft, tip_object

# --- tissue, sectioned just behind the needle's plane ------------------------------------------
CUT_Z = -.6
def build_tissue():
    wall_top, r_in, r_out = 6.4, 10.0, 13.0
    yc = wall_top - r_in
    def wall_point(x, r, alpha, cut=CUT_Z):
        a0 = math.asin(-cut / r)
        a = a0 + (math.radians(80) - a0) * alpha
        return Vector((x, yc + r * math.cos(a), -r * math.sin(a)))
    xs = [-24, 32]                                            # straight along the airway
    n = 22
    inner = [[wall_point(x, r_in, j / n) for x in xs] for j in range(n + 1)]
    outer = [[wall_point(x, r_out, j / n) for x in xs] for j in range(n + 1)]
    inward = lambda c: Vector((0, yc - c.y, -c.z))
    chunks = [
        grid(inner, 'mucosa', orient=inward), grid(outer, 'mucosa', orient=lambda c: -inward(c)),
        grid([inner[0], outer[0]], 'wall_cut', orient=lambda c: Z),
        grid([inner[-1], outer[-1]], 'mucosa', orient=lambda c: Vector((0, -1, 0))),
        grid([[row[0] for row in inner], [row[0] for row in outer]], 'wall_cut', orient=lambda c: Vector((-1, 0, 0))),
        grid([[row[-1] for row in inner], [row[-1] for row in outer]], 'wall_cut', orient=lambda c: Vector((1, 0, 0))),
    ]
    # Cartilage rings, proud of the adventitia and of the cut face; the needle passes between two.
    ring_n, m = 18, 16
    for k in range(-4, 7):
        xc = -.6 + 5 * k
        if not xs[0] + 1.6 < xc < xs[-1] - 1.6:
            continue
        section = []
        for i in range(m):
            t = 2 * math.pi * i / m
            cx, sx = math.cos(t), math.sin(t)
            section.append((xc + 1.05 * math.copysign(abs(cx) ** .6, cx), 12.1 + 1.2 * math.copysign(abs(sx) ** .6, sx)))
        rings = [[wall_point(x, r, j / ring_n * .93, CUT_Z + .03) for (x, r) in section] for j in range(ring_n + 1)]
        ring = grid(rings, 'cartilage', close_u=True)
        for end in (0, ring_n):
            base = end * m
            ring['verts'].append(sum(rings[end], Vector()) / m)
            ring['faces'] += [(base + i, base + (i + 1) % m, len(ring['verts']) - 1) for i in range(m)]
            ring['mats'] += ['cartilage'] * m
        chunks.append(ring)
    make('airway_wall', 'Airway wall', chunks, sharp=45)

    # Node: the far half of the contract's ellipsoid, with the capsule drawn as a rim on the cut.
    c, radii = Vector((6, 23, 0)), (10, 8, 6)
    mu0 = math.asin(-CUT_Z / radii[2])
    shell = [[Vector((c.x + radii[0] * math.cos(mu) * math.cos(lam), c.y + radii[1] * math.cos(mu) * math.sin(lam), c.z - radii[2] * math.sin(mu)))
              for lam in (2 * math.pi * k / 72 for k in range(72))]
             for mu in (mu0 + (math.pi / 2 - mu0) * i / 22 for i in range(23))]
    rim = shell[0]
    face_centre = Vector((c.x, c.y, CUT_Z))
    inset = [face_centre + (p - face_centre) * .94 for p in rim]
    cut = [[face_centre + (p - face_centre) * f + Vector((0, 0, .02)) for p in inset] for f in (1, .5)]
    make('target_node', 'Example node', [
        grid(shell, 'node', close_u=True, away=c),
        grid([rim, inset], 'node', close_u=True, orient=lambda p: Z),
        grid(cut, 'node_cut', close_u=True, orient=lambda p: Z),
        chunk(cut[1] + [face_centre + Vector((0, 0, .02))], [(k, (k + 1) % 72, 72) for k in range(72)], 'node_cut', orient=lambda p: Z),
    ], sharp=50)

    # Vessel crossing the plane beyond the node: wall, cut edge and blood.
    vc, vr, seg = Vector((25, 15, 0)), 4.0, 40
    ring = lambda r, z: [Vector((vc.x + r * math.cos(t), vc.y + r * math.sin(t), z)) for t in (2 * math.pi * k / seg for k in range(seg))]
    back_centre = Vector((vc.x, vc.y, -12))
    outward = lambda p: Vector((p.x - vc.x, p.y - vc.y, 0))
    make('adjacent_vessel', 'Adjacent vessel', [
        grid([ring(vr, CUT_Z), ring(vr, -12)], 'vessel', close_u=True, orient=outward),
        chunk(ring(vr, -12) + [back_centre], [(k, (k + 1) % seg, seg) for k in range(seg)], 'vessel', orient=lambda p: -Z),
        grid([ring(vr, CUT_Z), ring(vr - .55, CUT_Z)], 'vessel_cut', close_u=True, orient=lambda p: Z),
        grid([ring(vr - .55, CUT_Z), ring(vr - .55, CUT_Z - .35)], 'vessel_cut', close_u=True, orient=lambda p: -outward(p)),
        chunk(ring(vr - .55, CUT_Z - .35) + [Vector((vc.x, vc.y, CUT_Z - .35))], [(k, (k + 1) % seg, seg) for k in range(seg)], 'blood',
              orient=lambda p: Z),
    ], sharp=50)

# --- checks, export, preview -------------------------------------------------------------------
def check():
    """The fixed contract and the drawn geometry agree, and nothing the needle passes is in its way."""
    apex = max((tip(TR_S + TR_R * math.cos(t), TR_H + TR_R * math.sin(t)) for t in (math.pi * i / 180 for i in range(181))), key=lambda p: p.y)
    assert 5.9 < apex.y < 6.4 and abs(apex.x) < 1.0, apex
    centre = tip(TR_S, TR_H)
    clearance = abs((centre - A).cross(D).z) - TR_R
    assert clearance > 1.0, clearance                        # sheath radius .95
    crossing = [A + D * ((y - A.y) / D.y) for y in (6.4, 9.4)]
    assert all(1.5 < (p.x + .6) % 5 < 3.5 for p in crossing), crossing                       # between two rings
    assert (bpy.data.objects['needle_tip'].matrix_world.translation - W(RETRACTED_TIP)).length < 1e-9
    return {'transducerApexWebMm': [round(v, 3) for v in apex], 'needleToTransducerClearanceMm': round(clearance, 3),
            'insertionTubeAxisY': round(Y0, 3), 'tipAxisDegrees': round(math.degrees(TIP_ANGLE), 2), 'needleExitDegrees': 20}

AO_SKIP = ('needle_shaft', 'needle_tip', 'sheath', 'protected_needle_in_channel', 'scope_length_break')
def bake_contact_shading():
    """Ambient occlusion over a few millimetres, baked to vertex colours: depth cues at no runtime cost.
    Parts that slide out of cover (needle, sheath) are left unshaded so they never emerge dark."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device, scene.cycles.samples = 'CPU', 48
    if scene.world is None:
        scene.world = bpy.data.worlds.new('bake')
    scene.world.light_settings.distance = .0045
    for o in [o for o in scene.objects if o.type == 'MESH' and o.name not in AO_SKIP]:
        attribute = o.data.color_attributes.new('contact_shading', 'FLOAT_COLOR', 'POINT')
        o.data.color_attributes.active_color = attribute
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
        for item in attribute.data:
            v = max(.42, 1 - (1 - item.color[0]) * .85)
            item.color = (v, v, v, 1)

def export():
    OUT.mkdir(parents=True, exist_ok=True)
    if not arg('--out'):
        try:
            sys.path.insert(0, str(ROOT / 'scripts'))
            from local_data import local_data_path
            native = local_data_path('raw-assets', 'ebus-guided-models', 'additional')
            native.mkdir(parents=True, exist_ok=True)
            bpy.ops.wm.save_as_mainfile(filepath=str(native / (NAME + '-v2.blend')))
        except Exception as error:                           # the editable source is optional
            print('Native .blend not saved:', error)
    path = OUT / (NAME + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', export_yup=True, export_extras=True,
                              export_animations=False, export_cameras=False, export_lights=False, export_texcoords=False,
                              export_vertex_color='ACTIVE' if '--no-ao' not in ARGS else 'NONE')
    record = {'path': path.name, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
              'objects': [{'id': o.name, 'label': o.get('label'), 'role': o.get('role')} for o in bpy.context.scene.objects],
              'triangles': sum(len(p.vertices) - 2 for o in bpy.context.scene.objects if o.type == 'MESH' for p in o.data.polygons),
              'units': 'm', 'notes': NOTES, 'reviewStatus': 'faculty review pending'}
    manifest_path = OUT / 'asset-manifest.json'
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
        manifest['assets'] = [record if a['path'] == path.name else a for a in manifest['assets']]
        manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    return record

def pose(extension, sheath):
    """The runtime's own placement of the pivots and the stretched shaft, for stills."""
    motion = D * (extension + sheath)
    bpy.data.objects['sheath_motion'].location = W(D * sheath)
    bpy.data.objects['needle_motion'].location = W(motion)
    bpy.data.objects['handle_body_motion'].location = W((sheath, 0, 0))
    bpy.data.objects['handle_motion'].location = W((extension, 0, 0))
    shaft, end = bpy.data.objects['needle_shaft'], RETRACTED_TIP + motion
    shaft.location = W((A + end) / 2 - motion)
    shaft.scale.z = (end - A).length / shaft['spanMm']

def render_previews(directory):
    directory.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1400, 875
    scene.view_settings.view_transform = 'AgX'
    world = bpy.data.worlds.new('preview'); scene.world = world; world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    nodes.clear()
    ambient, backdrop = nodes.new('ShaderNodeBackground'), nodes.new('ShaderNodeBackground')
    ambient.inputs['Color'].default_value, backdrop.inputs['Color'].default_value = (.075, .082, .092, 1), (.012, .028, .04, 1)
    path, mix, output = nodes.new('ShaderNodeLightPath'), nodes.new('ShaderNodeMixShader'), nodes.new('ShaderNodeOutputWorld')
    links.new(path.outputs['Is Camera Ray'], mix.inputs[0])
    links.new(ambient.outputs[0], mix.inputs[1]); links.new(backdrop.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs['Surface'])
    camera = bpy.data.objects.new('preview_camera', bpy.data.cameras.new('preview_camera'))
    scene.collection.objects.link(camera); scene.camera = camera
    camera.data.lens, camera.data.clip_start, camera.data.clip_end = 70, .001, 10
    lights = []
    for name, energy, size, local in (('key', 16, .7, (-.35, .55, .25)), ('fill', 4, 1.0, (.6, -.2, .3)), ('rim', 12, .5, (.2, .5, -.6))):
        data = bpy.data.lights.new(name, 'AREA')
        light = bpy.data.objects.new(name, data); scene.collection.objects.link(light); lights.append((light, Vector(local), energy, size))
    only = arg('--shots').split(',') if arg('--shots') else None
    def shot(filename, target, offset, width, up=(0, -1, 0)):
        if only and filename.split('.')[0] not in only:
            return
        """Look at a web-mm target from target + offset, framed to `width` mm across."""
        target, offset = Vector(target), Vector(offset)
        distance = width / (2 * math.tan(camera.data.angle_x / 2))
        position = target + offset.normalized() * distance
        forward = (W(target) - W(position)).normalized()
        right = forward.cross(W(up) ).normalized()
        true_up = right.cross(forward)
        basis = Matrix((right, true_up, -forward)).transposed().to_4x4()
        camera.matrix_world = Matrix.Translation(W(position)) @ basis
        metres = distance / 1000
        for light, local, energy, size in lights:
            place = camera.matrix_world @ (local * metres * 1.4)
            direction = (W(target) - place).normalized()
            light.matrix_world = Matrix.Translation(place) @ direction.to_track_quat('-Z', 'Y').to_matrix().to_4x4()
            light.data.energy, light.data.size = energy * (metres / .5) ** 2, size * metres
        scene.render.filepath = str(directory / filename)
        bpy.ops.render.render(write_still=True)
    pose(0, 0)
    handle_centre = (X_H0 - 112, Y0, 0)
    shot('handle-side.png', handle_centre, (.05, .15, 1), 250)
    shot('handle-three-quarter.png', (X_H0 - 100, Y0, 0), (.75, -.45, 1), 235)
    shot('handle-distal-detail.png', (X_H0 - 55, Y0, 0), (.3, -.35, 1), 120)
    shot('handle-proximal-detail.png', (X_H0 - 185, Y0, 0), (-.3, -.3, 1), 105)
    shot('tip-retracted.png', (-10, 4, 0), (.05, .15, 1), 92)
    pose(16, 2)
    shot('tip-needle-out.png', (-8, 6, 0), (.05, .15, 1), 92)
    shot('tip-close.png', (-4, 4, 0), (-.25, -.25, 1), 42)
    shot('tip-lens.png', (-2, 2, 0), (.7, .15, 1), 30)
    shot('needle-point.png', tuple(RETRACTED_TIP + D * 14), (-.3, -.2, 1), 11)
    shot('whole.png', ((X_H0 - 225 + 32) / 2, 2, 0), (.05, .15, 1), 360)
    pose(0, 0)

reset()
assembly = build_handle()
build_scope()
build_needle()
build_tissue()
bpy.context.view_layer.update()
facts = check()
if '--no-ao' not in ARGS:
    bake_contact_shading()
record = export()
print(json.dumps({'asset': {k: record[k] for k in ('path', 'bytes', 'sha256', 'triangles')}, 'geometry': facts}, indent=2))
if PREVIEW:
    render_previews(PREVIEW)
