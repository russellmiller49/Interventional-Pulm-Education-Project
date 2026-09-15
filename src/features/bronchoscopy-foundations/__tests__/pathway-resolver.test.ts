import { BRONCH_SECTION_IDS, bronchPathwaySections } from '../content/pathway'
import {
  bronchCompositionLine,
  bronchPathwayComposition,
  bronchPathwayGroups,
  bronchSectionHref,
  bronchSectionLinkTarget,
  nextBronchSection,
  reviewedBronchSectionIds,
  validateBronchPhases,
} from '../content/pathwayResolver'
import { BRONCH_PHASES } from '../content/sectionIds'
import {
  createEmptyBronchSelfPacedRecord,
  withSectionOpened,
  withSectionReviewed,
} from '../engine/selfPacedProgress'

describe('the one map', () => {
  it('flattens the grouped view back to the canonical order', () => {
    const flattened = bronchPathwayGroups().flatMap((group) => group.sections.map((s) => s.id))
    expect(flattened).toEqual([...BRONCH_SECTION_IDS])
    expect(validateBronchPhases()).toEqual([])
    expect(bronchPathwayGroups().map((group) => group.phase)).toEqual(
      BRONCH_PHASES.map((phase) => phase.id),
    )
  })

  it('counts every number in the composition from the registry', () => {
    const composition = bronchPathwayComposition()
    expect(composition.total).toBe(bronchPathwaySections.length)
    expect(composition.minutes).toBe(bronchPathwaySections.reduce((sum, s) => sum + s.minutes, 0))
    expect(composition.byPhase.reduce((sum, phase) => sum + phase.count, 0)).toBe(composition.total)
    const line = bronchCompositionLine()
    expect(line).toMatch(new RegExp(`^${composition.total} sections`))
    expect(line).toContain(`${BRONCH_PHASES.length} phases`)
    expect(line).toMatch(new RegExp(`${composition.minutes} min estimated$`))
  })
})

/** Self-paced door (BF-01): where the learner left off, never answers or completion evidence. */
describe('the one door', () => {
  it('sends a fresh learner to the first section', () => {
    const next = nextBronchSection(createEmptyBronchSelfPacedRecord())
    expect(next?.section.id).toBe(BRONCH_SECTION_IDS[0])
    expect(next?.index).toBe(0)
    expect(next?.total).toBe(BRONCH_SECTION_IDS.length)
    expect(next?.resumed).toBe(false)
    expect(next?.href).toBe(bronchSectionHref(BRONCH_SECTION_IDS[0]))
  })

  it('resumes the section the learner was in unless they marked it reviewed', () => {
    const [first, second, third] = BRONCH_SECTION_IDS
    let record = withSectionOpened(createEmptyBronchSelfPacedRecord(), third)
    expect(nextBronchSection(record)).toMatchObject({ section: { id: third }, resumed: true })
    record = withSectionReviewed(record, third, true)
    expect(nextBronchSection(record)).toMatchObject({ section: { id: first }, resumed: false })
    record = withSectionReviewed(record, first, true)
    expect(nextBronchSection(record)?.section.id).toBe(second)
    expect([...reviewedBronchSectionIds(record)]).toEqual([first, third])
  })

  it('returns null once every section is marked reviewed', () => {
    let record = createEmptyBronchSelfPacedRecord()
    for (const id of BRONCH_SECTION_IDS) record = withSectionReviewed(record, id, true)
    expect(nextBronchSection(record)).toBeNull()
    expect(reviewedBronchSectionIds(record).size).toBe(BRONCH_SECTION_IDS.length)
  })

  it('links every section through one typed target', () => {
    for (const id of BRONCH_SECTION_IDS) {
      expect(bronchSectionLinkTarget(id)).toEqual({
        pathname: '/bronchoscopy-foundations/learn',
        query: { section: id },
      })
      expect(bronchSectionHref(id)).toBe(`/bronchoscopy-foundations/learn?section=${id}`)
    }
  })
})
