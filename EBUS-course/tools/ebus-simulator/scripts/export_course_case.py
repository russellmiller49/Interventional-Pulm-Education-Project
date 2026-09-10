from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve()
TOOL_ROOT = SCRIPT_PATH.parents[1]
COURSE_ROOT = SCRIPT_PATH.parents[3]
SOURCE_ROOT = TOOL_ROOT / "src"

if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from ebus_simulator.centerline import CenterlinePolyline
from ebus_simulator.rendering import build_render_context
from ebus_simulator.web_case_export import export_web_case
from ebus_simulator.web_navigation import preset_navigation_entries
from ebus_simulator.web_volume_intersections import (
    DEFAULT_DEPTH_SAMPLES,
    DEFAULT_LATERAL_SAMPLES,
    DEFAULT_SLAB_HALF_THICKNESS_MM,
    DEFAULT_SLAB_SAMPLES,
    build_volume_sector_response,
)


DEFAULT_MANIFEST = TOOL_ROOT / "configs" / "3d_slicer_files.yaml"
DEFAULT_OUTPUT_DIR = COURSE_ROOT / "apps" / "web" / "public" / "simulator" / "case-001"
DEFAULT_CLEAN_MODEL_DIR = COURSE_ROOT / "model"
DEFAULT_SCOPE_MODEL = TOOL_ROOT / "model" / "EBUS_tip.glb"


def snapshot_file_name(preset_key: str) -> str:
    return f"{re.sub(r'[^A-Za-z0-9_-]+', '__', preset_key).strip('_')}.json"


def load_json(path: Path) -> dict[str, object]:
    return json.loads(path.read_text())


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")


def centerlines_from_context(context: object) -> dict[int, CenterlinePolyline]:
    return {int(polyline.line_index): polyline for polyline in context.main_graph.polylines}


def generate_sector_snapshots(
    manifest_path: Path,
    output_dir: Path,
    *,
    preset_keys: set[str] | None = None,
) -> dict[str, str]:
    context = build_render_context(manifest_path)
    centerlines = centerlines_from_context(context)
    presets = preset_navigation_entries(context)
    web_manifest_path = output_dir / "case_manifest.web.json"
    web_manifest = load_json(web_manifest_path)

    defaults = web_manifest.get("render_defaults", {})
    default_depth = float(defaults.get("max_depth_mm", 40.0)) if isinstance(defaults, dict) else 40.0
    default_sector = float(defaults.get("sector_angle_deg", 60.0)) if isinstance(defaults, dict) else 60.0
    default_roll = float(defaults.get("roll_deg", 0.0)) if isinstance(defaults, dict) else 0.0

    assets = web_manifest.get("assets", {})
    station_keys = [
        str(asset.get("key"))
        for asset in (assets.get("stations", []) if isinstance(assets, dict) else [])
        if isinstance(asset, dict) and asset.get("key")
    ]
    vessel_keys = [
        str(asset.get("key"))
        for asset in (assets.get("vessels", []) if isinstance(assets, dict) else [])
        if isinstance(asset, dict) and asset.get("key")
    ]
    color_map = web_manifest.get("color_map", {})
    resolved_color_map = color_map if isinstance(color_map, dict) else {}

    snapshot_dir = output_dir / "sector_snapshots"
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    snapshot_refs: dict[str, str] = {}
    for preset in presets:
        if preset_keys is not None and preset.preset_key not in preset_keys:
            continue

        response = build_volume_sector_response(
            context,
            centerlines_by_index=centerlines,
            preset=preset,
            line_index=int(preset.line_index),
            centerline_s_mm=float(preset.centerline_s_mm),
            roll_deg=default_roll,
            max_depth_mm=default_depth,
            sector_angle_deg=default_sector,
            station_keys=station_keys,
            vessel_keys=vessel_keys,
            color_map=resolved_color_map,
            depth_samples=DEFAULT_DEPTH_SAMPLES,
            lateral_samples=DEFAULT_LATERAL_SAMPLES,
            slab_half_thickness_mm=DEFAULT_SLAB_HALF_THICKNESS_MM,
            slab_samples=DEFAULT_SLAB_SAMPLES,
        )
        relative_path = f"sector_snapshots/{snapshot_file_name(preset.preset_key)}"
        write_json(
            output_dir / relative_path,
            {
                "schema_version": 1,
                "preset_key": preset.preset_key,
                "query": {
                    "line_index": int(preset.line_index),
                    "s_mm": float(preset.centerline_s_mm),
                    "roll_deg": default_roll,
                    "max_depth_mm": default_depth,
                    "sector_angle_deg": default_sector,
                },
                "response": response,
            },
        )
        snapshot_refs[preset.preset_key] = relative_path

    return snapshot_refs


def export_course_case(
    *,
    manifest_path: Path,
    output_dir: Path,
    clean_model_dir: Path,
    scope_model_path: Path,
    preset_keys: set[str] | None,
    skip_snapshots: bool,
) -> None:
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    result = export_web_case(
        manifest_path,
        output_dir=output_dir,
        clean_model_dir=clean_model_dir,
        scope_model_path=scope_model_path,
    )
    snapshot_refs = {} if skip_snapshots else generate_sector_snapshots(manifest_path, output_dir, preset_keys=preset_keys)

    manifest_asset_path = Path(result.manifest_path)
    web_manifest = load_json(manifest_asset_path)
    web_manifest["sector_snapshots"] = snapshot_refs
    notes = web_manifest.setdefault("notes", {})
    if isinstance(notes, dict):
        notes["course_export"] = (
            "Static SoCal EBUS Prep learner asset. Sector snapshots are precomputed for station snaps; "
            "free navigation uses the browser point-cloud fallback."
        )
    write_json(manifest_asset_path, web_manifest)

    print(f"web_case: {result.output_dir}")
    print(f"manifest: {result.manifest_path}")
    print(f"presets: {result.preset_count}")
    print(f"sector_snapshots: {len(snapshot_refs)}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export the static simulator case consumed by the SoCal EBUS Prep app.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--clean-model-dir", type=Path, default=DEFAULT_CLEAN_MODEL_DIR)
    parser.add_argument("--scope-model", type=Path, default=DEFAULT_SCOPE_MODEL)
    parser.add_argument("--preset-key", action="append", default=None, help="Limit snapshot generation to one preset key. Repeatable.")
    parser.add_argument("--skip-snapshots", action="store_true", help="Export geometry only; useful for fast smoke tests.")
    return parser.parse_args()


def main() -> int:
    # The bundled configs resolve ${REPO_ROOT} relative to the tool root, not the
    # git root discovered by manifest loading. Set it here (not at import time) so
    # importing this script never leaks the override into other processes' env.
    os.environ["REPO_ROOT"] = str(TOOL_ROOT)
    args = parse_args()
    preset_keys = None if args.preset_key is None else {str(value) for value in args.preset_key}
    export_course_case(
        manifest_path=args.manifest.expanduser().resolve(),
        output_dir=args.output_dir.expanduser().resolve(),
        clean_model_dir=args.clean_model_dir.expanduser().resolve(),
        scope_model_path=args.scope_model.expanduser().resolve(),
        preset_keys=preset_keys,
        skip_snapshots=bool(args.skip_snapshots),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
