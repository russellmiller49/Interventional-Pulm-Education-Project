"""Slicer: verify exported geometry and save a derived review scene, never the source CT.

Run after audit_sources.py and build_models.py in an isolated Slicer process.
The native label map is the browser's acoustic anatomy, not a CT segmentation.
"""
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

import numpy as np
from scipy.spatial import cKDTree
import slicer
import vtk

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))
from local_data import local_data_path


def main():
    native = local_data_path("raw-assets", "ebus-guided-models", "phase-1")
    case = ROOT / "EBUS-course/apps/web/public/simulator/case-001"
    out = case / "models/guided-v1"
    spec = importlib.util.spec_from_file_location("mesh_loader", ROOT / "EBUS-course/scripts/cases/build-acoustic-volume.py")
    loader = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loader)
    source, source_hash = loader.meshes(case / "models/simplified_sim_model.glb")
    derived = []
    for filename in ["mediastinum-teaching.glb", "node-examples.glb"]:
        rows, _ = loader.meshes(out / filename)
        derived += rows
    manifest = json.loads((out / "asset-manifest.json").read_text())
    assert source_hash == manifest["sourceGeometrySha256"]
    report = []
    for name, _, points, faces in source:
        ident = loader.key_for(name)
        ids = ["trachea", "carina", "right_main_bronchus", "left_main_bronchus", "distal_airway_branches"] if ident == "airway" else ["node_"+ident if ident.startswith("station_") else ident]
        parts = [row for row in derived if row[0] in ids]
        assert parts, name
        other = np.concatenate([row[2] for row in parts])
        centers = points[faces].mean(axis=1)
        other_centers = np.concatenate([row[2][row[3]].mean(axis=1) for row in parts])
        assert len(centers) == len(other_centers), name+" triangle count changed"
        error = max(cKDTree(points).query(other)[0].max(), cKDTree(other).query(points)[0].max(), cKDTree(centers).query(other_centers)[0].max())
        assert error < .002, (name, error)
        report.append({"source": name, "exportIds": ids, "triangles": len(faces), "maxRoundTripErrorMm": float(error)})
    assert len(derived) == sum(len(row["exportIds"]) for row in report)
    # Verify the legacy tip AFTER applying its original calibration, not only its raw file.
    old_tip, _ = loader.meshes(case / "models/device/EBUS_tip.glb")
    device = json.loads((out / "device-geometry.json").read_text())
    new_tip, _ = loader.meshes(out / "ebus-scope-teaching.glb")
    original = np.concatenate([row[2] for row in old_tip]) / 1000
    expected = (original - np.array(device["originalAnchor"])) * device["originalScaleMmPerUnit"]
    actual = next(row[2] for row in new_tip if row[0] == "legacy_distal_body")
    tip_error = max(cKDTree(expected).query(actual)[0].max(), cKDTree(actual).query(expected)[0].max())
    assert tip_error < .002, tip_error
    # The scene contains separately selectable surface models, node examples, and markups.
    for name, lps, _, triangles in derived:
        ras = lps.copy(); ras[:, :2] *= -1
        model = slicer.modules.models.logic().AddModel(loader.polydata(ras, triangles))
        model.SetName(name)
        model.SetAttribute("EBUS.SourceGeometrySha256", source_hash)
        model.SetAttribute("EBUS.ReviewStatus", "pending")
        display = model.GetDisplayNode()
        display.SetColor(*((.67,.75,.4) if name.startswith("node_") else (.7,.45,.43) if "bronchus" in name or name in ["carina","trachea","distal_airway_branches"] else (.4,.55,.7)))
    markups = slicer.mrmlScene.AddNewNodeByClass("vtkMRMLMarkupsFiducialNode", "Teaching_landmarks_REVIEW_PENDING")
    for landmark in json.loads((out / "landmarks.json").read_text())["landmarks"]:
        x, y, z = landmark["positionWebMm"]
        markups.AddControlPoint(vtk.vtkVector3d(-x, z, y), landmark["label"])
    slicer.util.saveNode(markups, str(native / "landmarks.mrk.json"))
    meta = json.loads((case / "geometry/acoustic-v2.json").read_text())
    raw = gzip.decompress((case / "geometry/acoustic-v2.u8.gz").read_bytes())
    assert hashlib.sha256(raw).hexdigest() == meta["decodedSha256"]
    label = slicer.mrmlScene.AddNewNodeByClass("vtkMRMLLabelMapVolumeNode", "Model_labels_NOT_CT")
    slicer.util.updateVolumeFromArray(label, np.frombuffer(raw, dtype=np.uint8).reshape(tuple(meta["sizeXyz"][::-1])))
    mat = vtk.vtkMatrix4x4(); mat.Identity()
    for axis in range(3):
        sign = -1 if axis < 2 else 1
        mat.SetElement(axis, axis, sign * meta["spacingXyzMm"][axis])
        mat.SetElement(axis, 3, sign * meta["originLps"][axis])
    label.SetIJKToRASMatrix(mat)
    label.SetAttribute("EBUS.SourceGeometrySha256", source_hash)
    colors = slicer.mrmlScene.AddNewNodeByClass("vtkMRMLColorTableNode", "Model_label_names")
    colors.SetTypeToUser(); colors.SetNumberOfColors(256); colors.NamesInitialisedOn()
    colors.SetColor(0, "Outside model", 0, 0, 0, 0)
    for row in meta["labels"]:
        if row["id"]:
            colors.SetColor(row["id"], row["label"], .3+(row["id"]%3)*.2, .4, .6, 1)
    label.CreateDefaultDisplayNodes(); label.GetDisplayNode().SetAndObserveColorNodeID(colors.GetID())
    segmentation = slicer.mrmlScene.AddNewNodeByClass("vtkMRMLSegmentationNode", "Acoustic_model_segmentation_NOT_CT")
    segmentation.CreateDefaultDisplayNodes()
    slicer.modules.segmentations.logic().ImportLabelmapToSegmentationNode(label, segmentation)
    segmentation.GetDisplayNode().SetVisibility(False)
    assert slicer.util.saveNode(segmentation, str(native / "acoustic-model.seg.nrrd"))
    assert slicer.util.saveScene(str(native / "mediastinum-review.mrb"))
    result = {"schema":"ebus-model-validation/v1", "sourceGeometrySha256":source_hash,
              "coordinateToleranceMm":.002, "anatomy":report, "tipMaxRoundTripErrorMm":float(tip_error),
              "assets":[{"path":a["path"],"sha256":a["sha256"]} for a in manifest["assets"]],
              "result":"PASS", "clinicalAnatomicalReview":"pending", "sourceCtIncluded":False}
    (out / "geometry-validation.json").write_text(json.dumps(result, indent=2)+"\n")
    print("EBUS_GUIDED_VALIDATION", json.dumps({"result":"PASS", "structures":len(report), "maxErrorMm":max(r["maxRoundTripErrorMm"] for r in report), "tipErrorMm":float(tip_error)}))


try:
    main()
except Exception:
    import traceback
    traceback.print_exc()
    slicer.app.exit(1)
else:
    slicer.app.exit(0)
