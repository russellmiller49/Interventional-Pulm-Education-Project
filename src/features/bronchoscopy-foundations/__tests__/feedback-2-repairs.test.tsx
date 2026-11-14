/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'

import { renderToStaticMarkup } from 'react-dom/server'

import { sampleEdgePose } from '@/lib/airway-anatomy/scope-state'
import { projectOptical } from '@/lib/bronchoscopy-core/frame'
import { scopeOpticalFrame } from '@/lib/airway-anatomy/transport-frames'
import type { Vec3 } from '@/lib/airway-anatomy/types'

import {
  HELD_STEP_MM,
  HELD_TURN_DEG,
  heldKeyCommand,
  scopeKeyCommand,
} from '../components/scope/scopeKeyMap'
import { projectPinLabel, projectScenePins } from '../components/scope/scopeSceneModel'
import {
  AIRWAY_LABELS,
  SEGMENTAL_AIRWAY_LABELS,
  type AirwayLabel,
  type ScopeCommand,
  type ScopeGoal,
  type ScopeGoalTest,
  type ScopeViewSpec,
} from '../components/scope/types'
import {
  HEAD_OF_BED_LANDMARKS,
  OPERATOR_POSITIONS,
  clockWords,
  landmarkClock,
} from '../components/stage/OrientationCompass'
import { SurveyVideo } from '../components/stage/SurveyVideo'
import { airwayDisplayName } from '../content/airwayTree'
import { COURSE_FLOWS } from '../content/courseFlow'
import { findFrame } from '../content/findFrames'
import { bronchLearnerCopyErrors } from '../content/learnerCopy'
import { courseStill } from '../content/media'
import { BRONCH_SECTION_IDS } from '../content/sectionIds'
import { section as larynxAndEntry } from '../content/sections/larynx-and-entry'
import { section as leftSide } from '../content/sections/left-side'
import { section as rightSide } from '../content/sections/right-side'
import { section as systematicSurvey } from '../content/sections/systematic-survey'
import { bronchStageLesson } from '../content/stageLessons'
import type { BronchAct, ScopeLabAct } from '../content/types'
import {
  GOAL_GROUP_HEADING,
  GOAL_PENDING_HEADING,
  PLAIN_DONE_LEAD,
  PLAIN_GOALS_DONE_HEADING,
  PLAIN_GOALS_HEADING,
  PLAIN_NEXT_GOAL_HEADING,
  goalListHeading,
  scopeDoneLead,
  scopeNowLine,
} from '../engine/scope/goalPresentation'
import {
  UNNAMED_AIRWAY_WORDS,
  namingSubject,
  unnamedAirways,
} from '../engine/scope/inspectionLedger'
import { scopeLocationCaption } from '../engine/scope/scopeCaption'
import { goalHelp } from '../engine/scope/goalHelp'
import { aimAt } from '../engine/scope/scopeFrame'
import { scopeGoalStatuses, scopeGoalTestMet } from '../engine/scope/scopeGoalEvaluation'
import { DEFAULT_STEP_MM } from '../engine/scope/scopeInputs'
import { isForkWaitMessage, SCOPE_MESSAGES } from '../engine/scope/scopeMessages'
import { formatScopeMetric } from '../engine/scope/scopeMetrics'
import { aimsAtWall, guidedFork } from '../engine/scope/scopeMotion'
import { openingInsetMm } from '../engine/scope/scopeCase'
import { OPTICAL_ASPECT, OPTICAL_FOV_DEG } from '../engine/scope/scopeOstia'
import { transportFor } from '../engine/scope/scopePose'
import {
  ENVIRONMENT_CLOCK_SCRIPTS,
  FORK_CARRY_MM,
  FORK_STANDOFF_MM,
  GUIDED_AIM_CONE_DEG,
  GUIDED_AIM_MARGIN_DEG,
  MOTION_INCREMENT_MM,
} from '../engine/scope/scopeScripts'
import { scopeViewErrors } from '../engine/scope/scopeViewErrors'
import { ScopePilot } from '../test-support/scopePilot'
import { CARINA_RECIPE, SCOPE_RECIPES } from '../test-support/scopeRecipes'
import { ScopeDriver, teachingCase } from '../test-support/teachingCase'

/**
 * Educator feedback on the course, 2026-10-13, held at the level of the engine and the content.
 *
 * The driving asked for more precision than a screen can teach, so guided travel was made
 * forgiving: a bend registers no wall contact, and the picture decides at a fork. The scope stops
 * once short of every fork, where both openings are in the picture; from there the opening nearest
 * the centre of the learner's own view is entered in one movement, or the scope waits while none
 * is plainly the nearest; and the tip returns to neutral once through. The tasks dropped what
 * depended on the old strictness (the
 * trachea declaration, the clean-passage goal, the hold above the carina, the penalty for a wrong
 * turn). Opening names moved off the ridge between two openings and into each lumen, the right
 * lung task opens on the view that finds the middle lobe, the right main bronchus has a still from
 * the trachea, a held control glides, and the goal card says what to do in plain words. The survey
 * is recorded by naming each segment from inside it, a figure shows what standing somewhere other
 * than the head of the bed does to the picture, and the survey video opens on its own first frame.
 */

const scopeCase = teachingCase()

function scopeLab(act: BronchAct | undefined): ScopeLabAct {
  if (!act || act.kind !== 'scope-lab') throw new Error('Not a scope task')
  return act
}

const walkView = (
  label: AirwayLabel,
  at: 'proximal' | 'mid' | 'distal',
  extra: Partial<ScopeViewSpec> = {},
): ScopeViewSpec => ({
  sectionId: 'feedback-2',
  mode: 'guided-walk',
  profile: 'adult-teaching-combined-left-basal-v1',
  start: { kind: 'airway', label, at },
  controls: ['advance', 'withdraw', 'rotate', 'deflect', 'recenter'],
  assists: { 'centerline-lock': true, 'aim-guard': true, recenter: true },
  boundary: 'Engine test view.',
  ...extra,
})

/** The same airway under unaided travel on the graph alone: no lumen to drive against. */
const unaidedView = (label: AirwayLabel, at: 'proximal' | 'mid' | 'distal'): ScopeViewSpec =>
  walkView(label, at, { mode: 'free-drive', assists: {} })

const pilot = (view: ScopeViewSpec) => new ScopePilot(new ScopeDriver(view))
const allMet = (goals: readonly ScopeGoal[]) => Object.fromEntries(goals.map((g) => [g.id, true]))
const count = (events: readonly string[], event: string) =>
  events.filter((candidate) => candidate === event).length

function goalEvents(test: ScopeGoalTest): string[] {
  switch (test.type) {
    case 'event':
    case 'without':
      return [test.event]
    case 'event-sequence':
      return [...test.events]
    case 'all':
      return test.tests.flatMap(goalEvents)
    default:
      return []
  }
}

function withoutTests(test: ScopeGoalTest): string[] {
  if (test.type === 'without') return [test.event]
  return test.type === 'all' ? test.tests.flatMap(withoutTests) : []
}

const step = (driver: ScopeDriver) =>
  driver.send({ type: 'advance', mm: driver.state.inputs.stepMm })

/** The fork ahead of the tip as guided travel reads it now, with the controls as they are. */
function forkAhead(driver: ScopeDriver) {
  const engine = driver.state.engine!
  const fork = guidedFork(
    engine.edgeId,
    driver.state.inputs,
    { view: driver.view, scopeCase },
    engine.distanceMm,
  )
  if (!fork) throw new Error(`Edge ${engine.edgeId} does not end in a fork`)
  return fork
}

/** Whether the scope has come to the place it waits at before the fork ahead, or is past it. */
const atTheWait = (driver: ScopeDriver) =>
  driver.state.engine!.distanceMm >= forkAhead(driver).standMm - 1e-6

/**
 * Advance with the tip as it is until the scope stops before the fork ahead, the way a learner
 * arrives at one: the scope stops there by itself, whether or not the aim has chosen an opening.
 */
function advanceToFork(driver: ScopeDriver) {
  const from = driver.state.engine!.edgeId
  for (let i = 0; i < 80 && driver.state.engine!.edgeId === from && !atTheWait(driver); i += 1)
    step(driver)
  return driver
}

/** Stopped above the main carina with a straight tip: short of the fork, not on it. */
const atTheCarina = () => advanceToFork(new ScopeDriver(walkView('TR', 'distal')))

/** How far short of the fork ahead the tip is, along the airway it is in. */
function shortOfFork(driver: ScopeDriver): number {
  const engine = driver.state.engine!
  return scopeCase.index.edgesById.get(engine.edgeId)!.lengthMm - engine.distanceMm
}

const inViewLabels = (driver: ScopeDriver) =>
  driver.state.ostia
    .filter((pin) => pin.inView)
    .map((pin) => pin.label)
    .sort()

/** The point inside an opening where its name is drawn, and one further down its course. */
function pointDown(edgeId: number, beyondNameMm = 0): Vec3 {
  const child = scopeCase.index.edgesById.get(edgeId)!
  const mm = openingInsetMm(child) + beyondNameMm
  if (mm <= child.lengthMm) return sampleEdgePose(child, mm).point
  // Past the end of a short first segment the course is carried straight on.
  const end = sampleEdgePose(child, child.lengthMm)
  const over = mm - child.lengthMm
  return [
    end.point[0] + end.tangent[0] * over,
    end.point[1] + end.tangent[1] * over,
    end.point[2] + end.tangent[2] * over,
  ]
}

/**
 * Bring an opening of the fork ahead toward the centre of the picture the fork is read from: the
 * point where its name is drawn, all the way or a share of the bend that would centre it.
 */
function centre(driver: ScopeDriver, edgeId: number, share = 1) {
  const fork = forkAhead(driver)
  if (!fork.openings.some((candidate) => candidate.edgeId === edgeId))
    throw new Error(`Edge ${edgeId} does not open off the fork ahead`)
  const aim = aimAt(fork.base, pointDown(edgeId))
  driver.send({ type: 'set-rotation', deg: aim.rotationDeg })
  driver.send({ type: 'set-deflection', deg: aim.deflectionDeg * share })
  return aim
}

/** The edge a labelled airway opens off: the one whose fork holds its opening. */
function parentEdgeOf(label: AirwayLabel): number {
  const edge = scopeCase.index.edgesById.get(scopeCase.originEdge.get(label)!)!
  const parent = scopeCase.index.nodesById.get(edge.startNodeId)?.parentEdgeId
  if (parent == null) throw new Error(`${label} opens off no fork`)
  return parent
}

/** A straight tip just inside an edge, reached the learner's own way. */
function onEdge(edgeId: number) {
  const driver = new ScopeDriver(walkView('TR', 'distal'))
  new ScopePilot(driver).goToEdge(edgeId)
  return driver
}

/** Every edge of the teaching graph that ends in a fork. */
const FORK_EDGES = scopeCase.graph.edges.filter(
  (edge) => (scopeCase.index.nodesById.get(edge.endNodeId)?.childEdgeIds.length ?? 0) > 1,
)

/**
 * Whether ordinary steps from where the tip is end one of their increments exactly on the place
 * the scope waits. See the known defect pinned under "guided travel is forgiving".
 */
function stepLandsOnTheWait(driver: ScopeDriver): boolean {
  const increments =
    (forkAhead(driver).standMm - driver.state.engine!.distanceMm) / MOTION_INCREMENT_MM
  return increments > 0 && Math.abs(increments - Math.round(increments)) < 1e-9
}

describe('larynx, trachea and carina: what the tasks ask for', () => {
  const cords = scopeLab(larynxAndEntry.act)
  const carina = scopeLab(larynxAndEntry.moreActs?.carina)

  it('has no hold activity, and no step of the course runs the scripted hold', () => {
    expect(Object.keys(larynxAndEntry.moreActs ?? {})).not.toContain('hold')
    const flow = COURSE_FLOWS['larynx-and-entry'] ?? []
    expect(flow.map((chunk) => chunk.id)).not.toContain('hold-view')
    expect(flow.some((chunk) => chunk.act === 'hold')).toBe(false)
    // The reading on holding a view stays; only the task went.
    expect(flow.some((chunk) => chunk.blocks.includes('holding-the-view'))).toBe(true)
    let scopeSteps = 0
    for (const id of BRONCH_SECTION_IDS)
      for (const step of bronchStageLesson(id).steps) {
        const { interaction } = step
        if (interaction.kind !== 'scope-task' && interaction.kind !== 'observe') continue
        scopeSteps += 1
        expect({ step: step.id, hold: interaction.view.script === 'assistant-interrupt' }).toEqual({
          step: step.id,
          hold: false,
        })
        expect(interaction.view.controls).not.toContain('acknowledge')
      }
    expect(scopeSteps).toBeGreaterThan(8)
    // The engine still carries the scripted hold and its clock (`test-support/carinaTasks.ts`).
    expect([...ENVIRONMENT_CLOCK_SCRIPTS]).toContain('assistant-interrupt')
  })

  it('asks only for the crossing on the cords task: nothing to record, and no control for it', () => {
    expect(cords.goals.map((goal) => goal.id)).toEqual([
      'cross-glottis-open',
      'no-advance-against-closure',
    ])
    expect(cords.view.controls).not.toContain('declare')
    expect(cords.view.ledger).toBeUndefined()
    expect(
      cords.goals.flatMap((goal) => goalEvents(goal.test)).filter((e) => e.startsWith('declared:')),
    ).toEqual([])
    // Crossing as the folds part is the whole task.
    const p = pilot(cords.view)
    SCOPE_RECIPES['larynx-and-entry']!.act(p)
    expect(p.state.location.label).toBe('TR')
    expect(p.goals(cords.goals)).toEqual(allMet(cords.goals))
    // And a declaration has nowhere to go on this view.
    p.send({ type: 'declare', airway: 'TR', status: 'identified' })
    expect(p.state.events.some((event) => event.startsWith('declared:'))).toBe(false)
    expect(p.state.message).toBe(SCOPE_MESSAGES.controlNotOffered)
  })

  it('asks at the carina for the way into each main bronchus and the way back, and nothing else', () => {
    expect(carina.goals.map((goal) => goal.id)).toEqual([
      'reach-carina',
      'enter-right',
      'back-to-trachea',
      'enter-left',
      'back-from-left',
    ])
    expect(carina.goals.at(-1)!.test).toEqual({
      type: 'event-sequence',
      events: ['entered:LMSB', 'returned-to-trachea'],
    })
    for (const goal of [...cords.goals, ...carina.goals])
      expect(goal.label).not.toMatch(/wall contact|refused/i)
    // No goal of the carina task can be lost: none is a "without".
    expect(carina.goals.flatMap((goal) => withoutTests(goal.test))).toEqual([])
    expect(carina.view.readouts ?? []).not.toContain('contactCount')
    // The outcome no longer promises a steadiness the task does not ask for.
    expect(larynxAndEntry.outcomes?.find((o) => o.id === 'carina-home')?.text).not.toMatch(/drift/i)
  })

  it('still meets every carina goal after a refused advance on the way', () => {
    const p = pilot(carina.view)
    // Straight down the trachea until the aim guard stops the tip at the carina.
    p.advanceUntil(() => p.state.events.includes('aim-refused'))
    expect(p.state.location.label).toBe('TR')
    CARINA_RECIPE(p)
    expect(p.state.events).toContain('aim-refused')
    expect(p.goals(carina.goals)).toEqual(allMet(carina.goals))
    expect(p.state.location.label).toBe('TR')
  })
})

describe('guided travel is forgiving', () => {
  it('waits short of the main carina with a straight tip, both openings in view, and no contact', () => {
    const driver = atTheCarina()
    expect(driver.state.location.label).toBe('TR')
    expect(driver.state.inputs.deflectionDeg).toBe(0)
    expect(driver.state.events).toContain('aim-refused')
    expect(driver.state.message).toBe(SCOPE_MESSAGES.aimRefused)
    expect(driver.state.assistsUsed).toContain('aim-guard')
    // The tip is held back from the fork, where the picture still shows what it is choosing
    // between; on the fork itself the picture is the ridge between the two openings.
    expect(Math.abs(shortOfFork(driver) - FORK_STANDOFF_MM)).toBeLessThan(0.5)
    expect(inViewLabels(driver)).toEqual(['LMSB', 'RMSB'])
    // Neither opening is plainly the nearer the centre of that picture, so none is chosen.
    const fork = forkAhead(driver)
    expect(fork.chosenEdgeId).toBeNull()
    expect(driver.state.engine!.distanceMm).toBeCloseTo(fork.standMm, 6)
    expect(fork.openings.map((opening) => opening.edgeId).sort()).toEqual(
      [scopeCase.originEdge.get('RMSB')!, scopeCase.originEdge.get('LMSB')!].sort(),
    )
    expect(fork.openings[1].offAxisDeg - fork.openings[0].offAxisDeg).toBeLessThan(
      GUIDED_AIM_MARGIN_DEG,
    )
    // Asked again, it waits again: the guard still does not choose a side, and does not creep.
    const depth = driver.state.depthMm
    const refusals = count(driver.state.events, 'aim-refused')
    step(driver)
    expect(driver.state.location.label).toBe('TR')
    expect(driver.state.depthMm).toBe(depth)
    expect(count(driver.state.events, 'aim-refused')).toBe(refusals + 1)
    expect(driver.state.events).not.toContain('wall-contact')
    expect(driver.state.events).not.toContain('red-out')
    expect(driver.state.signals.contactCount).toBe(0)
  })

  it.each(['RMSB', 'LMSB'] as const)(
    'enters %s from the carina in one advance once its opening is brought toward the centre',
    (label) => {
      const edgeId = scopeCase.originEdge.get(label)!
      // Half the bend that would centre it already makes it plainly the nearer; so does all of it.
      for (const share of [0.5, 1]) {
        const driver = atTheCarina()
        centre(driver, edgeId, share)
        expect(forkAhead(driver).chosenEdgeId).toBe(edgeId)
        // The aim is decided, so the wait is over: one movement takes the tip through.
        const refusals = count(driver.state.events, 'aim-refused')
        step(driver)
        expect(driver.state.location.label).toBe(label)
        expect(driver.state.events).toContain(`entered:${label}`)
        expect(count(driver.state.events, 'aim-refused')).toBe(refusals)
        expect(driver.state.events).not.toContain('wall-contact')
      }
    },
  )

  it('takes the side the learner turned to: a quarter turn and a small bend, no exact aim', () => {
    for (const [rotationDeg, label] of [
      [90, 'RMSB'],
      [-90, 'LMSB'],
    ] as const) {
      const driver = atTheCarina()
      driver.send({ type: 'set-rotation', deg: rotationDeg })
      driver.send({ type: 'set-deflection', deg: 10 })
      expect(forkAhead(driver).chosenEdgeId).toBe(scopeCase.originEdge.get(label))
      step(driver)
      expect([rotationDeg, driver.state.location.label]).toEqual([rotationDeg, label])
    }
  })

  it('waits exactly while no opening is plainly the nearest: the picture decides, not the bend', () => {
    const left = scopeCase.originEdge.get('LMSB')!
    let waited = 0
    let entered = 0
    // From a straight tip to the left main opening centred, a twentieth of the way at a time.
    for (let twentieths = 0; twentieths <= 20; twentieths += 1) {
      const driver = atTheCarina()
      const aim = centre(driver, left, twentieths / 20)
      const fork = forkAhead(driver)
      const [nearest, next] = fork.openings
      const plain =
        nearest.offAxisDeg <= GUIDED_AIM_CONE_DEG &&
        next.offAxisDeg - nearest.offAxisDeg >= GUIDED_AIM_MARGIN_DEG
      expect(fork.chosenEdgeId).toBe(plain ? nearest.edgeId : null)
      const depth = driver.state.depthMm
      const refusals = count(driver.state.events, 'aim-refused')
      step(driver)
      if (plain) {
        // What the picture chose is what the engine enters.
        expect(driver.state.engine!.edgeId).toBe(nearest.edgeId)
        expect(count(driver.state.events, 'aim-refused')).toBe(refusals)
        entered += 1
      } else {
        expect(driver.state.location.label).toBe('TR')
        expect(driver.state.depthMm).toBe(depth)
        expect(count(driver.state.events, 'aim-refused')).toBe(refusals + 1)
        // The bend the learner put on is theirs to keep: nothing was crossed.
        expect(driver.state.inputs.deflectionDeg).toBeCloseTo((aim.deflectionDeg * twentieths) / 20)
        waited += 1
      }
    }
    // The straight tip and the smallest bends wait; most of the way to the centre does not.
    expect(waited).toBeGreaterThan(0)
    expect(entered).toBeGreaterThan(10)
  })

  it('does not choose an opening that is out of the picture, however clearly it is the nearest', () => {
    const driver = atTheCarina()
    const right = scopeCase.originEdge.get('RMSB')!
    // Past the right main opening and on round, until all of its course is outside the cone.
    const aim = centre(driver, right)
    let bend = aim.deflectionDeg
    for (; bend < 120 && forkAhead(driver).openings[0].offAxisDeg <= GUIDED_AIM_CONE_DEG; bend += 5)
      driver.send({ type: 'set-deflection', deg: bend + 5 })
    const fork = forkAhead(driver)
    const [nearest, next] = fork.openings
    expect(nearest.edgeId).toBe(right)
    expect(nearest.offAxisDeg).toBeGreaterThan(GUIDED_AIM_CONE_DEG)
    expect(next.offAxisDeg - nearest.offAxisDeg).toBeGreaterThanOrEqual(GUIDED_AIM_MARGIN_DEG)
    expect(fork.chosenEdgeId).toBeNull()
    const depth = driver.state.depthMm
    step(driver)
    expect(driver.state.location.label).toBe('TR')
    expect(driver.state.depthMm).toBe(depth)
    expect(driver.state.message).toBe(SCOPE_MESSAGES.aimRefused)
    // Brought back inside the cone, the same opening is chosen.
    driver.send({ type: 'set-deflection', deg: aim.deflectionDeg + 10 })
    expect(forkAhead(driver).chosenEdgeId).toBe(right)
  })

  it('chooses the opening the view is pointed down, from the waiting place and from anywhere on the last stretch', () => {
    // Every fork, with and without the reference roll, from the waiting place in to a quarter of
    // a millimetre short of the fork, each opening aimed at where its name is drawn and at a
    // point further down its course.
    let cases = 0
    for (const assists of [
      { 'centerline-lock': true, 'aim-guard': true },
      { 'centerline-lock': true, 'aim-guard': true, 'reference-orientation': true },
    ] as const) {
      const view = walkView('TR', 'distal', { assists })
      const ctx = { view, scopeCase }
      for (const edge of FORK_EDGES)
        for (const before of [8, 6, 4, 2, 1, 0.25]) {
          const at = Math.max(0, edge.lengthMm - before)
          const base = transportFor(view, scopeCase).at(edge.id, at)
          for (const childId of scopeCase.index.nodesById.get(edge.endNodeId)!.childEdgeIds)
            for (const beyondNameMm of [0, 6]) {
              const aim = aimAt(base, pointDown(childId, beyondNameMm))
              const fork = guidedFork(edge.id, aim, ctx, at)!
              const where = { fork: edge.id, before, opening: childId, beyondNameMm }
              expect({ ...where, chosen: fork.chosenEdgeId }).toEqual({ ...where, chosen: childId })
              cases += 1
            }
        }
    }
    expect(FORK_EDGES).toHaveLength(35)
    expect(cases).toBe(1680)
  })

  it('reads the fork from where the tip is once it is past the waiting place', () => {
    // The case the educator met: back at the upper lobe's first fork with a clear view down the
    // way on, control section turned 98° and the tip bent 44°. Read from eight millimetres back,
    // that bend pointed at the wall; read from the tip, it points down the continuation.
    const upperLobe = scopeCase.originEdge.get('RUL')!
    const edge = scopeCase.index.edgesById.get(upperLobe)!
    const [continuation] = scopeCase.index.nodesById
      .get(edge.endNodeId)!
      .childEdgeIds.filter((childId) => scopeCase.labelAt(childId) === 'RUL')
    expect(continuation).toBeDefined()
    const view = walkView('TR', 'distal')
    expect(view.assists['reference-orientation']).toBeUndefined()
    const inputs = { rotationDeg: 98, deflectionDeg: 44 }
    for (const before of [8, 4, 2, 0.5]) {
      const fork = guidedFork(upperLobe, inputs, { view, scopeCase }, edge.lengthMm - before)!
      expect({ before, chosen: fork.chosenEdgeId }).toEqual({ before, chosen: continuation })
    }
    // Past the waiting place the picture is the tip's own, taken from where the tip is.
    const fromTheWait = guidedFork(upperLobe, inputs, { view, scopeCase })!
    const fromTheTip = guidedFork(upperLobe, inputs, { view, scopeCase }, edge.lengthMm - 2)!
    expect(fromTheWait.standMm).toBeCloseTo(edge.lengthMm - FORK_STANDOFF_MM, 6)
    expect(fromTheTip.standMm).toBe(fromTheWait.standMm)
    expect(fromTheTip.base.position).not.toEqual(fromTheWait.base.position)
    expect(fromTheTip.base.position).toEqual(
      transportFor(view, scopeCase).at(upperLobe, edge.lengthMm - 2).position,
    )
    // At the waiting place or short of it, a distance changes nothing: it is the wait's reading.
    expect(guidedFork(upperLobe, inputs, { view, scopeCase }, fromTheWait.standMm)).toEqual(
      fromTheWait,
    )
    expect(guidedFork(upperLobe, inputs, { view, scopeCase }, 1)).toEqual(fromTheWait)
  })

  it('stops once on arriving at a fork even with the way on plainly chosen, and records no refusal', () => {
    const driver = new ScopeDriver(walkView('TR', 'distal'))
    expect(shortOfFork(driver)).toBeGreaterThan(FORK_STANDOFF_MM + 3)
    // Chosen from well back: the right main opening centred in the picture the fork is read from.
    centre(driver, scopeCase.originEdge.get('RMSB')!)
    const bend = driver.state.inputs.deflectionDeg
    expect(forkAhead(driver).chosenEdgeId).toBe(scopeCase.originEdge.get('RMSB'))
    advanceToFork(driver)
    // The scope has stopped to show the fork: at the waiting place, with nothing refused.
    expect(driver.state.location.label).toBe('TR')
    expect(driver.state.engine!.distanceMm).toBeCloseTo(forkAhead(driver).standMm, 6)
    expect(driver.state.message).toBe(SCOPE_MESSAGES.forkAhead)
    expect(driver.state.events).not.toContain('aim-refused')
    expect(driver.state.inputs.deflectionDeg).toBe(bend)
    expect(inViewLabels(driver)).toContain('RMSB')
    // A long advance is stopped there too: arriving never runs on through the fork.
    const far = new ScopeDriver(walkView('TR', 'distal'))
    centre(far, scopeCase.originEdge.get('RMSB')!)
    far.send({ type: 'advance', mm: 60 })
    expect(far.state.location.label).toBe('TR')
    expect(far.state.depthMm).toBeCloseTo(driver.state.depthMm, 6)
    expect(far.state.message).toBe(SCOPE_MESSAGES.forkAhead)
    // The next advance goes on, into the opening at the centre of the view.
    step(driver)
    expect(driver.state.location.label).toBe('RMSB')
    expect(driver.state.events).not.toContain('aim-refused')
  })

  it('carries the tip through a chosen opening in one movement, a short way inside', () => {
    const driver = atTheCarina()
    centre(driver, scopeCase.originEdge.get('LMSB')!)
    const depth = driver.state.depthMm
    const toFork = shortOfFork(driver)
    expect(toFork).toBeCloseTo(FORK_STANDOFF_MM, 6)
    // One ordinary step is shorter than the last stretch, and still takes the tip all the way.
    expect(driver.state.inputs.stepMm).toBeLessThan(toFork)
    step(driver)
    expect(driver.state.location.label).toBe('LMSB')
    expect(driver.state.engine!.distanceMm).toBeCloseTo(FORK_CARRY_MM, 6)
    expect(driver.state.depthMm).toBeCloseTo(depth + toFork + FORK_CARRY_MM, 6)
    // The fine increment of a held control is carried the same way.
    const fine = atTheCarina()
    centre(fine, scopeCase.originEdge.get('LMSB')!)
    fine.send({ type: 'advance', mm: HELD_STEP_MM })
    expect(fine.state.location.label).toBe('LMSB')
    expect(fine.state.engine!.distanceMm).toBeCloseTo(FORK_CARRY_MM, 6)
  })

  it('takes one opening in one movement: it does not run on through the next fork', () => {
    // The upper lobe's way on is a connecting stretch under five millimetres long, with the fork
    // into RB1 and RB2 at its end.
    const upperLobe = scopeCase.originEdge.get('RUL')!
    const driver = advanceToFork(onEdge(upperLobe))
    const fork = forkAhead(driver)
    const continuation = fork.chosenEdgeId!
    expect(scopeCase.labelAt(continuation)).toBe('RUL')
    expect(scopeCase.index.edgesById.get(continuation)!.lengthMm).toBeLessThan(FORK_STANDOFF_MM)
    expect(driver.state.message).toBe(SCOPE_MESSAGES.forkAhead)
    // However long the movement, it ends just inside that stretch, short of the next choice.
    for (const mm of [driver.state.inputs.stepMm, 40]) {
      const one = advanceToFork(onEdge(upperLobe))
      const refusals = count(one.state.events, 'aim-refused')
      one.send({ type: 'advance', mm })
      expect({ mm, edge: one.state.engine!.edgeId }).toEqual({ mm, edge: continuation })
      expect(one.state.location.label).toBe('RUL')
      expect(one.state.events.filter((event) => event.startsWith('entered:RB'))).toEqual([])
      expect(one.state.engine!.distanceMm).toBeLessThanOrEqual(FORK_CARRY_MM + 1e-6)
      // It does not stop there without a word: the stretch's own fork is announced at once, as a
      // fork is anywhere else, and with no refusal recorded for it.
      expect({ mm, said: isForkWaitMessage(one.state.message) }).toEqual({ mm, said: true })
      expect(count(one.state.events, 'aim-refused')).toBe(refusals)
    }
    // And a second movement is one more opening, not two.
    step(driver)
    step(driver)
    expect(scopeCase.index.edgesById.get(driver.state.engine!.edgeId)!.startNodeId).toBe(
      scopeCase.index.edgesById.get(continuation)!.endNodeId,
    )
  })

  it('enters whichever opening is centred, at every fork of the model, in one advance', () => {
    let openings = 0
    for (const edge of FORK_EDGES)
      for (const childId of scopeCase.index.nodesById.get(edge.endNodeId)!.childEdgeIds) {
        const driver = advanceToFork(onEdge(edge.id))
        // Whatever stopped the scope here (a pause, a refusal, or a step that ran on and was
        // withdrawn), the tip is at the fork, on this edge.
        if (driver.state.engine!.edgeId !== edge.id) new ScopePilot(driver).withdrawToEdge(edge.id)
        expect(atTheWait(driver)).toBe(true)
        centre(driver, childId)
        // Centred in the picture the fork is read from, it is the one chosen …
        const aimed = forkAhead(driver)
        const where = { fork: edge.id, opening: childId }
        expect({ ...where, chosen: aimed.chosenEdgeId }).toEqual({ ...where, chosen: childId })
        expect(aimed.openings[0].edgeId).toBe(childId)
        expect(aimed.openings[0].offAxisDeg).toBeLessThan(0.01)
        // … and one advance takes the tip into it, with nothing refused and the bend let go.
        const refusals = count(driver.state.events, 'aim-refused')
        step(driver)
        expect({ ...where, entered: driver.state.engine!.edgeId }).toEqual({
          ...where,
          entered: childId,
        })
        expect(count(driver.state.events, 'aim-refused')).toBe(refusals)
        expect(driver.state.inputs.deflectionDeg).toBe(0)
        expect(driver.state.engine!.distanceMm).toBeLessThanOrEqual(FORK_CARRY_MM + 1e-6)
        openings += 1
      }
    // Every fork of the teaching graph, and both openings of each.
    expect(openings).toBe(2 * FORK_EDGES.length)
  })

  it.each([
    ['RB6', 'RLL'],
    ['LB6', 'LLL'],
    ['RB9', 'RLL'],
    ['RUL', 'RMSB'],
  ] as const)('enters %s from %s when its opening is centred', (label, from) => {
    // Four openings an earlier rule would not enter on a centred aim: it read the direction each
    // branch leaves the fork in, and the airway's continuation could win.
    expect(scopeCase.labelAt(parentEdgeOf(label))).toBe(from)
    const edgeId = scopeCase.originEdge.get(label)!
    const driver = advanceToFork(onEdge(parentEdgeOf(label)))
    centre(driver, edgeId)
    expect(forkAhead(driver).chosenEdgeId).toBe(edgeId)
    const refusals = count(driver.state.events, 'aim-refused')
    step(driver)
    expect(driver.state.location.label).toBe(label)
    expect(driver.state.events).toContain(`entered:${label}`)
    expect(count(driver.state.events, 'aim-refused')).toBe(refusals)
  })

  it('with a straight tip, stops at every fork and then does what that fork’s picture says', () => {
    let waits = 0
    let passes = 0
    let checked = 0
    for (const edge of FORK_EDGES) {
      const driver = onEdge(edge.id)
      expect(driver.state.inputs.deflectionDeg).toBe(0)
      // A step that ends exactly on the waiting place is the known defect below; left to it.
      if (stepLandsOnTheWait(driver)) continue
      checked += 1
      const arrivedAt = driver.state.engine!.distanceMm
      const where = { fork: edge.id }
      advanceToFork(driver)
      // Arriving always stops the scope on this edge: where the picture holds both openings, or
      // where the tip already is if it came in past that place.
      const fork = forkAhead(driver)
      expect({ ...where, edge: driver.state.engine!.edgeId }).toEqual({ ...where, edge: edge.id })
      expect(driver.state.engine!.distanceMm).toBeCloseTo(Math.max(arrivedAt, fork.standMm), 6)
      const depth = driver.state.depthMm
      const refusals = count(driver.state.events, 'aim-refused')
      if (fork.chosenEdgeId === null) {
        // No opening plainly the nearer the centre: every further advance is refused in place.
        if (arrivedAt < fork.standMm) expect(driver.state.message).toBe(SCOPE_MESSAGES.aimRefused)
        step(driver)
        expect({ ...where, edge: driver.state.engine!.edgeId }).toEqual({ ...where, edge: edge.id })
        expect(driver.state.depthMm).toBe(depth)
        expect(count(driver.state.events, 'aim-refused')).toBe(refusals + 1)
        expect(driver.state.message).toBe(SCOPE_MESSAGES.aimRefused)
        waits += 1
      } else {
        // One opening plainly ahead: the scope shows the fork once, and the next advance goes in.
        if (arrivedAt < fork.standMm) expect(driver.state.message).toBe(SCOPE_MESSAGES.forkAhead)
        step(driver)
        expect({ ...where, entered: driver.state.engine!.edgeId }).toEqual({
          ...where,
          entered: fork.chosenEdgeId,
        })
        expect(count(driver.state.events, 'aim-refused')).toBe(refusals)
        passes += 1
      }
      expect(driver.state.events).not.toContain('wall-contact')
    }
    // Some forks wait for a choice and some have a plain way on.
    expect(waits).toBeGreaterThan(0)
    expect(passes).toBeGreaterThan(0)
    expect(checked).toBeGreaterThan(30)
  })

  // Arrival is "reaches", not "passes". Where one of a movement's half-millimetre increments ends
  // exactly on the waiting place, the tip has arrived and stops there; read as "passes", the same
  // movement carried it on through the fork with no pause. One millimetre inside the airway, where
  // a carry leaves the tip, that happens in the lower lobe trunk before LB10 (22.5 mm long) and in
  // LB9 (11 mm).
  it('stops on arrival where a step ends exactly on the waiting place', () => {
    const trunk = parentEdgeOf('LB10')
    const driver = onEdge(trunk)
    expect(stepLandsOnTheWait(driver)).toBe(true)
    expect(forkAhead(driver).chosenEdgeId).not.toBeNull()
    for (let i = 0; i < 12 && driver.state.message !== SCOPE_MESSAGES.forkAhead; i += 1) {
      step(driver)
      // The scope must not leave the trunk before it has stopped to show the fork.
      expect(driver.state.engine!.edgeId).toBe(trunk)
    }
    expect(driver.state.message).toBe(SCOPE_MESSAGES.forkAhead)
    expect(driver.state.engine!.distanceMm).toBeCloseTo(forkAhead(driver).standMm, 6)
  })

  it('waits with a straight tip at the forks the course asks the learner to choose at', () => {
    // The main carina, the end of each main bronchus, the end of the bronchus intermedius, the
    // middle lobe's two segments, and the lower lobe where the superior segment leaves it.
    for (const label of ['TR', 'RMSB', 'LMSB', 'BI', 'RML', 'RLL'] as const) {
      const driver = advanceToFork(onEdge(scopeCase.originEdge.get(label)!))
      const fork = forkAhead(driver)
      expect({ label, chosen: fork.chosenEdgeId }).toEqual({ label, chosen: null })
      expect(fork.openings[1].offAxisDeg - fork.openings[0].offAxisDeg).toBeLessThan(
        GUIDED_AIM_MARGIN_DEG,
      )
      expect(driver.state.message).toBe(SCOPE_MESSAGES.aimRefused)
      step(driver)
      expect(driver.state.location.label).toBe(label)
      expect(driver.state.message).toBe(SCOPE_MESSAGES.aimRefused)
    }
    // Deeper in, where one opening is plainly ahead, a second press follows the airway on: out
    // of the basal trunk the way ahead is RB10.
    const trunk = advanceToFork(onEdge(parentEdgeOf('RB10')))
    const ahead = forkAhead(trunk)
    expect(ahead.chosenEdgeId).toBe(scopeCase.originEdge.get('RB10'))
    expect(ahead.openings[1].offAxisDeg - ahead.openings[0].offAxisDeg).toBeGreaterThanOrEqual(
      GUIDED_AIM_MARGIN_DEG,
    )
    step(trunk)
    expect(trunk.state.location.label).toBe('RB10')
    expect(trunk.state.events).not.toContain('misnamed')
  })

  it.each([
    ['the right lung task', scopeLab(rightSide.act)],
    ['the left lung task', scopeLab(leftSide.act)],
  ] as const)(
    'in %s, Advance alone from the start pauses at each fork, ends waiting, and meets no goal',
    (_task, act) => {
      const driver = new ScopeDriver(act.view)
      const start = driver.state
      const unmet = Object.fromEntries(act.goals.map((goal) => [goal.id, false]))
      const stops: { readonly edgeId: number; readonly chosen: number | null }[] = []
      // Press Advance until a press no longer moves the scope.
      for (let presses = 0; presses < 80; presses += 1) {
        const before = driver.state
        step(driver)
        if (isForkWaitMessage(driver.state.message) && driver.state.depthMm !== before.depthMm) {
          // Stopped to show a fork: short of it, on the airway that leads to it.
          expect(atTheWait(driver)).toBe(true)
          stops.push({
            edgeId: driver.state.engine!.edgeId,
            chosen: forkAhead(driver).chosenEdgeId,
          })
        }
        if (driver.state.depthMm === before.depthMm) break
      }
      // It went on only through forks whose picture had one opening plainly ahead, one fork to a
      // press, and it ends held at the first fork where the choice is open.
      expect(stops.length).toBeGreaterThan(0)
      expect(stops.slice(0, -1).every((stop) => stop.chosen !== null)).toBe(true)
      expect(stops.at(-1)!.chosen).toBeNull()
      expect(stops.at(-1)!.edgeId).toBe(driver.state.engine!.edgeId)
      expect(driver.state.message).toBe(SCOPE_MESSAGES.aimRefused)
      expect(driver.state.events).toContain('aim-refused')
      expect(driver.state.events).not.toContain('lumen-end')
      expect(driver.state.ostia.filter((pin) => pin.inView).length).toBeGreaterThanOrEqual(2)
      // What it entered on the way is what each of those pictures chose.
      expect(driver.state.events.filter((event) => event.startsWith('entered:'))).toEqual(
        stops.slice(0, -1).map((stop) => `entered:${scopeCase.labelAt(stop.chosen!)}`),
      )
      // The learner steered nothing, and no goal of the task is met.
      expect(
        driver.state.events.filter((event) => /^control-used:(rotation|deflection)$/.test(event)),
      ).toEqual([])
      expect(driver.state.inputs.rotationDeg).toBe(start.inputs.rotationDeg)
      expect(new ScopePilot(driver).goals(act.goals)).toEqual(unmet)
      // And it stays there however long Advance is pressed.
      const depth = driver.state.depthMm
      for (let i = 0; i < 10; i += 1) step(driver)
      expect(driver.state.depthMm).toBe(depth)
      expect(new ScopePilot(driver).goals(act.goals)).toEqual(unmet)
    },
  )

  it('comes back to the waiting place when withdrawn out of a branch, with both openings in view', () => {
    const driver = atTheCarina()
    const stand = forkAhead(driver).standMm
    const depthAtTheWait = driver.state.depthMm
    centre(driver, scopeCase.originEdge.get('RMSB')!)
    step(driver)
    expect(driver.state.location.label).toBe('RMSB')
    // One ordinary step back is enough: the scope returns to where both openings are in the
    // picture, not to the ridge between them.
    const before = driver.state
    driver.send({ type: 'advance', mm: -before.inputs.stepMm })
    expect(driver.state.location.label).toBe('TR')
    expect(driver.state.engine!.distanceMm).toBeCloseTo(stand, 6)
    expect(driver.state.depthMm).toBeCloseTo(depthAtTheWait, 6)
    expect(inViewLabels(driver)).toEqual(['LMSB', 'RMSB'])
    expect(driver.state.events.slice(before.events.length)).toEqual(
      expect.arrayContaining(['withdrawn', 'withdrew-to:TR', 'returned-to-trachea']),
    )
    expect(driver.state.events.slice(before.events.length)).not.toContain('aim-refused')
    // From there the choice is open again: straight on waits, and the other side is one advance.
    step(driver)
    expect(driver.state.location.label).toBe('TR')
    expect(driver.state.message).toBe(SCOPE_MESSAGES.aimRefused)
    centre(driver, scopeCase.originEdge.get('LMSB')!)
    step(driver)
    expect(driver.state.location.label).toBe('LMSB')
    // A long withdrawal from deeper in ends at the same place: that movement goes no further.
    step(driver)
    step(driver)
    expect(driver.state.engine!.distanceMm).toBeGreaterThan(FORK_CARRY_MM + 3)
    driver.send({ type: 'advance', mm: -60 })
    expect(driver.state.location.label).toBe('TR')
    expect(driver.state.engine!.distanceMm).toBeCloseTo(stand, 6)
    expect(inViewLabels(driver)).toEqual(['LMSB', 'RMSB'])
  })

  it('says which messages mean the scope is waiting at a fork', () => {
    expect(isForkWaitMessage(SCOPE_MESSAGES.forkAhead)).toBe(true)
    expect(isForkWaitMessage(SCOPE_MESSAGES.aimRefused)).toBe(true)
    for (const other of [
      null,
      '',
      SCOPE_MESSAGES.tipStraightened,
      SCOPE_MESSAGES.lumenEnd,
      SCOPE_MESSAGES.wallFromBend,
    ])
      expect(isForkWaitMessage(other)).toBe(false)
    // The two are different sentences: one says choose, the other says the way on is chosen.
    expect(SCOPE_MESSAGES.forkAhead).not.toBe(SCOPE_MESSAGES.aimRefused)
    expect(SCOPE_MESSAGES.forkAhead).toMatch(/^A fork\. Advance again/)
  })

  it('applies the wait only where the aim guard is on', () => {
    // Without the guard the straight tip is carried on through the fork, as before.
    const driver = new ScopeDriver(
      walkView('TR', 'distal', { assists: { 'centerline-lock': true, 'aim-guard': false } }),
    )
    for (let i = 0; i < 12 && driver.state.location.label === 'TR'; i += 1) step(driver)
    expect(driver.state.location.label).not.toBe('TR')
    expect(driver.state.events).not.toContain('aim-refused')
    expect(driver.state.message).toBeNull()
  })

  it('registers no wall contact and no lost view for a bent tip, in any airway', () => {
    let advanced = 0
    let proxyWouldHaveStopped = 0
    for (const label of AIRWAY_LABELS)
      for (const at of ['proximal', 'mid', 'distal'] as const)
        for (const rotationDeg of [0, 90, 180, -90])
          for (const deflectionDeg of [40, -40]) {
            const driver = new ScopeDriver(walkView(label, at))
            driver.send({ type: 'set-rotation', deg: rotationDeg })
            driver.send({ type: 'set-deflection', deg: deflectionDeg })
            // The proxy unaided travel still uses: where it reads a wall, guided travel goes on.
            if (
              aimsAtWall(driver.state.engine!, driver.state.inputs, {
                view: driver.view,
                scopeCase,
              })
            )
              proxyWouldHaveStopped += 1
            for (let i = 0; i < 4; i += 1) driver.send({ type: 'advance', mm: 3 })
            const { events, signals } = driver.state
            const where = { label, at, rotationDeg, deflectionDeg }
            expect({ ...where, contact: events.includes('wall-contact') }).toEqual({
              ...where,
              contact: false,
            })
            expect(events).not.toContain('red-out')
            expect(events).not.toContain('advanced-blind')
            expect(signals.view).toBe('clear')
            expect(signals.contactCount).toBe(0)
            expect(signals.lossOfViewCount).toBe(0)
            if (events.includes('advanced')) advanced += 1
          }
    // The sample is not vacuous: most of these moved, and many would once have been stopped.
    expect(advanced).toBeGreaterThan(400)
    expect(proxyWouldHaveStopped).toBeGreaterThan(200)
  })

  it('carries a bent tip along a segment the old proxy stopped it in', () => {
    // RB9: a narrow segment, started well short of where the scope waits before its own fork.
    const driver = new ScopeDriver(walkView('RB9', 'proximal'))
    expect(shortOfFork(driver)).toBeGreaterThan(FORK_STANDOFF_MM + 3)
    driver.send({ type: 'set-deflection', deg: 40 })
    expect(
      aimsAtWall(driver.state.engine!, driver.state.inputs, { view: driver.view, scopeCase }),
    ).toBe(true)
    const depth = driver.state.depthMm
    driver.send({ type: 'advance', mm: 3 })
    expect(driver.state.depthMm).toBeCloseTo(depth + 3, 6)
    expect(driver.state.events).toEqual([
      'control-used:deflection',
      'control-used:insertion',
      'advanced',
    ])
    expect(driver.state.message).toBeNull()
    // Inside one airway the bend is the learner's: nothing straightens it.
    expect(driver.state.inputs.deflectionDeg).toBe(40)
  })

  it('still registers the bent tip against the wall under unaided travel without a lumen', () => {
    const driver = new ScopeDriver(unaidedView('RB9', 'proximal'))
    driver.send({ type: 'set-deflection', deg: 40 })
    const depth = driver.state.depthMm
    driver.send({ type: 'advance', mm: 3 })
    expect(driver.state.depthMm).toBe(depth)
    expect(driver.state.events).toEqual([
      'control-used:deflection',
      'control-used:insertion',
      'wall-contact',
      'red-out',
    ])
    expect(driver.state.message).toBe(SCOPE_MESSAGES.wallFromBend)
    expect(driver.state.signals.view).toBe('red-out')
    expect(driver.state.signals.contactCount).toBe(1)
    expect(driver.state.inputs.deflectionDeg).toBe(40)
  })

  it('returns the tip to neutral once through a fork, as the engine’s act and not the learner’s', () => {
    const driver = atTheCarina()
    centre(driver, scopeCase.originEdge.get('RMSB')!, 0.5)
    const before = driver.state
    expect(before.inputs.deflectionDeg).toBeGreaterThan(10)
    step(driver)
    expect(driver.state.location.label).toBe('RMSB')
    expect(driver.state.inputs.deflectionDeg).toBe(0)
    // Rotation is left where the learner put it; only the bend is let go.
    expect(driver.state.inputs.rotationDeg).toBe(before.inputs.rotationDeg)
    expect(driver.state.message).toBe(SCOPE_MESSAGES.tipStraightened)
    // The learner did not move the lever, so the record does not say they did.
    expect(count(driver.state.events, 'control-used:deflection')).toBe(
      count(before.events, 'control-used:deflection'),
    )
    expect(driver.state.events.slice(before.events.length)).toEqual(
      expect.arrayContaining(['control-used:insertion', 'advanced', 'entered:RMSB']),
    )
    // A bend put on away from any fork is the learner's to keep as the tip travels.
    const along = new ScopeDriver(walkView('TR', 'proximal'))
    along.send({ type: 'set-deflection', deg: 20 })
    step(along)
    expect(along.state.inputs.deflectionDeg).toBe(20)
    expect(along.state.message).toBeNull()
  })

  it('keeps the bend on the way back through a fork', () => {
    const driver = new ScopeDriver(walkView('RMSB', 'proximal'))
    driver.send({ type: 'set-deflection', deg: 10 })
    for (let i = 0; i < 6 && driver.state.location.label !== 'TR'; i += 1)
      driver.send({ type: 'advance', mm: -driver.state.inputs.stepMm })
    expect(driver.state.events).toContain('returned-to-trachea')
    expect(driver.state.inputs.deflectionDeg).toBe(10)
    expect(driver.state.message).toBeNull()
    // Back at the waiting place, with that bend still on.
    expect(driver.state.engine!.distanceMm).toBeCloseTo(forkAhead(driver).standMm, 6)
  })

  it('says both of its new lines in the course’s own register', () => {
    expect(SCOPE_MESSAGES.aimRefused).toMatch(/Bend the tip toward the one you want/)
    expect(SCOPE_MESSAGES.aimRefused).not.toMatch(/aim guard|will not choose/i)
    for (const text of [
      SCOPE_MESSAGES.aimRefused,
      SCOPE_MESSAGES.forkAhead,
      SCOPE_MESSAGES.tipStraightened,
    ])
      expect(bronchLearnerCopyErrors('engine copy', text)).toEqual([])
  })
})

describe('“Show me where”, followed to the letter', () => {
  /**
   * Do what the help says for the first goal not yet met, one input at a time. The help says to
   * advance only where the engine would take the tip on, so an advance it asked for that leaves
   * the tip on the same stretch, refused, is the help being wrong, and fails the drive. A refusal
   * recorded by the advance that has just carried the tip into a new airway is that airway's own
   * fork asking for the next choice.
   */
  function followHelp(
    driver: ScopeDriver,
    goals: readonly ScopeGoal[],
    turnDeg: number,
    bendDeg: number,
  ) {
    for (let moves = 0; ; moves += 1) {
      const unmet = scopeGoalStatuses(goals, driver.state).find((status) => !status.met)
      if (!unmet) return driver
      const edgeBefore = driver.state.engine?.edgeId
      const refusalsBefore = count(driver.state.events, 'aim-refused')
      const help = goalHelp(unmet.goal.test, driver.state, driver.view, scopeCase)
      if (moves >= 400 || !help?.control)
        throw new Error(
          `The help does not lead to ${unmet.goal.id} from ${driver.state.location.label} (edge ${driver.state.engine?.edgeId}), turning ${turnDeg}° and bending ${bendDeg}° at a time: ${help?.sentence ?? 'no advice'}`,
        )
      const stepMm = driver.state.inputs.stepMm
      switch (help.control) {
        case 'rotate':
          driver.send({
            type: 'rotate',
            deg: /counterclockwise/.test(help.sentence) ? -turnDeg : turnDeg,
          })
          break
        case 'deflect':
          driver.send({ type: 'deflect', deg: /toward U/.test(help.sentence) ? bendDeg : -bendDeg })
          break
        case 'advance':
          driver.send({ type: 'advance', mm: stepMm })
          break
        case 'withdraw':
          driver.send({ type: 'advance', mm: -stepMm })
          break
        default:
          throw new Error(`The help names a control this drive does not use: ${help.control}`)
      }
      if (
        count(driver.state.events, 'aim-refused') > refusalsBefore &&
        driver.state.engine?.edgeId === edgeBefore
      )
        throw new Error(
          `The help said "${help.sentence}" and the advance was refused where the tip was, in ${driver.state.location.label} (edge ${edgeBefore})`,
        )
    }
  }

  /** A single key press, a held key's fine turn, and the slider's one degree. */
  const INPUT_SIZES = [
    [5, 5],
    [HELD_TURN_DEG, HELD_TURN_DEG],
    [1, 1],
  ] as const

  const enter = (label: AirwayLabel): readonly ScopeGoal[] => [
    {
      id: `enter-${label}`,
      label: `Enter ${label}`,
      test: { type: 'event', event: `entered:${label}` },
    },
  ]

  it.each([
    ['the carina task', scopeLab(larynxAndEntry.moreActs?.carina)],
    ['the right lung task', scopeLab(rightSide.act)],
    ['the left lung task', scopeLab(leftSide.act)],
  ] as const)('completes %s, whatever the size of each input', (_task, act) => {
    for (const [turnDeg, bendDeg] of INPUT_SIZES) {
      const driver = followHelp(new ScopeDriver(act.view), act.goals, turnDeg, bendDeg)
      expect(new ScopePilot(driver).goals(act.goals)).toEqual(allMet(act.goals))
      // No advance the help asked for was refused where the tip was (`followHelp`), and a learner
      // who follows it never meets a wall.
      expect(driver.state.events).not.toContain('wall-contact')
    }
  })

  // Openings that lie beyond a connecting stretch with no name of its own (RB1, RB7, RB10, LB9),
  // and one that is almost straight ahead of its fork (LB5): the help once said "Deflect" for
  // ever at each of these.
  it.each(['RB1', 'RB7', 'RB10', 'LB9', 'LB5'] as const)(
    'reaches %s from above the carina, through every fork on the way',
    (label) => {
      for (const [turnDeg, bendDeg] of INPUT_SIZES) {
        const driver = followHelp(
          new ScopeDriver(walkView('TR', 'distal')),
          enter(label),
          turnDeg,
          bendDeg,
        )
        expect(driver.state.location.label).toBe(label)
      }
    },
  )

  it('reaches LB5 when it is asked for straight after the lingular division is entered', () => {
    for (const [turnDeg, bendDeg] of INPUT_SIZES) {
      const driver = onEdge(scopeCase.originEdge.get('LB4+5')!)
      expect(driver.state.location.label).toBe('LB4+5')
      followHelp(driver, enter('LB5'), turnDeg, bendDeg)
      expect(driver.state.location.label).toBe('LB5')
    }
  })

  it('reaches every airway of the model from above the carina', () => {
    for (const label of AIRWAY_LABELS) {
      if (label === 'TR') continue
      const driver = followHelp(
        new ScopeDriver(walkView('TR', 'distal')),
        enter(label),
        HELD_TURN_DEG,
        HELD_TURN_DEG,
      )
      expect(driver.state.location.label).toBe(label)
    }
  }, 30_000)

  it('says to advance once the opening that leads on is the one the picture has chosen', () => {
    // RB1 lies beyond the upper lobe's connecting stretch: from the lobar bronchus the help asks
    // for the opening that leads toward it, and stops asking once that opening is chosen.
    const driver = onEdge(scopeCase.originEdge.get('RUL')!)
    const lead = scopeCase.index.nodesById.get(
      scopeCase.index.edgesById.get(scopeCase.originEdge.get('RB1')!)!.startNodeId,
    )!.parentEdgeId!
    expect(scopeCase.labelAt(lead)).toBe('RUL')
    centre(driver, lead)
    expect(forkAhead(driver).chosenEdgeId).toBe(lead)
    const help = goalHelp(enter('RB1')[0].test, driver.state, driver.view, scopeCase)
    expect(help?.control).toBe('advance')
    expect(help?.sentence).toMatch(/^Advance: the tip is pointed the way to /)
  })
})

describe('a wrong turn on the left is retraced, not penalised', () => {
  const act = scopeLab(leftSide.act)
  const goal = (id: string) => act.goals.find((candidate) => candidate.id === id)!

  it('carries no "without" on the lingula and superior segment goals', () => {
    expect(withoutTests(goal('lingular-division').test)).toEqual([])
    expect(withoutTests(goal('superior-segment').test)).toEqual([])
    for (const id of ['lingular-division', 'superior-segment'])
      expect(goal(id).label).not.toMatch(/without/i)
  })

  it('meets every goal after the upper division and a basal segment were entered by mistake', () => {
    const p = pilot(act.view)
    p.goInto('LUL-UD')
    p.withdrawTo('LUL')
    p.goInto('LB4+5')
    expect(p.goals(act.goals)['lingular-division']).toBe(true)
    p.goInto('LB4')
    p.withdrawTo('LB4+5')
    p.goInto('LB5')
    p.withdrawTo('LMSB')
    p.goInto('LB10')
    p.withdrawTo('LMSB')
    p.goInto('LB6')
    expect(p.state.events).toEqual(expect.arrayContaining(['entered:LUL-UD', 'entered:LB10']))
    expect(p.goals(act.goals)).toEqual(allMet(act.goals))
  })
})

describe('the right lung task opens on the view that finds the middle lobe', () => {
  const act = scopeLab(rightSide.act)

  it('starts back in the bronchus intermedius, turned, with both openings in view', () => {
    expect(act.view.start).toEqual({ kind: 'airway', label: 'BI', at: 'mid' })
    const { state } = new ScopeDriver(act.view)
    expect(state.location.label).toBe('BI')
    expect(state.inputs.rotationDeg).toBe(44)
    expect(state.inputs.deflectionDeg).toBe(-3)
    expect(state.inputs.branchLabels).toBe(false)
    expect(
      state.ostia
        .filter((pin) => pin.inView)
        .map((pin) => pin.label)
        .sort(),
    ).toEqual(['RLL', 'RML'])
    // The opening view is the task's start, not work the learner has done.
    expect(state.events.filter((event) => event.startsWith('control-used:'))).toEqual([])
    expect(new ScopePilot(new ScopeDriver(act.view)).goals(act.goals)).toEqual(
      Object.fromEntries(act.goals.map((goal) => [goal.id, false])),
    )
  })

  it('puts the middle lobe above the lower lobe in that image', () => {
    const { state } = new ScopeDriver(act.view)
    const pins = Object.fromEntries(projectScenePins(state).map((pin) => [pin.label, pin]))
    expect(pins.RML.topPct).toBeLessThan(pins.RLL.topPct)
    expect(pins.RML.topPct).toBeLessThan(50)
  })

  it('recenters to that opening view, not to a neutral tip', () => {
    const driver = new ScopeDriver(act.view)
    driver.send({ type: 'rotate', deg: 30 })
    driver.send({ type: 'deflect', deg: 20 })
    expect(driver.state.inputs).toMatchObject({ rotationDeg: 74, deflectionDeg: 17 })
    driver.send({ type: 'assist', assist: 'recenter' })
    expect(driver.state.inputs).toMatchObject({ rotationDeg: 44, deflectionDeg: -3 })
    expect(driver.state.events.at(-1)).toBe('assist:recenter')
    expect(driver.state.assistsUsed).toContain('recenter')
  })

  it('still recenters to neutral on a view that authors no start', () => {
    const driver = new ScopeDriver(walkView('BI', 'mid'))
    driver.send({ type: 'rotate', deg: 30 })
    driver.send({ type: 'deflect', deg: 20 })
    driver.send({ type: 'assist', assist: 'recenter' })
    expect(driver.state.inputs).toMatchObject({ rotationDeg: 0, deflectionDeg: 0 })
  })
})

describe('opening names are drawn inside the lumen', () => {
  /** Where a point falls along an edge's centerline, and how far off it. */
  function alongEdge(points: readonly Vec3[], point: Vec3) {
    let offMm = Number.POSITIVE_INFINITY
    let atMm = 0
    let travelled = 0
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1]
      const b = points[i]
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
      const length = Math.hypot(ab[0], ab[1], ab[2])
      const t =
        length > 0
          ? Math.max(
              0,
              Math.min(
                1,
                ((point[0] - a[0]) * ab[0] +
                  (point[1] - a[1]) * ab[1] +
                  (point[2] - a[2]) * ab[2]) /
                  length ** 2,
              ),
            )
          : 0
      const off = Math.hypot(
        point[0] - a[0] - ab[0] * t,
        point[1] - a[1] - ab[1] * t,
        point[2] - a[2] - ab[2] * t,
      )
      if (off < offMm) {
        offMm = off
        atMm = travelled + length * t
      }
      travelled += length
    }
    return { offMm, atMm }
  }

  it('gives every airway a name point on its own first segment, further in than its opening', () => {
    expect([...scopeCase.labelPoint.keys()].sort()).toEqual([...AIRWAY_LABELS].sort())
    for (const label of AIRWAY_LABELS) {
      const edge = scopeCase.index.edgesById.get(scopeCase.originEdge.get(label)!)!
      const name = alongEdge(edge.pointsLps, scopeCase.labelPoint.get(label)!)
      const opening = alongEdge(edge.pointsLps, scopeCase.ostiumPoint.get(label)!)
      expect({ label, onCenterline: name.offMm < 1e-6 }).toEqual({ label, onCenterline: true })
      expect({ label, furtherIn: name.atMm > opening.atMm + 1 }).toEqual({ label, furtherIn: true })
      // Inside the segment, never at or past its far end.
      expect({ label, inside: name.atMm < edge.lengthMm * 0.75 }).toEqual({ label, inside: true })
      expect(scopeCase.labelPoint.get(label)).not.toEqual(scopeCase.ostiumPoint.get(label))
    }
  })

  it('hands each opening its name point, and leaves what is in view to the opening itself', () => {
    for (const label of AIRWAY_LABELS) {
      const { state } = new ScopeDriver(walkView(label, 'distal'))
      for (const pin of state.ostia) {
        expect(pin.labelPointLps).toEqual(scopeCase.labelPoint.get(pin.label))
        expect(pin.pointLps).toEqual(scopeCase.ostiumPoint.get(pin.label))
      }
    }
  })

  /** How far apart two projected points are, in units of the image's half-height. */
  const apart = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot((a.x - b.x) * OPTICAL_ASPECT, a.y - b.y)

  it.each([
    ['the right lung task’s start', scopeLab(rightSide.act).view, 'RML', 'RLL'],
    ['above the main carina', walkView('TR', 'distal'), 'RMSB', 'LMSB'],
  ] as const)('spreads the two names apart from %s', (_where, view, first, second) => {
    const { state } = new ScopeDriver(view)
    const frame = scopeOpticalFrame(state.pose!)
    const pin = (label: AirwayLabel) => state.ostia.find((candidate) => candidate.label === label)!
    const name = (label: AirwayLabel) => projectPinLabel(pin(label), frame)!
    const opening = (label: AirwayLabel) =>
      projectOptical(pin(label).pointLps, frame, OPTICAL_ASPECT, OPTICAL_FOV_DEG)!
    expect(pin(first).inView && pin(second).inView).toBe(true)
    expect(apart(name(first), name(second))).toBeGreaterThan(
      1.5 * apart(opening(first), opening(second)),
    )
    // The scene draws each name where `projectPinLabel` puts it.
    for (const drawn of projectScenePins(state)) {
      const at = name(drawn.label)
      expect(drawn.leftPct).toBeCloseTo((0.5 + at.x / 2) * 100, 8)
      expect(drawn.topPct).toBeCloseTo((0.5 - at.y / 2) * 100, 8)
    }
  })

  it('steps a name back toward its opening rather than let it leave the round field', () => {
    const radius = (at: { x: number; y: number }) => Math.hypot(at.x * OPTICAL_ASPECT, at.y)
    const same = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y) < 1e-9
    let atItsPoint = 0
    let steppedBack = 0
    // Above the carina, straight and then turned and bent to every side.
    for (const rotationDeg of [-180, -90, -35, 0, 35, 90, 180])
      for (const deflectionDeg of [-25, -15, 0, 15, 25]) {
        const driver = new ScopeDriver(walkView('TR', 'distal'))
        driver.send({ type: 'set-rotation', deg: rotationDeg })
        driver.send({ type: 'set-deflection', deg: deflectionDeg })
        const frame = scopeOpticalFrame(driver.state.pose!)
        for (const pin of driver.state.ostia.filter((candidate) => candidate.inView)) {
          const name = projectPinLabel(pin, frame)!
          const opening = projectOptical(pin.pointLps, frame, OPTICAL_ASPECT, OPTICAL_FOV_DEG)!
          const inside = projectOptical(pin.labelPointLps!, frame, OPTICAL_ASPECT, OPTICAL_FOV_DEG)
          // A name that has left its opening is inside the field, where it can be read whole.
          if (!same(name, opening)) expect(radius(name)).toBeLessThan(1)
          if (!inside) continue
          // It lies on the image of the line from the opening into the airway, never beside it.
          const along = { x: inside.x - opening.x, y: inside.y - opening.y }
          const share =
            ((name.x - opening.x) * along.x + (name.y - opening.y) * along.y) /
            (along.x ** 2 + along.y ** 2)
          expect(share).toBeGreaterThan(-1e-9)
          expect(share).toBeLessThan(1 + 1e-9)
          expect(opening.x + along.x * share).toBeCloseTo(name.x, 8)
          expect(opening.y + along.y * share).toBeCloseTo(name.y, 8)
          // Deepest first: the airway's own point where the field holds it comfortably.
          if (radius(inside) < 0.5) {
            expect(same(name, inside)).toBe(true)
            atItsPoint += 1
          }
          // And never out past the rim: there the name has come back toward the opening.
          if (radius(inside) >= 1) {
            expect(same(name, inside)).toBe(false)
            steppedBack += 1
          }
        }
      }
    expect(atItsPoint).toBeGreaterThan(5)
    expect(steppedBack).toBeGreaterThan(5)
  })

  it('names an opening where it is when it has no point inside the airway', () => {
    const { state } = new ScopeDriver(walkView('TR', 'distal'))
    const frame = scopeOpticalFrame(state.pose!)
    for (const pin of state.ostia)
      expect(projectPinLabel({ ...pin, labelPointLps: undefined }, frame)).toEqual(
        projectOptical(pin.pointLps, frame, OPTICAL_ASPECT, OPTICAL_FOV_DEG),
      )
  })
})

describe('the right main bronchus is first shown from the trachea', () => {
  it('uses the course’s own frame, with an outline, for the right main bronchus only', () => {
    const still = courseStill('rmb')
    expect(still).not.toBeNull()
    expect(still!.src).toBe('/bronchoscopy-foundations/find-frames/right-main-origin.jpg')
    expect(still!.sourceFrame).toBe(562)
    expect(still!.width).toBeGreaterThan(0)
    expect(still!.height).toBeGreaterThan(0)
    // A closed outline: at least three points, as x, y pairs inside the frame.
    expect(still!.outline.length).toBeGreaterThanOrEqual(6)
    expect(still!.outline.length % 2).toBe(0)
    still!.outline.forEach((value, index) => {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(index % 2 === 0 ? still!.width : still!.height)
    })
    expect(courseStill('lmb')).toBeNull()
  })

  it('ships that frame, and the frame still shows the left main opening beside it', () => {
    const still = courseStill('rmb')!
    const file = path.join(process.cwd(), 'public', still.src)
    expect(fs.existsSync(file)).toBe(true)
    expect(fs.statSync(file).size).toBeGreaterThan(1000)
    const frame = findFrame('right-main-origin')
    expect(frame.src).toBe(still.src)
    expect(frame.markers.map((marker) => marker.id)).toEqual(['rmb', 'lmb'])
    expect(frame.markers.find((marker) => marker.id === 'rmb')!.points).toEqual(still.outline)
  })
})

describe('a held movement control glides', () => {
  it('keeps the direction of the press and sends the fine increment', () => {
    expect(heldKeyCommand({ type: 'advance', mm: 3 })).toEqual({
      type: 'advance',
      mm: HELD_STEP_MM,
    })
    expect(heldKeyCommand({ type: 'advance', mm: -3 })).toEqual({
      type: 'advance',
      mm: -HELD_STEP_MM,
    })
    expect(heldKeyCommand({ type: 'rotate', deg: 5 })).toEqual({
      type: 'rotate',
      deg: HELD_TURN_DEG,
    })
    expect(heldKeyCommand({ type: 'rotate', deg: -5 })).toEqual({
      type: 'rotate',
      deg: -HELD_TURN_DEG,
    })
    expect(heldKeyCommand({ type: 'deflect', deg: 5 })).toEqual({
      type: 'deflect',
      deg: HELD_TURN_DEG,
    })
    expect(heldKeyCommand({ type: 'deflect', deg: -5 })).toEqual({
      type: 'deflect',
      deg: -HELD_TURN_DEG,
    })
  })

  it('is finer than a press for every movement key, and the same command otherwise', () => {
    const { state } = new ScopeDriver(walkView('TR', 'mid'))
    expect(HELD_STEP_MM).toBeLessThan(DEFAULT_STEP_MM)
    for (const key of ['w', 's', 'a', 'd', 'ArrowUp', 'ArrowDown']) {
      const press = scopeKeyCommand(key, state)!
      const held = heldKeyCommand(press)
      expect(held.type).toBe(press.type)
      const size = (command: typeof press) =>
        command.type === 'advance'
          ? command.mm
          : command.type === 'rotate' || command.type === 'deflect'
            ? command.deg
            : Number.NaN
      expect(Math.sign(size(held))).toBe(Math.sign(size(press)))
      expect(Math.abs(size(held))).toBeLessThan(Math.abs(size(press)))
    }
    // Nothing but movement is changed by a hold.
    const capture = { type: 'capture' } as const
    expect(heldKeyCommand(capture)).toBe(capture)
    const recenter = scopeKeyCommand('r', state)!
    expect(heldKeyCommand(recenter)).toBe(recenter)
  })

  it('travels as far in fine increments as the same distance in one press', () => {
    const press = new ScopeDriver(walkView('TR', 'proximal'))
    press.send({ type: 'advance', mm: DEFAULT_STEP_MM })
    const glide = new ScopeDriver(walkView('TR', 'proximal'))
    for (let mm = 0; mm < DEFAULT_STEP_MM; mm += HELD_STEP_MM)
      glide.send(heldKeyCommand({ type: 'advance', mm: DEFAULT_STEP_MM }))
    expect(glide.state.depthMm).toBeCloseTo(press.state.depthMm, 6)
    expect(glide.state.location).toEqual(press.state.location)
  })
})

describe('the goal card in plain words', () => {
  it('names the list, the next goal and the finished card without the claim wording', () => {
    expect(PLAIN_GOALS_HEADING).toBe('Goals for this task')
    expect(PLAIN_GOALS_DONE_HEADING).toBe('Goals met')
    expect(PLAIN_NEXT_GOAL_HEADING).toBe('Your next goal')
    expect(PLAIN_DONE_LEAD).toBe('All the goals for this task are met.')
    for (const claim of ['history', 'current', 'mixed'] as const) {
      expect(goalListHeading(claim, false, true)).toBe(PLAIN_GOALS_HEADING)
      expect(goalListHeading(claim, true, true)).toBe(PLAIN_GOALS_DONE_HEADING)
      expect(scopeDoneLead(claim, true)).toBe(PLAIN_DONE_LEAD)
    }
    expect(goalListHeading('mixed', true, true)).toBe('Goals met')
    expect(scopeDoneLead('history', true)).toBe('All the goals for this task are met.')
  })

  it('says nothing about the view, and passes the course’s copy gate', () => {
    for (const text of [
      PLAIN_GOALS_HEADING,
      PLAIN_GOALS_DONE_HEADING,
      PLAIN_NEXT_GOAL_HEADING,
      PLAIN_DONE_LEAD,
    ]) {
      expect(text).not.toMatch(/\b(?:view|image|lumen|clear|usable)\b/i)
      expect(bronchLearnerCopyErrors('goal card', text)).toEqual([])
    }
  })

  it('leaves the card outside a rewritten section exactly as it was', () => {
    for (const claim of ['history', 'current', 'mixed'] as const) {
      expect(goalListHeading(claim, false)).toBe(GOAL_PENDING_HEADING)
      expect(goalListHeading(claim, false, false)).toBe(GOAL_PENDING_HEADING)
      expect(goalListHeading(claim, true)).toBe(GOAL_GROUP_HEADING[claim])
      expect(scopeDoneLead(claim)).toBe(scopeDoneLead(claim, false))
      expect(scopeDoneLead(claim)).not.toBe(PLAIN_DONE_LEAD)
    }
    expect(GOAL_PENDING_HEADING).toBe('What this card is waiting for')
    expect(scopeDoneLead('history')).toBe('Recorded: every step this card asks for.')
    expect(scopeDoneLead('mixed')).toBe(
      'Recorded: every step this card asks for, and its live readings hold.',
    )
  })

  it('is the card every section now shows: each one is a rewritten section', () => {
    for (const id of BRONCH_SECTION_IDS)
      expect({ id, contract: bronchStageLesson(id).section.authoringContract }).toEqual({
        id,
        contract: 2,
      })
  })
})

describe('the survey is recorded by naming each segment from inside it', () => {
  const act = scopeLab(systematicSurvey.act)
  const inside = (label: AirwayLabel) => {
    const p = pilot(act.view)
    p.goInto(label)
    return p
  }
  /** Every line a pane prints the location through. */
  const locationLines = (p: ScopePilot) => [
    p.state.location.fullLabel,
    scopeLocationCaption(p.state),
    scopeNowLine(p.state),
    formatScopeMetric('currentAirway', p.state),
  ]

  it('opens with eighteen segments to name and nothing withheld outside them', () => {
    expect(act.view.ledger).toEqual({ expected: 'segmental', naming: true })
    expect(act.goals.map((goal) => goal.id)).toEqual(['right-lung-named', 'left-lung-named'])
    const { state } = new ScopeDriver(act.view)
    expect(unnamedAirways(state.ledger)).toEqual([...SEGMENTAL_AIRWAY_LABELS])
    expect(namingSubject(act.view, state)).toBeNull()
    expect(state.location.fullLabel).toBe(airwayDisplayName('TR'))
    // A lobar bronchus is not on the record, so it is named as usual on the way in.
    const p = pilot(act.view)
    p.goInto('RUL')
    expect(namingSubject(act.view, p.state)).toBeNull()
    expect(p.state.location.fullLabel).toBe(airwayDisplayName('RUL'))
  })

  it('withholds the name of the segment the tip is inside until the learner has given it', () => {
    const p = inside('RB1')
    // The model knows where the tip is; what it prints is the question.
    expect(p.state.location.label).toBe('RB1')
    expect(namingSubject(act.view, p.state)).toBe('RB1')
    expect(p.state.location.fullLabel).toBe(UNNAMED_AIRWAY_WORDS)
    for (const line of locationLines(p)) {
      expect(line).toContain(UNNAMED_AIRWAY_WORDS)
      expect(line).not.toContain(airwayDisplayName('RB1'))
      expect(line).not.toMatch(/\bRB1\b/)
    }
    expect(bronchLearnerCopyErrors('naming record', UNNAMED_AIRWAY_WORDS)).toEqual([])
    // Driving on inside the segment does not give it away either.
    p.goDeep('RB1')
    expect(p.state.location.fullLabel).toBe(UNNAMED_AIRWAY_WORDS)
    expect(p.state.message ?? '').not.toMatch(/\bRB1\b/)
  })

  it('leaves the record as it was on a wrong name, and records that it was wrong', () => {
    const p = inside('RB1')
    const before = p.state
    p.send({ type: 'name', airway: 'RB2' })
    expect(p.state.ledger).toEqual(before.ledger)
    expect(p.state.events.slice(before.events.length)).toEqual(['misnamed'])
    expect(p.state.message).toBe(SCOPE_MESSAGES.misnamed)
    // Neither segment is named by it, the question stays open and the answer stays withheld.
    expect(p.state.ledger.RB1!.identified).toBe(false)
    expect(p.state.ledger.RB2!.identified).toBe(false)
    expect(unnamedAirways(p.state.ledger)).toEqual([...SEGMENTAL_AIRWAY_LABELS])
    expect(namingSubject(act.view, p.state)).toBe('RB1')
    expect(p.state.location.fullLabel).toBe(UNNAMED_AIRWAY_WORDS)
    expect(SCOPE_MESSAGES.misnamed).not.toMatch(/\b[RL]B\d/)
    expect(p.goals(act.goals)).toEqual({ 'right-lung-named': false, 'left-lung-named': false })
  })

  it('records the right name: identified, off the list, and called by its name again', () => {
    const p = inside('RB1')
    const before = p.state
    p.send({ type: 'name', airway: 'RB1' })
    expect(p.state.ledger.RB1).toEqual({ ...before.ledger.RB1!, identified: true })
    expect(p.state.events.slice(before.events.length)).toEqual(['declared:RB1:identified'])
    expect(p.state.message).toBe(SCOPE_MESSAGES.named(airwayDisplayName('RB1')))
    expect(unnamedAirways(p.state.ledger)).toEqual(
      SEGMENTAL_AIRWAY_LABELS.filter((label) => label !== 'RB1'),
    )
    expect(namingSubject(act.view, p.state)).toBeNull()
    for (const line of locationLines(p)) {
      expect(line).toContain(airwayDisplayName('RB1'))
      expect(line).not.toContain(UNNAMED_AIRWAY_WORDS)
    }
    expect(scopeGoalTestMet({ type: 'ledger', airway: 'RB1', status: 'identified' }, p.state)).toBe(
      true,
    )
    // The name is all that was recorded: naming a segment does not say it was examined.
    expect(p.state.ledger.RB1!.inspected).toBe('no')
    expect(p.state.ledger.RB1!.limitation).toBeNull()
    // And it is kept once the scope has left.
    p.withdrawTo('RUL')
    expect(p.state.ledger.RB1!.identified).toBe(true)
    p.goInto('RB1')
    expect(p.state.location.fullLabel).toBe(airwayDisplayName('RB1'))
  })

  it('refuses a name where there is no unnamed segment to give it to', () => {
    // Outside a segment: in the lobar bronchus, with its three segments ahead.
    const outside = pilot(act.view)
    outside.goInto('RUL')
    // Inside a segment that already has its name.
    const named = inside('RB1')
    named.send({ type: 'name', airway: 'RB1' })
    for (const p of [outside, named]) {
      const before = p.state
      p.send({ type: 'name', airway: 'RB2' })
      expect(p.state.message).toBe(SCOPE_MESSAGES.nothingToName)
      expect(p.state.ledger).toEqual(before.ledger)
      expect(p.state.events.slice(before.events.length)).toEqual([])
    }
    // On a record that is not kept by naming, the command answers nothing either.
    const declared = pilot(
      walkView('RB6', 'mid', {
        controls: ['advance', 'withdraw', 'rotate', 'deflect', 'declare'],
        ledger: { expected: ['RB6'] },
      }),
    )
    expect(declared.state.location.fullLabel).toBe(airwayDisplayName('RB6'))
    declared.send({ type: 'name', airway: 'RB6' })
    expect(declared.state.message).toBe(SCOPE_MESSAGES.nothingToName)
    expect(declared.state.ledger.RB6!.identified).toBe(false)
    // And where the step offers no record control at all, it is a control not offered.
    const walk = pilot(walkView('RB6', 'mid'))
    walk.send({ type: 'name', airway: 'RB6' })
    expect(walk.state.message).toBe(SCOPE_MESSAGES.controlNotOffered)
  })

  it('meets the right lung’s goal at its tenth name and the left’s at the eighteenth', () => {
    const driver = new ScopeDriver(act.view)
    const progress: { right: boolean; left: boolean }[] = []
    // The recipe's own drive, with the goals read after every name it gives.
    const p = new ScopePilot({
      view: driver.view,
      scopeCase: driver.scopeCase,
      get state() {
        return driver.state
      },
      send(command: ScopeCommand) {
        driver.send(command)
        if (command.type !== 'name') return
        const met = new ScopePilot(driver).goals(act.goals)
        progress.push({ right: met['right-lung-named'], left: met['left-lung-named'] })
      },
    })
    SCOPE_RECIPES['systematic-survey']!.act(p)
    expect(progress).toHaveLength(SEGMENTAL_AIRWAY_LABELS.length)
    expect(progress.map((at) => at.right)).toEqual(progress.map((_, index) => index >= 9))
    expect(progress.map((at) => at.left)).toEqual(progress.map((_, index) => index === 17))
    expect(unnamedAirways(driver.state.ledger)).toEqual([])
    expect(driver.state.events).not.toContain('misnamed')
    expect(p.goals(act.goals)).toEqual(allMet(act.goals))
    // The record is complete when no name is left, and says so once, with the last name.
    expect(count(driver.state.events, 'survey-complete')).toBe(1)
    expect(driver.state.events.at(-1)).toBe('survey-complete')
    expect(driver.state.events.at(-2)).toBe('declared:LB10:identified')
  })

  it('refuses a naming view that would hand out the names, or has no way to answer', () => {
    expect(scopeViewErrors(act.view)).toEqual([])
    const errorsWith = (patch: Partial<ScopeViewSpec>) =>
      scopeViewErrors({ ...act.view, ...patch }).join(' ')
    expect(errorsWith({ controls: act.view.controls.filter((key) => key !== 'declare') })).toMatch(
      /naming record without the control that answers it/,
    )
    expect(errorsWith({ controls: [...act.view.controls, 'branchLabels'] })).toMatch(
      /offers opening names on a record that asks for them/,
    )
    expect(errorsWith({ assists: { ...act.view.assists, 'branch-labels': true } })).toMatch(
      /offers opening names on a record that asks for them/,
    )
    expect(errorsWith({ readouts: ['parentage'] })).toMatch(
      /prints the path to an airway its naming record asks the learner for/,
    )
  })
})

describe('where the operator stands turns the picture', () => {
  const turnOf = (id: (typeof OPERATOR_POSITIONS)[number]['id']) =>
    OPERATOR_POSITIONS.find((position) => position.id === id)!.turnDeg
  const landmark = (id: (typeof HEAD_OF_BED_LANDMARKS)[number]['id']) =>
    HEAD_OF_BED_LANDMARKS.find((entry) => entry.id === id)!.atDeg

  it.each([
    ['head', '6 o\u2019clock', '3 o\u2019clock'],
    ['facing', '12 o\u2019clock', '9 o\u2019clock'],
    ['bedside-right', '9 o\u2019clock', '6 o\u2019clock'],
    ['bedside-left', '3 o\u2019clock', '12 o\u2019clock'],
  ] as const)(
    '%s: the membranous wall at %s and the right main bronchus at %s',
    (position, wall, rightMain) => {
      expect(landmarkClock(landmark('membranous-wall'), turnOf(position))).toBe(wall)
      expect(landmarkClock(landmark('right-main'), turnOf(position))).toBe(rightMain)
    },
  )

  it('turns the picture by half a turn facing the patient and a quarter turn at the bedside', () => {
    expect(OPERATOR_POSITIONS.map((position) => [position.id, position.turnDeg])).toEqual([
      ['head', 0],
      ['facing', 180],
      ['bedside-right', 90],
      ['bedside-left', 270],
    ])
  })

  it('turns every landmark together: the picture is turned, never mirrored', () => {
    const hour = (deg: number) => Number.parseInt(clockWords(deg), 10) % 12
    for (const position of OPERATOR_POSITIONS) {
      const at = (id: (typeof HEAD_OF_BED_LANDMARKS)[number]['id']) =>
        hour(landmark(id) + position.turnDeg)
      // The two main bronchi stay opposite each other, the wall a quarter turn on from the right.
      expect((at('left-main') - at('right-main') + 12) % 12).toBe(6)
      expect((at('membranous-wall') - at('right-main') + 12) % 12).toBe(3)
      // The middle lobe opening and RB6 face each other across the bronchus intermedius.
      expect((at('right-superior') - at('middle-lobe') + 12) % 12).toBe(6)
    }
  })

  it('reads a direction as a clock hour, the top of the picture at twelve', () => {
    expect([0, 90, 180, 270, 360, 450, -90].map(clockWords)).toEqual([
      '12 o\u2019clock',
      '3 o\u2019clock',
      '6 o\u2019clock',
      '9 o\u2019clock',
      '12 o\u2019clock',
      '3 o\u2019clock',
      '9 o\u2019clock',
    ])
  })

  it('is on its own teaching screen, between the carina reading and the carina task', () => {
    const flow = COURSE_FLOWS['larynx-and-entry'] ?? []
    const ids = flow.map((chunk) => chunk.id)
    const screen = flow.find((chunk) => chunk.id === 'where-you-stand')
    expect(screen).toMatchObject({ kind: 'teach', visual: 'orientation-compass' })
    expect(screen!.blocks).toEqual(['where-you-stand'])
    expect(larynxAndEntry.blocks.map((block) => block.id)).toContain('where-you-stand')
    expect(ids.indexOf('trachea-and-carina')).toBeLessThan(ids.indexOf('where-you-stand'))
    expect(ids.indexOf('where-you-stand')).toBeLessThan(ids.indexOf('carina'))
  })
})

describe('the survey video opens on its own first frame', () => {
  it('ships the poster the player names', () => {
    // Rendered without a browser: the element and its attributes, with no effect run.
    const markup = renderToStaticMarkup(<SurveyVideo />)
    const poster = /<video[^>]*\sposter="([^"]+)"/.exec(markup)?.[1]
    expect(poster).toBe('/bronchoscopy-foundations/survey/opening-frame.jpg')
    const file = path.join(process.cwd(), 'public', poster!)
    expect(fs.existsSync(file)).toBe(true)
    expect(fs.statSync(file).size).toBeGreaterThan(1000)
  })
})
