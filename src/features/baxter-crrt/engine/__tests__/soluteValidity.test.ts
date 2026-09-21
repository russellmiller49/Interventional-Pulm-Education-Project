import { baxterCrrtCases, getBaxterCrrtCase } from '../../content/completeCases'
import { collectCrrtCaseSemanticIssues } from '../../content/schema'
import { createCrrtLearningSession, crrtLearningSessionReducer } from '../learningSession'
import { evaluateCrrtMetricCondition, readAllowlistedCrrtMetric } from '../outcomes'
import {
  isCrrtSoluteConcentrationMetric,
  selectCrrtSoluteDynamicsValidityMap,
  selectCrrtUnsupportedSoluteIds,
} from '../soluteValidity'
import { crrtSoluteIds } from '../types'

function session(caseId: string) {
  return createCrrtLearningSession({
    caseDefinition: getBaxterCrrtCase(caseId as never),
    experience: 'practice',
    roleLens: 'integrated',
    attempt: 1,
    deviceId: 'prismax-aw8035-2xx',
  })
}

describe('CRRT solute output validity', () => {
  it('reports every runtime solute pool as removal-only, with the inputs it is missing', () => {
    for (const definition of baxterCrrtCases) {
      const state = session(definition.id).simulation
      const validity = selectCrrtSoluteDynamicsValidityMap(state.patient, state.circuit.bags)
      for (const soluteId of crrtSoluteIds) {
        const record = validity[soluteId]
        expect(record).toBeDefined()
        expect(record?.status).toBe('removal-only')
        // No bag in any fixture declares a composition, so the solution term is
        // missing for every solute in every case.
        expect(record?.missingInputIds).toContain('solution-concentration')
      }
      expect(selectCrrtUnsupportedSoluteIds(state.patient, state.circuit.bags)).toEqual([
        ...crrtSoluteIds,
      ])
    }
  })

  it('names the zero source terms the review fixtures actually carry', () => {
    const state = session('CRRT-15').simulation
    const validity = selectCrrtSoluteDynamicsValidityMap(state.patient, state.circuit.bags)
    expect(validity['urea-marker']?.missingInputIds).toEqual([
      'solution-concentration',
      'endogenous-production',
      'external-input',
      'residual-clearance',
    ])
  })

  it('refuses a solute concentration as a scored metric', () => {
    const state = session('CRRT-02').simulation
    expect(isCrrtSoluteConcentrationMetric('patient.solutes.sodium.concentrationPerLiter')).toBe(
      true,
    )
    for (const soluteId of crrtSoluteIds) {
      expect(
        readAllowlistedCrrtMetric(state, `patient.solutes.${soluteId}.concentrationPerLiter`),
      ).toBeNull()
    }
    // A supported delivery metric still reads, so this is containment, not a
    // blanket disabling of the metric reader.
    expect(
      readAllowlistedCrrtMetric(state, 'deliveredTherapy.prescribedEffluentDoseMlKgHour'),
    ).toBeGreaterThan(0)
    expect(
      evaluateCrrtMetricCondition(state, {
        id: 'probe',
        metric: 'patient.solutes.sodium.concentrationPerLiter',
        comparator: 'gte',
        value: 0,
        unit: 'mmol/L',
        sourceId: 'SYNTH-CRRT-02',
        reviewStatus: 'pending',
      }),
    ).toBe(false)
  })

  it('rejects an authored case that scores a solute concentration', () => {
    const definition = getBaxterCrrtCase('CRRT-02')
    const tampered = {
      ...definition,
      successConditions: [
        {
          ...definition.successConditions[0],
          metric: 'patient.solutes.bicarbonate.concentrationPerLiter',
        },
        ...definition.successConditions.slice(1),
      ],
    }
    expect(collectCrrtCaseSemanticIssues(tampered)).toEqual(
      expect.arrayContaining([expect.stringMatching(/unmodeled solute concentration/)]),
    )
    expect(collectCrrtCaseSemanticIssues(definition)).toEqual([])
  })

  it('leaves the mass-balance arithmetic itself unchanged', () => {
    // The documented phenotype the containment covers: with production, input
    // and residual clearance all zero and no solution term, every pool decays.
    // The engine equation is generic and correct; its fixture is incomplete.
    let run = session('CRRT-15')
    run = crrtLearningSessionReducer(run, { type: 'ADVANCE_TIME', seconds: 8 * 3_600 })
    const patient = run.simulation.patient
    expect(patient.status).toBe('configured')
    if (patient.status !== 'configured') return
    expect(patient.solutes.sodium?.concentrationPerLiter).toBeCloseTo(100.862, 2)
    expect(patient.solutes.bicarbonate?.concentrationPerLiter).toBeCloseTo(14.378, 2)
    expect(patient.solutes.potassium?.concentrationPerLiter).toBeCloseTo(3.523, 2)
  })
})
