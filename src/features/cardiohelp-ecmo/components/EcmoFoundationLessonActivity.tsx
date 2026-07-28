'use client'

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
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
  type EcmoSharedFoundationSectionId,
} from '../content/foundationLessonRuntime'
import { ecmoReferenceProfileForMode } from '../content/referenceProfiles'
import { createReferenceSimulationState, ecmoSimulationReducer } from '../engine'
import type { EcmoSimulationState, SimulationAction, SupportMode } from '../engine/types'
import { CardiohelpConsole } from './CardiohelpConsole'
import { CircuitAndMonitors } from './CircuitAndMonitors'
import { EcmoFoundationTeachingPanel } from './teaching/EcmoFoundationTeachingPanel'

/**
 * The Learn activity for the four track-shared foundation sections.
 *
 * These were static prose pages with no simulator at all, which meant the sections that teach the
 * circuit were the only ones a learner could not look at a circuit while reading. This activity
 * gives them one live reference circuit — fault-free, running, and authored as content rather than
 * as a scenario — and arranges it in the same three panes the rest of the resource uses.
 *
 * One reducer, mounted once here, feeds all three panes. The console and the circuit view are the
 * existing components; nothing is duplicated.
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

interface ActivityState {
  readonly simulation: EcmoSimulationState
  /** Reset whenever the reference circuit is restored, so evidence never carries across. */
  readonly interactionsSinceRestore: readonly string[]
}

type ActivityAction =
  | { readonly type: 'simulation'; readonly action: SimulationAction }
  | { readonly type: 'restore'; readonly supportMode: SupportMode }
  | { readonly type: 'record-interaction'; readonly id: string }

function profileIdFor(supportMode: SupportMode) {
  return ecmoReferenceProfileForMode(supportMode).id
}

function activityReducer(state: ActivityState, action: ActivityAction): ActivityState {
  switch (action.type) {
    case 'simulation':
      return { ...state, simulation: ecmoSimulationReducer(state.simulation, action.action) }
    case 'restore':
      return {
        simulation: createReferenceSimulationState(profileIdFor(action.supportMode)),
        interactionsSinceRestore: [],
      }
    case 'record-interaction':
      return {
        ...state,
        interactionsSinceRestore: state.interactionsSinceRestore.includes(action.id)
          ? state.interactionsSinceRestore
          : [...state.interactionsSinceRestore, action.id],
      }
    default:
      return state
  }
}

export function EcmoFoundationLessonActivity({
  sectionId,
  supportMode,
}: {
  readonly sectionId: EcmoSharedFoundationSectionId
  readonly supportMode: SupportMode
}) {
  const section = ecmoFoundationSectionById.get(sectionId)
  const runtime = ecmoFoundationLessonRuntime(sectionId)
  const items = ecmoFoundationLearningItemsFor(sectionId)
  const profile = ecmoReferenceProfileForMode(supportMode)

  const [state, dispatch] = useReducer(activityReducer, undefined, () => ({
    simulation: createReferenceSimulationState(profileIdFor(supportMode)),
    interactionsSinceRestore: [],
  }))

  const [phase, setPhase] = useState<CriticalCareActivityPhase>('recognize')
  const [committedPredictionId, setCommittedPredictionId] = useState<string | null>(null)
  const [committedTransferId, setCommittedTransferId] = useState<string | null>(null)
  const [running, setRunning] = useState(true)

  // The reference circuit is reloaded when the track changes; a VA lesson must never inherit a VV
  // circuit's state.
  useEffect(() => {
    dispatch({ type: 'restore', supportMode })
    setPhase('recognize')
    setCommittedPredictionId(null)
    setCommittedTransferId(null)
  }, [supportMode, sectionId])

  useEffect(() => {
    if (!running) return undefined
    const timer = setInterval(
      () => dispatch({ type: 'simulation', action: { type: 'STEP' } }),
      1000,
    )
    return () => clearInterval(timer)
  }, [running])

  const runAction = useCallback(
    (actionId: string) => {
      const guided = runtime.guidedActions.find((candidate) => candidate.id === actionId)
      if (!guided) return
      if (guided.restoreFirst || guided.id === 'restore-reference') {
        dispatch({ type: 'restore', supportMode })
      }
      dispatch({ type: 'record-interaction', id: guided.id })
    },
    [runtime.guidedActions, supportMode],
  )

  // Applying the action itself has to happen after a restore has landed, so it is sequenced
  // through an effect keyed on the recorded interaction rather than fired inline.
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  useEffect(() => {
    if (!pendingAction) return
    const guided = runtime.guidedActions.find((candidate) => candidate.id === pendingAction)
    setPendingAction(null)
    if (!guided) return
    const resolved = guided.resolve(state.simulation)
    if (resolved) dispatch({ type: 'simulation', action: resolved })
    for (let tick = 0; tick < guided.settleSeconds; tick += 1) {
      dispatch({ type: 'simulation', action: { type: 'STEP' } })
    }
    // Intentionally excludes `state.simulation`: this must run once per queued action, not on
    // every tick of the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAction, runtime.guidedActions])

  const pathway = criticalCareLearningPathway('cardiohelp-ecmo', supportMode)
  const sectionIndex = pathwaySectionIndex(pathway, sectionId)
  const next = nextPathwaySection(pathway, sectionId)

  const conflict = section?.heldDisagreementId
    ? criticalCareSourceConflictById.get(section.heldDisagreementId)
    : undefined

  const phaseCopy = runtime.phases[phase]
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
      <CardiohelpConsole
        state={state.simulation}
        dispatch={(action) => dispatch({ type: 'simulation', action })}
        controlsEnabled={false}
      />
      <CircuitAndMonitors
        state={state.simulation}
        dispatch={(action) => dispatch({ type: 'simulation', action })}
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
      <EcmoFoundationTeachingPanel sectionId={sectionId} state={state.simulation} />

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
                onClick={() => setPhase('act')}
              >
                Continue
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {phase === 'act' || phase === 'observe' ? (
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
                onClick={() => {
                  runAction(guided.id)
                  setPendingAction(guided.id)
                }}
              >
                <span className="font-semibold">{guided.label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {guided.description}
                </span>
              </button>
            ))}
          </div>
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
            onClick={() => setRunning((current) => !current)}
          >
            {running ? 'Pause the circuit' : 'Run the circuit'}
          </button>
          <button
            type="button"
            className="rounded-xl border px-3 py-2 text-sm"
            onClick={() => dispatch({ type: 'restore', supportMode })}
          >
            Restore reference state
          </button>
        </div>
        <nav className="mt-3 flex flex-wrap gap-2" aria-label="Lesson phases">
          {PHASES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className="rounded-lg border px-2 py-1 text-xs"
              aria-current={candidate === phase ? 'step' : undefined}
              onClick={() => setPhase(candidate)}
            >
              {candidate}
            </button>
          ))}
        </nav>
      </section>
    </div>
  )

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
        {supportMode.toUpperCase()} pathway · Section {sectionIndex + 1} of{' '}
        {pathway.sections.length}
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{section.title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        Reference circuit: {profile.title}. Support configuration:{' '}
        {supportMode === 'va' ? 'venoarterial' : 'venovenous'}.
      </p>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Reference circuit track">
        {(['vv', 'va'] as const).map((candidate) => (
          <Link
            key={candidate}
            href={`/cardiohelp-ecmo/learn?lesson=${sectionId}&track=${candidate}` as Route}
            className="rounded-xl border px-3 py-1.5 text-sm"
            aria-current={candidate === supportMode ? 'true' : undefined}
          >
            {candidate.toUpperCase()} reference
          </Link>
        ))}
      </div>
      <p className="sr-only" role="status">
        Showing the {supportMode === 'va' ? 'venoarterial' : 'venovenous'} reference circuit.
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
