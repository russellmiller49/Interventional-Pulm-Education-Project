"""Manifest validation helpers for derived FluoroView cases."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


REQUIRED_TOP_LEVEL_KEYS = {
    "id",
    "title",
    "safetyLabel",
    "geometry",
    "assets",
    "ctSlices",
    "drrAtlas",
    "lessons",
}


def load_manifest(path: str | Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def validate_manifest(manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    missing = REQUIRED_TOP_LEVEL_KEYS.difference(manifest)
    if missing:
        errors.append(f"Missing required manifest keys: {', '.join(sorted(missing))}")
    if "not for diagnosis" not in str(manifest.get("safetyLabel", "")).lower():
        errors.append("Manifest safety label must include non-diagnostic wording.")
    frames = manifest.get("drrAtlas", {}).get("frames", [])
    if not frames:
        errors.append("Manifest must include at least one DRR atlas frame.")
    provenance = manifest.get("drrAtlas", {}).get("provenance", {})
    if not provenance.get("backend"):
        errors.append("Manifest DRR atlas must include a provenance backend.")
    for frame in frames:
        if "imageUrl" not in frame or "raoLaoDeg" not in frame or "cranialCaudalDeg" not in frame:
            errors.append("Every DRR frame must include imageUrl, raoLaoDeg, and cranialCaudalDeg.")
            break
    return errors
