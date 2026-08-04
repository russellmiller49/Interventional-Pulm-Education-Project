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
  /** Everything pulled from the blood side to the fluid side across the membrane. */
  readonly crossingMembraneMlHour: number
  /**
   * Net fluid handed back to the patient by the circuit. Negative means the
   * patient is losing fluid to the machine, which is the usual case.
   */
  readonly netFluidToPatientMlHour: number
  /** Total effluent the effluent pump must carry. MATH-PM-001. */
  readonly totalEffluentMlHour: number
  /** The machine's own patient-fluid-removed term. FLUID-PM-002. */
  readonly machinePatientFluidRemovalMlHour: number
  /** Prescribed patient fluid removal, read straight off the flow settings. */
  readonly prescribedPatientFluidRemovalMlHour: number
  /**
   * How many millilitres of effluent are produced per millilitre the patient
   * actually loses. Null when net removal is zero, because the ratio is then
   * undefined rather than infinite.
   */
  readonly effluentPerMillilitreRemoved: number | null
  /**
   * The device makeup term. It appears in the effluent target expression
   * (MATH-PM-001) but not in the patient-fluid-removed expression
   * (FLUID-PM-002), so a non-zero value makes the machine's removal term exceed
   * the prescribed removal. Authored examples keep this at zero and the dump
   * harness flags any state where it is not.
   */
  readonly makeupMlHour: number
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

  // FLUID-PM-002 is defined over volumes; one hour of each rate keeps the units
  // honest and leaves the expression untouched.
  const machinePatientFluidRemovalMlHour = calculatePrismaxPatientFluidRemovedMl({
    effluentVolumeMl: totalEffluentMlHour,
    preBloodPumpVolumeMl: flows.pbpFlowMlHour,
    dialysateVolumeMl: flows.dialysateFlowMlHour,
    replacementVolumeMl: totalReplacementMlHour,
    syringeVolumeMl: flows.syringeFlowMlHour,
  })

  const enteringBloodPathMlHour = finite(
    flows.pbpFlowMlHour + totalReplacementMlHour + flows.syringeFlowMlHour,
    'enteringBloodPathMlHour',
  )
  const neverEnteringPatientMlHour = finite(flows.dialysateFlowMlHour, 'neverEnteringPatientMlHour')
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
    makeupMlHour: flows.makeupFlowMlHour,
    sourceIds: Object.freeze([
      PRISMAX_EFFLUENT_TARGET_SOURCE_ID,
      PRISMAX_PATIENT_FLUID_REMOVED_SOURCE_ID,
    ]),
  })
}

export interface CrrtConservationCheck {
  readonly id:
    | 'effluent-equals-membrane-plus-dialysate'
    | 'membrane-minus-added-equals-machine-removal'
    | 'net-to-patient-mirrors-machine-removal'
    | 'makeup-term-inflates-machine-removal'
  readonly label: string
  readonly balanced: boolean
  readonly residualMlHour: number
  readonly explanation: string
}

/**
 * The conservation identities the ledger must satisfy. These are arithmetic
 * facts about the two source expressions, not clinical judgements, so a failure
 * means the ledger or the flows are wrong rather than that the therapy is.
 */
export function checkCrrtFluidConservation(
  ledger: CrrtMachineFluidLedger,
): readonly CrrtConservationCheck[] {
  const membranePlusDialysate =
    ledger.crossingMembraneMlHour + ledger.neverEnteringPatientMlHour - ledger.totalEffluentMlHour
  const membraneMinusAdded =
    ledger.crossingMembraneMlHour -
    ledger.enteringBloodPathMlHour -
    ledger.machinePatientFluidRemovalMlHour
  const netMirror = ledger.netFluidToPatientMlHour + ledger.machinePatientFluidRemovalMlHour
  const makeupResidual =
    ledger.machinePatientFluidRemovalMlHour - ledger.prescribedPatientFluidRemovalMlHour

  return Object.freeze([
    {
      id: 'effluent-equals-membrane-plus-dialysate',
      label: 'Total effluent equals what crossed the membrane plus the dialysate that never did',
      balanced: Math.abs(membranePlusDialysate) <= CONSERVATION_EPSILON_ML_HOUR,
      residualMlHour: membranePlusDialysate,
      explanation:
        'Everything in the effluent bag either crossed the membrane out of the blood or ran past the membrane as dialysate. There is no third source.',
    },
    {
      id: 'membrane-minus-added-equals-machine-removal',
      label: 'What crossed the membrane, less what was given back, is what the patient lost',
      balanced: Math.abs(membraneMinusAdded) <= CONSERVATION_EPSILON_ML_HOUR,
      residualMlHour: membraneMinusAdded,
      explanation:
        'The membrane volume is large because replacement and pre-blood-pump fluid are pulled off again along with the patient’s own fluid. Subtracting what was given back leaves the net loss.',
    },
    {
      id: 'net-to-patient-mirrors-machine-removal',
      label: 'Net fluid to the patient is the machine removal term with the opposite sign',
      balanced: Math.abs(netMirror) <= CONSERVATION_EPSILON_ML_HOUR,
      residualMlHour: netMirror,
      explanation:
        'Fluid the circuit hands back and fluid the machine records as removed are the same quantity seen from the two ends.',
    },
    {
      id: 'makeup-term-inflates-machine-removal',
      label: 'The machine removal term matches the prescribed removal',
      balanced: Math.abs(makeupResidual) <= CONSERVATION_EPSILON_ML_HOUR,
      residualMlHour: makeupResidual,
      explanation:
        'The makeup term is carried by the effluent target expression but not by the patient-fluid-removed expression, so any non-zero makeup flow makes the machine record more removal than was prescribed. Authored examples keep makeup at zero; a residual here means the difference must be explained rather than displayed as patient loss.',
    },
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
