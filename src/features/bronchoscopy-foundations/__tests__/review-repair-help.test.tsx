import { cleanup, fireEvent } from '@testing-library/react'

import type { ScopeCommand, ScopeGoal } from '../components/scope/types'
import { scopeControlId } from '../components/scope/types'
import { goalHelp } from '../engine/scope/goalHelp'
import type { ScopeRuntimeState } from '../engine/scope/scopeRuntime'
import { BRONCH_SELF_PACED_STORAGE_KEY } from '../engine/selfPacedProgress'
import { latestScopePaneProps } from '../test-support/ScopeTestDouble'
import { ScopePilot } from '../test-support/scopePilot'
import { CARINA_RECIPE } from '../test-support/scopeRecipes'
import {
  clickPrimary,
  control,
  currentStepId,
  installDom,
  mountSection,
  scopeTransport,
  settle,
} from '../test-support/stageHarness'
import { teachingCase } from '../test-support/teachingCase'

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
 * BF-PRE-REVIEW-03 independent review, blocker 1: "Show me where" kept the advice it was given
 * when it was asked for. In S6 Part 3, help asked for before the carina still said to advance to
 * the carina, and still lit Advance, after that goal was met and the next one needed a rotation.
 *
 * The contract these tests hold the real host to: while help is on, what the pane shows is the
 * help for the first goal not yet met, read against the scope state now. Nothing is asked for a
 * second time in any of them.
 */
beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
  installDom()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

const PRACTICE = 'larynx-and-entry-flow-v1-carina'

async function reachPractice() {
  const { lesson } = await mountSection('larynx-and-entry')
  // Every card before the carina task can be left without doing it.
  while (currentStepId() !== PRACTICE) {
    const skip = document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-skip]')
    if (skip) fireEvent.click(skip)
    else clickPrimary()
    await settle()
  }
  expect(currentStepId()).toBe(PRACTICE)
  const step = lesson.steps.find((candidate) => candidate.id === PRACTICE)!
  if (step.interaction.kind !== 'scope-task') throw new Error('Part 3 is a scope task')
  return step.interaction.goals
}

function nowButton(name: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('[data-now-card] button')].find(
    (candidate) => candidate.textContent?.trim() === name,
  )
}

async function askForHelp(name: 'Show me where' | 'Highlight it again' = 'Show me where') {
  fireEvent.click(nowButton(name)!)
  await settle()
}

/** What the pane is showing as help: the sentence on the goal card and the lit control. */
function shown() {
  return {
    sentence: document.querySelector('[data-goal-help]')?.textContent ?? null,
    control:
      document.querySelector('[data-spotlight="true"]')?.getAttribute('data-control') ?? null,
  }
}

const goalRows = () =>
  [...document.querySelectorAll('[data-step-goals] li')].map((row) => ({
    id: row.getAttribute('data-goal'),
    met: row.getAttribute('data-met') === 'true',
  }))

/** The help the engine gives now, for the first goal the page shows as not yet met. */
function current(goals: readonly ScopeGoal[]) {
  const unmet = goalRows().find((row) => !row.met)
  if (!unmet) return { sentence: null, control: null }
  const props = latestScopePaneProps()!
  const help = goalHelp(
    goals.find((goal) => goal.id === unmet.id)!.test,
    // The host hands the pane its own runtime state.
    props.state as ScopeRuntimeState,
    props.view,
    teachingCase(),
  )
  return { sentence: help?.sentence ?? null, control: help?.control ?? null }
}

const send = (command: ScopeCommand) => scopeTransport().send(command)
const state = () => latestScopePaneProps()!.state

async function advanceToCarina() {
  for (let i = 0; i < 80 && !goalRows().find((row) => row.id === 'reach-carina')!.met; i += 1) {
    send({ type: 'advance', mm: state().inputs.stepMm })
    await settle()
  }
  expect(goalRows().find((row) => row.id === 'reach-carina')!.met).toBe(true)
}

describe('blocker 1 — help follows the goal the learner is on, without being asked again', () => {
  it('S6 Part 3: help asked for before the carina is not left on it once it is reached', async () => {
    const goals = await reachPractice()
    await askForHelp()
    expect(shown()).toEqual({
      sentence: 'Advance down the trachea to the main carina.',
      control: 'advance',
    })

    await advanceToCarina()

    // The goal the learner is on is now the right main bronchus; no second request was made.
    expect(goalRows().find((row) => !row.met)!.id).toBe('enter-right')
    const after = shown()
    expect(after.sentence).not.toMatch(/carina/i)
    expect(after.sentence).not.toMatch(/^Advance/)
    expect(after.control).not.toBe('advance')
    expect(after.control).toBe('rotate')
    expect(after).toEqual(current(goals))
  })

  it('follows a move that changes the useful control while the goal stays the same', async () => {
    const goals = await reachPractice()
    await askForHelp()
    await advanceToCarina()
    const seen = [shown().control]
    // Do what the help says, one small input at a time; the goal stays "enter-right" throughout.
    for (let i = 0; i < 40 && seen[seen.length - 1] !== 'advance'; i += 1) {
      const { sentence, control: key } = shown()
      if (key === 'rotate')
        send({ type: 'rotate', deg: /counterclockwise/.test(sentence!) ? -15 : 15 })
      else if (key === 'deflect')
        send({ type: 'deflect', deg: /toward U/.test(sentence!) ? 5 : -5 })
      else throw new Error(`Unexpected help control ${key}`)
      await settle()
      expect(goalRows().find((row) => !row.met)!.id).toBe('enter-right')
      expect(shown()).toEqual(current(goals))
      if (shown().control !== seen[seen.length - 1]) seen.push(shown().control)
    }
    expect(seen).toEqual(['rotate', 'deflect', 'advance'])
  })

  it('moves the focus when help is asked for, and never when the advice changes', async () => {
    await reachPractice()
    await askForHelp()
    const advance = document.getElementById(scopeControlId('advance'))
    expect(document.activeElement).toBe(advance)
    await advanceToCarina()
    expect(shown().control).toBe('rotate')
    // The keyboard stays on the control in use; its next key is not handed to another control.
    expect(document.activeElement).toBe(advance)
    await askForHelp('Highlight it again')
    expect(document.activeElement).toBe(document.getElementById(scopeControlId('rotate')))
  })

  it('stays current through every goal of the step, and shows nothing once all are met', async () => {
    const goals = await reachPractice()
    await askForHelp()
    const transport = scopeTransport()
    let checked = 0
    const pilot = new ScopePilot({
      get view() {
        return transport.view
      },
      get state() {
        return transport.state
      },
      scopeCase: transport.scopeCase,
      send(command) {
        transport.send(command)
        // After every single command of the whole step, without another request.
        expect(shown()).toEqual(current(goals))
        checked += 1
      },
    })
    CARINA_RECIPE(pilot)
    await settle()
    expect(checked).toBeGreaterThan(20)
    expect(goalRows().every((row) => row.met)).toBe(true)
    expect(shown()).toEqual({ sentence: null, control: null })
    expect(document.querySelector('[data-goal-help]')).toBeNull()
    expect(nowButton('Show me where')).toBeUndefined()
    expect(nowButton('Highlight it again')).toBeUndefined()
  })

  it('ends with a reset: the new attempt starts without the last attempt’s help', async () => {
    await reachPractice()
    await askForHelp()
    await advanceToCarina()
    expect(shown().control).toBe('rotate')
    fireEvent.click(control('reset'))
    await settle()
    expect(goalRows().every((row) => !row.met)).toBe(true)
    expect(shown()).toEqual({ sentence: null, control: null })
    expect(nowButton('Show me where')).toBeDefined()
    // Asked for again, it is the help for where the new attempt starts.
    await askForHelp()
    expect(shown()).toEqual({
      sentence: 'Advance down the trachea to the main carina.',
      control: 'advance',
    })
  })

  it('ends when the learner leaves the step, and is not brought back on return', async () => {
    const goals = await reachPractice()
    await askForHelp()
    await advanceToCarina()
    expect(shown().control).toBe('rotate')
    fireEvent.click(nowButton('Back')!)
    await settle()
    expect(currentStepId()).not.toBe(PRACTICE)
    expect(shown()).toEqual({ sentence: null, control: null })
    for (let i = 0; i < 4 && currentStepId() !== PRACTICE; i += 1) {
      clickPrimary()
      await settle()
    }
    expect(currentStepId()).toBe(PRACTICE)
    // The attempt is as it was left, with the carina goal met; the help is there to ask for.
    expect(goalRows().find((row) => !row.met)!.id).toBe('enter-right')
    expect(shown()).toEqual({ sentence: null, control: null })
    await askForHelp()
    expect(shown()).toEqual(current(goals))
    expect(shown().control).toBe('rotate')
  })
})

describe('blocker 1 — preserved: help is advice and writes nothing', () => {
  /** One whole attempt through the pane's own command seam; `help` says when help is asked for. */
  async function attempt(help: boolean) {
    await reachPractice()
    if (help) await askForHelp()
    const before = JSON.stringify(state())
    if (help) {
      // Asking, and asking again, sends nothing to the scope.
      await askForHelp('Highlight it again')
      expect(JSON.stringify(state())).toBe(before)
    }
    await advanceToCarina()
    if (help) await askForHelp('Highlight it again')
    CARINA_RECIPE(new ScopePilot(scopeTransport()))
    await settle()
    const result = {
      state: JSON.stringify(state()),
      goals: JSON.stringify(goalRows()),
      // The record on the device, less the time it was last written.
      record: JSON.stringify({
        ...JSON.parse(localStorage.getItem(BRONCH_SELF_PACED_STORAGE_KEY)!),
        updatedAt: null,
      }),
    }
    cleanup()
    localStorage.clear()
    return result
  }

  it('leaves the scope state, the goals and the device record exactly as an attempt without it', async () => {
    const without = await attempt(false)
    const withHelp = await attempt(true)
    // Events, inputs, input modes, assists, the inspection record, signals and counts: all of it.
    expect(withHelp.state).toBe(without.state)
    expect(withHelp.goals).toBe(without.goals)
    expect(withHelp.record).toBe(without.record)
    // The step's own assists are in both; help added none, and no event of its own.
    const assists = (text: string) =>
      (JSON.parse(text) as { assistsUsed: string[]; events: string[] }).assistsUsed
    expect(assists(withHelp.state)).toEqual(assists(without.state))
  })
})
