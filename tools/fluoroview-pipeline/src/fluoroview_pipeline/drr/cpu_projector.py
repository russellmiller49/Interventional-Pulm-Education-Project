"""Deterministic CPU fallback DRR projector."""

from __future__ import annotations

import numpy as np
from scipy import ndimage

from fluoroview_pipeline.drr.base import ProjectionOptions, ProjectionResult, ProjectorBackend
from fluoroview_pipeline.geometry.carm import CArmGeometry
from fluoroview_pipeline.physics.hu import hu_to_linear_attenuation, normalize_to_uint8


class CpuRaySumProjector(ProjectorBackend):
    """Approximate ray-sum projector for tests, local development, and fallback atlas generation."""

    def project(
        self,
        volume_hu: np.ndarray,
        spacing_mm: tuple[float, float, float],
        geometry: CArmGeometry,
        options: ProjectionOptions | None = None,
    ) -> ProjectionResult:
        opts = options or ProjectionOptions()
        mu = hu_to_linear_attenuation(volume_hu, opts.mu_water, opts.min_hu, opts.max_hu)
        rotated = _rotate_volume_for_geometry(mu, geometry)
        line_integral = rotated.sum(axis=1) * float(spacing_mm[1])
        image = _resize_to_detector(line_integral, geometry.detector_shape, opts.downsample)
        if opts.invert_for_fluoro:
            image = np.exp(-image)
        if opts.normalize:
            image = normalize_to_uint8(image).astype(np.float32) / 255.0
        return ProjectionResult(
            image=image.astype(np.float32),
            geometry=geometry,
            options=opts,
            metadata={"backend": "cpu-ray-sum", "educational": True},
        )


def _rotate_volume_for_geometry(volume: np.ndarray, geometry: CArmGeometry) -> np.ndarray:
    primary = float(geometry.primary_angle_deg)
    secondary = float(geometry.secondary_angle_deg)
    rotated = ndimage.rotate(volume, primary, axes=(2, 1), reshape=False, order=1, mode="nearest")
    if abs(secondary) > 1e-6:
        rotated = ndimage.rotate(rotated, secondary, axes=(0, 1), reshape=False, order=1, mode="nearest")
    return rotated


def _resize_to_detector(
    image: np.ndarray,
    detector_shape: tuple[int, int],
    downsample: int,
) -> np.ndarray:
    rows = max(1, detector_shape[0] // max(1, int(downsample)))
    cols = max(1, detector_shape[1] // max(1, int(downsample)))
    zoom = (rows / image.shape[0], cols / image.shape[1])
    return ndimage.zoom(image, zoom, order=1)

