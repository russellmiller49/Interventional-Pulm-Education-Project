/**
 * Numbers that look like they disagree but do not.
 *
 * A maximum *mean* flow, a peak *systolic* flow, and an *observed study average* are three answers
 * to three different questions. Filing them as competing positions in a source conflict says the
 * sources contradict each other, which is false and teaches the wrong lesson. The right lesson is
 * that a quantity is uninterpretable until its measurand and reporting condition are named — which
 * is the same claim the critical-care curriculum makes everywhere else about measured values.
 *
 * Genuine contradictions belong in `sourceConflicts.ts` and stay there, unaveraged.
 */
export interface CriticalCareClarifiedQuantity {
  /** The number as its source states it, units included. */
  readonly valueText: string
  /** What is being measured. This is the field that makes the quantities non-competing. */
  readonly measurand: string
  /** The condition under which it holds or was reported. */
  readonly condition?: string
  readonly source: string
  readonly locator: string
  readonly evidenceIds: readonly string[]
}

export interface CriticalCareMeasurementClarification {
  readonly id: string
  readonly title: string
  readonly context: string
  readonly quantities: readonly CriticalCareClarifiedQuantity[]
  /** What the learner should take away, rendered after the quantities. */
  readonly teachingPoint: string
  readonly conceptIds: readonly string[]
  readonly reviewStatus: 'draft' | 'sme-review' | 'released'
}

export const criticalCareMeasurementClarifications: readonly CriticalCareMeasurementClarification[] =
  Object.freeze([
    {
      id: 'clarification.mcs.impella-cp-flow-measurands',
      title: 'Impella CP flow figures name different measurands',
      context:
        'Several different flow numbers are published for the same pump. They are not competing answers to one question: current labeling reports a maximum mean flow and a peak systolic flow as separate quantities, and the supporting clinical evidence reports an observed average that is different again.',
      quantities: [
        {
          valueText: '3.7 L/min',
          measurand: 'Maximum mean flow',
          condition: 'Device specification for this revision',
          source:
            'Impella CP with SmartAssist Instructions for Use & Clinical Reference Manual (0048-9007 rev V, V11.1, United States only)',
          locator: 'Table 9.15 pump metrics, page 272; same figure in the narrative, page 26',
          evidenceIds: ['fda-impella-cp-labeling', 'jnj-impella-cp-current'],
        },
        {
          valueText: 'Up to 4.3 L/min',
          measurand: 'Peak flow rate at systole',
          condition: 'At performance level P-9; explicitly not a maximum mean flow',
          source:
            'Impella CP with SmartAssist Instructions for Use & Clinical Reference Manual (0048-9007 rev V)',
          locator: 'page 77',
          evidenceIds: ['fda-impella-cp-labeling'],
        },
        {
          valueText: '3.8 ± 0.6 L/min',
          measurand: 'Average flow observed during support',
          condition:
            'Reported in the supporting clinical evidence; an observation in a studied population, not a device specification',
          source:
            'Impella CP with SmartAssist Instructions for Use & Clinical Reference Manual (0048-9007 rev V)',
          locator: 'clinical evidence section, page 165',
          evidenceIds: ['fda-impella-cp-labeling'],
        },
      ],
      teachingPoint:
        '“Maximum flow” is uninterpretable until the measurand and the reporting condition are named. A mean, a peak, and an observed average describe the same pump doing different things, and none of the three substitutes for another.',
      conceptIds: [
        'cc.measurement.measurand',
        'cc.device.selected-vs-delivered-support',
        'cc.measurement.measured-estimated-inferred',
      ],
      reviewStatus: 'sme-review',
    },
  ])

export const criticalCareMeasurementClarificationById: ReadonlyMap<
  string,
  CriticalCareMeasurementClarification
> = new Map(
  criticalCareMeasurementClarifications.map((clarification) => [clarification.id, clarification]),
)

export function measurementClarificationsForConcept(
  conceptId: string,
): readonly CriticalCareMeasurementClarification[] {
  return criticalCareMeasurementClarifications.filter((clarification) =>
    clarification.conceptIds.includes(conceptId),
  )
}

export function validateCriticalCareMeasurementClarifications(
  clarifications: readonly CriticalCareMeasurementClarification[],
): readonly string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const clarification of clarifications) {
    if (seen.has(clarification.id)) errors.push(`duplicate clarification id: ${clarification.id}`)
    seen.add(clarification.id)
    if (clarification.quantities.length < 2) {
      errors.push(`${clarification.id}: a clarification needs at least two quantities to contrast`)
    }
    for (const quantity of clarification.quantities) {
      if (!quantity.measurand.trim()) {
        errors.push(`${clarification.id}: quantity "${quantity.valueText}" has no named measurand`)
      }
      if (quantity.evidenceIds.length === 0) {
        errors.push(`${clarification.id}: quantity "${quantity.valueText}" has no evidence ids`)
      }
      if (!quantity.locator.trim()) {
        errors.push(`${clarification.id}: quantity "${quantity.valueText}" has no locator`)
      }
    }
  }
  return errors
}

const clarificationErrors = validateCriticalCareMeasurementClarifications(
  criticalCareMeasurementClarifications,
)
if (clarificationErrors.length > 0) {
  throw new Error(
    `Invalid critical-care measurement clarifications:\n- ${clarificationErrors.join('\n- ')}`,
  )
}
