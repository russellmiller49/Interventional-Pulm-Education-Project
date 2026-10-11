/**
 * What the registered sources actually support for H4, and what they do not.
 *
 * This file exists because "the claim has a source id attached" and "the claim is supported by that
 * source" are different statements, and cardiac-output teaching is full of numbers where the
 * difference matters — three trials, ten percent agreement, ten milliliters of iced injectate, a
 * named oxygen-uptake estimating equation. Every one of those is widely taught, and none of them is
 * carried by the claim text of any record in this module's registry.
 *
 * Two separate audits live here.
 *
 * 1. `cardiacOutputSourceSupportsClaim` — the CRRT pattern (`crrtSourceSupportsClaim`) applied to
 *    this registry. A topic is mapped to a source only when that source's own registered
 *    `intendedUse` names it. The audit is over the registry's claim text, which is all this
 *    repository holds: no source document is distributed here, so no claim in this module has been
 *    checked against source text and a locator. Registry membership is what was verified, and this
 *    file says so rather than implying more.
 *
 * 2. `cardiacOutputAcquisitionParameters` — every exact number the section could show, classified as
 *    source-supported, device-or-protocol-specific, a simulation parameter, or unsupported. A number
 *    classified as anything other than source-supported has to carry its qualifier wherever a
 *    learner reads it, and a number classified `unsupported` is not shown at all.
 */

import { hemodynamicsSourceById } from './sources'
import { HEMODYNAMICS_NUMBERS, type HemodynamicsNumberId } from './teachingNumbers'

/* ------------------------------------------------------------------ *
 * Claim topics
 * ------------------------------------------------------------------ */

export const CARDIAC_OUTPUT_CLAIM_TOPICS = [
  /* Topics the registered records' own claim text does cover. */
  'thermodilution-measurement',
  'thermodilution-technical-validation',
  'thermodilution-interpretation-limits',
  'repeated-cardiac-output-measurement',
  'fick-versus-thermodilution-framing',
  'cardiac-output-trial-review-workflow',
  'educational-model-boundary',
  /**
   * Deliberately unmapped. No registered record's claim text names any of these, so a statement
   * needing one is a source gap by construction, and stays one until the source set is expanded and
   * an SME confirms the claim against a locator.
   */
  'oxygen-uptake-estimating-equation',
  'numeric-repeatability-criterion',
  'injectate-protocol-specification',
  'oxygen-content-constants',
  'method-performance-in-tricuspid-regurgitation',
  'method-performance-in-low-flow',
] as const

export type CardiacOutputClaimTopic = (typeof CARDIAC_OUTPUT_CLAIM_TOPICS)[number]

/**
 * Source id → the topics that record's own registered `intendedUse` covers.
 *
 * Each entry quotes the phrase from `sources.ts` it was read off, so the audit can be re-run by a
 * reviewer against the registry without reading this file's reasoning. An unmapped id supports
 * nothing, which is the safe default.
 */
const claimTopicsBySourceId: ReadonlyMap<string, readonly CardiacOutputClaimTopic[]> = new Map([
  // "Thermodilution, derived hemodynamics, interpretation limits, and technical validation."
  [
    'pac-derived-part-2-2021',
    [
      'thermodilution-measurement',
      'thermodilution-technical-validation',
      'thermodilution-interpretation-limits',
    ] as const,
  ],
  // "...direct-Fick versus thermodilution method framing, repeated CO measurement..."
  [
    'esc-ers-ph-2022',
    ['fick-versus-thermodilution-framing', 'repeated-cardiac-output-measurement'] as const,
  ],
  // "Generic workflow concepts from the 2019 instructions for use, such as zeroing, wedge capture,
  //  and cardiac-output trial review."
  ['monitor-workflow-supplied', ['cardiac-output-trial-review-workflow'] as const],
  // "Links ventricular loading, vascular resistance/compliance, volume, PEEP, and signal-system
  //  effects to coherent simulated trends." — the module's own model, and the only record whose
  //  claim covers a simulated quantity.
  ['icu-hemodynamics-model-v1', ['educational-model-boundary'] as const],
])

/** True only when the record resolves *and* its registered claim text covers the topic. */
export function cardiacOutputSourceSupportsClaim(
  sourceId: string,
  topic: CardiacOutputClaimTopic,
): boolean {
  if (!hemodynamicsSourceById.has(sourceId)) return false
  return (claimTopicsBySourceId.get(sourceId) ?? []).includes(topic)
}

/** Every registered record whose claim covers the topic. Empty means the source set has a gap. */
export function cardiacOutputSourcesSupportingClaim(
  topic: CardiacOutputClaimTopic,
): readonly string[] {
  return [...claimTopicsBySourceId]
    .filter(([, topics]) => topics.includes(topic))
    .map(([id]) => id)
    .sort()
}

/** The topics no registered record supports. These are the section's declared source gaps. */
export function cardiacOutputUnsupportedClaimTopics(): readonly CardiacOutputClaimTopic[] {
  return CARDIAC_OUTPUT_CLAIM_TOPICS.filter(
    (topic) => cardiacOutputSourcesSupportingClaim(topic).length === 0,
  )
}

/* ------------------------------------------------------------------ *
 * Verification depth — stated once, so no surface can overstate it
 * ------------------------------------------------------------------ */

export type CardiacOutputVerificationDepth =
  | 'registry-membership-only'
  | 'claim-text-audited'
  | 'source-text-and-locator-verified'

/** How far the source audit went. Project metadata; not rendered. */
export const CARDIAC_OUTPUT_VERIFICATION_DEPTH: CardiacOutputVerificationDepth =
  'claim-text-audited'

export const CARDIAC_OUTPUT_VERIFICATION_NOTE =
  'Source support was audited against each record’s registered description in the source registry.'

/* ------------------------------------------------------------------ *
 * Acquisition parameters — every exact number, classified
 * ------------------------------------------------------------------ */

export type CardiacOutputParameterProvenance =
  | 'source-supported'
  | 'device-or-protocol-specific'
  | 'simulation-parameter'
  | 'unsupported'

export const cardiacOutputParameterProvenanceLabels: Readonly<
  Record<CardiacOutputParameterProvenance, { readonly label: string; readonly detail: string }>
> = Object.freeze({
  'source-supported': {
    label: 'Sourced',
    detail: 'A cited source gives this value.',
  },
  'device-or-protocol-specific': {
    label: 'Device or protocol value',
    detail: 'Set on the monitor or by the unit; it must match what is delivered.',
  },
  'simulation-parameter': {
    label: 'Simulator setting',
    detail: 'How this simulator is configured.',
  },
  unsupported: {
    label: 'Not stated',
    detail: 'No value is given here.',
  },
})

export interface CardiacOutputAcquisitionParameter {
  readonly id: string
  readonly label: string
  /** Exactly what a learner sees, or null when the classification is `unsupported`. */
  readonly valueShown: string | null
  readonly provenance: CardiacOutputParameterProvenance
  readonly whyThisClassification: string
  /** What the learner is told beside the value. */
  readonly learnerFacingQualifier: string
  readonly claimTopic: CardiacOutputClaimTopic
  readonly evidenceIds: readonly string[]
  /** The numbers-register row that sources this value, when a registry record does not. */
  readonly numberId?: HemodynamicsNumberId
}

export const cardiacOutputAcquisitionParameters: readonly CardiacOutputAcquisitionParameter[] =
  Object.freeze([
    {
      id: 'minimum-accepted-trials',
      label: 'Trials summarized in a series',
      valueShown: '3',
      provenance: 'simulation-parameter',
      whyThisClassification: 'The series size this simulator uses.',
      learnerFacingQualifier:
        'Take at least three injections and average the ones that agree. Three is the usual minimum and may be too few.',
      claimTopic: 'repeated-cardiac-output-measurement',
      evidenceIds: ['esc-ers-ph-2022', 'icu-hemodynamics-model-v1'],
    },
    {
      id: 'maximum-trials',
      label: 'Most trials this series allows',
      valueShown: '6',
      provenance: 'simulation-parameter',
      whyThisClassification: 'A cap on the exercise.',
      learnerFacingQualifier: 'The simulator stops a series at six injections.',
      claimTopic: 'educational-model-boundary',
      evidenceIds: ['icu-hemodynamics-model-v1'],
    },
    {
      id: 'injectate-volume',
      label: 'Injectate volume',
      valueShown: '10 mL',
      provenance: 'device-or-protocol-specific',
      whyThisClassification: 'The volume must match the monitor’s computation constant.',
      learnerFacingQualifier: `Use ${HEMODYNAMICS_NUMBERS.value('injectate-volume')}: it gives the most reproducible result. Room-temperature injectate is also used. The volume you inject must match the monitor’s computation constant.`,
      claimTopic: 'injectate-protocol-specification',
      evidenceIds: ['monitor-workflow-supplied', 'icu-hemodynamics-model-v1'],
      numberId: 'injectate-volume',
    },
    {
      id: 'injectate-temperature',
      label: 'Injectate temperature',
      valueShown: '5 °C',
      provenance: 'device-or-protocol-specific',
      whyThisClassification: 'The temperature must match the monitor’s computation constant.',
      learnerFacingQualifier:
        'Iced injectate, 5 °C in this scenario. The temperature set on the monitor must match what you inject.',
      claimTopic: 'injectate-protocol-specification',
      evidenceIds: ['monitor-workflow-supplied', 'icu-hemodynamics-model-v1'],
    },
    {
      id: 'injection-duration-window',
      label: 'Injection-duration window outside which this model raises an alert',
      valueShown: '0.6 to 4 seconds',
      provenance: 'simulation-parameter',
      whyThisClassification: 'The bounds at which this simulator raises a technique alert.',
      learnerFacingQualifier:
        'Inject fast and smoothly. The simulator flags an injection outside 0.6 to 4 seconds in the technique record; it does not redraw the curve for a slow or interrupted bolus.',
      claimTopic: 'thermodilution-technical-validation',
      evidenceIds: ['icu-hemodynamics-model-v1'],
    },
    {
      id: 'respiratory-phase-requirement',
      label: 'Respiratory phase for injection',
      valueShown: 'End expiration',
      provenance: 'device-or-protocol-specific',
      whyThisClassification: 'Standard technique: the same phase for every injection.',
      learnerFacingQualifier:
        'Inject at the same point in the respiratory cycle every time: end expiration.',
      claimTopic: 'thermodilution-technical-validation',
      evidenceIds: ['icu-hemodynamics-model-v1'],
    },
    {
      id: 'numeric-repeatability-criterion',
      label: 'Agreement between injections',
      valueShown: HEMODYNAMICS_NUMBERS.value('thermodilution-spread'),
      provenance: 'source-supported',
      whyThisClassification: 'From the numbers register.',
      learnerFacingQualifier: `Accept a series when the injections are ${HEMODYNAMICS_NUMBERS.value('thermodilution-spread')}. The simulator shows the spread and leaves that call to you.`,
      claimTopic: 'numeric-repeatability-criterion',
      evidenceIds: ['esc-ers-ph-2022'],
      numberId: 'thermodilution-spread',
    },
    {
      id: 'oxygen-uptake-estimating-equation',
      label: 'Estimating equation for assumed oxygen uptake',
      valueShown: null,
      provenance: 'unsupported',
      whyThisClassification: 'No estimating equation is in the numbers register yet.',
      learnerFacingQualifier:
        'An assumed oxygen uptake is an estimate from body size, not a measurement. Each scenario states the figure it substitutes.',
      claimTopic: 'oxygen-uptake-estimating-equation',
      evidenceIds: ['icu-hemodynamics-model-v1'],
    },
    {
      id: 'hemoglobin-oxygen-binding-capacity',
      label: 'Oxygen carried per gram of hemoglobin',
      valueShown: '1.34 mL/g',
      provenance: 'simulation-parameter',
      whyThisClassification: 'The constant this simulator uses for oxygen content.',
      learnerFacingQualifier:
        'Oxygen content uses 1.34 mL of oxygen per gram of hemoglobin; published values differ slightly.',
      claimTopic: 'oxygen-content-constants',
      evidenceIds: ['icu-hemodynamics-model-v1'],
    },
    {
      id: 'dissolved-oxygen-coefficient',
      label: 'Oxygen dissolved per unit of partial pressure',
      valueShown: '0.003 mL/dL per mmHg',
      provenance: 'simulation-parameter',
      whyThisClassification: 'The constant this simulator uses for dissolved oxygen.',
      learnerFacingQualifier:
        'Dissolved oxygen adds 0.003 mL/dL per mmHg: a small term, applied to both contents or to neither.',
      claimTopic: 'oxygen-content-constants',
      evidenceIds: ['icu-hemodynamics-model-v1'],
    },
  ])

export const cardiacOutputAcquisitionParameterById: ReadonlyMap<
  string,
  CardiacOutputAcquisitionParameter
> = new Map(cardiacOutputAcquisitionParameters.map((parameter) => [parameter.id, parameter]))

export function requireCardiacOutputParameter(id: string): CardiacOutputAcquisitionParameter {
  const parameter = cardiacOutputAcquisitionParameterById.get(id)
  if (!parameter) throw new Error(`Unknown cardiac-output acquisition parameter: ${id}`)
  return parameter
}

/* ------------------------------------------------------------------ *
 * Open method-performance questions — preserved, not flattened
 * ------------------------------------------------------------------ */

export interface CardiacOutputOpenQuestion {
  readonly id: string
  readonly question: string
  readonly whyItIsOpen: string
  readonly whatThisModuleDoes: string
  readonly claimTopic: CardiacOutputClaimTopic
}

/** Method questions the literature has not settled, with what the simulator shows for each. */
export const cardiacOutputOpenMethodQuestions: readonly CardiacOutputOpenQuestion[] = Object.freeze(
  [
    {
      id: 'tricuspid-regurgitation-direction',
      question:
        'With significant tricuspid regurgitation, does thermodilution read systematically high or systematically low?',
      whyItIsOpen: 'Reports go both ways. What is agreed is that the number is unreliable.',
      whatThisModuleDoes:
        'Here the curve broadens and its decay may not return to baseline inside the recorded window. Look at what the trace settles to before you use the number.',
      claimTopic: 'method-performance-in-tricuspid-regurgitation',
    },
    {
      id: 'low-flow-direction',
      question: 'In low-output states, does thermodilution systematically over- or under-read?',
      whyItIsOpen:
        'The error depends on where the end of a long, low curve is taken, so no single direction is taught here.',
      whatThisModuleDoes:
        'Here low flow gives a prolonged, low-amplitude curve with an uncertain tail. Treat the tail as the uncertainty.',
      claimTopic: 'method-performance-in-low-flow',
    },
    {
      id: 'method-hierarchy',
      question: 'Which method should be believed when the two disagree?',
      whyItIsOpen: 'Neither is always right.',
      whatThisModuleDoes:
        'Decide from how each was acquired in this episode: curve quality for thermodilution, measured or assumed oxygen uptake and the sampling sites for Fick. Sometimes neither result stands.',
      claimTopic: 'fick-versus-thermodilution-framing',
    },
  ],
)

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

export function validateCardiacOutputSourceBoundaries(): void {
  for (const [sourceId] of claimTopicsBySourceId) {
    if (!hemodynamicsSourceById.has(sourceId)) {
      throw new Error(`Claim-topic map cites an unregistered source: ${sourceId}`)
    }
  }
  for (const parameter of cardiacOutputAcquisitionParameters) {
    if ((parameter.provenance === 'unsupported') !== (parameter.valueShown === null)) {
      throw new Error(
        `${parameter.id}: a value classified "unsupported" must show no number, and a value that shows a number must not be classified "unsupported".`,
      )
    }
    if (parameter.learnerFacingQualifier.trim().length < 30) {
      throw new Error(`${parameter.id} has no usable learner-facing qualifier.`)
    }
    if (parameter.provenance === 'source-supported' && parameter.numberId === undefined) {
      const supporting = parameter.evidenceIds.filter((id) =>
        cardiacOutputSourceSupportsClaim(id, parameter.claimTopic),
      )
      if (supporting.length === 0) {
        throw new Error(
          `${parameter.id} is classified source-supported, but no cited record’s claim covers ${parameter.claimTopic}.`,
        )
      }
    }
    for (const evidenceId of parameter.evidenceIds) {
      if (!hemodynamicsSourceById.has(evidenceId)) {
        throw new Error(`${parameter.id} cites unregistered evidence: ${evidenceId}`)
      }
    }
  }
  for (const question of cardiacOutputOpenMethodQuestions) {
    if (!CARDIAC_OUTPUT_CLAIM_TOPICS.includes(question.claimTopic)) {
      throw new Error(`${question.id} names an unknown claim topic.`)
    }
  }
}

validateCardiacOutputSourceBoundaries()
