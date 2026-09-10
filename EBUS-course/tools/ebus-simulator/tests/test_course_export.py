from __future__ import annotations

import importlib.util
from pathlib import Path


TOOL_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = TOOL_ROOT / "scripts" / "export_course_case.py"


def _load_export_module():
    spec = importlib.util.spec_from_file_location("course_export", SCRIPT_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_snapshot_file_name_is_stable_for_preset_keys():
    module = _load_export_module()

    assert module.snapshot_file_name("station_7_node_a::rms") == "station_7_node_a__rms.json"


def test_course_export_writes_static_manifest_without_runtime_api(tmp_path):
    module = _load_export_module()
    output_dir = tmp_path / "case-001"

    module.export_course_case(
        manifest_path=TOOL_ROOT / "configs" / "3d_slicer_files.yaml",
        output_dir=output_dir,
        clean_model_dir=TOOL_ROOT.parents[1] / "model",
        scope_model_path=TOOL_ROOT / "model" / "EBUS_tip.glb",
        preset_keys=None,
        skip_snapshots=True,
    )

    manifest_path = output_dir / "case_manifest.web.json"
    assert manifest_path.exists()
    assert (output_dir / "geometry" / "airway_mesh.json").exists()
    assert (output_dir / "models" / "device" / "EBUS_tip.glb").exists()
