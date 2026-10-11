import { BRONCH_PHASES, BRONCH_SECTION_IDS } from '../content/sectionIds'
import {
  forwardSectionId,
  forwardSectionIds,
  RETIRED_SECTION_FORWARD,
  REWRITE_SECTION_ORDER,
} from '../content/sectionMigration'
import {
  createEmptyBronchSelfPacedRecord,
  parseBronchSelfPacedRecord,
} from '../engine/selfPacedProgress'

const finalOrder: readonly string[] = REWRITE_SECTION_ORDER
const inFinalCourse = (id: string) => finalOrder.includes(id)
const retired = Object.keys(RETIRED_SECTION_FORWARD)

describe('the rewrite’s section order and its forward map', () => {
  it('ends at fifteen sections, and every section is either kept or leads to a kept one', () => {
    expect(finalOrder).toHaveLength(15)
    for (const id of BRONCH_SECTION_IDS) {
      if (inFinalCourse(id)) expect(RETIRED_SECTION_FORWARD[id]).toBeUndefined()
      else expect(finalOrder).toContain(RETIRED_SECTION_FORWARD[id])
    }
    for (const id of retired) expect(inFinalCourse(id)).toBe(false)
  })

  it('keeps the sections that stay in the plan’s order', () => {
    const kept = BRONCH_SECTION_IDS.filter(inFinalCourse)
    expect(kept).toEqual(finalOrder.filter((id) => kept.includes(id as never)))
  })

  it('groups the course in the plan’s five phases', () => {
    expect(BRONCH_PHASES.map((phase) => phase.title)).toEqual([
      'Prepare',
      'Handle',
      'Navigate',
      'Describe and sample',
      'Respond',
    ])
  })

  it('leaves a section alone while it is still in the course', () => {
    for (const id of BRONCH_SECTION_IDS) expect(forwardSectionId(id)).toBe(id)
    expect(forwardSectionId('not-a-section')).toBeNull()
  })

  it('once the rewrite is complete, sends every retired section to the one that absorbed it', () => {
    expect(retired.map((id) => [id, forwardSectionId(id, inFinalCourse)])).toEqual([
      ['shared-airway', 'clinical-question'],
      ['branch-entry', 'five-controls'],
      ['reference-frames', 'right-side'],
      ['poor-return', 'washing-and-lavage'],
      ['protected-accessories', 'biopsy-and-specimens'],
      ['specimen-pathway', 'biopsy-and-specimens'],
      ['scope-in-a-tube', 'ventilated-patient'],
      ['icu-physiology', 'ventilated-patient'],
      ['honest-report', 'describe-findings'],
      ['what-completion-means', 'ventilated-patient'],
    ])
    expect(
      forwardSectionIds(
        ['branch-entry', 'five-controls', 'made-up', 'reference-frames', 'right-side'],
        inFinalCourse,
      ),
    ).toEqual(['five-controls', 'right-side'])
  })

  it('reads a saved record through the map without dropping a current section', () => {
    const saved = {
      ...createEmptyBronchSelfPacedRecord(),
      lastSectionId: 'left-side',
      visitedSectionIds: ['right-side', 'left-side', 'gone'],
      reviewedSectionIds: ['right-side', 'gone'],
      reviewLaterSectionIds: ['left-side'],
    }
    expect(parseBronchSelfPacedRecord(JSON.stringify(saved))).toMatchObject({
      lastSectionId: 'left-side',
      visitedSectionIds: ['right-side', 'left-side'],
      reviewedSectionIds: ['right-side'],
      reviewLaterSectionIds: ['left-side'],
    })
  })
})
