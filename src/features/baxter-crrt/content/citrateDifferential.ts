/** Publication-supported physiology and explicitly scoped circuit topology.
 * Stable term/category identities are retained; protocol-dependent decisions remain unavailable.
 */
import { crrtCitrateCalciumTermById, type CrrtCitrateCalciumTerm } from './circuitModel'
import {
  crrtSourceSupportsClaim,
  unresolvableCrrtSourceIds,
  type CrrtClaimTopic,
} from './learnerSourceMap'

/* ------------------------------------------------------------------ *
 * The mechanism walk
 * ------------------------------------------------------------------ */

export interface CrrtCitrateMechanismStep {
  readonly ordinal: number
  /** The already-authored term this step is a presentation of. Never a second definition. */
  readonly termId: string
  /** What the learner should be able to trace on the circuit at this point. */
  readonly traceOnTheCircuit: string
  readonly nodeId: import('./circuitModel').CrrtCircuitNodeId
}

/**
 * The order the mechanism is walked in: into the circuit, what it does there, where the bound
 * calcium goes, what comes back to the patient, and how the patient is supported — then the two
 * sampling domains, which are the point of the whole walk.
 */
export const crrtCitrateMechanismSteps: readonly CrrtCitrateMechanismStep[] = [
  {
    termId: 'citrate-entry-point',
    nodeId: 'pbp-citrate-entry',
    traceOnTheCircuit: 'Locate the entry before the pump.',
  },
  {
    termId: 'circuit-anticoagulation',
    nodeId: 'filter',
    traceOnTheCircuit: 'Follow blood through the filter.',
  },
  {
    termId: 'citrate-calcium-in-effluent',
    nodeId: 'effluent-scale',
    traceOnTheCircuit: 'Follow fluid across the membrane to effluent.',
  },
  {
    termId: 'blood-returns-to-patient',
    nodeId: 'return-lumen',
    traceOnTheCircuit: 'Follow the return limb to the patient.',
  },
  {
    termId: 'systemic-metabolism',
    nodeId: 'patient',
    traceOnTheCircuit: 'Locate the patient beyond the return limb.',
  },
  {
    termId: 'calcium-replacement',
    nodeId: 'calcium-source',
    traceOnTheCircuit: 'Trace the separate calcium line drawn in this configuration.',
  },
  {
    termId: 'circuit-sample',
    nodeId: 'circuit-sampling-domain',
    traceOnTheCircuit: 'Select the post-filter sampling domain.',
  },
  {
    termId: 'systemic-sample',
    nodeId: 'systemic-sampling-domain',
    traceOnTheCircuit: 'Select the systemic sampling domain.',
  },
].map((step, index) =>
  Object.freeze({ ...step, ordinal: index + 1 }),
) as readonly CrrtCitrateMechanismStep[]

export interface CrrtCitrateMechanismStepView extends CrrtCitrateMechanismStep {
  readonly term: CrrtCitrateCalciumTerm
}

/** Resolves each step against the single authored term registry, failing closed. */
export function crrtCitrateMechanismWalk(): readonly CrrtCitrateMechanismStepView[] {
  return Object.freeze(
    crrtCitrateMechanismSteps.map((step) => {
      const term = crrtCitrateCalciumTermById.get(step.termId)
      if (!term) {
        throw new Error(
          `The citrate mechanism walk names ${step.termId}, which is not an authored citrate term.`,
        )
      }
      return Object.freeze({ ...step, term })
    }),
  )
}

export const CRRT_CITRATE_MECHANISM_HEADLINE =
  'Circuit anticoagulation and patient calcium balance are different questions. Follow citrate through the circuit, then consider the patient’s metabolism.' as const

/* ------------------------------------------------------------------ *
 * The four-way comparison
 * ------------------------------------------------------------------ */

export const CRRT_CITRATE_DIFFERENTIAL_IDS = [
  'insufficient-citrate-effect',
  'inadequate-calcium-replacement',
  'citrate-accumulation',
  'citrate-related-alkalosis',
] as const

export type CrrtCitrateDifferentialId = (typeof CRRT_CITRATE_DIFFERENTIAL_IDS)[number]

/** Which compartment a category is a question about. This is the axis that separates them. */
export type CrrtSamplingDomain = 'circuit' | 'systemic' | 'both-compared'

/**
 * Every field states whether it is topology, publication-supported physiology or unresolved.
 */
export type CrrtCitrateFieldSupport = 'topology' | 'clinical-publication' | 'held-open'

export interface CrrtCitrateField {
  readonly support: CrrtCitrateFieldSupport
  readonly statement: string
  readonly sourceIds?: readonly string[]
  readonly topic?: CrrtClaimTopic
}

export interface CrrtCitrateDifferentialCategory {
  readonly id: CrrtCitrateDifferentialId
  readonly ordinal: number
  readonly name: string
  /** A one-line contrast with the neighbouring category most often confused with it. */
  readonly notToBeConfusedWith: string
  readonly clinicalQuestion: string
  readonly samplingDomain: CrrtSamplingDomain
  readonly samplingDomainWhy: string
  readonly circuitBehaviour: CrrtCitrateField
  readonly systemicCalciumContext: CrrtCitrateField
  readonly acidBaseContext: CrrtCitrateField
  readonly whatFindingsMaySupport: CrrtCitrateField
  readonly whatOneFindingCannotEstablish: string
  readonly firstVerificationBoundary: string
  readonly sourceIds: readonly string[]
}

const MECHANISM = 'CITRATE-SIAARTI-2023-MECHANISM'
const SAMPLING = 'CITRATE-SIAARTI-2023-SAMPLING'
const METABOLISM = 'CITRATE-SCHNEIDER-2017-METABOLISM'
const PATTERNS = 'CITRATE-SCHNEIDER-2017-PATTERNS'
const SAFETY = 'CITRATE-ICU-GUIDE-2026-SAFETY'
const publication = (
  statement: string,
  topic: CrrtClaimTopic,
  ...sourceIds: string[]
): CrrtCitrateField => {
  if (!sourceIds.length || sourceIds.some((id) => !crrtSourceSupportsClaim(id, topic)))
    throw new Error(`Unsupported citrate field: ${topic}`)
  return Object.freeze({ support: 'clinical-publication', statement, topic, sourceIds })
}
const open = (statement: string): CrrtCitrateField => ({ support: 'held-open', statement })
const VERIFICATION_BOUNDARY =
  'Verify sampling site, timing and actual infusions with the responsible clinical team and authorised local protocol. This module carries no quantity, no target, and no adjustment.'

export const crrtCitrateDifferentialCategories: readonly CrrtCitrateDifferentialCategory[] = [
  {
    id: 'insufficient-citrate-effect',
    ordinal: 1,
    name: 'Insufficient citrate effect in the circuit',
    notToBeConfusedWith:
      'Not the same as inadequate calcium replacement or insufficient systemic buffer delivery.',
    clinicalQuestion: 'Is anticoagulant effect adequate within the circuit?',
    samplingDomain: 'circuit',
    samplingDomainWhy:
      'Post-filter ionized calcium describes circuit effect; a systemic sample cannot replace it.',
    circuitBehaviour: publication(
      'Insufficient calcium chelation can leave the circuit inadequately anticoagulated.',
      'citrate-calcium-binding',
      MECHANISM,
    ),
    systemicCalciumContext: publication(
      'Patient calcium support is assessed separately with systemic ionized calcium.',
      'citrate-sampling',
      SAMPLING,
    ),
    acidBaseContext: open('Acid-base status alone cannot determine circuit anticoagulant effect.'),
    whatFindingsMaySupport: publication(
      'Interpret the post-filter sample with verified citrate delivery and circuit behavior.',
      'citrate-sampling',
      SAMPLING,
    ),
    whatOneFindingCannotEstablish:
      'Clotting or a pressure change alone does not establish citrate under-delivery; inspect mechanical and delivery causes.',
    firstVerificationBoundary: VERIFICATION_BOUNDARY,
    sourceIds: [MECHANISM, SAMPLING, PATTERNS, 'SYNTH-LAB-CITRATE-001'],
  },
  {
    id: 'inadequate-calcium-replacement',
    ordinal: 2,
    name: 'Inadequate calcium replacement to the patient',
    notToBeConfusedWith:
      'Low systemic ionized calcium has several causes; it is not itself a diagnosis of accumulation.',
    clinicalQuestion: 'Is calcium replacement reaching the patient?',
    samplingDomain: 'systemic',
    samplingDomainWhy:
      'This schematic uses a separate patient infusion; the approved connection varies by protocol.',
    circuitBehaviour: publication(
      'A satisfactory circuit sample does not establish patient calcium safety.',
      'citrate-sampling',
      SAMPLING,
    ),
    systemicCalciumContext: publication(
      'Calcium lost during RCA requires replacement to maintain patient calcium balance.',
      'citrate-sampling',
      SAMPLING,
    ),
    acidBaseContext: open(
      'No single acid-base pattern identifies an interrupted calcium infusion.',
    ),
    whatFindingsMaySupport: publication(
      'Read systemic ionized calcium alongside actual calcium delivery.',
      'citrate-sampling',
      SAMPLING,
    ),
    whatOneFindingCannotEstablish:
      'One low systemic value does not distinguish interrupted replacement from impaired citrate metabolism or another cause.',
    firstVerificationBoundary: VERIFICATION_BOUNDARY,
    sourceIds: [SAMPLING, METABOLISM, SAFETY, 'SYNTH-LAB-CITRATE-001'],
  },
  {
    id: 'citrate-accumulation',
    ordinal: 3,
    name: 'Citrate accumulation in the patient',
    notToBeConfusedWith:
      'Accumulation and citrate-associated alkalosis must not be merged: metabolism is impaired in accumulation.',
    clinicalQuestion: 'Is returned citrate exceeding the patient’s capacity to metabolize it?',
    samplingDomain: 'both-compared',
    samplingDomainWhy:
      'Circuit effect and systemic safety remain separate; systemic trends address accumulation.',
    circuitBehaviour: publication(
      'Citrate not removed in effluent returns to the patient for metabolism.',
      'citrate-metabolism',
      METABOLISM,
    ),
    systemicCalciumContext: publication(
      'A rising systemic total/ionized calcium ratio and increasing calcium needs raise concern.',
      'citrate-metabolic-patterns',
      PATTERNS,
      SAFETY,
    ),
    acidBaseContext: publication(
      'Worsening metabolic acidosis may accompany impaired metabolism; shock and other causes also matter.',
      'citrate-metabolic-patterns',
      PATTERNS,
      SAFETY,
    ),
    whatFindingsMaySupport: publication(
      'Concern rests on linked trends and clinical context, including perfusion and lactate trajectory.',
      'citrate-metabolic-patterns',
      SAFETY,
    ),
    whatOneFindingCannotEstablish:
      'A single calcium result, ratio or acid-base value is insufficient for the diagnosis.',
    firstVerificationBoundary: VERIFICATION_BOUNDARY,
    sourceIds: [METABOLISM, PATTERNS, SAFETY, 'SYNTH-LAB-CITRATE-001'],
  },
  {
    id: 'citrate-related-alkalosis',
    ordinal: 4,
    name: 'Citrate-related metabolic alkalosis',
    notToBeConfusedWith: 'Not a synonym for citrate accumulation and not a stage of it.',
    clinicalQuestion: 'Is the net alkali load contributing to alkalosis?',
    samplingDomain: 'systemic',
    samplingDomainWhy: 'Assess the patient’s acid-base trajectory and complete fluid prescription.',
    circuitBehaviour: publication(
      'Citrate return, removal and fluid composition contribute to systemic acid-base balance.',
      'citrate-metabolism',
      METABOLISM,
    ),
    systemicCalciumContext: publication(
      'With net citrate overload, calcium indices can remain stable because metabolism is preserved.',
      'citrate-metabolic-patterns',
      PATTERNS,
    ),
    acidBaseContext: publication(
      'Metabolized citrate can contribute excess alkali; the overall solution balance matters.',
      'citrate-metabolism',
      METABOLISM,
    ),
    whatFindingsMaySupport: publication(
      'Alkalosis with preserved calcium handling suggests net alkali excess rather than accumulation.',
      'citrate-metabolic-patterns',
      PATTERNS,
    ),
    whatOneFindingCannotEstablish:
      'Alkalosis alone cannot attribute the cause to citrate; other patient and treatment factors need review.',
    firstVerificationBoundary: VERIFICATION_BOUNDARY,
    sourceIds: [METABOLISM, PATTERNS, 'SYNTH-LAB-CITRATE-001'],
  },
]

export const crrtCitrateDifferentialById: ReadonlyMap<
  CrrtCitrateDifferentialId,
  CrrtCitrateDifferentialCategory
> = new Map(crrtCitrateDifferentialCategories.map((category) => [category.id, category]))

if (
  crrtCitrateDifferentialCategories.map((category) => category.id).join('|') !==
  CRRT_CITRATE_DIFFERENTIAL_IDS.join('|')
) {
  throw new Error('The CRRT citrate comparison must carry all four categories exactly once.')
}

/** Every field of one category, in render order, so the table and the tests read the same list. */
export interface CrrtCitrateComparisonRow {
  readonly id: string
  readonly label: string
  readonly read: (category: CrrtCitrateDifferentialCategory) => CrrtCitrateField
}

export const crrtCitrateComparisonRows: readonly CrrtCitrateComparisonRow[] = Object.freeze([
  Object.freeze({
    id: 'circuit-behaviour',
    label: 'What this says about the circuit',
    read: (category: CrrtCitrateDifferentialCategory) => category.circuitBehaviour,
  }),
  Object.freeze({
    id: 'systemic-calcium',
    label: 'What this says about patient calcium',
    read: (category: CrrtCitrateDifferentialCategory) => category.systemicCalciumContext,
  }),
  Object.freeze({
    id: 'acid-base',
    label: 'What this says about acid–base',
    read: (category: CrrtCitrateDifferentialCategory) => category.acidBaseContext,
  }),
  Object.freeze({
    id: 'may-support',
    label: 'What the available findings may support',
    read: (category: CrrtCitrateDifferentialCategory) => category.whatFindingsMaySupport,
  }),
])

export const CRRT_CITRATE_HELD_OPEN_NOTICE =
  'Clinical-publication support is labeled separately from this schematic. An open question cannot be resolved from that finding alone. Human clinical review remains pending.' as const

export const CRRT_CITRATE_SCOPE_NOTICE =
  'Conceptual teaching, not a bedside algorithm. Dosing, solution selection, sampling schedules and restart decisions require a reviewed local protocol; none is supplied here.' as const

/* ------------------------------------------------------------------ *
 * Provenance closure
 * ------------------------------------------------------------------ */

/** Every citation must resolve in the merged learner-facing registry, or this throws at import. */
export function unresolvedCrrtCitrateSourceIds(): readonly string[] {
  const cited = new Set<string>()
  for (const category of crrtCitrateDifferentialCategories) {
    for (const id of category.sourceIds) cited.add(id)
  }
  for (const step of crrtCitrateMechanismWalk()) {
    for (const id of step.term.claimSupport.supportingSourceIds) cited.add(id)
  }
  return unresolvableCrrtSourceIds(cited)
}

const unresolvedAtImport = unresolvedCrrtCitrateSourceIds()
if (unresolvedAtImport.length > 0) {
  throw new Error(
    `CRRT citrate teaching cites source records that do not exist: ${unresolvedAtImport.join(', ')}`,
  )
}
