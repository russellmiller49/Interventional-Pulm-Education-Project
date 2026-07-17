import {
  BAXTER_CRRT_PROGRESS_MAX_COUNTER,
  BAXTER_CRRT_PROGRESS_MAX_IDS,
  BAXTER_CRRT_PROGRESS_MAX_RECORD_ENTRIES,
  BAXTER_CRRT_PROGRESS_STORAGE_KEY,
  canonicalizeProgress,
  createDefaultProgress,
  parseProgress,
  progressAttemptKey,
  readProgress,
  recordCaseResult,
  recordLessonCompletion,
  serializeProgress,
  setProgressContext,
  writeProgress,
  type BaxterCrrtProgressStorage,
} from '../progress'
import { BAXTER_CRRT_PILOT_CONTENT_VERSION } from '../../content/versions'

function memoryStorage(initial: string | null = null): BaxterCrrtProgressStorage & {
  value: string | null
} {
  return {
    value: initial,
    getItem: jest.fn(function () {
      return this.value
    }),
    setItem: jest.fn(function (_key: string, value: string) {
      this.value = value
    }),
  }
}

describe('Baxter CRRT progress persistence', () => {
  it('uses the exact v2 key and a pathway-isolated non-PHI DTO', () => {
    expect(BAXTER_CRRT_PROGRESS_STORAGE_KEY).toBe('baxter-crrt-progress-v2')
    expect(createDefaultProgress().contentVersion).toBe(BAXTER_CRRT_PILOT_CONTENT_VERSION)
    expect(Object.keys(createDefaultProgress())).toEqual([
      'version',
      'lastDevice',
      'lastRoleLens',
      'completedLessonIds',
      'completedPracticeCaseIds',
      'completedMasteryCapstoneIds',
      'attempts',
      'bestSafeScores',
      'criticalErrorAttempts',
      'hintUse',
      'lastStation',
      'engineVersion',
      'contentVersion',
    ])
  })

  it('accepts only exact device, role, station, and schema identifiers', () => {
    const valid = createDefaultProgress()
    expect(canonicalizeProgress(valid)).toEqual(valid)
    expect(canonicalizeProgress({ ...valid, version: 1 })).toBeNull()
    expect(canonicalizeProgress({ ...valid, lastDevice: 'generic-baxter-device' })).toBeNull()
    expect(canonicalizeProgress({ ...valid, lastDevice: 'prismaflex-g5036003-6xx' })).toBeNull()
    expect(canonicalizeProgress({ ...valid, lastRoleLens: 'administrator' })).toBeNull()
    expect(canonicalizeProgress({ ...valid, lastStation: 'patient-chart' })).toBeNull()
    expect(canonicalizeProgress({ ...valid, engineVersion: 'version with free text' })).toBeNull()

    const oldV2 = Object.fromEntries(
      Object.entries(valid).filter(
        ([key]) => key !== 'bestSafeScores' && key !== 'criticalErrorAttempts',
      ),
    )
    expect(
      canonicalizeProgress({
        ...oldV2,
        bestScores: {},
        criticalErrorStatus: {},
      }),
    ).toBeNull()
  })

  it('canonicalizes only activated learner IDs and strips every property outside the privacy allowlist', () => {
    const crrt04Key = progressAttemptKey('prismax-aw8035-2xx', 'operator', 'practice', 'crrt-04')
    const crrt10Key = progressAttemptKey('prismax-aw8035-2xx', 'integrated', 'practice', 'crrt-10')
    const canonical = canonicalizeProgress({
      ...createDefaultProgress(),
      completedLessonIds: ['crrt-10.learn', 'crrt-04.learn', 'crrt-10.learn'],
      completedPracticeCaseIds: ['crrt-10', 'crrt-04'],
      completedMasteryCapstoneIds: [],
      attempts: { [crrt10Key]: 1, [crrt04Key]: 2 },
      bestSafeScores: { [crrt10Key]: 80, [crrt04Key]: 95 },
      criticalErrorAttempts: { [crrt10Key]: 1, [crrt04Key]: 0 },
      hintUse: { [crrt10Key]: 2, [crrt04Key]: 0 },
      seed: 12345,
      protocolProfile: 'local-citrate-protocol',
      patient: { weightKg: 84 },
      circuit: { bloodFlowMlMin: 180 },
      trends: [{ time: 1, potassium: 4.2 }],
      actionHistory: [{ type: 'ACK_ALARM' }],
      timestamp: '2026-07-16T12:00:00Z',
      notes: 'free-text reasoning',
    })

    expect(canonical).toEqual({
      ...createDefaultProgress(),
      completedLessonIds: ['crrt-04.learn', 'crrt-10.learn'],
      completedPracticeCaseIds: ['crrt-04', 'crrt-10'],
      completedMasteryCapstoneIds: [],
      attempts: { [crrt04Key]: 2, [crrt10Key]: 1 },
      bestSafeScores: { [crrt04Key]: 95, [crrt10Key]: 80 },
      criticalErrorAttempts: { [crrt04Key]: 0, [crrt10Key]: 1 },
      hintUse: { [crrt04Key]: 0, [crrt10Key]: 2 },
    })
    expect(JSON.parse(serializeProgress(canonical) ?? '{}')).toEqual(canonical)
    expect(serializeProgress(canonical)).not.toMatch(
      /seed|protocol|patient|circuit|trend|history|timestamp|notes|reasoning/i,
    )
  })

  it('rejects malformed, oversized, unsafe, and out-of-range payloads', () => {
    const valid = createDefaultProgress()
    expect(parseProgress('not-json')).toBeNull()
    expect(
      parseProgress(JSON.stringify({ ...valid, completedPracticeCaseIds: ['Case With Spaces'] })),
    ).toBeNull()
    expect(
      canonicalizeProgress({
        ...valid,
        completedLessonIds: Array.from(
          { length: BAXTER_CRRT_PROGRESS_MAX_IDS + 1 },
          (_, index) => `lesson-${index}`,
        ),
      }),
    ).toBeNull()
    expect(
      canonicalizeProgress({
        ...valid,
        attempts: Object.fromEntries(
          Array.from({ length: BAXTER_CRRT_PROGRESS_MAX_RECORD_ENTRIES + 1 }, (_, index) => [
            `case-${index}`,
            1,
          ]),
        ),
      }),
    ).toBeNull()
    expect(
      canonicalizeProgress({
        ...valid,
        attempts: { 'case-a': BAXTER_CRRT_PROGRESS_MAX_COUNTER + 1 },
      }),
    ).toBeNull()
    expect(canonicalizeProgress({ ...valid, bestSafeScores: { 'case-a': 101 } })).toBeNull()
    expect(canonicalizeProgress({ ...valid, criticalErrorAttempts: { 'case-a': -1 } })).toBeNull()
  })

  it('writes only the canonical projection and reads it back', () => {
    const storage = memoryStorage()
    const runtimeValue = {
      ...createDefaultProgress(),
      completedPracticeCaseIds: ['crrt-10', 'crrt-04'],
      patient: { name: 'must-not-persist' },
    }

    expect(writeProgress(runtimeValue, storage)).toBe(true)
    expect(storage.setItem).toHaveBeenCalledWith(
      BAXTER_CRRT_PROGRESS_STORAGE_KEY,
      expect.any(String),
    )
    expect(storage.value).not.toContain('patient')
    expect(storage.value).not.toContain('must-not-persist')
    expect(readProgress(storage).completedPracticeCaseIds).toEqual(['crrt-04', 'crrt-10'])
  })

  it('updates lesson, context, attempt, score, critical-error, and hint aggregates immutably', () => {
    const initial = createDefaultProgress()
    const withLesson = recordLessonCompletion(initial, 'crrt-04.learn')
    const withContext = setProgressContext(withLesson, {
      device: 'prismax-aw8035-2xx',
      roleLens: 'operator',
      station: 'build-prescription',
    })
    const result = recordCaseResult(withContext, {
      caseId: 'crrt-04',
      device: 'prismax-aw8035-2xx',
      roleLens: 'operator',
      pathway: 'practice',
      score: 88,
      criticalError: false,
      hintCount: 2,
      reassessmentCompleted: true,
      masteryCompleted: false,
    })
    const key = progressAttemptKey('prismax-aw8035-2xx', 'operator', 'practice', 'crrt-04')
    expect(initial.completedLessonIds).toEqual([])
    expect(result).toMatchObject({
      completedLessonIds: ['crrt-04.learn'],
      completedPracticeCaseIds: ['crrt-04'],
      completedMasteryCapstoneIds: [],
      attempts: { [key]: 1 },
      bestSafeScores: { [key]: 88 },
      criticalErrorAttempts: { [key]: 0 },
      hintUse: { [key]: 2 },
      lastStation: 'build-prescription',
      lastRoleLens: 'operator',
    })
  })

  it('rejects arbitrary case IDs during composite-key construction', () => {
    const caseId = `c${'a'.repeat(99)}`
    expect(() =>
      progressAttemptKey('prismax-aw8035-2xx', 'integrated', 'practice', caseId),
    ).toThrow(/valid device, role, pathway, and case IDs/i)
  })

  it('rejects reviewer, arbitrary lesson, and locked Mastery identifiers in existing DTOs', () => {
    const reviewerKey = 'prismax-aw8035-2xx:integrated:practice:crrt-01'
    const crafted = {
      ...createDefaultProgress(),
      completedLessonIds: ['crrt-01.learn'],
      completedPracticeCaseIds: ['crrt-01'],
      completedMasteryCapstoneIds: ['mastery-unapproved'],
      attempts: { [reviewerKey]: 1 },
      bestSafeScores: { [reviewerKey]: 100 },
      criticalErrorAttempts: { [reviewerKey]: 0 },
      hintUse: { [reviewerKey]: 0 },
    }
    const storage = memoryStorage()

    expect(canonicalizeProgress(crafted)).toBeNull()
    expect(writeProgress(crafted, storage)).toBe(false)
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(() => recordLessonCompletion(createDefaultProgress(), 'crrt-01.learn')).toThrow(
      /activated learner lesson/i,
    )
  })

  it('refuses to persist a reviewer-only Phase 7 Practice result', () => {
    expect(() =>
      recordCaseResult(createDefaultProgress(), {
        caseId: 'crrt-01',
        device: 'prismax-aw8035-2xx',
        roleLens: 'integrated',
        pathway: 'practice',
        score: 100,
        criticalError: false,
        hintCount: 0,
        reassessmentCompleted: true,
        masteryCompleted: false,
      }),
    ).toThrow(/activated learner runtime/i)
  })

  it('never promotes Practice and rejects all Mastery persistence while locked', () => {
    const practice = recordCaseResult(createDefaultProgress(), {
      caseId: 'crrt-04',
      device: 'prismax-aw8035-2xx',
      roleLens: 'integrated',
      pathway: 'practice',
      score: 100,
      criticalError: false,
      hintCount: 0,
      reassessmentCompleted: true,
      masteryCompleted: false,
    })
    expect(practice.completedPracticeCaseIds).toEqual(['crrt-04'])
    expect(practice.completedMasteryCapstoneIds).toEqual([])
    expect(() =>
      recordCaseResult(practice, {
        caseId: 'crrt-04',
        device: 'prismax-aw8035-2xx',
        roleLens: 'integrated',
        pathway: 'practice',
        score: 100,
        criticalError: false,
        hintCount: 0,
        reassessmentCompleted: true,
        masteryCompleted: true,
      }),
    ).toThrow(/Practice results cannot complete Mastery/i)

    expect(() =>
      recordCaseResult(practice, {
        caseId: 'mastery-prismax-01',
        device: 'prismax-aw8035-2xx',
        roleLens: 'integrated',
        pathway: 'mastery',
        score: 80,
        criticalError: false,
        hintCount: 0,
        reassessmentCompleted: true,
        masteryCompleted: true,
      }),
    ).toThrow(/Mastery progress is locked/i)
    expect(() =>
      recordCaseResult(practice, {
        caseId: 'crrt-04',
        device: 'prismax-aw8035-2xx',
        roleLens: 'integrated',
        pathway: 'mastery',
        score: 100,
        criticalError: false,
        hintCount: 0,
        reassessmentCompleted: true,
        masteryCompleted: true,
      }),
    ).toThrow(/Mastery progress is locked/i)
    expect(() =>
      progressAttemptKey('prismax-aw8035-2xx', 'integrated', 'mastery', 'crrt-04'),
    ).toThrow(/valid device, role, pathway, and case IDs/i)
  })

  it('never combines an unsafe high score with a later safe low score', () => {
    const base = {
      caseId: 'crrt-04',
      device: 'prismax-aw8035-2xx' as const,
      roleLens: 'integrated' as const,
      pathway: 'practice' as const,
      hintCount: 0,
      reassessmentCompleted: true,
      masteryCompleted: false,
    }
    const unsafeHigh = recordCaseResult(createDefaultProgress(), {
      ...base,
      score: 100,
      criticalError: true,
    })
    const key = progressAttemptKey('prismax-aw8035-2xx', 'integrated', 'practice', 'crrt-04')
    expect(unsafeHigh.bestSafeScores[key]).toBeUndefined()
    expect(unsafeHigh.criticalErrorAttempts[key]).toBe(1)

    const laterSafeLow = recordCaseResult(unsafeHigh, {
      ...base,
      score: 45,
      criticalError: false,
    })
    expect(laterSafeLow.bestSafeScores[key]).toBe(45)
    expect(laterSafeLow.criticalErrorAttempts[key]).toBe(1)
    expect(laterSafeLow.attempts[key]).toBe(2)
  })

  it('rejects stale versions, nonboolean critical status, and inconsistent record families', () => {
    const current = createDefaultProgress()
    expect(canonicalizeProgress({ ...current, engineVersion: '0.1.0-stale' })).toBeNull()
    expect(canonicalizeProgress({ ...current, contentVersion: 'stale-content' })).toBeNull()
    expect(() =>
      recordCaseResult(current, {
        caseId: 'crrt-04',
        device: 'prismax-aw8035-2xx',
        roleLens: 'integrated',
        pathway: 'practice',
        score: 50,
        criticalError: 'no' as unknown as boolean,
        hintCount: 0,
        reassessmentCompleted: true,
        masteryCompleted: false,
      }),
    ).toThrow(/boolean/i)

    const key = progressAttemptKey('prismax-aw8035-2xx', 'integrated', 'practice', 'crrt-04')
    expect(
      canonicalizeProgress({
        ...current,
        bestSafeScores: { [key]: 80 },
      }),
    ).toBeNull()
    expect(
      canonicalizeProgress({
        ...current,
        attempts: { [key]: 1 },
        criticalErrorAttempts: { [key]: 2 },
      }),
    ).toBeNull()
  })

  it('fails safely during SSR, denied storage, invalid writes, and corrupt reads', () => {
    expect(readProgress(null)).toEqual(createDefaultProgress())
    expect(writeProgress(createDefaultProgress(), null)).toBe(false)

    const deniedStorage: BaxterCrrtProgressStorage = {
      getItem: jest.fn(() => {
        throw new DOMException('Storage denied', 'SecurityError')
      }),
      setItem: jest.fn(() => {
        throw new DOMException('Storage denied', 'SecurityError')
      }),
    }
    expect(readProgress(deniedStorage)).toEqual(createDefaultProgress())
    expect(writeProgress(createDefaultProgress(), deniedStorage)).toBe(false)

    const corruptStorage = memoryStorage('{"version":2}')
    expect(readProgress(corruptStorage)).toEqual(createDefaultProgress())
    const staleStorage = memoryStorage(
      JSON.stringify({ ...createDefaultProgress(), engineVersion: '0.1.0-stale' }),
    )
    expect(readProgress(staleStorage)).toEqual(createDefaultProgress())
    expect(serializeProgress({ ...createDefaultProgress(), hintUse: { case: -1 } })).toBeNull()
  })
})
