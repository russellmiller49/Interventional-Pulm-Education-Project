/**
 * Citrate: the transferable mechanism, and the four-way comparison built on top of it.
 *
 * C3 asks for two things. The first is a mechanism a learner can carry to any protocol: citrate
 * enters before the filter, the circuit and the patient are two sampling domains that answer
 * different questions, citrate-calcium complexes can leave in the effluent, blood still returns to
 * the patient, and calcium replacement supports the patient rather than the circuit. All five of
 * those already exist as `crrtCitrateCalciumTerms` in `circuitModel.ts`, authored and cited during
 * C0/C1. This file does not restate them — it orders them into a walk and points at them by id, so
 * there is exactly one citrate definition in the module.
 *
 * The second is a comparison that keeps four things apart which are routinely collapsed:
 * insufficient citrate effect, inadequate calcium replacement, citrate accumulation, and
 * citrate-related alkalosis. The last two are the pair most often merged, and they are not the
 * same: one is a question about how much citrate the patient is handling, the other is a question
 * about what the acid–base picture is doing. They are kept separate here structurally, not by
 * assertion.
 *
 * ## The source boundary, stated once and enforced per field
 *
 * The registered CRRT source set carries no recorded claim about citrate metabolism. The three
 * clinical-context records this module cites for citrate — `TEXT-CRRT-NEYRA-2026`,
 * `REVIEW-CKRT-CORE-2025`, `GUID-RRT-ICU-2026` — carry framing, mechanism-concept, and
 * prescribed-versus-delivered claims; none of them states what citrate is metabolised to, what
 * accumulation is, or how alkalosis arises. `SYNTH-LAB-CITRATE-001` records that limit.
 *
 * So every field below is one of two kinds, and the type makes a reader say which:
 *
 * - `topology` — follows from the circuit this module already teaches: where a fluid enters, which
 *   compartment a sample describes, what a circuit-directed effect can and cannot reach. These are
 *   safe to state, because the module authored and cited the circuit itself.
 * - `held-open` — would require a physiologic account the registered sources do not give. These
 *   are rendered as an open question the learner takes to the local protocol and the responsible
 *   clinical team. They are never filled in from general knowledge.
 *
 * Nothing here carries a dose, a calcium quantity, a ratio, a target, a titration schedule, a
 * sampling frequency, an alarm limit, or an institution-specific instruction. A test enumerates
 * that prohibition over every rendered string rather than trusting this comment.
 */

import { crrtCitrateCalciumTermById, type CrrtCitrateCalciumTerm } from './circuitModel'
import { unresolvableCrrtSourceIds } from './learnerSourceMap'

/* ------------------------------------------------------------------ *
 * The mechanism walk
 * ------------------------------------------------------------------ */

export interface CrrtCitrateMechanismStep {
  readonly ordinal: number
  /** The already-authored term this step is a presentation of. Never a second definition. */
  readonly termId: string
  /** What the learner should be able to trace on the circuit at this point. */
  readonly traceOnTheCircuit: string
}

/**
 * The order the mechanism is walked in: into the circuit, what it does there, where the bound
 * calcium goes, what comes back to the patient, and how the patient is supported — then the two
 * sampling domains, which are the point of the whole walk.
 */
export const crrtCitrateMechanismSteps: readonly CrrtCitrateMechanismStep[] = Object.freeze([
  Object.freeze({
    ordinal: 1,
    termId: 'citrate-entry-point',
    traceOnTheCircuit:
      'Start at the pre-blood-pump entry on the access line. Everything downstream of it is inside the circuit.',
  }),
  Object.freeze({
    ordinal: 2,
    termId: 'circuit-anticoagulation',
    traceOnTheCircuit:
      'Follow the blood from that entry through the pump and into the filter. This stretch is where the intended effect happens, and it is all outside the patient.',
  }),
  Object.freeze({
    ordinal: 3,
    termId: 'citrate-calcium-in-effluent',
    traceOnTheCircuit:
      'Turn at the membrane and follow the fluid side out through the effluent line. Some of what citrate bound leaves the circuit this way.',
  }),
  Object.freeze({
    ordinal: 4,
    termId: 'blood-returns-to-patient',
    traceOnTheCircuit:
      'Go back to the blood path and follow it out of the filter, along the return line, and through the return lumen. The two compartments are connected, not sealed off.',
  }),
  Object.freeze({
    ordinal: 5,
    termId: 'calcium-replacement',
    traceOnTheCircuit:
      'Now find the separate calcium line running straight to the patient. It never touches the circuit, which is why it is judged against the patient rather than against the filter.',
  }),
  Object.freeze({
    ordinal: 6,
    termId: 'circuit-sample',
    traceOnTheCircuit:
      'Put a finger on the circuit sampling point after the filter. Anything drawn here describes the circuit.',
  }),
  Object.freeze({
    ordinal: 7,
    termId: 'systemic-sample',
    traceOnTheCircuit:
      'Now put a finger on the patient. Anything drawn here describes the patient. Neither finger can answer the other one’s question.',
  }),
])

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
  'One value, drawn from one compartment, cannot stand in for the other. Everything else about citrate follows from where it enters and which side of the membrane a sample came from.' as const

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
 * A statement that either follows from the circuit this module teaches, or does not follow from
 * anything the registered sources say. There is no third kind, and no field may be left implicit.
 */
export type CrrtCitrateFieldSupport = 'topology' | 'held-open'

export interface CrrtCitrateField {
  readonly support: CrrtCitrateFieldSupport
  readonly statement: string
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

const CITRATE_CONTEXT_SOURCE_IDS = Object.freeze([
  'REVIEW-CKRT-CORE-2025',
  'TEXT-CRRT-NEYRA-2026',
  'GUID-RRT-ICU-2026',
  'SYNTH-LAB-CITRATE-001',
])

/**
 * The single escalation boundary, phrased once. Every category ends here because every category
 * ends in the same place: confirm the result is real, say which compartment it describes, and hand
 * the decision to the people and the protocol authorised to make it.
 */
const VERIFICATION_BOUNDARY =
  'Confirm the result is real and say which compartment it came from before it means anything. Then hand it to the responsible clinical team and the authorised local protocol — this module carries no quantity, no target, and no adjustment.'

export const crrtCitrateDifferentialCategories: readonly CrrtCitrateDifferentialCategory[] =
  Object.freeze([
    Object.freeze({
      id: 'insufficient-citrate-effect' as const,
      ordinal: 1,
      name: 'Insufficient citrate effect in the circuit',
      notToBeConfusedWith:
        'Not the same as inadequate calcium replacement: this one is a question about the circuit, and that one is a question about the patient.',
      clinicalQuestion: 'Is the circuit getting the protection it was meant to get?',
      samplingDomain: 'circuit' as const,
      samplingDomainWhy:
        'The intended effect is on blood travelling through the circuit, so the circuit sample is the one that describes it.',
      circuitBehaviour: Object.freeze({
        support: 'topology' as const,
        statement:
          'The circuit is the compartment at issue. Citrate enters before the pump and acts on blood between that entry and the return lumen, so anything about how well the circuit is protected is asked and answered inside that stretch.',
      }),
      systemicCalciumContext: Object.freeze({
        support: 'topology' as const,
        statement:
          'A patient sample does not answer this question. It describes a compartment the circuit-directed effect was never aimed at, and reading it as if it did swaps one compartment for the other.',
      }),
      acidBaseContext: Object.freeze({
        support: 'held-open' as const,
        statement:
          'Whether and how the acid–base picture moves in this category is not established by the sources registered for this module. Take that question to the local protocol rather than inferring it here.',
      }),
      whatFindingsMaySupport: Object.freeze({
        support: 'topology' as const,
        statement:
          'A circuit sample together with how the circuit is actually behaving can support a statement about circuit protection. Delivery has to be part of that: whether citrate reached the circuit at all is a different question from whether enough of it was prescribed.',
      }),
      whatOneFindingCannotEstablish:
        'One circuit result cannot establish that the patient is in any particular state, and it cannot by itself separate an under-delivery from a circuit that is failing for another reason entirely — a clotting filter, an access problem, or a run that has simply been interrupted.',
      firstVerificationBoundary: VERIFICATION_BOUNDARY,
      sourceIds: CITRATE_CONTEXT_SOURCE_IDS,
    }),
    Object.freeze({
      id: 'inadequate-calcium-replacement' as const,
      ordinal: 2,
      name: 'Inadequate calcium replacement to the patient',
      notToBeConfusedWith:
        'Not the same as citrate accumulation: this one asks whether enough calcium is reaching the patient, and that one asks what the patient is doing with the citrate load.',
      clinicalQuestion: 'Is the patient being supported for what the circuit is taking away?',
      samplingDomain: 'systemic' as const,
      samplingDomainWhy:
        'Calcium replacement runs to the patient on its own line and never enters the circuit, so it is judged against a patient sample.',
      circuitBehaviour: Object.freeze({
        support: 'topology' as const,
        statement:
          'The circuit is not the compartment at issue. Calcium replacement is outside the extracorporeal path entirely, so a circuit sample describes something else.',
      }),
      systemicCalciumContext: Object.freeze({
        support: 'topology' as const,
        statement:
          'This is the compartment the question is about. Citrate-calcium complexes leave the circuit in the effluent, which is why calcium has to be given back somewhere, and the patient is where it is given back.',
      }),
      acidBaseContext: Object.freeze({
        support: 'held-open' as const,
        statement:
          'Whether the acid–base picture helps distinguish this category is not established by the sources registered for this module.',
      }),
      whatFindingsMaySupport: Object.freeze({
        support: 'topology' as const,
        statement:
          'A patient sample together with confirmation that the replacement infusion is actually running and reaching the patient can support a statement about patient-side support. A prescribed infusion that is not running is a different problem from one that is running and not enough.',
      }),
      whatOneFindingCannotEstablish:
        'A single patient-side result cannot say whether the cause is on the replacement side or the citrate side, and it cannot be read back as a statement about how well the circuit is protected.',
      firstVerificationBoundary: VERIFICATION_BOUNDARY,
      sourceIds: CITRATE_CONTEXT_SOURCE_IDS,
    }),
    Object.freeze({
      id: 'citrate-accumulation' as const,
      ordinal: 3,
      name: 'Citrate accumulation in the patient',
      notToBeConfusedWith:
        'Not the same as citrate-related alkalosis, and the two must not be merged: this one is a question about how much citrate the patient is carrying, and that one is a question about what the acid–base picture is doing. They can be asked separately and answered separately.',
      clinicalQuestion:
        'Is the patient handling the citrate load the circuit is handing back, or is it building up?',
      samplingDomain: 'both-compared' as const,
      samplingDomainWhy:
        'Neither compartment answers this alone. The question is about the relationship between what the circuit is doing and what the patient shows, so it needs both samples read as a pair.',
      circuitBehaviour: Object.freeze({
        support: 'topology' as const,
        statement:
          'The circuit is the source of the load. Blood that citrate acted on returns to the patient through the return lumen, so whatever the circuit is delivering does not stay in the circuit.',
      }),
      systemicCalciumContext: Object.freeze({
        support: 'held-open' as const,
        statement:
          'The specific pattern of patient calcium measurements said to characterise accumulation is not established by the sources registered for this module, and is deliberately not stated here. What is established is that the circuit sample and the patient sample are different measurements of different compartments, so a discordance between them is a finding rather than an error.',
      }),
      acidBaseContext: Object.freeze({
        support: 'held-open' as const,
        statement:
          'How the acid–base picture behaves in accumulation is not established by the sources registered for this module.',
      }),
      whatFindingsMaySupport: Object.freeze({
        support: 'held-open' as const,
        statement:
          'The registered sources support treating a discordant pattern across the two compartments as something to verify and escalate. They do not support a rule for calling accumulation from any particular combination of findings, and no such rule is offered here.',
      }),
      whatOneFindingCannotEstablish:
        'No single value from either compartment can establish this. It is by construction a question about a relationship over time, and a first step is always to check that the samples were drawn from the compartments they are labelled with.',
      firstVerificationBoundary: VERIFICATION_BOUNDARY,
      sourceIds: CITRATE_CONTEXT_SOURCE_IDS,
    }),
    Object.freeze({
      id: 'citrate-related-alkalosis' as const,
      ordinal: 4,
      name: 'Citrate-related metabolic alkalosis',
      notToBeConfusedWith:
        'Not a synonym for citrate accumulation, and not a stage of it. This category is entered through the acid–base picture; accumulation is entered through the citrate load. A patient can raise one question without raising the other.',
      clinicalQuestion: 'Is the acid–base picture moving, and is the therapy part of why?',
      samplingDomain: 'systemic' as const,
      samplingDomainWhy:
        'Acid–base status is a property of the patient. A circuit sample describes the circuit and cannot carry this question.',
      circuitBehaviour: Object.freeze({
        support: 'topology' as const,
        statement:
          'The circuit is one of several things exchanging with the patient across the membrane, and everything the prescription runs — dialysate on the far side, replacement fluid into the blood path — is part of that exchange. The circuit is therefore a candidate contributor, not automatically the cause.',
      }),
      systemicCalciumContext: Object.freeze({
        support: 'held-open' as const,
        statement:
          'Whether patient calcium information distinguishes this category from the others is not established by the sources registered for this module.',
      }),
      acidBaseContext: Object.freeze({
        support: 'held-open' as const,
        statement:
          'This is the compartment and the axis the question lives on, and it is also where the registered sources stop. They do not state the mechanism by which citrate therapy shifts acid–base status, and it is not stated here. Take the mechanism to a source that carries it, and the patient to the responsible clinical team.',
      }),
      whatFindingsMaySupport: Object.freeze({
        support: 'held-open' as const,
        statement:
          'The registered sources support comparing linked calcium and acid–base information and escalating a discordant pattern. They do not support attributing an acid–base change to the citrate therapy from that comparison alone.',
      }),
      whatOneFindingCannotEstablish:
        'An acid–base result cannot on its own attribute the change to the therapy. A critically ill patient has many routes to the same picture, and the therapy is one candidate among them rather than the default explanation.',
      firstVerificationBoundary: VERIFICATION_BOUNDARY,
      sourceIds: CITRATE_CONTEXT_SOURCE_IDS,
    }),
  ])

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
  'Where a row is marked as an open question, the sources registered for this module do not carry the answer. It is left open rather than filled in from elsewhere, because a confident-sounding sentence with nothing behind it is the more dangerous of the two options.' as const

export const CRRT_CITRATE_SCOPE_NOTICE =
  'This comparison stays at the level of mechanism and of telling four questions apart. It is not a bedside algorithm, it carries no quantity of any kind, and it replaces neither the authorised local protocol nor the judgment of the responsible clinical team.' as const

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
