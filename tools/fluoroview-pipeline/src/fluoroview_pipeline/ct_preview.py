"""Low-resolution CT preview volume export for browser interaction."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from fluoroview_pipeline.io.dicom_loader import read_ct_series


@dataclass(frozen=True)
class CtPreviewExport:
    metadata: dict[str, Any]
    volume: np.ndarray


def export_ct_preview(
    dicom_dir: str | Path,
    output_path: str | Path,
    *,
    stride_xy: int = 2,
    stride_z: int = 2,
    window_low: float = -1050.0,
    window_high: float = 350.0,
) -> CtPreviewExport:
    """Export a PHI-free uint8 CT preview volume using X-fastest order."""

    ct = read_ct_series(dicom_dir)
    volume = ct.volume_hu[::stride_z, ::stride_xy, ::stride_xy]
    preview = hu_to_uint8(volume, window_low=window_low, window_high=window_high)
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(preview.copy(order="C").tobytes())

    origin_lps = _origin_lps_from_metadata(ct.safe_metadata)
    spacing_xyz = [
        float(ct.spacing_mm[2] * stride_xy),
        float(ct.spacing_mm[1] * stride_xy),
        float(ct.spacing_mm[0] * stride_z),
    ]
    metadata = {
        "raw": path.name,
        "sizeXyz": [int(preview.shape[2]), int(preview.shape[1]), int(preview.shape[0])],
        "originalSizeXyz": [
            int(ct.volume_hu.shape[2]),
            int(ct.volume_hu.shape[1]),
            int(ct.volume_hu.shape[0]),
        ],
        "stride": [stride_xy, stride_xy, stride_z],
        "spacingXyzMm": spacing_xyz,
        "originLps": origin_lps,
        "directionLps": list(ct.orientation or (1.0, 0.0, 0.0, 0.0, 1.0, 0.0)),
        "windowHu": [window_low, window_high],
        "source": "Derived low-resolution uint8 preview from local CT DICOM; not diagnostic.",
    }
    return CtPreviewExport(metadata=metadata, volume=preview)


def hu_to_uint8(volume_hu: np.ndarray, *, window_low: float, window_high: float) -> np.ndarray:
    scaled = (volume_hu.astype(np.float32) - window_low) / max(window_high - window_low, 1.0)
    return np.clip(np.round(scaled * 255.0), 0, 255).astype(np.uint8)


def _origin_lps_from_metadata(metadata: dict[str, Any]) -> list[float]:
    position = metadata.get("ImagePositionPatient")
    if isinstance(position, (list, tuple)) and len(position) == 3:
        return [float(position[0]), float(position[1]), float(position[2])]
    return [0.0, 0.0, 0.0]
