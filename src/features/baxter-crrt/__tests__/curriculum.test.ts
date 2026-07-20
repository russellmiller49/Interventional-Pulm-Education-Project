import {
  baxterCrrtAdditionalCaseIds,
  baxterCrrtCoreCaseIds,
  baxterCrrtCurriculum,
  baxterCrrtPracticeCaseIds,
  isCrrtCapstoneUnlocked,
  nextRecommendedCrrtActivity,
  remainingCrrtCoreCaseIds,
} from '../content'
import { createDefaultProgress } from '../engine/progress'

describe('Baxter CRRT curriculum curation', () => {
  it('defines six stations with at least one core case and exactly ten core cases overall', () => {
    expect(baxterCrrtCurriculum).toHaveLength(6)
    expect(baxterCrrtCurriculum.map(({ station }) => station)).toEqual([1, 2, 3, 4, 5, 6])
    expect(baxterCrrtCurriculum.every(({ coreCaseIds }) => coreCaseIds.length > 0)).toBe(true)
    expect(baxterCrrtCoreCaseIds).toEqual([
      'CRRT-01',
      'CRRT-02',
      'CRRT-04',
      'CRRT-05',
      'CRRT-08',
      'CRRT-11',
      'CRRT-13',
      'CRRT-15',
      'CRRT-17',
      'CRRT-18',
    ])
  })

  it('keeps seven optional cases and excludes CRRT-16 from every Practice picker list', () => {
    expect(baxterCrrtAdditionalCaseIds).toEqual([
      'CRRT-03',
      'CRRT-06',
      'CRRT-07',
      'CRRT-09',
      'CRRT-10',
      'CRRT-12',
      'CRRT-14',
    ])
    expect(baxterCrrtPracticeCaseIds).toHaveLength(17)
    expect(baxterCrrtPracticeCaseIds).not.toContain('CRRT-16')
  })

  it('gates the capstone on core cases only', () => {
    const defaultProgress = createDefaultProgress()
    expect(isCrrtCapstoneUnlocked(defaultProgress)).toBe(false)
    expect(remainingCrrtCoreCaseIds(defaultProgress)).toEqual(baxterCrrtCoreCaseIds)

    const optionalOnly = {
      ...defaultProgress,
      completedPracticeCaseIds: baxterCrrtAdditionalCaseIds.map((id) => id.toLowerCase()),
    }
    expect(isCrrtCapstoneUnlocked(optionalOnly)).toBe(false)

    const allCore = {
      ...defaultProgress,
      completedPracticeCaseIds: baxterCrrtCoreCaseIds.map((id) => id.toLowerCase()),
    }
    expect(isCrrtCapstoneUnlocked(allCore)).toBe(true)
    expect(remainingCrrtCoreCaseIds(allCore)).toEqual([])
  })

  it('recommends lessons, core cases, then the capstone in core-path order', () => {
    const progress = createDefaultProgress()
    expect(nextRecommendedCrrtActivity(progress)).toMatchObject({
      kind: 'lesson',
      id: 'crrt-indications-modality',
    })

    const allCoreComplete = {
      ...progress,
      completedLessonIds: baxterCrrtCurriculum.flatMap(({ lessonIds }) => lessonIds),
      completedPracticeCaseIds: baxterCrrtCoreCaseIds.map((id) => id.toLowerCase()),
    }
    expect(nextRecommendedCrrtActivity(allCoreComplete)).toMatchObject({
      kind: 'capstone',
      id: 'MASTERY-PRISMAX-01',
    })
  })
})
