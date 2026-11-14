import { DOLPHIN_OBJECTIVES } from '../content/objectives'
import { DOLPHIN_INTEGRATED_CASES } from '../content/integratedCases'
import { DOLPHIN_MICRO_CASES } from '../content/microCases'
import { dolphinSectionIds } from '../content/pathway'
import { DOLPHIN_SECTIONS } from '../content/sections'

/**
 * Every objective is assessed at least three times across Learn, Practice and the integrated
 * cases, and every section on the pathway is authored.
 */
describe('alignment', () => {
  it('authors every section on the pathway', () => {
    expect(DOLPHIN_SECTIONS.map((section) => section.id)).toEqual([...dolphinSectionIds])
  })

  it('assesses every objective at least three times', () => {
    const counts = new Map<string, number>()
    const add = (ids: readonly string[]) =>
      ids.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1))
    for (const section of DOLPHIN_SECTIONS) {
      add(section.prediction.objectiveIds)
      add(section.transfer.objectiveIds)
    }
    for (const microCase of DOLPHIN_MICRO_CASES) add(microCase.item.objectiveIds)
    for (const integrated of DOLPHIN_INTEGRATED_CASES) add(integrated.objectiveIds)
    for (const objective of DOLPHIN_OBJECTIVES) {
      expect([objective.id, (counts.get(objective.id) ?? 0) >= 3]).toEqual([objective.id, true])
    }
  })

  it('gives the planning, procedure and trouble sections three to five practice cases each, with unique ids', () => {
    const ids = DOLPHIN_MICRO_CASES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    const from = dolphinSectionIds.indexOf('choosing-the-instrument')
    const to = dolphinSectionIds.indexOf('recovery-and-return')
    for (const section of DOLPHIN_SECTIONS) {
      const index = dolphinSectionIds.indexOf(section.id)
      if (index >= from && index <= to) {
        expect([section.id, section.practice.length >= 3 && section.practice.length <= 5]).toEqual([
          section.id,
          true,
        ])
      }
    }
  })
})
