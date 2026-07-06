#!/usr/bin/env python3
"""
Universal Scope Tracker v4 - parametric printable parts.

Generates STLs for:
  bench_jig_base / bench_jig_clamp      Phase 0 optical de-risking jig (PRINT FIRST)
  module_b_base / module_b_lid          split clamshell cord tracker (wiper + photogate +
                                        V-groove saddle + PAT9125 cavity + electronics tray)
  module_b_wiper_cassette               slotted felt-ring carrier (print spares)
  module_a_clamp / module_a_follower    lever module: handle C-clamp + AS5600 follower arm
  desk_stand                            flange holder for benchtop use

Every dimension that depends on YOUR scope or YOUR breakout boards is in PARAMS below.
Measure, edit, re-run. Units: mm. Z = up = print bed normal for every part as exported.

Run:
  python3 -m venv cadenv && ./cadenv/bin/pip install trimesh manifold3d numpy shapely matplotlib
  ./cadenv/bin/python scope_tracker_cad.py

Outputs land in ./stl and ./preview next to this script.

Companion docs:
  ../universal_scope_tracker_plan_v4.md   (engineering plan; geometry targets in §6)
  ../scope_tracker_build_guide_v1.md      (assembly + firmware + bring-up)
  ../../../docs/scope-tracker-web-contract.md (firmware <-> web contract)
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import trimesh
from shapely.geometry import Polygon

# ---------------------------------------------------------------------------
# PARAMS - measure your hardware and edit these
# ---------------------------------------------------------------------------

PARAMS = {
    # --- scope (verify with calipers; aScope 4 approx: slim 3.8, regular 5.0, large 5.8)
    "cord_od": 5.0,                 # insertion-cord outer diameter
    "cord_clearance": 0.35,         # radial clearance in the plain channel (plan: 0.2-0.4)
    "handle_neck_od": 22.0,         # Module A clamp seat diameter - MEASURE YOUR SCOPE
    # --- optical tracking zone (plan §6.3)
    "v_angle_deg": 100.0,           # included V angle (test 90-120)
    "optical_slot_w": 2.2,          # slot across the cord (plan 1.5-2.5)
    "optical_slot_len": 9.0,        # slot along the cord
    "sensor_surface_gap": 1.0,      # cord surface -> sensor aperture; tune with shutter/frame sweep
    "sensor_hole_spacing": 17.0,    # PAT9125 breakout mounting-hole spacing - MEASURE YOUR BOARD
    "sensor_cavity_w": 24.0,        # cavity for the sensor breakout (X, along cord)
    "sensor_cavity_d": 20.0,        # cavity across (Y)
    # --- wiper cassette (plan §6.2)
    "wiper_felt_od": 13.0,          # felt washer OD you will punch/cut
    "wiper_felt_thickness": 4.0,    # felt thickness along the cord (plan 3-5)
    # --- module B body
    "b_split_z": 14.0,              # cord-axis height = clamshell split plane
    "b_channel_w": 26.0,            # width of the cord-channel strip
    "b_tray_w": 38.0,               # electronics tray width beside the channel
    "b_len": 108.0,                 # body length (flange sits beyond this)
    "b_lid_t": 10.0,                # lid thickness above the split plane
    "flange_od": 44.0,
    "flange_t": 5.0,
    "flange_bolt_circle": 34.0,     # 4x M3 at 45/135/225/315 deg
    # --- pico + boards (tray bosses)
    "pico_hole_x": 47.0,            # Pi Pico mounting grid
    "pico_hole_y": 11.4,
    # --- module A
    "a_ring_h": 14.0,
    "a_ring_wall": 3.4,
    "a_arm_len": 48.0,              # pivot to shoe centre - iterate to fit your lever throw
    "a_magnet_d": 6.0,              # diametric magnet for AS5600
    "a_magnet_t": 2.5,
    # --- printing
    "self_tap_pilot_m3": 2.6,       # PETG self-tap pilot for M3 (use 2.8 for harder plastics)
    "self_tap_pilot_m2": 1.8,
    "m3_clear": 3.4,
    "m3_head_d": 6.5,
    "peg_d": 3.0,                   # lid alignment pegs
    "peg_clear": 0.35,
}

SEG = 96  # circle segments for cylinders

HERE = Path(__file__).resolve().parent
STL_DIR = HERE / "stl"
PREVIEW_DIR = HERE / "preview"


# ---------------------------------------------------------------------------
# geometry helpers
# ---------------------------------------------------------------------------

def box(sx, sy, sz, at=(0, 0, 0)):
    """Axis-aligned box; `at` is the MIN corner."""
    b = trimesh.creation.box(extents=(sx, sy, sz))
    b.apply_translation((at[0] + sx / 2, at[1] + sy / 2, at[2] + sz / 2))
    return b


def cyl_z(d, h, center_xy=(0, 0), z0=0.0):
    c = trimesh.creation.cylinder(radius=d / 2, height=h, sections=SEG)
    c.apply_translation((center_xy[0], center_xy[1], z0 + h / 2))
    return c


def cyl_x(d, length, x0, center_yz):
    c = trimesh.creation.cylinder(radius=d / 2, height=length, sections=SEG)
    c.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, (0, 1, 0)))
    c.apply_translation((x0 + length / 2, center_yz[0], center_yz[1]))
    return c


def cyl_y(d, length, y0, center_xz):
    c = trimesh.creation.cylinder(radius=d / 2, height=length, sections=SEG)
    c.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, (1, 0, 0)))
    c.apply_translation((center_xz[0], y0 + length / 2, center_xz[1]))
    return c


def frustum_x(r0, r1, length, x0, center_yz):
    """Truncated cone along +X: radius r0 at x0, r1 at x0+length. Watertight."""
    n = SEG
    ang = np.linspace(0, 2 * math.pi, n, endpoint=False)
    ring0 = np.column_stack([np.full(n, x0), r0 * np.cos(ang) + center_yz[0], r0 * np.sin(ang) + center_yz[1]])
    ring1 = np.column_stack([np.full(n, x0 + length), r1 * np.cos(ang) + center_yz[0], r1 * np.sin(ang) + center_yz[1]])
    c0 = np.array([[x0, center_yz[0], center_yz[1]]])
    c1 = np.array([[x0 + length, center_yz[0], center_yz[1]]])
    verts = np.vstack([ring0, ring1, c0, c1])
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + i])
        faces.append([j, n + j, n + i])
        faces.append([2 * n, j, i])          # cap at x0 (normal -X)
        faces.append([2 * n + 1, n + i, n + j])  # cap at x1 (normal +X)
    return trimesh.Trimesh(vertices=verts, faces=np.array(faces), process=True)


def vee_prism_x(x0, length, vertex_z, half_angle_deg, top_z, y_center=0.0):
    """Upward-opening V (in YZ) extruded along X, from its vertex up past top_z."""
    half = math.radians(half_angle_deg)
    w = (top_z - vertex_z) * math.tan(half) + 1.0
    poly = Polygon([
        (y_center, vertex_z),
        (y_center + w, top_z + 2.0),
        (y_center - w, top_z + 2.0),
    ])
    prism = trimesh.creation.extrude_polygon(poly, height=length)  # XY poly extruded along Z
    # map (u, v, w) -> (X=w, Y=u, Z=v)
    m = np.eye(4)
    m[:3, :3] = np.array([[0, 0, 1], [1, 0, 0], [0, 1, 0]])
    prism.apply_transform(m)
    prism.apply_translation((x0, 0, 0))
    return prism


def union(parts):
    return trimesh.boolean.union(parts, engine="manifold")


def cut(base, cutters):
    return trimesh.boolean.difference([base, union(cutters)], engine="manifold")


def finish(mesh, name):
    mesh = trimesh.Trimesh(vertices=mesh.vertices, faces=mesh.faces, process=True)
    ok = mesh.is_watertight
    print(f"  {name:26s} watertight={ok}  bbox={np.round(mesh.extents, 1)}  vol={mesh.volume / 1000:.1f} cm^3")
    if not ok:
        print(f"    WARNING: {name} is not watertight - inspect before printing")
    return mesh


# ---------------------------------------------------------------------------
# derived values
# ---------------------------------------------------------------------------

P = PARAMS
CORD_R = P["cord_od"] / 2
CH_R = CORD_R + P["cord_clearance"]          # plain channel radius
HALF_V = P["v_angle_deg"] / 2
V_DROP = CORD_R / math.sin(math.radians(HALF_V))  # vertex below cord centre when seated

# Module B layout along X (proximal -> distal)
FUNNEL_LEN = 8.0
WIPER_X0, WIPER_X1 = 12.0, 24.0              # cassette slot
GATE_X = 31.0                                 # photogate beam
V_X0, V_X1 = 44.0, 76.0                       # V-groove tracking zone
SLOT_XC = (V_X0 + V_X1) / 2                   # optical window centre
EXIT_FUNNEL_X0 = P["b_len"] - 8.0
CH_Y0, CH_Y1 = -P["b_channel_w"] / 2, P["b_channel_w"] / 2
TRAY_Y0, TRAY_Y1 = CH_Y1, CH_Y1 + P["b_tray_w"]
SPLIT = P["b_split_z"]
LID_TOP = SPLIT + P["b_lid_t"]
CAVITY_CEIL = SPLIT - CORD_R - P["sensor_surface_gap"]

BOLT_XS = (8.0, 36.0, 84.0, 102.0)
BOLT_Y = 9.5
PEGS = ((6.0, 9.0), (6.0, -9.0), (95.0, 9.0), (95.0, -9.0))

WIPER_CASSETTE_T = (WIPER_X1 - WIPER_X0) - 0.5   # X thickness, slides into slot
WIPER_CASSETTE_W = P["b_channel_w"] - 4.0        # Y width
WIPER_SLOT_BASE_Z = 5.0                           # slot floor in the base
WIPER_SLOT_LID_Z = SPLIT + P["b_lid_t"] - 1.8     # slot roof inside the lid


# ---------------------------------------------------------------------------
# Module B - base half
# ---------------------------------------------------------------------------

def build_module_b_base():
    body = box(P["b_len"], P["b_channel_w"], SPLIT, at=(0, CH_Y0, 0))
    tray_block = box(P["b_len"], P["b_tray_w"], SPLIT, at=(0, TRAY_Y0, 0))

    # flange disc (belongs fully to the base), keyhole slot cut later
    flange = cyl_x(P["flange_od"], P["flange_t"], P["b_len"], (0, SPLIT))
    flange = cut(flange, [box(200, 200, 40, at=(-40, -100, -40))])  # clip below bed

    solid = union([body, tray_block, flange])

    cutters = []
    # plain cord half-channel along the full length (upper half removed with the split)
    cutters.append(cyl_x(CH_R * 2, P["b_len"] + P["flange_t"] + 2, -1, (0, SPLIT)))
    # entry / exit funnels
    cutters.append(frustum_x(CH_R + 3.0, CH_R, FUNNEL_LEN, 0, (0, SPLIT)))
    cutters.append(frustum_x(CH_R, CH_R + 3.0, 8.0, EXIT_FUNNEL_X0, (0, SPLIT)))
    # V-groove saddle in the tracking zone (replaces the channel floor)
    cutters.append(vee_prism_x(V_X0, V_X1 - V_X0, SPLIT - V_DROP, HALF_V, SPLIT))
    # optical window through the V vertex
    cutters.append(box(P["optical_slot_len"], P["optical_slot_w"], SPLIT - CAVITY_CEIL + 2,
                       at=(SLOT_XC - P["optical_slot_len"] / 2, -P["optical_slot_w"] / 2, CAVITY_CEIL - 1)))
    # sensor cavity, open to the bottom face (PAT9125 board mounts chip-up against the ceiling)
    cutters.append(box(P["sensor_cavity_w"], P["sensor_cavity_d"], CAVITY_CEIL + 0.001 - 0,
                       at=(SLOT_XC - P["sensor_cavity_w"] / 2, -P["sensor_cavity_d"] / 2, -0.001)))
    # sensor board pilot holes (M2 self-tap into the cavity ceiling)
    for dx in (-P["sensor_hole_spacing"] / 2, P["sensor_hole_spacing"] / 2):
        cutters.append(cyl_z(P["self_tap_pilot_m2"], 5.0, (SLOT_XC + dx, 0), CAVITY_CEIL - 0.2))
    # sensor wire passage into the tray
    cutters.append(box(10, P["b_channel_w"] / 2 + 4, 5, at=(SLOT_XC - 5, 4, 2)))
    # wiper cassette slot
    cutters.append(box(WIPER_X1 - WIPER_X0, WIPER_CASSETTE_W + 0.5, SPLIT - WIPER_SLOT_BASE_Z + 1,
                       at=(WIPER_X0, -(WIPER_CASSETTE_W + 0.5) / 2, WIPER_SLOT_BASE_Z)))
    # photogate: vertical beam hole up to the channel + phototransistor pocket from the bottom
    cutters.append(cyl_z(3.2, SPLIT, (GATE_X, 0), 0))
    cutters.append(cyl_z(5.4, 6.0, (GATE_X, 0), 0))
    # photogate wire groove along the bottom face to the tray side
    cutters.append(box(4, P["b_channel_w"] / 2 + 6, 2.4, at=(GATE_X - 2, 0, 0)))
    # electronics tray pocket
    cutters.append(box(92, P["b_tray_w"] - 8, SPLIT - 6, at=(8, TRAY_Y0 + 4, 6)))
    # USB opening in the distal tray wall (level with a Pico on 3 mm bosses)
    cutters.append(box(P["b_len"] - 92 + 2, 13, 8, at=(98, TRAY_Y0 + 12, 9)))
    # cable exit in the proximal tray wall (Module A cable, with room for strain relief)
    cutters.append(box(10, 9, 7, at=(-1, TRAY_Y0 + 12, 7)))
    # lid bolt pilots
    for bx in BOLT_XS:
        for by in (BOLT_Y, -BOLT_Y):
            cutters.append(cyl_z(P["self_tap_pilot_m3"], 9.5, (bx, by), SPLIT - 9.5))
    # flange keyhole: cord drops in from the top (no tip threading)
    cutters.append(box(P["flange_t"] + 4, P["cord_od"] + 1.6, P["flange_od"] / 2 + 2,
                       at=(P["b_len"] - 2, -(P["cord_od"] + 1.6) / 2, SPLIT)))
    cutters.append(cyl_x(P["cord_od"] + 1.6, P["flange_t"] + 4, P["b_len"] - 2, (0, SPLIT)))
    # flange bolt holes (45/135/225/315 so none land on the split)
    for ang in (45, 135, 225, 315):
        yy = P["flange_bolt_circle"] / 2 * math.cos(math.radians(ang))
        zz = SPLIT + P["flange_bolt_circle"] / 2 * math.sin(math.radians(ang))
        if zz > 2:
            cutters.append(cyl_x(P["m3_clear"], P["flange_t"] + 6, P["b_len"] - 3, (yy, zz)))

    base = cut(solid, cutters)

    # lid alignment pegs (added after cuts)
    pegs = [cyl_z(P["peg_d"], 2.5, (px, py), SPLIT) for px, py in PEGS]
    # Pico bosses in the tray (3 mm tall, M2 pilots)
    bosses = []
    px0, py0 = 96 - P["pico_hole_x"], TRAY_Y0 + 10
    for dx in (0, P["pico_hole_x"]):
        for dy in (0, P["pico_hole_y"]):
            b = cyl_z(6.0, 3.0, (px0 + dx, py0 + dy), 6.0)
            b = cut(b, [cyl_z(P["self_tap_pilot_m2"], 3.2, (px0 + dx, py0 + dy), 6.0)])
            bosses.append(b)
    # PCA9615-B bosses (generic pair, 15 mm apart - adjust to your breakout)
    for dy in (0, 15.0):
        b = cyl_z(5.5, 3.0, (16, TRAY_Y0 + 12 + dy), 6.0)
        b = cut(b, [cyl_z(P["self_tap_pilot_m2"], 3.2, (16, TRAY_Y0 + 12 + dy), 6.0)])
        bosses.append(b)
    return union([base] + pegs + bosses)


# ---------------------------------------------------------------------------
# Module B - lid half (exported upside-down for printing)
# ---------------------------------------------------------------------------

def build_module_b_lid(flip_for_print=True):
    lid = box(P["b_len"] - 2.0, P["b_channel_w"], P["b_lid_t"], at=(0, CH_Y0, SPLIT))

    cutters = []
    # cord half-channel on the underside
    cutters.append(cyl_x(CH_R * 2, P["b_len"] + 2, -1, (0, SPLIT)))
    cutters.append(frustum_x(CH_R + 3.0, CH_R, FUNNEL_LEN, 0, (0, SPLIT)))
    cutters.append(frustum_x(CH_R, CH_R + 3.0, 8.0, EXIT_FUNNEL_X0, (0, SPLIT)))
    # compliant-cap foam recess over the tracking zone: opens into the channel so a
    # 3 mm EVA/PU foam strip stuck to its ceiling presses the cord into the V-groove
    cutters.append(box(V_X1 - V_X0 - 4, 14, CH_R + 1.0, at=(V_X0 + 2, -7, SPLIT + 0.8)))
    # wiper cassette slot (upper half)
    cutters.append(box(WIPER_X1 - WIPER_X0, WIPER_CASSETTE_W + 0.5, WIPER_SLOT_LID_Z - SPLIT + 1,
                       at=(WIPER_X0, -(WIPER_CASSETTE_W + 0.5) / 2, SPLIT - 1)))
    # photogate: beam hole + IR LED pocket from the top + wire groove
    cutters.append(cyl_z(3.2, P["b_lid_t"] + 2, (GATE_X, 0), SPLIT - 1))
    cutters.append(cyl_z(5.4, 5.0, (GATE_X, 0), LID_TOP - 5.0))
    cutters.append(box(4, P["b_channel_w"] / 2 + 2, 2.4, at=(GATE_X - 2, 0, LID_TOP - 2.4)))
    # bolt clearance + counterbores
    for bx in BOLT_XS:
        for by in (BOLT_Y, -BOLT_Y):
            cutters.append(cyl_z(P["m3_clear"], P["b_lid_t"] + 2, (bx, by), SPLIT - 1))
            cutters.append(cyl_z(P["m3_head_d"], 3.4, (bx, by), LID_TOP - 3.4))
    # alignment peg sockets
    for px, py in PEGS:
        cutters.append(cyl_z(P["peg_d"] + P["peg_clear"], 3.2, (px, py), SPLIT - 0.1))

    lid = cut(lid, cutters)
    if flip_for_print:
        # flip upside-down so the print bed face is the (flat) top
        lid.apply_transform(trimesh.transformations.rotation_matrix(math.pi, (1, 0, 0)))
        lid.apply_translation((0, 0, LID_TOP))
        lid.apply_translation((0, 0, -lid.bounds[0][2]))
    return lid


# ---------------------------------------------------------------------------
# Module B - wiper cassette
# ---------------------------------------------------------------------------

def build_wiper_cassette():
    h = WIPER_SLOT_LID_Z - WIPER_SLOT_BASE_Z - 0.6
    cassette = box(WIPER_CASSETTE_T, WIPER_CASSETTE_W, h,
                   at=(-WIPER_CASSETTE_T / 2, -WIPER_CASSETTE_W / 2, 0))
    axis_z = SPLIT - WIPER_SLOT_BASE_Z - 0.3  # cord axis height inside the cassette
    cutters = [
        # felt pocket: through-bore sized for your felt washer OD
        cyl_x(P["wiper_felt_od"] + 0.4, WIPER_CASSETTE_T + 2, -WIPER_CASSETTE_T / 2 - 1, (0, axis_z)),
        # top drop-in slot so the cassette goes over the cord without threading the tip
        box(WIPER_CASSETTE_T + 2, P["cord_od"] + 0.8, h - axis_z + 1,
            at=(-WIPER_CASSETTE_T / 2 - 1, -(P["cord_od"] + 0.8) / 2, axis_z)),
    ]
    cassette = cut(cassette, cutters)
    # stand it on its side for printing (bore axis vertical -> clean circles)
    cassette.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, (0, 1, 0)))
    cassette.apply_translation((0, 0, -cassette.bounds[0][2]))
    return cassette


# ---------------------------------------------------------------------------
# Phase 0 bench jig
# ---------------------------------------------------------------------------

def build_bench_jig_base():
    L, W, H = 46.0, 34.0, 16.0
    blk = box(L, W, H, at=(0, -W / 2, 0))
    vertex_z = H - 1.0 - V_DROP
    ceil_z = H - 1.0 - CORD_R - P["sensor_surface_gap"]
    cutters = [
        vee_prism_x(-1, L + 2, vertex_z, HALF_V, H),
        box(P["optical_slot_len"], P["optical_slot_w"], vertex_z - ceil_z + 3,
            at=(L / 2 - P["optical_slot_len"] / 2, -P["optical_slot_w"] / 2, ceil_z - 1)),
        box(P["sensor_cavity_w"], P["sensor_cavity_d"], ceil_z,
            at=(L / 2 - P["sensor_cavity_w"] / 2, -P["sensor_cavity_d"] / 2, -0.001)),
        box(10, W / 2 + 2, 5, at=(L / 2 - 5, 4, 2)),  # wire exit
    ]
    for dx in (-P["sensor_hole_spacing"] / 2, P["sensor_hole_spacing"] / 2):
        cutters.append(cyl_z(P["self_tap_pilot_m2"], 5, (L / 2 + dx, 0), ceil_z - 0.2))
    for dx in (-15, 15):
        cutters.append(cyl_z(P["self_tap_pilot_m3"], 10, (L / 2 + dx, 0), H - 10))
    return cut(blk, cutters)


def build_bench_jig_clamp():
    L, W, T = 46.0, 12.0, 5.0
    bar = box(L, W, T, at=(0, -W / 2, 0))
    cutters = [box(22, 9, 2.0, at=(L / 2 - 11, -4.5, 0))]  # foam recess (underside)
    for dx in (-15, 15):
        cutters.append(cyl_z(P["m3_clear"], T + 2, (L / 2 + dx, 0), -1))
        cutters.append(cyl_z(P["m3_head_d"], 2.4, (L / 2 + dx, 0), T - 2.4))
    return cut(bar, cutters)


# ---------------------------------------------------------------------------
# Module A - two-piece clamp (half with sensor tower + plain cap half) and
# the follower arm. The halves close around the handle neck with 2x M3.
# ---------------------------------------------------------------------------

def _a_dims():
    ring_id = P["handle_neck_od"] + 1.0          # +1 for a TPU/moleskin pad lining
    ring_od = ring_id + 2 * P["a_ring_wall"]
    return ring_id, ring_od, ring_od / 2, P["a_ring_h"]


def _half_ring(sign):
    """Half annulus: sign=+1 keeps y>=0, sign=-1 keeps y<=0."""
    ring_id, ring_od, r_out, h = _a_dims()
    ring = cut(cyl_z(ring_od, h, (0, 0), 0), [cyl_z(ring_id, h + 2, (0, 0), -1)])
    keep = box(ring_od + 4, r_out + 2, h + 2,
               at=(-r_out - 2, 0 if sign > 0 else -r_out - 2, -1))
    return trimesh.boolean.intersection([ring, keep], engine="manifold")


def _lug(sign, sx):
    """Bolt lug at the y=0 split plane, on the sx (+1/-1) side of the ring."""
    _, _, r_out, h = _a_dims()
    lug_w, lug_t = 8.0, 6.0
    x0 = r_out - 0.5 if sx > 0 else -(r_out - 0.5) - lug_w
    y0 = 0.0 if sign > 0 else -lug_t
    return box(lug_w, lug_t, h, at=(x0, y0, 0))


def _lug_hole_center(sx):
    _, _, r_out, _ = _a_dims()
    return sx * (r_out - 0.5 + 4.0)


def build_module_a_clamp():
    """Tower half (y >= 0): half ring + lugs + sensor tower/ears + button wing."""
    ring_id, ring_od, r_out, h = _a_dims()
    axle_z = 26.0
    ear_gap = 13.0            # hub is 12 wide
    ear_t = 5.0
    ty = r_out - 1.5          # tower front face sits just off the ring
    ear_y0, ear_y1 = ty + 8.0, ty + 8.0 + 26.0
    axle_y = (ear_y0 + ear_y1) / 2

    tower = box(26, 8.0, 40, at=(-13, ty, 0))
    ears = [
        box(ear_t, ear_y1 - ear_y0, 40, at=(ear_gap / 2, ear_y0 - 0.001, 0)),
        box(ear_t, ear_y1 - ear_y0, 40, at=(-ear_gap / 2 - ear_t, ear_y0 - 0.001, 0)),
        # cross-brace between the ear legs for stiffness
        box(ear_gap + 2 * ear_t, ear_y1 - ear_y0, 8, at=(-ear_gap / 2 - ear_t, ear_y0 - 0.001, 0)),
    ]
    wing = box(20, 3.5, 16, at=(13, ty, 8))  # button panel wing
    solid = union([_half_ring(1), _lug(1, 1), _lug(1, -1), tower, wing] + ears)

    ear_face_x = ear_gap / 2 + ear_t
    pocket_depth = 3.8        # leaves a 1.2 mm web between AS5600 chip and magnet
    cutters = [
        # M3 axle clearance through both ears
        cyl_x(P["m3_clear"], 60, -30, (axle_y, axle_z)),
        # AS5600 breakout pocket on the outer +X ear face, chip centred on the axle
        box(pocket_depth, 22.8, 22.8,
            at=(ear_face_x - pocket_depth + 0.001, axle_y - 11.4, axle_z - 11.4)),
        # wire notch out of the pocket toward the rear
        box(pocket_depth, 12, 6, at=(ear_face_x - pocket_depth + 0.001, axle_y + 8, axle_z - 3)),
        # spring anchor hole in the tower top
        cyl_z(2.2, 8, (0, ty + 4), 40 - 8),
    ]
    # lug pilots (cap screws thread into this half)
    for sx in (1, -1):
        cutters.append(cyl_y(P["self_tap_pilot_m3"], 5.5, 0 - 0.5, (_lug_hole_center(sx), h / 2)))
    # button holes in the wing (7 mm panel-mount momentary switches)
    for bx in (19, 27):
        cutters.append(cyl_y(7.2, 6, ty - 1, (bx, 16)))
    # zip-tie slots through the tower plate for the PCA9615-A breakout
    for dz in (5, 23):
        for dx in (-11, 8):
            cutters.append(box(3.0, 10, 2.2, at=(dx, ty - 1, dz)))
    return cut(solid, cutters)


def build_module_a_clamp_cap():
    """Plain half (y <= 0): half ring + lugs with M3 clearance + counterbores."""
    _, _, r_out, h = _a_dims()
    solid = union([_half_ring(-1), _lug(-1, 1), _lug(-1, -1)])
    lug_t = 6.0
    cutters = []
    for sx in (1, -1):
        xc = _lug_hole_center(sx)
        cutters.append(cyl_y(P["m3_clear"], lug_t + 2, -lug_t - 1, (xc, h / 2)))
        cutters.append(cyl_y(P["m3_head_d"], 2.6, -lug_t - 0.01, (xc, h / 2)))
    cap = cut(solid, cutters)
    # flip so the flat split face is up and the round side prints on the bed...
    # actually the split face IS flat and already at y=0; print lying on the split face:
    cap.apply_transform(trimesh.transformations.rotation_matrix(-math.pi / 2, (1, 0, 0)))
    cap.apply_translation((0, 0, -cap.bounds[0][2]))
    return cap


def build_module_a_follower():
    hub_w = 12.0
    hub = cyl_x(12.0, hub_w, -hub_w / 2, (0, 0))                    # axle along X at origin
    arm = box(4.5, P["a_arm_len"], 7.0, at=(-2.25, 0, -3.5))        # beam along +Y
    shoe = cyl_x(9.0, 10.0, -5.0, (P["a_arm_len"], 0))              # roller-shoe at the tip
    post = cyl_x(3.0, 5.0, 2.249, (10.0, 0))                        # spring/rubber-band post off the arm face
    follower = union([hub, arm, shoe, post])
    cutters = [
        cyl_x(3.4, hub_w + 6, -hub_w / 2 - 3, (0, 0)),              # M3 axle bore
        cyl_x(P["a_magnet_d"] + 0.15, P["a_magnet_t"] + 0.2,        # diametric magnet pocket
              hub_w / 2 - (P["a_magnet_t"] + 0.2) + 0.001, (0, 0)),
    ]
    follower = cut(follower, cutters)
    # print flat: rotate so the axle is vertical with the magnet pocket facing up
    follower.apply_transform(trimesh.transformations.rotation_matrix(-math.pi / 2, (0, 1, 0)))
    follower.apply_translation((0, 0, -follower.bounds[0][2]))
    return follower


# ---------------------------------------------------------------------------
# desk stand
# ---------------------------------------------------------------------------

def build_desk_stand():
    base = box(90, 70, 6, at=(0, -35, 0))
    wall = box(6, 60, 58, at=(6, -30, 0))
    gussets = []
    for gy in (-24, 24):
        poly = Polygon([(12, 6), (44, 6), (12, 40)])
        g = trimesh.creation.extrude_polygon(poly, height=5)
        m = np.eye(4)
        m[:3, :3] = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]])  # XY poly -> XZ, extrude along Y
        g.apply_transform(m)
        g.apply_translation((0, gy + 2.5, 0))
        gussets.append(g)
    stand = union([base, wall] + gussets)
    # flange interface: cord pass-through + 4x M3 on the bolt circle
    cutters = [cyl_x(P["cord_od"] + 6, 10, 4, (0, 34))]
    for ang in (45, 135, 225, 315):
        yy = P["flange_bolt_circle"] / 2 * math.cos(math.radians(ang))
        zz = 34 + P["flange_bolt_circle"] / 2 * math.sin(math.radians(ang))
        cutters.append(cyl_x(P["m3_clear"], 10, 4, (yy, zz)))
    # bench screw-down holes
    for cx, cy in ((-38, -28), (-38, 28), (38, -28), (38, 28)):
        cutters.append(cyl_z(4.5, 8, (cx, cy), -1))
    return cut(stand, cutters)


# ---------------------------------------------------------------------------
# preview rendering
# ---------------------------------------------------------------------------

def render_preview(mesh, name):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection

    fig = plt.figure(figsize=(7, 5.5))
    ax = fig.add_subplot(111, projection="3d")
    tris = mesh.vertices[mesh.faces]
    col = Poly3DCollection(tris, alpha=0.95, facecolor="#8fb8d8", edgecolor="#2b4a63", linewidths=0.1)
    ax.add_collection3d(col)
    lo, hi = mesh.bounds
    center = (lo + hi) / 2
    radius = float(np.max(hi - lo)) / 2 * 1.15
    ax.set_xlim(center[0] - radius, center[0] + radius)
    ax.set_ylim(center[1] - radius, center[1] + radius)
    ax.set_zlim(max(0, center[2] - radius), center[2] + radius)
    ax.set_title(f"{name}   ({mesh.extents[0]:.0f} x {mesh.extents[1]:.0f} x {mesh.extents[2]:.0f} mm)")
    ax.view_init(elev=32, azim=-55)
    ax.set_box_aspect((1, 1, 1))
    fig.tight_layout()
    fig.savefig(PREVIEW_DIR / f"{name}.png", dpi=110)
    plt.close(fig)


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    STL_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    print(f"cord_od={P['cord_od']}  channel_r={CH_R:.2f}  V={P['v_angle_deg']}deg  "
          f"vertex_drop={V_DROP:.2f}  cavity_ceiling_z={CAVITY_CEIL:.2f}")
    parts = {
        "bench_jig_base": build_bench_jig_base,
        "bench_jig_clamp": build_bench_jig_clamp,
        "module_b_base": build_module_b_base,
        "module_b_lid": build_module_b_lid,
        "module_b_wiper_cassette": build_wiper_cassette,
        "module_a_clamp": build_module_a_clamp,
        "module_a_clamp_cap": build_module_a_clamp_cap,
        "module_a_follower": build_module_a_follower,
        "desk_stand": build_desk_stand,
    }
    for name, builder in parts.items():
        mesh = finish(builder(), name)
        mesh.export(STL_DIR / f"{name}.stl")
        render_preview(mesh, name)
    print(f"\nSTLs -> {STL_DIR}\npreviews -> {PREVIEW_DIR}")


if __name__ == "__main__":
    main()
