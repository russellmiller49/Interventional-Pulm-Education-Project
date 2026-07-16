"""Build additional rigid-bronchoscopy tools and a reusable assembly-kit GLB.

The EFER components are supplied as already-split GLBs. This script creates the
photo-derived accessories requested for the teaching lab, then combines all
component roots into one web-loading pack while preserving the individual GLBs.

Run with Blender 5.1+:

  blender --background --python scripts/rigid-bronchoscopy/build-rigid-tool-assets.py -- \
    public/models/rigid-bronchoscopy/assembly/components \
    public/models/rigid-bronchoscopy/assembly
"""

from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


HOOD_ORDERING_URL = "https://hoodlabs.com/efer-bronchoscope-ordering-information/"
HOOD_FORCEPS_URL = "https://hoodlabs.com/efer-bronchoscope-forceps/"
HOOD_ENDOSCOPE_URL = "https://hoodlabs.com/efer-bronchoscope-endoscope/"
HOOD_USER_MANUAL_URL = (
    "https://hoodlabs.com/wp-content/uploads/EFER-BRONCHOSCOPE-USER-MANUAL.pdf"
)
STRYKER_CAMERA_URL = (
    "https://www.stryker.com/us/en/portfolios/medical-surgical-equipment/"
    "surgical-visualization/camera-systems.html"
)
KARL_STORZ_LIGHT_CABLE_URL = (
    "https://www.karlstorz.com/us/en/product-detail-page.htm?cat=1000071971&productID=1000060267"
)


def args_after_separator() -> list[str]:
    if "--" not in sys.argv:
        raise SystemExit("Expected COMPONENT_DIR and OUTPUT_DIR after --")
    return sys.argv[sys.argv.index("--") + 1 :]


component_arg, output_arg = args_after_separator()
component_dir = Path(component_arg).resolve()
output_dir = Path(output_arg).resolve()
component_dir.mkdir(parents=True, exist_ok=True)
output_dir.mkdir(parents=True, exist_ok=True)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def make_material(name: str, color: tuple[float, float, float, float], metallic=0.0, roughness=0.4):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return material


def new_asset_scene(root_name: str, metadata: dict):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    collection = bpy.data.collections.new("MODEL")
    scene.collection.children.link(collection)
    root = bpy.data.objects.new(root_name, None)
    collection.objects.link(root)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.01
    root["education_only"] = True
    root["units"] = "meters"
    for key, value in metadata.items():
        root[key] = value
    return scene, collection, root


def link_to_collection(obj, collection):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def set_side_smoothing(obj):
    for polygon in obj.data.polygons:
        polygon.use_smooth = abs(polygon.normal.z) < 0.5


def rounded_box(name, dimensions, location, material, parent, collection, bevel=0.004):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = link_to_collection(bpy.context.object, collection)
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    obj.dimensions = dimensions
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("Rounded machined housing", "BEVEL")
    modifier.width = min(bevel, min(dimensions) * 0.24)
    modifier.segments = 5
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(material)
    obj.parent = parent
    return obj


def cylinder_y(name, radius, depth, location, material, parent, collection, vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = link_to_collection(bpy.context.object, collection)
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    obj.rotation_euler.x = math.pi / 2
    obj.data.materials.append(material)
    obj.parent = parent
    set_side_smoothing(obj)
    return obj


def cylinder_between(name, start, end, radius, material, parent, collection, vertices=40):
    start_v = Vector(start)
    end_v = Vector(end)
    delta = end_v - start_v
    center = (start_v + end_v) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=delta.length, location=center)
    obj = link_to_collection(bpy.context.object, collection)
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(delta.normalized())
    obj.data.materials.append(material)
    obj.parent = parent
    set_side_smoothing(obj)
    return obj


def hollow_segment_y(name, y0, y1, outer_radius, inner_radius, material, parent, collection, segments=64):
    vertices = []
    for radius, y in (
        (outer_radius, y0),
        (inner_radius, y0),
        (outer_radius, y1),
        (inner_radius, y1),
    ):
        for index in range(segments):
            theta = math.tau * index / segments
            vertices.append((radius * math.cos(theta), y, radius * math.sin(theta)))
    o0, i0, o1, i1 = 0, segments, segments * 2, segments * 3
    faces = []
    for index in range(segments):
        nxt = (index + 1) % segments
        faces.extend(
            [
                (o0 + index, o0 + nxt, o1 + nxt, o1 + index),
                (i0 + nxt, i0 + index, i1 + index, i1 + nxt),
                (o0 + nxt, o0 + index, i0 + index, i0 + nxt),
                (o1 + index, o1 + nxt, i1 + nxt, i1 + index),
            ]
        )
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=False)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    obj.parent = parent
    for idx, polygon in enumerate(obj.data.polygons):
        polygon.use_smooth = idx % 4 in (0, 1)
    return obj


def curve_tube(name, points, radius, material, parent, collection, resolution=3):
    curve = bpy.data.curves.new(f"{name}_Curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = resolution
    curve.bevel_depth = radius
    curve.bevel_resolution = 4
    spline = curve.splines.new("NURBS")
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1.0)
    spline.order_u = min(4, len(points))
    spline.use_endpoint_u = True
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    obj.parent = parent
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.data.name = f"{name}_Mesh"
    return obj


def torus(name, major_radius, minor_radius, location, material, parent, collection, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=64,
        minor_segments=12,
        location=location,
        rotation=rotation,
    )
    obj = link_to_collection(bpy.context.object, collection)
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    obj.data.materials.append(material)
    obj.parent = parent
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def tapered_jaw(name, center, length, width, angle, material, parent, collection):
    obj = rounded_box(name, (width, length, width * 0.72), center, material, parent, collection, bevel=width * 0.15)
    obj.rotation_euler.z = angle
    return obj


def swept_hollow_tube(name, points, outer_radius, inner_radius, material, parent, collection, segments=20):
    vectors = [Vector(point) for point in points]
    vertices = []
    frames = []
    previous_normal = Vector((1, 0, 0))
    for index, point in enumerate(vectors):
        if index == 0:
            tangent = (vectors[1] - point).normalized()
        elif index == len(vectors) - 1:
            tangent = (point - vectors[index - 1]).normalized()
        else:
            tangent = (vectors[index + 1] - vectors[index - 1]).normalized()
        normal = previous_normal - tangent * previous_normal.dot(tangent)
        if normal.length < 1e-6:
            normal = tangent.cross(Vector((0, 0, 1)))
        normal.normalize()
        binormal = tangent.cross(normal).normalized()
        frames.append((normal, binormal))
        previous_normal = normal
        for radius in (outer_radius, inner_radius):
            for ring_index in range(segments):
                theta = math.tau * ring_index / segments
                offset = normal * (math.cos(theta) * radius) + binormal * (math.sin(theta) * radius)
                vertices.append(tuple(point + offset))

    faces = []
    stride = segments * 2
    for path_index in range(len(vectors) - 1):
        base = path_index * stride
        next_base = (path_index + 1) * stride
        for ring_index in range(segments):
            nxt = (ring_index + 1) % segments
            faces.append((base + ring_index, base + nxt, next_base + nxt, next_base + ring_index))
            faces.append(
                (
                    base + segments + nxt,
                    base + segments + ring_index,
                    next_base + segments + ring_index,
                    next_base + segments + nxt,
                )
            )
    first_outer = 0
    first_inner = segments
    last_outer = (len(vectors) - 1) * stride
    last_inner = last_outer + segments
    for ring_index in range(segments):
        nxt = (ring_index + 1) % segments
        faces.append((first_outer + nxt, first_outer + ring_index, first_inner + ring_index, first_inner + nxt))
        faces.append((last_outer + ring_index, last_outer + nxt, last_inner + nxt, last_inner + ring_index))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=False)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    obj.parent = parent
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def recursive_select(root):
    root.select_set(True)
    for child in root.children:
        recursive_select(child)


def object_bounds(root):
    points = []
    stack = [root]
    while stack:
        current = stack.pop()
        stack.extend(current.children)
        if current.type == "MESH":
            points.extend(current.matrix_world @ Vector(corner) for corner in current.bound_box)
    minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return {
        "min": [round(value, 6) for value in minimum],
        "max": [round(value, 6) for value in maximum],
        "size": [round(value, 6) for value in maximum - minimum],
    }


def export_asset(filename, root, metadata):
    for obj in bpy.context.scene.objects:
        obj.select_set(False)
    recursive_select(root)
    output_path = component_dir / filename
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_extras=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
    )
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    triangles = sum(sum(max(0, len(poly.vertices) - 2) for poly in obj.data.polygons) for obj in mesh_objects)
    return {
        "filename": filename,
        "root_node": root.name,
        "metadata": metadata,
        "bounds_blender_z_up_m": object_bounds(root),
        "mesh_count": len(mesh_objects),
        "triangle_count": triangles,
        "size_bytes": output_path.stat().st_size,
        "sha256": sha256(output_path),
    }


def build_camera_head():
    metadata = {
        "component_type": "generic_endoscopic_camera_head",
        "source_type": "reference_photo_and_manufacturer_manual_educational_approximation",
        "source_url": HOOD_USER_MANUAL_URL,
        "secondary_source_url": STRYKER_CAMERA_URL,
        "geometry_note": (
            "Generic unbranded round/cylindrical C-mount camera proxy; the supplied images and "
            "manual do not establish an exact camera model or manufacturing dimensions."
        ),
        "connector_role": "telescope_ocular_camera_coupler",
    }
    _, collection, root = new_asset_scene("Generic_Endoscopic_Camera_Head", metadata)
    white = make_material("Camera housing", (0.68, 0.71, 0.72, 1), 0.18, 0.32)
    black = make_material("Camera grip", (0.018, 0.022, 0.028, 1), 0.08, 0.28)
    glass = make_material("Camera optical glass", (0.01, 0.08, 0.10, 1), 0.35, 0.08)
    metal = make_material("Camera connector metal", (0.35, 0.42, 0.48, 1), 0.85, 0.22)
    cylinder_y("Camera_Round_Main_Housing", 0.042, 0.105, (0, -0.070, 0), white, root, collection, 96)
    hollow_segment_y(
        "Camera_Round_Front_Grip_Collar",
        -0.032,
        -0.008,
        0.045,
        0.0345,
        black,
        root,
        collection,
        96,
    )
    cylinder_y("Camera_Round_Rear_End_Cap", 0.036, 0.018, (0, -0.131, 0), black, root, collection, 80)
    hollow_segment_y(
        "Camera_Round_Metal_Trim_Ring",
        -0.013,
        -0.004,
        0.038,
        0.0342,
        metal,
        root,
        collection,
        80,
    )
    hollow_segment_y("Camera_Ocular_Coupler", -0.025, 0.015, 0.034, 0.018, black, root, collection, 72)
    hollow_segment_y("Camera_Coupler_Metal_Insert", 0.010, 0.022, 0.020, 0.015, metal, root, collection, 64)
    cylinder_y("Camera_Optical_Window", 0.014, 0.002, (0, 0.023, 0), glass, root, collection, 56)
    for index, y in enumerate((-0.050, -0.082), start=1):
        cylinder_between(f"Camera_Control_Button_{index}", (-0.018 + index * 0.022, y, 0.033), (-0.018 + index * 0.022, y, 0.039), 0.009, black, root, collection, 32)
    cylinder_between("Camera_Cable_Strain_Relief", (0, -0.137, 0), (0, -0.161, 0), 0.008, black, root, collection)
    curve_tube(
        "Camera_Integral_CCU_Cable",
        [(0, -0.161, 0), (0.012, -0.205, -0.018), (0.018, -0.255, -0.060)],
        0.0045,
        black,
        root,
        collection,
    )
    return export_asset("generic-endoscopic-camera-head.glb", root, metadata)


def build_light_guide_adapter_c1():
    metadata = {
        "component_type": "generic_light_guide_adapter_c1",
        "adapter_stage": "C1",
        "source_type": "reference_photo_educational_approximation",
        "source_url": HOOD_USER_MANUAL_URL,
        "nominal_length_mm": 10,
        "connector_role": "telescope_light_guide_post_to_c2_adapter",
        "lumen_patent": True,
        "geometry_note": (
            "Photo-derived C1 teaching proxy. The supplied composite does not establish an exact "
            "part number or whether it represents the STORZ/Olympus, WOLF, or ACMI interface."
        ),
    }
    _, collection, root = new_asset_scene("Generic_Light_Guide_Adapter_C1", metadata)
    metal = make_material("C1 adapter stainless steel", (0.44, 0.50, 0.54, 1), 0.94, 0.17)
    dark = make_material("C1 adapter identification band", (0.035, 0.040, 0.045, 1), 0.4, 0.3)
    hollow_segment_y("C1_Optic_Post_Socket", 0.0, 0.006, 0.00525, 0.0046, metal, root, collection, 72)
    hollow_segment_y("C1_Distal_Male_Interface", 0.006, 0.010, 0.0038, 0.0020, metal, root, collection, 64)
    hollow_segment_y("C1_Identification_Band", 0.0045, 0.0052, 0.0055, 0.00455, dark, root, collection, 72)
    return export_asset("generic-light-guide-adapter-c1.glb", root, metadata)


def build_light_guide_adapter_c2():
    metadata = {
        "component_type": "generic_light_guide_adapter_c2",
        "adapter_stage": "C2",
        "source_type": "reference_photo_educational_approximation",
        "source_url": HOOD_USER_MANUAL_URL,
        "nominal_length_mm": 16,
        "connector_role": "c1_adapter_to_generic_fiberoptic_light_cable",
        "lumen_patent": True,
        "geometry_note": (
            "Photo-derived C2 teaching proxy. The supplied composite does not establish an exact "
            "part number or whether it represents the STORZ/Olympus, WOLF, or ACMI interface."
        ),
    }
    _, collection, root = new_asset_scene("Generic_Light_Guide_Adapter_C2", metadata)
    metal = make_material("C2 adapter stainless steel", (0.44, 0.50, 0.54, 1), 0.94, 0.17)
    dark = make_material("C2 adapter identification band", (0.035, 0.040, 0.045, 1), 0.4, 0.3)
    hollow_segment_y("C2_Proximal_C1_Receiver", 0.0, 0.004, 0.0054, 0.0039, metal, root, collection, 72)
    hollow_segment_y("C2_Main_Adapter_Body", 0.004, 0.010, 0.0054, 0.0020, metal, root, collection, 72)
    hollow_segment_y("C2_Distal_Cable_Spigot", 0.010, 0.016, 0.00115, 0.0006, metal, root, collection, 48)
    hollow_segment_y("C2_Identification_Band", 0.0080, 0.0090, 0.00565, 0.00195, dark, root, collection, 72)
    return export_asset("generic-light-guide-adapter-c2.glb", root, metadata)


def build_light_cable():
    metadata = {
        "component_type": "generic_fiberoptic_light_cable",
        "source_type": "reference_photo_with_manufacturer_exemplar",
        "source_url": KARL_STORZ_LIGHT_CABLE_URL,
        "nominal_length_mm": 2300,
        "nominal_diameter_mm": 3.5,
        "geometry_note": "Cable dimensions use a current exemplar; connector shapes remain generic.",
    }
    _, collection, root = new_asset_scene("Generic_Fiberoptic_Light_Cable", metadata)
    jacket = make_material("Light cable jacket", (0.36, 0.46, 0.58, 1), 0.0, 0.48)
    rubber = make_material("Light cable strain relief", (0.025, 0.030, 0.035, 1), 0.02, 0.44)
    metal = make_material("Light cable connectors", (0.42, 0.49, 0.54, 1), 0.92, 0.18)
    coil_points = [(0.0, 0.055, 0.0), (0.075, 0.085, 0.0)]
    turns = 3.25
    samples = 150
    center = Vector((0.0, 0.205, 0.0))
    radius = 0.112
    for index in range(samples):
        progress = index / (samples - 1)
        angle = -math.pi / 2 + progress * turns * math.tau
        coil_points.append((center.x + math.cos(angle) * radius, center.y + math.sin(angle) * radius, 0.0))
    curve_tube("Fiberoptic_Cable_Jacket", coil_points, 0.00175, jacket, root, collection, resolution=2)
    hollow_segment_y("Scope_End_Light_Connector", -0.010, 0.038, 0.0060, 0.0020, metal, root, collection, 56)
    cylinder_y("Scope_End_Strain_Relief", 0.0068, 0.020, (0, 0.047, 0), rubber, root, collection, 48)
    end = Vector(coil_points[-1])
    previous = Vector(coil_points[-2])
    direction = (end - previous).normalized()
    cylinder_between("Light_Source_End_Connector", end, end + direction * 0.050, 0.0055, metal, root, collection, 48)
    cylinder_between("Light_Source_End_Strain_Relief", end - direction * 0.018, end, 0.0065, rubber, root, collection, 40)
    return export_asset("generic-fiberoptic-light-cable.glb", root, metadata)


def add_ring_handles(root, collection, metal, hub_y=-0.006):
    for side in (-1, 1):
        center = (side * 0.026, -0.066, 0)
        torus(f"Finger_Ring_{'L' if side < 0 else 'R'}", 0.018, 0.0025, center, metal, root, collection)
        cylinder_between(
            f"Handle_Arm_{'L' if side < 0 else 'R'}",
            (side * 0.018, -0.049, 0),
            (side * 0.006, hub_y, 0),
            0.0025,
            metal,
            root,
            collection,
        )
    cylinder_y("Forceps_Handle_Hub", 0.008, 0.018, (0, hub_y, 0), metal, root, collection, 48)


def add_two_jaws(root, collection, metal, distal_y, head_width, opening=0.42):
    tapered_jaw("Distal_Jaw_Left", (-head_width * 0.45, distal_y, 0), 0.014, head_width * 0.52, opening, metal, root, collection)
    tapered_jaw("Distal_Jaw_Right", (head_width * 0.45, distal_y, 0), 0.014, head_width * 0.52, -opening, metal, root, collection)


def build_optical_forceps():
    metadata = {
        "component_type": "optical_grasping_forceps",
        "part_number": "32-3230-430HM",
        "working_length_mm": 470,
        "head_diameter_mm": 3,
        "source_type": "manufacturer_dimensions_photo_derived_handle",
        "source_url": HOOD_FORCEPS_URL,
        "geometry_note": "Guide-tube and handle proportions are educational approximations, not manufacturing tolerances.",
    }
    _, collection, root = new_asset_scene("Optical_Grasping_Forceps_32_3230_430HM", metadata)
    metal = make_material("Optical forceps stainless steel", (0.36, 0.43, 0.49, 1), 0.92, 0.2)
    black = make_material("Optical forceps ocular trim", (0.018, 0.022, 0.026, 1), 0.08, 0.34)
    add_ring_handles(root, collection, metal)
    hollow_segment_y("Optical_Forceps_Telescope_Guide", 0.0, 0.470, 0.0040, 0.0029, metal, root, collection, 56)
    cylinder_y("Optical_Forceps_Proximal_Coupler", 0.011, 0.030, (0, -0.004, 0), black, root, collection, 56)
    cylinder_between("Optical_Forceps_Control_Rod", (0.0048, 0.0, 0), (0.0048, 0.466, 0), 0.0007, metal, root, collection, 20)
    add_two_jaws(root, collection, metal, 0.477, 0.003)
    return export_asset("optical-grasping-forceps-32-3230-430hm.glb", root, metadata)


def build_semirigid_forceps(part_number, root_name, filename, biopsy=False):
    metadata = {
        "component_type": "semi_rigid_biopsy_forceps" if biopsy else "semi_rigid_grasping_forceps",
        "part_number": part_number,
        "working_length_mm": 600,
        "shaft_diameter_mm": 1.5,
        "head_diameter_mm": 3,
        "source_type": "manufacturer_dimensions_photo_derived_handle",
        "source_url": HOOD_FORCEPS_URL,
    }
    _, collection, root = new_asset_scene(root_name, metadata)
    metal = make_material("Semi-rigid forceps stainless steel", (0.38, 0.45, 0.50, 1), 0.93, 0.19)
    add_ring_handles(root, collection, metal)
    cylinder_between("Forceps_Semi_Rigid_Shaft", (0, 0, 0), (0, 0.600, 0), 0.00075, metal, root, collection, 20)
    cylinder_y("Forceps_Distal_Hub", 0.0015, 0.010, (0, 0.600, 0), metal, root, collection, 28)
    if biopsy:
        for side in (-1, 1):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=14, radius=0.0015, location=(side * 0.0011, 0.607, 0))
            cup = link_to_collection(bpy.context.object, collection)
            cup.name = f"Biopsy_Cup_{'L' if side < 0 else 'R'}"
            cup.data.name = f"{cup.name}_Mesh"
            cup.scale.y = 1.4
            cup.rotation_euler.z = side * 0.35
            cup.data.materials.append(metal)
            cup.parent = root
    else:
        add_two_jaws(root, collection, metal, 0.607, 0.003)
    return export_asset(filename, root, metadata)


def build_suction_catheter():
    metadata = {
        "component_type": "semi_rigid_suction_catheter",
        "nominal_outer_diameter_mm": 3,
        "working_length_mm": 550,
        "source_type": "manufacturer_dimensions_educational_geometry",
        "source_url": HOOD_ORDERING_URL,
        "lumen_patent": True,
    }
    _, collection, root = new_asset_scene("Semi_Rigid_Suction_Catheter_3mm", metadata)
    metal = make_material("Suction catheter stainless steel", (0.38, 0.45, 0.50, 1), 0.93, 0.19)
    black = make_material("Suction catheter connector", (0.02, 0.025, 0.03, 1), 0.03, 0.42)
    points = []
    for index in range(24):
        progress = index / 23
        y = progress * 0.550
        bend = max(0.0, (progress - 0.84) / 0.16)
        x = 0.028 * bend * bend
        points.append((x, y, 0.0))
    swept_hollow_tube("Suction_Catheter_Patent_Lumen", points, 0.0015, 0.00105, metal, root, collection)
    hollow_segment_y("Suction_Connector", -0.032, 0.006, 0.0060, 0.0020, black, root, collection, 48)
    return export_asset("semi-rigid-suction-catheter-3mm.glb", root, metadata)


new_assets = [
    build_camera_head(),
    build_light_guide_adapter_c1(),
    build_light_guide_adapter_c2(),
    build_light_cable(),
    build_optical_forceps(),
    build_semirigid_forceps(
        "BPS2002",
        "Semi_Rigid_Grasping_Forceps_BPS2002",
        "semi-rigid-grasping-forceps-bps2002.glb",
        biopsy=False,
    ),
    build_semirigid_forceps(
        "BPS2001",
        "Semi_Rigid_Biopsy_Forceps_BPS2001",
        "semi-rigid-biopsy-forceps-bps2001.glb",
        biopsy=True,
    ),
    build_suction_catheter(),
]

inventory_path = output_dir / "tool-asset-inventory.json"
inventory = {
    "schema_version": 1,
    "generated_with": bpy.app.version_string,
    "assets": new_assets,
    "reference_images": [
        "endoscopic camera.jpg",
        "light source tube.webp",
        "optical forcepts.png",
        "rigid optic.png",
        "rigid componenets.png",
    ],
    "reference_documents": [
        {
            "filename": "EFER-BRONCHOSCOPE-USER-MANUAL.pdf",
            "url": HOOD_USER_MANUAL_URL,
            "use_note": (
                "Supports the universal C-mount relationship and the existence of light-cable "
                "adapter families; C1/C2 shapes remain photo-derived teaching approximations."
            ),
        }
    ],
}

# Build a single request-efficient runtime pack while leaving every item available as an individual GLB.
bpy.ops.wm.read_factory_settings(use_empty=True)
pack_root = bpy.data.objects.new("Rigid_Bronchoscopy_Assembly_Kit", None)
bpy.context.scene.collection.objects.link(pack_root)
pack_root["education_only"] = True
pack_root["source_type"] = "manufacturer_specs_plus_photo_derived_accessories"
pack_root["individual_component_directory"] = "components"

component_paths = sorted(component_dir.glob("*.glb"))
for component_path in component_paths:
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(component_path))
    imported = [obj for obj in bpy.context.scene.objects if obj not in before]
    imported_roots = [obj for obj in imported if obj.parent is None]
    if len(imported_roots) != 1:
        raise RuntimeError(f"Expected one root from {component_path.name}, found {[obj.name for obj in imported_roots]}")
    imported_root = imported_roots[0]
    if imported_root.name == "Autoclavable_Bronchial_Endoscope_BX5500_FA":
        imported_root["working_length_mm_is_educational_estimate"] = True
        imported_root["working_length_note"] = (
            "490 mm is the source model shaft estimate; current manufacturer pages publish 5.5 mm "
            "diameter and 0-degree view but not this working length."
        )
    world = imported_root.matrix_world.copy()
    imported_root.parent = pack_root
    imported_root.matrix_world = world

for obj in bpy.context.scene.objects:
    obj.select_set(False)
recursive_select(pack_root)
pack_path = output_dir / "rigid-bronchoscopy-assembly-kit.glb"
bpy.ops.export_scene.gltf(
    filepath=str(pack_path),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_extras=True,
    export_yup=True,
    export_cameras=False,
    export_lights=False,
)

inventory["assembly_pack"] = {
    "filename": pack_path.name,
    "root_node": pack_root.name,
    "component_file_count": len(component_paths),
    "size_bytes": pack_path.stat().st_size,
    "sha256": sha256(pack_path),
}
inventory_path.write_text(json.dumps(inventory, indent=2) + "\n", encoding="utf-8")

print(
    json.dumps(
        {
            "new_asset_count": len(new_assets),
            "component_file_count": len(component_paths),
            "assembly_pack": str(pack_path),
            "assembly_pack_size_bytes": pack_path.stat().st_size,
            "assembly_pack_sha256": inventory["assembly_pack"]["sha256"],
            "inventory": str(inventory_path),
        }
    )
)
