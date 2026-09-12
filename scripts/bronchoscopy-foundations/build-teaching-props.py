"""Author the missing bench, control handle, distal tip and practice props in Blender.

All dimensions and appearances are illustrative teaching choices, not device specifications
or clinical findings. No source scene or patient model is modified.
"""
import json
import math
import runpy
from pathlib import Path

import bmesh

HERE = Path(__file__).resolve().parent
builder = runpy.run_path(str(HERE / 'build-scope-assets.py'))
primitive = builder['primitive_mesh']
join = builder['join_meshes']
write = builder['write_glb']
CACHE = builder['CACHE']
CACHE.mkdir(parents=True, exist_ok=True)


def box(center, size):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co = tuple(center[k] + v.co[k] * size[k] for k in range(3))
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bm.verts.index_update()
    result = ([tuple(v.co) for v in bm.verts], [tuple(v.index for v in f.verts) for f in bm.faces])
    bm.free()
    return result


def item(name, pieces, color, **extra):
    return join(name, pieces, color=color, **extra)


meta = {'numberClass': 'authored-for-simulation', 'units': 'mm',
        'clinicalReviewStatus': 'pending', 'authoredDate': '2026-09-12',
        'interpretation': 'Illustrative teaching props. Not a product, measured finding or patient image.'}

handle = [
    item('HANDLE_body', [primitive('sphere', (0, 0, -35), (9, 7, 32)),
                        primitive('cylinder', (0, 0, -71), (4, 4, 12)),
                        primitive('sphere', (0, 0, -7), (11, 8, 10))], [.07, .09, .12, 1]),
    # Lever and button are authored around their own pivots; scene positions are in props.json.
    item('HANDLE_lever', [box((0, 0, -6), (3, 3, 14)),
                         primitive('sphere', (0, 0, -13), (5, 3, 2))], [.3, .36, .41, 1]),
    item('HANDLE_suction', [primitive('cylinder', (0, 0, 0), (3, 3, 3)),
                           primitive('sphere', (0, 0, 3), (3.2, 3.2, 1))], [.12, .66, .68, 1]),
]
write(CACHE / 'handle.raw.glb', handle, meta)

tip = [
    item('TIP_body', [primitive('cylinder', (0, 0, -3), (1.9, 1.9, 3))], [.13, .17, .2, 1], metallic=.35),
    item('TIP_lens', [primitive('cylinder', (-.65, .65, .05), (.59, .59, .1))], [.06, .23, .3, 1], metallic=.6, roughness=.12),
    item('TIP_light', [primitive('cylinder', (.8, .55, .05), (.38, .38, .1)),
                      primitive('cylinder', (-1.1, -.5, .05), (.28, .28, .1))], [.97, .94, .7, 1]),
    item('TIP_channel', [primitive('cylinder', (.35, -.65, .06), (.62, .62, .12))], [.006, .008, .009, 1]),
]
write(CACHE / 'scope-tip.raw.glb', tip, meta)

# An asymmetric physical card makes optical rotation distinguishable from deflection.
bench = [item('BENCH_card', [box((0, 0, .7), (45, 35, 1.4))], [.9, .91, .87, 1])]
for name, x, y, color in [
    ('cyan', -12, 8, [.06, .65, .71, 1]), ('amber', 12, 8, [.97, .55, .13, 1]),
    ('coral', 12, -8, [.76, .19, .17, 1]), ('navy', -12, -8, [.08, .17, .3, 1]),
]:
    bench.append(item('BENCH_' + name, [primitive('cylinder', (x, y, -.1), (4, 4, .2))], color))
bench.append(item('BENCH_up', [([(-2, 5, -.4), (2, 5, -.4), (0, 11, -.4)], [(0, 1, 2)])], [.12, .16, .2, 1]))
bench.append(item('BENCH_cross', [box((0, 0, -.3), (12, .8, .3)), box((0, 0, -.3), (.8, 8, .3))], [.17, .2, .23, 1]))
write(CACHE / 'bench.raw.glb', bench, meta)

findings = [
    item('PRACTICE_target', [primitive('sphere', (0, 0, 0), (2.4, 2.4, .65))], [.72, .34, .31, 1], roughness=.38),
    item('PRACTICE_secretion', [primitive('sphere', (0, 0, 0), (2, 3.4, .55)),
                              primitive('sphere', (1, -1, 0), (1.8, 1.7, .65))], [.7, .64, .37, 1], roughness=.22),
]
write(CACHE / 'findings.raw.glb', findings, meta)

props = {
    'schema': 'bronchoscopy_foundations_teaching_props/v1', **meta,
    'handle': {'leverPivotMm': [0, 9, -12], 'suctionPivotMm': [-8, 0, -10],
               'leverVisualLimitDeg': 50, 'suctionTravelMm': 1.5},
    'scopeTip': {'odMm': 3.8, 'forwardAxis': '+Z', 'origin': 'distal face'},
    'bench': {'cardCenterMm': [0, 0, 65], 'forwardAxis': '+Z'},
    'practiceTarget': {'aheadMm': 18, 'radialOffsetMm': 3},
}
out = builder['ASSETS'] / 'devices/teaching-props.json'
out.write_text(json.dumps(props, indent=2) + '\n')
print('Built handle, distal tip, asymmetric bench card and authored practice props.')
