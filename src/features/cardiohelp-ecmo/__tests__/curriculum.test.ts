import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import {
  cardiohelpCurriculum,
  capstoneScenarioIdForMode,
  caseMechanismByCaseId,
  isTrackCapstoneUnlocked,
  lessonMechanism,
  nextRecommendedActivity,
  orderedCaseScenarioIds,
  orderedLessonScenarioIds,
  pairedCaseForLesson,
  pairedCaseIdByLessonScenarioId,
  pairedCaseIdsForLesson,
  pairedLessonIdsForCase,
  remainingCapstonePrerequisites,
  unitIdByCaseScenarioId,
  unitIdByLessonScenarioId,
  validateCurriculumRegistry,
  validatePracticePairing,
  type EcmoCaseMechanism,
} from '../content/curriculum'
import {
  capstoneLessonErrors,
  cardiohelpLearnLessonByScenarioId,
  cardiohelpLearnLessonsBySupportMode,
} from '../content/learnLessons'
import { cardiohelpCapstonePrerequisiteIdsBySupportMode } from '../content/scenarios'

describe('CARDIOHELP curriculum registry', () => {
  it('validates with no errors', () => {
    expect(validateCurriculumRegistry()).toEqual([])
  })

  it('defines seven units per track with the expected capstones', () => {
    expect(cardiohelpCurriculum.vv).toHaveLength(7)
    expect(cardiohelpCurriculum.va).toHaveLength(7)
    expect(capstoneScenarioIdForMode('vv')).toBe('vv-off-sweep-capstone')
    expect(capstoneScenarioIdForMode('va')).toBe('va-mixed-circulation-capstone')
  })

  it('orders every lesson and case exactly once per track', () => {
    expect(orderedLessonScenarioIds('vv')).toHaveLength(10)
    expect(orderedLessonScenarioIds('va')).toHaveLength(10)
    expect(orderedCaseScenarioIds('vv')).toHaveLength(7)
    expect(orderedCaseScenarioIds('va')).toHaveLength(7)
    expect(new Set(orderedLessonScenarioIds('vv')).size).toBe(10)
    expect(new Set(orderedCaseScenarioIds('va')).size).toBe(7)
  })

  it('round-trips lesson and case pairings within a unit', () => {
    expect(pairedCaseIdsForLesson('acute-hypercapnia')).toContain('clinical-vv-gas-disconnection')
    expect(pairedLessonIdsForCase('clinical-vv-gas-disconnection')).toContain('acute-hypercapnia')
    expect(pairedCaseIdsForLesson('va-differential-hypoxemia')).toEqual([
      'va-clinical-differential-hypoxemia',
    ])
    expect(pairedCaseIdsForLesson('arterial-bubble-stop')).toContain(
      'clinical-vv-circuit-air-embolism',
    )
    expect(pairedCaseIdsForLesson('va-lv-loading')).toHaveLength(0)
  })

  it('unlocks the capstone through lessons, cases, or a mixture', () => {
    const prerequisites = cardiohelpCapstonePrerequisiteIdsBySupportMode.vv
    const locked = { completedLabs: [], completedLearnLessonIds: [] }
    expect(isTrackCapstoneUnlocked(locked, 'vv')).toBe(false)
    expect(
      isTrackCapstoneUnlocked(
        { completedLabs: [], completedLearnLessonIds: prerequisites.slice(0, 5) },
        'vv',
      ),
    ).toBe(false)
    expect(
      isTrackCapstoneUnlocked(
        { completedLabs: [], completedLearnLessonIds: [...prerequisites] },
        'vv',
      ),
    ).toBe(true)
    expect(
      isTrackCapstoneUnlocked(
        { completedLabs: [...prerequisites], completedLearnLessonIds: [] },
        'vv',
      ),
    ).toBe(true)
    expect(
      isTrackCapstoneUnlocked(
        {
          completedLabs: prerequisites.slice(0, 5),
          completedLearnLessonIds: prerequisites.slice(5),
        },
        'vv',
      ),
    ).toBe(true)
  })

  it('lists remaining capstone prerequisites with lesson titles and units', () => {
    const prerequisites = cardiohelpCapstonePrerequisiteIdsBySupportMode.vv
    const remaining = remainingCapstonePrerequisites(
      { completedLabs: [], completedLearnLessonIds: prerequisites.slice(1) },
      'vv',
    )
    expect(remaining).toHaveLength(1)
    expect(remaining[0].scenarioId).toBe(prerequisites[0])
    expect(remaining[0].title.length).toBeGreaterThan(0)
    expect(remaining[0].unitId).not.toBe('')
  })

  it('recommends lessons, then the unit case, then the unlocked capstone', () => {
    expect(
      nextRecommendedActivity({ completedLabs: [], completedLearnLessonIds: [] }, 'vv'),
    ).toEqual({
      kind: 'lesson',
      scenarioId: 'startup-sensor-orientation',
      unitId: 'vv-1-foundations',
    })
    expect(
      nextRecommendedActivity(
        { completedLabs: [], completedLearnLessonIds: ['startup-sensor-orientation'] },
        'vv',
      ),
    ).toEqual({
      kind: 'case',
      scenarioId: 'clinical-vv-initiation-ards',
      unitId: 'vv-1-foundations',
    })
    const allLessons = [...cardiohelpCapstonePrerequisiteIdsBySupportMode.vv]
    const allCases = [...orderedCaseScenarioIds('vv')]
    expect(
      nextRecommendedActivity(
        { completedLabs: allCases, completedLearnLessonIds: allLessons },
        'vv',
      ),
    ).toEqual({ kind: 'capstone', scenarioId: 'vv-off-sweep-capstone', unitId: 'vv-7-capstone' })
    expect(
      nextRecommendedActivity(
        {
          completedLabs: [...allCases, 'vv-off-sweep-capstone'],
          completedLearnLessonIds: allLessons,
        },
        'vv',
      ),
    ).toBeNull()
  })
})

describe('capstone lesson permission (WP10 §4)', () => {
  const capstoneScenarioId = capstoneScenarioIdForMode('vv')
  const base = cardiohelpLearnLessonsBySupportMode.vv[0]

  it('permits exactly one integration-stage lesson to wrap a capstone scenario', () => {
    const asIntegration = {
      ...base,
      id: 'learn-vv-capstone-integration',
      scenarioId: capstoneScenarioId,
      curriculumStage: 'integration' as const,
    }
    expect(capstoneLessonErrors(asIntegration)).toEqual([])
  })

  it('still rejects a non-integration lesson wrapping a capstone scenario', () => {
    const asDrill = {
      ...base,
      id: 'learn-vv-capstone-drill',
      scenarioId: capstoneScenarioId,
    }
    expect(capstoneLessonErrors(asDrill)).toEqual([
      expect.stringContaining('only an integration-stage lesson may wrap the capstone scenario'),
    ])
  })
})

/**
 * I3f — the Learn -> Practice bridge pairs by mechanism, not by unit order.
 *
 * A unit is a theme, and reading "the first case in the unit" as the lesson's application sent the
 * VA membrane drill to the vasoplegia case and the VA air drill to the limb-ischemia case under the
 * words "apply this in Practice". The map below is the one the completion card reads; what is pinned
 * here is that every pair is structurally sound, that the whole table resolves as authored, and that
 * the validator refuses each way the map could go wrong.
 */
describe('I3f: Learn -> Practice pairing by mechanism', () => {
  const allLessonIds = [...orderedLessonScenarioIds('vv'), ...orderedLessonScenarioIds('va')]

  it('pairs every mapped lesson with a case in its own unit and track that applies the same mechanism', () => {
    expect(pairedCaseIdByLessonScenarioId.size).toBe(11)
    for (const [lessonId, caseId] of pairedCaseIdByLessonScenarioId) {
      expect(unitIdByCaseScenarioId.get(caseId)).toBe(unitIdByLessonScenarioId.get(lessonId))
      expect(clinicalPracticeScenarioById.get(caseId)?.supportMode).toBe(
        cardiohelpLearnLessonByScenarioId.get(lessonId)?.supportMode,
      )
      expect(lessonMechanism(lessonId)).not.toBeNull()
      expect(caseMechanismByCaseId.get(caseId)).toBe(lessonMechanism(lessonId))
    }
  })

  it('resolves the whole table as authored', () => {
    expect(allLessonIds.map((id) => [id, pairedCaseForLesson(id)])).toEqual([
      [
        'startup-sensor-orientation',
        { kind: 'mechanism-match', caseId: 'clinical-vv-initiation-ards' },
      ],
      [
        'preload-drainage-collapse',
        { kind: 'mechanism-match', caseId: 'clinical-vv-occult-hemorrhage' },
      ],
      [
        'afterload-return-obstruction',
        { kind: 'next-in-unit', caseId: 'clinical-vv-oxygenator-thrombosis' },
      ],
      [
        'afterload-oxygenator-resistance',
        { kind: 'mechanism-match', caseId: 'clinical-vv-oxygenator-thrombosis' },
      ],
      [
        'vv-recirculation',
        { kind: 'mechanism-match', caseId: 'clinical-vv-recirculation-migration' },
      ],
      ['acute-hypercapnia', { kind: 'next-in-unit', caseId: 'clinical-vv-gas-disconnection' }],
      [
        'compensated-hypercapnia',
        { kind: 'next-in-unit', caseId: 'clinical-vv-gas-disconnection' },
      ],
      [
        'gas-source-interruption',
        { kind: 'mechanism-match', caseId: 'clinical-vv-gas-disconnection' },
      ],
      [
        'arterial-bubble-stop',
        { kind: 'mechanism-match', caseId: 'clinical-vv-circuit-air-embolism' },
      ],
      [
        'transport-power-loss',
        { kind: 'next-in-unit', caseId: 'clinical-vv-circuit-air-embolism' },
      ],
      [
        'va-startup-sensor-orientation',
        { kind: 'mechanism-match', caseId: 'va-clinical-initiation-shock' },
      ],
      [
        'va-preload-drainage-collapse',
        { kind: 'mechanism-match', caseId: 'va-clinical-tamponade' },
      ],
      [
        'va-afterload-arterial-return-obstruction',
        { kind: 'next-in-unit', caseId: 'va-clinical-vasoplegia' },
      ],
      [
        'va-afterload-oxygenator-resistance',
        { kind: 'mechanism-match', caseId: 'va-clinical-oxygenator-thrombosis' },
      ],
      [
        'va-differential-hypoxemia',
        { kind: 'mechanism-match', caseId: 'va-clinical-differential-hypoxemia' },
      ],
      ['va-lv-loading', { kind: 'none' }],
      ['va-acute-hypercapnia', { kind: 'none' }],
      ['va-gas-source-interruption', { kind: 'none' }],
      [
        'va-arterial-bubble-stop',
        { kind: 'mechanism-match', caseId: 'va-clinical-circuit-air-embolism' },
      ],
      ['va-transport-power-loss', { kind: 'next-in-unit', caseId: 'va-clinical-limb-ischemia' }],
    ])
  })

  it('names the three VA drills whose unit has no case as the only gaps', () => {
    const gaps = (supportMode: 'vv' | 'va') =>
      orderedLessonScenarioIds(supportMode).filter((id) => pairedCaseForLesson(id).kind === 'none')
    expect(gaps('vv')).toEqual([])
    expect(gaps('va')).toEqual([
      'va-lv-loading',
      'va-acute-hypercapnia',
      'va-gas-source-interruption',
    ])
    for (const id of gaps('va')) expect(pairedCaseIdsForLesson(id)).toHaveLength(0)
  })

  it('falls back to the unit’s first case, and never to one that applies the lesson’s mechanism', () => {
    const fallbacks = allLessonIds.filter((id) => pairedCaseForLesson(id).kind === 'next-in-unit')
    expect(fallbacks.length).toBeGreaterThan(0)
    for (const id of fallbacks) {
      const pairing = pairedCaseForLesson(id)
      if (pairing.kind !== 'next-in-unit') throw new Error(`${id} is not a fallback`)
      expect(pairing.caseId).toBe(pairedCaseIdsForLesson(id)[0])
      expect(caseMechanismByCaseId.get(pairing.caseId)).not.toBe(lessonMechanism(id))
    }
  })

  it('re-routes the two VA lessons the unit order used to mis-pair', () => {
    // Unit order still says vasoplegia and limb ischemia come first; the mechanism map does not.
    expect(pairedCaseIdsForLesson('va-afterload-oxygenator-resistance')[0]).toBe(
      'va-clinical-vasoplegia',
    )
    expect(pairedCaseForLesson('va-afterload-oxygenator-resistance')).toEqual({
      kind: 'mechanism-match',
      caseId: 'va-clinical-oxygenator-thrombosis',
    })
    expect(pairedCaseIdsForLesson('va-arterial-bubble-stop')[0]).toBe('va-clinical-limb-ischemia')
    expect(pairedCaseForLesson('va-arterial-bubble-stop')).toEqual({
      kind: 'mechanism-match',
      caseId: 'va-clinical-circuit-air-embolism',
    })
  })

  it('declares a mechanism for every case and every lesson, and nothing for an unknown lesson', () => {
    for (const clinical of clinicalPracticeScenarioById.values()) {
      expect(caseMechanismByCaseId.get(clinical.id)).toBeDefined()
    }
    for (const lesson of cardiohelpLearnLessonByScenarioId.values()) {
      expect(lessonMechanism(lesson.scenarioId)).not.toBeNull()
    }
    expect(pairedCaseForLesson('not-a-lesson')).toEqual({ kind: 'none' })
    expect(pairedCaseForLesson('constructor')).toEqual({ kind: 'none' })
  })

  describe('the validator refuses', () => {
    const withPair = (lessonId: string, caseId: string) =>
      new Map([...pairedCaseIdByLessonScenarioId, [lessonId, caseId]])
    const withMechanism = (caseId: string, mechanism: EcmoCaseMechanism) =>
      new Map([...caseMechanismByCaseId, [caseId, mechanism]])

    it('nothing about the authored maps', () => {
      expect(validatePracticePairing()).toEqual([])
    })

    it('a pair across units', () => {
      const errors = validatePracticePairing(
        withPair('acute-hypercapnia', 'clinical-vv-circuit-air-embolism'),
      )
      expect(errors.join('\n')).toMatch(/acute-hypercapnia \(vv-5-sweep\) is paired with/)
    })

    it('a pair across tracks', () => {
      const errors = validatePracticePairing(
        withPair('acute-hypercapnia', 'va-clinical-circuit-air-embolism'),
      )
      expect(errors.join('\n')).toMatch(/is on vv but va-clinical-circuit-air-embolism is on va/)
    })

    it('a pair whose two sides name different mechanisms', () => {
      const errors = validatePracticePairing(
        withPair('afterload-return-obstruction', 'clinical-vv-oxygenator-thrombosis'),
      )
      expect(errors).toContain(
        'pairing: afterload-return-obstruction teaches return-path-resistance but clinical-vv-oxygenator-thrombosis applies membrane-resistance',
      )
    })

    it('a lesson left off the map while a same-mechanism case sits in its unit', () => {
      const without = new Map(pairedCaseIdByLessonScenarioId)
      without.delete('va-afterload-oxygenator-resistance')
      expect(validatePracticePairing(without)).toContain(
        'pairing: va-afterload-oxygenator-resistance and va-clinical-oxygenator-thrombosis share the membrane-resistance mechanism in va-3-afterload but are not paired',
      )
    })

    it('a case with no mechanism, and a mechanism for no case', () => {
      const missing = new Map(caseMechanismByCaseId)
      missing.delete('va-clinical-vasoplegia')
      expect(validatePracticePairing(undefined, missing)).toContain(
        'pairing: case va-clinical-vasoplegia declares no mechanism',
      )
      expect(
        validatePracticePairing(
          undefined,
          withMechanism('clinical-vv-not-a-case', 'recirculation'),
        ),
      ).toContain(
        'pairing: clinical-vv-not-a-case declares a mechanism but is not a registered case',
      )
    })
  })
})
