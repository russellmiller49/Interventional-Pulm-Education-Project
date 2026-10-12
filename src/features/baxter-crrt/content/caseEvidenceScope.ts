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
 * not simulation. CRRT-12 (CRRT-FELLOW-06 F06-01) promised changing electrolyte,
 * temperature, medication and nutrition trends during an interruption; the fixture
 * carries one case-start record, the patient model never writes temperature, no
 * medication or nutrition quantity exists, and the run starts with delivery running.
 *
 * Teaching-first revision (2026-10-08): CRRT-12, CRRT-17 and CRRT-18 now state their
 * laboratory values in the case description and mirror them in the fixture, so the entries
 * for those cases say where to find the values and what the run does not advance. They no
 * longer list every missing model.
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
  'temperature',
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
      'This case compares where replacement fluid enters the circuit. The flows change as you set them; the simulator does not change clearance or filter pressure with the split, so read those from the teaching below.',
    suppliedEvidenceFieldIds: [],
    absentEvidence: [
      {
        label: 'Filtration fraction for each split',
        reason:
          'The engine carries filtration fraction as a fixed model coefficient, not a quantity calculated from the flows, so it does not differ between the two splits here. Work it out by hand: fluid across the membrane divided by plasma flow plus pre-filter fluid.',
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
        text: 'PrisMax presents total predilution and filtration fraction as calculations from the circuit flows. Post-filter replacement raises filtration fraction; pre-filter replacement lowers it.',
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
        text: 'After any change in fluid removal, go back to the patient: blood pressure, vasopressor dose and perfusion over the next hour.',
        sourceIds: [RRT_ICU],
      },
    ],
  },
  {
    caseId: 'CRRT-12',
    headline:
      'The case description gives this morning’s results. The machine beside it shows what CRRT has delivered: dose, downtime and the fluid ledger.',
    suppliedEvidenceFieldIds: ['potassium', 'bicarbonate', 'ph', 'temperature'],
    absentEvidence: [
      {
        label: 'Repeat results after you act',
        reason:
          'The laboratory values are the ones in the case description. They are a single set and stay as they are while the run advances.',
      },
    ],
    modelCalculates: [
      'Delivered dose, elapsed time and downtime, as they occur in this run.',
      'The whole-patient fluid ledger: machine removal plus the other inputs and outputs.',
      'The current settings and the circuit pressures.',
    ],
    modelDoesNotModel: [
      'Electrolyte replacement, temperature, drug clearance or nutrition. Your plan is recorded and the debrief explains what each move would do.',
    ],
    furtherTeaching: [
      {
        text: 'Compare the dose prescribed with the dose delivered over the same hours before you link a result to the treatment. Downtime is the usual gap.',
        sourceIds: [RRT_ICU],
      },
      {
        text: 'What crosses the membrane is decided by size and protein binding. Phosphate, potassium, magnesium, amino acids and many antibiotics are small and unbound, so they are cleared with the urea.',
        sourceIds: [CORE_REVIEW],
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
          'The actions in this case record your plan. The circuit beside the case keeps running as it is.',
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
      'The case description gives the calcium, acid-base and lactate results. Work out the total-to-ionized calcium ratio yourself, in mmol/L: the description gives total calcium as 2.75 mmol/L.',
    suppliedEvidenceFieldIds: ['systemic-ionized-calcium', 'total-calcium', 'bicarbonate', 'ph'],
    absentEvidence: [
      {
        label: 'Repeat calcium and blood gas after you act',
        reason:
          'The laboratory values are the ones in the case description. They are a single set and stay as they are while the run advances.',
      },
    ],
    modelCalculates: [
      'The circuit and delivery picture: pressures, delivered dose, downtime and the fluid ledger.',
    ],
    modelDoesNotModel: [
      'Citrate and calcium infusions or their effect. The machine beside the case runs without anticoagulant; your plan is recorded and the debrief explains what it would do.',
    ],
    furtherTeaching: [
      {
        text: 'Post-filter ionized calcium tells you whether the circuit is anticoagulated. Systemic ionized calcium tells you whether the patient is safe. A good post-filter value says nothing about the patient.',
        sourceIds: [SAMPLING],
      },
      {
        text: 'Citrate that is not removed in the effluent returns to the patient and is metabolized mainly in the liver. When the liver cannot do it, citrate accumulates however well the circuit is running.',
        sourceIds: [MECHANISM],
      },
      {
        text: 'The anticoagulation lesson compares four patterns side by side: too little citrate effect in the circuit, too little calcium replacement, accumulation, and citrate alkalosis.',
        sourceIds: [SAMPLING, CORE_REVIEW],
      },
    ],
  },
  {
    caseId: 'CRRT-18',
    headline:
      'The case description gives the urine output and the clinical course. The decision to stop is yours; ending a treatment on the machine is a separate step that follows it.',
    suppliedEvidenceFieldIds: ['creatinine-marker', 'urine-output'],
    absentEvidence: [
      {
        label: 'The days after stopping',
        reason:
          'The run ends when the case does. The debrief describes what to measure each day off treatment and what would make you restart.',
      },
    ],
    modelCalculates: [
      'Delivered dose, downtime, the fluid ledger including urine output, and the machine’s stop and end steps.',
    ],
    modelDoesNotModel: [
      'Kidney recovery over time. Urine output is a fixed rate in the fluid ledger for the length of the run.',
    ],
    furtherTeaching: [
      {
        text: 'Deciding that kidney support is no longer needed is a clinical decision about the whole patient. Stop and End on the machine carry it out; they do not make it.',
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
