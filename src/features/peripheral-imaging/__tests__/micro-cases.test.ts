import { peripheralImagingPathwaySections, peripheralImagingSectionIds } from '../content/pathway'
import {
  imagingMicroCaseById,
  imagingMicroCases,
  imagingMicroCasesInPathwayOrder,
  microCasesForSection,
  practiceActivityId,
  practiceItemId,
  validateImagingMicroCases,
} from '../content/microCases'
import { QUESTION_BY_ID } from '../data/questions'
import {
  createEmptyImagingRecord,
  questionIdOfAttemptKey,
  withFirstAttempt,
} from '../engine/learnProgress'

/** The sections the plan pairs a practice case to: every mechanism and application section. */
const PAIRED_STAGES = new Set(['mechanism', 'application'])
const pairedSectionIds = peripheralImagingPathwaySections
  .filter((section) => PAIRED_STAGES.has(section.stage))
  .map((section) => section.id)

describe('the practice case registry', () => {
  it('validates at import, and says nothing is wrong with the authored set', () => {
    expect(validateImagingMicroCases()).toEqual([])
  })

  it('pairs at least one case to every mechanism and application section', () => {
    const unpaired = pairedSectionIds.filter((id) => microCasesForSection(id as never).length === 0)
    expect(unpaired).toEqual([])
  })

  it('pairs no case to a section that teaches no mechanism', () => {
    const stray = peripheralImagingSectionIds.filter(
      (id) => !pairedSectionIds.includes(id) && microCasesForSection(id).length > 0,
    )
    expect(stray).toEqual([])
  })

  it('holds the number of cases the plan asked for', () => {
    // One per mechanism/application section, and a second where the section fills two rows of the
    // diagnostic table. The plan's estimate was fourteen to eighteen.
    expect(imagingMicroCases.length).toBeGreaterThanOrEqual(14)
    expect(imagingMicroCases.length).toBeLessThanOrEqual(18)
  })

  it('lists cases in the order the course teaches their sections', () => {
    const order = imagingMicroCasesInPathwayOrder().map((microCase) => microCase.sectionId)
    const positions = order.map((id) => peripheralImagingSectionIds.indexOf(id))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(imagingMicroCasesInPathwayOrder()).toHaveLength(imagingMicroCases.length)
  })

  it('gives every case a question in the bank, so a decision can be recorded', () => {
    for (const microCase of imagingMicroCases) {
      const key = practiceItemId(microCase.id)
      expect(QUESTION_BY_ID[questionIdOfAttemptKey(key)]).toBeDefined()
      const written = withFirstAttempt(
        createEmptyImagingRecord(),
        key,
        microCase.item.choices[0].id,
      )
      expect(written.firstAttempts[key]).toBeDefined()
    }
  })

  it('keeps the first decision on a case and never rewrites it', () => {
    const microCase = imagingMicroCases[0]
    const key = practiceItemId(microCase.id)
    const keyed = microCase.item.correctChoiceIds[0]
    const other = microCase.item.choices.find((choice) => choice.id !== keyed)!.id
    const first = withFirstAttempt(createEmptyImagingRecord(), key, other)
    const second = withFirstAttempt(first, key, keyed)
    expect(second.firstAttempts[key].choiceId).toBe(other)
    expect(second.firstAttempts[key].correct).toBe(false)
  })

  it('separates a practice decision from the same sectionated Learn decision', () => {
    // Practice and Learn keys must not collide, or answering one would mark the other.
    const microCase = imagingMicroCases[0]
    expect(practiceItemId(microCase.id)).toMatch(/^practice:/)
    expect(practiceActivityId(microCase.sectionId)).toMatch(/:practice:/)
    const keys = imagingMicroCases.map((entry) => practiceItemId(entry.id))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('gives every case a distinct id and a lookup', () => {
    for (const microCase of imagingMicroCases) {
      expect(imagingMicroCaseById.get(microCase.id)).toBe(microCase)
    }
    expect(imagingMicroCaseById.size).toBe(imagingMicroCases.length)
  })

  it('marks every authored item as a draft awaiting subject-matter review', () => {
    for (const microCase of imagingMicroCases) {
      expect(microCase.item.reviewStatus).toBe('draft')
      expect(microCase.item.choices).toHaveLength(3)
      expect(microCase.item.correctChoiceIds).toHaveLength(1)
      expect(microCase.item.evidenceIds.length).toBeGreaterThan(0)
    }
  })

  it('spreads the keyed answer across the choice positions', () => {
    // Every key in the same slot is the cue a learner finds first.
    const slots = imagingMicroCases.map((microCase) =>
      microCase.item.choices.findIndex(
        (choice) => choice.id === microCase.item.correctChoiceIds[0],
      ),
    )
    expect(new Set(slots).size).toBeGreaterThan(1)
  })
})
