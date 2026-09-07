'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import {
  cardiacOutputInputStatusLabels,
  cardiacOutputMethodById,
  derivedMethodDisagreementDecision,
  derivedSelectiveDecision,
  derivedThresholdContextDecision,
  derivedTransferComparisonDecision,
  derivedWorkbenchEpisodes,
  requireDerivedInputDefinition,
  requireDerivedMeasurementEpisode,
  requireDerivedMetric,
  type CardiacOutputInputStatus,
  type DerivedDecisionOption,
  type DerivedMeasurementEpisode,
  type DerivedMetricId,
} from '../content'
import {
  DERIVED_SECTION_CHECKS,
  derivedResultStatusLabels,
  evaluateDerivedEpisode,
  evaluateDerivedMetric,
  type DerivedMetricEvaluation,
  type HemodynamicAction,
} from '../engine'
import styles from './icu-hemodynamics.module.css'

/**
 * The hands-on surfaces of the derived-hemodynamics station.
 *
 * Three components share this file because they share one discipline: a commitment happens before
 * the reasoning is revealed, committing never advances the phase, and every verdict a learner reads
 * is graded against the same evaluator the results themselves come from — the surface holds no
 * second copy of any rule.
 *
 * The four hands-on requirements are recorded as ordinary VALIDATE_SIGNAL checks
 * (`DERIVED_SECTION_CHECKS`), so the station's objective stays a function of simulation state and
 * survives phase navigation, exactly as the other stations' objectives do.
 */

/* ------------------------------------------------------------------ *
 * Recognize — separate measured from calculated
 * ------------------------------------------------------------------ */

interface ProvenanceDrillRow {
  readonly id: string
  readonly label: string
  readonly correct: CardiacOutputInputStatus
  readonly why: string
}

/**
 * Six quantities a learner meets on one flowsheet, each carrying exactly one provenance. The two
 * that matter most — a pressure an instrument produced and a resistance no instrument can produce —
 * anchor the measured-versus-calculated distinction the rest of the station depends on.
 */
const PROVENANCE_DRILL_ROWS: readonly ProvenanceDrillRow[] = [
  {
    id: 'mean-pap',
    label: 'Mean PA pressure on the monitor',
    correct: 'measured',
    why: 'The transducer produced it from the patient during this acquisition.',
  },
  {
    id: 'svr-flowsheet',
    label: 'SVR on the flowsheet',
    correct: 'calculated',
    why: 'No instrument reads resistance. An equation produced it from MAP, RAP, and a cardiac output — it was not observed.',
  },
  {
    id: 'bsa-header',
    label: 'Body surface area in the chart header',
    correct: 'calculated',
    why: 'The charting system computed it from an entered height and weight. It inherits both.',
  },
  {
    id: 'assumed-vo2',
    label: 'The oxygen uptake inside a Fick result with no expired-gas collection',
    correct: 'assumed',
    why: 'No one measured it on this patient; a substituted figure stands in for it, and the flow moves in proportion.',
  },
  {
    id: 'injectate-volume',
    label: 'Injectate volume typed into the cardiac-output computer',
    correct: 'entered',
    why: 'A person selected it. The calculation cannot tell whether the delivered volume matched it.',
  },
  {
    id: 'svo2-slip',
    label: 'Mixed-venous saturation on a blood-gas slip',
    correct: 'sampled',
    why: 'A specimen was drawn from a named site at a named time, and both are part of whether it is usable.',
  },
]

const PROVENANCE_CHOICES: readonly CardiacOutputInputStatus[] = [
  'measured',
  'sampled',
  'entered',
  'assumed',
  'calculated',
]

export function DerivedProvenanceDrill({
  separated,
  onSeparated,
}: {
  readonly separated: boolean
  readonly onSeparated: () => void
}) {
  const headingId = useId()
  const [answers, setAnswers] = useState<Record<string, CardiacOutputInputStatus | ''>>({})
  const [committed, setCommitted] = useState(false)

  const allAnswered = PROVENANCE_DRILL_ROWS.every((row) => answers[row.id])
  const allCorrect = PROVENANCE_DRILL_ROWS.every((row) => answers[row.id] === row.correct)

  return (
    <section className={styles.measurementTeachingPanel} aria-labelledby={headingId}>
      <header>
        <span>Recognize</span>
        <h2 id={headingId}>Which of these is actually a measurement?</h2>
        <p>
          Six quantities from one flowsheet, printed in the same typeface. Say how each one reached
          the record. Committing reveals the reasoning; it does not advance the station.
        </p>
      </header>
      <div className={styles.measurementTeachingCard}>
        {PROVENANCE_DRILL_ROWS.map((row) => {
          const answer = answers[row.id] ?? ''
          const wasCorrect = committed && answer === row.correct
          const wasWrong = committed && answer !== '' && answer !== row.correct
          return (
            <div key={row.id} className={styles.derivedDrillRow}>
              <label htmlFor={`provenance-${row.id}`}>{row.label}</label>
              <select
                id={`provenance-${row.id}`}
                value={answer}
                onChange={(event) => {
                  setCommitted(false)
                  setAnswers((current) => ({
                    ...current,
                    [row.id]: event.target.value as CardiacOutputInputStatus,
                  }))
                }}
              >
                <option value="" disabled>
                  How did it reach the record?
                </option>
                {PROVENANCE_CHOICES.map((choice) => (
                  <option key={choice} value={choice}>
                    {cardiacOutputInputStatusLabels[choice].label}
                  </option>
                ))}
              </select>
              {committed ? (
                <p
                  className={styles.methodVerdict}
                  data-verdict={wasCorrect ? 'defensible' : 'not-defensible'}
                >
                  <strong>
                    {wasCorrect
                      ? 'That is how it reached the record. '
                      : `This value is ${cardiacOutputInputStatusLabels[row.correct].label.toLowerCase()}. `}
                  </strong>
                  {row.why}
                  {wasWrong
                    ? ' Change the answer and commit again; the distinction is the point of this drill.'
                    : ''}
                </p>
              ) : null}
            </div>
          )
        })}
        <button
          type="button"
          className={styles.derivedCommitButton}
          disabled={!allAnswered || committed}
          onClick={() => {
            setCommitted(true)
            if (allCorrect) onSeparated()
          }}
        >
          Commit these classifications
        </button>
        {separated ? (
          <p className={styles.methodVerdict} role="status">
            Measured and calculated are separated on this station. The workbench episodes now hold
            you to that distinction.
          </p>
        ) : null}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Shared result rendering
 * ------------------------------------------------------------------ */

function formatValue(evaluation: DerivedMetricEvaluation): string {
  if (evaluation.value === null) return 'Result withheld'
  return `${evaluation.value}${evaluation.unit ? ` ${evaluation.unit}` : ''}`
}

function MetricResultCard({ evaluation }: { readonly evaluation: DerivedMetricEvaluation }) {
  return (
    <article className={styles.derivedResultCard} data-status={evaluation.status}>
      <header>
        <h5>
          {evaluation.shortLabel} · {evaluation.metricName}
        </h5>
        <p className={styles.derivedStatusWord} data-status={evaluation.status}>
          {derivedResultStatusLabels[evaluation.status]}
        </p>
      </header>
      <p
        className={styles.fickOutcome}
        data-status={evaluation.status === 'withheld' ? 'withheld' : 'calculated'}
      >
        <span>{evaluation.status === 'withheld' ? 'No number is shown' : 'Calculated result'}</span>
        <strong>{formatValue(evaluation)}</strong>
        {evaluation.flowMethodLabel ? (
          <small>
            {evaluation.status === 'withheld'
              ? evaluation.flowMethodLabel
              : `calculated using ${evaluation.flowMethodLabel.toLowerCase()}`}
          </small>
        ) : (
          <small>no cardiac output required</small>
        )}
      </p>
      <ul className={styles.fickUnitAccount}>
        {evaluation.formulaAccount.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {evaluation.mathematicalValidityReasons.length > 0 ? (
        <div className={styles.derivedReasonBlock}>
          <h6>Not mathematically calculable</h6>
          <ul>
            {evaluation.mathematicalValidityReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {evaluation.clinicalValidityReasons.length > 0 ? (
        <div className={styles.derivedReasonBlock}>
          <h6>Not clinically interpretable</h6>
          <ul>
            {evaluation.clinicalValidityReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {evaluation.cautions.length > 0 ? (
        <div className={styles.derivedReasonBlock} data-kind="caution">
          <h6>Cautions</h6>
          <ul>
            {evaluation.cautions.map((caution) => (
              <li key={caution}>{caution}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {evaluation.sensitivity ? (
        <div className={styles.amplificationGrid}>
          <article>
            <span>As displayed</span>
            <strong>{evaluation.sensitivity.baseline}</strong>
          </article>
          <article>
            <span>
              With ±{evaluation.sensitivity.perturbation} in{' '}
              {evaluation.sensitivity.inputLabel.toLowerCase()}
            </span>
            <strong>
              {evaluation.sensitivity.perturbedLow} to {evaluation.sensitivity.perturbedHigh}
            </strong>
          </article>
        </div>
      ) : null}
      {evaluation.thresholdContexts.map((context) => (
        <p key={context.contextId} className={styles.openQuestionCard}>
          <strong>{context.classificationLabel}.</strong> {context.statement} Applies to:{' '}
          {context.population} {context.notUniversal}
        </p>
      ))}
      <details>
        <summary>Dependency ledger</summary>
        <dl className={styles.methodProvenanceTable}>
          {evaluation.ledger.map((row) => (
            <div key={row.inputId}>
              <dt>{row.label}</dt>
              <dd>
                <span className={styles.provenanceChip} data-status={row.provenance}>
                  {row.provenanceLabel}
                </span>
              </dd>
              <dd>
                {row.display} {row.note} Episode: {row.measurementEpisodeId}.
              </dd>
            </div>
          ))}
        </dl>
      </details>
      <p className="sr-only">{evaluation.textEquivalent}</p>
    </article>
  )
}

/**
 * A committed position, its reasoning, and — when the position was not defensible — a way back.
 *
 * Locking every commitment permanently was the wrong trade. Two of these decisions carry completion
 * evidence that is only awarded for the defensible option, so a learner who committed a wrong answer
 * was left holding it with no route to the right one short of resetting the activity. The station is
 * about revising a reading when the evidence does not support it; refusing the learner that same
 * revision taught the opposite lesson.
 *
 * A wrong answer is therefore recoverable, but never silently: the first attempt and its feedback
 * stay on screen until the learner explicitly asks to reconsider. A defensible answer stays locked,
 * because there is nothing to recover from.
 */
function DecisionFieldset({
  prompt,
  options,
  committedOptionId,
  onCommit,
  onReconsider,
  disabled,
}: {
  readonly prompt: string
  readonly options: readonly DerivedDecisionOption[]
  readonly committedOptionId: string | null
  readonly onCommit: (option: DerivedDecisionOption) => void
  /** Clears whatever the parent recorded, so the fieldset can be answered again. */
  readonly onReconsider?: () => void
  readonly disabled?: boolean
}) {
  const groupName = useId()
  const [choiceId, setChoiceId] = useState<string | null>(null)
  const committed = committedOptionId !== null
  const chosen = options.find((option) => option.id === (committedOptionId ?? choiceId))
  const recoverable = committed && chosen !== undefined && chosen.verdict !== 'defensible'

  // Focus follows the learner back to the choices; it is the point they were returned to.
  const firstOptionRef = useRef<HTMLInputElement | null>(null)
  const returningToChoices = useRef(false)
  useEffect(() => {
    if (returningToChoices.current && !committed) {
      returningToChoices.current = false
      firstOptionRef.current?.focus()
    }
  }, [committed])

  const reconsider = useCallback(() => {
    returningToChoices.current = true
    setChoiceId(null)
    onReconsider?.()
  }, [onReconsider])

  return (
    <fieldset className={styles.methodCommitment}>
      <legend>{prompt}</legend>
      {options.map((option, index) => (
        <label key={option.id}>
          <input
            ref={index === 0 ? firstOptionRef : undefined}
            type="radio"
            name={groupName}
            checked={(committedOptionId ?? choiceId) === option.id}
            disabled={committed || disabled}
            onChange={() => setChoiceId(option.id)}
          />
          {option.label}
        </label>
      ))}
      <button
        type="button"
        disabled={choiceId === null || committed || disabled}
        onClick={() => {
          const option = options.find((candidate) => candidate.id === choiceId)
          if (option) onCommit(option)
        }}
      >
        Commit this position
      </button>
      {committed && chosen ? (
        <p className={styles.methodVerdict} data-verdict={chosen.verdict} role="status">
          <strong>
            {chosen.verdict === 'defensible'
              ? 'Defensible for this episode. '
              : chosen.verdict === 'averages-methods'
                ? 'This averages or blends unlike quantities. '
                : 'Not defensible here. '}
          </strong>
          {chosen.why}
          {chosen.verdict !== 'defensible'
            ? ` ${options.find((option) => option.verdict === 'defensible')?.why ?? ''}`
            : ''}
        </p>
      ) : null}
      {recoverable && onReconsider ? (
        <button type="button" onClick={reconsider}>
          Reconsider and commit again
        </button>
      ) : null}
    </fieldset>
  )
}

/* ------------------------------------------------------------------ *
 * The episode workbench — Predict, Act, and Observe share it
 * ------------------------------------------------------------------ */

interface DerivedEpisodeWorkbenchProps {
  readonly dispatch: (action: HemodynamicAction) => void
  readonly checks: readonly string[]
  readonly disagreementPreserved: boolean
  readonly onDisagreementPreserved: () => void
  readonly thresholdContextResolved: boolean
  readonly onThresholdContextResolved: () => void
}

function EpisodeInputLedger({ episode }: { readonly episode: DerivedMeasurementEpisode }) {
  const tags = new Set(episode.inputs.map((input) => input.measurementEpisodeId))
  return (
    <details className={styles.derivedEpisodeLedger} open>
      <summary>Recorded inputs and their provenance</summary>
      <dl className={styles.methodProvenanceTable}>
        {episode.inputs.map((episodeInput) => {
          const definition = requireDerivedInputDefinition(episodeInput.inputId)
          return (
            <div key={episodeInput.inputId}>
              <dt>
                {definition.label}
                {episodeInput.value === null
                  ? ' — missing'
                  : ` = ${episodeInput.value} ${definition.unit}`}
              </dt>
              <dd>
                <span className={styles.provenanceChip} data-status={episodeInput.provenance}>
                  {cardiacOutputInputStatusLabels[episodeInput.provenance].label}
                </span>
              </dd>
              <dd>
                {episodeInput.valid ? '' : 'Invalid. '}
                {episodeInput.note}
                {tags.size > 1 ? ` Recorded in: ${episodeInput.measurementEpisodeId}.` : ''}
              </dd>
            </div>
          )
        })}
      </dl>
      <p className={styles.measurementTeachingCallout}>
        <strong>Body size.</strong> {episode.bodySizeNote}
      </p>
      <p className={styles.measurementTeachingCallout}>
        <strong>State across the episode.</strong> {episode.stateNote}
      </p>
    </details>
  )
}

function EpisodeFlowAccounts({ episode }: { readonly episode: DerivedMeasurementEpisode }) {
  return (
    <div className={styles.derivedFlowAccounts}>
      {episode.flowResults.map((flow) => {
        const method =
          flow.methodId === 'method-unknown' ? null : cardiacOutputMethodById.get(flow.methodId)
        return (
          <p
            key={flow.id}
            className={styles.fickOutcome}
            data-status={flow.status === 'withheld' ? 'withheld' : 'calculated'}
          >
            <span>{method ? method.name : 'Cardiac-output method not established'}</span>
            <strong>
              {flow.status === 'accepted' && flow.valueLMin !== null
                ? `${flow.valueLMin} L/min`
                : 'Withheld'}
            </strong>
            <small>{flow.acquisitionNote}</small>
          </p>
        )
      })}
    </div>
  )
}

/** The dependency-chain challenge on the coherent episode: name every input PVR requires. */
function DependencyChainChallenge({
  earned,
  onEarned,
}: {
  readonly earned: boolean
  readonly onEarned: () => void
}) {
  const metric = requireDerivedMetric('pulmonaryVascularResistance')
  const requiredIds = useMemo(
    () => new Set(metric.dependencies.map((dependency) => dependency.inputId)),
    [metric],
  )
  const candidateIds = [
    'meanPapMmHg',
    'pawpMeanMmHg',
    'cardiacOutputLMin',
    'mapMmHg',
    'rapMmHg',
    'papSystolicMmHg',
    'papDiastolicMmHg',
    'bodySurfaceAreaM2',
    'heartRateBpm',
  ]
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [committed, setCommitted] = useState(false)
  const correct =
    selected.size === requiredIds.size && [...requiredIds].every((id) => selected.has(id))

  return (
    <fieldset className={styles.methodCommitment}>
      <legend>
        Validate one dependency chain: which recorded inputs does {metric.shortLabel} ={' '}
        {metric.formulaText} actually require?
      </legend>
      {candidateIds.map((inputId) => {
        const definition = requireDerivedInputDefinition(inputId)
        return (
          <label key={inputId}>
            <input
              type="checkbox"
              checked={selected.has(inputId)}
              disabled={earned}
              onChange={(event) => {
                setCommitted(false)
                setSelected((current) => {
                  const next = new Set(current)
                  if (event.target.checked) next.add(inputId)
                  else next.delete(inputId)
                  return next
                })
              }}
            />
            {definition.label}
          </label>
        )
      })}
      <button
        type="button"
        disabled={selected.size === 0 || earned || committed}
        onClick={() => {
          setCommitted(true)
          if (correct) onEarned()
        }}
      >
        Commit the dependency chain
      </button>
      {committed || earned ? (
        <p
          className={styles.methodVerdict}
          data-verdict={correct || earned ? 'defensible' : 'not-defensible'}
          role="status"
        >
          <strong>{correct || earned ? 'Chain validated. ' : 'Not the chain. '}</strong>
          {metric.shortLabel} consumes the mean PA pressure and the mean PAWP as its gradient and a
          cardiac output as its denominator — nothing else, and nothing less. MAP, RAP, and the PA
          systolic and diastolic pressures belong to other equations, and body size only enters the
          indexed form.
          {!correct && !earned ? ' Adjust the selection and commit again.' : ''}
        </p>
      ) : null}
    </fieldset>
  )
}

/** The flow-method commitment: trace the calculated set back to its acquisition. */
function FlowMethodChallenge({
  episode,
  earned,
  onEarned,
}: {
  readonly episode: DerivedMeasurementEpisode
  readonly earned: boolean
  readonly onEarned: () => void
}) {
  const groupName = useId()
  const accepted = episode.flowResults.find((flow) => flow.status === 'accepted')
  const correctId = accepted?.methodId ?? 'method-unknown'
  const [choiceId, setChoiceId] = useState<string | null>(null)
  const [committed, setCommitted] = useState(false)
  const options = [
    { id: 'thermodilution', label: cardiacOutputMethodById.get('thermodilution')?.name ?? '' },
    { id: 'fick-direct', label: cardiacOutputMethodById.get('fick-direct')?.name ?? '' },
    { id: 'fick-assumed-vo2', label: cardiacOutputMethodById.get('fick-assumed-vo2')?.name ?? '' },
    { id: 'method-unknown', label: 'No method is established for this flow' },
  ]
  const correct = choiceId === correctId

  return (
    <fieldset className={styles.methodCommitment}>
      <legend>
        Trace the flow: which acquisition produced the cardiac output inside this episode’s derived
        values?
      </legend>
      {options.map((option) => (
        <label key={option.id}>
          <input
            type="radio"
            name={groupName}
            checked={choiceId === option.id}
            disabled={earned || committed}
            onChange={() => setChoiceId(option.id)}
          />
          {option.label}
        </label>
      ))}
      <button
        type="button"
        disabled={choiceId === null || earned || committed}
        onClick={() => {
          setCommitted(true)
          if (correct) onEarned()
        }}
      >
        Commit the method
      </button>
      {committed || earned ? (
        <p
          className={styles.methodVerdict}
          data-verdict={correct || earned ? 'defensible' : 'not-defensible'}
          role="status"
        >
          <strong>{correct || earned ? 'Traced. ' : 'Not this one. '}</strong>
          {accepted
            ? `${episode.title} carries its flow from ${
                cardiacOutputMethodById.get(
                  accepted.methodId as Exclude<typeof accepted.methodId, 'method-unknown'>,
                )?.name ?? 'an unestablished method'
              }: ${accepted.acquisitionNote}`
            : 'No accepted flow exists in this episode.'}{' '}
          Every flow-dependent value on this station names this method beside its number.
          {!correct && !earned && !committed ? '' : ''}
        </p>
      ) : null}
      {committed && !correct && !earned ? (
        <button type="button" onClick={() => setCommitted(false)}>
          Reconsider and commit again
        </button>
      ) : null}
    </fieldset>
  )
}

/** The selective-invalidation decision on the invalid-wedge episode. */
function SelectiveInvalidationChallenge({
  episode,
  withheldEarned,
  preservedEarned,
  onWithheldEarned,
  onPreservedEarned,
  onCommitted,
}: {
  readonly episode: DerivedMeasurementEpisode
  readonly withheldEarned: boolean
  readonly preservedEarned: boolean
  readonly onWithheldEarned: () => void
  readonly onPreservedEarned: () => void
  readonly onCommitted: () => void
}) {
  const flow = episode.flowResults.find((candidate) => candidate.status === 'accepted') ?? null
  const [decisions, setDecisions] = useState<Record<string, 'calculate' | 'withhold' | ''>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [committed, setCommitted] = useState(false)
  const alreadyEarned = withheldEarned && preservedEarned

  const evaluations = useMemo(
    () =>
      new Map(
        derivedSelectiveDecision.metricIds.map((metricId) => [
          metricId,
          evaluateDerivedMetric(metricId, episode, flow),
        ]),
      ),
    [episode, flow],
  )

  const allDecided = derivedSelectiveDecision.metricIds.every((metricId) => {
    const decision = decisions[metricId]
    if (!decision) return false
    if (decision === 'withhold') return Boolean(reasons[metricId])
    return true
  })

  function verdictFor(metricId: DerivedMetricId): { correct: boolean; explanation: string } {
    const evaluation = evaluations.get(metricId)!
    const decision = decisions[metricId]
    const shouldWithhold = evaluation.status === 'withheld'
    if (shouldWithhold) {
      const reasonCorrect = reasons[metricId] === derivedSelectiveDecision.correctWithholdReasonId
      return {
        correct: decision === 'withhold' && reasonCorrect,
        explanation:
          decision !== 'withhold'
            ? `${evaluation.shortLabel} must be withheld: ${evaluation.clinicalValidityReasons.join(' ')}`
            : reasonCorrect
              ? `${evaluation.shortLabel} is withheld for exactly this reason.`
              : `${evaluation.shortLabel} is withheld, but for the invalid wedge — not the reason selected: ${evaluation.clinicalValidityReasons.join(' ')}`,
      }
    }
    return {
      correct: decision === 'calculate',
      explanation:
        decision === 'calculate'
          ? `${evaluation.shortLabel} survives: its own inputs are valid, so the invalid wedge does not touch it.`
          : `${evaluation.shortLabel} should remain available — none of its inputs is the invalid wedge. Withholding it would be a global "hemodynamics invalid" switch, which this station refuses.`,
    }
  }

  return (
    <fieldset className={styles.methodCommitment}>
      <legend>{derivedSelectiveDecision.prompt}</legend>
      {derivedSelectiveDecision.metricIds.map((metricId) => {
        const metric = requireDerivedMetric(metricId)
        const decision = decisions[metricId] ?? ''
        return (
          <div key={metricId} className={styles.derivedDrillRow}>
            <label htmlFor={`selective-${metricId}`}>
              {metric.shortLabel} = {metric.formulaText}
            </label>
            <select
              id={`selective-${metricId}`}
              value={decision}
              disabled={alreadyEarned || committed}
              onChange={(event) => {
                setDecisions((current) => ({
                  ...current,
                  [metricId]: event.target.value as 'calculate' | 'withhold',
                }))
              }}
            >
              <option value="" disabled>
                Decide
              </option>
              <option value="calculate">Calculate it</option>
              <option value="withhold">Withhold it</option>
            </select>
            {decision === 'withhold' ? (
              <select
                aria-label={`Withholding reason for ${metric.shortLabel}`}
                value={reasons[metricId] ?? ''}
                disabled={alreadyEarned || committed}
                onChange={(event) =>
                  setReasons((current) => ({ ...current, [metricId]: event.target.value }))
                }
              >
                <option value="" disabled>
                  For which reason?
                </option>
                {derivedSelectiveDecision.withholdReasonOptions.map((reason) => (
                  <option key={reason.id} value={reason.id}>
                    {reason.label}
                  </option>
                ))}
              </select>
            ) : null}
            {committed ? (
              <p
                className={styles.methodVerdict}
                data-verdict={verdictFor(metricId).correct ? 'defensible' : 'not-defensible'}
              >
                {verdictFor(metricId).explanation}
              </p>
            ) : null}
          </div>
        )
      })}
      <button
        type="button"
        disabled={!allDecided || committed || alreadyEarned}
        onClick={() => {
          setCommitted(true)
          onCommitted()
          const withheldCorrect = derivedSelectiveDecision.metricIds
            .filter((metricId) => evaluations.get(metricId)!.status === 'withheld')
            .every((metricId) => verdictFor(metricId).correct)
          const preservedCorrect = derivedSelectiveDecision.metricIds
            .filter((metricId) => evaluations.get(metricId)!.status !== 'withheld')
            .every((metricId) => verdictFor(metricId).correct)
          if (withheldCorrect) onWithheldEarned()
          if (preservedCorrect) onPreservedEarned()
        }}
      >
        Commit these decisions
      </button>
      {committed && !alreadyEarned ? (
        <button type="button" onClick={() => setCommitted(false)}>
          Revise the decisions and commit again
        </button>
      ) : null}
      {alreadyEarned ? (
        <p className={styles.methodVerdict} role="status">
          Withholding and preservation are both on record for this episode: the invalid wedge takes
          down only what depends on it.
        </p>
      ) : null}
    </fieldset>
  )
}

export function DerivedEpisodeWorkbench({
  dispatch,
  checks,
  disagreementPreserved,
  onDisagreementPreserved,
  thresholdContextResolved,
  onThresholdContextResolved,
}: DerivedEpisodeWorkbenchProps) {
  const headingId = useId()
  const [episodeId, setEpisodeId] = useState<string>(derivedWorkbenchEpisodes[0]?.id ?? '')
  const episode = requireDerivedMeasurementEpisode(episodeId)
  const [revealCommitted, setRevealCommitted] = useState<Record<string, boolean>>({})
  const [disagreementChoice, setDisagreementChoice] = useState<string | null>(null)
  const [thresholdChoice, setThresholdChoice] = useState<string | null>(null)

  const checkSet = new Set(checks)
  const chainEarned = checkSet.has(DERIVED_SECTION_CHECKS.dependencyChain)
  const methodEarned = checkSet.has(DERIVED_SECTION_CHECKS.methodTraced)
  const withheldEarned = checkSet.has(DERIVED_SECTION_CHECKS.withheldForValidity)
  const preservedEarned = checkSet.has(DERIVED_SECTION_CHECKS.selectivePreserved)

  const resultSets = useMemo(() => evaluateDerivedEpisode(episode), [episode])

  /**
   * Commitment gates the reveal, not correctness: an episode with a graded interaction keeps its
   * evaluated results hidden until a position has been taken. Earned checks reopen the reveal after
   * a phase change, because the commitment they record has already happened.
   */
  const revealed = (() => {
    if (episode.id === 'ep-coherent-complete') {
      return (chainEarned && methodEarned) || Boolean(revealCommitted[episode.id])
    }
    if (episode.id === 'ep-invalid-pawp') {
      return (withheldEarned && preservedEarned) || Boolean(revealCommitted[episode.id])
    }
    if (episode.id === 'ep-method-disagreement') {
      return disagreementPreserved || disagreementChoice !== null
    }
    return true
  })()

  return (
    <section className={styles.disagreementLab} aria-labelledby={headingId}>
      <h2 id={headingId}>Measurement episodes</h2>
      <p>
        Eight authored episodes, each a validity exercise rather than a treatment case. Read the
        recorded inputs and the cardiac-output acquisition first; where an episode asks for a
        commitment, the evaluated results appear after you take a position.
      </p>
      <div className={styles.methodTabs} role="tablist" aria-label="Measurement episodes">
        {derivedWorkbenchEpisodes.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            role="tab"
            aria-selected={candidate.id === episodeId}
            onClick={() => setEpisodeId(candidate.id)}
          >
            {candidate.title}
          </button>
        ))}
      </div>

      <article className={styles.disagreementCard}>
        <h3>{episode.title}</h3>
        <p>{episode.presentation}</p>
        <EpisodeInputLedger episode={episode} />
        <EpisodeFlowAccounts episode={episode} />

        {episode.id === 'ep-coherent-complete' ? (
          <>
            <DependencyChainChallenge
              earned={chainEarned}
              onEarned={() =>
                dispatch({ type: 'VALIDATE_SIGNAL', check: DERIVED_SECTION_CHECKS.dependencyChain })
              }
            />
            <FlowMethodChallenge
              episode={episode}
              earned={methodEarned}
              onEarned={() =>
                dispatch({ type: 'VALIDATE_SIGNAL', check: DERIVED_SECTION_CHECKS.methodTraced })
              }
            />
            {!revealed ? (
              <button
                type="button"
                className={styles.derivedCommitButton}
                disabled={!(chainEarned && methodEarned)}
                onClick={() =>
                  setRevealCommitted((current) => ({ ...current, [episode.id]: true }))
                }
              >
                {chainEarned && methodEarned
                  ? 'Reveal the evaluated results'
                  : 'Validate the chain and trace the method to reveal the results'}
              </button>
            ) : null}
          </>
        ) : null}

        {episode.id === 'ep-invalid-pawp' ? (
          <SelectiveInvalidationChallenge
            episode={episode}
            withheldEarned={withheldEarned}
            preservedEarned={preservedEarned}
            onWithheldEarned={() =>
              dispatch({
                type: 'VALIDATE_SIGNAL',
                check: DERIVED_SECTION_CHECKS.withheldForValidity,
              })
            }
            onPreservedEarned={() =>
              dispatch({
                type: 'VALIDATE_SIGNAL',
                check: DERIVED_SECTION_CHECKS.selectivePreserved,
              })
            }
            onCommitted={() =>
              setRevealCommitted((current) => ({ ...current, [episode.id]: true }))
            }
          />
        ) : null}

        {episode.id === 'ep-method-disagreement' ? (
          <DecisionFieldset
            prompt={derivedMethodDisagreementDecision.prompt}
            options={derivedMethodDisagreementDecision.options}
            committedOptionId={
              disagreementPreserved
                ? derivedMethodDisagreementDecision.defensibleOptionId
                : disagreementChoice
            }
            onCommit={(option) => {
              setDisagreementChoice(option.id)
              if (option.verdict === 'defensible') onDisagreementPreserved()
            }}
            onReconsider={() => setDisagreementChoice(null)}
          />
        ) : null}

        {revealed ? (
          <>
            {resultSets.map((set) => (
              <section
                key={set.flow?.id ?? 'no-flow'}
                aria-label={`Results · ${set.flowMethodLabel}`}
              >
                <h4 className={styles.thermoTrialQuality}>
                  <span>Results · {set.flowMethodLabel}</span>
                </h4>
                <div className={styles.derivedResultGrid}>
                  {set.results.map((result) => (
                    <MetricResultCard key={result.metricId} evaluation={result} />
                  ))}
                </div>
              </section>
            ))}
            {episode.id === 'ep-coherent-complete' ? (
              <DecisionFieldset
                prompt={derivedThresholdContextDecision.prompt}
                options={derivedThresholdContextDecision.options}
                committedOptionId={
                  thresholdContextResolved
                    ? derivedThresholdContextDecision.defensibleOptionId
                    : thresholdChoice
                }
                onCommit={(option) => {
                  setThresholdChoice(option.id)
                  if (option.verdict === 'defensible') onThresholdContextResolved()
                }}
                onReconsider={() => setThresholdChoice(null)}
              />
            ) : null}
          </>
        ) : null}
      </article>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Transfer — two apparently complete episodes
 * ------------------------------------------------------------------ */

/** What the received flowsheet prints, before any validity reading. Computed from the same records. */
function naiveFlowsheet(
  episode: DerivedMeasurementEpisode,
): readonly { label: string; text: string }[] {
  const values: Record<string, number> = {}
  for (const episodeInput of episode.inputs) {
    if (episodeInput.value !== null) values[episodeInput.inputId] = episodeInput.value
  }
  const flow = episode.flowResults.find((candidate) => candidate.status === 'accepted')
  if (flow?.valueLMin) values.cardiacOutputLMin = flow.valueLMin
  if (values.cardiacOutputLMin && values.heartRateBpm) {
    values.strokeVolumeMl = (values.cardiacOutputLMin * 1000) / values.heartRateBpm
  }
  return (
    [
      'systemicVascularResistance',
      'cardiacIndexLMinM2',
      'pulmonaryVascularResistance',
      'cardiacPowerOutputW',
    ] as const
  ).map((metricId) => {
    const metric = requireDerivedMetric(metricId)
    const ready = metric.dependencies.every((dependency) => dependency.inputId in values)
    const value = ready ? metric.calculate(values) : null
    return {
      label: metric.shortLabel,
      text:
        value === null
          ? 'not printed'
          : `${Number(value.toFixed(metric.displayPrecision))}${metric.outputUnit ? ` ${metric.outputUnit}` : ''}`,
    }
  })
}

export function DerivedTransferComparison() {
  const headingId = useId()
  const plausible = requireDerivedMeasurementEpisode(
    derivedTransferComparisonDecision.plausibleEpisodeId,
  )
  const coherent = requireDerivedMeasurementEpisode(
    derivedTransferComparisonDecision.coherentEpisodeId,
  )
  const [committedOptionId, setCommittedOptionId] = useState<string | null>(null)
  // Latched: the comparison was earned by committing once, and reconsidering does not take it back.
  const [comparisonRevealed, setComparisonRevealed] = useState(false)

  const plausibleSets = useMemo(() => evaluateDerivedEpisode(plausible), [plausible])
  const coherentSets = useMemo(() => evaluateDerivedEpisode(coherent), [coherent])

  return (
    <section className={styles.disagreementLab} aria-labelledby={headingId}>
      <h2 id={headingId}>Two apparently complete episodes</h2>
      <p>
        Both flowsheets print tidy numbers. Read each episode’s acquisition evidence — not how
        ordinary its results look — and commit to the defensible position. The evaluated results
        appear after you commit.
      </p>
      <div className={styles.scenarioSideBySide}>
        {[plausible, coherent].map((episode) => (
          <section key={episode.id} aria-label={episode.title}>
            <h4 className={styles.thermoTrialQuality}>
              <span>{episode.title}</span>
            </h4>
            <p>{episode.presentation}</p>
            <p className={styles.measurementTeachingCallout}>
              <strong>As printed on the sheet, before any validity reading:</strong>{' '}
              {naiveFlowsheet(episode)
                .map((row) => `${row.label} ${row.text}`)
                .join(' · ')}
            </p>
            <EpisodeInputLedger episode={episode} />
            <EpisodeFlowAccounts episode={episode} />
          </section>
        ))}
      </div>

      <DecisionFieldset
        prompt={derivedTransferComparisonDecision.prompt}
        options={derivedTransferComparisonDecision.options}
        committedOptionId={committedOptionId}
        onCommit={(option) => {
          setCommittedOptionId(option.id)
          setComparisonRevealed(true)
        }}
        onReconsider={() => setCommittedOptionId(null)}
      />

      {comparisonRevealed ? (
        <div className={styles.scenarioSideBySide}>
          {[
            { episode: plausible, sets: plausibleSets },
            { episode: coherent, sets: coherentSets },
          ].map(({ episode, sets }) => (
            <section key={episode.id} aria-label={`Evaluated · ${episode.title}`}>
              <h4 className={styles.thermoTrialQuality}>
                <span>Evaluated · {episode.title}</span>
              </h4>
              {sets.map((set) => (
                <div key={set.flow?.id ?? 'no-flow'} className={styles.derivedResultGrid}>
                  {set.results
                    .filter((result) =>
                      [
                        'systemicVascularResistance',
                        'cardiacIndexLMinM2',
                        'pulmonaryVascularResistance',
                        'cardiacPowerOutputW',
                        'pulmonaryArteryPulsatilityIndex',
                      ].includes(result.metricId),
                    )
                    .map((result) => (
                      <MetricResultCard key={result.metricId} evaluation={result} />
                    ))}
                </div>
              ))}
            </section>
          ))}
        </div>
      ) : null}
    </section>
  )
}
