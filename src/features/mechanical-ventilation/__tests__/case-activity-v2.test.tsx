import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import {
  CRITICAL_CARE_PROGRESS_STORAGE_KEY,
  type CriticalCareActivityMode,
} from '@/features/learning-module/activity'

import MechanicalVentilationCaseActivityV2 from '../components/MechanicalVentilationCaseActivityV2'
import { mechanicalVentilationCaseById, selectVentilationTransferCaseId } from '../content'
import {
  MECHANICAL_VENTILATION_SESSION_STORAGE_KEY,
  readProgress,
  type CaseOutcome,
  type VentilationAction,
} from '../engine'

const push = jest.fn()
const recordEvent = jest.fn()

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

jest.mock('@/lib/analytics', () => ({
  recordSiteModuleEvent: (...args: unknown[]) => recordEvent(...args),
}))

jest.mock('../components/BedsidePanel', () => ({
  BedsidePanel: () => <div data-testid="mock-bedside">Patient surface</div>,
}))

jest.mock('../components/MechanicalVentilatorConsole', () => ({
  MechanicalVentilatorConsole: ({ controlsEnabled }: { controlsEnabled: boolean }) => (
    <div data-testid="mock-console" data-controls={controlsEnabled}>
      Fixed console surface
    </div>
  ),
}))

jest.mock('../components/CaseWorkflow', () => ({
  CaseWorkflow: ({
    dispatch,
    onResult,
  }: {
    dispatch: (action: VentilationAction) => void
    onResult: (outcome: CaseOutcome) => void
    mode?: CriticalCareActivityMode
  }) => (
    <div data-testid="mock-workflow">
      <button type="button" onClick={() => dispatch({ type: 'STEP_BREATH' })}>
        Observe mock breath
      </button>
      <button
        type="button"
        onClick={() =>
          dispatch({
            type: 'COMMIT_PREDICTION',
            mechanismId: 'test-mechanism',
            priorityId: 'test-priority',
            responseId: 'test-response',
          })
        }
      >
        Commit mock prediction
      </button>
      <button
        type="button"
        onClick={() => {
          dispatch({ type: 'COMMIT_REASSESSMENT' })
          dispatch({ type: 'REVEAL_DEBRIEF' })
          onResult({
            score: 90,
            mastery: true,
            resolved: true,
            criticalErrors: [],
            domains: {
              safety: 20,
              mechanism: 20,
              correctiveActions: 20,
              reassessment: 20,
              communicationComfort: 10,
            },
          })
        }}
      >
        Finish mock case
      </button>
      <button
        type="button"
        onClick={() =>
          onResult({
            score: 40,
            mastery: false,
            resolved: false,
            criticalErrors: [],
            domains: {
              safety: 10,
              mechanism: 10,
              correctiveActions: 10,
              reassessment: 10,
              communicationComfort: 0,
            },
          })
        }
      >
        Finish unresolved mock case
      </button>
    </div>
  ),
}))

describe('mechanical ventilation V2 case activity', () => {
  beforeEach(() => {
    window.localStorage.clear()
    push.mockClear()
    recordEvent.mockClear()
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

  it('keeps the selected console fixed and saves completion only after transfer', async () => {
    render(
      <MechanicalVentilationCaseActivityV2
        caseId="MV-01"
        deviceId="drager-evita-v800-v600"
        mode="practice"
        section="practice"
      />,
    )

    expect(await screen.findByRole('heading', { name: /MV-01/i })).toBeInTheDocument()
    expect(screen.getByText(/Dräger Evita V800 \/ V600 · 3.1n/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Choose a training console/i }),
    ).not.toBeInTheDocument()
    expect(window.localStorage.getItem(MECHANICAL_VENTILATION_SESSION_STORAGE_KEY)).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Observe mock breath' }))
    fireEvent.click(screen.getByRole('button', { name: 'Commit mock prediction' }))
    fireEvent.click(screen.getByRole('button', { name: 'Finish mock case' }))

    const beforeTransfer = JSON.parse(
      window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY) ?? '{}',
    )
    expect(beforeTransfer.activities[0].status).toBe('in-progress')
    expect(readProgress().bestScores['MV-01']).toBe(90)

    fireEvent.click(screen.getByRole('button', { name: /Load contrasting transfer patient/i }))
    const transferCaseId = selectVentilationTransferCaseId('MV-01')
    const transferDefinition = mechanicalVentilationCaseById.get(transferCaseId ?? '')
    expect(transferDefinition).toBeDefined()
    const incorrectMechanism = transferDefinition!.mechanismOptions.find(
      (option) => option.id !== transferDefinition!.correctMechanismId,
    )
    const correctMechanism = transferDefinition!.mechanismOptions.find(
      (option) => option.id === transferDefinition!.correctMechanismId,
    )
    expect(incorrectMechanism).toBeDefined()
    expect(correctMechanism).toBeDefined()

    fireEvent.click(screen.getByLabelText(incorrectMechanism!.label))
    fireEvent.click(screen.getByRole('button', { name: 'Record bedside assessment' }))
    fireEvent.click(screen.getByRole('button', { name: 'Document multitrace review' }))
    const transferButton = screen.getByRole('button', {
      name: /Submit scored transfer/i,
    })
    fireEvent.click(transferButton)
    expect(screen.getByText(/Follow-up score: 2\/3/)).toBeInTheDocument()
    expect(screen.queryByText(/^Completed$/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(correctMechanism!.label))
    fireEvent.click(transferButton)

    const completed = JSON.parse(
      window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY) ?? '{}',
    )
    expect(completed.activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activityId: 'ventilation:practice:MV-01',
          status: 'mastered',
          bestScore: 90,
          currentPhase: 'transfer',
        }),
      ]),
    )
    expect(completed.resume).toBeUndefined()
    expect(window.localStorage.getItem(MECHANICAL_VENTILATION_SESSION_STORAGE_KEY)).toBeNull()

    const interactions = recordEvent.mock.calls.map(
      ([event]) => (event as { eventPayload?: { interaction?: string } }).eventPayload?.interaction,
    )
    expect(
      interactions.filter((interaction) => interaction === 'critical_care_goal_met'),
    ).toHaveLength(1)
    expect(
      interactions.filter((interaction) => interaction === 'critical_care_activity_mastered'),
    ).toHaveLength(1)
    expect(
      interactions.filter((interaction) => interaction === 'critical_care_transfer_completed'),
    ).toHaveLength(1)
    expect(
      interactions.filter((interaction) =>
        [
          'critical_care_transfer_completed',
          'critical_care_activity_completed',
          'critical_care_activity_mastered',
        ].includes(interaction ?? ''),
      ),
    ).toEqual(['critical_care_transfer_completed', 'critical_care_activity_mastered'])
  })

  it('does not report goal attainment for an unresolved outcome', async () => {
    render(
      <MechanicalVentilationCaseActivityV2
        caseId="MV-01"
        deviceId="drager-evita-v800-v600"
        mode="practice"
        section="practice"
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Finish unresolved mock case' }))

    const interactions = recordEvent.mock.calls.map(
      ([event]) => (event as { eventPayload?: { interaction?: string } }).eventPayload?.interaction,
    )
    expect(interactions).not.toContain('critical_care_goal_met')
  })

  it('keeps assessment identity masked while preserving observable patient context', async () => {
    render(
      <MechanicalVentilationCaseActivityV2
        caseId="MV-01"
        deviceId="hamilton-c6"
        mode="challenge"
        section="assess"
        seedToken="assessment-mask-test"
      />,
    )

    expect(
      await screen.findByRole('heading', { name: 'Masked ventilation challenge' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/A 62-year-old woman with pneumonia-associated moderate-to-severe ARDS/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reference' })).not.toBeInTheDocument()
    expect(screen.queryByText(/seed \d+/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('mock-bedside')).toBeInTheDocument()
    expect(screen.getByTestId('mock-console')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Finish mock case' }))
    fireEvent.click(screen.getByRole('button', { name: /Load contrasting transfer patient/i }))

    expect(screen.getByRole('heading', { name: 'Masked transfer challenge' })).toBeInTheDocument()
    expect(screen.getByText(/A 50-year-old man with ARDS on moderate PEEP/)).toBeInTheDocument()
    expect(screen.queryByText(/Transfer · MV-14/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reference' })).not.toBeInTheDocument()
  })

  it('restores the scored primary case exactly and restarts partial transfer work clean', async () => {
    const props = {
      caseId: 'MV-01',
      deviceId: 'hamilton-c6' as const,
      mode: 'practice' as const,
      section: 'practice' as const,
    }
    const first = render(<MechanicalVentilationCaseActivityV2 {...props} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Finish mock case' }))
    fireEvent.click(screen.getByRole('button', { name: /Load contrasting transfer patient/i }))

    const saved = JSON.parse(
      window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY) ?? '{}',
    )
    expect(saved.resume).toEqual(
      expect.objectContaining({
        phase: 'transfer',
        checkpointId: 'transfer-clean-variant',
        payloadVersion: 'ventilation-transfer-safe-v1',
      }),
    )

    first.unmount()
    render(<MechanicalVentilationCaseActivityV2 {...props} />)

    expect(await screen.findByRole('heading', { name: /Transfer · MV-14/i })).toBeInTheDocument()
    expect(screen.getByText(/scored primary case was reconstructed exactly/i)).toBeInTheDocument()
    expect(screen.getByText(/Follow-up evidence: 0 of 3 recorded/)).toBeInTheDocument()
  })
})
