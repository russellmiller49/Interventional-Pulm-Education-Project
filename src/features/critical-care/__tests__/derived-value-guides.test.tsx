import { render } from '@testing-library/react'

import {
  DerivedValueReadout,
  HeldDisagreement,
  MeasurementClarification,
} from '../components/teaching/EvidenceRenderers'
import {
  allCriticalCareDerivedValueGuides,
  intervalContains,
  resolveInterpretation,
  validateCriticalCareDerivedValueGuides,
  type CriticalCareDerivedValueGuide,
} from '../content/derivedValueGuides'
import { criticalCareEvidenceById } from '../content/evidenceRegistry'
import {
  criticalCareMeasurementClarificationById,
  criticalCareMeasurementClarifications,
  measurementClarificationsForConcept,
} from '../content/measurementClarifications'
import {
  criticalCareSourceConflictById,
  criticalCareSourceConflicts,
} from '../content/sourceConflicts'
import {
  MCS_MODEL_BOUNDARIES,
  MCS_MODEL_BOUNDARY_REFERENCES,
  interpretMcsCardiacPowerOutput,
  interpretMcsPapi,
  mcsCardiacPowerOutputReferenceIds,
  mcsDerivedValueGuides,
  mcsPapiReferenceIds,
} from '@/features/mechanical-circulatory-support/content/derivedValueGuides'
import {
  assertEveryClarifiedQuantityRenders,
  assertEveryConflictPositionRenders,
  assertNoUniversalTargetLanguage,
} from '../test-support/teachingPanelContract'

function guide(
  overrides: Partial<CriticalCareDerivedValueGuide> = {},
): CriticalCareDerivedValueGuide {
  return {
    id: 'test.guide',
    label: 'Test',
    liveValueType: 'derived',
    interpretation: 'A test quantity.',
    references: [
      {
        id: 'test.reference',
        kind: 'cohort-observation',
        statement: 'A cohort reported something.',
        appliesWhen: 'That cohort.',
        evidenceIds: ['pac-derived-part-2-2021'],
      },
    ],
    caveats: 'Test caveats.',
    doNotInfer: 'Do not infer anything from a test.',
    conceptIds: [],
    reviewStatus: 'draft',
    ...overrides,
  }
}

describe('shared derived-value guide model', () => {
  it('no longer carries normalRange or actionableThresholds', () => {
    for (const authored of allCriticalCareDerivedValueGuides()) {
      const record = { ...authored } as Record<string, unknown>
      expect('normalRange' in record).toBe(false)
      expect('actionableThresholds' in record).toBe(false)
    }
  })

  it('requires a doNotInfer statement and at least one reference', () => {
    expect(validateCriticalCareDerivedValueGuides([guide({ doNotInfer: ' ' })])).toContainEqual(
      expect.stringContaining('doNotInfer is required'),
    )
    expect(validateCriticalCareDerivedValueGuides([guide({ references: [] })])).toContainEqual(
      expect.stringContaining('at least one reference'),
    )
  })

  it('rejects duplicate guide ids', () => {
    expect(validateCriticalCareDerivedValueGuides([guide(), guide()])).toContainEqual(
      expect.stringContaining('duplicate guide id'),
    )
  })

  it('rejects duplicate reference ids', () => {
    const duplicated = guide({
      references: [
        {
          id: 'same',
          kind: 'cohort-observation',
          statement: 'a',
          appliesWhen: 'x',
          evidenceIds: ['pac-derived-part-2-2021'],
        },
        {
          id: 'same',
          kind: 'cohort-observation',
          statement: 'b',
          appliesWhen: 'x',
          evidenceIds: ['pac-derived-part-2-2021'],
        },
      ],
    })
    expect(validateCriticalCareDerivedValueGuides([duplicated])).toContainEqual(
      expect.stringContaining('duplicate reference id'),
    )
  })

  it('rejects a reference with no evidence ids', () => {
    const unsourced = guide({
      references: [
        {
          id: 'unsourced',
          kind: 'cohort-observation',
          statement: 'a',
          appliesWhen: 'x',
          evidenceIds: [],
        },
      ],
    })
    expect(validateCriticalCareDerivedValueGuides([unsourced])).toContainEqual(
      expect.stringContaining('evidenceIds must not be empty'),
    )
  })

  it('rejects a rule pointing at a reference that does not exist', () => {
    const dangling = guide({
      rules: [{ id: 'r', interval: { lte: 1 }, statement: 's', referenceIds: ['missing'] }],
    })
    expect(validateCriticalCareDerivedValueGuides([dangling])).toContainEqual(
      expect.stringContaining('unknown reference missing'),
    )
  })

  it('rejects malformed intervals', () => {
    const bothLowerBounds = guide({
      rules: [
        { id: 'r', interval: { gt: 1, gte: 2 }, statement: 's', referenceIds: ['test.reference'] },
      ],
    })
    expect(validateCriticalCareDerivedValueGuides([bothLowerBounds])).toContainEqual(
      expect.stringContaining('malformed interval'),
    )

    const inverted = guide({
      rules: [
        { id: 'r', interval: { gte: 9, lte: 1 }, statement: 's', referenceIds: ['test.reference'] },
      ],
    })
    expect(validateCriticalCareDerivedValueGuides([inverted])).toContainEqual(
      expect.stringContaining('malformed interval'),
    )

    const empty = guide({
      rules: [{ id: 'r', interval: {}, statement: 's', referenceIds: ['test.reference'] }],
    })
    expect(validateCriticalCareDerivedValueGuides([empty])).toContainEqual(
      expect.stringContaining('malformed interval'),
    )
  })

  it('treats boundary inclusivity deterministically', () => {
    expect(intervalContains({ lte: 1 }, 1)).toBe(true)
    expect(intervalContains({ lt: 1 }, 1)).toBe(false)
    expect(intervalContains({ gte: 1 }, 1)).toBe(true)
    expect(intervalContains({ gt: 1 }, 1)).toBe(false)
  })

  it('falls back to the interval-free rule when nothing else matches', () => {
    const withFallback = guide({
      rules: [
        { id: 'low', interval: { lte: 1 }, statement: 'low', referenceIds: ['test.reference'] },
        { id: 'rest', statement: 'anything else', referenceIds: ['test.reference'] },
      ],
    })
    expect(resolveInterpretation(withFallback, 99)?.rule.id).toBe('rest')
  })

  it('returns null rather than inventing an interpretation when no rule matches', () => {
    const noFallback = guide({
      rules: [
        { id: 'low', interval: { lte: 1 }, statement: 'low', referenceIds: ['test.reference'] },
      ],
    })
    expect(resolveInterpretation(noFallback, 99)).toBeNull()
  })
})

describe('MCS guide migration', () => {
  it('preserves the CPO formula and both cohort cut points', () => {
    expect(mcsDerivedValueGuides.cardiacPowerOutputW.formula).toBe(
      'MAP × effective systemic flow / 451',
    )
    expect(interpretMcsCardiacPowerOutput(0.52)).toContain('0.53')
    expect(interpretMcsCardiacPowerOutput(0.53)).toContain('0.53')
    expect(interpretMcsCardiacPowerOutput(0.55)).toContain('0.6')
    expect(interpretMcsCardiacPowerOutput(0.6)).toContain('0.6')
    expect(interpretMcsCardiacPowerOutput(0.9)).toContain('does not establish adequate perfusion')
  })

  it('preserves CPO boundary semantics exactly at each cut point', () => {
    expect(mcsCardiacPowerOutputReferenceIds(0.53)).toEqual(['mcs.cpo.original-cohort'])
    expect(mcsCardiacPowerOutputReferenceIds(0.6)).toEqual(['mcs.cpo.high-risk-teaching-band'])
    expect(mcsCardiacPowerOutputReferenceIds(0.61)).toEqual(['mcs.cpo.high-risk-teaching-band'])
  })

  it('preserves the PAPi formula and both cohort bands', () => {
    expect(mcsDerivedValueGuides.pulmonaryArteryPulsatilityIndex.formula).toBe(
      '(PASP − PADP) / RAP',
    )
    expect(interpretMcsPapi(0.89)).toContain('0.9')
    expect(interpretMcsPapi(0.9)).toContain('0.9')
    expect(interpretMcsPapi(1.2)).toContain('1.85')
    expect(interpretMcsPapi(1.85)).toContain('does not exclude RV dysfunction')
    expect(interpretMcsPapi(2.5)).toContain('does not exclude RV dysfunction')
  })

  it('preserves PAPi boundary semantics exactly at each band edge', () => {
    expect(mcsPapiReferenceIds(0.9)).toEqual(['mcs.papi.acute-rv-infarction-cohort'])
    expect(mcsPapiReferenceIds(1.84)).toEqual(['mcs.papi.advanced-heart-failure-band'])
    // 1.85 is the exclusive upper edge of the advanced-HF band, so it falls through.
    expect(mcsPapiReferenceIds(1.85)).toEqual(['mcs.papi.advanced-heart-failure-band'])
  })

  it('keeps the simulator PAPi boundary an educational-model boundary, not a clinical one', () => {
    expect(MCS_MODEL_BOUNDARIES.rvLimitedPapiMax).toBe(1.5)
    expect(MCS_MODEL_BOUNDARY_REFERENCES.rvLimitedPapiMax.kind).toBe('educational-model-boundary')
    expect(MCS_MODEL_BOUNDARY_REFERENCES.rvLimitedPapiMax.appliesWhen).toMatch(/simulation/i)
  })

  it('declares both cut-point references as cohort observations', () => {
    const kinds = mcsDerivedValueGuides.cardiacPowerOutputW.references.map(
      (reference) => reference.kind,
    )
    expect(kinds).toContain('cohort-observation')
    expect(kinds).not.toContain('guideline-recommendation')
  })
})

describe('Impella measurand clarification and textbook disagreement', () => {
  const clarification = criticalCareMeasurementClarificationById.get(
    'clarification.mcs.impella-cp-flow-measurands',
  )!
  const conflict = criticalCareSourceConflictById.get('conflict.mcs.impella-cp-textbook-flow')!

  it('files the three manufacturer figures as a clarification', () => {
    const values = clarification.quantities.map((quantity) => quantity.valueText)
    expect(values).toEqual(
      expect.arrayContaining(['3.7 L/min', 'Up to 4.3 L/min', '3.8 ± 0.6 L/min']),
    )
  })

  it('names a distinct measurand for each figure', () => {
    const measurands = clarification.quantities.map((quantity) => quantity.measurand)
    expect(new Set(measurands).size).toBe(clarification.quantities.length)
    for (const quantity of clarification.quantities) {
      expect(quantity.measurand.trim()).toBeTruthy()
      expect(quantity.evidenceIds.length).toBeGreaterThan(0)
    }
  })

  it('keeps only the two textbook figures in the disagreement', () => {
    expect(conflict.positions).toHaveLength(2)
    const claims = conflict.positions.map((position) => position.claim).join(' ')
    expect(claims).toContain('3.8')
    expect(claims).toContain('3.5')
    expect(claims).not.toContain('3.7')
    expect(claims).not.toContain('4.3')
  })

  it('prohibits averaging in its handling statement', () => {
    expect(conflict.handling).toMatch(/do not average/i)
  })

  it('is queryable by concept', () => {
    expect(
      measurementClarificationsForConcept('cc.measurement.measurand').map((item) => item.id),
    ).toContain(clarification.id)
  })
})

describe('source-conflict provenance', () => {
  it('keeps every conflict at two or more positions with source, locator and evidence', () => {
    for (const conflict of criticalCareSourceConflicts) {
      expect(conflict.positions.length).toBeGreaterThanOrEqual(2)
      for (const position of conflict.positions) {
        expect(position.source.trim()).toBeTruthy()
        expect(position.locator.trim()).toBeTruthy()
        expect(position.evidenceIds.length).toBeGreaterThan(0)
        for (const evidenceId of position.evidenceIds) {
          expect(criticalCareEvidenceById.has(evidenceId)).toBe(true)
        }
      }
    }
  })

  it('retains both anti-Xa ranges and both GEF formulas', () => {
    expect(
      criticalCareSourceConflictById.get('conflict.ecmo.anti-xa-target')?.positions,
    ).toHaveLength(2)
    expect(
      criticalCareSourceConflictById.get('conflict.hemodynamics.gef-formula')?.positions,
    ).toHaveLength(2)
  })
})

describe('shared evidence renderers', () => {
  it('exposes value, unit, value type and reference kind', () => {
    const { container } = render(
      <DerivedValueReadout guide={mcsDerivedValueGuides.cardiacPowerOutputW} value={0.5} />,
    )
    expect(container.querySelector('[data-live-value]')?.textContent).toContain('0.5')
    expect(container.querySelector('[data-live-value-type]')?.textContent).toContain('Derived')
    expect(container.querySelector('[data-reference-kind]')?.textContent).toMatch(/cohort/i)
    expect(container.querySelector('[data-do-not-infer]')?.textContent).toBeTruthy()
    assertNoUniversalTargetLanguage(container.textContent ?? '')
  })

  it('renders no interpretation block when a value resolves to nothing', () => {
    const { container } = render(
      <DerivedValueReadout guide={mcsDerivedValueGuides.cardiacPowerOutputW} value={null} />,
    )
    expect(container.querySelector('[data-interpretation-rule]')).toBeNull()
  })

  it('renders every clarified quantity with its measurand', () => {
    const { container } = render(
      <MeasurementClarification clarification={criticalCareMeasurementClarifications[0]} />,
    )
    assertEveryClarifiedQuantityRenders(container)
    expect(container.querySelector('[data-teaching-point]')?.textContent).toMatch(/measurand/i)
  })

  it('renders every authored conflict position with semantic grouping', () => {
    for (const conflict of criticalCareSourceConflicts) {
      const { container, unmount } = render(<HeldDisagreement conflict={conflict} />)
      assertEveryConflictPositionRenders(container)
      expect(container.querySelectorAll('li[data-conflict-position]').length).toBe(
        conflict.positions.length,
      )
      unmount()
    }
  })
})

describe('ECMO normal-state lessons', () => {
  it('no longer attach the anti-Xa disagreement, which is not what they teach', async () => {
    const { ecmoFoundationSectionById } =
      await import('@/features/cardiohelp-ecmo/content/foundationLessons')
    expect(ecmoFoundationSectionById.get('vv-normal-state')?.heldDisagreementId).toBeUndefined()
    expect(ecmoFoundationSectionById.get('va-normal-state')?.heldDisagreementId).toBeUndefined()
  })

  it('keeps the anti-Xa conflict registered for later anticoagulation content', () => {
    expect(criticalCareSourceConflictById.has('conflict.ecmo.anti-xa-target')).toBe(true)
  })
})
