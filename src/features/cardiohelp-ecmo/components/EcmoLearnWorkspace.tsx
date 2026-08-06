'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'

import type { CriticalCareActivityPhase } from '@/features/learning-module/activity'
import { ResizableTeachingWorkspace } from '@/features/learning-module/curriculum/ResizableTeachingWorkspace'

import type {
  CircuitViewPreference,
  EcmoSimulationState,
  GuidedControlId,
  GuidedLessonDefinition,
  GuidedTarget,
  GuidedWalkthroughStep,
  SimulationAction,
} from '../engine'
import { LearnLessonPlayer } from './LearnLessonPlayer'
import { LearnStepTeaching, type LearnStepStatus } from './LearnStepTeaching'
import { EcmoDrillTeachingPanel } from './teaching/EcmoDrillTeachingPanel'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'
import styles from './EcmoLearnWorkspace.module.css'

/**
 * The guided drill Learn route, arranged as three panes instead of one column.
 *
 * Before this, the Learn workbench stacked the simulator above the lesson player in a single grid
 * column, so a learner comparing a console reading with the task that asked for it scrolled the page
 * between them and lost one to look at the other. That was the barrier the novice assessment
 * reported, and it is what this workspace exists to remove.
 *
 * Practice and Assess are untouched: they keep the stacked workbench, the case player, their own
 * stage transitions, auto-scroll, verdict timing, and scoring. Nothing here is reachable from them.
 *
 * The simulator is received as a node rather than constructed. There is exactly one console and one
 * circuit view in this route, and the workbench that owns their props hands the same element to
 * whichever layout is showing — a second copy would be a second set of control ids, and the guided
 * help targeting resolves controls by id.
 */

type WorkspacePane = 'primary' | 'secondary' | 'tertiary'
type WorkspaceMode = 'wide' | 'laptop' | 'compact'
type ContextTab = 'secondary' | 'tertiary'

const PANES: readonly WorkspacePane[] = ['primary', 'secondary', 'tertiary']

/** The laptop arrangement keeps the simulator on screen, so only these two share the second column. */
const CONTEXT_TABS: readonly WorkspacePane[] = ['tertiary', 'secondary']

const PANE_LABELS: Readonly<Record<WorkspacePane, string>> = {
  primary: 'Live simulator',
  secondary: 'Teaching',
  tertiary: 'Current task',
}

/**
 * Where the layout changes, measured on the workspace frame's own width.
 *
 * `COMPACT_BELOW_PX` is not a taste threshold: `ResizableTeachingWorkspace` goes compact when its
 * *usable* width — the frame minus 0.75rem of padding on each side and the two 0.75rem separators —
 * falls under 960px, which is a frame of 1008px. Matching it exactly is what keeps this module's
 * mode and the shared component's own decision from disagreeing in a band where one would render
 * tabs the other ignored.
 *
 * `WIDE_FROM_PX` is where three panes stop being cramped. Below it the console — which cannot lay
 * out under about 820px — is squeezed into a primary pane narrower than half a laptop screen while
 * the task pane holds prediction options, so the two context panes share one column instead.
 */
const COMPACT_BELOW_PX = 1008
const WIDE_FROM_PX = 1500

function modeForWidth(width: number): WorkspaceMode {
  if (width <= 0) return 'wide'
  if (width < COMPACT_BELOW_PX) return 'compact'
  return width < WIDE_FROM_PX ? 'laptop' : 'wide'
}

export interface EcmoLearnWorkspaceProps {
  readonly state: EcmoSimulationState
  readonly lesson: GuidedLessonDefinition
  readonly dispatch: (action: SimulationAction) => void
  /** The live simulator column, built once by the workbench and never reconstructed here. */
  readonly simulator: ReactNode
  readonly onSelectLesson: (scenarioId: string) => void
  readonly onCompleteLesson: (scenarioId: string) => void
  readonly onTryPractice: (scenarioId: string) => void
  readonly onTargetChange: (target: GuidedTarget | null) => void
  readonly onControlHelpChange: (controlId: GuidedControlId | null) => void
  readonly onCircuitViewPreferenceChange?: (
    preference: { view: CircuitViewPreference; stepId: string } | null,
  ) => void
  readonly onPhaseChange?: (phase: CriticalCareActivityPhase) => void
  readonly onActiveStepChange?: (step: GuidedWalkthroughStep) => void
}

export function EcmoLearnWorkspace({
  state,
  lesson,
  dispatch,
  simulator,
  onSelectLesson,
  onCompleteLesson,
  onTryPractice,
  onTargetChange,
  onControlHelpChange,
  onCircuitViewPreferenceChange,
  onPhaseChange,
  onActiveStepChange,
}: EcmoLearnWorkspaceProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<WorkspaceMode>('wide')
  const [contextTab, setContextTab] = useState<ContextTab>('tertiary')
  const [compactPane, setCompactPane] = useState<WorkspacePane>('primary')
  const [stepStatus, setStepStatus] = useState<LearnStepStatus | null>(null)
  const tabRefs = useRef<Partial<Record<WorkspacePane, HTMLButtonElement | null>>>({})

  useIsomorphicLayoutEffect(() => {
    function measure() {
      const frame = frameRef.current
      if (!frame) return
      setMode(modeForWidth(frame.getBoundingClientRect().width))
    }

    measure()
    window.addEventListener('resize', measure)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (frameRef.current) observer?.observe(frameRef.current)
    return () => {
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [])

  /*
   * Pane scroll positions.
   *
   * Both the compact tabs and the laptop context tabs take a pane out of the layout, and a scroll
   * container that leaves the layout comes back at the top: the browser has nowhere to keep the
   * offset of a box it destroyed. So the offsets are recorded as the learner scrolls and written
   * back when a pane returns, which is what makes "switching context does not lose your place" true
   * rather than merely intended.
   */
  const paneContentRefs = useRef<Record<WorkspacePane, HTMLElement | null>>({
    primary: null,
    secondary: null,
    tertiary: null,
  })
  const paneScrollTops = useRef<Record<WorkspacePane, number>>({
    primary: 0,
    secondary: 0,
    tertiary: 0,
  })
  const suppressScrollRecording = useRef(0)

  const paneContentRef = useCallback(
    (pane: WorkspacePane) => (node: HTMLElement | null) => {
      paneContentRefs.current[pane] = node
    },
    [],
  )

  /** The element that actually scrolls: the shared pane holding this workspace's pane content. */
  const scrollerFor = useCallback(
    (pane: WorkspacePane) => paneContentRefs.current[pane]?.parentElement ?? null,
    [],
  )

  const restorePaneScroll = useCallback(
    (pane: WorkspacePane) => {
      const scroller = scrollerFor(pane)
      if (!scroller) return
      const target = paneScrollTops.current[pane]
      if (scroller.scrollTop === target) return
      suppressScrollRecording.current += 1
      scroller.scrollTop = target
      window.setTimeout(() => {
        suppressScrollRecording.current = Math.max(0, suppressScrollRecording.current - 1)
      }, 0)
    },
    [scrollerFor],
  )

  useEffect(() => {
    const teardown: (() => void)[] = []
    for (const pane of PANES) {
      const scroller = scrollerFor(pane)
      if (!scroller) continue
      // The scrolling element belongs to the shared component, so the marker this module's layout
      // CSS and its measurements need is stamped on it here rather than declared in its JSX.
      scroller.setAttribute('data-scroll-pane', pane)
      /*
       * And the tab points back at it. A `tab` has to name the panel it controls, but the id is
       * generated by the shared component's own `useId`, so it is not knowable when this module
       * renders the button. Reading it back and setting the attribute here — beside the stamp above,
       * for the same reason — keeps the pairing correct without a state round trip whose only effect
       * would be a second render.
       */
      tabRefs.current[pane]?.setAttribute('aria-controls', scroller.id)

      const element = scroller
      const record = () => {
        if (suppressScrollRecording.current > 0) return
        paneScrollTops.current[pane] = element.scrollTop
      }
      element.addEventListener('scroll', record, { passive: true })
      teardown.push(() => element.removeEventListener('scroll', record))
    }
    return () => {
      for (const dispose of teardown) dispose()
    }
    // `mode` is a dependency because the tab buttons only exist in two of the three arrangements:
    // without it the pairing above would never run for a tab row mounted after the first paint.
  }, [mode, scrollerFor])

  useIsomorphicLayoutEffect(() => {
    for (const pane of PANES) restorePaneScroll(pane)
  }, [compactPane, contextTab, mode, restorePaneScroll])

  /**
   * Bring the pane holding a help target back on screen before anything tries to focus it.
   *
   * Every guided control id belongs to the console, circuit, gas panel, patient monitor, or trend
   * panel, all of which live in the primary pane. In the laptop layout that pane is always on screen
   * and there is nothing to do; in compact only one pane is, so the help request selects it. The
   * learner's step, committed answer, and verdict are untouched — the other panes are hidden, not
   * unmounted, so no state goes with them.
   */
  const revealTargetPane = useCallback(() => {
    setCompactPane('primary')
  }, [])

  const handleStepStatusChange = useCallback((status: LearnStepStatus) => {
    setStepStatus(status)
  }, [])

  /**
   * The pane tabs, as a real ARIA tablist rather than the shape of one.
   *
   * A roving tabindex puts exactly one tab in the tab sequence, which is correct — and which makes
   * the arrow keys the only way to reach the others. Without them the roving tabindex stops being an
   * affordance and becomes a lock: in the compact arrangement the teaching and the prediction are
   * behind tabs a keyboard-only learner could not reach at all. Selection follows focus, which is
   * the pattern for tabs whose panels are already mounted and cost nothing to show.
   */
  const renderPaneTabs = (
    order: readonly WorkspacePane[],
    selected: WorkspacePane,
    select: (pane: WorkspacePane) => void,
  ) => {
    function moveTo(index: number) {
      const pane = order[index]
      select(pane)
      tabRefs.current[pane]?.focus()
    }

    function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault()
          moveTo((index + 1) % order.length)
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault()
          moveTo((index - 1 + order.length) % order.length)
          break
        case 'Home':
          event.preventDefault()
          moveTo(0)
          break
        case 'End':
          event.preventDefault()
          moveTo(order.length - 1)
          break
        default:
          break
      }
    }

    return order.map((pane, index) => (
      <button
        key={pane}
        ref={(node) => {
          tabRefs.current[pane] = node
        }}
        type="button"
        role="tab"
        aria-selected={selected === pane}
        tabIndex={selected === pane ? 0 : -1}
        data-pane-tab={pane}
        onClick={() => select(pane)}
        onKeyDown={(event) => onKeyDown(event, index)}
      >
        {PANE_LABELS[pane]}
      </button>
    ))
  }

  const compact = mode === 'compact'
  const laptop = mode === 'laptop'
  const visiblePane: WorkspacePane = compact ? compactPane : laptop ? contextTab : 'primary'

  const primary = (
    <div
      className={styles.simulatorPane}
      data-pane="live-simulator"
      ref={paneContentRef('primary')}
    >
      {simulator}
    </div>
  )

  /*
   * The step teaching is rendered only once the published step belongs to the lesson on screen.
   *
   * Selecting a new lesson remounts the player, and the new player publishes its first step from an
   * effect — one frame after the render that swapped it in. Without this check that frame would show
   * the previous lesson's rationale beside the new lesson's circuit.
   */
  const stepBelongsToLesson =
    stepStatus !== null && lesson.steps.some((step) => step.id === stepStatus.step.id)

  const secondary = (
    <div className={styles.readingPane} data-pane="teaching" ref={paneContentRef('secondary')}>
      {stepBelongsToLesson && stepStatus ? (
        <LearnStepTeaching state={state} status={stepStatus} />
      ) : null}
      <EcmoDrillTeachingPanel state={state} />
    </div>
  )

  const tertiary = (
    <div className={styles.taskPane} data-pane="current-task" ref={paneContentRef('tertiary')}>
      <LearnLessonPlayer
        key={lesson.id}
        state={state}
        lesson={lesson}
        dispatch={dispatch}
        onSelectLesson={onSelectLesson}
        onCompleteLesson={onCompleteLesson}
        onTryPractice={onTryPractice}
        onTargetChange={onTargetChange}
        onControlHelpChange={onControlHelpChange}
        onCircuitViewPreferenceChange={onCircuitViewPreferenceChange}
        onPhaseChange={onPhaseChange}
        onActiveStepChange={onActiveStepChange}
        onStepStatusChange={handleStepStatusChange}
        onBeforeRevealTarget={revealTargetPane}
      />
    </div>
  )

  return (
    <div
      ref={frameRef}
      className={styles.workspaceFrame}
      data-ecmo-learn-workspace
      data-workspace-mode={mode}
      data-workspace-context={visiblePane}
    >
      {compact ? (
        <div className={styles.paneTabs} role="tablist" aria-label="Workspace panels">
          {renderPaneTabs(PANES, compactPane, setCompactPane)}
        </div>
      ) : laptop ? (
        <div className={styles.paneTabs} role="tablist" aria-label="Context panel">
          <span className={styles.paneTabsLabel}>
            The simulator stays on screen. Choose what sits beside it.
          </span>
          {renderPaneTabs(CONTEXT_TABS, contextTab, (pane) => setContextTab(pane as ContextTab))}
        </div>
      ) : null}

      <p className="sr-only" role="status">
        {mode === 'wide'
          ? 'All three workspace panels are shown side by side.'
          : mode === 'laptop'
            ? `The live simulator and ${PANE_LABELS[visiblePane]} are shown side by side. Your step, answer, and scroll position are kept when you switch.`
            : `${PANE_LABELS[visiblePane]} is shown. Your step, answer, and scroll position are kept when you switch.`}
      </p>

      <ResizableTeachingWorkspace
        className={[
          styles.deviceWorkspace,
          laptop ? styles.laptopWorkspace : null,
          compact ? styles.compactWorkspace : null,
        ]
          .filter(Boolean)
          .join(' ')}
        // The shared component owns pane visibility only in its own compact mode. This module
        // measures the same threshold, so handing it the selected pane keeps its `hidden` attributes
        // in step with the tab row above; the laptop arrangement is this module's CSS on top of the
        // `data-mobile-visible` markers the shared component publishes either way.
        activePane={compact ? compactPane : undefined}
        primary={primary}
        secondary={secondary}
        tertiary={tertiary}
        paneLabels={PANE_LABELS}
        workspaceLabel="Guided ECMO drill workspace: live simulator, teaching, and current task"
      />
    </div>
  )
}
