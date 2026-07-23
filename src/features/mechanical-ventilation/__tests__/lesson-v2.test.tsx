import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import { CRITICAL_CARE_PROGRESS_STORAGE_KEY } from '@/features/learning-module/activity'

import { MechanicalVentilationLessonActivity } from '../components/MechanicalVentilationLessonActivity'
import { mechanicalVentilationLessons } from '../content'

const push = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push }),
}))

describe('focused mechanical ventilation lesson', () => {
  beforeEach(() => {
    window.localStorage.clear()
    push.mockClear()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }),
    })
  })

  it('records completion only after the explicit transfer check', async () => {
    const lesson = mechanicalVentilationLessons[0]
    render(<MechanicalVentilationLessonActivity lesson={lesson} />)

    expect(await screen.findByRole('heading', { name: lesson.title })).toBeInTheDocument()
    expect(window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBeNull()

    fireEvent.click(
      screen.getByRole('button', { name: 'I have reviewed the signal and patient context' }),
    )
    fireEvent.click(screen.getByLabelText(lesson.prediction.choices[0].label))
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply the bounded teaching action' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reassess the predicted response' }))
    expect(screen.getByRole('heading', { name: 'Causal debrief' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Apply the reasoning to a variant' }))

    const beforeTransfer = JSON.parse(
      window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY) ?? '{}',
    )
    expect(beforeTransfer.activities[0].status).toBe('in-progress')

    fireEvent.click(screen.getByLabelText(lesson.transfer.choices[0].label))
    fireEvent.click(screen.getByRole('button', { name: 'Complete transfer check' }))
    expect(screen.getByText('Completed')).toBeInTheDocument()

    const saved = JSON.parse(
      window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY) ?? '{}',
    )
    expect(saved.activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activityId: `ventilation:learn:${lesson.id}`,
          status: 'completed',
          currentPhase: 'transfer',
        }),
      ]),
    )
    expect(saved.resume).toBeUndefined()
  })
})
