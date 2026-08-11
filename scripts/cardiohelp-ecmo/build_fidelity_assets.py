"""B7 deterministic builders for the CARDIOHELP bedside fidelity assets.

Owner-approved at Visual Approval Gate 1 and the follow-up gate (both
2026-08-11). This script is the reproducible source for five runtime GLBs —
no supplied source files, no manual .blend edits, no randomness beyond
Blender's fixed-parameter procedural textures:

  cardiohelp-console.glb      procedural CARDIOHELP System console (original
                              CARDIOHELP, not Cardiohelp II): blue roll cage,
                              white housing, inclined control face with screen,
                              keypad column, rotary setpoint knob, connector
                              panel with red emergency connector, HLS holder
                              plate with sensor sockets, emergency drive,
                              battery/vent service side. No manufacturer
                              logos or copied artwork.
  patient-femoral-access.glb  neutral non-identifiable supine adult mannequin
                              (~1.75 m, 7.5-head proportions) from a
                              skin-modifier skeleton: defined elbows/knees/
                              ankles, mitten hands, dorsiflexed feet,
                              featureless face with a surgical-cap treatment,
                              fitted chest-to-knees drape with two crisp
                              access windows at the groin sites. No baked
                              gauze — the runtime draws dressings at the
                              layout anchors.
  circuit-clamp.glb           procedural tubing clamp re-proportioned so the
                              jaws straddle the scene's 0.08 m-OD circuit
                              tubing (the previous clamp's 0.048 m jaw span
                              could not reach around the tube it clamps).
  oxygenator.glb              procedural HLS Module Advanced (diamond clear
                              housing, fiber bundle, red frame + volute,
                              plain label plate, stopcocks, brass HX ports,
                              pump stem), replacing the supplied
                              photogrammetry scan and its textures.
  sweep-gas-blender.glb       pole-mounted air/O2 mixer with FiO2 dial, two
                              flowmeter tubes, supply hoses, and the green
                              mixed-gas outlet the runtime sweep line
                              originates from (BLENDER_OUTLET_LOCAL).

Coordinate conventions:
  - Console and clamp are authored in Blender Z-up standing upright; the glTF
    exporter's Y-up conversion lands them upright in three.js, so the runtime
    applies a plain yaw — the legacy [pi, yaw, 0] flip is retired.
  - The patient is authored in the runtime frame (x right, y up, z toward the
    feet) with the dorsal plane at y = -0.095, then rotated into Blender Z-up
    (`orient_for_runtime`) exactly like scripts/cardiohelp-ecmo/prepare_assets.py.
  - The three groin access sites keep their authored (x, z): left vein
    (-0.135, 0.09), right vein (0.135, 0.09), right artery (0.175, 0.055).
    The report prints the raycast-measured skin-surface y at each site plus
    the DPC entry — `layout.ts` groin anchors are re-measured from these.

Known deterministic-material trap, documented because it shipped a defect:
applying a boolean whose cutter has no material inserts a None slot at index
0; a material appended afterwards lands unused at slot 1 while every face
stays indexed 0, and `material_slot_remove_unused` then deletes the real
material at join. That is how the previous patient exported a null material
slot and a default-white drape. Materials are therefore always assigned
BEFORE boolean cuts here.

Run (rebuilds all five in place):
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/cardiohelp-ecmo/build_fidelity_assets.py -- \
    public/models/cardiohelp-ecmo

  # Or a subset:
  ... build_fidelity_assets.py -- public/models/cardiohelp-ecmo --only console
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector

GROIN_SITES = (
    ("left_vein", (-0.135, 0.09)),
    ("right_vein", (0.135, 0.09)),
    ("right_artery", (0.175, 0.055)),
)
DPC_ENTRY_XZ = (0.185, 0.115)

# Circuit tubing outer diameter the clamp must straddle (TUBE_RADII.circuitWall * 2).
TUBE_OUTER_DIAMETER = 0.08


# ---------------------------------------------------------------- shared

def make_material(name, color, *, roughness=0.45, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    principled = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    material.diffuse_color = (*color, 1.0)
    material.metallic = metallic
    material.roughness = roughness
    return material


def srgb(hex_code: str):
    """Hex sRGB -> linear tuple for the Principled Base Color input."""
    rgb = tuple(int(hex_code.lstrip("#")[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return tuple(channel ** 2.2 for channel in rgb)


def export_glb(obj: bpy.types.Object, output_path: Path) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_attributes=False,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )


def join_named(objects, name: str) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    joined.data.name = f"{name}_mesh"
    bpy.ops.object.material_slot_remove_unused()
    return joined


def mesh_stats(obj: bpy.types.Object, output_path: Path) -> dict:
    lo = Vector((min(v.co[i] for v in obj.data.vertices) for i in range(3)))
    hi = Vector((max(v.co[i] for v in obj.data.vertices) for i in range(3)))
    return {
        "output": output_path.name,
        "triangles": sum(max(1, len(p.vertices) - 2) for p in obj.data.polygons),
        "vertices": len(obj.data.vertices),
        "materials": [m.name if m else None for m in obj.data.materials],
        "local_bounds": {
            "min": [round(v, 4) for v in lo],
            "max": [round(v, 4) for v in hi],
        },
        "bytes": output_path.stat().st_size,
    }


# ---------------------------------------------------------------- console

class ConsoleBuild:
    """Approved console Candidate A. All dimensions in meters, Blender Z-up,
    operated face toward -Y (three.js +Z), base resting on z = 0. Envelope
    W 0.67 x D 0.79 x H 0.95 preserves the shipped asset's deliberate ~2x
    display scale (the real unit is 255 x 455 x 427 mm; at true scale it
    would render ~140 px tall at 720p and stop reading as a console)."""

    def __init__(self):
        self.parts: list[bpy.types.Object] = []
        self.palette = {
            "body": make_material("console_body", srgb("#e9ebeb"), roughness=0.42),
            "cage": make_material("console_cage", srgb("#24346a"), roughness=0.5),
            "metal": make_material("console_metal", srgb("#c9ced2"), roughness=0.32, metallic=0.85),
            "screen": make_material("console_screen", srgb("#141f2b"), roughness=0.28),
            "panel": make_material("console_panel", srgb("#2b3238"), roughness=0.55),
            "red": make_material("console_red", srgb("#b52c24"), roughness=0.45),
            "knob": make_material("console_knob", srgb("#dde2e3"), roughness=0.38),
        }

    def rounded_box(self, name, location, size, material, *, bevel=0.02, segments=3):
        bpy.ops.mesh.primitive_cube_add(location=location)
        obj = bpy.context.object
        obj.name = name
        obj.dimensions = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if bevel > 0:
            modifier = obj.modifiers.new("bevel", type="BEVEL")
            modifier.width = min(bevel, min(size) * 0.45)
            modifier.segments = segments
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.data.materials.append(material)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        self.parts.append(obj)
        return obj

    def cylinder(self, name, location, radius, depth, material, *, axis="Z", vertices=28):
        axis_rotation = {
            "Z": (0.0, 0.0, 0.0),
            "X": (0.0, math.radians(90), 0.0),
            "Y": (math.radians(90), 0.0, 0.0),
        }[axis]
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=vertices, radius=radius, depth=depth, location=location,
            rotation=axis_rotation,
        )
        obj = bpy.context.object
        obj.name = name
        obj.data.materials.append(material)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        self.parts.append(obj)
        return obj

    def tube(self, name, points, tube_radius, material, *, resolution=8, cyclic=False,
             bevel_resolution=6):
        curve_data = bpy.data.curves.new(name, type="CURVE")
        curve_data.dimensions = "3D"
        spline = curve_data.splines.new("NURBS")
        spline.points.add(len(points) - 1)
        for index, point in enumerate(points):
            spline.points[index].co = (*point, 1.0)
        spline.use_cyclic_u = cyclic
        spline.use_endpoint_u = not cyclic
        spline.order_u = 3
        spline.resolution_u = resolution
        curve_data.bevel_depth = tube_radius
        curve_data.bevel_resolution = bevel_resolution
        curve_data.use_fill_caps = True
        obj = bpy.data.objects.new(name, curve_data)
        bpy.context.collection.objects.link(obj)
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.convert(target="MESH")
        obj = bpy.context.object
        obj.data.materials.append(material)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        self.parts.append(obj)
        return obj

    def ring(self, name, z, width, depth, corner, tube_radius, material):
        """Rounded-rectangle cage ring in the XY plane at height z."""
        half_w = width / 2 - corner
        half_d = depth / 2 - corner
        c = corner
        points = []
        for corner_pts in (
            [(half_w + c, half_d), (half_w + c, half_d + c * 0.6), (half_w, half_d + c)],
            [(-half_w, half_d + c), (-half_w - c * 0.6, half_d + c), (-half_w - c, half_d)],
            [(-half_w - c, -half_d), (-half_w - c, -half_d - c * 0.6), (-half_w, -half_d - c)],
            [(half_w, -half_d - c), (half_w + c * 0.6, -half_d - c), (half_w + c, -half_d)],
        ):
            for px, py in corner_pts:
                points.append((px, py, z))
        return self.tube(name, points, tube_radius, material, cyclic=True)

    def build(self, output_path: Path) -> dict:
        palette = self.palette

        # Protective transport cage: floor skid ring, carry hoop, four posts.
        self.ring("cage_skid", 0.024, 0.62, 0.72, 0.09, 0.024, palette["cage"])
        self.ring("cage_hoop", 0.915, 0.56, 0.64, 0.09, 0.024, palette["cage"])
        for sx in (-1, 1):
            for sy in (-1, 1):
                self.tube(
                    f"cage_post_{sx}_{sy}",
                    [(sx * 0.276, sy * 0.318, 0.03), (sx * 0.276, sy * 0.318, 0.35),
                     (sx * 0.252, sy * 0.286, 0.65), (sx * 0.252, sy * 0.286, 0.905)],
                    0.022, palette["cage"],
                )
        self.cylinder("handle_grip", (0.0, -0.32, 0.915), 0.03, 0.30, palette["metal"],
                      axis="X", vertices=24)

        # Main housing fills the cage.
        self.rounded_box("housing", (0.0, 0.01, 0.41), (0.56, 0.62, 0.66), palette["body"],
                         bevel=0.045, segments=4)

        # Inclined user-facing control surface, built flat then tilted 8 deg.
        panel_parts: list[bpy.types.Object] = []

        def panel_box(name, location, size, material, *, bevel=0.02, segments=3):
            obj = self.rounded_box(name, location, size, material, bevel=bevel, segments=segments)
            panel_parts.append(obj)
            return obj

        def panel_cylinder(name, location, radius, depth, material, *, vertices=28):
            obj = self.cylinder(name, location, radius, depth, material, axis="Y",
                                vertices=vertices)
            panel_parts.append(obj)
            return obj

        panel_box("panel_body", (0.0, 0.062, 0.0), (0.53, 0.13, 0.38), palette["body"],
                  bevel=0.025)
        panel_box("screen_bezel", (-0.055, -0.006, 0.025), (0.36, 0.028, 0.27),
                  palette["screen"], bevel=0.008)
        panel_box("screen_face", (-0.055, -0.0235, 0.025), (0.325, 0.006, 0.235),
                  palette["screen"], bevel=0.003, segments=1)
        panel_box("keypad_slab", (0.192, -0.004, 0.025), (0.095, 0.024, 0.27),
                  palette["panel"], bevel=0.007)
        for index, key_z in enumerate((0.125, 0.065, 0.005, -0.055)):
            panel_box(f"key_{index}", (0.192, -0.02, key_z), (0.058, 0.012, 0.042),
                      palette["knob"], bevel=0.004, segments=1)
        panel_cylinder("knob_ring", (0.163, -0.022, -0.132), 0.058, 0.016, palette["panel"],
                       vertices=32)
        panel_cylinder("knob_body", (0.163, -0.04, -0.132), 0.05, 0.034, palette["knob"],
                       vertices=20)
        panel_cylinder("knob_cap", (0.163, -0.057, -0.132), 0.035, 0.012, palette["body"],
                       vertices=20)

        tilt = Euler((math.radians(-8.0), 0.0, 0.0))
        for obj in panel_parts:
            offset = obj.location.copy()
            obj.location = (0, 0, 0)
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
            obj.rotation_euler = tilt
            obj.location = Vector((0.0, -0.316, 0.560)) + tilt.to_matrix() @ offset

        # Lower front connector panel: power inlet, two circuit connectors,
        # the red emergency drive connector, ground stud.
        self.rounded_box("connector_panel", (0.0, -0.298, 0.20), (0.40, 0.02, 0.17),
                         palette["panel"], bevel=0.008)
        self.cylinder("connector_red", (0.13, -0.31, 0.21), 0.023, 0.025, palette["red"],
                      axis="Y", vertices=18)
        self.cylinder("connector_a", (0.0, -0.309, 0.20), 0.018, 0.02, palette["metal"],
                      axis="Y", vertices=16)
        self.cylinder("connector_b", (0.06, -0.309, 0.20), 0.018, 0.02, palette["metal"],
                      axis="Y", vertices=16)
        self.rounded_box("power_inlet", (-0.13, -0.306, 0.215), (0.055, 0.018, 0.045),
                         palette["screen"], bevel=0.005, segments=1)
        self.cylinder("ground_stud", (-0.13, -0.308, 0.155), 0.009, 0.018, palette["metal"],
                      axis="Y", vertices=12)

        # HLS holder side (-X): plate, sensor sockets, bracket boss. The
        # holder arm itself is drawn by the runtime from consoleHolderAnchor.
        self.rounded_box("holder_plate", (-0.292, 0.03, 0.47), (0.016, 0.38, 0.44),
                         palette["metal"], bevel=0.006)
        for index, socket_z in enumerate((0.60, 0.52, 0.44)):
            self.cylinder(f"holder_socket_{index}", (-0.302, 0.15, socket_z), 0.016, 0.014,
                          palette["panel"], axis="X", vertices=14)
        self.rounded_box("holder_boss", (-0.306, -0.05, 0.58), (0.03, 0.08, 0.10),
                         palette["metal"], bevel=0.008, segments=2)

        # Emergency hand-crank drive, top rear.
        self.cylinder("emergency_drum", (0.14, 0.20, 0.785), 0.055, 0.09, palette["panel"],
                      axis="Z", vertices=24)
        self.cylinder("crank_arm", (0.165, 0.20, 0.842), 0.011, 0.10, palette["metal"],
                      axis="X", vertices=12)
        self.cylinder("crank_knob", (0.213, 0.20, 0.862), 0.014, 0.045, palette["metal"],
                      axis="Z", vertices=12)

        # Battery / service side (+X) and rear vents.
        for index, vent_z in enumerate((0.30, 0.255, 0.21)):
            self.rounded_box(f"vent_{index}", (0.282, 0.0, vent_z), (0.012, 0.32, 0.024),
                             palette["panel"], bevel=0.004, segments=1)
        self.rounded_box("battery_hatch", (0.283, 0.0, 0.52), (0.012, 0.24, 0.16),
                         palette["body"], bevel=0.005, segments=2)
        self.rounded_box("hatch_slot", (0.29, 0.0, 0.578), (0.008, 0.05, 0.016),
                         palette["panel"], bevel=0.002, segments=1)
        for index, vent_z in enumerate((0.33, 0.375, 0.42)):
            self.rounded_box(f"rear_vent_{index}", (0.0, 0.317, vent_z), (0.32, 0.012, 0.022),
                             palette["panel"], bevel=0.004, segments=1)

        console = join_named(self.parts, "cardiohelp_console")
        lo = Vector((min(v.co[i] for v in console.data.vertices) for i in range(3)))
        hi = Vector((max(v.co[i] for v in console.data.vertices) for i in range(3)))
        console.data.transform(Matrix.Translation(-(lo + hi) / 2))
        console.data.update()

        export_glb(console, output_path)
        return mesh_stats(console, output_path)


def build_console(output_dir: Path) -> dict:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return ConsoleBuild().build(output_dir / "cardiohelp-console.glb")


# ---------------------------------------------------------------- patient

def patient_skeleton():
    """(vertices, edges, radii, root_index) for the skin-modifier body.
    Runtime frame: x right, y up, z toward the feet; supine, face (+y) up."""
    verts: list[tuple[float, float, float]] = []
    radii: list[tuple[float, float]] = []
    edges: list[tuple[int, int]] = []

    def add(position, radius) -> int:
        verts.append(position)
        radii.append(radius)
        return len(verts) - 1

    def chain(*indices):
        for a, b in zip(indices, indices[1:]):
            edges.append((a, b))

    crown = add((0.0, 0.03, -0.815), (0.045, 0.042))
    skull = add((0.0, 0.032, -0.73), (0.083, 0.077))
    jaw = add((0.0, 0.012, -0.632), (0.052, 0.048))
    neck = add((0.0, -0.005, -0.565), (0.044, 0.042))
    chest = add((0.0, 0.02, -0.38), (0.185, 0.115))
    waist = add((0.0, 0.012, -0.16), (0.155, 0.10))
    pelvis = add((0.0, 0.012, 0.02), (0.20, 0.11))
    iliac = add((0.0, 0.008, 0.075), (0.215, 0.105))
    pubis = add((0.0, 0.004, 0.13), (0.17, 0.095))
    chain(crown, skull, jaw, neck, chest, waist, pelvis, iliac, pubis)

    for side in (-1.0, 1.0):
        shoulder = add((side * 0.185, 0.02, -0.45), (0.068, 0.062))
        upper_arm = add((side * 0.265, -0.01, -0.335), (0.048, 0.046))
        elbow = add((side * 0.295, -0.035, -0.24), (0.043, 0.041))
        forearm = add((side * 0.31, -0.045, -0.14), (0.04, 0.036))
        wrist = add((side * 0.315, -0.055, -0.045), (0.03, 0.024))
        palm = add((side * 0.318, -0.06, 0.045), (0.044, 0.019))
        fingers = add((side * 0.312, -0.062, 0.125), (0.035, 0.013))
        thumb = add((side * 0.272, -0.045, 0.075), (0.015, 0.012))
        edges.append((chest, shoulder))
        chain(shoulder, upper_arm, elbow, forearm, wrist, palm)
        edges.append((palm, fingers))
        edges.append((palm, thumb))

        hip = add((side * 0.122, 0.0, 0.14), (0.10, 0.092))
        thigh = add((side * 0.125, -0.005, 0.31), (0.078, 0.072))
        knee = add((side * 0.124, -0.015, 0.475), (0.06, 0.056))
        calf = add((side * 0.128, -0.02, 0.60), (0.056, 0.05))
        shin = add((side * 0.128, -0.038, 0.72), (0.042, 0.038))
        ankle = add((side * 0.127, -0.05, 0.815), (0.032, 0.03))
        heel = add((side * 0.127, -0.062, 0.865), (0.034, 0.03))
        instep = add((side * 0.124, 0.0, 0.9), (0.044, 0.028))
        toes = add((side * 0.118, 0.038, 0.94), (0.038, 0.018))
        edges.append((iliac, hip))
        chain(hip, thigh, knee, calf, shin, ankle, heel)
        chain(ankle, instep, toes)

    return verts, edges, radii, pelvis


def build_patient_body(skin_material) -> bpy.types.Object:
    verts, edges, radii, root = patient_skeleton()
    mesh = bpy.data.meshes.new("patient_body_skeleton")
    mesh.from_pydata(verts, edges, [])
    mesh.update()
    body = bpy.data.objects.new("patient_body", mesh)
    bpy.context.collection.objects.link(body)
    bpy.context.view_layer.objects.active = body
    body.select_set(True)

    skin = body.modifiers.new("Skin", type="SKIN")
    skin.use_smooth_shade = True
    for index, (rx, ry) in enumerate(radii):
        vertex = body.data.skin_vertices[0].data[index]
        vertex.radius = (rx, ry)
        vertex.use_root = index == root
        vertex.use_loose = False

    subsurf = body.modifiers.new("Subsurf", type="SUBSURF")
    subsurf.levels = 2
    subsurf.render_levels = 2

    smooth = body.modifiers.new("CorrectiveSmooth", type="CORRECTIVE_SMOOTH")
    smooth.factor = 0.5
    smooth.iterations = 8
    smooth.smooth_type = "LENGTH_WEIGHTED"

    for modifier in list(body.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)

    target = 24000
    if len(body.data.polygons) > target:
        decimate = body.modifiers.new("Decimate", type="DECIMATE")
        decimate.ratio = target / len(body.data.polygons)
        decimate.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=decimate.name)

    body.data.materials.append(skin_material)
    for polygon in body.data.polygons:
        polygon.use_smooth = True
        polygon.material_index = 0
    return body


def surface_height(body: bpy.types.Object, x: float, z: float) -> float:
    """Skin-surface y at (x, z) via a straight-down object-level raycast.
    Object-level so only the body is tested — scene.ray_cast returns whatever
    scene object lies above it (the drape fit shipped flat because of this)."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    hit, location, _normal, _index = body.ray_cast(
        Vector((x, 1.0, z)), Vector((0.0, -1.0, 0.0)), depsgraph=depsgraph
    )
    return location.y if hit else float("nan")


def build_patient_drape(body: bpy.types.Object, material) -> bpy.types.Object:
    """Fitted chest-to-knees sterile drape with two crisp access windows:
    a circle over the left vein site, a capsule over the right vein + artery
    (+ DPC entry) cluster."""
    bpy.ops.mesh.primitive_grid_add(
        x_subdivisions=60,
        y_subdivisions=92,
        size=1.0,
        location=(0.0, 0.4, 0.15),
        rotation=(math.radians(-90.0), 0.0, 0.0),
    )
    sheet = bpy.context.object
    sheet.name = "sterile_drape_sheet"
    sheet.scale = (0.60, 0.94, 1.0)
    # Location applied too: the raycast fit reads vertex.co as WORLD
    # coordinates, and join would otherwise re-add the object offset.
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # Material FIRST (see module docstring: boolean cutters without materials
    # insert a None slot at index 0 and orphan a later-appended material).
    sheet.data.materials.append(material)
    for polygon in sheet.data.polygons:
        polygon.material_index = 0

    depsgraph = bpy.context.evaluated_depsgraph_get()
    mattress_y = -0.082
    for vertex in sheet.data.vertices:
        x, _y, z = vertex.co
        hit, location, normal, _i = body.ray_cast(
            Vector((x, 1.0, z)), Vector((0.0, -1.0, 0.0)), depsgraph=depsgraph
        )
        if hit:
            # Slope-compensated clearance: a purely vertical offset thins to
            # nothing on near-vertical flanks and the skin pokes through.
            clearance = 0.018 / max(0.35, normal.y)
            vertex.co.y = max(location.y + clearance, mattress_y)
        else:
            vertex.co.y = mattress_y
    # y-only neighbor smoothing so the sheet tents rather than cliffs.
    neighbor_map: dict[int, list[int]] = {}
    for edge in sheet.data.edges:
        a, b = edge.vertices
        neighbor_map.setdefault(a, []).append(b)
        neighbor_map.setdefault(b, []).append(a)
    for _ in range(4):
        smoothed = {
            index: sum(sheet.data.vertices[n].co.y for n in neighbors) / len(neighbors)
            for index, neighbors in neighbor_map.items()
        }
        for index, value in smoothed.items():
            vertex = sheet.data.vertices[index]
            vertex.co.y = vertex.co.y * 0.45 + value * 0.55
    # Smoothing can pull the cloth back under a ridge: enforce a floor of
    # 0.015 above the skin (> the 0.005 solidify + 0.009 displace that follow).
    for vertex in sheet.data.vertices:
        x, _y, z = vertex.co
        hit, location, _n, _i = body.ray_cast(
            Vector((x, 1.0, z)), Vector((0.0, -1.0, 0.0)), depsgraph=depsgraph
        )
        if hit and vertex.co.y < location.y + 0.015:
            vertex.co.y = location.y + 0.015
    sheet.data.update()

    solidify = sheet.modifiers.new("Drape thickness", type="SOLIDIFY")
    solidify.thickness = 0.005
    solidify.offset = 1.0  # thicken upward, away from the skin
    bpy.context.view_layer.objects.active = sheet
    bpy.ops.object.modifier_apply(modifier=solidify.name)

    def cut(name, location, scale):
        # Cutter axis notes: with object rotation Rx(90), local x -> world x,
        # local y -> world z, local z -> world -y (the cylinder axis). The
        # window radii therefore go in the first two scale slots.
        bpy.ops.mesh.primitive_cylinder_add(
            radius=1.0, depth=0.7, location=location,
            rotation=(math.radians(90.0), 0.0, 0.0),
        )
        cutter = bpy.context.object
        cutter.name = name
        cutter.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        boolean = sheet.modifiers.new(f"Cut {name}", type="BOOLEAN")
        boolean.operation = "DIFFERENCE"
        boolean.object = cutter
        bpy.context.view_layer.objects.active = sheet
        bpy.ops.object.modifier_apply(modifier=boolean.name)
        bpy.data.objects.remove(cutter, do_unlink=True)

    # Windows cut after solidify: an EXACT boolean against an open sheet can
    # silently no-op; a closed manifold cuts dependably.
    cut("window_left_vein", (-0.135, 0.2, 0.09), (0.082, 0.082, 1.0))
    cut("window_right_cluster", (0.158, 0.2, 0.083), (0.088, 0.115, 1.0))

    folds = bpy.data.textures.new("drape_folds", type="CLOUDS")
    folds.noise_scale = 0.3
    displace = sheet.modifiers.new("Drape folds", type="DISPLACE")
    displace.texture = folds
    displace.strength = 0.009
    displace.mid_level = 0.5
    bpy.ops.object.modifier_apply(modifier=displace.name)

    if len(sheet.data.polygons) > 6400:
        decimate = sheet.modifiers.new("Drape reduction", type="DECIMATE")
        decimate.ratio = 6400 / len(sheet.data.polygons)
        decimate.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=decimate.name)

    for polygon in sheet.data.polygons:
        polygon.use_smooth = True
    return sheet


def build_patient_cap(material) -> bpy.types.Object:
    """Surgical-cap shell over the crown: hides scalp detail without reading
    as hair or identity."""
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=28, ring_count=14, location=(0.0, 0.028, -0.762)
    )
    cap = bpy.context.object
    cap.name = "surgical_cap"
    cap.scale = (0.094, 0.09, 0.108)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    cap.data.materials.append(material)
    for polygon in cap.data.polygons:
        polygon.material_index = 0
    bpy.ops.mesh.primitive_cube_add(location=(0.0, 0.0, -0.585), size=1.0)
    cutter = bpy.context.object
    cutter.scale = (0.4, 0.4, 0.2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    boolean = cap.modifiers.new("Trim", type="BOOLEAN")
    boolean.operation = "DIFFERENCE"
    boolean.object = cutter
    bpy.context.view_layer.objects.active = cap
    bpy.ops.object.modifier_apply(modifier=boolean.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    for polygon in cap.data.polygons:
        polygon.use_smooth = True
    return cap


def build_patient_pillow(material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=(0.0, -0.075, -0.73))
    pillow = bpy.context.object
    pillow.name = "pillow"
    pillow.dimensions = (0.42, 0.075, 0.32)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = pillow.modifiers.new("Soft edge", type="BEVEL")
    modifier.width = 0.03
    modifier.segments = 4
    bpy.context.view_layer.objects.active = pillow
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    pillow.data.materials.append(material)
    for polygon in pillow.data.polygons:
        polygon.use_smooth = True
        polygon.material_index = 0
    return pillow


def orient_for_runtime(obj: bpy.types.Object) -> None:
    """Runtime frame (y up) -> Blender Z-up, transforming mesh data directly:
    bpy.ops.object.transform_apply silently no-ops on some objects in
    Blender 5.1 background mode."""
    obj.data.transform(Euler((math.radians(90.0), 0.0, 0.0)).to_matrix().to_4x4())
    obj.data.update()


def build_patient(output_dir: Path) -> dict:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    skin = make_material("patient_skin", srgb("#c99a80"), roughness=0.68)
    drape_material = make_material("sterile_drape", srgb("#3c7f86"), roughness=0.82)
    linen = make_material("hospital_linen", srgb("#dbe7e4"), roughness=0.88)
    cap_material = make_material("surgical_cap", srgb("#9fc3c9"), roughness=0.85)

    body = build_patient_body(skin)

    # Skin-surface measurements the layout anchors are re-measured from,
    # taken before soft goods cover the sites.
    site_heights = {
        name: round(surface_height(body, x, z), 4) for name, (x, z) in GROIN_SITES
    }
    site_heights["dpc_entry"] = round(surface_height(body, *DPC_ENTRY_XZ), 4)

    parts = [
        body,
        build_patient_pillow(linen),
        build_patient_cap(cap_material),
        build_patient_drape(body, drape_material),
    ]
    patient = join_named(parts, "patient_femoral_access")

    stats_pre_orient = {
        name: value for name, value in site_heights.items()
    }
    orient_for_runtime(patient)
    output_path = output_dir / "patient-femoral-access.glb"
    export_glb(patient, output_path)
    stats = mesh_stats(patient, output_path)
    stats["groin_skin_surface_y"] = stats_pre_orient
    return stats


# ---------------------------------------------------------------- clamp

def build_clamp(output_dir: Path) -> dict:
    """Procedural tubing clamp sized for the scene's tubing: jaw span clears
    the 0.08 m tube OD when open (the previous clamp's 0.048 m span hovered
    beside the tube it claimed to clamp). Same runtime alignment convention:
    length along X, jaw opening along Y (authored Z-up in Blender)."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    body_material = make_material("clamp_body", srgb("#c23a30"), roughness=0.42)
    accent_material = make_material("clamp_teeth", srgb("#e8eaec"), roughness=0.3, metallic=0.1)

    objects: list[bpy.types.Object] = []

    def rounded_bar(name, location, dimensions, material, bevel=0.004,
                    rotation=(0.0, 0.0, 0.0)):
        bpy.ops.mesh.primitive_cube_add(location=location)
        obj = bpy.context.object
        obj.name = name
        obj.dimensions = dimensions
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        modifier = obj.modifiers.new("bevel", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        if any(rotation):
            obj.rotation_euler = Euler(rotation)
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        obj.data.materials.append(material)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        objects.append(obj)
        return obj

    half_gap = TUBE_OUTER_DIAMETER / 2 + 0.008  # jaw clearance around the tube
    rounded_bar("jaw_lower", (0.0, 0.0, -half_gap), (0.24, 0.06, 0.018), body_material)
    rounded_bar("jaw_upper", (0.005, 0.0, half_gap), (0.235, 0.06, 0.018), body_material,
                rotation=(0.0, math.radians(-4.0), 0.0))

    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.02, depth=0.07, location=(-0.115, 0.0, 0.0),
        rotation=(math.radians(90), 0, 0),
    )
    hinge = bpy.context.object
    hinge.name = "hinge"
    hinge.data.materials.append(body_material)
    for polygon in hinge.data.polygons:
        polygon.use_smooth = True
    objects.append(hinge)

    # Ratchet rack spanning the jaw gap at the handle end, seated on the
    # lower jaw (the old rack floated as disconnected chips mid-gap).
    rounded_bar("ratchet_rack", (0.092, 0.0, 0.0), (0.008, 0.034, 2 * half_gap - 0.01),
                accent_material, bevel=0.002)
    for index in range(4):
        rounded_bar(
            f"ratchet_tooth_{index}",
            (0.085, 0.0, -half_gap + 0.02 + index * 0.02),
            (0.007, 0.03, 0.008),
            accent_material,
            bevel=0.001,
        )

    for name, z_offset in (("loop_lower", -half_gap - 0.016), ("loop_upper", half_gap + 0.016)):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.028, minor_radius=0.007,
            location=(0.128, 0.0, z_offset),
            rotation=(math.radians(90), 0, 0),
        )
        loop = bpy.context.object
        loop.name = name
        loop.data.materials.append(body_material)
        for polygon in loop.data.polygons:
            polygon.use_smooth = True
        objects.append(loop)

    clamp = join_named(objects, "circuit_clamp")
    if len(clamp.data.polygons) > 6000:
        decimate = clamp.modifiers.new("Web runtime reduction", type="DECIMATE")
        decimate.decimate_type = "COLLAPSE"
        decimate.ratio = 6000 / len(clamp.data.polygons)
        decimate.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = clamp
        bpy.ops.object.modifier_apply(modifier=decimate.name)

    output_path = output_dir / "circuit-clamp.glb"
    export_glb(clamp, output_path)
    return mesh_stats(clamp, output_path)




# ---------------------------------------------------------------- HLS module + gas blender
# (Owner-approved at the B7 follow-up visual gate, 2026-08-11: procedural HLS
# Module Advanced replacing the supplied oxygenator scan, and the sweep-gas
# air/O2 blender the sweep line now originates from.)

COLLECTED: list[bpy.types.Object] = []


def make_alpha_material(name, color, *, roughness=0.45, metallic=0.0, alpha=1.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    principled = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    if alpha < 1.0:
        principled.inputs["Alpha"].default_value = alpha
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "BLENDED"
    material.diffuse_color = (*color, alpha)
    material.metallic = metallic
    material.roughness = roughness
    return material


def register(obj):
    COLLECTED.append(obj)
    return obj


def rounded_box(name, location, size, material, *, bevel=0.01, segments=3,
                rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new("bevel", type="BEVEL")
        modifier.width = min(bevel, min(size) * 0.45)
        modifier.segments = segments
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    if any(rotation):
        obj.rotation_euler = Euler(rotation)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return register(obj)


def cylinder(name, location, radius, depth, material, *, axis="Z", vertices=24,
             rotation=None):
    axis_rotation = {
        "Z": (0.0, 0.0, 0.0),
        "X": (0.0, math.radians(90), 0.0),
        "Y": (math.radians(90), 0.0, 0.0),
    }[axis]
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=location,
        rotation=rotation if rotation is not None else axis_rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return register(obj)


def sphere(name, location, radius, material, *, segments=16, rings=10,
           scale=(1.0, 1.0, 1.0)):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, location=location, radius=radius
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return register(obj)


def tube(name, points, radius, material, *, resolution=8, bevel_resolution=5):
    curve_data = bpy.data.curves.new(name, type="CURVE")
    curve_data.dimensions = "3D"
    spline = curve_data.splines.new("NURBS")
    spline.points.add(len(points) - 1)
    for index, point in enumerate(points):
        spline.points[index].co = (*point, 1.0)
    spline.use_endpoint_u = True
    spline.order_u = 3
    spline.resolution_u = resolution
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = bevel_resolution
    curve_data.use_fill_caps = True
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return register(obj)


def join_and_export(name, out_path, *, center=True):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in COLLECTED:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = COLLECTED[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    joined.data.name = f"{name}_mesh"
    bpy.ops.object.material_slot_remove_unused()
    lo = Vector((min(v.co[i] for v in joined.data.vertices) for i in range(3)))
    hi = Vector((max(v.co[i] for v in joined.data.vertices) for i in range(3)))
    if center:
        joined.data.transform(Matrix.Translation(-(lo + hi) / 2))
        joined.data.update()
        lo, hi = lo - (lo + hi) / 2, hi - (lo + hi) / 2
    bpy.ops.object.select_all(action="DESELECT")
    joined.select_set(True)
    bpy.context.view_layer.objects.active = joined
    bpy.ops.export_scene.gltf(
        filepath=str(out_path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_attributes=False,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )
    return {
        "output": out_path.name,
        "triangles": sum(max(1, len(p.vertices) - 2) for p in joined.data.polygons),
        "vertices": len(joined.data.vertices),
        "materials": [m.name if m else None for m in joined.data.materials],
        "local_bounds": {"min": [round(v, 4) for v in lo], "max": [round(v, 4) for v in hi]},
        "bytes": out_path.stat().st_size,
    }


# ------------------------------------------------------------- HLS module

def build_oxygenator(output_dir: Path) -> dict:
    out_path = output_dir / "oxygenator.glb"
    bpy.ops.wm.read_factory_settings(use_empty=True)
    COLLECTED.clear()

    clear_poly = make_alpha_material("hls_clear_housing", srgb("#dfeef2"), roughness=0.1, alpha=0.16)
    fiber = make_alpha_material("hls_fiber_bundle", srgb("#f0f1ee"), roughness=0.78)
    red = make_alpha_material("hls_red", srgb("#a01d23"), roughness=0.38)
    label_white = make_alpha_material("hls_label_white", srgb("#f4f6f7"), roughness=0.5)
    label_blue = make_alpha_material("hls_label_blue", srgb("#2159a8"), roughness=0.5)
    stop_blue = make_alpha_material("hls_stopcock_blue", srgb("#2a6fd6"), roughness=0.4)
    brass = make_alpha_material("hls_port_brass", srgb("#b9975b"), roughness=0.35, metallic=0.8)
    dark = make_alpha_material("hls_port_dark", srgb("#2b3238"), roughness=0.5)

    tilt45 = (0.0, math.radians(45.0), 0.0)

    # Diamond housing (square standing on a corner), fiber bundle inside.
    rounded_box("housing_clear", (0, 0, 0), (0.27, 0.13, 0.27), clear_poly,
                bevel=0.02, segments=3, rotation=tilt45)
    rounded_box("fiber_bundle", (0, 0, 0), (0.20, 0.085, 0.20), fiber,
                bevel=0.02, segments=3, rotation=tilt45)
    # Red edge frame: four bars along the diamond's edges.
    half = 0.135  # half-side of the square before rotation
    for index, (sx, sz) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        # Edge midpoint after 45-degree tilt lies on the x/z axes.
        angle = math.radians(45.0 if sx * sz > 0 else -45.0)
        rounded_box(
            f"frame_edge_{index}",
            (sx * half / math.sqrt(2), 0.0, sz * half / math.sqrt(2)),
            (0.295, 0.138, 0.024),
            red,
            bevel=0.008,
            segments=2,
            rotation=(0.0, angle, 0.0),
        )

    # Label plate + blue band on the front face (-Y), no text.
    rounded_box("label_plate", (0.0, -0.069, 0.02), (0.115, 0.006, 0.15),
                label_white, bevel=0.004, segments=1)
    rounded_box("label_band", (0.0, -0.0725, -0.032), (0.115, 0.006, 0.05),
                label_blue, bevel=0.004, segments=1)

    # Red top volute with de-airing cap.
    cylinder("volute", (0.0, 0.0, 0.235), 0.052, 0.1, red, axis="Z", vertices=28)
    cylinder("volute_cap", (0.0, 0.0, 0.292), 0.03, 0.02, red, axis="Z", vertices=20)
    cylinder("deairing_port", (0.0, -0.045, 0.27), 0.011, 0.035, label_white, axis="Y",
             vertices=12)

    # Bottom blood ports + stopcocks (blue venous-side, red arterial-side).
    cylinder("port_left", (-0.1, -0.02, -0.155), 0.019, 0.09, dark, axis="Z",
             rotation=(math.radians(20), 0, math.radians(15)), vertices=16)
    cylinder("port_right", (0.1, -0.02, -0.155), 0.019, 0.09, dark, axis="Z",
             rotation=(math.radians(20), 0, math.radians(-15)), vertices=16)
    for name, x_pos, material in (("stopcock_blue", -0.125, stop_blue), ("stopcock_red", 0.125, red)):
        cylinder(f"{name}_body", (x_pos, -0.045, -0.175), 0.011, 0.05, label_white,
                 axis="X", vertices=12)
        cylinder(f"{name}_handle", (x_pos, -0.07, -0.175), 0.014, 0.028, material,
                 axis="Y", vertices=10)

    # Brass heat-exchanger ports, lower rear.
    for x_pos in (-0.05, 0.05):
        cylinder(f"hx_port_{x_pos}", (x_pos, 0.075, -0.19), 0.016, 0.05, brass,
                 axis="Y", vertices=14)

    # Stem down to the runtime pump head.
    cylinder("pump_stem", (0.0, 0.0, -0.24), 0.036, 0.12, dark, axis="Z", vertices=20)
    cylinder("pump_collar", (0.0, 0.0, -0.295), 0.05, 0.02, label_white, axis="Z",
             vertices=20)

    return join_and_export("membrane_oxygenator", out_path, center=True)


# ------------------------------------------------------------- gas blender

def build_blender(output_dir: Path) -> dict:
    out_path = output_dir / "sweep-gas-blender.glb"
    bpy.ops.wm.read_factory_settings(use_empty=True)
    COLLECTED.clear()

    steel = make_alpha_material("blender_pole", srgb("#c4c9cd"), roughness=0.3, metallic=0.85)
    box_gray = make_alpha_material("blender_box", srgb("#dfe2e3"), roughness=0.45)
    panel_dark = make_alpha_material("blender_panel", srgb("#2b3238"), roughness=0.55)
    knob_black = make_alpha_material("blender_knob", srgb("#17191b"), roughness=0.6)
    clear_acrylic = make_alpha_material("blender_flowtube", srgb("#eef4f6"), roughness=0.12, alpha=0.3)
    float_steel = make_alpha_material("blender_float", srgb("#5f6d74"), roughness=0.3, metallic=0.6)
    hose_green = make_alpha_material("blender_hose_o2", srgb("#3d8f4e"), roughness=0.6)
    hose_white = make_alpha_material("blender_hose_air", srgb("#e8e9e6"), roughness=0.6)

    # Weighted base + pole.
    cylinder("base", (0.0, 0.0, 0.014), 0.17, 0.028, steel, axis="Z", vertices=28)
    cylinder("base_hub", (0.0, 0.0, 0.05), 0.03, 0.06, steel, axis="Z", vertices=16)
    cylinder("pole", (0.0, 0.0, 0.72), 0.013, 1.36, steel, axis="Z", vertices=16)
    cylinder("pole_cap", (0.0, 0.0, 1.4), 0.016, 0.02, steel, axis="Z", vertices=12)

    # Clamp block joining mixer to pole.
    rounded_box("clamp_block", (0.045, 0.0, 1.08), (0.07, 0.05, 0.05), steel, bevel=0.008)

    # Mixer box with FiO2 dial on the front (-Y).
    rounded_box("mixer_box", (0.145, 0.0, 1.08), (0.13, 0.1, 0.15), box_gray,
                bevel=0.012, segments=3)
    rounded_box("mixer_label", (0.145, -0.048, 1.125), (0.07, 0.008, 0.028), panel_dark,
                bevel=0.004, segments=1)
    for port_x in (0.115, 0.175):
        cylinder(f"mixer_port_{port_x}", (port_x, 0.02, 1.0), 0.008, 0.025, steel,
                 axis="Z", vertices=10)
    cylinder("dial_ring", (0.145, -0.053, 1.045), 0.034, 0.01, panel_dark, axis="Y",
             vertices=24)
    cylinder("dial_knob", (0.145, -0.062, 1.045), 0.026, 0.022, box_gray, axis="Y",
             vertices=18)
    rounded_box("dial_pointer", (0.145, -0.072, 1.06), (0.006, 0.006, 0.024), panel_dark,
                bevel=0.002, segments=1)

    # Two clear flowmeter tubes with floats and black needle-valve knobs.
    for index, x_pos in enumerate((-0.005, 0.055)):
        rounded_box(f"flowtube_{index}", (x_pos, -0.025, 1.1), (0.04, 0.04, 0.28),
                    clear_acrylic, bevel=0.008, segments=2)
        cylinder(f"flowbore_{index}", (x_pos, -0.025, 1.1), 0.004, 0.24, hose_white,
                 axis="Z", vertices=10)
        sphere(f"float_{index}", (x_pos, -0.025, 1.05 + index * 0.07), 0.012, float_steel)
        cylinder(f"flowknob_{index}", (x_pos, -0.055, 0.945), 0.017, 0.03, knob_black,
                 axis="Y", vertices=14)

    # Supply hoses (air white, O2 green) dropping behind the pole to the floor.
    tube("hose_air", [(0.115, 0.02, 1.0), (0.115, 0.03, 0.96), (0.07, 0.09, 0.6),
                      (0.02, 0.12, 0.25), (-0.01, 0.13, 0.02)], 0.009, hose_white)
    tube("hose_o2", [(0.175, 0.02, 1.0), (0.175, 0.03, 0.96), (0.14, 0.1, 0.55),
                     (0.08, 0.14, 0.2), (0.05, 0.15, 0.02)], 0.009, hose_green)

    # Mixed-gas outlet: barb + green stub, low on the mixer's right side. The
    # runtime sweep line begins at this stub's tip.
    cylinder("outlet_barb", (0.215, 0.0, 1.02), 0.009, 0.03, steel, axis="X", vertices=10)
    tube("outlet_stub", [(0.23, 0.0, 1.02), (0.27, -0.02, 0.98), (0.29, -0.03, 0.93)],
         0.0085, hose_green)

    return join_and_export("sweep_gas_blender", out_path, center=False)


# ---------------------------------------------------------------- main

def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :]
    if not argv:
        raise SystemExit("usage: ... -- <output-dir> [--only console|patient|clamp]")
    output_dir = Path(argv[0]).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    only = argv[argv.index("--only") + 1] if "--only" in argv else None

    report = []
    if only in (None, "console"):
        report.append(build_console(output_dir))
    if only in (None, "patient"):
        report.append(build_patient(output_dir))
    if only in (None, "clamp"):
        report.append(build_clamp(output_dir))
    if only in (None, "oxygenator"):
        report.append(build_oxygenator(output_dir))
    if only in (None, "blender"):
        report.append(build_blender(output_dir))
    print("ECMO_FIDELITY_REPORT=" + json.dumps(report, indent=2))


main()
