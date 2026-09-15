import { buildDrillStageLesson } from '../components/stage/adapters/drillStageAdapter'
import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import { pairedCaseForLesson } from '../content/curriculum'
import { cardiohelpLearnLessons } from '../content/learnLessons'

/**
 * I3f — what the stage hands the completion card, for all twenty drills.
 *
 * The card reads `practicePairing` and nothing else, so the adapter has to carry the kind the
 * mechanism map resolved, the case it named, and the case's existing title. Named learning cases remain findable
 * before the optional prediction or explanation is opened (ECMO-02).
 */
describe('the drill stage carries the mechanism pairing to the completion card', () => {
  it.each(cardiohelpLearnLessons.map((lesson) => [lesson.scenarioId, lesson] as const))(
    '%s',
    (_id, lesson) => {
      const stage = buildDrillStageLesson(lesson, lesson.supportMode)
      const pairing = pairedCaseForLesson(lesson.scenarioId)

      if (pairing.kind === 'none') {
        expect(stage.practicePairing).toBeUndefined()
        return
      }
      const clinical = clinicalPracticeScenarioById.get(pairing.caseId)
      if (!clinical) throw new Error(`${pairing.caseId} is not a registered case`)
      expect(stage.practicePairing).toEqual({
        kind: pairing.kind,
        caseId: clinical.id,
        title: clinical.title,
      })
    },
  )

  it('offers a Practice case to seventeen drills and none to the three without a unit case', () => {
    const stages = cardiohelpLearnLessons.map((lesson) =>
      buildDrillStageLesson(lesson, lesson.supportMode),
    )
    expect(stages.filter((stage) => stage.practicePairing).length).toBe(17)
    expect(
      stages
        .filter((stage) => !stage.practicePairing)
        .map((stage) => stage.scenarioId)
        .sort(),
    ).toEqual(['va-acute-hypercapnia', 'va-gas-source-interruption', 'va-lv-loading'])
    expect(stages.filter((stage) => stage.practicePairing?.kind === 'mechanism-match').length).toBe(
      11,
    )
    expect(stages.filter((stage) => stage.practicePairing?.kind === 'next-in-unit').length).toBe(6)
  })
})
