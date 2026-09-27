import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { FormulaDrawer } from '../components/FormulaDrawer'
import { HemodynamicCaseActivity } from '../components/HemodynamicCaseActivity'
import { hemodynamicCaseById } from '../content'
import { storedWedgeProvenance, thermodilutionSeriesView } from '../engine/measurementProvenance'
import { icuHemodynamicsReducer } from '../engine/reducer'
import { createInitialHemodynamicState } from '../engine/simulation'
import { standardTechnique } from '../engine/stageRuntime'
import type {
  HemodynamicAction,
  HemodynamicInterventionDefinition,
  HemodynamicSimulationState,
} from '../engine/types'

/**
 * HD-PRE-REVIEW-02 sanity repair — the three blockers from the independent review of `e5a3096f`.
 *
 * Written only against APIs that already existed at `e5a3096f`, so that this file run there fails
 * on its assertions — on what the module did — rather than on a missing import or field. Guards and
 * the full matrix, including the new helpers, are in `hd-pre-review-02-sanity-repair-matrix`.
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

/**
 * HD-01: a leg raise (a transient the model begins to withdraw 20 model seconds later), then an
 * occlusion started while it is still building, so the capture straddles the waning boundary.
 */
function legRaiseOcclusion(inflateAfterSeconds: number) {
  let state = zeroedPractice('HD-01', 3469)
  const legRaiseAt = state.timeSeconds
  state = reduce(state, {
    type: 'APPLY_INTERVENTION',
    intervention: intervention('HD-01', 'passive-leg-raise'),
  })
  const legRaiseEpisode = state.physiologicalEpisode.index
  state = reduce(state, { type: 'TICK', seconds: inflateAfterSeconds })
  state = reduce(state, { type: 'START_WEDGE' })
  state = tickUntil(state, (candidate) => candidate.catheter.wedgeCaptureReady)
  return { state, legRaiseEpisode, waningAt: legRaiseAt + 20 }
}

/** Capture and cursor in the leg-raise episode; Store pressed after the effect began to wane. */
function storedAcrossTheWaningBoundary() {
  const occlusion = legRaiseOcclusion(12)
  let state = reduce(occlusion.state, { type: 'TICK', seconds: 0.6 })
  state = reduce(state, { type: 'PLACE_WEDGE_CURSOR', placement: 'assisted' })
  const cursor = state.catheter.wedgeCursor!
  expect(cursor.windowEnd).toBeLessThan(occlusion.waningAt)
  expect(state.physiologicalEpisode.index).toBe(occlusion.legRaiseEpisode)
  state = tickUntil(
    state,
    (candidate) => candidate.physiologicalEpisode.index !== occlusion.legRaiseEpisode,
  )
  expect(state.physiologicalEpisode.cause.kind).toBe('effect-waning')
  expect(state.catheter.balloonInflated).toBe(true)
  state = reduce(state, { type: 'STORE_WEDGE' })
  return { ...occlusion, state, cursor }
}

function pvrArticle(): HTMLElement {
  return [...document.querySelectorAll<HTMLElement>('article')].find(
    (article) => article.querySelector('span')?.textContent === 'PVR',
  )!
}

describe('Blocker 1: a stored wedge keeps the conditions its pressure was acquired under', () => {
  it('capture → cursor → effect wanes → Store: the record keeps the leg-raise episode', () => {
    const { state, legRaiseEpisode } = storedAcrossTheWaningBoundary()
    expect(state.catheter.storedWedgeMmHg).not.toBeNull()
    // At e5a3096f the record took the episode current when Store was pressed.
    expect(state.catheter.storedWedge?.physiologicalEpisode).toBe(legRaiseEpisode)
    expect(state.physiologicalEpisode.index).toBe(legRaiseEpisode + 1)
    expect(storedWedgeProvenance(state)?.current).toBe(false)
  })

  it('an old wedge and a current flow do not make a PVR (end to end, through the drawer)', () => {
    let { state } = storedAcrossTheWaningBoundary()
    state = reduce(state, { type: 'DEFLATE_WEDGE' })
    state = reduce(state, { type: 'TICK', seconds: 1 })
    state = acceptThree(state)
    expect(thermodilutionSeriesView(state).currentEstablished).toBe(true)

    render(<FormulaDrawer state={state} dispatch={jest.fn()} observedInputsOnly />)
    // At e5a3096f this read 1.4 WU: a leg-raise pressure divided by a post-waning flow.
    expect(pvrArticle().querySelector('strong')?.textContent ?? null).toBeNull()
    expect(within(pvrArticle()).getByText('Not interpretable')).toBeInTheDocument()
    expect(document.querySelector('[data-derived-stale-inputs]')?.textContent).toMatch(
      /the stored wedge was read after PLR/,
    )
  })

  it('a cursor set after the boundary on samples acquired before it stores the earlier episode', () => {
    const occlusion = legRaiseOcclusion(14)
    let state = tickUntil(
      occlusion.state,
      (candidate) => candidate.timeSeconds >= occlusion.waningAt + 1.2,
    )
    expect(state.physiologicalEpisode.index).toBe(occlusion.legRaiseEpisode + 1)
    state = reduce(state, {
      type: 'PLACE_WEDGE_CURSOR',
      placement: 'manual',
      time: occlusion.waningAt - 1,
    })
    expect(state.catheter.wedgeCursor!.windowEnd).toBeLessThan(occlusion.waningAt)
    state = reduce(state, { type: 'STORE_WEDGE' })
    expect(state.catheter.storedWedge?.physiologicalEpisode).toBe(occlusion.legRaiseEpisode)
    expect(storedWedgeProvenance(state)?.current).toBe(false)
  })

  it('a cycle that straddles the boundary is not stored as a single-condition wedge', () => {
    const occlusion = legRaiseOcclusion(14)
    let state = tickUntil(
      occlusion.state,
      (candidate) => candidate.timeSeconds >= occlusion.waningAt + 1.2,
    )
    state = reduce(state, {
      type: 'PLACE_WEDGE_CURSOR',
      placement: 'manual',
      time: occlusion.waningAt,
    })
    const cursor = state.catheter.wedgeCursor!
    expect(cursor.windowStart).toBeLessThan(occlusion.waningAt)
    expect(cursor.windowEnd).toBeGreaterThan(occlusion.waningAt)
    state = reduce(state, { type: 'STORE_WEDGE' })
    // At e5a3096f this stored the straddling mean and labelled it with the later episode.
    expect(state.catheter.storedWedgeMmHg).toBeNull()
    expect(state.catheter.storedWedge ?? null).toBeNull()
    expect(state.responseMessage).toMatch(/straddles a change in the modeled physiology/)
    expect(state.responseMessage).toMatch(/cannot be stored as one wedge/)
  })
})

/** HD-02: thirty norepinephrine tiers — past the SVR and LV-contractility bounds — then time. */
function clampedNorepinephrine() {
  let state = zeroedPractice('HD-02', 3470)
  const norepinephrine = intervention('HD-02', 'norepinephrine-up')
  for (let dose = 0; dose < 30; dose += 1) {
    state = reduce(state, { type: 'APPLY_INTERVENTION', intervention: norepinephrine })
  }
  state = reduce(state, { type: 'TICK', seconds: 150 })
  expect(state.parameters.systemicVascularResistanceDynSecCm5).toBe(3200)
  expect(state.parameters.leftVentricularContractility).toBe(2)
  return { state: acceptThree(state), norepinephrine }
}

describe('Blocker 2: an action the model’s bounds absorb starts no physiological episode', () => {
  it('the 31st norepinephrine tier: no new episode, and the accepted series stays current', () => {
    const { state, norepinephrine } = clampedNorepinephrine()
    const before = thermodilutionSeriesView(state)
    expect(before.currentEstablished).toBe(true)
    const after = reduce(state, { type: 'APPLY_INTERVENTION', intervention: norepinephrine })
    expect(after.activeEffects).toHaveLength(state.activeEffects.length + 1)
    // At e5a3096f this became a new episode, and the series went historical.
    expect(after.physiologicalEpisode.index).toBe(state.physiologicalEpisode.index)
    const view = thermodilutionSeriesView(after)
    expect(view.currentEstablished).toBe(true)
    expect(view.current.identity.key).toBe(before.current.identity.key)
    expect(view.current.averageLMin).toBe(before.current.averageLMin)
  })

  it('the learner is told it had no further modeled effect, not that tone rose', () => {
    const { state, norepinephrine } = clampedNorepinephrine()
    const after = reduce(state, { type: 'APPLY_INTERVENTION', intervention: norepinephrine })
    expect(after.responseMessage).not.toBe(norepinephrine.response)
    expect(after.responseMessage).toMatch(/no further modeled effect/)
    expect(after.responseMessage).toMatch(/already at the limit this simulation allows/)
  })

  it('a leg raise the volume bound already absorbs starts no episode, and neither does its waning', () => {
    let state = zeroedPractice('HD-01', 3472)
    const fluid = intervention('HD-01', 'fluid-250')
    for (let step = 0; step < 10; step += 1) {
      state = reduce(state, { type: 'APPLY_INTERVENTION', intervention: fluid })
    }
    state = reduce(state, { type: 'TICK', seconds: 60 })
    expect(state.parameters.circulatingVolumeFraction).toBe(1.4)
    const episodeBefore = state.physiologicalEpisode.index
    state = reduce(state, {
      type: 'APPLY_INTERVENTION',
      intervention: intervention('HD-01', 'passive-leg-raise'),
    })
    expect(state.physiologicalEpisode.index).toBe(episodeBefore)
    state = reduce(state, { type: 'TICK', seconds: 60 })
    expect(state.physiologicalEpisode.index).toBe(episodeBefore)
    expect(
      state.physiologicalEpisodes.some((episode) => episode.cause.kind === 'effect-waning'),
    ).toBe(false)
  })
})

/* ------------------------------------------------------------------ *
 * Blocker 3: the debrief, through the case host a learner uses
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

/** Three curves through the real controls: inject, review the raw curve, accept it. */
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

describe('Blocker 3: the debrief keeps “none now” apart from “none ever”', () => {
  it('fluid → accepted series → dobutamine: the post-fluid series is acknowledged as historical', async () => {
    jest.useFakeTimers()
    await toActions('HD-03')
    fireEvent.click(interventionCard('fluid-250'))
    modelSeconds(40)
    acquireSeriesThroughTheControls()
    fireEvent.click(interventionCard('dobutamine-up'))
    modelSeconds(5)
    openDebrief()

    const flow = document.querySelector('[data-pressure-versus-flow]')!.textContent ?? ''
    // At e5a3096f: "No accepted thermodilution series was acquired, so this run holds no flow
    // measurement …" — with an accepted post-fluid series on file.
    expect(flow).not.toMatch(/No accepted thermodilution series was acquired/)
    expect(flow).toMatch(
      /An accepted thermodilution series was acquired after Fluid \+250 mL: \d\.\d L\/min/,
    )
    expect(flow).toMatch(/the conditions at the end of the run are those after Dobutamine ↑/)
    expect(flow).toMatch(/no series was acquired under them/)
    expect(flow).toMatch(/no measurement of flow under the final conditions/)

    const fluid =
      document.querySelector('[data-unfavourable-action="fluid-250"]')!.textContent ?? ''
    // At e5a3096f: "No thermodilution series was acquired after it".
    expect(fluid).not.toMatch(/No thermodilution series was acquired after it/)
    expect(fluid).toMatch(
      /Flow was acquired after it, under the conditions it created: \d\.\d L\/min/,
    )
    expect(fluid).toMatch(/That series is now historical/)
    expect(fluid).toMatch(/no series has been acquired under them, so current flow is not measured/)
  })

  it('fluid → dobutamine → series: the later series is not offered as the fluid’s effect', async () => {
    jest.useFakeTimers()
    await toActions('HD-03')
    fireEvent.click(interventionCard('fluid-250'))
    modelSeconds(20)
    fireEvent.click(interventionCard('dobutamine-up'))
    modelSeconds(30)
    acquireSeriesThroughTheControls()
    openDebrief()

    const fluid =
      document.querySelector('[data-unfavourable-action="fluid-250"]')!.textContent ?? ''
    // At e5a3096f: "Flow was acquired after it: … acquired after Dobutamine ↑" — a post-dobutamine
    // series read as the fluid's response.
    expect(fluid).not.toMatch(/Flow was acquired after it:/)
    expect(fluid).toMatch(/No series was acquired under the conditions it created/)
    expect(fluid).toMatch(/came only after a later change in the modeled physiology/)
    expect(fluid).toMatch(/cannot be read as this choice’s effect alone/)
  })
})
