"""Blender: preserve the patient-space lumen, weld normals, export indexed GLB.

Run with --background --factory-startup --python this-file -- --source ... --output ...
No source files or patient transforms are modified. Geometry stays in LPS millimeters.
"""
import argparse
import sys
from pathlib import Path

import bpy

p = argparse.ArgumentParser()
p.add_argument("--source", required=True)
p.add_argument("--output", required=True)
a = p.parse_args(sys.argv[sys.argv.index("--") + 1:])
bpy.ops.wm.stl_import(filepath=str(Path(a.source).resolve()))
obj = bpy.context.selected_objects[0]
obj.name = "PatientLpsLumen"
bpy.context.view_layer.objects.active = obj
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=0.00001)
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")
for polygon in obj.data.polygons:
    polygon.use_smooth = True
obj["coordinateSystem"] = "LPS"
obj["units"] = "mm"
Path(a.output).parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(Path(a.output).resolve()), export_format="GLB", use_selection=True,
    export_yup=False, export_normals=True, export_materials="NONE", export_extras=True,
)
print("Exported unchanged lumen topology:", len(obj.data.vertices), "vertices,", len(obj.data.polygons), "faces")
