import {
  ENGINEERING_DEEP_DIVE_ID,
  LEGACY_STENT_PROGRESS_STORAGE_KEY,
  STENT_PROGRESS_STORAGE_KEY,
  createDefaultStentProgress,
  getExplicitLessonFromSearchParams,
  isModuleComplete,
  markLessonCompleted,
  markOptionalLabCompleted,
  parseStentProgress,
  readStentProgress,
  recordAssessmentResult,
  resolveInitialLessonId,
  resolveStentLessonRequest,
  setLastLesson,
  writeStentProgress,
} from '../engine/learningLabProgress'
import type { LegacyStentProgressStateV1, StentProgressStorage } from '../engine/learningLabTypes'

class MemoryStorage implements StentProgressStorage {
  values = new Map<string, string>()
  writes: Array<{ key: string; value: string }> = []

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
    this.writes.push({ key, value })
  }
}

function legacyProgress(
  overrides: Partial<LegacyStentProgressStateV1> = {},
): LegacyStentProgressStateV1 {
  return {
    version: 1,
    lastLessonId: 'orient',
    completedLessonIds: [],
    assessment: {
      attempts: 0,
      lastScore: null,
      bestScore: null,
      mastery: false,
    },
    ...overrides,
  }
}

describe('airway stent clinical-lab progress', () => {
  it('creates a version 2 default at the first clinical lesson', () => {
    expect(createDefaultStentProgress()).toEqual({
      version: 2,
      lastLessonId: 'indication',
      completedLessonIds: [],
      completedOptionalLabIds: [],
      assessment: {
        attempts: 0,
        lastScore: null,
        lastTotal: null,
        bestPercent: null,
        mastery: false,
      },
    })
  })

  it('round-trips valid progress through the v2 storage key only', () => {
    const storage = new MemoryStorage()
    const progress = markLessonCompleted(createDefaultStentProgress(), 'indication')

    expect(writeStentProgress(progress, storage)).toBe(true)
    expect(storage.values.get(STENT_PROGRESS_STORAGE_KEY)).toBe(JSON.stringify(progress))
    expect(storage.values.has(LEGACY_STENT_PROGRESS_STORAGE_KEY)).toBe(false)
    expect(readStentProgress(storage)).toEqual(progress)
  })

  it('parses v2 progress defensively and keeps assessment totals dynamic', () => {
    const serialized = JSON.stringify({
      version: 2,
      lastLessonId: 'fit-behavior',
      completedLessonIds: ['indication', 'indication', 'not-a-lesson', 'clinical-job'],
      completedOptionalLabIds: [ENGINEERING_DEEP_DIVE_ID, ENGINEERING_DEEP_DIVE_ID, 42],
      assessment: {
        attempts: 1,
        lastScore: 3,
        lastTotal: 4,
        bestPercent: 75,
        mastery: false,
      },
      migratedFromV1: true,
    })

    expect(parseStentProgress(serialized)).toEqual({
      version: 2,
      lastLessonId: 'fit-behavior',
      completedLessonIds: ['indication', 'clinical-job'],
      completedOptionalLabIds: [ENGINEERING_DEEP_DIVE_ID],
      assessment: {
        attempts: 1,
        lastScore: 3,
        lastTotal: 4,
        bestPercent: 75,
        mastery: false,
      },
      migratedFromV1: true,
    })
    expect(parseStentProgress('{bad json')).toBeNull()
    expect(parseStentProgress(JSON.stringify({ version: 1 }))).toBeNull()
    expect(
      parseStentProgress(
        JSON.stringify({
          version: 2,
          lastLessonId: 'not-a-lesson',
          completedLessonIds: [],
          completedOptionalLabIds: [],
          assessment: {
            attempts: 0,
            lastScore: null,
            lastTotal: null,
            bestPercent: null,
            mastery: false,
          },
        }),
      ),
    ).toBeNull()
    expect(
      parseStentProgress(
        JSON.stringify({
          ...createDefaultStentProgress(),
          assessment: {
            attempts: 1,
            lastScore: 5,
            lastTotal: 4,
            bestPercent: 100,
            mastery: true,
          },
        }),
      ),
    ).toBeNull()
  })

  it('migrates incomplete v1 progress to the nearest clinical lessons', () => {
    const storage = new MemoryStorage()
    const legacy = legacyProgress({
      lastLessonId: 'force-lab',
      completedLessonIds: ['orient', 'architectures'],
    })
    storage.values.set(LEGACY_STENT_PROGRESS_STORAGE_KEY, JSON.stringify(legacy))

    expect(readStentProgress(storage)).toEqual({
      ...createDefaultStentProgress(),
      lastLessonId: 'architecture-choice',
      completedLessonIds: ['indication', 'architecture-choice'],
      migratedFromV1: true,
    })
  })

  it('migrates complete v1 progress without carrying old assessment completion or mastery', () => {
    const storage = new MemoryStorage()
    const legacy = legacyProgress({
      lastLessonId: 'assessment',
      completedLessonIds: [
        'orient',
        'architectures',
        'force-lab',
        'tissue-time',
        'evidence-decisions',
        'assessment',
      ],
      assessment: {
        attempts: 3,
        lastScore: 6,
        bestScore: 6,
        mastery: true,
      },
    })
    storage.values.set(LEGACY_STENT_PROGRESS_STORAGE_KEY, JSON.stringify(legacy))

    const migrated = readStentProgress(storage)

    expect(migrated).toEqual({
      version: 2,
      lastLessonId: 'assessment',
      completedLessonIds: ['indication', 'architecture-choice', 'complications-surveillance'],
      completedOptionalLabIds: [ENGINEERING_DEEP_DIVE_ID],
      assessment: {
        attempts: 0,
        lastScore: null,
        lastTotal: null,
        bestPercent: null,
        mastery: false,
      },
      migratedFromV1: true,
    })
    expect(migrated.completedLessonIds).not.toContain('assessment')
    expect(isModuleComplete(migrated)).toBe(false)
  })

  it('falls back safely for malformed v1 state without persisting a migration', () => {
    const storage = new MemoryStorage()
    storage.values.set(
      LEGACY_STENT_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        ...legacyProgress(),
        assessment: { attempts: 1, lastScore: null, bestScore: 6, mastery: true },
      }),
    )

    expect(readStentProgress(storage)).toEqual(createDefaultStentProgress())
    expect(storage.values.has(STENT_PROGRESS_STORAGE_KEY)).toBe(false)
    expect(storage.writes).toHaveLength(0)
  })

  it('persists a legacy migration once and reuses v2 state on repeated reads', () => {
    const storage = new MemoryStorage()
    storage.values.set(
      LEGACY_STENT_PROGRESS_STORAGE_KEY,
      JSON.stringify(
        legacyProgress({
          lastLessonId: 'evidence-decisions',
          completedLessonIds: ['orient', 'force-lab', 'force-lab', 'tissue-time'],
        }),
      ),
    )

    const firstRead = readStentProgress(storage)
    const secondRead = readStentProgress(storage)

    expect(secondRead).toEqual(firstRead)
    expect(storage.writes).toHaveLength(1)
    expect(storage.writes[0].key).toBe(STENT_PROGRESS_STORAGE_KEY)
    expect(firstRead.completedOptionalLabIds).toEqual([ENGINEERING_DEEP_DIVE_ID])
  })

  it('falls back safely when storage is unavailable or throws', () => {
    const throwingStorage: StentProgressStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }

    expect(readStentProgress(null)).toEqual(createDefaultStentProgress())
    expect(readStentProgress(throwingStorage)).toEqual(createDefaultStentProgress())
    expect(writeStentProgress(createDefaultStentProgress(), null)).toBe(false)
    expect(writeStentProgress(createDefaultStentProgress(), throwingStorage)).toBe(false)
  })

  it.each([
    ['orient', 'indication', false],
    ['architectures', 'architecture-choice', false],
    ['force-lab', 'architecture-choice', true],
    ['tissue-time', 'complications-surveillance', false],
    ['evidence-decisions', 'complications-surveillance', false],
  ] as const)(
    'maps the legacy %s deep link to %s',
    (requestedLesson, expectedLesson, openEngineeringDeepDive) => {
      expect(resolveStentLessonRequest(requestedLesson)).toEqual({
        lessonId: expectedLesson,
        openEngineeringDeepDive,
        usedLegacyAlias: true,
      })
    },
  )

  it('gives canonical and legacy deep links precedence over resume state', () => {
    const progress = setLastLesson(createDefaultStentProgress(), 'fit-behavior')

    expect(resolveInitialLessonId('clinical-job', progress)).toBe('clinical-job')
    expect(resolveInitialLessonId('force-lab', progress)).toBe('architecture-choice')
    expect(resolveInitialLessonId('not-a-lesson', progress)).toBe('fit-behavior')
    expect(resolveInitialLessonId(null, null)).toBe('indication')
    expect(resolveStentLessonRequest('assessment')).toEqual({
      lessonId: 'assessment',
      openEngineeringDeepDive: false,
      usedLegacyAlias: false,
    })
    expect(resolveStentLessonRequest('unknown')).toBeNull()

    expect(
      getExplicitLessonFromSearchParams(new URLSearchParams('lesson=evidence-decisions')),
    ).toBe('complications-surveillance')
    expect(getExplicitLessonFromSearchParams(new URLSearchParams('lesson=unknown'))).toBeNull()
  })

  it('tracks optional engineering completion without affecting required module completion', () => {
    const defaultProgress = createDefaultStentProgress()
    const once = markOptionalLabCompleted(defaultProgress, ENGINEERING_DEEP_DIVE_ID)
    const twice = markOptionalLabCompleted(once, ENGINEERING_DEEP_DIVE_ID)

    expect(twice.completedOptionalLabIds).toEqual([ENGINEERING_DEEP_DIVE_ID])
    expect(twice.completedLessonIds).toEqual([])
    expect(isModuleComplete(twice)).toBe(false)
  })

  it('requires only the six clinical lessons for module completion', () => {
    let progress = createDefaultStentProgress()
    for (const lessonId of [
      'indication',
      'clinical-job',
      'architecture-choice',
      'fit-behavior',
      'complications-surveillance',
    ] as const) {
      progress = markLessonCompleted(progress, lessonId)
    }

    expect(isModuleComplete(progress)).toBe(false)
    progress = recordAssessmentResult(progress, 4, 5)
    expect(progress.assessment).toEqual({
      attempts: 1,
      lastScore: 4,
      lastTotal: 5,
      bestPercent: 80,
      mastery: true,
    })
    expect(isModuleComplete(progress)).toBe(true)
    expect(progress.completedOptionalLabIds).toEqual([])
  })

  it('records dynamic assessment totals and preserves the best percentage and mastery', () => {
    let progress = recordAssessmentResult(createDefaultStentProgress(), 2, 4)
    expect(progress.assessment).toEqual({
      attempts: 1,
      lastScore: 2,
      lastTotal: 4,
      bestPercent: 50,
      mastery: false,
    })

    progress = recordAssessmentResult(progress, 3, 3)
    expect(progress.assessment).toEqual({
      attempts: 2,
      lastScore: 3,
      lastTotal: 3,
      bestPercent: 100,
      mastery: true,
    })

    progress = recordAssessmentResult(progress, 1, 2)
    expect(progress.assessment).toEqual({
      attempts: 3,
      lastScore: 1,
      lastTotal: 2,
      bestPercent: 100,
      mastery: true,
    })
  })

  it('rejects invalid assessment scores, totals, and mastery thresholds', () => {
    const progress = createDefaultStentProgress()
    expect(() => recordAssessmentResult(progress, -1, 5)).toThrow('between zero')
    expect(() => recordAssessmentResult(progress, 6, 5)).toThrow('between zero')
    expect(() => recordAssessmentResult(progress, 4.5, 5)).toThrow('valid integers')
    expect(() => recordAssessmentResult(progress, 0, 0)).toThrow('valid integers')
    expect(() => recordAssessmentResult(progress, 3, 5, 0)).toThrow('between one')
    expect(() => recordAssessmentResult(progress, 3, 5, 6)).toThrow('between one')
  })
})
