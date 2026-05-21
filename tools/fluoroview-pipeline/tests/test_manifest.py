from fluoroview_pipeline.validation.manifest import validate_manifest


def test_manifest_requires_non_diagnostic_label_and_frames():
    errors = validate_manifest(
        {
            "id": "demo",
            "title": "Demo",
            "safetyLabel": "Educational simulation only - not for diagnosis.",
            "geometry": {},
            "assets": {},
            "ctSlices": {},
            "drrAtlas": {
                "provenance": {"backend": "cpu-ray-sum"},
                "frames": [{"imageUrl": "x", "raoLaoDeg": 0, "cranialCaudalDeg": 0}],
            },
            "lessons": [],
        }
    )
    assert errors == []


def test_manifest_requires_interaction_defaults_for_airway_graph():
    errors = validate_manifest(
        {
            "id": "demo",
            "title": "Demo",
            "safetyLabel": "Educational simulation only - not for diagnosis.",
            "geometry": {},
            "assets": {"airwayGraphJson": "/graph.json"},
            "ctSlices": {},
            "drrAtlas": {
                "provenance": {"backend": "cpu-ray-sum"},
                "frames": [{"imageUrl": "x", "raoLaoDeg": 0, "cranialCaudalDeg": 0}],
            },
            "lessons": [],
        }
    )

    assert "Interaction defaults are required when airwayGraphJson is present." in errors
