/** Replaces the former answer-leak denylist; source and measurement boundaries still apply. */
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import { isPresentedVentilationStep, ventilationStageLesson } from '../content/stageLessons'
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

it.each(ventilationLearningUnits.map((unit) => unit.id))(
  '%s discloses meaningful titles, teaching and sources before any answer',
  (unitId) => {
    const lesson = ventilationStageLesson(unitId)
    render(<VentilationStageHost unitId={unitId} />)
    act(() => jest.advanceTimersByTime(10))
    const outline = document.querySelector('[data-step-list]')!
    // MV-PRE-REVIEW-04 (N6): the task list names the steps that have a screen of their own. The
    // two kinds that repeated a neighbouring screen stay in the lesson and out of the list.
    for (const step of lesson.steps.filter(isPresentedVentilationStep))
      expect(outline).toHaveTextContent(step.title)
    for (const step of lesson.steps.filter((item) => !isPresentedVentilationStep(item)))
      expect(['observe', 'interpret']).toContain(step.interaction.kind)
    // The first task says what the section is for, folded under one named disclosure.
    expect(document.querySelector('[data-stage-objectives]')?.textContent).toContain(
      lesson.spec.objective,
    )
    chooseStep(lesson.predictionStepIndex)
    fireEvent.click(screen.getAllByRole('button', { name: 'Show explanation' })[0])
    // MV-PRE-REVIEW-03 (T1): the lesson is shown, not folded inside a wrapper named like a
    // bibliography; only the named optional parts fold.
    expect(screen.queryByText('Teaching and worked references')).toBeNull()
    const teaching = document.querySelector('[data-lesson]')!
    expect(teaching).not.toBeNull()
    expect(teaching.closest('details')).toBeNull()
    expect(teaching.querySelector('[data-lesson-part="task"]')).not.toBeNull()
    expect(teaching.querySelector('[data-lesson-disclosure="more-detail"]')).not.toBeNull()
    expect(
      document.querySelectorAll('[data-source-list] [data-source-claims]').length,
    ).toBeGreaterThan(0)
    expect(document.querySelector('[data-recorded-breath-comparison]')).toBeNull()
    expect(
      screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked),
    ).toBe(true)
    // A question never holds the learner: Continue is there before anything is answered.
    expect(document.querySelector('[data-now-primary]')?.textContent).toBe('Continue')
    expect((document.querySelector('[data-now-primary]') as HTMLButtonElement).disabled).toBe(false)
  },
)
