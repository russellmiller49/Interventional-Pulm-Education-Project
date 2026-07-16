import {
  clinicalPracticeScenarios,
  clinicalPracticeScenariosBySupportMode,
  clinicalPracticeStations,
  validateClinicalPracticeRegistry,
} from '../content/clinicalCases'
import { validateEvidenceIds } from '../content/evidence'

describe('CARDIOHELP clinical Practice registry', () => {
  it('is internally valid and keeps complete VV and VA case sets isolated', () => {
    expect(validateClinicalPracticeRegistry()).toEqual([])
    expect(clinicalPracticeScenarios).toHaveLength(12)
    expect(clinicalPracticeScenariosBySupportMode.vv).toHaveLength(6)
    expect(clinicalPracticeScenariosBySupportMode.va).toHaveLength(6)
    expect(
      clinicalPracticeScenariosBySupportMode.vv.every((scenario) => scenario.supportMode === 'vv'),
    ).toBe(true)
    expect(
      clinicalPracticeScenariosBySupportMode.va.every(
        (scenario) => scenario.supportMode === 'va' && scenario.id.startsWith('va-'),
      ),
    ).toBe(true)
  })

  it('covers initiation, deterioration, and complication stations in both modes', () => {
    expect(clinicalPracticeStations.map((station) => station.id)).toEqual([
      'orientation',
      'flow-pressure',
      'troubleshooting',
    ])

    for (const supportMode of ['vv', 'va'] as const) {
      const cases = clinicalPracticeScenariosBySupportMode[supportMode]
      expect(new Set(cases.map((scenario) => scenario.family))).toEqual(
        new Set(['initiation', 'patient-deterioration', 'clinical-complication']),
      )
      expect(cases.some((scenario) => scenario.clinicalCase?.kind === 'initiation')).toBe(true)
      expect(cases.some((scenario) => scenario.clinicalCase?.kind === 'deterioration')).toBe(true)
      expect(cases.some((scenario) => scenario.clinicalCase?.kind === 'complication')).toBe(true)
    }
  })

  it('resolves evidence and all intervention requirements and prerequisites', () => {
    for (const scenario of clinicalPracticeScenarios) {
      const clinicalCase = scenario.clinicalCase
      expect(clinicalCase).toBeDefined()
      expect(validateEvidenceIds(scenario.evidenceIds)).toBe(true)
      expect(clinicalCase?.interventions.length).toBeGreaterThanOrEqual(3)
      expect(clinicalCase?.requiredInterventionIds.length).toBeGreaterThan(0)
      expect(scenario.debrief.correctWorkflow.length).toBeGreaterThan(0)
      expect(scenario.debrief.causalChain.length).toBeGreaterThan(0)

      const interventionIds = new Set(clinicalCase?.interventions.map((item) => item.id))
      for (const requiredId of clinicalCase?.requiredInterventionIds ?? []) {
        expect(interventionIds.has(requiredId)).toBe(true)
      }
      for (const intervention of clinicalCase?.interventions ?? []) {
        for (const prerequisiteId of intervention.prerequisites ?? []) {
          expect(interventionIds.has(prerequisiteId)).toBe(true)
          expect(prerequisiteId).not.toBe(intervention.id)
        }
      }
    }
  })

  it('requires case-specific settings only for ECMO-initiation cases', () => {
    const initiationCases = clinicalPracticeScenarios.filter(
      (scenario) => scenario.clinicalCase?.kind === 'initiation',
    )
    const establishedSupportCases = clinicalPracticeScenarios.filter(
      (scenario) => scenario.clinicalCase?.kind !== 'initiation',
    )

    expect(initiationCases).toHaveLength(2)
    expect(
      initiationCases.every(
        (scenario) =>
          scenario.clinicalCase?.initialSupportStatus === 'not-on-ecmo' &&
          scenario.clinicalCase.initiationTargets !== undefined,
      ),
    ).toBe(true)
    expect(
      establishedSupportCases.every(
        (scenario) =>
          scenario.clinicalCase?.initialSupportStatus === 'on-ecmo' &&
          scenario.clinicalCase.initiationTargets === undefined,
      ),
    ).toBe(true)
  })
})
