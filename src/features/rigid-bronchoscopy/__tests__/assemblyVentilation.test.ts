import { bronchoscopeTubeOptions } from '../content/assemblyParts'
import { transformVentilationScopePoint } from '../content/assemblyAirway'
import {
  getExpectedVentilationPrediction,
  getRespiratoryCycle,
  getRespiratoryCycleState,
  getVentilationActivePort,
  getVentilationComparison,
  getVentilationModeProfile,
  getVentilationSegmentsForPhase,
  safeDefaultVentilationPreset,
  ventilationModeIds,
  ventilationObstructionStates,
  ventilationScenarioMetadata,
  ventilationScenarioPresets,
  ventilationScopePositionIds,
  ventilationSetups,
  validateVentilationScenarioPresets,
} from '../content/assemblyVentilation'

function tube(id: string) {
  const match = bronchoscopeTubeOptions.find((part) => part.id === id)
  if (!match) throw new Error(`Missing test tube ${id}`)
  return match
}

describe('rigid bronchoscopy ventilation comparison', () => {
  it('defines the four requested ventilation modes', () => {
    expect(ventilationModeIds).toEqual([
      'conventional',
      'spontaneous-assist',
      'low-frequency-jet',
      'high-frequency-jet',
    ])
  })

  it('exposes all six authored depth choices, including shallow and beyond-carina teaching states', () => {
    expect(ventilationScopePositionIds).toEqual([
      'proximal-trachea',
      'mid-trachea',
      'at-carina',
      'past-carina',
      'right-mainstem',
      'left-mainstem',
    ])
  })

  it('assigns conventional and spontaneous ventilation to the circuit port and jets to jet', () => {
    expect(ventilationSetups.conventional.inlet).toBe('anesthesiaCircuit')
    expect(ventilationSetups['spontaneous-assist'].inlet).toBe('anesthesiaCircuit')
    expect(ventilationSetups.conventional.expiratoryOutlet).toBe('anesthesiaCircuit')
    expect(ventilationSetups['spontaneous-assist'].expiratoryOutlet).toBe('anesthesiaCircuit')
    expect(ventilationSetups['low-frequency-jet'].inlet).toBe('jet')
    expect(ventilationSetups['high-frequency-jet'].inlet).toBe('jet')
    expect(ventilationSetups['low-frequency-jet'].expiratoryOutlet).toBe('openSystem')
    expect(getVentilationActivePort('conventional')).toBe('anesthesiaCircuit')
    expect(getVentilationActivePort('high-frequency-jet')).toBe('jet')
  })

  it('provides a safe BT2203 controlled mid-tracheal default and coherent presets', () => {
    expect(safeDefaultVentilationPreset).toEqual({
      id: 'safe-default-controlled-mid-trachea',
      mode: 'conventional',
      tubeId: 'tube-bt2203-3',
      position: 'mid-trachea',
      obstructionState: 'open',
      proceduralPoseId: 'midTrachea',
    })
    expect(ventilationScenarioPresets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ position: 'right-mainstem', tubeId: 'tube-bt2105-3' }),
        expect.objectContaining({ position: 'left-mainstem', tubeId: 'tube-bt2105-3' }),
        expect.objectContaining({
          position: 'proximal-trachea',
          tubeId: 'tube-bt2105-3',
        }),
        expect.objectContaining({
          position: 'proximal-trachea',
          tubeId: 'tube-bt2205-3',
        }),
        expect.objectContaining({ position: 'past-carina', tubeId: 'tube-bt2105-3' }),
        expect.objectContaining({ position: 'past-carina', tubeId: 'tube-bt2205-3' }),
        expect.objectContaining({ obstructionState: 'ball-valve' }),
      ]),
    )
  })

  it('validates the diameter-matched long/short scenario pairs and counterfactual warning', () => {
    const longTube = tube('tube-bt2105-3')
    const shortTube = tube('tube-bt2205-3')
    expect(longTube.outerDiameterMm).toBe(shortTube.outerDiameterMm)
    expect(longTube.innerDiameterMm).toBe(shortTube.innerDiameterMm)
    expect(longTube.hasDistalFenestrations).toBe(true)
    expect(shortTube.hasDistalFenestrations).toBe(false)

    expect(
      ventilationScenarioMetadata['controlled-short-tracheoscope-past-carina-counterfactual'],
    ).toMatchObject({
      intent: 'counterfactual',
      geometryCompatibility: 'matched-diameter-counterfactual',
      expected: {
        prediction: 'mainstem-only',
        sideFenestrationFinding: 'unavailable',
      },
    })
    expect(
      ventilationScenarioMetadata['controlled-short-tracheoscope-past-carina-counterfactual']
        .disclaimer,
    ).toMatch(/not its intended use/i)

    expect(validateVentilationScenarioPresets()).toEqual({ valid: true, errors: [] })
  })

  it('preserves tube pattern and geometry as structured data', () => {
    expect(bronchoscopeTubeOptions).toHaveLength(9)
    expect(bronchoscopeTubeOptions.every((part) => part.tubeType)).toBe(true)
    expect(
      bronchoscopeTubeOptions
        .filter((part) => part.tubeType === 'bronchial')
        .every((part) => part.hasDistalFenestrations),
    ).toBe(true)
    expect(
      bronchoscopeTubeOptions
        .filter((part) => part.tubeType === 'tracheal')
        .every((part) => !part.hasDistalFenestrations),
    ).toBe(true)

    const bronchoscope = tube('tube-bt2103-3')
    const tracheoscope = tube('tube-bt2203-3')
    expect(bronchoscope.outerDiameterMm).toBe(tracheoscope.outerDiameterMm)
    expect(bronchoscope.innerDiameterMm).toBe(tracheoscope.innerDiameterMm)
    expect(bronchoscope.workingLengthMm).toBeGreaterThan(tracheoscope.workingLengthMm ?? 0)
  })

  it('changes the available distal route with depth and tube pattern', () => {
    expect(getExpectedVentilationPrediction('bronchial', 'at-carina')).toBe('both-branches')
    expect(getExpectedVentilationPrediction('bronchial', 'past-carina')).toBe(
      'contralateral-fenestrations',
    )
    expect(getExpectedVentilationPrediction('tracheal', 'past-carina')).toBe('mainstem-only')
    expect(getExpectedVentilationPrediction('bronchial', 'past-carina', false)).toBe(
      'mainstem-only',
    )

    const bronchial = getVentilationComparison('conventional', tube('tube-bt2103-3'), {
      position: 'past-carina',
    })
    const tracheal = getVentilationComparison('conventional', tube('tube-bt2203-3'), {
      position: 'past-carina',
    })

    expect(
      bronchial.segments.some((segment) => segment.id === 'contralateral-fenestration-flow'),
    ).toBe(true)
    expect(
      tracheal.segments.some((segment) => segment.id === 'contralateral-fenestration-flow'),
    ).toBe(false)
    expect(bronchial.sideFenestrationFinding).toBe('available')
    expect(tracheal.sideFenestrationFinding).toBe('unavailable')

    const nonfenestratedBronchialTube = {
      ...tube('tube-bt2103-3'),
      hasDistalFenestrations: false,
    }
    const nonfenestratedBronchial = getVentilationComparison(
      'conventional',
      nonfenestratedBronchialTube,
      { position: 'past-carina' },
    )
    expect(nonfenestratedBronchial.expectedPrediction).toBe('mainstem-only')
    expect(nonfenestratedBronchial.sideFenestrationFinding).toBe('unavailable')
    expect(
      nonfenestratedBronchial.segments.some(
        (segment) => segment.id === 'contralateral-fenestration-flow',
      ),
    ).toBe(false)
  })

  it('shows the major leak only when long-tube fenestrations sit above the cords', () => {
    const bronchial = getVentilationComparison('conventional', tube('tube-bt2103-3'), {
      position: 'proximal-trachea',
    })
    const tracheal = getVentilationComparison('conventional', tube('tube-bt2203-3'), {
      position: 'proximal-trachea',
    })

    expect(bronchial.leakSeverity).toBe('fenestrations-above-cords')
    expect(
      bronchial.segments.some((segment) => segment.id === 'fenestration-related-proximal-leak'),
    ).toBe(true)
    expect(tracheal.leakSeverity).toBe('limited')
    expect(tracheal.segments.some((segment) => segment.id === 'limited-proximal-leak')).toBe(true)
  })

  it('visually separates low-frequency and high-frequency jet pulse profiles', () => {
    const low = getVentilationModeProfile('low-frequency-jet')
    const high = getVentilationModeProfile('high-frequency-jet')

    expect(high.burstFrequencyHz).toBeGreaterThan(low.burstFrequencyHz ?? 0)
    expect(high.particleRadius).toBeLessThan(low.particleRadius)
    expect(high.particleCount).toBeGreaterThan(low.particleCount)

    const controlled = getVentilationComparison('conventional', tube('tube-bt2103-3'), {
      position: 'past-carina',
    })
    const jet = getVentilationComparison('low-frequency-jet', tube('tube-bt2103-3'), {
      position: 'past-carina',
    })
    const controlledStart = controlled.segments[0].points[0]
    const jetStart = jet.segments[0].points[0]
    const expectedControlledStart = transformVentilationScopePoint(
      [-1.88, -0.72, 0],
      controlled.scopePose,
    )
    const expectedJetStart = transformVentilationScopePoint([-2.109, -0.53, 0], jet.scopePose)
    expect(controlledStart).toEqual(expectedControlledStart)
    expect(jetStart).toEqual(expectedJetStart)
    expect(
      Math.hypot(...controlledStart.map((value, index) => value - jetStart[index])),
    ).toBeGreaterThan(0.2)
  })

  it('keeps patient inspiration and assist distinct while using the same circuit port', () => {
    const comparison = getVentilationComparison('spontaneous-assist', tube('tube-bt2203-3'), {
      position: 'mid-trachea',
    })
    const patient = comparison.segments.find(
      (segment) => segment.id === 'spontaneous-patient-inflow',
    )
    const assist = comparison.segments.find((segment) => segment.id === 'spontaneous-assist-inflow')
    const expectedCircuitStart = transformVentilationScopePoint(
      [-1.88, -0.72, 0],
      comparison.scopePose,
    )

    expect(patient?.points[0]).toEqual(expectedCircuitStart)
    expect(assist?.points[0]).toEqual(expectedCircuitStart)
    expect(patient?.activePhaseIds).toEqual(['patient-inspiration'])
    expect(assist?.activePhaseIds).toEqual(['assisted-inspiration'])
    expect(getVentilationSegmentsForPhase(comparison, 'expiration')).not.toContain(patient)
    expect(getVentilationSegmentsForPhase(comparison, 'expiration')).not.toContain(assist)
  })

  it('models respiratory phases sequentially rather than as simultaneous effects', () => {
    expect(getRespiratoryCycle('conventional').phases.map((phase) => phase.id)).toEqual([
      'controlled-inspiration',
      'pause',
      'expiration',
    ])
    expect(getRespiratoryCycle('spontaneous-assist').phases.map((phase) => phase.id)).toEqual([
      'patient-inspiration',
      'assisted-inspiration',
      'pause',
      'expiration',
    ])
    expect(getRespiratoryCycle('low-frequency-jet').phases.map((phase) => phase.id)).toEqual([
      'jet-pulse',
      'pause',
      'expiration',
    ])

    const duringInspiration = getRespiratoryCycleState('conventional', 0.2)
    const duringExpiration = getRespiratoryCycleState('conventional', 3)
    expect(duringInspiration.phase.id).toBe('controlled-inspiration')
    expect(duringExpiration.phase.id).toBe('expiration')
    expect(duringInspiration.phase.distalExpirationPermitted).toBe(false)
    expect(duringExpiration.phase.distalInspirationPermitted).toBe(false)
  })

  it('distinguishes open, fixed-complete, and ball-valve obstruction behavior', () => {
    expect(ventilationObstructionStates).toEqual(['open', 'fixed-complete', 'ball-valve'])
    const selectedTube = tube('tube-bt2203-3')
    const open = getVentilationComparison('conventional', selectedTube, {
      obstructionState: 'open',
      position: 'at-carina',
    })
    const fixed = getVentilationComparison('conventional', selectedTube, {
      obstructionState: 'fixed-complete',
      position: 'at-carina',
    })
    const ballValve = getVentilationComparison('conventional', selectedTube, {
      obstructionState: 'ball-valve',
      position: 'at-carina',
    })

    expect(open.inspirationPermitted).toBe(true)
    expect(open.expirationRestricted).toBe(false)
    expect(open.relativeDistalAccumulationPerCycle).toBe(0)

    expect(fixed.inspirationPermitted).toBe(false)
    expect(fixed.expirationRestricted).toBe(true)
    expect(fixed.segments.some((segment) => segment.id === 'conventional-inflow')).toBe(false)
    expect(fixed.segments.some((segment) => segment.id === 'restricted-expiratory-egress')).toBe(
      true,
    )
    expect(
      fixed.segments.find((segment) => segment.id === 'restricted-expiratory-egress')?.speed,
    ).toBe(0)

    expect(ballValve.inspirationPermitted).toBe(true)
    expect(ballValve.expirationRestricted).toBe(true)
    expect(ballValve.segments.some((segment) => segment.id === 'conventional-inflow')).toBe(true)
    expect(
      ballValve.segments.some((segment) => segment.id === 'restricted-expiratory-egress'),
    ).toBe(true)
    expect(
      ballValve.segments.find((segment) => segment.id === 'restricted-expiratory-egress')?.speed,
    ).toBeGreaterThan(0)
    expect(ballValve.relativeDistalAccumulationPerCycle).toBeGreaterThan(0)

    const oneCycle = getRespiratoryCycleState(
      'conventional',
      ballValve.respiratoryCycle.durationSeconds + 0.01,
      'ball-valve',
    )
    const twoCycles = getRespiratoryCycleState(
      'conventional',
      ballValve.respiratoryCycle.durationSeconds * 2 + 0.01,
      'ball-valve',
    )
    expect(twoCycles.relativeDistalAccumulation).toBeGreaterThan(
      oneCycle.relativeDistalAccumulation,
    )
  })
})
