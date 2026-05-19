"""Optional TIGRE backend.

TIGRE is intentionally imported lazily so local CPU-only development and CI do not require CUDA.
"""

from __future__ import annotations

import importlib.util

import numpy as np

from fluoroview_pipeline.drr.base import ProjectionOptions, ProjectionResult, ProjectorBackend
from fluoroview_pipeline.drr.cpu_projector import CpuRaySumProjector
from fluoroview_pipeline.geometry.carm import CArmGeometry


def is_available() -> bool:
    return importlib.util.find_spec("tigre") is not None


class TigreProjector(ProjectorBackend):
    """TIGRE projector wrapper.

    The first implementation validates availability and falls back to the same projection shape
    contract as the CPU backend. Geometry mapping should be calibrated on the GPU VM before using
    TIGRE-generated assets in the public case manifest.
    """

    def project(
        self,
        volume_hu: np.ndarray,
        spacing_mm: tuple[float, float, float],
        geometry: CArmGeometry,
        options: ProjectionOptions | None = None,
    ) -> ProjectionResult:
        if not is_available():
            raise RuntimeError(
                "TIGRE is not installed. Use CpuRaySumProjector locally or run the TIGRE VM setup."
            )

        import tigre  # type: ignore  # noqa: F401

        result = CpuRaySumProjector().project(volume_hu, spacing_mm, geometry, options)
        return ProjectionResult(
            image=result.image,
            geometry=geometry,
            options=result.options,
            metadata={**result.metadata, "backend": "tigre-placeholder"},
        )

