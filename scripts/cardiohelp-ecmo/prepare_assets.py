"""Build and normalize ECMO GLBs for the browser runtime.

The script preserves the supplied source files and writes centered, consistently
scaled, material-complete runtime GLBs. The patient is generated as a clean,
draped supine model because the supplied lower-body mesh has open/cropped geometry
and disconnected cannula tubing. It intentionally avoids Draco so the site can
load every asset without a separate decoder dependency.

Usage:
  blender --background --python scripts/cardiohelp-ecmo/prepare_assets.py -- \
    <source-directory> <output-directory>

  # Regenerate only the procedural patient (no source assets required):
  blender --background --python scripts/cardiohelp-ecmo/prepare_assets.py -- \
    --patient-only <output-directory>

Coordinate convention: the patient generator authors its volumes in the web
runtime's frame (x right, y up, z toward the feet). `orient_for_runtime`
rotates the finished mesh into Blender's Z-up frame so the glTF exporter's
Y-up conversion lands it supine in three.js — the original export skipped
this, which left the patient standing vertically in the app.
"""

from __future__ import annotations

import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path

import bpy
from mathutils import Euler, Vector


@dataclass(frozen=True)
class AssetRecipe:
    source_name: str
    output_name: str
    node_name: str
    longest_dimension_m: float
    decimate_ratio: float
    base_color: tuple[float, float, float, float] | None = None
    metallic: float = 0.0
    roughness: float = 0.48
    texture_limit: int | None = None
    remove_emissive_texture: bool = False


RECIPES = (
    AssetRecipe(
        "cardiohelp_console.glb",
        "cardiohelp-console.glb",
        "cardiohelp_console",
        0.95,
        0.55,
        (0.065, 0.09, 0.095, 1.0),
        metallic=0.18,
        roughness=0.32,
    ),
    AssetRecipe(
        "oxygenator.glb",
        "oxygenator.glb",
        "membrane_oxygenator",
        0.42,
        0.28,
        texture_limit=1024,
        remove_emissive_texture=True,
    ),
    AssetRecipe(
        "Clamp.glb",
        "circuit-clamp.glb",
        "circuit_clamp",
        0.19,
        0.45,
        (0.78, 0.08, 0.045, 1.0),
        roughness=0.3,
    ),
    AssetRecipe(
        "HLS internal sensor connection..glb",
        "hls-sensor-connector.glb",
        "hls_sensor_connector",
        0.2,
        1.0,
        (0.2, 0.28, 0.3, 1.0),
        metallic=0.12,
        roughness=0.34,
    ),
)

PATIENT_OUTPUT_NAME = "patient-femoral-access.glb"


def mesh_bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    minimum = Vector(tuple(min(point[index] for point in corners) for index in range(3)))
    maximum = Vector(tuple(max(point[index] for point in corners) for index in range(3)))
    return minimum, maximum


def import_single_mesh(path: Path, node_name: str) -> bpy.types.Object:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"No mesh geometry found in {path}")

    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = node_name
    obj.data.name = f"{node_name}_mesh"
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return obj


def normalize_geometry(obj: bpy.types.Object, longest_dimension_m: float) -> None:
    minimum, maximum = mesh_bounds(obj)
    center = (minimum + maximum) / 2
    obj.location -= center
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

    minimum, maximum = mesh_bounds(obj)
    current_longest = max(maximum - minimum)
    if current_longest <= 0:
        raise RuntimeError(f"Cannot scale empty bounds for {obj.name}")
    scale = longest_dimension_m / current_longest
    obj.scale = (scale, scale, scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def create_material(recipe: AssetRecipe) -> bpy.types.Material:
    material = bpy.data.materials.new(f"{recipe.node_name}_material")
    material.use_nodes = True
    material.diffuse_color = recipe.base_color or (0.5, 0.5, 0.5, 1.0)
    material.metallic = recipe.metallic
    material.roughness = recipe.roughness
    principled = next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    principled.inputs["Base Color"].default_value = material.diffuse_color
    principled.inputs["Metallic"].default_value = recipe.metallic
    principled.inputs["Roughness"].default_value = recipe.roughness
    return material


def create_pbr_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    roughness: float,
    metallic: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    material.metallic = metallic
    material.roughness = roughness
    principled = next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    return material


def add_ellipsoid(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    segments: int = 24,
    rings: int = 12,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def add_rounded_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    bevel: float,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new(name="Soft clinical edge", type="BEVEL")
    modifier.width = bevel
    modifier.segments = 4
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def create_patient_body(material: bpy.types.Material) -> bpy.types.Object:
    """Create one continuous mannequin body from blended metaball volumes."""

    metaball = bpy.data.metaballs.new("patient_body_skin_volume")
    metaball.resolution = 0.026
    metaball.render_resolution = 0.024
    metaball.threshold = 0.62
    body = bpy.data.objects.new("patient_body_skin", metaball)
    bpy.context.collection.objects.link(body)

    def add_volume(
        location: tuple[float, float, float],
        scale: tuple[float, float, float],
        rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    ) -> None:
        element = metaball.elements.new()
        element.type = "ELLIPSOID"
        element.co = location
        element.radius = 1.0
        element.size_x, element.size_y, element.size_z = scale
        element.rotation = Euler(rotation).to_quaternion()
        element.stiffness = 2.0

    add_volume((0.0, 0.12, -0.72), (0.13, 0.12, 0.16))
    add_volume((0.0, 0.08, -0.57), (0.075, 0.07, 0.11))
    add_volume((0.0, 0.07, -0.37), (0.32, 0.13, 0.32))
    add_volume((0.0, 0.075, -0.07), (0.29, 0.12, 0.21))
    for side in (-1.0, 1.0):
        # Shoulder caps blend the arm roots into the torso silhouette.
        add_volume(
            (side * 0.3, 0.075, -0.5),
            (0.1, 0.09, 0.12),
            (0.0, side * 0.05, 0.0),
        )
        add_volume(
            (side * 0.355, 0.035, -0.34),
            (0.075, 0.07, 0.35),
            (0.0, side * 0.07, 0.0),
        )
        add_volume(
            (side * 0.155, 0.055, 0.22),
            (0.14, 0.11, 0.32),
            (0.0, -side * 0.035, 0.0),
        )
        # Knee and ankle volumes keep the leg silhouette from reading as tubes.
        add_volume(
            (side * 0.165, 0.05, 0.46),
            (0.1, 0.09, 0.12),
        )
        add_volume(
            (side * 0.17, 0.035, 0.6),
            (0.11, 0.095, 0.27),
            (0.0, side * 0.025, 0.0),
        )
        add_volume(
            (side * 0.172, 0.03, 0.82),
            (0.09, 0.07, 0.12),
        )
        add_volume(
            (side * 0.17, 0.035, 0.92),
            (0.1, 0.07, 0.14),
            (0.0, side * 0.035, 0.0),
        )

    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    bpy.ops.object.convert(target="MESH")
    body = bpy.context.object
    body.data.materials.append(material)
    for polygon in body.data.polygons:
        polygon.use_smooth = True
    if len(body.data.polygons) > 14000:
        modifier = body.modifiers.new(name="Patient web reduction", type="DECIMATE")
        modifier.ratio = 14000 / len(body.data.polygons)
        modifier.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return body


GROIN_SITES = (
    ("left_vein", (-0.135, 0.09)),
    ("right_vein", (0.135, 0.09)),
    ("right_artery", (0.175, 0.055)),
)


def create_shrinkwrapped_drape(
    body: bpy.types.Object, material: bpy.types.Material
) -> bpy.types.Object:
    """Drape a subdivided sheet over the body with real fold suggestion.

    Deterministic (no cloth sim): shrinkwrap onto the body, boolean-cut the
    groin windows, solidify, and displace with a fixed-seed clouds texture.
    """

    plane_height = 0.34
    bpy.ops.mesh.primitive_grid_add(
        x_subdivisions=44,
        y_subdivisions=68,
        size=1.0,
        location=(0.0, plane_height, 0.16),
        rotation=(math.radians(-90.0), 0.0, 0.0),
    )
    sheet = bpy.context.object
    sheet.name = "sterile_drape_sheet"
    sheet.scale = (0.46, 0.78, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    # NEAREST_SURFACEPOINT gives a fitted cover over the torso and legs;
    # projection-based draping leaves jagged walls between the limbs.
    shrinkwrap = sheet.modifiers.new(name="Drape shrinkwrap", type="SHRINKWRAP")
    shrinkwrap.target = body
    shrinkwrap.wrap_method = "NEAREST_SURFACEPOINT"
    shrinkwrap.offset = 0.016
    bpy.context.view_layer.objects.active = sheet
    bpy.ops.object.modifier_apply(modifier=shrinkwrap.name)

    # Groin windows: cut cleanly through the flat-wrapped sheet before adding
    # thickness, so the openings have crisp edges.
    for name, (site_x, site_z) in GROIN_SITES:
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.088,
            depth=0.6,
            location=(site_x, 0.2, site_z),
            rotation=(math.radians(90.0), 0.0, 0.0),
        )
        cutter = bpy.context.object
        cutter.name = f"window_cutter_{name}"
        boolean = sheet.modifiers.new(name=f"Cut {name}", type="BOOLEAN")
        boolean.operation = "DIFFERENCE"
        boolean.object = cutter
        bpy.context.view_layer.objects.active = sheet
        bpy.ops.object.modifier_apply(modifier=boolean.name)
        bpy.data.objects.remove(cutter, do_unlink=True)

    solidify = sheet.modifiers.new(name="Drape thickness", type="SOLIDIFY")
    solidify.thickness = 0.006
    bpy.context.view_layer.objects.active = sheet
    bpy.ops.object.modifier_apply(modifier=solidify.name)

    folds = bpy.data.textures.new("drape_folds", type="CLOUDS")
    folds.noise_scale = 0.35
    displace = sheet.modifiers.new(name="Drape folds", type="DISPLACE")
    displace.texture = folds
    displace.strength = 0.012
    displace.mid_level = 0.5
    bpy.ops.object.modifier_apply(modifier=displace.name)

    if len(sheet.data.polygons) > 4000:
        decimate = sheet.modifiers.new(name="Drape web reduction", type="DECIMATE")
        decimate.ratio = 4000 / len(sheet.data.polygons)
        decimate.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = sheet
        bpy.ops.object.modifier_apply(modifier=decimate.name)

    sheet.data.materials.append(material)
    for polygon in sheet.data.polygons:
        polygon.use_smooth = True
    return sheet


def orient_for_runtime(obj: bpy.types.Object) -> None:
    """Rotate an object authored in the runtime frame (y up, z toward feet)
    into Blender's Z-up frame so the exporter's Y-up conversion is correct.

    Transforms mesh data directly: bpy.ops.object.transform_apply silently
    no-ops on some objects in Blender 5.1 background mode."""

    obj.data.transform(Euler((math.radians(90.0), 0.0, 0.0)).to_matrix().to_4x4())
    obj.data.update()


def join_meshes(objects: list[bpy.types.Object], name: str) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    result = bpy.context.view_layer.objects.active
    result.name = name
    result.data.name = f"{name}_mesh"
    bpy.ops.object.material_slot_remove_unused()
    return result


def generate_patient_asset(output_directory: Path) -> dict[str, object]:
    """Generate a privacy-preserving full patient with exposed bilateral groin sites.

    Runtime cannulae and dressings are authored in React Three Fiber so their hub
    endpoints share exact coordinates with the circuit curves.
    """

    bpy.ops.wm.read_factory_settings(use_empty=True)
    skin = create_pbr_material(
        "patient_skin",
        (0.48, 0.285, 0.19, 1.0),
        roughness=0.67,
    )
    drape = create_pbr_material(
        "sterile_drape",
        (0.025, 0.24, 0.26, 1.0),
        roughness=0.82,
    )
    linen = create_pbr_material(
        "hospital_linen",
        (0.72, 0.82, 0.8, 1.0),
        roughness=0.88,
    )
    hair = create_pbr_material(
        "patient_hair",
        (0.055, 0.037, 0.028, 1.0),
        roughness=0.9,
    )

    gauze = create_pbr_material(
        "site_gauze",
        (0.9, 0.93, 0.9, 1.0),
        roughness=0.8,
    )

    body = create_patient_body(skin)
    objects: list[bpy.types.Object] = [body]
    objects.append(
        add_rounded_box("pillow", (0.0, -0.07, -0.72), (0.43, 0.09, 0.34), linen, bevel=0.06)
    )
    objects.append(add_ellipsoid("hair", (0.0, 0.145, -0.755), (0.134, 0.105, 0.135), hair))
    # One shrinkwrapped drape with boolean-cut groin windows replaces the old
    # trio of floating ellipsoids; the windows expose the access region for the
    # bilateral venous sites plus the right femoral artery.
    objects.append(create_shrinkwrapped_drape(body, drape))

    for name, (site_x, site_z) in GROIN_SITES:
        objects.append(
            add_ellipsoid(
                f"groin_window_{name}",
                (site_x, 0.222, site_z),
                (0.068, 0.01, 0.076),
                skin,
                segments=20,
                rings=10,
            )
        )
        objects.append(
            add_rounded_box(
                f"site_gauze_a_{name}",
                (site_x - 0.06, 0.235, site_z),
                (0.055, 0.012, 0.04),
                gauze,
                bevel=0.005,
            )
        )
        objects.append(
            add_rounded_box(
                f"site_gauze_b_{name}",
                (site_x + 0.06, 0.235, site_z),
                (0.055, 0.012, 0.04),
                gauze,
                bevel=0.005,
            )
        )

    patient = join_meshes(objects, "patient_femoral_access")
    orient_for_runtime(patient)
    output_path = output_directory / PATIENT_OUTPUT_NAME
    export_asset(patient, output_path)
    minimum, maximum = mesh_bounds(patient)
    triangle_count = sum(max(1, len(polygon.vertices) - 2) for polygon in patient.data.polygons)
    return {
        "source": "procedurally generated draped supine patient",
        "replaces_source": "Fem_Fem_legs.glb",
        "output": PATIENT_OUTPUT_NAME,
        "runtime_triangles": triangle_count,
        "dimensions_m": [round(value, 4) for value in maximum - minimum],
        "bytes": output_path.stat().st_size,
    }


def ensure_material(obj: bpy.types.Object, recipe: AssetRecipe) -> None:
    if recipe.base_color is None and obj.data.materials:
        return
    obj.data.materials.clear()
    obj.data.materials.append(create_material(recipe))
    for polygon in obj.data.polygons:
        polygon.material_index = 0


def simplify_geometry(obj: bpy.types.Object, ratio: float) -> None:
    if ratio >= 1:
        return
    modifier = obj.modifiers.new(name="Web runtime reduction", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = ratio
    modifier.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def optimize_textures(recipe: AssetRecipe) -> None:
    if recipe.remove_emissive_texture:
        for material in bpy.data.materials:
            if not material.use_nodes:
                continue
            principled = next(
                (node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"),
                None,
            )
            if principled is None:
                continue
            emission = principled.inputs.get("Emission Color") or principled.inputs.get("Emission")
            if emission is not None:
                for link in list(emission.links):
                    material.node_tree.links.remove(link)
                emission.default_value = (0.0, 0.0, 0.0, 1.0)
            strength = principled.inputs.get("Emission Strength")
            if strength is not None:
                strength.default_value = 0.0

    if recipe.texture_limit is None:
        return
    for image in bpy.data.images:
        if image.type != "IMAGE" or image.size[0] == 0 or image.size[1] == 0:
            continue
        longest = max(image.size)
        if longest <= recipe.texture_limit:
            continue
        ratio = recipe.texture_limit / longest
        image.scale(max(1, round(image.size[0] * ratio)), max(1, round(image.size[1] * ratio)))


def export_asset(obj: bpy.types.Object, output_path: Path) -> None:
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


def prepare(recipe: AssetRecipe, source_directory: Path, output_directory: Path) -> dict[str, object]:
    source_path = source_directory / recipe.source_name
    if not source_path.exists():
        raise FileNotFoundError(source_path)
    obj = import_single_mesh(source_path, recipe.node_name)
    source_triangles = len(obj.data.polygons)
    ensure_material(obj, recipe)
    optimize_textures(recipe)
    simplify_geometry(obj, recipe.decimate_ratio)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    normalize_geometry(obj, recipe.longest_dimension_m)

    output_path = output_directory / recipe.output_name
    export_asset(obj, output_path)
    minimum, maximum = mesh_bounds(obj)
    return {
        "source": recipe.source_name,
        "output": recipe.output_name,
        "source_triangles": source_triangles,
        "runtime_triangles": len(obj.data.polygons),
        "dimensions_m": [round(value, 4) for value in maximum - minimum],
        "bytes": output_path.stat().st_size,
    }


def main() -> None:
    arguments = sys.argv[sys.argv.index("--") + 1 :]
    if len(arguments) == 2 and arguments[0] == "--patient-only":
        output_directory = Path(arguments[1]).expanduser().resolve()
        output_directory.mkdir(parents=True, exist_ok=True)
        report = [generate_patient_asset(output_directory)]
        print("ECMO_PREPARE_REPORT=" + json.dumps(report, indent=2))
        return
    if len(arguments) != 2:
        raise SystemExit(
            "Expected <source-directory> <output-directory> or --patient-only <output-directory>"
        )
    source_directory = Path(arguments[0]).expanduser().resolve()
    output_directory = Path(arguments[1]).expanduser().resolve()
    output_directory.mkdir(parents=True, exist_ok=True)
    report = [generate_patient_asset(output_directory)]
    report.extend(prepare(recipe, source_directory, output_directory) for recipe in RECIPES)
    print("ECMO_PREPARE_REPORT=" + json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
