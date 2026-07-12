import {
  ENGINEERING_DEEP_DIVE_ID,
  LEGACY_STENT_PROGRESS_STORAGE_KEY,
  PREVIOUS_STENT_PROGRESS_STORAGE_KEY,
  STENT_PROGRESS_STORAGE_KEY,
  createDefaultStentProgress,
  getExplicitLessonFromSearchParams,
  isCaseCompleted,
  isModuleComplete,
  markCaseCompleted,
  markCaseInteractionCompleted,
  markCaseSurveillanceCommitted,
  markLessonCompleted,
  markOptionalLabCompleted,
  parseStentProgress,
  readStentProgress,
  recordAssessmentResult,
  recordCaseDecision,
  recordCaseObservationCommitment,
  resolveInitialLessonId,
  resolveStentLessonRequest,
  setCaseComplicationSelections,
  setCaseOutcomeState,
  setLastCase,
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
  it('creates a version 3 default at the first clinical lesson', () => {
    expect(createDefaultStentProgress()).toEqual({
      version: 3,
      lastLessonId: 'indication',
      lastCaseId: null,
      completedLessonIds: [],
      completedOptionalLabIds: [],
      caseProgress: {},
      assessment: {
        attempts: 0,
        lastScore: null,
        lastTotal: null,
        bestPercent: null,
        mastery: false,
      },
    })
  })

  it('round-trips valid v3 case progress through the current storage key only', () => {
    const storage = new MemoryStorage()
    let progress = markLessonCompleted(createDefaultStentProgress(), 'indication')
    progress = recordCaseDecision(progress, 'residual-extrinsic', 'stent-after-debulking', false)
    progress = markCaseInteractionCompleted(progress, 'residual-extrinsic', 'inspect-distal-airway')

    expect(writeStentProgress(progress, storage)).toBe(true)
    expect(storage.values.get(STENT_PROGRESS_STORAGE_KEY)).toBe(JSON.stringify(progress))
    expect(storage.values.has(PREVIOUS_STENT_PROGRESS_STORAGE_KEY)).toBe(false)
    expect(storage.values.has(LEGACY_STENT_PROGRESS_STORAGE_KEY)).toBe(false)
    expect(readStentProgress(storage)).toEqual(progress)
  })

  it('parses v3 progress defensively, normalizes IDs, and keeps case progress', () => {
    const serialized = JSON.stringify({
      version: 3,
      lastLessonId: 'fit-behavior',
      lastCaseId: 'curved-silicone',
      completedLessonIds: ['indication', 'indication', 'not-a-lesson', 'clinical-job'],
      completedOptionalLabIds: [ENGINEERING_DEEP_DIVE_ID, ENGINEERING_DEEP_DIVE_ID, 42],
      caseProgress: {
        'curved-silicone': {
          caseId: 'curved-silicone',
          committedDecisionIds: ['initial-fit', 'initial-fit'],
          revisedDecisionIds: ['revise-fit', 'revise-fit'],
          completedInteractionIds: ['inspect-buckling', 'inspect-buckling'],
          observationCommitmentIds: ['inspect-end', 'inspect-end'],
          complicationSelectionIds: ['migration', 'mucus-obstruction', 'migration'],
          outcomeStateId: 'central-involution',
          surveillancePlanCommitted: true,
          complete: true,
        },
      },
      assessment: {
        attempts: 1,
        lastScore: 3,
        lastTotal: 4,
        bestPercent: 75,
        mastery: false,
      },
      migratedFromV1: true,
      migratedFromV2: true,
    })

    expect(parseStentProgress(serialized)).toEqual({
      version: 3,
      lastLessonId: 'fit-behavior',
      lastCaseId: 'curved-silicone',
      completedLessonIds: ['indication', 'clinical-job'],
      completedOptionalLabIds: [ENGINEERING_DEEP_DIVE_ID],
      caseProgress: {
        'curved-silicone': {
          caseId: 'curved-silicone',
          committedDecisionIds: ['initial-fit'],
          revisedDecisionIds: ['revise-fit'],
          completedInteractionIds: ['inspect-buckling'],
          observationCommitmentIds: ['inspect-end'],
          complicationSelectionIds: ['migration', 'mucus-obstruction'],
          outcomeStateIds: ['central-involution'],
          surveillancePlanCommitted: true,
          complete: true,
        },
      },
      assessment: {
        attempts: 1,
        lastScore: 3,
        lastTotal: 4,
        bestPercent: 75,
        mastery: false,
      },
      migratedFromV1: true,
      migratedFromV2: true,
    })
    expect(parseStentProgress('{bad json')).toBeNull()
    expect(parseStentProgress(JSON.stringify({ version: 2 }))).toBeNull()
    expect(
      parseStentProgress(
        JSON.stringify({
          ...createDefaultStentProgress(),
          lastLessonId: 'not-a-lesson',
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
    expect(
      parseStentProgress(
        JSON.stringify({
          ...createDefaultStentProgress(),
          caseProgress: {
            'case-map-key': {
              caseId: 'different-case-id',
              committedDecisionIds: [],
              revisedDecisionIds: [],
              completedInteractionIds: [],
              outcomeStateId: null,
              surveillancePlanCommitted: false,
              complete: false,
            },
          },
        }),
      ),
    ).toBeNull()
    expect(
      parseStentProgress(
        JSON.stringify({
          ...createDefaultStentProgress(),
          caseProgress: {
            invalid: {
              caseId: 'invalid',
              committedDecisionIds: ['choice', 42],
              revisedDecisionIds: [],
              completedInteractionIds: [],
              outcomeStateId: null,
              surveillancePlanCommitted: false,
              complete: false,
            },
          },
        }),
      ),
    ).toBeNull()
  })

  it('migrates v2 to v3 while preserving resume and optional-lab state only', () => {
    const storage = new MemoryStorage()
    storage.values.set(
      PREVIOUS_STENT_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        lastLessonId: 'fit-behavior',
        completedLessonIds: [
          'indication',
          'clinical-job',
          'architecture-choice',
          'fit-behavior',
          'complications-surveillance',
          'assessment',
        ],
        completedOptionalLabIds: [ENGINEERING_DEEP_DIVE_ID, 'glb-gallery'],
        assessment: {
          attempts: 2,
          lastScore: 6,
          lastTotal: 6,
          bestPercent: 100,
          mastery: true,
        },
        migratedFromV1: true,
      }),
    )

    const migrated = readStentProgress(storage)

    expect(migrated).toEqual({
      ...createDefaultStentProgress(),
      lastLessonId: 'fit-behavior',
      completedOptionalLabIds: [ENGINEERING_DEEP_DIVE_ID, 'glb-gallery'],
      migratedFromV1: true,
      migratedFromV2: true,
    })
    expect(migrated.completedLessonIds).toEqual([])
    expect(migrated.caseProgress).toEqual({})
    expect(migrated.assessment.mastery).toBe(false)
    expect(storage.values.get(STENT_PROGRESS_STORAGE_KEY)).toBe(JSON.stringify(migrated))
  })

  it('migrates v1 to v3 while preserving the nearest lesson and optional deep dive only', () => {
    const storage = new MemoryStorage()
    const legacy = legacyProgress({
      lastLessonId: 'force-lab',
      completedLessonIds: ['orient', 'architectures', 'force-lab'],
      assessment: {
        attempts: 2,
        lastScore: 6,
        bestScore: 6,
        mastery: true,
      },
    })
    storage.values.set(LEGACY_STENT_PROGRESS_STORAGE_KEY, JSON.stringify(legacy))

    expect(readStentProgress(storage)).toEqual({
      ...createDefaultStentProgress(),
      lastLessonId: 'architecture-choice',
      completedOptionalLabIds: [ENGINEERING_DEEP_DIVE_ID],
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
      version: 3,
      lastLessonId: 'assessment',
      lastCaseId: null,
      completedLessonIds: [],
      completedOptionalLabIds: [ENGINEERING_DEEP_DIVE_ID],
      caseProgress: {},
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

  it('persists a legacy migration once and reuses v3 state on repeated reads', () => {
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
    const progress = setLastCase(
      setLastLesson(createDefaultStentProgress(), 'fit-behavior'),
      'curved-mainstem-fit-failure',
    )

    expect(progress.lastCaseId).toBe('curved-mainstem-fit-failure')

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

  it('records each case workflow stage idempotently through the case progress helpers', () => {
    const initial = createDefaultStentProgress()
    let progress = recordCaseDecision(initial, 'curved-silicone', 'fit-plan', false)
    progress = recordCaseDecision(progress, 'curved-silicone', 'fit-plan', true)
    progress = recordCaseDecision(progress, 'curved-silicone', 'fit-plan', true)
    progress = markCaseInteractionCompleted(progress, 'curved-silicone', 'inspect-buckling')
    progress = markCaseInteractionCompleted(progress, 'curved-silicone', 'inspect-buckling')
    progress = recordCaseObservationCommitment(progress, 'curved-silicone', 'inspect-end')
    progress = recordCaseObservationCommitment(progress, 'curved-silicone', 'inspect-end')
    progress = setCaseComplicationSelections(progress, 'curved-silicone', [
      'migration',
      'mucus-obstruction',
      'migration',
    ])
    progress = setCaseOutcomeState(
      progress,
      'curved-silicone',
      'silicone-curve-involution:solid-silicone-tube:central-involution',
    )
    progress = setCaseOutcomeState(
      progress,
      'curved-silicone',
      'cough-interface-response:solid-silicone-tube:multifactorial-response',
    )
    progress = setCaseOutcomeState(
      progress,
      'curved-silicone',
      'silicone-curve-involution:solid-silicone-tube:central-involution',
    )
    progress = markCaseSurveillanceCommitted(progress, 'curved-silicone')

    expect(initial.caseProgress).toEqual({})
    expect(isCaseCompleted(progress, 'curved-silicone')).toBe(false)
    expect(progress.caseProgress['curved-silicone']).toEqual({
      caseId: 'curved-silicone',
      committedDecisionIds: ['fit-plan'],
      revisedDecisionIds: ['fit-plan'],
      completedInteractionIds: ['inspect-buckling'],
      observationCommitmentIds: ['inspect-end'],
      complicationSelectionIds: ['migration', 'mucus-obstruction'],
      outcomeStateIds: [
        'silicone-curve-involution:solid-silicone-tube:central-involution',
        'cough-interface-response:solid-silicone-tube:multifactorial-response',
      ],
      surveillancePlanCommitted: true,
      complete: false,
    })

    progress = markCaseCompleted(progress, 'curved-silicone')

    expect(isCaseCompleted(progress, 'curved-silicone')).toBe(true)
    expect(progress.caseProgress['curved-silicone'].complete).toBe(true)
  })

  it('completes the assessment lesson and module only after mastery', () => {
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
    progress = recordAssessmentResult(progress, 4, 6)
    expect(progress.assessment).toEqual({
      attempts: 1,
      lastScore: 4,
      lastTotal: 6,
      bestPercent: (4 / 6) * 100,
      mastery: false,
    })
    expect(progress.completedLessonIds).not.toContain('assessment')
    expect(isModuleComplete(progress)).toBe(false)

    progress = recordAssessmentResult(progress, 5, 6)
    expect(progress.assessment).toEqual({
      attempts: 2,
      lastScore: 5,
      lastTotal: 6,
      bestPercent: (5 / 6) * 100,
      mastery: true,
    })
    expect(progress.completedLessonIds).toContain('assessment')
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
