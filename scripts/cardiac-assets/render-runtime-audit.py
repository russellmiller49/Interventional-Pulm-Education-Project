#!/usr/bin/env python3
"""Render deterministic visual-audit frames from the shipped cardiac GLBs and rig."""

from __future__ import annotations

import argparse
import bisect
import json
import math
from pathlib import Path
import sys
from typing import Sequence

import bpy
from mathutils import Euler, Matrix, Vector
from mathutils.bvhtree import BVHTree


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = Path("/tmp/cardiac-runtime-audit")
RIG = json.loads(
    (
        ROOT / "src" / "features" / "cardiac-anatomy" / "content" / "cardiac-rig.json"
    ).read_text()
)
CT_RIG = json.loads(
    (
        ROOT
        / "src"
        / "features"
        / "cardiac-anatomy"
        / "content"
        / "cardiac-ct-rig.json"
    ).read_text()
)

RUNTIME_SCENES = ("impella", "iabp", "lvad", "pac", "ecmo")
IMPELLA_POSES = {
    "aortic-entry": "aorticRoot",
    "correct": "correct",
    "too-deep": "deep",
    "too-shallow": "tooShallow",
}
IMPELLA_ANCHOR_TOLERANCE_MM = 0.1
IMPELLA_ANCHOR_ERRORS: dict[str, dict[str, float]] = {}
IMPELLA_ROUTE_MEASUREMENTS: dict[str, dict[str, float]] = {}
LVAD_GRAFT_CLEARANCE_MM: dict[str, float] = {}
IMPELLA_VARIANTS = {
    "cp": {
        "route": "impella",
        "headAnchor": "inletLocal",
        "trailingAnchor": "outletLocal",
        "spanStart": "aorticRoot",
        "headNodes": ("DistalPigtail", "InletCage"),
        "trailingNodes": ("OutletCage", "MotorHousing", "OpenPressureArea"),
        "cannulaRadius": 0.056,
        "cannulaColor": (0.223, 0.402, 1.0, 1),
        "shaftRadius": 0.036,
        "tipDeployEnd": "tooShallow",
        "physicalReferenceMm": 47,
        "physicalReferenceKind": "registered inlet-to-outlet anchor span",
        "inletAnchor": "Anchor_Impella_CP_InletCenter",
        "outletAnchor": "Anchor_Impella_CP_OutletCenter",
    },
    "55": {
        "route": "impella55",
        "headAnchor": "inletLocal",
        "trailingAnchor": "outletLocal",
        "spanStart": "aorticRoot",
        "headNodes": ("DistalTip", "InletCage"),
        "trailingNodes": ("OutletCage", "MotorHousing", "FiberOpticSensor"),
        "cannulaRadius": 0.084,
        "cannulaColor": (0.239, 0.425, 1.0, 1),
        "shaftRadius": 0.036,
        "physicalReferenceMm": 65,
        "physicalReferenceKind": "registered inlet-to-outlet anchor span",
        "inletAnchor": "Anchor_Impella_55_InletCenter",
        "outletAnchor": "Anchor_Impella_55_OutletCenter",
    },
    "rp": {
        "route": "impellaRp",
        "headAnchor": "outletLocal",
        "trailingAnchor": "inletLocal",
        "spanStart": "ivcInlet",
        "headNodes": ("DistalPigtail", "OutletCage"),
        "trailingNodes": (
            "InletCage",
            "MotorHousing",
            "DifferentialPressureSensor",
            "ProximalShaft",
        ),
        "cannulaRadius": 0.088,
        "cannulaColor": (0.274, 0.398, 1.0, 1),
        "shaftRadius": 0.044,
        "tipDeployEnd": "tooProximal",
        "physicalReferenceMm": 205,
        "physicalReferenceKind": "registered inlet-to-outlet anchor span",
        "inletAnchor": "Anchor_Impella_RP_InletCenter",
        "outletAnchor": "Anchor_Impella_RP_OutletCenter",
    },
}


def desired_to_blender(point: Sequence[float]) -> Vector:
    return Vector((float(point[0]), -float(point[2]), float(point[1])))


COORDINATE_CONVERSION = Matrix(
    (
        (1, 0, 0, 0),
        (0, 0, -1, 0),
        (0, 1, 0, 0),
        (0, 0, 0, 1),
    )
)


def clear_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def configure_render() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 760
    scene.render.resolution_y = 760
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new("AuditWorld")
    scene.world.color = (0.008, 0.025, 0.032)
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.image_settings.color_mode = "RGBA"


def add_lighting() -> None:
    world = bpy.context.scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.006, 0.022, 0.029, 1)
    background.inputs["Strength"].default_value = 0.32
    for name, location, energy, color, size in (
        ("Key", (4.5, -5.5, 6.5), 1050, (1.0, 0.86, 0.8), 4.0),
        ("Fill", (-4.0, -2.0, 2.5), 700, (0.45, 0.78, 0.82), 3.0),
        ("Rim", (0.5, 2.5, 5.0), 850, (0.65, 0.82, 1.0), 3.0),
    ):
        light_data = bpy.data.lights.new(name, "AREA")
        light_data.energy = energy
        light_data.color = color
        light_data.shape = "DISK"
        light_data.size = size
        light = bpy.data.objects.new(name, light_data)
        light.location = location
        bpy.context.collection.objects.link(light)


def add_camera(preset: dict) -> None:
    camera_data = bpy.data.cameras.new("AuditCamera")
    camera_data.lens = 50
    camera = bpy.data.objects.new("AuditCamera", camera_data)
    camera.location = desired_to_blender(preset["position"])
    target = desired_to_blender(preset["target"])
    camera.rotation_euler = (
        (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    )
    camera_data.angle = math.radians(preset["fov"])
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera


def add_isolated_camera(objects: Sequence[bpy.types.Object]) -> None:
    meshes = [object_ for object_ in objects if object_.type == "MESH"]
    corners = [
        object_.matrix_world @ Vector(corner)
        for object_ in meshes
        for corner in object_.bound_box
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
    camera_data = bpy.data.cameras.new("IsolatedAuditCamera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = max(maximum.z - minimum.z, maximum.x - minimum.x) * 1.18
    camera = bpy.data.objects.new("IsolatedAuditCamera", camera_data)
    camera.location = center + Vector((0, -8, 0))
    camera.rotation_euler = (
        (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    )
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera


def import_asset(url: str) -> list[bpy.types.Object]:
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / "public" / url.removeprefix("/")))
    return [object_ for object_ in bpy.context.scene.objects if object_ not in before]


def show_only_mesh_fragments(
    objects: Sequence[bpy.types.Object], name_fragments: Sequence[str]
) -> None:
    """Keep only the endpoint assembly meshes used by the runtime split follower."""

    for object_ in objects:
        if object_.type == "MESH":
            object_.hide_render = not any(
                fragment in object_.name for fragment in name_fragments
            )


def make_impella_audit_visible(objects: Sequence[bpy.types.Object]) -> None:
    """Give endpoint assemblies a small emissive lift for the x-ray teaching view."""

    materials = {
        material
        for object_ in objects
        if object_.type == "MESH"
        for material in object_.data.materials
        if material is not None
    }
    for material in materials:
        if not material.use_nodes:
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
        base_color = principled.inputs["Base Color"].default_value
        emission = principled.inputs.get("Emission Color") or principled.inputs.get(
            "Emission"
        )
        if emission is not None:
            emission.default_value = (*base_color[:3], 1)
        emission_strength = principled.inputs.get("Emission Strength")
        if emission_strength is not None:
            emission_strength.default_value = 0.45


def parent_with_transform(
    objects: list[bpy.types.Object],
    name: str,
    position: Sequence[float],
    rotation: Sequence[float],
    scale: float,
) -> bpy.types.Object:
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for object_ in [candidate for candidate in objects if candidate.parent is None]:
        world = object_.matrix_world.copy()
        object_.parent = root
        object_.matrix_world = world
    desired_rotation = Euler(tuple(rotation), "XYZ").to_matrix().to_4x4()
    blender_rotation = (
        COORDINATE_CONVERSION @ desired_rotation @ COORDINATE_CONVERSION.inverted()
    )
    transform = (
        Matrix.Translation(desired_to_blender(position))
        @ blender_rotation
        @ Matrix.Scale(scale, 4)
    )
    root.matrix_world = transform
    return root


def parent_with_desired_matrix(
    objects: list[bpy.types.Object],
    name: str,
    desired_matrix: Matrix,
) -> bpy.types.Object:
    """Apply a Three.js-space matrix to imported roots after glTF axis conversion."""
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for object_ in [candidate for candidate in objects if candidate.parent is None]:
        world = object_.matrix_world.copy()
        object_.parent = root
        object_.matrix_world = world
    root.matrix_world = (
        COORDINATE_CONVERSION @ desired_matrix @ COORDINATE_CONVERSION.inverted()
    )
    return root


def _catmull_rom_coordinate(
    p0: float,
    p1: float,
    p2: float,
    p3: float,
    dt0: float,
    dt1: float,
    dt2: float,
    weight: float,
) -> float:
    """Match Three.js' non-uniform CatmullRomCurve3 cubic for one coordinate."""
    tangent1 = (p1 - p0) / dt0 - (p2 - p0) / (dt0 + dt1) + (p2 - p1) / dt1
    tangent2 = (p2 - p1) / dt1 - (p3 - p1) / (dt1 + dt2) + (p3 - p2) / dt2
    tangent1 *= dt1
    tangent2 *= dt1
    coefficient0 = p1
    coefficient1 = tangent1
    coefficient2 = -3 * p1 + 3 * p2 - 2 * tangent1 - tangent2
    coefficient3 = 2 * p1 - 2 * p2 + tangent1 + tangent2
    return (
        coefficient0
        + coefficient1 * weight
        + coefficient2 * weight * weight
        + coefficient3 * weight * weight * weight
    )


def _catmull_rom_point(points: Sequence[Sequence[float]], parameter: float) -> Vector:
    """Evaluate Three.js' open centripetal CatmullRomCurve3 at curve parameter t."""
    count = len(points)
    if count < 2:
        raise ValueError("A runtime route needs at least two points")
    scaled = max(0.0, min(1.0, parameter)) * (count - 1)
    point_index = math.floor(scaled)
    weight = scaled - point_index
    if weight == 0 and point_index == count - 1:
        point_index = count - 2
        weight = 1

    p0 = Vector(points[point_index if point_index == 0 else point_index - 1])
    p1 = Vector(points[point_index])
    p2 = Vector(points[count - 1 if point_index > count - 2 else point_index + 1])
    p3 = Vector(points[count - 1 if point_index > count - 3 else point_index + 2])
    # Three.js uses distance^0.5 for its centripetal parameter deltas.
    dt0 = math.sqrt((p0 - p1).length)
    dt1 = math.sqrt((p1 - p2).length)
    dt2 = math.sqrt((p2 - p3).length)
    if dt1 < 1e-4:
        dt1 = 1
    if dt0 < 1e-4:
        dt0 = dt1
    if dt2 < 1e-4:
        dt2 = dt1
    return Vector(
        _catmull_rom_coordinate(
            p0[axis], p1[axis], p2[axis], p3[axis], dt0, dt1, dt2, weight
        )
        for axis in range(3)
    )


class RuntimeCurve:
    """Small Three.js-compatible getPointAt/getTangentAt adapter for Blender audits."""

    def __init__(self, points: Sequence[Sequence[float]]) -> None:
        self.points = points
        divisions = 200
        sampled = [
            _catmull_rom_point(points, index / divisions)
            for index in range(divisions + 1)
        ]
        self.arc_lengths = [0.0]
        for previous, current in zip(sampled, sampled[1:]):
            self.arc_lengths.append(self.arc_lengths[-1] + (current - previous).length)

    def parameter_at(self, progress: float) -> float:
        bounded = max(0.0, min(1.0, progress))
        target_length = bounded * self.arc_lengths[-1]
        high = bisect.bisect_left(self.arc_lengths, target_length)
        if high <= 0:
            return 0.0
        if high >= len(self.arc_lengths):
            return 1.0
        low = high - 1
        segment_length = self.arc_lengths[high] - self.arc_lengths[low]
        fraction = (
            0.0
            if segment_length == 0
            else (target_length - self.arc_lengths[low]) / segment_length
        )
        return (low + fraction) / (len(self.arc_lengths) - 1)

    def point_at(self, progress: float) -> Vector:
        return _catmull_rom_point(self.points, self.parameter_at(progress))

    def tangent_at(self, progress: float) -> Vector:
        parameter = self.parameter_at(progress)
        delta = 0.0001
        first = _catmull_rom_point(self.points, max(0.0, parameter - delta))
        second = _catmull_rom_point(self.points, min(1.0, parameter + delta))
        return (second - first).normalized()


def curve_material(
    name: str, color: tuple[float, float, float, float], metallic: float = 0.0
):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    material.metallic = metallic
    material.roughness = 0.32
    principled = next(
        node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"
    )
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Alpha"].default_value = color[3]
    metallic_input = principled.inputs.get(
        "Metallic IOR Level"
    ) or principled.inputs.get("Metallic")
    if metallic_input is not None:
        metallic_input.default_value = metallic
    principled.inputs["Roughness"].default_value = 0.32
    emission = principled.inputs.get("Emission Color") or principled.inputs.get(
        "Emission"
    )
    if emission is not None:
        emission.default_value = (*color[:3], 1)
    emission_strength = principled.inputs.get("Emission Strength")
    if emission_strength is not None:
        emission_strength.default_value = 0.28
    if color[3] < 1 and hasattr(material, "surface_render_method"):
        material.surface_render_method = "BLENDED"
        if hasattr(material, "use_transparency_overlap"):
            material.use_transparency_overlap = False
    return material


def add_path(
    name: str, points: Sequence[Sequence[float]], radius: float, color
) -> bpy.types.Object:
    curve_data = bpy.data.curves.new(name, "CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 4
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 4
    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for control, point in zip(spline.bezier_points, points, strict=True):
        control.co = desired_to_blender(point)
        control.handle_left_type = "AUTO"
        control.handle_right_type = "AUTO"
    object_ = bpy.data.objects.new(name, curve_data)
    curve_data.materials.append(curve_material(f"{name} material", color))
    bpy.context.collection.objects.link(object_)
    return object_


def add_runtime_path(
    name: str,
    points: Sequence[Sequence[float]],
    radius: float,
    color: tuple[float, float, float, float],
    end_progress: float = 1,
    start_progress: float = 0,
    reverse: bool = False,
) -> bpy.types.Object:
    """Render the arc-length-parametrized centripetal spline used by TubeGeometry."""
    curve = RuntimeCurve(points)
    bounded_start = max(0.0, min(1.0, start_progress))
    bounded_end = max(0.0, min(1.0, end_progress))
    if bounded_end <= bounded_start:
        raise ValueError("A runtime path segment needs end_progress > start_progress")
    span = bounded_end - bounded_start
    sample_count = max(24, math.ceil(len(points) * 3 * span))
    progresses = [
        bounded_start + span * index / sample_count
        for index in range(sample_count + 1)
    ]
    if reverse:
        progresses.reverse()
    sampled_points = [
        curve.point_at(progress) for progress in progresses
    ]
    curve_data = bpy.data.curves.new(name, "CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 1
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 4
    spline = curve_data.splines.new("POLY")
    spline.points.add(len(sampled_points) - 1)
    for control, point in zip(spline.points, sampled_points, strict=True):
        blender_point = desired_to_blender(point)
        control.co = (*blender_point, 1)
    object_ = bpy.data.objects.new(name, curve_data)
    curve_data.materials.append(curve_material(f"{name} material", color))
    bpy.context.collection.objects.link(object_)
    return object_


def add_marker(
    name: str,
    point: Sequence[float],
    radius: float,
    color: tuple[float, float, float, float],
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=24,
        ring_count=16,
        radius=radius,
        location=desired_to_blender(point),
    )
    marker = bpy.context.object
    marker.name = name
    marker.data.materials.append(
        curve_material(f"{name} material", color, metallic=0.12)
    )
    return marker


def assert_anchor_position(
    objects: Sequence[bpy.types.Object],
    anchor_name: str,
    expected: Sequence[float],
    tolerance: float | None = None,
) -> float:
    bpy.context.view_layer.update()
    anchor = next(
        (
            object_
            for object_ in objects
            if object_.name == anchor_name
            or object_.name.startswith(f"{anchor_name}.")
        ),
        None,
    )
    if anchor is None:
        raise RuntimeError(f"{anchor_name} is missing from the shipped device GLB")
    error = (anchor.matrix_world.translation - desired_to_blender(expected)).length
    allowed_error = (
        CT_RIG["provenance"]["webUnitsPerMm"] * IMPELLA_ANCHOR_TOLERANCE_MM
        if tolerance is None
        else tolerance
    )
    if error > allowed_error:
        raise RuntimeError(
            f"{anchor_name} misses its registered runtime position by {error:.5f} web units"
        )
    return error


def desired_follower_rotation(tangent: Vector) -> Matrix:
    """Match SplineFollower: local +Y is the device/cannula forward axis."""
    return (
        Vector((0, 1, 0)).rotation_difference(tangent.normalized()).to_matrix().to_4x4()
    )


def runtime_segment_length(
    curve: RuntimeCurve, start_progress: float, end_progress: float, samples: int = 512
) -> float:
    """Measure the rendered curve segment, including the runtime LUT's interpolation."""

    points = [
        curve.point_at(
            start_progress
            + (end_progress - start_progress) * sample_index / samples
        )
        for sample_index in range(samples + 1)
    ]
    return sum((current - previous).length for previous, current in zip(points, points[1:]))


def add_cannula_tip(
    name: str,
    points: Sequence[Sequence[float]],
    color: tuple[float, float, float, float],
    role: str,
    schematic_boundary: bool = False,
) -> None:
    curve = RuntimeCurve(points)
    endpoint = curve.point_at(1)
    tangent = curve.tangent_at(1)
    if schematic_boundary:
        blender_tangent = desired_to_blender(tangent).normalized()
        marker_rotation = (
            Vector((0, 0, 1)).rotation_difference(blender_tangent).to_euler()
        )
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.11,
            minor_radius=0.025,
            major_segments=28,
            minor_segments=10,
            location=desired_to_blender(endpoint),
            rotation=marker_rotation,
        )
        boundary_ring = bpy.context.object
        boundary_ring.name = f"{name}_SchematicBoundaryRing"
        boundary_ring.data.materials.append(
            curve_material(f"{name} boundary material", color, metallic=0.1)
        )
        bpy.ops.mesh.primitive_cone_add(
            vertices=18,
            radius1=0.075,
            radius2=0,
            depth=0.2,
            location=desired_to_blender(endpoint - tangent * 0.13),
            rotation=marker_rotation,
        )
        boundary_cone = bpy.context.object
        boundary_cone.name = f"{name}_SchematicBoundaryCone"
        boundary_cone.data.materials.append(
            curve_material(f"{name} cone material", color, metallic=0.1)
        )
        return

    radius = 0.105 if role == "drainage" else 0.088
    length = 0.34 if role == "drainage" else 0.29
    midpoint = endpoint - tangent * (length / 2)
    blender_tangent = desired_to_blender(tangent).normalized()
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=18,
        radius=radius,
        depth=length,
        location=desired_to_blender(midpoint),
    )
    body = bpy.context.object
    body.name = f"{name}_Body"
    body.data.materials.append(curve_material(f"{name} material", color, metallic=0.16))
    body.rotation_euler = (
        Vector((0, 0, 1)).rotation_difference(blender_tangent).to_euler()
    )

    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=20,
        ring_count=14,
        radius=radius * 0.92,
        location=desired_to_blender(endpoint),
    )
    tip = bpy.context.object
    tip.name = f"{name}_Tip"
    tip.data.materials.append(
        curve_material(f"{name} tip material", color, metallic=0.1)
    )


def set_balloon_morph(objects: list[bpy.types.Object], value: float) -> None:
    for object_ in objects:
        if object_.type == "MESH" and object_.data.shape_keys:
            key = object_.data.shape_keys.key_blocks.get("Inflated")
            if key is not None:
                key.value = value


def render(filename: str) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(OUTPUT_DIR / filename)
    bpy.ops.render.render(write_still=True)


def add_shared_heart(*, xray: bool = False) -> list[bpy.types.Object]:
    heart_objects = import_asset(RIG["assets"]["heart"])
    parent_with_transform(heart_objects, "HeartTransform", (0, 0, 0), (0, 0, 0), 1)
    if not xray:
        return heart_objects
    materials = {
        material
        for object_ in heart_objects
        if object_.type == "MESH"
        for material in object_.data.materials
        if material is not None
    }
    for material in materials:
        color = material.diffuse_color
        material.diffuse_color = (*color[:3], min(color[3], 0.11))
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "BLENDED"
        if hasattr(material, "use_transparency_overlap"):
            material.use_transparency_overlap = False
        if not material.use_nodes:
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
        base_color = principled.inputs["Base Color"].default_value
        base_color[3] = min(base_color[3], 0.11)
        principled.inputs["Alpha"].default_value = min(
            principled.inputs["Alpha"].default_value, 0.11
        )
    return heart_objects


def world_bvh(object_: bpy.types.Object) -> BVHTree:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = object_.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        vertices = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
        polygons = [tuple(polygon.vertices) for polygon in mesh.polygons]
        return BVHTree.FromPolygons(vertices, polygons, all_triangles=False)
    finally:
        evaluated.to_mesh_clear()


def assert_lvad_graft_clearance(
    heart_objects: Sequence[bpy.types.Object],
    route_points: Sequence[Sequence[float]],
    radius: float,
) -> dict[str, float]:
    """Numerically keep the visible graft outside the CT chambers and pulmonary artery."""

    structures = {
        "LV myocardium": "CT_LV_Myocardium",
        "RV": "CT_RV_Cavity",
        "RA": "CT_RA_Cavity",
        "pulmonary artery": "CT_PulmonaryArteries",
    }
    bpy.context.view_layer.update()
    route = RuntimeCurve(route_points)
    web_units_per_mm = CT_RIG["provenance"]["webUnitsPerMm"]
    minimum_edge_clearance_mm: dict[str, float] = {}
    for label, name_fragment in structures.items():
        meshes = [
            object_
            for object_ in heart_objects
            if object_.type == "MESH" and name_fragment in object_.name
        ]
        if not meshes:
            raise RuntimeError(f"LVAD clearance audit cannot find {name_fragment}")
        trees = [world_bvh(object_) for object_ in meshes]
        minimum_centerline_distance = math.inf
        for index in range(501):
            point = desired_to_blender(route.point_at(index / 500))
            for tree in trees:
                nearest = tree.find_nearest(point)
                if nearest is not None:
                    minimum_centerline_distance = min(
                        minimum_centerline_distance, nearest[3]
                    )
        edge_clearance = minimum_centerline_distance - radius
        edge_clearance_mm = edge_clearance / web_units_per_mm
        minimum_edge_clearance_mm[label] = edge_clearance_mm
        if edge_clearance_mm < 0.4:
            raise RuntimeError(
                f"LVAD graft approaches {label} within {edge_clearance_mm:.2f} mm"
            )
    return minimum_edge_clearance_mm


def place_impella_endpoint(
    *,
    variant: str,
    label: str,
    route: RuntimeCurve,
    progress: float,
    registration: dict,
    local_anchor_name: str,
    visible_nodes: Sequence[str],
) -> tuple[list[bpy.types.Object], Vector]:
    """Place one rigid endpoint assembly while the cannula remains route-following."""

    placement_point = route.point_at(progress)
    rotation = desired_follower_rotation(route.tangent_at(progress))
    scale = registration["modelScale"]
    local_anchor = Vector(registration[local_anchor_name])
    model_origin = placement_point - (rotation.to_3x3() @ local_anchor) * scale
    desired_matrix = (
        Matrix.Translation(model_origin) @ rotation @ Matrix.Scale(scale, 4)
    )
    objects = import_asset(registration["modelUrl"])
    show_only_mesh_fragments(objects, visible_nodes)
    make_impella_audit_visible(objects)
    parent_with_desired_matrix(objects, f"Impella_{variant}_{label}", desired_matrix)
    return objects, placement_point


def render_route_following_impella(
    variant: str, head_progress_key: str, filename: str, error_key: str
) -> None:
    """Mirror the runtime's two endpoint followers and CT-spline cannula."""

    contract = IMPELLA_VARIANTS[variant]
    route_record = CT_RIG[contract["route"]]
    route_points = route_record["points"]
    route_progress = route_record["progress"]
    registration = route_record["deviceRegistration"]
    head_progress = route_progress[head_progress_key]
    final_span = route_progress["correct"] - route_progress[contract["spanStart"]]
    trailing_progress = max(0.0, head_progress - final_span)

    clear_scene()
    configure_render()
    add_lighting()
    add_camera(RIG["cameras"]["heart"])
    add_shared_heart(xray=True)

    route = RuntimeCurve(route_points)
    head_nodes = contract["headNodes"]
    tip_deploy_end = contract.get("tipDeployEnd")
    if tip_deploy_end and head_progress < route_progress[tip_deploy_end]:
        head_nodes = tuple(
            node for node in head_nodes if node != "DistalPigtail"
        )
    head_objects, head_point = place_impella_endpoint(
        variant=variant,
        label="HeadFollower",
        route=route,
        progress=head_progress,
        registration=registration,
        local_anchor_name=contract["headAnchor"],
        visible_nodes=head_nodes,
    )
    cp_tip_scale = {
        "correct": 0.95,
        "deep": 0.8,
    }.get(head_progress_key, 1.0)
    if variant == "cp" and cp_tip_scale < 1.0:
        for object_ in head_objects:
            if "DistalPigtail" in object_.name:
                object_.scale *= cp_tip_scale
    trailing_objects, trailing_point = place_impella_endpoint(
        variant=variant,
        label="TrailingFollower",
        route=route,
        progress=trailing_progress,
        registration=registration,
        local_anchor_name=contract["trailingAnchor"],
        visible_nodes=contract["trailingNodes"],
    )

    if variant == "rp":
        inlet_point = trailing_point
        outlet_point = head_point
        inlet_error = assert_anchor_position(
            trailing_objects, contract["inletAnchor"], inlet_point
        )
        outlet_error = assert_anchor_position(
            head_objects, contract["outletAnchor"], outlet_point
        )
    else:
        inlet_point = head_point
        outlet_point = trailing_point
        inlet_error = assert_anchor_position(
            head_objects, contract["inletAnchor"], inlet_point
        )
        outlet_error = assert_anchor_position(
            trailing_objects, contract["outletAnchor"], outlet_point
        )

    units_per_mm = CT_RIG["provenance"]["webUnitsPerMm"]
    IMPELLA_ANCHOR_ERRORS[error_key] = {
        "inletMm": inlet_error / units_per_mm,
        "outletMm": outlet_error / units_per_mm,
        "flexibleCannulaCenterlineErrorMm": 0.0,
    }
    total_route_mm = runtime_segment_length(route, 0, 1) / units_per_mm
    route_span_mm = (
        runtime_segment_length(route, trailing_progress, head_progress) / units_per_mm
    )
    access_shaft_mm = (
        runtime_segment_length(route, 0, trailing_progress) / units_per_mm
        if trailing_progress > 0
        else 0.0
    )
    registered_span_mm = (
        (
            Vector(registration["inletLocal"])
            - Vector(registration["outletLocal"])
        ).length
        * registration["modelScale"]
        / units_per_mm
    )
    physical_reference_mm = contract["physicalReferenceMm"]
    physical_delta_mm = route_span_mm - physical_reference_mm
    deformation_percent = physical_delta_mm / physical_reference_mm * 100
    # The RP outlet is staged within PA0 so the CT-route arc agrees with the generated
    # facsimile's registered 205 mm inlet-to-outlet span while preserving the IVC inlet.
    if abs(deformation_percent) > 2:
        raise RuntimeError(
            f"Impella {variant} CT-fit deformation is {deformation_percent:.2f}%, "
            "outside the bounded 2% audit allowance"
        )
    IMPELLA_ROUTE_MEASUREMENTS[error_key] = {
        "headProgress": head_progress,
        "trailingProgress": trailing_progress,
        "accessShaftMm": access_shaft_mm,
        "flexibleCannulaMm": route_span_mm,
        "registeredAnchorSpanMm": registered_span_mm,
        "physicalReferenceMm": physical_reference_mm,
        "physicalReferenceKind": contract["physicalReferenceKind"],
        "patientSpecificCtFitDeltaMm": physical_delta_mm,
        "patientSpecificCtFitDeformationPercent": deformation_percent,
        "ctFitLimitPercent": 2,
    }

    if trailing_progress > 0:
        add_runtime_path(
            f"Impella_{variant}_DarkAccessShaft",
            route_points,
            contract["shaftRadius"],
            (0.0185, 0.042311, 0.074214, 1),
            end_progress=trailing_progress,
        )
    if variant == "55":
        add_runtime_path(
            "Impella_55_SyntheticSurgicalAccessConduit",
            route_points,
            0.13,
            (0.58, 0.33, 0.23, 0.34),
            end_progress=route_progress["surgicalAccessEnd"],
        )
    if head_progress_key == "aorticRoot":
        add_runtime_path(
            f"Impella_{variant}_Guidewire",
            route_points,
            0.012,
            (0.82, 0.9, 0.87, 1),
            start_progress=head_progress,
            end_progress=min(1.0, head_progress + 0.022),
        )
    add_runtime_path(
        f"Impella_{variant}_BlueCannula",
        route_points,
        contract["cannulaRadius"],
        contract["cannulaColor"],
        start_progress=trailing_progress,
        end_progress=head_progress,
    )
    add_marker(
        f"Impella_{variant}_RegisteredInlet",
        inlet_point,
        0.035,
        (1.0, 0.75, 0.16, 1),
    )
    add_marker(
        f"Impella_{variant}_RegisteredOutlet",
        outlet_point,
        0.03,
        (0.36, 0.88, 0.94, 1),
    )
    render(filename)


def render_impella(pose: str) -> None:
    render_route_following_impella(
        "cp", IMPELLA_POSES[pose], f"impella-{pose}.png", pose
    )


def render_impella_variant_in_heart(variant: str) -> None:
    render_route_following_impella(
        variant, "correct", f"impella-{variant}-in-heart.png", f"{variant}-correct"
    )


def render_isolated_impella(variant: str) -> None:
    contract = IMPELLA_VARIANTS[variant]
    registration = CT_RIG[contract["route"]]["deviceRegistration"]
    clear_scene()
    configure_render()
    add_lighting()
    device = import_asset(registration["modelUrl"])
    add_isolated_camera(device)
    render(f"impella-{variant}-isolated.png")


def render_lvad() -> None:
    clear_scene()
    configure_render()
    add_lighting()
    base_camera = RIG["cameras"]["heart"]
    camera_target = Vector(base_camera["target"]) + Vector((0, -0.95, 0))
    camera_offset = Vector(base_camera["position"]) - Vector(base_camera["target"])
    lvad_camera = {
        **base_camera,
        "target": tuple(camera_target),
        "position": tuple(camera_target + camera_offset * 1.35),
    }
    add_camera(lvad_camera)
    heart_objects = add_shared_heart(xray=True)
    LVAD_GRAFT_CLEARANCE_MM.clear()
    LVAD_GRAFT_CLEARANCE_MM.update(
        assert_lvad_graft_clearance(
            heart_objects,
            RIG["lvad"]["outflowRoute"][:-1],
            0.105,
        )
    )
    registration = RIG["lvad"]["modelRegistration"]
    outward_axis = Vector(registration["outwardAxis"]).normalized()
    model_outward_axis = Vector(registration["modelOutwardAxisLocal"]).normalized()
    rotation = model_outward_axis.rotation_difference(outward_axis).to_matrix().to_4x4()
    scale = registration["scale"]
    local_anchor = Vector(registration["modelAnchorLocal"])
    model_origin = Vector(registration["apicalCuffWorld"]) - (
        rotation.to_3x3() @ local_anchor
    ) * scale
    desired_matrix = Matrix.Translation(model_origin) @ rotation @ Matrix.Scale(scale, 4)
    device = import_asset(RIG["assets"]["lvad"])
    parent_with_desired_matrix(device, "LVADPlacement", desired_matrix)
    assert_anchor_position(
        device,
        "Anchor_LVAD_ApicalCuff",
        registration["apicalCuffWorld"],
        tolerance=0.002,
    )
    assert_anchor_position(
        device,
        "Anchor_LVAD_PumpOutlet",
        RIG["lvad"]["outflowRoute"][0],
        tolerance=0.004,
    )
    add_runtime_path(
        "LVADOutflow",
        RIG["lvad"]["outflowRoute"][:-1],
        0.105,
        (0.46, 0.52, 0.51, 1),
    )
    add_marker(
        "LVADAorticAnastomosis",
        RIG["lvad"]["ctRegistration"]["aorticSurfaceAnastomosis"],
        0.12,
        (0.72, 0.76, 0.73, 1),
    )
    render("lvad.png")


def render_isolated_lvad_candidates() -> None:
    rotations = (
        ("native", (0, 0, 0)),
        ("face-x", (math.pi / 2, 0, 0)),
        ("face-y", (0, math.pi / 2, 0)),
        ("face-z", (0, 0, math.pi / 2)),
    )
    for label, rotation in rotations:
        clear_scene()
        configure_render()
        add_lighting()
        add_camera(RIG["cameras"]["preview"])
        device = import_asset(RIG["assets"]["lvad"])
        parent_with_transform(device, "LVADCandidate", (0, 0, 0), rotation, 1.35)
        render(f"lvad-isolated-{label}.png")


def render_heart_lvad_candidates() -> None:
    candidates = (
        ("native", (0.64, -0.94, 0.68), (0, 0, 0), 0.62),
        ("flip", (0.64, -0.94, 0.68), (0, 0, math.pi), 0.62),
        ("tilt", (0.64, -0.94, 0.68), (0, 0, -0.55), 0.62),
        ("current", (0.78, -1.08, 0.67), (math.pi / 2, 0, -0.35), 0.72),
    )
    for label, position, rotation, scale in candidates:
        clear_scene()
        configure_render()
        add_lighting()
        add_camera(RIG["cameras"]["heart"])
        add_shared_heart()
        device = import_asset(RIG["assets"]["lvad"])
        parent_with_transform(device, "LVADHeartCandidate", position, rotation, scale)
        render(f"lvad-heart-{label}.png")


def render_lvad_source_components() -> None:
    clear_scene()
    configure_render()
    add_lighting()
    add_camera(RIG["cameras"]["preview"])
    source_path = ROOT / "3D assets" / "Cardiac" / "Devices" / "LVAD.glb"
    bpy.ops.import_scene.gltf(filepath=str(source_path))
    meshes = [
        object_ for object_ in bpy.context.scene.objects if object_.type == "MESH"
    ]
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
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    components = sorted(
        [object_ for object_ in bpy.context.selected_objects if object_.type == "MESH"],
        key=lambda object_: len(object_.data.polygons),
        reverse=True,
    )
    corners = [
        object_.matrix_world @ Vector(corner)
        for object_ in components
        for corner in object_.bound_box
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
    scale = 2 / max(maximum.x - minimum.x, maximum.y - minimum.y, maximum.z - minimum.z)
    root = bpy.data.objects.new("LVADSourceComponents", None)
    bpy.context.collection.objects.link(root)
    colors = (
        (0.85, 0.2, 0.22, 1),
        (0.15, 0.65, 0.82, 1),
        (0.2, 0.75, 0.38, 1),
        (0.85, 0.66, 0.18, 1),
    )
    for index, component in enumerate(components):
        component.name = f"LVAD_Component_{index}_{len(component.data.polygons)}tri"
        component.data.materials.clear()
        component.data.materials.append(
            curve_material(component.name, colors[index % len(colors)])
        )
        world = component.matrix_world.copy()
        component.parent = root
        component.matrix_world = world
    root.scale = (scale, scale, scale)
    root.location = -center * scale
    render("lvad-source-components.png")
    for index, component in enumerate(components):
        for candidate in components:
            candidate.hide_render = candidate != component
        render(f"lvad-source-component-{index}.png")


def render_pac(position: str) -> None:
    clear_scene()
    configure_render()
    add_lighting()
    add_camera(RIG["cameras"]["heart"])
    add_shared_heart()
    route = CT_RIG["pac"]["points"]
    progress = CT_RIG["pac"]["progress"][position]
    add_runtime_path(
        "PAC",
        route,
        RIG["pac"]["radius"],
        (0.92, 0.69, 0.18, 1),
        end_progress=progress,
    )
    endpoint = RuntimeCurve(route).point_at(progress)
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=24,
        ring_count=16,
        radius=RIG["pac"]["balloonRadius"][
            "inflated" if position == "wedge" else "deflated"
        ],
        location=desired_to_blender(endpoint),
    )
    balloon = bpy.context.object
    balloon.name = f"PAC_{position}_Balloon"
    balloon.data.materials.append(
        curve_material("PAC balloon", (0.78, 0.72, 0.48, 0.7))
    )
    render(f"pac-{position}.png")


def render_ecmo(mode: str) -> None:
    clear_scene()
    configure_render()
    add_lighting()
    # A wider audit view includes the inferior schematic VA boundary that lies below CT coverage.
    add_camera(
        {
            "position": [4.8, 0, 9.4],
            "target": [-0.2, -0.65, -0.45],
            "fov": 35,
        }
    )
    add_shared_heart()
    routes = CT_RIG["ecmo"][mode]
    drainage = routes["femoralVenousDrainage"]["points"]
    return_route = (
        routes["jugularVenousReturn"]["points"]
        if mode == "vv"
        else routes["femoralArterialReturn"]["points"]
    )
    drainage_color = (0.435, 0.612, 1.0, 1)
    return_color = (
        (0.431, 0.906, 0.878, 1) if mode == "vv" else (1.0, 0.502, 0.435, 0.72)
    )
    add_runtime_path("ECMO_Drainage", drainage, 0.092, drainage_color)
    add_runtime_path(
        "ECMO_VenousReturn" if mode == "vv" else "ECMO_SchematicArterialBoundaryRoute",
        return_route,
        0.076 if mode == "vv" else 0.045,
        return_color,
    )
    add_cannula_tip("ECMO_DrainageTip", drainage, drainage_color, "drainage")
    add_cannula_tip(
        "ECMO_ReturnTip" if mode == "vv" else "ECMO_ArterialBoundary",
        return_route,
        return_color,
        "return",
        schematic_boundary=mode == "va",
    )
    if mode == "va":
        add_runtime_path(
            "ECMO_RetrogradeAorticFlow",
            routes["retrogradeAorticFlow"]["points"],
            0.014,
            (1.0, 0.545, 0.471, 1),
        )
    render(f"ecmo-{mode}.png")


def render_iabp(inflated: bool) -> None:
    clear_scene()
    configure_render()
    add_lighting()
    add_camera(RIG["cameras"]["iabp"])
    import_asset(RIG["assets"]["iabpAorta"])
    add_path(
        "IABP_CatheterRoute", RIG["iabp"]["catheterRoute"], 0.014, (0.76, 0.8, 0.8, 1)
    )
    balloon_objects = import_asset(RIG["assets"]["iabpBalloon"])
    set_balloon_morph(balloon_objects, 1 if inflated else 0)
    parent_with_transform(
        balloon_objects,
        "IABPPlacement",
        RIG["iabp"]["balloonCenter"],
        RIG["iabp"]["balloonRotation"],
        RIG["iabp"]["balloonScale"],
    )
    render(f"iabp-{'inflated' if inflated else 'deflated'}.png")


def validate_runtime_inputs() -> None:
    if CT_RIG.get("schemaVersion") != 3:
        raise RuntimeError("The runtime audit requires cardiac-ct-rig schema version 3")
    if RIG["assets"]["heart"] != "/models/cardiac/heart-ct-animated-v1.glb":
        raise RuntimeError("The shared runtime rig is not using the CT heart")

    expected_assets = {
        "impella": RIG["assets"]["impellaCp"],
        "impella55": RIG["assets"]["impella55"],
        "impellaRp": RIG["assets"]["impellaRp"],
    }
    for route_name, expected_asset in expected_assets.items():
        registration = CT_RIG[route_name]["deviceRegistration"]
        if registration["modelUrl"] != expected_asset:
            raise RuntimeError(
                f"{route_name} CT registration and runtime asset URLs disagree"
            )
        if registration["localForwardAxis"] != "+Y":
            raise RuntimeError(
                "The Blender audit currently supports the runtime +Y device-forward axis"
            )
    impella_progress = CT_RIG["impella"]["progress"]
    ordered_progress = [
        impella_progress[name]
        for name in ("aorticRoot", "aorticValve", "tooShallow", "correct", "deep")
    ]
    if ordered_progress != sorted(ordered_progress) or len(
        set(ordered_progress)
    ) != len(ordered_progress):
        raise RuntimeError("Impella route landmarks are not strictly ordered")

    impella_55_progress = CT_RIG["impella55"]["progress"]
    ordered_55_progress = [
        impella_55_progress[name]
        for name in (
            "access",
            "aorticRoot",
            "aorticValve",
            "tooShallow",
            "shallow",
            "correct",
            "deep",
        )
    ]
    if ordered_55_progress != sorted(ordered_55_progress) or len(
        set(ordered_55_progress)
    ) != len(ordered_55_progress):
        raise RuntimeError("Impella 5.5 route landmarks are not strictly ordered")

    impella_rp_progress = CT_RIG["impellaRp"]["progress"]
    ordered_rp_progress = [
        impella_rp_progress[name]
        for name in (
            "access",
            "ivcInlet",
            "tricuspidGate",
            "rv",
            "pulmonicGate",
            "tooProximal",
            "correct",
            "tooDistal",
        )
    ]
    if ordered_rp_progress != sorted(ordered_rp_progress) or len(
        set(ordered_rp_progress)
    ) != len(ordered_rp_progress):
        raise RuntimeError("Impella RP route landmarks are not strictly ordered")

    pac_progress = CT_RIG["pac"]["progress"]
    if pac_progress["pa"] != pac_progress["wedge"]:
        raise RuntimeError(
            "PAWP capture must not imply automatic distal catheter advancement"
        )

    ecmo = CT_RIG["ecmo"]
    required_routes = (
        ecmo["vv"]["femoralVenousDrainage"],
        ecmo["vv"]["jugularVenousReturn"],
        ecmo["va"]["femoralVenousDrainage"],
        ecmo["va"]["femoralArterialReturn"],
        ecmo["va"]["retrogradeAorticFlow"],
    )
    if any(len(route["points"]) < 2 for route in required_routes):
        raise RuntimeError("One or more ECMO audit routes have fewer than two points")
    if not CT_RIG["provenance"].get("authoredPeripheralExtension"):
        raise RuntimeError(
            "VA arterial route is missing its schematic-extension provenance"
        )
    rp_outlet_registration = CT_RIG["provenance"].get(
        "impellaRpOutletRegistration", {}
    )
    if (
        rp_outlet_registration.get("inletSourceControlPointIndex") != 0
        or rp_outlet_registration.get("inletProgress")
        != impella_rp_progress["ivcInlet"]
        or rp_outlet_registration.get("correctInletToOutletArcMm") != 205
        or rp_outlet_registration.get("correctOutletControlPointBracket") != [26, 27]
        or rp_outlet_registration.get("rawSource205MmReference", {}).get(
            "controlPointBracket"
        )
        != [16, 17]
    ):
        raise RuntimeError("Impella RP audit requires the validated 205 mm PA0 outlet")


def parse_script_arguments() -> argparse.Namespace:
    script_arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--only",
        nargs="+",
        choices=RUNTIME_SCENES,
        default=list(RUNTIME_SCENES),
        help="Render only the selected runtime scene families.",
    )
    return parser.parse_args(script_arguments)


def write_audit_manifest(scene_families: Sequence[str], frames: Sequence[str]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "schemaVersion": 1,
        "generatedBy": "scripts/cardiac-assets/render-runtime-audit.py",
        "ctRigSchemaVersion": CT_RIG["schemaVersion"],
        "sceneFamilies": list(scene_families),
        "frames": list(frames),
        "impella": {
            "inHeartRepresentation": "fixed-length split endpoint followers with a CT-spline cannula, route-following guidewire, and post-arrival pigtail deployment",
            "spanPolicy": "head and trailing anchors retain the correct-placement inlet-to-outlet arc span in every placement state",
            "tipPolicy": "pigtails remain constrained during advancement and deploy only after the selected endpoint is reached",
            "contactLimitedCpTipScales": {
                "correct": 0.95,
                "deep": 0.8,
            },
            "rpOutletRegistration": CT_RIG["provenance"][
                "impellaRpOutletRegistration"
            ],
            "variants": {
                "cp": {
                    "progress": CT_RIG["impella"]["progress"],
                    "deviceRegistration": CT_RIG["impella"]["deviceRegistration"],
                },
                "55": {
                    "progress": CT_RIG["impella55"]["progress"],
                    "deviceRegistration": CT_RIG["impella55"][
                        "deviceRegistration"
                    ],
                },
                "rp": {
                    "progress": CT_RIG["impellaRp"]["progress"],
                    "deviceRegistration": CT_RIG["impellaRp"][
                        "deviceRegistration"
                    ],
                },
            },
            "anchorToleranceMm": IMPELLA_ANCHOR_TOLERANCE_MM,
            "measuredAnchorErrorMm": IMPELLA_ANCHOR_ERRORS,
            "measuredRouteFollowing": IMPELLA_ROUTE_MEASUREMENTS,
        },
        "impellaProvenance": {
            "authoredImpella55Access": CT_RIG["provenance"][
                "authoredImpella55Access"
            ],
            "impellaRpValveGates": CT_RIG["provenance"]["impellaRpValveGates"],
            "impellaRpOutletRegistration": CT_RIG["provenance"][
                "impellaRpOutletRegistration"
            ],
        },
        "lvad": {
            "visibleGraftStopsAtAorticSurface": True,
            "graftRadiusWebUnits": 0.105,
            "minimumTubeEdgeClearanceMm": LVAD_GRAFT_CLEARANCE_MM,
        },
        "ecmoProvenance": {
            "authoredPeripheralExtension": CT_RIG["provenance"][
                "authoredPeripheralExtension"
            ],
            "authoredRightAtrialReturnEndpoint": CT_RIG["provenance"][
                "authoredRightAtrialReturnEndpoint"
            ],
        },
        "valveMorphology": CT_RIG["provenance"]["valveMorphology"],
    }
    (OUTPUT_DIR / "audit-manifest.json").write_text(
        f"{json.dumps(manifest, indent=2)}\n"
    )


def main() -> None:
    arguments = parse_script_arguments()
    selected = set(arguments.only)
    validate_runtime_inputs()
    frames: list[str] = []
    if "impella" in selected:
        for pose in IMPELLA_POSES:
            render_impella(pose)
            frames.append(f"impella-{pose}.png")
        for variant in IMPELLA_VARIANTS:
            render_isolated_impella(variant)
            frames.append(f"impella-{variant}-isolated.png")
        for variant in ("55", "rp"):
            render_impella_variant_in_heart(variant)
            frames.append(f"impella-{variant}-in-heart.png")
    if "iabp" in selected:
        render_iabp(False)
        render_iabp(True)
        frames.extend(("iabp-deflated.png", "iabp-inflated.png"))
    if "lvad" in selected:
        render_lvad()
        frames.append("lvad.png")
    if "pac" in selected:
        for position in ("introducer", "ra", "rv", "pa", "wedge"):
            render_pac(position)
            frames.append(f"pac-{position}.png")
    if "ecmo" in selected:
        for mode in ("vv", "va"):
            render_ecmo(mode)
            frames.append(f"ecmo-{mode}.png")
    write_audit_manifest(arguments.only, frames)
    print(f"Rendered {len(frames)} cardiac visual-audit frames to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
