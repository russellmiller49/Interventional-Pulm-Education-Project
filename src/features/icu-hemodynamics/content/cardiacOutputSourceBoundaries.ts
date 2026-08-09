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
  // "Generic workflow concepts such as zeroing, wedge capture, and cardiac-output trial review."
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

/**
 * How far the H4 audit actually went.
 *
 * `claim-text-audited` means the mapping above was made by reading each record's registered
 * `intendedUse` in `sources.ts`. It does not mean anyone opened the source document: none of the
 * files named in `suppliedFilename` is present in this repository or in the primary checkout, so
 * `source-text-and-locator-verified` is not claimed for any H4 statement.
 */
export const CARDIAC_OUTPUT_VERIFICATION_DEPTH: CardiacOutputVerificationDepth =
  'claim-text-audited'

export const CARDIAC_OUTPUT_VERIFICATION_NOTE =
  'Source support was audited against each record’s registered description in this module’s source registry. The underlying documents are not distributed in this repository, so no statement here has been checked against source text and a page locator. Sentence-level verification remains an open review item.'

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
    label: 'Source-supported',
    detail: 'A registered record’s own claim covers this value in this context.',
  },
  'device-or-protocol-specific': {
    label: 'Device or protocol value',
    detail:
      'This belongs to a particular monitor, catheter, or unit protocol. It is shown as this scenario’s configuration, not as a general rule.',
  },
  'simulation-parameter': {
    label: 'Simulation parameter',
    detail:
      'This is how this educational model is configured. It is not a clinical acceptance criterion.',
  },
  unsupported: {
    label: 'Not shown — source gap',
    detail:
      'No registered record supports a specific value here, so this module states no number and defers to local device and unit protocol.',
  },
})

export interface CardiacOutputAcquisitionParameter {
  readonly id: string
  readonly label: string
  /** Exactly what a learner sees, or null when the classification is `unsupported`. */
  readonly valueShown: string | null
  readonly provenance: CardiacOutputParameterProvenance
  readonly whyThisClassification: string
  /** The qualifier that must travel with the value wherever it is shown. */
  readonly learnerFacingQualifier: string
  readonly claimTopic: CardiacOutputClaimTopic
  readonly evidenceIds: readonly string[]
}

export const cardiacOutputAcquisitionParameters: readonly CardiacOutputAcquisitionParameter[] =
  Object.freeze([
    {
      id: 'minimum-accepted-trials',
      label: 'Trials summarized in a series',
      valueShown: '3',
      provenance: 'simulation-parameter',
      whyThisClassification:
        'The figure comes from this module’s own series configuration. The one registered record whose claim mentions repeated cardiac-output measurement does not state a count, so no number here is source-supported.',
      learnerFacingQualifier:
        'How many acquisitions a series should summarize is set by local device and unit protocol. Three is this simulation’s configuration.',
      claimTopic: 'repeated-cardiac-output-measurement',
      evidenceIds: ['esc-ers-ph-2022', 'icu-hemodynamics-model-v1'],
    },
    {
      id: 'maximum-trials',
      label: 'Most trials this series allows',
      valueShown: '6',
      provenance: 'simulation-parameter',
      whyThisClassification:
        'A bound on the modeled exercise so a learner cannot generate curves indefinitely. It carries no clinical meaning.',
      learnerFacingQualifier: 'A limit on this exercise, not a clinical rule.',
      claimTopic: 'educational-model-boundary',
      evidenceIds: ['icu-hemodynamics-model-v1'],
    },
    {
      id: 'injectate-volume',
      label: 'Injectate volume',
      valueShown: '10 mL',
      provenance: 'device-or-protocol-specific',
      whyThisClassification:
        'Injectate volume has to match the computation constant the monitor was set to, which is a device and protocol matter. It is shown as this scenario’s configured constant.',
      learnerFacingQualifier:
        'This scenario’s configured computation constant. What matters is that the delivered volume matches whatever the monitor was set to.',
      claimTopic: 'injectate-protocol-specification',
      evidenceIds: ['monitor-workflow-supplied', 'icu-hemodynamics-model-v1'],
    },
    {
      id: 'injectate-temperature',
      label: 'Injectate temperature',
      valueShown: '5 °C',
      provenance: 'device-or-protocol-specific',
      whyThisClassification:
        'Same reasoning as the volume: the entered temperature has to describe what was delivered, and the choice belongs to the device and the local protocol.',
      learnerFacingQualifier:
        'This scenario’s configured computation constant. What matters is that the delivered temperature matches whatever the monitor was set to.',
      claimTopic: 'injectate-protocol-specification',
      evidenceIds: ['monitor-workflow-supplied', 'icu-hemodynamics-model-v1'],
    },
    {
      id: 'injection-duration-window',
      label: 'Injection-duration window this model flags outside of',
      valueShown: '0.6 to 4 seconds',
      provenance: 'simulation-parameter',
      whyThisClassification:
        'These are the bounds at which this module’s own model raises a technique alert. No registered record’s claim states an injection-duration requirement.',
      learnerFacingQualifier:
        'The window this simulation flags outside of. The teaching claim is that a prolonged or interrupted bolus broadens the curve, not that a particular number of seconds is required.',
      claimTopic: 'thermodilution-technical-validation',
      evidenceIds: ['icu-hemodynamics-model-v1'],
    },
    {
      id: 'respiratory-phase-requirement',
      label: 'Required respiratory phase for injection',
      valueShown: null,
      provenance: 'unsupported',
      whyThisClassification:
        'No registered record’s claim names a required respiratory phase for indicator injection. This module teaches consistency between trials rather than asserting a specific phase.',
      learnerFacingQualifier:
        'Use the same point in the respiratory cycle for every trial. Which point, and whether the unit standardizes one, is a local protocol matter.',
      claimTopic: 'thermodilution-technical-validation',
      evidenceIds: ['icu-hemodynamics-model-v1'],
    },
    {
      id: 'numeric-repeatability-criterion',
      label: 'Numeric agreement criterion between trials',
      valueShown: null,
      provenance: 'unsupported',
      whyThisClassification:
        'The widely quoted agreement criterion is not carried by any registered record’s claim, so this module states none. Spread is shown and described; it is not compared against an authored cut point.',
      learnerFacingQualifier:
        'This module shows the spread across accepted trials and does not apply a numeric agreement criterion. The acceptance criterion is set by local device and unit protocol.',
      claimTopic: 'numeric-repeatability-criterion',
      evidenceIds: ['esc-ers-ph-2022'],
    },
    {
      id: 'oxygen-uptake-estimating-equation',
      label: 'Estimating equation for assumed oxygen uptake',
      valueShown: null,
      provenance: 'unsupported',
      whyThisClassification:
        'No registered record’s claim names an oxygen-uptake estimating equation or the population one was derived from, so this module names no equation and quotes no coefficient.',
      learnerFacingQualifier:
        'This module does not name an estimating equation. Each scenario carries an authored substituted figure, labeled as an assumption, so that the effect of substituting a value can be shown without asserting which published value to substitute.',
      claimTopic: 'oxygen-uptake-estimating-equation',
      evidenceIds: ['icu-hemodynamics-model-v1'],
    },
    {
      id: 'hemoglobin-oxygen-binding-capacity',
      label: 'Oxygen carried per gram of hemoglobin',
      valueShown: '1.34 mL/g',
      provenance: 'simulation-parameter',
      whyThisClassification:
        'A constant this model needs in order to compute an oxygen content at all. No registered record’s claim covers it, and published values differ slightly, so it is labeled a model constant wherever it appears.',
      learnerFacingQualifier:
        'A model constant. Published values differ slightly, and the difference between them is far smaller than the sampling and assumption effects this section is about.',
      claimTopic: 'oxygen-content-constants',
      evidenceIds: ['icu-hemodynamics-model-v1'],
    },
    {
      id: 'dissolved-oxygen-coefficient',
      label: 'Oxygen dissolved per unit of partial pressure',
      valueShown: '0.003 mL/dL per mmHg',
      provenance: 'simulation-parameter',
      whyThisClassification:
        'Same reasoning as the binding capacity: needed to compute a content, not carried by any registered record’s claim.',
      learnerFacingQualifier:
        'A model constant, used only when a scenario supplies partial pressures. It contributes a small amount to each content and must be applied to both or to neither.',
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

/**
 * Questions this module refuses to answer, and says so.
 *
 * The shared critical-care registry (`criticalCareSourceConflicts`) holds disagreements between two
 * source positions that are both quotable. These are a weaker but equally important thing: places
 * where a directional claim is commonly taught and *no* registered record here carries it. Writing
 * a direction anyway would be inventing a finding; leaving the topic out entirely would let a
 * learner assume the module had checked. So the question stays visible with its status attached.
 */
export const cardiacOutputOpenMethodQuestions: readonly CardiacOutputOpenQuestion[] = Object.freeze(
  [
    {
      id: 'tricuspid-regurgitation-direction',
      question:
        'With significant tricuspid regurgitation, does thermodilution read systematically high or systematically low?',
      whyItIsOpen:
        'No registered record in this module carries a claim about the direction of that effect, and a direction is commonly asserted both ways.',
      /**
       * This sentence used to say "a broadened curve with a secondary disturbance", which the model
       * does not produce: at the modeled severity the trace broadens and its decay runs past the end
       * of the recording, and the derived curve features report no secondary excursion. A learner
       * was being told to look for something that is not on the trace.
       */
      whatThisModuleDoes:
        'This model represents significant tricuspid regurgitation as a broadened curve whose decay may not return toward baseline inside the recorded window. It states no direction of bias. The learner is asked to notice what the trace does and does not settle to, not to apply a correction.',
      claimTopic: 'method-performance-in-tricuspid-regurgitation',
    },
    {
      id: 'low-flow-direction',
      question: 'In low-output states, does thermodilution systematically over- or under-read?',
      whyItIsOpen:
        'No registered record here carries a directional claim, and the effect is entangled with how the end of a long, low curve is identified.',
      whatThisModuleDoes:
        'Represents low flow as a prolonged, low-amplitude curve with a less certain boundary, and asks the learner to treat the boundary as the uncertainty rather than assuming a direction.',
      claimTopic: 'method-performance-in-low-flow',
    },
    {
      id: 'method-hierarchy',
      question: 'Which method should be believed when the two disagree?',
      whyItIsOpen:
        'The one registered record whose claim covers method framing describes the two methods; it does not rank them, and neither does anything else in this registry.',
      whatThisModuleDoes:
        'Refuses a universal ranking. Each scenario is decided on the acquisition evidence in that specific measurement episode, and a scenario may end with neither result being defensible.',
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
    if (parameter.provenance === 'source-supported') {
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
