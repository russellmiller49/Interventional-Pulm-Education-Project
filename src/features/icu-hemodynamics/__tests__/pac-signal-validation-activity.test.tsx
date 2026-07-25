import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import {
  CRITICAL_CARE_PROGRESS_STORAGE_KEY,
  createEmptyCriticalCareProgress,
  upsertCriticalCareActivityProgress,
  writeCriticalCareProgress,
} from '@/features/learning-module/activity'

import { PacGuidedSkillActivity } from '../components/PacGuidedSkillActivity'
import { PacLearningPathwayNav } from '../components/PacLearningPathwayNav'
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

    fireEvent.change(screen.getByLabelText(/Transducer relative to phlebostatic axis/i), {
      target: { value: '0' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open to air + zero' }))
    fireEvent.click(screen.getByRole('button', { name: /fast-flush response check/i }))
    fireEvent.click(screen.getByRole('radio', { name: /Underdamped.*Several oscillations/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Check classification' }))
    fireEvent.click(screen.getByRole('button', { name: 'Resolve the pressure-system response' }))
    fireEvent.click(screen.getByRole('button', { name: 'Retract' }))

    for (let trial = 0; trial < 3; trial += 1) {
      fireEvent.click(screen.getByRole('button', { name: /Hold to inject/i }))
      const acceptButtons = screen.getAllByRole('button', { name: 'Accept' })
      fireEvent.click(acceptButtons[acceptButtons.length - 1])
    }
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
      screen.getByLabelText('An overdamped measurement system attenuating rapid pressure change'),
    )
    fireEvent.click(screen.getByRole('button', { name: /fast-flush response check/i }))
    fireEvent.click(screen.getByRole('radio', { name: /Overdamped.*Sluggish return/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Check classification' }))
    fireEvent.click(screen.getByRole('button', { name: 'Resolve the pressure-system response' }))
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Complete after choosing, reviewing, and correcting the new trace',
      }),
    )
    expect(screen.getByText('Worked through')).toBeInTheDocument()

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
    expect(screen.getByRole('button', { name: 'Repeat this section' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Continue to hemodynamics practice' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Repeat this section' }))
    expect(screen.getByText('Recognize').closest('li')).toHaveAttribute('aria-current', 'step')
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

  it('requires an authored pressure variant interaction and keeps SME-review work non-credit', async () => {
    const onPathwaySectionChange = jest.fn()
    render(
      <PacGuidedSkillActivity
        skillId="pressure-system"
        onPathwaySectionChange={onPathwaySectionChange}
      />,
    )
    expect(
      await screen.findByRole('heading', { name: 'Level, zero, and dynamic response' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Orient to this skill station' }))
    fireEvent.click(
      screen.getByLabelText(
        'The system is off level, not zeroed, and underdamped; repair and verify each problem separately.',
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))

    expect(
      screen.getByRole('heading', { name: 'Leveling changes the number, not the waveform' }),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Transducer relative to phlebostatic axis/i), {
      target: { value: '0' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open to air + zero' }))
    fireEvent.click(screen.getByRole('button', { name: /fast-flush response check/i }))
    expect(
      screen.getByRole('img', {
        name: /observed fast-flush release response.*several oscillations persist/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Continue after completing the objective' }),
    ).toBeDisabled()
    expect(
      screen.queryByRole('heading', { name: 'Three qualitative release patterns' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /Underdamped.*Several oscillations/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Check classification' }))
    expect(screen.getByRole('status', { name: 'Dynamic response feedback' })).toHaveTextContent(
      /Pattern aligned.*underdamped response/i,
    )
    expect(
      screen.getByRole('heading', { name: 'Three qualitative release patterns' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Continue after completing the objective' }),
    ).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Resolve the pressure-system response' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue after completing the objective' }))
    fireEvent.click(screen.getByRole('button', { name: 'Observe and explain the result' }))
    expect(screen.getByRole('heading', { name: 'Causal debrief' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open transfer check' }))

    fireEvent.click(
      screen.getByLabelText(
        'Re-level the transducer and restore the overdamped measurement response.',
      ),
    )
    const completeTransfer = screen.getByRole('button', {
      name: 'Complete transfer and keep the reasoning feedback',
    })
    expect(completeTransfer).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Transducer relative to phlebostatic axis/i), {
      target: { value: '0' },
    })
    fireEvent.click(screen.getByRole('button', { name: /fast-flush response check/i }))
    fireEvent.click(screen.getByRole('radio', { name: /Overdamped.*Sluggish return/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Check classification' }))
    fireEvent.click(screen.getByRole('button', { name: 'Resolve the pressure-system response' }))
    expect(completeTransfer).toBeEnabled()
    fireEvent.click(completeTransfer)

    const envelope = JSON.parse(
      window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY) ?? '{}',
    )
    expect(envelope.activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activityId: 'hemodynamics:learn:pressure-system',
          status: 'in-progress',
          currentPhase: 'transfer',
          competencyEvidenceIds: [],
        }),
      ]),
    )
    expect(envelope.resume).toBeDefined()
    expect(screen.getByText('Draft reviewed · non-credit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Repeat this section' })).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Continue to next section: Interpret normal and abnormal waveforms',
      }),
    )
    expect(onPathwaySectionChange).toHaveBeenCalledWith('waveform-interpretation')
  })

  it('orients through introducer, RA, RV, PA, and PAWP before restarting the hands-on pass', async () => {
    render(<PacGuidedSkillActivity skillId="catheter-advancement" />)

    expect(
      await screen.findByRole('heading', { name: 'Advance the PAC by waveform' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Position introducer')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Orient to this skill station' }))
    expect(screen.getByText('Position introducer')).toBeInTheDocument()
    expect(screen.getByText('Orientation 1 of 5')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Introducer / SVC' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next: Right atrium' }))
    expect(screen.getByText('Position ra')).toBeInTheDocument()
    expect(screen.getByText('Orientation 2 of 5')).toBeInTheDocument()
    expect(screen.getByText(/distal PAC and CVP channels represent the same/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next: Right ventricle' }))
    expect(screen.getByText('Position rv')).toBeInTheDocument()
    expect(screen.getByText('Orientation 3 of 5')).toBeInTheDocument()
    expect(screen.getByText(/diastolic contour rather than the peak alone/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next: Pulmonary artery' }))
    expect(screen.getByText('Position pa')).toBeInTheDocument()
    expect(screen.getByText('Orientation 4 of 5')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next: Normal wedge / PAWP' }))
    expect(screen.getByText('Position wedge')).toBeInTheDocument()
    expect(screen.getByText('Orientation 5 of 5')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Normal wedge / PAWP' })).toBeInTheDocument()
    expect(screen.getByText('Balloon · INFLATED for brief PA occlusion')).toBeInTheDocument()
    expect(screen.getByText(/static column of blood/i)).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('radio', {
        name: /PA pulsatility and the dicrotic notch disappear/i,
      }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Finish orientation and begin hands-on pass' }),
    )
    expect(screen.getByText('Position introducer')).toBeInTheDocument()
    expect(screen.getByText('Balloon · deflated')).toBeInTheDocument()
  })

  it('withholds the fast-flush classification until submission and requires correction', async () => {
    render(<PacGuidedSkillActivity skillId="pressure-system" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Orient to this skill station' }))
    fireEvent.click(
      screen.getByLabelText(
        'The system is off level, not zeroed, and underdamped; repair and verify each problem separately.',
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))
    fireEvent.change(screen.getByLabelText(/Transducer relative to phlebostatic axis/i), {
      target: { value: '0' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open to air + zero' }))
    fireEvent.click(screen.getByRole('button', { name: /fast-flush response check/i }))

    expect(screen.getByText('Classification withheld')).toBeInTheDocument()
    expect(screen.queryByText(/This is an underdamped response/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /Overdamped.*Sluggish return/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Check classification' }))
    expect(screen.getByText('Reference pattern')).toBeInTheDocument()
    expect(screen.getByText('Selected response')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Dynamic response feedback' })).toHaveTextContent(
      /Compare the response.*underdamped response/i,
    )
    expect(
      screen.getByRole('button', { name: 'Continue after completing the objective' }),
    ).toBeDisabled()

    fireEvent.click(screen.getByRole('radio', { name: /Underdamped.*Several oscillations/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Check classification' }))
    expect(screen.getByRole('status', { name: 'Dynamic response feedback' })).toHaveTextContent(
      /Pattern aligned.*underdamped response/i,
    )
    expect(
      screen.getByRole('button', { name: 'Continue after completing the objective' }),
    ).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Resolve the pressure-system response' }))
    expect(
      screen.getByRole('button', { name: 'Continue after completing the objective' }),
    ).toBeEnabled()
  })

  it('presents an ungated advancement-first pathway with signal validation last', () => {
    const onSelect = jest.fn()
    render(<PacLearningPathwayNav activeSectionId="catheter-advancement" onSelect={onSelect} />)

    const sectionButtons = screen.getAllByRole('button')
    expect(sectionButtons).toHaveLength(7)
    expect(sectionButtons[0]).toHaveAccessibleName(/^1\. Advance the PAC by waveform/)
    expect(sectionButtons[6]).toHaveAccessibleName(
      /^7\. PAC signal-validation capstone, integration capstone/,
    )
    expect(sectionButtons[0]).toHaveAttribute('aria-current', 'step')

    fireEvent.click(
      screen.getByRole('button', {
        name: /^6\. Derived hemodynamics and validity/,
      }),
    )
    expect(onSelect).toHaveBeenCalledWith('derived-hemodynamics')
  })

  it('allows direct phase navigation while rebuilding the authored transfer setup', async () => {
    render(<PacGuidedSkillActivity skillId="pressure-system" />)
    expect(
      await screen.findByRole('heading', { name: 'Level, zero, and dynamic response' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open Transfer phase' }))

    expect(screen.getByText('Transfer').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText(/Opened the transfer section directly/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Complete transfer and keep the reasoning feedback' }),
    ).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Open Recognize phase' }))
    expect(screen.getByText('Recognize').closest('li')).toHaveAttribute('aria-current', 'step')
  })

  it('teaches thermodilution versus Fick before the cardiac-output simulator', async () => {
    render(<PacGuidedSkillActivity skillId="thermodilution-series" />)

    expect(
      await screen.findByRole('heading', {
        name: 'Cardiac output: measure flow, then judge the method',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/CO = V̇O₂ ÷/)).toBeInTheDocument()
    expect(
      screen.getByText(/Indirect.*estimated Fick substitutes predicted oxygen consumption/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Thermodilution measurement lab' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('separator')).toHaveLength(2)
  })

  it('makes the derived-value dependency teaching visible beside the live formulas', async () => {
    render(<PacGuidedSkillActivity skillId="derived-hemodynamics" />)

    expect(
      await screen.findByRole('heading', {
        name: 'Derived hemodynamics are equations, not new measurements',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'PVR = (mPAP − PAWP) ÷ CO' })).toBeInTheDocument()
    expect(screen.getByText(/Which input is the denominator/)).toBeInTheDocument()

    fireEvent.click(
      screen.getByText('Derived hemodynamics and interpretation limits', {
        selector: 'summary',
      }),
    )
    expect(screen.getByText('CI')).toBeInTheDocument()
    expect(screen.getByText('CO / BSA')).toBeInTheDocument()
  })
})
