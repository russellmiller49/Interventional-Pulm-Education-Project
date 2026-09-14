import { peripheralImagingPathwaySections, peripheralImagingSectionIds } from '../content/pathway'
import {
  imagingCompositionLine,
  imagingPathwayComposition,
  imagingPathwayGroups,
  imagingSectionHref,
  imagingSectionLinkTarget,
  recommendedImagingSection,
  reviewedImagingSectionIds,
  reviewLaterImagingSections,
  visitedImagingSectionIds,
} from '../content/pathwayResolver'
import {
  createEmptyImagingProgress,
  withLocation,
  withReviewLater,
  withSectionReviewed,
} from '../engine/selfPacedProgress'

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

/*
 * Contract change (PI-01). The door used to resolve to the first section without a completed
 * record — completion that required committed answers — and send a finished learner to a locked
 * capstone. It now recommends from location and the learner's own reviewed marks only.
 */
describe('the one door', () => {
  it('sends a fresh learner to the first section', () => {
    const next = recommendedImagingSection(createEmptyImagingProgress())
    expect(next?.section.id).toBe(peripheralImagingSectionIds[0])
    expect(next?.index).toBe(0)
    expect(next?.resumed).toBe(false)
    expect(next?.href).toBe(imagingSectionHref(peripheralImagingSectionIds[0]))
  })

  it('offers back the section the learner left before marking it reviewed', () => {
    const [first, , third] = peripheralImagingSectionIds
    let progress = withSectionReviewed(createEmptyImagingProgress(), first)
    progress = withLocation(progress, { kind: 'section', id: third })
    const next = recommendedImagingSection(progress)
    expect(next?.section.id).toBe(third)
    expect(next?.resumed).toBe(true)
  })

  it('otherwise recommends the first section, in canonical order, not marked reviewed', () => {
    const [first, second, third] = peripheralImagingSectionIds
    let progress = createEmptyImagingProgress()
    progress = withSectionReviewed(progress, first)
    progress = withLocation(progress, { kind: 'section', id: third })
    progress = withSectionReviewed(progress, third)
    const next = recommendedImagingSection(progress)
    expect(next?.section.id).toBe(second)
    expect(next?.resumed).toBe(false)
    expect([...reviewedImagingSectionIds(progress)]).toEqual([first, third])
    expect([...visitedImagingSectionIds(progress)]).toEqual([third])
  })

  it('is decided by sections alone: cases, bookmarks and unknown ids do not move it', () => {
    let progress = withLocation(createEmptyImagingProgress(), {
      kind: 'practice-case',
      id: 'signal-practice-1',
    })
    progress = withLocation(progress, { kind: 'integrated-case', id: 'case-6' })
    progress = withReviewLater(progress, peripheralImagingSectionIds[4], true)
    progress = withSectionReviewed(progress, 'a-retired-section')
    expect(recommendedImagingSection(progress)?.section.id).toBe(peripheralImagingSectionIds[0])
    expect(reviewedImagingSectionIds(progress).size).toBe(0)
    expect(reviewLaterImagingSections(progress).map((section) => section.id)).toEqual([
      peripheralImagingSectionIds[4],
    ])
  })

  it('returns null once every section is marked reviewed', () => {
    let progress = createEmptyImagingProgress()
    for (const id of peripheralImagingSectionIds) progress = withSectionReviewed(progress, id)
    expect(recommendedImagingSection(progress)).toBeNull()
  })

  it('links every section through one typed target', () => {
    for (const id of peripheralImagingSectionIds) {
      expect(imagingSectionLinkTarget(id)).toEqual({
        pathname: '/peripheral-imaging/learn',
        query: { section: id },
      })
    }
  })
})
