"""HU conversion and windowing helpers for educational CT rendering."""

from __future__ import annotations

import numpy as np


def stored_to_hu(
    stored: np.ndarray,
    slope: float | int | None = 1.0,
    intercept: float | int | None = -1024.0,
) -> np.ndarray:
    """Convert stored CT pixel values to Hounsfield units."""

    safe_slope = 1.0 if slope is None else float(slope)
    safe_intercept = 0.0 if intercept is None else float(intercept)
    return stored.astype(np.float32) * safe_slope + safe_intercept


def safe_clip_hu(
    volume_hu: np.ndarray,
    min_hu: float = -1200.0,
    max_hu: float = 3000.0,
) -> np.ndarray:
    """Clip extreme HU values and replace non-finite values."""

    cleaned = np.nan_to_num(volume_hu.astype(np.float32), nan=min_hu, posinf=max_hu, neginf=min_hu)
    return np.clip(cleaned, min_hu, max_hu)


def hu_to_windowed_image(
    volume_or_slice: np.ndarray,
    window_center: float,
    window_width: float,
) -> np.ndarray:
    """Map HU values to a 0..1 grayscale window."""

    width = max(float(window_width), 1.0)
    low = float(window_center) - width / 2.0
    high = float(window_center) + width / 2.0
    clipped = safe_clip_hu(volume_or_slice, low, high)
    return ((clipped - low) / (high - low)).astype(np.float32)


def normalize_to_uint8(image: np.ndarray) -> np.ndarray:
    """Normalize an image to uint8 while avoiding NaNs and divide-by-zero."""

    data = np.nan_to_num(image.astype(np.float32), nan=0.0, posinf=0.0, neginf=0.0)
    min_value = float(data.min())
    max_value = float(data.max())
    if max_value <= min_value:
        return np.zeros(data.shape, dtype=np.uint8)
    return np.round(((data - min_value) / (max_value - min_value)) * 255.0).astype(np.uint8)


def hu_to_linear_attenuation(
    volume_hu: np.ndarray,
    mu_water: float = 0.02,
    min_hu: float = -1000.0,
    max_hu: float = 3000.0,
) -> np.ndarray:
    """Convert HU to a simplified monoenergetic attenuation map.

    This is an educational approximation, not a calibrated physical model.
    """

    clipped = safe_clip_hu(volume_hu, min_hu, max_hu)
    mu = float(mu_water) * (1.0 + clipped / 1000.0)
    return np.maximum(mu, 0.0).astype(np.float32)

