import {
  createSyntheticPressureLocalizationResult,
  comparePressureLocalizationPrediction,
  pressureLocalizationSignals,
  type PressureLocalizationPrediction,
} from '../pressureLocalizationLabModel'
import {
  diagnoseCrrtBalanceEntry,
  selectCrrtBalanceFeedback,
  type CrrtBalanceChart,
} from '../balanceFeedback'

const context = { windowHours: 4, effluentMl: 5000 }
const chart: CrrtBalanceChart = {
  externalInputMl: 1700,
  urineMl: 110,
  otherOutputMl: 230,
  removalMl: 370,
  additionalDeviceGainMl: 40,
  balanceMl: 1030,
}

describe('independent Batch-04 arithmetic challenges', () => {
  it.each([
    ['sign-reversed', -1030],
    ['urine-left-out', 1140],
    ['other-output-left-out', 1260],
    ['net-removal-left-out', 1400],
    ['net-removal-added', 1770],
    ['intake-left-out', -670],
    ['net-removal-as-balance', -370],
    ['circuit-fluids-counted', -3600],
    ['effluent-also-subtracted', -3970],
    ['per-hour-average', 257.5],
    ['liters-not-milliliters', 1.03],
    ['device-gain-left-out', 990],
    ['device-gain-subtracted', 950],
  ])('recognizes the distinct %s candidate', (errorId, value) => {
    expect(diagnoseCrrtBalanceEntry(Number(value), chart, context)).toMatchObject({
      kind: 'specific',
      errorId,
    })
  })
  it('does not discard a competing candidate because it lies near the correct balance', () => {
    const close = {
      ...chart,
      externalInputMl: 121.2,
      urineMl: 0.4,
      otherOutputMl: 0.8,
      removalMl: 20,
      additionalDeviceGainMl: 0,
      balanceMl: 100,
    }
    // 100.6 is within 0.5 of both urine omission (100.4) and other-output omission (100.8).
    expect(diagnoseCrrtBalanceEntry(100.6, close, context)).toMatchObject({
      kind: 'general',
      errorId: null,
    })
  })
  it.each(['urineMl', 'removalMl'] as const)(
    'fails closed with missing %s even if a stale balance is supplied',
    (key) => {
      const missing = { ...chart, [key]: null }
      expect(selectCrrtBalanceFeedback(1030, missing, context)).toMatchObject({
        status: 'unavailable',
        recordedMl: null,
        differenceMl: null,
      })
      expect(selectCrrtBalanceFeedback(1030, missing, context).workedCalculation).toMatch(
        /= unavailable$/,
      )
      expect(diagnoseCrrtBalanceEntry(1140, missing, context)).toBeNull()
    },
  )
  it('handles correct, empty, arbitrary, negative, zero, one-hour, large and boundary values', () => {
    expect(selectCrrtBalanceFeedback(1030, chart, context).status).toBe('matches')
    expect(selectCrrtBalanceFeedback(null, chart, context).diagnosis).toBeNull()
    expect(diagnoseCrrtBalanceEntry(7777, chart, context)?.kind).toBe('general')
    expect(selectCrrtBalanceFeedback(1030.499, chart, context).status).toBe('matches')
    expect(selectCrrtBalanceFeedback(1030.5, chart, context).status).toBe('does-not-match')
    const negative = { ...chart, externalInputMl: 100, balanceMl: -570 }
    expect(diagnoseCrrtBalanceEntry(570, negative, context)?.errorId).toBe('sign-reversed')
    const zero = {
      externalInputMl: 0,
      urineMl: 0,
      otherOutputMl: 0,
      removalMl: 0,
      additionalDeviceGainMl: 0,
      balanceMl: 0,
    }
    expect(selectCrrtBalanceFeedback(0, zero, { windowHours: 1, effluentMl: 0 }).status).toBe(
      'matches',
    )
    expect(diagnoseCrrtBalanceEntry(10, zero, { windowHours: 1, effluentMl: 0 })?.kind).toBe(
      'general',
    )
    expect(diagnoseCrrtBalanceEntry(257.5, chart, { ...context, windowHours: 1 })?.kind).toBe(
      'general',
    )
    const large = Object.fromEntries(
      Object.entries(chart).map(([key, value]) => [key, Number(value) * 1e6]),
    ) as unknown as CrrtBalanceChart
    expect(
      diagnoseCrrtBalanceEntry(1140e6, large, { windowHours: 4, effluentMl: 5e9 })?.errorId,
    ).toBe('urine-left-out')
  })
})

// Every signal can be independently wrong; TMP/drop use the same live-pattern comparison.
describe('independent six-signal direction audit', () => {
  const result = createSyntheticPressureLocalizationResult('obstruction', 'return-line')
  const observed = comparePressureLocalizationPrediction(result, null)
  const correct = Object.fromEntries(
    observed.map((row: { id: string; observed: string }) => [row.id, row.observed]),
  ) as PressureLocalizationPrediction
  it('accepts every individually matching direction without a total', () => {
    expect(
      comparePressureLocalizationPrediction(result, correct).map(
        (row: { outcome: string }) => row.outcome,
      ),
    ).toEqual(Array(6).fill('matches'))
  })
  it.each(pressureLocalizationSignals.map((signal) => signal.id))(
    'identifies a wrong %s without changing the other comparisons',
    (id) => {
      const prediction = {
        ...correct,
        [id]: correct[id] === 'higher' ? 'lower' : 'higher',
      } as PressureLocalizationPrediction
      for (const row of comparePressureLocalizationPrediction(result, prediction)) {
        expect(row.predicted).toBe(prediction[row.id])
        expect(row.outcome).toBe(row.id === id ? 'does-not-match' : 'matches')
        expect(row.explanation.length).toBeGreaterThan(30)
      }
    },
  )
})
