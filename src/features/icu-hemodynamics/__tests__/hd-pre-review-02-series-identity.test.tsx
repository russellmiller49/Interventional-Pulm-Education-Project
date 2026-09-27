import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { BedsideMonitor } from '../components/BedsideMonitor'
import { FormulaDrawer } from '../components/FormulaDrawer'
import {
  ThermodilutionSeriesReadout,
  ThermodilutionTrialCard,
} from '../components/ThermodilutionTrialReview'
import { hemodynamicCaseById } from '../content/cases'
import {
  authoredThermodilutionSeriesIdentity,
  createInitialHemodynamicState,
  icuHemodynamicsReducer,
  learnerThermodilutionSeriesIdentity,
  thermodilutionAcceptedAverage,
  thermodilutionCurveTextEquivalent,
  thermodilutionSeriesIncompatibility,
  thermodilutionSeriesSummary,
  thermodilutionTrialInclusion,
  UNRECORDED_THERMODILUTION_SERIES,
} from '../engine'
import { describeObservedSystemState, observedSystemState } from '../engine/decisionRecord'
import {
  currentThermodilutionSeriesIdentity,
  thermodilutionSeriesView,
} from '../engine/measurementProvenance'
import { effectWaningStartsAt } from '../engine/simulation'
import { cleanState, reduceAll, standardTechnique } from '../engine/stageRuntime'
import type {
  HemodynamicAction,
  HemodynamicCaseDefinition,
  HemodynamicSimulationState,
  ThermodilutionTechnique,
} from '../engine/types'

afterEach(cleanup)

/**
 * HD-PRE-REVIEW-02, sections A and B: thermodilution acquisition-series identity, and learner
 * acceptance kept apart from technical quality and calculation inclusion.
 */

const reduce = (state: HemodynamicSimulationState, action: HemodynamicAction) =>
  icuHemodynamicsReducer(state, action)

function acquire(
  state: HemodynamicSimulationState,
  count: number,
  technique: ThermodilutionTechnique = standardTechnique(),
): HemodynamicSimulationState {
  let next = state
  for (let index = 0; index < count; index += 1) {
    next = reduce(next, { type: 'GENERATE_THERMODILUTION_TRIAL', technique })
    const trial = next.thermodilutionTrials[next.thermodilutionTrials.length - 1]
    next = reduce(next, { type: 'REVIEW_THERMODILUTION_CURVE', trialId: trial.id })
    next = reduce(next, { type: 'SET_THERMODILUTION_ACCEPTED', trialId: trial.id, accepted: true })
  }
  return next
}

const HD01 = hemodynamicCaseById.get('HD-01')!
const FLUID = HD01.interventions.find((item) => item.id === 'fluid-250')!
const PLR = HD01.interventions.find((item) => item.id === 'passive-leg-raise')!

function hd01(): HemodynamicSimulationState {
  return reduce(createInitialHemodynamicState(HD01, 'practice', 3345), { type: 'ZERO_TRANSDUCER' })
}

function threePlusThree() {
  let state = acquire(hd01(), 3)
  const pre = state
  state = reduce(state, { type: 'APPLY_INTERVENTION', intervention: FLUID })
  const afterFluid = state
  state = acquire(reduce(state, { type: 'TICK', seconds: 40 }), 3)
  return { pre, afterFluid, post: state }
}

describe('A. acquisition-series identity', () => {
  it('3 pre + 3 post: two series, each with its own conditions, never pooled', () => {
    const { pre, post } = threePlusThree()
    const view = thermodilutionSeriesView(post)
    expect(view.currentEstablished).toBe(true)
    expect(view.current.includedTrialIds).toHaveLength(3)
    expect(view.current.identity.episode?.cause).toEqual({
      kind: 'intervention',
      interventionId: 'fluid-250',
      label: 'Fluid +250 mL',
    })
    expect(view.earlier).toHaveLength(1)
    expect(view.earlier[0].identity.episode?.cause.kind).toBe('case-opened')
    expect(view.earlier[0].averageLMin).toBe(thermodilutionSeriesView(pre).current.averageLMin)
    // No function in the module returns the six-curve pool.
    const all = post.thermodilutionTrials.map((trial) => trial.estimatedCardiacOutputLMin)
    const pooled = Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 10) / 10
    expect(view.current.averageLMin).not.toBe(pooled)
    expect(thermodilutionAcceptedAverage(post.thermodilutionTrials)).toBe(view.current.averageLMin)
    expect(view.current.unpooledReason).toMatch(/modeled physiology changed between them/)
    // The monitor prints the post-fluid series, not the pool.
    render(<BedsideMonitor state={post} dispatch={jest.fn()} />)
    const rail = screen.getByRole('group', { name: 'Thermodilution cardiac output' })
    expect(rail.querySelector('strong')?.textContent).toBe(view.current.averageLMin!.toFixed(1))
  })

  it('never rewrites an acquired curve’s identity when conditions later change', () => {
    const { pre, post } = threePlusThree()
    const before = pre.thermodilutionTrials.map((trial) => trial.acquisition)
    const after = post.thermodilutionTrials.slice(0, 3).map((trial) => trial.acquisition)
    expect(after).toEqual(before)
    // Reviewing and deciding an old curve after the intervention changes its decision, not its series.
    const old = post.thermodilutionTrials[0]
    const reexcluded = reduce(post, {
      type: 'SET_THERMODILUTION_ACCEPTED',
      trialId: old.id,
      accepted: true,
    })
    expect(reexcluded.thermodilutionTrials[0].acquisition).toEqual(old.acquisition)
    expect(thermodilutionSeriesView(reexcluded).current.identity.key).toBe(
      thermodilutionSeriesView(post).current.identity.key,
    )
  })

  it('a partial current series is not replaced by the complete earlier one', () => {
    let state = acquire(hd01(), 3)
    state = reduce(state, { type: 'APPLY_INTERVENTION', intervention: FLUID })
    state = acquire(reduce(state, { type: 'TICK', seconds: 30 }), 2)
    const view = thermodilutionSeriesView(state)
    expect(view.currentEstablished).toBe(false)
    expect(view.current.includedTrialIds).toHaveLength(2)
    expect(view.current.blockedReasons.join(' ')).toMatch(/2 of the 3 usable curves/)
    expect(view.latestEarlierEstablished?.includedTrialIds).toHaveLength(3)

    const observed = observedSystemState(state)
    expect(observed.flow).toBeNull()
    expect(observed.earlierFlow?.trialCount).toBe(3)
    expect(describeObservedSystemState(observed)).toMatch(
      /cardiac index not acquired under the current conditions \(the last accepted series, .* was acquired as the case opened and is not carried forward\)/,
    )

    render(<BedsideMonitor state={state} dispatch={jest.fn()} />)
    const rail = screen.getByRole('group', { name: 'Thermodilution cardiac output' })
    expect(rail.querySelector('strong')?.textContent).toBe('—')
    expect(rail.textContent).toMatch(/not established for current conditions/)
    expect(rail.textContent).toMatch(/acquired as the case opened/)
  })

  it('a derived value never divides a current pressure by an earlier episode’s flow', () => {
    let state = acquire(hd01(), 3)
    state = reduce(state, { type: 'APPLY_INTERVENTION', intervention: FLUID })
    state = reduce(state, { type: 'TICK', seconds: 30 })
    render(<FormulaDrawer state={state} dispatch={jest.fn()} observedInputsOnly />)
    expect(document.querySelector('[data-derived-stale-inputs]')?.textContent).toMatch(
      /only accepted thermodilution series was acquired as the case opened/,
    )
  })

  it('starts no episode for navigation-like, display or measurement-system actions', () => {
    const start = hd01()
    const noOps: HemodynamicAction[] = [
      { type: 'TOGGLE_FREEZE' },
      { type: 'TOGGLE_FREEZE' },
      { type: 'SET_SWEEP', seconds: 8 },
      { type: 'SET_PRESSURE_SCALE', maximum: 80 },
      { type: 'ACKNOWLEDGE_ALARMS' },
      { type: 'SET_PHASE', phase: 'measure' },
      { type: 'SELECT_MECHANISM', id: 'underfilled' },
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: 4 },
      { type: 'SET_DAMPING', dampingRatio: 1.1 },
      { type: 'FAST_FLUSH', lineType: 'systemic-arterial' },
      { type: 'VALIDATE_SIGNAL', check: 'waveform-valid' },
      { type: 'START_WEDGE' },
      { type: 'DEFLATE_WEDGE' },
      { type: 'TICK', seconds: 20 },
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: 0 },
      { type: 'SET_DAMPING', dampingRatio: 0.65 },
    ]
    const after = reduceAll(start, noOps)
    expect(after.physiologicalEpisode).toEqual(start.physiologicalEpisode)
    expect(after.physiologicalEpisodes).toHaveLength(1)
    expect(currentThermodilutionSeriesIdentity(after).key).toBe(
      currentThermodilutionSeriesIdentity(start).key,
    )
    // Curves either side of those actions are one series.
    const pooled = acquire(reduceAll(acquire(start, 2), noOps), 1)
    expect(thermodilutionSeriesView(pooled).current.includedTrialIds).toHaveLength(3)
    expect(thermodilutionSeriesView(pooled).earlier).toHaveLength(0)
  })

  it('an accepted intervention with a modeled effect starts an episode; a refused or inert one does not', () => {
    const withFluid = reduce(hd01(), { type: 'APPLY_INTERVENTION', intervention: FLUID })
    expect(withFluid.physiologicalEpisode.index).toBe(1)
    expect(withFluid.physiologicalEpisode.cause.kind).toBe('intervention')

    const hd08 = hemodynamicCaseById.get('HD-08')!
    const capstone = createInitialHemodynamicState(hd08, 'practice', 808)
    const refused = reduce(capstone, {
      type: 'APPLY_INTERVENTION',
      intervention: hd08.interventions.find((item) => item.id === 'correct-measurement-system')!,
    })
    expect(refused.physiologicalEpisode.index).toBe(0)

    const inert: HemodynamicCaseDefinition = {
      ...HD01,
      interventions: [{ ...PLR, id: 'inert-check', parameterDeltas: {} }],
    }
    const inertState = reduce(createInitialHemodynamicState(inert, 'practice', 5), {
      type: 'APPLY_INTERVENTION',
      intervention: inert.interventions[0],
    })
    expect(inertState.activeEffects).toHaveLength(1)
    expect(inertState.physiologicalEpisode.index).toBe(0)
  })

  it('a transient effect the model begins to withdraw is a scheduled boundary', () => {
    let state = reduce(hd01(), { type: 'APPLY_INTERVENTION', intervention: PLR })
    const waning = effectWaningStartsAt(state.activeEffects[0])!
    expect(waning).toBeGreaterThan(state.timeSeconds)
    state = reduce(state, { type: 'TICK', seconds: waning - state.timeSeconds - 0.5 })
    expect(state.physiologicalEpisode.index).toBe(1)
    state = reduce(state, { type: 'TICK', seconds: 1 })
    expect(state.physiologicalEpisode.index).toBe(2)
    expect(state.physiologicalEpisode.cause).toEqual({
      kind: 'effect-waning',
      interventionId: 'passive-leg-raise',
      label: 'PLR',
    })
  })

  it('a reset is a new run whose series are never the previous run’s', () => {
    const state = acquire(hd01(), 3)
    const reset = reduce(state, {
      type: 'RESET_CASE',
      definition: HD01,
      mode: 'practice',
      seed: 3345,
    })
    expect(reset.sessionId).not.toBe(state.sessionId)
    expect(reset.thermodilutionTrials).toHaveLength(0)
    const before = thermodilutionSeriesView(state).current.identity
    const after = currentThermodilutionSeriesIdentity(reset)
    expect(after.key).not.toBe(before.key)
    expect(thermodilutionSeriesIncompatibility(before, after)).toMatch(/different runs/)
    // A fresh case built directly is deterministic: the same inputs give the same identity.
    expect(createInitialHemodynamicState(HD01, 'practice', 3345).sessionId).toBe(
      createInitialHemodynamicState(HD01, 'practice', 3345).sessionId,
    )
  })

  it('keeps the configured maximum per series, so a post-intervention series can be acquired', () => {
    let state = acquire(hd01(), 6)
    const refused = reduce(state, {
      type: 'GENERATE_THERMODILUTION_TRIAL',
      technique: standardTechnique(),
    })
    expect(refused.thermodilutionTrials).toHaveLength(6)
    expect(refused.responseMessage).toMatch(/maximum for one series/)
    state = reduce(state, { type: 'APPLY_INTERVENTION', intervention: FLUID })
    state = acquire(state, 1)
    expect(state.thermodilutionTrials).toHaveLength(7)
  })

  it('separates identities by injectate constants, origin and recording, and says why', () => {
    const episode = { index: 0, startedAtSeconds: 12, cause: { kind: 'case-opened' as const } }
    const a = learnerThermodilutionSeriesIdentity({
      sessionId: 's',
      caseId: 'HD-01',
      episode,
      injectate: { volumeMl: 10, temperatureC: 5 },
    })
    const b = learnerThermodilutionSeriesIdentity({
      sessionId: 's',
      caseId: 'HD-01',
      episode,
      injectate: { volumeMl: 5, temperatureC: 5 },
    })
    expect(a.key).not.toBe(b.key)
    expect(thermodilutionSeriesIncompatibility(a, b)).toMatch(/different injectate constants/)
    const authored = authoredThermodilutionSeriesIdentity({
      exampleId: 'x',
      injectate: { volumeMl: 10, temperatureC: 5 },
    })
    expect(thermodilutionSeriesIncompatibility(a, authored)).toMatch(/authored example/)
    expect(thermodilutionSeriesIncompatibility(a, UNRECORDED_THERMODILUTION_SERIES)).toMatch(
      /not recorded/,
    )
  })

  it('a changed delivered injectate stays in its series and is flagged, not averaged', () => {
    const configured = standardTechnique()
    let state = acquire(hd01(), 3)
    state = acquire(state, 1, { ...configured, injectateVolumeMl: 5 })
    const odd = state.thermodilutionTrials[3]
    expect(odd.acquisition?.series.key).toBe(state.thermodilutionTrials[0].acquisition?.series.key)
    expect(odd.quality).not.toBe('valid')
    expect(thermodilutionTrialInclusion(odd).code).toBe('accepted-with-quality-alert')
    expect(thermodilutionSeriesView(state).current.includedTrialIds).toHaveLength(3)
  })

  it('opening the earlier-series list changes nothing and pools nothing', () => {
    const { post } = threePlusThree()
    const view = thermodilutionSeriesView(post)
    render(<ThermodilutionSeriesReadout trials={post.thermodilutionTrials} view={view} />)
    const details = document.querySelector<HTMLDetailsElement>('[data-earlier-series]')!
    fireEvent.click(details.querySelector('summary')!)
    expect(details.textContent).toMatch(/kept, and not averaged with this one/)
    expect(details.textContent).toMatch(/as the case opened/)
    expect(details.textContent).toMatch(
      new RegExp(`${view.earlier[0].averageLMin!.toFixed(1)} L/min from 3 curves`),
    )
    expect(document.querySelector('[data-series-state="established"]')?.textContent).toMatch(
      new RegExp(
        `${view.current.averageLMin!.toFixed(1)} L/min.*from 3 reviewed trials in this series`,
      ),
    )
  })

  it('treats curves with no acquisition context as their own unrecorded group', () => {
    const unrecorded = acquire(cleanState(510, 'pa'), 3).thermodilutionTrials.map((trial) => ({
      ...trial,
      acquisition: null,
    }))
    const summary = thermodilutionSeriesSummary(unrecorded)
    expect(summary.identity.origin).toBe('unrecorded')
    expect(summary.averageLMin).not.toBeNull()
    // Mixed with recorded curves, they are never averaged into them.
    const recorded = acquire(cleanState(510, 'pa'), 2).thermodilutionTrials
    const mixed = [...unrecorded, ...recorded]
    const latest = thermodilutionSeriesSummary(mixed)
    expect(latest.identity.origin).toBe('learner-acquired')
    expect(latest.averageLMin).toBeNull()
    expect(latest.unpooledReason).toMatch(/were not recorded/)
  })
})

describe('B. learner acceptance, technical quality and calculation inclusion', () => {
  function unusableAccepted() {
    let state = reduce(cleanState(510, 'pa'), {
      type: 'GENERATE_THERMODILUTION_TRIAL',
      technique: {
        ...standardTechnique(),
        injectionDurationSeconds: 7,
        respiratoryPhase: 'variable',
        smoothness: 0.3,
      },
    })
    const trial = state.thermodilutionTrials[0]
    state = reduce(state, { type: 'REVIEW_THERMODILUTION_CURVE', trialId: trial.id })
    state = reduce(state, {
      type: 'SET_THERMODILUTION_ACCEPTED',
      trialId: trial.id,
      accepted: true,
    })
    return state
  }

  it('keeps the learner’s acceptance, the technical verdict and exclusion from the average apart', () => {
    const state = unusableAccepted()
    const trial = state.thermodilutionTrials[0]
    const inclusion = thermodilutionTrialInclusion(trial)
    expect(inclusion).toMatchObject({
      learnerDecision: 'accepted',
      technicalQuality: 'invalid',
      included: false,
      code: 'accepted-not-technically-usable',
    })
    expect(trial.accepted).toBe(true)
    expect(trial.quality).toBe('invalid')
    expect(state.responseMessage).toContain(inclusion.explanation)
    const summary = thermodilutionSeriesView(state).current
    expect(summary.learnerAcceptedTrialIds).toEqual([trial.id])
    expect(summary.includedTrialIds).toEqual([])
    expect(summary.acceptedButNotIncluded[0].explanation).toBe(inclusion.explanation)
    // The text equivalent says the same thing the card says.
    expect(thermodilutionCurveTextEquivalent(trial)).toContain(inclusion.explanation)
    expect(thermodilutionCurveTextEquivalent(trial)).toMatch(/Your decision: accepted\./)
  })

  it('shows the selection, the inclusion badge and the reason on the card, announced', () => {
    const trial = unusableAccepted().thermodilutionTrials[0]
    render(
      <ThermodilutionTrialCard
        trial={trial}
        onReview={jest.fn()}
        onAccept={jest.fn()}
        onExclude={jest.fn()}
      />,
    )
    const card = document.querySelector('[data-trial-inclusion]')!
    expect(card.getAttribute('data-trial-inclusion')).toBe('accepted-not-technically-usable')
    expect(within(card as HTMLElement).getByText('Accepted trial')).toBeInTheDocument()
    expect(card.querySelector('[data-trial-in-calculation]')?.textContent).toBe(
      'Not in the calculation',
    )
    const note = card.querySelector('[data-trial-inclusion-note]')!
    expect(note.getAttribute('role')).toBe('status')
    expect(note.textContent).toMatch(/your choice is kept — but it is not in the calculation/)
    expect(note.textContent).not.toMatch(/clinical/i)
  })

  it('an excluded curve names its reason, and an included one says it is included', () => {
    let state = acquire(cleanState(510, 'pa'), 2)
    state = reduce(state, {
      type: 'GENERATE_THERMODILUTION_TRIAL',
      technique: { ...standardTechnique(), respiratoryPhase: 'variable' },
    })
    const variable = state.thermodilutionTrials[2]
    state = reduce(state, { type: 'REVIEW_THERMODILUTION_CURVE', trialId: variable.id })
    state = reduce(state, {
      type: 'SET_THERMODILUTION_ACCEPTED',
      trialId: variable.id,
      accepted: false,
      exclusionReasonId: 'respiratory-phase-inconsistent',
    })
    expect(thermodilutionTrialInclusion(state.thermodilutionTrials[2])).toMatchObject({
      code: 'excluded-by-learner',
      included: false,
    })
    expect(thermodilutionTrialInclusion(state.thermodilutionTrials[2]).explanation).toMatch(
      /respiratory timing was not the series timing/,
    )
    expect(thermodilutionTrialInclusion(state.thermodilutionTrials[0])).toMatchObject({
      code: 'included',
      included: true,
    })
  })

  it('keeps every trial-review question optional: no decision is required to keep exploring', () => {
    // Undecided and unreviewed curves simply stay out of the calculation; nothing gates on them.
    const state = reduce(cleanState(510, 'pa'), {
      type: 'GENERATE_THERMODILUTION_TRIAL',
      technique: standardTechnique(),
    })
    expect(thermodilutionTrialInclusion(state.thermodilutionTrials[0]).code).toBe('not-reviewed')
    const moved = reduce(state, { type: 'TICK', seconds: 5 })
    expect(moved.thermodilutionTrials).toHaveLength(1)
  })
})
