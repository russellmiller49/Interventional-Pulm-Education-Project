import { SUITE_VIEWS } from '../content/suiteViews'
import { labReadouts } from '../engine/labMetrics'
import { dosePlanes } from '../components/suite/doseModel'
import { resolveSuiteInputs } from '../components/suite/suiteViewSpec'
import { projectToDetector } from '../lib/physics'

test('defined free-air planes preserve KAP and agree with the lab across its input range', () => {
  const view = SUITE_VIEWS['dose-reporting']
  for (const kerma of [1, 10, 20])
    for (const area of [50, 100, 500]) {
      const model = dosePlanes(resolveSuiteInputs(view, { kerma, area }))
      const kap = labReadouts('dose', { kerma, area }, view.sectionId).kapGyCm2 as number
      for (const plane of model.planes) expect(plane.kapGyCm2).toBeCloseTo(kap, 12)
      expect(model.planes[0].kermaMgy).toBeGreaterThan(model.planes[1].kermaMgy)
      expect(model.planes[0].areaCm2).toBeLessThan(model.planes[1].areaCm2)
      expect(model.skinEntry).toBeNull()
    }
})

test('both quantity planes share the same cone footprint at an oblique detector', () => {
  const inputs = {
    ...resolveSuiteInputs(SUITE_VIEWS['dose-reporting'], { kerma: 8, area: 250 }),
    orbit: 45,
    tilt: 20,
  }
  const model = dosePlanes(inputs)
  const expectedHalf =
    ((Math.sqrt(inputs.areaCm2 * 100) / 2) * inputs.geometry.sid) / inputs.geometry.sod
  for (const plane of model.planes)
    for (const point of plane.points) {
      const [u, v] = projectToDetector(point, inputs.orbit, inputs.tilt, inputs.geometry)
      expect(Math.abs(u)).toBeCloseTo(expectedHalf, 8)
      expect(Math.abs(v)).toBeCloseTo(expectedHalf, 8)
    }
})
