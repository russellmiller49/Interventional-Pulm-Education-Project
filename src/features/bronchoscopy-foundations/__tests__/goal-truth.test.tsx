import { cleanup, fireEvent, render } from '@testing-library/react'

import { ScopeFallback } from '../components/scope/ScopeFallback'
import type { ScopeCommand } from '../components/scope/types'
import {
  GOAL_CLAIM_TAG,
  GOAL_GROUP_HEADING,
  PLAIN_DONE_LEAD,
  PLAIN_GOALS_DONE_HEADING,
  PLAIN_GOALS_HEADING,
  PLAIN_NEXT_GOAL_HEADING,
  scopeDoneLead,
} from '../engine/scope/goalPresentation'
import { scopeLocationCaption } from '../engine/scope/scopeCaption'
import { scopeGoalStatuses } from '../engine/scope/scopeGoalEvaluation'
import { carinaAct, holdAct } from '../test-support/carinaTasks'
import { CARINA_RECIPE, SCOPE_RECIPES } from '../test-support/scopeRecipes'
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
import { ScopeDriver, teachingCase } from '../test-support/teachingCase'

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
 *
 * Educator feedback (2026-10-13) then found the card's wording too much. A rewritten section's
 * card, which is every section's now, says "Goals for this task" and, once they are met, "Goals
 * met" and "All the goals for this task are met.", with no tag on each row. What these tests still
 * hold the real stage to: the ticks stay once earned, the card's rows are still classified, where
 * the tip is now is printed apart from them, and nothing on the card describes the view. The
 * earlier wording is still what a card outside a rewritten section prints; the pane tests at the
 * end of this file hold it there.
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

  async function reachPractice(section: 'view-loss' | 'systematic-survey') {
    const { lesson } = await mountSection(section)
    // The section's own scope task: a practice screen that names no further activity. Every card
    // before it can be left.
    const reached = () => {
      const course = lesson.steps.find((step) => step.id === currentStepId())?.course
      return course?.kind === 'practice' && !course.act
    }
    while (!reached()) {
      const skip = document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-skip]')
      if (skip) fireEvent.click(skip)
      else clickPrimary()
      await settle()
    }
    return lesson
  }

  /** The carina task of "Larynx, trachea and carina": every card before it can be left. */
  async function reachCarina() {
    const { lesson } = await mountSection('larynx-and-entry')
    while (lesson.steps.find((step) => step.id === currentStepId())?.course?.id !== 'carina') {
      const skip = document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-skip]')
      if (skip) fireEvent.click(skip)
      else clickPrimary()
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

    // 4. Nothing prominent approves the current view: the card says the goals are met, in the
    //    plain words of a rewritten section, and says nothing about the picture.
    expect(nowStatus()).toBe(PLAIN_DONE_LEAD)
    for (const pattern of APPROVING) expect(cardText()).not.toMatch(pattern)
    expect(heading()?.getAttribute('data-goal-group')).toBe('history')
    expect(heading()?.textContent).toBe(PLAIN_GOALS_DONE_HEADING)
    // A rewritten section's card carries no note on what it does not judge; it says only where
    // the tip is, apart from the record.
    expect(limit()).not.toMatch(/usable|judge/i)

    // 5. Where the tip is now stays visible, and separate from the record.
    expect(limit()).toContain(`Where the tip is now: ${pilot.state.location.fullLabel}.`)
    expect(document.querySelector('[data-goal-now]')).not.toBe(heading())
  })

  it('frames the pane’s own goal card the same way', async () => {
    await reachCarina()
    // Before anything is met the two cards are a to-do list, and say so in plain words.
    expect(heading()?.textContent).toBe(PLAIN_GOALS_HEADING)
    expect(document.querySelector('[data-scope-goals-group]')?.textContent).toBe(
      PLAIN_NEXT_GOAL_HEADING,
    )
    expect(document.querySelector('[data-goal-claim-tag]')).toBeNull()
    const pilot = scopePilot()
    CARINA_RECIPE(pilot)
    await settle()
    expect(goalStates()).toEqual(['true', 'true', 'true', 'true', 'true'])
    // BF-PRE-REVIEW-03 (A37) replaced the duplicated list under the controls with one card beside
    // them. Once every goal is met, its one row is the card's own lead, with the same
    // classification, the same heading and the same limit the stage card carries.
    expect(paneRows()).toEqual([{ met: 'true', claim: 'history' }])
    expect(document.querySelector('[data-scope-goals] li')?.textContent).toBe(PLAIN_DONE_LEAD)
    const group = document.querySelector('[data-scope-goals-group]')
    expect(group?.getAttribute('data-scope-goals-group')).toBe('history')
    expect(group?.textContent).toBe(PLAIN_GOALS_DONE_HEADING)
    expect(heading()?.textContent).toBe(PLAIN_GOALS_DONE_HEADING)
    const labelledBy = document.querySelector('[data-scope-goals]')?.getAttribute('aria-labelledby')
    expect(document.getElementById(labelledBy ?? '')?.textContent).toBe(PLAIN_GOALS_DONE_HEADING)
    // A rewritten section's card says where the tip is and carries no sentence about the model.
    const limit = document.querySelector('[data-scope-goals-limit]')?.textContent ?? ''
    expect(limit).toContain('Where the tip is now')
    expect(limit).not.toContain('does not judge the bronchoscope image')
    for (const pattern of APPROVING)
      expect(document.querySelector('[data-scope-goal-now]')?.textContent).not.toMatch(pattern)
  })

  it('asks for the way in and the way back at the carina, and nothing of the wall or the view', async () => {
    await reachCarina()
    const pilot = scopePilot()
    CARINA_RECIPE(pilot)
    await settle()
    const rows = [...document.querySelectorAll('[data-step-goals] li')]
    expect(rows.map((row) => row.getAttribute('data-goal'))).toEqual(
      carinaAct.goals.map((goal) => goal.id),
    )
    expect(rows.map((row) => row.getAttribute('data-goal'))).toEqual([
      'reach-carina',
      'enter-right',
      'back-to-trachea',
      'enter-left',
      'back-from-left',
    ])
    // Guided travel counts no contact for a bend and penalises no refused advance (educator
    // feedback, 2026-10-13), so no goal here is about either, and none describes the view.
    const labels = rows.map((row) => row.textContent?.trim()).join(' | ')
    for (const words of [
      'wall contact',
      'refused',
      'lost view',
      'keep the tip off the wall',
      'without a clear view',
    ])
      expect(labels).not.toContain(words)
    // The count the removed goal read is no longer printed beside this view either.
    expect(document.querySelector('[data-readout="contactCount"]')).toBeNull()
    expect(document.querySelector('[data-readout="currentAirway"]')).not.toBeNull()
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
    pilot.withdrawTo('LMSB')
    await settle()
    expect(pilot.state.location.label).toBe('LMSB')
    expect(goalStates().every((state) => state === 'true')).toBe(true)
    expect(claims().every((claim) => claim === 'history')).toBe(true)
    expect(heading()?.textContent).toBe(PLAIN_GOALS_DONE_HEADING)
    expect(cardText()).not.toContain('Read from the scope right now')
    expect(limit()).toContain('Where the tip is now: Left main bronchus.')
  })
})

/**
 * The hold above the carina is no longer a step of the course (educator feedback, 2026-10-13), so
 * there is no stage card to mount for it. The pane and the engine still carry the scripted hold,
 * and its card is the one that mixes a record with a live reading. These drive the fixture task on
 * the pane itself, with the goal statuses the host hands it, one command at a time.
 */
describe('the scripted hold, on the pane that still carries it', () => {
  afterEach(cleanup)

  function mountHold(plain = false) {
    const driver = new ScopeDriver(holdAct.view)
    const pane = () => (
      <ScopeFallback
        view={holdAct.view}
        state={driver.state}
        map={teachingCase().map}
        caption={scopeLocationCaption(driver.state)}
        goals={scopeGoalStatuses(holdAct.goals, driver.state)}
        controlsEnabled
        onCommand={() => {}}
        onReset={() => {}}
        plain={plain}
      />
    )
    const { rerender } = render(pane())
    return {
      driver,
      met: () => scopeGoalStatuses(holdAct.goals, driver.state).map((status) => status.met),
      send(command: ScopeCommand) {
        driver.send(command)
        rerender(pane())
      },
    }
  }

  const group = () => document.querySelector('[data-scope-goals-group]')
  const row = () => document.querySelector('[data-scope-goals] li')
  const readout = () =>
    document.querySelector('[data-readout="holdRemaining"]')?.textContent?.trim() ?? ''
  const goal = (id: string) => holdAct.goals.find((candidate) => candidate.id === id)!

  it('marks the two kinds apart on a card that carries both', () => {
    const hold = mountHold()
    expect(group()?.getAttribute('data-scope-goals-group')).toBe('mixed')
    // Nothing is met yet, so the card is still a to-do and its heading says so.
    expect(group()?.textContent).toBe('The goal this step is waiting for')
    expect(row()?.getAttribute('data-goal-claim')).toBe('history')
    expect(row()?.textContent).toBe(`${GOAL_CLAIM_TAG.history}${goal('acknowledge').label}`)
    hold.send({ type: 'acknowledge' })
    // The next goal reads the record and where the tip is now, and its tag says both.
    expect(row()?.getAttribute('data-goal-claim')).toBe('mixed')
    expect(row()?.textContent).toBe(`${GOAL_CLAIM_TAG.mixed}${goal('capture').label}`)
    expect(GOAL_CLAIM_TAG).toMatchObject({ history: 'Recorded', mixed: 'Recorded and now' })
    hold.send({ type: 'capture' })
    expect(row()?.textContent).toBe(`${GOAL_CLAIM_TAG.mixed}${goal('hold').label}`)
    for (let i = 0; i < 12; i += 1) hold.send({ type: 'tick', seconds: 0.5 })
    expect(hold.met()).toEqual([true, true, true, true])
    expect(group()?.textContent).toBe(GOAL_GROUP_HEADING.mixed)
    expect(group()?.textContent).toBe(
      'On the record for this attempt, and read from the scope right now',
    )
    expect(row()?.textContent).toBe(scopeDoneLead('mixed'))
    expect(row()?.textContent).toBe(
      'Recorded: every step this card asks for, and its live readings hold.',
    )
    for (const pattern of APPROVING)
      expect(document.querySelector('[data-scope-goal-now]')?.textContent).not.toMatch(pattern)
  })

  it('drops the tags and uses the plain words on a rewritten section’s pane', () => {
    const hold = mountHold(true)
    // The card is still classified; it no longer prints the classification row by row.
    expect(group()?.getAttribute('data-scope-goals-group')).toBe('mixed')
    expect(group()?.textContent).toBe(PLAIN_NEXT_GOAL_HEADING)
    expect(row()?.textContent).toBe(goal('acknowledge').label)
    hold.send({ type: 'acknowledge' })
    expect(row()?.getAttribute('data-goal-claim')).toBe('mixed')
    expect(row()?.textContent).toBe(goal('capture').label)
    hold.send({ type: 'capture' })
    for (let i = 0; i < 12; i += 1) hold.send({ type: 'tick', seconds: 0.5 })
    expect(hold.met()).toEqual([true, true, true, true])
    expect(group()?.textContent).toBe(PLAIN_GOALS_DONE_HEADING)
    expect(row()?.textContent).toBe(PLAIN_DONE_LEAD)
    // Where the tip is stays beside the card; the note on what the model judges is left out.
    const limit = document.querySelector('[data-scope-goals-limit]')?.textContent ?? ''
    expect(limit).toContain('Where the tip is now: Trachea.')
    expect(limit).not.toContain('does not judge the bronchoscope image')
  })

  it('shows the scripted hold from the clock, and finishes it on the learner’s own actions', () => {
    const hold = mountHold()
    expect(readout()).toContain('scripted seconds still to run')
    // Time alone is not the hold: it runs out with the assistant still waiting.
    for (let i = 0; i < 12; i += 1) hold.send({ type: 'tick', seconds: 0.5 })
    expect(readout()).toContain('the assistant is still waiting')
    expect(hold.met()).toEqual([false, false, false, false])
    expect(document.querySelector('[data-scope-goal-now]')).toHaveAttribute(
      'data-scope-goal-now',
      'acknowledge',
    )
    hold.send({ type: 'acknowledge' })
    hold.send({ type: 'capture' })
    expect(readout()).toContain('finished')
    expect(hold.met()).toEqual([true, true, true, true])
    expect(document.querySelector('[data-scope-goal-now]')).toHaveAttribute(
      'data-scope-goal-now',
      'all-recorded',
    )
  })

  it('does not call a hold steady when the depth drifted during it', () => {
    const hold = mountHold()
    hold.send({ type: 'advance', mm: hold.driver.state.inputs.stepMm })
    hold.send({ type: 'acknowledge' })
    hold.send({ type: 'capture' })
    for (let i = 0; i < 12; i += 1) hold.send({ type: 'tick', seconds: 0.5 })
    expect(hold.driver.state.events).toContain('drift-detected')
    // The hold itself finished above the carina; staying steady through it did not.
    expect(hold.met()).toEqual([true, true, true, false])
    // So the card is still waiting on that row, and does not print its finished lead.
    expect(document.querySelector('[data-scope-goal-now]')).toHaveAttribute(
      'data-scope-goal-now',
      'no-drift',
    )
    expect(row()?.getAttribute('data-met')).toBe('false')
  })
})
