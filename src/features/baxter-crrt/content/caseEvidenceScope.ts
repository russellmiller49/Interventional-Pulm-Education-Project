import type { CrrtCaseId } from './schema'

/**
 * What a case can actually show, stated in the task rather than only after a
 * reveal.
 *
 * Several cases describe evidence they do not carry. CRRT-17 names "linked
 * calcium, acid-base, circuit and treatment-delivery trends" and a conceptual
 * dashboard of trend directions; the fixture carries one systemic ionized calcium
 * value at case start, `totalCalciumMgPerDl` is null so no total/ionized
 * relationship can be formed, the schema has no post-filter sample at all, and
 * `circuit.citrate.linkedTrendDirections` is hard-wired to `unknown` and rendered
 * nowhere. CRRT-18 says recovery signals are improving; the fixture carries one
 * creatinine value, a constant 5 mL/h urine output and zero residual kidney
 * clearance, at one time point. CRRT-05 asks about the dilution tradeoff while
 * the model holds the concentration reaching the filter and the filtration
 * fraction constant. CRRT-16 describes several failed circuits that are history,
 * not simulation.
 *
 * Every line here is a statement about this repository — a fixture field, an
 * engine constant, or an already-registered source. Nothing here supplies a
 * clinical value, a threshold or a trend. The missing models stay missing; the
 * point is that the learner is told so before committing, not after.
 */

/** Supplied case values this block can read out of `initialPatient`. */
export const crrtSuppliedEvidenceFieldIds = [
  'systemic-ionized-calcium',
  'total-calcium',
  'creatinine-marker',
  'urine-output',
  'residual-kidney-clearance',
  'potassium',
  'bicarbonate',
  'ph',
] as const

export type CrrtSuppliedEvidenceFieldId = (typeof crrtSuppliedEvidenceFieldIds)[number]

export interface CrrtAbsentEvidence {
  readonly label: string
  /** Why it is absent, in terms of the fixture, schema or engine. */
  readonly reason: string
}

export interface CrrtScopeTeachingPointer {
  readonly text: string
  readonly sourceIds: readonly string[]
}

export interface CrrtCaseEvidenceScope {
  readonly caseId: CrrtCaseId
  readonly headline: string
  readonly suppliedEvidenceFieldIds: readonly CrrtSuppliedEvidenceFieldId[]
  readonly absentEvidence: readonly CrrtAbsentEvidence[]
  /** What the simulation does compute for this case's phenomenon. */
  readonly modelCalculates: readonly string[]
  /** What it does not model, so no learner infers a tradeoff from an equal number. */
  readonly modelDoesNotModel: readonly string[]
  readonly furtherTeaching: readonly CrrtScopeTeachingPointer[]
}

const SAMPLING = 'CITRATE-SIAARTI-2023-SAMPLING'
const MECHANISM = 'CITRATE-SIAARTI-2023-MECHANISM'
const CORE_REVIEW = 'REVIEW-CKRT-CORE-2025'
const NICE = 'GUID-NICE-NG148-2024'
const RRT_ICU = 'GUID-RRT-ICU-2026'
const PRISMAX_FF = 'MATH-PM-003'
const PRISMAX_PRESSURE = 'DEV-PM-009'

const scopes: readonly CrrtCaseEvidenceScope[] = Object.freeze([
  {
    caseId: 'CRRT-05',
    headline:
      'This case compares where replacement fluid enters the circuit. The flow split is real; the clearance consequence of diluting blood before the filter is not modeled.',
    suppliedEvidenceFieldIds: [],
    absentEvidence: [
      {
        label: 'Filtration fraction for each split',
        reason:
          'The engine carries filtration fraction as a fixed model coefficient, not a quantity calculated from the flows, so it cannot differ between the two splits. The PrisMax expressions that would calculate it are held for device review.',
      },
      {
        label: 'Concentration of blood reaching the filter',
        reason:
          'The solute model uses a constant filter-inlet fraction, so moving fluid before the filter does not change the concentration the filter sees.',
      },
    ],
    modelCalculates: [
      'The pre- and post-filter replacement flows you set, and that their total is unchanged.',
      'The effluent pump target and the prescribed effluent dose, from the flows and body weight.',
      'Delivered dose, downtime, the fluid ledger and the four measured circuit pressures.',
    ],
    modelDoesNotModel: [
      'Any effect of pre-filter dilution on clearance, filter burden, filter pressure or TMP. After the split, those values are identical because nothing couples them to the split — not because the split makes no clinical difference.',
    ],
    furtherTeaching: [
      {
        text: 'Pre-filter replacement can lower the solute concentration presented to the filter and change clearance per liter of effluent; post-filter replacement preserves that concentration but can concentrate blood inside the filter. Neither split is universally preferred.',
        sourceIds: [CORE_REVIEW],
      },
      {
        text: 'PrisMax presents total predilution and filtration fraction as calculations from the circuit flows. This module calculates neither, because the device expression it would need is held for review.',
        sourceIds: [PRISMAX_FF],
      },
    ],
  },
  {
    caseId: 'CRRT-11',
    headline:
      'This case is about fluid-removal tolerance. The signals that separate one path from another are bounded model indices and the fluid ledger, not a blood pressure.',
    suppliedEvidenceFieldIds: ['potassium', 'bicarbonate', 'ph'],
    absentEvidence: [
      {
        label: 'Blood-pressure, heart-rate or vasopressor response to your change',
        reason:
          'The patient model advances a tolerance-stress index and an intravascular reserve. It never writes mean arterial pressure, heart rate or vasopressor support, so those hold their supplied values for the whole run.',
      },
      {
        label: 'Lactate or any perfusion marker over time',
        reason: 'No such quantity exists in the patient fixture or the engine.',
      },
    ],
    modelCalculates: [
      'Machine fluid removal, the whole-patient fluid balance, delivered dose and downtime.',
      'A bounded tolerance-stress index and the intravascular reserve remaining.',
    ],
    modelDoesNotModel: [
      'Any hemodynamic response to removing fluid. An unchanged mean arterial pressure after an unsafe removal rate is the model holding a supplied value, not evidence that the rate was tolerated.',
    ],
    furtherTeaching: [
      {
        text: 'Reassessment after a fluid-removal change belongs with the patient, the monitoring available and the local protocol, not with a single displayed number.',
        sourceIds: [RRT_ICU],
      },
    ],
  },
  {
    caseId: 'CRRT-15',
    headline:
      'This case is about localizing a pressure trend by reading the signals together. The run starts from a stable circuit and the filter trend over six hours is very small.',
    suppliedEvidenceFieldIds: [],
    absentEvidence: [
      {
        label: 'A readable filter-pressure trend within the run',
        reason:
          'The filter burden coefficients are slow: filter pressure rises well under a millimeter of mercury across six simulated hours, so the run cannot demonstrate a trend you could localize from the number alone. The pressure-location exercise teaches the pattern instead.',
      },
    ],
    modelCalculates: [
      'The four measured pressures, the filter pressure drop and TMP, and how they move with blood flow and with added resistance.',
      'Delivered dose, downtime and the fluid ledger.',
    ],
    modelDoesNotModel: [
      'Anticoagulation, and any rate of filter loss you could read off this run.',
    ],
    furtherTeaching: [
      {
        text: 'A pressure pattern tells you where resistance changed, not why. Read the measured sites separately, and note the blood flow they were read at, before calling a trend.',
        sourceIds: [PRISMAX_PRESSURE],
      },
    ],
  },
  {
    caseId: 'CRRT-16',
    headline:
      'The repeated filter losses in this case are supplied history. They are described, not simulated: the current circuit is running and your actions here record a plan.',
    suppliedEvidenceFieldIds: [],
    absentEvidence: [
      {
        label: 'The earlier failed circuits',
        reason:
          'They exist only in the case description. No earlier circuit, filter change or downtime from them is in the simulation, so no trend from them can be read.',
      },
      {
        label: 'A filter exchange, or any effect of your plan on this circuit',
        reason:
          'Every action in this case carries no simulated effect. Choosing an explanation, planning an exchange or escalating records what you would do; it does not change the running circuit, and no filter-loss model exists to respond to it.',
      },
    ],
    modelCalculates: [
      'The current circuit: measured pressures, filter pressure drop, TMP, delivered dose, downtime and the fluid ledger.',
    ],
    modelDoesNotModel: [
      'Recurrent filter loss, filter failure over time, anticoagulation, or the response of any of those to a corrective plan.',
    ],
    furtherTeaching: [
      {
        text: 'Access dysfunction, the concentration effect of post-filter replacement, interruptions and anticoagulation can combine rather than act alone; a structured summary names the verified contributors and the questions that remain.',
        sourceIds: [CORE_REVIEW],
      },
    ],
  },
  {
    caseId: 'CRRT-17',
    headline:
      'This case is about recognizing that circuit anticoagulation and patient calcium are different questions, and escalating. The calcium data it would take to read a citrate-accumulation pattern is not in this case.',
    suppliedEvidenceFieldIds: ['systemic-ionized-calcium', 'total-calcium', 'bicarbonate', 'ph'],
    absentEvidence: [
      {
        label: 'A post-filter (circuit) ionized calcium',
        reason:
          'The patient fixture has no circuit or post-filter sample field at all, so the sample that describes circuit anticoagulant effect cannot be shown.',
      },
      {
        label: 'Serial calcium values, or any calcium trend',
        reason:
          'The case supplies one systemic value at case start. There is no second time point, and the simulation does not model how calcium changes.',
      },
      {
        label: 'A total/ionized calcium relationship',
        reason:
          'Total calcium is not supplied for this case, so no relationship between total and ionized calcium can be formed. Absent is not zero and not normal.',
      },
      {
        label: 'Citrate delivery, calcium replacement, or their interruption',
        reason:
          'No citrate or calcium infusion quantity exists anywhere in the engine. The module carries no dose, target or adjustment.',
      },
      {
        label: 'The linked trend-direction display',
        reason:
          'The conceptual citrate state carries every linked direction as unknown for every case and is not rendered on any learner surface.',
      },
    ],
    modelCalculates: [
      'The circuit and delivery context: measured pressures, delivered dose, downtime and the fluid ledger.',
    ],
    modelDoesNotModel: [
      'Citrate physiology, calcium kinetics, citrate accumulation, or any threshold that would separate those patterns.',
    ],
    furtherTeaching: [
      {
        text: 'Post-filter ionized calcium describes anticoagulant effect inside the circuit; a systemic sample cannot replace it, and a satisfactory circuit sample does not establish patient calcium safety. The sampling site is what separates the two questions.',
        sourceIds: [SAMPLING],
      },
      {
        text: 'Citrate not removed in the effluent returns to the patient to be metabolized, which is why impaired metabolism is a systemic question rather than a circuit-dose question.',
        sourceIds: [MECHANISM],
      },
      {
        text: 'The four-pattern comparison in the anticoagulation lesson works through insufficient circuit effect, inadequate calcium replacement, accumulation and citrate-associated alkalosis, each with the sampling domain it belongs to.',
        sourceIds: [SAMPLING, CORE_REVIEW],
      },
    ],
  },
  {
    caseId: 'CRRT-18',
    headline:
      'This case is about keeping the clinical decision to stop kidney support separate from the machine stop and end controls. It carries no recovery trajectory to read.',
    suppliedEvidenceFieldIds: ['creatinine-marker', 'urine-output', 'residual-kidney-clearance'],
    absentEvidence: [
      {
        label: 'A recovery trend',
        reason:
          'The case supplies one creatinine value at case start, a constant urine output and zero residual kidney clearance. There is no second time point and no improving signal; the supplied urine output does not change during the run.',
      },
      {
        label: 'Recovering kidney function',
        reason:
          'The engine has no model of returning kidney function: residual clearance is a fixed fixture input, and urine output is a fixed external rate in the fluid ledger.',
      },
      {
        label: 'Serial chemistry after stopping treatment',
        reason:
          'Nothing continues after the run, and no post-treatment observation exists in the case.',
      },
    ],
    modelCalculates: [
      'Delivered dose, downtime, the fluid ledger including the supplied urine output, and the machine stop and end workflow.',
    ],
    modelDoesNotModel: [
      'Renal recovery, a falling creatinine, rising urine output, or clearance returning. Those are the signals the decision would rest on, and this exercise does not produce them.',
    ],
    furtherTeaching: [
      {
        text: 'Whether kidney support is still needed is a clinical decision about the whole patient, taken with the responsible team; the machine stop and end controls are a separate operation that follows it.',
        sourceIds: [NICE, RRT_ICU],
      },
    ],
  },
])

const scopeByCaseId = new Map(scopes.map((scope) => [scope.caseId, scope]))

export function getCrrtCaseEvidenceScope(caseId: string): CrrtCaseEvidenceScope | undefined {
  return scopeByCaseId.get(caseId as CrrtCaseId)
}

export const crrtCaseEvidenceScopes = scopes
