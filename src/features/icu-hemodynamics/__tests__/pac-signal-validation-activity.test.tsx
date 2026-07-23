import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import {
  CRITICAL_CARE_PROGRESS_STORAGE_KEY,
  createEmptyCriticalCareProgress,
  upsertCriticalCareActivityProgress,
  writeCriticalCareProgress,
} from '@/features/learning-module/activity'

import { PacGuidedSkillActivity } from '../components/PacGuidedSkillActivity'
import { PacSignalValidationActivity } from '../components/PacSignalValidationActivity'

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

jest.mock('../components/BedsideMonitor', () => ({
  BedsideMonitor: ({
    state,
  }: {
    state: { catheter: { position: string }; responseMessage: string | null }
  }) => (
    <section aria-label="Mock deterministic bedside monitor">
      <span>Position {state.catheter.position}</span>
      <span>{state.responseMessage}</span>
    </section>
  ),
}))

describe('PAC signal-validation vertical slice', () => {
  beforeEach(() => {
    window.localStorage.clear()
    push.mockClear()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }),
    })
  })

  it('uses explicit six-phase actions and records completion only after transfer', async () => {
    render(<PacSignalValidationActivity />)

    expect(
      await screen.findByRole('heading', { name: 'PAC signal validation' }),
    ).toBeInTheDocument()
    expect(window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'I recognize a signal-validation problem' }))
    expect(screen.getByText('Predict').closest('li')).toHaveAttribute('aria-current', 'step')

    fireEvent.click(screen.getByLabelText('No — validate the signal first'))
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))
    expect(screen.getByText('Act').closest('li')).toHaveAttribute('aria-current', 'step')

    fireEvent.click(
      screen.getByRole('button', { name: /Level, zero, and correct the pressure system/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /Perform a fast-flush assessment/i }))
    fireEvent.click(
      screen.getByRole('button', { name: /Return the catheter to a confirmed PA position/i }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Repeat thermodilution with valid technique/i }),
    )
    const observe = screen.getByRole('button', { name: 'Observe the corrected signal' })
    expect(observe).toBeEnabled()
    fireEvent.click(observe)
    expect(screen.getByText('Observe').closest('li')).toHaveAttribute('aria-current', 'step')

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Reassess pressure, flow, perfusion, and validity',
      }),
    )
    expect(screen.getByRole('heading', { name: 'Causal debrief' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Apply this reasoning to a new waveform' }))
    expect(screen.getByText('Transfer').closest('li')).toHaveAttribute('aria-current', 'step')

    const beforeTransfer = JSON.parse(
      window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY) ?? '{}',
    )
    expect(beforeTransfer.activities[0].status).toBe('in-progress')

    fireEvent.click(
      screen.getByRole('button', { name: 'Repeat the fast-flush assessment before treatment' }),
    )
    expect(screen.getByText('Completed')).toBeInTheDocument()

    const saved = window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)
    expect(saved).not.toBeNull()
    const envelope = JSON.parse(saved ?? '{}')
    expect(envelope.activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activityId: 'hemodynamics:learn:pac-signal-validation',
          status: 'completed',
          currentPhase: 'transfer',
        }),
      ]),
    )
    expect(envelope.resume).toBeUndefined()
    expect(saved).not.toMatch(/not-usable|selectedMechanism|selectedPriority|freeText/i)
  })

  it('restores only a validated authored checkpoint without inventing prior choices', async () => {
    const now = new Date().toISOString()
    const saved = upsertCriticalCareActivityProgress(
      createEmptyCriticalCareProgress(now),
      {
        activityId: 'hemodynamics:learn:pac-signal-validation',
        status: 'in-progress',
        currentPhase: 'act',
        mode: 'guided',
        attempts: 1,
        hintCount: 0,
        competencyEvidenceIds: [],
        updatedAt: now,
      },
      {
        activityId: 'hemodynamics:learn:pac-signal-validation',
        pathname: '/icu-hemodynamics/learn',
        query: { activity: 'pac-signal-validation' },
        mode: 'guided',
        phase: 'act',
        scenarioId: 'HD-08',
        checkpointId: 'action-ready',
        payloadVersion: 'pac-signal-validation-v1',
        updatedAt: now,
      },
    )
    writeCriticalCareProgress(window.localStorage, saved)

    render(<PacSignalValidationActivity />)
    expect(await screen.findByRole('button', { name: 'Resume activity' })).toBeInTheDocument()
    expect(
      screen.getByText(/prior prediction choice.*intentionally not retained/i),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Resume activity' }))

    expect(
      await screen.findByRole('heading', { name: 'PAC signal validation' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Act').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Position wedge')).toBeInTheDocument()
  })

  it('maps a preserved PAC skill station into the same six-phase completion contract', async () => {
    render(<PacGuidedSkillActivity skillId="pressure-system" />)
    expect(
      await screen.findByRole('heading', { name: 'Level, zero, and dynamic response' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Orient to this skill station' }))
    fireEvent.click(
      screen.getByLabelText('Validate the signal and technique before interpretation'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))

    expect(
      screen.getByRole('heading', { name: 'Leveling changes the number, not the waveform' }),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Transducer relative to phlebostatic axis/i), {
      target: { value: '10' },
    })
    expect(screen.getByText('-7.4 mmHg')).toBeInTheDocument()
    expect(screen.getByText('reads low')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open to air + zero' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fast flush test' }))
    expect(
      screen.getByRole('img', {
        name: /observed fast-flush release response.*small number of rapidly settling oscillations/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Continue after completing the objective' }),
    ).toBeDisabled()
    expect(
      screen.queryByRole('heading', { name: 'Three qualitative release patterns' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /Acceptable.*Prompt return/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Check classification' }))
    expect(screen.getByRole('status', { name: 'Dynamic response feedback' })).toHaveTextContent(
      /Correct.*acceptable dynamic response/i,
    )
    expect(
      screen.getByRole('heading', { name: 'Three qualitative release patterns' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue after completing the objective' }))
    fireEvent.click(screen.getByRole('button', { name: 'Observe and explain the result' }))
    expect(screen.getByRole('heading', { name: 'Causal debrief' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open transfer check' }))
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Carry the validation sequence into the new context',
      }),
    )

    const envelope = JSON.parse(
      window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY) ?? '{}',
    )
    expect(envelope.activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activityId: 'hemodynamics:learn:pressure-system',
          status: 'completed',
          currentPhase: 'transfer',
        }),
      ]),
    )
  })

  it('withholds the fast-flush classification until submission and requires correction', async () => {
    render(<PacGuidedSkillActivity skillId="pressure-system" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Orient to this skill station' }))
    fireEvent.click(
      screen.getByLabelText('Validate the signal and technique before interpretation'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open to air + zero' }))
    fireEvent.change(screen.getByLabelText('Concealed test'), {
      target: { value: 'response-a' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Fast flush test' }))

    expect(screen.getByText('Classification withheld')).toBeInTheDocument()
    expect(screen.queryByText(/This is an underdamped response/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /Overdamped.*Sluggish return/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Check classification' }))
    expect(screen.getByRole('status', { name: 'Dynamic response feedback' })).toHaveTextContent(
      /Compare the response.*underdamped response/i,
    )
    expect(
      screen.getByRole('button', { name: 'Continue after completing the objective' }),
    ).toBeDisabled()

    fireEvent.click(screen.getByRole('radio', { name: /Underdamped.*Several oscillations/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Check classification' }))
    expect(screen.getByRole('status', { name: 'Dynamic response feedback' })).toHaveTextContent(
      /Correct.*underdamped response/i,
    )
    expect(
      screen.getByRole('button', { name: 'Continue after completing the objective' }),
    ).toBeEnabled()
  })
})
