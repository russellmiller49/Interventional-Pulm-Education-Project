import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { getCriticalCareResumeTarget } from '@/features/critical-care/progress'

import { BaxterCrrtAssess } from '../components/BaxterCrrtAssess'
import { CrrtActivityWorkspace } from '../components/CrrtActivityWorkspace'
import { BaxterCrrtLearn } from '../components/BaxterCrrtLearn'
import { BaxterCrrtPractice } from '../components/BaxterCrrtPractice'
import { baxterCrrtCoreCaseIds, getBaxterCrrtCase } from '../content'
import { createCrrtLearningSession } from '../engine'
import { createDefaultProgress, readProgress, writeProgress } from '../engine/progress'

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

describe('Baxter CRRT Practice curation and open Challenge access', () => {
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

  it('advances after any patient-application response while preserving mechanism feedback', async () => {
    render(<BaxterCrrtLearn initialLessonId="crrt-core-concepts" />)
    const phases = screen.getByRole('group', { name: 'CRRT shared activity phases' })

    expect(screen.queryByRole('button', { name: 'Mark lesson complete' })).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('radio', {
        name: /choose the modality with the most transport mechanisms/i,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Check clinical reasoning' }))
    expect(
      screen.getByText('That mechanism would produce a different pattern from the one shown here.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try another frame' })).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('Lesson evidence recorded')).toBeInTheDocument())
    expect(readProgress().completedLessonIds).toContain('crrt-indications-modality')
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

  it('requires both the prescription lab interaction and the patient application', async () => {
    render(<BaxterCrrtLearn initialLessonId="crrt-prescription-dosing" />)

    fireEvent.click(
      screen.getByRole('radio', {
        name: /reconcile elapsed treatment time and downtime/i,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Check clinical reasoning' }))
    expect(screen.getByText('Evidence in progress')).toBeInTheDocument()
    expect(readProgress().completedLessonIds).not.toContain('crrt-prescription-dosing')

    fireEvent.change(screen.getByRole('spinbutton', { name: /^Dialysate flow/ }), {
      target: { value: '1200' },
    })
    fireEvent.focus(screen.getByRole('region', { name: 'Educational calculation outputs' }))

    await waitFor(() => expect(screen.getByText('Lesson evidence recorded')).toBeInTheDocument())
    expect(readProgress().completedLessonIds).toContain('crrt-prescription-dosing')
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

  it('opens the full case workspace first, with ten core cases and seven collapsed extras', () => {
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
    expect(screen.getByText('Live patient, prescription, and circuit')).toBeInTheDocument()
    expect(screen.getByText('Relevant labs')).toBeInTheDocument()
    expect(screen.getByText('Pressure pattern')).toBeInTheDocument()
    expect(screen.queryByText('prismax-aw8035-2xx')).not.toBeInTheDocument()

    const viewport = container.querySelector('#crrt-activity-viewport')
    expect(viewport?.firstElementChild).toContainElement(screen.getByTestId('crrt-case-workflow'))
  })

  it('keeps outer task guidance synchronized with the case reasoning phase', () => {
    const definition = getBaxterCrrtCase('CRRT-01')
    const initialSession = createCrrtLearningSession({
      caseDefinition: definition,
      experience: 'practice',
      roleLens: 'integrated',
      attempt: 1,
      deviceId: 'prismax-aw8035-2xx',
    })
    const workspaceProps = {
      mode: 'practice' as const,
      progressLabel: 'Case in progress',
      onReset: jest.fn(),
      onSaveAndExit: jest.fn(),
    }
    const { rerender } = render(
      <CrrtActivityWorkspace session={initialSession} {...workspaceProps}>
        <div>Case workspace</div>
      </CrrtActivityWorkspace>,
    )

    expect(
      screen.getByText(/Review the patient, access, circuit, current prescription/i),
    ).toBeInTheDocument()

    rerender(
      <CrrtActivityWorkspace
        session={{ ...initialSession, reasoningPhase: 'run' }}
        {...workspaceProps}
      >
        <div>Case workspace</div>
      </CrrtActivityWorkspace>,
    )
    expect(
      screen.getByText(/Sequence the clinical and equipment actions, then advance simulated time/i),
    ).toBeInTheDocument()
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

  it('keeps the Challenge open without requiring prior case history', async () => {
    render(<BaxterCrrtAssess />)

    expect(
      await screen.findAllByRole('heading', {
        name: 'Recurrent filter loss across access, filtration, downtime, and policy domains',
      }),
    ).not.toHaveLength(0)
    expect(screen.getByRole('note', { name: 'Challenge flow.' })).toBeInTheDocument()
    expect(screen.queryByText(/remaining core cases|capstone locked/i)).not.toBeInTheDocument()
  })

  it('keeps the same named Challenge open when prior cases exist', async () => {
    const progress = {
      ...createDefaultProgress(),
      completedPracticeCaseIds: baxterCrrtCoreCaseIds.map((id) => id.toLowerCase()),
    }
    expect(writeProgress(progress, window.localStorage)).toBe(true)

    render(<BaxterCrrtAssess />)

    await waitFor(() =>
      expect(
        screen.getAllByRole('heading', {
          name: 'Recurrent filter loss across access, filtration, downtime, and policy domains',
        }).length,
      ).toBeGreaterThan(0),
    )
    expect(screen.getByRole('note', { name: 'Challenge flow.' })).toBeInTheDocument()
    expect(screen.getByText('Live patient, prescription, and circuit')).toBeInTheDocument()
    expect(screen.getByText('Relevant labs')).toBeInTheDocument()
    expect(screen.getByText('Pressure pattern')).toBeInTheDocument()
    const capstone = getBaxterCrrtCase('CRRT-16')
    for (const objective of capstone.learningObjectives) {
      expect(screen.getAllByText(objective)).not.toHaveLength(0)
    }
  })
})
