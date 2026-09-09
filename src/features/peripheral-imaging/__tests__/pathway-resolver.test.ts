import { peripheralImagingPathwaySections, peripheralImagingSectionIds } from '../content/pathway'
import {
  imagingCompositionLine,
  imagingPathwayComposition,
  imagingPathwayGroups,
  imagingSectionHref,
  imagingSectionLinkTarget,
  nextIncompleteImagingSection,
  workedImagingSectionIds,
} from '../content/pathwayResolver'
import {
  createEmptyImagingRecord,
  withSectionCompleted,
  withSectionVisited,
} from '../engine/learnProgress'

describe('the one map', () => {
  it('flattens the grouped view back to the canonical order', () => {
    const flattened = imagingPathwayGroups().flatMap((group) => group.sections.map((s) => s.id))
    expect(flattened).toEqual([...peripheralImagingSectionIds])
  })

  it('counts every number in the composition from the registry', () => {
    const composition = imagingPathwayComposition()
    expect(composition.total).toBe(peripheralImagingPathwaySections.length)
    expect(composition.minutes).toBe(
      peripheralImagingPathwaySections.reduce((sum, s) => sum + s.minutes, 0),
    )
    const line = imagingCompositionLine()
    expect(line).toMatch(new RegExp(`^${composition.total} sections`))
    expect(line).toMatch(new RegExp(`${composition.minutes} min$`))
  })
})

describe('the one door', () => {
  it('sends a fresh learner to the first section', () => {
    const next = nextIncompleteImagingSection(createEmptyImagingRecord())
    expect(next?.section.id).toBe(peripheralImagingSectionIds[0])
    expect(next?.index).toBe(0)
    expect(next?.resumed).toBe(false)
    expect(next?.href).toBe(imagingSectionHref(peripheralImagingSectionIds[0]))
  })

  it('sends a learner to the first section not worked through, not the one opened last', () => {
    const [first, second, third] = peripheralImagingSectionIds
    let record = createEmptyImagingRecord()
    record = withSectionCompleted(record, first)
    record = withSectionCompleted(record, third)
    record = withSectionVisited(record, third)
    const next = nextIncompleteImagingSection(record)
    expect(next?.section.id).toBe(second)
    expect(next?.resumed).toBe(false)
    expect([...workedImagingSectionIds(record)]).toEqual([first, third])
  })

  it('marks the section opened last as resumed and returns null once everything is worked through', () => {
    let record = createEmptyImagingRecord()
    record = withSectionVisited(record, peripheralImagingSectionIds[0])
    expect(nextIncompleteImagingSection(record)?.resumed).toBe(true)
    for (const id of peripheralImagingSectionIds) record = withSectionCompleted(record, id)
    expect(nextIncompleteImagingSection(record)).toBeNull()
  })

  it('links every section through one typed target', () => {
    for (const id of peripheralImagingSectionIds) {
      expect(imagingSectionLinkTarget(id)).toEqual({
        pathname: '/fluoroview/learn',
        query: { section: id },
      })
    }
  })
})
