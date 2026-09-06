import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import {
  runVentilationStory,
  ventilationStoryProblems,
  ventilationStoryProblemsFor,
} from '../content/storyProblems'

/**
 * The story problems' copy is checked against the engine, not against itself: each story's
 * tempting control is run and the readings the verdict shows are asserted to move the way the
 * keyed answer says.
 */
describe('the story problems', () => {
  it('sit on the carbon-dioxide section, two of them, with clean copy and no length cue', () => {
    expect(ventilationStoryProblemsFor('ventilation-and-co2')).toHaveLength(2)
    for (const story of ventilationStoryProblems) {
      const copy = [story.title, story.scenario, story.axisVerdict, story.item.stem].join(' ')
      expect(flaggedLearnerCopyTerms(copy)).toEqual([])
      expect(/\d/.test(story.axisVerdict)).toBe(false)
      const lengths = story.item.choices.map((choice) => choice.label.length)
      const best = story.item.choices.find((choice) => choice.plausibility === 'best')!
      const longest = Math.max(...lengths)
      // The keyed label may be long, but not uniquely the longest.
      expect(
        lengths.filter((length) => length === longest).length > 1 || best.label.length < longest,
      ).toBe(true)
    }
  })

  it('oxygen for a carbon dioxide problem: the saturation moves and the carbon dioxide does not', () => {
    const story = ventilationStoryProblems.find((s) => s.id === 'oxygen-for-carbon-dioxide')!
    const run = runVentilationStory(story)
    expect(run.after.spo2).toBeGreaterThanOrEqual(run.before.spo2)
    expect(Math.abs(run.after.co2 - run.before.co2)).toBeLessThan(1.5)
    expect(Math.abs(run.after.minute - run.before.minute)).toBeLessThan(0.3)
  })

  it('rate into a slowly emptying system: expiratory flow is still running at the next breath', () => {
    const story = ventilationStoryProblems.find((s) => s.id === 'rate-into-trapping')!
    const run = runVentilationStory(story)
    expect(run.after.expiratoryFlow).toBeLessThan(run.before.expiratoryFlow - 1)
    expect(run.after.intrinsicPeep).toBeGreaterThanOrEqual(run.before.intrinsicPeep)
  })
})
