import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { HemodynamicCaseActivity } from '../components/HemodynamicCaseActivity'
import { IcuHemodynamicsAssessLandingV2 } from '../components/IcuHemodynamicsAssessLandingV2'
import { HemodynamicsSimulatorPane } from '../components/stage/HemodynamicsSimulatorPane'
import { LineDock } from '../components/stage/StageDocks'
import { ThermodilutionTrialCard } from '../components/ThermodilutionTrialReview'
import { hemodynamicCaseById } from '../content'
import { hemodynamicsTaskPresentation } from '../content/taskPresentation'
import { catheterTransitionHold } from '../engine/catheterSafety'
import { displaySeamsFor, displaySeamWords } from '../engine/displaySeams'
import { thermodilutionSeriesView } from '../engine/measurementProvenance'
import { withOpeningTrace } from '../engine/simulation'
import {
  capstoneState,
  cleanState,
  dampedArterialState,
  dampedLineState,
  faultyLineState,
  freshTeachingState,
  reduceAll,
  threeTrialState,
} from '../engine/stageRuntime'
import { INJECTION_TECHNIQUE_CURVE_NOTE } from '../engine/thermodilution'
import type { HemodynamicSimulationState } from '../engine/types'

const push = jest.fn()

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
  useRouter: () => ({ push }),
}))
jest.mock('../components/HemodynamicHeart3DDynamic', () => ({
  HemodynamicHeart3DDynamic: () => <div>Mock heart</div>,
}))

afterEach(cleanup)

/**
 * HD-PRE-REVIEW-03 — the workbench, and what it must not disturb.
 *
 * The visual changes in this batch added one piece of engine state (display seams) and changed how
 * lesson openings fill the waveform buffer. Both are pinned here against the Task-01 safety model
 * and the Task-02 measurement and provenance model: neither may move a measurement, an episode, a
 * series identity or a catheter flag.
 */

function withoutSeams(state: HemodynamicSimulationState) {
  const rest = { ...state }
  delete rest.displaySeams
  return rest
}

describe('display seams are a record of the display, and of nothing else', () => {
  it('marks an accepted change of height, zero or line response with the channels it reached', () => {
    const start = reduceAll(freshTeachingState(700), [{ type: 'TICK', seconds: 1 }])
    const moved = reduceAll(start, [{ type: 'SET_TRANSDUCER_LEVEL', levelCm: 8 }])
    expect(moved.displaySeams).toEqual([
      {
        kind: 'transducer-height',
        scope: 'all-pressure-lines',
        fromSeconds: start.timeSeconds,
        untilSeconds: start.timeSeconds,
      },
    ])
    const zeroed = reduceAll(moved, [{ type: 'TICK', seconds: 2 }, { type: 'ZERO_TRANSDUCER' }])
    expect(zeroed.displaySeams?.map((seam) => seam.kind)).toEqual(['transducer-height', 'zero'])
    const damped = reduceAll(zeroed, [
      { type: 'TICK', seconds: 2 },
      { type: 'SET_DAMPING', dampingRatio: 1.2, line: 'systemic-arterial' },
    ])
    const arterial = damped.displaySeams!.at(-1)!
    expect(arterial).toMatchObject({ kind: 'line-response', scope: 'systemic-arterial-line' })
    expect(displaySeamWords(arterial)).toBe('arterial line response changed')
    // An arterial-only change marks the arterial strip and no other.
    expect(displaySeamsFor(damped, 'systemic-arterial')).toHaveLength(3)
    expect(displaySeamsFor(damped, 'other-pressure')).toHaveLength(2)
  })

  it('records nothing for an action that changed no sample', () => {
    const state = reduceAll(cleanState(510, 'pa'), [{ type: 'TICK', seconds: 1 }])
    expect(state.displaySeams).toEqual([])
    for (const action of [
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: 0 },
      { type: 'ZERO_TRANSDUCER' },
      { type: 'SET_ARTIFACT', artifact: 'none' },
      { type: 'SET_DAMPING', dampingRatio: 0.65 },
    ] as const) {
      expect(reduceAll(state, [action]).displaySeams).toEqual([])
    }
  })

  it('keeps one seam while a control is dragged, and drops seams that have scrolled away', () => {
    const state = reduceAll(cleanState(510, 'pa'), [{ type: 'TICK', seconds: 1 }])
    const dragged = reduceAll(state, [
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: -2 },
      { type: 'TICK', seconds: 0.2 },
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: -6 },
      { type: 'TICK', seconds: 0.2 },
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: -10 },
    ])
    expect(dragged.displaySeams).toHaveLength(1)
    expect(
      dragged.displaySeams![0].untilSeconds - dragged.displaySeams![0].fromSeconds,
    ).toBeCloseTo(0.4, 5)
    const later = reduceAll(dragged, [
      { type: 'TICK', seconds: 14 },
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: 0 },
    ])
    expect(later.displaySeams).toHaveLength(1)
    expect(later.displaySeams![0].fromSeconds).toBe(later.timeSeconds)
  })

  it('changes no measurement, episode, series, catheter flag or stored value (Tasks 01 and 02)', () => {
    const before = reduceAll(threeTrialState(510), [{ type: 'TICK', seconds: 1 }])
    const after = reduceAll(before, [{ type: 'SET_TRANSDUCER_LEVEL', levelCm: -10 }])
    expect(after.physiologicalEpisode).toBe(before.physiologicalEpisode)
    expect(after.physiologicalEpisodes).toBe(before.physiologicalEpisodes)
    expect(after.sessionId).toBe(before.sessionId)
    expect(after.catheter).toBe(before.catheter)
    expect(after.thermodilutionTrials).toBe(before.thermodilutionTrials)
    expect(thermodilutionSeriesView(after).current.identity.key).toBe(
      thermodilutionSeriesView(before).current.identity.key,
    )
    expect(after.waveforms).toBe(before.waveforms)
    expect(catheterTransitionHold(after)).toEqual(catheterTransitionHold(before))
    // A refused action leaves no seam either: the flush interlock is untouched.
    const wedged = capstoneState(808)
    const refused = reduceAll(wedged, [{ type: 'FAST_FLUSH', lineType: 'pulmonary-artery' }])
    expect(refused.responseMessage).toMatch(/flush blocked/i)
    expect(refused.displaySeams ?? []).toEqual(wedged.displaySeams ?? [])
  })
})

describe('a lesson opens on the tracing its own measurement system draws', () => {
  it('has no step in the opening buffer and no seam to explain one', () => {
    const clean = cleanState(510, 'pa')
    const unzeroed = freshTeachingState(510)
    expect(clean.displaySeams).toEqual([])
    expect(clean.waveforms).toHaveLength(unzeroed.waveforms.length)
    // The same patient, seed and sample times: the clean line reads exactly the zero offset lower
    // from its first sample to its last. Before this batch the buffer still held the unzeroed line.
    clean.waveforms.forEach((sample, index) => {
      expect(sample.time).toBe(unzeroed.waveforms[index].time)
      expect(unzeroed.waveforms[index].papMmHg - sample.papMmHg).toBeCloseTo(5, 6)
      expect(unzeroed.waveforms[index].artMmHg - sample.artMmHg).toBeCloseTo(5, 6)
    })
  })

  it('redraws nothing but the buffer', () => {
    for (const build of [
      () => cleanState(510, 'pa'),
      () => faultyLineState(510),
      () => dampedLineState(611),
      () => dampedArterialState(616),
      () => threeTrialState(510),
    ]) {
      const state = build()
      const redrawn = withOpeningTrace(state)
      // Idempotent: an opening is already the trace its own system draws.
      expect(redrawn.waveforms).toEqual(state.waveforms)
      expect(withoutSeams(redrawn)).toEqual(withoutSeams(state))
    }
    // The capstone is authored as it is and is not rebuilt.
    expect(capstoneState(808).displaySeams ?? []).toEqual([])
  })

  it('keeps the Task-02 line isolation: only the arterial line is damped in the arterial transfer', () => {
    const damped = dampedArterialState(616)
    const clean = cleanState(616, 'pa')
    damped.waveforms.forEach((sample, index) => {
      expect(sample.papMmHg).toBe(clean.waveforms[index].papMmHg)
      expect(sample.cvpMmHg).toBe(clean.waveforms[index].cvpMmHg)
    })
    const pulse = (state: HemodynamicSimulationState) => {
      const values = state.waveforms.map((sample) => sample.artMmHg)
      return Math.max(...values) - Math.min(...values)
    }
    expect(pulse(damped)).toBeLessThan(pulse(clean))
  })
})

describe('the arterial scale control acts on a visible arterial tracing or is not offered (L2-13)', () => {
  function pane(surface: 'line' | 'flush' | 'scale-demo' | 'capstone', section: string) {
    const state = surface === 'capstone' ? capstoneState(808) : cleanState(510, 'pa')
    const presentation = hemodynamicsTaskPresentation(
      section as never,
      {
        surface,
        interaction: { kind: surface === 'scale-demo' ? 'read' : 'simulator-task', goals: [] },
      } as never,
    )
    const dispatch = jest.fn()
    render(
      <HemodynamicsSimulatorPane
        state={state}
        dispatch={dispatch}
        surface={surface}
        flushLine="pulmonary-artery"
        controlsEnabled
        chamberLabel="shown"
        stops={[]}
        tipVisible
        presentation={presentation}
        baseline={state}
      />,
    )
    return { state, dispatch, presentation }
  }
  const strips = () =>
    [...document.querySelectorAll('[data-waveform-strip]')].map((node) =>
      node.getAttribute('data-waveform-strip'),
    )

  it.each(['line', 'flush'] as const)('withdraws it, with the reason, on a %s task', (surface) => {
    pane(surface, 'pressure-system')
    expect(strips()).not.toContain('artMmHg')
    expect(document.getElementById('hemodynamics-control-scale')).toBeNull()
    expect(document.querySelector('[data-scale-unavailable]')?.textContent).toMatch(
      /changes how the arterial\s+tracing is drawn/,
    )
  })

  it('offers it beside the arterial tracing, and it changes that tracing’s axis only', () => {
    const { dispatch } = pane('scale-demo', 'pressure-system')
    expect(strips()).toContain('artMmHg')
    const control = document.getElementById('hemodynamics-control-scale') as HTMLSelectElement
    fireEvent.change(control, { target: { value: '80' } })
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_PRESSURE_SCALE', maximum: 80 })
    cleanup()
    pane('capstone', 'pac-signal-validation')
    expect(strips()).toContain('artMmHg')
    expect(document.getElementById('hemodynamics-control-scale')).not.toBeNull()
  })

  it('is a change of view in the engine too: no sample, measurement or other axis moves', () => {
    const before = reduceAll(cleanState(510, 'pa'), [{ type: 'TICK', seconds: 1 }])
    const after = reduceAll(before, [{ type: 'SET_PRESSURE_SCALE', maximum: 80 }])
    expect(after.pressureScaleMmHg).toBe(80)
    expect(after.waveforms).toBe(before.waveforms)
    expect(after.measurements).toBe(before.measurements)
    expect(after.displaySeams).toBe(before.displaySeams)
    expect({ ...after, pressureScaleMmHg: before.pressureScaleMmHg }).toEqual(before)
  })

  it('keeps the control available to a caller that does not say what the monitor shows', () => {
    render(<LineDock state={cleanState(510, 'pa')} dispatch={jest.fn()} enabled />)
    expect(document.getElementById('hemodynamics-control-scale')).not.toBeNull()
  })
})

describe('a thermodilution trial says what its curve does not draw (L7-02)', () => {
  it('prints the note on the prolonged trial and on no other', () => {
    const [first, second] = threeTrialState(510).thermodilutionTrials
    const card = (trial: typeof first) =>
      render(
        <ThermodilutionTrialCard
          trial={trial}
          onReview={jest.fn()}
          onAccept={jest.fn()}
          onExclude={jest.fn()}
        />,
      )
    card(second)
    expect(document.querySelector('[data-trial-curve-model-note]')?.textContent).toBe(
      INJECTION_TECHNIQUE_CURVE_NOTE,
    )
    cleanup()
    card(first)
    expect(document.querySelector('[data-trial-curve-model-note]')).toBeNull()
  })
})

describe('Practice keeps its tools after a response is observed (P-03)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }),
    })
  })

  it('shows every checkpoint, returns to the actions, and resets nothing on the way', async () => {
    const definition = hemodynamicCaseById.get('HD-01')!
    render(<HemodynamicCaseActivity caseId="HD-01" mode="practice" />)
    expect(await screen.findByRole('heading', { name: definition.title })).toBeInTheDocument()

    // The checkpoints are in view, not inside a collapsed list.
    const checkpoints = screen.getByRole('navigation', { name: 'Case checkpoints' })
    expect(checkpoints.closest('details')).toBeNull()
    expect(within(checkpoints).getAllByRole('button')).toHaveLength(6)
    // The zeroing expectation is stated in the brief.
    expect(document.querySelector('[data-zero-expectation]')?.textContent).toMatch(
      /Zero it before you trust a\s+pressure/,
    )

    fireEvent.click(within(checkpoints).getByRole('button', { name: /Choose an action/ }))
    const legRaise = () => screen.getByRole('button', { name: (name) => name.includes('PLR') })
    fireEvent.click(legRaise())
    expect(legRaise()).toBeDisabled()
    const clock = () => document.querySelector('time')?.textContent
    const timeAfterAction = clock()

    fireEvent.click(screen.getByRole('button', { name: 'Observe the modeled response' }))
    expect(
      within(checkpoints).getByRole('button', { name: /Compare the response/ }),
    ).toHaveAttribute('aria-current', 'step')
    // The measurement tools are still usable while observing…
    expect(document.querySelector('[data-return-to-actions]')).not.toBeNull()
    expect(screen.queryByRole('button', { name: (name) => name.includes('PLR') })).toBeNull()

    // …and one press returns to the actions with the same patient.
    fireEvent.click(screen.getByRole('button', { name: 'Back to actions and measurements' }))
    expect(within(checkpoints).getByRole('button', { name: /Choose an action/ })).toHaveAttribute(
      'aria-current',
      'step',
    )
    // The leg raise is still spent: the case was not reset or regenerated.
    expect(legRaise()).toBeDisabled()
    expect(clock()).toBe(timeAfterAction)
    expect(
      screen
        .getAllByRole('status')
        .map((node) => node.textContent)
        .join(' '),
    ).toMatch(/everything measured so far are unchanged/)
    // A second action can follow the first.
    const fluid = screen.getByRole('button', { name: (name) => name.includes('Fluid') })
    expect(fluid).toBeEnabled()
  })

  it('has one main landmark to sit inside, on both landings', () => {
    const { container } = render(<IcuHemodynamicsAssessLandingV2 />)
    expect(container.querySelector('main')).toBeNull()
  })
})
