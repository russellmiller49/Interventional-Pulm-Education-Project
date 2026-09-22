import { getBaxterCrrtCase } from '../../content/completeCases'
import { selectCrrtActualRunReview } from '../../actualRunReview'
import { selectCrrtLabEvidence } from '../../labEvidence'
import { createCrrtLearningSession, crrtLearningSessionReducer } from '../learningSession'
import { readAllowlistedCrrtMetric } from '../outcomes'
import {
  selectCrrtSoluteDynamicsValidity,
  selectCrrtSoluteDynamicsValidityMap,
} from '../soluteValidity'
import { advanceSolutePool } from '../soluteModel'
import { completeCrrtMachineSetup } from '../testSupport/machineWorkflow'

function start(caseId: 'CRRT-02' | 'CRRT-04' | 'CRRT-11' | 'CRRT-13' | 'CRRT-15') {
  return createCrrtLearningSession({
    caseDefinition: getBaxterCrrtCase(caseId),
    experience: 'practice',
    roleLens: 'integrated',
    attempt: 1,
    deviceId: 'prismax-aw8035-2xx',
  })
}

describe('independent Batch 01 sanity regressions', () => {
  it('does not infer suppliedness or clinical validity from zero or nonzero source terms', () => {
    const state = start('CRRT-15').simulation
    if (state.patient.status !== 'configured') throw new Error('Expected patient fixture')
    const pool = state.patient.solutes.sodium!
    const zero = selectCrrtSoluteDynamicsValidity(pool, state.circuit.bags)
    const nonzero = selectCrrtSoluteDynamicsValidity(
      { ...pool, productionAmountPerHour: 1, inputAmountPerHour: 1, residualClearanceMlMin: 1 },
      state.circuit.bags,
    )
    expect(nonzero).toEqual(zero)
    // Even a fabricated composition field cannot establish a reviewed model.
    const fabricatedBags = state.circuit.bags.map((bag) => ({
      ...bag,
      soluteConcentrationsPerLiter: { sodium: 140 },
    }))
    expect(
      selectCrrtSoluteDynamicsValidity(
        { ...pool, productionAmountPerHour: 1, inputAmountPerHour: 1, residualClearanceMlMin: 1 },
        fabricatedBags,
      ),
    ).toEqual(zero)
  })

  it('raises an explicit error if a prohibited metric bypasses content validation', () => {
    expect(() =>
      readAllowlistedCrrtMetric(
        start('CRRT-02').simulation,
        'patient.solutes.sodium.concentrationPerLiter',
      ),
    ).toThrow(/unsupported solute/i)
  })

  it('keeps absent pools, explicit zero, unsupported output and an unchanged pool distinct', () => {
    const run = start('CRRT-15')
    const patient = run.simulation.patient
    if (patient.status !== 'configured') throw new Error('Expected patient fixture')
    const pool = patient.solutes.sodium!
    const absent = selectCrrtSoluteDynamicsValidityMap(
      { ...patient, solutes: {} },
      run.simulation.circuit.bags,
    )
    expect(absent.sodium).toBeUndefined()
    expect(selectCrrtSoluteDynamicsValidity(pool, run.simulation.circuit.bags).status).toBe(
      'unsupported',
    )
    const zero = { ...pool, concentrationPerLiter: 0 }
    expect(advanceSolutePool(zero, 0, 3600).pool.concentrationPerLiter).toBe(0)
    expect(advanceSolutePool(pool, 0, 3600).pool.concentrationPerLiter).toBe(
      pool.concentrationPerLiter,
    )
    const evidence = selectCrrtLabEvidence({
      ...run,
      caseDefinition: {
        ...run.caseDefinition,
        initialPatient: {
          ...run.caseDefinition.initialPatient,
          solutes: {
            ...run.caseDefinition.initialPatient.solutes,
            sodiumMmolPerL: 0,
          },
        },
      },
    })
    expect(evidence.suppliedBaseline.find((lab) => lab.id === 'sodium')?.value).toBe(0)
    expect(evidence.unmodeledResponses.map((lab) => lab.soluteId)).toContain('sodium')
  })

  it('preserves equal-time ordering and logs double activation as refused without reapplying it', () => {
    let run = start('CRRT-11')
    const action = {
      type: 'PERFORM_INTERVENTION' as const,
      interventionId: 'crrt11-action-unsafe-candidate',
    }
    run = crrtLearningSessionReducer(run, action)
    const appliedSimulation = run.simulation
    run = crrtLearningSessionReducer(run, action)
    expect(run.simulation).toBe(appliedSimulation)
    expect(run.performedInterventionIds).toEqual([action.interventionId])
    const review = selectCrrtActualRunReview(run)
    expect(review.actions.map((entry) => [entry.sequence, entry.atSeconds, entry.outcome])).toEqual(
      [
        [1, 0, 'applied'],
        [2, 0, 'refused'],
      ],
    )
    expect(review.unsafeActionsPerformed).toHaveLength(1)
    expect(review.actions[1].valueNote).toMatch(/already performed/)
  })

  it('records two different prescription entries at event time, then a refused setup repeat', () => {
    let run = start('CRRT-04')
    for (const action of [
      { type: 'SELECT_NEW_PATIENT' as const },
      { type: 'COMPLETE_SETUP_STEP' as const, stepId: 'patient' as const },
      { type: 'SELECT_CVVHD' as const },
      { type: 'COMPLETE_SETUP_STEP' as const, stepId: 'therapy' as const },
      { type: 'SET_PRESCRIPTION_VALUE' as const, field: 'bloodFlowMlMin' as const, value: 150 },
      { type: 'SET_PRESCRIPTION_VALUE' as const, field: 'bloodFlowMlMin' as const, value: 180 },
      { type: 'COMPLETE_SETUP_STEP' as const, stepId: 'therapy' as const },
    ])
      run = crrtLearningSessionReducer(run, { type: 'DEVICE_ACTION', action })
    const review = selectCrrtActualRunReview(run)
    expect(review.actions.slice(-3).map((entry) => entry.outcome)).toEqual([
      'applied',
      'applied',
      'refused',
    ])
    expect(review.actions.at(-3)?.valueNote).toContain('150 mL/min')
    expect(review.actions.at(-2)?.valueNote).toContain('180 mL/min')
    expect(review.actions.map((entry) => entry.atSeconds)).toEqual(Array(7).fill(0))
  })
  it.each([
    ['CRRT-02', 2, 129.691, 9.512, 6.563],
    ['CRRT-04', 6, 138, 16, 5.8],
    ['CRRT-15', 8, 100.862, 14.378, 3.523],
  ] as const)(
    'contains %s after %s hours while preserving authored baseline evidence',
    (id, hours, na, bicarbonate, potassium) => {
      const initial = start(id)
      const run = crrtLearningSessionReducer(initial, {
        type: 'ADVANCE_TIME',
        seconds: hours * 3600,
      })
      if (run.simulation.patient.status !== 'configured')
        throw new Error('Expected patient fixture')
      expect(run.simulation.patient.solutes.sodium?.concentrationPerLiter).toBeCloseTo(na, 2)
      expect(run.simulation.patient.solutes.bicarbonate?.concentrationPerLiter).toBeCloseTo(
        bicarbonate,
        2,
      )
      expect(run.simulation.patient.solutes.potassium?.concentrationPerLiter).toBeCloseTo(
        potassium,
        2,
      )
      expect(selectCrrtLabEvidence(run).suppliedBaseline).toEqual(
        selectCrrtLabEvidence(initial).suppliedBaseline,
      )
      expect(selectCrrtLabEvidence(run).unmodeledResponses).toHaveLength(7)
    },
  )

  it('contains the configured CRRT-04 six-hour removal-only trajectory as well', () => {
    // The run now starts on the machine, because a case card can no longer prime,
    // review, connect or start around the facsimile's interlock (F-17). The
    // removal-only arithmetic this pins is unchanged: the same supplied example
    // prescription reaches the engine, by the only route that can start it.
    let run = completeCrrtMachineSetup(start('CRRT-04'), {
      bloodFlowMlMin: 120,
      dialysateFlowMlHour: 1_800,
      patientFluidRemovalMlHour: 100,
    })
    for (const suffix of [
      'assess-goal',
      'enter-blood-flow',
      'enter-dialysate-primary',
      'enter-machine-pfr',
      'complete-prime-review',
      'start-reviewed-treatment',
      'advance-six-hours',
    ]) {
      run = crrtLearningSessionReducer(run, {
        type: 'PERFORM_INTERVENTION',
        interventionId: `crrt04-${suffix}`,
      })
    }
    if (run.simulation.patient.status !== 'configured') throw new Error('Expected patient fixture')
    expect(run.simulation.patient.solutes.sodium?.concentrationPerLiter).toBeCloseTo(111.316, 2)
    expect(
      selectCrrtLabEvidence(run).suppliedBaseline.find((lab) => lab.id === 'sodium')?.value,
    ).toBe(138)
    expect(selectCrrtLabEvidence(run).unmodeledResponses).toHaveLength(7)
  })

  it('preserves prescription, reassessment, time and history when changing the role', () => {
    let run = start('CRRT-11')
    for (const suffix of ['assess', 'safe-candidate']) {
      run = crrtLearningSessionReducer(run, {
        type: 'PERFORM_INTERVENTION',
        interventionId: `crrt11-action-${suffix}`,
      })
    }
    run = crrtLearningSessionReducer(run, {
      type: 'COMMIT_REASSESSMENT',
      optionIds: [run.caseDefinition.reassessmentOptions[0].id],
    })
    const changed = crrtLearningSessionReducer(run, { type: 'SET_ROLE_LENS', roleLens: 'operator' })
    expect(changed).toEqual({
      ...run,
      roleLens: 'operator',
      simulation: { ...run.simulation, roleLens: 'operator' },
    })
    expect(changed.reassessment.committed).toBe(true)
    expect(changed.simulation.simulationTimeSeconds).toBe(3600)
  })

  it('keeps a paused pool unchanged without presenting it as a supported lab response', () => {
    let run = start('CRRT-13')
    for (const suffix of [
      'assess-patient-device',
      'advance-to-pattern',
      'inspect-access-path',
      'pause-treatment',
    ]) {
      run = crrtLearningSessionReducer(run, {
        type: 'PERFORM_INTERVENTION',
        interventionId: `crrt13-${suffix}`,
      })
    }
    expect(run.simulation.device.deliveryState).toBe('paused')
    const before = run.simulation.patient
    run = crrtLearningSessionReducer(run, { type: 'ADVANCE_TIME', seconds: 300 })
    if (run.simulation.patient.status !== 'configured' || before.status !== 'configured')
      throw new Error('Expected patient fixture')
    expect(run.simulation.patient.solutes).toEqual(before.solutes)
    expect(selectCrrtLabEvidence(run).unmodeledResponses).toHaveLength(7)
    expect(run.simulation.deliveredTherapy.cumulativeDowntimeSeconds).toBe(300)
  })
})
