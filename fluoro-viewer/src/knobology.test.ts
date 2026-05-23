import {
  DEFAULT_FLUORO_SETTINGS,
  EMPTY_DOSE_STATE,
  estimateRelativeDoseRate,
  fieldAreaFraction,
  imageBrightnessForSettings,
  imageContrastForSettings,
  noiseSigma,
  updateDoseState,
} from './knobology'

test('mA reduces noise and increases relative dose', () => {
  const low = { ...DEFAULT_FLUORO_SETTINGS, ma: 1 }
  const high = { ...DEFAULT_FLUORO_SETTINGS, ma: 4 }
  expect(noiseSigma(high)).toBeLessThan(noiseSigma(low))
  expect(estimateRelativeDoseRate(high)).toBeGreaterThan(estimateRelativeDoseRate(low))
})

test('collimation reduces relative KAP contribution', () => {
  const collimated = { ...DEFAULT_FLUORO_SETTINGS, collimationX: 0.5, collimationY: 0.5 }
  expect(fieldAreaFraction(collimated)).toBeLessThan(fieldAreaFraction(DEFAULT_FLUORO_SETTINGS))
  const dose = updateDoseState(EMPTY_DOSE_STATE, collimated, 10)
  expect(dose.cumulativeRelativeKap).toBeLessThan(dose.cumulativeRelativeAirKerma)
})

test('detector magnification increases dose but digital zoom does not', () => {
  const digital = {
    ...DEFAULT_FLUORO_SETTINGS,
    magnificationMode: 'digital' as const,
    magnificationFactor: 2,
  }
  const detector = {
    ...DEFAULT_FLUORO_SETTINGS,
    magnificationMode: 'detector' as const,
    magnificationFactor: 2,
  }
  expect(estimateRelativeDoseRate(detector)).toBeGreaterThan(estimateRelativeDoseRate(digital))
})

test('exposure controls brighten the educational fluoro image', () => {
  const low = { ...DEFAULT_FLUORO_SETTINGS, kvp: 60, ma: 1, pulseWidthMs: 4 }
  const high = { ...DEFAULT_FLUORO_SETTINGS, kvp: 120, ma: 8, pulseWidthMs: 14 }
  expect(imageBrightnessForSettings(DEFAULT_FLUORO_SETTINGS)).toBeGreaterThan(1)
  expect(imageBrightnessForSettings(high)).toBeGreaterThan(imageBrightnessForSettings(low))
})

test('higher kVp lowers displayed contrast while exposure remains bright', () => {
  const lowKvp = { ...DEFAULT_FLUORO_SETTINGS, kvp: 60 }
  const highKvp = { ...DEFAULT_FLUORO_SETTINGS, kvp: 120 }
  expect(imageContrastForSettings(highKvp)).toBeLessThan(imageContrastForSettings(lowKvp))
})
