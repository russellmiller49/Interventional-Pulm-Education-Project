"""Polish the runtime ECMO GLBs in place (no source assets required).

The original preparation exported several assets without the Z-up -> Y-up axis
conversion, so in the browser the console lay on its back and the sensor needed
a hand-tuned rotation; the supplied clamp was a flat 8 mm plate. This pass:

  - cardiohelp-console.glb: reorients upright, welds vertices, tightens the
    material to a two-tone device look.
  - hls-sensor-connector.glb: reorients so the runtime can align it by tangent
    without a magic rotation.
  - circuit-clamp.glb: REPLACES the flat plate with a procedural tubing clamp
    (jaws, hinge, ratchet, finger loops) authored for the runtime's alignment
    convention (length along X, jaw opening along Y).
  - oxygenator.glb: strips the orphaned, unreferenced normal-map image and
    welds vertices; embedded base-color/roughness textures are preserved.

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/cardiohelp-ecmo/polish_runtime_assets.py -- \
    public/models/cardiohelp-ecmo public/models/cardiohelp-ecmo
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Vector


def parse_args() -> tuple[Path, Path]:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(argv) != 2:
        raise SystemExit("usage: ... -- <input-dir> <output-dir>")
    input_dir = Path(argv[0]).expanduser().resolve()
    output_dir = Path(argv[1]).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    return input_dir, output_dir


def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_meshes(path: Path) -> list[bpy.types.Object]:
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def join_all(meshes: list[bpy.types.Object], name: str) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    obj.data.name = f"{name}_mesh"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def weld(obj: bpy.types.Object, distance: float = 0.0002) -> None:
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=distance)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")


def decimate(obj: bpy.types.Object, target_polygons: int) -> None:
    if len(obj.data.polygons) <= target_polygons:
        return
    modifier = obj.modifiers.new(name="Web runtime reduction", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = target_polygons / len(obj.data.polygons)
    modifier.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def mesh_rotate(obj: bpy.types.Object, euler: Euler) -> None:
    """Rotate mesh data directly — bpy.ops.object.transform_apply silently
    no-ops on glTF-imported objects in Blender 5.1 background mode."""
    obj.data.transform(euler.to_matrix().to_4x4())
    obj.data.update()


def vertex_extents(obj: bpy.types.Object) -> list[float]:
    mins = [min(v.co[i] for v in obj.data.vertices) for i in range(3)]
    maxs = [max(v.co[i] for v in obj.data.vertices) for i in range(3)]
    return [maxs[i] - mins[i] for i in range(3)]


def stand_longest_axis(obj: bpy.types.Object) -> None:
    """Idempotently rotate so the longest dimension lies along Blender Z,
    which the glTF exporter's Y-up conversion turns into three.js Y (up)."""
    extents = vertex_extents(obj)
    longest = extents.index(max(extents))
    if longest == 1:
        mesh_rotate(obj, Euler((math.radians(90.0), 0.0, 0.0)))
    elif longest == 0:
        mesh_rotate(obj, Euler((0.0, math.radians(90.0), 0.0)))


def make_material(name: str, color, *, roughness=0.4, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    principled = next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    material.diffuse_color = (*color, 1.0)
    material.metallic = metallic
    material.roughness = roughness
    return material


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


def report_entry(name: str, obj: bpy.types.Object, output_path: Path) -> dict[str, object]:
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    minimum = Vector(tuple(min(point[i] for point in corners) for i in range(3)))
    maximum = Vector(tuple(max(point[i] for point in corners) for i in range(3)))
    return {
        "output": name,
        "runtime_triangles": sum(max(1, len(p.vertices) - 2) for p in obj.data.polygons),
        "dimensions_blender": [round(v, 4) for v in (maximum - minimum)],
        "bytes": output_path.stat().st_size,
    }


def polish_console(input_dir: Path, output_dir: Path) -> dict[str, object]:
    reset()
    obj = join_all(import_meshes(input_dir / "cardiohelp-console.glb"), "cardiohelp_console")
    weld(obj)
    decimate(obj, 16000)
    # The original export skipped axis conversion, leaving the console's
    # 0.95 m height horizontal in the browser. Stand it up (idempotent).
    stand_longest_axis(obj)
    obj.data.materials.clear()
    obj.data.materials.append(
        make_material("console_shell", (0.115, 0.175, 0.19), roughness=0.35, metallic=0.12)
    )
    for polygon in obj.data.polygons:
        polygon.material_index = 0
        polygon.use_smooth = True
    output_path = output_dir / "cardiohelp-console.glb"
    export_glb(obj, output_path)
    return report_entry("cardiohelp-console.glb", obj, output_path)


def polish_sensor(input_dir: Path, output_dir: Path) -> dict[str, object]:
    reset()
    obj = join_all(import_meshes(input_dir / "hls-sensor-connector.glb"), "hls_sensor_connector")
    weld(obj)
    # Runtime aligns the sensor's local Y axis to the return-line tangent, so
    # its 0.2 m length must sit along glTF Y — i.e. along Blender Z pre-export.
    stand_longest_axis(obj)
    obj.data.materials.clear()
    obj.data.materials.append(
        make_material("sensor_shell", (0.2, 0.28, 0.3), roughness=0.34, metallic=0.12)
    )
    for polygon in obj.data.polygons:
        polygon.material_index = 0
        polygon.use_smooth = True
    output_path = output_dir / "hls-sensor-connector.glb"
    export_glb(obj, output_path)
    return report_entry("hls-sensor-connector.glb", obj, output_path)


def polish_oxygenator(input_dir: Path, output_dir: Path) -> dict[str, object]:
    reset()
    obj = join_all(import_meshes(input_dir / "oxygenator.glb"), "membrane_oxygenator")
    weld(obj)
    # Remove the orphaned normal image: the material references only base color
    # and metallic-roughness, so the normal map is dead payload (~58 KB).
    for image in list(bpy.data.images):
        if image.name.lower().startswith("normal") and not image.users:
            bpy.data.images.remove(image)
    for material in bpy.data.materials:
        if not material.use_nodes:
            continue
        for node in list(material.node_tree.nodes):
            if node.type == "TEX_IMAGE" and node.image and node.image.name.lower().startswith(
                "normal"
            ):
                if not any(output.links for output in node.outputs):
                    material.node_tree.nodes.remove(node)
    output_path = output_dir / "oxygenator.glb"
    export_glb(obj, output_path)
    return report_entry("oxygenator.glb", obj, output_path)


def build_clamp(output_dir: Path) -> dict[str, object]:
    """Procedural tubing clamp replacing the flat supplied plate.

    Authored in Blender Z-up so the exported glb reads, in three.js: length
    along X, jaw opening along Y — matching the runtime's tangent alignment.
    """

    reset()
    body_material = make_material("clamp_body", (0.72, 0.13, 0.1), roughness=0.42)
    accent_material = make_material("clamp_teeth", (0.9, 0.92, 0.93), roughness=0.3, metallic=0.1)

    objects: list[bpy.types.Object] = []

    def rounded_bar(name, location, dimensions, material, bevel=0.004):
        bpy.ops.mesh.primitive_cube_add(location=location)
        obj = bpy.context.object
        obj.name = name
        obj.dimensions = dimensions
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        modifier = obj.modifiers.new(name="bevel", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.data.materials.append(material)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        objects.append(obj)
        return obj

    # Blender frame: X = clamp length, Y = across the tube, Z = jaw opening.
    lower = rounded_bar("jaw_lower", (0.0, 0.0, -0.024), (0.17, 0.05, 0.016), body_material)
    upper = rounded_bar("jaw_upper", (0.004, 0.0, 0.024), (0.165, 0.05, 0.016), body_material)
    upper.rotation_euler = Euler((0.0, math.radians(-5.0), 0.0))
    bpy.context.view_layer.objects.active = upper
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

    # Hinge barrel at the working end.
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.016, depth=0.06, location=(-0.082, 0.0, 0.0), rotation=(math.radians(90), 0, 0)
    )
    hinge = bpy.context.object
    hinge.name = "hinge"
    hinge.data.materials.append(body_material)
    for polygon in hinge.data.polygons:
        polygon.use_smooth = True
    objects.append(hinge)

    # Ratchet rack between the handle ends.
    for index in range(4):
        rounded_bar(
            f"ratchet_{index}",
            (0.062 + index * 0.007, 0.0, -0.002 + index * 0.006),
            (0.005, 0.03, 0.012),
            accent_material,
            bevel=0.001,
        )

    # Finger loops.
    for name, z_offset in (("loop_lower", -0.036), ("loop_upper", 0.038)):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.024,
            minor_radius=0.006,
            location=(0.096, 0.0, z_offset),
            rotation=(math.radians(90), 0, 0),
        )
        loop = bpy.context.object
        loop.name = name
        loop.data.materials.append(body_material)
        for polygon in loop.data.polygons:
            polygon.use_smooth = True
        objects.append(loop)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    clamp = bpy.context.view_layer.objects.active
    clamp.name = "circuit_clamp"
    clamp.data.name = "circuit_clamp_mesh"
    decimate(clamp, 6000)

    output_path = output_dir / "circuit-clamp.glb"
    export_glb(clamp, output_path)
    return report_entry("circuit-clamp.glb", clamp, output_path)


def main() -> None:
    input_dir, output_dir = parse_args()
    report = [
        polish_console(input_dir, output_dir),
        polish_sensor(input_dir, output_dir),
        polish_oxygenator(input_dir, output_dir),
        build_clamp(output_dir),
    ]
    print("ECMO_POLISH_REPORT=" + json.dumps(report, indent=2))


main()
