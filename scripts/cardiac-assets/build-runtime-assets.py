#!/usr/bin/env python3
"""Build compact, clinically anchored cardiac-device teaching assets.

Run with Blender, not the system Python:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python \
    scripts/cardiac-assets/build-runtime-assets.py

The LVAD source GLB remains a local authoring input. This script produces neutral,
compressed learner-facing derivatives, project-authored open-lumen vessel scenes, and
physically scaled procedural teaching facsimiles of the Impella CP, 5.5, and RP.
"""

from __future__ import annotations

import json
import math
import shutil
import struct
import subprocess
from pathlib import Path
from typing import Sequence

import bpy
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "3D assets" / "Cardiac" / "Devices"
OUTPUT_DIR = ROOT / "public" / "models" / "cardiac-devices"
RIG_PATH = (
    ROOT / "src" / "features" / "cardiac-anatomy" / "content" / "cardiac-rig.json"
)
RAW_SUFFIX = ".uncompressed.glb"


WEB_UNITS_PER_MM = 0.024
VALVE_MORPHOLOGY_BOUNDARY = (
    "Only the aortic cusps are complete segmented valve morphology; mitral, tricuspid, "
    "and pulmonic locations are route/orifice proxies only."
)

# Procedural teaching facsimiles use physical relative dimensions in the same web-space scale as
# the CT heart. Coordinates are glTF/Three.js Y-up; local +Y always points distally. CP and 5.5
# are rooted at the inlet center. RP is rooted at the PA outlet center for a single spline follower.
IMPELLA_SPECS = {
    "impella-cp-v1.glb": {
        "root": "Impella_CP",
        "label": "Impella CP",
        "triangleLimit": 20_000,
        "byteLimit": 2_000_000,
        "nominalInvasiveLengthMm": 151,
        "diametersMm": {"pigtail": 2.0, "shaft": 3.0, "pump": 14 / 3},
        "anchors": {
            "Anchor_Impella_CP_InletCenter": [0, 0, 0],
            "Anchor_Impella_CP_AorticAnnulus": [0, -35 * WEB_UNITS_PER_MM, 0],
            "Anchor_Impella_CP_OutletCenter": [0, -47 * WEB_UNITS_PER_MM, 0],
            "Anchor_Impella_CP_DistalPigtailTip": [0.12, 0.72, 0],
            "Anchor_Impella_CP_ProximalShaftExit": [0, -106 * WEB_UNITS_PER_MM, 0],
        },
    },
    "impella-55-v1.glb": {
        "root": "Impella_55",
        "label": "Impella 5.5",
        "triangleLimit": 20_000,
        "byteLimit": 2_000_000,
        "nominalInvasiveLengthMm": 114,
        "diametersMm": {"shaft": 3.0, "motor": 6.3, "cannula": 7.0},
        "anchors": {
            "Anchor_Impella_55_InletCenter": [0, 0, 0],
            "Anchor_Impella_55_AorticAnnulus": [0, -50 * WEB_UNITS_PER_MM, 0],
            "Anchor_Impella_55_OutletCenter": [0, -65 * WEB_UNITS_PER_MM, 0],
            "Anchor_Impella_55_DistalTip": [0, 0.12, 0],
            "Anchor_Impella_55_ProximalShaftExit": [0, -109 * WEB_UNITS_PER_MM, 0],
        },
    },
    "impella-rp-v1.glb": {
        "root": "Impella_RP",
        "label": "Impella RP",
        "triangleLimit": 20_000,
        "byteLimit": 2_000_000,
        "nominalInvasiveLengthMm": 238,
        "diametersMm": {"pigtail": 2.0, "shaft": 11 / 3, "motor": 7.0, "cannula": 22 / 3},
        "anchors": {
            "Anchor_Impella_RP_OutletCenter": [0, 0, 0],
            "Anchor_Impella_RP_InletCenter": [0, -205 * WEB_UNITS_PER_MM, 0],
            "Anchor_Impella_RP_MotorCenter": [0, -213 * WEB_UNITS_PER_MM, 0],
            "Anchor_Impella_RP_DistalPigtailTip": [0.08, 0.24, 0],
            "Anchor_Impella_RP_ProximalShaftExit": [0, -221.333333 * WEB_UNITS_PER_MM, 0],
        },
    },
}

IMPELLA_COMPATIBILITY_ALIASES = {
    "impella-cp-v1.glb": "impella-cp.glb",
    "impella-55-v1.glb": "impella-55.glb",
    "impella-rp-v1.glb": "impella-rp.glb",
}

DEVICE_SOURCES = {
    "lvad-v2.glb": ("LVAD.glb", "LVAD", 60_000, 2_500_000),
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
    material.metallic = metallic
    material.roughness = roughness
    principled = next(
        node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"
    )
    principled.inputs["Base Color"].default_value = color
    metallic_input = principled.inputs.get(
        "Metallic IOR Level"
    ) or principled.inputs.get("Metallic")
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
    mesh.from_pydata(
        [desired_to_blender(vertex) for vertex in desired_vertices], [], faces
    )
    mesh.update()
    for material in materials:
        mesh.materials.append(material)
    if material_indices is not None:
        for polygon, material_index in zip(
            mesh.polygons, material_indices, strict=True
        ):
            polygon.material_index = material_index
    object_ = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(object_)
    smooth_mesh(object_)
    return object_


def catmull_rom(
    points: Sequence[Sequence[float]], samples_per_segment: int = 9
) -> list[Vector]:
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
            tangent = (
                centers[center_index + 1] - centers[center_index - 1]
            ).normalized()
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
                point = (
                    center
                    + side * math.cos(angle) * ring_radius
                    + ring_front * math.sin(angle) * ring_radius
                )
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
            vertices.append(
                (x + math.cos(angle) * radius, y, z + math.sin(angle) * radius)
            )
    for index in range(segments):
        following = (index + 1) % segments
        faces.append((index, following, segments + following, segments + index))
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple(range(segments, segments * 2)))
    return create_mesh_object(name, vertices, faces, (material,))


def sampled_centerline(
    control_points: Sequence[Sequence[float]], samples_per_segment: int = 7
) -> tuple[list[Vector], list[Vector], list[Vector], list[Vector]]:
    """Return a stable parallel-transport frame along a compact Catmull-Rom centerline."""

    centers = catmull_rom(control_points, samples_per_segment=samples_per_segment)
    centers = [
        point
        for index, point in enumerate(centers)
        if index == 0 or (point - centers[index - 1]).length > 1e-6
    ]
    tangents: list[Vector] = []
    for index, center in enumerate(centers):
        if index == 0:
            tangent = centers[1] - center
        elif index == len(centers) - 1:
            tangent = center - centers[index - 1]
        else:
            tangent = centers[index + 1] - centers[index - 1]
        tangents.append(tangent.normalized())

    reference = Vector((0, 0, 1))
    if abs(reference.dot(tangents[0])) > 0.92:
        reference = Vector((1, 0, 0))
    normal = (reference - tangents[0] * reference.dot(tangents[0])).normalized()
    normals = [normal.copy()]
    binormals = [tangents[0].cross(normal).normalized()]
    for previous, tangent in zip(tangents, tangents[1:]):
        normal.rotate(previous.rotation_difference(tangent))
        normal = (normal - tangent * normal.dot(tangent)).normalized()
        normals.append(normal.copy())
        binormals.append(tangent.cross(normal).normalized())
    return centers, tangents, normals, binormals


def create_swept_tube(
    name: str,
    control_points: Sequence[Sequence[float]],
    radius: float,
    material: bpy.types.Material,
    *,
    radial_segments: int = 12,
    samples_per_segment: int = 7,
    start_radius: float | None = None,
    end_radius: float | None = None,
) -> bpy.types.Object:
    centers, _tangents, normals, binormals = sampled_centerline(
        control_points, samples_per_segment
    )
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    for center_index, (center, normal, binormal) in enumerate(
        zip(centers, normals, binormals, strict=True)
    ):
        fraction = center_index / max(1, len(centers) - 1)
        ring_radius = radius
        if start_radius is not None and end_radius is not None:
            ring_radius = start_radius + (end_radius - start_radius) * fraction
        for segment in range(radial_segments):
            angle = 2 * math.pi * segment / radial_segments
            point = (
                center
                + normal * math.cos(angle) * ring_radius
                + binormal * math.sin(angle) * ring_radius
            )
            vertices.append(tuple(point))
    for ring in range(len(centers) - 1):
        for segment in range(radial_segments):
            following = (segment + 1) % radial_segments
            current = ring * radial_segments + segment
            next_ring = (ring + 1) * radial_segments + segment
            faces.append(
                (
                    current,
                    next_ring,
                    next_ring + following - segment,
                    current + following - segment,
                )
            )
    first_center = len(vertices)
    vertices.append(tuple(centers[0]))
    last_center = len(vertices)
    vertices.append(tuple(centers[-1]))
    for segment in range(radial_segments):
        following = (segment + 1) % radial_segments
        faces.append((first_center, following, segment))
        last_ring = (len(centers) - 1) * radial_segments
        faces.append((last_center, last_ring + segment, last_ring + following))
    return create_mesh_object(name, vertices, faces, (material,))


def create_torus(
    name: str,
    center: Sequence[float],
    axis: Sequence[float],
    major_radius: float,
    minor_radius: float,
    material: bpy.types.Material,
    *,
    major_segments: int = 20,
    minor_segments: int = 8,
) -> bpy.types.Object:
    center_vector = Vector(center)
    tangent = Vector(axis).normalized()
    reference = Vector((0, 0, 1))
    if abs(reference.dot(tangent)) > 0.92:
        reference = Vector((1, 0, 0))
    normal = (reference - tangent * reference.dot(tangent)).normalized()
    binormal = tangent.cross(normal).normalized()
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for major in range(major_segments):
        major_angle = 2 * math.pi * major / major_segments
        radial = normal * math.cos(major_angle) + binormal * math.sin(major_angle)
        for minor in range(minor_segments):
            minor_angle = 2 * math.pi * minor / minor_segments
            point = (
                center_vector
                + radial * (major_radius + minor_radius * math.cos(minor_angle))
                + tangent * minor_radius * math.sin(minor_angle)
            )
            vertices.append(tuple(point))
    for major in range(major_segments):
        next_major = (major + 1) % major_segments
        for minor in range(minor_segments):
            next_minor = (minor + 1) % minor_segments
            faces.append(
                (
                    major * minor_segments + minor,
                    next_major * minor_segments + minor,
                    next_major * minor_segments + next_minor,
                    major * minor_segments + next_minor,
                )
            )
    return create_mesh_object(name, vertices, faces, (material,))


def join_meshes(name: str, objects: Sequence[bpy.types.Object]) -> bpy.types.Object:
    material = objects[0].data.materials[0]
    bpy.ops.object.select_all(action="DESELECT")
    for object_ in objects:
        object_.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    joined.data.materials.clear()
    joined.data.materials.append(material)
    for polygon in joined.data.polygons:
        polygon.material_index = 0
    smooth_mesh(joined)
    return joined


def create_window_cage(
    name: str,
    center: Sequence[float],
    axis: Sequence[float],
    length: float,
    radius: float,
    windows: int,
    material: bpy.types.Material,
) -> bpy.types.Object:
    center_vector = Vector(center)
    tangent = Vector(axis).normalized()
    reference = Vector((0, 0, 1))
    if abs(reference.dot(tangent)) > 0.92:
        reference = Vector((1, 0, 0))
    normal = (reference - tangent * reference.dot(tangent)).normalized()
    binormal = tangent.cross(normal).normalized()
    start = center_vector - tangent * length / 2
    end = center_vector + tangent * length / 2
    rail_radius = max(0.007, radius * 0.11)
    components: list[bpy.types.Object] = [
        create_torus(
            f"{name}_StartRing",
            start,
            tangent,
            radius - rail_radius,
            rail_radius,
            material,
        ),
        create_torus(
            f"{name}_EndRing",
            end,
            tangent,
            radius - rail_radius,
            rail_radius,
            material,
        ),
    ]
    for index in range(windows):
        angle = 2 * math.pi * index / windows
        offset = (
            normal * math.cos(angle) * (radius - rail_radius)
            + binormal * math.sin(angle) * (radius - rail_radius)
        )
        components.append(
            create_swept_tube(
                f"{name}_Rail_{index + 1}",
                (start + offset, end + offset),
                rail_radius,
                material,
                radial_segments=8,
                samples_per_segment=1,
            )
        )
    return join_meshes(name, components)


def create_reinforcement_spiral(
    name: str,
    control_points: Sequence[Sequence[float]],
    body_radius: float,
    material: bpy.types.Material,
    *,
    turns: float,
) -> bpy.types.Object:
    centers, _tangents, normals, binormals = sampled_centerline(
        control_points, samples_per_segment=8
    )
    points: list[tuple[float, float, float]] = []
    for index, (center, normal, binormal) in enumerate(
        zip(centers, normals, binormals, strict=True)
    ):
        fraction = index / max(1, len(centers) - 1)
        angle = turns * 2 * math.pi * fraction
        point = center + (
            normal * math.cos(angle) + binormal * math.sin(angle)
        ) * (body_radius * 1.015)
        points.append(tuple(point))
    return create_swept_tube(
        name,
        points,
        max(0.0045, body_radius * 0.055),
        material,
        radial_segments=6,
        samples_per_segment=1,
    )


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
    arterial_outer = make_material(
        "Aortic outer wall", (0.42, 0.075, 0.065, 1), roughness=0.68
    )
    arterial_inner = make_material(
        "Aortic lumen", (0.68, 0.19, 0.15, 1), roughness=0.58
    )
    pulmonary_outer = make_material(
        "Pulmonary artery outer wall", (0.08, 0.16, 0.38, 1), roughness=0.7
    )
    pulmonary_inner = make_material(
        "Pulmonary artery lumen", (0.15, 0.31, 0.64, 1), roughness=0.6
    )
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
    create_open_vessel(
        "IABP_Aorta_OpenLumen",
        anatomy["aorta"],
        0.23,
        0.052,
        outer,
        inner,
        radial_segments=22,
    )
    for index, branch in enumerate(anatomy["archBranches"], start=1):
        create_open_vessel(
            f"IABP_ArchBranch_{index}",
            branch,
            0.09,
            0.024,
            outer,
            inner,
            radial_segments=14,
        )
    for index, branch in enumerate(anatomy["renalBranches"], start=1):
        create_open_vessel(
            f"IABP_RenalArtery_{index}",
            branch,
            0.075,
            0.02,
            outer,
            inner,
            radial_segments=14,
        )
    for index, branch in enumerate(anatomy["iliacBranches"], start=1):
        create_open_vessel(
            f"IABP_IliacArtery_{index}",
            branch,
            0.145,
            0.035,
            outer,
            inner,
            radial_segments=16,
        )
    add_landmark("Landmark_LeftSubclavian", anatomy["archBranches"][2][0])
    add_landmark("Landmark_RenalArteries", anatomy["renalBranches"][0][0])
    add_landmark("Landmark_RightFemoralAccess", anatomy["iliacBranches"][1][-1])
    export_compressed("iabp-aorta-cutaway.glb")


def build_iabp_balloon() -> None:
    clear_scene()
    balloon_material = make_material(
        "IABP translucent membrane",
        (0.72, 0.82, 0.84, 0.52),
        roughness=0.22,
        transparent=True,
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
                (
                    math.cos(angle) * collapsed_radius,
                    y,
                    math.sin(angle) * collapsed_radius,
                )
            )
            inflated.append(
                (
                    math.cos(angle) * inflated_radius,
                    y,
                    math.sin(angle) * inflated_radius,
                )
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


def impella_materials() -> dict[str, bpy.types.Material]:
    return {
        "blue": make_material(
            "Impella blue polyurethane", (0.035, 0.23, 0.48, 1), roughness=0.3
        ),
        "red": make_material(
            "Impella red inlet outlet", (0.68, 0.025, 0.035, 1), roughness=0.27
        ),
        "silver": make_material(
            "Impella silver motor", (0.5, 0.57, 0.59, 1), metallic=0.72, roughness=0.2
        ),
        "marker": make_material(
            "Impella radiopaque marker",
            (0.82, 0.67, 0.28, 1),
            metallic=0.65,
            roughness=0.18,
        ),
        "shaft": make_material(
            "Impella dark proximal shaft", (0.025, 0.035, 0.045, 1), roughness=0.25
        ),
    }


def finish_impella_hierarchy(
    output_name: str,
    components: Sequence[bpy.types.Object],
    legacy_anchors: dict[str, Sequence[float]],
) -> None:
    spec = IMPELLA_SPECS[output_name]
    root_name = spec["root"]
    root = bpy.data.objects.new(f"{root_name}_Root", None)
    root["educational_facsimile"] = True
    root["web_units_per_mm"] = WEB_UNITS_PER_MM
    root["nominal_invasive_length_mm"] = spec["nominalInvasiveLengthMm"]
    root["local_forward_axis"] = "+Y"
    root["valve_morphology_boundary"] = VALVE_MORPHOLOGY_BOUNDARY
    bpy.context.collection.objects.link(root)
    assembly = bpy.data.objects.new(root_name, None)
    assembly.parent = root
    bpy.context.collection.objects.link(assembly)
    for component in components:
        component.parent = assembly

    anchors = {**spec["anchors"], **legacy_anchors}
    for name, point in anchors.items():
        landmark = add_landmark(name, point)
        landmark.parent = root
    export_compressed(output_name)


def build_impella_cp() -> None:
    clear_scene()
    materials = impella_materials()
    pump_radius = (14 / 3) * WEB_UNITS_PER_MM / 2
    shaft_radius = 3 * WEB_UNITS_PER_MM / 2
    pigtail_radius = 2 * WEB_UNITS_PER_MM / 2
    cannula_controls = (
        (0, -0.12, 0),
        (0.11, -0.38, 0.01),
        (0.13, -0.63, 0.015),
        (0.04, -0.82, 0.006),
        (0, -1.00, 0),
    )
    motor_controls = ((0, -1.26, 0), (0.035, -1.56, 0), (0.02, -1.92, 0))
    pigtail_controls = (
        (0, 0.14, 0),
        (-0.04, 0.4, 0),
        (-0.22, 0.72, 0),
        (-0.24, 1.02, 0),
        (-0.05, 1.08, 0),
        (0.18, 0.94, 0),
        (0.22, 0.76, 0),
        (0.12, 0.72, 0),
    )
    components = [
        create_swept_tube(
            "Impella_CP_DistalPigtail",
            pigtail_controls,
            pigtail_radius,
            materials["blue"],
            radial_segments=10,
        ),
        create_window_cage(
            "Impella_CP_InletCage",
            (0, 0, 0),
            (0, 1, 0),
            0.28,
            pump_radius * 1.12,
            4,
            materials["red"],
        ),
        create_swept_tube(
            "Impella_CP_ReinforcedCannula",
            cannula_controls,
            pump_radius,
            materials["blue"],
            radial_segments=14,
        ),
        create_reinforcement_spiral(
            "Impella_CP_ReinforcementSpiral",
            cannula_controls,
            pump_radius,
            materials["silver"],
            turns=8,
        ),
        create_torus(
            "Impella_CP_AorticAnnulusMarker",
            (0, -35 * WEB_UNITS_PER_MM, 0),
            (0, 1, 0),
            pump_radius * 1.02,
            0.012,
            materials["marker"],
        ),
        create_window_cage(
            "Impella_CP_OutletCage",
            (0, -47 * WEB_UNITS_PER_MM, 0),
            (0, 1, 0),
            0.26,
            pump_radius * 1.1,
            4,
            materials["red"],
        ),
        create_swept_tube(
            "Impella_CP_MotorHousing",
            motor_controls,
            pump_radius,
            materials["silver"],
            radial_segments=14,
        ),
        create_torus(
            "Impella_CP_OpenPressureArea",
            (0.02, -1.92, 0),
            (0, 1, 0),
            shaft_radius * 1.15,
            0.012,
            materials["marker"],
        ),
        create_swept_tube(
            "Impella_CP_ProximalShaft",
            ((0.02, -1.92, 0), (0.01, -2.2, 0), (0, -2.544, 0)),
            shaft_radius,
            materials["shaft"],
            radial_segments=10,
        ),
    ]
    anchors = IMPELLA_SPECS["impella-cp-v1.glb"]["anchors"]
    finish_impella_hierarchy(
        "impella-cp-v1.glb",
        components,
        {
            "Anchor_Impella_CP_Inlet": anchors["Anchor_Impella_CP_InletCenter"],
            "Anchor_Impella_CP_Outlet": anchors["Anchor_Impella_CP_OutletCenter"],
            "Anchor_Impella_CP_Distal": anchors["Anchor_Impella_CP_DistalPigtailTip"],
            "Anchor_Impella_CP_Proximal": anchors[
                "Anchor_Impella_CP_ProximalShaftExit"
            ],
        },
    )


def build_impella_55() -> None:
    clear_scene()
    materials = impella_materials()
    cannula_radius = 7 * WEB_UNITS_PER_MM / 2
    motor_radius = 6.3 * WEB_UNITS_PER_MM / 2
    shaft_radius = 3 * WEB_UNITS_PER_MM / 2
    cannula_controls = (
        (0, -0.1, 0),
        (0.13, -0.42, 0.015),
        (0.18, -0.78, 0.025),
        (0.06, -1.16, 0.01),
        (0, -1.4, 0),
    )
    components = [
        create_swept_tube(
            "Impella_55_DistalTip",
            ((0, 0.1, 0), (0, 0.12, 0)),
            cannula_radius,
            materials["blue"],
            radial_segments=12,
            samples_per_segment=1,
            start_radius=cannula_radius,
            end_radius=0.016,
        ),
        create_window_cage(
            "Impella_55_InletCage",
            (0, 0, 0),
            (0, 1, 0),
            0.2,
            cannula_radius * 1.08,
            5,
            materials["red"],
        ),
        create_swept_tube(
            "Impella_55_ReinforcedCannula",
            cannula_controls,
            cannula_radius,
            materials["blue"],
            radial_segments=14,
        ),
        create_reinforcement_spiral(
            "Impella_55_ReinforcementSpiral",
            cannula_controls,
            cannula_radius,
            materials["silver"],
            turns=10,
        ),
        create_torus(
            "Impella_55_AorticAnnulusMarker",
            (0, -50 * WEB_UNITS_PER_MM, 0),
            (0, 1, 0),
            cannula_radius * 1.02,
            0.013,
            materials["marker"],
        ),
        create_torus(
            "Impella_55_FiberOpticSensor",
            (0, -1.39, 0),
            (0, 1, 0),
            cannula_radius * 1.04,
            0.012,
            materials["marker"],
        ),
        create_window_cage(
            "Impella_55_OutletCage",
            (0, -65 * WEB_UNITS_PER_MM, 0),
            (0, 1, 0),
            0.3,
            cannula_radius * 1.08,
            5,
            materials["red"],
        ),
        create_swept_tube(
            "Impella_55_MotorHousing",
            ((0, -1.72, 0), (0.025, -1.98, 0), (0.015, -2.28, 0)),
            motor_radius,
            materials["silver"],
            radial_segments=14,
        ),
        create_swept_tube(
            "Impella_55_ProximalShaft",
            ((0.015, -2.28, 0), (0.008, -2.46, 0), (0, -2.616, 0)),
            shaft_radius,
            materials["shaft"],
            radial_segments=10,
        ),
    ]
    anchors = IMPELLA_SPECS["impella-55-v1.glb"]["anchors"]
    finish_impella_hierarchy(
        "impella-55-v1.glb",
        components,
        {
            "Anchor_Impella_55_Distal": anchors["Anchor_Impella_55_DistalTip"],
            "Anchor_Impella_55_Proximal": anchors[
                "Anchor_Impella_55_ProximalShaftExit"
            ],
        },
    )


def build_impella_rp() -> None:
    clear_scene()
    materials = impella_materials()
    cannula_radius = (22 / 3) * WEB_UNITS_PER_MM / 2
    motor_radius = 7 * WEB_UNITS_PER_MM / 2
    shaft_radius = (11 / 3) * WEB_UNITS_PER_MM / 2
    cannula_controls = (
        (0, -0.15, 0),
        (0.12, -0.55, 0.025),
        (0.35, -1.15, 0.06),
        (0.58, -1.9, 0.09),
        (0.62, -2.7, 0.09),
        (0.49, -3.45, 0.06),
        (0.25, -4.15, 0.025),
        (0, -4.78, 0),
    )
    pigtail_controls = (
        (0, 0.15, 0),
        (-0.06, 0.28, 0),
        (-0.02, 0.4, 0),
        (0.12, 0.39, 0),
        (0.18, 0.3, 0),
        (0.08, 0.24, 0),
    )
    components = [
        create_swept_tube(
            "Impella_RP_DistalPigtail",
            pigtail_controls,
            2 * WEB_UNITS_PER_MM / 2,
            materials["blue"],
            radial_segments=10,
        ),
        create_window_cage(
            "Impella_RP_OutletCage",
            (0, 0, 0),
            (0, 1, 0),
            0.3,
            cannula_radius * 1.08,
            5,
            materials["red"],
        ),
        create_swept_tube(
            "Impella_RP_ReinforcedCannula",
            cannula_controls,
            cannula_radius,
            materials["blue"],
            radial_segments=14,
            samples_per_segment=10,
        ),
        create_reinforcement_spiral(
            "Impella_RP_ReinforcementSpiral",
            cannula_controls,
            cannula_radius,
            materials["silver"],
            turns=18,
        ),
        create_torus(
            "Impella_RP_DifferentialPressureSensor",
            (0, -4.78, 0),
            (0, 1, 0),
            cannula_radius * 1.02,
            0.013,
            materials["marker"],
        ),
        create_window_cage(
            "Impella_RP_InletCage",
            (0, -205 * WEB_UNITS_PER_MM, 0),
            (0, 1, 0),
            0.28,
            cannula_radius * 1.08,
            5,
            materials["red"],
        ),
        create_swept_tube(
            "Impella_RP_MotorHousing",
            ((0, -5.02, 0), (0, -5.112, 0), (0, -5.22, 0)),
            motor_radius,
            materials["silver"],
            radial_segments=14,
        ),
        create_swept_tube(
            "Impella_RP_ProximalShaft",
            ((0, -5.22, 0), (0, -5.26, 0), (0, -5.312, 0)),
            shaft_radius,
            materials["shaft"],
            radial_segments=10,
        ),
    ]
    anchors = IMPELLA_SPECS["impella-rp-v1.glb"]["anchors"]
    finish_impella_hierarchy(
        "impella-rp-v1.glb",
        components,
        {
            "Anchor_Impella_RP_Distal": anchors[
                "Anchor_Impella_RP_DistalPigtailTip"
            ],
            "Anchor_Impella_RP_Proximal": anchors[
                "Anchor_Impella_RP_ProximalShaftExit"
            ],
        },
    )


def imported_meshes() -> list[bpy.types.Object]:
    return [object_ for object_ in bpy.context.scene.objects if object_.type == "MESH"]


def normalize_imported_scene(
    root_name: str, *, reference_longest: float | None = None
) -> bpy.types.Object:
    meshes = imported_meshes()
    if not meshes:
        raise RuntimeError(f"{root_name}: no meshes were imported")
    corners = [
        mesh.matrix_world @ Vector(corner)
        for mesh in meshes
        for corner in mesh.bound_box
    ]
    minimum = Vector(
        (
            min(point.x for point in corners),
            min(point.y for point in corners),
            min(point.z for point in corners),
        )
    )
    maximum = Vector(
        (
            max(point.x for point in corners),
            max(point.y for point in corners),
            max(point.z for point in corners),
        )
    )
    center = (minimum + maximum) * 0.5
    longest = reference_longest or max(
        maximum.x - minimum.x, maximum.y - minimum.y, maximum.z - minimum.z
    )
    scale = 2 / longest
    root = bpy.data.objects.new(root_name, None)
    bpy.context.collection.objects.link(root)
    top_level = [
        object_
        for object_ in bpy.context.scene.objects
        if object_ != root and object_.parent is None
    ]
    for object_ in top_level:
        world = object_.matrix_world.copy()
        object_.parent = root
        object_.matrix_world = world
    root.scale = (scale, scale, scale)
    root.location = -center * scale
    return root


def bake_root_transform(root: bpy.types.Object) -> None:
    """Bake normalization into the root's children so local landmark coordinates stay exact."""

    bpy.context.view_layer.update()
    child_world_matrices = {child: child.matrix_world.copy() for child in root.children}
    root.matrix_world = Matrix.Identity(4)
    for child, matrix_world in child_world_matrices.items():
        child.matrix_world = matrix_world
    bpy.context.view_layer.update()


def simplify_impella_materials(label: str) -> None:
    for material in bpy.data.materials:
        material.name = f"{label} clinical polymer"
        if not material.use_nodes or material.node_tree is None:
            continue
        principled = next(
            (
                node
                for node in material.node_tree.nodes
                if node.type == "BSDF_PRINCIPLED"
            ),
            None,
        )
        if principled is None:
            continue
        for input_name in (
            "Metallic IOR Level",
            "Roughness",
            "Normal",
            "Emission Color",
            "Emission Strength",
        ):
            input_ = principled.inputs.get(input_name)
            if input_ is None:
                continue
            for link in list(input_.links):
                material.node_tree.links.remove(link)
        metallic_input = principled.inputs.get(
            "Metallic IOR Level"
        ) or principled.inputs.get("Metallic")
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
                if link.from_node.type == "TEX_IMAGE"
                and link.from_node.image is not None
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
    bake_root_transform(root)
    add_landmark(f"Anchor_{root_name}_Distal", (0, 1, 0))
    add_landmark(f"Anchor_{root_name}_Proximal", (0, -1, 0))
    if root_name == "Impella_CP":
        # Registration landmarks for the CT-derived aortic-valve route. Local +Y is distal.
        add_landmark("Anchor_Impella_CP_Inlet", (0, 0.6, 0))
        add_landmark("Anchor_Impella_CP_Outlet", (0, -0.32, 0))
    for landmark in [
        object_
        for object_ in bpy.context.scene.objects
        if object_.name.startswith("Anchor_")
    ]:
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
        raise RuntimeError(
            "LVAD source no longer contains the expected graft, inflow, and pump parts"
        )
    outflow_graft = components[0]
    inflow_cannula = components[1]
    pump_housing = components[2]
    for discarded in [outflow_graft, *components[3:]]:
        bpy.data.objects.remove(discarded, do_unlink=True)

    kept = (inflow_cannula, pump_housing)
    total_triangles = sum(len(component.data.polygons) for component in kept)
    decimation_ratio = min(1.0, 56_000 / max(1, total_triangles))
    materials = (
        make_material(
            "LVAD inflow titanium", (0.43, 0.49, 0.5, 1), metallic=0.62, roughness=0.24
        ),
        make_material(
            "LVAD pump housing", (0.2, 0.25, 0.27, 1), metallic=0.48, roughness=0.3
        ),
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
    # Keep the normalized authoring geometry in an identity root.  Without this bake,
    # parenting landmarks below the translated/scaled root silently moves them several
    # web units away from the actual pump (the previous runtime asset did exactly that).
    bake_root_transform(root)
    add_landmark("Anchor_LVAD_Inflow", (-0.17, -0.55, 0.02))
    add_landmark("Anchor_LVAD_ApicalCuff", (-0.17, -0.43, 0.02))
    add_landmark("Anchor_LVAD_Outflow", (0.01777, 0.13045, 0.00231))
    add_landmark("Anchor_LVAD_PumpOutlet", (0.01777, 0.13045, 0.00231))
    add_landmark("Anchor_LVAD_PumpCenter", (0.0939, 0.26912, -0.03838))
    for landmark in [
        object_
        for object_ in bpy.context.scene.objects
        if object_.name.startswith("Anchor_")
    ]:
        landmark.parent = root
    export_compressed(output_name)


def gltf_pipeline_executable() -> str:
    local = ROOT / "node_modules" / ".bin" / "gltf-pipeline"
    if local.exists():
        return str(local)
    executable = shutil.which("gltf-pipeline")
    if executable:
        return executable
    raise RuntimeError(
        "gltf-pipeline is required; run npm install before building cardiac assets"
    )


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
    compatibility_alias = IMPELLA_COMPATIBILITY_ALIASES.get(output_name)
    if compatibility_alias:
        shutil.copy2(output_path, OUTPUT_DIR / compatibility_alias)


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
        "nodes": [
            node.get("name") for node in document.get("nodes", []) if node.get("name")
        ],
        "dracoCompressed": "KHR_draco_mesh_compression"
        in document.get("extensionsUsed", []),
    }


def write_runtime_manifest() -> None:
    limits = {
        "heart-great-vessels.glb": (
            50_000,
            2_500_000,
            "Project-authored open-lumen great vessels",
        ),
        "iabp-aorta-cutaway.glb": (
            50_000,
            2_500_000,
            "Project-authored open-lumen aorta",
        ),
        "iabp-balloon.glb": (
            20_000,
            2_000_000,
            "Project-authored neutral IABP facsimile",
        ),
        **{
            output: (
                spec["triangleLimit"],
                spec["byteLimit"],
                "Project-authored physical-scale procedural teaching facsimile informed by supplied reference artwork and FDA/IFU dimensional labels",
            )
            for output, spec in IMPELLA_SPECS.items()
        },
        **{
            output: (
                triangles,
                byte_limit,
                f"Derived from local authoring input: {source}",
            )
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
        if filename in IMPELLA_SPECS:
            spec = IMPELLA_SPECS[filename]
            assets[filename]["physicalScale"] = {
                "webUnitsPerMm": WEB_UNITS_PER_MM,
                "nominalInvasiveLengthMm": spec["nominalInvasiveLengthMm"],
                "diametersMm": spec["diametersMm"],
            }
            assets[filename]["anchorConvention"] = {
                "localForwardAxis": "+Y",
                "rootRole": (
                    "pulmonary-artery outlet center"
                    if filename == "impella-rp-v1.glb"
                    else "left-ventricular inlet center"
                ),
                "anchors": spec["anchors"],
            }
            assets[filename]["compatibilityAliases"] = [
                f"/models/cardiac-devices/{IMPELLA_COMPATIBILITY_ALIASES[filename]}"
            ]
            assets[filename]["valveMorphologyBoundary"] = (
                VALVE_MORPHOLOGY_BOUNDARY
            )
        elif filename == "lvad-v2.glb":
            assets[filename]["anchorConvention"] = {
                "localForwardAxis": "+Y from LV inflow toward the extracardiac pump",
                "anchors": {
                    "Anchor_LVAD_Inflow": [-0.17, -0.55, 0.02],
                    "Anchor_LVAD_ApicalCuff": [-0.17, -0.43, 0.02],
                    "Anchor_LVAD_Outflow": [0.01777, 0.13045, 0.00231],
                    "Anchor_LVAD_PumpOutlet": [0.01777, 0.13045, 0.00231],
                    "Anchor_LVAD_PumpCenter": [0.0939, 0.26912, -0.03838],
                },
            }
    manifest = {
        "schemaVersion": 2,
        "generatedBy": "scripts/cardiac-assets/build-runtime-assets.py",
        "redistributionStatus": "pending-clinical-and-rights-review",
        "valveMorphologyBoundary": VALVE_MORPHOLOGY_BOUNDARY,
        "assets": assets,
    }
    (OUTPUT_DIR / "asset-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n"
    )


def main() -> None:
    rig = json.loads(RIG_PATH.read_text())
    missing = [
        source
        for source, *_ in DEVICE_SOURCES.values()
        if not (SOURCE_DIR / source).exists()
    ]
    if missing:
        raise FileNotFoundError(
            f"Missing source cardiac-device assets: {', '.join(missing)}"
        )
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    build_heart_great_vessels(rig)
    build_iabp_aorta(rig)
    build_iabp_balloon()
    build_impella_cp()
    build_impella_55()
    build_impella_rp()
    for output_name, (
        source_name,
        root_name,
        _triangles,
        _bytes,
    ) in DEVICE_SOURCES.items():
        prepare_lvad(SOURCE_DIR / source_name, output_name, root_name)
    write_runtime_manifest()
    print(
        f"Built {len(DEVICE_SOURCES) + len(IMPELLA_SPECS) + 3} cardiac runtime assets in {OUTPUT_DIR}"
    )


if __name__ == "__main__":
    main()
