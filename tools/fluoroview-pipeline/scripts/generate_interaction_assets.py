"""Generate FluoroView airway graph and CT interaction preview assets."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Any

from fluoroview_pipeline.airway_graph import write_airway_graph
from fluoroview_pipeline.ct_preview import export_ct_preview


SAFETY_NOTE = "Derived educational interaction assets; raw source imaging remains local."
ZERO_TRANSLATION_MM = [0, 0, 0]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--new-model-dir", required=True)
    parser.add_argument("--dicom-dir", required=True)
    parser.add_argument("--case-dir", required=True)
    parser.add_argument("--public-asset-dir", required=True)
    parser.add_argument("--stride-xy", type=int, default=2)
    parser.add_argument("--stride-z", type=int, default=2)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    new_model_dir = Path(args.new_model_dir)
    case_dir = Path(args.case_dir)
    public_asset_dir = Path(args.public_asset_dir)
    metadata_dir = case_dir / "metadata"
    ct_dir = case_dir / "ct"

    metadata_dir.mkdir(parents=True, exist_ok=True)
    ct_dir.mkdir(parents=True, exist_ok=True)
    public_asset_dir.mkdir(parents=True, exist_ok=True)

    graph = write_airway_graph(new_model_dir / "centerline", metadata_dir / "airway_graph.json")
    preview = export_ct_preview(
        args.dicom_dir,
        ct_dir / "ct_preview_uint8.raw",
        stride_xy=args.stride_xy,
        stride_z=args.stride_z,
    )
    (ct_dir / "ct_preview_metadata.json").write_text(
        json.dumps(preview.metadata, indent=2) + "\n",
        encoding="utf-8",
    )

    copy_if_exists(new_model_dir / "bronch_animation.glb", public_asset_dir / "bronch_animation.glb")
    update_manifest(case_dir / "case_manifest.json", graph, preview.metadata)

    print(f"Wrote {metadata_dir / 'airway_graph.json'}")
    print(f"Wrote {ct_dir / 'ct_preview_uint8.raw'}")
    print(f"Wrote {ct_dir / 'ct_preview_metadata.json'}")
    print(f"Updated {case_dir / 'case_manifest.json'}")


def copy_if_exists(source: Path, destination: Path) -> None:
    if source.exists():
        shutil.copy2(source, destination)


def update_manifest(manifest_path: Path, graph: dict[str, Any], ct_metadata: dict[str, Any]) -> None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["version"] = "0.2.0"
    manifest["description"] = (
        "Derived educational case generated from local CT source data with a richer distal "
        "airway graph, browser-side nodule placement, and scope-route overlays. Raw source "
        "files remain local and untracked."
    )
    manifest["assets"] = {
        **manifest["assets"],
        "airwayGlb": "/fluoroview/airway_segments_new.glb",
        "airwayFullGlb": "/fluoroview/airway_full.glb",
        "airwaySegmentsGlb": "/fluoroview/airway_segments_new.glb",
        "airwayGraphJson": "/fluoroview/cases/patient-4/metadata/airway_graph.json",
        "scopePathGlb": "/fluoroview/bronch_animation.glb",
        "ctVolumePreview": "/fluoroview/cases/patient-4/ct/ct_preview_uint8.raw",
        "assetTransforms": {
            "airway": {
                "sceneScale": 1000,
                "rotationDeg": [90, 0, 0],
                "positionOffsetMm": [0, 0, 0],
                "note": "Updated Blender GLBs use local X, slice/Z, -Y axes; rotate +90 deg about X into LPS before isocenter calibration.",
            }
        },
    }
    manifest["ctVolume"] = {
        **ct_metadata,
        "rawUrl": "/fluoroview/cases/patient-4/ct/ct_preview_uint8.raw",
    }
    ct_isocenter = ct_volume_center_lps(ct_metadata)
    manifest["geometry"]["isocenter_mm"] = ct_isocenter
    terminal_node_id = max(
        graph["terminalNodeIds"],
        key=lambda node_id: graph["nodes"][node_id]["rootDistanceMm"],
    )
    manifest["interaction"] = {
        "noduleRadiusMm": 10,
        "snapRadiusMm": 20,
        "defaultScopeProgress": 0.45,
        "defaultRouteTerminalNodeId": terminal_node_id,
        "source": SAFETY_NOTE,
    }
    target_detector_percent = detector_percent_for_lps_point(
        graph["carinaLpsMm"],
        ct_isocenter,
        manifest["geometry"],
    )
    manifest["geometry"]["overlay_calibration"] = {
        **manifest["geometry"].get("overlay_calibration", {}),
        "method": "centerline-carina",
        "carina_lps_mm": graph["carinaLpsMm"],
        "target_detector_percent": target_detector_percent,
        "reference_translation_mm": ZERO_TRANSLATION_MM,
        "source_curves": ["Network curve (0)", "Network curve (1)", "Network curve (2)"],
        "note": (
            "C-arm pivot is the CT volume center used by TIGRE and confirmed against a "
            "3D Slicer volume export. The centerline carina is projected from its LPS "
            "coordinate without an artificial detector-plane translation."
        ),
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def ct_volume_center_lps(ct_metadata: dict[str, Any]) -> list[float]:
    origin = [float(value) for value in ct_metadata["originLps"]]
    size = [float(value) for value in ct_metadata["originalSizeXyz"]]
    stride_value = ct_metadata.get("stride", [1, 1, 1])
    if isinstance(stride_value, (int, float)):
        stride = [float(stride_value)] * 3
    else:
        stride = [float(value) for value in stride_value]
    preview_spacing = [float(value) for value in ct_metadata["spacingXyzMm"]]
    spacing = [preview_spacing[index] / stride[index] for index in range(3)]
    return [origin[index] + spacing[index] * (size[index] - 1) / 2 for index in range(3)]


def detector_percent_for_lps_point(
    point_lps: list[float],
    isocenter_lps: list[float],
    geometry: dict[str, Any],
) -> list[float]:
    detector_width_mm = float(geometry["detector_pixels"][0]) * float(geometry["pixel_pitch_mm"])
    detector_height_mm = float(geometry["detector_pixels"][1]) * float(geometry["pixel_pitch_mm"])
    source_to_isocenter_mm = float(geometry["source_to_isocenter_mm"])
    local_point = [point_lps[index] - isocenter_lps[index] for index in range(3)]
    magnification = source_to_isocenter_mm / max(
        source_to_isocenter_mm + local_point[1],
        1.0,
    )
    return [
        50 + ((local_point[0] * magnification) / detector_width_mm) * 100,
        50 - ((local_point[2] * magnification) / detector_height_mm) * 100,
    ]


if __name__ == "__main__":
    main()
