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
 * A finished scope card on the real stage says what it is a statement about (A4, A5).
 *
 * The walkthrough reached the authored target, kept going, and ended with the lens against the
 * wall while every goal stayed ticked and the card said the work was done. The events that earned
 * those ticks really did happen, so they stay; what changes is that the card stops implying they
 * describe the picture on the screen, and prints where the tip actually is.
 */

const LOST_VIEW_BOUND = 'They record this attempt, not the view on the screen now.'

describe('a finished scope card after the tip has moved on', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    installDom()
  })
  afterEach(() => {
    cleanup()
    jest.useRealTimers()
  })

  function basis() {
    return document.querySelector('[data-goal-basis]')?.textContent?.trim() ?? ''
  }
  function claims() {
    return [...document.querySelectorAll('[data-step-goals] li')].map((row) =>
      row.getAttribute('data-goal-claim'),
    )
  }

  it('keeps the recovery goals met after an overshoot, and stops calling the view done', async () => {
    const { lesson } = await mountSection('view-loss')
    while (lesson.steps.find((step) => step.id === currentStepId())?.course?.kind !== 'practice') {
      clickPrimary()
      await settle()
    }
    const pilot = scopePilot()
    SCOPE_RECIPES['view-loss']!.act(pilot)
    await settle()
    expect(goalStates()).toEqual(['true', 'true', 'true'])
    expect(claims()).toEqual(['history', 'history', 'history'])
    expect(nowStatus()).toContain(LOST_VIEW_BOUND)
    expect(basis()).toContain('records something that happened during this attempt')
    expect(basis()).toContain('does not judge the picture on the screen')
    expect(basis()).toContain('The tip is in')

    // Keep advancing past the authored target, the way the walkthrough did.
    const before = pilot.state.location.label
    pilot.advanceUntil(() => pilot.state.location.label !== before, 60)
    await settle()
    // The events happened; the card still records them, and still bounds what they mean.
    expect(goalStates()).toEqual(['true', 'true', 'true'])
    expect(nowStatus()).toContain(LOST_VIEW_BOUND)
    expect(basis()).toContain(`The tip is in ${pilot.state.location.fullLabel} now.`)
  })

  it('bounds the entry card the same way, and names the contact signal rather than the wall', async () => {
    const { lesson } = await mountSection('branch-entry')
    while (lesson.steps.find((step) => step.id === currentStepId())?.course?.kind !== 'practice') {
      clickPrimary()
      await settle()
    }
    const pilot = scopePilot()
    SCOPE_RECIPES['branch-entry']!.act(pilot)
    await settle()
    expect(goalStates()).toEqual(['true', 'true', 'true', 'true', 'true'])
    expect(claims()).toEqual(['history', 'history', 'history', 'history', 'history'])
    expect(nowStatus()).toContain(LOST_VIEW_BOUND)
    const labels = [...document.querySelectorAll('[data-step-goals] li')].map((row) =>
      row.textContent?.trim(),
    )
    expect(labels.join(' | ')).toContain('no wall contact recorded')
    expect(labels.join(' | ')).not.toContain('keep the tip off the wall')
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
    expect(nowStatus()).toContain('Done.')
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
