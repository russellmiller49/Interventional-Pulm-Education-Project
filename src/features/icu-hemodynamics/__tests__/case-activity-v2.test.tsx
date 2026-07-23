import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import { CRITICAL_CARE_PROGRESS_STORAGE_KEY } from '@/features/learning-module/activity'

import { HemodynamicCaseActivity } from '../components/HemodynamicCaseActivity'
import { hemodynamicCaseById } from '../content'
import { ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY } from '../engine'

const push = jest.fn()
const recordLifecycleEvent = jest.fn()

jest.mock('@/features/critical-care/analytics', () => ({
  recordCriticalCareEvent: (...args: unknown[]) => recordLifecycleEvent(...args),
}))

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
  BedsideMonitor: ({ state }: { state: { responseMessage: string | null } }) => (
    <section aria-label="Mock deterministic bedside monitor">
      <span>{state.responseMessage}</span>
    </section>
  ),
}))

jest.mock('../components/PacSkillsLab', () => ({
  PacSkillsLab: () => <div>Mock thermodilution lab</div>,
}))

jest.mock('../components/FormulaDrawer', () => ({
  FormulaDrawer: () => <div>Mock derived values</div>,
}))

describe('focused hemodynamic case activity', () => {
  beforeEach(() => {
    window.localStorage.clear()
    push.mockClear()
    recordLifecycleEvent.mockClear()
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

  it('runs the preserved reducer and score through six phases and writes both progress contracts', async () => {
    const definition = hemodynamicCaseById.get('HD-01')
    if (!definition) throw new Error('Missing HD-01 test fixture.')
    const requiredInterventions = definition.requiredInterventionIds.map((requiredId) => {
      const intervention = definition.interventions.find((item) => item.id === requiredId)
      if (!intervention) throw new Error(`HD-01 must expose required intervention ${requiredId}.`)
      return intervention
    })

    render(<HemodynamicCaseActivity caseId="HD-01" mode="practice" />)
    expect(await screen.findByRole('heading', { name: definition.title })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Orient to the patient and signals' }))
    fireEvent.change(screen.getByLabelText('Suspected mechanism'), {
      target: { value: definition.correctMechanismId },
    })
    fireEvent.change(screen.getByLabelText('Immediate priority'), {
      target: { value: definition.correctPriorityId },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Commit mechanism and priority' }))

    fireEvent.click(screen.getByRole('button', { name: 'Level + zero' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fast flush' }))
    fireEvent.click(screen.getByRole('button', { name: 'Position' }))
    for (const intervention of requiredInterventions) {
      fireEvent.click(
        screen.getByRole('button', {
          name: (accessibleName) => accessibleName.includes(intervention.shortLabel),
        }),
      )
    }
    fireEvent.click(screen.getByRole('button', { name: 'Observe the modeled response' }))
    fireEvent.click(screen.getByRole('button', { name: 'Commit final reassessment' }))

    expect(await screen.findByRole('heading', { name: 'Causal debrief' })).toBeInTheDocument()
    expect(screen.getByText(/Total/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue to transfer check' }))
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Validate, predict, act, and reassess in the next case',
      }),
    )

    const normalized = JSON.parse(
      window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY) ?? '{}',
    )
    expect(normalized.activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activityId: 'hemodynamics:practice:HD-01',
          status: expect.stringMatching(/completed|mastered/),
          currentPhase: 'transfer',
        }),
      ]),
    )
    expect(normalized.resume).toBeUndefined()

    const legacy = JSON.parse(
      window.localStorage.getItem(ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY) ?? '{}',
    )
    expect(legacy.completedCaseIds).toContain('HD-01')

    const interactions = recordLifecycleEvent.mock.calls.map(
      ([event]) => (event as { interaction: string }).interaction,
    )
    expect(
      interactions.filter((interaction) => interaction === 'critical_care_activity_opened'),
    ).toHaveLength(1)
    expect(
      interactions.filter((interaction) => interaction === 'critical_care_prediction_submitted'),
    ).toHaveLength(1)
    expect(
      interactions.filter((interaction) => interaction === 'critical_care_debrief_viewed'),
    ).toHaveLength(1)
    expect(
      interactions.filter((interaction) => interaction === 'critical_care_goal_met'),
    ).toHaveLength(1)
    expect(
      interactions.filter((interaction) => interaction === 'critical_care_transfer_completed'),
    ).toHaveLength(1)
    expect(
      interactions.filter((interaction) =>
        ['critical_care_activity_completed', 'critical_care_activity_mastered'].includes(
          interaction,
        ),
      ),
    ).toHaveLength(1)
  })

  it('keeps hints unavailable and patient details masked in challenge mode', async () => {
    render(<HemodynamicCaseActivity caseId="HD-07" mode="challenge" />)
    expect(
      await screen.findByRole('heading', { name: 'Masked hemodynamics capstone' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show hint' })).not.toBeInTheDocument()
    expect(screen.getByText('Masked patient context')).toBeInTheDocument()
    expect(screen.queryByText('HD-07')).not.toBeInTheDocument()
    expect(screen.queryByText('CI ≥ 2.2 L/min/m²')).not.toBeInTheDocument()
    expect(screen.queryByText('MAP ≥ 65 mmHg')).not.toBeInTheDocument()
    expect(screen.queryByText('Cardiac tamponade')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Help' }))
    expect(screen.getByRole('status')).toHaveTextContent(/diagnosis cues remain hidden/i)
  })

  it('labels the authored restart checkpoint as Recognize rather than exact Predict resume', async () => {
    render(<HemodynamicCaseActivity caseId="HD-01" mode="practice" />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Orient to the patient and signals' }),
    )

    const normalized = JSON.parse(
      window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY) ?? '{}',
    )
    expect(normalized.resume).toEqual(
      expect.objectContaining({
        activityId: 'hemodynamics:practice:HD-01',
        checkpointId: 'authored-pre-prediction',
        phase: 'recognize',
      }),
    )
  })
})
