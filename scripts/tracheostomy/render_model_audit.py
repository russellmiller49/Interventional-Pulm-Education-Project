"""Render orthographic audit views for tracheostomy GLB assets with Blender.

Run with:
  blender --background --python scripts/tracheostomy/render_model_audit.py -- \
    "3D assets/Tracheostomy" /tmp/tracheostomy-model-audit
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


VIEW_DIRECTIONS = {
    "iso": Vector((1.25, -1.45, 0.9)),
    "front": Vector((0.0, -1.0, 0.0)),
    "side": Vector((1.0, 0.0, 0.0)),
    "top": Vector((0.0, 0.0, 1.0)),
}


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(collection):
            if datablock.users == 0:
                collection.remove(datablock)


def scene_bounds() -> tuple[Vector, Vector]:
    points: list[Vector] = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise RuntimeError("Imported asset has no mesh objects")
    minimum = Vector(tuple(min(point[i] for point in points) for i in range(3)))
    maximum = Vector(tuple(max(point[i] for point in points) for i in range(3)))
    return minimum, maximum


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area_light(name: str, location: Vector, target: Vector, energy: float, size: float) -> None:
    data = bpy.data.lights.new(name=name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name=name, object_data=data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    point_at(obj, target)


def configure_scene(center: Vector, max_dimension: float) -> bpy.types.Object:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"

    world = bpy.data.worlds.new("Audit world") if not scene.world else scene.world
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.006, 0.012, 0.03, 1.0)
    background.inputs["Strength"].default_value = 0.3

    add_area_light(
        "Key",
        center + Vector((1.7, -1.5, 1.8)) * max_dimension,
        center,
        1300.0,
        max_dimension,
    )
    add_area_light(
        "Fill",
        center + Vector((-1.5, -0.5, 0.6)) * max_dimension,
        center,
        850.0,
        max_dimension * 1.2,
    )
    add_area_light(
        "Rim",
        center + Vector((0.0, 1.8, 1.2)) * max_dimension,
        center,
        1050.0,
        max_dimension,
    )

    camera_data = bpy.data.cameras.new("Audit camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = max_dimension * 1.22
    camera_data.lens = 55
    camera_data.clip_start = max(max_dimension * 0.001, 0.0001)
    camera_data.clip_end = max_dimension * 20
    camera = bpy.data.objects.new("Audit camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    return camera


def render_asset(source: Path, output_dir: Path) -> None:
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(source))
    minimum, maximum = scene_bounds()
    center = (minimum + maximum) * 0.5
    dimensions = maximum - minimum
    max_dimension = max(dimensions)
    camera = configure_scene(center, max_dimension)

    for label, raw_direction in VIEW_DIRECTIONS.items():
        direction = raw_direction.normalized()
        camera.location = center + direction * max_dimension * 3.0
        point_at(camera, center)
        bpy.context.scene.render.filepath = str(output_dir / f"{source.stem}--{label}.png")
        bpy.ops.render.render(write_still=True)

    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    triangles = sum(
        len(poly.vertices) - 2 for obj in mesh_objects for poly in obj.data.polygons
    )
    print(
        f"AUDIT_RENDER {source.name}: meshes={len(mesh_objects)} "
        f"triangles={triangles} dimensions={tuple(round(v, 4) for v in dimensions)}"
    )


def main() -> None:
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(args) != 2:
        raise SystemExit("Expected source directory and output directory")
    source_dir = Path(args[0]).resolve()
    output_dir = Path(args[1]).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    for source in sorted(source_dir.glob("*.glb")):
        render_asset(source, output_dir)


if __name__ == "__main__":
    main()
