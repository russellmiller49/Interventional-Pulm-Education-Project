import {
  ASSEMBLY_BASE_PART_ID,
  assemblySteps,
  bronchoscopeTubeOptions,
  getAssemblyPart,
} from '../content/assemblyParts'
import {
  canPlacePart,
  getNextAssemblyStep,
  getPlacedTransform,
  getRemainingAssemblyParts,
  isWithinSnapDistance,
  removeLastPlacedPart,
} from '../engine/assembly'

function requiredPart(id: string) {
  const part = getAssemblyPart(id)
  if (!part) {
    throw new Error(`Missing assembly fixture: ${id}`)
  }
  return part
}

describe('rigid bronchoscopy assembly engine', () => {
  it('requires the fixed base before a tube can be placed', () => {
    const tube = bronchoscopeTubeOptions[0]

    expect(canPlacePart(tube, [])).toEqual({
      allowed: false,
      missing: [ASSEMBLY_BASE_PART_ID],
    })
    expect(canPlacePart(tube, [ASSEMBLY_BASE_PART_ID])).toEqual({
      allowed: true,
      missing: [],
    })
  })

  it('accepts every base-connected piece in any order', () => {
    const obturator = requiredPart('double-gate-lateral-obturator')
    const cap = requiredPart('red-main-cap-5p5mm')
    const alternateTube = bronchoscopeTubeOptions[7]

    for (const part of [obturator, cap, alternateTube]) {
      expect(canPlacePart(part, [])).toEqual({
        allowed: false,
        missing: [ASSEMBLY_BASE_PART_ID],
      })
      expect(canPlacePart(part, [ASSEMBLY_BASE_PART_ID])).toEqual({
        allowed: true,
        missing: [],
      })
    }
  })

  it('allows an alternate complete order while retaining direct mating dependencies', () => {
    const alternateOrder = [
      'red-main-cap-5p5mm',
      'rigid-telescope-bx5500-fa',
      'light-guide-adapter-c1',
      'light-guide-adapter-c2',
      'generic-fiberoptic-light-cable',
      'generic-camera-head',
      'double-gate-lateral-obturator',
      bronchoscopeTubeOptions[7].id,
    ]
    const placed = [ASSEMBLY_BASE_PART_ID]

    for (const partId of alternateOrder) {
      const part = requiredPart(partId)
      expect(canPlacePart(part, placed)).toEqual({ allowed: true, missing: [] })
      placed.push(part.id)
    }

    expect(getRemainingAssemblyParts(placed, assemblySteps)).toHaveLength(0)
  })

  it('reports the directly mated part when a connection is not ready', () => {
    const telescope = requiredPart('rigid-telescope-bx5500-fa')

    expect(canPlacePart(telescope, [ASSEMBLY_BASE_PART_ID])).toEqual({
      allowed: false,
      missing: ['red-main-cap-5p5mm'],
    })
  })

  it('finds the next incomplete step and treats an alternate tube as completing step one', () => {
    expect(getNextAssemblyStep([ASSEMBLY_BASE_PART_ID], assemblySteps)?.id).toBe('tube-bt2203-3')

    const placed = [
      ASSEMBLY_BASE_PART_ID,
      bronchoscopeTubeOptions[8].id,
      'double-gate-lateral-obturator',
    ]
    expect(getNextAssemblyStep(placed, assemblySteps)?.id).toBe('red-main-cap-5p5mm')

    expect(
      getNextAssemblyStep(
        [
          ASSEMBLY_BASE_PART_ID,
          bronchoscopeTubeOptions[0].id,
          ...assemblySteps.slice(1).map((p) => p.id),
        ],
        assemblySteps,
      ),
    ).toBeNull()
  })

  it('keeps every unplaced puzzle piece available while preserving alternate-tube semantics', () => {
    const placed = [ASSEMBLY_BASE_PART_ID, bronchoscopeTubeOptions[4].id]
    const remaining = getRemainingAssemblyParts(placed, assemblySteps)

    expect(remaining).toHaveLength(assemblySteps.length - 1)
    expect(remaining.some((part) => part.category === 'tube')).toBe(false)
    expect(remaining.map((part) => part.id)).toContain('generic-camera-head')
    expect(remaining.map((part) => part.id)).toContain('light-guide-adapter-c1')
  })

  it('models camera and light-guide adapters as separate branches after the telescope', () => {
    const telescopeReady = [
      ASSEMBLY_BASE_PART_ID,
      bronchoscopeTubeOptions[2].id,
      'double-gate-lateral-obturator',
      'red-main-cap-5p5mm',
      'rigid-telescope-bx5500-fa',
    ]
    const camera = requiredPart('generic-camera-head')
    const c1 = requiredPart('light-guide-adapter-c1')
    const c2 = requiredPart('light-guide-adapter-c2')

    expect(canPlacePart(camera, telescopeReady).allowed).toBe(true)
    expect(canPlacePart(c1, telescopeReady).allowed).toBe(true)
    expect(canPlacePart(c2, telescopeReady)).toEqual({
      allowed: false,
      missing: ['light-guide-adapter-c1'],
    })
  })

  it('uses the authored target transform after placement', () => {
    const telescope = requiredPart('rigid-telescope-bx5500-fa')
    expect(getPlacedTransform(telescope)).toBe(telescope.target)
  })

  it('withdraws the telescope chain to match the selected tube while keeping its parts connected', () => {
    const telescope = requiredPart('rigid-telescope-bx5500-fa')
    const camera = requiredPart('generic-camera-head')
    const shortTube = requiredPart('tube-bt2203-3')
    const longTube = requiredPart('tube-bt2105-3')
    const shortTelescopeTransform = getPlacedTransform(telescope, shortTube)
    const longTelescopeTransform = getPlacedTransform(telescope, longTube)
    const shortCameraTransform = getPlacedTransform(camera, shortTube)
    const telescopeShortShift = shortTelescopeTransform.position[0] - telescope.target.position[0]
    const cameraShortShift = shortCameraTransform.position[0] - camera.target.position[0]

    expect(shortTelescopeTransform.position[0]).toBeCloseTo(-3.7235, 9)
    expect(longTelescopeTransform.position[0]).toBeCloseTo(-2.8235, 9)
    expect(cameraShortShift).toBeCloseTo(telescopeShortShift, 9)
    expect(isWithinSnapDistance(shortTelescopeTransform.position, telescope, shortTube)).toBe(true)
    expect(isWithinSnapDistance(telescope.target.position, telescope, shortTube)).toBe(false)
  })

  it('checks three-dimensional snap distance including the exact boundary', () => {
    const part = requiredPart('red-main-cap-5p5mm')
    const [x, y, z] = part.target.position
    const tolerance = part.snapDistance ?? 0

    expect(isWithinSnapDistance([x, y, z], part)).toBe(true)
    expect(isWithinSnapDistance([x + tolerance, y, z], part)).toBe(true)
    expect(isWithinSnapDistance([x + tolerance + 0.001, y, z], part)).toBe(false)
    expect(isWithinSnapDistance([x, y + tolerance * 0.8, z + tolerance * 0.8], part)).toBe(false)
  })

  it('removes the last movable part without mutating state or removing the fixed base', () => {
    const placed = [
      ASSEMBLY_BASE_PART_ID,
      'tube-bt2103-3',
      'double-gate-lateral-obturator',
    ] as const

    expect(removeLastPlacedPart(placed)).toEqual([ASSEMBLY_BASE_PART_ID, 'tube-bt2103-3'])
    expect(placed).toEqual([
      ASSEMBLY_BASE_PART_ID,
      'tube-bt2103-3',
      'double-gate-lateral-obturator',
    ])
    expect(removeLastPlacedPart([ASSEMBLY_BASE_PART_ID])).toEqual([ASSEMBLY_BASE_PART_ID])
    expect(removeLastPlacedPart([])).toEqual([])
  })
})
