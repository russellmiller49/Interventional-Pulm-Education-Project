import {
  ASSEMBLY_BASE_PART_ID,
  ASSEMBLY_KIT_ASSET_PATH,
  assemblyParts,
  assemblySourceIds,
  assemblySteps,
  assemblyToolParts,
  bronchoscopeTubeOptions,
  getAssemblyPart,
} from '../content/assemblyParts'
import { airwayReferences } from '../content/references'

const expectedTubeNodes = [
  'BT2000_3_Adult_bronchial_tube_13.20_12.20_mm',
  'BT2101_3_Adult_bronchial_tube_12.00_11.00_mm',
  'BT2103_3_Adult_bronchial_tube_10.00_9.20_mm',
  'BT2105_3_Adult_bronchial_tube_8.00_7.00_mm',
  'BT2106_3_Adult_bronchial_tube_7.00_6.50_mm',
  'BT2201_3_Adult_tracheal_tube_12.00_11.00_mm',
  'BT2203_3_Adult_tracheal_tube_10.00_9.20_mm',
  'BT2205_3_Adult_tracheal_tube_8.00_7.00_mm',
  'BT2210_3_Adult_tracheal_tube_13.20_12.20_mm',
] as const

describe('rigid bronchoscopy assembly content', () => {
  it('points to the request-efficient assembly-kit model', () => {
    expect(ASSEMBLY_KIT_ASSET_PATH).toMatch(
      /\/models\/rigid-bronchoscopy\/v2\/components\/rigid-bronchoscopy-assembly-kit-[a-f0-9]{12}\.glb$/,
    )
  })

  it('offers every segmented tube with unique ids and exact GLB node names', () => {
    expect(bronchoscopeTubeOptions).toHaveLength(9)
    expect(bronchoscopeTubeOptions.map((part) => part.nodeName)).toEqual(expectedTubeNodes)

    const ids = bronchoscopeTubeOptions.map((part) => part.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(bronchoscopeTubeOptions.filter((part) => part.label.includes('bronchial'))).toHaveLength(
      5,
    )
    expect(bronchoscopeTubeOptions.filter((part) => part.label.includes('tracheal'))).toHaveLength(
      4,
    )

    for (const tube of bronchoscopeTubeOptions) {
      expect(tube.category).toBe('tube')
      expect(tube.prerequisites).toEqual([ASSEMBLY_BASE_PART_ID])
      expect(tube.specs).toHaveLength(4)
      expect(tube.sourceType).toBe('manufacturer')
      expect(tube.individualAssetPath).toMatch(/\.glb$/)
    }
  })

  it('authors the requested eight-piece assembly puzzle', () => {
    expect(assemblySteps.map((part) => part.id)).toEqual([
      'tube-bt2203-3',
      'double-gate-lateral-obturator',
      'red-main-cap-5p5mm',
      'rigid-telescope-bx5500-fa',
      'generic-camera-head',
      'light-guide-adapter-c1',
      'light-guide-adapter-c2',
      'generic-fiberoptic-light-cable',
    ])

    expect(assemblySteps[0].prerequisites).toEqual([ASSEMBLY_BASE_PART_ID])
    expect(assemblySteps[1].prerequisites).toEqual([ASSEMBLY_BASE_PART_ID])
    expect(assemblySteps[2].prerequisites).toEqual([ASSEMBLY_BASE_PART_ID])
    expect(assemblySteps[3].prerequisites).toEqual(['red-main-cap-5p5mm'])
    expect(assemblySteps[4].prerequisites).toEqual(['rigid-telescope-bx5500-fa'])
    expect(assemblySteps[5].prerequisites).toEqual(['rigid-telescope-bx5500-fa'])
    expect(assemblySteps[6].prerequisites).toEqual(['light-guide-adapter-c1'])
    expect(assemblySteps[7].prerequisites).toEqual(['light-guide-adapter-c2'])

    const starts = assemblySteps.map((part) => part.start.position.join(','))
    expect(new Set(starts).size).toBe(assemblySteps.length)
  })

  it('rotates the red main cap 90 degrees and seats it flush on the universal base', () => {
    const cap = getAssemblyPart('red-main-cap-5p5mm')
    const tube = getAssemblyPart('tube-bt2103-3')

    expect(cap?.target.rotation).toEqual([0, 0, 0])
    expect((cap?.target.rotation[1] ?? 0) - (tube?.target.rotation[1] ?? 0)).toBeCloseTo(
      Math.PI / 2,
    )
    expect(cap?.target.position).toEqual([-2.5725, -0.3, 0])
  })

  it('seats the double-gate obturator flush in the universal base accessory port', () => {
    const obturator = getAssemblyPart('double-gate-lateral-obturator')

    expect(obturator?.target.position).toEqual([-2.415357384, 0.182843948, -0.009])
    expect(obturator?.target.rotation).toEqual([1.122192283, 0.354522903, 1.736358719])
    expect(obturator?.start.rotation).toEqual(obturator?.target.rotation)
  })

  it('builds the light-guide chain downward from the telescope through C1 and C2', () => {
    const c1 = getAssemblyPart('light-guide-adapter-c1')
    const c2 = getAssemblyPart('light-guide-adapter-c2')
    const cable = getAssemblyPart('generic-fiberoptic-light-cable')

    expect(c1?.target.position).toEqual([-2.794000024, -0.543000143, 0])
    expect(c2?.target.position).toEqual([-2.794000024, -0.597000143, 0])
    expect(cable?.target.position).toEqual([-2.794000024, -0.741000143, 0])
    expect(c1?.target.rotation).toEqual([-Math.PI / 2, 0, 0])
    expect(c2?.target.rotation).toEqual(c1?.target.rotation)
    expect(cable?.target.rotation).toEqual(c1?.target.rotation)
    expect(c1?.interactionRadius).toBeGreaterThan(0)
    expect(c2?.interactionRadius).toBe(c1?.interactionRadius)
    expect(c1?.sourceType).toBe('reference-photo-educational-approximation')
    expect(c2?.source.note).toMatch(/dimensions are educational approximations/i)
  })

  it('stages both loose light-guide adapters clear of the seated camera', () => {
    const camera = getAssemblyPart('generic-camera-head')
    const adapters = [
      getAssemblyPart('light-guide-adapter-c1'),
      getAssemblyPart('light-guide-adapter-c2'),
    ]

    expect(camera).toBeDefined()
    for (const adapter of adapters) {
      expect(adapter).toBeDefined()
      expect(adapter!.start.position[0]).toBeGreaterThan(camera!.target.position[0] + 2)
      expect(adapter!.start.position[1]).toBeGreaterThan(1)
    }
  })

  it('centers the round camera coupler over the telescope eyepiece', () => {
    const camera = getAssemblyPart('generic-camera-head')

    expect(camera?.target.position).toEqual([-3.007000114, -0.3, 0])
    expect(camera?.target.rotation).toEqual([0, -Math.PI / 2, 0])
    expect(camera?.target.scale).toBe(6)
  })

  it('includes all five configuration-specific tool models', () => {
    expect(assemblyToolParts.map((part) => part.nodeName)).toEqual([
      'Optical_Grasping_Forceps_32_3230_430HM',
      'Semi_Rigid_Grasping_Forceps_BPS2002',
      'Semi_Rigid_Biopsy_Forceps_BPS2001',
      'Semi_Rigid_Suction_Catheter_3mm',
      'Stent_Introducer_Hollow_Shaft',
    ])

    for (const tool of assemblyToolParts) {
      expect(tool.category).toBe('tool')
      expect(tool.specs?.length).toBeGreaterThanOrEqual(3)
      expect(tool.safetyNote).toBeTruthy()
      expect(tool.source.url).toMatch(/^https:\/\//)
    }
  })

  it('keeps source evidence and approximation labels explicit for every part', () => {
    expect(assemblySourceIds).toEqual([
      'efer-ordering-information',
      'efer-user-manual',
      'efer-forceps',
      'efer-endoscope',
      'stryker-camera-systems',
      'karl-storz-light-cable',
    ])

    const ids = assemblyParts.map((part) => part.id)
    const nodes = assemblyParts.map((part) => part.nodeName)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(nodes).size).toBe(nodes.length)

    for (const part of assemblyParts) {
      expect(part.sourceType).toBeTruthy()
      expect(part.source.label.trim()).not.toBe('')
      expect(part.source.url).toMatch(/^https:\/\//)
      expect(part.description.trim()).not.toBe('')
      expect(part.start.position).toHaveLength(3)
      expect(part.target.position).toHaveLength(3)
    }

    expect(getAssemblyPart('generic-camera-head')?.sourceType).toBe(
      'reference-photo-educational-approximation',
    )
    expect(getAssemblyPart('generic-fiberoptic-light-cable')?.sourceType).toBe(
      'manufacturer-exemplar-generic-geometry',
    )
    expect(getAssemblyPart('not-a-real-part')).toBeUndefined()
  })

  it('resolves every assembly source on the module references page', () => {
    const referenceIds = new Set(airwayReferences.map((reference) => reference.id))
    expect(assemblySourceIds.every((sourceId) => referenceIds.has(sourceId))).toBe(true)
  })
})
