import {
  CRITICAL_CARE_PROGRESS_STORAGE_KEY,
  createEmptyCriticalCareProgress,
  parseActivityDefinition,
  parseResumePointer,
  parseSerializedCriticalCareProgress,
  readCriticalCareProgress,
  resolveCriticalCareResumePointer,
  newestValidCriticalCareResume,
  upsertCriticalCareActivityProgress,
  withoutCriticalCareResumePointer,
  writeCriticalCareProgress,
} from '..'
import type {
  CriticalCareActivityDefinition,
  CriticalCareActivityProgress,
  CriticalCareResumePointer,
} from '..'

const EARLIER = '2026-07-22T08:00:00.000Z'
const LATER = '2026-07-22T09:00:00.000Z'
const LATEST = '2026-07-22T10:00:00.000Z'

const activity: CriticalCareActivityDefinition = {
  id: 'hemodynamics.pac-signal-validation',
  moduleId: 'icu-hemodynamics',
  title: 'PAC signal validation',
  description: 'Validate a synthetic pulmonary artery catheter signal before interpretation.',
  kind: 'guided-case',
  supportedModes: ['guided', 'practice'],
  pathname: '/icu-hemodynamics/learn',
  query: { activity: 'pac-signal-validation' },
  pathwayIds: ['shock-and-perfusion'],
  competencyIds: ['signal-validation'],
  prerequisiteActivityIds: [],
  teachesConceptIds: ['signal-fidelity'],
  assumedConceptIds: [],
  estimatedMinutes: 10,
  difficulty: 'foundation',
  completionRuleId: 'complete-pac-signal-validation',
  assetIds: ['hemodynamics-bedside-waveforms'],
  reviewStatus: 'sme-review',
  evidenceIds: ['pac-waveforms-part-1-2021'],
  contentVersion: '2026.07',
  creditPolicy: 'competency-eligible',
  completionEvidenceAuthority: 'reviewed-engine-score',
}

function makeProgress(
  overrides: Partial<CriticalCareActivityProgress> = {},
): CriticalCareActivityProgress {
  return {
    activityId: activity.id,
    status: 'in-progress',
    currentPhase: 'recognize',
    mode: 'guided',
    attempts: 1,
    hintCount: 0,
    competencyEvidenceIds: [],
    updatedAt: EARLIER,
    ...overrides,
  }
}

function makeResume(overrides: Partial<CriticalCareResumePointer> = {}): CriticalCareResumePointer {
  return {
    activityId: activity.id,
    pathname: activity.pathname,
    query: activity.query,
    mode: 'guided',
    phase: 'recognize',
    payloadVersion: 'activity-v1',
    updatedAt: EARLIER,
    ...overrides,
  }
}

describe('critical-care activity schema invariants', () => {
  it('requires a mastery rule for assessments', () => {
    expect(parseActivityDefinition({ ...activity, kind: 'assessment' })).toBeNull()
    expect(
      parseActivityDefinition({
        ...activity,
        kind: 'assessment',
        masteryRuleId: 'master-pac-signal-validation',
      }),
    ).toMatchObject({ kind: 'assessment', masteryRuleId: 'master-pac-signal-validation' })
  })

  it('requires evidence for released activities', () => {
    expect(
      parseActivityDefinition({ ...activity, reviewStatus: 'released', evidenceIds: [] }),
    ).toBeNull()
    expect(
      parseActivityDefinition({
        ...activity,
        reviewStatus: 'released',
        evidenceIds: ['pac-waveforms-part-1-2021'],
      }),
    ).toMatchObject({ reviewStatus: 'released' })
  })
})

describe('critical-care persisted progress boundary', () => {
  it('accepts only a strict version-one envelope', () => {
    const envelope = {
      version: 1,
      activities: [makeProgress()],
      updatedAt: EARLIER,
    }

    expect(parseSerializedCriticalCareProgress(JSON.stringify(envelope))).toEqual(envelope)
    expect(
      parseSerializedCriticalCareProgress(JSON.stringify({ ...envelope, version: 2 })),
    ).toBeNull()
    expect(
      parseSerializedCriticalCareProgress(JSON.stringify({ ...envelope, unexpected: true })),
    ).toBeNull()
    expect(
      parseSerializedCriticalCareProgress(
        JSON.stringify({
          ...envelope,
          activities: [{ ...makeProgress(), unexpected: true }],
        }),
      ),
    ).toBeNull()
  })

  it('fails closed for corrupt JSON and duplicate activity records', () => {
    expect(parseSerializedCriticalCareProgress('{not-json')).toBeNull()
    expect(parseSerializedCriticalCareProgress(null)).toBeNull()
    expect(
      parseSerializedCriticalCareProgress(
        JSON.stringify({
          version: 1,
          activities: [makeProgress(), makeProgress({ status: 'completed' })],
          updatedAt: EARLIER,
        }),
      ),
    ).toBeNull()
  })

  it('returns an empty record for absent storage, empty storage, and read exceptions', () => {
    const emptyStorage = { getItem: jest.fn(() => null), setItem: jest.fn() }
    const throwingStorage = {
      getItem: jest.fn(() => {
        throw new Error('storage unavailable')
      }),
      setItem: jest.fn(),
    }

    for (const result of [
      readCriticalCareProgress(null),
      readCriticalCareProgress(emptyStorage),
      readCriticalCareProgress(throwingStorage),
    ]) {
      expect(result).toMatchObject({ version: 1, activities: [] })
      expect(Number.isNaN(Date.parse(result.updatedAt))).toBe(false)
    }
    expect(emptyStorage.getItem).toHaveBeenCalledWith(CRITICAL_CARE_PROGRESS_STORAGE_KEY)
  })

  it('contains storage write exceptions and reports failure', () => {
    const envelope = createEmptyCriticalCareProgress(EARLIER)
    const throwingStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(() => {
        throw new Error('quota exceeded')
      }),
    }

    expect(writeCriticalCareProgress(null, envelope)).toBe(false)
    expect(writeCriticalCareProgress(throwingStorage, envelope)).toBe(false)
  })

  it('merges progress monotonically without mutating the prior envelope', () => {
    const existing = makeProgress({
      status: 'mastered',
      currentPhase: 'transfer',
      attempts: 4,
      bestScore: 92,
      hintCount: 3,
      competencyEvidenceIds: ['evidence-a'],
      updatedAt: LATER,
    })
    const envelope = {
      version: 1 as const,
      activities: [existing],
      updatedAt: LATER,
    }
    const staleIncoming = makeProgress({
      status: 'in-progress',
      currentPhase: 'predict',
      attempts: 2,
      bestScore: 70,
      hintCount: 1,
      competencyEvidenceIds: ['evidence-b'],
      updatedAt: EARLIER,
    })

    const merged = upsertCriticalCareActivityProgress(envelope, staleIncoming)

    expect(merged.activities[0]).toEqual({
      ...existing,
      competencyEvidenceIds: ['evidence-a', 'evidence-b'],
    })
    expect(merged.updatedAt).toBe(LATER)
    expect(envelope.activities[0]).toBe(existing)
  })

  it('clears only the matching completed activity resume pointer', () => {
    const resume = makeResume({ updatedAt: LATER })
    const envelope = { ...createEmptyCriticalCareProgress(LATER), resume }

    expect(withoutCriticalCareResumePointer(envelope, activity.id).resume).toBeUndefined()
    expect(withoutCriticalCareResumePointer(envelope, 'another.activity')).toBe(envelope)
  })
})

describe('critical-care resume resolution', () => {
  it('validates route-only pathnames and bounded query records', () => {
    expect(parseResumePointer(makeResume())).not.toBeNull()
    expect(parseResumePointer(makeResume({ pathname: 'https://example.com/learn' }))).toBeNull()
    expect(parseResumePointer(makeResume({ pathname: '//example.com/learn' }))).toBeNull()
    expect(parseResumePointer(makeResume({ pathname: '/learn?activity=unsafe' }))).toBeNull()
    expect(parseResumePointer(makeResume({ query: { '': 'invalid-key' } }))).toBeNull()
  })

  it('resolves and safely encodes a valid query while requiring catalog query fields', () => {
    const definition = {
      ...activity,
      query: { activity: 'pac signal' },
    }
    const pointer = makeResume({
      query: { activity: 'pac signal', device: 'C6/preview' },
    })

    expect(resolveCriticalCareResumePointer(pointer, [definition])?.href).toBe(
      '/icu-hemodynamics/learn?activity=pac+signal&device=C6%2Fpreview',
    )
    expect(
      resolveCriticalCareResumePointer(makeResume({ query: { activity: 'different-activity' } }), [
        activity,
      ]),
    ).toBeNull()
  })

  it.each([
    ['unknown activity', makeResume({ activityId: 'unknown.activity' })],
    ['wrong path', makeResume({ pathname: '/mechanical-ventilation/learn' })],
    ['unsupported mode', makeResume({ mode: 'challenge' })],
  ])('rejects an %s resume target', (_label, pointer) => {
    expect(resolveCriticalCareResumePointer(pointer, [activity])).toBeNull()
  })

  it('selects the newest schema-valid pointer that resolves to the catalog', () => {
    const oldestValid = makeResume({ updatedAt: EARLIER })
    const newestValid = makeResume({ mode: 'practice', phase: 'observe', updatedAt: LATER })
    const newerUnknownActivity = makeResume({
      activityId: 'missing.activity',
      updatedAt: LATEST,
    })
    const malformedNewest = {
      ...makeResume({ updatedAt: LATEST }),
      updatedAt: 'not-a-date',
    } as CriticalCareResumePointer

    expect(
      newestValidCriticalCareResume(
        [oldestValid, newerUnknownActivity, malformedNewest, newestValid],
        [activity],
      )?.pointer,
    ).toEqual(newestValid)
  })
})
