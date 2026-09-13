/**
 * @jest-environment node
 */
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'

import { peripheralImagingSectionIds } from '../content/pathway'
import {
  imagingStageLesson,
  imagingStageLessons,
  validateImagingStageLessons,
} from '../content/stageLessons'
import { imagingStageItems } from '../content/stageItems'

describe('the stage lessons', () => {
  it('validate clean at import and share one shape', () => {
    expect(validateImagingStageLessons()).toEqual([])
    const lessons = imagingStageLessons()
    expect(lessons).toHaveLength(peripheralImagingSectionIds.length)
    for (const lesson of lessons) {
      expect(lesson.steps[0].phase).toBe('recognize')
      expect(lesson.steps.at(-1)?.phase).toBe('transfer')
      expect(
        lesson.steps.filter(
          (s) => s.interaction.kind === 'prediction' && s.interaction.round === 0,
        ),
      ).toHaveLength(1)
      expect(lesson.predictionStepIndex).toBeGreaterThan(0)
      expect(lesson.steps.every((step) => !/\d/.test(step.title))).toBe(true)
      expect(
        lesson.steps
          .slice(lesson.predictionStepIndex + 1)
          .every((step) => step.gate === 'after-prediction'),
      ).toBe(true)
      expect(lesson.steps.every((step) => step.lookIn.landmark.length > 0)).toBe(true)
    }
  })

  it('gives the walk section a walk, the sort sections a sort, the lab sections a task', () => {
    expect(imagingStageLesson('chain-walk').steps.map((s) => s.interaction.kind)).toEqual([
      'read',
      'walk',
      'prediction',
      'explain',
      'prediction',
    ])
    expect(imagingStageLesson('imaging-questions').steps.map((s) => s.interaction.kind)).toEqual([
      'read',
      'prediction',
      'sort',
      'explain',
      'prediction',
    ])
    expect(imagingStageLesson('projection').steps.map((s) => s.interaction.kind)).toEqual([
      'read',
      'lab-task',
      'observe',
      'prediction',
      'explain',
      'prediction',
    ])
  })

  it('puts direct answer controls beside the clinical task after the chain walk', () => {
    const lesson = imagingStageLesson('chain-walk')
    const predict = lesson.steps[lesson.predictionStepIndex]
    expect(predict.interaction.kind === 'prediction' && predict.interaction.chainTargets).toBeNull()
    expect(predict.lookIn.pane).toBe('steps')
  })

  it('keeps the keyed answer off the first slot and off the longest option often enough', () => {
    const items = Object.values(imagingStageItems).flatMap((entry) => [
      entry.prediction,
      entry.transfer,
    ])
    let keyedFirst = 0
    let keyedLongest = 0
    for (const item of items) {
      const ordered = orderChoices(item.id, item.choices)
      const keyed = item.correctChoiceIds[0]
      if (ordered[0].id === keyed) keyedFirst += 1
      const longest = [...item.choices].sort((a, b) => b.label.length - a.label.length)[0]
      if (longest.id === keyed) keyedLongest += 1
    }
    expect(keyedFirst / items.length).toBeLessThan(0.6)
    expect(keyedLongest / items.length).toBeLessThan(0.7)
  })
})
