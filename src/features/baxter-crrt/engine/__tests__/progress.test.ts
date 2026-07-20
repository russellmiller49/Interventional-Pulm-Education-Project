import {
  BAXTER_CRRT_PROGRESS_STORAGE_KEY,
  BAXTER_CRRT_PROGRESS_VERSION,
  canonicalizeProgress,
  createDefaultProgress,
  parseProgress,
  progressAttemptKey,
  readProgress,
  recordCaseResult,
  recordInstructionalToolCompletion,
  recordLessonCompletion,
  recordRapidDrillCompletion,
  writeProgress,
  type BaxterCrrtProgressStorage,
} from '../progress'

function memoryStorage(initial: Record<string, string> = {}): BaxterCrrtProgressStorage & {
  values: Record<string, string>
} {
  const values = { ...initial }
  return {
    values,
    getItem: (key) => values[key] ?? null,
    setItem: (key, value) => {
      values[key] = value
    },
  }
}

describe('Baxter CRRT progress v3', () => {
  it('keeps the v3 key and intentionally ignores v2 private-pilot results', () => {
    expect(BAXTER_CRRT_PROGRESS_VERSION).toBe(3)
    expect(BAXTER_CRRT_PROGRESS_STORAGE_KEY).toBe('baxter-crrt-progress-v3')
    const storage = memoryStorage({
      'baxter-crrt-progress-v2': JSON.stringify({ version: 2, completedLessonIds: ['legacy'] }),
    })
    expect(readProgress(storage)).toEqual(createDefaultProgress())
  })

  it('allowlists the new lesson IDs, five drills, two labs, curated cases, and capstone', () => {
    let progress = createDefaultProgress()
    progress = recordLessonCompletion(progress, 'crrt-fluid-liberation')
    progress = recordRapidDrillCompletion(progress, 'DRILL-WRONG-SOLUTION')
    progress = recordInstructionalToolCompletion(progress, 'LAB-PRESSURE-LOCALIZATION')
    progress = recordCaseResult(progress, {
      caseId: 'crrt-18',
      device: 'prismax-aw8035-2xx',
      roleLens: 'operator',
      pathway: 'practice',
      score: 82,
      criticalError: false,
      hintCount: 1,
      reassessmentCompleted: true,
      masteryCompleted: false,
    })
    progress = recordCaseResult(progress, {
      caseId: 'MASTERY-PRISMAX-01',
      device: 'prismax-aw8035-2xx',
      roleLens: 'integrated',
      pathway: 'mastery',
      score: 80,
      criticalError: false,
      hintCount: 0,
      reassessmentCompleted: true,
      masteryCompleted: true,
    })

    expect(progress.completedLessonIds).toContain('crrt-fluid-liberation')
    expect(progress.completedRapidDrillIds).toContain('DRILL-WRONG-SOLUTION')
    expect(progress.completedInstructionalToolIds).toContain('LAB-PRESSURE-LOCALIZATION')
    expect(progress.completedPracticeCaseIds).toContain('crrt-18')
    expect(progress.completedMasteryCapstoneIds).toContain('MASTERY-PRISMAX-01')
    expect(
      progress.attempts[
        progressAttemptKey('prismax-aw8035-2xx', 'operator', 'practice', 'crrt-18')
      ],
    ).toBe(1)
  })

  it('excludes CRRT-16 and retired artifacts from learner progress', () => {
    const progress = createDefaultProgress()
    expect(() =>
      recordCaseResult(progress, {
        caseId: 'crrt-16',
        device: 'prismax-aw8035-2xx',
        roleLens: 'integrated',
        pathway: 'practice',
        score: 100,
        criticalError: false,
        hintCount: 0,
        reassessmentCompleted: true,
        masteryCompleted: false,
      }),
    ).toThrow(/registered learner runtime case/i)
    expect(() => recordRapidDrillCompletion(progress, 'DRILL-BLOOD-RETURN')).toThrow()
    expect(() => recordInstructionalToolCompletion(progress, 'LAB-CITRATE-DASHBOARD')).toThrow()
  })

  it('keeps unsafe scores out of best-safe scores and enforces Mastery criteria', () => {
    const critical = recordCaseResult(createDefaultProgress(), {
      caseId: 'crrt-01',
      device: 'prismax-aw8035-2xx',
      roleLens: 'integrated',
      pathway: 'practice',
      score: 99,
      criticalError: true,
      hintCount: 0,
      reassessmentCompleted: true,
      masteryCompleted: false,
    })
    expect(critical.bestSafeScores).toEqual({})
    expect(() =>
      recordCaseResult(createDefaultProgress(), {
        caseId: 'MASTERY-PRISMAX-01',
        device: 'prismax-aw8035-2xx',
        roleLens: 'integrated',
        pathway: 'mastery',
        score: 79,
        criticalError: false,
        hintCount: 0,
        reassessmentCompleted: true,
        masteryCompleted: true,
      }),
    ).toThrow(/Mastery completion/i)
  })

  it('persists canonical data without changing the v3 storage shape', () => {
    const storage = memoryStorage()
    const progress = createDefaultProgress()
    expect(writeProgress(progress, storage)).toBe(true)
    expect(parseProgress(storage.values[BAXTER_CRRT_PROGRESS_STORAGE_KEY])).toEqual(progress)
  })

  it('rejects unknown identifiers, unknown versions, and stale content versions', () => {
    const progress = createDefaultProgress()
    expect(canonicalizeProgress({ ...progress, version: 2 })).toBeNull()
    expect(canonicalizeProgress({ ...progress, contentVersion: 'stale' })).toBeNull()
    expect(canonicalizeProgress({ ...progress, completedPracticeCaseIds: ['crrt-99'] })).toBeNull()
    expect(() => recordRapidDrillCompletion(progress, 'DRILL-UNKNOWN')).toThrow()
    expect(() => recordInstructionalToolCompletion(progress, 'LAB-UNKNOWN')).toThrow()
  })
})
