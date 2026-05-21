"""Optional TIGRE backend.

TIGRE is intentionally imported lazily so local CPU-only development and CI do not require CUDA.
"""

from __future__ import annotations

import importlib.util
import math
from types import ModuleType
from typing import Any

import numpy as np

from fluoroview_pipeline.drr.base import ProjectionOptions, ProjectionResult, ProjectorBackend
from fluoroview_pipeline.geometry.carm import CArmGeometry
from fluoroview_pipeline.physics.hu import hu_to_linear_attenuation, normalize_to_uint8


def is_available() -> bool:
    if importlib.util.find_spec("tigre") is None:
        return False
    try:
        _import_tigre()
    except RuntimeError:
        return False
    return True


class TigreProjector(ProjectorBackend):
    """CUDA/TIGRE projector wrapper."""

    def project(
        self,
        volume_hu: np.ndarray,
        spacing_mm: tuple[float, float, float],
        geometry: CArmGeometry,
        options: ProjectionOptions | None = None,
    ) -> ProjectionResult:
        opts = options or ProjectionOptions()
        tigre = _import_tigre()
        mu_volume = _prepare_volume_for_tigre(_hu_to_mu(volume_hu, opts))
        tigre_geometry = _build_tigre_geometry(volume_hu, spacing_mm, geometry, opts, tigre)
        angles = _build_tigre_angles(geometry)
        projection = _project_with_tigre(mu_volume, tigre_geometry, angles, tigre)
        image = _normalize_projection(projection, opts)

        return ProjectionResult(
            image=image,
            geometry=geometry,
            options=opts,
            metadata={
                "backend": "tigre",
                "educational": True,
                "projector": "tigre.Ax",
                "projectionType": "Siddon",
                "geometry": _geometry_metadata(tigre_geometry, geometry, opts, angles),
                "attenuation": {
                    "muWater": opts.mu_water,
                    "minHu": opts.min_hu,
                    "maxHu": opts.max_hu,
                    "inputUnits": "HU",
                    "projectedUnits": "linear attenuation integral",
                },
            },
        )


def _import_tigre() -> ModuleType:
    try:
        import tigre  # type: ignore
    except Exception as exc:
        raise RuntimeError(
            "TIGRE is not installed or failed to import. Use CpuRaySumProjector locally "
            "or run the TIGRE WSL setup before requesting the TIGRE backend."
        ) from exc
    return tigre


def _hu_to_mu(volume_hu: np.ndarray, options: ProjectionOptions) -> np.ndarray:
    return hu_to_linear_attenuation(
        volume_hu,
        mu_water=options.mu_water,
        min_hu=options.min_hu,
        max_hu=options.max_hu,
    )


def _prepare_volume_for_tigre(mu_volume: np.ndarray) -> np.ndarray:
    """Map CT array axes from patient ``(z, y, x)`` to TIGRE ``(z, y, x)``.

    TIGRE's angle-zero cone geometry places the source on +X and detector on -X. FluoroView's AP
    geometry places the source on patient -Y and detector on +Y, so native TIGRE X is patient -Y,
    native TIGRE Y is patient X, and native TIGRE Z is patient Z.
    """

    native = np.transpose(mu_volume[:, ::-1, :], (0, 2, 1))
    return np.ascontiguousarray(native.astype(np.float32, copy=False))


def _build_tigre_geometry(
    volume_hu: np.ndarray,
    spacing_mm: tuple[float, float, float],
    geometry: CArmGeometry,
    options: ProjectionOptions,
    tigre: ModuleType | None = None,
) -> Any:
    tigre_module = tigre or _import_tigre()
    geo = tigre_module.geometry(mode="cone")
    downsample = max(1, int(options.downsample))
    detector_rows = max(1, int(geometry.detector_shape[0]) // downsample)
    detector_cols = max(1, int(geometry.detector_shape[1]) // downsample)
    row_spacing_mm, col_spacing_mm = geometry.detector_pixel_spacing_mm
    z_spacing_mm, y_spacing_mm, x_spacing_mm = spacing_mm

    geo.DSD = float(geometry.source_to_detector_mm)
    geo.DSO = float(geometry.source_to_isocenter_mm)
    geo.nDetector = np.array([detector_rows, detector_cols], dtype=np.int32)
    geo.dDetector = np.array(
        [row_spacing_mm * downsample, col_spacing_mm * downsample],
        dtype=float,
    )
    geo.sDetector = geo.nDetector * geo.dDetector
    geo.nVoxel = np.array(
        [volume_hu.shape[0], volume_hu.shape[2], volume_hu.shape[1]],
        dtype=np.int32,
    )
    geo.dVoxel = np.array([z_spacing_mm, x_spacing_mm, y_spacing_mm], dtype=float)
    geo.sVoxel = geo.nVoxel * geo.dVoxel
    geo.offOrigin = np.array(
        _table_offset_to_tigre_origin(geometry.table_offset_mm),
        dtype=float,
    )
    geo.offDetector = np.array(
        [geometry.detector_offset_mm[1], geometry.detector_offset_mm[0]],
        dtype=float,
    )
    geo.rotDetector = np.array(
        [math.radians(float(geometry.detector_rotation_deg)), 0.0, 0.0],
        dtype=float,
    )
    geo.COR = 0.0
    geo.accuracy = 0.5
    geo.mode = "cone"
    return geo


def _table_offset_to_tigre_origin(table_offset_mm: tuple[float, float, float]) -> tuple[float, float, float]:
    tx, ty, tz = (float(value) for value in table_offset_mm)
    return (-tz, -tx, ty)


def _build_tigre_angles(geometry: CArmGeometry) -> np.ndarray:
    return np.array(
        [
            [
                math.radians(float(geometry.primary_angle_deg)),
                math.radians(float(geometry.secondary_angle_deg)),
                0.0,
            ]
        ],
        dtype=np.float32,
    )


def _project_with_tigre(
    mu_volume: np.ndarray,
    tigre_geometry: Any,
    angles: np.ndarray,
    tigre: ModuleType | None = None,
) -> np.ndarray:
    tigre_module = tigre or _import_tigre()
    try:
        return np.asarray(tigre_module.Ax(mu_volume, tigre_geometry, angles, "Siddon"))
    except Exception as exc:
        raise RuntimeError("TIGRE projection failed.") from exc


def _normalize_projection(projection: np.ndarray, options: ProjectionOptions) -> np.ndarray:
    if projection.ndim == 3 and projection.shape[0] == 1:
        image = projection[0]
    elif projection.ndim == 2:
        image = projection
    else:
        raise ValueError(f"Unexpected TIGRE projection shape: {projection.shape}")

    image = np.nan_to_num(image.astype(np.float32, copy=False), nan=0.0, posinf=0.0, neginf=0.0)
    if options.invert_for_fluoro:
        image = np.exp(-np.maximum(image, 0.0))
    if options.normalize:
        image = normalize_to_uint8(image).astype(np.float32) / 255.0
    return image.astype(np.float32, copy=False)


def _geometry_metadata(
    tigre_geometry: Any,
    geometry: CArmGeometry,
    options: ProjectionOptions,
    angles: np.ndarray,
) -> dict[str, Any]:
    return {
        "sourceToIsocenterMm": geometry.source_to_isocenter_mm,
        "sourceToDetectorMm": geometry.source_to_detector_mm,
        "detectorShape": np.asarray(tigre_geometry.nDetector, dtype=int).tolist(),
        "detectorPixelSpacingMm": np.asarray(tigre_geometry.dDetector, dtype=float).tolist(),
        "volumeShapeTigreZyx": np.asarray(tigre_geometry.nVoxel, dtype=int).tolist(),
        "voxelSpacingTigreZyxMm": np.asarray(tigre_geometry.dVoxel, dtype=float).tolist(),
        "volumeAxisMapping": {
            "input": "CT array z,y,x",
            "tigreZ": "patient z",
            "tigreY": "patient x",
            "tigreX": "patient -y",
        },
        "offOriginTigreZyxMm": np.asarray(tigre_geometry.offOrigin, dtype=float).tolist(),
        "offDetectorTigreVuMm": np.asarray(tigre_geometry.offDetector, dtype=float).tolist(),
        "anglesRad": angles.tolist(),
        "anglesDeg": {
            "primary": geometry.primary_angle_deg,
            "secondary": geometry.secondary_angle_deg,
        },
        "downsample": max(1, int(options.downsample)),
    }
