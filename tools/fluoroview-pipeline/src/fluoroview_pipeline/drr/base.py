"""Projection backend interfaces."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from fluoroview_pipeline.geometry.carm import CArmGeometry


@dataclass(frozen=True)
class ProjectionOptions:
    samples_per_ray: int = 256
    downsample: int = 2
    mu_water: float = 0.02
    min_hu: float = -1000.0
    max_hu: float = 3000.0
    normalize: bool = True
    invert_for_fluoro: bool = True


@dataclass(frozen=True)
class ProjectionResult:
    image: np.ndarray
    geometry: CArmGeometry
    options: ProjectionOptions
    metadata: dict[str, Any] = field(default_factory=dict)


class ProjectorBackend(ABC):
    """Common interface for CPU and optional TIGRE projectors."""

    @abstractmethod
    def project(
        self,
        volume_hu: np.ndarray,
        spacing_mm: tuple[float, float, float],
        geometry: CArmGeometry,
        options: ProjectionOptions | None = None,
    ) -> ProjectionResult:
        """Project a CT volume into one DRR frame."""

