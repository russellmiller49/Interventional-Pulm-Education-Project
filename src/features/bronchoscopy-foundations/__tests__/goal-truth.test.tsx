import { cleanup, fireEvent } from '@testing-library/react'

import { SCOPE_RECIPES } from '../test-support/scopeRecipes'
import {
  clickPrimary,
  currentStepId,
  goalStates,
  installDom,
  mountSection,
  nowStatus,
  scopePilot,
  settle,
} from '../test-support/stageHarness'

jest.mock(
  '../components/scope/ScopePane',
  () =>
    jest.requireActual<typeof import('../test-support/ScopeTestDouble')>(
      '../test-support/ScopeTestDouble',
    ).scopePaneDouble,
)
jest.mock('../components/stage/scopeCaseLoader', () => ({
  loadStageScopeCase: () =>
    Promise.resolve(
      jest
        .requireActual<
          typeof import('../test-support/teachingCase')
        >('../test-support/teachingCase')
        .teachingCase(),
    ),
}))
jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname: string }
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/bronchoscopy-foundations/learn',
}))

/**
 * A finished scope card on the real stage says what it established, in its headline (A4, A5).
 *
 * The walkthrough reached the authored target, carried on into the left main bronchus, and read
 * "Done. Every goal on this card is met." beside a field of mucosa with no lumen in it. The first
 * repair added a qualifier underneath; the independent review of PR #254 was right that the learner
 * then has to reconcile a completion headline with fine print, and the headline wins. So the
 * headline itself reports a record, the model's limit sits beside the rows with the same weight,
 * and the live location is printed separately. The events that earned the ticks still happened, so
 * they stay.
 */

/** Words no finished scope card may use, because their ordinary reading approves the image. */
const APPROVING = [/Every goal on this card is met/i, /\bDone\.\s*Every goal\b/i]

describe('a finished scope card after the tip has moved on', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    installDom()
  })
  afterEach(() => {
    cleanup()
    jest.useRealTimers()
  })

  const heading = () => document.querySelector('[data-goal-group]')
  const limit = () => document.querySelector('[data-goal-now]')?.textContent?.trim() ?? ''
  const claims = () =>
    [...document.querySelectorAll('[data-step-goals] li')].map((row) =>
      row.getAttribute('data-goal-claim'),
    )
  const paneRows = () =>
    [...document.querySelectorAll('[data-scope-goals] li')].map((row) => ({
      met: row.getAttribute('data-met'),
      claim: row.getAttribute('data-goal-claim'),
    }))
  const cardText = () => document.querySelector('[data-now-card]')?.textContent ?? ''

  async function reachPractice(section: 'view-loss' | 'branch-entry' | 'systematic-survey') {
    const { lesson } = await mountSection(section)
    while (lesson.steps.find((step) => step.id === currentStepId())?.course?.kind !== 'practice') {
      clickPrimary()
      await settle()
    }
    return lesson
  }

  it('reports a record, not a verdict on the view, after a deliberate overshoot', async () => {
    await reachPractice('view-loss')
    const pilot = scopePilot()
    // 1. The card's requirement is achieved with the learner's own controls.
    SCOPE_RECIPES['view-loss']!.act(pilot)
    await settle()
    expect(goalStates()).toEqual(['true', 'true', 'true'])
    expect(claims()).toEqual(['history', 'history', 'history'])

    // 2. Then the learner keeps going, the way the walkthrough did.
    const before = pilot.state.location.label
    pilot.advanceUntil(() => pilot.state.location.label !== before, 60)
    await settle()

    // 3. The events happened, so the record keeps them.
    expect(goalStates()).toEqual(['true', 'true', 'true'])

    // 4. Nothing prominent approves the current view.
    expect(nowStatus()).toBe('Recorded: every step this card asks for.')
    for (const pattern of APPROVING) expect(cardText()).not.toMatch(pattern)
    expect(heading()?.getAttribute('data-goal-group')).toBe('history')
    expect(heading()?.textContent).toBe('On the record for this attempt')
    expect(limit()).toContain('does not judge the bronchoscope image')
    expect(limit()).toContain('nothing on this card says the view on the screen is usable')

    // 5. Where the tip is now stays visible, and separate from the record.
    expect(limit()).toContain(`Where the tip is now: ${pilot.state.location.fullLabel}.`)
    expect(document.querySelector('[data-goal-now]')).not.toBe(heading())
  })

  it('frames the pane’s own green list the same way', async () => {
    await reachPractice('branch-entry')
    const pilot = scopePilot()
    SCOPE_RECIPES['branch-entry']!.act(pilot)
    await settle()
    expect(goalStates()).toEqual(['true', 'true', 'true', 'true', 'true'])
    // The duplicated list under the controls carries the same classification and the same limit.
    expect(paneRows()).toEqual(Array(5).fill({ met: 'true', claim: 'history' }))
    expect(document.querySelector('[data-scope-goals-group]')?.textContent).toBe(
      'On the record for this attempt',
    )
    expect(document.querySelector('[data-scope-goals]')?.getAttribute('aria-label')).toBe(
      'On the record for this attempt',
    )
    expect(document.querySelector('[data-scope-goals-limit]')?.textContent).toContain(
      'does not judge the bronchoscope image',
    )
  })

  it('says only what the model records about the view and the wall', async () => {
    await reachPractice('branch-entry')
    const pilot = scopePilot()
    SCOPE_RECIPES['branch-entry']!.act(pilot)
    await settle()
    const labels = [...document.querySelectorAll('[data-step-goals] li')]
      .map((row) => row.textContent?.trim())
      .join(' | ')
    expect(labels).toContain('no wall contact recorded')
    expect(labels).toContain('while the model recorded a lost view')
    expect(labels).not.toContain('keep the tip off the wall')
    expect(labels).not.toContain('without a clear view')
  })

  it('marks the two kinds apart on a card that carries both', async () => {
    const lesson = await mountSection('branch-entry')
    while (
      lesson.lesson.steps.find((step) => step.id === currentStepId())?.course?.id !== 'hold-view'
    ) {
      const skip = document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-skip]')
      if (skip) fireEvent.click(skip)
      else clickPrimary()
      await settle()
    }
    expect(heading()?.getAttribute('data-goal-group')).toBe('mixed')
    // Nothing is met yet, so the rows are still a to-do list and the heading says so.
    expect(heading()?.textContent).toBe('What this card is waiting for')
    expect(claims()).toEqual(['history', 'mixed', 'mixed', 'history'])
    expect(
      [...document.querySelectorAll('[data-goal-claim-tag]')].map((tag) => tag.textContent),
    ).toEqual(['Recorded', 'Recorded and now', 'Recorded and now', 'Recorded'])
    const pilot = scopePilot()
    pilot.send({ type: 'acknowledge' })
    pilot.send({ type: 'capture' })
    for (let i = 0; i < 12; i += 1) pilot.send({ type: 'tick', seconds: 0.5 })
    await settle()
    expect(goalStates()).toEqual(['true', 'true', 'true', 'true'])
    expect(heading()?.textContent).toBe(
      'On the record for this attempt, and read from the scope right now',
    )
    expect(nowStatus()).toBe('Recorded: every step this card asks for, and its live readings hold.')
    for (const pattern of APPROVING) expect(cardText()).not.toMatch(pattern)
  })

  it('keeps a completed inspection record a record, not a claim about the view now', async () => {
    await reachPractice('systematic-survey')
    const pilot = scopePilot()
    SCOPE_RECIPES['systematic-survey']!.act(pilot)
    await settle()
    expect(goalStates().every((state) => state === 'true')).toBe(true)
    // The ledger keeps every declaration after the scope leaves the airway it was made in, so a
    // met ledger goal is a record of the attempt — never a reading of what is in view now.
    expect(claims().every((claim) => claim === 'history')).toBe(true)
    expect(heading()?.getAttribute('data-goal-group')).toBe('history')
    pilot.withdrawTo('BI')
    await settle()
    expect(pilot.state.location.label).toBe('BI')
    expect(goalStates().every((state) => state === 'true')).toBe(true)
    expect(claims().every((claim) => claim === 'history')).toBe(true)
    expect(heading()?.textContent).toBe('On the record for this attempt')
    expect(cardText()).not.toContain('Read from the scope right now')
    expect(limit()).toContain('Where the tip is now: Bronchus intermedius.')
  })

  it('shows the scripted hold from the clock, and finishes it on the learner’s own actions', async () => {
    const { lesson } = await mountSection('branch-entry')
    while (lesson.steps.find((step) => step.id === currentStepId())?.course?.id !== 'hold-view') {
      // Every card on the way can be left; the observation step is the one under test.
      const skip = document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-skip]')
      if (skip) fireEvent.click(skip)
      else clickPrimary()
      await settle()
    }
    const readout = () =>
      document.querySelector('[data-readout="holdRemaining"]')?.textContent?.trim() ?? ''
    expect(readout()).toContain('scripted seconds still to run')
    const pilot = scopePilot()
    // Time alone is not the hold: it runs out with the assistant still waiting.
    for (let i = 0; i < 12; i += 1) pilot.send({ type: 'tick', seconds: 0.5 })
    await settle()
    expect(readout()).toContain('the assistant is still waiting')
    expect(goalStates()).toEqual(['false', 'false', 'false', 'false'])
    pilot.send({ type: 'acknowledge' })
    pilot.send({ type: 'capture' })
    await settle()
    expect(readout()).toContain('finished')
    expect(goalStates()).toEqual(['true', 'true', 'true', 'true'])
  })

  it('does not call a hold steady when the depth drifted during it', async () => {
    const { lesson } = await mountSection('branch-entry')
    while (lesson.steps.find((step) => step.id === currentStepId())?.course?.id !== 'hold-view') {
      const skip = document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-skip]')
      if (skip) fireEvent.click(skip)
      else clickPrimary()
      await settle()
    }
    const pilot = scopePilot()
    pilot.advance()
    pilot.send({ type: 'acknowledge' })
    pilot.send({ type: 'capture' })
    for (let i = 0; i < 12; i += 1) pilot.send({ type: 'tick', seconds: 0.5 })
    await settle()
    expect(pilot.state.events).toContain('drift-detected')
    // The hold itself finished above the carina; staying steady through it did not.
    const [acknowledged, captured, held, steady] = goalStates()
    expect([acknowledged, captured, held]).toEqual(['true', 'true', 'true'])
    expect(steady).toBe('false')
  })
})
