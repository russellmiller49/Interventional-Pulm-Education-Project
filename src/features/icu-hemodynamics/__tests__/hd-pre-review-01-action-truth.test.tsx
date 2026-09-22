import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { HemodynamicCaseActivity } from '../components/HemodynamicCaseActivity'
import { hemodynamicCaseById } from '../content'
import { describeObservedSystemState, observedSystemState } from '../engine/decisionRecord'
import { icuHemodynamicsReducer } from '../engine/reducer'
import { createInitialHemodynamicState } from '../engine/simulation'
import { standardTechnique } from '../engine/stageRuntime'
import type { HemodynamicSimulationState } from '../engine/types'

const push = jest.fn()

jest.mock('@/features/critical-care/analytics', () => ({
  recordCriticalCareEvent: jest.fn(),
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
  BedsideMonitor: ({
    state,
  }: {
    state: { responseMessage: string | null; measurementSystem: { zeroed: boolean } }
  }) => (
    <section aria-label="Mock deterministic bedside monitor">
      <span>{state.responseMessage}</span>
      <span data-monitor-zero>{state.measurementSystem.zeroed ? 'zeroed' : 'ZERO REQUIRED'}</span>
    </section>
  ),
}))

jest.mock('../components/FormulaDrawer', () => ({
  FormulaDrawer: () => <div>Mock derived values</div>,
}))

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

function openCheckpoint(name: RegExp) {
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Case checkpoints' })).getByRole('button', {
      name,
    }),
  )
}

function openDebrief() {
  openCheckpoint(/Review your reasoning/)
  fireEvent.click(
    screen.getByRole('button', { name: 'Show the teaching without recording a frame' }),
  )
}

function traceRows(): readonly string[] {
  return [...document.querySelectorAll('ol li')]
    .map((row) => row.textContent ?? '')
    .filter((text) => text.includes('Model +'))
}

function interventionCard(id: string): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(`[data-intervention="${id}"]`)!
}

/**
 * HD-PRE-REVIEW-01, parts E and F: what a case says happened, and what a decision record contains.
 *
 * On the base commit HD-08 narrated "the pressure chain was re-leveled and re-zeroed" over a header
 * still reading ZERO REQUIRED, because the host recorded "Applied …" and revealed the authored
 * five-part feedback before dispatching an action the reducer refuses by design (report P-09). And
 * every case's decision trace was formatted from `state.measurements`, so a run with no cardiac
 * output ever measured still listed a cardiac index at every step (report P-10).
 */
describe('HD-08 says what the engine did, not what the card meant (P-09)', () => {
  async function openActions() {
    const definition = hemodynamicCaseById.get('HD-08')!
    render(<HemodynamicCaseActivity caseId="HD-08" mode="practice" />)
    expect(await screen.findByRole('heading', { name: definition.title })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Orient to the patient and signals' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Go to the actions without recording a frame' }),
    )
  }

  it('points the three bundled cards at the controls that actually do the work', async () => {
    await openActions()
    for (const id of [
      'correct-measurement-system',
      'reposition-catheter',
      'repeat-valid-thermodilution',
    ]) {
      expect(interventionCard(id).getAttribute('data-preparation-only')).toBe('true')
    }
    expect(interventionCard('correct-measurement-system').textContent).toMatch(
      /level the transducer and zero it in The line/i,
    )
    expect(interventionCard('reposition-catheter').textContent).toMatch(/Withdraw in The tip/i)
    expect(interventionCard('repeat-valid-thermodilution').textContent).toMatch(
      /a series comes from The injection/i,
    )
    // The ordinary actions on this case keep their own cards untouched.
    expect(interventionCard('fluid-250').getAttribute('data-preparation-only')).toBeNull()
  })

  it('records a refused request as a request, changes nothing, and says so in the same words everywhere', async () => {
    await openActions()
    expect(document.querySelector('[data-monitor-zero]')?.textContent).toBe('ZERO REQUIRED')

    fireEvent.click(interventionCard('correct-measurement-system'))

    // The monitor and the current state are untouched: nothing was zeroed to fit a description.
    expect(document.querySelector('[data-monitor-zero]')?.textContent).toBe('ZERO REQUIRED')
    expect(screen.getByText(/Level: 10 cm from reference/)).toBeInTheDocument()
    expect(screen.getByText(/Atmospheric zero: required/)).toBeInTheDocument()

    // The feedback claims nothing and names the control.
    const verdict = document.querySelector('[data-scenario-feedback], article, section')
    expect(document.body.textContent).toMatch(/Requested, not performed/)
    expect(document.body.textContent).toMatch(/Nothing has changed on the monitor/)
    expect(document.body.textContent).not.toMatch(
      /the pressure chain was re-leveled and re-zeroed/i,
    )
    expect(verdict).not.toBeNull()

    // The engine's own refusal reaches the learner instead of being swallowed.
    expect(document.body.textContent).toMatch(/bundled action credit is disabled/)

    openDebrief()
    const rows = traceRows()
    expect(rows.some((row) => /Requested .*this case did not perform it/.test(row))).toBe(true)
    expect(rows.some((row) => /^.*Applied Re-level, re-zero/.test(row))).toBe(false)
  })

  it('still records an ordinary action as applied when the engine accepts it', async () => {
    await openActions()
    fireEvent.click(interventionCard('fluid-250'))
    openDebrief()
    expect(traceRows().some((row) => /Applied /.test(row))).toBe(true)
  })
})

describe('a decision record holds what could be seen or had been acquired (P-10)', () => {
  const definition = hemodynamicCaseById.get('HD-02')!

  it('says a cardiac index was not acquired when no series exists', () => {
    const state = createInitialHemodynamicState(definition, 'practice', 3000)
    const observed = observedSystemState(state)
    expect(observed.flow).toBeNull()
    const sentence = describeObservedSystemState(observed)
    expect(sentence).toMatch(/cardiac index not acquired/)
    expect(sentence).toMatch(/no accepted thermodilution series/)
    // The model's own cardiac index exists, and is not what the record says.
    expect(state.measurements.cardiacIndexLMinM2).toBeGreaterThan(0)
    expect(sentence).not.toContain(state.measurements.cardiacIndexLMinM2.toFixed(1))
  })

  it('carries the method, the number of curves and the age once a series has been acquired', () => {
    let state = createInitialHemodynamicState(definition, 'practice', 3000)
    const technique = standardTechnique()
    for (let index = 0; index < 3; index += 1) {
      state = icuHemodynamicsReducer(state, {
        type: 'GENERATE_THERMODILUTION_TRIAL',
        technique,
      })
    }
    state = state.thermodilutionTrials.reduce<HemodynamicSimulationState>(
      (current, trial) =>
        icuHemodynamicsReducer(
          icuHemodynamicsReducer(current, {
            type: 'REVIEW_THERMODILUTION_CURVE',
            trialId: trial.id,
          }),
          { type: 'SET_THERMODILUTION_ACCEPTED', trialId: trial.id, accepted: true },
        ),
      state,
    )
    state = icuHemodynamicsReducer(state, { type: 'TICK', seconds: 40 })

    const observed = observedSystemState(state)
    expect(observed.flow?.method).toBe('thermodilution')
    expect(observed.flow?.trialCount).toBe(3)
    expect(observed.flow?.ageSeconds).toBeGreaterThanOrEqual(39)
    expect(describeObservedSystemState(observed)).toMatch(
      /cardiac index .* \(thermodilution, 3 accepted curves, newest \d+ s earlier\)/,
    )
  })

  it('says whether the pressure it reports was read on a validated line', () => {
    const unzeroed = createInitialHemodynamicState(hemodynamicCaseById.get('HD-08')!, 'practice', 1)
    expect(describeObservedSystemState(observedSystemState(unzeroed))).toMatch(
      /MAP \d+ mmHg \(monitor, [^;]+; line not yet zeroed\)/,
    )
    const zeroed = icuHemodynamicsReducer(
      icuHemodynamicsReducer(unzeroed, { type: 'SET_TRANSDUCER_LEVEL', levelCm: 0 }),
      { type: 'ZERO_TRANSDUCER' },
    )
    expect(describeObservedSystemState(observedSystemState(zeroed))).toMatch(
      /MAP \d+ mmHg \(monitor, [^;]+; levelled and zeroed\)/,
    )
  })
})

describe('the debrief names the definitive step that was not taken (A-02, P-11)', () => {
  it('says the drainage pathway was not performed, and does not read a MAP rise as improvement', async () => {
    render(<HemodynamicCaseActivity caseId="HD-07" mode="challenge" />)
    expect(
      await screen.findByRole('heading', { name: hemodynamicCaseById.get('HD-07')!.title }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Orient to the patient and signals' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Go to the actions without recording a frame' }),
    )
    fireEvent.click(interventionCard('fluid-250'))
    fireEvent.click(interventionCard('norepinephrine-up'))
    openDebrief()

    const summary = document.querySelector('[data-case-run-summary]')!
    const definitive = summary.querySelector('[data-definitive-action="pericardial-drainage"]')
    expect(definitive?.getAttribute('data-performed')).toBe('false')
    expect(definitive?.textContent).toMatch(/not performed in this run/)
    expect(summary.querySelector('[data-pressure-versus-flow]')?.textContent).toMatch(
      /no flow measurement to say whether perfusion moved with it/i,
    )
    // P-11: the unzeroed line is explained as a limit on the pressure evidence, not as a gate.
    expect(summary.querySelector('[data-signal-validity]')?.textContent).toMatch(
      /never zeroed.*does not make the patient in front of you unreadable/is,
    )
    // No score, no points, no pass mark is added by any of this.
    expect(summary.textContent).not.toMatch(/\d+\s*(points?|%)/i)
    expect(summary.textContent).toMatch(/not a judgement of competence/)
  })

  it('says the definitive step was performed when the engine accepted it', async () => {
    render(<HemodynamicCaseActivity caseId="HD-07" mode="practice" />)
    expect(
      await screen.findByRole('heading', { name: hemodynamicCaseById.get('HD-07')!.title }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Orient to the patient and signals' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Go to the actions without recording a frame' }),
    )
    fireEvent.click(interventionCard('pericardial-drainage'))
    openDebrief()
    expect(
      document
        .querySelector('[data-definitive-action="pericardial-drainage"]')
        ?.getAttribute('data-performed'),
    ).toBe('true')
  })
})
