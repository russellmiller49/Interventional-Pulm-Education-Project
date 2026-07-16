import {
  adaptInitialSettingsForDevice,
  mechanicalVentilationSettingsSchema,
  mechanicalVentilationCases,
  mechanicalVentilationCasesByStation,
  mechanicalVentilationSource,
  mechanicalVentilationSourceProvenance,
  pilotCaseIds,
  validateMechanicalVentilationCaseRegistry,
  ventilationStations,
} from '../content'

const expectedModeBySourceMode = {
  'VC-A/C': 'volume-ac',
  'PC-A/C': 'pressure-ac',
  PSV: 'pressure-support',
  'PSV with apnea backup': 'pressure-support',
} as const

describe('mechanical ventilation case registry', () => {
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

  it('validates all runtime definitions and their canonical setting discriminants', () => {
    expect(mechanicalVentilationCases).toHaveLength(15)
    expect(validateMechanicalVentilationCaseRegistry()).toEqual([])
    for (const definition of mechanicalVentilationCases) {
      expect(() =>
        mechanicalVentilationSettingsSchema.parse(definition.initialSettings),
      ).not.toThrow()
      expect(definition.sourceCaseId).toBe(definition.id)
      expect(definition.mechanismOptions).toHaveLength(3)
      expect(definition.priorityOptions).toHaveLength(3)
      expect(definition.responseOptions).toHaveLength(3)
      expect(definition.interventions.some((item) => item.id === 'communicate-plan')).toBe(true)
      expect(definition.sourceBasis.length).toBeGreaterThan(0)
    }
  })

  it('maps source modes into device-independent canonical modes', () => {
    for (const definition of mechanicalVentilationCases) {
      const source = mechanicalVentilationSource.cases.find((item) => item.id === definition.id)!
      const genericMode = String(
        source.initial_ventilator.mode,
      ) as keyof typeof expectedModeBySourceMode
      expect(definition.initialSettings.mode).toBe(expectedModeBySourceMode[genericMode])
      if (genericMode === 'PSV with apnea backup') {
        expect(definition.initialSettings.mode).toBe('pressure-support')
        if (definition.initialSettings.mode === 'pressure-support') {
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

  it('keeps MV-11 canonical while applying the C6-specific P-ramp cap at the adapter boundary', () => {
    expect(pilotCaseIds).toEqual(['MV-01', 'MV-04', 'MV-06', 'MV-11', 'MV-15'])
    const mv11 = mechanicalVentilationCases.find((item) => item.id === 'MV-11')!
    expect(mv11.initialSettings.mode).toBe('pressure-support')
    if (mv11.initialSettings.mode === 'pressure-support') {
      expect(mv11.initialSettings.pRampMs).toBe(600)
      const c6Settings = adaptInitialSettingsForDevice(mv11.initialSettings, 'hamilton-c6')
      const evitaSettings = adaptInitialSettingsForDevice(
        mv11.initialSettings,
        'drager-evita-v800-v600',
      )
      expect(c6Settings.mode).toBe('pressure-support')
      expect(evitaSettings.mode).toBe('pressure-support')
      if (c6Settings.mode === 'pressure-support' && evitaSettings.mode === 'pressure-support') {
        expect(c6Settings.pRampMs).toBe(200)
        expect(evitaSettings.pRampMs).toBe(600)
      }
    }
    expect(mv11.deviceAdaptationNotes.join(' ')).toMatch(/70–120 ms/)
    expect(mv11.deviceAdaptationNotes.join(' ')).toMatch(/30 ms/)
    for (const definition of mechanicalVentilationCases) {
      if (definition.initialSettings.mode === 'pressure-support') {
        expect(definition.initialSettings.pRampMs).toBeLessThanOrEqual(2000)
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
