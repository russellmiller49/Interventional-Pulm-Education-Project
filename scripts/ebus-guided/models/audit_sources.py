"""Run with Slicer Python; inspect immutable source geometry and native image coordinates.

Only a sanitized derived audit is written. Original CT/segmentation are never modified.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

import numpy as np
import slicer
import vtk

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))
from local_data import local_data_path


def main():
    native = local_data_path("raw-assets", "ebus-guided-models", "phase-1")
    native.mkdir(parents=True, exist_ok=True)
    case = ROOT / "EBUS-course/apps/web/public/simulator/case-001"
    loader_spec = importlib.util.spec_from_file_location("source_meshes", ROOT / "EBUS-course/scripts/cases/build-acoustic-volume.py")
    loader = importlib.util.module_from_spec(loader_spec)
    loader_spec.loader.exec_module(loader)
    surfaces, geometry_hash = loader.meshes(case / "models/simplified_sim_model.glb")
    rows = []
    for name, lps, web, triangles in surfaces:
        rows.append({"name": name, "triangles": len(triangles), "centerWebMm": web.mean(axis=0).tolist(),
                     "boundsWebMm": [web.min(axis=0).tolist(), web.max(axis=0).tolist()],
                     "sourceType": "existing-presentation-mesh", "anatomicalReview": "pending"})
    volume = slicer.util.loadVolume(str(ROOT / "EBUS-course/model/case_001_ct.nrrd"))
    seg = slicer.util.loadSegmentation(str(ROOT / "EBUS-course/model/case_001_segmentation.nrrd"))
    ijk = vtk.vtkMatrix4x4()
    volume.GetIJKToRASMatrix(ijk)
    segment_names = [seg.GetSegmentation().GetNthSegment(i).GetName() for i in range(seg.GetSegmentation().GetNumberOfSegments())]
    report = {
        "schema": "ebus-source-audit/v1", "caseId": "case-001", "sourceGeometrySha256": geometry_hash,
        "ct": {"sizeIjk": list(volume.GetImageData().GetDimensions()),
               "ijkToRas": [[ijk.GetElement(r, c) for c in range(4)] for r in range(4)],
               "role": "historical CT reference; registration to presentation geometry is not established"},
        "sourceSegmentationNames": segment_names, "meshes": rows,
        "existingAcousticDependency": json.loads((case / "geometry/acoustic-v2.json").read_text())["sourceGeometrySha256"],
        "lpsToWeb": [[1, 0, 0, 0], [0, 0, 1, 0], [0, -1, 0, 0], [0, 0, 0, 1]],
        "rasToWeb": [[-1, 0, 0, 0], [0, 0, 1, 0], [0, 1, 0, 0], [0, 0, 0, 1]],
        "limitations": ["Source station meshes are example tissue volumes, not a validated station-compartment atlas.",
                        "No original segmentation edits or patient-specific clinical interpretations performed."]}
    assert report["existingAcousticDependency"] == geometry_hash, "Source and acoustic revision mismatch"
    (native / "source-audit.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"audit": str(native / "source-audit.json"), "meshes": len(rows), "segments": len(segment_names), "sourceGeometrySha256": geometry_hash}))


try:
    main()
except Exception:
    import traceback
    traceback.print_exc()
    slicer.app.exit(1)
else:
    slicer.app.exit(0)
