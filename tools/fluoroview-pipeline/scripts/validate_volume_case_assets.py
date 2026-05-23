#!/usr/bin/env python3
"""Validate public assets for a FluoroView volume-DRR case."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


FORBIDDEN_SUFFIXES = (
    ".nrrd",
    ".nii",
    ".nii.gz",
    ".dcm",
    ".h5",
    ".mrml",
    ".vtk",
    ".blend",
    ".seg.nrrd",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case-dir", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    case_dir = Path(args.case_dir)
    errors = validate_case_dir(case_dir)
    if errors:
        for error in errors:
            print(f"[validate] ERROR: {error}")
        raise SystemExit(1)
    print(f"[validate] OK: {case_dir}")


def validate_case_dir(case_dir: Path) -> list[str]:
    errors: list[str] = []
    manifest_path = case_dir / "case_manifest.json"
    if not manifest_path.exists():
        return [f"Missing {manifest_path}"]
    manifest = load_json(manifest_path)
    safety = str(manifest.get("safetyLabel", "")).lower()
    if "not for diagnosis" not in safety and "not diagnostic" not in safety:
        errors.append("Safety label must contain non-diagnostic language.")

    volume = manifest.get("volumeDrr")
    if volume:
        raw_path = case_dir / relative_public_path(volume.get("volumeUri", ""))
        size = volume.get("sizeXyz", [])
        expected = product(size) if isinstance(size, list) and len(size) == 3 else None
        if expected is None:
            errors.append("volumeDrr.sizeXyz must contain three values.")
        elif not raw_path.exists():
            errors.append(f"Missing CT raw volume: {raw_path}")
        elif raw_path.stat().st_size != expected:
            errors.append(
                f"CT raw byte length mismatch: expected {expected}, got {raw_path.stat().st_size}."
            )
        if len(volume.get("directionLps", [])) != 9:
            errors.append("volumeDrr.directionLps must contain 9 values.")
        if volume.get("format") != "uint8-r8":
            errors.append('volumeDrr.format must be "uint8-r8".')
        if volume.get("sampleDomain") != "normalized-r8":
            errors.append('volumeDrr.sampleDomain must be "normalized-r8".')
    else:
        errors.append("Manifest must include volumeDrr for volume case validation.")

    graph_path = case_dir / "metadata" / "airway_graph.json"
    if not graph_path.exists():
        errors.append("Missing metadata/airway_graph.json.")
    else:
        graph = load_json(graph_path)
        if not graph.get("nodes") or not graph.get("edges") or not graph.get("terminalNodeIds"):
            errors.append("Airway graph must include nodes, edges, and terminalNodeIds.")
        if graph.get("rootNodeId") is None or graph.get("carinaNodeId") is None:
            errors.append("Airway graph must include rootNodeId and carinaNodeId.")

    scope_path = case_dir / "metadata" / "bronch_animation_path.json"
    if scope_path.exists():
        scope = load_json(scope_path)
        if len(scope.get("pointsLps", [])) < 20:
            errors.append("Scope animation path must contain at least 20 points.")

    for json_path in case_dir.rglob("*.json"):
        payload_text = json_path.read_text(encoding="utf-8")
        if "/Users/" in payload_text:
            errors.append(f"Public JSON leaks a local /Users path: {json_path}")
        try:
            payload = json.loads(payload_text)
        except json.JSONDecodeError:
            errors.append(f"Invalid JSON: {json_path}")
            continue
        leaked = find_absolute_source_paths(payload)
        if leaked:
            errors.append(f"Public JSON contains local absolute source paths in {json_path}: {leaked[0]}")

    for file_path in case_dir.rglob("*"):
        if not file_path.is_file():
            continue
        lower = file_path.name.lower()
        if lower.endswith(FORBIDDEN_SUFFIXES):
            errors.append(f"Public case folder contains forbidden source file: {file_path}")

    return errors


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def relative_public_path(uri: str) -> Path:
    marker = "/fluoroview/cases/"
    if marker not in uri:
        return Path(uri.lstrip("/"))
    parts = uri.split(marker, 1)[1].split("/", 1)
    return Path(parts[1] if len(parts) > 1 else "")


def product(values: list[Any]) -> int:
    total = 1
    for value in values:
        total *= int(value)
    return total


def find_absolute_source_paths(value: Any) -> list[str]:
    found: list[str] = []
    if isinstance(value, str):
        if value.startswith("/Users/") or value.startswith("/Volumes/"):
            found.append(value)
    elif isinstance(value, list):
        for item in value:
            found.extend(find_absolute_source_paths(item))
    elif isinstance(value, dict):
        for item in value.values():
            found.extend(find_absolute_source_paths(item))
    return found


if __name__ == "__main__":
    main()
