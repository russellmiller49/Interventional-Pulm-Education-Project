"""Import every packaged anatomy file in Blender and compare it with the file before packaging.

Run with Blender 5.1, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \\
        --python scripts/medical-thoracoscopy/validate_anatomy_blender.py

For each file in the packaged manifest in the owner's local data, Blender's own importer decodes
the packaged file (Draco, 16-bit quantised positions, morph targets) and the file as built, and
they are compared object by object: the same meshes, triangles and points, bounds within 0.02 mm,
surface area within 0.1 %, and the root's label, attribution, frame, presentation and gravity. The lung and
its proxy are compared state by state: each shape key, applied in Blender, must hold the volume
the committed record gives for that state. This is the independent reader of the anatomy:
`validate_thorax_surfaces.py` and `validate_lung_states.py` read the files with the module's own
code. A report is written to the owner's local data; the exit status is 1 on failure.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import bmesh
import bpy

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))
from local_data import local_data_path  # noqa: E402

ANATOMY = ("raw-assets", "medical-thoracoscopy", "anatomy")
RECORDS = REPO / "src/features/medical-thoracoscopy/content/data/anatomy"
BOUNDS_TOLERANCE = 0.02  # mm; Draco keeps 16 bits of position over about 300 mm
AREA_TOLERANCE = 0.001
VOLUME_TOLERANCE_ML = 0.5


def measure(obj, key=None) -> dict:
    """Triangles, area, bounds and signed volume of a mesh object, optionally at one shape key."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    if key is not None:
        layer = bm.verts.layers.shape.get(key)
        for vert in bm.verts:
            vert.co = vert[layer]
    bm.transform(obj.matrix_world)
    xs, ys, zs = ([v.co[i] for v in bm.verts] for i in range(3))
    out = {
        "vertices": len(bm.verts),
        "triangles": sum(len(face.verts) - 2 for face in bm.faces),
        "area": sum(face.calc_area() for face in bm.faces),
        "bounds": [min(xs), min(ys), min(zs), max(xs), max(ys), max(zs)] if xs else [],
        "volumeMl": bm.calc_volume(signed=True) / 1000.0 if bm.faces else 0.0,
    }
    bm.free()
    return out


def load(path: Path) -> dict:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    meshes, keyed, roots = {}, {}, {}
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            meshes[obj.name] = measure(obj)
            keys = obj.data.shape_keys
            if keys is not None:
                keyed[obj.name] = {block.name: measure(obj, block.name) for block in keys.key_blocks}
        if obj.parent is None:
            # read now: the next file's import frees these objects and their properties
            roots[obj.name] = {key: plain(obj[key]) for key in obj.keys() if key in PROVENANCE}
    return {"meshes": meshes, "keyed": keyed, "roots": roots}


PROVENANCE = ("label", "attribution", "frame", "presentationFromLps", "gravityLps")


def plain(value):
    """A Blender custom property as a plain JSON value. Arrays are read element by element: their
    `to_list()` fails in Blender 5.1 for the arrays the glTF importer makes of nested lists."""
    if hasattr(value, "to_dict"):
        return {key: plain(value[key]) for key in value.keys()}
    if hasattr(value, "typecode"):
        return [value[i] for i in range(len(value))]
    if isinstance(value, (list, tuple)):
        return [plain(item) for item in value]
    return value


def provenance(roots: dict) -> dict:
    root = next(iter(roots.values()), {})
    return {key: root[key] for key in PROVENANCE if key in root}


def main() -> int:
    packaged_dir = local_data_path(*ANATOMY, "packaged")
    manifest = json.loads((packaged_dir / "manifest.json").read_text())
    lung_record = json.loads((RECORDS / "lung-states.json").read_text())
    failures, summaries = [], []
    for entry in manifest["files"]:
        name = entry["id"]

        def fail(check, detail):
            failures.append({"file": name, "check": check, "detail": detail})

        packaged_path = packaged_dir / entry["file"]
        raw_path = local_data_path(*ANATOMY, "raw", f"{name}.glb")
        if hashlib.sha256(packaged_path.read_bytes()).hexdigest() != entry["sha256"]:
            fail("packaged file hash", entry["file"])
        if hashlib.sha256(raw_path.read_bytes()).hexdigest() != entry["rawSha256"]:
            fail("raw file hash", str(raw_path))
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
            if before["triangles"] == 0 and after["vertices"] != before["vertices"]:
                fail(f"{mesh} points", {"packaged": after["vertices"], "raw": before["vertices"]})
            if before["bounds"]:
                worst = max(abs(a - b) for a, b in zip(after["bounds"], before["bounds"]))
                if worst > BOUNDS_TOLERANCE:
                    fail(f"{mesh} bounds", round(worst, 5))
            if abs(after["area"] - before["area"]) > AREA_TOLERANCE * max(before["area"], 1e-9):
                fail(f"{mesh} surface area", {"packaged": after["area"], "raw": before["area"]})
        roots_packaged = provenance(packaged["roots"])
        if roots_packaged != provenance(raw["roots"]):
            fail("root provenance", sorted(roots_packaged))
        for key in PROVENANCE:
            if roots_packaged.get(key) != manifest[key]:
                fail(f"root {key} equals the manifest's", roots_packaged.get(key))
        if entry["morphTargets"]:
            for mesh, keys in packaged["keyed"].items():
                names = [key for key in keys if key != "Basis"]
                if names != entry["morphTargets"]:
                    fail(f"{mesh} shape keys", names)
            if name == "lung-states":
                keys = next(iter(packaged["keyed"].values()), {})
                for k, state in enumerate(lung_record["states"]):
                    measured = keys.get("Basis" if k == 0 else f"step {k}")
                    if measured is None:
                        fail(f"state {k} present", None)
                        continue
                    if abs(measured["volumeMl"] - state["volumeMl"]) > VOLUME_TOLERANCE_ML:
                        fail(f"state {k} volume equals the record", {"blender": measured["volumeMl"], "record": state["volumeMl"]})
                    if measured["triangles"] != lung_record["lung"]["faces"]:
                        fail(f"state {k} triangles", measured["triangles"])
        summaries.append({
            "file": name,
            "meshes": len(packaged["meshes"]),
            "triangles": sum(m["triangles"] for m in packaged["meshes"].values()),
            "shapeKeys": {mesh: len(keys) for mesh, keys in packaged["keyed"].items()},
        })

    report = {
        "report": "medical-thoracoscopy-anatomy-packaged-validation",
        "blenderVersion": bpy.app.version_string,
        "passed": not failures,
        "files": summaries,
        "failures": failures,
    }
    path = local_data_path(*ANATOMY, "validation-packaged.json")
    path.write_text(json.dumps(report, indent=2, default=str) + "\n")
    for failure in failures:
        print("✗", failure["file"], "—", failure["check"], json.dumps(failure["detail"], default=str))
    print(f"{len(summaries)} packaged anatomy files imported in Blender {bpy.app.version_string}; "
          f"{len(failures)} failures. Report: {path}")
    return 1 if failures else 0


sys.exit(main())
