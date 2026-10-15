/**
 * The rendered pre-commit scan for Sections 6–14 (clinical-language pass, October 2026): before the
 * first prediction is committed, neither the Now card nor the task list says what the answer is.
 *
 * The task list matters here because it prints every task's title from the start, including the
 * explanation steps that carry a round's own title, and the static scan in `stage-lessons.test.ts`
 * reads only the steps up to the prediction. Section 9 is left out: its matched PEEP comparison is
 * openly disclosed by design.
 *
 * The part-setup line ("It starts with …") is generated from a round's setup in `learnerMap.ts` and
 * is not scanned: in Section 14 it names the teaching patient's mechanics before the hold, which is
 * ticket MV-L5 in `docs/clinical-language/mechanical-ventilation-sections-6-14.md`.
 */
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'

import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { ventilationExperimentByUnit } from '../content/learningExperiments'
import { ventilationPresentedStepIndexes, ventilationStageLesson } from '../content/stageLessons'
import { chooseStep } from '../test-support/stageHost'
import { ventilationLeakMatches, ventilationPrecommitDenyPatterns } from '../test-support/stageLeak'

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

const SECTIONS = [
  'lung-protection',
  'expiration-and-air-trapping',
  'triggering-and-cycling',
  'ventilation-and-co2',
  'waveform-reading-sequence',
  'dyssynchrony-mechanisms',
  'safety-reassessment-and-human-factors',
  'high-peak-pressure-integration',
]

/** The Now card and the task list, the question's own choices and the part-setup line removed. */
function precommitSurfaceText(): string {
  const parts: string[] = []
  for (const root of document.querySelectorAll<HTMLElement>('[data-now-card], [data-task-map]')) {
    const copy = root.cloneNode(true) as HTMLElement
    copy
      .querySelectorAll('[data-prediction-choices], fieldset, [data-part-setup]')
      .forEach((node) => node.remove())
    parts.push(copy.textContent ?? '')
    copy
      .querySelectorAll('[aria-label]')
      .forEach((node) => parts.push(node.getAttribute('aria-label')!))
  }
  return parts.join(' ')
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

describe('Sections 6–14 pre-commit surfaces, rendered', () => {
  it.each(SECTIONS)('%s: the Now card and the task list wait for the prediction', (unitId) => {
    const lesson = ventilationStageLesson(unitId)
    render(<VentilationStageHost unitId={unitId} />)
    act(() => jest.advanceTimersByTime(10))
    const keys = ventilationExperimentByUnit
      .get(unitId)!
      .rounds.map((round) => new RegExp(escape(round.choices[round.correct]), 'i'))
    const deny = [...ventilationPrecommitDenyPatterns(unitId), ...keys]
    for (const index of ventilationPresentedStepIndexes(lesson)) {
      if (index > lesson.predictionStepIndex) break
      chooseStep(index)
      act(() => jest.advanceTimersByTime(200))
      expect(ventilationLeakMatches(precommitSurfaceText(), deny)).toEqual([])
    }
    // Committed: the verdict names the keyed choice, so the same scan now finds it.
    const interaction = lesson.steps[lesson.predictionStepIndex].interaction
    if (interaction.kind !== 'prediction') throw new Error('expected a prediction')
    const card = within(document.querySelector<HTMLElement>('[data-now-card]')!)
    fireEvent.click(card.getByLabelText(interaction.item.choices[0].label))
    fireEvent.click(card.getByRole('button', { name: 'Compare my choice' }))
    expect(ventilationLeakMatches(precommitSurfaceText(), deny).length).toBeGreaterThan(0)
  })
})
