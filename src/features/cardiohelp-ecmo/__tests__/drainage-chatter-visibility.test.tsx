import { fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { cardiohelpLearnLessons } from '../content/learnLessons'
import {
  createInitialSimulationState,
  ecmoSimulationReducer,
  type EcmoSimulationState,
  type GuidedWalkthroughStep,
} from '../engine'
import { CircuitAndMonitors } from '../components/CircuitAndMonitors'
import { EcmoCircuit3D } from '../components/EcmoCircuit3D'
import { chatterPinchAmount, drainageChatterActive } from '../components/ecmo-circuit/chatter'

/**
 * Drainage chatter must be *visible*, and visible from the engine's own flag.
 *
 * Owner smoke test, 2026-08-06: `preload-drainage-collapse` opens on the bedside 3D circuit, the
 * lesson and the teaching pane both describe a juddering drainage line, `state.circuit.drainageChatter`
 * is true — and the 3D limb sat perfectly still. The bedside scene gated its suck-down on a second,
 * independent rule (`pVen.displayed <= -300`) that no authored drainage scenario reaches: the
 * preload sweep bottoms out near −143 mmHg, and the only state that does reach −350 is a closed
 * drainage clamp, whose narrower pinch then wins the `collapse > pinch` race inside `FlowTube`.
 *
 * jsdom cannot rasterise the scene, so the visual claim is pinned where it can be: the shared
 * chatter module both surfaces read, the DOM cues around the viewport, and a source contract that
 * the dead threshold has not come back.
 */

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

const SOURCE_ROOT = join(__dirname, '..', 'components')

function sourceOf(...segments: string[]): string {
  return readFileSync(join(SOURCE_ROOT, ...segments), 'utf8')
}

/** The authored preload case, run up to a settled chattering state. */
function chatteringState(scenarioId = 'preload-drainage-collapse'): EcmoSimulationState {
  let state = createInitialSimulationState(scenarioId, 'guided')
  for (let tick = 0; tick < 12; tick += 1) state = ecmoSimulationReducer(state, { type: 'STEP' })
  return state
}

function committed(state: EcmoSimulationState): EcmoSimulationState {
  return ecmoSimulationReducer(state, {
    type: 'COMMIT_PREDICTION',
    goalId: 'restore-drainage',
    control: 'rpm',
    direction: 'decrease',
  })
}

function allSteps(): readonly GuidedWalkthroughStep[] {
  return cardiohelpLearnLessons.flatMap((lesson) => lesson.steps)
}

function stepById(id: string): GuidedWalkthroughStep {
  const found = allSteps().find((step) => step.id === id)
  if (!found) throw new Error(`No guided step ${id}`)
  return found
}

describe('the engine flag, and nothing else, decides that the limb is chattering', () => {
  it('is true on the authored preload case at its own opening speed', () => {
    const state = chatteringState()
    expect(state.circuit.drainageChatter).toBe(true)
    expect(drainageChatterActive(state)).toBe(true)

    // The exact reason the old visual rule never fired.
    expect(state.circuit.readouts.pVen.displayed ?? 0).toBeGreaterThan(-300)
  })

  it('clears when the drainage cause is corrected', () => {
    let state = chatteringState()
    state = ecmoSimulationReducer(state, { type: 'CORRECT_FAULT', fault: 'preload-limited' })
    for (let tick = 0; tick < 6; tick += 1) state = ecmoSimulationReducer(state, { type: 'STEP' })
    expect(state.circuit.drainageChatter).toBe(false)
    expect(drainageChatterActive(state)).toBe(false)
  })

  it('is not shown on a stopped pump', () => {
    const state = chatteringState()
    const stopped = { ...state, device: { ...state.device, pumpRunning: false } }
    expect(drainageChatterActive(stopped)).toBe(false)
  })

  it('holds for the VA sibling too', () => {
    expect(drainageChatterActive(chatteringState('va-preload-drainage-collapse'))).toBe(true)
  })

  it('no longer carries a second pressure threshold of the view own', () => {
    const scene = sourceOf('ecmo-circuit', 'BedsideScene.tsx')
    // Strip comments first: the removed rule is quoted in one, and that quote is the point.
    const code = scene.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/readouts\.pVen/)
    expect(code).not.toMatch(/-\s*300/)
    expect(code).toContain('drainageChatterActive(state)')
    expect(code).toContain('chatter={drainageChattering}')
  })
})

describe('the 3D limb judders, and stops juddering under reduced motion', () => {
  const phases = Array.from({ length: 24 }, (_, index) => index / 24)

  it('sweeps a wide range of crimp across the chatter cycle', () => {
    const amounts = phases.map((phase) =>
      chatterPinchAmount({ collapse: 1, phase, reduceMotion: false }),
    )
    const min = Math.min(...amounts)
    const max = Math.max(...amounts)

    // A visible repeated suck-down, not a hum: the deepest crimp is several times the shallowest.
    expect(max - min).toBeGreaterThan(0.4)
    expect(max).toBeGreaterThan(0.55)
    expect(min).toBeLessThan(0.15)
  })

  it('holds one deep, unmistakable value when motion is reduced', () => {
    const amounts = phases.map((phase) =>
      chatterPinchAmount({ collapse: 1, phase, reduceMotion: true }),
    )
    expect(new Set(amounts).size).toBe(1)
    // Deeper than the old static collapse (0.35), so a still frame still reads as a drawn-shut limb.
    expect(amounts[0]).toBeGreaterThan(0.35)
  })

  it('affects only the drainage limb', () => {
    const scene = sourceOf('ecmo-circuit', 'BedsideScene.tsx')
    expect(scene.match(/chatter=\{/g)).toHaveLength(1)
    // No camera or scene-wide shake was introduced.
    expect(scene).not.toMatch(/camera\.position\.(x|y|z)\s*\+=/)
  })

  it('keeps the reduced-motion CSS switch over the map animation', () => {
    const css = sourceOf('cardiohelp-ecmo.module.css')
    const reducedBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reducedBlock).toContain('.chatteringTube')
    expect(reducedBlock).toContain('animation: none !important')
    // And the map's chatter cue does not depend on that animation.
    expect(css).toContain('.chatteringTube .drainageLimb')
    expect(css).toContain('stroke-dasharray')
  })
})

describe('the pressure-zone map names the chattering limb', () => {
  it('marks the drainage limb and spells the state out in words', () => {
    render(
      <CircuitAndMonitors state={chatteringState()} dispatch={jest.fn()} controlsEnabled={false} />,
    )
    fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))

    const limb = document.querySelector('[data-limb="drainage"]')
    expect(limb).toHaveAttribute('data-chattering', 'true')
    expect(screen.getByText('DRAINAGE CHATTER')).toBeInTheDocument()
  })

  it('drops both cues when the engine says the chatter has resolved', () => {
    let state = chatteringState()
    state = ecmoSimulationReducer(state, { type: 'CORRECT_FAULT', fault: 'preload-limited' })
    for (let tick = 0; tick < 6; tick += 1) state = ecmoSimulationReducer(state, { type: 'STEP' })

    render(<CircuitAndMonitors state={state} dispatch={jest.fn()} controlsEnabled={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))

    expect(document.querySelector('[data-limb="drainage"]')).not.toHaveAttribute('data-chattering')
    expect(screen.queryByText('DRAINAGE CHATTER')).not.toBeInTheDocument()
  })

  it('names a sign, not a diagnosis, before the learner has committed', () => {
    const state = chatteringState()
    expect(state.scenario.prediction.committed).toBe(false)

    render(<CircuitAndMonitors state={state} dispatch={jest.fn()} controlsEnabled={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))

    // The observe step asks the learner to see the chatter, so the cue is theirs to read. What must
    // not appear is the pattern it points to.
    expect(screen.getByText('DRAINAGE CHATTER')).toBeInTheDocument()
    expect(screen.queryByText(/Preload-limited drainage pattern/i)).not.toBeInTheDocument()
    expect(screen.getByText(/withheld until reassessment and reveal/i)).toBeInTheDocument()
  })
})

describe('the accessible interface still says chatter is present', () => {
  it('states it outside the aria-hidden viewport', () => {
    render(<EcmoCircuit3D state={chatteringState()} dispatch={jest.fn()} controlsEnabled={false} />)

    const chatterLine = screen.getByText(/Drainage chatter\./i).closest('p')
    expect(chatterLine).not.toBeNull()
    expect(chatterLine).toHaveAttribute('role', 'status')
    // The whole reason this line exists: everything inside the viewport is hidden from AT.
    expect(chatterLine?.closest('[aria-hidden="true"]')).toBeNull()
    expect(chatterLine?.textContent).toMatch(/judders/i)
    // And it does not claim the cue changed a measurement.
    expect(chatterLine?.textContent).toMatch(/pVen and flow are unchanged/i)
  })

  it('says nothing when there is no chatter', () => {
    const state = createInitialSimulationState('startup-sensor-orientation', 'guided')
    render(<EcmoCircuit3D state={state} dispatch={jest.fn()} controlsEnabled={false} />)
    expect(screen.queryByText(/Drainage chatter\./i)).not.toBeInTheDocument()
  })

  it('keeps the existing text callout on the circuit panel', () => {
    render(
      <CircuitAndMonitors
        state={committed(chatteringState())}
        dispatch={jest.fn()}
        controlsEnabled={false}
      />,
    )
    expect(screen.getByText(/drainage line chattering/i)).toBeInTheDocument()
  })
})

describe('a guided step names the circuit surface it is read on', () => {
  const pressureSteps = [
    'preload-drainage-collapse-observe',
    'preload-drainage-collapse-interpret',
    'afterload-return-obstruction-observe',
    'afterload-return-obstruction-interpret',
    'afterload-oxygenator-resistance-observe',
    'afterload-oxygenator-resistance-interpret',
    'va-preload-drainage-collapse-observe',
    'va-preload-drainage-collapse-interpret',
    'va-afterload-arterial-return-obstruction-observe',
    'va-afterload-arterial-return-obstruction-interpret',
    'va-afterload-oxygenator-resistance-observe',
    'va-afterload-oxygenator-resistance-interpret',
  ]

  it.each(pressureSteps)('%s opens on the pressure-zone map', (id) => {
    expect(stepById(id).preferredCircuitView).toBe('diagnostic')
  })

  const bedsideSteps = allSteps().filter((step) =>
    step.actions.some(
      (action) =>
        action.type === 'TOGGLE_CIRCUIT_CLAMP' || action.type === 'RESUME_SUPPORT_AFTER_BUBBLE',
    ),
  )

  it('covers every clamp and resumption step', () => {
    expect(bedsideSteps.length).toBeGreaterThan(0)
  })

  it.each(bedsideSteps.map((step) => [step.id, step] as const))(
    '%s prefers the bedside view, where the clamp is',
    (_id, step) => {
      expect(step.preferredCircuitView).toBe('bedside')
    },
  )

  it('does not force a view on steps that have no reason to', () => {
    expect(stepById('startup-orient-domains').preferredCircuitView).toBeUndefined()
    expect(stepById('startup-settle-circuit').preferredCircuitView).toBeUndefined()
  })

  it('keeps the circuit component free of scenario ids', () => {
    const source = sourceOf('CircuitAndMonitors.tsx')
    expect(source).not.toContain('preload-drainage-collapse')
    expect(source).not.toContain('state.scenario.scenarioId')
  })
})

describe('the circuit panel honours the step preference without trapping the learner', () => {
  const chatter = chatteringState()

  function renderWithPreference(view: 'bedside' | 'diagnostic', stepId: string) {
    return render(
      <CircuitAndMonitors
        state={chatter}
        dispatch={jest.fn()}
        controlsEnabled={false}
        circuitViewPreference={{ view, stepId }}
      />,
    )
  }

  it('opens on the map when the active step asks for it', () => {
    renderWithPreference('diagnostic', 'preload-drainage-collapse-observe')
    expect(screen.getByRole('tab', { name: /Pressure-zone map/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('still defaults to the bedside scene when no step asks', () => {
    render(<CircuitAndMonitors state={chatter} dispatch={jest.fn()} controlsEnabled={false} />)
    expect(screen.getByRole('tab', { name: /Bedside 3D circuit/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('respects a tab the learner picks while the step is still active', () => {
    const { rerender } = renderWithPreference('diagnostic', 'preload-drainage-collapse-observe')
    fireEvent.click(screen.getByRole('tab', { name: /Bedside 3D circuit/i }))
    expect(screen.getByRole('tab', { name: /Bedside 3D circuit/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    // Same step, re-rendered for any other reason: the learner's choice survives.
    rerender(
      <CircuitAndMonitors
        state={chatter}
        dispatch={jest.fn()}
        controlsEnabled={false}
        circuitViewPreference={{
          view: 'diagnostic',
          stepId: 'preload-drainage-collapse-observe',
        }}
      />,
    )
    expect(screen.getByRole('tab', { name: /Bedside 3D circuit/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('applies again when the learner moves to the next step that asks', () => {
    const { rerender } = renderWithPreference('diagnostic', 'preload-drainage-collapse-observe')
    fireEvent.click(screen.getByRole('tab', { name: /Bedside 3D circuit/i }))

    rerender(
      <CircuitAndMonitors
        state={chatter}
        dispatch={jest.fn()}
        controlsEnabled={false}
        circuitViewPreference={{
          view: 'diagnostic',
          stepId: 'preload-drainage-collapse-interpret',
        }}
      />,
    )
    expect(screen.getByRole('tab', { name: /Pressure-zone map/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('still reveals the bedside view when guided help points at a clamp', () => {
    const { rerender } = renderWithPreference('diagnostic', 'preload-drainage-collapse-observe')
    expect(screen.getByRole('tab', { name: /Pressure-zone map/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    rerender(
      <CircuitAndMonitors
        state={chatter}
        dispatch={jest.fn()}
        controlsEnabled={false}
        circuitViewPreference={{
          view: 'diagnostic',
          stepId: 'preload-drainage-collapse-observe',
        }}
        guidedControlId="cardiohelp-clamp-drainage"
      />,
    )
    expect(screen.getByRole('tab', { name: /Bedside 3D circuit/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('leaves the simulator state and the pressure readouts alone when the view changes', () => {
    const dispatch = jest.fn()
    render(
      <CircuitAndMonitors
        state={chatter}
        dispatch={dispatch}
        controlsEnabled={false}
        circuitViewPreference={{ view: 'diagnostic', stepId: 'preload-drainage-collapse-observe' }}
      />,
    )
    const readout = () => document.querySelector('[data-channel="pVen"]')?.textContent
    const before = readout()
    expect(before).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: /Bedside 3D circuit/i }))

    // Switching tabs is a view change and nothing else.
    expect(dispatch).not.toHaveBeenCalled()
    expect(readout()).toBe(before)
  })
})
