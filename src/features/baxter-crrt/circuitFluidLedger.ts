/**
 * The CRRT fluid-conservation ledger.
 *
 * One question drives this file: *why is effluent so much larger than the fluid
 * the patient actually loses?* The answer is bookkeeping, not physiology, and it
 * is already carried by two source-pinned device expressions this module
 * implements:
 *
 * - total effluent (MATH-PM-001) adds up every fluid the effluent pump must
 *   carry away, including dialysate that was never inside the patient;
 * - the machine patient-fluid-removed term (FLUID-PM-002) subtracts all of those
 *   given fluids back out again.
 *
 * Nothing here introduces new physiology. Every quantity is either read straight
 * off `CrrtFlowRates` or computed by the existing engine functions, so the
 * ledger cannot drift away from what the simulation actually did.
 *
 * One term does not reconcile between those two expressions, and the ledger
 * refuses to guess. See `CRRT_MAKEUP_ATTRIBUTION_CONFLICT` below.
 */

import {
  calculatePrismaxEffluentPumpTargetMlPerHour,
  calculatePrismaxPatientFluidRemovedMl,
  PRISMAX_EFFLUENT_TARGET_SOURCE_ID,
  PRISMAX_PATIENT_FLUID_REMOVED_SOURCE_ID,
} from './engine/clinicalMath'
import { calculateWholePatientNetBalanceMl } from './engine/fluidModel'
import type { CrrtFlowRates, ExternalFluidRates, FluidLedgerTotals } from './engine/types'

/** Rounding guard for float comparisons, in mL/h. Not a clinical tolerance. */
const CONSERVATION_EPSILON_ML_HOUR = 1e-6

/**
 * The makeup term does not reconcile between the two registered expressions, and
 * no third record settles it.
 *
 * `MATH-PM-001` (manual p217) defines the effluent target as
 * `Qeff = Qpfr + Qpbp + Qrep + Qdial + Qsyr + Qmakeup` — makeup is carried.
 * `FLUID-PM-002` (manual p219) defines the machine's patient-fluid-removed term
 * as `Vpfr = Veff - Vpbp - Vdial - Vrep - Vsyr` — makeup is absent.
 *
 * Subtracting an effluent total that contains makeup using an expression that
 * does not subtract it leaves the makeup volume sitting inside the patient
 * removal term. Nothing in the registered sources says whether makeup reached
 * the patient, so attributing it either way would be an invention.
 *
 * This is recorded rather than resolved, in the same spirit as the existing
 * CONFLICT-001 and CONFLICT-002 gates in `engine/clinicalMath.ts`. The
 * consequence is enforced, not merely documented: when makeup is non-zero, every
 * quantity that depends on the attribution is suppressed and the ledger reports
 * itself unresolved. It is never shown as a balanced limb, and the unattributed
 * volume is never added to patient fluid loss.
 */
export const CRRT_MAKEUP_ATTRIBUTION_CONFLICT = Object.freeze({
  id: 'CONFLICT-CRRT-MAKEUP-001' as const,
  sourceRecordIds: Object.freeze(['MATH-PM-001', 'FLUID-PM-002']),
  symbol: 'Qmakeup' as const,
  observation:
    'The effluent-target expression carries the makeup term and the patient-fluid-removed expression omits it, so the makeup volume is left inside the removal term with no source statement about where it belongs.',
  requiredDisposition:
    'Suppress every quantity that depends on the attribution and report the ledger as unresolved. Authored C0/C1 examples hold makeup at zero.',
  status: 'unresolved-source-attribution-conflict' as const,
  reviewStatus: 'pending' as const,
})

/**
 * Whether the ledger's patient-facing quantities can be stated at all.
 * `unresolved-makeup-attribution` is not a warning attached to a number — it
 * means the number is withheld.
 */
export type CrrtLedgerResolution = 'resolved' | 'unresolved-makeup-attribution'

export interface CrrtMachineFluidLedger {
  /**
   * Fluid added to the blood path and therefore reaching the patient unless it
   * is filtered off again: pre-blood-pump, both replacement ports, and the
   * syringe.
   */
  readonly enteringBloodPathMlHour: number
  /**
   * Fluid that runs along the fluid side of the membrane and leaves in the
   * effluent without ever joining the blood path. Dialysate only.
   */
  readonly neverEnteringPatientMlHour: number
  /**
   * Everything pulled from the blood side to the fluid side across the membrane.
   * Null when the makeup attribution is unresolved, because an unattributed
   * volume inside the effluent total may or may not have crossed.
   */
  readonly crossingMembraneMlHour: number | null
  /**
   * Net fluid handed back to the patient by the circuit. Negative means the
   * patient is losing fluid to the machine, which is the usual case. Null when
   * the makeup attribution is unresolved.
   */
  readonly netFluidToPatientMlHour: number | null
  /** Total effluent the effluent pump must carry. MATH-PM-001. Always stateable. */
  readonly totalEffluentMlHour: number
  /**
   * The machine's own patient-fluid-removed term. FLUID-PM-002. Null when the
   * makeup attribution is unresolved — the expression would otherwise report an
   * unattributed volume as fluid the patient lost.
   */
  readonly machinePatientFluidRemovalMlHour: number | null
  /** Prescribed patient fluid removal, read straight off the flow settings. */
  readonly prescribedPatientFluidRemovalMlHour: number
  /**
   * How many millilitres of effluent are produced per millilitre the patient
   * actually loses. Null when net removal is zero, because the ratio is then
   * undefined rather than infinite.
   */
  readonly effluentPerMillilitreRemoved: number | null
  /** The device makeup term. See `CRRT_MAKEUP_ATTRIBUTION_CONFLICT`. */
  readonly makeupMlHour: number
  /** `resolved` only when the makeup term is zero. */
  readonly resolution: CrrtLedgerResolution
  /** Learner-facing reason the suppressed quantities are withheld. Null when resolved. */
  readonly unresolvedReason: string | null
  readonly sourceIds: readonly string[]
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`)
  return value
}

/**
 * Builds the machine-side ledger from one set of flow settings.
 *
 * The membrane term is deliberately derived as `total effluent − dialysate`
 * rather than assembled independently. That keeps it arithmetically tied to the
 * source-pinned effluent expression, so the ledger can never balance in this
 * file while disagreeing with the engine.
 */
export function calculateCrrtMachineFluidLedger(flows: CrrtFlowRates): CrrtMachineFluidLedger {
  const totalReplacementMlHour = finite(
    flows.preReplacementFlowMlHour + flows.postReplacementFlowMlHour,
    'totalReplacementMlHour',
  )

  const totalEffluentMlHour = calculatePrismaxEffluentPumpTargetMlPerHour({
    patientFluidRemovalMlPerHour: flows.patientFluidRemovalMlHour,
    preBloodPumpMlPerHour: flows.pbpFlowMlHour,
    totalReplacementMlPerHour: totalReplacementMlHour,
    dialysateMlPerHour: flows.dialysateFlowMlHour,
    syringeMlPerHour: flows.syringeFlowMlHour,
    makeupMlPerHour: flows.makeupFlowMlHour,
  })

  const enteringBloodPathMlHour = finite(
    flows.pbpFlowMlHour + totalReplacementMlHour + flows.syringeFlowMlHour,
    'enteringBloodPathMlHour',
  )
  const neverEnteringPatientMlHour = finite(flows.dialysateFlowMlHour, 'neverEnteringPatientMlHour')

  const makeupMlHour = finite(flows.makeupFlowMlHour, 'makeupMlHour')
  const unresolved = Math.abs(makeupMlHour) > CONSERVATION_EPSILON_ML_HOUR

  const sourceIds = Object.freeze([
    PRISMAX_EFFLUENT_TARGET_SOURCE_ID,
    PRISMAX_PATIENT_FLUID_REMOVED_SOURCE_ID,
  ])

  if (unresolved) {
    // Every quantity below the membrane depends on knowing where the makeup
    // volume went, and no registered source says. Withhold them rather than
    // publish a number the sources do not support.
    return Object.freeze({
      enteringBloodPathMlHour,
      neverEnteringPatientMlHour,
      crossingMembraneMlHour: null,
      netFluidToPatientMlHour: null,
      totalEffluentMlHour,
      machinePatientFluidRemovalMlHour: null,
      prescribedPatientFluidRemovalMlHour: flows.patientFluidRemovalMlHour,
      effluentPerMillilitreRemoved: null,
      makeupMlHour,
      resolution: 'unresolved-makeup-attribution' as const,
      unresolvedReason: `A makeup flow of ${makeupMlHour} mL/h is running. The effluent expression counts it and the patient-fluid-removed expression does not, and no registered source says which side of the membrane it belongs to. Everything that depends on that answer is withheld rather than guessed, so this circuit cannot be shown as a balanced ledger and none of this volume is attributed to patient fluid loss.`,
      sourceIds,
    })
  }

  // FLUID-PM-002 is defined over volumes; one hour of each rate keeps the units
  // honest and leaves the expression untouched.
  const machinePatientFluidRemovalMlHour = calculatePrismaxPatientFluidRemovedMl({
    effluentVolumeMl: totalEffluentMlHour,
    preBloodPumpVolumeMl: flows.pbpFlowMlHour,
    dialysateVolumeMl: flows.dialysateFlowMlHour,
    replacementVolumeMl: totalReplacementMlHour,
    syringeVolumeMl: flows.syringeFlowMlHour,
  })

  const crossingMembraneMlHour = finite(
    totalEffluentMlHour - neverEnteringPatientMlHour,
    'crossingMembraneMlHour',
  )
  const netFluidToPatientMlHour = finite(
    enteringBloodPathMlHour - crossingMembraneMlHour,
    'netFluidToPatientMlHour',
  )

  return Object.freeze({
    enteringBloodPathMlHour,
    neverEnteringPatientMlHour,
    crossingMembraneMlHour,
    netFluidToPatientMlHour,
    totalEffluentMlHour,
    machinePatientFluidRemovalMlHour,
    prescribedPatientFluidRemovalMlHour: flows.patientFluidRemovalMlHour,
    effluentPerMillilitreRemoved:
      machinePatientFluidRemovalMlHour === 0
        ? null
        : totalEffluentMlHour / machinePatientFluidRemovalMlHour,
    makeupMlHour,
    resolution: 'resolved' as const,
    unresolvedReason: null,
    sourceIds,
  })
}

/**
 * A check is `balanced`, `unbalanced`, or `unresolved`. The third state exists so
 * a suppressed ledger can never be mistaken for a balanced one: an unresolved
 * check is not a passing check.
 */
export type CrrtConservationStatus = 'balanced' | 'unbalanced' | 'unresolved'

export interface CrrtConservationCheck {
  readonly id:
    | 'effluent-equals-membrane-plus-dialysate'
    | 'membrane-minus-added-equals-machine-removal'
    | 'net-to-patient-mirrors-machine-removal'
    | 'makeup-attribution-resolved'
  readonly label: string
  readonly status: CrrtConservationStatus
  /** Null when the check could not be evaluated at all. */
  readonly residualMlHour: number | null
  readonly explanation: string
}

/** True only when every identity was evaluated and every one balanced. */
export function crrtLedgerIsFullyBalanced(checks: readonly CrrtConservationCheck[]): boolean {
  return checks.length > 0 && checks.every((check) => check.status === 'balanced')
}

function identity(
  id: CrrtConservationCheck['id'],
  label: string,
  residual: number | null,
  explanation: string,
): CrrtConservationCheck {
  return {
    id,
    label,
    status:
      residual === null
        ? 'unresolved'
        : Math.abs(residual) <= CONSERVATION_EPSILON_ML_HOUR
          ? 'balanced'
          : 'unbalanced',
    residualMlHour: residual,
    explanation,
  }
}

/**
 * The conservation identities the ledger must satisfy. These are arithmetic
 * facts about the two source expressions, not clinical judgements, so a failure
 * means the ledger or the flows are wrong rather than that the therapy is.
 *
 * When the makeup attribution is unresolved the dependent identities report
 * `unresolved` rather than being silently skipped or reported as balanced.
 */
export function checkCrrtFluidConservation(
  ledger: CrrtMachineFluidLedger,
): readonly CrrtConservationCheck[] {
  const { crossingMembraneMlHour, netFluidToPatientMlHour, machinePatientFluidRemovalMlHour } =
    ledger

  const membranePlusDialysate =
    crossingMembraneMlHour === null
      ? null
      : crossingMembraneMlHour + ledger.neverEnteringPatientMlHour - ledger.totalEffluentMlHour
  const membraneMinusAdded =
    crossingMembraneMlHour === null || machinePatientFluidRemovalMlHour === null
      ? null
      : crossingMembraneMlHour - ledger.enteringBloodPathMlHour - machinePatientFluidRemovalMlHour
  const netMirror =
    netFluidToPatientMlHour === null || machinePatientFluidRemovalMlHour === null
      ? null
      : netFluidToPatientMlHour + machinePatientFluidRemovalMlHour
  const makeupResidual =
    ledger.resolution === 'resolved' && machinePatientFluidRemovalMlHour !== null
      ? machinePatientFluidRemovalMlHour - ledger.prescribedPatientFluidRemovalMlHour
      : null

  return Object.freeze([
    identity(
      'effluent-equals-membrane-plus-dialysate',
      'Total effluent equals what crossed the membrane plus the dialysate that never did',
      membranePlusDialysate,
      'Everything in the effluent bag either crossed the membrane out of the blood or ran past the membrane as dialysate. There is no third source.',
    ),
    identity(
      'membrane-minus-added-equals-machine-removal',
      'What crossed the membrane, less what was given back, is what the patient lost',
      membraneMinusAdded,
      'The membrane volume is large because replacement and pre-blood-pump fluid are pulled off again along with the patient’s own fluid. Subtracting what was given back leaves the net loss.',
    ),
    identity(
      'net-to-patient-mirrors-machine-removal',
      'Net fluid to the patient is the machine removal term with the opposite sign',
      netMirror,
      'Fluid the circuit hands back and fluid the machine records as removed are the same quantity seen from the two ends.',
    ),
    identity(
      'makeup-attribution-resolved',
      'Every fluid in the effluent total can be attributed to a side of the membrane',
      makeupResidual,
      ledger.unresolvedReason ??
        'With no makeup flow running, every term in the effluent total is accounted for on one side of the membrane or the other.',
    ),
  ])
}

export interface CrrtWholePatientLedger {
  readonly externalInputMlHour: number
  readonly externalOutputMlHour: number
  readonly machinePatientFluidRemovalMlHour: number
  readonly unintendedDeviceNetGainMlHour: number
  readonly netBalanceMlHour: number
}

/**
 * The second ledger. The machine ledger answers "what did the circuit do"; this
 * one answers "what happened to the patient", and the two are different numbers
 * for the same hour.
 */
export function calculateCrrtWholePatientLedger(
  externalRates: ExternalFluidRates,
  machinePatientFluidRemovalMlHour: number,
  unintendedDeviceNetGainMlHour: number,
): CrrtWholePatientLedger {
  const externalInputMlHour =
    externalRates.maintenanceInputMlHour +
    externalRates.medicationCarrierInputMlHour +
    externalRates.nutritionInputMlHour +
    externalRates.bloodProductInputMlHour +
    externalRates.bolusInputMlHour +
    externalRates.otherInputMlHour
  const externalOutputMlHour =
    externalRates.urineOutputMlHour +
    externalRates.drainOutputMlHour +
    externalRates.otherOutputMlHour

  // Reuse the engine's own expression by treating one hour of each rate as a
  // volume, so this ledger cannot disagree with the cumulative one.
  const netBalanceMlHour = calculateWholePatientNetBalanceMl({
    maintenanceInputMl: externalRates.maintenanceInputMlHour,
    medicationCarrierInputMl: externalRates.medicationCarrierInputMlHour,
    nutritionInputMl: externalRates.nutritionInputMlHour,
    bloodProductInputMl: externalRates.bloodProductInputMlHour,
    bolusInputMl: externalRates.bolusInputMlHour,
    otherInputMl: externalRates.otherInputMlHour,
    urineOutputMl: externalRates.urineOutputMlHour,
    drainOutputMl: externalRates.drainOutputMlHour,
    otherOutputMl: externalRates.otherOutputMlHour,
    machinePatientFluidRemovalMl: machinePatientFluidRemovalMlHour,
    unintendedDeviceNetGainMl: unintendedDeviceNetGainMlHour,
  })

  return Object.freeze({
    externalInputMlHour,
    externalOutputMlHour,
    machinePatientFluidRemovalMlHour,
    unintendedDeviceNetGainMlHour,
    netBalanceMlHour,
  })
}

/** Cumulative form, for reading a ledger the simulation has actually run. */
export function calculateCrrtCumulativeWholePatientBalanceMl(totals: FluidLedgerTotals): number {
  return calculateWholePatientNetBalanceMl(totals)
}

/* ------------------------------------------------------------------ *
 * The worked example
 * ------------------------------------------------------------------ */

export interface CrrtWorkedLedgerExample {
  readonly id: string
  readonly title: string
  readonly flows: CrrtFlowRates
  readonly narrative: string
  readonly questions: readonly string[]
}

/**
 * The example the whole package exists to make survivable: a large effluent
 * number sitting beside a small patient loss, with every millilitre accounted
 * for. Values are an authored teaching state, not a prescription or a target.
 */
export const crrtWorkedLedgerExample: CrrtWorkedLedgerExample = Object.freeze({
  id: 'crrt-conservation-worked-example',
  title: 'Where do 2,100 mL an hour go when the patient only loses 100?',
  flows: Object.freeze({
    bloodFlowMlMin: 150,
    dialysateFlowMlHour: 1_000,
    pbpFlowMlHour: 0,
    preReplacementFlowMlHour: 0,
    postReplacementFlowMlHour: 1_000,
    patientFluidRemovalMlHour: 100,
    syringeFlowMlHour: 0,
    makeupFlowMlHour: 0,
  }),
  narrative:
    'Dialysate runs at 1,000 mL an hour along the far side of the membrane and never touches the blood. Replacement fluid runs at 1,000 mL an hour into the blood after the filter, so all of it reaches the patient. Net removal is set at 100 mL an hour. To hand back 1,000 mL and still take 100 mL off, the machine must pull 1,100 mL an hour across the membrane; add the 1,000 mL of dialysate that was never in the patient and the effluent bag fills at 2,100 mL an hour. The effluent bag is therefore twenty-one times the size of the patient’s actual loss, and reading it as fluid removed from the patient would overstate that loss by 2,000 mL every hour.',
  questions: Object.freeze([
    'Which of these fluids enters the patient, and which never does?',
    'How much fluid crossed the membrane, and why is that larger than the amount the patient lost?',
    'If you read only the effluent bag, by how much would you overstate what the patient lost this hour?',
    'Change the replacement fluid from the post-filter port to the pre-filter port. Which number in the ledger changes, and which do not?',
  ]),
})
