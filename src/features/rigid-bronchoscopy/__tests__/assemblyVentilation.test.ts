import { bronchoscopeTubeOptions } from '../content/assemblyParts'
import { transformVentilationScopePoint } from '../content/assemblyAirway'
import {
  getExpectedVentilationPrediction,
  getVentilationComparison,
  getVentilationModeProfile,
  ventilationModeIds,
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

  it('keeps blocked expiratory egress separate from proximal leak', () => {
    const comparison = getVentilationComparison('high-frequency-jet', tube('tube-bt2103-3'), {
      distalEgressOpen: false,
      position: 'past-carina',
    })

    expect(comparison.leakSeverity).toBe('limited')
    expect(
      comparison.segments.some((segment) => segment.id === 'restricted-expiratory-egress'),
    ).toBe(true)
    expect(comparison.instrumentedMainstemReceivesFlow).toBe(false)
    expect(comparison.segments.some((segment) => segment.id === 'instrumented-mainstem-flow')).toBe(
      false,
    )
    expect(comparison.oppositeMainstemReceivesFlow).toBe(true)

    const carinalMainstemObstruction = getVentilationComparison(
      'conventional',
      tube('tube-bt2203-3'),
      {
        distalEgressOpen: false,
        position: 'at-carina',
      },
    )
    expect(carinalMainstemObstruction.instrumentedMainstemReceivesFlow).toBe(false)
    expect(carinalMainstemObstruction.oppositeMainstemReceivesFlow).toBe(true)
    expect(carinalMainstemObstruction.expectedPrediction).toBe('both-branches')

    const proximalGlobalObstruction = getVentilationComparison(
      'conventional',
      tube('tube-bt2103-3'),
      {
        distalEgressOpen: false,
        position: 'proximal-trachea',
      },
    )
    expect(proximalGlobalObstruction.instrumentedMainstemReceivesFlow).toBe(false)
    expect(proximalGlobalObstruction.oppositeMainstemReceivesFlow).toBe(false)
    expect(proximalGlobalObstruction.expectedPrediction).toBe('both-branches')
  })
})
