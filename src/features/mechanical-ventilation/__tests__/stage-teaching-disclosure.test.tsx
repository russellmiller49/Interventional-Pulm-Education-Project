/** Replaces the former answer-leak denylist; source and measurement boundaries still apply. */
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import { isPresentedVentilationStep, ventilationStageLesson } from '../content/stageLessons'

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
    const outline = screen.getByRole('combobox', { name: 'Choose step' })
    // MV-PRE-REVIEW-04 (N6): the outline lists the steps that have a screen of their own. The
    // two kinds that repeated a neighbouring screen stay in the lesson and out of the outline.
    for (const step of lesson.steps.filter(isPresentedVentilationStep))
      expect(outline).toHaveTextContent(step.title)
    for (const step of lesson.steps.filter((item) => !isPresentedVentilationStep(item)))
      expect(['observe', 'interpret']).toContain(step.interaction.kind)
    fireEvent.change(outline, { target: { value: lesson.predictionStepIndex } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Show explanation' })[0])
    // MV-PRE-REVIEW-03 (T1): the lesson is shown, not folded inside a wrapper named like a
    // bibliography; only the named optional parts fold.
    expect(screen.queryByText('Teaching and worked references')).toBeNull()
    const teaching = document.querySelector('[data-lesson]')!
    expect(teaching).not.toBeNull()
    expect(teaching.closest('details')).toBeNull()
    expect(teaching.querySelector('[data-lesson-part="idea"]')).not.toBeNull()
    expect(teaching.querySelector('[data-lesson-disclosure="more-detail"]')).not.toBeNull()
    expect(
      document.querySelectorAll('[data-source-list] [data-source-claims]').length,
    ).toBeGreaterThan(0)
    expect(document.querySelector('[data-no-observation]')).not.toBeNull()
    expect(document.querySelector('[data-recorded-breath-comparison]')).toBeNull()
    expect(
      screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked),
    ).toBe(true)
    expect(
      screen
        .getAllByRole('button', { name: 'Continue' })
        .every((button) => !(button as HTMLButtonElement).disabled),
    ).toBe(true)
  },
)
