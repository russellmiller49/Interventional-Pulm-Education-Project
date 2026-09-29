"""The independent landmark and projection table (independent review, R3).

    python3 scripts/medical-thoracoscopy/landmark_table.py

Written in Python, apart from the TypeScript engine, the scene and three.js, so that two consumers of
one wrong transform cannot agree their way to a pass. It reads only the raw records (the port record,
the port candidates' rib points, the device definitions) and does its own arithmetic: the port's
frame by projection and normalisation, a tilt as an explicit rotation matrix about an explicit axis,
the camera by the conventions stated below, and a pinhole projection. It writes
`src/features/medical-thoracoscopy/test-support/landmark-table.json`, which the Jest suite checks
against the engine and three.js and the browser suite checks against real pixels.

Conventions, stated once (plan, section 4.5; fidelity contract; owner decisions T4, T5):
- Millimetres, LPS (+x the patient's left, +y posterior, +z superior).
- Into the chest: the port record's corridor axis. Across the ribs: from the lower rib point toward
  the upper, less its part along the corridor: toward the head. Along the ribs: into x across.
- A tilt across the ribs by a turns the axis toward the head; then a tilt along by b turns it toward
  "along", about the turned across-direction.
- The tip is `depth` from the pivot along the axis. The camera sits `opticOffsetOnTip` from the tip
  toward the picture's up, and looks along the axis. At roll 0 the picture's up is toward the head;
  a roll of r turns it by r about the axis by the right-hand rule, which is clockwise as one looks
  down the telescope.
- The picture's right is forward x up. A point p projects to x = (p.right / p.forward) / tan(fov/2),
  y = (p.up / p.forward) / tan(fov/2): normalised device coordinates, the field square, 75 degrees.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'src/features/medical-thoracoscopy/content/data'
OUT = ROOT / 'src/features/medical-thoracoscopy/test-support/landmark-table.json'


def norm(v):
    length = math.sqrt(sum(c * c for c in v))
    return [c / length for c in v]


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def sub(a, b):
    return [x - y for x, y in zip(a, b)]


def add(a, b):
    return [x + y for x, y in zip(a, b)]


def mul(a, s):
    return [x * s for x in a]


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def rotation(axis, degrees):
    """The 3 x 3 matrix of a right-hand rotation about a unit axis (written out, not Rodrigues' form)."""
    x, y, z = axis
    c = math.cos(math.radians(degrees))
    s = math.sin(math.radians(degrees))
    t = 1 - c
    return [
        [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
        [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
        [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
    ]


def apply(m, v):
    return [dot(row, v) for row in m]


def fact(devices, device_id, key):
    device = next(d for d in devices['devices'] if d['id'] == device_id)
    return next(f for f in device['facts'] if (f.get('id') or f.get('key')) == key)['value']


def main():
    port = json.loads((DATA / 'anatomy/port-record.json').read_text())
    candidates = json.loads((DATA / 'anatomy/port-candidates.json').read_text())
    devices = json.loads((DATA / 'device-definitions.json').read_text())
    row = next(
        r
        for r in candidates['rows']
        if r['space'] == port['space'] and r['line'] == port['line'] and r['status'] == 'measured'
    )
    inward = norm(port['corridorAxis'])
    ribward = sub(row['upperRibPointLps'], row['lowerRibPointLps'])
    across = norm(sub(ribward, mul(inward, dot(ribward, inward))))
    along = norm(cross(inward, across))
    pivot = port['pivotLps']
    fov = fact(devices, 'operative-telescope', 'fieldOfView')
    offset = fact(devices, 'operative-telescope', 'opticOffsetOnTip')
    focal = 1 / math.tan(math.radians(fov / 2))

    # Asymmetric landmarks, fixed in the anatomy: none is the mirror of another in any axis, and they
    # lie at different depths, so an axis swap, a flipped hand, a mirrored side, a wrong scale or a
    # turned camera each moves at least one of them to a different place in the picture.
    base = add(pivot, mul(inward, 70))
    landmarks = {
        'centre-70': base,
        'superior-12': add(base, [0, 0, 12]),
        'posterior-15': add(base, [0, 15, 0]),
        'anterior-inferior': add(base, [0, -9, -7]),
        'near-45': add(add(pivot, mul(inward, 45)), [0, -10, 6]),
    }
    poses = {
        'straight': {'tiltAcrossRibsDeg': 0, 'tiltAlongRibsDeg': 0, 'depthMm': 20, 'rollDeg': 0},
        'toward-head-10': {'tiltAcrossRibsDeg': 10, 'tiltAlongRibsDeg': 0, 'depthMm': 20, 'rollDeg': 0},
        'along-8': {'tiltAcrossRibsDeg': 0, 'tiltAlongRibsDeg': 8, 'depthMm': 20, 'rollDeg': 0},
        'rolled-90': {'tiltAcrossRibsDeg': 0, 'tiltAlongRibsDeg': 0, 'depthMm': 20, 'rollDeg': 90},
        'combined': {'tiltAcrossRibsDeg': -6, 'tiltAlongRibsDeg': 4, 'depthMm': 28, 'rollDeg': 35},
    }
    table = []
    for name, pose in poses.items():
        turn_across = rotation(along, pose['tiltAcrossRibsDeg'])
        axis = apply(turn_across, inward)
        turned_across = apply(turn_across, across)
        # toward "along": about the turned across-direction, the turn that carries axis toward along
        axis = norm(apply(rotation(turned_across, -pose['tiltAlongRibsDeg']), axis))
        tip = add(pivot, mul(axis, pose['depthMm']))
        headward = norm(sub(across, mul(axis, dot(across, axis))))
        up = norm(apply(rotation(axis, pose['rollDeg']), headward))
        origin = add(tip, mul(up, offset))
        right = cross(axis, up)
        projected = {}
        for key, point in landmarks.items():
            p = sub(point, origin)
            ahead = dot(p, axis)
            projected[key] = {
                'ndc': [focal * dot(p, right) / ahead, focal * dot(p, up) / ahead],
                'aheadMm': ahead,
            }
        table.append(
            {
                'pose': name,
                'scopePose': pose,
                'camera': {'origin': origin, 'forward': axis, 'up': up, 'right': right},
                'landmarks': projected,
            }
        )
    record = {
        'record': 'medical-thoracoscopy-landmark-table',
        'script': 'scripts/medical-thoracoscopy/landmark_table.py',
        'statement': 'Hand-derived in Python from the raw records, apart from the engine and three.js. Expected camera frames and normalised device coordinates for fixed, asymmetric landmarks.',
        'fieldOfViewDeg': fov,
        'opticOffsetMm': offset,
        'landmarks': landmarks,
        'poses': table,
    }
    OUT.write_text(json.dumps(record, indent=2) + '\n')
    for entry in table:
        print(entry['pose'], {k: [round(c, 4) for c in v['ndc']] for k, v in entry['landmarks'].items()})


main()
