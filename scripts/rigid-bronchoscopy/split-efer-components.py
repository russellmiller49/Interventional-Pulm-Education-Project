import bpy
import hashlib
import json
import math
import re
import sys
from pathlib import Path
from mathutils import Vector


EXCLUDED_COMPONENT_IDS = {
    "Teaching_Demo_Assembled_BT2103_3_with_BD2410_3",
}


def argv_after_separator():
    if "--" not in sys.argv:
        raise SystemExit("Expected arguments after --")
    return sys.argv[sys.argv.index("--") + 1 :]


def descendants(root):
    found = []
    stack = list(root.children)
    while stack:
        obj = stack.pop()
        found.append(obj)
        stack.extend(obj.children)
    return found


def rounded(values, digits=9):
    return [round(float(value), digits) for value in values]


def bounds_for_objects(objects):
    points = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        return None
    minimum = Vector(
        (
            min(point.x for point in points),
            min(point.y for point in points),
            min(point.z for point in points),
        )
    )
    maximum = Vector(
        (
            max(point.x for point in points),
            max(point.y for point in points),
            max(point.z for point in points),
        )
    )
    return {
        "min": rounded(minimum),
        "max": rounded(maximum),
        "size": rounded(maximum - minimum),
        "center": rounded((minimum + maximum) * 0.5),
    }


def triangle_count(objects):
    total = 0
    for obj in objects:
        if obj.type != "MESH":
            continue
        total += sum(max(0, len(poly.loop_indices) - 2) for poly in obj.data.polygons)
    return total


def material_names(objects):
    names = set()
    for obj in objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            if slot.material:
                names.add(slot.material.name)
    return sorted(names)


def custom_properties(owner):
    result = {}
    for key in owner.keys():
        if key == "_RNA_UI":
            continue
        value = owner[key]
        if isinstance(value, (str, int, float, bool)):
            result[key] = value
        elif hasattr(value, "to_list"):
            result[key] = value.to_list()
        elif isinstance(value, (list, tuple)):
            result[key] = list(value)
        else:
            result[key] = str(value)
    return result


def filename_for_component(root):
    props = custom_properties(root)
    part = str(props.get("part_number", root.name)).lower().replace("_", "-")
    ctype = str(props.get("component_type", "component")).replace("_", "-")
    if ctype in {"bronchial-tube", "tracheal-tube"}:
        od = f'{float(props["outer_diameter_mm"]):.2f}'.replace(".", "p")
        inner = f'{float(props["inner_diameter_mm"]):.2f}'.replace(".", "p")
        base = f"{part}-{ctype}-od{od}-id{inner}mm"
    elif root.name == "Autoclavable_Bronchial_Endoscope_BX5500_FA":
        base = f"{part}-rigid-telescope"
    elif root.name == "Adult_Universal_Base_BD2410_3":
        base = f"{part}-adult-universal-base"
    elif root.name == "Compact_Base_BD2501_3":
        base = f"{part}-compact-base"
    elif root.name == "Lateral_Obturator_One_Gate_BB2401_3":
        base = f"{part}-lateral-obturator-single-gate"
    elif root.name == "Lateral_Obturator_Two_Gates_BB2402_3":
        base = f"{part}-lateral-obturator-double-gate"
    elif root.name == "Main_Cap_BS2303_3_Red_5_5mm":
        base = f"{part}-main-cap-red-5p5mm"
    elif root.name == "Main_Cap_BS2310_3_Green_Dual_4mm":
        base = f"{part}-main-cap-green-dual-4mm"
    elif root.name == "Side_Cap_BS2101_3_Blue_Solid":
        base = f"{part}-side-cap-blue-solid"
    elif root.name == "Side_Cap_BS2102_3_Blue_2mm":
        base = f"{part}-side-cap-blue-2mm"
    else:
        label = re.sub(r"[^a-z0-9]+", "-", root.name.lower()).strip("-")
        base = f"{part}-{label}"
    return re.sub(r"-+", "-", base).strip("-") + ".glb"


def file_sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def component_stats(root):
    objects = [root, *descendants(root)]
    meshes = [obj for obj in objects if obj.type == "MESH"]
    return {
        "node_count": len(objects),
        "mesh_node_count": len(meshes),
        "unique_mesh_count": len({obj.data.as_pointer() for obj in meshes}),
        "triangle_count": triangle_count(objects),
        "material_names": material_names(objects),
        "bounds_blender_z_up_m": bounds_for_objects(objects),
        "object_names": sorted(obj.name for obj in objects),
        "root_custom_properties": custom_properties(root),
    }


def close_enough(a, b, tolerance=2e-6):
    if len(a) != len(b):
        return False
    return all(math.isclose(float(x), float(y), abs_tol=tolerance, rel_tol=0.0) for x, y in zip(a, b))


def compare_bounds(expected, actual):
    if expected is None or actual is None:
        return expected is actual
    return all(close_enough(expected[key], actual[key]) for key in ("min", "max", "size", "center"))


source_arg, output_arg, inventory_arg, validation_arg = argv_after_separator()
source_path = Path(source_arg).resolve()
output_dir = Path(output_arg).resolve()
inventory_path = Path(inventory_arg).resolve()
validation_path = Path(validation_arg).resolve()
output_dir.mkdir(parents=True, exist_ok=True)

for old_path in output_dir.glob("*.glb"):
    old_path.unlink()

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source_path))
bpy.context.view_layer.update()

scene_roots = [obj for obj in bpy.context.scene.objects if obj.parent is None]
if len(scene_roots) != 1 or scene_roots[0].name != "EFER_DUMON_Rigid_Bronchoscopy_Teaching_Set":
    raise RuntimeError(f"Unexpected scene roots: {[obj.name for obj in scene_roots]}")
source_set_root = scene_roots[0]
source_set_properties = custom_properties(source_set_root)

component_roots = sorted(
    (child for child in source_set_root.children if child.name not in EXCLUDED_COMPONENT_IDS),
    key=lambda obj: obj.name,
)

if len(component_roots) != 18:
    raise RuntimeError(f"Expected 18 reusable components, found {len(component_roots)}")

inventory_entries = []
expected_by_file = {}

for root in component_roots:
    original_matrix_world = root.matrix_world.copy()
    rebased_matrix_world = original_matrix_world.copy()
    rebased_matrix_world.translation = Vector((0.0, 0.0, 0.0))
    root.matrix_world = rebased_matrix_world
    bpy.context.view_layer.update()

    source_layout_translation = rounded(original_matrix_world.translation)
    stats = component_stats(root)
    filename = filename_for_component(root)
    output_path = output_dir / filename

    bpy.ops.object.select_all(action="DESELECT")
    selected_objects = [root, *descendants(root)]
    for obj in selected_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root

    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_yup=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )

    entry = {
        "top_level_component_id": root.name,
        "filename": filename,
        "part_number": stats["root_custom_properties"].get("part_number"),
        "component_type": stats["root_custom_properties"].get("component_type"),
        "source_showcase_translation_blender_z_up_m": source_layout_translation,
        "export_origin_policy": "component semantic root rebased to [0,0,0]; child-local transforms preserved",
        **stats,
        "file_size_bytes": output_path.stat().st_size,
        "sha256": file_sha256(output_path),
    }
    inventory_entries.append(entry)
    expected_by_file[filename] = entry

    root.matrix_world = original_matrix_world
    bpy.context.view_layer.update()

inventory = {
    "schema_version": 1,
    "generated_with": bpy.app.version_string,
    "source_filename": source_path.name,
    "source_size_bytes": source_path.stat().st_size,
    "source_sha256": file_sha256(source_path),
    "metadata_qualifications": [
        {
            "top_level_component_id": "Autoclavable_Bronchial_Endoscope_BX5500_FA",
            "field": "working_length_mm",
            "qualification": (
                "The 490 mm shaft length is an educational geometry estimate from the source model. "
                "Current manufacturer pages publish 5.5 mm diameter and 0-degree direction of view, "
                "but do not publish this working length."
            ),
        }
    ],
    "source_set_top_level_id": source_set_root.name,
    "source_set_custom_properties": source_set_properties,
    "coordinate_and_units": {
        "glb_coordinate_system": "glTF 2.0 right-handed Y-up",
        "reported_bounds_coordinate_system": "Blender right-handed Z-up after reimport",
        "reported_bounds_units": "meters",
    },
    "export_policy": {
        "selection": "each direct semantic child of the source teaching-set root plus all descendants",
        "origin": "rebase component semantic root translation to world origin",
        "hierarchy": "preserve component root, descendant object names, local transforms, and materials",
        "metadata": "preserve glTF node extras imported as Blender custom properties",
    },
    "excluded_components": [
        {
            "top_level_component_id": component_id,
            "reason": "duplicate assembled teaching demo; reusable assembly should compose the separately exported tube and base",
        }
        for component_id in sorted(EXCLUDED_COMPONENT_IDS)
    ],
    "component_count": len(inventory_entries),
    "components": inventory_entries,
}
inventory_path.write_text(json.dumps(inventory, indent=2) + "\n", encoding="utf-8")

validation_entries = []
for entry in inventory_entries:
    output_path = output_dir / entry["filename"]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(output_path))
    bpy.context.view_layer.update()

    roots = [obj for obj in bpy.context.scene.objects if obj.parent is None]
    matching_root = bpy.data.objects.get(entry["top_level_component_id"])
    root_is_top_level = matching_root is not None and matching_root.parent is None
    actual = component_stats(matching_root) if matching_root else None
    checks = {
        "semantic_root_name_preserved": matching_root is not None,
        "semantic_root_is_only_top_level_node": root_is_top_level and len(roots) == 1,
        "semantic_root_location_is_origin": bool(matching_root) and close_enough(matching_root.location, (0.0, 0.0, 0.0)),
        "node_count_preserved": bool(actual) and actual["node_count"] == entry["node_count"],
        "mesh_node_count_preserved": bool(actual) and actual["mesh_node_count"] == entry["mesh_node_count"],
        "triangle_count_preserved": bool(actual) and actual["triangle_count"] == entry["triangle_count"],
        "material_names_preserved": bool(actual) and actual["material_names"] == entry["material_names"],
        "object_names_preserved": bool(actual) and actual["object_names"] == entry["object_names"],
        "root_custom_properties_preserved": bool(actual) and actual["root_custom_properties"] == entry["root_custom_properties"],
        "bounds_preserved_within_2e-6_m": bool(actual) and compare_bounds(
            entry["bounds_blender_z_up_m"], actual["bounds_blender_z_up_m"]
        ),
    }
    validation_entries.append(
        {
            "filename": entry["filename"],
            "top_level_component_id": entry["top_level_component_id"],
            "top_level_nodes_after_roundtrip": [obj.name for obj in roots],
            "checks": checks,
            "passed": all(checks.values()),
            "actual": actual,
        }
    )

validation = {
    "schema_version": 1,
    "method": "Blender GLB import -> semantic split/export -> clean Blender factory reset -> GLB reimport",
    "bounds_tolerance_m": 2e-6,
    "validated_file_count": len(validation_entries),
    "all_passed": all(entry["passed"] for entry in validation_entries),
    "entries": validation_entries,
}
validation_path.write_text(json.dumps(validation, indent=2) + "\n", encoding="utf-8")

print(
    json.dumps(
        {
            "component_count": len(inventory_entries),
            "output_dir": str(output_dir),
            "inventory": str(inventory_path),
            "validation": str(validation_path),
            "all_roundtrip_checks_passed": validation["all_passed"],
            "failed_files": [entry["filename"] for entry in validation_entries if not entry["passed"]],
        }
    )
)
