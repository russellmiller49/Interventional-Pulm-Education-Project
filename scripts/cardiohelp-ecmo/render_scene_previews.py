"""Offline preview renders of the CARDIOHELP bedside 3D circuit scene.

Rebuilds the runtime scene inside Blender from the exported layout JSON
(single source of truth: components/ecmo-circuit/layout.ts via
export-circuit-layout.mts) plus the runtime GLBs, and renders PNG poses so
scene quality can be judged without a browser (the in-app pane cannot
capture 3D pixels).

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/cardiohelp-ecmo/render_scene_previews.py -- \
    public/models/cardiohelp-ecmo scripts/cardiohelp-ecmo/circuit-layout.vv.json \
    /tmp/ecmo-previews/vv [--clamped]

Poses rendered: default, access-site, clamps, hls-module, overhead.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Vector

RESOLUTION = (1280, 800)


def parse_args() -> tuple[Path, Path, Path, bool]:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(argv) < 3:
        raise SystemExit(
            "usage: ... -- <assets-dir> <circuit-layout.json> <out-dir> [--clamped]"
        )
    return Path(argv[0]), Path(argv[1]), Path(argv[2]), "--clamped" in argv


def t2b(point) -> Vector:
    """three.js (Y-up) world coordinates -> Blender (Z-up)."""
    x, y, z = point
    return Vector((x, -z, y))


def t2b_euler(rotation):
    """three.js XYZ Euler -> the Blender XYZ Euler that produces the same pose.

    The world map is (x, y, z) -> (x, -z, y), so a rotation about three.js Y becomes a rotation
    about Blender Z and a rotation about three.js Z becomes a rotation about Blender -Y. Order is
    preserved because three.js 'XYZ' and Blender 'XYZ' compose the same way.
    """
    rx, ry, rz = rotation
    return Euler((rx, -rz, ry), "XYZ")


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = RESOLUTION
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("ecmo-world")
    world.use_nodes = True
    background = world.node_tree.nodes["Background"]
    background.inputs[0].default_value = (0.012, 0.03, 0.035, 1.0)
    background.inputs[1].default_value = 0.7
    scene.world = world


def make_material(name: str, color: str, *, roughness=0.4, metallic=0.0, emission=0.0,
                  alpha=1.0, clearcoat=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    rgb = tuple(int(color.lstrip("#")[i : i + 2], 16) / 255 for i in (0, 2, 4))
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission > 0:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*rgb, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        material.surface_render_method = "BLENDED" if hasattr(material, "surface_render_method") else material.surface_render_method
    if clearcoat > 0 and "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = clearcoat
    return material


def add_curve_tube(name: str, points, radius: float, material) -> bpy.types.Object:
    curve_data = bpy.data.curves.new(name, type="CURVE")
    curve_data.dimensions = "3D"
    spline = curve_data.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for index, point in enumerate(points):
        blender_point = t2b(point)
        spline.points[index].co = (*blender_point, 1.0)
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 6
    obj = bpy.data.objects.new(name, curve_data)
    obj.data.materials.append(material)
    bpy.context.collection.objects.link(obj)
    return obj


def import_glb(path: Path) -> list[bpy.types.Object]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [obj for obj in bpy.data.objects if obj not in before]


def group_objects(objects, name: str) -> bpy.types.Object:
    empty = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(empty)
    for obj in objects:
        if obj.parent is None:
            obj.parent = empty
    return empty


def bounds_min_z(objects) -> float:
    lowest = math.inf
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(depsgraph)
        for corner in evaluated.bound_box:
            world = evaluated.matrix_world @ Vector(corner)
            lowest = min(lowest, world.z)
    return 0.0 if lowest is math.inf else lowest


def look_at(camera: bpy.types.Object, target: Vector) -> None:
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_camera(name: str, position: Vector, target: Vector, fov_degrees: float):
    camera_data = bpy.data.cameras.new(name)
    camera_data.lens_unit = "FOV"
    camera_data.angle = math.radians(fov_degrees)
    camera = bpy.data.objects.new(name, camera_data)
    camera.location = position
    bpy.context.collection.objects.link(camera)
    look_at(camera, target)
    return camera


def add_label(name: str, text: str, position: Vector, material) -> bpy.types.Object:
    """A camera-facing text pill, so label anchors can be judged offline.

    The runtime draws labels as DOM overlays, which no Blender render can reproduce exactly. What
    this does reproduce is the thing that actually goes wrong: whether a label sits on the object it
    names. Position is the exported anchor, verbatim.
    """
    text_data = bpy.data.curves.new(name, type="FONT")
    text_data.body = text.upper()
    text_data.align_x = "CENTER"
    text_data.align_y = "CENTER"
    text_data.size = 0.07
    obj = bpy.data.objects.new(name, text_data)
    obj.location = position
    obj.data.materials.append(material)
    bpy.context.collection.objects.link(obj)
    return obj


def face_camera(objects, camera: bpy.types.Object) -> None:
    for obj in objects:
        direction = camera.location - obj.location
        obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()


def add_area_light(name: str, position: Vector, energy: float, size: float, color=(1, 1, 1)):
    light_data = bpy.data.lights.new(name, type="AREA")
    light_data.energy = energy
    light_data.size = size
    light_data.color = color
    light = bpy.data.objects.new(name, light_data)
    light.location = position
    bpy.context.collection.objects.link(light)
    look_at(light, Vector((0, 0, -0.4)))
    return light


def main() -> None:
    assets_dir, layout_path, out_dir, clamped = parse_args()
    layout = json.loads(layout_path.read_text())
    out_dir.mkdir(parents=True, exist_ok=True)

    reset_scene()
    floor_z = layout["floorY"]

    # Floor
    bpy.ops.mesh.primitive_plane_add(size=6.4, location=(0, 0, floor_z))
    floor = bpy.context.active_object
    floor.data.materials.append(make_material("floor", layout["palette"]["floor"], roughness=0.92))

    # Bed
    bpy.ops.mesh.primitive_cube_add(location=t2b((-1.35, -0.67, -0.3)))
    frame = bpy.context.active_object
    frame.scale = (0.61, 1.04, 0.06)
    frame.data.materials.append(make_material("bed-frame", layout["palette"]["bedFrame"], roughness=0.82))
    bpy.ops.mesh.primitive_cube_add(location=t2b((-1.35, -0.56, -0.3)))
    mattress = bpy.context.active_object
    mattress.scale = (0.54, 0.99, 0.065)
    mattress.data.materials.append(make_material("mattress", layout["palette"]["mattress"], roughness=0.88))

    # Patient GLB
    patient_objects = import_glb(assets_dir / "patient-femoral-access.glb")
    patient = group_objects(patient_objects, "patient-root")
    patient.location = t2b(layout["patient"]["position"])
    patient.scale = (layout["patient"]["scale"],) * 3

    # Console GLB, grounded on its transformed bounds
    console_objects = import_glb(assets_dir / "cardiohelp-console.glb")
    console = group_objects(console_objects, "console-root")
    placement = layout["consolePlacement"]
    console.location = t2b((placement["x"], 0.0, placement["z"]))
    console.rotation_euler = t2b_euler(placement["rotation"])
    console.scale = (placement.get("scale", 1.0),) * 3
    bpy.context.view_layer.update()
    console.location.z += floor_z - bounds_min_z(console_objects)

    # HLS module: oxygenator GLB above a placeholder pump head
    module = t2b(layout["hlsModule"])
    oxygenator_objects = import_glb(assets_dir / "oxygenator.glb")
    oxygenator = group_objects(oxygenator_objects, "oxygenator-root")
    oxygenator.location = module + Vector((0, 0, 0.2))
    oxygenator.rotation_euler = (0.02, 0.0, -0.55)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=0.16, location=module + Vector((0, 0, -0.16)))
    pump = bpy.context.active_object
    pump.data.materials.append(
        make_material("pump-housing", layout["palette"]["pumpHousing"], roughness=0.22, clearcoat=0.7)
    )

    # Sensor GLB along the return line
    sensor_objects = import_glb(assets_dir / "hls-sensor-connector.glb")
    sensor = group_objects(sensor_objects, "sensor-root")
    sensor.location = t2b(layout["sensor"]["position"])
    tangent = t2b(layout["sensor"]["tangent"])
    sensor.rotation_euler = tangent.to_track_quat("Z", "Y").to_euler()
    sensor.scale = (0.85,) * 3

    # Tubes: translucent wall + emissive core per limb role
    tints = {
        "venous": layout["bloodTints"]["venous"],
        "arterial": layout["bloodTints"]["arterial"],
        "sweep": layout["bloodTints"]["sweep"],
        "cannula": layout["palette"]["cannulaShaft"],
        "dpc": layout["palette"]["dpcLine"],
    }
    for tube in layout["tubes"]:
        wall_material = make_material(
            f"{tube['name']}-wall", layout["palette"]["tubeWall"], roughness=0.15, alpha=0.3, clearcoat=0.6
        )
        add_curve_tube(f"{tube['name']}-wall", tube["points"], tube["radius"], wall_material)
        if tube["role"] in {"venous", "arterial", "sweep"}:
            core_material = make_material(
                f"{tube['name']}-core", tints[tube["role"]], roughness=0.5, emission=0.35
            )
            add_curve_tube(f"{tube['name']}-core", tube["points"], tube["radius"] * 0.63, core_material)
        elif tube["role"] in {"cannula", "dpc"}:
            core_material = make_material(
                f"{tube['name']}-core", tints[tube["role"]], roughness=0.35, alpha=0.9
            )
            add_curve_tube(f"{tube['name']}-core", tube["points"], tube["radius"] * 0.8, core_material)

    # Clamp GLBs at their stations (closed pose approximated when --clamped)
    for limb in ("drainage", "return"):
        clamp_objects = import_glb(assets_dir / "circuit-clamp.glb")
        clamp = group_objects(clamp_objects, f"clamp-{limb}")
        station = layout["clamps"][limb]
        clamp.location = t2b(station["position"]) + Vector((0, 0, 0.012 if clamped else 0.075))
        clamp_tangent = t2b(station["tangent"])
        clamp.rotation_euler = clamp_tangent.to_track_quat("X", "Z").to_euler()
        if clamped:
            ring_material = make_material(f"clamp-ring-{limb}", "#ff6b73", emission=1.4)
        else:
            ring_material = make_material(f"clamp-ring-{limb}", "#76d69b", emission=1.0)
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.065, minor_radius=0.005, location=t2b(station["position"]) + Vector((0, 0, 0.09))
        )
        ring = bpy.context.active_object
        ring.data.materials.append(ring_material)

    # Access-site dressings
    for site in layout["accessSites"]:
        location = t2b(site["position"]) + Vector((0, 0, 0.008))
        bpy.ops.mesh.primitive_cylinder_add(radius=0.105, depth=0.006, location=location)
        film = bpy.context.active_object
        film.data.materials.append(
            make_material(f"dressing-{site['name']}", layout["palette"]["dressingFilm"], alpha=0.5)
        )
        bpy.ops.mesh.primitive_torus_add(major_radius=0.034, minor_radius=0.008, location=location + Vector((0, 0, 0.006)))
        ring = bpy.context.active_object
        ring.data.materials.append(make_material(f"dressing-ring-{site['name']}", site["ring"], roughness=0.36))

    # Scene labels at their exported anchors
    label_material = make_material("scene-label", "#c9fbff", emission=2.4)
    label_objects = [
        add_label(f"label-{label['id']}", label["text"], t2b(label["position"]), label_material)
        for label in layout.get("labels", [])
    ]

    # Lights: key + fill + rim (approximating the app rig)
    add_area_light("key", Vector((3.5, -4.0, 5.0)), 900, 3.2, (0.92, 1.0, 1.0))
    add_area_light("fill", Vector((-4.0, 3.0, 2.5)), 260, 3.6, (0.62, 0.71, 1.0))
    add_area_light("rim", Vector((-2.0, -5.0, 3.0)), 320, 2.6, (0.44, 0.88, 0.9))

    camera_spec = layout["camera"]
    default_position = t2b(camera_spec["position"])
    default_target = t2b(camera_spec["target"])
    poses = {
        "default": (default_position, default_target, camera_spec["fov"]),
        "access-site": (t2b((-0.4, 1.15, 1.7)), t2b(layout["accessSites"][0]["position"]), 32),
        "clamps": (t2b((0.4, 1.5, 2.2)), t2b(layout["clamps"]["drainage"]["position"]), 34),
        "hls-module": (t2b((2.1, 1.1, 1.9)), t2b(layout["hlsModule"]), 34),
        "overhead": (t2b((0.2, 4.6, 0.6)), default_target, 40),
    }

    scene = bpy.context.scene
    suffix = "clamped" if clamped else "open"
    mode = layout["supportMode"]
    for name, (position, target, fov) in poses.items():
        camera = add_camera(f"camera-{name}", position, target, fov)
        scene.camera = camera
        face_camera(label_objects, camera)
        scene.render.filepath = str(out_dir / f"{mode}-{name}-{suffix}.png")
        bpy.ops.render.render(write_still=True)
        print(f"rendered {scene.render.filepath}")

    print(f"ECMO_PREVIEW_REPORT={json.dumps({'mode': mode, 'poses': list(poses), 'clamped': clamped})}")


main()
