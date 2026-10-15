/**
 * The rendered pre-commit scan for Section 1: before the prediction about a marked interval is
 * committed, nothing on the task card or the console says what that interval shows. The frozen
 * breath draws the marker and its letter; its evidence sentence ("flow … (gas moving out) and
 * volume falling") waits for the commitment (`revealMarkerEvidence`).
 */
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { ventilationStageLesson } from '../content/stageLessons'
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

const SECTION_1 = 'breathing-with-support'

/** The text of the surfaces about the marked interval, the question's own choices removed. */
function precommitSurfaceText(): string {
  const parts: string[] = []
  for (const root of document.querySelectorAll<HTMLElement>(
    '[data-now-card], [data-ventilation-console]',
  )) {
    const copy = root.cloneNode(true) as HTMLElement
    copy.querySelectorAll('[data-prediction-choices], fieldset').forEach((node) => node.remove())
    parts.push(copy.textContent ?? '')
    copy
      .querySelectorAll('[aria-label]')
      .forEach((node) => parts.push(node.getAttribute('aria-label')!))
  }
  return parts.join(' ')
}

describe('Section 1 pre-commit surfaces, rendered', () => {
  it.each([0, 1] as const)(
    'part %i: the marked interval’s evidence waits for the prediction',
    (round) => {
      const lesson = ventilationStageLesson(SECTION_1)
      render(<VentilationStageHost unitId={SECTION_1} />)
      act(() => jest.advanceTimersByTime(10))
      const deny = ventilationPrecommitDenyPatterns(SECTION_1)
      const question = lesson.steps.findIndex(
        (step) => step.interaction.kind === 'prediction' && step.interaction.round === round,
      )
      // Every task up to and including the question, as the learner reaches it.
      for (let index = round === 0 ? 0 : question; index <= question; index += 1) {
        chooseStep(index)
        act(() => jest.advanceTimersByTime(200))
        expect(ventilationLeakMatches(precommitSurfaceText(), deny)).toEqual([])
      }
      // The marker is on the frozen breath while the question is open.
      const letter = round === 0 ? 'A' : 'B'
      expect(
        document.querySelectorAll(`[data-ventilation-console] [data-marker-letter="${letter}"]`),
      ).toHaveLength(3)
      // Committed: the evidence sentence is printed, and it is exactly what the patterns refuse.
      const interaction = lesson.steps[question].interaction
      if (interaction.kind !== 'prediction') throw new Error('expected a prediction')
      fireEvent.click(screen.getByLabelText(interaction.item.choices[0].label))
      fireEvent.click(screen.getByRole('button', { name: 'Compare my choice' }))
      expect(ventilationLeakMatches(precommitSurfaceText(), deny).length).toBeGreaterThan(0)
    },
  )
})
