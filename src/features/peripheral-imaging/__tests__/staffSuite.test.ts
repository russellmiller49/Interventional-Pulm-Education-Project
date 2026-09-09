import { SUITE_VIEWS } from '../content/suiteViews'
import { labReadouts } from '../engine/labMetrics'
import { staff } from '../components/suite/staffModel'
import { resolveSuiteInputs } from '../components/suite/suiteViewSpec'

test('staff distance matches the lab trend; shielding only marks a geometric sector', () => {
  const view = SUITE_VIEWS['staff-protection']
  for (const distance of [1.3, 1.6, 3]) {
    const a = staff(resolveSuiteInputs(view, { distance, shield: false }))
    const b = staff(resolveSuiteInputs(view, { distance, shield: true }))
    expect(a.inverseSquareRatio).toBe(
      labReadouts('safety', { distance }, view.sectionId).inverseSquareRatio,
    )
    expect(b.inverseSquareRatio).toBe(a.inverseSquareRatio)
    expect(Math.hypot(a.position[0], a.position[2])).toBeCloseTo(distance * 1000)
    expect(a.rings[0].segments.some((p) => p.shadow)).toBe(false)
    expect(b.rings[0].segments.some((p) => p.shadow)).toBe(true)
  }
})
test('authored scatter weighting follows the beam entrance side as the gantry rotates', () => {
  const view = SUITE_VIEWS['staff-protection']
  const left = staff(resolveSuiteInputs(view, { orbit: 90 }))
  const right = staff(resolveSuiteInputs(view, { orbit: -90 }))
  expect(left.tubeWeight(0)).toBeGreaterThan(left.tubeWeight(Math.PI))
  expect(right.tubeWeight(Math.PI)).toBeGreaterThan(right.tubeWeight(0))
})
