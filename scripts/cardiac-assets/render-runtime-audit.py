#!/usr/bin/env python3
"""Render deterministic visual-audit frames from the shipped cardiac GLBs and rig."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Sequence

import bpy
from mathutils import Euler, Matrix, Vector


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = Path("/tmp/cardiac-runtime-audit")
RIG = json.loads(
    (ROOT / "src" / "features" / "cardiac-anatomy" / "content" / "cardiac-rig.json").read_text()
)


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
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.angle = math.radians(preset["fov"])
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera


def import_asset(url: str) -> list[bpy.types.Object]:
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / "public" / url.removeprefix("/")))
    return [object_ for object_ in bpy.context.scene.objects if object_ not in before]


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
    blender_rotation = COORDINATE_CONVERSION @ desired_rotation @ COORDINATE_CONVERSION.inverted()
    transform = Matrix.Translation(desired_to_blender(position)) @ blender_rotation @ Matrix.Scale(scale, 4)
    root.matrix_world = transform
    return root


def curve_material(name: str, color: tuple[float, float, float, float], metallic: float = 0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.metallic = metallic
    material.roughness = 0.32
    return material


def add_path(name: str, points: Sequence[Sequence[float]], radius: float, color) -> bpy.types.Object:
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


def add_shared_heart() -> None:
    heart_objects = import_asset(RIG["assets"]["heart"])
    parent_with_transform(heart_objects, "HeartTransform", (0, -1.42, -0.08), (0, 0, 0), 1.05)
    import_asset(RIG["assets"]["heartGreatVessels"])


def render_impella(pose: str) -> None:
    clear_scene()
    configure_render()
    add_lighting()
    add_camera(RIG["cameras"]["heart"])
    add_shared_heart()
    transform = RIG["impella"]["modelTransform"]
    offset = RIG["impella"]["positionOffsets"][pose]
    position = [
        transform["position"][index] + offset[index]
        for index in range(3)
    ]
    device = import_asset(RIG["assets"]["impellaCp"])
    parent_with_transform(
        device,
        "ImpellaPlacement",
        position,
        transform["rotation"],
        transform["scale"],
    )
    add_path("ImpellaShaft", RIG["impella"]["shaftRoute"], 0.012, (0.72, 0.78, 0.79, 1))
    render(f"impella-{pose}.png")


def render_lvad() -> None:
    clear_scene()
    configure_render()
    add_lighting()
    add_camera(RIG["cameras"]["heart"])
    add_shared_heart()
    transform = RIG["lvad"]["modelTransform"]
    device = import_asset(RIG["assets"]["lvad"])
    parent_with_transform(
        device,
        "LVADPlacement",
        transform["position"],
        transform["rotation"],
        transform["scale"],
    )
    add_path("LVADInflow", RIG["lvad"]["inflowRoute"], 0.05, (0.65, 0.7, 0.7, 1))
    add_path("LVADOutflow", RIG["lvad"]["outflowRoute"], 0.045, (0.65, 0.7, 0.7, 1))
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
    meshes = [object_ for object_ in bpy.context.scene.objects if object_.type == "MESH"]
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
    corners = [object_.matrix_world @ Vector(corner) for object_ in components for corner in object_.bound_box]
    minimum = Vector((min(point.x for point in corners), min(point.y for point in corners), min(point.z for point in corners)))
    maximum = Vector((max(point.x for point in corners), max(point.y for point in corners), max(point.z for point in corners)))
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
        component.data.materials.append(curve_material(component.name, colors[index % len(colors)]))
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
    endpoint_index = RIG["pac"]["endpointIndex"][position]
    route = RIG["pac"]["route"][: endpoint_index + 1]
    add_path("PAC", route, RIG["pac"]["radius"], (0.92, 0.69, 0.18, 1))
    endpoint = route[-1]
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
    balloon.data.materials.append(curve_material("PAC balloon", (0.78, 0.72, 0.48, 0.7)))
    render(f"pac-{position}.png")


def render_iabp(inflated: bool) -> None:
    clear_scene()
    configure_render()
    add_lighting()
    add_camera(RIG["cameras"]["iabp"])
    import_asset(RIG["assets"]["iabpAorta"])
    add_path("IABP_CatheterRoute", RIG["iabp"]["catheterRoute"], 0.014, (0.76, 0.8, 0.8, 1))
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


def main() -> None:
    for pose in ("correct", "too-deep", "too-shallow"):
        render_impella(pose)
    render_iabp(False)
    render_iabp(True)
    render_lvad()
    for position in ("introducer", "ra", "rv", "pa", "wedge"):
        render_pac(position)
    print(f"Rendered cardiac visual audit to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
