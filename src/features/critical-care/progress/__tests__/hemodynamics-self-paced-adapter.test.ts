import { criticalCareActivities } from '@/features/critical-care/content/activities'
import { buildCriticalCarePublicClientCatalog } from '@/features/critical-care/content/publicCatalog.server'
import { deriveCriticalCareDashboard } from '@/features/critical-care/dashboard'
import { derivePublicCriticalCareDashboard } from '@/features/critical-care/publicDashboard'
import {
  ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY,
  ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
} from '@/features/icu-hemodynamics/engine/progress'
import {
  ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY,
  createEmptySelfPacedRecord,
  withCaseOpened,
  withSectionReviewed,
  withSectionVisited,
  type IcuHemodynamicsSelfPacedRecord,
} from '@/features/icu-hemodynamics/engine/selfPacedProgress'
import {
  CRITICAL_CARE_PROGRESS_STORAGE_KEY,
  type CriticalCareActivityProgress,
  type CriticalCareProgressEnvelope,
} from '@/features/learning-module/activity'

import {
  completedLegacyProgressFixtures,
  corruptProgressFixture,
  masteredLegacyProgressFixtures,
  partialLegacyProgressFixtures,
} from '../__fixtures__/legacyProgress'
import { projectCriticalCareCoarseProgress } from '../accountSync'
import { readHemodynamicsLegacyProgress } from '../adapters/hemodynamics'
import { readMergedCriticalCareProgress } from '../index'
import { projectPublicCriticalCareCoarseProgress } from '../publicAccountSync'
import { readPublicCriticalCareProgress } from '../publicClient'
import { getCriticalCareRecommendations } from '../recommendation'
import { LEGACY_PROGRESS_EPOCH } from '../types'
import { isCurrentProgressActivity, isCurrentProgressResume } from '../utils'

const catalog = buildCriticalCarePublicClientCatalog()
const hemodynamicsDefinitions = criticalCareActivities.filter(
  (activity) => activity.moduleId === 'icu-hemodynamics',
)

/**
 * Sections 2–8 each end on a case run inside the section (owner plan, 2026-10-14), and section 8
 * offers a second case once it is finished. The record writes the same `withCaseOpened` either way.
 */
const SECTION_LAST_TASK_CASES = [
  ['pressure-system', 'HD-08'],
  ['waveform-interpretation', 'HD-04'],
  ['waveform-components', 'HD-07'],
  ['catheter-advancement', 'HD-03'],
  ['pawp-capture', 'HD-06'],
  ['thermodilution-series', 'HD-01'],
  ['derived-hemodynamics', 'HD-05'],
] as const
const SECTION_EIGHT_SECOND_CASE = 'HD-02'

const LEDGER_FIXTURES: readonly (readonly [
  label: string,
  fixtures: Readonly<Record<string, string>>,
  key: string,
])[] = [
  ['partial v2 ledger', partialLegacyProgressFixtures, ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY],
  [
    'completed v1 ledger',
    completedLegacyProgressFixtures,
    ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY,
  ],
  ['mastered v2 ledger', masteredLegacyProgressFixtures, ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY],
  // The ledger rows closest to a visit: no attempts or score, kept out only by phase or mode.
  [
    'v2 ledger last in PAC skills',
    { [ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]: ledgerV2({ lastWorkspace: 'pac-skills' }) },
    ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
  ],
  [
    'v2 ledger with an unattempted last case',
    { [ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]: ledgerV2({ lastStation: 'HD-04' }) },
    ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
  ],
  [
    'v2 ledger with a completion but no attempts',
    { [ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]: ledgerV2({ completedCaseIds: ['HD-03'] }) },
    ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
  ],
]

function ledgerV2(overrides: Readonly<Record<string, unknown>>): string {
  return JSON.stringify({
    version: 2,
    lastStation: 'HD-01',
    lastWorkspace: 'cases',
    attempts: {},
    completedCaseIds: [],
    bestScores: {},
    masteredCaseIds: [],
    ...overrides,
  })
}

function storageOf(values: Readonly<Record<string, string>>) {
  return { getItem: (key: string) => values[key] ?? null }
}

function store(record: IcuHemodynamicsSelfPacedRecord) {
  localStorage.setItem(ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY, JSON.stringify(record))
}

/** The full reader, the reader restricted to this module, and the public reader. */
function readAll() {
  return [
    readMergedCriticalCareProgress(localStorage),
    readMergedCriticalCareProgress(localStorage, hemodynamicsDefinitions),
    readPublicCriticalCareProgress(catalog.activities, localStorage),
  ]
}

function hemodynamicsRows(envelope: CriticalCareProgressEnvelope) {
  return envelope.activities.filter((item) => item.activityId.startsWith('hemodynamics:'))
}

function visit(
  activityId: string,
  mode: 'guided' | 'challenge' = 'guided',
): CriticalCareActivityProgress {
  return {
    activityId,
    status: 'in-progress',
    mode,
    attempts: 0,
    competencyEvidenceIds: [],
    updatedAt: LEGACY_PROGRESS_EPOCH,
  }
}

/**
 * A fellow who works the pathway in order: each of sections 1–8 opened, its last-task case run and
 * the section marked reviewed at the end, section 8's second case opened, then section 9 opened.
 */
function workedThroughSectionEight(): IcuHemodynamicsSelfPacedRecord {
  let record = withSectionVisited(
    createEmptySelfPacedRecord(),
    'why-measure',
    '2026-10-15T08:00:00.000Z',
  )
  record = withSectionReviewed(record, 'why-measure', true, '2026-10-15T08:10:00.000Z')
  SECTION_LAST_TASK_CASES.forEach(([sectionId, caseId], index) => {
    const hour = `2026-10-15T${String(9 + index).padStart(2, '0')}`
    record = withSectionVisited(record, sectionId, `${hour}:00:00.000Z`)
    record = withCaseOpened(record, caseId, 'practice', `${hour}:20:00.000Z`)
    record = withSectionReviewed(record, sectionId, true, `${hour}:40:00.000Z`)
  })
  record = withCaseOpened(record, SECTION_EIGHT_SECOND_CASE, 'practice', '2026-10-15T16:00:00.000Z')
  return withSectionVisited(record, 'pac-signal-validation', '2026-10-15T16:30:00.000Z')
}

describe('ICU hemodynamics self-paced record in the critical-care progress adapter', () => {
  beforeEach(() => localStorage.clear())

  it('reads a fresh self-paced record as valid, with nothing started and nowhere to resume', () => {
    const fresh = createEmptySelfPacedRecord()
    const result = readHemodynamicsLegacyProgress(
      storageOf({ [ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY]: JSON.stringify(fresh) }),
      criticalCareActivities,
    )
    expect(result.status).toBe('valid')
    expect(result.sources).toEqual([
      {
        moduleId: 'icu-hemodynamics',
        storageKey: ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY,
        status: 'valid',
        detectedVersion: '1',
      },
      expect.objectContaining({
        storageKey: ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
        status: 'empty',
      }),
      expect.objectContaining({
        storageKey: ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY,
        status: 'empty',
      }),
    ])
    expect(result.activities).toEqual([])
    expect(result.resume).toBeUndefined()

    store(fresh)
    for (const read of readAll()) {
      expect(hemodynamicsRows(read.envelope)).toEqual([])
      expect(read.envelope.resume).toBeUndefined()
      expect(
        deriveCriticalCareDashboard(read).modules.find(
          (item) => item.module.id === 'icu-hemodynamics',
        )?.state,
      ).toBe('not-started')
    }
  })

  it('projects reviewed sections and every section-ending case as started, ungraded visits', () => {
    const record = workedThroughSectionEight()
    store(record)
    const before = { ...localStorage }

    const sectionIds = [
      'why-measure',
      ...SECTION_LAST_TASK_CASES.map(([sectionId]) => sectionId),
      'pac-signal-validation',
    ]
    const caseIds = [
      ...SECTION_LAST_TASK_CASES.map(([, caseId]) => caseId),
      SECTION_EIGHT_SECOND_CASE,
    ]
    const expectedRows = [
      ...sectionIds.map((id) => visit(`hemodynamics:learn:${id}`)),
      ...caseIds.map((id) => visit(`hemodynamics:practice:${id}`)),
    ]
    expect(record.reviewedSectionIds).toEqual(sectionIds.slice(0, 8))

    const result = readHemodynamicsLegacyProgress(localStorage, criticalCareActivities)
    expect(result.status).toBe('valid')
    // A reviewed mark is not completion: the catalog grants these activities no completion authority.
    expect(result.activities).toEqual(expectedRows)
    expect(result.resume).toEqual({
      activityId: 'hemodynamics:learn:pac-signal-validation',
      pathname: '/icu-hemodynamics/learn',
      query: { activity: 'pac-signal-validation' },
      mode: 'guided',
      phase: 'recognize',
      payloadVersion: 'icu-hemodynamics-self-paced-v1',
      updatedAt: '2026-10-15T16:30:00.000Z',
    })

    for (const read of readAll()) {
      expect(hemodynamicsRows(read.envelope)).toEqual(expectedRows)
      expect(read.envelope.resume).toEqual(result.resume)
      expect(read.notices).toEqual([])
      const dashboards = [
        deriveCriticalCareDashboard(read),
        derivePublicCriticalCareDashboard(catalog, read),
      ]
      for (const dashboard of dashboards) {
        expect(dashboard.audienceState).toBe('returning')
        expect(dashboard.resume?.href).toBe(
          '/icu-hemodynamics/learn?activity=pac-signal-validation',
        )
        expect(
          dashboard.modules.find((item) => item.module.id === 'icu-hemodynamics'),
        ).toMatchObject({
          state: 'in-progress',
          startedActivities: expectedRows.length,
          completedActivities: 0,
          percentComplete: 0,
        })
      }
      expect(
        getCriticalCareRecommendations(hemodynamicsDefinitions, read.envelope, { limit: 100 })
          .filter((item) => item.reason === 'continue')
          .map((item) => item.activity.id)
          .sort(),
      ).toEqual(expectedRows.map((row) => row.activityId).sort())
      // The coarse account boundary is unchanged: converted modules publish no account progress.
      expect(projectCriticalCareCoarseProgress(read.envelope, criticalCareActivities)).toBeNull()
      expect(projectPublicCriticalCareCoarseProgress(read.envelope, catalog.activities)).toBeNull()
    }
    expect({ ...localStorage }).toEqual(before)
  })

  it('resumes into the case a section ended on, and into the applied case', () => {
    let record = withSectionVisited(
      createEmptySelfPacedRecord(),
      'catheter-advancement',
      '2026-10-15T09:00:00.000Z',
    )
    record = withCaseOpened(record, 'HD-03', 'practice', '2026-10-15T09:20:00.000Z')
    store(record)
    for (const read of readAll()) {
      expect(read.envelope.resume).toEqual({
        activityId: 'hemodynamics:practice:HD-03',
        pathname: '/icu-hemodynamics/practice',
        query: { case: 'HD-03' },
        mode: 'guided',
        phase: 'recognize',
        scenarioId: 'HD-03',
        payloadVersion: 'icu-hemodynamics-self-paced-v1',
        updatedAt: '2026-10-15T09:20:00.000Z',
      })
      expect(deriveCriticalCareDashboard(read).resume?.href).toBe(
        '/icu-hemodynamics/practice?case=HD-03',
      )
    }

    store(withCaseOpened(record, 'HD-07', 'applied', '2026-10-15T10:00:00.000Z'))
    for (const read of readAll()) {
      expect(hemodynamicsRows(read.envelope)).toEqual([
        visit('hemodynamics:learn:catheter-advancement'),
        visit('hemodynamics:practice:HD-03'),
        // The record keeps opened case ids without their variant; only the location names it.
        visit('hemodynamics:practice:HD-07'),
        visit('hemodynamics:assess:masked-seeded', 'challenge'),
      ])
      expect(read.envelope.resume).toMatchObject({
        activityId: 'hemodynamics:assess:masked-seeded',
        query: { start: '1' },
        mode: 'challenge',
        scenarioId: 'HD-07',
        updatedAt: '2026-10-15T10:00:00.000Z',
      })
    }
  })

  it.each(LEDGER_FIXTURES)(
    'keeps a legacy-only %s as the fallback reading, inert in every reader',
    (_label, fixtures, key) => {
      const raw = fixtures[key]
      expect(raw).toBeDefined()
      const result = readHemodynamicsLegacyProgress(
        storageOf({ [key]: raw! }),
        criticalCareActivities,
      )
      expect(result.status).toBe('valid')
      expect(result.sources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            storageKey: ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY,
            status: 'empty',
          }),
          expect.objectContaining({ storageKey: key, status: 'valid' }),
        ]),
      )
      // The historical projection is still read, and none of it counts as current progress.
      expect(result.activities.length).toBeGreaterThan(0)
      expect(result.activities.filter(isCurrentProgressActivity)).toEqual([])
      if (result.resume) expect(isCurrentProgressResume(result.resume)).toBe(false)

      localStorage.setItem(key, raw!)
      for (const read of readAll()) {
        expect(hemodynamicsRows(read.envelope)).toEqual([])
        expect(read.envelope.resume).toBeUndefined()
        expect(
          getCriticalCareRecommendations(hemodynamicsDefinitions, read.envelope, {
            limit: 100,
          }).some((item) => item.reason === 'continue'),
        ).toBe(false)
      }
      expect(localStorage.getItem(key)).toBe(raw)
      expect(localStorage.getItem(ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY)).toBeNull()
    },
  )

  it('lets a self-paced record replace the ledger reading without carrying a score across', () => {
    const ledger = masteredLegacyProgressFixtures[ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]!
    const record = withCaseOpened(
      createEmptySelfPacedRecord(),
      'HD-01',
      'practice',
      '2026-10-15T09:00:00.000Z',
    )
    const result = readHemodynamicsLegacyProgress(
      storageOf({
        [ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY]: JSON.stringify(record),
        [ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]: ledger,
      }),
      criticalCareActivities,
    )
    expect(result.sources.map((source) => source.status)).toEqual(['valid', 'valid', 'empty'])
    expect(result.activities).toEqual([visit('hemodynamics:practice:HD-01')])
    expect(result.resume?.payloadVersion).toBe('icu-hemodynamics-self-paced-v1')
  })

  it('falls back to the ledger when the self-paced record cannot be read', () => {
    const ledger = partialLegacyProgressFixtures[ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]!
    for (const unreadable of [corruptProgressFixture, JSON.stringify({ version: 2 })]) {
      const result = readHemodynamicsLegacyProgress(
        storageOf({
          [ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY]: unreadable,
          [ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]: ledger,
        }),
        criticalCareActivities,
      )
      expect(result.sources[0]).toMatchObject({
        storageKey: ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY,
        status: unreadable === corruptProgressFixture ? 'corrupt' : 'incompatible',
      })
      expect(result.resume?.payloadVersion).toBe('icu-hemodynamics-progress-v2')
      expect(result.activities.filter(isCurrentProgressActivity)).toEqual([])
    }
  })

  it('drops ids outside the catalog and keeps the epoch for a timestamp the pointer cannot take', () => {
    const record: IcuHemodynamicsSelfPacedRecord = {
      version: 1,
      visitedSectionIds: ['pressure-system', 'not-a-section'],
      reviewedSectionIds: ['not-a-section'],
      openedCaseIds: ['HD-99'],
      location: { kind: 'section', sectionId: 'pressure-system' },
      updatedAt: 'yesterday',
    }
    store(record)
    for (const read of readAll()) {
      expect(hemodynamicsRows(read.envelope)).toEqual([visit('hemodynamics:learn:pressure-system')])
      expect(read.envelope.resume).toMatchObject({
        activityId: 'hemodynamics:learn:pressure-system',
        updatedAt: LEGACY_PROGRESS_EPOCH,
      })
    }

    store({ ...record, location: { kind: 'case', caseId: 'HD-99', mode: 'practice' } })
    for (const read of readAll()) expect(read.envelope.resume).toBeUndefined()
  })

  it('does not take visit-shaped hemodynamics rows or pointers from the normalized store', () => {
    const forged: CriticalCareProgressEnvelope = {
      version: 1,
      activities: [visit('hemodynamics:learn:pressure-system')],
      resume: {
        activityId: 'hemodynamics:learn:pressure-system',
        pathname: '/icu-hemodynamics/learn',
        query: { activity: 'pressure-system' },
        mode: 'guided',
        phase: 'recognize',
        payloadVersion: 'icu-hemodynamics-self-paced-v1',
        updatedAt: '2099-01-01T00:00:00.000Z',
      },
      updatedAt: '2099-01-01T00:00:00.000Z',
    }
    const bytes = JSON.stringify(forged)
    localStorage.setItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY, bytes)
    for (const read of readAll()) {
      expect(hemodynamicsRows(read.envelope)).toEqual([])
      expect(read.envelope.resume).toBeUndefined()
    }

    // A real module location still resumes, even though the forged pointer claims a later date.
    store(
      withSectionVisited(createEmptySelfPacedRecord(), 'why-measure', '2026-10-15T08:00:00.000Z'),
    )
    for (const read of readAll()) {
      expect(read.envelope.resume?.activityId).toBe('hemodynamics:learn:why-measure')
    }
    expect(localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBe(bytes)
  })
})
