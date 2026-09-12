import {
  bronchMicroCaseById,
  bronchMicroCasesInPathwayOrder,
  microCaseAttemptKey,
  microCasesForSection,
  validateBronchMicroCases,
} from '../content/microCases'
import { BRONCH_SECTION_IDS } from '../content/pathway'
import { BRONCH_SECTION_STAGE } from '../content/sectionIds'
import { bronchItem, capstoneStageItems } from '../content/stageItems'
import { createEmptyBronchRecord, withFirstAttempt } from '../engine/learnProgress'

/** The sections the plan pairs a practice case to: every mechanism and application section. */
const PAIRED_STAGES = new Set(['mechanism', 'application'])
const pairedSectionIds = BRONCH_SECTION_IDS.filter((id) =>
  PAIRED_STAGES.has(BRONCH_SECTION_STAGE[id]),
)

const cases = bronchMicroCasesInPathwayOrder()

describe('the practice case registry', () => {
  it('validates at import, and says nothing is wrong with the authored set', () => {
    expect(validateBronchMicroCases()).toEqual([])
    expect(cases.length).toBeGreaterThan(0)
  })

  it('pairs every case to a section in the canonical order, and lists them in that order', () => {
    for (const microCase of cases) {
      expect(BRONCH_SECTION_IDS).toContain(microCase.sectionId)
    }
    const positions = cases.map((microCase) => BRONCH_SECTION_IDS.indexOf(microCase.sectionId))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    const bySection = BRONCH_SECTION_IDS.flatMap((id) => microCasesForSection(id))
    expect(bySection.map((entry) => entry.id)).toEqual(cases.map((entry) => entry.id))
  })

  it('pairs at least one case to every mechanism and application section', () => {
    const unpaired = pairedSectionIds.filter((id) => microCasesForSection(id).length === 0)
    expect(unpaired).toEqual([])
  })

  it('gives every case a distinct id and a lookup', () => {
    const ids = cases.map((microCase) => microCase.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const microCase of cases) {
      expect(bronchMicroCaseById.get(microCase.id)).toBe(microCase)
    }
    expect(bronchMicroCaseById.size).toBe(cases.length)
  })

  it('keys every case on its own item in the bank, apart from the Learn and capstone keys', () => {
    const keys = cases.map((microCase) => microCaseAttemptKey(microCase))
    expect(new Set(keys).size).toBe(keys.length)
    const capstoneIds = new Set(capstoneStageItems.map((entry) => entry.item.id))
    for (const microCase of cases) {
      const key = microCaseAttemptKey(microCase)
      expect(key).toBe(`practice:${microCase.stage.item.id}`)
      expect(bronchItem(microCase.stage.item.id)).toBe(microCase.stage.item)
      expect(capstoneIds.has(microCase.stage.item.id)).toBe(false)
      const written = withFirstAttempt(
        createEmptyBronchRecord(),
        key,
        microCase.stage.item.choices[0].id,
      )
      expect(written.firstAttempts[key]).toBeDefined()
    }
  })

  it('keeps the first decision on a case and never rewrites it', () => {
    const microCase = cases[0]
    const key = microCaseAttemptKey(microCase)
    const keyed = microCase.stage.item.correctChoiceIds[0]
    const other = microCase.stage.item.choices.find((choice) => choice.id !== keyed)!.id
    const first = withFirstAttempt(createEmptyBronchRecord(), key, other)
    const second = withFirstAttempt(first, key, keyed)
    expect(second.firstAttempts[key].choiceId).toBe(other)
    expect(second.firstAttempts[key].correct).toBe(false)
  })

  it('marks every authored item as a draft awaiting subject-matter review, with one keyed choice', () => {
    for (const microCase of cases) {
      const item = microCase.stage.item
      expect(item.reviewStatus).toBe('draft')
      expect(item.choices.length).toBeGreaterThanOrEqual(3)
      expect(item.correctChoiceIds).toHaveLength(1)
      expect(item.evidenceIds.length).toBeGreaterThan(0)
      expect(microCase.situation.trim().length).toBeGreaterThan(0)
      expect(microCase.presentationTitle.trim().length).toBeGreaterThan(0)
    }
  })

  it('spreads the keyed answer across the choice positions', () => {
    const slots = cases.map((microCase) =>
      microCase.stage.item.choices.findIndex(
        (choice) => choice.id === microCase.stage.item.correctChoiceIds[0],
      ),
    )
    expect(new Set(slots).size).toBeGreaterThan(1)
  })
})
