/**
 * The staged prescription builder's model.
 *
 * C2 §5 replaces one dense form with three explicit stages — the job the prescription has to do,
 * the flows that do it, and what those flows predict. This file holds all three, and it holds no
 * arithmetic of its own.
 *
 * Everything numeric here is produced by something that already existed:
 *
 * - `calculatePrescriptionWorkbench` (and through it the source-pinned PrisMax expressions in
 *   `engine/clinicalMath`) supplies the effluent target, the weight-normalised display dose,
 *   plasma flow, the printed predilution fraction, and the four outputs the evidence does not
 *   support;
 * - `calculateCrrtMachineFluidLedger` and `checkCrrtFluidConservation` (the landed C0/C1 ledger)
 *   supply every fluid-destination quantity and the makeup-attribution behaviour;
 * - `crrtCircuitOverlays`, `crrtCircuitPaths`, and `crrtPressureSignalDetails` (the landed C0/C1
 *   circuit) supply the active paths, their text equivalents, and the pressure implications.
 *
 * The one composition this file performs is time bookkeeping: a treatment window with downtime in
 * it delivers fewer effluent millilitres than the prescription asks for, and the delivered display
 * dose is then the engine's own `calculateEffluentDoseMlPerKgHour` applied to that smaller average
 * rate — the same composition `advanceContinuous` performs in `engine/simulation.ts`. No second
 * dose formula is written here.
 *
 * Nothing in this file is a clinical target. There is no recommended prescription, no correct set
 * of flows, and no numeric goal: the stage-1 catalogue names *jobs*, and stage 3 reports what a
 * given construction predicts, which is not the same thing as what a patient needs.
 */

import {
  calculateCrrtMachineFluidLedger,
  checkCrrtFluidConservation,
  CRRT_MAKEUP_ATTRIBUTION_CONFLICT,
  type CrrtConservationCheck,
  type CrrtMachineFluidLedger,
} from './circuitFluidLedger'
import {
  crrtCircuitOverlay,
  crrtCircuitOverlays,
  crrtCircuitPath,
  crrtCircuitTextEquivalent,
  crrtOverlayFluidDestinations,
  crrtPressureSignalDetails,
  type CrrtCircuitOverlay,
  type CrrtCircuitOverlayId,
  type CrrtCircuitPathId,
  type CrrtPressureSignalKind,
} from './content/circuitModel'
import { unresolvableCrrtSourceIds } from './content/learnerSourceMap'
import { calculateEffluentDoseMlPerKgHour } from './engine/clinicalMath'
import type { CrrtFlowRates, CrrtModality } from './engine/types'
import {
  assertNonNegativeNumber,
  assertPositiveNumber,
  integrateMillilitersPerHourForHours,
} from './engine/units'
import {
  calculatePrescriptionWorkbench,
  PRESCRIPTION_WORKBENCH_UNAVAILABLE_OUTPUTS,
  type PrescriptionWorkbenchResult,
  type QualitativePrePostDilutionResult,
  type UnavailableWorkbenchOutput,
} from './prescriptionWorkbenchModel'

/* ------------------------------------------------------------------ *
 * Stages
 * ------------------------------------------------------------------ */

export const CRRT_PRESCRIPTION_STAGE_IDS = [
  'goals',
  'construction',
  'predicted-consequences',
] as const

export type CrrtPrescriptionStageId = (typeof CRRT_PRESCRIPTION_STAGE_IDS)[number]

export interface CrrtPrescriptionStage {
  readonly id: CrrtPrescriptionStageId
  /** 1-based position, so the rendered stepper and the model cannot disagree about order. */
  readonly ordinal: 1 | 2 | 3
  readonly shortTitle: string
  readonly title: string
  /** The single question this stage asks. */
  readonly question: string
  readonly summary: string
}

export const crrtPrescriptionStages: readonly CrrtPrescriptionStage[] = Object.freeze([
  Object.freeze({
    id: 'goals' as const,
    ordinal: 1 as const,
    shortTitle: 'Goals',
    title: 'What job is this prescription meant to do?',
    question: 'Before any flow is set: what is the therapy being asked to change?',
    summary:
      'Name the job first. A set of flows that serves a fluid problem is not the same set that serves a solute problem, and the same numbers can be right for one and wrong for the other.',
  }),
  Object.freeze({
    id: 'construction' as const,
    ordinal: 2 as const,
    shortTitle: 'Construction',
    title: 'Which flows do that job, and where do they enter?',
    question: 'Work outward from the blood the circuit sees to the fluid the patient loses.',
    summary:
      'Each group below answers one question, in the order the circuit answers them. Every entry is a practice value, not a starting point or a recommendation.',
  }),
  Object.freeze({
    id: 'predicted-consequences' as const,
    ordinal: 3 as const,
    shortTitle: 'Predicted consequences',
    title: 'What does this construction predict?',
    question: 'What follows from these entries — and what still does not follow from them?',
    summary:
      'Everything here is read back from the same circuit and the same source-pinned expressions used everywhere else in the module. A prediction about this construction is not a recommendation for a patient.',
  }),
])

export const crrtPrescriptionStageById: ReadonlyMap<
  CrrtPrescriptionStageId,
  CrrtPrescriptionStage
> = new Map(crrtPrescriptionStages.map((stage) => [stage.id, stage]))

export function crrtPrescriptionStage(id: CrrtPrescriptionStageId): CrrtPrescriptionStage {
  const stage = crrtPrescriptionStageById.get(id)
  if (!stage) throw new Error(`Unknown CRRT prescription stage: ${id}`)
  return stage
}

/** Movement is free in both directions; the stage list is an order, not a gate. */
export function nextCrrtPrescriptionStageId(
  id: CrrtPrescriptionStageId,
): CrrtPrescriptionStageId | null {
  const index = CRRT_PRESCRIPTION_STAGE_IDS.indexOf(id)
  return CRRT_PRESCRIPTION_STAGE_IDS[index + 1] ?? null
}

export function previousCrrtPrescriptionStageId(
  id: CrrtPrescriptionStageId,
): CrrtPrescriptionStageId | null {
  const index = CRRT_PRESCRIPTION_STAGE_IDS.indexOf(id)
  return index > 0 ? (CRRT_PRESCRIPTION_STAGE_IDS[index - 1] ?? null) : null
}

/* ------------------------------------------------------------------ *
 * Stage 1 — goals
 * ------------------------------------------------------------------ */

export const CRRT_PRESCRIPTION_GOAL_GROUP_IDS = [
  'solute-clearance',
  'acid-base-electrolyte',
  'fluid-management',
  'operational-delivery',
] as const

export type CrrtPrescriptionGoalGroupId = (typeof CRRT_PRESCRIPTION_GOAL_GROUP_IDS)[number]

export interface CrrtPrescriptionGoalGroup {
  readonly id: CrrtPrescriptionGoalGroupId
  readonly title: string
  readonly question: string
}

export const crrtPrescriptionGoalGroups: readonly CrrtPrescriptionGoalGroup[] = Object.freeze([
  Object.freeze({
    id: 'solute-clearance' as const,
    title: 'Solute and clearance',
    question: 'Is something in the blood meant to come down, and by which transport?',
  }),
  Object.freeze({
    id: 'acid-base-electrolyte' as const,
    title: 'Acid–base and electrolyte',
    question: 'Is the acid–base or electrolyte picture meant to move, and in which direction?',
  }),
  Object.freeze({
    id: 'fluid-management' as const,
    title: 'Fluid management',
    question: 'Is fluid meant to leave the patient, and how quickly?',
  }),
  Object.freeze({
    id: 'operational-delivery' as const,
    title: 'Operational delivery',
    question: 'What has to stay true for any of the above to actually reach the patient?',
  }),
])

export interface CrrtPrescriptionGoalOption {
  readonly id: string
  readonly group: CrrtPrescriptionGoalGroupId
  /** The job, phrased as a job rather than as a number. */
  readonly label: string
  /** What choosing this job asks of the construction stage. */
  readonly whatThePrescriptionMustDo: string
  readonly sourceIds: readonly string[]
}

/**
 * The vocabulary already reviewed elsewhere in this module. Every option restates a distinction
 * the indications, transport, prescription, or fluid lesson already makes; none of them carries a
 * number, and none is marked preferable to another.
 */
const GOAL_FRAMING_SOURCE_IDS = Object.freeze([
  'TEXT-CRRT-NEYRA-2026',
  'REVIEW-CRRT-PRINCIPLES-2021',
  'REVIEW-CKRT-CORE-2025',
  'GUID-RRT-ICU-2026',
])

export const crrtPrescriptionGoalOptions: readonly CrrtPrescriptionGoalOption[] = Object.freeze([
  Object.freeze({
    id: 'goal-diffusive-clearance',
    group: 'solute-clearance' as const,
    label: 'Clear small solute mainly by diffusion, along a concentration gradient',
    whatThePrescriptionMustDo:
      'Run dialysate along the fluid side of the membrane. Dialysate never joins the blood path, so it changes what is cleared without changing what the patient is given.',
    sourceIds: GOAL_FRAMING_SOURCE_IDS,
  }),
  Object.freeze({
    id: 'goal-convective-clearance',
    group: 'solute-clearance' as const,
    label: 'Clear solute mainly by convection, carried with ultrafiltered plasma water',
    whatThePrescriptionMustDo:
      'Run replacement fluid and pull more volume across the membrane than the patient is meant to lose. Replacement fluid does reach the patient, so it has to be given back as fast as it is taken off.',
    sourceIds: GOAL_FRAMING_SOURCE_IDS,
  }),
  Object.freeze({
    id: 'goal-controlled-solute-trajectory',
    group: 'solute-clearance' as const,
    label: 'Move solute gradually rather than as fast as the circuit allows',
    whatThePrescriptionMustDo:
      'Treat total effluent intensity as the thing being chosen, and state that a slower trajectory is the intent rather than an under-delivery.',
    sourceIds: GOAL_FRAMING_SOURCE_IDS,
  }),
  Object.freeze({
    id: 'goal-acid-base-support',
    group: 'acid-base-electrolyte' as const,
    label: 'Support an acid–base problem the kidney is no longer handling',
    whatThePrescriptionMustDo:
      'Make the solution running against the blood, and the transport carrying it, explicit — the acid–base result follows from what is exchanged across the membrane, not from the modality label.',
    sourceIds: GOAL_FRAMING_SOURCE_IDS,
  }),
  Object.freeze({
    id: 'goal-electrolyte-control',
    group: 'acid-base-electrolyte' as const,
    label: 'Bring a dangerous electrolyte under continuous control',
    whatThePrescriptionMustDo:
      'State which transport is doing the work and over what period, and keep the plan for rechecking it with the prescription rather than separate from it.',
    sourceIds: GOAL_FRAMING_SOURCE_IDS,
  }),
  Object.freeze({
    id: 'goal-net-fluid-removal',
    group: 'fluid-management' as const,
    label: 'Take net fluid off the patient at a rate the circulation tolerates',
    whatThePrescriptionMustDo:
      'Set the machine patient-fluid-removal term. This is the only entry that decides what the patient loses; effluent intensity does not.',
    sourceIds: GOAL_FRAMING_SOURCE_IDS,
  }),
  Object.freeze({
    id: 'goal-fluid-neutral',
    group: 'fluid-management' as const,
    label: 'Hold the patient fluid-neutral while still clearing solute',
    whatThePrescriptionMustDo:
      'Set patient fluid removal at nothing while dialysate or replacement keeps running. A large effluent volume alongside no patient loss is the normal case, not an error.',
    sourceIds: GOAL_FRAMING_SOURCE_IDS,
  }),
  Object.freeze({
    id: 'goal-tolerable-continuous-delivery',
    group: 'operational-delivery' as const,
    label: 'Keep the therapy running, because an interrupted therapy delivers less than it asks',
    whatThePrescriptionMustDo:
      'Account for the hours the circuit is actually running. Prescribed intensity is what was asked for; delivered intensity is what the window produced.',
    sourceIds: GOAL_FRAMING_SOURCE_IDS,
  }),
  Object.freeze({
    id: 'goal-circuit-protection',
    group: 'operational-delivery' as const,
    label: 'Protect the circuit so the prescription survives long enough to be delivered',
    whatThePrescriptionMustDo:
      'Name the anticoagulation approach and where it acts. Circuit protection is a circuit-side job even when it is judged with patient-side information.',
    sourceIds: GOAL_FRAMING_SOURCE_IDS,
  }),
])

export const crrtPrescriptionGoalOptionById: ReadonlyMap<string, CrrtPrescriptionGoalOption> =
  new Map(crrtPrescriptionGoalOptions.map((option) => [option.id, option]))

/**
 * The distinction stage 1 exists to prevent a learner collapsing, restated at the point of choice
 * and again in stage 3. Clearance intensity and net patient fluid removal are set by different
 * entries and answer different questions; neither can be read off the other.
 */
export const CRRT_CLEARANCE_VERSUS_REMOVAL_CONTRAST = Object.freeze({
  id: 'clearance-is-not-net-removal' as const,
  title: 'A clearance goal and a fluid-removal goal are two different goals',
  clearanceSide:
    'Clearance intensity is carried by total effluent — the dialysate, the replacement fluid, and everything pulled across the membrane. It is set mostly by dialysate and replacement flow.',
  removalSide:
    'Net patient fluid removal is one entry of its own. It is what the patient actually loses, and it can be nothing at all while effluent runs at litres an hour.',
  consequence:
    'Changing dialysate flow changes what is cleared without changing what the patient loses. Changing the patient-fluid-removal entry changes what the patient loses without changing much of what is cleared.',
  sourceIds: Object.freeze(['MATH-PM-001', 'FLUID-PM-002', 'DOSE-PM-001', 'SYNTH-LAB-FLUID-001']),
})

/* ------------------------------------------------------------------ *
 * Stage 2 — construction
 * ------------------------------------------------------------------ */

/** The overlays that represent a modality a learner can prescribe. */
export const crrtPrescriptionModalityViews: readonly CrrtCircuitOverlay[] = Object.freeze(
  crrtCircuitOverlays.filter((overlay) => overlay.modality !== null),
)

export type CrrtPrescriptionModalityViewId = CrrtCircuitOverlayId

export interface CrrtPrescriptionConstruction {
  /** Which authored modality view this prescription claims to be. */
  readonly modalityViewId: CrrtPrescriptionModalityViewId
  readonly simulatedWeightKg: number
  readonly hematocritPercent: number
  readonly bloodFlowMlPerMinute: number
  readonly preBloodPumpMlPerHour: number
  readonly dialysateMlPerHour: number
  readonly preReplacementMlPerHour: number
  readonly postReplacementMlPerHour: number
  readonly patientFluidRemovalMlPerHour: number
  /** The device makeup term. See `CRRT_MAKEUP_ATTRIBUTION_CONFLICT`; authored examples hold it at zero. */
  readonly makeupMlPerHour: number
  readonly treatmentWindowHours: number
  readonly downtimeHours: number
  /** Medication-specific instruction stays outside this general educational tool. */
  readonly anticoagulationConcept: 'none'
}

export const CRRT_CONSTRUCTION_GROUP_IDS = [
  'who-is-being-treated',
  'blood-the-circuit-sees',
  'how-solute-moves',
  'what-leaves-the-patient',
  'how-the-circuit-is-protected',
  'how-much-of-the-window-runs',
] as const

export type CrrtConstructionGroupId = (typeof CRRT_CONSTRUCTION_GROUP_IDS)[number]

export type CrrtConstructionFieldId =
  | 'modalityViewId'
  | 'simulatedWeightKg'
  | 'hematocritPercent'
  | 'bloodFlowMlPerMinute'
  | 'preBloodPumpMlPerHour'
  | 'dialysateMlPerHour'
  | 'preReplacementMlPerHour'
  | 'postReplacementMlPerHour'
  | 'patientFluidRemovalMlPerHour'
  | 'makeupMlPerHour'
  | 'treatmentWindowHours'
  | 'downtimeHours'
  | 'anticoagulationConcept'

export interface CrrtConstructionGroup {
  readonly id: CrrtConstructionGroupId
  readonly ordinal: number
  readonly title: string
  /** Why this group is asked at this point and not earlier or later. */
  readonly causalNote: string
  readonly fieldIds: readonly CrrtConstructionFieldId[]
}

/**
 * The causal order. This is the whole point of stage 2: the dense form asked for twelve entries
 * at once with no statement of which one depends on which, and a learner filling it in had no way
 * to see that the patient-fluid-removal entry is the only one that decides what the patient loses.
 */
export const crrtConstructionGroups: readonly CrrtConstructionGroup[] = Object.freeze([
  Object.freeze({
    id: 'who-is-being-treated' as const,
    ordinal: 1,
    title: 'Who is being treated',
    causalNote:
      'These two entries are denominators, not therapy. Weight normalises the effluent display; haematocrit converts blood flow into plasma flow. Neither changes what the circuit does.',
    fieldIds: Object.freeze(['simulatedWeightKg', 'hematocritPercent'] as const),
  }),
  Object.freeze({
    id: 'blood-the-circuit-sees' as const,
    ordinal: 2,
    title: 'How much blood the circuit sees',
    causalNote:
      'Blood flow comes before every fluid decision, because it sets how much plasma the membrane is offered and it moves every pressure on the circuit whether or not anything else changes.',
    fieldIds: Object.freeze(['bloodFlowMlPerMinute'] as const),
  }),
  Object.freeze({
    id: 'how-solute-moves' as const,
    ordinal: 3,
    title: 'How solute is moved, and where each fluid enters',
    causalNote:
      'Choose the view first, then the flows that make it true. Dialysate runs along the far side of the membrane and never enters the patient; pre-filter fluid dilutes blood before the membrane; post-filter fluid is never filtered, so all of it reaches the patient.',
    fieldIds: Object.freeze([
      'modalityViewId',
      'dialysateMlPerHour',
      'preBloodPumpMlPerHour',
      'preReplacementMlPerHour',
      'postReplacementMlPerHour',
    ] as const),
  }),
  Object.freeze({
    id: 'what-leaves-the-patient' as const,
    ordinal: 4,
    title: 'What the patient actually loses',
    causalNote:
      'One entry, kept separate from everything above it. This is the only setting that decides net fluid loss; the effluent number will be far larger and is not the same quantity.',
    fieldIds: Object.freeze(['patientFluidRemovalMlPerHour', 'makeupMlPerHour'] as const),
  }),
  Object.freeze({
    id: 'how-the-circuit-is-protected' as const,
    ordinal: 5,
    title: 'How the circuit is protected',
    causalNote:
      'Named as a concept only. This module carries no medication quantity, and the circuit-protection decision belongs to the authorised local protocol and the responsible clinical team.',
    fieldIds: Object.freeze(['anticoagulationConcept'] as const),
  }),
  Object.freeze({
    id: 'how-much-of-the-window-runs' as const,
    ordinal: 6,
    title: 'How much of the window actually runs',
    causalNote:
      'Last, because it changes nothing about the prescription and everything about the therapy. A window with downtime in it delivers less than the same window without.',
    fieldIds: Object.freeze(['treatmentWindowHours', 'downtimeHours'] as const),
  }),
])

/**
 * The authored starting construction. These are practice values chosen to make the teaching
 * distinctions visible on first render — a large effluent beside a small patient loss — and they
 * are neither defaults, targets, nor a recommendation.
 */
export const CRRT_STARTING_CONSTRUCTION: CrrtPrescriptionConstruction = Object.freeze({
  modalityViewId: 'cvvhdf',
  simulatedWeightKg: 70,
  hematocritPercent: 30,
  bloodFlowMlPerMinute: 100,
  preBloodPumpMlPerHour: 200,
  dialysateMlPerHour: 1_000,
  preReplacementMlPerHour: 300,
  postReplacementMlPerHour: 500,
  patientFluidRemovalMlPerHour: 100,
  makeupMlPerHour: 0,
  treatmentWindowHours: 24,
  downtimeHours: 0,
  anticoagulationConcept: 'none',
})

export function crrtConstructionFlowRates(
  construction: CrrtPrescriptionConstruction,
): CrrtFlowRates {
  return Object.freeze({
    bloodFlowMlMin: construction.bloodFlowMlPerMinute,
    dialysateFlowMlHour: construction.dialysateMlPerHour,
    pbpFlowMlHour: construction.preBloodPumpMlPerHour,
    preReplacementFlowMlHour: construction.preReplacementMlPerHour,
    postReplacementFlowMlHour: construction.postReplacementMlPerHour,
    patientFluidRemovalMlHour: construction.patientFluidRemovalMlPerHour,
    syringeFlowMlHour: 0,
    makeupFlowMlHour: construction.makeupMlPerHour,
  })
}

/* ------------------------------------------------------------------ *
 * Stage 3 — predicted consequences
 * ------------------------------------------------------------------ */

/**
 * A single predicted quantity.
 *
 * `status` is the point of the type. `withheld` is not a formatting state: it means the registered
 * sources do not settle where a volume belongs, so no number exists to show. A withheld row is
 * never rendered as zero, as a stale previous value, or as a balanced result.
 */
export type CrrtPredictedValueStatus = 'available' | 'withheld' | 'unavailable-source-limited'

export interface CrrtPredictedValue {
  readonly id: string
  readonly label: string
  readonly status: CrrtPredictedValueStatus
  /** Null whenever `status` is not `available`. */
  readonly valueMlPerHour: number | null
  readonly unit: string
  /** What this number is, in one sentence. */
  readonly meaning: string
  /** Why it is withheld or unavailable. Null when available. */
  readonly withheldReason: string | null
  readonly sourceIds: readonly string[]
}

export interface CrrtPredictedIntensity {
  readonly prescribedEffluentRateMlPerHour: number
  readonly prescribedDoseMlPerKgHour: number
  readonly deliveredEffluentRateMlPerHour: number
  readonly deliveredDoseMlPerKgHour: number
  readonly deliveredHours: number
  readonly treatmentWindowHours: number
  readonly downtimeHours: number
  /** Zero when the whole window ran. Never presented as a target or a shortfall to correct. */
  readonly shortfallMlPerKgHour: number
  readonly separationIsVisible: boolean
  readonly statement: string
  readonly sourceIds: readonly string[]
}

export interface CrrtPredictedPathActivity {
  readonly pathId: CrrtCircuitPathId
  readonly label: string
  readonly textEquivalent: string
  readonly enteredRateMlPerHour: number | null
}

export interface CrrtModalityConsistencyNote {
  readonly fieldId: CrrtConstructionFieldId
  readonly expectation: 'must-be-running' | 'must-be-off'
  readonly statement: string
}

export interface CrrtPredictedCircuitView {
  readonly overlayId: CrrtCircuitOverlayId
  readonly overlayLabel: string
  readonly modality: CrrtModality
  readonly teachingPoint: string
  readonly textEquivalent: string
  readonly enteredActivePaths: readonly CrrtPredictedPathActivity[]
  readonly entersPatientPathLabels: readonly string[]
  readonly neverEntersPatientPathLabels: readonly string[]
  /** Empty when the entered flows match the view the learner chose. */
  readonly consistencyNotes: readonly CrrtModalityConsistencyNote[]
  readonly sourceIds: readonly string[]
}

export interface CrrtPredictedPressureImplication {
  readonly signalId: string
  readonly label: string
  readonly kind: CrrtPressureSignalKind
  readonly hasALocation: boolean
  readonly bloodFlowEffect: string
  readonly sourceIds: readonly string[]
}

export interface CrrtPredictedFiltrationBurden {
  readonly qualitative: QualitativePrePostDilutionResult
  readonly printedTotalPredilutionFraction: number | null
  readonly quantitativeStatus: 'unavailable-source-limited'
  readonly quantitativeReason: string
  readonly sourceIds: readonly string[]
}

export interface CrrtPredictedConsequences {
  readonly resolution: CrrtMachineFluidLedger['resolution']
  /** Null when the makeup attribution is resolved. */
  readonly withheldNotice: string | null
  readonly conflictId: typeof CRRT_MAKEUP_ATTRIBUTION_CONFLICT.id | null
  readonly circuitView: CrrtPredictedCircuitView
  /** The construction as engine flow rates, so the rendered circuit reads the same numbers. */
  readonly flows: CrrtFlowRates
  /**
   * The machine-readable statement of which fluid quantities this construction supports and which
   * are withheld. The learner sees these numbers once, in the circuit's own ledger — this module
   * has exactly one fluid ledger and stage 3 does not render a second copy of it. This array is
   * what the tests and the numeric review harness assert against.
   */
  readonly fluidValues: readonly CrrtPredictedValue[]
  readonly conservationChecks: readonly CrrtConservationCheck[]
  readonly intensity: CrrtPredictedIntensity
  readonly filtrationBurden: CrrtPredictedFiltrationBurden
  readonly pressureImplications: readonly CrrtPredictedPressureImplication[]
  readonly unavailableOutputs: readonly UnavailableWorkbenchOutput[]
  readonly modelBoundaries: readonly string[]
  readonly ledger: CrrtMachineFluidLedger
  readonly workbench: PrescriptionWorkbenchResult
  readonly sourceIds: readonly string[]
}

const WITHHELD_NOT_ZERO =
  'No number is shown because none exists to show. Substituting zero, or the value from before the makeup flow was entered, would report an attribution the sources do not make.'

/** Which construction entry keeps each modality view true, read off the overlay's own paths. */
const MODALITY_DEFINING_FIELDS: readonly {
  readonly pathId: CrrtCircuitPathId
  readonly fieldId: CrrtConstructionFieldId
  readonly fluidLabel: string
}[] = Object.freeze([
  Object.freeze({
    pathId: 'dialysate-supply' as const,
    fieldId: 'dialysateMlPerHour' as const,
    fluidLabel: 'Dialysate',
  }),
  Object.freeze({
    pathId: 'pre-filter-replacement' as const,
    fieldId: 'preReplacementMlPerHour' as const,
    fluidLabel: 'Pre-filter replacement fluid',
  }),
  Object.freeze({
    pathId: 'post-filter-replacement' as const,
    fieldId: 'postReplacementMlPerHour' as const,
    fluidLabel: 'Post-filter replacement fluid',
  }),
])

function enteredRateForPath(
  construction: CrrtPrescriptionConstruction,
  pathId: CrrtCircuitPathId,
): number | null {
  switch (pathId) {
    case 'dialysate-supply':
      return construction.dialysateMlPerHour
    case 'pre-filter-replacement':
      return construction.preReplacementMlPerHour
    case 'post-filter-replacement':
      return construction.postReplacementMlPerHour
    case 'pbp-citrate-infusion':
      return construction.preBloodPumpMlPerHour
    default:
      return null
  }
}

/**
 * Which paths the entered flows actually put fluid in — derived from the entries rather than from
 * the chosen view, so a mismatch between the two is visible instead of hidden.
 */
function enteredActivePaths(
  construction: CrrtPrescriptionConstruction,
  overlay: CrrtCircuitOverlay,
): readonly CrrtPredictedPathActivity[] {
  return Object.freeze(
    overlay.activePathIds.flatMap((pathId) => {
      const rate = enteredRateForPath(construction, pathId)
      if (rate !== null && rate === 0) return []
      const path = crrtCircuitPath(pathId)
      return [
        Object.freeze({
          pathId,
          label: path.label,
          textEquivalent: path.textEquivalent,
          enteredRateMlPerHour: rate,
        }),
      ]
    }),
  )
}

function modalityConsistencyNotes(
  construction: CrrtPrescriptionConstruction,
  overlay: CrrtCircuitOverlay,
): readonly CrrtModalityConsistencyNote[] {
  const active = new Set(overlay.activePathIds)
  const notes: CrrtModalityConsistencyNote[] = []

  for (const field of MODALITY_DEFINING_FIELDS) {
    const expected = active.has(field.pathId)
    const entered = enteredRateForPath(construction, field.pathId) ?? 0
    if (expected && entered === 0) {
      notes.push(
        Object.freeze({
          fieldId: field.fieldId,
          expectation: 'must-be-running',
          statement: `${overlay.label} draws ${field.fluidLabel.toLowerCase()} as running, and nothing is entered for it. The picture and the entries describe different therapies.`,
        }),
      )
    } else if (!expected && entered > 0) {
      notes.push(
        Object.freeze({
          fieldId: field.fieldId,
          expectation: 'must-be-off',
          statement: `${field.fluidLabel} is entered at ${entered} mL/h, but ${overlay.label} does not draw it. The label describes the transport intent; the entries decide what actually runs.`,
        }),
      )
    }
  }

  return Object.freeze(notes)
}

function predictedCircuitView(
  construction: CrrtPrescriptionConstruction,
): CrrtPredictedCircuitView {
  const overlay = crrtCircuitOverlay(construction.modalityViewId)
  if (overlay.modality === null) {
    throw new RangeError(
      `modalityViewId must name a modality view; ${construction.modalityViewId} is not one`,
    )
  }
  const destinations = crrtOverlayFluidDestinations(overlay)

  return Object.freeze({
    overlayId: overlay.id,
    overlayLabel: overlay.label,
    modality: overlay.modality,
    teachingPoint: overlay.teachingPoint,
    textEquivalent: crrtCircuitTextEquivalent(overlay.id),
    enteredActivePaths: enteredActivePaths(construction, overlay),
    entersPatientPathLabels: Object.freeze(
      destinations.entersPatient.map((id) => crrtCircuitPath(id).label),
    ),
    neverEntersPatientPathLabels: Object.freeze(
      destinations.neverEntersPatient.map((id) => crrtCircuitPath(id).label),
    ),
    consistencyNotes: modalityConsistencyNotes(construction, overlay),
    sourceIds: overlay.sourceIds,
  })
}

function fluidValues(ledger: CrrtMachineFluidLedger): readonly CrrtPredictedValue[] {
  const withheld = ledger.resolution === 'unresolved-makeup-attribution'
  const withheldReason = withheld ? `${ledger.unresolvedReason} ${WITHHELD_NOT_ZERO}` : null

  return Object.freeze([
    Object.freeze({
      id: 'total-effluent',
      label: 'Total effluent the pump must carry',
      status: 'available' as const,
      valueMlPerHour: ledger.totalEffluentMlHour,
      unit: 'mL/h',
      meaning:
        'Everything leaving by the fluid side: the dialysate that was never inside the patient, plus everything pulled across the membrane. This is not fluid the patient lost.',
      withheldReason: null,
      sourceIds: ledger.sourceIds,
    }),
    Object.freeze({
      id: 'entering-blood-path',
      label: 'Fluid entering the blood path',
      status: 'available' as const,
      valueMlPerHour: ledger.enteringBloodPathMlHour,
      unit: 'mL/h',
      meaning:
        'Pre-blood-pump fluid and both replacement ports. This fluid reaches the patient unless it is filtered off again.',
      withheldReason: null,
      sourceIds: ledger.sourceIds,
    }),
    Object.freeze({
      id: 'never-entering-patient',
      label: 'Fluid that never enters the patient',
      status: 'available' as const,
      valueMlPerHour: ledger.neverEnteringPatientMlHour,
      unit: 'mL/h',
      meaning:
        'Dialysate. It runs along the far side of the membrane and leaves in the effluent without ever joining the blood path.',
      withheldReason: null,
      sourceIds: ledger.sourceIds,
    }),
    Object.freeze({
      id: 'machine-removal-setting',
      label: 'Machine patient-fluid-removal setting',
      status: 'available' as const,
      valueMlPerHour: ledger.prescribedPatientFluidRemovalMlHour,
      unit: 'mL/h',
      meaning:
        'The entry you made in construction, echoed back. It is the prescription, not yet a result.',
      withheldReason: null,
      sourceIds: ledger.sourceIds,
    }),
    Object.freeze({
      id: 'crossing-membrane',
      label: 'Fluid crossing the membrane',
      status: withheld ? ('withheld' as const) : ('available' as const),
      valueMlPerHour: ledger.crossingMembraneMlHour,
      unit: 'mL/h',
      meaning:
        'Everything pulled from the blood side to the fluid side. It is larger than the patient’s loss because replacement and pre-blood-pump fluid are pulled off again alongside it.',
      withheldReason,
      sourceIds: ledger.sourceIds,
    }),
    Object.freeze({
      id: 'net-fluid-to-patient',
      label: 'Net fluid handed back to the patient',
      status: withheld ? ('withheld' as const) : ('available' as const),
      valueMlPerHour: ledger.netFluidToPatientMlHour,
      unit: 'mL/h',
      meaning:
        'The circuit’s side of the same exchange. Negative means the patient is losing fluid to the machine, which is the usual case.',
      withheldReason,
      sourceIds: ledger.sourceIds,
    }),
    Object.freeze({
      id: 'machine-recorded-removal',
      label: 'What the machine records as removed',
      status: withheld ? ('withheld' as const) : ('available' as const),
      valueMlPerHour: ledger.machinePatientFluidRemovalMlHour,
      unit: 'mL/h',
      meaning:
        'The device’s own patient-fluid-removed term. It still is not the whole-patient balance, which also needs the patient’s other inputs and outputs.',
      withheldReason,
      sourceIds: ledger.sourceIds,
    }),
  ])
}

/**
 * Prescribed versus delivered.
 *
 * The effluent rate comes from the ledger, not from `calculatePrescriptionWorkbench`. That
 * distinction is load-bearing rather than stylistic: the workbench holds the makeup term at zero
 * because it has no control for it, so with a makeup flow running its effluent target and the
 * ledger's total effluent are two different numbers for the same quantity. Reading the workbench
 * figure here put both on one page — the offline review harness caught it — which is precisely the
 * second calculation path C0/C1 forbids. The ledger's total effluent carries the makeup term the
 * way `MATH-PM-001` does, so it is the one that may be shown.
 *
 * Both dose figures then come from the engine's own `calculateEffluentDoseMlPerKgHour`; the only
 * thing added here is the window arithmetic, integrated with the engine's own unit helper. Neither
 * number is compared with a target, because the module has none.
 */
function predictedIntensity(
  construction: CrrtPrescriptionConstruction,
  ledger: CrrtMachineFluidLedger,
): CrrtPredictedIntensity {
  const windowHours = assertPositiveNumber(
    construction.treatmentWindowHours,
    'treatmentWindowHours',
  )
  const downtimeHours = assertNonNegativeNumber(construction.downtimeHours, 'downtimeHours')
  if (downtimeHours > windowHours) {
    throw new RangeError('downtimeHours must not exceed treatmentWindowHours')
  }

  const prescribedEffluentRateMlPerHour = ledger.totalEffluentMlHour
  const deliveredHours = windowHours - downtimeHours
  const deliveredEffluentMl = integrateMillilitersPerHourForHours(
    prescribedEffluentRateMlPerHour,
    deliveredHours,
  )
  const deliveredEffluentRateMlPerHour = deliveredEffluentMl / windowHours
  const deliveredDoseMlPerKgHour = calculateEffluentDoseMlPerKgHour(
    deliveredEffluentRateMlPerHour,
    construction.simulatedWeightKg,
  )
  const prescribedDoseMlPerKgHour = calculateEffluentDoseMlPerKgHour(
    prescribedEffluentRateMlPerHour,
    construction.simulatedWeightKg,
  )
  const shortfallMlPerKgHour = prescribedDoseMlPerKgHour - deliveredDoseMlPerKgHour

  return Object.freeze({
    prescribedEffluentRateMlPerHour,
    prescribedDoseMlPerKgHour,
    deliveredEffluentRateMlPerHour,
    deliveredDoseMlPerKgHour,
    deliveredHours,
    treatmentWindowHours: windowHours,
    downtimeHours,
    shortfallMlPerKgHour,
    separationIsVisible: downtimeHours > 0,
    statement:
      downtimeHours > 0
        ? `The circuit ran for ${deliveredHours} of ${windowHours} hours. The prescription was unchanged throughout, so the prescribed intensity is unchanged too — what fell is the intensity the window actually produced.`
        : `The circuit ran for the whole ${windowHours}-hour window, so prescribed and delivered intensity are the same number here. They stop being the same number as soon as any hour is lost.`,
    sourceIds: Object.freeze(['MATH-PM-001', 'DOSE-PM-001', 'GUID-RRT-ICU-2026']),
  })
}

function predictedFiltrationBurden(
  workbench: PrescriptionWorkbenchResult,
): CrrtPredictedFiltrationBurden {
  const quantitative = PRESCRIPTION_WORKBENCH_UNAVAILABLE_OUTPUTS.find(
    (output) => output.id === 'quantitative-ff',
  )
  if (!quantitative) throw new Error('The quantitative filtration-fraction boundary is missing.')

  return Object.freeze({
    qualitative: workbench.prePostExperiment,
    printedTotalPredilutionFraction: workbench.totalPredilutionFraction,
    quantitativeStatus: 'unavailable-source-limited' as const,
    quantitativeReason: quantitative.reason,
    sourceIds: Object.freeze([...quantitative.sourceRecordIds, 'SYNTH-LAB-PREPOST-001']),
  })
}

function predictedPressureImplications(): readonly CrrtPredictedPressureImplication[] {
  return Object.freeze(
    crrtPressureSignalDetails.map((detail) =>
      Object.freeze({
        signalId: detail.id,
        label: detail.label,
        kind: detail.kind,
        hasALocation: detail.kind === 'directly-modelled-site',
        bloodFlowEffect: detail.bloodFlowEffect,
        sourceIds: detail.sourceIds,
      }),
    ),
  )
}

const MODEL_BOUNDARIES: readonly string[] = Object.freeze([
  'These are predictions about a set of entries, not a recommendation for a patient. No entry combination here is marked correct, preferred, or adequate.',
  'No target range, normal range, or alarm limit appears anywhere in this builder, and none should be inferred from the practice starting values.',
  'The whole-patient fluid balance is not calculated: it also needs the patient’s other inputs, non-machine outputs, actual machine removal, and downtime, which are not entered here.',
  'Nothing here is a device screen, an operating instruction, or a substitute for current manufacturer instructions and the authorised local protocol.',
])

/**
 * The single entry point. Given a construction, report what it predicts.
 *
 * Fails closed: an entry the source-backed expressions cannot accept throws rather than being
 * clamped, and the caller renders every output as unavailable.
 */
export function calculateCrrtPredictedConsequences(
  construction: CrrtPrescriptionConstruction,
): CrrtPredictedConsequences {
  const workbench = calculatePrescriptionWorkbench({
    simulatedWeightKg: construction.simulatedWeightKg,
    hematocritPercent: construction.hematocritPercent,
    bloodFlowMlPerMinute: construction.bloodFlowMlPerMinute,
    preBloodPumpMlPerHour: construction.preBloodPumpMlPerHour,
    dialysateMlPerHour: construction.dialysateMlPerHour,
    preReplacementMlPerHour: construction.preReplacementMlPerHour,
    postReplacementMlPerHour: construction.postReplacementMlPerHour,
    patientFluidRemovalMlPerHour: construction.patientFluidRemovalMlPerHour,
    anticoagulationConcept: construction.anticoagulationConcept,
    solutionProfileId: null,
    syntheticBagCapacityMl: null,
    syntheticBagStream: 'dialysate',
  })

  const flows = crrtConstructionFlowRates(construction)
  const ledger = calculateCrrtMachineFluidLedger(flows)
  const withheld = ledger.resolution === 'unresolved-makeup-attribution'

  return Object.freeze({
    resolution: ledger.resolution,
    withheldNotice: withheld ? `${ledger.unresolvedReason} ${WITHHELD_NOT_ZERO}` : null,
    conflictId: withheld ? CRRT_MAKEUP_ATTRIBUTION_CONFLICT.id : null,
    circuitView: predictedCircuitView(construction),
    flows,
    fluidValues: fluidValues(ledger),
    conservationChecks: checkCrrtFluidConservation(ledger),
    intensity: predictedIntensity(construction, ledger),
    filtrationBurden: predictedFiltrationBurden(workbench),
    pressureImplications: predictedPressureImplications(),
    unavailableOutputs: workbench.unavailableOutputs,
    modelBoundaries: MODEL_BOUNDARIES,
    ledger,
    workbench,
    sourceIds: Object.freeze([
      ...new Set([
        ...workbench.sourceRecordIds,
        ...ledger.sourceIds,
        ...CRRT_CLEARANCE_VERSUS_REMOVAL_CONTRAST.sourceIds,
      ]),
    ]),
  })
}

/* ------------------------------------------------------------------ *
 * Provenance closure
 * ------------------------------------------------------------------ */

/**
 * Every citation this stage makes must resolve in the merged learner-facing registry, and this
 * throws at import if one does not — the same fail-closed contract the circuit already holds.
 */
export function unresolvedCrrtStagedPrescriptionSourceIds(): readonly string[] {
  const cited = new Set<string>()
  for (const option of crrtPrescriptionGoalOptions) {
    for (const id of option.sourceIds) cited.add(id)
  }
  for (const id of CRRT_CLEARANCE_VERSUS_REMOVAL_CONTRAST.sourceIds) cited.add(id)
  for (const id of CRRT_MAKEUP_ATTRIBUTION_CONFLICT.sourceRecordIds) cited.add(id)
  const sample = calculateCrrtPredictedConsequences(CRRT_STARTING_CONSTRUCTION)
  for (const id of sample.sourceIds) cited.add(id)
  for (const value of sample.fluidValues) {
    for (const id of value.sourceIds) cited.add(id)
  }
  for (const id of sample.intensity.sourceIds) cited.add(id)
  for (const id of sample.filtrationBurden.sourceIds) cited.add(id)
  for (const implication of sample.pressureImplications) {
    for (const id of implication.sourceIds) cited.add(id)
  }
  for (const id of sample.circuitView.sourceIds) cited.add(id)
  for (const output of sample.unavailableOutputs) {
    for (const id of output.sourceRecordIds) cited.add(id)
  }
  return unresolvableCrrtSourceIds(cited)
}

const unresolvedAtImport = unresolvedCrrtStagedPrescriptionSourceIds()
if (unresolvedAtImport.length > 0) {
  throw new Error(
    `CRRT staged prescription builder cites source records that do not exist: ${unresolvedAtImport.join(', ')}`,
  )
}
