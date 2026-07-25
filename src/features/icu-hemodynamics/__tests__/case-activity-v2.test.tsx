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

  it('runs the preserved reducer through the learning phases and writes both progress contracts', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Open to air + zero' }))
    fireEvent.click(screen.getByRole('button', { name: /fast-flush response check/i }))
    for (const intervention of requiredInterventions) {
      fireEvent.click(
        screen.getByRole('button', {
          name: (accessibleName) => accessibleName.includes(intervention.shortLabel),
        }),
      )
    }
    fireEvent.click(screen.getByRole('button', { name: 'Observe the modeled response' }))
    fireEvent.click(screen.getByRole('button', { name: 'Commit final reassessment' }))

    expect(
      await screen.findByRole('heading', {
        name: /Before we look at what happened/,
      }),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('My working frame'), {
      target: { value: 'The pressure pattern suggested low effective filling.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Capture this frame and reveal the trace' }))
    expect(screen.getByRole('heading', { name: 'Reconstruct the reasoning' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Which cue I trusted' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue to the signal-transfer variant/ }))
    fireEvent.click(
      screen.getByLabelText(
        'An off-level, overdamped measurement chain that requires revalidation',
      ),
    )
    fireEvent.change(screen.getByLabelText(/Transducer relative to phlebostatic axis/i), {
      target: { value: '0' },
    })
    fireEvent.click(screen.getByRole('button', { name: /fast-flush response check/i }))
    fireEvent.click(screen.getByRole('radio', { name: /Overdamped.*Sluggish return/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Check classification' }))
    fireEvent.click(screen.getByRole('button', { name: 'Resolve the pressure-system response' }))
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Complete transfer and keep the reasoning feedback',
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

  it('keeps challenge identity visible while deferring optional teaching feedback', async () => {
    render(<HemodynamicCaseActivity caseId="HD-07" mode="challenge" />)
    expect(
      await screen.findByRole('heading', {
        name: 'Pressure equalization with a falling pulse pressure',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show hint' })).not.toBeInTheDocument()
    expect(screen.getAllByText('HD-07').length).toBeGreaterThan(0)
    expect(screen.queryByText('CI ≥ 2.2 L/min/m²')).not.toBeInTheDocument()
    expect(screen.queryByText('MAP ≥ 65 mmHg')).not.toBeInTheDocument()
    expect(screen.getByText(/tamponade/i)).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: /Show teaching feedback as I work/ }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Help' }))
    expect(screen.getByText(/deferring teaching feedback until the debrief/i)).toBeInTheDocument()
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
