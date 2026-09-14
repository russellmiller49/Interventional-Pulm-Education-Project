import { runCausalExperiment } from '../test-support/causal-experiment'
import { advanceSimulation, createInitialSimulationState } from '../engine/simulation'
import { ventilationSimulationReducer } from '../engine/reducer'

describe('MV-03 equal-time causal controls (MV-01)', () => {
  it.each([0, 30])(
    'does not attribute breath mechanics to oxygen or a non-effective rate change after %s s baseline',
    (baseline) => {
      const arms = runCausalExperiment(baseline)
      for (const name of ['noopOxygen', 'changedOxygen', 'lowerSetRate']) {
        arms.wait.forEach((wait, i) => {
          expect({ ...arms[name][i], oxygenPercent: null, setRate: null }).toEqual({
            ...wait,
            oxygenPercent: null,
            setRate: null,
          })
        })
      }
      const wait = arms.wait.at(-1)!
      const timing = arms.longerInspiration.at(-1)!
      expect(timing.totalRate).toBe(wait.totalRate)
      expect(timing.mechanicalTi).toBeGreaterThan(wait.mechanicalTi)
      expect(timing.observedTi).toBeGreaterThan(wait.observedTi!)
      expect(timing.observedTe).not.toBeCloseTo(wait.observedTe!, 1)
      expect(timing.peak).toBeLessThan(wait.peak)
      expect(timing.plateauInterpretable).toBe(false)
      expect(timing.hold).toBeNull()
    },
  )

  it('reproduces a phase-sensitive PEEPi drop that is not sustained resolution', () => {
    const baseline = advanceSimulation(createInitialSimulationState('MV-03', 'learn'), 30)
    const later = advanceSimulation(baseline, 120)
    const nextPair = advanceSimulation(later, 0.8)
    expect(baseline.branch).toBe('short-machine-ti')
    expect(later.interventions).toEqual([])
    expect(later.measurements.intrinsicPeepCmH2O).toBeLessThan(
      baseline.measurements.intrinsicPeepCmH2O / 2,
    )
    expect(nextPair.measurements.intrinsicPeepCmH2O).toBeGreaterThan(
      later.measurements.intrinsicPeepCmH2O * 2,
    )
    expect(later.measurements.plateauPressureCmH2O).toBeCloseTo(
      baseline.measurements.plateauPressureCmH2O,
      0,
    )
    expect(later.measurements.plateauIsInterpretable).toBe(false)
  })

  it.each(['MV-01', 'MV-13'])('preserves unrelated oxygen/mechanics separation for %s', (id) => {
    const initial = createInitialSimulationState(id, 'learn')
    const oxygen = ventilationSimulationReducer(initial, {
      type: 'SET_CONTROL',
      control: 'oxygenPercent',
      value: 70,
    })
    const wait = advanceSimulation(initial, 60)
    const changed = advanceSimulation(oxygen, 60)
    expect(changed.waveforms).toEqual(wait.waveforms)
    expect(changed.measurements).toEqual(wait.measurements)
    expect(changed.patient.gasExchange.paO2MmHg).not.toBe(wait.patient.gasExchange.paO2MmHg)
  })
})
