import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { CRITICAL_CARE_PROGRESS_STORAGE_KEY } from '@/features/learning-module/activity'

import { HemodynamicCaseActivity } from '../components/HemodynamicCaseActivity'
import { hemodynamicCaseById } from '../content'
import {
  ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY,
  ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
} from '../engine'
import { ICU_HEMODYNAMICS_LEARN_STORAGE_KEY } from '../engine/learnProgress'
import {
  ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY,
  parseSelfPacedRecord,
} from '../engine/selfPacedProgress'

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
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
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

/** The lifecycle events a self-paced case may still emit: none of them carries a response. */
const AUTOMATIC_LIFECYCLE_EVENTS = new Set([
  'critical_care_activity_opened',
  'critical_care_qualified_start',
  'critical_care_phase_completed',
])

function interactions(): readonly string[] {
  return recordLifecycleEvent.mock.calls.map(
    ([event]) => (event as { interaction: string }).interaction,
  )
}

function openCheckpoint(name: RegExp) {
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Case checkpoints' })).getByRole('button', {
      name,
    }),
  )
}

function storedRecord() {
  return parseSelfPacedRecord(localStorage.getItem(ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY))
}

/**
 * HD-01 replaced `case-activity-v2.test.tsx`, which asserted that a finished case wrote a scored
 * legacy result and a completed/mastered normalized record, emitted prediction/mastery telemetry,
 * saved a resume checkpoint, and deferred feedback by default on the challenge. Under the self-paced
 * decision a case writes nothing but the visit; its real simulation constraints stay.
 */
describe('a hemodynamic case, self-paced', () => {
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

  it('acts without a working frame, opens the debrief before any reassessment, and records only the visit', async () => {
    const definition = hemodynamicCaseById.get('HD-01')!
    render(<HemodynamicCaseActivity caseId="HD-01" mode="practice" />)
    expect(await screen.findByRole('heading', { name: definition.title })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Orient to the patient and signals' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Go to the actions without recording a frame' }),
    )
    const plr = () => screen.getByRole('button', { name: (name) => name.includes('PLR') })
    expect(plr()).toBeEnabled()
    fireEvent.click(plr())
    // The reducer ran it without a prediction: a non-repeatable intervention is now spent.
    expect(plr()).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Help' }))
    expect(document.querySelector('[data-case-hint]')?.textContent).toBe(definition.guidedPrompt)

    openCheckpoint(/Review your reasoning/)
    expect(document.querySelector('[data-debrief-before-reassessment]')).not.toBeNull()
    expect(document.querySelector('[data-expert-reasoning]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Open the signal-transfer variant' })).toBeEnabled()

    expect(localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(ICU_HEMODYNAMICS_LEARN_STORAGE_KEY)).toBeNull()
    expect(storedRecord()?.openedCaseIds).toEqual(['HD-01'])
    expect(storedRecord()?.location).toEqual({ kind: 'case', caseId: 'HD-01', mode: 'practice' })
    expect(interactions().every((interaction) => AUTOMATIC_LIFECYCLE_EVENTS.has(interaction))).toBe(
      true,
    )
  })

  it('runs through reassessment and the transfer, needs a real line repair, and leaves legacy records byte-identical', async () => {
    const legacy: Readonly<Record<string, string>> = {
      [ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY]:
        '{"version":1,"lastCaseId":"HD-01","attempts":{"HD-01":3},"bestScores":{"HD-01":91}}',
      [CRITICAL_CARE_PROGRESS_STORAGE_KEY]:
        '{"version":1,"activities":[{"activityId":"hemodynamics:practice:HD-01","status":"mastered","bestScore":91}],"updatedAt":"2026-09-01T00:00:00.000Z"}',
      [ICU_HEMODYNAMICS_LEARN_STORAGE_KEY]:
        '{"version":1,"completedSectionIds":["why-measure"],"lastSectionId":"why-measure","updatedAt":"2026-09-01T00:00:00.000Z"}',
    }
    for (const [key, value] of Object.entries(legacy)) localStorage.setItem(key, value)

    const definition = hemodynamicCaseById.get('HD-01')!
    const requiredInterventions = definition.requiredInterventionIds.map(
      (requiredId) => definition.interventions.find((item) => item.id === requiredId)!,
    )
    render(<HemodynamicCaseActivity caseId="HD-01" mode="practice" />)
    expect(await screen.findByRole('heading', { name: definition.title })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Orient to the patient and signals' }))
    fireEvent.change(screen.getByLabelText('Suspected mechanism'), {
      target: { value: definition.correctMechanismId },
    })
    fireEvent.change(screen.getByLabelText('Immediate priority'), {
      target: { value: definition.correctPriorityId },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Record mechanism and priority' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Reassess and open the debrief' }))
    expect(document.querySelector('[data-debrief-before-reassessment]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Open the signal-transfer variant' }))
    // The answer alone does not revalidate the line.
    fireEvent.click(
      screen.getByLabelText(
        'An off-level, overdamped measurement chain that requires revalidation',
      ),
    )
    expect(document.querySelector('[data-transfer-feedback]')).toHaveTextContent(
      /Best-supported interpretation/,
    )
    expect(screen.getByRole('button', { name: 'Confirm the line is revalidated' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Transducer relative to phlebostatic axis/i), {
      target: { value: '0' },
    })
    fireEvent.click(screen.getByRole('button', { name: /fast-flush response check/i }))
    fireEvent.click(screen.getByRole('radio', { name: /Overdamped.*Sluggish return/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Check classification' }))
    fireEvent.click(screen.getByRole('button', { name: 'Resolve the pressure-system response' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm the line is revalidated' }))
    expect(document.querySelector('[data-transfer-complete]')).not.toBeNull()

    for (const [key, value] of Object.entries(legacy)) expect(localStorage.getItem(key)).toBe(value)
    expect(localStorage.getItem(ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY)).toBeNull()
    expect(interactions().every((interaction) => AUTOMATIC_LIFECYCLE_EVENTS.has(interaction))).toBe(
      true,
    )
  })

  it('gives each transfer option its own reasoning, openable before an answer', async () => {
    render(<HemodynamicCaseActivity caseId="HD-01" mode="practice" />)
    await screen.findByRole('heading', { name: hemodynamicCaseById.get('HD-01')!.title })
    openCheckpoint(/Revalidate the changed signal/)
    fireEvent.click(screen.getByRole('button', { name: 'Show the reasoning' }))
    const reasoning = document.querySelector('[data-transfer-reasoning]')!
    expect(reasoning.querySelectorAll('li')).toHaveLength(3)
    expect(reasoning.textContent).not.toMatch(/Reasonable cue to consider/)
    expect(reasoning.textContent).toMatch(/fast-flush release tests the tubing and transducer/)
    fireEvent.click(screen.getByLabelText(/Respiratory variation alone/))
    expect(document.querySelector('[data-transfer-feedback]')).toHaveTextContent(
      /Not the best-supported reading/,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(document.querySelector('[data-transfer-feedback]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Confirm the line is revalidated' })).toBeDisabled()
  })

  it('opens the applied case with help and immediate feedback; holding feedback is the learner’s choice', async () => {
    render(<HemodynamicCaseActivity caseId="HD-07" mode="challenge" />)
    expect(
      await screen.findByRole('heading', {
        name: 'Pressure equalization with a falling pulse pressure',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Applied case · HD-07/ })).toBeInTheDocument()
    const flow = document.querySelector('[data-case-flow]')!
    expect(flow).toHaveAttribute('data-feedback-mode', 'immediate')
    const hold = screen.getByRole('checkbox', { name: /Hold teaching feedback until the debrief/ })
    expect(hold).not.toBeChecked()
    fireEvent.click(hold)
    expect(flow).toHaveAttribute('data-feedback-mode', 'deferred')
    fireEvent.click(screen.getByRole('button', { name: 'Help' }))
    expect(document.querySelector('[data-case-hint]')?.textContent?.length).toBeGreaterThan(0)
    expect(localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBeNull()
    expect(storedRecord()?.location).toEqual({ kind: 'case', caseId: 'HD-07', mode: 'applied' })
  })

  it('still interrupts a hazardous action taken without a working frame', async () => {
    render(<HemodynamicCaseActivity caseId="HD-01" mode="practice" />)
    await screen.findByRole('heading', { name: hemodynamicCaseById.get('HD-01')!.title })
    fireEvent.click(screen.getByRole('button', { name: 'Orient to the patient and signals' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Go to the actions without recording a frame' }),
    )
    const peep = () => screen.getByRole('button', { name: (name) => name.includes('PEEP ↑') })
    fireEvent.click(peep())
    expect(screen.getAllByText(/Stopping here/).length).toBeGreaterThan(0)
    // The pre-action state is preserved: the hazardous intervention did not run.
    expect(peep()).toBeEnabled()
    expect(interactions()).not.toContain('critical_care_safety_event')
  })
})
