import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { getCriticalCareResumeTarget } from '@/features/critical-care/progress'

import { BaxterCrrtAssess } from '../components/BaxterCrrtAssess'
import { CrrtActivityWorkspace } from '../components/CrrtActivityWorkspace'
import { BaxterCrrtLearn } from '../components/BaxterCrrtLearn'
import { BaxterCrrtPractice } from '../components/BaxterCrrtPractice'
import { baxterCrrtCoreCaseIds, getBaxterCrrtCase } from '../content'
import { createCrrtLearningSession } from '../engine'
import { createDefaultProgress, writeProgress } from '../engine/progress'

const mockRecordLifecycleEvent = jest.fn()

jest.mock('@/features/critical-care/analytics', () => ({
  recordCriticalCareEvent: (...args: unknown[]) => mockRecordLifecycleEvent(...args),
}))

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const resolved =
      typeof href === 'string'
        ? href
        : `${href.pathname}?${new URLSearchParams(href.query ?? {}).toString()}`
    return (
      <a href={resolved} {...rest}>
        {children}
      </a>
    )
  },
}))

describe('Baxter CRRT Practice curation and Assess gating', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockRecordLifecycleEvent.mockClear()
  })

  it('maps the authored pressure lab through Predict, Act, Observe, and Explain', async () => {
    render(<BaxterCrrtLearn initialLessonId="crrt-circuit-pressures" />)
    const phases = screen.getByRole('group', { name: 'CRRT shared activity phases' })
    await waitFor(() =>
      expect(
        mockRecordLifecycleEvent.mock.calls.some(
          ([event]) =>
            (event as { interaction?: string }).interaction === 'critical_care_activity_opened',
        ),
      ).toBe(true),
    )

    fireEvent.focus(screen.getByRole('radio', { name: 'Access catheter' }))
    expect(within(phases).getByText('Predict').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    )

    for (const signal of [
      'Access pressure',
      'Filter pressure',
      'Return pressure',
      'Effluent pressure',
      'TMP',
      'Filter pressure drop',
    ]) {
      fireEvent.click(
        within(screen.getByRole('group', { name: signal })).getByRole('radio', {
          name: 'Unchanged',
        }),
      )
    }
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))
    expect(within(phases).getByText('Act').closest('li')).toHaveAttribute('aria-current', 'step')

    fireEvent.click(screen.getByRole('button', { name: 'Reveal pressure pattern' }))
    await waitFor(() =>
      expect(within(phases).getByText('Explain').closest('li')).toHaveAttribute(
        'aria-current',
        'step',
      ),
    )

    const events = mockRecordLifecycleEvent.mock.calls.map(
      ([event]) => event as { interaction: string; phase?: string },
    )
    expect(
      events.filter((event) => event.interaction === 'critical_care_prediction_submitted'),
    ).toHaveLength(1)
    expect(
      events
        .filter((event) => event.interaction === 'critical_care_phase_completed')
        .map((event) => event.phase),
    ).toEqual(expect.arrayContaining(['recognize', 'predict', 'act', 'observe']))
  })

  it('keeps generic Learn completion at Explain without emitting transfer completion', async () => {
    render(<BaxterCrrtLearn initialLessonId="crrt-core-concepts" />)
    const phases = screen.getByRole('group', { name: 'CRRT shared activity phases' })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Mark lesson complete' })).toBeEnabled(),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mark lesson complete' }))

    expect(within(phases).getByText('Explain').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    )
    expect(within(phases).getByText('Transfer').closest('li')).not.toHaveAttribute('aria-current')
    expect(
      mockRecordLifecycleEvent.mock.calls.map(
        ([event]) => (event as { interaction: string }).interaction,
      ),
    ).not.toContain('critical_care_transfer_completed')
  })

  it('keeps a revealed case debrief at Explain without emitting transfer completion', async () => {
    const definition = getBaxterCrrtCase('CRRT-01')
    const initialSession = createCrrtLearningSession({
      caseDefinition: definition,
      experience: 'practice',
      roleLens: 'integrated',
      attempt: 1,
      deviceId: 'prismax-aw8035-2xx',
    })
    const revealedSession = {
      ...initialSession,
      reasoningPhase: 'reflect' as const,
      debriefRevealed: true,
    }

    render(
      <CrrtActivityWorkspace
        session={revealedSession}
        mode="practice"
        progressLabel="Completed case"
        onReset={jest.fn()}
        onSaveAndExit={jest.fn()}
      >
        <div>Completed CRRT case</div>
      </CrrtActivityWorkspace>,
    )

    const phases = screen.getByRole('group', { name: 'CRRT shared activity phases' })
    expect(within(phases).getByText('Explain').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    )
    expect(within(phases).getByText('Transfer').closest('li')).not.toHaveAttribute('aria-current')
    await waitFor(() =>
      expect(
        mockRecordLifecycleEvent.mock.calls.map(
          ([event]) => (event as { interaction: string }).interaction,
        ),
      ).toContain('critical_care_debrief_viewed'),
    )
    expect(
      mockRecordLifecycleEvent.mock.calls.map(
        ([event]) => (event as { interaction: string }).interaction,
      ),
    ).not.toContain('critical_care_transfer_completed')
  })

  it('shows ten station-grouped core cases, collapses seven extras, and hides CRRT-16', () => {
    const { container } = render(<BaxterCrrtPractice />)

    expect(container.querySelector('[data-critical-care-activity-shell]')).toBeInTheDocument()
    const sharedPhases = screen.getByRole('group', { name: 'CRRT shared activity phases' })
    for (const label of ['Recognize', 'Predict', 'Act', 'Observe', 'Explain', 'Transfer']) {
      expect(within(sharedPhases).getByText(label)).toBeInTheDocument()
    }
    const selector = screen.getByRole('combobox', { name: 'Station-grouped core case' })
    const values = within(selector)
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value)
    expect(values).toEqual(baxterCrrtCoreCaseIds)
    expect(values).not.toContain('CRRT-16')
    expect(selector.querySelectorAll('optgroup')).toHaveLength(6)
    expect(screen.getByText(/Additional cases \(7\)/)).toBeInTheDocument()
  })

  it('persists exact Learn and Practice deep-link selections for global Continue', async () => {
    const learn = render(<BaxterCrrtLearn initialLessonId="crrt-circuit-pressures" />)
    expect(learn.container.querySelector('[data-critical-care-activity-shell]')).toBeInTheDocument()
    await waitFor(() =>
      expect(getCriticalCareResumeTarget(window.localStorage)?.href).toBe(
        '/baxter-crrt/learn?lesson=crrt-circuit-pressures',
      ),
    )
    learn.unmount()

    render(<BaxterCrrtPractice initialCaseId="CRRT-13" />)
    expect(screen.getByRole('combobox', { name: 'Station-grouped core case' })).toHaveValue(
      'CRRT-13',
    )
    await waitFor(() =>
      expect(getCriticalCareResumeTarget(window.localStorage)?.href).toBe(
        '/baxter-crrt/practice?case=CRRT-13',
      ),
    )
  })

  it('keeps the capstone locked and links every remaining core case', async () => {
    render(<BaxterCrrtAssess />)

    const heading = await screen.findByRole('heading', {
      name: 'Complete 10 remaining core cases',
    })
    const gate = heading.closest('section')
    expect(gate).not.toBeNull()
    expect(within(gate as HTMLElement).getAllByRole('link')).toHaveLength(10)
  })

  it('unlocks only after all ten core cases are complete', async () => {
    const progress = {
      ...createDefaultProgress(),
      completedPracticeCaseIds: baxterCrrtCoreCaseIds.map((id) => id.toLowerCase()),
    }
    expect(writeProgress(progress, window.localStorage)).toBe(true)

    render(<BaxterCrrtAssess />)

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Unseen PrisMax capstone', level: 2 }),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByText('Capstone locked')).not.toBeInTheDocument()
    expect(screen.getByRole('note', { name: 'Capstone safeguards.' })).toBeInTheDocument()
    const capstone = getBaxterCrrtCase('CRRT-16')
    expect(screen.queryByText('CRRT-16')).not.toBeInTheDocument()
    for (const objective of capstone.learningObjectives) {
      expect(screen.queryByText(objective)).not.toBeInTheDocument()
    }
  })
})
