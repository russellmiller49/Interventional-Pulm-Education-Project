#!/usr/bin/env python3
"""Build compact, clinically anchored cardiac-device teaching assets.

Run with Blender, not the system Python:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python \
    scripts/cardiac-assets/build-runtime-assets.py

The source device GLBs remain local authoring inputs. This script produces neutral,
compressed learner-facing derivatives and two project-authored open-lumen vessel scenes.
"""

from __future__ import annotations

import json
import math
import shutil
import struct
import subprocess
from pathlib import Path
from typing import Iterable, Sequence

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "3D assets" / "Cardiac" / "Devices"
OUTPUT_DIR = ROOT / "public" / "models" / "cardiac-devices"
RIG_PATH = ROOT / "src" / "features" / "cardiac-anatomy" / "content" / "cardiac-rig.json"
RAW_SUFFIX = ".uncompressed.glb"


DEVICE_SOURCES = {
    "impella-cp.glb": ("Impella CP.glb", "Impella_CP", 20_000, 2_000_000),
    "impella-55.glb": ("Impella 5.5.glb", "Impella_55", 20_000, 2_000_000),
    "impella-rp.glb": ("Impella RP.glb", "Impella_RP", 20_000, 2_000_000),
    "lvad.glb": ("LVAD.glb", "LVAD", 60_000, 2_500_000),
}


def clear_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def desired_to_blender(point: Sequence[float]) -> tuple[float, float, float]:
    """Convert desired glTF/three.js Y-up coordinates to Blender Z-up coordinates."""

    return (float(point[0]), -float(point[2]), float(point[1]))


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    metallic: float = 0.0,
    roughness: float = 0.45,
    transparent: bool = False,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    principled = next(
        node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"
    )
    principled.inputs["Base Color"].default_value = color
    metallic_input = principled.inputs.get("Metallic IOR Level") or principled.inputs.get("Metallic")
    if metallic_input is not None:
        metallic_input.default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Alpha"].default_value = color[3]
    if transparent:
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "DITHERED"
        if hasattr(material, "use_transparency_overlap"):
            material.use_transparency_overlap = False
    return material


def smooth_mesh(mesh_object: bpy.types.Object) -> None:
    for polygon in mesh_object.data.polygons:
        polygon.use_smooth = True


def create_mesh_object(
    name: str,
    desired_vertices: Sequence[Sequence[float]],
    faces: Sequence[Sequence[int]],
    materials: Sequence[bpy.types.Material],
    material_indices: Sequence[int] | None = None,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata([desired_to_blender(vertex) for vertex in desired_vertices], [], faces)
    mesh.update()
    for material in materials:
        mesh.materials.append(material)
    if material_indices is not None:
        for polygon, material_index in zip(mesh.polygons, material_indices, strict=True):
            polygon.material_index = material_index
    object_ = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(object_)
    smooth_mesh(object_)
    return object_


def catmull_rom(points: Sequence[Sequence[float]], samples_per_segment: int = 9) -> list[Vector]:
    source = [Vector(point) for point in points]
    if len(source) < 2:
        raise ValueError("A vessel centerline requires at least two points")
    result: list[Vector] = []
    for index in range(len(source) - 1):
        p0 = source[max(0, index - 1)]
        p1 = source[index]
        p2 = source[index + 1]
        p3 = source[min(len(source) - 1, index + 2)]
        for sample in range(samples_per_segment):
            t = sample / samples_per_segment
            t2 = t * t
            t3 = t2 * t
            result.append(
                0.5
                * (
                    (2 * p1)
                    + (-p0 + p2) * t
                    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                    + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
                )
            )
    result.append(source[-1])
    return result


def create_open_vessel(
    name: str,
    points: Sequence[Sequence[float]],
    radius: float,
    wall: float,
    outer_material: bpy.types.Material,
    inner_material: bpy.types.Material,
    *,
    radial_segments: int = 18,
) -> bpy.types.Object:
    centers = catmull_rom(points)
    angles = [
        (3 * math.pi / 4) + (3 * math.pi / 2) * index / radial_segments
        for index in range(radial_segments + 1)
    ]
    vertices: list[tuple[float, float, float]] = []
    front = Vector((0, 0, 1))
    inner_radius = max(radius - wall, radius * 0.68)

    for center_index, center in enumerate(centers):
        if center_index == 0:
            tangent = (centers[1] - center).normalized()
        elif center_index == len(centers) - 1:
            tangent = (center - centers[center_index - 1]).normalized()
        else:
            tangent = (centers[center_index + 1] - centers[center_index - 1]).normalized()
        side = front.cross(tangent)
        if side.length < 0.001:
            side = Vector((1, 0, 0))
        else:
            side.normalize()
        ring_front = tangent.cross(side).normalized()
        if ring_front.dot(front) < 0:
            ring_front.negate()
        for ring_radius in (radius, inner_radius):
            for angle in angles:
                point = center + side * math.cos(angle) * ring_radius + ring_front * math.sin(angle) * ring_radius
                vertices.append(tuple(point))

    ring_size = len(angles)
    layer_size = ring_size * 2
    faces: list[tuple[int, int, int, int]] = []
    material_indices: list[int] = []

    def outer(center: int, angle: int) -> int:
        return center * layer_size + angle

    def inner(center: int, angle: int) -> int:
        return center * layer_size + ring_size + angle

    for center_index in range(len(centers) - 1):
        for angle_index in range(ring_size - 1):
            faces.append(
                (
                    outer(center_index, angle_index),
                    outer(center_index + 1, angle_index),
                    outer(center_index + 1, angle_index + 1),
                    outer(center_index, angle_index + 1),
                )
            )
            material_indices.append(0)
            faces.append(
                (
                    inner(center_index, angle_index + 1),
                    inner(center_index + 1, angle_index + 1),
                    inner(center_index + 1, angle_index),
                    inner(center_index, angle_index),
                )
            )
            material_indices.append(1)

        for cut_index in (0, ring_size - 1):
            faces.append(
                (
                    outer(center_index, cut_index),
                    inner(center_index, cut_index),
                    inner(center_index + 1, cut_index),
                    outer(center_index + 1, cut_index),
                )
            )
            material_indices.append(0)

    for center_index, reverse in ((0, True), (len(centers) - 1, False)):
        for angle_index in range(ring_size - 1):
            face = (
                outer(center_index, angle_index),
                outer(center_index, angle_index + 1),
                inner(center_index, angle_index + 1),
                inner(center_index, angle_index),
            )
            faces.append(tuple(reversed(face)) if reverse else face)
            material_indices.append(0)

    return create_mesh_object(
        name,
        vertices,
        faces,
        (outer_material, inner_material),
        material_indices,
    )


def create_y_cylinder(
    name: str,
    y_center: float,
    radius: float,
    height: float,
    material: bpy.types.Material,
    *,
    x: float = 0,
    z: float = 0,
    segments: int = 20,
) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    for y in (y_center - height / 2, y_center + height / 2):
        for index in range(segments):
            angle = 2 * math.pi * index / segments
            vertices.append((x + math.cos(angle) * radius, y, z + math.sin(angle) * radius))
    for index in range(segments):
        following = (index + 1) % segments
        faces.append((index, following, segments + following, segments + index))
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple(range(segments, segments * 2)))
    return create_mesh_object(name, vertices, faces, (material,))


def add_landmark(name: str, point: Sequence[float]) -> bpy.types.Object:
    landmark = bpy.data.objects.new(name, None)
    landmark.empty_display_type = "SPHERE"
    landmark.empty_display_size = 0.06
    landmark.location = desired_to_blender(point)
    landmark["cardiac_anchor"] = True
    bpy.context.collection.objects.link(landmark)
    return landmark


def build_heart_great_vessels(rig: dict) -> None:
    clear_scene()
    arterial_outer = make_material("Aortic outer wall", (0.42, 0.075, 0.065, 1), roughness=0.68)
    arterial_inner = make_material("Aortic lumen", (0.68, 0.19, 0.15, 1), roughness=0.58)
    pulmonary_outer = make_material("Pulmonary artery outer wall", (0.08, 0.16, 0.38, 1), roughness=0.7)
    pulmonary_inner = make_material("Pulmonary artery lumen", (0.15, 0.31, 0.64, 1), roughness=0.6)
    vessels = rig["heartVessels"]
    create_open_vessel(
        "Heart_Aorta_OpenLumen",
        vessels["aorta"],
        0.165,
        0.034,
        arterial_outer,
        arterial_inner,
    )
    for index, branch in enumerate(vessels["aorticBranches"], start=1):
        create_open_vessel(
            f"Heart_AorticBranch_{index}",
            branch,
            0.07,
            0.018,
            arterial_outer,
            arterial_inner,
            radial_segments=14,
        )
    for index, branch in enumerate(vessels["pulmonaryArteries"], start=1):
        radius = 0.13 if index == 1 else 0.105
        create_open_vessel(
            f"Heart_PulmonaryArtery_{index}",
            branch,
            radius,
            0.026,
            pulmonary_outer,
            pulmonary_inner,
            radial_segments=16,
        )
    add_landmark("Landmark_AorticValve", vessels["aorta"][0])
    add_landmark("Landmark_RightPAWedge", vessels["pulmonaryArteries"][1][-1])
    export_compressed("heart-great-vessels.glb")


def build_iabp_aorta(rig: dict) -> None:
    clear_scene()
    outer = make_material("Aortic wall", (0.37, 0.085, 0.065, 1), roughness=0.78)
    inner = make_material("Aortic lumen", (0.63, 0.19, 0.15, 1), roughness=0.64)
    anatomy = rig["iabpAorta"]
    create_open_vessel("IABP_Aorta_OpenLumen", anatomy["aorta"], 0.23, 0.052, outer, inner, radial_segments=22)
    for index, branch in enumerate(anatomy["archBranches"], start=1):
        create_open_vessel(
            f"IABP_ArchBranch_{index}", branch, 0.09, 0.024, outer, inner, radial_segments=14
        )
    for index, branch in enumerate(anatomy["renalBranches"], start=1):
        create_open_vessel(
            f"IABP_RenalArtery_{index}", branch, 0.075, 0.02, outer, inner, radial_segments=14
        )
    for index, branch in enumerate(anatomy["iliacBranches"], start=1):
        create_open_vessel(
            f"IABP_IliacArtery_{index}", branch, 0.145, 0.035, outer, inner, radial_segments=16
        )
    add_landmark("Landmark_LeftSubclavian", anatomy["archBranches"][2][0])
    add_landmark("Landmark_RenalArteries", anatomy["renalBranches"][0][0])
    add_landmark("Landmark_RightFemoralAccess", anatomy["iliacBranches"][1][-1])
    export_compressed("iabp-aorta-cutaway.glb")


def build_iabp_balloon() -> None:
    clear_scene()
    balloon_material = make_material(
        "IABP translucent membrane", (0.72, 0.82, 0.84, 0.52), roughness=0.22, transparent=True
    )
    catheter_material = make_material(
        "IABP catheter polymer", (0.77, 0.8, 0.79, 1), metallic=0.08, roughness=0.32
    )
    marker_material = make_material(
        "IABP radiopaque markers", (0.48, 0.53, 0.54, 1), metallic=0.72, roughness=0.2
    )

    ring_count = 33
    radial_segments = 24
    collapsed: list[tuple[float, float, float]] = []
    inflated: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for ring in range(ring_count):
        fraction = ring / (ring_count - 1)
        y = -1.16 + fraction * 2.32
        profile = math.sin(math.pi * fraction) ** 0.55
        collapsed_radius = 0.024 + 0.013 * profile
        inflated_radius = 0.024 + 0.145 * profile
        for segment in range(radial_segments):
            angle = 2 * math.pi * segment / radial_segments
            collapsed.append(
                (math.cos(angle) * collapsed_radius, y, math.sin(angle) * collapsed_radius)
            )
            inflated.append(
                (math.cos(angle) * inflated_radius, y, math.sin(angle) * inflated_radius)
            )
    for ring in range(ring_count - 1):
        for segment in range(radial_segments):
            following = (segment + 1) % radial_segments
            current = ring * radial_segments + segment
            next_ring = (ring + 1) * radial_segments + segment
            next_following = (ring + 1) * radial_segments + following
            current_following = ring * radial_segments + following
            faces.append((current, next_ring, next_following, current_following))

    balloon = create_mesh_object("IABP_Balloon", collapsed, faces, (balloon_material,))
    balloon.shape_key_add(name="Basis")
    inflated_key = balloon.shape_key_add(name="Inflated")
    for vertex, coordinate in zip(inflated_key.data, inflated, strict=True):
        vertex.co = desired_to_blender(coordinate)
    inflated_key.value = 0
    create_y_cylinder("IABP_CentralCatheter", 0, 0.018, 2.65, catheter_material)
    create_y_cylinder("IABP_CranialMarker", 1.17, 0.04, 0.055, marker_material)
    create_y_cylinder("IABP_CaudalMarker", -1.17, 0.04, 0.055, marker_material)
    add_landmark("Anchor_IABP_CranialTip", (0, 1.17, 0))
    add_landmark("Anchor_IABP_CaudalEnd", (0, -1.17, 0))
    export_compressed("iabp-balloon.glb")


def imported_meshes() -> list[bpy.types.Object]:
    return [object_ for object_ in bpy.context.scene.objects if object_.type == "MESH"]


def normalize_imported_scene(
    root_name: str, *, reference_longest: float | None = None
) -> bpy.types.Object:
    meshes = imported_meshes()
    if not meshes:
        raise RuntimeError(f"{root_name}: no meshes were imported")
    corners = [mesh.matrix_world @ Vector(corner) for mesh in meshes for corner in mesh.bound_box]
    minimum = Vector((min(point.x for point in corners), min(point.y for point in corners), min(point.z for point in corners)))
    maximum = Vector((max(point.x for point in corners), max(point.y for point in corners), max(point.z for point in corners)))
    center = (minimum + maximum) * 0.5
    longest = reference_longest or max(
        maximum.x - minimum.x, maximum.y - minimum.y, maximum.z - minimum.z
    )
    scale = 2 / longest
    root = bpy.data.objects.new(root_name, None)
    bpy.context.collection.objects.link(root)
    top_level = [object_ for object_ in bpy.context.scene.objects if object_ != root and object_.parent is None]
    for object_ in top_level:
        world = object_.matrix_world.copy()
        object_.parent = root
        object_.matrix_world = world
    root.scale = (scale, scale, scale)
    root.location = -center * scale
    return root


def simplify_impella_materials(label: str) -> None:
    for material in bpy.data.materials:
        material.name = f"{label} clinical polymer"
        if not material.use_nodes or material.node_tree is None:
            continue
        principled = next(
            (node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None
        )
        if principled is None:
            continue
        for input_name in ("Metallic IOR Level", "Roughness", "Normal", "Emission Color", "Emission Strength"):
            input_ = principled.inputs.get(input_name)
            if input_ is None:
                continue
            for link in list(input_.links):
                material.node_tree.links.remove(link)
        metallic_input = principled.inputs.get("Metallic IOR Level") or principled.inputs.get("Metallic")
        if metallic_input is not None:
            metallic_input.default_value = 0.22
        principled.inputs["Roughness"].default_value = 0.34
        emission = principled.inputs.get("Emission Color")
        if emission is not None:
            emission.default_value = (0, 0, 0, 1)
        emission_strength = principled.inputs.get("Emission Strength")
        if emission_strength is not None:
            emission_strength.default_value = 0

        base_color = principled.inputs.get("Base Color")
        retained_images: set[bpy.types.Image] = set()
        if base_color is not None:
            retained_images = {
                link.from_node.image
                for link in base_color.links
                if link.from_node.type == "TEX_IMAGE" and link.from_node.image is not None
            }
        for image in retained_images:
            if max(image.size) > 1024:
                image.scale(1024, 1024)
            image.pack()
        for node in list(material.node_tree.nodes):
            if node.type == "TEX_IMAGE" and node.image not in retained_images:
                material.node_tree.nodes.remove(node)
        material.diffuse_color = (0.58, 0.66, 0.68, 1)


def prepare_impella(source: Path, output_name: str, root_name: str) -> None:
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(source))
    simplify_impella_materials(root_name.replace("_", " "))
    for index, mesh in enumerate(imported_meshes(), start=1):
        mesh.name = root_name if index == 1 else f"{root_name}_{index}"
        smooth_mesh(mesh)
    root = normalize_imported_scene(f"{root_name}_Root")
    add_landmark(f"Anchor_{root_name}_Distal", (0, 1, 0))
    add_landmark(f"Anchor_{root_name}_Proximal", (0, -1, 0))
    for landmark in [object_ for object_ in bpy.context.scene.objects if object_.name.startswith("Anchor_")]:
        landmark.parent = root
    export_compressed(output_name)


def prepare_lvad(source: Path, output_name: str, root_name: str) -> None:
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = imported_meshes()
    for mesh in meshes:
        mesh.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    mesh = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.000001)
    bpy.ops.object.mode_set(mode="OBJECT")
    full_size = Vector(mesh.dimensions)
    reference_longest = max(full_size.x, full_size.y, full_size.z)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    components = sorted(
        [object_ for object_ in bpy.context.selected_objects if object_.type == "MESH"],
        key=lambda object_: len(object_.data.polygons),
        reverse=True,
    )
    if len(components) < 3:
        raise RuntimeError("LVAD source no longer contains the expected graft, inflow, and pump parts")
    outflow_graft = components[0]
    inflow_cannula = components[1]
    pump_housing = components[2]
    for discarded in [outflow_graft, *components[3:]]:
        bpy.data.objects.remove(discarded, do_unlink=True)

    kept = (inflow_cannula, pump_housing)
    total_triangles = sum(len(component.data.polygons) for component in kept)
    decimation_ratio = min(1.0, 56_000 / max(1, total_triangles))
    materials = (
        make_material("LVAD inflow titanium", (0.43, 0.49, 0.5, 1), metallic=0.62, roughness=0.24),
        make_material("LVAD pump housing", (0.2, 0.25, 0.27, 1), metallic=0.48, roughness=0.3),
    )
    names = ("LVAD_InflowCannula", "LVAD_PumpAndHousing")
    for component, material, name in zip(kept, materials, names, strict=True):
        if decimation_ratio < 1:
            modifier = component.modifiers.new("Web triangle budget", "DECIMATE")
            modifier.ratio = decimation_ratio
            modifier.use_collapse_triangulate = True
            bpy.context.view_layer.objects.active = component
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        component.name = name
        component.data.materials.clear()
        component.data.materials.append(material)
        smooth_mesh(component)
    root = normalize_imported_scene(
        f"{root_name}_Root", reference_longest=reference_longest
    )
    add_landmark("Anchor_LVAD_Inflow", (0, -0.82, 0))
    add_landmark("Anchor_LVAD_Outflow", (0, 0.82, 0))
    for landmark in [object_ for object_ in bpy.context.scene.objects if object_.name.startswith("Anchor_")]:
        landmark.parent = root
    export_compressed(output_name)


def gltf_pipeline_executable() -> str:
    local = ROOT / "node_modules" / ".bin" / "gltf-pipeline"
    if local.exists():
        return str(local)
    executable = shutil.which("gltf-pipeline")
    if executable:
        return executable
    raise RuntimeError("gltf-pipeline is required; run npm install before building cardiac assets")


def export_compressed(output_name: str) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    raw_path = OUTPUT_DIR / output_name.replace(".glb", RAW_SUFFIX)
    output_path = OUTPUT_DIR / output_name
    bpy.ops.export_scene.gltf(
        filepath=str(raw_path),
        export_format="GLB",
        export_yup=True,
        export_morph=True,
        export_extras=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )
    subprocess.run(
        [gltf_pipeline_executable(), "-i", str(raw_path), "-o", str(output_path), "-d"],
        cwd=ROOT,
        check=True,
    )
    raw_path.unlink(missing_ok=True)


def read_glb_json(path: Path) -> dict:
    data = path.read_bytes()
    if data[:4] != b"glTF":
        raise ValueError(f"Not a binary glTF: {path}")
    offset = 12
    while offset < len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        chunk = data[offset + 8 : offset + 8 + chunk_length]
        if chunk_type == 0x4E4F534A:
            return json.loads(chunk.rstrip(b" \x00").decode("utf-8"))
        offset += 8 + chunk_length
    raise ValueError(f"No JSON chunk in {path}")


def asset_stats(path: Path) -> dict:
    document = read_glb_json(path)
    accessors = document.get("accessors", [])
    triangles = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if primitive.get("mode", 4) == 4 and "indices" in primitive:
                triangles += accessors[primitive["indices"]]["count"] // 3
    return {
        "bytes": path.stat().st_size,
        "triangles": triangles,
        "nodes": [node.get("name") for node in document.get("nodes", []) if node.get("name")],
        "dracoCompressed": "KHR_draco_mesh_compression" in document.get("extensionsUsed", []),
    }


def write_runtime_manifest() -> None:
    limits = {
        "heart-great-vessels.glb": (50_000, 2_500_000, "Project-authored open-lumen great vessels"),
        "iabp-aorta-cutaway.glb": (50_000, 2_500_000, "Project-authored open-lumen aorta"),
        "iabp-balloon.glb": (20_000, 2_000_000, "Project-authored neutral IABP facsimile"),
        **{
            output: (triangles, byte_limit, f"Derived from local authoring input: {source}")
            for output, (source, _root, triangles, byte_limit) in DEVICE_SOURCES.items()
        },
    }
    assets = {}
    for filename, (triangle_limit, byte_limit, source) in limits.items():
        path = OUTPUT_DIR / filename
        stats = asset_stats(path)
        assets[filename] = {
            "url": f"/models/cardiac-devices/{filename}",
            "source": source,
            "limits": {"triangles": triangle_limit, "bytes": byte_limit},
            **stats,
        }
    manifest = {
        "schemaVersion": 1,
        "generatedBy": "scripts/cardiac-assets/build-runtime-assets.py",
        "redistributionStatus": "pending-clinical-and-rights-review",
        "assets": assets,
    }
    (OUTPUT_DIR / "asset-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def main() -> None:
    rig = json.loads(RIG_PATH.read_text())
    missing = [source for source, *_ in DEVICE_SOURCES.values() if not (SOURCE_DIR / source).exists()]
    if missing:
        raise FileNotFoundError(f"Missing source cardiac-device assets: {', '.join(missing)}")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    build_heart_great_vessels(rig)
    build_iabp_aorta(rig)
    build_iabp_balloon()
    for output_name, (source_name, root_name, _triangles, _bytes) in DEVICE_SOURCES.items():
        if output_name == "lvad.glb":
            prepare_lvad(SOURCE_DIR / source_name, output_name, root_name)
        else:
            prepare_impella(SOURCE_DIR / source_name, output_name, root_name)
    write_runtime_manifest()
    print(f"Built {len(DEVICE_SOURCES) + 3} cardiac runtime assets in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
