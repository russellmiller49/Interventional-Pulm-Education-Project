import { prismaxCalculationAdapter } from './engine/deviceAdapters/calculations'
import {
  PRISMAX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG,
  PRISMAX_FILTER_PRESSURE_DROP_SOURCE_ID,
  PRISMAX_TMP_HYDROSTATIC_OFFSET_MMHG,
  PRISMAX_TMP_SOURCE_ID,
} from './engine/pressureModel'

/**
 * Presentation of the arithmetic the PrisMax calculation adapter already performs (F-14).
 *
 * Nothing here is a formula of its own. The result is always the adapter's own
 * `calculateDisplayedPressures` output for the same three raw readings, so the worked line a
 * learner reads cannot drift from the number on the tile. The two correction terms are the
 * engine's constants, imported, never restated: −18 mmHg is printed in the AW8035 displayed-TMP
 * expression; applying −25 mmHg to the drop is this model's reading of the manual and remains
 * held for device review (G01-CRRT-02 / O-04). Showing either term neatly does not verify it.
 */

export type CrrtCalculatedPressureId = 'tmp' | 'filter-drop'

export interface CrrtRawCircuitPressures {
  readonly filterMmHg: number
  readonly returnMmHg: number
  readonly effluentMmHg: number
}

export interface CrrtArithmeticTerm {
  readonly label: string
  readonly role: 'monitored-site' | 'correction' | 'intermediate'
  readonly valueMmHg: number
}

export interface CrrtPressureArithmetic {
  readonly id: CrrtCalculatedPressureId
  readonly label: string
  /** The label as it reads mid-sentence. */
  readonly noun: string
  /** The relationship in words, with the correction as its own labelled term. */
  readonly expression: string
  readonly terms: readonly CrrtArithmeticTerm[]
  /** The same relationship with this moment's rounded values substituted. */
  readonly worked: string
  /** The adapter's own result for these readings, unrounded. */
  readonly resultMmHg: number
  readonly correction: {
    readonly valueMmHg: number
    readonly status: 'printed-in-manual' | 'placement-held-for-device-review'
    readonly note: string
  }
  readonly sourceId: string
  readonly sourceLabel: string
  /** The page locator alone, for surfaces that deliberately do not name the device. */
  readonly sourcePages: string
  /**
   * Whether the rounded terms, worked by hand, give the rounded result. When they do not, the
   * display says the result was calculated from unrounded readings rather than hiding the gap.
   */
  readonly roundedTermsReproduceResult: boolean
}

const SOURCE_LABEL = 'PrisMax AW8035 operator’s manual, software 2.xx'

/** Whole mmHg, the precision every CRRT pressure tile uses. `−` is a true minus sign. */
export function formatCrrtMmHg(value: number): string {
  const rounded = Math.round(value)
  return rounded < 0 ? `−${Math.abs(rounded)}` : String(rounded === 0 ? 0 : rounded)
}

/** A term inside an expression, bracketed when negative so "− −20" never appears. */
function term(value: number): string {
  const rounded = Math.round(value)
  return rounded < 0 ? `(${formatCrrtMmHg(rounded)})` : formatCrrtMmHg(rounded)
}

/** Equality is valid only if the visible whole-mmHg terms give the visible result exactly. */
function relation(visibleCalculation: number, engineResult: number): string {
  return visibleCalculation === Math.round(engineResult) ? '=' : '≈'
}

export function describeCrrtTmpArithmetic(raw: CrrtRawCircuitPressures): CrrtPressureArithmetic {
  const result = prismaxCalculationAdapter.calculateDisplayedPressures({
    rawFilterPressureMmHg: raw.filterMmHg,
    rawReturnPressureMmHg: raw.returnMmHg,
    rawEffluentPressureMmHg: raw.effluentMmHg,
  }).transmembranePressureMmHg
  const [f, r, e, c] = [
    Math.round(raw.filterMmHg),
    Math.round(raw.returnMmHg),
    Math.round(raw.effluentMmHg),
    PRISMAX_TMP_HYDROSTATIC_OFFSET_MMHG,
  ]
  const byHand = (f + r) / 2 - e + c
  return {
    id: 'tmp',
    label: 'TMP',
    noun: 'TMP',
    expression: '(filter + return) ÷ 2 − effluent + display offset',
    terms: [
      { label: 'Filter pressure', role: 'monitored-site', valueMmHg: raw.filterMmHg },
      { label: 'Return pressure', role: 'monitored-site', valueMmHg: raw.returnMmHg },
      { label: 'Effluent pressure', role: 'monitored-site', valueMmHg: raw.effluentMmHg },
      { label: 'Display offset', role: 'correction', valueMmHg: c },
    ],
    worked: `(${term(f)} + ${term(r)}) ÷ 2 − ${term(e)} + ${term(c)} ${relation(byHand, result)} ${formatCrrtMmHg(result)} mmHg`,
    resultMmHg: result,
    correction: {
      valueMmHg: c,
      status: 'printed-in-manual',
      note: `The ${formatCrrtMmHg(c)} mmHg offset is printed in the manual’s displayed-TMP expression (manual p217 · PDF p218). It is a display term, not an alarm limit or a clinical threshold.`,
    },
    sourceId: PRISMAX_TMP_SOURCE_ID,
    sourceLabel: `${SOURCE_LABEL} · manual p217 · PDF p218`,
    sourcePages: 'operator’s manual p217 · PDF p218',
    roundedTermsReproduceResult: Math.round(byHand) === Math.round(result),
  }
}

export function describeCrrtFilterDropArithmetic(
  raw: Pick<CrrtRawCircuitPressures, 'filterMmHg' | 'returnMmHg'>,
): CrrtPressureArithmetic {
  const calculated = prismaxCalculationAdapter.calculateDisplayedPressures({
    rawFilterPressureMmHg: raw.filterMmHg,
    rawReturnPressureMmHg: raw.returnMmHg,
    // The drop does not read the effluent term; any finite value leaves it unchanged.
    rawEffluentPressureMmHg: 0,
  })
  const [f, r, c] = [
    Math.round(raw.filterMmHg),
    Math.round(raw.returnMmHg),
    PRISMAX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG,
  ]
  const byHand = f - r + c
  return {
    id: 'filter-drop',
    label: 'Filter pressure drop',
    noun: 'filter pressure drop',
    expression: '(filter − return) + correction applied by this simulation',
    terms: [
      { label: 'Filter pressure', role: 'monitored-site', valueMmHg: raw.filterMmHg },
      { label: 'Return pressure', role: 'monitored-site', valueMmHg: raw.returnMmHg },
      {
        label: 'Filter − return, before correction',
        role: 'intermediate',
        valueMmHg: calculated.rawFilterPressureDropMmHg,
      },
      { label: 'Correction applied by this simulation', role: 'correction', valueMmHg: c },
    ],
    worked: `(${term(f)} − ${term(r)}) + ${term(c)} ${relation(byHand, calculated.displayedFilterPressureDropMmHg)} ${formatCrrtMmHg(
      calculated.displayedFilterPressureDropMmHg,
    )} mmHg`,
    resultMmHg: calculated.displayedFilterPressureDropMmHg,
    correction: {
      valueMmHg: c,
      status: 'placement-held-for-device-review',
      note: `The manual prints the drop as filter − return and says those two readings are corrected for a ${formatCrrtMmHg(c)} mmHg sensor-height bias (manual pp201–202 · PDF pp202–203). This simulation applies the ${formatCrrtMmHg(c)} mmHg to the drop itself; where the correction belongs awaits device review. It is not an alarm limit or a clinical threshold.`,
    },
    sourceId: PRISMAX_FILTER_PRESSURE_DROP_SOURCE_ID,
    sourceLabel: `${SOURCE_LABEL} · manual pp201–202 · PDF pp202–203`,
    sourcePages: 'operator’s manual pp201–202 · PDF pp202–203',
    roundedTermsReproduceResult:
      Math.round(byHand) === Math.round(calculated.displayedFilterPressureDropMmHg),
  }
}

export function describeCrrtCalculatedPressure(
  id: CrrtCalculatedPressureId,
  raw: CrrtRawCircuitPressures,
): CrrtPressureArithmetic {
  return id === 'tmp' ? describeCrrtTmpArithmetic(raw) : describeCrrtFilterDropArithmetic(raw)
}
