"""Render previews of the device kit, and renders seen through the reference frames' cameras.

Run with Blender 5.1, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \\
        --python scripts/medical-thoracoscopy/render_device_previews.py -- [--parts id,id] [--matched]

Overview renders show each part alone from three sides. With `--matched`, the telescope (and the
sleeve and forceps on it) is also rendered through the camera that `measure_reference_frames.py`
fitted to frames 2, 7 and 13, at the frame's own size, so `compose_reference_comparisons.py` can
lay the model over the frame. The distal face is rendered head-on, at a fixed scale, for frame 3.

Everything is written to the owner's local data. The previews contain no manufacturer image; the
comparison sheets made from them do, and stay there.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))
from local_data import local_data_path  # noqa: E402

DEVICES_DIR = ("raw-assets", "medical-thoracoscopy", "devices")
FULL_RECORD = ("raw-assets", "medical-thoracoscopy", "measurements", "reference-measurements-full.json")


def clear() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("world")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.9, 0.9, 0.92, 1.0)
    background.inputs["Strength"].default_value = 0.8
    scene.world = world


def import_part(name: str, matrix: Matrix | None = None):
    path = local_data_path(*DEVICES_DIR, "raw", f"{name}.glb")
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [obj for obj in bpy.context.scene.objects if obj not in before]
    roots = [obj for obj in new if obj.parent is None]
    # The files hold the device frame as is (exported with export_yup=False); the importer converts
    # Y-up to Z-up by default, so undo that to get the device frame back.
    for obj in roots:
        obj.matrix_world = (matrix or Matrix.Identity(4)) @ Matrix.Rotation(-math.pi / 2, 4, "X") @ obj.matrix_world
    bpy.context.view_layer.update()
    return new


def lights(target: Vector, size: float) -> None:
    for name, direction, energy in (("key", (-0.4, 0.7, -0.6), 3.5), ("fill", (0.8, 0.3, -0.5), 1.4),
                                    ("rim", (0.1, -0.8, 0.6), 2.0)):
        light = bpy.data.lights.new(name, "SUN")
        light.energy = energy
        obj = bpy.data.objects.new(name, light)
        obj.rotation_euler = Vector(direction).to_track_quat("-Z", "Y").to_euler()
        bpy.context.scene.collection.objects.link(obj)


def ortho_camera(position: Vector, target: Vector, up: Vector, scale: float, width: int, height: int):
    camera = bpy.data.cameras.new("camera")
    camera.type = "ORTHO"
    camera.ortho_scale = scale
    camera.clip_start = 0.1
    camera.clip_end = 5000.0
    obj = bpy.data.objects.new("camera", camera)
    forward = (target - position).normalized()
    obj.matrix_world = Matrix.Translation(position) @ look_rotation(forward, up).to_4x4()
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.scene.camera = obj
    bpy.context.scene.render.resolution_x = width
    bpy.context.scene.render.resolution_y = height
    return obj


def look_rotation(forward: Vector, up: Vector) -> Matrix:
    z = -forward.normalized()
    x = up.cross(z).normalized()
    y = z.cross(x)
    return Matrix((x, y, z)).transposed()


def render(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def bounds(objects) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for obj in objects if obj.type == "MESH" for corner in obj.bound_box]
    low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return low, high


def overview(name: str) -> None:
    clear()
    objects = import_part(name)
    low, high = bounds(objects)
    centre = (low + high) / 2
    extent = max((high - low).length, 1.0)
    print(f"{name}: bounds {tuple(round(v, 1) for v in low)} to {tuple(round(v, 1) for v in high)}")
    lights(centre, extent)
    out = local_data_path(*DEVICES_DIR, "previews")
    views = {
        "side": (Vector((-1.0, 0.0, 0.0)), Vector((0.0, 1.0, 0.0))),
        "top": (Vector((0.0, 1.0, 0.0)), Vector((-1.0, 0.0, 0.0))),
        "three-quarter": (Vector((-0.8, 0.45, -0.4)).normalized(), Vector((0.0, 1.0, 0.0))),
    }
    for view, (direction, up) in views.items():
        ortho_camera(centre + direction * extent * 2, centre, up, extent * 1.08, 1800, 900)
        render(out / f"{name}.{view}.png")
    # The working end, close up: the first 24 mm of the part, from the side and three-quarter.
    tip = Vector((0.0, 0.0, low.z + 10.0))
    for view, (direction, up) in (("tip-side", views["side"]), ("tip-three-quarter", views["three-quarter"])):
        ortho_camera(tip + direction * 200.0, tip, up, 26.0, 1200, 900)
        render(out / f"{name}.{view}.png")


def device_pose(pose: dict) -> Matrix:
    """World matrix placing the device frame as the fitted camera saw it. The fitted camera has x
    right, y down and z forward; Blender's camera looks along -Z with +Y up."""
    def c(v):
        return Vector((v[0], -v[1], -v[2]))
    z_axis = c(pose["axis"]).normalized()
    y_axis = c(pose["up"]).normalized()
    x_axis = y_axis.cross(z_axis).normalized()
    y_axis = z_axis.cross(x_axis)
    rotation = Matrix((x_axis, y_axis, z_axis)).transposed().to_4x4()
    return Matrix.Translation(c(pose["tipMm"])) @ rotation


def pinhole(camera_fit: dict, width: int, height: int) -> None:
    camera = bpy.data.cameras.new("fitted")
    camera.sensor_fit = "HORIZONTAL"
    camera.sensor_width = 36.0
    camera.lens = camera_fit["focalPx"] * 36.0 / width
    cx, cy = camera_fit["principalPointPx"]
    larger = max(width, height)
    camera.shift_x = (width / 2 - cx) / larger
    camera.shift_y = (cy - height / 2) / larger
    camera.clip_start = 1.0
    camera.clip_end = 5000.0
    obj = bpy.data.objects.new("fitted", camera)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.scene.camera = obj
    bpy.context.scene.render.resolution_x = width
    bpy.context.scene.render.resolution_y = height


def matched() -> None:
    record = json.loads(local_data_path(*FULL_RECORD).read_text())
    frames = {entry["frame"]: entry for entry in json.loads(
        (REPO / "src/features/medical-thoracoscopy/content/data/reference-measurements.json").read_text())["frames"]}
    out = local_data_path(*DEVICES_DIR, "previews")

    side = record["frame2"]["nominal"]
    clear()
    world = device_pose(side["pose"])
    import_part("operative-telescope", world)
    lights(Vector((0.0, 0.0, -500.0)), 300.0)
    pinhole(side["camera"], frames[2]["widthPx"], frames[2]["heightPx"])
    render(out / "matched.frame2.png")

    sleeve_fit = record["frame13"]["nominal"]
    clear()
    world = device_pose(sleeve_fit["pose"])
    import_part("operative-telescope", world)
    offset = Matrix.Translation(Vector((0.0, 0.0, sleeve_fit["tubeDistalEndAt"])))
    import_part("trocar-sleeve-flexible", world @ offset)
    lights(Vector((0.0, 0.0, -500.0)), 300.0)
    pinhole(sleeve_fit["camera"], frames[13]["widthPx"], frames[13]["heightPx"])
    render(out / "matched.frame13.png")

    # The distal face, head-on at 200 px per millimetre, optic up.
    clear()
    import_part("operative-telescope")
    lights(Vector((0.0, 0.0, 0.0)), 10.0)
    ortho_camera(Vector((0.0, 0.0, -40.0)), Vector((0.0, 0.0, 0.0)), Vector((0.0, 1.0, 0.0)), 6.0, 1200, 1200)
    render(out / "matched.frame3.png")


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--parts", default="")
    parser.add_argument("--matched", action="store_true")
    args = parser.parse_args(argv)
    raw = local_data_path(*DEVICES_DIR, "raw")
    names = args.parts.split(",") if args.parts else sorted(path.stem for path in raw.glob("*.glb"))
    for name in names:
        overview(name)
        print(f"rendered {name}")
    if args.matched:
        matched()
        print("rendered the matched views")


main()
