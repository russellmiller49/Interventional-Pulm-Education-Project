'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import type { Route } from 'next'
import { ArrowRight } from 'lucide-react'

import { HeldDisagreement } from '@/features/critical-care/components/teaching/EvidenceRenderers'
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { criticalCareSourceConflictById } from '@/features/critical-care/content/sourceConflicts'
import { ChoiceReasoningFeedback } from '@/features/learning-module/components/ChoiceReasoningFeedback'
import { ResizableTeachingWorkspace } from '@/features/learning-module/curriculum/ResizableTeachingWorkspace'
import {
  nextPathwaySection,
  pathwaySectionIndex,
} from '@/features/learning-module/curriculum/types'
import type { CriticalCareActivityPhase } from '@/features/learning-module/activity/types'
import { Link } from '@/i18n/navigation'

import { ecmoFoundationSectionById } from '../content/foundationLessons'
import { ecmoFoundationLearningItemsFor } from '../content/foundationLearningItems'
import {
  ecmoFoundationInitialVariant,
  ecmoFoundationLessonRuntime,
  ecmoFoundationPrimaryVariant,
  ecmoFoundationVariant,
  ecmoFoundationVariants,
  type EcmoFoundationGuidedAction,
  type EcmoInteractiveFoundationSectionId,
} from '../content/foundationLessonRuntime'
import {
  createEcmoFoundationSessionState,
  ecmoFoundationRestoreAction,
  ecmoFoundationSessionReducer,
} from '../session/foundationSession'
import { persistFoundationSectionCompleted } from '../engine/progress'
import type { SupportMode } from '../engine/types'
import { CardiohelpConsole } from './CardiohelpConsole'
import { CircuitAndMonitors } from './CircuitAndMonitors'
import { FitWidthSurface, type FitWidthMode } from './FitWidthSurface'
import { EcmoFoundationTeachingPanel } from './teaching/EcmoFoundationTeachingPanel'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'
import workspaceStyles from './EcmoFoundationWorkspace.module.css'

/**
 * The Learn activity for the ten interactive foundation sections.
 *
 * These were static prose pages with no simulator at all, which meant the sections that teach the
 * circuit were the only ones a learner could not look at a circuit while reading. This activity
 * gives them a live state to read — a fault-free reference circuit, or an existing case loaded as a
 * non-scored teaching preview — arranged in the same three panes the rest of the resource uses.
 *
 * One session reducer, mounted once here, feeds all three panes. Every state change that reloads a
 * source is a single atomic dispatch, so a restored-but-untouched frame is never rendered and the
 * ordering of a restore and the actions applied to it does not depend on React's scheduling.
 *
 * Exactly one thing is persisted, and only when the learner commits the transfer answer: this
 * section's id, marking it worked so that it can take part in "what comes next". Nothing here
 * records a scenario result, writes mastery, or touches Practice progress — a preview is a state
 * to read, not a drill being worked — and nothing at all is written by opening, reading, or
 * navigating a section.
 */

const PHASES: readonly CriticalCareActivityPhase[] = [
  'recognize',
  'predict',
  'act',
  'observe',
  'explain',
  'transfer',
]

/**
 * What the fixed-pathway indicator says, per track.
 *
 * Both track-fixed groups exist for the same reason and neither may borrow the other's sentence: a
 * VA section is not teaching series physiology, and a learner told it was would have been given a
 * wrong account of the circuit in front of them.
 */
const FIXED_PATHWAY_COPY: Readonly<Record<SupportMode, string>> = {
  vv: 'VV pathway · this section teaches series physiology and always runs on the VV reference circuit.',
  va: 'VA pathway · this section teaches parallel circulation and always runs on the VA reference circuit.',
}

const DEVICE_BOUNDARY_SHORT =
  'Console follows the U.S. CARDIOHELP Instructions for Use, Revision 2.3 (January 2025). The VV and VA teaching is not limited to the U.S. labeled indication or duration.'

const DEVICE_BOUNDARY_FULL =
  'The simulated console follows the U.S. CARDIOHELP System Instructions for Use, Revision 2.3, January 2025. The VV and VA clinical teaching reflects contemporary ECMO practice and is not limited to the U.S. labeled indication or duration. This independent educational module does not replace current manufacturer instructions, local protocol, or supervised competency validation.'

/** The three panes of the shared workspace, as this activity refers to them. */
type FoundationPane = 'primary' | 'secondary' | 'tertiary'

const FOUNDATION_PANES: readonly FoundationPane[] = ['primary', 'secondary', 'tertiary']

const PANE_LABELS: Readonly<Record<FoundationPane, string>> = {
  primary: 'Circuit & console',
  secondary: 'Teaching',
  tertiary: 'Your turn',
}

const PANE_FOCUS_LABELS: Readonly<Record<FoundationPane, string>> = {
  primary: 'Maximize circuit & console',
  secondary: 'Maximize teaching',
  tertiary: 'Maximize your turn',
}

/**
 * How much room is left below the workspace when its height is computed from the viewport.
 *
 * Everything above the workspace is measured; this is the only constant, and it exists so the
 * bottom edge of the frame is not flush against the bottom of the window.
 */
const WORKSPACE_BOTTOM_GUTTER_PX = 24

/**
 * Resolves the mode the lesson actually runs in, then mounts the workspace under a key made from
 * the section and that mode.
 *
 * Remounting is how a section or track change gets a clean state. The alternative — an effect that
 * resets four pieces of state after the props have already rendered once — is exactly the pattern
 * this package was asked to remove.
 */
export function EcmoFoundationLessonActivity({
  sectionId,
  supportMode,
  initialPhase = 'recognize',
}: {
  readonly sectionId: EcmoInteractiveFoundationSectionId
  readonly supportMode: SupportMode
  /** The phase the lesson opens at, carried by the URL. Nothing about it is persisted. */
  readonly initialPhase?: CriticalCareActivityPhase
}) {
  const runtime = ecmoFoundationLessonRuntime(sectionId)
  // A VV-only section ignores the requested track outright: its teaching is series physiology, and
  // a VA reference circuit behind it would contradict the text beside it.
  const resolvedMode = runtime.supportMode ?? supportMode
  return (
    <EcmoFoundationLessonWorkspace
      key={`${sectionId}:${resolvedMode}:${initialPhase}`}
      sectionId={sectionId}
      supportMode={resolvedMode}
      initialPhase={initialPhase}
    />
  )
}

function EcmoFoundationLessonWorkspace({
  sectionId,
  supportMode,
  initialPhase,
}: {
  readonly sectionId: EcmoInteractiveFoundationSectionId
  readonly supportMode: SupportMode
  readonly initialPhase: CriticalCareActivityPhase
}) {
  const section = ecmoFoundationSectionById.get(sectionId)
  const runtime = ecmoFoundationLessonRuntime(sectionId)
  const items = ecmoFoundationLearningItemsFor(sectionId)
  const variants = ecmoFoundationVariants(runtime, supportMode)
  const primaryVariant = ecmoFoundationPrimaryVariant(runtime, supportMode)
  const trackIsFixed = runtime.supportMode !== undefined

  /**
   * The clean state this mount opens on.
   *
   * Resolved from the phase the lesson is being mounted at, not from the lesson's primary variant
   * alone: a link into a phase whose authored content is written against a different state used to
   * open on a state that content does not describe. Only the *initial* state is resolved this way —
   * `initialPhase` is a mount-time prop, this component remounts when it changes, and nothing
   * re-runs the resolver when the learner walks the phase navigation.
   *
   * It resolves a state, and only a state. No earlier prediction, transfer answer, snapshot,
   * interaction record or control sequence is reconstructed, no stored progress is consulted to
   * resolve it, and the note below says so wherever the lesson opens anywhere other than the first
   * phase.
   */
  const initialVariant = ecmoFoundationInitialVariant(runtime, supportMode, initialPhase)

  const [session, dispatch] = useReducer(ecmoFoundationSessionReducer, initialVariant, (variant) =>
    createEcmoFoundationSessionState(variant),
  )

  const [phase, setPhase] = useState<CriticalCareActivityPhase>(initialPhase)
  const [committedPredictionId, setCommittedPredictionId] = useState<string | null>(null)
  const [committedTransferId, setCommittedTransferId] = useState<string | null>(null)

  /**
   * Which pane, if any, currently has the whole workspace.
   *
   * Local state rather than a shared-component feature: `ResizableTeachingWorkspace` accepts
   * `activePane` and publishes it as `data-mobile-visible` on each pane, but only hides panes itself
   * in compact mode, so the desktop single-pane view is implemented in this module's CSS on top of
   * that published state.
   */
  const [focusedPane, setFocusedPane] = useState<FoundationPane | null>(null)
  const [consoleFitMode, setConsoleFitMode] = useState<FitWidthMode>('fit')

  const frameRef = useRef<HTMLDivElement>(null)
  const [workspaceOffset, setWorkspaceOffset] = useState<number | null>(null)

  /**
   * The workspace's bounded height, measured rather than guessed.
   *
   * `ResizableTeachingWorkspace` asks for `height: 100%`. It used to be given a `mt-4` div with no
   * height at all, so 100% resolved against an auto-height ancestor, the panes grew to their content
   * and the document became the scroll surface — which is exactly the reported defect. The chrome
   * above the workspace is not a fixed height (module identity row, section nav, safety notice,
   * lesson title block, track control, focus toolbar, all reflowing with viewport and locale), so
   * the offset is read from the frame's own position in the document.
   */
  useIsomorphicLayoutEffect(() => {
    function measureOffset() {
      const frame = frameRef.current
      if (!frame) return
      const documentTop = frame.getBoundingClientRect().top + window.scrollY
      const next = Math.max(0, Math.round(documentTop + WORKSPACE_BOTTOM_GUTTER_PX))
      setWorkspaceOffset((current) =>
        current !== null && Math.abs(current - next) < 2 ? current : next,
      )
    }

    measureOffset()
    window.addEventListener('resize', measureOffset)
    // The chrome above the frame reflows without the window changing size — the nav wraps, the
    // safety notice rewraps — so the body is observed rather than only the window.
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measureOffset)
    observer?.observe(document.body)
    return () => {
      window.removeEventListener('resize', measureOffset)
      observer?.disconnect()
    }
  }, [])

  /*
   * Pane scroll positions.
   *
   * Both the shared compact tabs and this activity's focus mode take a pane out of the layout, and a
   * scroll container that leaves the layout comes back at the top: the browser has nowhere to keep
   * the offset of a box it destroyed. The positions are therefore recorded as the learner scrolls
   * and written back when a pane returns.
   */
  const paneContentRefs = useRef<Record<FoundationPane, HTMLElement | null>>({
    primary: null,
    secondary: null,
    tertiary: null,
  })
  const paneScrollTops = useRef<Record<FoundationPane, number>>({
    primary: 0,
    secondary: 0,
    tertiary: 0,
  })
  const suppressScrollRecording = useRef(0)

  const paneContentRef = useCallback(
    (pane: FoundationPane) => (node: HTMLElement | null) => {
      paneContentRefs.current[pane] = node
    },
    [],
  )

  /** The element that actually scrolls: the shared pane holding this activity's pane content. */
  const scrollerFor = useCallback(
    (pane: FoundationPane) => paneContentRefs.current[pane]?.parentElement ?? null,
    [],
  )

  const restorePaneScroll = useCallback(
    (pane: FoundationPane) => {
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
    for (const pane of FOUNDATION_PANES) {
      const scroller = scrollerFor(pane)
      if (!scroller) continue
      // The scrolling element belongs to the shared component, so the marker the layout CSS and the
      // acceptance measurements need is stamped on it here rather than declared in its JSX.
      scroller.setAttribute('data-scroll-pane', pane)

      const element = scroller
      const record = () => {
        if (suppressScrollRecording.current > 0) return
        paneScrollTops.current[pane] = element.scrollTop
      }
      element.addEventListener('scroll', record, { passive: true })
      teardown.push(() => element.removeEventListener('scroll', record))

      if (typeof MutationObserver !== 'undefined') {
        // Covers the shared compact tab row, whose pane switching this activity never sees.
        const observer = new MutationObserver(() => {
          if (scroller.hasAttribute('hidden')) return
          restorePaneScroll(pane)
        })
        observer.observe(scroller, { attributes: true, attributeFilter: ['hidden'] })
        teardown.push(() => observer.disconnect())
      }
    }
    return () => {
      for (const dispose of teardown) dispose()
    }
  }, [restorePaneScroll, scrollerFor])

  // Entering or leaving focused mode: whichever panes are on screen go back to where they were.
  useIsomorphicLayoutEffect(() => {
    for (const pane of FOUNDATION_PANES) {
      if (focusedPane !== null && focusedPane !== pane) continue
      restorePaneScroll(pane)
    }
  }, [focusedPane, restorePaneScroll])

  /**
   * Move to a phase and leave the URL saying so.
   *
   * The phase is the one part of "where the learner was" that nothing persists — no storage key,
   * DTO, adapter, or payload version carries it, and `ProgressV2` is deliberately untouched. The
   * URL is therefore the only thing that can carry it, and something has to write it there or the
   * parameter the route reads would never be produced by the resource itself.
   *
   * `replaceState` rather than a router navigation: the server component has nothing new to say
   * about a phase the client already holds, and pushing would put six history entries inside one
   * lesson so that leaving it took six presses of the back button.
   */
  function goToPhase(next: CriticalCareActivityPhase) {
    setPhase(next)
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('phase', next)
    window.history.replaceState(window.history.state, '', url)
  }

  // Whether the clock runs belongs to the loaded state, not to this component: a preview authored
  // to sit short of a timed change has to be held, and has to be held again on every reload.
  const running = session.clockRunning

  useEffect(() => {
    if (!running) return undefined
    const timer = setInterval(
      () => dispatch({ type: 'SIMULATION', action: { type: 'STEP' } }),
      1000,
    )
    return () => clearInterval(timer)
  }, [running])

  /**
   * One dispatch per button. A restore rebuilds its variant and applies everything the action
   * resolves inside the same transition; nothing is queued for a later effect to fire.
   *
   * Deliberately not memoized: it is handed to a short list of buttons, and every input it reads is
   * derived from props, so wrapping it would buy nothing and only obscure that.
   */
  function runGuidedAction(guided: EcmoFoundationGuidedAction) {
    if (guided.kind === 'restore-and-apply') {
      const variant = guided.variantId
        ? ecmoFoundationVariant(runtime, supportMode, guided.variantId)
        : undefined
      if (!variant) return
      dispatch(ecmoFoundationRestoreAction(variant, guided))
      return
    }
    if (guided.kind === 'advance') {
      dispatch({ type: 'ADVANCE', seconds: guided.settleSeconds, id: guided.id })
      return
    }
    dispatch(
      guided.capturesSnapshot
        ? { type: 'CAPTURE_SNAPSHOT', id: guided.id }
        : { type: 'RECORD_INTERACTION', id: guided.id },
    )
  }

  const pathway = criticalCareLearningPathway('cardiohelp-ecmo', supportMode)
  const sectionIndex = pathwaySectionIndex(pathway, sectionId)
  const next = nextPathwaySection(pathway, sectionId)

  const conflict = section?.heldDisagreementId
    ? criticalCareSourceConflictById.get(section.heldDisagreementId)
    : undefined

  const phaseCopy = runtime.phases[phase]
  const activeVariant =
    variants.find((variant) => variant.id === session.variantId) ?? primaryVariant
  const predictionChoice = useMemo(
    () => items.prediction.choices.find((choice) => choice.id === committedPredictionId),
    [items.prediction.choices, committedPredictionId],
  )
  const transferChoice = useMemo(
    () => items.transfer.choices.find((choice) => choice.id === committedTransferId),
    [items.transfer.choices, committedTransferId],
  )

  /**
   * Committing the transfer answer is also the point at which this section counts as worked.
   *
   * It is the last thing a learner does here and the only one that requires having read the
   * section, which is why it carries the marker rather than the "continue to next section" link:
   * that link does not render on the last section of the pathway, so recording there would leave
   * a finished learner permanently one section short of done.
   */
  const commitTransfer = useCallback(
    (choiceId: string) => {
      setCommittedTransferId(choiceId)
      persistFoundationSectionCompleted(sectionId)
    },
    [sectionId],
  )

  if (!section) return null

  const primary = (
    <div className="grid gap-3" data-pane="circuit-and-console" ref={paneContentRef('primary')}>
      <div
        className={`rounded-xl border px-3 py-2 ${workspaceStyles.stateCard}`}
        data-active-state-variant={activeVariant.id}
      >
        <p
          className={`uppercase tracking-wide text-muted-foreground ${workspaceStyles.stateCardLabel}`}
        >
          State on screen
        </p>
        <p className="font-semibold">{activeVariant.label}</p>
        {running ? null : (
          <p className="mt-1 font-medium" data-clock-held>
            The clock is held here, so this state stays as it is until you start it.
          </p>
        )}
        {activeVariant.modelBoundary ? (
          <p className="mt-1 text-muted-foreground" data-variant-boundary>
            {activeVariant.modelBoundary}
          </p>
        ) : null}
      </div>
      {/*
        The two dark device surfaces, grouped so the workspace's light foreground can be handed back
        to them. Only the console is scaled: the state card, the circuit view and the boundary note
        all lay out at any pane width, and scaling them too would shrink readable prose for no reason.
      */}
      <div className={workspaceStyles.deviceSurface}>
        <FitWidthSurface
          mode={consoleFitMode}
          remeasureKey={focusedPane ?? 'all'}
          label="CARDIOHELP console, scaled to fit the width of this panel"
        >
          <CardiohelpConsole
            state={session.simulation}
            dispatch={(action) => dispatch({ type: 'SIMULATION', action })}
            controlsEnabled={false}
          />
        </FitWidthSurface>
        <CircuitAndMonitors
          state={session.simulation}
          dispatch={(action) => dispatch({ type: 'SIMULATION', action })}
          controlsEnabled={false}
        />
      </div>
      <p
        className={`rounded-xl border border-dashed px-3 py-2 ${workspaceStyles.boundaryNote}`}
        data-device-boundary
      >
        {DEVICE_BOUNDARY_SHORT}
      </p>
    </div>
  )

  const secondary = (
    <div
      className={`grid gap-4 ${workspaceStyles.readingPane}`}
      data-pane="teaching"
      ref={paneContentRef('secondary')}
    >
      <EcmoFoundationTeachingPanel
        sectionId={sectionId}
        state={session.simulation}
        snapshot={session.snapshot}
      />

      <section className="rounded-2xl border p-4" aria-labelledby="lesson-narrative-heading">
        <h3 id="lesson-narrative-heading" className="text-sm font-semibold uppercase tracking-wide">
          Lesson narrative
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.summary}</p>
        <div className="mt-3 grid gap-3" data-lesson-paragraphs>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-6">
              {paragraph}
            </p>
          ))}
        </div>
        {section.bullets ? (
          <ul className="mt-3 grid gap-2" data-lesson-bullets>
            {section.bullets.map((bullet) => (
              <li key={bullet} className="rounded-xl border px-3 py-2 text-sm leading-6">
                {bullet}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{DEVICE_BOUNDARY_FULL}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Sources: {section.sourceIds.join(', ')}
        </p>
      </section>

      {conflict ? <HeldDisagreement conflict={conflict} headingLevel={3} /> : null}
    </div>
  )

  const tertiary = (
    <div
      className={`grid gap-4 ${workspaceStyles.readingPane}`}
      data-pane="your-turn"
      ref={paneContentRef('tertiary')}
    >
      <section className="rounded-2xl border p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Your turn · {phase}</p>
        <h3 className="mt-1 text-base font-semibold">{phaseCopy.objective}</h3>
        <p className="mt-2 text-sm leading-6">{phaseCopy.requiredAction}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{phaseCopy.teachingPoint}</p>
      </section>

      {phase === 'predict' ? (
        <section className="rounded-2xl border p-4" aria-labelledby="prediction-heading">
          <h3 id="prediction-heading" className="text-sm font-semibold">
            {items.prediction.stem}
          </h3>
          <div className="mt-3 grid gap-2">
            {items.prediction.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className="rounded-xl border px-3 py-2 text-left text-sm"
                aria-pressed={committedPredictionId === choice.id}
                disabled={committedPredictionId !== null}
                onClick={() => setCommittedPredictionId(choice.id)}
              >
                {choice.label}
              </button>
            ))}
          </div>
          {predictionChoice ? (
            <div className="mt-3 grid gap-3">
              <ChoiceReasoningFeedback
                choice={predictionChoice}
                explanation={items.prediction.explanation}
                evidenceIds={items.prediction.evidenceIds}
              />
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold"
                onClick={() => goToPhase('act')}
              >
                Continue
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {/*
        Every phase after the commitment can load a state. Transfer needs it too: the VV capstone's
        transfer step is "load the re-drainage preview and read it", which cannot happen if the
        actions disappear when the transfer item appears.
      */}
      {phase !== 'recognize' && phase !== 'predict' ? (
        <section className="rounded-2xl border p-4" aria-labelledby="actions-heading">
          <h3 id="actions-heading" className="text-sm font-semibold">
            Bounded actions
          </h3>
          <div className="mt-3 grid gap-2">
            {runtime.guidedActions.map((guided) => (
              <button
                key={guided.id}
                type="button"
                className="rounded-xl border px-3 py-2 text-left text-sm"
                data-guided-action={guided.id}
                data-guided-action-kind={guided.kind}
                onClick={() => runGuidedAction(guided)}
              >
                <span className="font-semibold">{guided.label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {guided.description}
                </span>
              </button>
            ))}
          </div>
          {session.interactionsSinceRestore.length > 0 ? (
            <div className="mt-3" data-interaction-evidence>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Looked at since this state was loaded
              </p>
              <ul className="mt-1 grid gap-1">
                {session.interactionsSinceRestore.map((id) => (
                  <li key={id} className="text-xs leading-5" data-interaction={id}>
                    {runtime.guidedActions.find((guided) => guided.id === id)?.label ?? id}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {phase === 'transfer' ? (
        <section className="rounded-2xl border p-4" aria-labelledby="transfer-heading">
          <h3 id="transfer-heading" className="text-sm font-semibold">
            {items.transfer.stem}
          </h3>
          <div className="mt-3 grid gap-2">
            {items.transfer.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className="rounded-xl border px-3 py-2 text-left text-sm"
                aria-pressed={committedTransferId === choice.id}
                disabled={committedTransferId !== null}
                onClick={() => commitTransfer(choice.id)}
              >
                {choice.label}
              </button>
            ))}
          </div>
          {transferChoice ? (
            <ChoiceReasoningFeedback
              choice={transferChoice}
              explanation={items.transfer.explanation}
              evidenceIds={items.transfer.evidenceIds}
            />
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl border px-3 py-2 text-sm"
            data-clock-running={running}
            onClick={() => dispatch({ type: 'SET_CLOCK_RUNNING', running: !running })}
          >
            {running ? 'Pause the circuit' : 'Let the circuit run on'}
          </button>
          <button
            type="button"
            className="rounded-xl border px-3 py-2 text-sm"
            data-restore-primary
            onClick={() => dispatch(ecmoFoundationRestoreAction(primaryVariant))}
          >
            Restore {primaryVariant.label}
          </button>
        </div>
        <nav className="mt-3 flex flex-wrap gap-2" aria-label="Lesson phases">
          {PHASES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className="rounded-lg border px-2 py-1 text-xs"
              aria-current={candidate === phase ? 'step' : undefined}
              onClick={() => goToPhase(candidate)}
            >
              {candidate}
            </button>
          ))}
        </nav>
      </section>
    </div>
  )

  return (
    <main
      className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8"
      data-support-mode={supportMode}
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
        {supportMode.toUpperCase()} pathway · Section {sectionIndex + 1} of{' '}
        {pathway.sections.length}
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{section.title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        Opening state: {initialVariant.label}. Support configuration:{' '}
        {supportMode === 'va' ? 'venoarterial' : 'venovenous'}.
      </p>

      {/*
        What a phase URL did and did not do.

        It selected a clean state authored for that phase. It did not restore a session, so saying
        anything that implied one — "resumed", "your progress", "where you left off" — would be a
        claim about state this module deliberately never keeps. Shown only while the learner is still
        on the phase they arrived at, because once they move on it is describing a phase they left.
      */}
      {initialPhase !== 'recognize' && phase === initialPhase ? (
        <p
          className="mt-2 max-w-3xl rounded-xl border border-dashed px-3 py-2 text-sm leading-6"
          data-phase-restoration-note={initialPhase}
        >
          Opened at the {initialPhase} phase with a clean teaching state. Earlier choices,
          snapshots, and actions were not restored.
        </p>
      ) : null}

      {trackIsFixed ? (
        <p
          className="mt-3 inline-flex rounded-xl border px-3 py-1.5 text-sm"
          data-fixed-pathway={supportMode}
        >
          {FIXED_PATHWAY_COPY[supportMode]}
        </p>
      ) : (
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label="Reference circuit track"
        >
          {(['vv', 'va'] as const).map((candidate) => (
            <Link
              key={candidate}
              href={`/cardiohelp-ecmo/learn?lesson=${sectionId}&track=${candidate}` as Route}
              className="rounded-xl border px-3 py-1.5 text-sm"
              data-track-link={candidate}
              aria-current={candidate === supportMode ? 'true' : undefined}
            >
              {candidate.toUpperCase()} reference
            </Link>
          ))}
        </div>
      )}
      <p className="sr-only" role="status">
        Showing the {supportMode === 'va' ? 'venoarterial' : 'venovenous'} pathway, with{' '}
        {activeVariant.label} loaded.
      </p>

      <div
        className={workspaceStyles.workspaceToolbar}
        role="group"
        aria-label="Workspace panel size"
      >
        <span className={workspaceStyles.workspaceToolbarLabel} aria-hidden="true">
          Panels
        </span>
        {FOUNDATION_PANES.map((pane) => (
          <button
            key={pane}
            type="button"
            className={workspaceStyles.workspaceToolbarButton}
            data-focus-pane={pane}
            aria-pressed={focusedPane === pane}
            onClick={() => setFocusedPane((current) => (current === pane ? null : pane))}
          >
            {PANE_FOCUS_LABELS[pane]}
          </button>
        ))}
        <button
          type="button"
          className={workspaceStyles.workspaceToolbarButton}
          data-focus-restore
          disabled={focusedPane === null}
          onClick={() => setFocusedPane(null)}
        >
          Return to three panes
        </button>
        <button
          type="button"
          className={workspaceStyles.workspaceToolbarButton}
          data-console-fit-mode={consoleFitMode}
          aria-pressed={consoleFitMode === 'actual'}
          onClick={() => setConsoleFitMode((current) => (current === 'fit' ? 'actual' : 'fit'))}
        >
          Console at actual size
        </button>
      </div>
      <p className="sr-only" role="status">
        {focusedPane === null
          ? 'All three workspace panels are shown.'
          : `${PANE_LABELS[focusedPane]} is maximized. The other two panels are hidden until you return to three panes.`}
      </p>

      <div
        ref={frameRef}
        className={workspaceStyles.workspaceFrame}
        style={
          workspaceOffset === null
            ? undefined
            : ({ '--ecmo-workspace-offset': `${workspaceOffset}px` } as CSSProperties)
        }
        data-ecmo-workspace-frame
        data-workspace-focus={focusedPane ?? 'all'}
      >
        <ResizableTeachingWorkspace
          className={[
            workspaceStyles.readableWorkspace,
            focusedPane === null ? null : workspaceStyles.focusedWorkspace,
          ]
            .filter(Boolean)
            .join(' ')}
          activePane={focusedPane ?? undefined}
          primary={primary}
          secondary={secondary}
          tertiary={tertiary}
          paneLabels={PANE_LABELS}
          workspaceLabel="Resizable ECMO circuit, teaching, and activity workspace"
        />
      </div>

      {next ? (
        <Link
          href={`/cardiohelp-ecmo/learn?lesson=${next.id}&track=${supportMode}` as Route}
          className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          Continue to next section: {next.title}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </main>
  )
}
