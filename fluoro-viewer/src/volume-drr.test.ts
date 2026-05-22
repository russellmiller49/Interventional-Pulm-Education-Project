import { reconstructHuFromNormalizedSample, resolveVolumeRenderPlan } from './volume-drr'

test('reconstructHuFromNormalizedSample uses normalized R8 sampler values', () => {
  expect(reconstructHuFromNormalizedSample(0, [-1144, 2951])).toBe(-1144)
  expect(reconstructHuFromNormalizedSample(1, [-1144, 2951])).toBe(2951)
  expect(reconstructHuFromNormalizedSample(0.5, [-1144, 2951])).toBeCloseTo(903.5)
})

test('resolveVolumeRenderPlan uses interactive and full recommendations', () => {
  const asset = {
    recommendedSteps: { interactive: 96, full: 240 },
    recommendedRenderScale: { interactive: 0.6, full: 1 },
  }

  expect(resolveVolumeRenderPlan(asset, true)).toEqual({ sampleSteps: 96, renderScale: 0.6 })
  expect(resolveVolumeRenderPlan(asset, false)).toEqual({ sampleSteps: 240, renderScale: 1 })
})
