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
  it('uses the exact v1 key and a narrow non-PHI DTO', () => {
    expect(BAXTER_CRRT_PROGRESS_STORAGE_KEY).toBe('baxter-crrt-progress-v1')
    expect(Object.keys(createDefaultProgress())).toEqual([
      'version',
      'lastDevice',
      'lastRoleLens',
      'completedLessonIds',
      'completedCaseIds',
      'attempts',
      'bestScores',
      'criticalErrorStatus',
      'hintUse',
      'lastStation',
      'engineVersion',
      'contentVersion',
    ])
  })

  it('accepts only exact device, role, station, and schema identifiers', () => {
    const valid = createDefaultProgress()
    expect(canonicalizeProgress(valid)).toEqual(valid)
    expect(canonicalizeProgress({ ...valid, version: 2 })).toBeNull()
    expect(canonicalizeProgress({ ...valid, lastDevice: 'generic-baxter-device' })).toBeNull()
    expect(canonicalizeProgress({ ...valid, lastRoleLens: 'administrator' })).toBeNull()
    expect(canonicalizeProgress({ ...valid, lastStation: 'patient-chart' })).toBeNull()
    expect(canonicalizeProgress({ ...valid, engineVersion: 'version with free text' })).toBeNull()
  })

  it('canonicalizes stable IDs and strips every property outside the privacy allowlist', () => {
    const canonical = canonicalizeProgress({
      ...createDefaultProgress(),
      completedLessonIds: ['lesson-b', 'lesson-a', 'lesson-b'],
      completedCaseIds: ['case-2', 'case-1'],
      attempts: { 'case-2': 1, 'case-1': 2 },
      bestScores: { 'case-2': 80, 'case-1': 95 },
      criticalErrorStatus: { 'case-2': true, 'case-1': false },
      hintUse: { 'case-2': 2, 'case-1': 0 },
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
      completedLessonIds: ['lesson-a', 'lesson-b'],
      completedCaseIds: ['case-1', 'case-2'],
      attempts: { 'case-1': 2, 'case-2': 1 },
      bestScores: { 'case-1': 95, 'case-2': 80 },
      criticalErrorStatus: { 'case-1': false, 'case-2': true },
      hintUse: { 'case-1': 0, 'case-2': 2 },
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
      parseProgress(JSON.stringify({ ...valid, completedCaseIds: ['Case With Spaces'] })),
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
    expect(canonicalizeProgress({ ...valid, bestScores: { 'case-a': 101 } })).toBeNull()
    expect(canonicalizeProgress({ ...valid, criticalErrorStatus: { 'case-a': 'no' } })).toBeNull()
  })

  it('writes only the canonical projection and reads it back', () => {
    const storage = memoryStorage()
    const runtimeValue = {
      ...createDefaultProgress(),
      completedCaseIds: ['case-b', 'case-a'],
      patient: { name: 'must-not-persist' },
    }

    expect(writeProgress(runtimeValue, storage)).toBe(true)
    expect(storage.setItem).toHaveBeenCalledWith(
      BAXTER_CRRT_PROGRESS_STORAGE_KEY,
      expect.any(String),
    )
    expect(storage.value).not.toContain('patient')
    expect(storage.value).not.toContain('must-not-persist')
    expect(readProgress(storage).completedCaseIds).toEqual(['case-a', 'case-b'])
  })

  it('updates lesson, context, attempt, score, critical-error, and hint aggregates immutably', () => {
    const initial = createDefaultProgress()
    const withLesson = recordLessonCompletion(initial, 'orientation-lesson-1')
    const withContext = setProgressContext(withLesson, {
      device: 'prismax-aw8035-2xx',
      roleLens: 'operator',
      station: 'build-prescription',
    })
    const result = recordCaseResult(withContext, {
      caseId: 'crrt-04',
      device: 'prismax-aw8035-2xx',
      roleLens: 'operator',
      score: 88,
      criticalError: false,
      hintCount: 2,
    })
    const key = progressAttemptKey('prismax-aw8035-2xx', 'operator', 'crrt-04')
    expect(initial.completedLessonIds).toEqual([])
    expect(result).toMatchObject({
      completedLessonIds: ['orientation-lesson-1'],
      completedCaseIds: ['crrt-04'],
      attempts: { [key]: 1 },
      bestScores: { [key]: 88 },
      criticalErrorStatus: { [key]: false },
      hintUse: { [key]: 2 },
      lastStation: 'build-prescription',
      lastRoleLens: 'operator',
    })
  })

  it('keeps valid long case IDs serializable after composite-key construction', () => {
    const caseId = `c${'a'.repeat(99)}`
    const result = recordCaseResult(createDefaultProgress(), {
      caseId,
      device: 'prismax-aw8035-2xx',
      roleLens: 'integrated',
      score: 50,
      criticalError: false,
      hintCount: 0,
    })
    expect(serializeProgress(result)).not.toBeNull()
    expect(result.completedCaseIds).toEqual([caseId])
  })

  it('rejects stale versions, nonboolean critical status, and record growth past the cap', () => {
    const current = createDefaultProgress()
    expect(canonicalizeProgress({ ...current, engineVersion: '0.1.0-stale' })).toBeNull()
    expect(canonicalizeProgress({ ...current, contentVersion: 'stale-content' })).toBeNull()
    expect(() =>
      recordCaseResult(current, {
        caseId: 'crrt-04',
        device: 'prismax-aw8035-2xx',
        roleLens: 'integrated',
        score: 50,
        criticalError: 'no' as unknown as boolean,
        hintCount: 0,
      }),
    ).toThrow(/boolean/i)

    const attempts = Object.fromEntries(
      Array.from({ length: BAXTER_CRRT_PROGRESS_MAX_RECORD_ENTRIES }, (_, index) => [
        `existing-${index}`,
        1,
      ]),
    )
    const atLimit = canonicalizeProgress({ ...current, attempts })
    expect(atLimit).not.toBeNull()
    expect(() =>
      recordCaseResult(atLimit!, {
        caseId: 'new-case',
        device: 'prismax-aw8035-2xx',
        roleLens: 'integrated',
        score: 50,
        criticalError: false,
        hintCount: 0,
      }),
    ).toThrow(/storage boundary/i)
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
