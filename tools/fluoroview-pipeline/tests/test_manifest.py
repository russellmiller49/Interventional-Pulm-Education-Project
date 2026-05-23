from fluoroview_pipeline.validation.manifest import validate_manifest


def test_manifest_accepts_atlas_manifest():
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


def test_manifest_accepts_volume_only_manifest():
    errors = validate_manifest(
        {
            "id": "demo",
            "title": "Demo",
            "safetyLabel": "Educational simulation only - not for diagnosis.",
            "geometry": {},
            "assets": {},
            "ctSlices": {},
            "volumeDrr": {
                "volumeUri": "/case/ct.raw",
                "format": "uint8-r8",
                "directionLps": [1, 0, 0, 0, 1, 0, 0, 0, 1],
                "sampleDomain": "normalized-r8",
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
