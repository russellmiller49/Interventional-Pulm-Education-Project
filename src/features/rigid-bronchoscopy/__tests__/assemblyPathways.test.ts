import { bronchoscopeTubeOptions } from '../content/assemblyParts'
import {
  assemblyPathwayIds,
  getAssemblyPathway,
  getTubeDistalX,
  getTubeSafetyStopX,
} from '../content/assemblyPathways'

function tube(id: string) {
  const match = bronchoscopeTubeOptions.find((part) => part.id === id)
  if (!match) throw new Error(`Missing test tube ${id}`)
  return match
}

describe('rigid bronchoscopy assembly pathways', () => {
  it('defines the three teaching routes', () => {
    expect(assemblyPathwayIds).toEqual(['ventilation', 'instrument', 'optics-light'])
  })

  it('uses the physical bevel as the distal endpoint and keeps the safety stop separate', () => {
    expect(getTubeDistalX(tube('tube-bt2103-3'))).toBeCloseTo(1.6, 4)
    expect(getTubeSafetyStopX(tube('tube-bt2103-3'))).toBeCloseTo(1.5064, 4)
    expect(getTubeDistalX(tube('tube-bt2203-3'))).toBeCloseTo(0.7, 4)
    expect(getTubeSafetyStopX(tube('tube-bt2203-3'))).toBeCloseTo(0.6064, 4)
  })

  it('stops ventilation particles proximal to a blocked distal outlet', () => {
    const selectedTube = tube('tube-bt2103-3')
    const open = getAssemblyPathway('ventilation', selectedTube, {
      distalEgressOpen: true,
    })
    const blocked = getAssemblyPathway('ventilation', selectedTube, {
      distalEgressOpen: false,
    })
    const openEnd = open.segments[0].points.at(-1)?.[0]
    const blockedEnd = blocked.segments[0].points.at(-1)?.[0]

    expect(openEnd).toBeCloseTo(1.6, 4)
    expect(blockedEnd).toBeCloseTo(1.5064, 4)
    expect(blocked.segments[0].particleCount).toBeGreaterThan(open.segments[0].particleCount)
  })

  it('routes optical instruments axially and slender forceps through the accessory gate', () => {
    const selectedTube = tube('tube-bt2103-3')
    const axial = getAssemblyPathway('instrument', selectedTube, {
      instrumentRouteId: 'optical-forceps-main-axial',
    })
    const accessory = getAssemblyPathway('instrument', selectedTube, {
      instrumentRouteId: 'semi-rigid-grasping-accessory',
    })

    expect(axial.activePortId).toBe('mainAxial')
    expect(axial.instrumentRoute?.requiredInterface).toBe('bs2319-optical-forceps-cap')
    expect(axial.segments[0].points[0]).toEqual([-2.73, -0.3, 0])
    expect(accessory.activePortId).toBe('accessory')
    expect(accessory.instrumentRoute?.requiredInterface).toBe('bb2402-double-gate')
    expect(accessory.segments[0].points[0]).toEqual([-2.512, 0.45, -0.009])
  })

  it('blocks a route when the selected tube lacks the authored clearance', () => {
    const result = getAssemblyPathway('instrument', tube('tube-bt2106-3'), {
      instrumentRouteId: 'optical-forceps-main-axial',
    })

    expect(result.compatibility).toMatchObject({
      allowed: false,
      availableDiameterMm: 6.5,
      occupiedDiameterMm: 8.5,
      reason: 'insufficient-clearance',
    })
    expect(result.segments).toEqual([])
  })

  it('separates outward illumination from the returning image', () => {
    const pathway = getAssemblyPathway('optics-light', tube('tube-bt2103-3'))

    expect(pathway.segments.map((segment) => segment.legendId)).toEqual([
      'illumination-outward',
      'image-return',
    ])
    expect(pathway.segments[0].points[0][1]).toBeLessThan(-0.7)
    expect(pathway.segments[1].points[0][0]).toBeGreaterThan(
      pathway.segments[1].points.at(-1)?.[0] ?? 0,
    )
  })
})
