import {
  createDefaultIcuHemodynamicsProgress,
  hasIcuHemodynamicsMastery,
  migrateIcuHemodynamicsProgressV1,
  parseIcuHemodynamicsProgress,
  recordIcuHemodynamicsResult,
} from '../engine'

describe('versioned local ICU hemodynamics progress', () => {
  it('parses v2, rejects malformed records, and migrates v1', () => {
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

  it('persists attempts, completion, best score, and mastery only without a critical error', () => {
    const breakdown = {
      signalValidity: 20,
      mechanism: 20,
      management: 20,
      thermodilutionAndDerived: 15,
      reassessmentAndSafety: 20,
      total: 95,
    }
    const unsafe = recordIcuHemodynamicsResult(createDefaultIcuHemodynamicsProgress(), {
      caseId: 'HD-01',
      score: breakdown,
      criticalErrorCount: 1,
    })
    expect(unsafe.completedCaseIds).toContain('HD-01')
    expect(hasIcuHemodynamicsMastery(unsafe, 'HD-01')).toBe(false)

    const safe = recordIcuHemodynamicsResult(unsafe, {
      caseId: 'HD-01',
      score: breakdown,
      criticalErrorCount: 0,
    })
    expect(safe.attempts['HD-01']).toBe(2)
    expect(safe.bestScores['HD-01']).toBe(95)
    expect(hasIcuHemodynamicsMastery(safe, 'HD-01')).toBe(true)
  })
})
