"""Build and normalize ECMO GLBs for the browser runtime.

The script preserves the supplied source files and writes centered, consistently
scaled, material-complete runtime GLBs. The patient is generated as a clean,
draped supine model because the supplied lower-body mesh has open/cropped geometry
and disconnected cannula tubing. It intentionally avoids Draco so the site can
load every asset without a separate decoder dependency.

Usage:
  blender --background --python scripts/cardiohelp-ecmo/prepare_assets.py -- \
    <source-directory> <output-directory>
"""

from __future__ import annotations

import json
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
    """Create one continuous low-poly mannequin body from blended ellipsoids."""

    metaball = bpy.data.metaballs.new("patient_body_skin_volume")
    metaball.resolution = 0.035
    metaball.render_resolution = 0.03
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
        add_volume(
            (side * 0.17, 0.035, 0.6),
            (0.11, 0.095, 0.27),
            (0.0, side * 0.025, 0.0),
        )
        add_volume(
            (side * 0.17, 0.035, 0.88),
            (0.11, 0.08, 0.17),
            (0.0, side * 0.035, 0.0),
        )

    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    bpy.ops.object.convert(target="MESH")
    body = bpy.context.object
    body.data.materials.append(material)
    for polygon in body.data.polygons:
        polygon.use_smooth = True
    if len(body.data.polygons) > 18000:
        modifier = body.modifiers.new(name="Patient web reduction", type="DECIMATE")
        modifier.ratio = 18000 / len(body.data.polygons)
        modifier.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return body


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

    objects: list[bpy.types.Object] = [create_patient_body(skin)]
    objects.append(add_rounded_box("pillow", (0.0, -0.07, -0.72), (0.43, 0.09, 0.34), linen, bevel=0.06))
    objects.append(add_ellipsoid("hair", (0.0, 0.145, -0.755), (0.134, 0.105, 0.135), hair))

    # The upper-body drape gives the model a complete silhouette while leaving
    # the inguinal access region visible for the two educational cannula sites.
    objects.append(
        add_ellipsoid(
            "upper_body_drape",
            (0.0, 0.19, -0.31),
            (0.38, 0.07, 0.32),
            drape,
        )
    )
    objects.append(
        add_ellipsoid(
            "pelvic_drape",
            (0.0, 0.205, 0.005),
            (0.34, 0.065, 0.145),
            drape,
        )
    )
    objects.append(
        add_ellipsoid(
            "lower_body_drape",
            (0.0, 0.16, 0.49),
            (0.325, 0.075, 0.47),
            drape,
        )
    )
    for side in (-1.0, 1.0):
        objects.append(
            add_ellipsoid(
                f"groin_window_{'left' if side < 0 else 'right'}",
                (side * 0.135, 0.255, 0.09),
                (0.075, 0.012, 0.085),
                skin,
                segments=20,
                rings=10,
            )
        )

    patient = join_meshes(objects, "patient_femoral_access")
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
    if len(arguments) != 2:
        raise SystemExit("Expected <source-directory> <output-directory>")
    source_directory = Path(arguments[0]).expanduser().resolve()
    output_directory = Path(arguments[1]).expanduser().resolve()
    output_directory.mkdir(parents=True, exist_ok=True)
    report = [generate_patient_asset(output_directory)]
    report.extend(prepare(recipe, source_directory, output_directory) for recipe in RECIPES)
    print("ECMO_PREPARE_REPORT=" + json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
