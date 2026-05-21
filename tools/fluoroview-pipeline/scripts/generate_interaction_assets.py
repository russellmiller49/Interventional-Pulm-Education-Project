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
    manifest["geometry"]["overlay_calibration"] = {
        **manifest["geometry"].get("overlay_calibration", {}),
        "method": "centerline-carina",
        "carina_lps_mm": graph["carinaLpsMm"],
        "source_curves": ["Network curve (0)", "Network curve (1)", "Network curve (2)"],
        "note": (
            "Carina anchor from the updated centerline network curves; used to align the "
            "airway, nodule, and scope overlays to the DRR detector."
        ),
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
