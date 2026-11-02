import { cleanup, render, screen, within } from '@testing-library/react'

import { FormulaDrawer } from '../components/FormulaDrawer'
import {
  hemodynamicCaseById,
  hemodynamicDerivedValueGuides,
  hemodynamicDerivedValueIds,
  type HemodynamicDerivedValueId,
} from '../content'
import { icuHemodynamicsReducer } from '../engine/reducer'
import { createInitialHemodynamicState } from '../engine/simulation'
import { standardTechnique } from '../engine/stageRuntime'
import type { HemodynamicAction, HemodynamicSimulationState } from '../engine/types'

/**
 * A calculated result is only as good as the measurements it needs.
 *
 * This section drives the reducer and reads the drawer a learner reads, and uses no API newer than
 * the fault it reproduces, so it fails on what the module did rather than on a missing import. Each
 * case names the results one fault takes down; every other result must stay.
 */

afterEach(cleanup)

const reduce = (state: HemodynamicSimulationState, ...actions: readonly HemodynamicAction[]) =>
  actions.reduce(icuHemodynamicsReducer, state)

/** Passes the PPV screen and has a positive RAP, so every result can be calculated once clean. */
const cleanCase = hemodynamicCaseById.get('HD-03')!

function tickUntil(
  state: HemodynamicSimulationState,
  done: (state: HemodynamicSimulationState) => boolean,
): HemodynamicSimulationState {
  let next = state
  for (let guard = 0; guard < 500 && !done(next); guard += 1) {
    next = reduce(next, { type: 'TICK', seconds: 0.2 })
  }
  if (!done(next)) throw new Error('condition never reached')
  return next
}

function storeWedge(state: HemodynamicSimulationState): HemodynamicSimulationState {
  const occluded = tickUntil(
    reduce(state, { type: 'START_WEDGE' }),
    (candidate) => candidate.catheter.wedgeCaptureReady,
  )
  const settled = reduce(occluded, { type: 'TICK', seconds: 0.6 })
  return reduce(
    settled,
    { type: 'PLACE_WEDGE_CURSOR', placement: 'assisted' },
    { type: 'STORE_WEDGE' },
    { type: 'DEFLATE_WEDGE' },
  )
}

function acceptThree(state: HemodynamicSimulationState): HemodynamicSimulationState {
  let next = state
  for (let index = 0; index < 3; index += 1) {
    next = reduce(next, { type: 'GENERATE_THERMODILUTION_TRIAL', technique: standardTechnique() })
    const trial = next.thermodilutionTrials[next.thermodilutionTrials.length - 1]
    next = reduce(
      next,
      { type: 'REVIEW_THERMODILUTION_CURVE', trialId: trial.id },
      { type: 'SET_THERMODILUTION_ACCEPTED', trialId: trial.id, accepted: true },
    )
  }
  return next
}

/** A zeroed, levelled chain with a clean stored wedge and an accepted thermodilution series. */
function cleanChain(): HemodynamicSimulationState {
  const opened = createInitialHemodynamicState(cleanCase, 'practice', 3469)
  return acceptThree(storeWedge(reduce(opened, { type: 'ZERO_TRANSDUCER' })))
}

function drawerResults(state: HemodynamicSimulationState) {
  render(<FormulaDrawer state={state} dispatch={jest.fn()} observedInputsOnly />)
  const articles = [...document.querySelectorAll<HTMLElement>('article')]
  const results = new Map<HemodynamicDerivedValueId, HTMLElement>()
  for (const id of hemodynamicDerivedValueIds) {
    const label = hemodynamicDerivedValueGuides[id].label
    results.set(id, articles.find((item) => item.querySelector('span')?.textContent === label)!)
  }
  return results
}

function withheldResults(state: HemodynamicSimulationState): HemodynamicDerivedValueId[] {
  const results = drawerResults(state)
  return hemodynamicDerivedValueIds.filter((id) => {
    const article = results.get(id)!
    const value = article.querySelector('strong')
    if (value !== null) return false
    expect(within(article).getByText('Not interpretable')).toBeInTheDocument()
    return true
  })
}

/** Everything that reads an absolute pressure. PPV reads pulse pressures, which an offset leaves. */
const absolutePressureResults: readonly HemodynamicDerivedValueId[] = [
  'systemicVascularResistance',
  'systemicVascularResistanceIndex',
  'pulmonaryVascularResistance',
  'pulmonaryVascularResistanceIndex',
  'cardiacPowerOutputW',
  'pulmonaryArteryPulsatilityIndex',
  'pulmonaryArteryCompliance',
]

describe('calculated results through the drawer', () => {
  it('shows every result on a clean chain', () => {
    expect(withheldResults(cleanChain())).toEqual([])
  })

  it('an unzeroed transducer takes down absolute pressures and leaves flow and PPV alone', () => {
    const opened = createInitialHemodynamicState(cleanCase, 'practice', 3469)
    expect(opened.measurementSystem.zeroed).toBe(false)
    expect(withheldResults(acceptThree(storeWedge(opened)))).toEqual(absolutePressureResults)
  })

  it('an unzeroed offset does not lend PAPi a denominator the patient does not have', () => {
    const opened = createInitialHemodynamicState(
      hemodynamicCaseById.get('HD-01')!,
      'practice',
      3469,
    )
    expect(opened.measurements.rapMmHg).toBe(5)
    const results = drawerResults(acceptThree(opened))
    const papi = results.get('pulmonaryArteryPulsatilityIndex')!
    expect(papi.querySelector('strong')).toBeNull()
    expect(papi.querySelector('p')?.textContent).toBe(
      'Unreliable input: Right atrial pressure, PA systolic pressure, PA diastolic pressure (transducer not zeroed).',
    )
  })

  it('a transducer off the phlebostatic axis does the same', () => {
    const state = reduce(cleanChain(), { type: 'SET_TRANSDUCER_LEVEL', levelCm: 10 })
    expect(withheldResults(state)).toEqual(absolutePressureResults)
  })

  it('a level within tolerance withholds nothing', () => {
    const state = reduce(cleanChain(), { type: 'SET_TRANSDUCER_LEVEL', levelCm: 1 })
    expect(withheldResults(state)).toEqual([])
  })

  it.each(['overdamped', 'underdamped'] as const)(
    'an %s system takes down what is read off systolic and diastolic, not the means',
    (artifact) => {
      const state = reduce(cleanChain(), { type: 'SET_ARTIFACT', artifact })
      expect(withheldResults(state)).toEqual([
        'pulmonaryArteryPulsatilityIndex',
        'pulmonaryArteryCompliance',
        'pulsePressureVariationPercent',
      ])
    },
  )

  it.each(['catheter-whip', 'wall-contact'] as const)(
    '%s takes down what the catheter tip reads and leaves the arterial line alone',
    (artifact) => {
      const state = reduce(cleanChain(), { type: 'SET_ARTIFACT', artifact })
      expect(withheldResults(state)).toEqual([
        'pulmonaryVascularResistance',
        'pulmonaryVascularResistanceIndex',
        'pulmonaryArteryPulsatilityIndex',
        'pulmonaryArteryCompliance',
      ])
    },
  )

  it('a damped arterial line takes down PPV alone when the PA line is sound', () => {
    const state = reduce(cleanChain(), {
      type: 'SET_ARTIFACT',
      artifact: 'overdamped',
      line: 'systemic-arterial',
    })
    expect(withheldResults(state)).toEqual(['pulsePressureVariationPercent'])
  })

  it('an arterial line repaired on its own gets PPV back while the PA line stays damped', () => {
    const state = reduce(
      cleanChain(),
      { type: 'SET_ARTIFACT', artifact: 'overdamped' },
      { type: 'SET_ARTIFACT', artifact: 'none', line: 'systemic-arterial' },
    )
    expect(withheldResults(state)).toEqual([
      'pulmonaryArteryPulsatilityIndex',
      'pulmonaryArteryCompliance',
    ])
  })

  it('a wedge stored during a false-wedge tracing is not rescued by clearing the artifact', () => {
    const opened = createInitialHemodynamicState(cleanCase, 'practice', 3469)
    const contaminated = reduce(
      storeWedge(
        reduce(
          opened,
          { type: 'ZERO_TRANSDUCER' },
          { type: 'SET_ARTIFACT', artifact: 'false-wedge' },
        ),
      ),
      { type: 'SET_ARTIFACT', artifact: 'none' },
    )
    expect(withheldResults(acceptThree(contaminated))).toEqual([
      'pulmonaryVascularResistance',
      'pulmonaryVascularResistanceIndex',
    ])
  })

  it('a wedge stored before zeroing is not rescued by zeroing afterwards', () => {
    const opened = createInitialHemodynamicState(cleanCase, 'practice', 3469)
    const zeroedLate = reduce(storeWedge(opened), { type: 'ZERO_TRANSDUCER' })
    expect(withheldResults(acceptThree(zeroedLate))).toEqual([
      'pulmonaryVascularResistance',
      'pulmonaryVascularResistanceIndex',
    ])
  })

  it('a clean stored wedge survives a false-wedge tracing that appears later', () => {
    const state = reduce(cleanChain(), { type: 'SET_ARTIFACT', artifact: 'false-wedge' })
    expect(withheldResults(state)).toEqual([])
  })

  it('a damping ratio that stays out of range stays a fault after the artifact is cleared', () => {
    const state = reduce(
      cleanChain(),
      { type: 'SET_DAMPING', dampingRatio: 0.28 },
      { type: 'SET_ARTIFACT', artifact: 'none' },
    )
    expect(state.measurementSystem.artifact).toBe('none')
    expect(withheldResults(state)).toEqual([
      'pulmonaryArteryPulsatilityIndex',
      'pulmonaryArteryCompliance',
      'pulsePressureVariationPercent',
    ])
  })

  it('repairing the line brings the results back without being asked twice', () => {
    const broken = reduce(cleanChain(), { type: 'SET_ARTIFACT', artifact: 'wall-contact' })
    expect(withheldResults(broken)).not.toEqual([])
    cleanup()
    expect(withheldResults(reduce(broken, { type: 'SET_ARTIFACT', artifact: 'none' }))).toEqual([])
  })
})

describe('what the drawer says about a withheld result', () => {
  it('names the unreliable measurements and the fault on the result itself', () => {
    const results = drawerResults(
      reduce(cleanChain(), { type: 'SET_TRANSDUCER_LEVEL', levelCm: 10 }),
    )
    expect(results.get('systemicVascularResistance')!.querySelector('p')?.textContent).toBe(
      'Unreliable input: Mean arterial pressure, Right atrial pressure (transducer off level).',
    )
  })

  it('puts the reason ahead of the reading guide so it is the first thing under the label', () => {
    const results = drawerResults(
      reduce(cleanChain(), { type: 'SET_ARTIFACT', artifact: 'false-wedge' }),
    )
    expect(results.get('pulmonaryVascularResistance')!.querySelector('strong')).not.toBeNull()
    cleanup()
    const withheld = drawerResults(
      reduce(cleanChain(), { type: 'SET_ARTIFACT', artifact: 'wall-contact' }),
    )
    const children = [...withheld.get('pulmonaryVascularResistance')!.children].map(
      (child) => child.tagName,
    )
    expect(children.indexOf('P')).toBeLessThan(children.indexOf('DL'))
  })

  it('states each fault, what it reaches, and what is still available', () => {
    drawerResults(reduce(cleanChain(), { type: 'SET_TRANSDUCER_LEVEL', levelCm: -10 }))
    const summary = document.querySelector('[data-derived-signal-faults]')!
    expect(summary.textContent).toMatch(/10 cm below the phlebostatic axis/)
    expect(summary.textContent).toMatch(/Pulse pressure is unchanged/)
    expect(summary.textContent).toMatch(/Affects: Mean arterial pressure, Right atrial pressure/)
    expect(summary.textContent).toMatch(/Still available.*CI, SV, SVI, PPV\./)
  })

  it('shows no fault summary on a clean chain', () => {
    drawerResults(cleanChain())
    expect(document.querySelector('[data-derived-signal-faults]')).toBeNull()
  })

  it('tells the learner to read a new wedge when the stored one carries the fault', () => {
    const opened = createInitialHemodynamicState(cleanCase, 'practice', 3469)
    const stored = reduce(
      storeWedge(
        reduce(
          opened,
          { type: 'ZERO_TRANSDUCER' },
          { type: 'SET_ARTIFACT', artifact: 'false-wedge' },
        ),
      ),
      { type: 'SET_ARTIFACT', artifact: 'none' },
    )
    drawerResults(acceptThree(stored))
    const summary = document.querySelector('[data-derived-signal-faults]')!
    expect(summary.textContent).toMatch(/stored wedge was read with false wedge/)
    expect(summary.textContent).toMatch(/read a new wedge/)
    expect(summary.textContent).not.toMatch(/The wedge tracing is a false wedge/)
  })

  it('reads the troubleshooting case as five separate faults', () => {
    const state = createInitialHemodynamicState(hemodynamicCaseById.get('HD-08')!, 'practice', 3469)
    drawerResults(acceptThree(state))
    const faults = [...document.querySelectorAll('[data-derived-signal-faults] p')]
    expect(faults).toHaveLength(5)
    expect(screen.getByText(/The arterial line is underdamped/)).toBeInTheDocument()
  })
})
