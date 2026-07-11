import { bronchoscopeTubeOptions } from '../content/assemblyParts'
import { assemblyPathwayIds, getAssemblyPathway, getTubeDistalX } from '../content/assemblyPathways'

function tube(id: string) {
  const match = bronchoscopeTubeOptions.find((part) => part.id === id)
  if (!match) throw new Error(`Missing test tube ${id}`)
  return match
}

describe('rigid bronchoscopy assembly pathways', () => {
  it('defines the three teaching routes', () => {
    expect(assemblyPathwayIds).toEqual(['ventilation', 'instrument', 'optics-light'])
  })

  it('uses the selected tube working length for the distal pathway endpoint', () => {
    expect(getTubeDistalX(tube('tube-bt2103-3'))).toBeCloseTo(1.51, 4)
    expect(getTubeDistalX(tube('tube-bt2203-3'))).toBeCloseTo(0.61, 4)
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

    expect(openEnd).toBeCloseTo(1.51, 4)
    expect(blockedEnd).toBeCloseTo(1.23, 4)
    expect(blocked.segments[0].particleCount).toBeGreaterThan(open.segments[0].particleCount)
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
