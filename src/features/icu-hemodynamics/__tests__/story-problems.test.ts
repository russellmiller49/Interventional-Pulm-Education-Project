import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity'

import {
  hemodynamicsStoryProblems,
  hemodynamicsStoryProblemsFor,
  runHemodynamicsStory,
  validateHemodynamicsStoryProblems,
} from '../content/storyProblems'

/**
 * Each story's verdict is a claim about the engine, and the engine is asked.
 *
 * A fresh zero on a ringing line moves every pressure by the same amount and leaves the flush
 * exactly as it was; a lower transducer raises every pressure by the same amount and leaves the
 * narrow, rounded shape; more balloon on a poor occlusion is refused and recorded. If the model
 * changes under a story, the story fails here rather than in front of a learner.
 */
describe('the story problems', () => {
  it('validate and sit on the sections that teach the confusable pair', () => {
    expect(validateHemodynamicsStoryProblems()).toEqual([])
    expect(hemodynamicsStoryProblemsFor('pressure-system')).toHaveLength(2)
    expect(hemodynamicsStoryProblemsFor('pawp-capture')).toHaveLength(1)
    expect(hemodynamicsStoryProblemsFor('why-measure')).toHaveLength(0)
  })

  it('carry no review vocabulary and no length cue', () => {
    for (const story of hemodynamicsStoryProblems) {
      const copy = [story.item.stem, story.axisVerdict, ...story.item.choices.map((c) => c.label)]
      for (const text of copy) expect(flaggedLearnerCopyTerms(text)).toEqual([])
      const longest = [...story.item.choices].sort((a, b) => b.label.length - a.label.length)[0]
      const runnerUp = [...story.item.choices].sort((a, b) => b.label.length - a.label.length)[1]
      if (longest.id === story.item.correctChoiceIds[0]) {
        expect(longest.label.length).toBeLessThan(runnerUp.label.length * 1.6)
      }
    }
  })

  it('a fresh zero moves the whole tracing and leaves the response alone', () => {
    const story = hemodynamicsStoryProblems.find((s) => s.id === 'story-rezero-for-ringing')!
    const run = runHemodynamicsStory(story)
    const systolicShift = (run.after.papSystolic as number) - (run.before.papSystolic as number)
    const diastolicShift = (run.after.papDiastolic as number) - (run.before.papDiastolic as number)
    expect(systolicShift).toBeLessThan(0)
    expect(Math.abs(systolicShift - diastolicShift)).toBeLessThanOrEqual(1)
    expect(
      Math.abs((run.after.pulsePressure as number) - (run.before.pulsePressure as number)),
    ).toBeLessThanOrEqual(1)
    expect(run.after.flushFinding).toMatch(/underdamping/)
    expect(run.after.flushFinding).toBe(run.before.flushFinding)
  })

  it('a lower transducer raises every pressure and leaves the narrow, rounded shape', () => {
    const story = hemodynamicsStoryProblems.find((s) => s.id === 'story-relevel-for-flat')!
    const run = runHemodynamicsStory(story)
    const systolicShift = (run.after.papSystolic as number) - (run.before.papSystolic as number)
    const diastolicShift = (run.after.papDiastolic as number) - (run.before.papDiastolic as number)
    expect(systolicShift).toBeGreaterThan(0)
    expect(Math.abs(systolicShift - diastolicShift)).toBeLessThanOrEqual(1)
    expect(
      Math.abs((run.after.pulsePressure as number) - (run.before.pulsePressure as number)),
    ).toBeLessThanOrEqual(1)
    expect(run.after.flushFinding).toMatch(/Sluggish/)
  })

  it('more balloon on a poor occlusion is refused and recorded, and the value stays implausible', () => {
    const story = hemodynamicsStoryProblems.find((s) => s.id === 'story-more-balloon')!
    const run = runHemodynamicsStory(story)
    expect(run.before.storedWedge).not.toBeNull()
    expect(run.before.storedWedge as number).toBeGreaterThan(run.before.papDiastolicFloor as number)
    expect(run.before.safety).toBe('Allowed')
    expect(run.after.safety).toBe('Refused, and recorded as unsafe')
    expect(run.after.storedWedge).toBe(run.before.storedWedge)
  })
})
