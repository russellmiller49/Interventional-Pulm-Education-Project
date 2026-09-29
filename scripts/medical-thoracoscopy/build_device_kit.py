"""Build the Medical Thoracoscopy device kit with Blender, from the device definitions.

Run with Blender 5.1, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \\
        --python scripts/medical-thoracoscopy/build_device_kit.py -- [--parts id,id]

Every dimension comes from `src/features/medical-thoracoscopy/content/data/device-definitions.json`:
published values, values measured from the manufacturer's reference frames, and values chosen by
the author, each labelled as such there. A number written in this file is rendering detail only:
tessellation, bevels and recesses of half a millimetre or less, the knurling pattern, the widths of
small bands and the material colours. None of them changes a dimension the course states.

Each part is built in its own device frame, in millimetres. For the telescope and the sleeves the
origin is the centre of the distal face; for a tool it is the centre of the distal end of its
sheath, shaft or insulation, and a jaw, hook or button reaches beyond it. -Z runs distally along
the shaft, +Y points from the channel toward the optic, and +X is image right. The frame is
exported as it is (`export_yup=False`), so the GLB holds the same numbers as the definitions.

Named empties mark the anchors that a scene, the space engine or a replacement CAD model attaches
to. Each carries its direction in its extras. No manufacturer name, mark or lettering is modelled.

Outputs, in the owner's local data (an intermediate, never committed):
    raw-assets/medical-thoracoscopy/devices/raw/<device>.glb
    raw-assets/medical-thoracoscopy/devices/blend/<device>.blend
Compression, hashing and the manifest follow in `package_device_kit.mjs`.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.geometry import tessellate_polygon

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))
from local_data import local_data_path  # noqa: E402

DEFINITIONS = REPO / "src/features/medical-thoracoscopy/content/data/device-definitions.json"
MEASUREMENTS = REPO / "src/features/medical-thoracoscopy/content/data/reference-measurements.json"
OUT = ("raw-assets", "medical-thoracoscopy", "devices")
GENERATOR = "scripts/medical-thoracoscopy/build_device_kit.py"


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


D = json.loads(DEFINITIONS.read_text())
DEVICES = {device["id"]: device for device in D["devices"]}
LABEL = D["labelUntilCad"]


def fact(device: str, key: str) -> float:
    """A number from the definitions. Refuses a missing value rather than guessing one."""
    for entry in DEVICES[device]["facts"]:
        if entry["key"] == key:
            if not isinstance(entry["value"], (int, float)):
                raise ValueError(f"{device}.{key} has no numeric value ({entry['status']})")
            return float(entry["value"])
    raise KeyError(f"{device}.{key}")


def form(device: str, key: str) -> dict:
    for entry in DEVICES[device]["forms"]:
        if entry["key"] == key:
            if entry["kind"] == "parameters":
                parameters = entry["parameters"]
                if "sameAsDevice" in parameters:
                    return form(parameters["sameAsDevice"], key)
                return parameters
            return {"points": entry["points"]}
    raise KeyError(f"{device}.{key}")


# ---------------------------------------------------------------------------------------------
# Materials. Colours are rendering detail.

MATERIALS = {
    "mt-steel": ((0.78, 0.79, 0.81, 1.0), 1.0, 0.28),
    "mt-black": ((0.018, 0.018, 0.02, 1.0), 0.0, 0.42),
    "mt-face": ((0.005, 0.005, 0.006, 1.0), 0.0, 0.7),
    "mt-blue": ((0.06, 0.22, 0.72, 1.0), 0.0, 0.38),
    "mt-white": ((0.9, 0.9, 0.88, 1.0), 0.0, 0.5),
    "mt-grey": ((0.62, 0.63, 0.66, 1.0), 0.0, 0.45),
    "mt-glass": ((0.55, 0.65, 0.72, 1.0), 0.0, 0.04),
    "mt-graduation": ((0.08, 0.08, 0.09, 1.0), 0.3, 0.5),
}


def material(name: str) -> bpy.types.Material:
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    colour, metallic, roughness = MATERIALS[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = colour
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return mat


# ---------------------------------------------------------------------------------------------
# Geometry, built as plain vertex and face lists in the device frame.


class Part:
    """One mesh: vertices, faces and the material of each face."""

    def __init__(self, name: str):
        self.name = name
        self.vertices: list[tuple[float, float, float]] = []
        self.faces: list[tuple[tuple[int, ...], str]] = []

    def vertex(self, point) -> int:
        self.vertices.append((float(point[0]), float(point[1]), float(point[2])))
        return len(self.vertices) - 1

    def face(self, indices, mat: str) -> None:
        if len(set(indices)) >= 3:
            self.faces.append((tuple(indices), mat))


class Axis:
    """A local frame: `origin`, the axis `w`, and `a`, `b` across it (b = w x a)."""

    def __init__(self, origin=(0.0, 0.0, 0.0), direction=(0.0, 0.0, 1.0), up=(0.0, 1.0, 0.0)):
        self.origin = Vector(origin)
        self.w = Vector(direction).normalized()
        up = Vector(up)
        a = up - up.dot(self.w) * self.w
        if a.length < 1e-9:
            a = Vector((1.0, 0.0, 0.0)) - Vector((1.0, 0.0, 0.0)).dot(self.w) * self.w
        self.a = a.normalized()
        self.b = self.w.cross(self.a)

    def point(self, s: float, r: float, theta: float) -> Vector:
        return self.origin + self.w * s + (self.a * math.cos(theta) + self.b * math.sin(theta)) * r


def lathe(part: Part, axis: Axis, profile, mats, segments: int, phase: float = 0.0,
          radius_at=None, closed: bool = False, cap_start: bool = True, cap_end: bool = True) -> None:
    """A surface of revolution. `profile` is a list of (s, r); `mats` gives each span's material
    (one name for all). A point with r == 0 is a pole. The profile is traversed so the solid lies
    on its left: outward along the outer surface, back along an inner one. `radius_at(theta, r)`
    may shape a ring (knurling). Open ends are capped."""
    if isinstance(mats, str):
        mats = [mats] * (len(profile) - 1 + (1 if closed else 0))
    rings: list[list[int]] = []
    for s, r in profile:
        if r <= 1e-9:
            rings.append([part.vertex(axis.point(s, 0.0, 0.0))])
            continue
        ring = []
        for j in range(segments):
            theta = phase + 2 * math.pi * j / segments
            radius = radius_at(theta, r) if radius_at else r
            ring.append(part.vertex(axis.point(s, radius, theta)))
        rings.append(ring)
    count = len(rings) if closed else len(rings) - 1
    for i in range(count):
        first, second = rings[i], rings[(i + 1) % len(rings)]
        mat = mats[i]
        if len(first) == 1 and len(second) == 1:
            continue
        for j in range(segments):
            k = (j + 1) % segments
            if len(first) == 1:
                part.face((first[0], second[k], second[j]), mat)
            elif len(second) == 1:
                part.face((first[j], first[k], second[0]), mat)
            else:
                part.face((first[j], first[k], second[k], second[j]), mat)
    if not closed:
        for index, ring, towards in ((0, rings[0], profile[1][0] - profile[0][0]),
                                     (-1, rings[-1], profile[-1][0] - profile[-2][0])):
            if len(ring) == 1 or (index == 0 and not cap_start) or (index == -1 and not cap_end):
                continue
            forward = towards > 0 if index == -1 else towards < 0
            part.face(tuple(ring) if forward else tuple(reversed(ring)), mats[0 if index == 0 else -1])


def flat_face(part: Part, loops, mat: str, normal: Vector) -> None:
    """A flat face with holes: the first loop is the outline, the rest are holes."""
    points = [Vector(p) for loop in loops for p in loop]
    triangles = tessellate_polygon([[tuple(p) for p in loop] for loop in loops])
    indices = [part.vertex(p) for p in points]
    for a, b, c in triangles:
        n = (points[b] - points[a]).cross(points[c] - points[a])
        if n.dot(normal) < 0:
            b, c = c, b
        part.face((indices[a], indices[b], indices[c]), mat)


def extrude_loop(part: Part, loop, z0: float, z1: float, mat: str, inward: bool) -> None:
    """Walls joining a loop at z0 to the same loop at z1. `inward` faces them toward the loop's
    inside, as the wall of a hole does."""
    n = len(loop)
    low = [part.vertex((x, y, z0)) for x, y in loop]
    high = [part.vertex((x, y, z1)) for x, y in loop]
    area = sum(loop[i][0] * loop[(i + 1) % n][1] - loop[(i + 1) % n][0] * loop[i][1] for i in range(n))
    counter_clockwise = area > 0
    for i in range(n):
        j = (i + 1) % n
        quad = (low[i], low[j], high[j], high[i])
        # With z1 > z0 a counter-clockwise loop gives outward walls.
        outward = counter_clockwise == (z1 > z0)
        part.face(quad if outward != inward else tuple(reversed(quad)), mat)


def circle(cx: float, cy: float, r: float, n: int, z: float, start: float = math.pi / 2):
    return [(cx + r * math.cos(start + 2 * math.pi * i / n), cy + r * math.sin(start + 2 * math.pi * i / n), z)
            for i in range(n)]


def catmull_rom(points, samples: int, closed: bool = True):
    """A smooth closed curve through the points."""
    out = []
    n = len(points)
    for i in range(n if closed else n - 1):
        p0, p1, p2, p3 = (Vector(points[(i + k) % n]) for k in (-1, 0, 1, 2))
        for step in range(samples):
            t = step / samples
            t2, t3 = t * t, t * t * t
            p = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                       + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
            out.append((p.x, p.y))
    return out


def helix_ridge(part: Part, axis: Axis, r_root: float, depth: float, pitch: float, s0: float,
                s1: float, mat: str, steps_per_turn: int = 20) -> None:
    """A thread: a trapezoidal ridge wound on a cylinder of radius `r_root`."""
    half_base = 0.32 * pitch
    half_top = 0.12 * pitch
    section = [(-half_base, 0.0), (-half_top, depth), (half_top, depth), (half_base, 0.0)]
    turns = (s1 - s0) / pitch
    steps = max(2, int(turns * steps_per_turn))
    rings = []
    for k in range(steps + 1):
        theta = 2 * math.pi * turns * k / steps
        s_centre = s0 + (s1 - s0) * k / steps
        rings.append([part.vertex(axis.point(s_centre + ds, r_root - 0.05 if dr == 0 else r_root + dr, theta))
                      for ds, dr in section])
    for k in range(steps):
        a, b = rings[k], rings[k + 1]
        for i in range(len(section) - 1):
            part.face((a[i], b[i], b[i + 1], a[i + 1]), mat)
    part.face(tuple(rings[0]), mat)
    part.face(tuple(reversed(rings[-1])), mat)


def box(part: Part, centre, size, mat: str, rotation: Matrix | None = None) -> None:
    cx, cy, cz = centre
    hx, hy, hz = (v / 2 for v in size)
    corners = [Vector((x, y, z)) for x in (-hx, hx) for y in (-hy, hy) for z in (-hz, hz)]
    if rotation is not None:
        corners = [rotation @ c for c in corners]
    idx = [part.vertex(Vector((cx, cy, cz)) + c) for c in corners]
    for quad in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        part.face(tuple(idx[q] for q in quad), mat)


def torus(part: Part, centre, normal, major: float, minor: float, mat: str, segments=40, sides=12,
          arc=(0.0, 2 * math.pi)) -> None:
    axis = Axis(centre, normal, up=(0.0, 1.0, 0.0) if abs(Vector(normal).y) < 0.9 else (0.0, 0.0, 1.0))
    full = abs(arc[1] - arc[0] - 2 * math.pi) < 1e-9
    count = segments if full else segments + 1
    rings = []
    for i in range(count):
        phi = arc[0] + (arc[1] - arc[0]) * i / segments
        centre_i = axis.origin + (axis.a * math.cos(phi) + axis.b * math.sin(phi)) * major
        radial = (axis.a * math.cos(phi) + axis.b * math.sin(phi))
        ring = []
        for j in range(sides):
            psi = 2 * math.pi * j / sides
            ring.append(part.vertex(centre_i + (radial * math.cos(psi) + axis.w * math.sin(psi)) * minor))
        rings.append(ring)
    for i in range(count if full else count - 1):
        a, b = rings[i], rings[(i + 1) % count]
        for j in range(sides):
            k = (j + 1) % sides
            part.face((a[j], a[k], b[k], b[j]), mat)
    if not full:
        part.face(tuple(reversed(rings[0])), mat)
        part.face(tuple(rings[-1]), mat)


# ---------------------------------------------------------------------------------------------
# Blender objects


def to_object(part: Part, parent, location=(0.0, 0.0, 0.0), smooth_angle: float = 35.0):
    mesh = bpy.data.meshes.new(part.name)
    names = []
    for _, mat in part.faces:
        if mat not in names:
            names.append(mat)
    bm = bmesh.new()
    verts = [bm.verts.new(Vector(v) - Vector(location)) for v in part.vertices]
    for indices, mat in part.faces:
        try:
            f = bm.faces.new([verts[i] for i in indices])
        except ValueError:
            continue  # a duplicate face
        f.material_index = names.index(mat)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(mesh)
    bm.free()
    for name in names:
        mesh.materials.append(material(name))
    mesh.shade_smooth()
    mesh.set_sharp_from_angle(angle=math.radians(smooth_angle))
    obj = bpy.data.objects.new(part.name, mesh)
    obj.location = location
    obj.parent = parent
    bpy.context.scene.collection.objects.link(obj)
    return obj


def anchor(parent, name: str, position, direction, description: str, up=(0.0, 1.0, 0.0)):
    """An empty whose +Z points along `direction`."""
    obj = bpy.data.objects.new(f"anchor:{name}", None)
    obj.empty_display_type = "ARROWS"
    obj.empty_display_size = 4.0
    axis = Axis(position, direction, up)
    rotation = Matrix((axis.b * -1, axis.a, axis.w)).transposed()  # columns: x, y, z
    obj.matrix_world = Matrix.Translation(Vector(position)) @ rotation.to_4x4()
    obj.parent = parent
    obj["anchor"] = name
    obj["position"] = [round(float(v), 4) for v in position]
    obj["direction"] = [round(float(v), 6) for v in Vector(direction).normalized()]
    obj["description"] = description
    bpy.context.scene.collection.objects.link(obj)
    return obj


def root(device_id: str, extras: dict, definition: str | None = None):
    """The node every part hangs from, carrying what the model is and what it was built from."""
    obj = bpy.data.objects.new(f"device:{device_id}", None)
    obj.empty_display_type = "PLAIN_AXES"
    device = DEVICES[definition or device_id]
    obj["deviceId"] = device_id
    obj["definitionId"] = definition or device_id
    obj["standard"] = device["standard"]
    obj["label"] = LABEL
    obj["units"] = "mm"
    obj["frame"] = ("Origin at the centre of the distal face (for a tool, of the distal end of its sheath, "
                    "shaft or insulation); -Z distal along the shaft; +Y from the channel toward the optic; "
                    "+X image right.")
    obj["productNumbers"] = [entry["number"] for entry in device["productNumbers"]]
    obj["definitionsSha256"] = sha256_file(DEFINITIONS)
    obj["measurementsSha256"] = sha256_file(MEASUREMENTS)
    obj["generator"] = GENERATOR
    obj["generatorSha256"] = sha256_file(Path(__file__))
    for key, value in extras.items():
        obj[key] = value
    bpy.context.scene.collection.objects.link(obj)
    return obj


# ---------------------------------------------------------------------------------------------
# The telescope

T = "operative-telescope"


def smooth_outline(points, window: int = 5):
    """A running mean over the measured outline. It moves no point by more than a tenth of a
    millimetre, well inside the outline's tolerance."""
    out = []
    half = window // 2
    for i in range(len(points)):
        lo, hi = max(0, i - half), min(len(points), i + half + 1)
        out.append((points[i][0], sum(p[1] for p in points[lo:hi]) / (hi - lo)))
    return out


def channel_loop(z: float, grow: float = 0.0, samples: int = 6):
    """The channel's outline at the distal face, from the measured half-widths, smoothed."""
    points = form(T, "channelOutline")["points"]
    top = fact(T, "channelTop")
    bottom = -fact(T, "channelBottom")
    right = [(w, h) for h, w in points]
    left = [(-w, h) for h, w in reversed(points)]
    ring = [(0.0, top)] + right + [(0.0, bottom)] + left
    centre_y = -fact(T, "channelExitOnTip")
    smooth = catmull_rom(ring, samples)
    if grow:
        grown = []
        for x, y in smooth:
            d = Vector((x, y - centre_y))
            grown.append((x + d.normalized().x * grow, y + d.normalized().y * grow))
        smooth = grown
    # The measured largest circle lies inside the channel by definition; smoothing must not cut
    # into it. Then nothing may cross the inner wall.
    circle_r = fact(T, "channelInscribedDiameter") / 2 + grow
    widened = []
    for x, y in smooth:
        d = Vector((x, y - centre_y))
        widened.append((x, y) if d.length >= circle_r else (d.normalized().x * circle_r,
                                                              centre_y + d.normalized().y * circle_r))
    # At its lowest the channel is bounded by the shaft's own wall, as frame 3 shows: the lumen may
    # reach the inner wall, and its rim stops just short of it so the dark face stays one piece.
    inner = fact(T, "shaftOuterDiameter") / 2 - fact(T, "wallThickness")
    limit = inner if grow == 0 else inner - 0.005
    clamped = []
    for x, y in widened:
        r = math.hypot(x, y)
        clamped.append((x * limit / r, y * limit / r) if r > limit else (x, y))
    # Counter-clockwise, seen from the front (-Z looking back): reverse if needed.
    area = sum(clamped[i][0] * clamped[(i + 1) % len(clamped)][1] - clamped[(i + 1) % len(clamped)][0] * clamped[i][1]
               for i in range(len(clamped)))
    if area < 0:
        clamped.reverse()
    return [(x, y, z) for x, y in clamped]


def build_telescope(cutaway: bool = False) -> None:
    radius = fact(T, "shaftOuterDiameter") / 2
    shaft_length = fact(T, "shaftLength")
    wall = fact(T, "wallThickness")
    inner = radius - wall
    segments = 64
    body_axis_y = -fact(T, "bodyAxisBelowShaftAxis")
    channel_y = -fact(T, "channelExitOnTip")
    recess = 0.05  # the dark face sits this far behind the wall's end (rendering detail)

    top = root(T if not cutaway else T + "-cutaway", {
        "name": DEVICES[T]["name"] + (", cutaway" if cutaway else ""),
        "fieldOfViewDeg": fact(T, "fieldOfView"),
        "fieldOfViewCategory": "authored simulation assumption",
        "directionOfViewDeg": fact(T, "directionOfView"),
    }, definition=T)

    # Shaft: a tube closed inside the body. Its distal end is a thin wall around a dark face.
    shaft_end = shaft_length + 12.0 if not cutaway else 60.0
    part = Part("shaft")
    lathe(part, Axis(), [(recess, inner), (0.0, inner), (0.0, radius), (shaft_end, radius), (shaft_end, 0.0)],
          "mt-steel", segments, cap_start=False)
    if cutaway:
        part = cut_half(part)
    to_object(part, top)

    # Distal face: dark filler with the optic and the channel set into it.
    face = Part("distalFace")
    housing_y = fact(T, "opticHousingCentreAbove")
    housing_r = fact(T, "opticHousingDiameter") / 2
    lens_y = fact(T, "opticOffsetOnTip")
    lens_r = fact(T, "lensDiameter") / 2
    outline = circle(0.0, 0.0, inner, segments, recess)
    housing_loop = circle(0.0, housing_y, housing_r, 40, recess)
    rim_loop = channel_loop(recess, grow=0.06)
    flat_face(face, [outline, list(reversed(housing_loop)), list(reversed(rim_loop))], "mt-face", Vector((0, 0, -1)))
    # Optic housing: a ring flush with the wall, the lens just behind it.
    ring = circle(0.0, housing_y, housing_r, 40, 0.0)
    lens_loop = circle(0.0, lens_y, lens_r, 32, 0.0)
    flat_face(face, [ring, list(reversed(lens_loop))], "mt-steel", Vector((0, 0, -1)))
    extrude_loop(face, [(x, y) for x, y, _ in ring], 0.0, recess, "mt-steel", inward=False)
    extrude_loop(face, [(x, y) for x, y, _ in lens_loop], 0.0, 0.03, "mt-steel", inward=True)
    flat_face(face, [circle(0.0, lens_y, lens_r, 32, 0.03)], "mt-glass", Vector((0, 0, -1)))
    # Channel: its rim at the face, and its wall running back into the shaft.
    channel = channel_loop(0.0)
    flat_face(face, [channel_loop(0.0, grow=0.06), list(reversed(channel))], "mt-steel", Vector((0, 0, -1)))
    extrude_loop(face, [(x, y) for x, y, _ in channel_loop(0.0, grow=0.06)], 0.0, recess, "mt-steel", inward=False)
    depth = 20.0 if not cutaway else 58.0
    extrude_loop(face, [(x, y) for x, y, _ in channel], 0.0, depth, "mt-black", inward=True)
    flat_face(face, [channel_loop(depth)], "mt-face", Vector((0, 0, -1)))
    if cutaway:
        # The optics run back from the lens, drawn as a plain rod: how the image is carried is not
        # established, so nothing inside it is drawn.
        lathe(face, Axis((0.0, lens_y, 0.0)), [(0.03, 0.0), (0.03, lens_r), (58.0, lens_r), (58.0, 0.0)],
              "mt-glass", 24)
        face = cut_half(face)
    to_object(face, top, smooth_angle=20.0)

    anchor(top, "distalFace", (0.0, 0.0, 0.0), (0.0, 0.0, -1.0),
           "Centre of the distal face. -Z is distal along the shaft.")
    anchor(top, "opticalOrigin", (0.0, lens_y, 0.0), (0.0, 0.0, -1.0),
           "Centre of the lens; the scope camera sits here and looks along -Z (0 degree direction of view).")
    anchor(top, "channelExit", (0.0, channel_y, 0.0), (0.0, 0.0, -1.0),
           "Centre of the working channel's exit; a tool leaves along -Z.")
    if cutaway:
        return

    anchor(top, "shaftAxis", (0.0, 0.0, 0.0), (0.0, 0.0, 1.0),
           "The shaft axis, from the distal face toward the body.")
    anchor(top, "workingLengthEnd", (0.0, 0.0, shaft_length), (0.0, 0.0, 1.0),
           "Where the published working length ends and the body begins.")

    # Body: a surface of revolution about its own axis, below the shaft axis.
    outline = smooth_outline(form(T, "bodyOutline")["points"])
    body_end = fact(T, "bodyEndsAt")
    ring_r = fact(T, "valveRingHalfWidth") - fact(T, "channelExitOnTip")
    profile = [(outline[0][0] - 0.3, 0.0)] + [(u, hw + body_axis_y) for u, hw in outline]
    profile += [(body_end, outline[-1][1] + body_axis_y), (body_end, ring_r - 0.4), (body_end - 3.0, 0.0)]
    body = Part("body")
    lathe(body, Axis((0.0, body_axis_y, 0.0)), profile, "mt-steel", 72)
    to_object(body, top, smooth_angle=40.0)

    # Valve ring (knurled) and sealing cap, on the channel's axis.
    cap_start = fact(T, "sealingCapStartsAt")
    cap_r = fact(T, "sealingCapHalfWidth") - fact(T, "channelExitOnTip")
    entry = fact(T, "channelLength")
    flutes = 24

    def knurl(theta: float, r: float) -> float:
        return r - 0.35 * max(0.0, math.cos(flutes * theta)) ** 4

    valve = Part("valveRing")
    lathe(valve, Axis((0.0, channel_y, 0.0)), [(body_end - 0.5, 0.0), (body_end - 0.5, ring_r - 0.3),
                                               (body_end, ring_r), (cap_start - 0.3, ring_r),
                                               (cap_start, ring_r - 0.4), (cap_start, 0.0)],
          "mt-black", flutes * 4, radius_at=knurl)
    to_object(valve, top, smooth_angle=60.0)

    cap = Part("sealingCap")
    hole = fact(T, "workingChannelDiameter") / 2
    lathe(cap, Axis((0.0, channel_y, 0.0)), [(entry - 1.5, hole), (entry, hole), (entry - 0.2, cap_r - 1.2),
                                             (entry - 0.8, cap_r - 0.3), (entry - 1.6, cap_r),
                                             (cap_start, cap_r), (cap_start, hole), (entry - 1.5, hole)],
          "mt-blue", 64, closed=True)
    to_object(cap, top, smooth_angle=40.0)
    anchor(top, "channelEntry", (0.0, channel_y, entry), (0.0, 0.0, -1.0),
           "Centre of the channel's entry, on the rear face of the sealing cap; a tool enters along -Z.")

    # Eyepiece, in the plane through the optic and the channel, on the optic's side.
    angle = math.radians(fact(T, "eyepieceAngle"))
    meet = fact(T, "eyepieceAxisMeetsShaft")
    direction = Vector((0.0, math.sin(angle), math.cos(angle)))
    axis = Axis((0.0, 0.0, meet), direction, up=(0.0, math.cos(angle), -math.sin(angle)))
    narrow = fact(T, "eyepieceNarrowDiameter") / 2
    wide = fact(T, "eyepieceWideDiameter") / 2
    neck = fact(T, "eyepieceNeckDiameter") / 2
    cup = fact(T, "eyecupDiameter") / 2
    s_wide = fact(T, "eyepieceWideStartsAt")
    s_ring0, s_ring1 = fact(T, "eyepieceRingFrom"), fact(T, "eyepieceRingTo")
    s_neck = fact(T, "eyepieceNeckStartsAt")
    s_flare = fact(T, "eyecupFlareStartsAt")
    s_cup0, s_cup1 = fact(T, "eyecupWidestFrom"), fact(T, "eyecupWidestTo")
    s_end = fact(T, "eyepieceEndsAt")
    flare = []
    for k in range(1, 9):
        t = k / 8
        flare.append((s_flare + (s_cup0 - s_flare) * t, neck + (cup - neck) * (1 - math.cos(t * math.pi / 2)) ** 0.8))
    rounding = []
    for k in range(1, 9):
        t = k / 8
        rounding.append((s_cup1 + (s_end - s_cup1) * math.sin(t * math.pi / 2),
                         cup - (cup - 0.72 * cup) * (1 - math.cos(t * math.pi / 2))))
    window = 0.38 * cup
    profile = ([(0.0, 0.0), (0.0, narrow), (s_wide - 0.4, narrow), (s_wide, wide), (s_ring0, wide),
                (s_ring1, wide), (s_neck - 0.4, wide), (s_neck, neck), (s_flare, neck)]
               + flare + [(s_cup1, cup)] + rounding + [(s_end, window), (s_end - 0.8, window), (s_end - 0.8, 0.0)])
    mats = ["mt-steel"] * 4 + ["mt-blue"] + ["mt-steel", "mt-steel"] + ["mt-black"] * (len(profile) - 8)
    mats[-1] = "mt-glass"
    eyepiece = Part("eyepiece")
    lathe(eyepiece, axis, profile, mats, 64)
    to_object(eyepiece, top, smooth_angle=40.0)
    anchor(top, "eyepiece", tuple(axis.point(s_end, 0.0, 0.0)), tuple(direction),
           "Centre of the eyepiece's rear face; the eyepiece axis runs along +Z of this anchor.")

    # Light post and stopcock: drawn from inspection, off the plane the measurements were read on.
    body_radius = {round(u, 1): hw + body_axis_y for u, hw in outline}

    def radius_at_u(u: float) -> float:
        keys = sorted(body_radius)
        if u <= keys[0]:
            return body_radius[keys[0]]
        if u >= keys[-1]:
            return body_radius[keys[-1]]
        for a, b in zip(keys, keys[1:]):
            if a <= u <= b:
                return body_radius[a] + (body_radius[b] - body_radius[a]) * (u - a) / (b - a)
        return body_radius[keys[-1]]

    def leaves_body(origin: Vector, d: Vector) -> float:
        s = 0.0
        while s < 60.0:
            p = origin + d * s
            if p.z > body_end or math.hypot(p.x, p.y - body_axis_y) > radius_at_u(p.z):
                return s
            s += 0.1
        return s

    post = form(T, "lightPost")
    side = -1.0 if post["side"] == "left" else 1.0
    around = math.radians(post["aroundDeg"])
    elevation, splay = math.radians(post["elevationDeg"]), math.radians(post["splayDeg"])
    front_u = post["frontAtMm"]
    r_front = radius_at_u(front_u)
    front = Vector((side * r_front * math.cos(around), body_axis_y + r_front * math.sin(around), front_u))
    d_post = Vector((side * math.sin(splay) * math.cos(elevation), math.sin(elevation),
                     math.cos(splay) * math.cos(elevation))).normalized()
    length = post["lengthMm"]
    r_post = post["diameterMm"] / 2
    r_step = post["endStepDiameterMm"] / 2
    s_step = length - post["endStepLengthMm"]
    profile = [(0.0, 0.0)]
    for k in range(1, 7):
        a = math.pi / 2 * k / 6
        profile.append((r_post * (1 - math.sin(a)) * 0.6, r_post * math.sin(a) if k < 6 else r_post))
    profile += [(s_step - 0.5, r_post), (s_step, r_step), (length - 2.5, r_step), (length - 2.5, r_step + 0.6),
                (length - 0.4, r_step + 0.6), (length, r_step), (length, 0.0)]
    light = Part("lightPost")
    lathe(light, Axis(front, d_post), profile, "mt-steel", 40)
    to_object(light, top, smooth_angle=40.0)
    anchor(top, "lightPost", tuple(front + d_post * length), tuple(d_post),
           "End of the light post, where the light cable attaches. Drawn, not measured.")

    stop = form(T, "stopcock")
    elevation = math.radians(stop["elevationDeg"])
    side = 1.0 if stop["side"] == "right" else -1.0
    d_stop = Vector((side * math.cos(elevation), math.sin(elevation), 0.0)).normalized()
    origin = Vector((0.0, body_axis_y, stop["atMm"]))
    s_out = leaves_body(origin, d_stop)
    r_body = stop["bodyDiameterMm"] / 2
    s_top = s_out + stop["bodyLengthMm"]
    r_port = stop["portDiameterMm"] / 2
    s_port = s_top + stop["portLengthMm"]
    cock = Part("stopcock")
    lathe(cock, Axis(origin, d_stop), [(s_out - 3.0, 0.0), (s_out - 3.0, r_body), (s_top, r_body),
                                       (s_top, r_port - 0.8), (s_port - 1.2, r_port - 0.8), (s_port - 1.2, r_port),
                                       (s_port, r_port), (s_port, r_port - 1.4), (s_port - 3.0, 0.0)],
          "mt-steel", 32)
    lever_centre = origin + d_stop * (s_out + stop["bodyLengthMm"] * 0.45)
    lever_dir = Vector((0.0, 0.0, 1.0))
    lever_len = stop["leverLengthMm"]
    box(cock, tuple(lever_centre + lever_dir * (lever_len / 2 + r_body * 0.6)), (1.6, 3.2, lever_len), "mt-black")
    to_object(cock, top, smooth_angle=40.0)
    anchor(top, "stopcock", tuple(origin + d_stop * s_port), tuple(d_stop),
           "Open end of the stopcock's port. Drawn from inspection, not measured.")

    grip = fact(T, "gripAt")
    anchor(top, "grip", (0.0, body_axis_y, grip), (0.0, 0.0, 1.0),
           "Where the hand holds the telescope, for posing it. Authored, not measured.")


def cut_half(part: Part) -> Part:
    """Keep the faces on the +X side of the Y-Z plane, for a cutaway."""
    kept = Part(part.name)
    kept.vertices = list(part.vertices)
    for indices, mat in part.faces:
        if all(part.vertices[i][0] >= -1e-6 for i in indices):
            kept.faces.append((indices, mat))
    return kept


# ---------------------------------------------------------------------------------------------
# Sleeves and trocars


def build_flexible_sleeve() -> None:
    device = "trocar-sleeve-flexible"
    top = root(device, {"name": DEVICES[device]["name"]})
    lumen = fact(device, "capacity") / 2
    outer = fact(device, "outerDiameter") / 2
    length = fact(device, "workingLength")
    head_r = fact(device, "headDiameter") / 2
    head_len = fact(device, "headLength")
    cap_len = fact(device, "capLength")
    thread = form(device, "thread")
    head = form(device, "head")
    root_r = outer - thread["depthMm"]
    shoulder = head["shoulderRadiusMm"]
    end = length + head_len + cap_len

    tube = Part("sleeveTube")
    lathe(tube, Axis(), [(0.0, lumen), (0.0, root_r - 0.25), (0.25, root_r), (length + 1.0, root_r),
                         (length + 1.0, lumen)], "mt-white", 48, closed=True)
    helix_ridge(tube, Axis(), root_r, thread["depthMm"], thread["pitchMm"], thread["plainTipMm"],
                length - 2.0, "mt-white")
    to_object(tube, top, smooth_angle=50.0)

    cap_start = length + head_len
    rounding = []
    for k in range(1, 7):
        t = k / 6
        rounding.append((length + shoulder * math.sin(t * math.pi / 2),
                         root_r + (head_r - root_r) * (1 - math.cos(t * math.pi / 2))))
    top_round = []
    for k in range(1, 7):
        t = k / 6
        top_round.append((end - shoulder * 0.6 + shoulder * 0.6 * math.sin(t * math.pi / 2),
                          head_r - (head_r - (lumen + 1.6)) * (1 - math.cos(t * math.pi / 2)) * 0.35))
    profile = ([(length, lumen), (length, root_r)] + rounding + [(cap_start, head_r)]
               + [(end - shoulder * 0.6, head_r)] + top_round + [(end, lumen + 1.6), (end, lumen)])
    mats = ["mt-white"] * (len(rounding) + 2) + ["mt-blue"] * (len(profile) - len(rounding) - 2)
    head_part = Part("sleeveHead")
    lathe(head_part, Axis(), profile, mats, 64, closed=True)
    to_object(head_part, top, smooth_angle=40.0)

    anchor(top, "distalEnd", (0.0, 0.0, 0.0), (0.0, 0.0, -1.0), "Centre of the sleeve's distal end.")
    anchor(top, "lumenAxis", (0.0, 0.0, 0.0), (0.0, 0.0, 1.0),
           "The lumen's axis, from the distal end toward the head. A telescope passes along it.")
    anchor(top, "headUnderside", (0.0, 0.0, length), (0.0, 0.0, 1.0),
           "Where the published working length ends: the underside of the head, which rests on the skin.")
    anchor(top, "proximalEnd", (0.0, 0.0, end), (0.0, 0.0, 1.0), "Centre of the cap's open end.")


def build_trocar(device: str) -> None:
    top = root(device, {"name": DEVICES[device]["name"]})
    size = fact(device, "size") / 2
    length = fact(device, "workingLength")
    p = form(device, "draftForm")
    tip_end = p["tipEndDiameterMm"] / 2
    taper = p["tipTaperMm"]
    rod = Part("trocarRod")
    profile = [(0.0, 0.0), (0.05, tip_end * 0.7), (0.3, tip_end), (taper, size), (length, size), (length, 0.0)]
    lathe(rod, Axis(), profile, "mt-steel", 32)
    to_object(rod, top, smooth_angle=35.0)
    colour = "mt-white" if p["handleColour"] == "light" else "mt-black"
    handle = Part("trocarHandle")
    hr, hl = p["handleDiameterMm"] / 2, p["handleLengthMm"]
    fr, fl = p["flangeDiameterMm"] / 2, p["flangeLengthMm"]
    lathe(handle, Axis(), [(length, 0.0), (length, hr - 0.5), (length + 0.5, hr), (length + hl, hr),
                           (length + hl, fr - 0.6), (length + hl + 0.6, fr), (length + hl + fl - 0.6, fr),
                           (length + hl + fl, fr - 0.6), (length + hl + fl, 0.0)], colour, 48)
    to_object(handle, top, smooth_angle=40.0)
    anchor(top, "tip", (0.0, 0.0, 0.0), (0.0, 0.0, -1.0), "The rounded tip.")
    anchor(top, "handleFace", (0.0, 0.0, length), (0.0, 0.0, 1.0),
           "Where the published working length ends: the face of the handle.")


def build_valved_sleeve() -> None:
    device = "trocar-sleeve-with-valves"
    top = root(device, {"name": DEVICES[device]["name"]})
    lumen = fact(device, "capacity") / 2
    length = fact(device, "workingLength")
    p = form(device, "draftForm")
    tube_r = p["tubeOuterDiameterMm"] / 2
    rib_r = p["ribOuterDiameterMm"] / 2
    head_r, head_len = p["headDiameterMm"] / 2, p["headLengthMm"]
    valve_r, valve_len = p["valveDiameterMm"] / 2, p["valveLengthMm"]
    ribbed = p["ribbedLengthMm"]
    tube = Part("sleeveTube")
    lathe(tube, Axis(), [(0.0, lumen), (0.0, tube_r - 0.3), (0.3, tube_r), (length - ribbed, tube_r),
                         (length, tube_r + 1.2), (length + 2.0, tube_r + 1.2), (length + 2.0, lumen)],
          "mt-black", 48, closed=True)
    helix_ridge(tube, Axis(), tube_r, rib_r - tube_r, p["ribPitchMm"], length - ribbed, length, "mt-black",
                steps_per_turn=16)
    to_object(tube, top, smooth_angle=50.0)
    head = Part("sleeveHead")
    s0 = length
    lathe(head, Axis(), [(s0, lumen), (s0, tube_r + 1.2), (s0 + 4.0, head_r), (s0 + head_len, head_r),
                         (s0 + head_len, valve_r), (s0 + head_len + valve_len - 1.0, valve_r),
                         (s0 + head_len + valve_len, valve_r - 1.0), (s0 + head_len + valve_len, lumen)],
          ["mt-black"] * 4 + ["mt-blue"] * 4, 56, closed=True)
    port_r, port_len = p["stopcockPortDiameterMm"] / 2, p["stopcockPortLengthMm"]
    lathe(head, Axis((0.0, 0.0, s0 + head_len * 0.55), (0.0, 1.0, 0.0), up=(0.0, 0.0, 1.0)),
          [(head_r - 2.0, 0.0), (head_r - 2.0, port_r + 1.0), (head_r + port_len, port_r + 1.0),
           (head_r + port_len, port_r), (head_r + port_len + 5.0, port_r), (head_r + port_len + 5.0, 0.0)],
          "mt-steel", 28)
    to_object(head, top, smooth_angle=40.0)
    anchor(top, "distalEnd", (0.0, 0.0, 0.0), (0.0, 0.0, -1.0), "Centre of the sleeve's distal end.")
    anchor(top, "lumenAxis", (0.0, 0.0, 0.0), (0.0, 0.0, 1.0), "The lumen's axis.")
    anchor(top, "headUnderside", (0.0, 0.0, length), (0.0, 0.0, 1.0),
           "Where the published working length ends.")


# ---------------------------------------------------------------------------------------------
# Tools


def handle_parts(top, device: str, sheath_end: float) -> None:
    """The simplified pistol-grip ring handle, from its nose at the sheath's proximal end."""
    h = form(device, "handle")
    nose_len, nose_r = h["noseLengthMm"], h["noseBaseDiameterMm"] / 2
    body_len, body_h, body_w = h["bodyLengthMm"], h["bodyHeightMm"], h["bodyWidthMm"]
    shaft_r = fact(device, "shaftOuterDiameter") / 2
    nose = Part("handleNose")
    lathe(nose, Axis((0.0, 0.0, sheath_end)), [(0.0, 0.0), (0.0, shaft_r + 0.4), (nose_len, nose_r),
                                               (nose_len, 0.0)], "mt-grey", 40)
    to_object(nose, top, smooth_angle=35.0)
    body = Part("handleBody")
    z0 = sheath_end + nose_len
    box(body, (0.0, -body_h * 0.1, z0 + body_len / 2), (body_w, body_h, body_len), "mt-black")
    drop = math.radians(h["gripDropDeg"])
    ring_r = h["ringOuterDiameterMm"] / 2 - h["ringBarMm"] / 2
    grip_centre = Vector((0.0, -body_h * 0.6 - ring_r * math.sin(drop), z0 + body_len - ring_r * 0.3))
    torus(body, tuple(grip_centre), (1.0, 0.0, 0.0), ring_r, h["ringBarMm"] / 2, "mt-black")
    to_object(body, top, smooth_angle=45.0)
    # The movable lever, with its own node so a scene can turn it about its pivot.
    pivot = Vector((0.0, -body_h * 0.55, z0 + body_len * 0.35))
    lever = Part("handleLever")
    lever_centre = pivot + Vector((0.0, -ring_r * 1.4, -ring_r * 0.2))
    torus(lever, tuple(lever_centre), (1.0, 0.0, 0.0), ring_r * 0.8, h["ringBarMm"] / 2 * 0.9, "mt-black")
    box(lever, tuple(pivot + Vector((0.0, -ring_r * 0.35, 0.0))), (body_w * 0.6, ring_r * 0.9, 6.0), "mt-black")
    obj = to_object(lever, top, location=tuple(pivot), smooth_angle=45.0)
    obj["pivot"] = "rotates about +X at its origin"
    obj["travelDeg"] = h["leverTravelDeg"]
    anchor(top, "handleFront", (0.0, 0.0, sheath_end), (0.0, 0.0, -1.0),
           "Proximal end of the published sheath length, at the handle's nose. When the tool is fully "
           "inserted this face meets the telescope's channel entry.")


def build_forceps(device: str) -> None:
    top = root(device, {"name": DEVICES[device]["name"]})
    shaft_r = fact(device, "shaftOuterDiameter") / 2
    sheath = fact(device, "sheathLength")
    jaw_len = fact(device, "jawLength")
    jaws = form(device, "jaws")
    hinge_z = jaws["hingeInsideSheathMm"]
    tube = Part("sheath")
    lathe(tube, Axis(), [(0.0, shaft_r - 0.6), (0.0, shaft_r - 0.2), (0.2, shaft_r), (sheath, shaft_r),
                         (sheath, 0.0), (0.4, 0.0), (0.4, shaft_r - 0.6)], "mt-black", 32, closed=True)
    to_object(tube, top, smooth_angle=40.0)
    hinge = Vector((0.0, 0.0, hinge_z))
    opening = 0.0
    if device == "double-spoon-forceps":
        opening = fact(device, "jawOpeningAngle")
        for side, name in ((1.0, "jaw.upper"), (-1.0, "jaw.lower")):
            jaw = Part(name)
            spoon_jaw(jaw, hinge, jaw_len, jaws, side)
            obj = to_object(jaw, top, location=tuple(hinge), smooth_angle=40.0)
            obj["pivot"] = "rotates about +X at its origin; the upper jaw opens toward +Y, the lower toward -Y"
            obj["openDeg"] = opening / 2
    else:
        for side, name in ((1.0, "jaw.upper"), (-1.0, "jaw.lower")):
            jaw = Part(name)
            dissecting_jaw(jaw, hinge, jaw_len, jaws, side)
            obj = to_object(jaw, top, location=tuple(hinge), smooth_angle=40.0)
            obj["pivot"] = "rotates about +X at its origin"
    handle_parts(top, device, sheath)
    tip_z = hinge_z - jaw_len
    anchor(top, "sheathEnd", (0.0, 0.0, 0.0), (0.0, 0.0, -1.0), "Centre of the sheath's distal end.")
    anchor(top, "jawHinge", tuple(hinge), (1.0, 0.0, 0.0),
           "The jaws' hinge; they turn about +X of this anchor.", up=(0.0, 0.0, 1.0))
    anchor(top, "workingElement", tuple(hinge), (0.0, 0.0, -1.0),
           "Start of the working element: the jaws, from the hinge to the tip. Only this part may touch "
           "an authorised target.")
    anchor(top, "toolTip", (0.0, 0.0, tip_z), (0.0, 0.0, -1.0), "The tips of the closed jaws.")
    top["jawOpeningDeg"] = opening


def spoon_jaw(part: Part, hinge: Vector, length: float, p: dict, side: float) -> None:
    """One spoon jaw, closed, built about its hinge. The cup's open face looks toward the other jaw."""
    width, depth, thick = p["cupWidthMm"] / 2, p["cupDepthMm"], p["jawThicknessMm"]
    cup_len = length * 0.62
    arm_len = length - cup_len
    # Arm: a flat bar from the hinge to the cup.
    box(part, (hinge.x, hinge.y + side * (thick / 2 + 0.05), hinge.z - arm_len / 2),
        (width * 1.3, thick, arm_len), "mt-steel")
    # Cup: a half ellipsoid shell, rim at the mid-plane.
    rows, cols = 10, 16
    outer, inner = [], []
    centre = Vector((hinge.x, hinge.y, hinge.z - arm_len - cup_len / 2))
    for i in range(rows + 1):
        u = -math.pi / 2 + math.pi * i / rows
        row_o, row_i = [], []
        for j in range(cols + 1):
            v = math.pi * j / cols
            x = math.cos(v) * math.cos(u)
            y = math.sin(v) * math.cos(u)
            z = math.sin(u)
            row_o.append(part.vertex(centre + Vector((x * width, side * y * depth, z * cup_len / 2))))
            row_i.append(part.vertex(centre + Vector((x * (width - thick), side * y * (depth - thick),
                                                      z * (cup_len / 2 - thick)))))
        outer.append(row_o)
        inner.append(row_i)
    for i in range(rows):
        for j in range(cols):
            quad_o = (outer[i][j], outer[i + 1][j], outer[i + 1][j + 1], outer[i][j + 1])
            quad_i = (inner[i][j], inner[i][j + 1], inner[i + 1][j + 1], inner[i + 1][j])
            part.face(quad_o if side > 0 else tuple(reversed(quad_o)), "mt-steel")
            part.face(quad_i if side > 0 else tuple(reversed(quad_i)), "mt-steel")
    for i in range(rows):
        for j in (0, cols):
            quad = (outer[i][j], inner[i][j], inner[i + 1][j], outer[i + 1][j])
            flip = (j == 0) != (side > 0)
            part.face(tuple(reversed(quad)) if flip else quad, "mt-steel")


def dissecting_jaw(part: Part, hinge: Vector, length: float, p: dict, side: float) -> None:
    base, tipw, thick = p["jawBaseWidthMm"] / 2, p["jawTipWidthMm"] / 2, p["jawThicknessMm"]
    steps = 8
    rows = []
    for k in range(steps + 1):
        t = k / steps
        z = hinge.z - length * t
        w = base + (tipw - base) * t
        h = thick * (1 - 0.5 * t)
        y0 = hinge.y + side * 0.05
        rows.append([part.vertex((hinge.x + dx * w, y0 + side * dy * h, z))
                     for dx, dy in ((-1, 0), (1, 0), (1, 1), (-1, 1))])
    for k in range(steps):
        a, b = rows[k], rows[k + 1]
        for i in range(4):
            j = (i + 1) % 4
            quad = (a[i], a[j], b[j], b[i])
            part.face(quad if side > 0 else tuple(reversed(quad)), "mt-steel")
    part.face(tuple(rows[0]) if side < 0 else tuple(reversed(rows[0])), "mt-steel")
    part.face(tuple(reversed(rows[-1])) if side < 0 else tuple(rows[-1]), "mt-steel")


def build_electrode(device: str) -> None:
    top = root(device, {"name": DEVICES[device]["name"]})
    shaft_r = fact(device, "shaftOuterDiameter") / 2
    length = fact(device, "workingLength")
    p = form(device, "draftForm")
    taper_len = p["insulationTaperLengthMm"]
    tip_r = p["insulationTipDiameterMm"] / 2
    shaft = Part("insulatedShaft")
    lathe(shaft, Axis(), [(0.0, 0.0), (0.0, tip_r), (taper_len, shaft_r), (length, shaft_r), (length, 0.0)],
          "mt-black", 32)
    to_object(shaft, top, smooth_angle=35.0)
    tip = Part("electrodeTip")
    if device == "hook-electrode":
        wire = p["wireDiameterMm"] / 2
        stem, leg = p["hookStemMm"], p["hookLegMm"]
        # The hook stays within the shaft's diameter, so it passes the channel: its stem leaves the
        # insulation off the axis and its leg crosses back over it.
        y0 = -leg / 2
        lathe(tip, Axis((0.0, y0, 0.0)), [(0.5, 0.0), (0.5, wire), (-stem, wire), (-stem, 0.0)], "mt-steel", 16)
        lathe(tip, Axis((0.0, y0, -stem), (0.0, 1.0, 0.0), up=(0.0, 0.0, 1.0)),
              [(-wire, 0.0), (-wire, wire), (leg, wire), (leg + wire * 0.8, 0.0)], "mt-steel", 16)
        tip_point = (0.0, y0 + leg, -stem)
    else:
        neck_r, neck_len = p["neckDiameterMm"] / 2, p["neckLengthMm"]
        button_r = p["buttonDiameterMm"] / 2
        profile = [(0.5, 0.0), (0.5, neck_r), (-neck_len, neck_r)]
        for k in range(0, 13):
            a = math.pi / 2 * k / 12
            profile.append((-neck_len - button_r * math.sin(a), button_r * math.cos(a)))
        lathe(tip, Axis(), profile, "mt-steel", 32)
        tip_point = (0.0, 0.0, -neck_len - button_r)
    to_object(tip, top, smooth_angle=45.0)
    grip(top, length, p["handleLengthMm"], p["handleDiameterMm"] / 2)
    anchor(top, "insulationEnd", (0.0, 0.0, 0.0), (0.0, 0.0, -1.0), "Distal end of the insulation.")
    anchor(top, "toolTip", tip_point, (0.0, 0.0, -1.0), "The active tip.")
    anchor(top, "handleFront", (0.0, 0.0, length), (0.0, 0.0, -1.0),
           "Where the published working length ends, at the handle.")


def grip(top, z0: float, length: float, radius: float) -> None:
    handle = Part("handle")
    profile = [(z0, 0.0), (z0, radius * 0.6), (z0 + 6.0, radius)]
    ribs = 6
    for k in range(ribs):
        s = z0 + 10.0 + (length - 20.0) * k / ribs
        profile += [(s, radius), (s + 1.5, radius * 0.9), (s + 3.0, radius)]
    profile += [(z0 + length - 4.0, radius), (z0 + length, radius * 0.7), (z0 + length, radius * 0.35),
                (z0 + length + 8.0, radius * 0.35), (z0 + length + 8.0, 0.0)]
    lathe(handle, Axis(), profile, "mt-black", 36)
    to_object(handle, top, smooth_angle=40.0)


def build_probe() -> None:
    device = "probe"
    top = root(device, {"name": DEVICES[device]["name"]})
    r = fact(device, "shaftOuterDiameter") / 2
    length = fact(device, "workingLength")
    p = form(device, "draftForm")
    rod = Part("probeRod")
    tip = p["tipRadiusMm"]
    profile = [(-tip, 0.0)]
    for k in range(1, 9):
        a = math.pi / 2 * k / 8
        profile.append((-tip * math.cos(a), r * math.sin(a)))
    interval, band = p["graduationIntervalMm"], p["graduationBandMm"]
    mats = ["mt-steel"] * (len(profile) - 1)
    s = interval
    while s + band < min(100.0, length - 10.0):
        profile += [(s, r), (s + band, r)]
        mats += ["mt-steel", "mt-graduation"]
        s += interval
    profile += [(length, r), (length, 0.0)]
    mats += ["mt-steel", "mt-steel"]
    lathe(rod, Axis(), profile, mats, 32)
    to_object(rod, top, smooth_angle=35.0)
    grip(top, length, p["handleLengthMm"], p["handleDiameterMm"] / 2)
    anchor(top, "toolTip", (0.0, 0.0, -tip), (0.0, 0.0, -1.0), "The rounded tip.")
    anchor(top, "handleFront", (0.0, 0.0, length), (0.0, 0.0, -1.0),
           "Where the published working length ends, at the handle.")


def build_suction() -> None:
    device = "suction-tube"
    top = root(device, {"name": DEVICES[device]["name"]})
    r = fact(device, "outerDiameter") / 2
    length = fact(device, "workingLength")
    p = form(device, "draftForm")
    tube = Part("suctionTube")
    tip = p["tipRadiusMm"]
    profile = [(-tip * 0.4, 0.0)]
    for k in range(1, 7):
        a = math.pi / 2 * k / 6
        profile.append((-tip * 0.4 * math.cos(a), r * math.sin(a)))
    profile += [(length, r), (length, 0.0)]
    lathe(tube, Axis(), profile, "mt-steel", 28)
    # Side holes, drawn as dark discs on the surface.
    for k in range(int(p["sideHoleCount"])):
        z = 3.0 + k * p["sideHoleSpacingMm"]
        theta = math.pi * (k % 2)
        normal = Vector((math.cos(theta + math.pi / 2), math.sin(theta + math.pi / 2), 0.0))
        centre = normal * (r + 0.01) + Vector((0.0, 0.0, z))
        disc_axis = Axis(tuple(centre), tuple(normal), up=(0.0, 0.0, 1.0))
        ring = [tuple(disc_axis.point(0.0, p["sideHoleDiameterMm"] / 2, 2 * math.pi * i / 12)) for i in range(12)]
        flat_face(tube, [ring], "mt-face", normal)
    to_object(tube, top, smooth_angle=35.0)
    cock = Part("stopcock")
    body_r, body_len = p["stopcockBodyDiameterMm"] / 2, p["stopcockBodyLengthMm"]
    lathe(cock, Axis((0.0, 0.0, length)), [(0.0, 0.0), (0.0, body_r), (body_len, body_r), (body_len, r + 0.6),
                                            (body_len + 12.0, r + 0.6), (body_len + 12.0, 0.0)], "mt-steel", 32)
    box(cock, (0.0, body_r + p["leverLengthMm"] / 2 - 2.0, length + body_len * 0.5),
        (2.0, p["leverLengthMm"], 4.0), "mt-black")
    to_object(cock, top, smooth_angle=40.0)
    anchor(top, "toolTip", (0.0, 0.0, -tip * 0.4), (0.0, 0.0, -1.0), "The rounded tip.")
    anchor(top, "stopcock", (0.0, 0.0, length), (0.0, 0.0, 1.0), "Where the stopcock begins.")


BUILDERS = {
    "operative-telescope": lambda: build_telescope(),
    "operative-telescope-cutaway": lambda: build_telescope(cutaway=True),
    "trocar-sleeve-flexible": build_flexible_sleeve,
    "trocar-for-flexible-sleeve": lambda: build_trocar("trocar-for-flexible-sleeve"),
    "trocar-sleeve-with-valves": build_valved_sleeve,
    "trocar-for-sleeve-with-valves": lambda: build_trocar("trocar-for-sleeve-with-valves"),
    "double-spoon-forceps": lambda: build_forceps("double-spoon-forceps"),
    "dissection-forceps": lambda: build_forceps("dissection-forceps"),
    "hook-electrode": lambda: build_electrode("hook-electrode"),
    "button-electrode": lambda: build_electrode("button-electrode"),
    "probe": build_probe,
    "suction-tube": build_suction,
}


def export(name: str) -> Path:
    raw = local_data_path(*OUT, "raw", f"{name}.glb")
    blend = local_data_path(*OUT, "blend", f"{name}.blend")
    raw.parent.mkdir(parents=True, exist_ok=True)
    blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(raw), export_format="GLB", use_selection=False, export_yup=False,
        export_extras=True, export_apply=True, export_animations=False, export_cameras=False,
        export_lights=False, export_materials="EXPORT", export_texcoords=False, export_normals=True,
    )
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
    return raw


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--parts", default=",".join(BUILDERS))
    args = parser.parse_args(argv)
    for name in args.parts.split(","):
        if name not in BUILDERS:
            raise SystemExit(f"Unknown part {name}. Known: {', '.join(BUILDERS)}")
        bpy.ops.wm.read_factory_settings(use_empty=True)
        BUILDERS[name]()
        path = export(name)
        triangles = sum(sum(len(p.vertices) - 2 for p in obj.data.polygons)
                        for obj in bpy.context.scene.objects if obj.type == "MESH")
        print(f"built {name}: {triangles} triangles -> {path}")


main()
