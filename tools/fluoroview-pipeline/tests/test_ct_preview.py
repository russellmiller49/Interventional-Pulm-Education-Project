import numpy as np

from fluoroview_pipeline.ct_preview import hu_to_uint8


def test_hu_to_uint8_windows_preview_volume():
    volume = np.array([-1000, -500, 0, 500], dtype=np.float32)

    preview = hu_to_uint8(volume, window_low=-1000, window_high=500)

    assert preview.tolist() == [0, 85, 170, 255]
