import { fireEvent, within } from '@testing-library/react'
import type { BronchStageLesson, BronchStageStep } from '../content/stageLessons'
import {
  clickPrimary,
  commitById,
  control,
  currentStepId,
  keyedChoiceId,
  setRange,
  settle,
} from './stageHarness'

export function pilotButton(name: string) {
  return within(document.querySelector<HTMLElement>('[data-now-card]')!).getByRole('button', {
    name,
  })
}

/** Actual form controls, without session injection or a solution computed from the goal predicate. */
export async function performPilotStep(step: BronchStageStep) {
  expect(currentStepId()).toBe(step.id)
  if (step.interaction.kind === 'prediction') {
    commitById(keyedChoiceId(step))
  } else if (step.interaction.kind === 'scope-task') {
    if (step.learn?.demonstration) fireEvent.click(pilotButton('Try with guidance'))
    switch (step.learn?.id) {
      case 'depth':
      case 'depth-repeat':
        fireEvent.click(control('advance'))
        fireEvent.click(control('withdraw'))
        break
      case 'bend':
      case 'bend-repeat':
        setRange('deflect', 25)
        setRange('deflect', 0)
        break
      case 'rotation':
        setRange('rotate', 45)
        setRange('deflect', 25)
        setRange('rotate', 0)
        break
      case 'rotation-repeat':
        setRange('rotate', 30)
        break
      case 'combine':
        setRange('rotate', 45)
        setRange('deflect', 27)
        fireEvent.click(control('advance'))
        fireEvent.click(control('advance'))
        setRange('deflect', 31)
        fireEvent.click(control('advance'))
        setRange('deflect', 33)
        fireEvent.click(control('advance'))
        break
      case 'suction':
      case 'suction-repeat':
        fireEvent.click(control('suction'))
        fireEvent.click(control('suction'))
        break
      case 'transfer':
        setRange('deflect', -20)
        fireEvent.click(control('advance'))
        fireEvent.click(control('advance'))
        setRange('deflect', -24)
        fireEvent.click(control('advance'))
        setRange('deflect', -25)
        fireEvent.click(control('advance'))
        break
    }
  }
  clickPrimary()
  await settle()
}

export async function performFiveControlsLearn(
  lesson: BronchStageLesson,
  until = lesson.steps.length,
) {
  for (const step of lesson.steps.slice(0, until)) await performPilotStep(step)
}
