import numpy as np

from fluoroview_pipeline.physics.hu import hu_to_windowed_image, safe_clip_hu, stored_to_hu


def test_stored_to_hu_uses_slope_and_intercept():
    stored = np.array([0, 1024], dtype=np.int16)
    np.testing.assert_allclose(stored_to_hu(stored, 1, -1024), [-1024, 0])
    np.testing.assert_allclose(stored_to_hu(stored, 2, -1000), [-1000, 1048])


def test_windowing_and_clip_are_finite():
    data = np.array([-2000, -500, 0, 1000, np.nan], dtype=np.float32)
    clipped = safe_clip_hu(data)
    assert np.isfinite(clipped).all()
    windowed = hu_to_windowed_image(data, window_center=0, window_width=1000)
    assert windowed.min() >= 0
    assert windowed.max() <= 1

