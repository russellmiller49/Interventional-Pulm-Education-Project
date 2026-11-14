/**
 * Two of the author's rulings of 2026-11-12, rendered.
 *
 * "Neutral titles": the task list prints every task's title from the start, so no title may say
 * what a question in the section is keyed to.
 *
 * "Close them before commitment": Section 7's point to keep in mind ("trapped gas", refused by the
 * section's own deny list) and its shaping note on Part 2's cycle-off wait for the answer they bear
 * on; so does Section 12's note that the rise time "shapes the start of the push". The intrinsic
 * PEEP reading tile and the lung drawing's shading on Part 1 stay, by his ruling on PR #523; they
 * are not tested here.
 */
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'

import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { ventilationUnitById } from '../content/learningCurriculum'
import { ventilationExperimentByUnit } from '../content/learningExperiments'
import { ventilationSectionSpec } from '../content/sectionSpecs'
import { ventilationLocationItemByUnit } from '../content/stageItems'
import { ventilationStageLesson } from '../content/stageLessons'
import { chooseStep } from '../test-support/stageHost'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
}))

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

function mount(unitId: string) {
  render(<VentilationStageHost unitId={unitId} />)
  act(() => jest.advanceTimersByTime(10))
}
const card = () => within(document.querySelector<HTMLElement>('[data-now-card]')!)
const column = () => document.querySelector<HTMLElement>('[data-teaching-column]')!
const taskList = () => document.querySelector<HTMLElement>('[data-step-list]')!.textContent ?? ''

function commitFirstChoice() {
  const radios = card().getAllByRole('radio')
  fireEvent.click(radios[0])
  fireEvent.click(card().getByRole('button', { name: 'Compare my choice' }))
  act(() => jest.advanceTimersByTime(10))
}

describe('neutral task titles (MV-L2, MV-L7)', () => {
  const retired = [
    ['controls-and-goals', 'Separate oxygen from breath delivery'],
    ['mechanics-load-and-pressure', 'Find the pressure spent moving gas'],
    ['modes-and-breath-delivery', 'Change the lung, keep the volume'],
    ['expiration-and-air-trapping', 'Give expiration time back'],
    ['triggering-and-cycling', 'Trigger sensitivity and unanswered efforts'],
    ['triggering-and-cycling', 'Set the flow trigger to 1.5 L/min'],
    ['waveform-reading-sequence', 'Inspect the circuit and clear the condensate'],
    ['dyssynchrony-mechanisms', 'Set the rise time'],
    ['dyssynchrony-mechanisms', 'Rise time on pressure support'],
    ['dyssynchrony-mechanisms', 'Give expiration time back'],
    ['safety-reassessment-and-human-factors', 'Assess the patient and establish communication'],
  ] as const

  it.each(retired)('%s: the task list no longer shows “%s”', (unitId, title) => {
    mount(unitId)
    expect(taskList()).not.toContain(title)
  })

  it('names no section’s keyed answer in a title, from the first task', () => {
    for (const [unitId, experiment] of ventilationExperimentByUnit) {
      const titles = ventilationStageLesson(unitId)
        .steps.map((step) => step.title.toLowerCase())
        .join(' | ')
      for (const round of experiment.rounds)
        expect(titles).not.toContain(round.choices[round.correct].toLowerCase())
      const location = ventilationLocationItemByUnit.get(unitId)
      if (location) {
        const keyed = location.targets[location.item.correctChoiceIds[0]]
        // The location's key, by the setting that acts there: no "trigger" or "rise time" title.
        const cue = { trigger: /trigger/, inspiration: /rise time|push/ }[keyed as string]
        if (cue) expect(titles).not.toMatch(cue)
      }
    }
  })

  it('Section 13 does not title its first action with the answer to its question', () => {
    const lesson = ventilationStageLesson('safety-reassessment-and-human-factors')
    expect(lesson.steps.map((step) => step.title)).toContain(
      'Act at the bedside, then watch the patient',
    )
  })
})

describe('Section 7: closed before the commitment (MV-L6)', () => {
  const unitId = 'expiration-and-air-trapping'
  const boundary = ventilationUnitById.get(unitId)!.boundary!
  const shaping = ventilationSectionSpec(unitId).shapingNote!

  it('refuses its own boundary before the first answer, by its own deny list', () => {
    expect(
      ventilationSectionSpec(unitId).precommitDenyPatterns.some((pattern) =>
        pattern.test(boundary),
      ),
    ).toBe(true)
  })

  it('shows neither before an answer, the boundary after Part 1’s, the note after Part 2’s', () => {
    mount(unitId)
    const lesson = ventilationStageLesson(unitId)
    expect(column().textContent).not.toContain(boundary)
    expect(column().textContent).not.toContain(shaping)
    expect(column().textContent).toContain('its last note waits until you have answered')

    chooseStep(lesson.predictionStepIndex)
    act(() => jest.advanceTimersByTime(10))
    expect(column().textContent).not.toContain(boundary)
    commitFirstChoice()
    expect(column().textContent).toContain(boundary)
    expect(column().textContent).not.toContain(shaping)

    chooseStep(lesson.transferPredictionStepIndex)
    act(() => jest.advanceTimersByTime(10))
    expect(column().textContent).not.toContain(shaping)
    // The preview note above Part 2 no longer says what raising the cycle-off does.
    expect(document.querySelector('[data-part-relation]')!.textContent).not.toMatch(
      /expiration more time|time back/,
    )
    commitFirstChoice()
    expect(column().textContent).toContain(shaping)
    expect(column().textContent).toContain('nothing here is held back')
  })

  it('opens both once the learner has moved on from the question without answering it', () => {
    mount(unitId)
    const lesson = ventilationStageLesson(unitId)
    chooseStep(lesson.steps.length - 1)
    act(() => jest.advanceTimersByTime(10))
    expect(column().textContent).toContain(boundary)
    expect(column().textContent).toContain(shaping)
  })
})

describe('Section 12: the shaping note waits for the location answer (MV-L7)', () => {
  const unitId = 'dyssynchrony-mechanisms'
  const shaping = ventilationSectionSpec(unitId).shapingNote!

  it('holds “shapes the start of the push” until the location question is answered', () => {
    mount(unitId)
    expect(column().textContent).not.toContain(shaping)
    expect(column().textContent).not.toMatch(/this push and this effort/)
    commitFirstChoice()
    expect(column().textContent).toContain(shaping)
  })
})
