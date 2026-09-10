"""Device-calibration profile: the Python tools and the web app must share one record."""

import json
import math
from pathlib import Path

import numpy as np
import pytest

from ebus_simulator.device import (
    DEVICE_PROFILE_DIR,
    endoscope_camera_payload,
    get_cp_ebus_device_model,
    resolve_video_axis,
    ultrasound_probe_payload,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
WEB_MANIFEST_PATH = REPO_ROOT / "apps/web/public/simulator/case-001/case_manifest.simplified.web.json"

SHAFT_AXIS = np.array([0.0, 0.0, 1.0])
PROBE_AXIS = np.array([0.0, 1.0, 0.0])
LATERAL_AXIS = np.cross(SHAFT_AXIS, PROBE_AXIS)


def test_default_profile_uses_the_calibrated_offset() -> None:
    model = get_cp_ebus_device_model("bf_uc180f")

    assert model.video_axis_offset_deg == 30.0
    assert model.obliquity_axis == "depth_axis"
    assert model.sector_angle_deg == 60.0
    assert model.displayed_range_mm == 40.0


def test_profile_file_exists_and_matches_the_resolved_model() -> None:
    profile_path = DEVICE_PROFILE_DIR / "bf_uc180f.json"
    assert profile_path.is_file()

    record = json.loads(profile_path.read_text(encoding="utf-8"))
    model = get_cp_ebus_device_model("bf_uc180f")

    assert record["optical_axis_offset_deg"] == model.video_axis_offset_deg
    assert record["obliquity_axis"] == model.obliquity_axis
    assert record["sector_angle_deg"] == model.sector_angle_deg
    assert record["displayed_range_mm"] == model.displayed_range_mm


def test_profile_carries_the_lens_realism_flags() -> None:
    model = get_cp_ebus_device_model("bf_uc180f")
    payload = endoscope_camera_payload(model)

    # The reference device's optics sit proximal enough that the tip hardware stays out of frame.
    assert payload["scope_tip_occlusion"] is False
    assert payload["circular_aperture"] is True
    assert payload["lens_distortion"] is True
    assert payload["headlight_falloff"] is True
    assert payload["contact_cap"] is True
    assert payload["contact_min_distance_mm"] == 1.5


def test_explicit_overrides_win_over_the_profile() -> None:
    model = get_cp_ebus_device_model(
        "bf_uc180f",
        overrides={"optical_axis_offset_deg": 20.0, "obliquity_axis": "negative_depth_axis"},
    )

    assert model.video_axis_offset_deg == 20.0
    assert model.obliquity_axis == "negative_depth_axis"
    # Untouched fields keep the profile values.
    assert model.sector_angle_deg == 60.0


def test_unsupported_obliquity_axis_is_rejected() -> None:
    with pytest.raises(ValueError):
        get_cp_ebus_device_model("bf_uc180f", overrides={"obliquity_axis": "up_axis"})


def test_video_axis_is_offset_by_the_configured_angle_toward_the_scan_side() -> None:
    model = get_cp_ebus_device_model("bf_uc180f")
    video_axis = resolve_video_axis(model, SHAFT_AXIS, PROBE_AXIS, LATERAL_AXIS)
    theta = math.radians(model.video_axis_offset_deg)

    assert math.isclose(float(np.linalg.norm(video_axis)), 1.0, abs_tol=1e-9)
    # Same convention as the web app: forward = shaft*cos(theta) + obliquity*sin(theta).
    assert math.isclose(float(np.dot(video_axis, SHAFT_AXIS)), math.cos(theta), abs_tol=1e-9)
    assert math.isclose(float(np.dot(video_axis, PROBE_AXIS)), math.sin(theta), abs_tol=1e-9)
    assert math.isclose(float(np.dot(video_axis, LATERAL_AXIS)), 0.0, abs_tol=1e-9)


def test_negative_depth_obliquity_flips_the_scan_side() -> None:
    model = get_cp_ebus_device_model("bf_uc180f", overrides={"obliquity_axis": "negative_depth_axis"})
    video_axis = resolve_video_axis(model, SHAFT_AXIS, PROBE_AXIS, LATERAL_AXIS)
    theta = math.radians(model.video_axis_offset_deg)

    assert math.isclose(float(np.dot(video_axis, SHAFT_AXIS)), math.cos(theta), abs_tol=1e-9)
    assert math.isclose(float(np.dot(video_axis, PROBE_AXIS)), -math.sin(theta), abs_tol=1e-9)


def test_web_manifest_carries_the_same_calibration_record() -> None:
    if not WEB_MANIFEST_PATH.is_file():
        pytest.skip("web manifest not present in this checkout")

    manifest = json.loads(WEB_MANIFEST_PATH.read_text(encoding="utf-8"))
    model = get_cp_ebus_device_model("bf_uc180f")

    assert manifest["endoscope_camera"] == endoscope_camera_payload(model)
    assert manifest["ultrasound_probe"] == ultrasound_probe_payload(model)
