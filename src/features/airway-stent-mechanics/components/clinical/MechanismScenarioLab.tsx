'use client'

import { CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, ShieldAlert } from 'lucide-react'
import { useId, useReducer } from 'react'

import {
  mechanismScenarioLabEnglishCopy,
  type MechanismScenarioLabCopy,
} from '../../content/mechanismScenarioLabCopy'
import type {
  MechanismArchitectureFamily,
  MechanismOutcomeDomain,
  MechanismPhase,
  MechanismScenario,
} from '../../content/mechanismScenarioRegistry'
import { getEvidenceReference } from '../../content/evidenceRegistry'
import {
  canAdvanceMechanismScenario,
  createInitialMechanismScenarioState,
  getCommittedMechanismPrediction,
  getCurrentMechanismPhase,
  getMechanismArchitectureBehavior,
  getMechanismConsequence,
  getPendingMechanismArchitectureFamilies,
  reduceMechanismScenarioState,
  type MechanismScenarioAction,
  type MechanismScenarioState,
} from '../../engine/mechanismScenarioFlow'

interface MechanismScenarioLabProps {
  scenario: MechanismScenario
  copy?: MechanismScenarioLabCopy
  onArchitectureCompleted?: (details: {
    scenarioId: string
    architectureFamily: MechanismArchitectureFamily
    consequenceId: string
  }) => void
  onPredictionCommitted?: (details: {
    scenarioId: string
    architectureFamily: MechanismArchitectureFamily
    predictionId: string
  }) => void
  onCompleted?: (details: {
    scenarioId: string
    architectureFamily: MechanismArchitectureFamily
    consequenceId: string
  }) => void
  onObservationCommitted?: (details: { scenarioId: string; observationId: string }) => void
}

const outcomeDomainLabels: Record<MechanismOutcomeDomain, string> = {
  'technical-patency': 'Technical patency',
  'symptom-quality-of-life': 'Symptoms and quality of life',
  'reintervention-burden': 'Reintervention burden',
  'underlying-disease-outcome': 'Underlying disease outcome',
}

export function MechanismScenarioLab(props: MechanismScenarioLabProps) {
  return <MechanismScenarioLabSession key={props.scenario.id} {...props} />
}

function MechanismScenarioLabSession({
  copy = mechanismScenarioLabEnglishCopy,
  onArchitectureCompleted,
  onCompleted,
  onObservationCommitted,
  onPredictionCommitted,
  scenario,
}: MechanismScenarioLabProps) {
  const [state, dispatch] = useReducer(
    (currentState: MechanismScenarioState, action: MechanismScenarioAction) =>
      reduceMechanismScenarioState(scenario, currentState, action),
    scenario,
    createInitialMechanismScenarioState,
  )
  const phase = getCurrentMechanismPhase(scenario, state)
  const behavior = getMechanismArchitectureBehavior(scenario, state.architectureFamily)
  const committedPrediction = getCommittedMechanismPrediction(scenario, state)
  const consequence = getMechanismConsequence(scenario, state)
  const pendingArchitectureFamilies = getPendingMechanismArchitectureFamilies(scenario, state)
  const completingCurrentFamilyFinishesScenario =
    scenario.completionPolicy === 'selected-architecture-family' ||
    scenario.architectureFamilies.every(
      (architectureFamily) =>
        architectureFamily === state.architectureFamily ||
        state.completedArchitectureFamilies.includes(architectureFamily),
    )
  const predictionChanged = Boolean(
    state.committedPredictionId && state.selectedPredictionId !== state.committedPredictionId,
  )
  const currentHotspots = phase.hotspotIds
    .map((hotspotId) => scenario.hotspots.find((hotspot) => hotspot.id === hotspotId))
    .filter((hotspot): hotspot is NonNullable<typeof hotspot> => Boolean(hotspot))
  const requiredObservations = (phase.requiredObservationIds ?? [])
    .map((observationId) =>
      scenario.observationPrompts.find((observation) => observation.id === observationId),
    )
    .filter((observation): observation is NonNullable<typeof observation> => Boolean(observation))

  function commitPrediction() {
    if (!state.selectedPredictionId) return
    dispatch({ type: 'commit-prediction' })
    onPredictionCommitted?.({
      scenarioId: scenario.id,
      architectureFamily: state.architectureFamily,
      predictionId: state.selectedPredictionId,
    })
  }

  function completeScenario() {
    if (!consequence || state.completed) return
    const architectureAlreadyCompleted = state.completedArchitectureFamilies.includes(
      state.architectureFamily,
    )
    dispatch({ type: 'complete' })
    const details = {
      scenarioId: scenario.id,
      architectureFamily: state.architectureFamily,
      consequenceId: consequence.id,
    }
    if (!architectureAlreadyCompleted) onArchitectureCompleted?.(details)
    if (completingCurrentFamilyFinishesScenario) onCompleted?.(details)
  }

  return (
    <section
      className="overflow-hidden rounded-3xl border bg-card shadow-sm"
      aria-labelledby={`${scenario.id}-mechanism-title`}
      data-testid={`mechanism-scenario-${scenario.id}`}
    >
      <header className="border-b bg-gradient-to-r from-cyan-500/10 via-background to-indigo-500/10 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-800 dark:text-cyan-200">
            {copy.eyebrow}
          </span>
          <span className="rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground">
            {scenario.clinicalReviewStatus === 'reviewed' ? copy.reviewedBadge : copy.draftBadge}
          </span>
          <span className="rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground">
            SVG + text equivalent
          </span>
        </div>
        <h3
          id={`${scenario.id}-mechanism-title`}
          className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl"
        >
          {scenario.title}
        </h3>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground sm:text-base">
          {scenario.clinicalQuestion}
        </p>
      </header>

      <div className="space-y-6 p-5 sm:p-7">
        {scenario.architectureFamilies.length > 1 ? (
          <fieldset>
            <legend className="text-sm font-semibold">{copy.architectureLegend}</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {scenario.architectureFamilies.map((architectureFamily) => {
                const candidate = getMechanismArchitectureBehavior(scenario, architectureFamily)
                const architectureCompleted =
                  state.completedArchitectureFamilies.includes(architectureFamily)
                return (
                  <label
                    key={architectureFamily}
                    className={
                      state.architectureFamily === architectureFamily
                        ? 'flex cursor-pointer gap-3 rounded-xl border border-cyan-500/60 bg-cyan-500/10 p-4 focus-within:ring-2 focus-within:ring-cyan-500'
                        : 'flex cursor-pointer gap-3 rounded-xl border bg-background p-4 hover:border-cyan-500/40 focus-within:ring-2 focus-within:ring-cyan-500'
                    }
                  >
                    <input
                      type="radio"
                      name={`${scenario.id}-architecture`}
                      value={architectureFamily}
                      checked={state.architectureFamily === architectureFamily}
                      onChange={() => dispatch({ type: 'select-architecture', architectureFamily })}
                      className="mt-1 accent-cyan-600"
                    />
                    <span>
                      <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {candidate.label}
                        {architectureCompleted ? (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-emerald-700 dark:text-emerald-200">
                            {copy.architectureCompletedLabel}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {candidate.construction}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        ) : null}

        {scenario.completionPolicy === 'all-architecture-families' ? (
          <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-4" role="status">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700 dark:text-indigo-200">
              {copy.architectureCoverageLabel}: {state.completedArchitectureFamilies.length} of{' '}
              {scenario.architectureFamilies.length} {copy.architectureCompletedLabel.toLowerCase()}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {pendingArchitectureFamilies.length > 0
                ? copy.architecturePendingInstruction
                : copy.completedButton}
            </p>
          </div>
        ) : null}

        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label={copy.phaseLabel}>
          {scenario.phases.map((candidate, index) => {
            const visible = Boolean(state.committedPredictionId) || index === 0
            const current = index === state.phaseIndex
            return (
              <li
                key={candidate.id}
                aria-current={current ? 'step' : undefined}
                className={
                  current
                    ? 'rounded-xl border border-cyan-500/50 bg-cyan-500/10 p-3'
                    : 'rounded-xl border bg-muted/20 p-3'
                }
              >
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {copy.phaseLabel} {index + 1}
                </span>
                <span className="mt-1 block text-sm font-semibold">
                  {visible ? candidate.label : copy.lockedPhaseLabel}
                </span>
              </li>
            )
          })}
        </ol>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
          <div className="min-w-0">
            <MechanismScene
              architectureFamily={state.architectureFamily}
              phase={phase}
              scenario={scenario}
            />
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border bg-background p-4" aria-live="polite">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-200">
                {phase.label}
              </p>
              <p className="mt-2 text-sm leading-6">{phase.action}</p>
              <div className="mt-4 rounded-xl bg-muted/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {copy.textEquivalentLabel}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {phase.reducedMotionText}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-200">
                {copy.inspectLabel}
              </p>
              <ul className="mt-3 space-y-3">
                {currentHotspots.map((hotspot) => (
                  <li key={hotspot.id} className="text-xs leading-5 text-muted-foreground">
                    <strong className="block text-foreground">{hotspot.label}</strong>
                    {hotspot.description}
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>

        <section className="rounded-2xl border bg-background p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-200">
            {behavior.label}
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-foreground">{copy.constructionLabel}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {behavior.construction}
              </p>
              {committedPrediction && behavior.motionDuringCough ? (
                <BehaviorList label={copy.behaviorLabel} items={behavior.motionDuringCough} />
              ) : null}
              {committedPrediction && behavior.deploymentMethod ? (
                <BehaviorList label={copy.deploymentLabel} items={behavior.deploymentMethod} />
              ) : null}
            </div>
            <div>
              {committedPrediction ? (
                <BehaviorList label={copy.notModeledLabel} items={behavior.explicitlyNotModeled} />
              ) : (
                <p className="rounded-xl border border-dashed p-3 text-xs leading-5 text-muted-foreground">
                  Architecture-specific motion and deployment details appear after commitment.
                </p>
              )}
            </div>
          </div>
        </section>

        <fieldset className="rounded-2xl border bg-background p-4 sm:p-5">
          <legend className="px-1 text-sm font-semibold">{copy.predictionLegend}</legend>
          <p className="text-sm font-semibold leading-6">{scenario.learnerPrompt.question}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {scenario.learnerPrompt.instruction}
          </p>
          <div className="mt-4 space-y-2">
            {scenario.learnerPrompt.choices.map((choice) => (
              <label
                key={choice.id}
                className={
                  state.selectedPredictionId === choice.id
                    ? 'flex cursor-pointer gap-3 rounded-xl border border-cyan-500/60 bg-cyan-500/10 p-4 focus-within:ring-2 focus-within:ring-cyan-500'
                    : 'flex cursor-pointer gap-3 rounded-xl border p-4 hover:border-cyan-500/40 focus-within:ring-2 focus-within:ring-cyan-500'
                }
              >
                <input
                  type="radio"
                  name={scenario.learnerPrompt.id}
                  value={choice.id}
                  checked={state.selectedPredictionId === choice.id}
                  onChange={() => dispatch({ type: 'select-prediction', predictionId: choice.id })}
                  className="mt-1 accent-cyan-600"
                />
                <span className="text-sm leading-6">{choice.label}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={commitPrediction}
            disabled={
              !state.selectedPredictionId ||
              (!predictionChanged && state.selectedPredictionId === state.committedPredictionId)
            }
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-500 px-5 text-sm font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {state.committedPredictionId ? copy.recommitButton : copy.commitButton}
          </button>

          {committedPrediction ? (
            <div
              className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4"
              role="status"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-800 dark:text-cyan-200">
                {copy.committedLabel}
              </p>
              <p className="mt-2 text-sm leading-6">{committedPrediction.postCommitRationale}</p>
            </div>
          ) : null}
        </fieldset>

        {requiredObservations.length > 0 ? (
          <fieldset className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5">
            <legend className="px-1 text-sm font-semibold">{copy.observationLegend}</legend>
            <p className="text-xs leading-5 text-muted-foreground">{copy.observationInstruction}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {requiredObservations.map((observation) => (
                <label
                  key={observation.id}
                  className="flex cursor-pointer gap-3 rounded-xl border bg-background p-3 focus-within:ring-2 focus-within:ring-amber-500"
                >
                  <input
                    type="checkbox"
                    checked={state.completedObservationIds.includes(observation.id)}
                    onChange={() => {
                      const committing = !state.completedObservationIds.includes(observation.id)
                      dispatch({ type: 'toggle-observation', observationId: observation.id })
                      if (committing) {
                        onObservationCommitted?.({
                          scenarioId: scenario.id,
                          observationId: observation.id,
                        })
                      }
                    }}
                    className="mt-1 accent-amber-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold">{observation.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {observation.purpose}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {consequence ? (
          <section
            className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 sm:p-5"
            aria-labelledby={`${scenario.id}-consequence-title`}
            aria-live="polite"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700 dark:text-indigo-200">
              {copy.consequenceLabel}
            </p>
            <h4 id={`${scenario.id}-consequence-title`} className="mt-2 text-xl font-bold">
              {consequence.label}
            </h4>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{consequence.summary}</p>
            <ul className="mt-4 grid gap-2 md:grid-cols-3">
              {consequence.inspectionFindings.map((finding) => (
                <li key={finding} className="rounded-xl border bg-background p-3 text-xs leading-5">
                  {finding}
                </li>
              ))}
            </ul>
            {consequence.outcomeDomains ? (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700 dark:text-indigo-200">
                  {copy.outcomeDomainsLabel}
                </p>
                <dl className="mt-3 grid gap-2 md:grid-cols-2">
                  {Object.entries(consequence.outcomeDomains).map(([domain, description]) => (
                    <div key={domain} className="rounded-xl border bg-background p-3">
                      <dt className="text-sm font-semibold">
                        {outcomeDomainLabels[domain as MechanismOutcomeDomain]}
                      </dt>
                      <dd className="mt-1 text-xs leading-5 text-muted-foreground">
                        {description}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'previous' })}
              disabled={!state.committedPredictionId || state.phaseIndex <= 1}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              {copy.previousButton}
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'restart' })}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              {copy.restartButton}
            </button>
          </div>

          {consequence ? (
            <button
              type="button"
              onClick={completeScenario}
              disabled={state.completed}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {state.completed
                ? copy.completedButton
                : completingCurrentFamilyFinishesScenario
                  ? copy.completeButton
                  : copy.completeArchitectureButton}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => dispatch({ type: 'advance' })}
              disabled={!canAdvanceMechanismScenario(scenario, state)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-500 px-5 text-sm font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {copy.advanceButton}
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-200">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            {copy.evidenceBoundaryLabel}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {scenario.evidenceBoundary}
          </p>
          <p className="mt-3 border-t border-amber-500/20 pt-3 text-xs leading-5 text-muted-foreground">
            {copy.disclaimer}
          </p>
        </section>

        <details className="rounded-2xl border bg-background p-4">
          <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
            {copy.evidenceSourcesLabel}
          </summary>
          <ul className="mt-4 space-y-3 text-xs leading-5 text-muted-foreground">
            {scenario.evidenceRefs.map((evidenceId) => {
              const reference = getEvidenceReference(evidenceId)
              return (
                <li key={evidenceId}>
                  {reference.url ? (
                    <a
                      href={reference.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-cyan-700 underline underline-offset-2 dark:text-cyan-200"
                    >
                      {reference.citation}
                    </a>
                  ) : (
                    <span>{reference.citation}</span>
                  )}
                  <span className="mt-1 block">
                    {reference.supportLevel} support · {reference.clinicalReviewStatus} clinical
                    review
                    {reference.sourcePages?.length
                      ? ` · source pages ${reference.sourcePages.join(', ')}`
                      : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        </details>
      </div>
    </section>
  )
}

function BehaviorList({ items, label }: { items: readonly string[]; label: string }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      <ul className="mt-1 space-y-1 text-xs leading-5 text-muted-foreground">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  )
}

function MechanismScene({
  architectureFamily,
  phase,
  scenario,
}: {
  architectureFamily: MechanismArchitectureFamily
  phase: MechanismPhase
  scenario: MechanismScenario
}) {
  const rawId = useId()
  const sceneId = `${scenario.id}-${rawId.replaceAll(':', '')}`
  const titleId = `${sceneId}-title`
  const descriptionId = `${sceneId}-description`

  return (
    <figure
      className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950"
      data-motion="static"
      data-testid="mechanism-scenario-scene"
    >
      <svg
        viewBox="0 0 720 360"
        className="h-auto min-h-[18rem] w-full"
        role="img"
        aria-labelledby={`${titleId} ${descriptionId}`}
      >
        <title id={titleId}>{`${scenario.title}: ${phase.label}`}</title>
        <desc id={descriptionId}>{phase.reducedMotionText}</desc>
        <defs>
          <pattern
            id={`${sceneId}-braid`}
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(32)"
          >
            <path d="M 0 0 L 0 18" stroke="#67e8f9" strokeWidth="5" />
          </pattern>
          <marker
            id={`${sceneId}-arrow`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24" />
          </marker>
        </defs>
        <rect width="720" height="360" fill="#020617" />
        {scenario.kind === 'curved-airway-deformation' ? <CurveScene phase={phase} /> : null}
        {scenario.kind === 'cough-interface-behavior' ? (
          <CoughScene
            architectureFamily={architectureFamily}
            arrowId={`${sceneId}-arrow`}
            braidId={`${sceneId}-braid`}
            phase={phase}
          />
        ) : null}
        {scenario.kind === 'bifurcation-fit-deployment' ? (
          <WholeYScene
            architectureFamily={architectureFamily}
            arrowId={`${sceneId}-arrow`}
            phase={phase}
          />
        ) : null}
        {scenario.kind === 'longitudinal-outcomes' ? <TimelineScene phase={phase} /> : null}
      </svg>
      <figcaption className="border-t border-slate-800 bg-slate-900/70 px-4 py-3 text-xs leading-5 text-slate-300">
        {phase.reducedMotionText}
      </figcaption>
    </figure>
  )
}

function CurveScene({ phase }: { phase: MechanismPhase }) {
  const loaded = phase.visualState !== 'curve-stable'
  const involuted = phase.visualState === 'curve-central-involution'
  const devicePath = loaded ? 'M 150 235 Q 355 155 565 220' : 'M 150 235 Q 355 90 565 220'

  return (
    <>
      <path
        d="M 90 260 Q 350 20 640 245"
        fill="none"
        stroke="#7f1d1d"
        strokeWidth="118"
        strokeLinecap="round"
      />
      <path
        d="M 90 260 Q 350 20 640 245"
        fill="none"
        stroke="#1e293b"
        strokeWidth="78"
        strokeLinecap="round"
      />
      <path d={devicePath} fill="none" stroke="#22d3ee" strokeWidth="48" strokeLinecap="round" />
      <path d={devicePath} fill="none" stroke="#082f49" strokeWidth="30" strokeLinecap="round" />
      {loaded ? (
        <>
          <path d="M 230 112 L 260 155" stroke="#fbbf24" strokeWidth="3" />
          <text x="105" y="100" fill="#fde68a" fontSize="15" fontWeight="600">
            straighter device axis
          </text>
          <path d="M 500 112 L 548 176" stroke="#fbbf24" strokeWidth="3" />
          <text x="470" y="92" fill="#fde68a" fontSize="15" fontWeight="600">
            end apposition shifts
          </text>
        </>
      ) : (
        <text x="218" y="42" fill="#a5f3fc" fontSize="15" fontWeight="600">
          compare airway and device centerlines
        </text>
      )}
      {involuted ? (
        <g transform="translate(300 175)">
          <rect width="150" height="142" rx="18" fill="#0f172a" stroke="#475569" />
          <text x="16" y="24" fill="#e2e8f0" fontSize="13" fontWeight="600">
            central cross-section
          </text>
          <circle cx="75" cy="82" r="43" fill="#22d3ee" />
          <path
            d="M 47 82 C 50 55, 66 63, 75 77 C 84 63, 100 55, 103 82 C 100 109, 84 101, 75 87 C 66 101, 50 109, 47 82 Z"
            fill="#082f49"
          />
          <text x="34" y="132" fill="#a5f3fc" fontSize="12">
            inward solid-wall fold
          </text>
        </g>
      ) : null}
      <text x="26" y="335" fill="#cbd5e1" fontSize="13">
        Generic solid silicone tube · no braid-angle shortening
      </text>
    </>
  )
}

function CoughScene({
  architectureFamily,
  arrowId,
  braidId,
  phase,
}: {
  architectureFamily: MechanismArchitectureFamily
  arrowId: string
  braidId: string
  phase: MechanismPhase
}) {
  const braid = architectureFamily === 'braided-self-expanding-scaffold'
  const excursion = phase.visualState !== 'cough-rest'
  const contributorCheck = phase.visualState === 'cough-contributors'
  const tissueResponse = phase.visualState === 'cough-tissue-response'
  const x = braid && excursion ? 210 : excursion ? 205 : 180
  const width = braid && excursion ? 300 : 360
  const height = braid && excursion ? 92 : 72
  const y = 180 - height / 2

  return (
    <>
      <rect x="45" y="102" width="630" height="156" rx="78" fill="#7f1d1d" />
      <rect x="70" y="126" width="580" height="108" rx="54" fill="#1e293b" />
      <path d="M 180 88 V 272 M 540 88 V 272" stroke="#94a3b8" strokeDasharray="6 7" />
      {contributorCheck ? (
        <g>
          {[
            ['End contact', 90, 80],
            ['Secretions / infection', 390, 80],
            ['Dwell time', 90, 225],
            ['Host response', 390, 225],
          ].map(([label, cardX, cardY]) => (
            <g key={String(label)} transform={`translate(${cardX} ${cardY})`}>
              <rect width="240" height="58" rx="12" fill="#172554" stroke="#818cf8" />
              <text x="120" y="35" fill="#e0e7ff" fontSize="15" textAnchor="middle">
                {label}
              </text>
            </g>
          ))}
          <text x="360" y="45" fill="#c7d2fe" fontSize="15" textAnchor="middle">
            Acknowledge every contributor domain
          </text>
        </g>
      ) : (
        <>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            rx={braid ? 14 : 30}
            fill={braid ? `url(#${braidId})` : '#22d3ee'}
            stroke="#cffafe"
            strokeWidth="3"
          />
          <rect
            x={x + 10}
            y={y + 17}
            width={width - 20}
            height={height - 34}
            rx="20"
            fill="#082f49"
          />
          {excursion ? (
            <>
              <line
                x1="180"
                y1="292"
                x2={x}
                y2="292"
                stroke="#fbbf24"
                strokeWidth="3"
                markerEnd={`url(#${arrowId})`}
              />
              <line
                x1="540"
                y1="312"
                x2={x + width}
                y2="312"
                stroke="#fbbf24"
                strokeWidth="3"
                markerEnd={`url(#${arrowId})`}
              />
              <text x="360" y="338" fill="#fde68a" fontSize="14" textAnchor="middle">
                {braid
                  ? 'diameter-length coupling with axial end excursion'
                  : 'whole-device sliding; solid-wall length is unchanged'}
              </text>
            </>
          ) : (
            <text x="360" y="310" fill="#cbd5e1" fontSize="14" textAnchor="middle">
              fixed airway reference marks establish the resting position
            </text>
          )}
          {tissueResponse ? (
            <>
              <ellipse cx={x + 12} cy="180" rx="25" ry="34" fill="#fb7185" opacity="0.9" />
              <ellipse cx={x + width - 12} cy="180" rx="25" ry="34" fill="#fb7185" opacity="0.9" />
              <text x="360" y="58" fill="#fecdd3" fontSize="14" textAnchor="middle">
                conceptual tissue-response pose · no single cause assigned
              </text>
            </>
          ) : null}
        </>
      )}
      <text x="26" y="28" fill="#a5f3fc" fontSize="14" fontWeight="600">
        {braid ? 'Braided scaffold' : 'Solid silicone tube'}
      </text>
    </>
  )
}

function WholeYScene({
  architectureFamily,
  arrowId,
  phase,
}: {
  architectureFamily: MechanismArchitectureFamily
  arrowId: string
  phase: MechanismPhase
}) {
  const metallic = architectureFamily === 'metallic-y-scaffold'
  const deploying = phase.visualState === 'y-deployment'
  const postdeployment = phase.visualState === 'y-postdeployment'
  const deviceStroke = metallic ? '#a5f3fc' : '#22d3ee'
  const dash = phase.visualState === 'y-whole-fit' ? '10 8' : undefined

  return (
    <>
      <path d="M 360 28 V 170" stroke="#7f1d1d" strokeWidth="118" strokeLinecap="round" />
      <path d="M 360 160 Q 315 215 180 305" stroke="#7f1d1d" strokeWidth="98" fill="none" />
      <path d="M 360 160 Q 405 215 540 305" stroke="#7f1d1d" strokeWidth="98" fill="none" />
      <path d="M 360 30 V 170" stroke="#1e293b" strokeWidth="76" strokeLinecap="round" />
      <path d="M 360 160 Q 315 215 180 305" stroke="#1e293b" strokeWidth="58" fill="none" />
      <path d="M 360 160 Q 405 215 540 305" stroke="#1e293b" strokeWidth="58" fill="none" />
      {deploying && metallic ? (
        <>
          <path d="M 350 20 Q 315 215 175 320" stroke="#fbbf24" strokeWidth="3" fill="none" />
          <path d="M 370 20 Q 405 215 545 320" stroke="#fbbf24" strokeWidth="3" fill="none" />
          <text x="360" y="340" fill="#fde68a" fontSize="14" textAnchor="middle">
            maintain both guidewire pathways during staged release
          </text>
        </>
      ) : (
        <>
          <path
            d="M 360 38 V 165"
            stroke={deviceStroke}
            strokeWidth={metallic ? 26 : 34}
            strokeDasharray={dash}
            strokeLinecap="round"
          />
          <path
            d="M 360 160 Q 315 215 190 294"
            stroke={deviceStroke}
            strokeWidth={metallic ? 22 : 30}
            strokeDasharray={dash}
            fill="none"
          />
          <path
            d="M 360 160 Q 405 215 530 294"
            stroke={deviceStroke}
            strokeWidth={metallic ? 22 : 30}
            strokeDasharray={dash}
            fill="none"
          />
        </>
      )}
      {deploying && !metallic ? (
        <>
          <line
            x1="360"
            y1="35"
            x2="360"
            y2="125"
            stroke="#fbbf24"
            strokeWidth="4"
            markerEnd={`url(#${arrowId})`}
          />
          <text x="465" y="82" fill="#fde68a" fontSize="14">
            push-pull orientation
          </text>
        </>
      ) : null}
      <circle cx="360" cy="166" r="18" fill="#fbbf24" opacity="0.8" />
      <text x="385" y="174" fill="#fde68a" fontSize="13">
        saddle
      </text>
      {postdeployment ? (
        <>
          <circle cx="175" cy="306" r="15" fill="none" stroke="#4ade80" strokeWidth="4" />
          <circle cx="545" cy="306" r="15" fill="none" stroke="#4ade80" strokeWidth="4" />
          <text x="360" y="342" fill="#bbf7d0" fontSize="14" textAnchor="middle">
            inspect both distal orifices after seating the whole Y
          </text>
        </>
      ) : null}
      <text x="24" y="28" fill="#a5f3fc" fontSize="14" fontWeight="600">
        {metallic ? 'Generic metallic Y scaffold' : 'Generic silicone Y'}
      </text>
    </>
  )
}

function TimelineScene({ phase }: { phase: MechanismPhase }) {
  const phaseOrder = ['timeline-baseline', 'timeline-early', 'timeline-later', 'timeline-outcomes']
  const currentIndex = phaseOrder.indexOf(phase.id)
  const cards = [
    ['Technical baseline', 'Patency · position · branch preservation'],
    ['Early reassessment', 'Mucus obstruction · infection · migration · branch obstruction'],
    ['Later reassessment', 'Granulation · tumor ingrowth/overgrowth · fracture · cover failure'],
    ['Four outcome domains', 'Technical · patient-experienced · reintervention · disease'],
  ] as const

  return (
    <>
      <line x1="90" y1="72" x2="630" y2="72" stroke="#475569" strokeWidth="5" />
      {cards.map(([label, details], index) => {
        const revealed = index <= currentIndex
        const y = 110 + index * 58
        return (
          <g key={label} opacity={revealed ? 1 : 0.28}>
            <circle cx={90 + index * 180} cy="72" r="14" fill={revealed ? '#22d3ee' : '#475569'} />
            <rect
              x="70"
              y={y}
              width="580"
              height="46"
              rx="12"
              fill={index === currentIndex ? '#172554' : '#0f172a'}
              stroke={index === currentIndex ? '#818cf8' : '#334155'}
            />
            <text x="88" y={y + 19} fill="#f8fafc" fontSize="14" fontWeight="600">
              {revealed ? label : 'Locked after prediction'}
            </text>
            <text x="88" y={y + 36} fill="#cbd5e1" fontSize="12">
              {revealed ? details : 'Advance the committed scenario to reveal this domain.'}
            </text>
          </g>
        )
      })}
      <text x="24" y="28" fill="#a5f3fc" fontSize="14" fontWeight="600">
        Nonquantitative longitudinal surveillance sequence
      </text>
    </>
  )
}
