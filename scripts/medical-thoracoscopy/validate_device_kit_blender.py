"""Import every packaged device model in Blender and compare it with the model before compression.

Run with Blender 5.1, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \\
        --python scripts/medical-thoracoscopy/validate_device_kit_blender.py

For each model in `public/models/medical-thoracoscopy/v1/devices/manifest.json`, the compressed
file is decoded by Blender's own importer and compared, mesh by mesh, with the uncompressed file in
the owner's local data: the same meshes and triangles, bounds within 0.01 mm, surface area within
0.1 %, every anchor with its extras, the root node's provenance, and the movable parts' pivots.
This is the second, independent reader of the models: `validate_device_kit.py` reads the raw files
with its own code. A report is written to the owner's local data; the exit status is 1 on failure.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import bpy
import bmesh

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))
from local_data import local_data_path  # noqa: E402

MANIFEST = REPO / "public/models/medical-thoracoscopy/v1/devices/manifest.json"
RAW = ("raw-assets", "medical-thoracoscopy", "devices", "raw")
REPORT = ("raw-assets", "medical-thoracoscopy", "devices", "validation-packaged.json")
BOUNDS_TOLERANCE = 0.01  # mm; Draco keeps 16 bits of position
AREA_TOLERANCE = 0.001


def load(path: Path) -> dict:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    meshes = {}
    anchors = {}
    roots = {}
    pivots = {}
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            bm.transform(obj.matrix_world)
            triangles = sum(len(face.verts) - 2 for face in bm.faces)
            area = sum(face.calc_area() for face in bm.faces)
            xs = [v.co.x for v in bm.verts]
            ys = [v.co.y for v in bm.verts]
            zs = [v.co.z for v in bm.verts]
            meshes[obj.name] = {
                "triangles": triangles,
                "area": area,
                "bounds": [min(xs), min(ys), min(zs), max(xs), max(ys), max(zs)],
                "materials": sorted(slot.material.name for slot in obj.material_slots if slot.material),
            }
            bm.free()
            if "pivot" in obj.keys():
                pivots[obj.name] = obj["pivot"]
        elif obj.name.startswith("anchor:"):
            anchors[obj.name] = {key: (list(obj[key]) if key in ("position", "direction") else obj[key])
                                 for key in ("anchor", "position", "direction", "description") if key in obj.keys()}
        elif obj.name.startswith("device:"):
            roots[obj.name] = {key: obj[key] for key in obj.keys() if not key.startswith("_")}
    return {"meshes": meshes, "anchors": anchors, "roots": roots, "pivots": pivots}


def main() -> int:
    manifest = json.loads(MANIFEST.read_text())
    failures = []
    summaries = []
    for model in manifest["models"]:
        name = model["id"]
        packaged_path = MANIFEST.parent / model["file"]
        raw_path = local_data_path(*RAW, f"{name}.glb")

        def fail(check, detail):
            failures.append({"model": name, "check": check, "detail": detail})

        if hashlib.sha256(packaged_path.read_bytes()).hexdigest() != model["sha256"]:
            fail("file hash", model["file"])
        packaged = load(packaged_path)
        raw = load(raw_path)
        if sorted(packaged["meshes"]) != sorted(raw["meshes"]):
            fail("same meshes", {"packaged": sorted(packaged["meshes"]), "raw": sorted(raw["meshes"])})
        for mesh, before in raw["meshes"].items():
            after = packaged["meshes"].get(mesh)
            if after is None:
                continue
            if after["triangles"] != before["triangles"]:
                fail(f"{mesh} triangles", {"packaged": after["triangles"], "raw": before["triangles"]})
            worst = max(abs(a - b) for a, b in zip(after["bounds"], before["bounds"]))
            if worst > BOUNDS_TOLERANCE:
                fail(f"{mesh} bounds", round(worst, 5))
            if abs(after["area"] - before["area"]) > AREA_TOLERANCE * before["area"]:
                fail(f"{mesh} surface area", {"packaged": after["area"], "raw": before["area"]})
            if after["materials"] != before["materials"]:
                fail(f"{mesh} materials", {"packaged": after["materials"], "raw": before["materials"]})
        if packaged["anchors"] != raw["anchors"]:
            fail("anchors and their extras", {"packaged": sorted(packaged["anchors"]), "raw": sorted(raw["anchors"])})
        expected_anchors = {f"anchor:{key}" for key in model["anchors"]}
        if set(packaged["anchors"]) != expected_anchors:
            fail("anchors named in the manifest", sorted(set(packaged["anchors"]) ^ expected_anchors))
        if packaged["roots"] != raw["roots"] or len(packaged["roots"]) != 1:
            fail("root provenance", {"packaged": list(packaged["roots"]), "raw": list(raw["roots"])})
        root = next(iter(packaged["roots"].values()), {})
        if root.get("label") != manifest["label"] or root.get("units") != "mm":
            fail("label and units", {"label": root.get("label"), "units": root.get("units")})
        if root.get("definitionsSha256") != manifest["definitionsSha256"]:
            fail("definitions hash in the model equals the manifest's", root.get("definitionsSha256"))
        if packaged["pivots"] != raw["pivots"]:
            fail("movable parts keep their pivots", {"packaged": packaged["pivots"], "raw": raw["pivots"]})
        summaries.append({
            "model": name,
            "meshes": len(packaged["meshes"]),
            "triangles": sum(mesh["triangles"] for mesh in packaged["meshes"].values()),
            "anchors": len(packaged["anchors"]),
        })

    report = {
        "report": "medical-thoracoscopy-device-kit-packaged-validation",
        "blenderVersion": bpy.app.version_string,
        "manifestGeometryDigest": manifest["geometryDigest"],
        "passed": not failures,
        "models": summaries,
        "failures": failures,
    }
    path = local_data_path(*REPORT)
    path.write_text(json.dumps(report, indent=2) + "\n")
    for failure in failures:
        print("✗", failure["model"], "—", failure["check"], json.dumps(failure["detail"], default=str))
    print(f"{len(summaries)} packaged models imported in Blender {bpy.app.version_string}; "
          f"{len(failures)} failures. Report: {path}")
    return 1 if failures else 0


sys.exit(main())
