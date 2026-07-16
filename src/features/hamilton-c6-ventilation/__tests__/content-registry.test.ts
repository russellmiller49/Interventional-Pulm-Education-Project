import {
  c6SettingsSchema,
  mechanicalVentilationCases,
  mechanicalVentilationCasesByStation,
  mechanicalVentilationSource,
  mechanicalVentilationSourceProvenance,
  pilotCaseIds,
  validateMechanicalVentilationCaseRegistry,
  ventilationStations,
} from '../content'

const expectedModeBySourceMode = {
  'VC-A/C': 'scmv',
  'PC-A/C': 'pcv-plus',
  PSV: 'spont',
  'PSV with apnea backup': 'spont',
} as const

describe('HAMILTON-C6 ventilation case registry', () => {
  it('preserves the supplied 15-case source as a versioned provenance snapshot', () => {
    expect(mechanicalVentilationSource.schema_version).toBe('1.0')
    expect(mechanicalVentilationSource.cases).toHaveLength(15)
    expect(mechanicalVentilationSource.cases.map((item) => item.id)).toEqual(
      Array.from({ length: 15 }, (_, index) => `MV-${String(index + 1).padStart(2, '0')}`),
    )
    expect(mechanicalVentilationSourceProvenance).toMatchObject({
      snapshotFile: 'source-cases.v1.json',
      sourceFilename: 'mechanical_ventilation_simulator_cases.json',
      sourceSha256: 'de53a9308f4127358376bfa54a7fc29524b6f0652e9185a8a861de3958dd2883',
    })
  })

  it('validates all runtime definitions and their C6 setting discriminants', () => {
    expect(mechanicalVentilationCases).toHaveLength(15)
    expect(validateMechanicalVentilationCaseRegistry()).toEqual([])
    for (const definition of mechanicalVentilationCases) {
      expect(() => c6SettingsSchema.parse(definition.initialSettings)).not.toThrow()
      expect(definition.sourceCaseId).toBe(definition.id)
      expect(definition.mechanismOptions).toHaveLength(3)
      expect(definition.priorityOptions).toHaveLength(3)
      expect(definition.responseOptions).toHaveLength(3)
      expect(definition.interventions.some((item) => item.id === 'communicate-plan')).toBe(true)
      expect(definition.sourceBasis.length).toBeGreaterThan(0)
    }
  })

  it('maps generic source modes into the locked C6 vocabulary', () => {
    for (const definition of mechanicalVentilationCases) {
      const source = mechanicalVentilationSource.cases.find((item) => item.id === definition.id)!
      const genericMode = String(
        source.initial_ventilator.mode,
      ) as keyof typeof expectedModeBySourceMode
      expect(definition.initialSettings.mode).toBe(expectedModeBySourceMode[genericMode])
      if (genericMode === 'PSV with apnea backup') {
        expect(definition.initialSettings.mode).toBe('spont')
        if (definition.initialSettings.mode === 'spont') {
          expect(definition.initialSettings.apneaBackupEnabled).toBe(true)
        }
      }
    }
  })

  it('groups exactly three cases into each of the five requested stations', () => {
    expect(ventilationStations).toHaveLength(5)
    expect(ventilationStations.map((item) => item.caseIds)).toEqual([
      ['MV-01', 'MV-02', 'MV-03'],
      ['MV-04', 'MV-07', 'MV-08'],
      ['MV-05', 'MV-06', 'MV-10'],
      ['MV-09', 'MV-11', 'MV-12'],
      ['MV-13', 'MV-14', 'MV-15'],
    ])
    for (const station of ventilationStations) {
      expect(mechanicalVentilationCasesByStation[station.id]).toHaveLength(3)
    }
  })

  it('locks the five engine-validation cases and C6-specific MV-11 P-ramp adaptation', () => {
    expect(pilotCaseIds).toEqual(['MV-01', 'MV-04', 'MV-06', 'MV-11', 'MV-15'])
    const mv11 = mechanicalVentilationCases.find((item) => item.id === 'MV-11')!
    expect(mv11.initialSettings.mode).toBe('spont')
    if (mv11.initialSettings.mode === 'spont') {
      expect(mv11.initialSettings.pRampMs).toBe(200)
    }
    expect(mv11.c6AdaptationNotes.join(' ')).toMatch(/70–120 ms/)
    expect(mv11.c6AdaptationNotes.join(' ')).toMatch(/30 ms/)
    for (const definition of mechanicalVentilationCases) {
      if (definition.initialSettings.mode === 'spont') {
        expect(definition.initialSettings.pRampMs).toBeLessThanOrEqual(200)
      }
    }
  })

  it('uses the faculty-editable fictional PBW defaults without deriving real patient identity', () => {
    for (const definition of mechanicalVentilationCases) {
      const expected = definition.id === 'MV-01' ? 70 : definition.patientSex === 'female' ? 65 : 70
      expect(definition.predictedBodyWeightKg).toBe(expected)
    }
  })
})
