"""Educational fluoroscopy knobology and relative dose model."""

from __future__ import annotations

from dataclasses import dataclass
import math


@dataclass(frozen=True)
class FluoroSettings:
    kvp: float = 80.0
    ma: float = 2.0
    pulse_width_ms: float = 8.0
    pulse_rate_fps: float = 7.5
    collimation_fraction_x: float = 1.0
    collimation_fraction_y: float = 1.0
    magnification_mode: str = "none"
    magnification_factor: float = 1.0
    abc_enabled: bool = True
    scatter_enabled: bool = True
    noise_enabled: bool = True
    detector_blur_sigma: float = 0.6
    temporal_averaging_frames: int = 1
    high_dose_mode: bool = False


@dataclass(frozen=True)
class DoseState:
    cumulative_frames: int = 0
    cumulative_relative_air_kerma: float = 0.0
    cumulative_relative_kap: float = 0.0
    elapsed_fluoro_seconds: float = 0.0


def field_area_fraction(settings: FluoroSettings) -> float:
    x = min(max(settings.collimation_fraction_x, 0.05), 1.0)
    y = min(max(settings.collimation_fraction_y, 0.05), 1.0)
    return x * y


def noise_sigma(settings: FluoroSettings) -> float:
    photons = max(settings.ma * settings.pulse_width_ms, 0.1)
    dose_quality = 2.0 if settings.high_dose_mode else 1.0
    return 1.0 / math.sqrt(photons * dose_quality)


def dose_multiplier_for_magnification(settings: FluoroSettings) -> float:
    factor = max(settings.magnification_factor, 1.0)
    if settings.magnification_mode == "detector":
        return factor * factor
    return 1.0


def estimate_relative_dose_rate(
    settings: FluoroSettings,
    thickness_proxy: float = 1.0,
) -> float:
    exposure = settings.ma * settings.pulse_width_ms * settings.pulse_rate_fps
    abc = max(thickness_proxy, 0.2) if settings.abc_enabled else 1.0
    high_dose = 2.0 if settings.high_dose_mode else 1.0
    return exposure * abc * high_dose * dose_multiplier_for_magnification(settings) / 100.0


def update_dose_state(
    state: DoseState,
    settings: FluoroSettings,
    frame_count: int,
    thickness_proxy: float = 1.0,
) -> DoseState:
    frames = max(0, int(frame_count))
    dose_per_second = estimate_relative_dose_rate(settings, thickness_proxy)
    seconds = frames / max(settings.pulse_rate_fps, 0.1)
    air_kerma = dose_per_second * seconds
    kap = air_kerma * field_area_fraction(settings)
    return DoseState(
        cumulative_frames=state.cumulative_frames + frames,
        cumulative_relative_air_kerma=state.cumulative_relative_air_kerma + air_kerma,
        cumulative_relative_kap=state.cumulative_relative_kap + kap,
        elapsed_fluoro_seconds=state.elapsed_fluoro_seconds + seconds,
    )

