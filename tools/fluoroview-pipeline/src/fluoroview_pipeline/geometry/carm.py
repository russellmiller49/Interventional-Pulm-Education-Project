"""C-arm geometry primitives for CPU and TIGRE projection backends."""

from __future__ import annotations

from dataclasses import dataclass
import math

import numpy as np


Vec3 = tuple[float, float, float]


@dataclass(frozen=True)
class CArmGeometry:
    """Right-handed patient-centered C-arm geometry in millimeters."""

    source_to_isocenter_mm: float = 600.0
    source_to_detector_mm: float = 1200.0
    detector_shape: tuple[int, int] = (256, 256)
    detector_pixel_spacing_mm: tuple[float, float] = (0.6, 0.6)
    primary_angle_deg: float = 0.0
    secondary_angle_deg: float = 0.0
    table_offset_mm: Vec3 = (0.0, 0.0, 0.0)
    detector_offset_mm: tuple[float, float] = (0.0, 0.0)
    detector_rotation_deg: float = 0.0

    @classmethod
    def ap(cls, **kwargs: object) -> "CArmGeometry":
        return cls(primary_angle_deg=0.0, secondary_angle_deg=0.0, **kwargs)

    @classmethod
    def lateral(cls, **kwargs: object) -> "CArmGeometry":
        return cls(primary_angle_deg=90.0, secondary_angle_deg=0.0, **kwargs)

    @classmethod
    def oblique(
        cls,
        primary_angle_deg: float,
        secondary_angle_deg: float = 0.0,
        **kwargs: object,
    ) -> "CArmGeometry":
        return cls(
            primary_angle_deg=primary_angle_deg,
            secondary_angle_deg=secondary_angle_deg,
            **kwargs,
        )

    def source_position(self) -> np.ndarray:
        direction = self._beam_direction()
        return -direction * self.source_to_isocenter_mm + np.array(self.table_offset_mm)

    def detector_center(self) -> np.ndarray:
        direction = self._beam_direction()
        distance = self.source_to_detector_mm - self.source_to_isocenter_mm
        return direction * distance + np.array(self.table_offset_mm)

    def detector_normal(self) -> np.ndarray:
        return -self._beam_direction()

    def detector_u_axis(self) -> np.ndarray:
        normal = self.detector_normal()
        superior = np.array([0.0, 0.0, 1.0])
        u = np.cross(superior, normal)
        if np.linalg.norm(u) < 1e-8:
            u = np.array([1.0, 0.0, 0.0])
        u = u / np.linalg.norm(u)
        if self.detector_rotation_deg:
            u = _rotate_about_axis(u, normal, math.radians(self.detector_rotation_deg))
        return u

    def detector_v_axis(self) -> np.ndarray:
        normal = self.detector_normal()
        u = self.detector_u_axis()
        v = np.cross(normal, u)
        return v / np.linalg.norm(v)

    def detector_pixel_world_coordinates(self, downsample: int = 1) -> np.ndarray:
        rows, cols = self.detector_shape
        step = max(1, int(downsample))
        row_idx = np.arange(0, rows, step, dtype=np.float32)
        col_idx = np.arange(0, cols, step, dtype=np.float32)
        rr, cc = np.meshgrid(row_idx, col_idx, indexing="ij")
        row_spacing, col_spacing = self.detector_pixel_spacing_mm
        u = self.detector_u_axis()
        v = self.detector_v_axis()
        center = self.detector_center()
        du = (cc - (cols - 1) / 2.0) * col_spacing + self.detector_offset_mm[0]
        dv = (rr - (rows - 1) / 2.0) * row_spacing + self.detector_offset_mm[1]
        return center + du[..., None] * u + dv[..., None] * v

    def describe(self) -> str:
        return (
            f"CArmGeometry(primary={self.primary_angle_deg:.1f}, "
            f"secondary={self.secondary_angle_deg:.1f}, "
            f"detector={self.detector_shape[0]}x{self.detector_shape[1]})"
        )

    def _beam_direction(self) -> np.ndarray:
        primary = math.radians(self.primary_angle_deg)
        secondary = math.radians(self.secondary_angle_deg)
        base = np.array([0.0, 1.0, 0.0])
        rz = np.array(
            [
                [math.cos(primary), -math.sin(primary), 0.0],
                [math.sin(primary), math.cos(primary), 0.0],
                [0.0, 0.0, 1.0],
            ]
        )
        rx = np.array(
            [
                [1.0, 0.0, 0.0],
                [0.0, math.cos(secondary), -math.sin(secondary)],
                [0.0, math.sin(secondary), math.cos(secondary)],
            ]
        )
        direction = rx @ rz @ base
        return direction / np.linalg.norm(direction)


def _rotate_about_axis(vector: np.ndarray, axis: np.ndarray, theta: float) -> np.ndarray:
    axis = axis / np.linalg.norm(axis)
    return (
        vector * math.cos(theta)
        + np.cross(axis, vector) * math.sin(theta)
        + axis * np.dot(axis, vector) * (1.0 - math.cos(theta))
    )

