/** Replaces the former answer-leak denylist; source and measurement boundaries still apply. */
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import { ventilationStageLesson } from '../content/stageLessons'

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
    for (const step of lesson.steps) expect(outline).toHaveTextContent(step.title)
    fireEvent.change(outline, { target: { value: lesson.predictionStepIndex } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Show explanation' })[0])
    const teaching = screen.getByText('Teaching and worked references').closest('details')!
    expect(teaching.open).toBe(true)
    expect(
      teaching.querySelector('[data-teaching-column], [data-foundation-teaching]'),
    ).not.toBeNull()
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
