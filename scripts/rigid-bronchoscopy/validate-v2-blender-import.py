"""Import every rigid-bronchoscopy v2 GLB in a clean Blender scene.

Run with Blender, not the system Python:

  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/rigid-bronchoscopy/validate-v2-blender-import.py -- \
    public/models/rigid-bronchoscopy/v2/asset-manifest.json \
    public/models/rigid-bronchoscopy/v2/blender-import-validation.json
"""

from __future__ import annotations

import json
import math
import sys
from datetime import date
from pathlib import Path

import bpy


def args_after_separator() -> list[str]:
    if "--" not in sys.argv:
        raise SystemExit("Expected MANIFEST_PATH and REPORT_PATH after --")
    return sys.argv[sys.argv.index("--") + 1 :]


arguments = args_after_separator()
if len(arguments) != 2:
    raise SystemExit("Expected exactly MANIFEST_PATH and REPORT_PATH")

manifest_path = Path(arguments[0]).resolve()
report_path = Path(arguments[1]).resolve()
repo_root = manifest_path.parents[4]
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
failures = []
summaries = []

for asset in manifest["assets"]:
    path = repo_root / "public" / asset["path"].lstrip("/")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.import_scene.gltf(filepath=str(path))
    except Exception as error:  # Blender importer exceptions are runtime-specific.
        failures.append({"id": asset["id"], "check": "import", "detail": str(error)})
        continue

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    triangle_count = sum(
        sum(max(0, len(polygon.vertices) - 2) for polygon in obj.data.polygons)
        for obj in meshes
    )
    if len(meshes) != asset["geometry"]["meshCount"]:
        failures.append(
            {
                "id": asset["id"],
                "check": "meshCount",
                "detail": {
                    "expected": asset["geometry"]["meshCount"],
                    "actual": len(meshes),
                },
            }
        )
    if triangle_count != asset["geometry"]["triangleCount"]:
        failures.append(
            {
                "id": asset["id"],
                "check": "triangleCount",
                "detail": {
                    "expected": asset["geometry"]["triangleCount"],
                    "actual": triangle_count,
                },
            }
        )
    for obj in meshes:
        if not obj.material_slots or any(slot.material is None for slot in obj.material_slots):
            failures.append(
                {"id": asset["id"], "check": "material", "detail": obj.name}
            )
        if any(not math.isfinite(value) for vertex in obj.data.vertices for value in vertex.co):
            failures.append(
                {"id": asset["id"], "check": "finiteVertices", "detail": obj.name}
            )
    summaries.append(
        {
            "id": asset["id"],
            "path": asset["path"],
            "meshCount": len(meshes),
            "triangleCount": triangle_count,
        }
    )

failed_ids = {failure["id"] for failure in failures}
report = {
    "schema": "rigid_bronchoscopy_blender_import_validation/v2",
    "validatedOn": date.today().isoformat(),
    "manifest": str(manifest_path.relative_to(repo_root)),
    "manifestBuildId": manifest["buildId"],
    "blenderVersion": bpy.app.version_string,
    "passed": not failures,
    "assetCount": len(manifest["assets"]),
    "importedWithoutFailure": len(manifest["assets"]) - len(failed_ids),
    "triangleCount": sum(summary["triangleCount"] for summary in summaries),
    "assetSummaries": summaries,
    "failures": failures,
}
report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(
    json.dumps(
        {
            "passed": report["passed"],
            "assetCount": report["assetCount"],
            "importedWithoutFailure": report["importedWithoutFailure"],
            "triangleCount": report["triangleCount"],
            "blenderVersion": report["blenderVersion"],
            "report": str(report_path.relative_to(repo_root)),
        }
    )
)
if failures:
    raise SystemExit(1)
