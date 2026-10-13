import { ScopeFallback } from '../components/scope/ScopeFallback'
import { BenchSchematic } from '../components/scope/BenchSchematic'
import { render, cleanup } from '@testing-library/react'
import { BenchFluidView } from '../components/scope/BenchFluidView'
import { FIVE_CONTROLS_TASKS } from '../content/fiveControlsBench'
import { bronchStageLesson } from '../content/stageLessons'
import { createScopeState, reduceScope } from '../engine/scope/scopeReducer'
import { scopeGoalsMet } from '../engine/scope/scopeGoalEvaluation'
import { benchFluidObservation } from '../engine/scope/benchFluid'
import { handTypedDigitErrors } from '../content/numbers'
import { bronchStageReducer, emptyBronchStageSession } from '../engine/stageSession'

afterEach(cleanup)

test('the lesson removes identical repeats but retains a changed-target application', () => {
  const ids = bronchStageLesson('five-controls').steps.map((step) => step.learn?.id)
  for (const removed of ['depth-repeat', 'bend-repeat', 'suction-repeat'])
    expect(ids).not.toContain(removed)
  expect(ids).toEqual(
    expect.arrayContaining(['depth', 'bend', 'suction', 'rotation-repeat', 'transfer']),
  )
})

test('near-neutral movements complete while substantial residual movement does not', () => {
  const { view, goals } = FIVE_CONTROLS_TASKS.depth
  const ctx = { view, scopeCase: null }
  let state = createScopeState(view, null)
  expect(scopeGoalsMet(goals, state)).toBe(false)
  state = reduceScope(state, { type: 'advance', mm: 12 }, 'pointer', ctx)
  state = reduceScope(state, { type: 'advance', mm: -5 }, 'pointer', ctx)
  expect(scopeGoalsMet(goals, state)).toBe(false)
  state = reduceScope(state, { type: 'advance', mm: -4 }, 'pointer', ctx)
  expect(scopeGoalsMet(goals, state)).toBe(true)
  const bend = FIVE_CONTROLS_TASKS.bend
  let bent = createScopeState(bend.view, null)
  const bendCtx = { view: bend.view, scopeCase: null }
  bent = reduceScope(bent, { type: 'set-deflection', deg: 35 }, 'pointer', bendCtx)
  bent = reduceScope(bent, { type: 'set-deflection', deg: 12 }, 'pointer', bendCtx)
  expect(scopeGoalsMet(bend.goals, bent)).toBe(false)
  bent = reduceScope(bent, { type: 'set-deflection', deg: 4 }, 'pointer', bendCtx)
  expect(scopeGoalsMet(bend.goals, bent)).toBe(true)
})

test('suction requires immersion and elapsed time, stops at the surface, and resets fluid', () => {
  const { view, goals } = FIVE_CONTROLS_TASKS.suction
  const ctx = { view, scopeCase: null }
  let state = createScopeState(view, null)
  const send = (command: Parameters<typeof reduceScope>[1]) => {
    state = reduceScope(state, command, 'pointer', ctx)
  }
  send({ type: 'suction', on: true })
  send({ type: 'tick', seconds: 2 })
  expect(state.signals.benchFluidRemaining).toBe(1)
  send({ type: 'suction', on: false })
  expect(scopeGoalsMet(goals, state)).toBe(false)
  send({ type: 'advance', mm: 24 })
  send({ type: 'suction', on: true })
  expect(state.signals.benchFluidRemaining).toBe(1)
  send({ type: 'tick', seconds: 1 })
  expect(state.signals.benchFluidRemaining).toBeCloseTo(0.85)
  expect(scopeGoalsMet(goals, state)).toBe(false)
  const { container, rerender } = render(<BenchFluidView state={state} />)
  expect(container.querySelector('svg')).toHaveAttribute('data-fluid-aspirating', 'true')
  send({ type: 'suction', on: false })
  const remaining = state.signals.benchFluidRemaining
  send({ type: 'tick', seconds: 2 })
  expect(state.signals.benchFluidRemaining).toBe(remaining)
  expect(scopeGoalsMet(goals, state)).toBe(true)
  send({ type: 'suction', on: true })
  send({ type: 'tick', seconds: 10 })
  expect(benchFluidObservation(state).surfaceMm).toBeCloseTo(state.depthMm)
  expect(benchFluidObservation(state).aspirating).toBe(false)
  rerender(<BenchFluidView state={state} />)
  expect(container.querySelector('svg')).toHaveAttribute('data-fluid-aspirating', 'false')
  expect(createScopeState(view, null).signals.benchFluidRemaining).toBe(1)
})

test('the live lesson accepts fluid clock ticks but cannot gain suction credit from playback commands', () => {
  const lesson = bronchStageLesson('five-controls')
  const step = lesson.steps.find((s) => s.learn?.id === 'suction')!
  const view = FIVE_CONTROLS_TASKS.suction.view
  const reducer = bronchStageReducer(lesson)
  let session = reducer(emptyBronchStageSession(), {
    type: 'SCOPE_INIT',
    stepId: step.id,
    view,
    scopeCase: null,
  })
  const command = (cmd: Parameters<typeof reduceScope>[1], inputMode: 'pointer' | 'scripted') => {
    session = reducer(session, {
      type: 'SCOPE_COMMAND',
      stepId: step.id,
      view,
      scopeCase: null,
      command: cmd,
      inputMode,
    })
  }
  command({ type: 'advance', mm: 24 }, 'scripted')
  expect(session.scope[step.id].depthMm).toBe(0)
  command({ type: 'advance', mm: 24 }, 'pointer')
  command({ type: 'suction', on: true }, 'pointer')
  command({ type: 'tick', seconds: 1 }, 'scripted')
  expect(session.scope[step.id].signals.benchFluidRemaining).toBeCloseTo(0.85)
})

test('device names are not mistaken for clinical measurements', () => {
  expect(handTypedDigitErrors('label', 'BF-1TH190 and BF-XT190')).toEqual([])
  expect(handTypedDigitErrors('label', 'BF-1TH190 has a 9.9 mm channel')).toHaveLength(1)
})

test('aiming accepts small alignment errors across a useful depth band but rejects blind advancement', () => {
  const { view, goals } = FIVE_CONTROLS_TASKS.combine
  const ctx = { view, scopeCase: null }
  let state = createScopeState(view, null)
  const send = (command: Parameters<typeof reduceScope>[1]) => {
    state = reduceScope(state, command, 'pointer', ctx)
  }
  send({ type: 'set-rotation', deg: 40 })
  send({ type: 'set-deflection', deg: 29 })
  send({ type: 'advance', mm: 20 })
  expect(state.events).not.toContain('bench-advanced-off-target')
  expect(scopeGoalsMet(goals, state)).toBe(true)
  const { container } = render(<BenchSchematic state={state} view={view} />)
  expect(container.querySelector('[data-bench-reticle]')).toBeVisible()
  state = createScopeState(view, null)
  send({ type: 'advance', mm: 20 })
  send({ type: 'set-rotation', deg: 45 })
  send({ type: 'set-deflection', deg: 38 })
  expect(state.events).toContain('bench-advanced-off-target')
  expect(scopeGoalsMet(goals, state)).toBe(false)
})

test('the non-WebGL fallback retains the fluid model and manual clock control', () => {
  const { view } = FIVE_CONTROLS_TASKS.suction
  const { container, getByRole } = render(
    <ScopeFallback
      view={view}
      state={createScopeState(view, null)}
      map={null}
      onCommand={() => {}}
      onReset={() => {}}
      controlsEnabled
      goals={[]}
      caption="Bench"
      plain
    />,
  )
  expect(container.querySelector('[data-bench-fluid="outside"]')).toBeVisible()
  expect(getByRole('button', { name: 'Step one second' })).toBeEnabled()
})
