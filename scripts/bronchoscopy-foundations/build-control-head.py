"""Generate the section-5 control-head close-up in Blender; no external assets required.

Run: Blender --background --factory-startup --python this-file
Then: node scripts/bronchoscopy-foundations/compress-scope-assets.mjs control-head

Unbranded, authored geometry informed by the owner's handle/lever reference images.
Dimensions and lever travel are presentation choices, not a manufacturer's specifications.
The three movable assemblies have local origins; their pivots are exported alongside the GLB.
"""
import json
import math
import runpy
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
builder = runpy.run_path(str(HERE / 'build-scope-assets.py'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
parts = []
POLYMER = [.019, .022, .027, 1]
RUBBER = [.007, .009, .012, 1]
TRIM = [.075, .084, .094, 1]
INK = [.67, .70, .68, 1]


def collect(obj, name, color=POLYMER, roughness=.34, metallic=0):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    mesh = obj.data
    mesh.calc_loop_triangles()
    parts.append({'name': name,
                  'vertices': [tuple(obj.matrix_world @ v.co) for v in mesh.vertices],
                  'faces': [tuple(t.vertices) for t in mesh.loop_triangles],
                  'color': color, 'roughness': roughness, 'metallic': metallic})
    obj.select_set(False)


def ellipsoid(name, center, scale, color=POLYMER, roughness=.34):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, location=center)
    obj = bpy.context.object
    obj.scale = scale
    collect(obj, name, color, roughness)


def cylinder(name, center, radius, length, color=POLYMER, axis=(0, 1, 0), roughness=.3, metallic=0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=radius, depth=length, location=center)
    obj = bpy.context.object
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector(axis))
    bevel = obj.modifiers.new('Machined edge', 'BEVEL')
    bevel.width = min(.55, length / 5)
    bevel.segments = 3
    collect(obj, name, color, roughness, metallic)


def path(name, points, radius, color=POLYMER, roughness=.34):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 12
    curve.bevel_depth = radius
    curve.bevel_resolution = 4
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for bp, co in zip(spline.bezier_points, points):
        bp.co = co
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    collect(obj, name, color, roughness)


def loft(name, profiles, color=POLYMER, power=2.6):
    # Rounded rectangular cross-sections give a moulded body, rather than joined ellipsoids.
    vertices, faces = [], []
    count = 64
    for y, cx, rx, rz in profiles:
        for i in range(count):
            a = 2 * math.pi * i / count
            c, s = math.cos(a), math.sin(a)
            vertices.append((cx + rx * math.copysign(abs(c) ** (2 / power), c), y,
                             rz * math.copysign(abs(s) ** (2 / power), s)))
    for j in range(len(profiles) - 1):
        for i in range(count):
            a, b = j * count + i, j * count + (i + 1) % count
            faces.append((a, b, b + count, a + count))
    faces += [tuple(reversed(range(count))), tuple(range(len(vertices) - count, len(vertices)))]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    sub = obj.modifiers.new('Moulded contours', 'SUBSURF')
    sub.levels = 2
    collect(obj, name, color)


loft('HEAD_shell', [(-61, 0, 10, 8), (-59, 0, 12, 9), (-53, 0, 12.5, 10),
                   (-29, 1, 13, 11), (-12, 3, 14, 12), (0, 2, 18, 13),
                   (15, 0, 23, 14), (37, -3, 22, 14), (51, -5, 18, 12),
                   (60, -6, 16, 11), (62, -6, 15, 10)])
loft('HEAD_top_cap', [(59, -6, 15, 10), (61, -6, 16, 11), (72, -6, 15, 10),
                     (76, -6, 13, 9), (77, -6, 11, 8)], RUBBER)
# A narrow seam between the control section's moulded halves.
path('HEAD_seam', [(-6, 74, -10), (9, 56, -10), (20, 30, -10), (21, 11, -9),
                   (14, -4, -9), (11, -31, -8), (10, -54, -7)], .28, TRIM)
ellipsoid('HEAD_angulation_plate', (-7, 29, 13), (21, 28, 3.4), RUBBER, .43)
path('HEAD_direction_arc', [(-20, 52, 20), (-26, 45, 20), (-28, 31, 20),
                           (-27, 16, 20), (-21, 7, 20)], .45, INK)
# Text is actual geometry, remaining crisp when the whole head turns.
for letter, pos in [('D', (-19, 50, 20)), ('U', (-20, 3, 20))]:
    font = bpy.data.curves.new('Direction', 'FONT')
    font.body, font.size, font.extrude = letter, 5, .03
    obj = bpy.data.objects.new('Direction', font)
    bpy.context.collection.objects.link(obj)
    obj.location = pos
    collect(obj, 'HEAD_mark_' + letter, INK, .7)
cylinder('HEAD_lever_bearing', (-7, 29, 18), 6.5, 3, TRIM, (0, 0, 1), metallic=.15)
# Lever origin is its pivot, with the paddle extending toward the operator's thumb.
cylinder('LEVER_hub', (0, 0, 0), 6.2, 5, RUBBER, (0, 0, 1))
path('LEVER_arm', [(0, 0, 1), (-9, -.3, 2), (-18, 0, 3)], 3.3, POLYMER)
ellipsoid('LEVER_thumb_pad', (-23, 0, 4), (8, 5.2, 3), RUBBER, .5)
for i in range(5):
    path('LEVER_grip_' + str(i), [(-27 + i * 2, -3.4, 6.1), (-27 + i * 2, 3.4, 6.1)],
         .25, TRIM, .65)
# Index-finger suction valve, angled away from the angulation lever.
axis = Vector((.64, .768, 0))
origin = Vector((21, 36, 1))
for name, distance, r, length, color in [('socket', 0, 8, 9, POLYMER),
                                        ('collar', 6, 8.2, 2, TRIM),
                                        ('stem', 9, 5.9, 6, RUBBER)]:
    cylinder('HEAD_suction_' + name, origin + axis * distance, r, length, color, axis)
cylinder('SUCTION_button', (0, 0, 0), 8.1, 5, [.052, .069, .083, 1], axis, .42)
cylinder('SUCTION_top', axis * 2.55, 6.8, .45, RUBBER, axis, .58)
# Working-channel entrance and a recessed valve opening.
port = Vector((15, -3, 10))
port_axis = Vector((.65, .4, .65)).normalized()
cylinder('HEAD_channel_neck', port, 5.2, 11, RUBBER, port_axis)
cylinder('HEAD_channel_rim', port + port_axis * 6, 6.4, 3, POLYMER, port_axis)
cylinder('HEAD_channel_opening', port + port_axis * 7.6, 3.8, .35, [.002, .003, .004, 1], port_axis)
for y in [-18, -29, -40]:
    path('HEAD_grip_' + str(y), [(9, y + 2, 10), (12.7, y, 6), (14, y - 1, 0)], .45, RUBBER)
for y in [55, -49]:
    cylinder('HEAD_screw_' + str(y), (5, y, 11.1), 1.4, .6, TRIM, (0, 0, 1), .25, .7)
    path('HEAD_screw_slot_' + str(y), [(4.2, y, 11.5), (5.8, y, 11.5)], .16, RUBBER)
# Insertion-tube strain relief and the separate universal cord.
for i in range(9):
    cylinder('HEAD_strain_' + str(i), (0, -62 - i * 2, 0), 7 - i * .45, 2.2, RUBBER)
path('HEAD_insertion_tube', [(0, -78, 0), (0, -95, 0), (3, -112, 0)], 2.3, RUBBER, .28)
path('HEAD_universal_cord', [(-11, -45, -4), (-25, -53, -7), (-31, -72, -8),
                            (-28, -99, -8)], 4.1, RUBBER, .4)

metadata = {'schema': 'bronchoscopy_foundations_control_head/v1',
            'numberClass': 'authored-for-simulation', 'authoredDate': '2026-09-13',
            'clinicalReviewStatus': 'pending', 'units': 'illustrative-mm',
            'interpretation': 'Unbranded control head; separate enlarged views, not a dimensional device model.',
            'leverPivot': [-7, 29, 18], 'leverTravelDeg': 52,
            'suctionPivot': list(origin + axis * 14), 'suctionAxis': list(axis),
            'suctionTravel': 2.4}
builder['write_glb'](builder['CACHE'] / 'control-head.raw.glb', parts, metadata)
(builder['ASSETS'] / 'devices/control-head.json').write_text(json.dumps(metadata, indent=2) + '\n')
print('Generated control head:', len(parts), 'meshes;', sum(len(p['faces']) for p in parts), 'triangles')
