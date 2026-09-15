import * as engine from '../engine'
import {
  createDefaultIcuHemodynamicsProgress,
  ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY,
  ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
  migrateIcuHemodynamicsProgressV1,
  parseIcuHemodynamicsProgress,
} from '../engine'

beforeEach(() => localStorage.clear())

/**
 * The legacy case ledger, read-only since HD-01. The retired contract — "persists attempts,
 * completion, best score, and mastery only without a critical error" — described a grade writer
 * the self-paced module no longer has. The parsers stay for the shared progress adapter.
 */
describe('versioned local ICU hemodynamics progress (legacy, read-only)', () => {
  it('parses v2, rejects malformed records, and reads v1 as v2 in memory', () => {
    const current = createDefaultIcuHemodynamicsProgress()
    expect(parseIcuHemodynamicsProgress(JSON.stringify(current))).toEqual(current)
    expect(parseIcuHemodynamicsProgress('{"version":2,"lastStation":4}')).toBeNull()

    const migrated = migrateIcuHemodynamicsProgressV1(
      JSON.stringify({
        version: 1,
        lastCaseId: 'HD-03',
        attempts: { 'HD-03': 2 },
        bestScores: { 'HD-03': 86 },
      }),
    )
    expect(migrated?.lastStation).toBe('HD-03')
    expect(migrated?.lastWorkspace).toBe('cases')
    expect(migrated?.masteredCaseIds).toContain('HD-03')
  })

  it('never writes: reading a stored v1 record as v2 leaves storage exactly as it was', () => {
    const v1 = '{"version":1,"lastCaseId":"HD-03","attempts":{"HD-03":2},"bestScores":{"HD-03":86}}'
    localStorage.setItem(ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY, v1)
    expect(
      migrateIcuHemodynamicsProgressV1(
        localStorage.getItem(ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY),
      )?.completedCaseIds,
    ).toEqual(['HD-03'])
    expect(localStorage.getItem(ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY)).toBe(v1)
    expect(localStorage.getItem(ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY)).toBeNull()
  })

  it('has no score, attempt, mastery or storage writer left to call', () => {
    for (const name of [
      'readIcuHemodynamicsProgress',
      'writeIcuHemodynamicsProgress',
      'recordIcuHemodynamicsResult',
      'hasIcuHemodynamicsMastery',
      'updateIcuHemodynamicsLocation',
    ]) {
      expect(name in engine).toBe(false)
    }
  })
})
