"""Procedurally generate three airway-stent 3D models in Blender (headless):
  A. Cross-type braided (two counter-rotating helical wire families, over/under weave)
  B. Hook-and-cross braided (interlocking sinusoid rows with small hook loops at apexes)
  C. Zigzag laser-cut (stacked Z rings, rectangular strut cross-section, welded apexes)
Renders a preview PNG per stent + a trio shot, exports one GLB per stent, saves .blend.
Run:  Blender --background --python make_stents.py
"""
import bpy
import math
import os

OUT = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

R = 1.0          # stent radius
L = 5.0          # stent length
Z0, Z1 = 0.0, L

# ---------------------------------------------------------------- materials
def make_mat(name, color, metallic, roughness):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return m

MAT_BLACK_WIRE = make_mat("BlackNitinolWire", (0.015, 0.015, 0.017), 0.55, 0.32)
MAT_SILVER     = make_mat("LaserCutNitinol", (0.82, 0.83, 0.85), 1.0, 0.28)
MAT_SILICONE   = make_mat("SiliconeCover", (0.90, 0.89, 0.87), 0.0, 0.42)

# ---------------------------------------------------------------- helpers
def new_collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c

def add_poly_curve(name, pts, coll, mat, bevel_depth=None, bevel_obj=None,
                   cyclic=False, bevel_res=6):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for p, (x, y, z) in zip(sp.points, pts):
        p.co = (x, y, z, 1.0)
    sp.use_cyclic_u = cyclic
    if bevel_obj is not None:
        cu.bevel_mode = 'OBJECT'
        cu.bevel_object = bevel_obj
    else:
        cu.bevel_depth = bevel_depth
        cu.bevel_resolution = bevel_res
    cu.use_fill_caps = True
    ob = bpy.data.objects.new(name, cu)
    ob.data.materials.append(mat)
    coll.objects.link(ob)
    return ob

def add_cover(name, coll, radius, z_lo, z_hi):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=96, radius=radius, depth=z_hi - z_lo,
        end_fill_type='NOTHING', location=(0, 0, (z_lo + z_hi) / 2))
    ob = bpy.context.active_object
    ob.name = name
    ob.data.materials.append(MAT_SILICONE)
    bpy.ops.object.shade_smooth()
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    coll.objects.link(ob)
    return ob

def cyl_pt(theta, r, z):
    return (r * math.cos(theta), r * math.sin(theta), z)

def convert_collection_to_mesh(coll):
    bpy.ops.object.select_all(action='DESELECT')
    curve_obs = [o for o in coll.objects if o.type == 'CURVE']
    if not curve_obs:
        return
    for o in curve_obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = curve_obs[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.shade_smooth()

def export_glb(coll, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in coll.objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB',
                              use_selection=True)

# ================================================================ A. cross braid
def build_cross_braid(coll):
    wr = 0.030                 # wire radius
    N = 9                      # wires per family
    turns = 1.8
    alpha = 2 * math.pi * turns / L      # rad per unit z
    weave_amp = 0.033
    weave_freq = alpha * N               # over/under frequency along z
    samples = 900
    margin = 0.08
    for fam, sgn, rsgn in (("CW", 1.0, 1.0), ("CCW", -1.0, -1.0)):
        for i in range(N):
            phi = 2 * math.pi * i / N
            pts = []
            for s in range(samples + 1):
                z = margin + (L - 2 * margin) * s / samples
                theta = phi + sgn * alpha * z
                r = R + rsgn * weave_amp * math.sin(weave_freq * z + math.pi / 2)
                pts.append(cyl_pt(theta, r, z))
            add_poly_curve(f"CrossWire_{fam}_{i}", pts, coll,
                           MAT_BLACK_WIRE, bevel_depth=wr)
    add_cover("Cover_Cross", coll, R - 0.075, Z0 + 0.05, Z1 - 0.05)

# ================================================================ B. hook & cross
def build_hook_cross(coll):
    wr = 0.045
    n = 6                      # hooks per row around circumference
    amp = 0.48                 # zig amplitude in z
    g = 1.45                   # >1 -> theta reverses near apex -> hook loop
    rows = 9
    spacing = 0.46
    rad_off = 0.035
    samples = 1400
    for k in range(rows):
        zk = 0.55 + k * spacing
        phase = (k % 2) * (math.pi / n)
        r = R + (rad_off if k % 2 == 0 else -rad_off)
        pts = []
        for s in range(samples):
            t = 2 * math.pi * s / samples
            u = n * t + phase * n
            theta = t - (g / n) * math.sin(u)
            z = zk + amp * math.cos(u)
            pts.append(cyl_pt(theta, r, z))
        add_poly_curve(f"HookRow_{k}", pts, coll, MAT_BLACK_WIRE,
                       bevel_depth=wr, cyclic=True)
    add_cover("Cover_HookCross", coll, R - 0.10, Z0 + 0.05, Z1 - 0.05)

# ================================================================ C. zigzag laser-cut
def build_zigzag(coll, profile_obj):
    n = 8                      # up-peaks per ring
    amp = 0.38
    rows = 8
    spacing = 0.52             # < 2*amp -> rows nest like the laser-cut Z pattern
    subdiv = 10
    for k in range(rows):
        zk = 0.50 + k * spacing
        phase = 0.0            # all rows in phase: nested chevrons, not a diamond lattice
        corners = []
        for c in range(2 * n):
            theta = phase + math.pi * c / n
            z = zk + (amp if c % 2 == 0 else -amp)
            corners.append((theta, z))
        pts = []
        for c in range(2 * n):
            t0, z0 = corners[c]
            t1, z1 = corners[(c + 1) % (2 * n)]
            if t1 < t0:
                t1 += 2 * math.pi
            for s in range(subdiv):
                f = s / subdiv
                pts.append(cyl_pt(t0 + (t1 - t0) * f, R, z0 + (z1 - z0) * f))
        add_poly_curve(f"ZigRing_{k}", pts, coll, MAT_SILVER,
                       bevel_obj=profile_obj, cyclic=True)
    add_cover("Cover_Zigzag", coll, R - 0.06, Z0 + 0.05, Z1 - 0.05)

# rectangular strut profile for the laser-cut look
def make_strut_profile():
    w, t = 0.13, 0.05
    cu = bpy.data.curves.new("StrutProfile", 'CURVE')
    cu.dimensions = '2D'
    sp = cu.splines.new('POLY')
    sp.points.add(3)
    for p, (x, y) in zip(sp.points, [(-w/2, -t/2), (w/2, -t/2),
                                     (w/2, t/2), (-w/2, t/2)]):
        p.co = (x, y, 0, 1)
    sp.use_cyclic_u = True
    ob = bpy.data.objects.new("StrutProfile", cu)
    scene.collection.objects.link(ob)
    ob.hide_render = True
    return ob

# ================================================================ build all three
profile = make_strut_profile()
specs = [
    ("Stent_CrossBraid",   build_cross_braid,  -3.6),
    ("Stent_HookCross",    build_hook_cross,    0.0),
    ("Stent_ZigzagLaser",  None,                3.6),
]
collections = {}
for name, builder, xoff in specs:
    coll = new_collection(name)
    collections[name] = coll
    if builder:
        builder(coll)
    else:
        build_zigzag(coll, profile)
    convert_collection_to_mesh(coll)
    export_glb(coll, os.path.join(OUT, name.lower() + ".glb"))
    for o in coll.objects:
        o.location.x += xoff

profile.hide_viewport = True

# ================================================================ studio setup
studio = new_collection("Studio")

def add_area(name, loc, energy, size):
    li = bpy.data.lights.new(name, 'AREA')
    li.energy = energy
    li.size = size
    ob = bpy.data.objects.new(name, li)
    ob.location = loc
    studio.objects.link(ob)
    return ob

target = bpy.data.objects.new("CamTarget", None)
target.location = (0, 0, 2.4)
studio.objects.link(target)

for ob, tgt in [(add_area("Key", (5, -7, 8), 2500, 7),  True),
                (add_area("Fill", (-7, -4, 4), 900, 8), True),
                (add_area("Rim", (0, 8, 7), 1200, 6),   True)]:
    c = ob.constraints.new('TRACK_TO')
    c.target = target

cam_data = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_data)
studio.objects.link(cam)
scene.camera = cam
c = cam.constraints.new('TRACK_TO')
c.target = target

world = bpy.data.worlds.new("World")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.85, 0.85, 0.86, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
scene.world = world

# ================================================================ render settings
scene.render.engine = 'CYCLES'
scene.cycles.samples = 96
scene.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = 'GPU'
    print("Cycles device: GPU/Metal")
except Exception as e:
    scene.cycles.device = 'CPU'
    print("Cycles device: CPU fallback:", e)

def render(path, res_x, res_y):
    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

# per-stent closeups
for name, _, xoff in specs:
    for other, coll in collections.items():
        vis = (other == name)
        for o in coll.objects:
            o.hide_render = not vis
    target.location = (xoff, 0, 2.4)
    cam_data.lens = 48
    cam.location = (xoff + 1.2, -7.6, 3.6)
    render(os.path.join(OUT, name.lower() + ".png"), 960, 1280)

# trio shot
for coll in collections.values():
    for o in coll.objects:
        o.hide_render = False
target.location = (0, 0, 2.4)
cam_data.lens = 45
cam.location = (0, -13.5, 3.8)
render(os.path.join(OUT, "stents_trio.png"), 1920, 1080)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "stents.blend"))
print("DONE")
