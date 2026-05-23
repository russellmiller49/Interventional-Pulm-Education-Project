from fluoroview_pipeline.physics.knobology import (
    DoseState,
    FluoroSettings,
    estimate_relative_dose_rate,
    field_area_fraction,
    noise_sigma,
    update_dose_state,
)


def test_ma_reduces_noise_and_increases_dose():
    low = FluoroSettings(ma=1)
    high = FluoroSettings(ma=4)
    assert noise_sigma(high) < noise_sigma(low)
    assert estimate_relative_dose_rate(high) > estimate_relative_dose_rate(low)


def test_collimation_reduces_kap_but_not_air_kerma_rate():
    open_field = FluoroSettings()
    collimated = FluoroSettings(collimation_fraction_x=0.5, collimation_fraction_y=0.5)
    assert field_area_fraction(collimated) < field_area_fraction(open_field)
    state = update_dose_state(DoseState(), collimated, frame_count=10)
    assert state.cumulative_relative_kap < state.cumulative_relative_air_kerma


def test_detector_magnification_increases_dose_but_digital_zoom_does_not():
    base = FluoroSettings(magnification_factor=2, magnification_mode="digital")
    detector = FluoroSettings(magnification_factor=2, magnification_mode="detector")
    assert estimate_relative_dose_rate(detector) > estimate_relative_dose_rate(base)

