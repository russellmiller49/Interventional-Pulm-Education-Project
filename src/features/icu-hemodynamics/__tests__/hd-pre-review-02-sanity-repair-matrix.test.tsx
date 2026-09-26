import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { BedsideMonitor } from '../components/BedsideMonitor'
import { FormulaDrawer } from '../components/FormulaDrawer'
import { HemodynamicCaseActivity } from '../components/HemodynamicCaseActivity'
import { PacActionDock } from '../components/PacActionDock'
import { WedgeDock } from '../components/stage/StageDocks'
import { hemodynamicCaseById } from '../content'
import { acceptedFlowSeries, flowAroundAction } from '../engine/decisionRecord'
import {
  physiologicalEpisodeAt,
  storedWedgeProvenance,
  thermodilutionSeriesView,
  WEDGE_WINDOW_STRADDLES_CHANGE,
} from '../engine/measurementProvenance'
import { icuHemodynamicsReducer } from '../engine/reducer'
import {
  createInitialHemodynamicState,
  deriveEffectiveCirculationParameters,
  effectCanChangeEffectiveParameters,
  interventionChangesPhysiology,
} from '../engine/simulation'
import { standardTechnique } from '../engine/stageRuntime'
import type {
  HemodynamicAction,
  HemodynamicInterventionDefinition,
  HemodynamicSimulationState,
  ParameterEffect,
} from '../engine/types'

/**
 * HD-PRE-REVIEW-02 sanity repair — the full matrix for the three blockers: guards that held before
 * the repair and must still hold, positive controls, the new helpers, and the rendered surfaces.
 * The regressions that distinguish `e5a3096f` from the repair are in
 * `hd-pre-review-02-sanity-repair-regressions`.
 */

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
  useRouter: () => ({ push: jest.fn() }),
}))

afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

const reduce = (state: HemodynamicSimulationState, action: HemodynamicAction) =>
  icuHemodynamicsReducer(state, action)

function intervention(caseId: string, id: string): HemodynamicInterventionDefinition {
  return hemodynamicCaseById.get(caseId)!.interventions.find((item) => item.id === id)!
}

function zeroedPractice(caseId: string, seed: number): HemodynamicSimulationState {
  return reduce(createInitialHemodynamicState(hemodynamicCaseById.get(caseId)!, 'practice', seed), {
    type: 'ZERO_TRANSDUCER',
  })
}

function acceptThree(state: HemodynamicSimulationState): HemodynamicSimulationState {
  let next = state
  for (let index = 0; index < 3; index += 1) {
    next = reduce(next, { type: 'GENERATE_THERMODILUTION_TRIAL', technique: standardTechnique() })
    const trial = next.thermodilutionTrials[next.thermodilutionTrials.length - 1]
    next = reduce(next, { type: 'REVIEW_THERMODILUTION_CURVE', trialId: trial.id })
    next = reduce(next, { type: 'SET_THERMODILUTION_ACCEPTED', trialId: trial.id, accepted: true })
  }
  return next
}

function tickUntil(
  state: HemodynamicSimulationState,
  done: (state: HemodynamicSimulationState) => boolean,
  step = 0.2,
): HemodynamicSimulationState {
  let next = state
  for (let guard = 0; guard < 2000 && !done(next); guard += 1) {
    next = reduce(next, { type: 'TICK', seconds: step })
  }
  if (!done(next)) throw new Error('condition never reached')
  return next
}

function occlude(state: HemodynamicSimulationState): HemodynamicSimulationState {
  return tickUntil(
    reduce(state, { type: 'START_WEDGE' }),
    (next) => next.catheter.wedgeCaptureReady,
  )
}

function legRaiseOcclusion(inflateAfterSeconds: number) {
  let state = zeroedPractice('HD-01', 3469)
  const legRaiseAt = state.timeSeconds
  state = reduce(state, {
    type: 'APPLY_INTERVENTION',
    intervention: intervention('HD-01', 'passive-leg-raise'),
  })
  const legRaiseEpisode = state.physiologicalEpisode.index
  state = occlude(reduce(state, { type: 'TICK', seconds: inflateAfterSeconds }))
  return { state, legRaiseEpisode, waningAt: legRaiseAt + 20 }
}

function storedAcrossTheWaningBoundary() {
  const occlusion = legRaiseOcclusion(12)
  let state = reduce(occlusion.state, { type: 'TICK', seconds: 0.6 })
  state = reduce(state, { type: 'PLACE_WEDGE_CURSOR', placement: 'assisted' })
  state = tickUntil(
    state,
    (candidate) => candidate.physiologicalEpisode.index !== occlusion.legRaiseEpisode,
  )
  return { ...occlusion, state: reduce(state, { type: 'STORE_WEDGE' }) }
}

function straddlingCursor() {
  const occlusion = legRaiseOcclusion(14)
  let state = tickUntil(occlusion.state, (next) => next.timeSeconds >= occlusion.waningAt + 1.2)
  state = reduce(state, {
    type: 'PLACE_WEDGE_CURSOR',
    placement: 'manual',
    time: occlusion.waningAt,
  })
  return { ...occlusion, state }
}

function pvrArticle(): HTMLElement {
  return [...document.querySelectorAll<HTMLElement>('article')].find(
    (article) => article.querySelector('span')?.textContent === 'PVR',
  )!
}

/* ------------------------------------------------------------------ *
 * Blocker 1 — wedge acquisition identity
 * ------------------------------------------------------------------ */

describe('Blocker 1 matrix: which conditions a wedge belongs to', () => {
  it('a sample at an episode’s start time still belongs to the episode before', () => {
    const { state, legRaiseEpisode } = legRaiseOcclusion(12)
    const episodes = state.physiologicalEpisodes
    const legRaise = episodes.find((episode) => episode.index === legRaiseEpisode)!
    expect(physiologicalEpisodeAt(episodes, legRaise.startedAtSeconds).index).toBe(
      legRaiseEpisode - 1,
    )
    expect(physiologicalEpisodeAt(episodes, legRaise.startedAtSeconds + 0.02).index).toBe(
      legRaiseEpisode,
    )
    expect(physiologicalEpisodeAt(episodes, 0).index).toBe(0)
  })

  it('the cursor records session, episode, occlusion, sample time, window and placement', () => {
    const { state: occluded, legRaiseEpisode } = legRaiseOcclusion(12)
    const state = reduce(reduce(occluded, { type: 'TICK', seconds: 0.6 }), {
      type: 'PLACE_WEDGE_CURSOR',
      placement: 'assisted',
    })
    const cursor = state.catheter.wedgeCursor!
    expect(cursor.acquisition).toEqual({
      sessionId: state.sessionId,
      physiologicalEpisode: legRaiseEpisode,
      windowEpisodes: [legRaiseEpisode],
    })
    expect(cursor.occlusionEpisode).toBe(state.catheter.wedgeEpisodeCount)
    expect(cursor.placement).toBe('assisted')
    expect(cursor.windowStart).toBeLessThan(cursor.time)
    expect(cursor.windowEnd).toBeGreaterThan(cursor.time)
  })

  it('same conditions: waiting, display changes and answer selection do not stale a capture', () => {
    let state = occlude(zeroedPractice('HD-01', 3473))
    state = reduce(state, { type: 'PLACE_WEDGE_CURSOR', placement: 'assisted' })
    const episode = state.physiologicalEpisode.index
    for (const action of [
      { type: 'SET_SWEEP', seconds: 12 },
      { type: 'SET_PRESSURE_SCALE', maximum: 40 },
      { type: 'TOGGLE_PV_LOOPS' },
      { type: 'TOGGLE_FREEZE' },
      { type: 'TOGGLE_FREEZE' },
      { type: 'ACKNOWLEDGE_ALARMS' },
      { type: 'SELECT_MECHANISM', id: 'underfilled' },
      { type: 'SET_PHASE', phase: 'observe' },
      { type: 'TICK', seconds: 1.5 },
    ] as HemodynamicAction[]) {
      state = reduce(state, action)
    }
    expect(state.physiologicalEpisode.index).toBe(episode)
    state = reduce(state, { type: 'STORE_WEDGE' })
    expect(state.catheter.storedWedge?.physiologicalEpisode).toBe(episode)
    expect(storedWedgeProvenance(state)?.current).toBe(true)
    expect(state.responseMessage).not.toMatch(/earlier conditions/)
  })

  it('a straddling cycle names both episodes, belongs to neither, and says why at placement', () => {
    const { state, legRaiseEpisode } = straddlingCursor()
    expect(state.catheter.wedgeCursor!.acquisition.physiologicalEpisode).toBeNull()
    expect(state.catheter.wedgeCursor!.acquisition.windowEpisodes).toEqual([
      legRaiseEpisode,
      legRaiseEpisode + 1,
    ])
    expect(state.responseMessage).toBe(WEDGE_WINDOW_STRADDLES_CHANGE)
  })

  it('storing a value from earlier conditions says so', () => {
    const { state } = storedAcrossTheWaningBoundary()
    expect(state.responseMessage).toMatch(/acquired before the modeled physiology last changed/)
    expect(state.responseMessage).toMatch(/not combined with measurements from now/)
  })

  it('a new occlusion under the new conditions restores a current wedge and a PVR', () => {
    let { state } = storedAcrossTheWaningBoundary()
    state = reduce(state, { type: 'DEFLATE_WEDGE' })
    state = reduce(state, { type: 'TICK', seconds: 2 })
    state = occlude(state)
    state = reduce(state, { type: 'PLACE_WEDGE_CURSOR', placement: 'assisted' })
    state = reduce(state, { type: 'STORE_WEDGE' })
    expect(state.catheter.storedWedge?.physiologicalEpisode).toBe(state.physiologicalEpisode.index)
    expect(storedWedgeProvenance(state)?.current).toBe(true)
    state = reduce(state, { type: 'DEFLATE_WEDGE' })
    state = acceptThree(reduce(state, { type: 'TICK', seconds: 1 }))

    render(<FormulaDrawer state={state} dispatch={jest.fn()} observedInputsOnly />)
    expect(pvrArticle().querySelector('strong')?.textContent).toMatch(/WU/)
    expect(document.querySelector('[data-derived-stale-inputs]')).toBeNull()
  })

  it('the monitor labels the old wedge as from earlier conditions', () => {
    const { state } = storedAcrossTheWaningBoundary()
    render(<BedsideMonitor state={state} dispatch={jest.fn()} />)
    expect(screen.getByRole('group', { name: 'PAWP measurement' }).textContent).toMatch(
      /stored end-exp · assisted cursor · earlier conditions/,
    )
  })

  it('the stage picker explains a straddling cycle and the Store control is not offered', () => {
    const { state } = straddlingCursor()
    render(<WedgeDock state={state} dispatch={jest.fn()} enabled />)
    const verdict = document.querySelector('[data-cursor-placed]')!
    expect(verdict.getAttribute('data-cursor-conditions')).toBe('straddles')
    expect(verdict.textContent).toContain(WEDGE_WINDOW_STRADDLES_CHANGE)
    expect(screen.getByRole('button', { name: 'Store' })).toBeDisabled()
  })

  it('the stage picker marks a cycle acquired before the last change as earlier', () => {
    const occlusion = legRaiseOcclusion(14)
    let state = tickUntil(occlusion.state, (next) => next.timeSeconds >= occlusion.waningAt + 1.2)
    state = reduce(state, {
      type: 'PLACE_WEDGE_CURSOR',
      placement: 'manual',
      time: occlusion.waningAt - 1,
    })
    render(<WedgeDock state={state} dispatch={jest.fn()} enabled />)
    const verdict = document.querySelector('[data-cursor-placed]')!
    expect(verdict.getAttribute('data-cursor-conditions')).toBe('earlier')
    expect(verdict.textContent).toMatch(/acquired before the modeled physiology last changed/)
    expect(screen.getByRole('button', { name: 'Store' })).toBeEnabled()
  })

  it('the practice dock explains a straddling assisted cursor and lets it be placed again', () => {
    const { state } = straddlingCursor()
    render(<PacActionDock state={state} dispatch={jest.fn()} />)
    expect(document.body.textContent).toMatch(
      /cardiac cycle straddles a change in the modeled physiology, so it cannot be stored as one wedge/,
    )
    expect(screen.getByRole('button', { name: 'Store PAWP' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'End-exp cursor (assisted)' })).toBeEnabled()
  })
})

/* ------------------------------------------------------------------ *
 * Blocker 2 — which actions start a physiological episode
 * ------------------------------------------------------------------ */

function effect(overrides: Partial<ParameterEffect>): ParameterEffect {
  return {
    id: 'candidate',
    interventionId: 'candidate',
    startedAt: 100,
    onsetSeconds: 5,
    recoverySeconds: null,
    deltas: {},
    ...overrides,
  }
}

/** Effective parameters with and without `candidate`, compared on the model's own step grid. */
function differsSomewhere(
  state: HemodynamicSimulationState,
  candidate: ParameterEffect,
  horizonSeconds: number,
): boolean {
  for (let seconds = 0; seconds <= horizonSeconds; seconds += 0.02) {
    const time = state.timeSeconds + seconds
    const without = deriveEffectiveCirculationParameters(
      state.baselineParameters,
      state.activeEffects,
      time,
    )
    const withIt = deriveEffectiveCirculationParameters(
      state.baselineParameters,
      [...state.activeEffects, candidate],
      time,
    )
    if (JSON.stringify(without) !== JSON.stringify(withIt)) return true
  }
  return false
}

function candidateFor(
  state: HemodynamicSimulationState,
  definition: HemodynamicInterventionDefinition,
): ParameterEffect {
  return effect({
    interventionId: definition.id,
    startedAt: state.timeSeconds,
    onsetSeconds: definition.onsetSeconds,
    recoverySeconds: definition.recoverySeconds ?? null,
    deltas: definition.parameterDeltas,
  })
}

describe('Blocker 2 matrix: an episode is a change in the modeled conditions', () => {
  it('an effective intervention starts one episode, and its effect really moves the parameters', () => {
    const state = acceptThree(zeroedPractice('HD-02', 3474))
    const norepinephrine = intervention('HD-02', 'norepinephrine-up')
    expect(interventionChangesPhysiology(state, norepinephrine)).toBe(true)
    expect(differsSomewhere(state, candidateFor(state, norepinephrine), 30)).toBe(true)
    const after = reduce(state, { type: 'APPLY_INTERVENTION', intervention: norepinephrine })
    expect(after.physiologicalEpisode.index).toBe(state.physiologicalEpisode.index + 1)
    expect(after.physiologicalEpisode.cause).toMatchObject({
      kind: 'intervention',
      interventionId: 'norepinephrine-up',
    })
    expect(thermodilutionSeriesView(after).currentEstablished).toBe(false)
    expect(after.responseMessage).toBe(norepinephrine.response)
  })

  it('a repeat dose before the bound still starts an episode', () => {
    const norepinephrine = intervention('HD-02', 'norepinephrine-up')
    let state = zeroedPractice('HD-02', 3475)
    state = reduce(state, { type: 'APPLY_INTERVENTION', intervention: norepinephrine })
    state = reduce(state, { type: 'TICK', seconds: 30 })
    expect(differsSomewhere(state, candidateFor(state, norepinephrine), 30)).toBe(true)
    const after = reduce(state, { type: 'APPLY_INTERVENTION', intervention: norepinephrine })
    expect(after.physiologicalEpisode.index).toBe(state.physiologicalEpisode.index + 1)
  })

  it('the clamped repeat is exactly inert on the model’s step grid, and the check agrees', () => {
    const norepinephrine = intervention('HD-02', 'norepinephrine-up')
    let state = zeroedPractice('HD-02', 3470)
    for (let dose = 0; dose < 30; dose += 1) {
      state = reduce(state, { type: 'APPLY_INTERVENTION', intervention: norepinephrine })
    }
    state = reduce(state, { type: 'TICK', seconds: 150 })
    expect(interventionChangesPhysiology(state, norepinephrine)).toBe(false)
    expect(differsSomewhere(state, candidateFor(state, norepinephrine), 120)).toBe(false)
  })

  it('a refused action starts no episode', () => {
    const state = zeroedPractice('HD-08', 3476)
    const after = reduce(state, {
      type: 'APPLY_INTERVENTION',
      intervention: intervention('HD-08', 'correct-measurement-system'),
    })
    expect(after.activeEffects).toHaveLength(0)
    expect(after.physiologicalEpisodes).toHaveLength(1)
  })

  it('an accepted action with no modeled effect starts no episode', () => {
    const state = zeroedPractice('HD-01', 3477)
    const after = reduce(state, {
      type: 'APPLY_INTERVENTION',
      intervention: intervention('HD-08', 'repeat-valid-thermodilution'),
    })
    expect(after.activeEffects).toHaveLength(1)
    expect(after.physiologicalEpisodes).toHaveLength(1)
    // Its own authored response, not the "no further effect" narration: it never had an effect.
    expect(after.responseMessage).toBe(
      intervention('HD-08', 'repeat-valid-thermodilution').response,
    )
  })

  it('an effective transient crosses its waning boundary exactly once, tick by tick', () => {
    let state = zeroedPractice('HD-01', 3478)
    const legRaiseAt = state.timeSeconds
    state = reduce(state, {
      type: 'APPLY_INTERVENTION',
      intervention: intervention('HD-01', 'passive-leg-raise'),
    })
    for (let step = 0; step < 300; step += 1) state = reduce(state, { type: 'TICK', seconds: 0.2 })
    const waning = state.physiologicalEpisodes.filter((item) => item.cause.kind === 'effect-waning')
    expect(waning).toHaveLength(1)
    expect(waning[0].startedAtSeconds).toBeCloseTo(legRaiseAt + 20, 6)
  })

  it('a TICK that jumps across the boundary still records exactly one transition', () => {
    let state = zeroedPractice('HD-01', 3479)
    state = reduce(state, {
      type: 'APPLY_INTERVENTION',
      intervention: intervention('HD-01', 'passive-leg-raise'),
    })
    state = reduce(state, { type: 'TICK', seconds: 60 })
    expect(
      state.physiologicalEpisodes.filter((item) => item.cause.kind === 'effect-waning'),
    ).toHaveLength(1)
  })

  it('an unbounded parameter is never absorbed; a push past a bound already reached is', () => {
    const baseline = createInitialHemodynamicState(
      hemodynamicCaseById.get('HD-01')!,
      'practice',
      1,
    ).baselineParameters
    expect(
      effectCanChangeEffectiveParameters(
        baseline,
        [],
        effect({ deltas: { referenceCardiacOutputLMin: 0.5 } }),
        100,
      ),
    ).toBe(true)
    const atFloor = { ...baseline, peepCmH2O: 0 }
    expect(
      effectCanChangeEffectiveParameters(atFloor, [], effect({ deltas: { peepCmH2O: -3 } }), 100),
    ).toBe(false)
    expect(
      effectCanChangeEffectiveParameters(atFloor, [], effect({ deltas: { peepCmH2O: 3 } }), 100),
    ).toBe(true)
    // A transient that holds the value at the bound now will wane, so it cannot mask a later push.
    const transientAtCeiling = effect({
      id: 'transient',
      startedAt: 0,
      recoverySeconds: 35,
      deltas: { circulatingVolumeFraction: 1 },
    })
    expect(
      effectCanChangeEffectiveParameters(
        baseline,
        [transientAtCeiling],
        effect({ deltas: { circulatingVolumeFraction: 0.08 } }),
        10,
      ),
    ).toBe(true)
  })

  it('the case host records an absorbed dose as having no further modeled effect', async () => {
    jest.useFakeTimers()
    await toActions('HD-02')
    for (let dose = 0; dose < 30; dose += 1) fireEvent.click(interventionCard('norepinephrine-up'))
    modelSeconds(150)
    acquireSeriesThroughTheControls()
    fireEvent.click(interventionCard('norepinephrine-up'))
    modelSeconds(2)
    openDebrief()
    const rows = [...document.querySelectorAll('ol li')].map((row) => row.textContent ?? '')
    expect(rows.some((row) => /no further modeled effect/.test(row))).toBe(true)
    // The series acquired before the absorbed dose is still the current one.
    expect(document.querySelector('[data-pressure-versus-flow]')?.textContent).toMatch(
      /has no earlier counterpart in this run/,
    )
  })
})

/* ------------------------------------------------------------------ *
 * Blocker 3 — what the debrief says about retained series
 * ------------------------------------------------------------------ */

function interventionCard(id: string): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(`[data-intervention="${id}"]`)!
}

async function toActions(caseId: string) {
  render(<HemodynamicCaseActivity caseId={caseId} mode="practice" />)
  expect(
    await screen.findByRole('heading', { name: hemodynamicCaseById.get(caseId)!.title }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Orient to the patient and signals' }))
  fireEvent.click(
    screen.getByRole('button', { name: 'Go to the actions without recording a frame' }),
  )
}

function openDebrief() {
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Case checkpoints' })).getByRole('button', {
      name: /Review your reasoning/,
    }),
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Show the teaching without recording a frame' }),
  )
}

function modelSeconds(seconds: number) {
  act(() => {
    jest.advanceTimersByTime(seconds * 1000)
  })
}

function acquireSeriesThroughTheControls() {
  for (let curve = 0; curve < 3; curve += 1) {
    fireEvent.click(screen.getByRole('button', { name: /Hold to inject/ }))
    for (const button of screen.queryAllByRole('button', { name: 'Review this curve' })) {
      if (!(button as HTMLButtonElement).disabled) fireEvent.click(button)
    }
    for (const button of screen.queryAllByRole('button', { name: 'Accept into the series' })) {
      if (button.getAttribute('aria-pressed') === 'false') fireEvent.click(button)
    }
  }
}

const runFlow = () => document.querySelector('[data-pressure-versus-flow]')?.textContent ?? ''
const fluidBlock = () =>
  document.querySelector('[data-unfavourable-action="fluid-250"]')?.textContent ?? ''

describe('Blocker 3 matrix: the debrief against the series the run holds', () => {
  it('no series anywhere: “no accepted series was acquired” still stands', async () => {
    jest.useFakeTimers()
    await toActions('HD-03')
    fireEvent.click(interventionCard('fluid-250'))
    modelSeconds(5)
    openDebrief()
    expect(runFlow()).toMatch(/No accepted thermodilution series was acquired/)
    expect(fluidBlock()).toMatch(
      /No thermodilution series was acquired after it, so this run holds no measurement of whether flow changed/,
    )
  })

  it('baseline only: the pre-fluid series is history, and no post-fluid measurement is claimed', async () => {
    jest.useFakeTimers()
    await toActions('HD-03')
    acquireSeriesThroughTheControls()
    fireEvent.click(interventionCard('fluid-250'))
    modelSeconds(40)
    openDebrief()
    expect(runFlow()).toMatch(/An accepted thermodilution series was acquired as the case opened/)
    expect(runFlow()).toMatch(/those after Fluid \+250 mL — and no series was acquired under them/)
    expect(fluidBlock()).toMatch(/No thermodilution series was acquired after it\./)
    expect(fluidBlock()).toMatch(
      /The series acquired before it \(\d\.\d L\/min .*acquired as the case opened\) describes the conditions before this choice, not its effect/,
    )
    expect(fluidBlock()).not.toMatch(/Flow was acquired after it/)
  })

  it('current only: the series under the final conditions is reported as current', async () => {
    jest.useFakeTimers()
    await toActions('HD-03')
    fireEvent.click(interventionCard('fluid-250'))
    modelSeconds(40)
    acquireSeriesThroughTheControls()
    openDebrief()
    expect(runFlow()).toMatch(/has no earlier counterpart in this run/)
    expect(fluidBlock()).toMatch(/Flow was acquired after it, under the conditions it created/)
    expect(fluidBlock()).not.toMatch(/now historical/)
  })

  it('across conditions: two series, named separately and never pooled', async () => {
    jest.useFakeTimers()
    await toActions('HD-03')
    acquireSeriesThroughTheControls()
    fireEvent.click(interventionCard('fluid-250'))
    modelSeconds(40)
    acquireSeriesThroughTheControls()
    openDebrief()
    expect(runFlow()).toMatch(
      /Accepted series under 2 different sets of conditions: \d\.\d L\/min .*as the case opened, then \d\.\d L\/min .*after Fluid \+250 mL/,
    )
    expect(runFlow()).toMatch(/cardiac index changed by [+−]\d\.\d\d L\/min\/m²/)
    expect(runFlow()).toMatch(/never averaged/)
    expect(fluidBlock()).toMatch(/under the conditions it created/)
  })

  it('several historical series: each is named with its own conditions', async () => {
    jest.useFakeTimers()
    await toActions('HD-03')
    acquireSeriesThroughTheControls()
    fireEvent.click(interventionCard('fluid-250'))
    modelSeconds(40)
    acquireSeriesThroughTheControls()
    fireEvent.click(interventionCard('dobutamine-up'))
    modelSeconds(5)
    openDebrief()
    expect(runFlow()).toMatch(/under 2 earlier sets of conditions, each kept separate/)
    expect(runFlow()).toMatch(/as the case opened; \d\.\d L\/min .*after Fluid \+250 mL/)
    expect(runFlow()).toMatch(/none of whether flow changed after the last of those series/)
    expect(fluidBlock()).toMatch(/under the conditions it created: \d\.\d L\/min .*after Fluid/)
    expect(fluidBlock()).toMatch(/That series is now historical/)
  })

  it('a leg-raise series acquired while it built is its response; one after waning is not', async () => {
    jest.useFakeTimers()
    await toActions('HD-01')
    fireEvent.click(interventionCard('passive-leg-raise'))
    modelSeconds(8)
    acquireSeriesThroughTheControls()
    openDebrief()
    expect(document.querySelector('[data-leg-raise-summary="performed"]')?.textContent).toMatch(
      /A thermodilution series was acquired while its modeled effect was building/,
    )
    cleanup()

    await toActions('HD-01')
    fireEvent.click(interventionCard('passive-leg-raise'))
    modelSeconds(25)
    acquireSeriesThroughTheControls()
    openDebrief()
    const late = document.querySelector('[data-leg-raise-summary="performed"]')?.textContent ?? ''
    expect(late).toMatch(/No series was acquired while its modeled effect was building/)
    expect(late).toMatch(/after the modeled PLR effect began to wane/)
    expect(late).toMatch(/so it is not the leg-raise response/)
  })

  it('the engine listing: every accepted series, oldest first, with the current one marked', () => {
    let state = acceptThree(zeroedPractice('HD-03', 3480))
    const fluid = intervention('HD-03', 'fluid-250')
    const beforeFluid = state
    state = reduce(state, { type: 'APPLY_INTERVENTION', intervention: fluid })
    state = acceptThree(reduce(state, { type: 'TICK', seconds: 40 }))
    const dobutamineBefore = state
    state = reduce(state, {
      type: 'APPLY_INTERVENTION',
      intervention: intervention('HD-03', 'dobutamine-up'),
    })
    const series = acceptedFlowSeries(state)
    expect(series.map((item) => item.current)).toEqual([false, false])
    expect(series[0].flow.firstAcquiredAtSeconds).toBeLessThan(
      series[1].flow.firstAcquiredAtSeconds,
    )
    expect(series[0].flow.seriesKey).not.toBe(series[1].flow.seriesKey)

    const aroundFluid = flowAroundAction(state, {
      interventionId: 'fluid-250',
      atSeconds: beforeFluid.timeSeconds,
      episodeBefore: beforeFluid.physiologicalEpisode.index,
    })
    expect(aroundFluid.kind).toBe('under-its-conditions')
    if (aroundFluid.kind === 'under-its-conditions') {
      expect(aroundFluid.afterIsCurrent).toBe(false)
      expect(aroundFluid.current).toBeNull()
      expect(aroundFluid.before?.seriesKey).toBe(series[0].flow.seriesKey)
    }
    const aroundDobutamine = flowAroundAction(state, {
      interventionId: 'dobutamine-up',
      atSeconds: dobutamineBefore.timeSeconds,
      episodeBefore: dobutamineBefore.physiologicalEpisode.index,
    })
    expect(aroundDobutamine.kind).toBe('none-after')
    expect(aroundDobutamine.before?.seriesKey).toBe(series[1].flow.seriesKey)
  })
})
