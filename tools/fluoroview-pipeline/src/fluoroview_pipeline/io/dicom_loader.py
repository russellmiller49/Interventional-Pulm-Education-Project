"""PHI-safe DICOM CT series loader."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any
import warnings

import numpy as np

from fluoroview_pipeline.io.deidentify import safe_dicom_metadata
from fluoroview_pipeline.physics.hu import stored_to_hu


@dataclass(frozen=True)
class CTVolume:
    volume_hu: np.ndarray
    spacing_mm: tuple[float, float, float]
    orientation: tuple[float, ...] | None
    safe_metadata: dict[str, Any]


def read_ct_series(series_dir: str | Path) -> CTVolume:
    """Read a CT DICOM series from a directory without exposing PHI fields."""

    try:
        import pydicom
    except ImportError as exc:
        raise RuntimeError("pydicom is required to load DICOM CT series.") from exc

    files = sorted(Path(series_dir).glob("*.dcm"))
    if not files:
        raise FileNotFoundError(f"No .dcm files found in {series_dir}")

    datasets = [pydicom.dcmread(str(path), force=True) for path in files]
    datasets.sort(key=_slice_sort_key)

    modality = str(getattr(datasets[0], "Modality", ""))
    if modality and modality.upper() != "CT":
        warnings.warn(f"Expected CT series, found modality {modality!r}.", stacklevel=2)

    rows = {int(getattr(ds, "Rows", -1)) for ds in datasets}
    cols = {int(getattr(ds, "Columns", -1)) for ds in datasets}
    if len(rows) != 1 or len(cols) != 1:
        raise ValueError("Inconsistent DICOM image dimensions.")

    pixel_spacing = tuple(float(v) for v in getattr(datasets[0], "PixelSpacing", [1.0, 1.0]))
    z_spacing = _estimate_slice_spacing(datasets)
    orientation = tuple(float(v) for v in getattr(datasets[0], "ImageOrientationPatient", [])) or None

    slices = []
    for ds in datasets:
        slope = getattr(ds, "RescaleSlope", 1.0)
        intercept = getattr(ds, "RescaleIntercept", 0.0)
        slices.append(stored_to_hu(ds.pixel_array, slope=slope, intercept=intercept))

    volume = np.stack(slices, axis=0).astype(np.float32)
    return CTVolume(
        volume_hu=volume,
        spacing_mm=(z_spacing, pixel_spacing[0], pixel_spacing[1]),
        orientation=orientation,
        safe_metadata=safe_dicom_metadata(datasets[0]),
    )


def _slice_sort_key(dataset: object) -> tuple[int, float]:
    if hasattr(dataset, "ImagePositionPatient"):
        try:
            return (0, float(dataset.ImagePositionPatient[2]))
        except (TypeError, ValueError, IndexError):
            pass
    return (1, float(getattr(dataset, "InstanceNumber", 0)))


def _estimate_slice_spacing(datasets: list[object]) -> float:
    positions = []
    for ds in datasets:
        if hasattr(ds, "ImagePositionPatient"):
            try:
                positions.append(float(ds.ImagePositionPatient[2]))
            except (TypeError, ValueError, IndexError):
                continue
    if len(positions) >= 2:
        diffs = np.diff(sorted(positions))
        return float(np.median(np.abs(diffs)))
    return float(getattr(datasets[0], "SliceThickness", 1.0))

