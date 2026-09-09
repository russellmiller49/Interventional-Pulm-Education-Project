import { SUITE_VIEWS } from '../content/suiteViews'
import { LESION_CENTER, projectToDetector } from '../lib/physics'
import { labReadouts } from '../engine/labMetrics'
import { registration } from '../components/suite/registrationModel'
import { resolveSuiteInputs } from '../components/suite/suiteViewSpec'

test('registration translates the current CT and stored contour independently while the tool stays fixed', () => {
  const view = SUITE_VIEWS['changing-anatomy']
  const a = registration(resolveSuiteInputs(view, { shift: 0, previous: 0 }))
  const values = { shift: 25, previous: 10 }
  const b = registration(resolveSuiteInputs(view, values))
  expect(b.toolTip).toEqual(a.toolTip)
  expect(b.currentOffset).toEqual([0, 0, -25])
  expect(b.storedTarget).toEqual([LESION_CENTER[0], LESION_CENTER[1], LESION_CENTER[2] - 10])
  expect(b.stale).toBe(labReadouts('registration', values, view.sectionId).contourStale)
  const updated = registration(resolveSuiteInputs(view, { shift: 25, previous: 25 }))
  expect(updated.currentProjection.hit).toEqual(updated.storedProjection.hit)
  const projected = projectToDetector(b.currentTarget, 0, 0)
  expect(b.currentProjection.uv[0]).toBeCloseTo(projected[0])
  expect(b.currentProjection.uv[1]).toBeCloseTo(projected[1])
})
