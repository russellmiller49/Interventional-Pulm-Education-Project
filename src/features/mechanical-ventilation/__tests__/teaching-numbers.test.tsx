import { render } from '@testing-library/react'

import { teachingNumberErrors } from '@/features/learning-module/numbers/teachingNumbers'

import { VentilationProtectionReference } from '../components/VentilationLearningVisuals'
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
    for (const id of ['vt-ards-goal', 'pplat-limit', 'driving-pressure-reference'] as const)
      expect(explanation).toContain(VENTILATION_NUMBERS.value(id))
  })

  describe('driving pressure', () => {
    const row = VENTILATION_NUMBERS.get('driving-pressure-reference')
    const unit = ventilationUnitById.get('lung-protection')!

    it('defines it as plateau minus total PEEP on holds in a passive patient', () => {
      expect(row.label).toContain('plateau − total PEEP')
      expect(row.appliesTo).toMatch(/passive patient/)
      expect(unit.explanation).toContain('plateau minus total PEEP')
      expect(unit.explanation).toMatch(/inspiratory pause/)
      expect(unit.explanation).toMatch(/end-expiratory hold/)
      expect(unit.checklist).toContain(
        'Subtract total PEEP, not set PEEP, from the plateau for the driving pressure.',
      )
    })

    it('keeps the 15 cmH₂O reference with the grade its source prints', () => {
      expect(row.value).toBe('about 15 cmH₂O')
      const aarc = row.sources.find((source) => source.sourceId === 'aarc-assessment-2024')!
      expect(aarc.grade).toBe('conditional recommendation, low certainty')
      expect(aarc.locator).toMatch(/Table 2/)
      expect(unit.explanation).toMatch(/conditional, low-certainty/)
      expect(unit.explanation).toMatch(/have not shown lower mortality/)
    })

    it('does not teach that no trial has tested a target', () => {
      const trials = ventilationEvidence.find(
        (record) => record.id === 'agrafiotis-driving-pressure-rcts-2026',
      )!
      expect(trials.supports.join(' ')).toMatch(/Four randomized trials \(431 patients\)/)
      const copy = ventilationEvidence.flatMap((record) => [
        ...record.supports,
        record.limitations ?? '',
      ])
      expect(copy.concat(row.note ?? '').join(' ')).not.toMatch(/no trial has tested/i)
    })

    it('renders the reference as a reference, apart from the plateau limit', () => {
      const { container } = render(<VentilationProtectionReference />)
      const text = container.textContent ?? ''
      expect(text).toContain('plateau minus total PEEP')
      expect(text).toContain(VENTILATION_NUMBERS.value('driving-pressure-reference'))
      expect(text).toMatch(/A reference, not a limit like the plateau/)
      expect(text).toContain('AARC 2024')
    })

    it('works the example with total PEEP, with and without intrinsic PEEP', () => {
      const { reasoning } = unit.example!
      const steps = reasoning.flatMap((line) =>
        [...line.matchAll(/(\d+) − (\d+) = (\d+) cmH₂O/g)].map((match) => match.slice(1, 4)),
      )
      expect(steps).toEqual([
        ['32', '10', '22'],
        ['32', '14', '18'],
      ])
      for (const [plateau, totalPeep, driving] of steps)
        expect(Number(plateau) - Number(totalPeep)).toBe(Number(driving))
    })
  })

  it.each(FIRST_MOVE_QUESTION_IDS)('%s is keyed on a first move, not on calling for help', (id) => {
    const question = ventilationQuestionById.get(id)!
    const keyed = question.choices.find((choice) => choice.id === question.correctId)!
    expect(keyed.label).not.toMatch(/get help|urgent help|local protocol|bedside support/i)
  })
})
