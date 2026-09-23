import { render, screen, waitFor, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { getCriticalCareResumeTarget } from '@/features/critical-care/progress'

import { BaxterCrrtAssess } from '../components/BaxterCrrtAssess'
import { CrrtActivityWorkspace } from '../components/CrrtActivityWorkspace'
import { BaxterCrrtLearn } from '../components/BaxterCrrtLearn'
import { BaxterCrrtPractice } from '../components/BaxterCrrtPractice'
import { baxterCrrtAdditionalCaseIds, baxterCrrtCoreCaseIds, getBaxterCrrtCase } from '../content'
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

describe('Baxter CRRT Practice curation and open Challenge access', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockRecordLifecycleEvent.mockClear()
  })

  // The revised introductory Learn journey is exercised in foundationLessons.ui.test.tsx.
  // Case/device checks remain; grading and inferred phase completion are superseded.

  it('does not infer completed phases or emit completion from an example debrief', async () => {
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
        progressLabel="Example reviewed"
        onReset={jest.fn()}
        onSaveAndExit={jest.fn()}
      >
        <div>CRRT example</div>
      </CrrtActivityWorkspace>,
    )

    expect(screen.queryByRole('group', { name: 'CRRT shared activity phases' })).toBeNull()
    expect(screen.queryByText(/, completed/)).toBeNull()
    expect(mockRecordLifecycleEvent).not.toHaveBeenCalled()
  })

  it('opens the full case workspace first, with ten core cases and seven optional extras', () => {
    const { container } = render(<BaxterCrrtPractice />)

    expect(container.querySelector('[data-critical-care-activity-shell]')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'CRRT case stages' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'CRRT shared activity phases' })).toBeNull()
    // CRRT-FELLOW-03: one visible Cases control carries the six station groups of core cases and
    // the optional additional cases, which used to sit in a separate collapsed list.
    const selector = screen.getByRole('combobox', { name: 'Cases' })
    const values = within(selector)
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value)
    expect(values).toEqual([...baxterCrrtCoreCaseIds, ...baxterCrrtAdditionalCaseIds])
    expect(values).not.toContain('CRRT-16')
    const groups = [...selector.querySelectorAll('optgroup')]
    expect(groups).toHaveLength(7)
    expect(groups.at(-1)).toHaveAttribute('label', 'Additional cases · optional')
    expect(within(groups.at(-1)!).getAllByRole('option')).toHaveLength(7)
    expect(screen.getByText('Live patient, prescription, and circuit')).toBeInTheDocument()
    expect(screen.getByText('Supplied labs at case start')).toBeInTheDocument()
    expect(screen.getByText('Access · filter · return · effluent pressure')).toBeInTheDocument()
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
    expect(screen.getByRole('combobox', { name: 'Cases' })).toHaveValue('CRRT-13')
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
    expect(screen.getByRole('button', { name: 'Explain this case' })).toBeEnabled()
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
    expect(screen.getByRole('button', { name: 'Explain this case' })).toBeEnabled()
    expect(screen.getByText('Live patient, prescription, and circuit')).toBeInTheDocument()
    expect(screen.getByText('Supplied labs at case start')).toBeInTheDocument()
    expect(screen.getByText('Access · filter · return · effluent pressure')).toBeInTheDocument()
    const capstone = getBaxterCrrtCase('CRRT-16')
    for (const objective of capstone.learningObjectives) {
      expect(screen.getAllByText(objective)).not.toHaveLength(0)
    }
  })
})
