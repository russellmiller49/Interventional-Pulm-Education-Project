"""Station-anchored physics sector snapshots for the web app.

For each station preset this pipeline renders a grayscale sector image through
``physics_renderer.render_physics_preset`` and writes a PNG plus a sidecar JSON
into ``<output-dir>/physics_snapshots/`` (the web case directory, e.g.
``apps/web/public/simulator/case-001/physics_snapshots/``). The web app lists
the sidecars in the manifest's optional ``physics_snapshots`` map and draws the
PNG as the sector-image background under its interactive labels.

Regenerate with::

    export-physics-snapshots [--manifest <case.yaml>] [--output-dir <web case dir>]
        [--preset-key <preset_key> ...] [--update-manifests]

Rendering needs the full source volumes, so CI only syntax-checks this module
(see tests/test_physics_snapshot_export.py); it never runs the render pipeline.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Iterable, Mapping

import numpy as np

from ebus_simulator.device import get_cp_ebus_device_model
from ebus_simulator.render_engines import RenderEngine, RenderRequest
from ebus_simulator.web_navigation import lps_to_web

SCHEMA_VERSION = 1
SNAPSHOT_DIR_NAME = "physics_snapshots"
WEB_MANIFEST_NAMES = ("case_manifest.web.json", "case_manifest.simplified.web.json")


def physics_snapshot_file_stem(preset_key: str) -> str:
    """Filesystem-safe stem for a preset key (``station_4r_node_a::default`` ->
    ``station_4r_node_a__default``), matching the sector-snapshot convention."""
    return re.sub(r"[^A-Za-z0-9_-]+", "__", preset_key).strip("_")


def _web_vector(vector_lps: Iterable[float] | None) -> list[float] | None:
    if vector_lps is None:
        return None
    return lps_to_web(np.asarray(list(vector_lps), dtype=np.float64))


def build_physics_snapshot_sidecar(
    metadata: Any,
    *,
    preset_key: str,
    image_ref: str,
    video_axis_offset_deg: float,
    labels: list[dict[str, Any]] | None = None,
    masks: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Sidecar JSON payload for one rendered snapshot.

    ``metadata`` is the ``RenderMetadata`` returned by the physics render; only
    plain attribute access is used so tests can pass a lightweight stub. Points
    and axes are emitted in the web frame (with ``*_lps`` counterparts), the
    same convention the manifest presets use.
    """
    shaft_lps = list(metadata.device_axes["nB"])
    depth_lps = list(metadata.device_axes["nUS"])
    lateral_lps = np.cross(
        np.asarray(shaft_lps, dtype=np.float64),
        np.asarray(depth_lps, dtype=np.float64),
    )
    lateral_norm = float(np.linalg.norm(lateral_lps))
    lateral_lps = (lateral_lps / lateral_norm).tolist() if lateral_norm > 1e-9 else None

    payload: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "preset_key": preset_key,
        "image": image_ref,
        "metadata": {
            "engine": "physics",
            "engine_version": str(metadata.engine_version),
            "model": str(metadata.device_model),
            "video_axis_offset_deg": float(video_axis_offset_deg),
            "sector_angle_deg": float(metadata.sector_angle_deg),
            "max_depth_mm": float(metadata.max_depth_mm),
            "roll_deg": float(metadata.roll_deg),
            "contact": _web_vector(metadata.contact_world),
            "contact_lps": [float(value) for value in metadata.contact_world],
            "shaft_axis": _web_vector(shaft_lps),
            "shaft_axis_lps": [float(value) for value in shaft_lps],
            "depth_axis": _web_vector(depth_lps),
            "depth_axis_lps": [float(value) for value in depth_lps],
            "lateral_axis": _web_vector(lateral_lps),
            "lateral_axis_lps": lateral_lps,
        },
        # Interactive hover labels keep coming from sector_snapshots / the live
        # point-cloud items; the physics image is background-only for now.
        "labels": list(labels or []),
    }
    if masks:
        payload["masks"] = dict(masks)
    return payload


def apply_physics_snapshot_refs(manifest_path: Path, refs: Mapping[str, str]) -> bool:
    """Merge snapshot refs into a web manifest's ``physics_snapshots`` map."""
    if not manifest_path.is_file():
        return False
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    existing = payload.get("physics_snapshots")
    merged = dict(existing) if isinstance(existing, dict) else {}
    merged.update(refs)
    payload["physics_snapshots"] = merged
    manifest_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    return True


def export_physics_snapshots(
    manifest_path: str | Path,
    *,
    output_dir: str | Path,
    preset_keys: set[str] | None = None,
    width: int | None = None,
    height: int | None = None,
    seed: int = 0,
    update_manifests: bool = False,
) -> dict[str, str]:
    """Render one grayscale physics sector PNG + sidecar JSON per station preset.

    Returns ``{preset_key: "physics_snapshots/<stem>.json"}`` for the rendered
    presets. Heavy imports happen here (not module scope) so the CLI surface
    stays importable in environments without the render stack's data.
    """
    from PIL import Image

    from ebus_simulator.physics_renderer import render_physics_preset
    from ebus_simulator.rendering import build_render_context
    from ebus_simulator.web_navigation import preset_navigation_entries

    manifest_path = Path(manifest_path).expanduser().resolve()
    output_root = Path(output_dir).expanduser().resolve()
    snapshot_dir = output_root / SNAPSHOT_DIR_NAME
    snapshot_dir.mkdir(parents=True, exist_ok=True)

    context = build_render_context(manifest_path)
    refs: dict[str, str] = {}
    for preset in preset_navigation_entries(context):
        if preset_keys is not None and preset.preset_key not in preset_keys:
            continue

        stem = physics_snapshot_file_stem(preset.preset_key)
        png_path = snapshot_dir / f"{stem}.png"
        sidecar_path = snapshot_dir / f"{stem}.json"
        request = RenderRequest(
            manifest_path=manifest_path,
            preset_id=preset.preset_id,
            approach=preset.approach,
            output_path=png_path,
            # The engine writes its own metadata JSON here first; the sidecar
            # below overwrites it with the web-facing schema.
            metadata_path=sidecar_path,
            engine=RenderEngine.PHYSICS,
            seed=seed,
            width=width,
            height=height,
            virtual_ebus=False,
            simulated_ebus=True,
            # Background image only: every burned-in overlay stays off so the
            # web app can composite its interactive labels on top.
            airway_overlay=False,
            airway_lumen_overlay=False,
            airway_wall_overlay=False,
            target_overlay=False,
            contact_overlay=False,
            show_contact=False,
            station_overlay=False,
            vessel_overlay_names=[],
            show_legend=False,
            label_overlays=False,
        )
        result = render_physics_preset(request, context=context)
        metadata = result.rendered_preset.metadata

        # The engine saves RGB; the sector signal is single-channel, so store it
        # as an 8-bit grayscale PNG.
        Image.open(png_path).convert("L").save(png_path)

        device_model = get_cp_ebus_device_model(metadata.device_model)
        sidecar = build_physics_snapshot_sidecar(
            metadata,
            preset_key=preset.preset_key,
            image_ref=f"{SNAPSHOT_DIR_NAME}/{png_path.name}",
            video_axis_offset_deg=device_model.video_axis_offset_deg,
        )
        sidecar_path.write_text(json.dumps(sidecar, indent=2, sort_keys=True) + "\n")
        refs[preset.preset_key] = f"{SNAPSHOT_DIR_NAME}/{sidecar_path.name}"
        print(f"physics_snapshot: {preset.preset_key} -> {refs[preset.preset_key]}")

    if update_manifests:
        for manifest_name in WEB_MANIFEST_NAMES:
            if apply_physics_snapshot_refs(output_root / manifest_name, refs):
                print(f"updated_manifest: {manifest_name}")

    return refs


def build_arg_parser() -> argparse.ArgumentParser:
    tool_root = Path(__file__).resolve().parents[2]
    course_root = tool_root.parents[1]
    parser = argparse.ArgumentParser(
        description="Render station-anchored physics sector snapshots for the web simulator case.",
    )
    parser.add_argument("--manifest", type=Path, default=tool_root / "configs" / "3d_slicer_files.yaml")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=course_root / "apps" / "web" / "public" / "simulator" / "case-001",
        help="Web case directory; PNG/JSON pairs land in its physics_snapshots/ subdirectory.",
    )
    parser.add_argument("--preset-key", action="append", default=None, help="Limit rendering to one preset key. Repeatable.")
    parser.add_argument("--width", type=int, default=None)
    parser.add_argument("--height", type=int, default=None)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument(
        "--update-manifests",
        action="store_true",
        help="Also merge the generated refs into case_manifest*.web.json in the output directory.",
    )
    return parser


def main() -> int:
    args = build_arg_parser().parse_args()
    preset_keys = None if args.preset_key is None else {str(value) for value in args.preset_key}
    refs = export_physics_snapshots(
        args.manifest,
        output_dir=args.output_dir,
        preset_keys=preset_keys,
        width=args.width,
        height=args.height,
        seed=args.seed,
        update_manifests=bool(args.update_manifests),
    )
    print(f"physics_snapshots: {len(refs)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
