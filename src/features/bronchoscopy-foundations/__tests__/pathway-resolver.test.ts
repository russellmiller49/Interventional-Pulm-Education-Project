import { BRONCH_SECTION_IDS, bronchPathwaySections } from '../content/pathway'
import {
  bronchCompositionLine,
  bronchPathwayComposition,
  bronchPathwayGroups,
  bronchSectionHref,
  bronchSectionLinkTarget,
  nextIncompleteBronchSection,
  validateBronchPhases,
  workedBronchSectionIds,
} from '../content/pathwayResolver'
import { BRONCH_PHASES } from '../content/sectionIds'
import {
  createEmptyBronchRecord,
  withSectionCompleted,
  withSectionVisited,
} from '../engine/learnProgress'

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
    expect(line).toMatch(new RegExp(`${composition.minutes} min$`))
  })
})

describe('the one door', () => {
  it('sends a fresh learner to the first section', () => {
    const next = nextIncompleteBronchSection(createEmptyBronchRecord())
    expect(next?.section.id).toBe(BRONCH_SECTION_IDS[0])
    expect(next?.index).toBe(0)
    expect(next?.total).toBe(BRONCH_SECTION_IDS.length)
    expect(next?.resumed).toBe(false)
    expect(next?.href).toBe(bronchSectionHref(BRONCH_SECTION_IDS[0]))
  })

  it('sends a learner to the first section not worked through, not the one opened last', () => {
    const [first, second, third] = BRONCH_SECTION_IDS
    let record = createEmptyBronchRecord()
    record = withSectionCompleted(record, first)
    record = withSectionCompleted(record, third)
    record = withSectionVisited(record, third)
    const next = nextIncompleteBronchSection(record)
    expect(next?.section.id).toBe(second)
    expect(next?.resumed).toBe(false)
    expect([...workedBronchSectionIds(record)]).toEqual([first, third])
  })

  it('marks the section opened last as resumed and returns null once everything is worked through', () => {
    let record = createEmptyBronchRecord()
    record = withSectionVisited(record, BRONCH_SECTION_IDS[0])
    expect(nextIncompleteBronchSection(record)?.resumed).toBe(true)
    for (const id of BRONCH_SECTION_IDS) record = withSectionCompleted(record, id)
    expect(nextIncompleteBronchSection(record)).toBeNull()
    expect(workedBronchSectionIds(record).size).toBe(BRONCH_SECTION_IDS.length)
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
