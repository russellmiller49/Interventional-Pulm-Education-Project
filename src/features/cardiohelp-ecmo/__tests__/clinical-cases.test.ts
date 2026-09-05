import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity'

import {
  clinicalPracticeScenarios,
  clinicalPracticeScenariosBySupportMode,
  clinicalPracticeStations,
  validateClinicalPracticeRegistry,
} from '../content/clinicalCases'
import { validateEvidenceIds } from '../content/evidence'
import { cardiohelpScenarioById } from '../content/scenarios'
import type { ClinicalCaseDefinition } from '../engine/types'

/**
 * Words long enough to carry a diagnosis, a mechanism or a move. Shorter tokens are grammar, units
 * and channel names (pVen, flow, CVP), which are what the learner is asked to read.
 */
function contentWords(text: string): ReadonlySet<string> {
  return new Set((text.toLowerCase().match(/[a-z]+/g) ?? []).filter((word) => word.length >= 5))
}

function sharedContentWords(text: string, reference: string): readonly string[] {
  const words = contentWords(reference)
  return [...contentWords(text)].filter((word) => words.has(word)).sort()
}

/** Digits in learner copy may only quote a value the case already shows the learner. */
function unquotedNumbers(text: string, clinicalCase: ClinicalCaseDefinition): readonly string[] {
  const shown = [
    clinicalCase.setting,
    clinicalCase.openingNarrative,
    ...clinicalCase.data.flatMap((item) => [item.label, item.value]),
  ].join(' ')
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).filter((number) => !shown.includes(number))
}

const CAPSTONE_IDS = ['vv-off-sweep-capstone', 'va-mixed-circulation-capstone'] as const

describe('CARDIOHELP clinical Practice registry', () => {
  it('is internally valid and keeps complete VV and VA case sets isolated', () => {
    expect(validateClinicalPracticeRegistry()).toEqual([])
    expect(clinicalPracticeScenarios).toHaveLength(14)
    expect(clinicalPracticeScenariosBySupportMode.vv).toHaveLength(7)
    expect(clinicalPracticeScenariosBySupportMode.va).toHaveLength(7)
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

  it('states exactly three learning objectives per case', () => {
    for (const scenario of clinicalPracticeScenarios) {
      const learningObjectives = scenario.clinicalCase?.learningObjectives ?? []
      expect(learningObjectives).toHaveLength(3)
      expect(learningObjectives.every((objective) => objective.trim().length > 0)).toBe(true)
    }
  })

  it('names every case by an authored presentation that shares no content word with its diagnosis', () => {
    for (const scenario of clinicalPracticeScenarios) {
      const clinicalCase = scenario.clinicalCase
      if (!clinicalCase) throw new Error(`${scenario.id} has no clinical case`)
      const title = clinicalCase.presentationTitle ?? ''
      expect(`${scenario.id}: ${title.trim().length > 0}`).toBe(`${scenario.id}: true`)
      // The header, the picker and the Now card show this before the plan is committed; the
      // diagnosis title returns only in the debrief.
      expect(title).not.toBe(scenario.title)
      expect(
        `${scenario.id}: ${sharedContentWords(title, scenario.debrief.diagnosis).join(', ')}`,
      ).toBe(`${scenario.id}: `)
      expect(`${scenario.id}: ${unquotedNumbers(title, clinicalCase).join(', ')}`).toBe(
        `${scenario.id}: `,
      )
      expect(`${scenario.id}: ${flaggedLearnerCopyTerms(title).join(', ')}`).toBe(
        `${scenario.id}: `,
      )
    }
  })

  it('writes every objective as a discrimination that names neither the diagnosis nor the first authored move', () => {
    for (const scenario of clinicalPracticeScenarios) {
      const clinicalCase = scenario.clinicalCase
      if (!clinicalCase) throw new Error(`${scenario.id} has no clinical case`)
      const firstMove = scenario.debrief.correctWorkflow[0]
      for (const objective of clinicalCase.learningObjectives) {
        const where = `${scenario.id}: ${objective.slice(0, 40)}`
        // The skill's pattern: "Decide from X, Y and Z whether … is A or B" — the discrimination,
        // never the answer. Objectives render only in the debrief today, but the rule holds.
        expect(`${where} → ${/^Decide\b/.test(objective)}`).toBe(`${where} → true`)
        expect(
          `${where} → ${sharedContentWords(objective, scenario.debrief.diagnosis).join(', ')}`,
        ).toBe(`${where} → `)
        expect(`${where} → ${sharedContentWords(objective, firstMove).join(', ')}`).toBe(
          `${where} → `,
        )
        expect(`${where} → ${unquotedNumbers(objective, clinicalCase).join(', ')}`).toBe(
          `${where} → `,
        )
        expect(`${where} → ${flaggedLearnerCopyTerms(objective).join(', ')}`).toBe(`${where} → `)
      }
    }
  })

  it('titles both capstones by a challenge brief that is not their diagnosis', () => {
    for (const id of CAPSTONE_IDS) {
      const scenario = cardiohelpScenarioById.get(id)
      if (!scenario) throw new Error(`No scenario ${id}`)
      const brief = scenario.challengeBrief
      expect(`${id}: ${Boolean(brief)}`).toBe(`${id}: true`)
      expect(brief?.title.trim().length ?? 0).toBeGreaterThan(0)
      expect(brief?.presentation.trim().length ?? 0).toBeGreaterThan(0)
      expect(brief?.title).not.toBe(scenario.title)
      expect(
        `${id}: ${sharedContentWords(brief?.title ?? '', scenario.debrief.diagnosis).join(', ')}`,
      ).toBe(`${id}: `)
      for (const text of [brief?.title ?? '', brief?.presentation ?? '']) {
        expect(`${id}: ${flaggedLearnerCopyTerms(text).join(', ')}`).toBe(`${id}: `)
      }
    }
  })

  it('gives every case objective reassessment choices and scored clues', () => {
    for (const scenario of clinicalPracticeScenarios) {
      expect(scenario.reassessment).toBeDefined()
      for (const domain of ['device', 'circuit', 'patient'] as const) {
        const question = scenario.reassessment?.[domain]
        expect(question?.options.length).toBeGreaterThanOrEqual(3)
        expect(question?.options.some((item) => item.id === question.correctOptionId)).toBe(true)
      }
      expect(scenario.hints).toHaveLength(2)
      expect(scenario.hints?.every((hint) => hint.penalty > 0)).toBe(true)
    }
  })
})
