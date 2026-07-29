'use client'

import { useEffect, useMemo, useReducer, useState } from 'react'
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
import type { SupportMode } from '../engine/types'
import { CardiohelpConsole } from './CardiohelpConsole'
import { CircuitAndMonitors } from './CircuitAndMonitors'
import { EcmoFoundationTeachingPanel } from './teaching/EcmoFoundationTeachingPanel'

/**
 * The Learn activity for the seven interactive foundation sections.
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
 * Nothing here records a scenario result, writes mastery, or touches Practice progress: a preview
 * is a state to read, not a drill being worked.
 */

const PHASES: readonly CriticalCareActivityPhase[] = [
  'recognize',
  'predict',
  'act',
  'observe',
  'explain',
  'transfer',
]

const DEVICE_BOUNDARY_SHORT =
  'Console follows the U.S. CARDIOHELP Instructions for Use, Revision 2.3 (January 2025). The VV and VA teaching is not limited to the U.S. labeled indication or duration.'

const DEVICE_BOUNDARY_FULL =
  'The simulated console follows the U.S. CARDIOHELP System Instructions for Use, Revision 2.3, January 2025. The VV and VA clinical teaching reflects contemporary ECMO practice and is not limited to the U.S. labeled indication or duration. This independent educational module does not replace current manufacturer instructions, local protocol, or supervised competency validation.'

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

  const [session, dispatch] = useReducer(ecmoFoundationSessionReducer, primaryVariant, (variant) =>
    createEcmoFoundationSessionState(variant),
  )

  const [phase, setPhase] = useState<CriticalCareActivityPhase>(initialPhase)
  const [committedPredictionId, setCommittedPredictionId] = useState<string | null>(null)
  const [committedTransferId, setCommittedTransferId] = useState<string | null>(null)

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

  if (!section) return null

  const primary = (
    <div className="grid gap-3" data-pane="circuit-and-console">
      <div className="rounded-xl border px-3 py-2" data-active-state-variant={activeVariant.id}>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">State on screen</p>
        <p className="text-sm font-semibold">{activeVariant.label}</p>
        {running ? null : (
          <p className="mt-1 text-xs leading-5 font-medium" data-clock-held>
            The clock is held here, so this state stays as it is until you start it.
          </p>
        )}
        {activeVariant.modelBoundary ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground" data-variant-boundary>
            {activeVariant.modelBoundary}
          </p>
        ) : null}
      </div>
      <CardiohelpConsole
        state={session.simulation}
        dispatch={(action) => dispatch({ type: 'SIMULATION', action })}
        controlsEnabled={false}
      />
      <CircuitAndMonitors
        state={session.simulation}
        dispatch={(action) => dispatch({ type: 'SIMULATION', action })}
        controlsEnabled={false}
      />
      <p
        className="rounded-xl border border-dashed px-3 py-2 text-xs leading-5"
        data-device-boundary
      >
        {DEVICE_BOUNDARY_SHORT}
      </p>
    </div>
  )

  const secondary = (
    <div className="grid gap-4" data-pane="teaching">
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
    <div className="grid gap-4" data-pane="your-turn">
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
                onClick={() => setCommittedTransferId(choice.id)}
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
        Opening state: {primaryVariant.label}. Support configuration:{' '}
        {supportMode === 'va' ? 'venoarterial' : 'venovenous'}.
      </p>

      {trackIsFixed ? (
        <p
          className="mt-3 inline-flex rounded-xl border px-3 py-1.5 text-sm"
          data-fixed-pathway={supportMode}
        >
          VV pathway · this section teaches series physiology and always runs on the VV reference
          circuit.
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

      <div className="mt-4">
        <ResizableTeachingWorkspace
          primary={primary}
          secondary={secondary}
          tertiary={tertiary}
          paneLabels={{
            primary: 'Circuit & console',
            secondary: 'Teaching',
            tertiary: 'Your turn',
          }}
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
