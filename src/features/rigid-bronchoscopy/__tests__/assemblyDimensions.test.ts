import {
  getVentilationScopePose,
  transformVentilationScopePoint,
  type VentilationScopePositionId,
} from '../content/assemblyAirway'
import { bronchoscopeTubeOptions, getAssemblyPart } from '../content/assemblyParts'
import { rigidBronchoscopyV2Manifest } from '../content/rigidAssetManifest'
import { getInstrumentRoute } from '../content/assemblyTopology'
import {
  calculateLumenClearance,
  distanceBetweenAnchorsMm,
  getInstrumentRouteClearance,
  getTelescopePlacementTransform,
  getTubeAxialLandmarks,
  isDimensionWithinTolerance,
  millimetersToWorldUnits,
  RIGID_TELESCOPE_OBJECTIVE_ASSET_ANCHOR_MM,
  transformAssetAnchorToAssemblyPoint,
  worldUnitsToMillimeters,
} from '../engine/dimensions'

function tube(id: string) {
  const match = bronchoscopeTubeOptions.find((part) => part.id === id)
  if (!match) throw new Error(`Missing test tube ${id}`)
  return match
}

function expectVectorClose(actual: readonly number[], expected: readonly number[], precision = 9) {
  expect(actual).toHaveLength(expected.length)
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], precision))
}

describe('rigid bronchoscopy dimensions and clearance', () => {
  it('uses one reversible millimeter-to-scene conversion', () => {
    expect(millimetersToWorldUnits(100)).toBeCloseTo(0.9, 10)
    expect(worldUnitsToMillimeters(0.9)).toBeCloseTo(100, 10)
  })

  it('resolves bevel, safety stop, and objective as separate semantic landmarks', () => {
    const landmarks = getTubeAxialLandmarks(tube('tube-bt2203-3'))

    expect(landmarks.bevel).toEqual([0.7, -0.3, 0])
    expect(landmarks.safetyStop[0]).toBeCloseTo(0.6064, 10)
    expect(landmarks.telescopeObjective[0]).toBeCloseTo(0.691, 10)
    expect(distanceBetweenAnchorsMm(landmarks.bevel, landmarks.safetyStop)).toBeCloseTo(10.4, 10)
    expect(distanceBetweenAnchorsMm(landmarks.bevel, landmarks.telescopeObjective)).toBeCloseTo(
      1,
      10,
    )
  })

  it('aligns the rendered telescope objective inside every selected tube and airway pose', () => {
    const telescope = getAssemblyPart('rigid-telescope-bx5500-fa')
    if (!telescope) throw new Error('Missing rigid telescope fixture')
    const positionIds: readonly VentilationScopePositionId[] = [
      'proximal-trachea',
      'mid-trachea',
      'at-carina',
      'past-carina',
      'right-mainstem',
      'left-mainstem',
    ]

    for (const selectedTube of [
      tube('tube-bt2203-3'),
      tube('tube-bt2205-3'),
      tube('tube-bt2105-3'),
    ]) {
      const landmarks = getTubeAxialLandmarks(selectedTube)
      const placement = getTelescopePlacementTransform(selectedTube, telescope)
      const renderedLocalObjective = transformAssetAnchorToAssemblyPoint(
        RIGID_TELESCOPE_OBJECTIVE_ASSET_ANCHOR_MM,
        placement,
      )

      expectVectorClose(renderedLocalObjective, landmarks.telescopeObjective)
      expect(distanceBetweenAnchorsMm(landmarks.bevel, renderedLocalObjective)).toBeCloseTo(1, 9)

      for (const positionId of positionIds) {
        const pose = getVentilationScopePose(landmarks.bevel[0], positionId)
        const renderedWorldObjective = transformVentilationScopePoint(renderedLocalObjective, pose)
        expectVectorClose(renderedWorldObjective, pose.worldTelescopeObjective)
        expect(distanceBetweenAnchorsMm(pose.worldBevel, renderedWorldObjective)).toBeCloseTo(1, 9)
      }
    }

    expect(
      getTelescopePlacementTransform(tube('tube-bt2203-3'), telescope).position[0],
    ).toBeCloseTo(-3.7235, 9)
    expect(
      getTelescopePlacementTransform(tube('tube-bt2105-3'), telescope).position[0],
    ).toBeCloseTo(-2.8235, 9)
  })

  it('keeps the rendered tube bevel on its declared manifest anchor', () => {
    const fixtures = [
      {
        selectedTube: tube('tube-bt2203-3'),
        anchor: rigidBronchoscopyV2Manifest.semanticAnchors.tubeFeatures.bt2203Bevel.positionMm,
      },
      {
        selectedTube: tube('tube-bt2105-3'),
        anchor: rigidBronchoscopyV2Manifest.semanticAnchors.tubeFeatures.bt2105Bevel.positionMm,
      },
    ] as const

    for (const fixture of fixtures) {
      const renderedBevel = transformAssetAnchorToAssemblyPoint(
        [fixture.anchor[0], fixture.anchor[1], fixture.anchor[2]],
        fixture.selectedTube.target,
      )
      expectVectorClose(renderedBevel, getTubeAxialLandmarks(fixture.selectedTube).bevel)
    }
  })

  it('uses a conservative diameter budget and blocks insufficient clearance', () => {
    const fittingClearance = calculateLumenClearance(9.2, [5.5, 3], 0.5)
    expect(fittingClearance).toMatchObject({
      allowed: true,
      reason: 'fits',
    })
    expect(fittingClearance.diametricClearanceMm).toBeCloseTo(0.7, 10)
    expect(calculateLumenClearance(7, [5.5, 3], 0.5)).toMatchObject({
      allowed: false,
      reason: 'insufficient-clearance',
    })
    expect(calculateLumenClearance(undefined, [3], 0.5)).toMatchObject({
      allowed: false,
      reason: 'missing-dimension',
    })

    const opticalRoute = getInstrumentRoute('optical-forceps-main-axial')
    expect(getInstrumentRouteClearance(opticalRoute, tube('tube-bt2203-3')).allowed).toBe(true)
    expect(getInstrumentRouteClearance(opticalRoute, tube('tube-bt2205-3')).allowed).toBe(false)
  })

  it('checks critical dimensions at the authored 0.1 mm tolerance', () => {
    expect(isDimensionWithinTolerance(10.09, 10)).toBe(true)
    expect(isDimensionWithinTolerance(10.11, 10)).toBe(false)
  })
})
