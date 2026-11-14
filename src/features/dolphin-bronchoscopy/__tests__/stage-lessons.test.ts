import { dolphinNumberErrors } from '../content/teachingNumbers'
import { validateDolphinPathway } from '../content/pathway'
import { validateDolphinPhases } from '../content/pathwayResolver'
import { DOLPHIN_SECTIONS } from '../content/sections'
import {
  dolphinStageLesson,
  precommitSurfaces,
  validateDolphinStageLessons,
} from '../content/stageLessons'

describe('dolphin bronchoscopy registries', () => {
  it('validate at import with no errors', () => {
    expect(validateDolphinPathway()).toEqual([])
    expect(validateDolphinPhases()).toEqual([])
    expect(dolphinNumberErrors()).toEqual([])
    expect(validateDolphinStageLessons()).toEqual([])
  })

  it('builds every authored section as Recognize, Predict, Act, Explain, Transfer, all open', () => {
    for (const section of DOLPHIN_SECTIONS) {
      const lesson = dolphinStageLesson(section.id)!
      expect(lesson.steps.map((step) => step.phase)).toEqual([
        'recognize',
        'predict',
        'act',
        'explain',
        'transfer',
      ])
      expect(lesson.steps.every((step) => step.gate === 'open')).toBe(true)
    }
  })

  it('keeps every keyed answer off the surfaces read before the prediction', () => {
    for (const section of DOLPHIN_SECTIONS) {
      const text = precommitSurfaces(section)
        .map((surface) => surface.text)
        .join('\n')
      for (const pattern of section.precommitDenyPatterns) expect(text).not.toMatch(pattern)
    }
  })

  it('never says correct, incorrect or wrong in an authored stem, option or rationale', () => {
    for (const section of DOLPHIN_SECTIONS) {
      const items = [section.prediction, section.transfer, ...section.practice.map((c) => c.item)]
      for (const item of items) {
        const text = [item.stem, ...item.choices.flatMap((c) => [c.label, c.rationale])].join(' ')
        expect(text).not.toMatch(/\b(correct|incorrect|wrong)\b/i)
      }
    }
  })
})
