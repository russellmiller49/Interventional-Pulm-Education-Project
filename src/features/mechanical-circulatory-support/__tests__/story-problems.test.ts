/**
 * The story problems: the copy cannot contradict the model.
 *
 * Registry half: two pairs on the two sections named, each item re-parsed against the schema,
 * no numbers in the learner's copy, and the keyed answer not the uniquely longest option.
 * Engine half: each story's change is run on the real reducer and the verdict's direction is
 * read off the run — the level gains a little and leaves the alarm; volume gains more and clears
 * it; speed gains a little and raises the pressure; resistance gains more and lowers it.
 */
import { clinicalLearningItemSchema } from '@/features/learning-module/activity/clinicalLearningItem'

import { mcsStoryProblems, mcsStoryProblemsFor, runMcsStory } from '../content/storyProblems'

const BANNED =
  /\b(score|grade|mastery|exam|quiz|assessment|competency|certification|engine|reducer)\b/i

function story(id: string) {
  const found = mcsStoryProblems.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`No story ${id}`)
  return found
}

function alarmActive(state: { alarms: readonly { id: string; active: boolean }[] }, id: string) {
  return state.alarms.some((alarm) => alarm.id === id && alarm.active)
}

describe('story problems — the registry', () => {
  it('carries two pairs, on the suction section and the durable-pump section', () => {
    expect(mcsStoryProblemsFor('impella-suction-purge-rv').map((s) => s.id)).toEqual([
      'story-level-for-suction',
      'story-volume-for-suction',
    ])
    expect(mcsStoryProblemsFor('lvad-parameters-assessment').map((s) => s.id)).toEqual([
      'story-speed-for-resistance',
      'story-resistance-lowered',
    ])
    expect(mcsStoryProblems).toHaveLength(4)
  })

  it.each(mcsStoryProblems.map((s) => [s.id, s] as const))(
    '%s is a valid draft item with clean copy',
    (_id, problem) => {
      expect(() => clinicalLearningItemSchema.parse(problem.item)).not.toThrow()
      expect(problem.item.phase).toBe('observe')
      expect(problem.item.reviewStatus).toBe('draft')
      const copy = [
        problem.title,
        problem.axisVerdict,
        problem.item.stem,
        problem.item.explanation,
        ...problem.item.choices.flatMap((choice) => [choice.label, choice.rationale]),
      ]
      for (const text of copy) {
        expect(text).not.toMatch(BANNED)
        expect(text).not.toMatch(/\d/)
      }
      expect(problem.item.choices.some((choice) => choice.plausibility === 'unsafe')).toBe(true)
      expect(problem.readings).toHaveLength(4)
    },
  )

  it('does not make the keyed answer the uniquely longest option', () => {
    for (const problem of mcsStoryProblems) {
      const lengths = problem.item.choices.map((choice) => choice.label.length)
      const best = problem.item.choices.find((choice) => choice.plausibility === 'best')!
      const longest = Math.max(...lengths)
      const uniquelyLongest =
        best.label.length === longest && lengths.filter((length) => length === longest).length === 1
      expect(uniquelyLongest).toBe(false)
    }
  })
})

describe('story problems — the engine agrees with every verdict', () => {
  it('the level for a suction alarm: a small gain, and the alarm stays', () => {
    const { before, after } = runMcsStory(story('story-level-for-suction'))
    expect(alarmActive(before, 'impella-left-suction')).toBe(true)
    expect(alarmActive(after, 'impella-left-suction')).toBe(true)
    const gain = after.metrics.leftDeviceFlowLMin - before.metrics.leftDeviceFlowLMin
    expect(gain).toBeGreaterThan(0)
    expect(gain).toBeLessThan(0.8)
    expect(after.metrics.lvedvMl).toBeLessThan(before.metrics.lvedvMl)
  })

  it('volume for the same alarm: a larger gain, and the alarm clears', () => {
    const level = runMcsStory(story('story-level-for-suction'))
    const volume = runMcsStory(story('story-volume-for-suction'))
    expect(alarmActive(volume.before, 'impella-left-suction')).toBe(true)
    expect(alarmActive(volume.after, 'impella-left-suction')).toBe(false)
    const levelGain =
      level.after.metrics.leftDeviceFlowLMin - level.before.metrics.leftDeviceFlowLMin
    const volumeGain =
      volume.after.metrics.leftDeviceFlowLMin - volume.before.metrics.leftDeviceFlowLMin
    expect(volumeGain).toBeGreaterThan(levelGain)
    expect(volume.after.metrics.pcwpMmHg).toBeGreaterThan(volume.before.metrics.pcwpMmHg)
    // Both stories start from the same colleague's circulation.
    expect(volume.before.metrics).toEqual(level.before.metrics)
  })

  it('speed for a stiff circulation: a small gain, and the pressure climbs further', () => {
    const { before, after } = runMcsStory(story('story-speed-for-resistance'))
    const gain = after.metrics.deviceFlowLMin - before.metrics.deviceFlowLMin
    expect(gain).toBeGreaterThan(0)
    expect(gain).toBeLessThan(0.8)
    expect(after.metrics.mapMmHg).toBeGreaterThan(before.metrics.mapMmHg)
  })

  it('the resistance lowered: a larger gain, and the pressure falls', () => {
    const speed = runMcsStory(story('story-speed-for-resistance'))
    const resistance = runMcsStory(story('story-resistance-lowered'))
    const speedGain = speed.after.metrics.deviceFlowLMin - speed.before.metrics.deviceFlowLMin
    const resistanceGain =
      resistance.after.metrics.deviceFlowLMin - resistance.before.metrics.deviceFlowLMin
    expect(resistanceGain).toBeGreaterThan(speedGain)
    expect(resistance.after.metrics.mapMmHg).toBeLessThan(resistance.before.metrics.mapMmHg)
    expect(resistance.before.metrics).toEqual(speed.before.metrics)
  })
})
