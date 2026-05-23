import importlib.util
from pathlib import Path

import pytest


SCRIPT_PATH = Path(__file__).parents[1] / "scripts" / "generate_interaction_assets.py"
SPEC = importlib.util.spec_from_file_location("generate_interaction_assets", SCRIPT_PATH)
generate_interaction_assets = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(generate_interaction_assets)


def test_carina_detector_percent_uses_ct_isocenter_without_translation():
    geometry = {
        "isocenter_mm": [-6.285000231743027, -172.10900023174304, -1191.25],
        "source_to_isocenter_mm": 600,
        "detector_pixels": [1024, 1024],
        "pixel_pitch_mm": 0.3,
    }
    carina_lps = [-7.776358604431152, -134.74790954589844, -1156.4952392578125]

    detector_percent = generate_interaction_assets.detector_percent_for_lps_point(
        carina_lps,
        geometry["isocenter_mm"],
        geometry,
    )

    assert detector_percent == pytest.approx([49.54298915258192, 39.34977470909921])
