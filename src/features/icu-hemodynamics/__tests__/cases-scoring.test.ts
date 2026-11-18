import { hemodynamicCaseById, hemodynamicCases, hemodynamicsSourceById } from '../content'
import {
  advanceHemodynamicSimulation,
  createInitialHemodynamicState,
  hasHemodynamicMastery,
  icuHemodynamicsReducer,
  type HemodynamicSimulationState,
} from '../engine'

function completeSafePath(caseIndex: number): HemodynamicSimulationState {
  const definition = hemodynamicCases[caseIndex]
  let state = createInitialHemodynamicState(definition, 'practice', 900 + caseIndex)
  state = icuHemodynamicsReducer(state, {
    type: 'SELECT_MECHANISM',
    id: definition.correctMechanismId,
  })
  state = icuHemodynamicsReducer(state, {
    type: 'SELECT_PRIORITY',
    id: definition.correctPriorityId,
  })
  state = icuHemodynamicsReducer(state, { type: 'COMMIT_PREDICTION' })
  state = icuHemodynamicsReducer(state, { type: 'SET_TRANSDUCER_LEVEL', levelCm: 0 })
  state = icuHemodynamicsReducer(state, { type: 'ZERO_TRANSDUCER' })
  state = icuHemodynamicsReducer(state, {
    type: 'FAST_FLUSH',
    lineType: 'pulmonary-artery',
  })
  state = icuHemodynamicsReducer(state, { type: 'VALIDATE_SIGNAL', check: 'waveform-valid' })
  state = icuHemodynamicsReducer(state, { type: 'VALIDATE_SIGNAL', check: 'derived-reviewed' })
  if (definition.id === 'HD-08') {
    state = icuHemodynamicsReducer(state, {
      type: 'VALIDATE_SIGNAL',
      check: 'dynamic-response-classified',
    })
    state = icuHemodynamicsReducer(state, { type: 'SET_DAMPING', dampingRatio: 0.65 })
    state = icuHemodynamicsReducer(state, { type: 'SET_ARTIFACT', artifact: 'none' })
    state = icuHemodynamicsReducer(state, { type: 'RETRACT_CATHETER', instant: true })
  }

  for (const interventionId of definition.requiredInterventionIds) {
    if (
      definition.id === 'HD-08' &&
      ['correct-measurement-system', 'reposition-catheter', 'repeat-valid-thermodilution'].includes(
        interventionId,
      )
    ) {
      continue
    }
    const intervention = definition.interventions.find(
      (candidate) => candidate.id === interventionId,
    )
    expect(intervention).toBeDefined()
    state = icuHemodynamicsReducer(state, {
      type: 'APPLY_INTERVENTION',
      intervention: intervention!,
    })
  }
  state = advanceHemodynamicSimulation(state, 90)

  for (let trialIndex = 0; trialIndex < 3; trialIndex += 1) {
    state = icuHemodynamicsReducer(state, {
      type: 'GENERATE_THERMODILUTION_TRIAL',
      technique: {
        injectateVolumeMl: definition.thermodilution.injectateVolumeMl,
        injectateTemperatureC: definition.thermodilution.injectateTemperatureC,
        injectionDurationSeconds: 2.5,
        respiratoryPhase: 'end-expiration',
        smoothness: 0.95,
      },
    })
    const trial = state.thermodilutionTrials.at(-1)!
    expect(trial.quality).toBe('valid')
    state = icuHemodynamicsReducer(state, {
      type: 'SET_THERMODILUTION_ACCEPTED',
      trialId: trial.id,
      accepted: true,
    })
  }
  state = icuHemodynamicsReducer(state, { type: 'REASSESS' })
  return icuHemodynamicsReducer(state, { type: 'COMPLETE_CASE' })
}

/**
 * Owner ruling 2026-11-14 (hd-ci-endpoint-2-vs-2-2): the case endpoints rise to the register's
 * cardiogenic-shock boundary, CI 2.2 L/min/m², where the keyed path can reach it. Each case is
 * played on its keyed path only — level, zero, every required intervention once, then time — and
 * the cardiac index the criterion reads is checked against the endpoint.
 */
function keyedPathCardiacIndex(caseId: string, seconds: number): number {
  const definition = hemodynamicCaseById.get(caseId)!
  let state = createInitialHemodynamicState(definition, 'practice', 900)
  state = icuHemodynamicsReducer(state, { type: 'SET_TRANSDUCER_LEVEL', levelCm: 0 })
  state = icuHemodynamicsReducer(state, { type: 'ZERO_TRANSDUCER' })
  for (const interventionId of definition.requiredInterventionIds) {
    state = icuHemodynamicsReducer(state, {
      type: 'APPLY_INTERVENTION',
      intervention: definition.interventions.find((candidate) => candidate.id === interventionId)!,
    })
  }
  return advanceHemodynamicSimulation(state, seconds).measurements.cardiacIndexLMinM2!
}

function cardiacIndexEndpoint(caseId: string): number | undefined {
  return hemodynamicCaseById
    .get(caseId)!
    .successCriteria.find((criterion) => criterion.metric === 'cardiacIndexLMinM2')?.value
}

describe('cardiac-index endpoints against the keyed path', () => {
  it.each(['HD-04', 'HD-05'])(
    '%s reaches CI 2.2 on its keyed path and resolves there',
    (caseId) => {
      expect(cardiacIndexEndpoint(caseId)).toBe(2.2)
      expect(keyedPathCardiacIndex(caseId, 300)).toBeGreaterThanOrEqual(2.2)
    },
  )

  it('HD-03 and HD-07 already use 2.2', () => {
    expect(cardiacIndexEndpoint('HD-03')).toBe(2.2)
    expect(cardiacIndexEndpoint('HD-07')).toBe(2.2)
  })

  it('HD-06 stays at 2.0 because diuresis and one PEEP step do not reach 2.2', () => {
    // The ruling raises an endpoint only where the keyed path reaches it; the engine and the case
    // were not tuned. Dobutamine is what would carry this case past 2.2. If this starts to fail,
    // the keyed path now reaches 2.2 and HD-06 can take the raised endpoint.
    expect(cardiacIndexEndpoint('HD-06')).toBe(2)
    expect(keyedPathCardiacIndex('HD-06', 300)).toBeLessThan(2.2)
  })
})

describe('eight versioned management cases', () => {
  it('has eight unique, sourced, deterministic definitions with declared safe and unsafe paths', () => {
    expect(hemodynamicCases).toHaveLength(8)
    expect(new Set(hemodynamicCases.map((definition) => definition.id)).size).toBe(8)
    for (const definition of hemodynamicCases) {
      expect(definition.version).toMatch(/^1\./)
      expect(definition.sourceIds.length).toBeGreaterThan(0)
      for (const sourceId of definition.sourceIds)
        expect(hemodynamicsSourceById.has(sourceId)).toBe(true)
      for (const required of definition.requiredInterventionIds) {
        expect(definition.interventions.some((intervention) => intervention.id === required)).toBe(
          true,
        )
      }
    }
  })

  it('starts each named case in the intended broad phenotype', () => {
    const underfilled = createInitialHemodynamicState(hemodynamicCaseById.get('HD-01')!)
    expect(underfilled.measurements.rapMmHg).toBeLessThan(6)
    expect(underfilled.parameters.fluidResponsiveness).toBeGreaterThan(0.8)

    const sepsis = createInitialHemodynamicState(hemodynamicCaseById.get('HD-02')!)
    expect(sepsis.parameters.systemicVascularResistanceDynSecCm5).toBeLessThan(600)
    expect(sepsis.measurements.mapMmHg).toBeLessThan(65)

    const lv = createInitialHemodynamicState(hemodynamicCaseById.get('HD-03')!)
    expect(lv.measurements.pawpMmHg).toBeGreaterThan(20)
    expect(lv.measurements.cardiacIndexLMinM2).toBeLessThan(2.2)

    const pe = createInitialHemodynamicState(hemodynamicCaseById.get('HD-04')!)
    expect(pe.parameters.pulmonaryVascularResistanceWU).toBeGreaterThan(5)
    expect(pe.measurements.rapMmHg).toBeGreaterThan(pe.measurements.pawpMmHg ?? 100)

    const precapillary = createInitialHemodynamicState(hemodynamicCaseById.get('HD-05')!)
    expect(precapillary.measurements.meanPapMmHg).toBeGreaterThan(20)
    expect(precapillary.measurements.pawpMmHg).toBeLessThanOrEqual(15)
    expect(precapillary.parameters.pulmonaryVascularResistanceWU).toBeGreaterThan(2)

    const postcapillary = createInitialHemodynamicState(hemodynamicCaseById.get('HD-06')!)
    expect(postcapillary.measurements.pawpMmHg).toBeGreaterThan(15)
    expect(postcapillary.parameters.peepCmH2O).toBeGreaterThan(10)

    const tamponade = createInitialHemodynamicState(hemodynamicCaseById.get('HD-07')!)
    expect(tamponade.parameters.pericardialPressureMmHg).toBeGreaterThan(10)

    const artifact = createInitialHemodynamicState(hemodynamicCaseById.get('HD-08')!)
    // The tip fault is a spontaneous wedge: a position, with the balloon down, not a signal artifact.
    expect(artifact.measurementSystem.artifact).toBe('none')
    expect(artifact.catheter.position).toBe('wedge')
    expect(artifact.catheter.balloonInflated).toBe(false)
  })

  it('keeps related cases mechanistically distinct and uses defensible scenario endpoints', () => {
    const relatedCases = ['HD-03', 'HD-04', 'HD-05', 'HD-06'].map(
      (caseId) => hemodynamicCaseById.get(caseId)!,
    )
    expect(new Set(relatedCases.map((definition) => definition.correctMechanismId)).size).toBe(4)
    expect(new Set(relatedCases.map((definition) => definition.correctPriorityId)).size).toBe(4)

    expect(hemodynamicCaseById.get('HD-02')?.unsafeInterventionIds).toContain('fluid-250')
    expect(
      hemodynamicCaseById
        .get('HD-04')
        ?.successCriteria.some((criterion) => criterion.metric === 'meanPapMmHg'),
    ).toBe(false)
    for (const caseId of ['HD-03', 'HD-06']) {
      expect(
        hemodynamicCaseById
          .get(caseId)
          ?.successCriteria.find((criterion) => criterion.metric === 'pawpMmHg')?.value,
      ).toBe(18)
    }
  })

  it('records complete provenance for the two high-use reference sources', () => {
    const sepsis = hemodynamicsSourceById.get('ssc-sepsis-2026')
    expect(sepsis?.citation).toMatch(/Prescott.*Crit Care Med.*7075/i)
    expect(sepsis?.url).toMatch(/surviving-sepsis-campaign.*2026/i)

    const waveformText = hemodynamicsSourceById.get('clinical-hemodynamics-waveforms')
    expect(waveformText?.year).toBe(2025)
    expect(waveformText?.citation).toMatch(/3rd ed.*15–49.*00002-2/i)
  })

  it.each(hemodynamicCases.map((definition, index) => [definition.id, index] as const))(
    '%s has at least one no-critical-error mastery path',
    (_caseId, index) => {
      const state = completeSafePath(index)
      expect(state.criticalErrors).toEqual([])
      expect(state.score?.total).toBeGreaterThanOrEqual(80)
      expect(hasHemodynamicMastery(state)).toBe(true)
    },
  )

  it('withholds mastery after a defined critical safety action even when the score is otherwise high', () => {
    const definition = hemodynamicCaseById.get('HD-04')!
    let state = completeSafePath(3)
    state = { ...state, completed: false, score: null }
    const unsafe = definition.interventions.find((item) => item.id === 'peep-up-unsafe')!
    state = icuHemodynamicsReducer(state, { type: 'APPLY_INTERVENTION', intervention: unsafe })
    state = icuHemodynamicsReducer(state, { type: 'COMPLETE_CASE' })
    expect(state.criticalErrors).toContain('peep-up-unsafe')
    expect(hasHemodynamicMastery(state)).toBe(false)
  })
})
