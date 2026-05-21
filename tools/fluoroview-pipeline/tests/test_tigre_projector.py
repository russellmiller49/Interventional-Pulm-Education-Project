import numpy as np
import pytest

from fluoroview_pipeline.drr.base import ProjectionOptions
from fluoroview_pipeline.drr.cpu_projector import CpuRaySumProjector
from fluoroview_pipeline.drr.tigre_projector import (
    TigreProjector,
    _hu_to_mu,
    _prepare_volume_for_tigre,
    is_available,
)
from fluoroview_pipeline.geometry.carm import CArmGeometry


def test_hu_to_mu_clips_air_to_zero_and_keeps_bone_positive():
    volume = np.array([-1200, -1000, 0, 1000], dtype=np.float32)

    mu = _hu_to_mu(volume, ProjectionOptions(mu_water=0.02))

    assert mu.tolist() == pytest.approx([0.0, 0.0, 0.02, 0.04])


def test_prepare_volume_for_tigre_maps_patient_axes_to_tigre_native_axes():
    volume = np.arange(2 * 3 * 4, dtype=np.float32).reshape(2, 3, 4)

    native = _prepare_volume_for_tigre(volume)

    assert native.shape == (2, 4, 3)
    np.testing.assert_array_equal(native[:, :, 0], volume[:, -1, :])
    np.testing.assert_array_equal(native[:, :, -1], volume[:, 0, :])


def test_tigre_projector_raises_clear_error_when_unavailable():
    if is_available():
        pytest.skip("TIGRE is available in this environment.")

    volume = np.full((8, 8, 8), -1000, dtype=np.float32)

    with pytest.raises(RuntimeError, match="TIGRE"):
        TigreProjector().project(volume, (1.0, 1.0, 1.0), CArmGeometry(detector_shape=(16, 16)))


@pytest.mark.skipif(not is_available(), reason="TIGRE/CUDA is not installed.")
def test_tigre_projection_shape_and_gross_ap_orientation_match_cpu():
    volume = np.full((24, 32, 32), -1000, dtype=np.float32)
    volume[8:18, 10:22, 21:27] = 1000
    geometry = CArmGeometry(detector_shape=(64, 64))
    options = ProjectionOptions(downsample=2, invert_for_fluoro=False)

    cpu = CpuRaySumProjector().project(volume, (1.0, 1.0, 1.0), geometry, options).image
    tigre = TigreProjector().project(volume, (1.0, 1.0, 1.0), geometry, options)

    assert tigre.image.shape == cpu.shape == (32, 32)
    assert np.isfinite(tigre.image).all()
    assert tigre.metadata["backend"] == "tigre"
    assert abs(_weighted_x(cpu) - _weighted_x(tigre.image)) < cpu.shape[1] * 0.3


def _weighted_x(image: np.ndarray) -> float:
    weights = image.astype(np.float32) - float(np.min(image))
    total = float(np.sum(weights))
    if total <= 0:
        return image.shape[1] / 2
    x = np.arange(image.shape[1], dtype=np.float32)
    return float(np.sum(weights * x[None, :]) / total)
