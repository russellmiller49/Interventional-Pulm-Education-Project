/** @jest-environment node */
import { section as branchEntry } from '../content/sections/branch-entry'
import { section as larynxAndEntry } from '../content/sections/larynx-and-entry'
import { section as protectedAccessories } from '../content/sections/protected-accessories'
import { section as systematicSurvey } from '../content/sections/systematic-survey'
import { section as viewLoss } from '../content/sections/view-loss'
import { COURSE_FLOWS } from '../content/courseFlow'
import { bronchStageLesson } from '../content/stageLessons'
import type { ScopeGoal, ScopeViewSpec } from '../components/scope/types'
import {
  bronchStageReducer,
  emptyBronchStageSession,
  learnerActedOnScope,
} from '../engine/stageSession'
import { createScopeState, reduceScope } from '../engine/scope/scopeReducer'
import { accessoryIsExposed } from '../engine/scope/scopeAccessory'
import { scopeGoalClaim, scopeGoalsClaim } from '../engine/scope/scopeGoalEvaluation'
import {
  GOAL_GROUP_HEADING,
  GOAL_MODEL_LIMIT,
  scopeDoneLead,
} from '../engine/scope/goalPresentation'
import { formatScopeMetric } from '../engine/scope/scopeMetrics'
import {
  ENVIRONMENT_CLOCK_SCRIPTS,
  HOLD_SECONDS,
  isEnvironmentClockCommand,
  breathPhaseAt,
} from '../engine/scope/scopeScripts'
import { teachingCase } from '../test-support/teachingCase'

/**
 * BF-PRE-REVIEW-01: the model, the state and the teaching may not disagree.
 *
 * Three separate things are pinned here. The worked exchange has to reach the protected state it
 * narrates, through the module's own misreport rule rather than around it (A1). The scripted
 * scene's clock has to reach the step on the real host, while every other scripted command stays
 * refused and a tick still counts as nobody's work (A2, A3). And a met goal has to say what kind
 * of claim it is, so a row of ticks is not read as approval of the picture on the screen (A4, A5).
 */

const act = (section: typeof branchEntry) => {
  if (section.act.kind !== 'scope-lab') throw new Error(`${section.id} is not a scope-lab section`)
  return section.act
}

describe('the protected exchange demonstration reaches the state it narrates (A1)', () => {
  const view = act(protectedAccessories).view
  const moves = COURSE_FLOWS['protected-accessories']!.find(
    (chunk) => chunk.demonstration,
  )!.demonstration!

  /** The playback the host runs: its own state, one scripted command per movement. */
  function play(upTo = moves.length) {
    let state = createScopeState(view, teachingCase())
    const seen: { caption: string; message: string | null; exposed: boolean }[] = []
    for (const move of moves.slice(0, upTo)) {
      state = reduceScope(state, move.command, 'scripted', { view, scopeCase: teachingCase() })
      seen.push({
        caption: move.caption,
        message: state.message,
        exposed: accessoryIsExposed(state.inputs.accessory),
      })
    }
    return { state, seen }
  }

  it('keeps the assistant’s false report and the check that exposes it', () => {
    const { seen } = play()
    const misreport = seen.findIndex((step) => step.message?.includes('back in its sheath'))
    expect(misreport).toBeGreaterThan(-1)
    // The report changes nothing: the brush is still exposed while the assistant says otherwise.
    expect(seen[misreport].exposed).toBe(true)
    expect(seen[misreport + 1].message).toContain('disagree')
    expect(seen[misreport + 1].exposed).toBe(true)
  })

  it('ends protected and in the channel, with no refused movement on the way', () => {
    const { state } = play()
    expect(state.inputs.accessory).toBe('brush-sheathed')
    expect(state.inputs.accessoryPosition).toBe('in-channel')
    expect(state.events).not.toContain('accessory-unsafe')
    expect(state.message).toBeNull()
    expect(state.script).toEqual({ id: 'assistant-misreport', phase: 'resolved' })
  })

  it('narrates the protected return only where the model agrees', () => {
    const returning = moves.findIndex((move, index) => {
      const command = move.command
      return index > 0 && command.type === 'accessory-move' && command.to === 'in-channel'
    })
    expect(returning).toBeGreaterThan(-1)
    expect(moves[returning].caption).toContain('protected brush returns into the channel')
    // Everything the narration needs has happened by the movement before it.
    const { state } = play(returning)
    expect(accessoryIsExposed(state.inputs.accessory)).toBe(false)
    expect(state.events).toContain('accessory-state-verified')
  })

  it('starts again from the same first state however it was interrupted', () => {
    const full = play()
    const restarted = play()
    expect(restarted.state.inputs).toEqual(full.state.inputs)
    expect(restarted.state.events).toEqual(full.state.events)
    // A playback stopped part way leaves nothing behind for the next one to inherit.
    const partial = play(3)
    expect(partial.state.inputs.accessory).toBe('brush-exposed')
    expect(play().state.inputs.accessory).toBe('brush-sheathed')
  })

  it('leaves the learner’s own first-failure path exactly as authored', () => {
    const goals = act(protectedAccessories).goals
    const retrieve = goals.find((goal) => goal.id === 'retrieve-protected')!
    expect(retrieve.test).toEqual({
      type: 'all',
      tests: [
        {
          type: 'event-sequence',
          events: [
            'accessory:brush-exposed',
            'accessory:brush-sheathed',
            'accessory-state-verified',
            'accessory-moved:in-channel',
          ],
        },
        { type: 'without', event: 'accessory-unsafe' },
      ],
    })
  })
})

describe('the scripted scene’s clock reaches an authored step; nothing else scripted does (A2, A3)', () => {
  const holdView = act(branchEntry).observe!.view!
  const larynxView = act(larynxAndEntry).view
  const plainView = act(viewLoss).view

  function stepWithView(
    sectionId: 'branch-entry' | 'larynx-and-entry' | 'view-loss',
    view: ScopeViewSpec,
  ) {
    const lesson = bronchStageLesson(sectionId)
    const step = lesson.steps.find(
      (candidate) =>
        (candidate.interaction.kind === 'observe' || candidate.interaction.kind === 'scope-task') &&
        candidate.interaction.view === view,
    )
    if (!step) throw new Error(`${sectionId} has no step for that view`)
    return { lesson, step }
  }

  function session(
    sectionId: 'branch-entry' | 'larynx-and-entry' | 'view-loss',
    view: ScopeViewSpec,
  ) {
    const { lesson, step } = stepWithView(sectionId, view)
    const reduce = bronchStageReducer(lesson)
    const scopeCase = teachingCase()
    let current = reduce(emptyBronchStageSession(), {
      type: 'SCOPE_INIT',
      stepId: step.id,
      view,
      scopeCase,
    })
    return {
      step,
      get state() {
        return current.scope[step.id]
      },
      send(
        command: Parameters<typeof reduceScope>[1],
        inputMode: Parameters<typeof reduceScope>[2],
      ) {
        current = reduce(current, {
          type: 'SCOPE_COMMAND',
          stepId: step.id,
          command,
          inputMode,
          view,
          scopeCase,
        })
        return current.scope[step.id]
      },
    }
  }

  it('names the two scripts whose scene carries its own clock', () => {
    expect([...ENVIRONMENT_CLOCK_SCRIPTS].sort()).toEqual([
      'assistant-interrupt',
      'breathing-cords',
    ])
    expect(isEnvironmentClockCommand(larynxView, { type: 'tick', seconds: 1 })).toBe(true)
    expect(isEnvironmentClockCommand(holdView, { type: 'tick', seconds: 1 })).toBe(true)
    expect(isEnvironmentClockCommand(plainView, { type: 'tick', seconds: 1 })).toBe(false)
    expect(isEnvironmentClockCommand(larynxView, { type: 'advance', mm: 3 })).toBe(false)
  })

  it('moves the authored breath on the larynx step, so a crossing becomes reachable', () => {
    const run = session('larynx-and-entry', larynxView)
    expect(run.state.inputs.cords).toBe('narrowing')
    let state = run.state
    for (let i = 0; i < 40 && state.inputs.cords !== 'abducted'; i += 1)
      state = run.send({ type: 'tick', seconds: 0.25 }, 'scripted')
    expect(state.inputs.cords).toBe('abducted')
    expect(state.signals.clockSec).toBeGreaterThan(0)
    // The phase the goal reads is the phase the readout prints: one clock, not two.
    expect(state.script).toEqual({
      id: 'breathing-cords',
      phase: breathPhaseAt(state.signals.clockSec),
    })
  })

  it('finishes the authored hold once the learner has acknowledged and captured', () => {
    const run = session('branch-entry', holdView)
    run.send({ type: 'acknowledge' }, 'pointer')
    run.send({ type: 'capture' }, 'pointer')
    let state = run.state
    for (let i = 0; i < 40 && !state.events.includes('hold-completed'); i += 1)
      state = run.send({ type: 'tick', seconds: 0.25 }, 'scripted')
    expect(state.events).toContain('hold-completed')
    expect(state.signals.clockSec).toBeGreaterThanOrEqual(HOLD_SECONDS)
    const goals = act(branchEntry).observe!.goals
    expect(goals.every((goal) => scopeGoalClaim(goal.test) !== undefined)).toBe(true)
  })

  it('finishes the hold with the image taken before the acknowledgment too', () => {
    const run = session('branch-entry', holdView)
    run.send({ type: 'capture' }, 'pointer')
    let state = run.state
    for (let i = 0; i < 40 && !state.events.includes('hold-completed'); i += 1)
      state = run.send({ type: 'tick', seconds: 0.25 }, 'scripted')
    // The scripted seconds have run, but the assistant has not been answered.
    expect(state.events).not.toContain('hold-completed')
    state = run.send({ type: 'acknowledge' }, 'pointer')
    expect(state.events).toContain('hold-completed')
  })

  it('refuses every other scripted command on an authored step', () => {
    const run = session('branch-entry', holdView)
    const before = run.state
    for (const command of [
      { type: 'advance', mm: 3 },
      { type: 'capture' },
      { type: 'acknowledge' },
    ] as const) {
      const after = run.send(command, 'scripted')
      expect(after).toBe(before)
    }
    expect(run.state.events).toEqual(before.events)
    expect(run.state.events).not.toContain('captured')
    expect(run.state.events).not.toContain('acknowledged')
    expect(run.state.events).not.toContain('advanced')
  })

  it('refuses a tick on a step whose scene has no clock of its own', () => {
    const run = session('view-loss', plainView)
    const before = run.state
    expect(run.send({ type: 'tick', seconds: 1 }, 'scripted')).toBe(before)
    expect(run.state.signals.clockSec).toBe(0)
  })

  it('never lets time alone count as the learner acting', () => {
    const run = session('larynx-and-entry', larynxView)
    for (let i = 0; i < 24; i += 1) run.send({ type: 'tick', seconds: 0.5 }, 'scripted')
    expect(run.state.inputModes).toEqual([])
    expect(learnerActedOnScope(run.state)).toBe(false)
    // A tick the learner presses is still not an action either; only a real command is.
    run.send({ type: 'tick', seconds: 1 }, 'pointer')
    expect(learnerActedOnScope(run.state)).toBe(false)
    run.send({ type: 'advance', mm: 3 }, 'pointer')
    expect(learnerActedOnScope(run.state)).toBe(true)
  })

  it('shows the hold from the clock its goal reads', () => {
    const run = session('branch-entry', holdView)
    expect(holdView.readouts).toContain('holdRemaining')
    expect(formatScopeMetric('holdRemaining', run.state)).toContain(`of ${HOLD_SECONDS}`)
    for (let i = 0; i < 4; i += 1) run.send({ type: 'tick', seconds: 1 }, 'scripted')
    expect(formatScopeMetric('holdRemaining', run.state)).toContain(`1 of ${HOLD_SECONDS}`)
    for (let i = 0; i < 4; i += 1) run.send({ type: 'tick', seconds: 1 }, 'scripted')
    // Time running out is not the hold: the assistant is still waiting for the image.
    expect(run.state.events).not.toContain('hold-completed')
    expect(formatScopeMetric('holdRemaining', run.state)).toBe(
      'The scripted seconds have run; the assistant is still waiting',
    )
    run.send({ type: 'acknowledge' }, 'pointer')
    expect(run.state.events).not.toContain('hold-completed')
    run.send({ type: 'capture' }, 'pointer')
    expect(run.state.events).toContain('hold-completed')
    expect(formatScopeMetric('holdRemaining', run.state)).toBe('The scripted hold is finished')
  })

  it('keeps the closed-fold refusal and the exposed-accessory refusal', () => {
    const larynx = session('larynx-and-entry', larynxView)
    let state = larynx.state
    while (state.depthMm + state.inputs.stepMm < 30)
      state = larynx.send({ type: 'advance', mm: state.inputs.stepMm }, 'pointer')
    expect(state.inputs.cords).not.toBe('abducted')
    state = larynx.send({ type: 'advance', mm: state.inputs.stepMm }, 'pointer')
    expect(state.events).toContain('advanced-against-closure')
    expect(state.events).not.toContain('glottis-crossed-open')
    expect(state.place).toBe('larynx')
  })
})

describe('a met goal says what kind of claim it is (A4, A5)', () => {
  it('separates what happened from what is true now', () => {
    expect(scopeGoalClaim({ type: 'event', event: 'reached-carina' })).toBe('history')
    expect(
      scopeGoalClaim({ type: 'event-sequence', events: ['reached-carina', 'entered:RMSB'] }),
    ).toBe('history')
    expect(scopeGoalClaim({ type: 'without', event: 'wall-contact' })).toBe('history')
    // The inspection record keeps every declaration after the scope leaves the airway, so reading
    // it is a statement about the attempt, not about what is in view (PR-254 review, finding 2).
    expect(scopeGoalClaim({ type: 'ledger', airway: 'RB6', status: 'inspected' })).toBe('history')
    expect(scopeGoalClaim({ type: 'ledger-complete', airways: ['RB6', 'RB7'] })).toBe('history')
    expect(scopeGoalClaim({ type: 'location', airway: 'TR' })).toBe('current')
    expect(
      scopeGoalClaim({ type: 'metric', metric: 'deflectionDeg', op: 'abs>=', value: 10 }),
    ).toBe('current')
    expect(
      scopeGoalClaim({
        type: 'all',
        tests: [
          { type: 'event', event: 'hold-completed' },
          { type: 'location', airway: 'TR' },
        ],
      }),
    ).toBe('mixed')
  })

  it('classes the two cards the walkthrough finished in a lost view as history', () => {
    expect(scopeGoalsClaim(act(branchEntry).goals)).toBe('history')
    expect(scopeGoalsClaim(act(viewLoss).goals)).toBe('history')
  })

  it('classes the survey card, which is entirely a record, as history', () => {
    const survey = act(systematicSurvey)
    expect(scopeGoalsClaim(survey.goals)).toBe('history')
    for (const goal of survey.goals)
      expect([goal.id, scopeGoalClaim(goal.test)]).toEqual([goal.id, 'history'])
  })

  it('keeps a live reading current, and a card that mixes the two mixed', () => {
    const hold = act(branchEntry).observe!.goals
    expect(scopeGoalsClaim(hold)).toBe('mixed')
    const byId = Object.fromEntries(hold.map((goal) => [goal.id, scopeGoalClaim(goal.test)]))
    expect(byId).toEqual({
      acknowledge: 'history',
      capture: 'mixed',
      hold: 'mixed',
      'no-drift': 'history',
    })
  })

  it('names what every finished card is allowed to say', () => {
    expect(scopeDoneLead('history')).toBe('Recorded: every step this card asks for.')
    expect(scopeDoneLead('mixed')).toBe(
      'Recorded: every step this card asks for, and its live readings hold.',
    )
    // No lead may read as approval of the picture; only a live-reading card says "Done".
    for (const claim of ['history', 'mixed'] as const)
      expect(scopeDoneLead(claim)).not.toMatch(/Every goal on this card is met/i)
    expect(GOAL_MODEL_LIMIT).toContain('does not judge the bronchoscope image')
    expect(GOAL_GROUP_HEADING.history).toBe('On the record for this attempt')
  })

  it('stops claiming an unmeasured quality in the goals themselves', () => {
    const labels = (goals: readonly ScopeGoal[]) => goals.map((goal) => goal.label).join(' | ')
    const entry = labels(act(branchEntry).goals)
    // The model counts contacts; it does not know the tip is off the wall now.
    expect(entry).not.toMatch(/keep the tip off the wall/i)
    expect(entry).toMatch(/no wall contact recorded/i)
    expect(labels(act(viewLoss).goals)).not.toMatch(/along the visible lumen/i)
    expect(labels(act(branchEntry).observe!.goals)).toMatch(/no wall contact recorded/i)
    // `advanced-blind` records an advance made while the model's own view signal was lost. It is
    // not a reading of the image, and the label may not imply one.
    expect(entry).not.toMatch(/without a clear view/i)
    expect(entry).toMatch(/while the model recorded a lost view/i)
    expect(labels(act(viewLoss).observe!.goals)).not.toMatch(/usable view/i)
    expect(labels(act(branchEntry).observe!.goals)).not.toMatch(/no change in depth/i)
  })

  it('keeps every goal reachable and unmet at the start', () => {
    for (const [sectionId, section] of [
      ['branch-entry', branchEntry],
      ['view-loss', viewLoss],
      ['larynx-and-entry', larynxAndEntry],
      ['protected-accessories', protectedAccessories],
    ] as const) {
      const lab = act(section)
      for (const goals of [lab.goals, lab.observe?.goals ?? []]) {
        for (const goal of goals)
          expect({ sectionId, goal: goal.id, claim: scopeGoalClaim(goal.test) }).toEqual({
            sectionId,
            goal: goal.id,
            claim: expect.stringMatching(/^(history|current|mixed)$/),
          })
      }
    }
  })
})
