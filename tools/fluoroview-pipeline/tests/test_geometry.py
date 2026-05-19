import numpy as np

from fluoroview_pipeline.geometry.carm import CArmGeometry


def test_ap_source_and_detector_are_opposite():
    geometry = CArmGeometry.ap()
    source = geometry.source_position()
    detector = geometry.detector_center()
    assert np.dot(source, detector) < 0


def test_detector_axes_are_orthonormal():
    geometry = CArmGeometry.oblique(30, 15)
    u = geometry.detector_u_axis()
    v = geometry.detector_v_axis()
    n = geometry.detector_normal()
    assert np.isclose(np.linalg.norm(u), 1)
    assert np.isclose(np.linalg.norm(v), 1)
    assert np.isclose(np.linalg.norm(n), 1)
    assert abs(np.dot(u, v)) < 1e-6


def test_pixel_coordinate_shape_honors_downsample():
    coords = CArmGeometry(detector_shape=(64, 80)).detector_pixel_world_coordinates(downsample=4)
    assert coords.shape == (16, 20, 3)

