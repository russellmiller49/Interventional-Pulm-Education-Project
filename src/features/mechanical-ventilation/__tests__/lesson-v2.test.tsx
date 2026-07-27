import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import { CRITICAL_CARE_PROGRESS_STORAGE_KEY } from '@/features/learning-module/activity'

import { MechanicalVentilationLessonActivity } from '../components/MechanicalVentilationLessonActivity'
import { mechanicalVentilationLessonItems, mechanicalVentilationLessons } from '../content'

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

  it('requires real primary and transfer interactions while keeping the lesson non-credit', async () => {
    // Pinned by id, not by position: this exercises the mechanics lesson's own guided actions and
    // items, and the pathway's first section is not always going to be this one.
    const lesson = mechanicalVentilationLessons.find(
      (candidate) => candidate.id === 'mechanics-load-and-pressure',
    )
    expect(lesson).toBeDefined()
    if (!lesson) return
    const items = mechanicalVentilationLessonItems['mechanics-load-and-pressure']
    render(<MechanicalVentilationLessonActivity lesson={lesson} />)

    expect(await screen.findByRole('heading', { name: lesson.title })).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'HAMILTON-C6 functional training facsimile' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Paw waveform/ })).toBeInTheDocument()
    expect(window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBeNull()

    const continueButton = screen.getByRole('button', { name: 'Continue to prediction' })
    expect(continueButton).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /^Record bedside assessment/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Document multitrace review/ }))
    expect(continueButton).toBeEnabled()
    fireEvent.click(continueButton)

    fireEvent.click(screen.getByLabelText(items.prediction.choices[0].label))
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))

    const responseButton = screen.getByRole('button', {
      name: 'Run the response and reassess',
    })
    expect(responseButton).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /^Perform an inspiratory hold/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Document multitrace review/ }))
    expect(responseButton).toBeEnabled()
    fireEvent.click(responseButton)

    const debriefButton = screen.getByRole('button', { name: 'Open the causal debrief' })
    expect(debriefButton).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /^Document multitrace review/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Advance one breath/ }))
    expect(debriefButton).toBeEnabled()
    fireEvent.click(debriefButton)

    expect(screen.getByRole('heading', { name: 'Causal debrief' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Load the transfer patient' }))
    expect(screen.getByText(/Transfer patient · MV-14/)).toBeInTheDocument()

    const beforeTransfer = JSON.parse(
      window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY) ?? '{}',
    )
    expect(beforeTransfer.activities[0].status).toBe('in-progress')

    fireEvent.click(screen.getByLabelText(items.transfer.choices[0].label))
    fireEvent.click(screen.getByRole('button', { name: 'Review draft transfer' }))
    expect(
      screen.getByText(/The interpretation fits the mechanism; complete the bedside actions/i),
    ).toBeInTheDocument()
    expect(screen.queryByText('Draft reviewed · non-credit')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Record bedside assessment/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Document multitrace review/ }))
    expect(
      screen.getByText(/The interpretation and bedside actions are ready to compare/i),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Review draft transfer' }))
    expect(screen.getByText('Draft reviewed · non-credit')).toBeInTheDocument()

    const saved = JSON.parse(
      window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY) ?? '{}',
    )
    expect(saved.activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activityId: `ventilation:learn:${lesson.id}`,
          status: 'in-progress',
          currentPhase: 'transfer',
          competencyEvidenceIds: [],
        }),
      ]),
    )
    expect(saved.resume).toBeDefined()
  })
})
