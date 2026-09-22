import type { RuntimeCrrtCase } from '../content/schema'
import {
  canStartPrismaxTreatment,
  prismaxSetupSteps,
  type PrismaxPilotInterfaceState,
  type PrismaxSetupStepId,
} from './deviceAdapters/prismax'
import type { CrrtLearningSessionState } from './learningSession'
import type { CrrtFlowRates } from './types'

/**
 * One authoritative record of the machine workflow and the prescription in use.
 *
 * CRRT-04 ran two workflows that disagreed (F-17). The PrisMax facsimile owns the
 * real setup sequence — patient, therapy, prescription, sets, fluids, prime,
 * review, connect — and its own start interlock. The case also carries "case
 * setting" cards whose authored effects write straight into the engine
 * prescription and delivery state. Nothing reconciled the two, so a card could
 * replace a prescription the learner had committed and reviewed on the machine
 * while the machine went on displaying the committed values, and a card could put
 * the machine on Operations with no setup step completed and prime never started.
 *
 * This module adds no acceptance criteria for a prescription and no new
 * interlock. It states which record is which, and where they have diverged.
 */

export type CrrtPrescriptionRecordStatus =
  /** No prescription is configured anywhere yet. */
  | 'not-set'
  /** A prescription was committed on the machine and is the one in use. */
  | 'machine-reviewed-matches'
  | 'machine-committed-unreviewed'
  /** A prescription was committed on the machine, but the one in use differs. */
  | 'changed-since-machine-review'
  /** A prescription is in use but was never committed through the machine. */
  | 'not-reviewed-on-machine'

export interface CrrtPrescriptionFieldDivergence {
  readonly label: string
  readonly unit: string
  readonly committedOnMachine: number
  readonly inUse: number
}

export interface CrrtPrescriptionRecord {
  readonly status: CrrtPrescriptionRecordStatus
  readonly reviewCurrent: boolean
  /** The flows the engine is actually running. */
  readonly inUse: CrrtFlowRates | null
  /** The flows the learner committed on the machine, if any. */
  readonly committedOnMachine: CrrtFlowRates | null
  readonly divergences: readonly CrrtPrescriptionFieldDivergence[]
  readonly statement: string
}

const machinePrescriptionFields = [
  ['bloodFlowMlMin', 'Blood flow', 'mL/min'],
  ['dialysateFlowMlHour', 'Dialysate flow', 'mL/h'],
  ['patientFluidRemovalMlHour', 'Patient fluid removal', 'mL/h'],
  ['pbpFlowMlHour', 'Pre-blood-pump flow', 'mL/h'],
  ['preReplacementFlowMlHour', 'Pre-filter replacement', 'mL/h'],
  ['postReplacementFlowMlHour', 'Post-filter replacement', 'mL/h'],
  ['syringeFlowMlHour', 'Syringe flow', 'mL/h'],
  ['makeupFlowMlHour', 'Makeup flow', 'mL/h'],
] as const

export const CRRT_PRESCRIPTION_RECORD_STATEMENTS: Readonly<
  Record<CrrtPrescriptionRecordStatus, string>
> = Object.freeze({
  'not-set': 'No prescription has been entered yet, on the machine or by a case action.',
  'machine-committed-unreviewed':
    'The current values match the machine entry, but the current prescription has not been reviewed on the machine.',
  'machine-reviewed-matches':
    'The prescription you committed on the machine is the one the simulation is running.',
  'changed-since-machine-review':
    'The prescription the simulation is running is no longer the one you committed on the machine. A case action changed it afterwards. The review status below refers to the current values; completed prime, connection and start are unchanged — and this exercise does not judge whether either prescription is clinically appropriate.',
  'not-reviewed-on-machine':
    'The prescription the simulation is running came from the case, not from a prescription you committed and reviewed on the machine.',
})

export function selectCrrtPrescriptionRecord(
  session: CrrtLearningSessionState,
): CrrtPrescriptionRecord {
  const reviewCurrent =
    session.interfaceState.completedStepIds.includes('review') &&
    !session.interfaceState.prescriptionReviewStale
  const prescription = session.simulation.prescription
  const committed = session.interfaceState.committedPrescription
  const inUse = prescription.status === 'configured' ? prescription.flows : null

  if (!inUse) {
    return Object.freeze({
      status: 'not-set',
      reviewCurrent,
      inUse: null,
      committedOnMachine: committed ? { ...pickMachineFields(committed.flows) } : null,
      divergences: Object.freeze([]),
      statement: CRRT_PRESCRIPTION_RECORD_STATEMENTS['not-set'],
    })
  }
  if (!committed) {
    return Object.freeze({
      status: 'not-reviewed-on-machine',
      reviewCurrent,
      inUse,
      committedOnMachine: null,
      divergences: Object.freeze([]),
      statement: CRRT_PRESCRIPTION_RECORD_STATEMENTS['not-reviewed-on-machine'],
    })
  }

  const divergences = machinePrescriptionFields.flatMap<CrrtPrescriptionFieldDivergence>(
    ([key, label, unit]) =>
      committed.flows[key] === inUse[key]
        ? []
        : [{ label, unit, committedOnMachine: committed.flows[key], inUse: inUse[key] }],
  )
  const status: CrrtPrescriptionRecordStatus =
    divergences.length === 0
      ? reviewCurrent
        ? 'machine-reviewed-matches'
        : 'machine-committed-unreviewed'
      : 'changed-since-machine-review'
  return Object.freeze({
    status,
    reviewCurrent,
    inUse,
    committedOnMachine: pickMachineFields(committed.flows),
    divergences: Object.freeze(divergences),
    statement: CRRT_PRESCRIPTION_RECORD_STATEMENTS[status],
  })
}

function pickMachineFields(flows: CrrtFlowRates) {
  return Object.freeze({ ...flows })
}

/* ------------------------------------------------------------------ *
 * Machine start readiness, as the facsimile already defines it
 * ------------------------------------------------------------------ */

export interface CrrtMachineStartReadiness {
  readonly ready: boolean
  /** The machine conditions that are not met, in the facsimile's own terms. */
  readonly missing: readonly string[]
}

const setupStepLabelById = new Map<PrismaxSetupStepId, string>(
  prismaxSetupSteps.map((step) => [step.id, step.label]),
)

export function crrtSetupStepLabel(stepId: PrismaxSetupStepId): string {
  return setupStepLabelById.get(stepId) ?? stepId
}

/**
 * Restates `canStartPrismaxTreatment` and names what is missing. It never relaxes
 * the facsimile's own condition: `ready` is exactly that function's verdict.
 */
export function selectCrrtMachineStartReadiness(
  interfaceState: PrismaxPilotInterfaceState,
): CrrtMachineStartReadiness {
  const completed = new Set(interfaceState.completedStepIds)
  const missing: string[] = []
  if (interfaceState.treatmentState === 'running') missing.push('treatment is already running')
  if (interfaceState.treatmentState === 'ended') missing.push('this treatment has been ended')
  for (const step of prismaxSetupSteps) {
    if (!completed.has(step.id)) missing.push(`the ${step.label} step is not complete`)
  }
  if (interfaceState.committedPrescription === null) {
    missing.push('no prescription has been committed')
  }
  if (interfaceState.prescriptionReviewStale && !interfaceState.treatmentStarted)
    missing.push('the prescription review is stale')
  if (interfaceState.primeState !== 'complete') missing.push('priming is not complete')
  return Object.freeze({
    ready: canStartPrismaxTreatment(interfaceState),
    missing: Object.freeze([...new Set(missing)]),
  })
}

/* ------------------------------------------------------------------ *
 * Machine steps a case declaration asserts
 * ------------------------------------------------------------------ */

export interface CrrtMachineStepAssertion {
  readonly stepId: PrismaxSetupStepId
  readonly label: string
  readonly complete: boolean
}

/**
 * A case card that says it completed prime and prescription review is a
 * declaration, not a machine step: its authored effects touch neither. Resolving
 * the steps it names against the facsimile's own record is what keeps "I have
 * done this" separate from "the machine recorded this".
 */
export function selectCrrtMachineStepAssertions(
  intervention: RuntimeCrrtCase['interventions'][number],
  interfaceState: PrismaxPilotInterfaceState,
): readonly CrrtMachineStepAssertion[] {
  const asserted = intervention.assertsCompletedMachineSteps ?? []
  if (asserted.length === 0) return Object.freeze([])
  const completed = new Set<string>(interfaceState.completedStepIds)
  return Object.freeze(
    asserted.map((stepId) => ({
      stepId,
      label: crrtSetupStepLabel(stepId),
      complete:
        completed.has(stepId) &&
        (stepId !== 'review' || !interfaceState.prescriptionReviewStale) &&
        (stepId !== 'prime' || interfaceState.primeState === 'complete'),
    })),
  )
}

export function crrtUnmetMachineStepAssertions(
  intervention: RuntimeCrrtCase['interventions'][number],
  interfaceState: PrismaxPilotInterfaceState,
): readonly CrrtMachineStepAssertion[] {
  return selectCrrtMachineStepAssertions(intervention, interfaceState).filter(
    (assertion) => !assertion.complete,
  )
}

/** True when any authored effect of this action would put delivery into `running`. */
export function crrtActionStartsDelivery(
  intervention: RuntimeCrrtCase['interventions'][number],
): boolean {
  return intervention.effects.some(
    (effect) =>
      effect.target === 'device.deliveryState' &&
      effect.valueType === 'enum' &&
      effect.value === 'running',
  )
}
