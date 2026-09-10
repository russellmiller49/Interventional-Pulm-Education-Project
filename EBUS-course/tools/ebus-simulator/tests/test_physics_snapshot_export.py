"""Physics snapshot pipeline: syntax/shape checks only — CI never runs a render."""

import json
import py_compile
from pathlib import Path
from types import SimpleNamespace

from ebus_simulator.physics_snapshot_export import (
    SCHEMA_VERSION,
    apply_physics_snapshot_refs,
    build_arg_parser,
    build_physics_snapshot_sidecar,
    physics_snapshot_file_stem,
)

MODULE_PATH = Path(__file__).resolve().parents[1] / "src" / "ebus_simulator" / "physics_snapshot_export.py"


def _stub_metadata() -> SimpleNamespace:
    return SimpleNamespace(
        engine_version="physics-v1",
        device_model="bf_uc180f",
        sector_angle_deg=60.0,
        max_depth_mm=40.0,
        roll_deg=0.0,
        contact_world=[1.0, 2.0, 3.0],
        device_axes={
            "nB": [0.0, 0.0, 1.0],
            "nUS": [0.0, 1.0, 0.0],
            "nC": [0.0, 0.5, 0.8660254],
            "wall_normal": [0.0, 1.0, 0.0],
        },
    )


def test_module_compiles() -> None:
    py_compile.compile(str(MODULE_PATH), doraise=True)


def test_snapshot_file_stem_matches_the_sector_snapshot_convention() -> None:
    assert physics_snapshot_file_stem("station_4r_node_a::default") == "station_4r_node_a__default"
    assert physics_snapshot_file_stem("station_11rs_node_b::lms") == "station_11rs_node_b__lms"


def test_sidecar_carries_the_required_metadata_in_the_web_frame() -> None:
    sidecar = build_physics_snapshot_sidecar(
        _stub_metadata(),
        preset_key="station_4r_node_a::default",
        image_ref="physics_snapshots/station_4r_node_a__default.png",
        video_axis_offset_deg=30.0,
    )

    assert sidecar["schema_version"] == SCHEMA_VERSION
    assert sidecar["preset_key"] == "station_4r_node_a::default"
    assert sidecar["image"] == "physics_snapshots/station_4r_node_a__default.png"
    assert sidecar["labels"] == []
    assert "masks" not in sidecar

    metadata = sidecar["metadata"]
    assert metadata["engine"] == "physics"
    assert metadata["engine_version"] == "physics-v1"
    assert metadata["model"] == "bf_uc180f"
    assert metadata["video_axis_offset_deg"] == 30.0
    assert metadata["sector_angle_deg"] == 60.0
    assert metadata["max_depth_mm"] == 40.0
    assert metadata["roll_deg"] == 0.0
    # LPS [L, P, S] -> web [L, S, -P], same as the manifest presets.
    assert metadata["contact"] == [1.0, 3.0, -2.0]
    assert metadata["contact_lps"] == [1.0, 2.0, 3.0]
    assert metadata["shaft_axis"] == [0.0, 1.0, 0.0]
    assert metadata["depth_axis"] == [0.0, 0.0, -1.0]
    # lateral = shaft x depth in LPS = [-1, 0, 0] -> web [-1, 0, 0].
    assert metadata["lateral_axis"] == [-1.0, 0.0, -0.0]


def test_snapshot_refs_merge_into_an_existing_manifest(tmp_path: Path) -> None:
    manifest_path = tmp_path / "case_manifest.web.json"
    manifest_path.write_text(json.dumps({"case_id": "case-001", "physics_snapshots": {"old::key": "physics_snapshots/old.json"}}))

    updated = apply_physics_snapshot_refs(
        manifest_path,
        {"station_4r_node_a::default": "physics_snapshots/station_4r_node_a__default.json"},
    )
    payload = json.loads(manifest_path.read_text())

    assert updated is True
    assert payload["physics_snapshots"] == {
        "old::key": "physics_snapshots/old.json",
        "station_4r_node_a::default": "physics_snapshots/station_4r_node_a__default.json",
    }
    assert apply_physics_snapshot_refs(tmp_path / "missing.json", {}) is False


def test_cli_parser_accepts_repeatable_preset_keys() -> None:
    args = build_arg_parser().parse_args(
        ["--preset-key", "a::default", "--preset-key", "b::lms", "--update-manifests"],
    )

    assert args.preset_key == ["a::default", "b::lms"]
    assert args.update_manifests is True
    assert args.output_dir.name == "case-001"
