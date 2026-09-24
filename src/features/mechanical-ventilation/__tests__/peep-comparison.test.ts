import { plateauReadingValidity } from '../content/plateauValidity'
import { measurementInputs } from '../engine/learningMeasurements'
import {
  createPeepComparisonBaseline,
  peepComparisonIntervals,
  peepComparisonSettings,
  peepComparisonSnapshot,
  runPeepComparison,
} from '../engine/peepComparison'
import { ventilationSimulationReducer } from '../engine/reducer'
import { advanceSimulation, createInitialSimulationState } from '../engine/simulation'
import { acquireExampleHold } from '../test-support/peep-experiment'

describe('MV-02 matched PEEP comparisons through the unchanged engine', () => {
  it.each(
    peepComparisonSettings.flatMap((peep) =>
      peepComparisonIntervals.map((seconds) => ({ peep, seconds })),
    ),
  )(
    'matches identity, time, effort and all selected inputs except PEEP at $peep / $seconds s',
    ({ peep, seconds }) => {
      const result = runPeepComparison(peep, seconds)
      const { baseline, unchanged, changed } = result
      for (const state of [baseline, unchanged, changed]) {
        expect(state).toMatchObject({
          caseId: 'MV-01',
          branch: 'standard',
          deviceId: 'hamilton-c6',
          experience: 'learn',
          seed: baseline.seed,
        })
        expect(state.patient.drive).toEqual(baseline.patient.drive)
        expect(state.interventions).toEqual([])
        expect(state.prediction.committed).toBe(false)
      }
      expect(baseline.simulationTime).toBeCloseTo(30, 6)
      expect(changed.simulationTime).toBeCloseTo(30 + seconds, 6)
      expect(changed.simulationTime).toBe(unchanged.simulationTime)
      const inputs = measurementInputs(baseline)
      expect(measurementInputs(unchanged)).toEqual(inputs)
      expect(measurementInputs(changed)).toEqual({ ...inputs, peepCmH2O: peep })
      // The fixed-step traces retain 0.1-mL sample rounding. Do not force identical delivery
      // or hide the observed 421.6 vs 421.7 mL difference at some short/phase-boundary endpoints.
      expect(
        Math.abs(
          peepComparisonSnapshot(changed).deliveredVt! -
            peepComparisonSnapshot(unchanged).deliveredVt!,
        ),
      ).toBeLessThan(0.21)
      expect(changed.measurements.totalRatePerMin).toBe(unchanged.measurements.totalRatePerMin)
      expect(changed.measurements.mechanicalInspiratoryTimeSeconds).toBe(
        unchanged.measurements.mechanicalInspiratoryTimeSeconds,
      )
    },
  )

  it('keeps the wait-only arm where it was, and retains the adverse higher-PEEP result', () => {
    const a = runPeepComparison(10, 45),
      b = runPeepComparison(15, 45)
    /*
     * The wait-only arm used to *rise* — "Oxygenation also rises while waiting" — because MV-01's
     * presenting PaO₂ (54 mmHg) was not the equilibrium of the model's oxygenation target at its
     * own FiO₂, PEEP and shunt (77 mmHg). MV-PRE-REVIEW-02 anchors that target at the case's
     * presentation, so waiting at PEEP 5 changes nothing and the arms differ by PEEP alone.
     */
    expect(
      Math.abs(
        a.unchanged.patient.gasExchange.spo2Percent - a.baseline.patient.gasExchange.spo2Percent,
      ),
    ).toBeLessThan(0.5)
    expect(a.changed.patient.gasExchange.spo2Percent).toBeGreaterThan(
      a.unchanged.patient.gasExchange.spo2Percent,
    )
    expect(b.changed.patient.gasExchange.spo2Percent).toBeGreaterThan(
      b.unchanged.patient.gasExchange.spo2Percent,
    )
    expect(b.changed.measurements.peakPressureCmH2O).toBeGreaterThan(
      a.changed.measurements.peakPressureCmH2O,
    )
    expect(b.changed.patient.hemodynamics.mapMmHg).toBeLessThan(
      a.changed.patient.hemodynamics.mapMmHg - 10,
    )
    expect(b.changed.patient.mechanics.complianceLPerCmH2O).toBeLessThan(
      a.changed.patient.mechanics.complianceLPerCmH2O,
    )
    expect(b.changed.alarms.some((alarm) => alarm.active)).toBe(true)
  })

  it('separates waiting and no-op controls from a change in oxygen concentration at equal times', () => {
    const baseline = createPeepComparisonBaseline()
    for (const seconds of peepComparisonIntervals) {
      const waited = advanceSimulation(baseline, seconds)
      for (const control of ['oxygenPercent', 'peepCmH2O'] as const) {
        const value = baseline.ventilator.settings[control]
        const noop = ventilationSimulationReducer(baseline, { type: 'SET_CONTROL', control, value })
        expect(peepComparisonSnapshot(advanceSimulation(noop, seconds))).toEqual(
          peepComparisonSnapshot(waited),
        )
      }
      const changed = advanceSimulation(
        ventilationSimulationReducer(baseline, {
          type: 'SET_CONTROL',
          control: 'oxygenPercent',
          value: 70,
        }),
        seconds,
      )
      expect(changed.measurements).toEqual(waited.measurements)
      expect(changed.patient.mechanics).toEqual(waited.patient.mechanics)
      expect(changed.patient.hemodynamics).toEqual(waited.patient.hemodynamics)
      expect(changed.waveforms).toEqual(waited.waveforms)
      expect(changed.patient.gasExchange.paO2MmHg).toBeGreaterThan(
        waited.patient.gasExchange.paO2MmHg,
      )
    }
  })

  it('does not mistake the effort-affected quotient for the assigned compliance', () => {
    for (const state of [
      runPeepComparison(10, 45).unchanged,
      runPeepComparison(10, 45).changed,
      runPeepComparison(15, 45).changed,
    ]) {
      const snapshot = peepComparisonSnapshot(state)
      expect(snapshot.plateauSource).toBe('waveform estimate')
      expect(snapshot.passiveInterpretationSupported).toBe(false)
      expect(snapshot.recentEffort).toBeGreaterThan(7)
      const invalidQuotient =
        snapshot.deliveredVt! / (snapshot.plateau - snapshot.peep - snapshot.intrinsicPeep)
      expect(invalidQuotient).toBeGreaterThan(snapshot.modelCompliance)
      expect(state.ventilator.holdType).toBeNull()
    }
  })

  it('records completed effortful holds as unsuitable, with a valid passive hold control', () => {
    for (const state of [
      runPeepComparison(10, 45).unchanged,
      runPeepComparison(10, 45).changed,
      runPeepComparison(15, 45).changed,
    ]) {
      const { captured } = acquireExampleHold(state)
      expect(captured.capturedAt).toBeGreaterThan(state.simulationTime)
      expect(captured.waveforms.length).toBeGreaterThan(10)
      expect(captured.interpretable).toBe(false)
      expect(captured.reason).toMatch(/effort/)
      expect(plateauReadingValidity(state).interpretable).toBe(false)
    }
    const passive = acquireExampleHold(
      advanceSimulation(createInitialSimulationState('MV-LAB'), 30),
    ).captured
    expect(passive.interpretable).toBe(true)
    expect(passive.reason).toBeNull()
  })

  /*
   * PEEP 13 used to fall back to the PEEP-5 state — 12 → 13 → 14 read 32 → 25 → 18 — a reversal no
   * part of the case describes (S9-2). The bounded behaviour holds the 8–12 state at 13; see
   * `ardsPeepBand`. 5 and 7 remain the unrecruited state and 14+ the overdistended one.
   */
  it('keeps the authored discrete boundaries and holds the recruited state at PEEP 13', () => {
    const baseline = createPeepComparisonBaseline()
    const outputs = [5, 7, 8, 10, 12, 13, 14, 15].map((value) => {
      const state = ventilationSimulationReducer(baseline, {
        type: 'SET_CONTROL',
        control: 'peepCmH2O',
        value,
      })
      return peepComparisonSnapshot(advanceSimulation(state, 45)).modelCompliance
    })
    expect(outputs).toEqual([25, 25, 32, 32, 32, 32, 18, 18])
  })

  it('replays the exact baseline and result after a different comparison without accumulated history', () => {
    const first = runPeepComparison(10, 45)
    const retained = JSON.stringify(first)
    runPeepComparison(15, 120)
    expect(runPeepComparison(10, 45)).toEqual(first)
    expect(JSON.stringify(first)).toBe(retained)
    expect(first.baseline).toEqual(createPeepComparisonBaseline())
  })
})
