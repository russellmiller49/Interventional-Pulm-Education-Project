import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useReducer, useState, type AnchorHTMLAttributes, type ReactNode } from 'react'

import { CardiohelpConsole } from '../components/CardiohelpConsole'
import { CircuitAndMonitors } from '../components/CircuitAndMonitors'
import { EcmoLearnWorkspace } from '../components/EcmoLearnWorkspace'
import { resolveGuidedLesson } from '../components/LearnLessonPlayer'
import { requireEcmoLearnPrediction } from '../content/learnPredictionItems'
import {
  createInitialSimulationState,
  ecmoSimulationReducer,
  type GuidedControlId,
  type GuidedTarget,
} from '../engine'

/**
 * B3: the guided drill Learn route as three panes.
 *
 * The refactor moved the simulator, the teaching, and the task into separate scroll regions. Three
 * things had to survive that and are pinned here: the guided help request still finds, focuses, and
 * reveals a control that now lives in a different pane; the learner's step, committed answer, and
 * verdict survive every context and viewport change; and Continue stays a separate act from the
 * verdict appearing.
 *
 * jsdom computes no layout, so the responsive behaviour is driven two ways. The mode itself is
 * measured from `getBoundingClientRect`, which is stubbed per viewport below — that is real
 * behaviour and is asserted on the rendered DOM. What the mode then does to the *grid* is CSS, which
 * jsdom will not apply, so those rules are asserted against the stylesheet text the way the
 * foundation workspace's layout suite does.
 */

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const workspaceCss = readFileSync(
  join(process.cwd(), 'src/features/cardiohelp-ecmo/components/EcmoLearnWorkspace.module.css'),
  'utf8',
)

/**
 * Viewport width minus the module shell, activity chrome, and viewport padding above the workspace.
 *
 * Approximate on purpose: the workspace measures its own box at runtime and never reads the window,
 * so this constant exists only to name the four viewports the package was asked to validate in terms
 * of the frame width each one produces.
 */
const CHROME_ALLOWANCE_PX = 48

const VIEWPORTS = [
  { label: '1600 × 900', width: 1600, expectedMode: 'wide' },
  { label: '1440 × 900', width: 1440, expectedMode: 'laptop' },
  { label: '1280 × 720', width: 1280, expectedMode: 'laptop' },
  { label: '1024 × 768', width: 1024, expectedMode: 'compact' },
] as const

let originalGetBoundingClientRect: typeof HTMLElement.prototype.getBoundingClientRect
let originalResizeObserver: typeof globalThis.ResizeObserver
let resizeCallbacks: ResizeObserverCallback[] = []

function rectOf(width: number): DOMRect {
  return {
    width,
    height: 700,
    top: 0,
    left: 0,
    right: width,
    bottom: 700,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect
}

/**
 * Give the two elements that measure themselves a width, and everything else zero.
 *
 * The frame decides this module's mode; the shared workspace section decides its own compact mode
 * from the same box minus its padding and its separators. Both are stubbed so the two decisions
 * agree, which is the whole point of matching their thresholds.
 */
function stubFrameWidth(width: number) {
  HTMLElement.prototype.getBoundingClientRect = function measured(this: HTMLElement) {
    if (this.hasAttribute('data-ecmo-learn-workspace')) return rectOf(width)
    if (this.getAttribute('role') === 'separator') return rectOf(12)
    if (this.tagName === 'SECTION' && this.getAttribute('aria-label')?.startsWith('Guided ECMO')) {
      return rectOf(width)
    }
    return rectOf(0)
  }
}

beforeEach(() => {
  originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
  originalResizeObserver = globalThis.ResizeObserver
  resizeCallbacks = []
  globalThis.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      resizeCallbacks.push(callback)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  // Wide by default; individual tests narrow it.
  stubFrameWidth(1600 - CHROME_ALLOWANCE_PX)
})

afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
  globalThis.ResizeObserver = originalResizeObserver
})

function notifyResize() {
  act(() => {
    for (const callback of resizeCallbacks) {
      callback([], {} as ResizeObserver)
    }
  })
}

function WorkspaceHarness({
  initialScenarioId,
  onCompleteLesson = jest.fn(),
  onTryPractice = jest.fn(),
}: {
  readonly initialScenarioId: string
  readonly onCompleteLesson?: (scenarioId: string) => void
  readonly onTryPractice?: (scenarioId: string) => void
}) {
  const [scenarioId, setScenarioId] = useState(initialScenarioId)
  const [state, dispatch] = useReducer(ecmoSimulationReducer, initialScenarioId, (id) =>
    createInitialSimulationState(id, 'guided'),
  )
  const [guidedTarget, setGuidedTarget] = useState<GuidedTarget>('circuit')
  const [guidedControlId, setGuidedControlId] = useState<GuidedControlId | null>(null)
  const lesson = resolveGuidedLesson(scenarioId)

  // Exactly what the workbench does: one simulator node, handed to the workspace.
  const simulator = (
    <div>
      <CardiohelpConsole
        state={state}
        dispatch={dispatch}
        controlsEnabled
        guidedTarget={guidedTarget}
        guidedControlId={guidedControlId}
      />
      <CircuitAndMonitors
        state={state}
        dispatch={dispatch}
        controlsEnabled
        guidedTarget={guidedTarget}
        guidedControlId={guidedControlId}
      />
    </div>
  )

  return (
    <>
      <output data-testid="prediction">
        {[
          String(state.scenario.prediction.committed),
          state.scenario.prediction.goalId ?? '',
          state.scenario.prediction.control ?? '',
          state.scenario.prediction.direction ?? '',
        ].join('|')}
      </output>
      <output data-testid="scenario">{state.scenario.scenarioId}</output>
      <output data-testid="screen">{state.device.screen}</output>
      <EcmoLearnWorkspace
        state={state}
        lesson={lesson}
        dispatch={dispatch}
        simulator={simulator}
        onSelectLesson={(next) => {
          setScenarioId(next)
          dispatch({ type: 'LOAD_SCENARIO', scenarioId: next, mode: 'guided' })
        }}
        onCompleteLesson={onCompleteLesson}
        onTryPractice={onTryPractice}
        onTargetChange={setGuidedTarget}
        onControlHelpChange={setGuidedControlId}
      />
    </>
  )
}

function frame() {
  return document.querySelector('[data-ecmo-learn-workspace]')
}

/** Only this workspace's own pane tabs — the circuit view carries tablists of its own. */
function workspaceTabs() {
  return [...document.querySelectorAll('[data-ecmo-learn-workspace] [data-pane-tab]')]
}

function paneRegion(label: string) {
  return document.querySelector(`[role="region"][aria-label="${label} panel"]`)
}

/** Brings the current-task pane on screen, for the arrangements that show one pane at a time. */
function showTaskPane() {
  const tab = screen.queryByRole('tab', { name: 'Current task' })
  if (tab && tab.getAttribute('aria-selected') !== 'true') fireEvent.click(tab)
}

/** Takes the orientation lesson's first step, which opens onto the console tour. */
function advanceToPrediction() {
  showTaskPane()
  fireEvent.click(screen.getByRole('button', { name: /I can identify all four domains/i }))
  fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
}

describe('B3: the Learn workspace is three labelled panes over one simulator', () => {
  it('renders the live simulator, the teaching, and the current task as separate regions', () => {
    render(<WorkspaceHarness initialScenarioId="preload-drainage-collapse" />)

    expect(paneRegion('Live simulator')).not.toBeNull()
    expect(paneRegion('Teaching')).not.toBeNull()
    expect(paneRegion('Current task')).not.toBeNull()

    // One console and one circuit view, not a second copy built for the workspace: the guided help
    // targeting resolves controls with getElementById.
    expect(document.querySelectorAll('#cardiohelp-console')).toHaveLength(1)
    expect(document.querySelectorAll('#cardiohelp-circuit-panel')).toHaveLength(1)
  })

  it('puts the live drill panel and the step teaching in the teaching pane, and the task in its own', () => {
    render(<WorkspaceHarness initialScenarioId="preload-drainage-collapse" />)

    const teaching = paneRegion('Teaching')
    expect(teaching?.querySelector('[data-drill-panel="preload-drainage-collapse"]')).not.toBeNull()
    expect(teaching?.querySelector('[data-learn-step-teaching]')).not.toBeNull()

    const task = paneRegion('Current task')
    expect(
      within(task as HTMLElement).getByRole('button', { name: /Restart lesson/i }),
    ).toBeInTheDocument()
    // The task pane is the surface a learner acts through; the explanation is no longer fused into it.
    expect(task?.querySelector('[data-learn-step-teaching]')).toBeNull()
  })

  it('keeps the shared separators keyboard-operable between panes', () => {
    render(<WorkspaceHarness initialScenarioId="preload-drainage-collapse" />)
    const separators = screen.getAllByRole('separator')
    expect(separators.length).toBeGreaterThan(0)
    for (const separator of separators) {
      expect(separator).toHaveAttribute('tabindex', '0')
      expect(separator).toHaveAttribute('aria-orientation', 'vertical')
    }
    const before = Number(separators[0].getAttribute('aria-valuenow'))
    fireEvent.keyDown(separators[0], { key: 'ArrowLeft' })
    expect(Number(separators[0].getAttribute('aria-valuenow'))).not.toBe(before)
  })
})

describe('B3: guided help still reaches the live control across the pane boundary', () => {
  it('focuses the console control named by the step, from the task pane', async () => {
    render(<WorkspaceHarness initialScenarioId="startup-sensor-orientation" />)
    advanceToPrediction()

    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))
    const parameters = document.getElementById('cardiohelp-screen-parameters')
    expect(parameters).not.toBeNull()
    await waitFor(() => expect(parameters).toHaveFocus())
    // The control it focused lives in the primary pane, not in the pane the button was pressed in.
    expect(paneRegion('Live simulator')?.contains(parameters)).toBe(true)
  })

  it('brings the simulator pane back on screen first when the learner is on another tab', async () => {
    stubFrameWidth(1024 - CHROME_ALLOWANCE_PX)
    render(<WorkspaceHarness initialScenarioId="startup-sensor-orientation" />)
    notifyResize()
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-mode', 'compact'))

    fireEvent.click(screen.getByRole('tab', { name: 'Current task' }))
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-context', 'tertiary'))
    expect(paneRegion('Live simulator')).toHaveAttribute('hidden')

    advanceToPrediction()
    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))

    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-context', 'primary'))
    expect(paneRegion('Live simulator')).not.toHaveAttribute('hidden')
    await waitFor(() =>
      expect(document.getElementById('cardiohelp-screen-parameters')).toHaveFocus(),
    )
  })

  it('clears the help target when the step changes', async () => {
    const onControlHelpChange = jest.fn()
    function Harness() {
      const [state, dispatch] = useReducer(ecmoSimulationReducer, 'gas-source-interruption', (id) =>
        createInitialSimulationState(id, 'guided'),
      )
      return (
        <EcmoLearnWorkspace
          state={state}
          lesson={resolveGuidedLesson('gas-source-interruption')}
          dispatch={dispatch}
          simulator={<CardiohelpConsole state={state} dispatch={dispatch} controlsEnabled />}
          onSelectLesson={jest.fn()}
          onCompleteLesson={jest.fn()}
          onTryPractice={jest.fn()}
          onTargetChange={jest.fn()}
          onControlHelpChange={onControlHelpChange}
        />
      )
    }
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: /Advance 5 simulated seconds/i }))
    fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
    await waitFor(() => expect(onControlHelpChange).toHaveBeenLastCalledWith(null))
  })
})

describe('B3: the learner’s state survives every layout change', () => {
  it('keeps the committed answer, the verdict, and a separate Continue across a context switch', async () => {
    stubFrameWidth(1280 - CHROME_ALLOWANCE_PX)
    render(<WorkspaceHarness initialScenarioId="preload-drainage-collapse" />)
    notifyResize()
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-mode', 'laptop'))

    // Answer the prediction on the current-task tab.
    fireEvent.click(screen.getByRole('button', { name: /Inspect the starting pattern/i }))
    fireEvent.click(screen.getByRole('button', { name: /Next step/i }))

    const prediction = requireEcmoLearnPrediction('preload-drainage-collapse')
    const best = prediction.item.choices.find((choice) => choice.plausibility === 'best')
    if (!best) throw new Error('No best choice authored')
    fireEvent.click(screen.getByRole('radio', { name: best.label }))
    fireEvent.click(screen.getByRole('button', { name: /Commit this prediction/i }))

    expect(screen.getByTestId('prediction').textContent).toBe(
      `true|${prediction.commitments[best.id].goalId}|${prediction.commitments[best.id].control}|${prediction.commitments[best.id].direction}`,
    )
    const verdict = document.querySelector('[data-answer-verdict]')
    expect(verdict).not.toBeNull()
    // The verdict is on screen and the step has not moved: Continue is still a separate act.
    expect(document.querySelector('[data-verdict-continue]')).not.toBeNull()

    // Switch to Teaching and back.
    fireEvent.click(screen.getByRole('tab', { name: 'Teaching' }))
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-context', 'secondary'))
    fireEvent.click(screen.getByRole('tab', { name: 'Current task' }))
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-context', 'tertiary'))

    // Nothing was remounted: the engine still holds the commitment, the radio is still checked and
    // locked, and the verdict is still the same one.
    expect(screen.getByTestId('prediction').textContent).toContain('true|')
    expect(screen.getByRole('radio', { name: best.label })).toBeChecked()
    expect(screen.getByRole('radio', { name: best.label })).toBeDisabled()
    expect(document.querySelector('[data-answer-verdict]')).not.toBeNull()
    expect(document.querySelector('[data-verdict-continue]')).not.toBeNull()
  })

  it('does not reset the simulator or the step when the compact tabs are switched', async () => {
    stubFrameWidth(1024 - CHROME_ALLOWANCE_PX)
    render(<WorkspaceHarness initialScenarioId="startup-sensor-orientation" />)
    notifyResize()
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-mode', 'compact'))

    advanceToPrediction()
    // The console control the step asks for is on another tab, so the help request is what brings
    // it back. Operating it there is the whole cross-pane path in one act.
    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-context', 'primary'))
    const parameters = document.getElementById('cardiohelp-screen-parameters')
    if (!parameters) throw new Error('The console did not render the PARAM control')
    fireEvent.click(parameters)
    expect(screen.getByTestId('screen').textContent).toBe('parameters')

    for (const tab of ['Teaching', 'Current task', 'Live simulator']) {
      fireEvent.click(screen.getByRole('tab', { name: tab }))
    }

    // The simulator kept the screen the learner opened, and the lesson kept its step.
    expect(screen.getByTestId('screen').textContent).toBe('parameters')
    expect(screen.getByTestId('scenario').textContent).toBe('startup-sensor-orientation')
    expect(document.querySelectorAll('#cardiohelp-console')).toHaveLength(1)
  })

  it('keeps the transfer scenario load and the completion hand-off intact', async () => {
    const onCompleteLesson = jest.fn()
    const onTryPractice = jest.fn()
    render(
      <WorkspaceHarness
        initialScenarioId="vv-recirculation"
        onCompleteLesson={onCompleteLesson}
        onTryPractice={onTryPractice}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Inspect the starting pattern/i }))
    fireEvent.click(screen.getByRole('button', { name: /Next step/i }))

    const prediction = requireEcmoLearnPrediction('vv-recirculation')
    const best = prediction.item.choices.find((choice) => choice.plausibility === 'best')
    if (!best) throw new Error('No best choice authored')
    fireEvent.click(screen.getByRole('radio', { name: best.label }))
    fireEvent.click(screen.getByRole('button', { name: /Commit this prediction/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Continue$/i }))

    fireEvent.click(
      screen.getByRole('button', { name: /Correct the cannula\/recirculation cause/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
    fireEvent.click(
      screen.getByRole('button', { name: /Advance 1 second and inspect the response/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /Next step/i }))

    // The transfer step loads a different case, and the teaching pane follows the circuit rather
    // than the lesson: the recirculation panel is not shown over the hypercapnia case.
    expect(screen.getByTestId('scenario').textContent).toBe('acute-hypercapnia')
    expect(document.querySelector('[data-drill-panel="vv-recirculation"]')).toBeNull()
    expect(document.querySelector('[data-drill-panel-unavailable]')).not.toBeNull()

    // The transfer step is operated on the real gas control, exactly as it was before the split.
    const sweepControl = screen.getByRole('slider', { name: 'Sweep flow control' })
    fireEvent.change(sweepControl, { target: { value: '4' } })
    await waitFor(() => expect(onCompleteLesson).toHaveBeenCalledWith('vv-recirculation'))
    expect(screen.getByRole('heading', { name: /Lesson worked through/i })).toBeInTheDocument()
  })

  it('keeps the pathway navigation reachable from the task pane', () => {
    render(<WorkspaceHarness initialScenarioId="preload-drainage-collapse" />)
    const task = paneRegion('Current task') as HTMLElement
    expect(within(task).getByRole('button', { name: /Previous lesson/i })).toBeInTheDocument()
    expect(within(task).getByRole('button', { name: /Next lesson/i })).toBeInTheDocument()
    expect(within(task).getByRole('heading', { name: /Guided lessons/i })).toBeInTheDocument()
  })
})

describe('B3: responsive behaviour at the four validated viewports', () => {
  it.each(VIEWPORTS)(
    '$label resolves to the $expectedMode arrangement',
    async ({ width, expectedMode }) => {
      stubFrameWidth(width - CHROME_ALLOWANCE_PX)
      render(<WorkspaceHarness initialScenarioId="preload-drainage-collapse" />)
      notifyResize()
      await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-mode', expectedMode))
    },
  )

  it('keeps the live signal and the current task simultaneously reachable at 1280 × 720', async () => {
    stubFrameWidth(1280 - CHROME_ALLOWANCE_PX)
    render(<WorkspaceHarness initialScenarioId="preload-drainage-collapse" />)
    notifyResize()
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-mode', 'laptop'))

    // The simulator is never taken off screen at this size, and the task is the default context.
    expect(paneRegion('Live simulator')).not.toHaveAttribute('hidden')
    expect(frame()).toHaveAttribute('data-workspace-context', 'tertiary')
    expect(screen.getByRole('tab', { name: 'Current task' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    // Teaching is one keyboard-reachable tab away, and it does not cover the console.
    const teachingTab = screen.getByRole('tab', { name: 'Teaching' })
    expect(teachingTab.tagName).toBe('BUTTON')
    fireEvent.click(teachingTab)
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-context', 'secondary'))
    expect(paneRegion('Live simulator')).not.toHaveAttribute('hidden')
  })

  it('offers all three panes as tabs at 1024 × 768, and only there', async () => {
    stubFrameWidth(1024 - CHROME_ALLOWANCE_PX)
    render(<WorkspaceHarness initialScenarioId="preload-drainage-collapse" />)
    notifyResize()
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-mode', 'compact'))
    expect(workspaceTabs()).toHaveLength(3)

    stubFrameWidth(1600 - CHROME_ALLOWANCE_PX)
    notifyResize()
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-mode', 'wide'))
    expect(workspaceTabs()).toHaveLength(0)
  })

  it('announces the arrangement rather than leaving it to be inferred from the layout', async () => {
    stubFrameWidth(1280 - CHROME_ALLOWANCE_PX)
    render(<WorkspaceHarness initialScenarioId="preload-drainage-collapse" />)
    notifyResize()
    await waitFor(() =>
      expect(
        screen.getByText(/The live simulator and Current task are shown side by side/i),
      ).toBeInTheDocument(),
    )
  })
})

describe('B3: the layout rules jsdom cannot compute', () => {
  it('gives the laptop arrangement two columns with the two context panes sharing one', () => {
    expect(workspaceCss).toContain('.laptopWorkspace.laptopWorkspace {')
    expect(workspaceCss).toMatch(
      /\.laptopWorkspace \[data-scroll-pane='secondary'\],\s*\.laptopWorkspace \[data-scroll-pane='tertiary'\] \{[^}]*grid-column: 3;/,
    )
    expect(workspaceCss).toContain(
      "[data-workspace-context='tertiary'] .laptopWorkspace [data-scroll-pane='secondary'] {\n  display: none;\n}",
    )
    expect(workspaceCss).toContain(
      "[data-workspace-context='secondary'] .laptopWorkspace [data-scroll-pane='tertiary'] {\n  display: none;\n}",
    )
    // The hidden pane is display:none, never unmounted — that is what keeps the state.
    expect(workspaceCss).not.toMatch(/laptopWorkspace[^{]*\{\s*content-visibility/)
  })

  it('collapses the compact arrangement to one column and hides the separators', () => {
    expect(workspaceCss).toContain(
      '.compactWorkspace.compactWorkspace {\n  grid-template-columns: minmax(0, 1fr);\n}',
    )
    expect(workspaceCss).toContain(
      ".compactWorkspace [data-mobile-visible='false'] {\n  display: none;\n}",
    )
    expect(workspaceCss).toContain(
      '.compactWorkspace [data-teaching-resize-handle] {\n  display: none;\n}',
    )
  })

  it('declares independent contained scrolling per pane and no fourth column', () => {
    expect(workspaceCss).toMatch(
      /\.deviceWorkspace \[data-scroll-pane\] \{[^}]*overflow-y: auto;[^}]*overscroll-behavior: contain;/,
    )
    expect(workspaceCss).not.toContain(
      'grid-template-columns:\n    minmax(0, var(--tw-primary-width, 52%))\n    0.75rem\n    minmax(0, 1fr)\n    0.75rem',
    )
  })

  it('bounds the frame on the viewport so the panes scroll rather than the page', () => {
    expect(workspaceCss).toMatch(/--ecmo-learn-max-height: 58rem;/)
    expect(workspaceCss).toMatch(/height: min\(\s*var\(--ecmo-learn-max-height\)/)
    expect(workspaceCss).toMatch(
      /@media \(max-width: 840px\) \{\s*\.workspaceFrame \{\s*height: auto;/,
    )
  })

  it('respects reduced motion and gives the tabs a visible focus ring', () => {
    expect(workspaceCss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(workspaceCss).toMatch(/\.paneTabs button:focus-visible \{[^}]*outline: 3px solid/)
    // Touch targets stay operable.
    expect(workspaceCss).toMatch(/\.paneTabs button \{[^}]*min-height: 2\.75rem;/)
  })
})
