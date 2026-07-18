import {
  cardiohelpCurriculum,
  capstoneScenarioIdForMode,
  isTrackCapstoneUnlocked,
  nextRecommendedActivity,
  orderedCaseScenarioIds,
  orderedLessonScenarioIds,
  pairedCaseIdsForLesson,
  pairedLessonIdsForCase,
  remainingCapstonePrerequisites,
  validateCurriculumRegistry,
} from '../content/curriculum'
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
    expect(orderedCaseScenarioIds('vv')).toHaveLength(6)
    expect(orderedCaseScenarioIds('va')).toHaveLength(6)
    expect(new Set(orderedLessonScenarioIds('vv')).size).toBe(10)
    expect(new Set(orderedCaseScenarioIds('va')).size).toBe(6)
  })

  it('round-trips lesson and case pairings within a unit', () => {
    expect(pairedCaseIdsForLesson('acute-hypercapnia')).toContain('clinical-vv-gas-disconnection')
    expect(pairedLessonIdsForCase('clinical-vv-gas-disconnection')).toContain('acute-hypercapnia')
    expect(pairedCaseIdsForLesson('va-differential-hypoxemia')).toEqual([
      'va-clinical-differential-hypoxemia',
    ])
    expect(pairedCaseIdsForLesson('arterial-bubble-stop')).toHaveLength(0)
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
