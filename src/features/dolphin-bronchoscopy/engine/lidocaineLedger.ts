/**
 * Lidocaine arithmetic for the topical ledger. Pure and unit-free beyond what each function says.
 *
 * A solution of p% holds p × 10 mg in each mL (1% = 10 mg/mL). The maximum is a dose per kilogram
 * across every route added together; the module's value is the register row `lidocaine-max`.
 * Educational arithmetic for the ledger exercise, not a dose check.
 */
export function mgPerMl(percent: number): number {
  return percent * 10
}

export function mgOf(volumeMl: number, percent: number): number {
  return round1(volumeMl * mgPerMl(percent))
}

export function mlOf(mg: number, percent: number): number {
  return round1(mg / mgPerMl(percent))
}

export function maxMg(weightKg: number, mgPerKg: number): number {
  return round1(weightKg * mgPerKg)
}

export interface LedgerLine {
  readonly volumeMl: number
  readonly percent: number
}

export function totalMg(lines: readonly LedgerLine[]): number {
  return round1(lines.reduce((sum, line) => sum + line.volumeMl * mgPerMl(line.percent), 0))
}

export interface LedgerState {
  readonly maxMg: number
  readonly givenMg: number
  readonly remainingMg: number
  readonly over: boolean
}

export function ledgerState(
  weightKg: number,
  mgPerKg: number,
  lines: readonly LedgerLine[],
): LedgerState {
  const max = maxMg(weightKg, mgPerKg)
  const given = totalMg(lines)
  return { maxMg: max, givenMg: given, remainingMg: round1(max - given), over: given > max }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}
