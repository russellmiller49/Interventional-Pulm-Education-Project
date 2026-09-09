import { SUITE_VIEWS } from '../content/suiteViews'
import { LESION_CENTER } from '../lib/physics'
import { labReadouts } from '../engine/labMetrics'
import { samplingPlanes } from '../components/suite/samplingModel'
import { resolveSuiteInputs } from '../components/suite/suiteViewSpec'

test('sampling geometry uses the same tip and side window as the slice and goal oracle', () => {
  for (const tipX of [-5, 0, 14]) {
    const values = { tipX, tipY: 0, tipZ: 0, axial: 3, coronal: -4, sagittal: 5 }
    const model = samplingPlanes(resolveSuiteInputs(SUITE_VIEWS['tool-confirmation'], values))
    const readouts = labReadouts('mpr', values, 'tool-confirmation')
    expect(model.relationship.intersects).toBe(readouts.windowIntersects)
    expect(model.relationship.tipInside).toBe(readouts.tipInside)
    expect(model.windowStart[0]).toBe(LESION_CENTER[0] + tipX - 14)
    expect(model.windowEnd[0]).toBe(LESION_CENTER[0] + tipX - 6)
    for (const [index, axis] of [2, 1, 0].entries())
      for (const p of model.planes[index].points)
        expect(p[axis]).toBe(LESION_CENTER[axis] + [3, -4, 5][index])
  }
})
