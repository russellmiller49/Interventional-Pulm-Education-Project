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

/** The module stylesheet that owns the boxes between the activity viewport and the frame. */
const moduleCss = readFileSync(
  join(process.cwd(), 'src/features/cardiohelp-ecmo/components/cardiohelp-ecmo.module.css'),
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

describe('B5: the pane tabs are operable from the keyboard alone', () => {
  /**
   * The tab rows are the only way to reach a pane that the arrangement has taken off screen, so a
   * learner who cannot operate them cannot reach the teaching or the prediction at all.
   *
   * They are authored as an ARIA tablist with a roving tabindex, which means exactly one tab is in
   * the tab sequence and the arrow keys are what move between them. Without the arrow-key half the
   * roving tabindex is not an affordance, it is a lock: `Tab` reaches the selected tab and there is
   * no key that reaches the other two.
   */
  /**
   * The lesson player moves focus to its step heading one animation frame after it mounts. That is
   * its own behaviour and is asserted elsewhere; here it only has to have finished, so that what the
   * arrow keys are measured against is the tab row rather than a frame still in flight.
   */
  async function settleStepFocus() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 32))
    })
  }

  async function compactWorkspace() {
    stubFrameWidth(1024 - CHROME_ALLOWANCE_PX)
    render(<WorkspaceHarness initialScenarioId="preload-drainage-collapse" />)
    notifyResize()
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-mode', 'compact'))
    await settleStepFocus()
  }

  it('moves selection and focus with the arrow keys, and wraps at both ends', async () => {
    await compactWorkspace()
    const tabs = workspaceTabs() as HTMLElement[]
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Live simulator',
      'Teaching',
      'Current task',
    ])

    tabs[0].focus()
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' })
    await waitFor(() => expect(tabs[1]).toHaveAttribute('aria-selected', 'true'))
    expect(tabs[1]).toHaveFocus()

    fireEvent.keyDown(tabs[1], { key: 'ArrowRight' })
    await waitFor(() => expect(tabs[2]).toHaveAttribute('aria-selected', 'true'))

    // Wrapping at the end is what keeps every pane reachable without counting keypresses.
    fireEvent.keyDown(tabs[2], { key: 'ArrowRight' })
    await waitFor(() => expect(tabs[0]).toHaveAttribute('aria-selected', 'true'))

    fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' })
    await waitFor(() => expect(tabs[2]).toHaveAttribute('aria-selected', 'true'))
  })

  it('jumps to the first and last pane with Home and End', async () => {
    await compactWorkspace()
    const tabs = workspaceTabs() as HTMLElement[]

    tabs[0].focus()
    fireEvent.keyDown(tabs[0], { key: 'End' })
    await waitFor(() => expect(tabs[2]).toHaveAttribute('aria-selected', 'true'))

    fireEvent.keyDown(tabs[2], { key: 'Home' })
    await waitFor(() => expect(tabs[0]).toHaveAttribute('aria-selected', 'true'))
  })

  it('keeps exactly one tab in the tab sequence and points each one at the pane it controls', async () => {
    await compactWorkspace()
    const tabs = workspaceTabs() as HTMLElement[]

    expect(tabs.filter((tab) => tab.tabIndex === 0)).toHaveLength(1)
    for (const tab of tabs) {
      // A `tab` with nothing to control is an unfinished pattern: the pane it shows has to be named
      // so assistive technology can follow the learner from the tab to the panel.
      const controls = tab.getAttribute('aria-controls')
      expect(controls).toBeTruthy()
      const panel = document.getElementById(controls as string)
      expect(panel).not.toBeNull()
      expect(panel).toHaveAttribute('data-scroll-pane', tab.getAttribute('data-pane-tab'))
    }
  })

  it('gives the laptop context tabs the same keyboard treatment', async () => {
    stubFrameWidth(1280 - CHROME_ALLOWANCE_PX)
    render(<WorkspaceHarness initialScenarioId="preload-drainage-collapse" />)
    notifyResize()
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-mode', 'laptop'))
    await settleStepFocus()

    const tabs = workspaceTabs() as HTMLElement[]
    expect(tabs).toHaveLength(2)
    tabs[0].focus()
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' })
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-context', 'secondary'))
    expect(tabs[1]).toHaveFocus()
  })
})

describe('B5: a pane that leaves the layout comes back where the learner left it', () => {
  /**
   * A browser resets `scrollTop` to 0 while a box is `display: none` and does not fire a scroll
   * event on the way in or out, so the offset has to be recorded while the pane is on screen and
   * written back when it returns. jsdom computes no layout and therefore never performs that reset,
   * so the reset is applied here explicitly — otherwise the assertion would pass against a
   * workspace that had no restoration logic at all.
   */
  it('restores each pane scroll offset across a context switch', async () => {
    stubFrameWidth(1280 - CHROME_ALLOWANCE_PX)
    render(<WorkspaceHarness initialScenarioId="preload-drainage-collapse" />)
    notifyResize()
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-mode', 'laptop'))

    const taskPane = document.querySelector('[data-scroll-pane="tertiary"]') as HTMLElement
    taskPane.scrollTop = 640
    fireEvent.scroll(taskPane)

    fireEvent.click(screen.getByRole('tab', { name: 'Teaching' }))
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-context', 'secondary'))
    // What the browser does to a box it stops laying out.
    taskPane.scrollTop = 0

    fireEvent.click(screen.getByRole('tab', { name: 'Current task' }))
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-context', 'tertiary'))
    expect(taskPane.scrollTop).toBe(640)
  })
})

describe('B5: the simulator survives every mode change, not only every tab change', () => {
  it('keeps the console screen, the scenario, and the commitment across compact → laptop → wide', async () => {
    stubFrameWidth(1024 - CHROME_ALLOWANCE_PX)
    render(<WorkspaceHarness initialScenarioId="preload-drainage-collapse" />)
    notifyResize()
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-mode', 'compact'))

    // Put the simulator in a non-default state and commit an answer, so there is something to lose.
    showTaskPane()
    fireEvent.click(screen.getByRole('button', { name: /Inspect the starting pattern/i }))
    fireEvent.click(screen.getByRole('button', { name: /Next step/i }))

    const prediction = requireEcmoLearnPrediction('preload-drainage-collapse')
    const best = prediction.item.choices.find((choice) => choice.plausibility === 'best')
    if (!best) throw new Error('No best choice authored')
    fireEvent.click(screen.getByRole('radio', { name: best.label }))
    fireEvent.click(screen.getByRole('button', { name: /Commit this prediction/i }))

    fireEvent.click(screen.getByRole('tab', { name: 'Live simulator' }))
    const parameters = document.getElementById('cardiohelp-screen-parameters')
    if (!parameters) throw new Error('The console did not render the PARAM control')
    fireEvent.click(parameters)
    expect(screen.getByTestId('screen').textContent).toBe('parameters')

    // The console element itself, so a remount is detectable rather than inferred from its output.
    const consoleBefore = document.getElementById('cardiohelp-console')

    for (const [width, expectedMode] of [
      [1280, 'laptop'],
      [1600, 'wide'],
      [1024, 'compact'],
      [1600, 'wide'],
    ] as const) {
      stubFrameWidth(width - CHROME_ALLOWANCE_PX)
      notifyResize()
      await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-mode', expectedMode))

      expect(document.getElementById('cardiohelp-console')).toBe(consoleBefore)
      expect(screen.getByTestId('screen').textContent).toBe('parameters')
      expect(screen.getByTestId('scenario').textContent).toBe('preload-drainage-collapse')
      expect(screen.getByTestId('prediction').textContent).toContain('true|')
      expect(document.querySelector('[data-answer-verdict]')).not.toBeNull()
      expect(document.querySelectorAll('#cardiohelp-console')).toHaveLength(1)
    }
  })
})

describe('B5: the help request reveals the pane before it focuses the control', () => {
  it('orders the reveal ahead of the focus, rather than merely doing both', async () => {
    stubFrameWidth(1024 - CHROME_ALLOWANCE_PX)
    render(<WorkspaceHarness initialScenarioId="startup-sensor-orientation" />)
    notifyResize()
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-mode', 'compact'))

    fireEvent.click(screen.getByRole('tab', { name: 'Current task' }))
    await waitFor(() => expect(frame()).toHaveAttribute('data-workspace-context', 'tertiary'))
    advanceToPrediction()

    /*
     * Both orderings leave the control focused and on screen, so asserting the end state alone
     * would pass against a workspace that focused a hidden box and revealed it afterwards — which
     * is precisely what does not work in a browser, where `focus()` on an unlaid-out element does
     * nothing at all. The timeline is what distinguishes them.
     */
    const timeline: string[] = []
    const observer = new MutationObserver(() => {
      if (frame()?.getAttribute('data-workspace-context') === 'primary') {
        if (!timeline.includes('reveal')) timeline.push('reveal')
      }
    })
    observer.observe(frame() as Node, {
      attributes: true,
      attributeFilter: ['data-workspace-context'],
    })

    const control = document.getElementById('cardiohelp-screen-parameters')
    if (!control) throw new Error('The console did not render the PARAM control')
    control.addEventListener('focus', () => {
      if (!timeline.includes('focus')) timeline.push('focus')
    })

    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))
    await waitFor(() => expect(control).toHaveFocus())
    observer.disconnect()

    expect(timeline).toEqual(['reveal', 'focus'])
  })
})

describe('B5: every control the guided drill needs is reachable from the keyboard', () => {
  it('reaches the choices, Commit, the verdict Continue, and both separators', async () => {
    render(<WorkspaceHarness initialScenarioId="preload-drainage-collapse" />)

    // The separators belong to the wide arrangement and are operable there.
    const separators = screen.getAllByRole('separator')
    expect(separators).toHaveLength(2)
    for (const separator of separators) expect(separator.tabIndex).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: /Inspect the starting pattern/i }))
    fireEvent.click(screen.getByRole('button', { name: /Next step/i }))

    const prediction = requireEcmoLearnPrediction('preload-drainage-collapse')
    for (const choice of prediction.item.choices) {
      const radio = screen.getByRole('radio', { name: choice.label })
      // A radio group is one tab stop with arrow keys inside it; every option must be operable.
      expect(radio).toBeEnabled()
      expect(radio.tabIndex).toBeGreaterThanOrEqual(-1)
    }

    const best = prediction.item.choices.find((choice) => choice.plausibility === 'best')
    if (!best) throw new Error('No best choice authored')
    const radio = screen.getByRole('radio', { name: best.label })
    radio.focus()
    expect(radio).toHaveFocus()

    fireEvent.click(radio)
    const commit = screen.getByRole('button', { name: /Commit this prediction/i })
    commit.focus()
    expect(commit).toHaveFocus()
    fireEvent.click(commit)

    const continueButton = screen.getByRole('button', { name: /^Continue$/i })
    continueButton.focus()
    expect(continueButton).toHaveFocus()
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

  it('fills the activity viewport so the panes scroll rather than the page', () => {
    // The frame takes the height it is given instead of estimating the chrome above it — an
    // estimate that made the frame taller than its container and put a fourth scroller around
    // three panes that already scroll.
    expect(workspaceCss).toMatch(/\.workspaceFrame \{[^}]*height: 100%;/)
    expect(workspaceCss).toMatch(
      /\.workspaceFrame \{[^}]*max-height: var\(--ecmo-learn-max-height\)/,
    )
    expect(workspaceCss).not.toContain('--ecmo-learn-chrome')
    expect(workspaceCss).toMatch(
      /@media \(max-width: 840px\) \{\s*\.workspaceFrame \{\s*height: auto;/,
    )
  })

  it('gives the frame a definite-height ancestor chain, on the Learn route only', () => {
    // `height: 100%` resolves to nothing against an auto-height parent, so the two boxes between the
    // activity viewport and the frame are made definite — and only for this route, because Practice
    // and Assess share those class names.
    expect(moduleCss).toMatch(/\.workbench\[data-learn-workspace='true'\] \{[^}]*height: 100%;/)
    expect(moduleCss).toMatch(
      /\.experiencePanel:has\(\[data-ecmo-learn-workspace\]\) \{[^}]*height: 100%;/,
    )
  })

  it('respects reduced motion and gives the tabs a visible focus ring', () => {
    expect(workspaceCss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(workspaceCss).toMatch(/\.paneTabs button:focus-visible \{[^}]*outline: 3px solid/)
    // Touch targets stay operable.
    expect(workspaceCss).toMatch(/\.paneTabs button \{[^}]*min-height: 2\.75rem;/)
  })
})
