import { teachingNumberErrors } from '@/features/learning-module/numbers/teachingNumbers'

import { ventilationEvidence } from '../content/evidence'
import { ventilationUnitById } from '../content/learningCurriculum'
import { ventilationQuestionById } from '../content/learningQuestions'
import {
  PEEP_FIO2_HIGHER_PEEP,
  PEEP_FIO2_LOWER_PEEP,
  VENTILATION_NUMBERS,
} from '../content/teachingNumbers'

/** The four deteriorating-patient questions re-keyed to first moves on 2026-10-08. */
const FIRST_MOVE_QUESTION_IDS = [
  'safety-reassessment-and-human-factors:check',
  'safety-reassessment-and-human-factors:placement',
  'high-peak-pressure-integration:transfer',
  'high-peak-pressure-integration:final',
] as const

describe('Mechanical Ventilation teaching numbers', () => {
  it('gives every number a class, a registered source, a locator and a check date', () => {
    expect(
      teachingNumberErrors(
        VENTILATION_NUMBERS,
        new Set(ventilationEvidence.map((record) => record.id)),
      ),
    ).toEqual([])
  })

  it('carries both ARDS Network PEEP and FiO₂ tables in full', () => {
    expect(PEEP_FIO2_LOWER_PEEP).toHaveLength(14)
    expect(PEEP_FIO2_HIGHER_PEEP).toHaveLength(14)
  })

  it('teaches the register’s lung-protection values in the lung-protection section', () => {
    const { explanation } = ventilationUnitById.get('lung-protection')!
    for (const id of ['vt-ards-goal', 'pplat-limit', 'driving-pressure-limit'] as const)
      expect(explanation).toContain(VENTILATION_NUMBERS.value(id))
  })

  it.each(FIRST_MOVE_QUESTION_IDS)('%s is keyed on a first move, not on calling for help', (id) => {
    const question = ventilationQuestionById.get(id)!
    const keyed = question.choices.find((choice) => choice.id === question.correctId)!
    expect(keyed.label).not.toMatch(/get help|urgent help|local protocol|bedside support/i)
  })
})
