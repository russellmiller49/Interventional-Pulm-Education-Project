import {
  BAXTER_CRRT_PROGRESS_STORAGE_KEY,
  createDefaultProgress as createDefaultCrrtProgress,
  recordCaseResult as recordCrrtCaseResult,
  writeProgress as writeCrrtProgress,
} from '@/features/baxter-crrt/engine/progress'
import { CARDIOHELP_PROGRESS_STORAGE_KEY } from '@/features/cardiohelp-ecmo/engine/progress'
import { criticalCareActivities } from '@/features/critical-care/content/activities'
import {
  ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY,
  ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
} from '@/features/icu-hemodynamics/engine/progress'
import {
  ICU_SIMULATION_PROGRESS_STORAGE_KEY,
  ICU_SIMULATION_SESSION_STORAGE_KEY,
} from '@/features/icu-simulation/engine/persistence'
import {
  LEGACY_HAMILTON_C6_PROGRESS_STORAGE_KEY,
  MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY,
} from '@/features/mechanical-ventilation/engine/progress'
import { resolveCriticalCareResumePointer } from '@/features/learning-module/activity'

import {
  cardiohelpV1ProgressFixture,
  completedLegacyProgressFixtures,
  corruptProgressFixture,
  emptyLegacyProgressFixtures,
  everyLegacyProgressStorageKey,
  incompatibleLegacyProgressFixtures,
  masteredLegacyProgressFixtures,
  partialLegacyProgressFixtures,
} from '../__fixtures__/legacyProgress'
import { readCrrtLegacyProgress } from '../adapters/crrt'
import { readEcmoLegacyProgress } from '../adapters/ecmo'
import { readHemodynamicsLegacyProgress } from '../adapters/hemodynamics'
import { readIcuSimulationLegacyProgress } from '../adapters/icuSimulation'
import { MCS_PROGRESS_STORAGE_KEY, readMcsLegacyProgress } from '../adapters/mcs'
import { readVentilationLegacyProgress } from '../adapters/ventilation'
import { readCriticalCareLegacyProgress } from '../index'
import { LEGACY_PROGRESS_EPOCH, type CriticalCareReadableStorage } from '../types'

class ReadOnlyFixtureStorage implements CriticalCareReadableStorage {
  readonly reads: string[] = []
  readonly setItem = jest.fn(() => {
    throw new Error('Progress adapters must not write.')
  })

  constructor(readonly values: Readonly<Record<string, string>> = {}) {}

  getItem(key: string): string | null {
    this.reads.push(key)
    return this.values[key] ?? null
  }
}

function activity(result: ReturnType<typeof readHemodynamicsLegacyProgress>, activityId: string) {
  return result.activities.find((item) => item.activityId === activityId)
}

describe('critical-care legacy progress adapters', () => {
  it('reads every established legacy key without writing when storage is empty', () => {
    const storage = new ReadOnlyFixtureStorage(emptyLegacyProgressFixtures)
    const results = readCriticalCareLegacyProgress(storage, criticalCareActivities)

    expect(results).toHaveLength(6)
    expect(results.every((result) => result.status === 'empty')).toBe(true)
    expect(results.flatMap((result) => result.activities)).toEqual([])
    expect(storage.reads).toEqual(everyLegacyProgressStorageKey)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('provides at least one valid fixture for every established legacy key', () => {
    const validFixtureKeys = new Set([
      ...Object.keys(partialLegacyProgressFixtures),
      ...Object.keys(completedLegacyProgressFixtures),
      ...Object.keys(masteredLegacyProgressFixtures),
    ])
    expect(everyLegacyProgressStorageKey.every((key) => validFixtureKeys.has(key))).toBe(true)
  })

  it('classifies storage read failures without throwing or attempting a write', () => {
    const storage = {
      getItem: jest.fn(() => {
        throw new Error('storage unavailable')
      }),
      setItem: jest.fn(),
    }
    const results = readCriticalCareLegacyProgress(storage, criticalCareActivities)

    expect(results.every((result) => result.status === 'corrupt')).toBe(true)
    expect(results.flatMap((result) => result.sources)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'corrupt',
          issue: 'storage-read-failed',
        }),
      ]),
    )
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('projects current and V1 hemodynamics records through the existing pure parsers', () => {
    const partialStorage = new ReadOnlyFixtureStorage({
      [ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]:
        partialLegacyProgressFixtures[ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY],
    })
    const partial = readHemodynamicsLegacyProgress(partialStorage, criticalCareActivities)

    expect(activity(partial, 'hemodynamics:practice:HD-02')).toMatchObject({
      status: 'in-progress',
      attempts: 2,
      bestScore: 55,
      currentPhase: 'recognize',
      updatedAt: LEGACY_PROGRESS_EPOCH,
    })
    expect(partial.resume).toMatchObject({
      activityId: 'hemodynamics:practice:HD-02',
      scenarioId: 'HD-02',
      updatedAt: LEGACY_PROGRESS_EPOCH,
    })

    const legacyRaw = completedLegacyProgressFixtures[ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY]
    const legacyStorage = new ReadOnlyFixtureStorage({
      [ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY]: legacyRaw,
    })
    const migrated = readHemodynamicsLegacyProgress(legacyStorage, criticalCareActivities)

    expect(activity(migrated, 'hemodynamics:practice:HD-01')).toMatchObject({
      status: 'completed',
      attempts: 1,
      bestScore: 75,
    })
    expect(legacyStorage.values[ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY]).toBe(legacyRaw)
    expect(legacyStorage.setItem).not.toHaveBeenCalled()

    const fallbackFromCorruptCurrent = readHemodynamicsLegacyProgress(
      new ReadOnlyFixtureStorage({
        [ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]: corruptProgressFixture,
        [ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY]: legacyRaw,
      }),
      criticalCareActivities,
    )
    expect(activity(fallbackFromCorruptCurrent, 'hemodynamics:practice:HD-01')?.status).toBe(
      'completed',
    )
    expect(fallbackFromCorruptCurrent.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          storageKey: ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
          status: 'corrupt',
        }),
        expect.objectContaining({
          storageKey: ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY,
          status: 'valid',
        }),
      ]),
    )

    const mastered = readHemodynamicsLegacyProgress(
      new ReadOnlyFixtureStorage({
        [ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]:
          masteredLegacyProgressFixtures[ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY],
      }),
      criticalCareActivities,
    )
    expect(activity(mastered, 'hemodynamics:practice:HD-01')?.status).toBe('mastered')
  })

  it('aggregates ventilation attempts by case and preserves the preferred device in safe resume', () => {
    const partial = readVentilationLegacyProgress(
      new ReadOnlyFixtureStorage({
        [MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY]:
          partialLegacyProgressFixtures[MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY],
      }),
      criticalCareActivities,
    )

    expect(activity(partial, 'ventilation:practice:MV-02')).toMatchObject({
      status: 'in-progress',
      attempts: 2,
      bestScore: 60,
    })
    expect(partial.resume).toMatchObject({
      activityId: 'ventilation:practice:MV-02',
      deviceId: 'drager-evita-v800-v600',
      query: {
        case: 'MV-02',
        device: 'drager-evita-v800-v600',
        mode: 'practice',
      },
    })
    expect(
      partial.resume
        ? resolveCriticalCareResumePointer(partial.resume, criticalCareActivities)?.href
        : null,
    ).toBe(
      '/mechanical-ventilation/practice?case=MV-02&device=drager-evita-v800-v600&mode=practice',
    )

    const legacy = readVentilationLegacyProgress(
      new ReadOnlyFixtureStorage({
        [LEGACY_HAMILTON_C6_PROGRESS_STORAGE_KEY]:
          completedLegacyProgressFixtures[LEGACY_HAMILTON_C6_PROGRESS_STORAGE_KEY],
      }),
      criticalCareActivities,
    )
    expect(activity(legacy, 'ventilation:practice:MV-01')).toMatchObject({
      status: 'completed',
      attempts: 1,
      bestScore: 75,
    })
    expect(legacy.resume?.deviceId).toBe('hamilton-c6')

    const safelyMastered = readVentilationLegacyProgress(
      new ReadOnlyFixtureStorage({
        [MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY]: JSON.stringify({
          version: 2,
          lastStation: 'lung-protection-demand',
          lastDeviceId: 'hamilton-c6',
          completedCases: ['MV-01'],
          attemptsByDeviceCase: { 'hamilton-c6:MV-01': 3 },
          bestScores: { 'MV-01': 88 },
          criticalErrorStatus: { 'MV-01': false },
        }),
      }),
      criticalCareActivities,
    )
    expect(activity(safelyMastered, 'ventilation:practice:MV-01')?.status).toBe('mastered')
  })

  it('safely projects permissive MCS V1 data without invoking its browser store', () => {
    const partial = readMcsLegacyProgress(
      new ReadOnlyFixtureStorage({
        [MCS_PROGRESS_STORAGE_KEY]: partialLegacyProgressFixtures[MCS_PROGRESS_STORAGE_KEY],
      }),
      criticalCareActivities,
    )
    expect(activity(partial, 'mcs:learn:mcs-foundations-signals')).toMatchObject({
      status: 'in-progress',
      competencyEvidenceIds: [],
    })
    expect(activity(partial, 'mcs:practice:IMP-01')).toMatchObject({
      status: 'in-progress',
      attempts: 0,
      bestScore: 55,
    })
    expect(partial.resume).toMatchObject({
      activityId: 'mcs:practice:IMP-01',
      deviceId: 'impella',
    })

    const mastered = readMcsLegacyProgress(
      new ReadOnlyFixtureStorage({
        [MCS_PROGRESS_STORAGE_KEY]: masteredLegacyProgressFixtures[MCS_PROGRESS_STORAGE_KEY],
      }),
      criticalCareActivities,
    )
    expect(activity(mastered, 'mcs:assess:CAP-IMP-01')).toMatchObject({
      status: 'mastered',
      attempts: 0,
      bestScore: 91,
    })
  })

  it('maps ECMO lesson, clinical-case, and capstone IDs to their catalog sections', () => {
    const partial = readEcmoLegacyProgress(
      new ReadOnlyFixtureStorage({
        [CARDIOHELP_PROGRESS_STORAGE_KEY]:
          partialLegacyProgressFixtures[CARDIOHELP_PROGRESS_STORAGE_KEY],
      }),
      criticalCareActivities,
    )
    expect(activity(partial, 'ecmo:learn:startup-sensor-orientation')).toMatchObject({
      status: 'in-progress',
      competencyEvidenceIds: [],
    })
    expect(activity(partial, 'ecmo:practice:clinical-vv-initiation-ards')).toMatchObject({
      status: 'in-progress',
      attempts: 1,
      bestScore: 65,
    })
    expect(partial.resume?.query).toEqual({
      case: 'clinical-vv-initiation-ards',
      track: 'vv',
    })

    const mastered = readEcmoLegacyProgress(
      new ReadOnlyFixtureStorage({
        [CARDIOHELP_PROGRESS_STORAGE_KEY]:
          masteredLegacyProgressFixtures[CARDIOHELP_PROGRESS_STORAGE_KEY],
      }),
      criticalCareActivities,
    )
    expect(activity(mastered, 'ecmo:assess:vv-off-sweep-capstone')?.status).toBe('completed')

    const migratedV1 = readEcmoLegacyProgress(
      new ReadOnlyFixtureStorage({
        [CARDIOHELP_PROGRESS_STORAGE_KEY]: cardiohelpV1ProgressFixture,
      }),
      criticalCareActivities,
    )
    expect(activity(migratedV1, 'ecmo:practice:clinical-vv-initiation-ards')).toMatchObject({
      status: 'completed',
      attempts: 1,
      bestScore: 84,
    })
    expect(migratedV1.resume).toBeUndefined()
  })

  it('projects strict CRRT lessons, practice, attempts, hints, and fail-closed mastery', () => {
    const completed = readCrrtLegacyProgress(
      new ReadOnlyFixtureStorage({
        [BAXTER_CRRT_PROGRESS_STORAGE_KEY]:
          completedLegacyProgressFixtures[BAXTER_CRRT_PROGRESS_STORAGE_KEY],
      }),
      criticalCareActivities,
    )
    expect(activity(completed, 'crrt:learn:crrt-indications-modality')).toMatchObject({
      status: 'in-progress',
      competencyEvidenceIds: [],
    })
    expect(activity(completed, 'crrt:practice:CRRT-01')).toMatchObject({
      status: 'completed',
      attempts: 2,
      bestScore: 76,
      hintCount: 1,
    })
    expect(completed.resume).toBeUndefined()

    const mastered = readCrrtLegacyProgress(
      new ReadOnlyFixtureStorage({
        [BAXTER_CRRT_PROGRESS_STORAGE_KEY]:
          masteredLegacyProgressFixtures[BAXTER_CRRT_PROGRESS_STORAGE_KEY],
      }),
      criticalCareActivities,
    )
    expect(activity(mastered, 'crrt:assess:MASTERY-PRISMAX-01')).toMatchObject({
      status: 'mastered',
      attempts: 1,
      bestScore: 93,
      hintCount: 0,
    })
  })

  it('round-trips the lowercase CRRT practice IDs written by the runtime into canonical catalog IDs', () => {
    const values: Record<string, string> = {}
    const storage = {
      getItem: (key: string) => values[key] ?? null,
      setItem: (key: string, value: string) => {
        values[key] = value
      },
    }
    const written = recordCrrtCaseResult(createDefaultCrrtProgress(), {
      caseId: 'crrt-13',
      device: 'prismax-aw8035-2xx',
      roleLens: 'integrated',
      pathway: 'practice',
      score: 82,
      criticalError: false,
      hintCount: 1,
      reassessmentCompleted: true,
      masteryCompleted: false,
    })
    expect(writeCrrtProgress(written, storage)).toBe(true)

    const projected = readCrrtLegacyProgress(storage, criticalCareActivities)
    expect(activity(projected, 'crrt:practice:CRRT-13')).toMatchObject({
      status: 'completed',
      attempts: 1,
      bestScore: 82,
      hintCount: 1,
    })
  })

  it('uses ICU coarse progress and validated semantic-session metadata without copying commands', () => {
    const result = readIcuSimulationLegacyProgress(
      new ReadOnlyFixtureStorage({
        [ICU_SIMULATION_PROGRESS_STORAGE_KEY]:
          masteredLegacyProgressFixtures[ICU_SIMULATION_PROGRESS_STORAGE_KEY],
        [ICU_SIMULATION_SESSION_STORAGE_KEY]:
          masteredLegacyProgressFixtures[ICU_SIMULATION_SESSION_STORAGE_KEY],
      }),
      criticalCareActivities,
    )
    expect(activity(result, 'icu:assess:septic-ards-aki')).toMatchObject({
      status: 'completed',
      attempts: 2,
      bestScore: 88,
      currentPhase: 'recognize',
      competencyEvidenceIds: [],
    })
    expect(result.resume).toMatchObject({
      activityId: 'icu:assess:septic-ards-aki',
      payloadVersion: 'icu-simulation-session-v1',
      scenarioId: 'septic-ards-aki',
    })
    expect(JSON.stringify(result)).not.toMatch(/commands|patient|waveform|replay/i)
  })

  it.each([
    ['hemodynamics', ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY, readHemodynamicsLegacyProgress],
    [
      'hemodynamics V1',
      ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY,
      readHemodynamicsLegacyProgress,
    ],
    ['ventilation', MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY, readVentilationLegacyProgress],
    ['Hamilton C6 V1', LEGACY_HAMILTON_C6_PROGRESS_STORAGE_KEY, readVentilationLegacyProgress],
    ['MCS', MCS_PROGRESS_STORAGE_KEY, readMcsLegacyProgress],
    ['ECMO', CARDIOHELP_PROGRESS_STORAGE_KEY, readEcmoLegacyProgress],
    ['CRRT', BAXTER_CRRT_PROGRESS_STORAGE_KEY, readCrrtLegacyProgress],
    ['ICU progress', ICU_SIMULATION_PROGRESS_STORAGE_KEY, readIcuSimulationLegacyProgress],
    ['ICU session', ICU_SIMULATION_SESSION_STORAGE_KEY, readIcuSimulationLegacyProgress],
  ] as const)('distinguishes corrupt and incompatible %s records', (_label, key, adapter) => {
    const corrupt = adapter(
      new ReadOnlyFixtureStorage({ [key]: corruptProgressFixture }),
      criticalCareActivities,
    )
    expect(corrupt.sources.find((source) => source.storageKey === key)).toMatchObject({
      status: 'corrupt',
      issue: 'invalid-json',
    })

    const incompatible = adapter(
      new ReadOnlyFixtureStorage({ [key]: JSON.stringify({ version: 99 }) }),
      criticalCareActivities,
    )
    expect(incompatible.sources.find((source) => source.storageKey === key)?.status).toBe(
      'incompatible',
    )
  })

  it('reports engine, content, and exact-checkpoint incompatibilities distinctly', () => {
    const crrt = readCrrtLegacyProgress(
      new ReadOnlyFixtureStorage({
        [BAXTER_CRRT_PROGRESS_STORAGE_KEY]:
          incompatibleLegacyProgressFixtures[BAXTER_CRRT_PROGRESS_STORAGE_KEY],
      }),
      criticalCareActivities,
    )
    expect(crrt.sources[0]).toMatchObject({
      status: 'incompatible',
      issue: 'content-version-mismatch',
    })

    const icu = readIcuSimulationLegacyProgress(
      new ReadOnlyFixtureStorage({
        [ICU_SIMULATION_PROGRESS_STORAGE_KEY]:
          incompatibleLegacyProgressFixtures[ICU_SIMULATION_PROGRESS_STORAGE_KEY],
        [ICU_SIMULATION_SESSION_STORAGE_KEY]:
          incompatibleLegacyProgressFixtures[ICU_SIMULATION_SESSION_STORAGE_KEY],
      }),
      criticalCareActivities,
    )
    expect(
      icu.sources.find((source) => source.storageKey === ICU_SIMULATION_PROGRESS_STORAGE_KEY),
    ).toMatchObject({ status: 'incompatible', issue: 'engine-version-mismatch' })
    expect(
      icu.sources.find((source) => source.storageKey === ICU_SIMULATION_SESSION_STORAGE_KEY),
    ).toMatchObject({ status: 'incompatible', issue: 'checkpoint-version-mismatch' })
  })
})
