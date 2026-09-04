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

  it('no longer carries a second pressure threshold of the view’s own', () => {
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
    // Exactly one limb receives the chatter prop, and it is the drainage line.
    expect(scene.match(/chatter=\{/g)).toHaveLength(1)
    const drainageTube = scene.slice(scene.indexOf('curve={layout.drainageLine}'))
    expect(drainageTube.slice(0, drainageTube.indexOf('/>'))).toContain(
      'chatter={drainageChattering}',
    )
  })

  it('keeps the reduced-motion CSS switch over the map animation', () => {
    const css = sourceOf('cardiohelp-ecmo.module.css')
    /*
     * The `animation: none !important` rule, not "somewhere after the first reduced-motion
     * at-rule". Slicing to end of file swept in the plain `.chatteringTube` rules and a different
     * block's `animation: none`, so deleting `.chatteringTube` from the rule that matters still
     * passed — the test named a regression it could not see.
     */
    const rules = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/g)]
    expect(rules.length).toBeGreaterThan(0)
    const switchesOffChatter = rules.some(
      (rule) =>
        rule[1].includes('.chatteringTube') && rule[1].includes('animation: none !important'),
    )
    expect(switchesOffChatter).toBe(true)

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
  it('states it outside both tabpanels, so the selected view cannot hide it', () => {
    render(
      <CircuitAndMonitors state={chatteringState()} dispatch={jest.fn()} controlsEnabled={false} />,
    )

    // The <strong> inside the paragraph matches the same text, so query the paragraph itself.
    const line = [...document.querySelectorAll('p[role="status"]')].find((node) =>
      /Drainage chatter\./i.test(node.textContent ?? ''),
    )
    expect(line).toBeDefined()
    expect(line?.textContent).toMatch(/judders/i)
    // It says the marker is presentational without claiming the numbers have not moved — they have.
    expect(line?.textContent).toMatch(/does not change any displayed number/i)

    /*
     * The reason this lives here and not in `EcmoCircuit3D`. Inside the bedside tabpanel it carried
     * `hidden` whenever the map was selected — and the drainage lesson now *opens* on the map, so
     * the one line written to reach a screen reader was hidden exactly when it mattered.
     */
    expect(line?.closest('[hidden]')).toBeNull()
    expect(line?.closest('[aria-hidden="true"]')).toBeNull()
    expect(line?.closest('#cardiohelp-bedside-view')).toBeNull()
    expect(line?.closest('#cardiohelp-diagnostic-view')).toBeNull()
  })

  it('survives switching to the pressure-zone map', () => {
    render(
      <CircuitAndMonitors state={chatteringState()} dispatch={jest.fn()} controlsEnabled={false} />,
    )
    fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))
    const line = [...document.querySelectorAll('p[role="status"]')].find((node) =>
      /Drainage chatter\./i.test(node.textContent ?? ''),
    )
    expect(line).toBeDefined()
    expect(line?.closest('[hidden]')).toBeNull()
  })

  it('says nothing when there is no chatter', () => {
    const state = createInitialSimulationState('startup-sensor-orientation', 'guided')
    render(<CircuitAndMonitors state={state} dispatch={jest.fn()} controlsEnabled={false} />)
    expect(document.querySelector('p[role="status"]')).toBeNull()
  })

  it('says nothing once the pump is stopped, even though the engine flag is still set', () => {
    /*
     * Closing the drainage clamp stops the pump and leaves `drainageChatter` true. Every surface
     * has to agree about that, or the map paints a juddering limb on an isolated circuit reading
     * 0.00 L/min while the bedside scene shows a limb at rest.
     */
    let state = chatteringState()
    state = committed(state)
    state = ecmoSimulationReducer(state, { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage' })
    for (let tick = 0; tick < 4; tick += 1) state = ecmoSimulationReducer(state, { type: 'STEP' })
    expect(state.circuit.drainageChatter).toBe(true)
    expect(state.device.pumpRunning).toBe(false)
    expect(drainageChatterActive(state)).toBe(false)

    render(<CircuitAndMonitors state={state} dispatch={jest.fn()} controlsEnabled={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))

    expect(
      [...document.querySelectorAll('p[role="status"]')].some((node) =>
        /Drainage chatter\./i.test(node.textContent ?? ''),
      ),
    ).toBe(false)
    expect(screen.queryByText('DRAINAGE CHATTER')).not.toBeInTheDocument()
    expect(document.querySelector('[data-limb="drainage"]')).not.toHaveAttribute('data-chattering')
    expect(document.getElementById('circuit-svg-desc')?.textContent ?? '').not.toMatch(/chatter/i)
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
    expect(stepById('startup-screen-parameters').preferredCircuitView).toBeUndefined()
    expect(stepById('startup-settle-circuit').preferredCircuitView).toBeUndefined()
  })

  it('opens the pressure-zone map on the tour’s circuit step, which is about where the sensors sit', () => {
    // This step used to be the example of one with no reason to force a view. It gained one in
    // September 2026 when the small map the tour's panel drew was retired: the pressure-zone map
    // draws every sensor with a leader to its place, which is the tour's subject.
    expect(stepById('startup-orient-domains').preferredCircuitView).toBe('diagnostic')
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
    const scroller = document.querySelector('[aria-label*="circuit diagram"]') as HTMLElement | null
    const before = readout()
    expect(before).toBeTruthy()
    if (scroller) scroller.scrollLeft = 120

    fireEvent.click(screen.getByRole('tab', { name: /Bedside 3D circuit/i }))
    fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))

    // Switching tabs is a view change and nothing else: no action reaches the engine, the readouts
    // do not move, and the diagram is not remounted (both panels stay mounted behind `hidden`).
    expect(dispatch).not.toHaveBeenCalled()
    expect(readout()).toBe(before)
    if (scroller) expect(scroller.scrollLeft).toBe(120)
  })
})

describe.each(['preload-drainage-collapse', 'va-preload-drainage-collapse'] as const)(
  '%s: the badge does not sit on another schematic label',
  (scenarioId) => {
    it('leaves every other text anchor outside its plate', () => {
      render(
        <CircuitAndMonitors
          state={chatteringState(scenarioId)}
          dispatch={jest.fn()}
          controlsEnabled={false}
        />,
      )
      fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))

      const badge = document.querySelector('g[class*="limbStatusBadge"]')
      expect(badge).not.toBeNull()
      const [, tx, ty] = /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(
        badge?.getAttribute('transform') ?? '',
      ) as RegExpExecArray
      const plate = badge?.querySelector('rect') as SVGRectElement
      const left = Number(tx) + Number(plate.getAttribute('x'))
      const top = Number(ty) + Number(plate.getAttribute('y'))
      const right = left + Number(plate.getAttribute('width'))
      const bottom = top + Number(plate.getAttribute('height'))

      /*
       * The plate is opaque and painted after the anatomy panel, so anything whose anchor falls
       * inside it is simply covered. At (286, 500) it swallowed the VA `DISTAL LIMB CHECK` label
       * whole. jsdom does no SVG layout, so anchors are the measurable proxy — enough to catch a
       * badge parked on top of another label.
       */
      const covered = [...document.querySelectorAll('svg text')]
        .map((node) => ({
          x: Number(node.getAttribute('x')),
          y: Number(node.getAttribute('y')),
          text: node.textContent?.trim() ?? '',
        }))
        .filter(
          (label) =>
            Number.isFinite(label.x) &&
            Number.isFinite(label.y) &&
            label.x >= left &&
            label.x <= right &&
            label.y >= top &&
            label.y <= bottom &&
            label.text !== 'DRAINAGE CHATTER',
        )
      expect(covered).toEqual([])
    })

    it('sits beside the limb it names, not down in the anatomy panel', () => {
      render(
        <CircuitAndMonitors
          state={chatteringState(scenarioId)}
          dispatch={jest.fn()}
          controlsEnabled={false}
        />,
      )
      fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))

      const badge = document.querySelector('g[class*="limbStatusBadge"]')
      const [, , ty] = /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(
        badge?.getAttribute('transform') ?? '',
      ) as RegExpExecArray
      const limbLabel = [...document.querySelectorAll('svg text')].find((node) =>
        /DRAINAGE LIMB/.test(node.textContent ?? ''),
      )
      // Within a label's height of the limb's own caption, rather than 139 px away under the feet.
      expect(Math.abs(Number(ty) - Number(limbLabel?.getAttribute('y')))).toBeLessThan(30)
    })
  },
)

describe('the map cue reaches assistive technology', () => {
  /*
   * The badge is drawn inside an SVG with role="img", so its text is not in the accessibility tree
   * — the accessible name and description come from the elements the SVG is labelled by. Without
   * this the cue would be visible-only, which is the same class of gap as the aria-hidden viewport.
   */
  it('names the chattering limb in the description the schematic is labelled by', () => {
    render(
      <CircuitAndMonitors state={chatteringState()} dispatch={jest.fn()} controlsEnabled={false} />,
    )
    fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))

    const description = document.getElementById('circuit-svg-desc')?.textContent ?? ''
    expect(description).toMatch(/drainage limb is currently marked as chattering/i)
    expect(description).toMatch(/DRAINAGE CHATTER/)
  })

  it('says nothing about chatter once it has resolved', () => {
    let state = chatteringState()
    state = ecmoSimulationReducer(state, { type: 'CORRECT_FAULT', fault: 'preload-limited' })
    for (let tick = 0; tick < 6; tick += 1) state = ecmoSimulationReducer(state, { type: 'STEP' })

    render(<CircuitAndMonitors state={state} dispatch={jest.fn()} controlsEnabled={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))

    expect(document.getElementById('circuit-svg-desc')?.textContent ?? '').not.toMatch(/chatter/i)
  })
})
