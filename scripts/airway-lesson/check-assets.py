#!/usr/bin/env python3
"""Validate generated airway anatomy lesson assets.

The module treats an airway as quiz-eligible only when it has three matching
asset families: a bronchoscopy still, a CT correlation, and video overlay data.
LB1/LB2 are the deliberate v1 exception: CT/model data exist, but the current
bronchoscopy annotation represents them together as LB1+2.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public" / "airway-lesson"
AIRWAY_MAP = ROOT / "src" / "data" / "airway-anatomy-lesson" / "airway-map.ts"

OVERLAYS = PUBLIC / "airway-survey-overlays.json"
SCOPE_SEGMENTS = PUBLIC / "airway-scope-segment-overlays.json"
QUIZ_FRAMES = PUBLIC / "airway-quiz-frames.json"
CT = PUBLIC / "airway-survey-ct.json"

EXPECTED_EXCEPTIONS = {
    "lb1": "Video/still coverage is represented by lb1-2; CT/model coverage exists separately.",
    "lb2": "Video/still coverage is represented by lb1-2; CT/model coverage exists separately.",
}
REPRESENTATIVE = {"lb1": "lb1-2", "lb2": "lb1-2"}


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def public_path(url: str) -> Path:
    if not url.startswith("/airway-lesson/"):
        raise ValueError(f"Unexpected public asset URL: {url}")
    return PUBLIC / url.removeprefix("/airway-lesson/")


def airway_node_ids() -> list[str]:
    text = AIRWAY_MAP.read_text(encoding="utf-8")
    return re.findall(r"\bid:\s*'([^']+)'", text)


def main() -> int:
    problems: list[str] = []
    warnings: list[str] = []

    for required in [OVERLAYS, SCOPE_SEGMENTS, QUIZ_FRAMES, CT]:
        if not required.exists():
            problems.append(f"missing manifest: {required.relative_to(ROOT)}")

    if problems:
        for problem in problems:
            print(f"ERROR: {problem}")
        return 1

    overlays = load_json(OVERLAYS)
    scope_segments = load_json(SCOPE_SEGMENTS)
    quiz = load_json(QUIZ_FRAMES)
    ct = load_json(CT)

    overlay_meta = overlays.get("meta", {})
    scope_meta = scope_segments.get("meta", {})
    for key in ["video", "poster"]:
        asset_name = overlay_meta.get(key)
        if not asset_name:
            problems.append(f"overlay meta missing {key}")
            continue
        asset_path = PUBLIC / asset_name
        if not asset_path.exists():
            problems.append(f"missing {key} asset: {asset_path.relative_to(ROOT)}")

    if overlay_meta.get("width") != 1368 or overlay_meta.get("height") != 1080:
        problems.append(
            f"overlay coordinate space should be 1368x1080, got {overlay_meta.get('width')}x{overlay_meta.get('height')}"
        )
    if overlay_meta.get("annotationSet") != "visible-anatomy":
        problems.append(f"visible overlay has unexpected annotationSet: {overlay_meta.get('annotationSet')}")
    crop = overlay_meta.get("crop") or {}
    if crop.get("x") != 552 or crop.get("width") != 1368 or crop.get("height") != 1080:
        problems.append(f"unexpected overlay crop metadata: {crop}")

    if scope_meta.get("width") != overlay_meta.get("width") or scope_meta.get("height") != overlay_meta.get("height"):
        problems.append(
            "scope-segment overlay coordinate space must match visible anatomy overlays"
        )
    if scope_meta.get("annotationSet") != "current-scope-segment":
        problems.append(
            f"scope-segment overlay has unexpected annotationSet: {scope_meta.get('annotationSet')}"
        )

    scope_nodes = {
        structure.get("node")
        for structure in scope_segments.get("structures", [])
        if structure.get("node")
    }
    for required_scope_node in ["trachea", "rmb", "bronchus-intermedius", "rml", "rll", "lmb", "lul", "lll"]:
        if required_scope_node not in scope_nodes:
            problems.append(f"scope-segment overlay missing {required_scope_node}")

    overlay_nodes = {
        structure.get("node")
        for structure in overlays.get("structures", [])
        if structure.get("node")
    }
    quiz_structures: dict[str, dict] = quiz.get("structures", {})
    ct_structures: dict[str, dict] = ct.get("structures", {})

    for node_id in airway_node_ids():
        if node_id in EXPECTED_EXCEPTIONS:
            if node_id not in ct_structures:
                problems.append(f"{node_id}: expected exception is missing CT coverage")
            representative = REPRESENTATIVE[node_id]
            if representative not in overlay_nodes or representative not in quiz_structures:
                problems.append(
                    f"{node_id}: expected representative {representative} is missing video/still coverage"
                )
            warnings.append(f"{node_id}: {EXPECTED_EXCEPTIONS[node_id]}")
            continue

        quiz_structure = quiz_structures.get(node_id)
        ct_structure = ct_structures.get(node_id)
        if not quiz_structure:
            problems.append(f"{node_id}: missing endoscopic still")
        elif not quiz_structure.get("hasCt"):
            problems.append(f"{node_id}: quiz manifest says CT is unavailable")
        if node_id not in overlay_nodes:
            problems.append(f"{node_id}: missing video overlay structure")
        if not ct_structure:
            problems.append(f"{node_id}: missing CT correlation")

    for node_id, quiz_structure in quiz_structures.items():
        if not quiz_structure:
            continue
        still = quiz_structure.get("img")
        if still and not public_path(still).exists():
            problems.append(f"{node_id}: missing still file {still}")

    for node_id, ct_structure in ct_structures.items():
        for plane in ["axial", "coronal"]:
            image = ct_structure.get(plane)
            if image and not public_path(image).exists():
                problems.append(f"{node_id}: missing {plane} CT file {image}")

    for warning in warnings:
        print(f"EXPECTED: {warning}")
    if problems:
        for problem in problems:
            print(f"ERROR: {problem}")
        return 1

    print(
        "OK: airway lesson assets have still, CT, and overlay coverage for quiz-eligible nodes; "
        "LB1/LB2 are documented representative exceptions."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
