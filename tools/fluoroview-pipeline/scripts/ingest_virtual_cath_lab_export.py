"""Ingest a SlicerHeart Virtual Cath Lab export into a public FluoroView case.

The source export may live under ignored raw-workspace paths such as ``fluoro_2``. This script
copies only derived PNGs and sanitized non-PHI geometry metadata into ``public/fluoroview``.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
from typing import Any


RAW_EXTENSIONS = {".dcm", ".nii", ".nrrd", ".stl", ".obj"}
RAW_SUFFIXES = {".nii.gz"}
PUBLIC_SUBDIR = "virtual-cath-lab"
METADATA_FILENAME = "virtual_cath_lab_ingest_manifest.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--export-dir", required=True, help="Folder containing virtual_cath_lab_bundle.json")
    parser.add_argument("--case-dir", required=True, help="Public case folder to update")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    export_dir = Path(args.export_dir)
    case_dir = Path(args.case_dir)
    bundle_path = export_dir / "virtual_cath_lab_bundle.json"
    manifest_path = case_dir / "case_manifest.json"
    public_vcl_dir = case_dir / PUBLIC_SUBDIR
    metadata_dir = case_dir / "metadata"

    validate_no_raw_files(export_dir)
    bundle = load_json(bundle_path)

    public_vcl_dir.mkdir(parents=True, exist_ok=True)
    metadata_dir.mkdir(parents=True, exist_ok=True)

    frames = copy_c_arm_frames(bundle, export_dir, public_vcl_dir, case_dir)
    ingest_manifest = build_ingest_manifest(bundle, frames)
    ingest_path = metadata_dir / METADATA_FILENAME
    ingest_path.write_text(json.dumps(ingest_manifest, indent=2) + "\n", encoding="utf-8")
    update_case_manifest(manifest_path, ingest_manifest)

    print(f"Copied {len(frames)} Virtual Cath Lab frame(s) to {public_vcl_dir}")
    print(f"Wrote {ingest_path}")
    print(f"Updated {manifest_path}")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_no_raw_files(root: Path) -> None:
    raw_files = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        suffix = "".join(path.suffixes[-2:]).lower()
        if path.suffix.lower() in RAW_EXTENSIONS or suffix in RAW_SUFFIXES:
            raw_files.append(path)
    if raw_files:
        joined = "\n".join(str(path) for path in raw_files[:20])
        raise SystemExit(f"Raw source-like files found in Virtual Cath Lab export; aborting:\n{joined}")


def copy_c_arm_frames(
    bundle: dict[str, Any],
    export_dir: Path,
    public_vcl_dir: Path,
    case_dir: Path,
) -> list[dict[str, Any]]:
    frames = []
    case_id = case_dir.name
    for frame in bundle.get("virtualCathLab", {}).get("cArmVolumes", []):
        file_name = frame.get("file")
        if not file_name:
            continue
        source = export_dir / str(file_name)
        if not source.exists():
            continue
        if is_blank_frame(frame):
            continue
        destination = public_vcl_dir / source.name
        shutil.copy2(source, destination)
        image_url = f"/fluoroview/cases/{case_id}/{PUBLIC_SUBDIR}/{destination.name}"
        frames.append(
            {
                "id": safe_id(str(frame.get("nodeName", destination.stem))),
                "nodeName": frame.get("nodeName"),
                "imageUrl": image_url,
                "dimensionsIJK": frame.get("dimensionsIJK"),
                "spacingIJKMm": frame.get("spacingIJKMm"),
                "detectorSizeMm": detector_size_mm(frame),
                "scalarRange": frame.get("scalarRange"),
                "sha256": sha256(destination),
                "relativePath": str(destination.relative_to(case_dir)),
            }
        )
    return frames


def is_blank_frame(frame: dict[str, Any]) -> bool:
    dims = frame.get("dimensionsIJK") or []
    scalar_range = frame.get("scalarRange") or []
    if len(dims) >= 2 and (int(dims[0]) <= 1 or int(dims[1]) <= 1):
        return True
    if len(scalar_range) >= 2 and float(scalar_range[0]) == float(scalar_range[1]):
        return True
    return False


def detector_size_mm(frame: dict[str, Any]) -> list[float] | None:
    dims = frame.get("dimensionsIJK") or []
    spacing = frame.get("spacingIJKMm") or []
    if len(dims) < 2 or len(spacing) < 2:
        return None
    return [float(dims[0]) * float(spacing[0]), float(dims[1]) * float(spacing[1])]


def build_ingest_manifest(bundle: dict[str, Any], frames: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "source": "SlicerHeart Virtual Cath Lab",
        "sourceSchema": bundle.get("schema"),
        "ingestedUtc": datetime.now(timezone.utc).isoformat(),
        "sourceCreatedUtc": bundle.get("createdUtc"),
        "coordinateSystem": bundle.get("coordinateSystem", "RAS"),
        "units": bundle.get("units", "mm"),
        "frames": frames,
        "geometry": {
            "parameterNodes": sanitize_parameter_nodes(
                bundle.get("virtualCathLab", {}).get("parameterNodes", [])
            ),
            "frontalCamera": find_camera(bundle, "CArmFrontal"),
            "frontalDetectorTransform": find_transform(bundle, "frontal-arm-detector-rotation-transform"),
            "frontalCameraTransform": find_transform(bundle, "frontal-camera-to-frontal-detector"),
            "gantryToRas": find_transform(bundle, "gantry-to-ras"),
            "positioningTransform": find_transform(bundle, "PositioningTransform"),
            "tableTransforms": [
                transform_summary(transform)
                for transform in bundle.get("transforms", [])
                if "table-" in str(transform.get("name", ""))
            ],
        },
        "anatomy": {
            "segmentations": [
                segmentation_summary(segmentation)
                for segmentation in bundle.get("segmentations", [])
            ],
            "models": [
                model_summary(model)
                for model in bundle.get("models", [])
                if not is_c_arm_model(model)
            ],
            "markups": [
                markup_summary(markup)
                for markup in bundle.get("markups", [])
            ],
        },
        "notes": [
            "Derived metadata only; raw volume/model storage paths are intentionally omitted.",
            "The current frontal reference frame may include the airway model baked into the rendered X-ray.",
        ],
    }


def sanitize_parameter_nodes(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    sanitized = []
    for node in nodes:
        sanitized.append(
            {
                "id": node.get("id"),
                "name": node.get("name"),
                "moduleName": node.get("moduleName"),
                "parameters": node.get("parameters", {}),
                "nodeReferences": node.get("nodeReferences", {}),
            }
        )
    return sanitized


def find_camera(bundle: dict[str, Any], active_tag_fragment: str) -> dict[str, Any] | None:
    for camera in bundle.get("cameras", []):
        if active_tag_fragment in str(camera.get("activeTag", "")):
            return camera_summary(camera)
    return None


def camera_summary(camera: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": camera.get("id"),
        "name": camera.get("name"),
        "activeTag": camera.get("activeTag"),
        "positionRASMm": camera.get("positionRASMm"),
        "focalPointRASMm": camera.get("focalPointRASMm"),
        "viewUpRAS": camera.get("viewUpRAS"),
        "viewAngleDeg": camera.get("viewAngleDeg"),
        "parallelProjection": camera.get("parallelProjection"),
        "clippingRangeMm": camera.get("clippingRangeMm"),
    }


def find_transform(bundle: dict[str, Any], name: str) -> dict[str, Any] | None:
    for transform in bundle.get("transforms", []):
        if transform.get("name") == name:
            return transform_summary(transform)
    return None


def transform_summary(transform: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": transform.get("id"),
        "name": transform.get("name"),
        "className": transform.get("className"),
        "parentTransformNodeId": transform.get("parentTransformNodeId"),
        "matrixToWorldRAS": transform.get("matrixToWorldRAS"),
        "isLinear": transform.get("isLinear"),
    }


def segmentation_summary(segmentation: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": segmentation.get("id"),
        "name": segmentation.get("name"),
        "parentTransformNodeId": segmentation.get("parentTransformNodeId"),
        "rasBoundsMm": segmentation.get("rasBoundsMm"),
        "worldTransformFromParent": segmentation.get("worldTransformFromParent"),
        "segmentCount": segmentation.get("segmentCount"),
        "segments": [
            {
                "id": segment.get("id"),
                "name": segment.get("name"),
                "color": segment.get("color"),
                "localBoundsMm": segment.get("localBoundsMm"),
                "numberOfPoints": segment.get("numberOfPoints"),
                "numberOfCells": segment.get("numberOfCells"),
                "samplePointsRAS": segment.get("samplePointsRAS"),
            }
            for segment in segmentation.get("segments", [])
        ],
    }


def model_summary(model: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": model.get("id"),
        "name": model.get("name"),
        "parentTransformNodeId": model.get("parentTransformNodeId"),
        "rasBoundsMm": model.get("rasBoundsMm"),
        "localBoundsMm": model.get("localBoundsMm"),
        "numberOfPoints": model.get("numberOfPoints"),
        "numberOfCells": model.get("numberOfCells"),
        "worldTransformFromParent": model.get("worldTransformFromParent"),
        "samplePointsRAS": model.get("samplePointsRAS"),
    }


def markup_summary(markup: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": markup.get("id"),
        "name": markup.get("name"),
        "className": markup.get("className"),
        "parentTransformNodeId": markup.get("parentTransformNodeId"),
        "worldTransformFromParent": markup.get("worldTransformFromParent"),
        "controlPoints": markup.get("controlPoints", []),
    }


def is_c_arm_model(model: dict[str, Any]) -> bool:
    name = str(model.get("name", "")).lower()
    return (
        name.startswith("frontal-")
        or name.startswith("lateral-")
        or name.startswith("table-")
        or "genericfluoro" in name
    )


def update_case_manifest(manifest_path: Path, ingest_manifest: dict[str, Any]) -> None:
    manifest = load_json(manifest_path)
    case_id = manifest_path.parent.name
    frames = ingest_manifest.get("frames", [])
    frontal_frame = next((frame for frame in frames if "Frontal" in str(frame.get("nodeName"))), None)
    frontal_dimensions = frontal_frame.get("dimensionsIJK") if frontal_frame else None
    frontal_spacing = frontal_frame.get("spacingIJKMm") if frontal_frame else None
    manifest["assets"] = {
        **manifest.get("assets", {}),
        "virtualCathLabManifest": f"/fluoroview/cases/{case_id}/metadata/{METADATA_FILENAME}",
        "virtualCathLabFrontalImage": frontal_frame.get("imageUrl") if frontal_frame else None,
    }
    manifest["virtualCathLab"] = {
        "source": "SlicerHeart Virtual Cath Lab",
        "status": "reference-export",
        "manifestUrl": f"/fluoroview/cases/{case_id}/metadata/{METADATA_FILENAME}",
        "frontalImageUrl": frontal_frame.get("imageUrl") if frontal_frame else None,
        "frontalDetectorPixels": frontal_dimensions[:2] if frontal_dimensions else None,
        "frontalDetectorSizeMm": frontal_frame.get("detectorSizeMm") if frontal_frame else None,
        "frontalPixelSpacingMm": frontal_spacing[:2] if frontal_spacing else None,
        "coordinateSystem": ingest_manifest.get("coordinateSystem", "RAS"),
        "note": (
            "SlicerHeart reference export is available for C-arm calibration. The current "
            "frontal image may include the airway model baked into the rendered X-ray, so it "
            "is used as calibration evidence before replacing the TIGRE atlas."
        ),
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def safe_id(value: str) -> str:
    return "".join(char.lower() if char.isalnum() else "-" for char in value).strip("-")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


if __name__ == "__main__":
    main()
