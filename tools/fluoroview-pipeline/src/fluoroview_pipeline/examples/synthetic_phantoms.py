"""Synthetic CT phantoms for deterministic projection tests."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import json
from pathlib import Path

import numpy as np


@dataclass(frozen=True)
class SyntheticPhantomMetadata:
    lesion_center_zyx: tuple[int, int, int]
    lesion_radius_voxels: int
    description: str


def create_synthetic_chest_phantom(
    shape: tuple[int, int, int] = (64, 96, 96),
    spacing_mm: tuple[float, float, float] = (2.0, 1.5, 1.5),
    seed: int = 7,
) -> tuple[np.ndarray, tuple[float, float, float], SyntheticPhantomMetadata]:
    rng = np.random.default_rng(seed)
    z, y, x = np.indices(shape)
    cy = shape[1] / 2.0
    cx = shape[2] / 2.0
    body = ((y - cy) / (shape[1] * 0.42)) ** 2 + ((x - cx) / (shape[2] * 0.38)) ** 2 <= 1.0
    left_lung = ((y - cy) / (shape[1] * 0.26)) ** 2 + ((x - cx + 19) / 18) ** 2 <= 1.0
    right_lung = ((y - cy) / (shape[1] * 0.26)) ** 2 + ((x - cx - 19) / 18) ** 2 <= 1.0
    spine = ((y - cy - 28) / 8) ** 2 + ((x - cx) / 10) ** 2 <= 1.0
    lesion_center = (shape[0] // 2, int(cy - 3), int(cx + 23))
    lesion = (
        (z - lesion_center[0]) ** 2
        + (y - lesion_center[1]) ** 2
        + (x - lesion_center[2]) ** 2
        <= 5**2
    )
    airway = ((x - cx) / 4) ** 2 + ((y - cy + 2) / 6) ** 2 <= 1.0

    volume = np.full(shape, -1000.0, dtype=np.float32)
    volume[body] = rng.normal(35.0, 4.0, size=int(body.sum()))
    volume[left_lung | right_lung] = rng.normal(-850.0, 18.0, size=int((left_lung | right_lung).sum()))
    volume[spine] = 900.0
    volume[lesion] = 65.0
    volume[airway] = -1000.0

    metadata = SyntheticPhantomMetadata(
        lesion_center_zyx=lesion_center,
        lesion_radius_voxels=5,
        description="Deterministic educational chest-like phantom; no patient data.",
    )
    return volume, spacing_mm, metadata


def save_synthetic_phantom(output_dir: str | Path, seed: int = 7) -> None:
    path = Path(output_dir)
    path.mkdir(parents=True, exist_ok=True)
    volume, spacing, metadata = create_synthetic_chest_phantom(seed=seed)
    np.save(path / "volume_hu.npy", volume)
    payload = {**asdict(metadata), "spacing_mm": spacing}
    (path / "metadata.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

