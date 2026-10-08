import { teachingNumberErrors } from '../../learning-module/numbers/teachingNumbers'
import { crrtSimulatedAlertLabel } from '../content/alertLabels'
import { crrtPressureSignalDetails } from '../content/circuitModel'
import { baxterCrrtLearnLessonById } from '../content/learnLessons'
import { baxterCrrtLearnerFacingSourceById } from '../content/learnerSourceMap'
import { CRRT_NUMBER_ONLY_SOURCES, CRRT_NUMBERS } from '../content/teachingNumbers'

/**
 * docs/teaching-first-rules.md: a number a decision depends on is taught, and the module's
 * register records its class, source and check date. These replace the tests that required a
 * hedge in its place.
 */
describe('CRRT teaching numbers', () => {
  it('gives every registered number a class, a resolvable source and a check date', () => {
    const ids = new Set<string>([
      ...baxterCrrtLearnerFacingSourceById.keys(),
      ...CRRT_NUMBER_ONLY_SOURCES.map((source) => source.id),
    ])
    expect(teachingNumberErrors(CRRT_NUMBERS, ids)).toEqual([])
  })

  it('states the citrate targets in the anticoagulation lesson', () => {
    const lesson = baxterCrrtLearnLessonById.get('crrt-anticoagulation')!
    const paragraphs = (lesson.paragraphs ?? []).join(' ')
    expect(paragraphs).toContain(CRRT_NUMBERS.value('postfilter-ica'))
    expect(paragraphs).toContain(CRRT_NUMBERS.value('calcium-ratio'))
  })

  it('gives every pressure signal concrete first moves', () => {
    expect(crrtPressureSignalDetails.length).toBeGreaterThan(0)
    for (const detail of crrtPressureSignalDetails) {
      expect({ signal: detail.id, text: detail.firstInspectionBoundary }).not.toEqual({
        signal: detail.id,
        text: expect.stringMatching(/hand the decision|responsible clinical team/i),
      })
      expect(detail.firstInspectionBoundary.length).toBeGreaterThanOrEqual(80)
    }
  })

  it('names the access-obstruction alert as the PrisMax alarm', () => {
    expect(crrtSimulatedAlertLabel('ACCESS_OBSTRUCTION')).toBe('Access Extremely Negative alarm')
  })
})
