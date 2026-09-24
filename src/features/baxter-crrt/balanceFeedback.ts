/**
 * Feedback for an entered whole-patient fluid balance (CRRT-FELLOW-04, F-21).
 *
 * The learner's number is compared with the recorded arithmetic, the ledger categories and the
 * sign convention are named, and the complete worked calculation is always part of the result —
 * nothing waits for a second miss, and nothing here counts attempts.
 *
 * A specific diagnosis is given only when the entered value is exactly what one single error
 * produces from this run's own numbers, and no other listed error produces the same value. Any
 * other wrong number gets the general hint, because a number alone does not say how it was made.
 * Two routes to the same arithmetic slip are described as one error, not as a guess between them:
 * using total effluent in place of net removal, and subtracting the circuit's own fluids as well,
 * leave the same number whenever effluent is net removal plus those fluids.
 *
 * A missing urine record makes the exact balance unavailable. It is never treated as zero.
 */

/** The recorded chart the learner reads; mirrors `crrtRecordedFluidChart`. */
export interface CrrtBalanceChart {
  readonly externalInputMl: number
  readonly urineMl: number | null
  readonly otherOutputMl: number
  readonly removalMl: number | null
  readonly additionalDeviceGainMl: number
  readonly balanceMl: number | null
}

export interface CrrtBalanceRunContext {
  /** The charting window the totals cover, in hours. */
  readonly windowHours: number
  /** Total effluent actually produced over the same window, in mL. */
  readonly effluentMl: number | null
}

export type CrrtBalanceFeedbackStatus = 'matches' | 'does-not-match' | 'unavailable'

export interface CrrtBalanceLedgerLine {
  readonly id: 'intake' | 'urine' | 'other-output' | 'net-removal' | 'device-gain'
  readonly label: string
  readonly operation: 'add' | 'subtract'
  /** Null when this chart does not record the term. */
  readonly valueMl: number | null
  readonly note: string
}

export type CrrtBalanceErrorId =
  | 'sign-reversed'
  | 'urine-left-out'
  | 'other-output-left-out'
  | 'net-removal-left-out'
  | 'net-removal-added'
  | 'intake-left-out'
  | 'circuit-fluids-counted'
  | 'effluent-also-subtracted'
  | 'net-removal-as-balance'
  | 'per-hour-average'
  | 'liters-not-milliliters'
  | 'device-gain-left-out'
  | 'device-gain-subtracted'

export interface CrrtBalanceDiagnosis {
  readonly kind: 'specific' | 'general'
  readonly errorId: CrrtBalanceErrorId | null
  readonly text: string
}

export interface CrrtBalanceFeedback {
  readonly status: CrrtBalanceFeedbackStatus
  readonly enteredMl: number | null
  readonly recordedMl: number | null
  /** Entered minus recorded, when both exist. */
  readonly differenceMl: number | null
  readonly ledger: readonly CrrtBalanceLedgerLine[]
  /** The worked calculation in one line, labelled term by term. */
  readonly workedCalculation: string
  readonly signConvention: string
  readonly unitsAndWindow: string
  readonly notInLedger: string
  readonly diagnosis: CrrtBalanceDiagnosis | null
}

/** The same half-milliliter tolerance the check itself uses. */
export const CRRT_BALANCE_TOLERANCE_ML = 0.5

export const CRRT_BALANCE_GENERAL_HINT =
  'Recheck which flows cross the patient boundary and the sign of net machine removal: intake adds to the patient; urine, other non-CRRT output and net CRRT removal take away; circuit fluids such as dialysate are already inside net removal.' as const

export const CRRT_BALANCE_SIGN_CONVENTION =
  'Positive means the patient gained fluid over the window; negative means a net loss. Intake adds; urine, other non-CRRT output and net CRRT removal subtract; any additional device net gain adds once.' as const

export const CRRT_BALANCE_NOT_IN_LEDGER =
  'Not in this ledger: effluent, dialysate, replacement and PBP fluid. They are circuit flows, already accounted for inside net CRRT removal, so adding or subtracting them again counts them twice.' as const

export function formatCrrtBalanceMl(value: number | null, signed = false): string {
  if (value === null) return 'not recorded'
  const rounded = Math.round(value * 10) / 10
  const magnitude = Math.abs(rounded).toLocaleString('en-US', { maximumFractionDigits: 1 })
  if (rounded === 0) return '0 mL'
  if (!signed) return `${rounded < 0 ? '−' : ''}${magnitude} mL`
  return `${rounded > 0 ? '+' : '−'}${magnitude} mL`
}

function ledgerLines(chart: CrrtBalanceChart): readonly CrrtBalanceLedgerLine[] {
  return [
    {
      id: 'intake',
      label: 'External intake',
      operation: 'add',
      valueMl: chart.externalInputMl,
      note: 'maintenance, medication carriers, nutrition, blood products and boluses',
    },
    {
      id: 'urine',
      label: 'Urine output',
      operation: 'subtract',
      valueMl: chart.urineMl,
      note: 'a non-CRRT output',
    },
    {
      id: 'other-output',
      label: 'Other non-CRRT output',
      operation: 'subtract',
      valueMl: chart.otherOutputMl,
      note: 'drains and other outputs',
    },
    {
      id: 'net-removal',
      label: 'Net CRRT removal',
      operation: 'subtract',
      valueMl: chart.removalMl,
      note: 'net machine fluid removal, set as PFR on PrisMax; counted once',
    },
    {
      id: 'device-gain',
      label: 'Additional device net gain',
      operation: 'add',
      valueMl: chart.additionalDeviceGainMl,
      note: 'added once',
    },
  ]
}

/** Lowercase the first letter only, so acronyms such as CRRT keep their case. */
function sentenceCase(label: string): string {
  return `${label.charAt(0).toLowerCase()}${label.slice(1)}`
}

function workedCalculation(
  ledger: readonly CrrtBalanceLedgerLine[],
  recordedMl: number | null,
): string {
  const terms = ledger.map((line, index) => {
    const value = line.valueMl === null ? 'not recorded' : formatCrrtBalanceMl(line.valueMl)
    const sign = index === 0 ? '' : line.operation === 'add' ? '+ ' : '− '
    return `${sign}${sentenceCase(line.label)} ${value}`
  })
  return `${terms.join(' ')} = ${recordedMl === null ? 'unavailable' : formatCrrtBalanceMl(recordedMl, true)}`
}

interface Variant {
  readonly id: CrrtBalanceErrorId
  readonly valueMl: number
  readonly text: string
}

function variants(
  chart: CrrtBalanceChart,
  recorded: number,
  context: CrrtBalanceRunContext,
): readonly Variant[] {
  const urine = chart.urineMl ?? 0
  const removal = chart.removalMl ?? 0
  const intake = chart.externalInputMl
  const other = chart.otherOutputMl
  const gain = chart.additionalDeviceGainMl
  const effluent = context.effluentMl
  const list: Variant[] = []
  const add = (condition: boolean, id: CrrtBalanceErrorId, valueMl: number, text: string) => {
    if (condition && Number.isFinite(valueMl)) list.push({ id, valueMl, text })
  }
  add(
    recorded !== 0,
    'sign-reversed',
    -recorded,
    'Your entry has the right size but the opposite sign. A gain is positive and a loss is negative.',
  )
  add(
    urine !== 0,
    'urine-left-out',
    recorded + urine,
    `Your entry is what the calculation gives with urine output (${formatCrrtBalanceMl(urine)}) left out. Urine is a non-CRRT output and is subtracted.`,
  )
  add(
    other !== 0,
    'other-output-left-out',
    recorded + other,
    `Your entry is what the calculation gives with other non-CRRT output (${formatCrrtBalanceMl(other)}) left out. It is subtracted.`,
  )
  add(
    removal !== 0,
    'net-removal-left-out',
    recorded + removal,
    `Your entry is what the calculation gives with net CRRT removal (${formatCrrtBalanceMl(removal)}) left out. Net machine removal leaves the patient and is subtracted once.`,
  )
  add(
    removal !== 0,
    'net-removal-added',
    recorded + 2 * removal,
    `Your entry is what the calculation gives with net CRRT removal (${formatCrrtBalanceMl(removal)}) added instead of subtracted.`,
  )
  add(
    intake !== 0,
    'intake-left-out',
    recorded - intake,
    `Your entry is what the calculation gives with external intake (${formatCrrtBalanceMl(intake)}) left out. Intake adds to the patient.`,
  )
  add(
    removal !== 0 && recorded !== -removal,
    'net-removal-as-balance',
    -removal,
    `Your entry equals net CRRT removal alone (${formatCrrtBalanceMl(-removal, true)}). Machine removal is one term of the patient ledger, not the whole-patient balance.`,
  )
  if (effluent !== null && effluent > 0) {
    const circuitFluids = effluent - removal
    add(
      circuitFluids > 0,
      'circuit-fluids-counted',
      recorded - circuitFluids,
      `Your entry is ${formatCrrtBalanceMl(circuitFluids)} lower than the balance — exactly the fluid the circuit itself added (dialysate and any replacement, PBP or syringe fluid). That is what happens when total effluent (${formatCrrtBalanceMl(effluent)}) is used in place of net CRRT removal (${formatCrrtBalanceMl(removal)}), or when those circuit fluids are subtracted as well. Only net removal belongs in the patient ledger.`,
    )
    add(
      true,
      'effluent-also-subtracted',
      recorded - effluent,
      `Your entry is what the calculation gives with total effluent (${formatCrrtBalanceMl(effluent)}) subtracted as well as net CRRT removal. Effluent is a circuit flow, not a patient output.`,
    )
  }
  add(
    context.windowHours > 1 && recorded !== 0,
    'per-hour-average',
    recorded / context.windowHours,
    `Your entry is the balance divided by the ${context.windowHours}-hour window — an hourly average. The question asks for the total over the whole window, in mL.`,
  )
  add(
    Math.abs(recorded) >= 1,
    'liters-not-milliliters',
    recorded / 1000,
    'Your entry is the balance written in liters. Enter the total in milliliters (mL).',
  )
  add(
    gain !== 0,
    'device-gain-left-out',
    recorded - gain,
    `Your entry is what the calculation gives with the additional device net gain (${formatCrrtBalanceMl(gain)}) left out. It is added once.`,
  )
  add(
    gain !== 0,
    'device-gain-subtracted',
    recorded - 2 * gain,
    `Your entry is what the calculation gives with the additional device net gain (${formatCrrtBalanceMl(gain)}) subtracted instead of added.`,
  )
  return list
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < CRRT_BALANCE_TOLERANCE_ML
}

/** A cached balance cannot establish availability when a required ledger term is absent. */
function availableBalance(chart: CrrtBalanceChart): number | null {
  return [
    chart.externalInputMl,
    chart.urineMl,
    chart.otherOutputMl,
    chart.removalMl,
    chart.additionalDeviceGainMl,
    chart.balanceMl,
  ].every((value) => value !== null && Number.isFinite(value))
    ? chart.balanceMl
    : null
}

/**
 * Only a value that exactly one listed slip produces — and that the correct arithmetic does not —
 * earns a specific statement. Every other wrong value gets the general hint.
 */
export function diagnoseCrrtBalanceEntry(
  enteredMl: number,
  chart: CrrtBalanceChart,
  context: CrrtBalanceRunContext,
): CrrtBalanceDiagnosis | null {
  const recorded = availableBalance(chart)
  if (recorded === null || near(enteredMl, recorded)) return null
  const matching = variants(chart, recorded, context).filter(
    // Count every candidate near the entry, including one also near the correct balance.
    // Tolerance neighborhoods can overlap; excluding that candidate falsely creates uniqueness.
    (variant) => near(variant.valueMl, enteredMl),
  )
  if (matching.length === 1) {
    return { kind: 'specific', errorId: matching[0].id, text: matching[0].text }
  }
  return { kind: 'general', errorId: null, text: CRRT_BALANCE_GENERAL_HINT }
}

export function selectCrrtBalanceFeedback(
  enteredMl: number | null,
  chart: CrrtBalanceChart,
  context: CrrtBalanceRunContext,
): CrrtBalanceFeedback {
  const ledger = ledgerLines(chart)
  const recorded = availableBalance(chart)
  const unitsAndWindow = `Every term is a recorded total in mL over the same ${context.windowHours}-hour charting window. An hourly rate, a liter value or a total from another window does not belong in this sum.`
  const base = {
    ledger,
    workedCalculation: workedCalculation(ledger, recorded),
    signConvention: CRRT_BALANCE_SIGN_CONVENTION,
    unitsAndWindow,
    notInLedger: CRRT_BALANCE_NOT_IN_LEDGER,
  }
  if (recorded === null) {
    return {
      ...base,
      status: 'unavailable',
      enteredMl,
      recordedMl: null,
      differenceMl: null,
      diagnosis: {
        kind: 'general',
        errorId: null,
        text:
          chart.urineMl === null
            ? 'Urine output is not recorded, so the exact whole-patient balance is unavailable. A missing record is not zero; reconcile it before reporting a balance.'
            : 'A term this balance needs is unavailable in this run, so no exact balance can be reported.',
      },
    }
  }
  if (enteredMl === null) {
    return {
      ...base,
      status: 'does-not-match',
      enteredMl: null,
      recordedMl: recorded,
      differenceMl: null,
      diagnosis: null,
    }
  }
  const matches = near(enteredMl, recorded)
  return {
    ...base,
    status: matches ? 'matches' : 'does-not-match',
    enteredMl,
    recordedMl: recorded,
    differenceMl: enteredMl - recorded,
    diagnosis: matches ? null : diagnoseCrrtBalanceEntry(enteredMl, chart, context),
  }
}
