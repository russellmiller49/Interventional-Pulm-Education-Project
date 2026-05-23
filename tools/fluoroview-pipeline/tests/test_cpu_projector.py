import numpy as np

from fluoroview_pipeline.drr.base import ProjectionOptions
from fluoroview_pipeline.drr.cpu_projector import CpuRaySumProjector
from fluoroview_pipeline.examples.synthetic_phantoms import create_synthetic_chest_phantom
from fluoroview_pipeline.geometry.carm import CArmGeometry


def test_cpu_projection_shape_and_determinism():
    volume, spacing, _metadata = create_synthetic_chest_phantom(shape=(24, 32, 32))
    geometry = CArmGeometry(detector_shape=(64, 64))
    options = ProjectionOptions(downsample=2)
    projector = CpuRaySumProjector()
    first = projector.project(volume, spacing, geometry, options).image
    second = projector.project(volume, spacing, geometry, options).image
    assert first.shape == (32, 32)
    assert np.isfinite(first).all()
    np.testing.assert_allclose(first, second)


def test_dense_object_changes_projection():
    air = np.full((24, 32, 32), -1000, dtype=np.float32)
    dense = air.copy()
    dense[:, 14:18, 14:18] = 1000
    geometry = CArmGeometry(detector_shape=(32, 32))
    projector = CpuRaySumProjector()
    air_projection = projector.project(air, (1, 1, 1), geometry).image
    dense_projection = projector.project(dense, (1, 1, 1), geometry).image
    assert not np.allclose(air_projection, dense_projection)

