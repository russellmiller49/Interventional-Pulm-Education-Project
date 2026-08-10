'use client'

import { useId, useMemo, useState } from 'react'

import {
  cardiacOutputComparisonScenarios,
  type CardiacOutputComparisonScenario,
} from '../content/cardiacOutputComparisons'
import { requireCardiacOutputMethod } from '../content/cardiacOutputMethods'
import { cardiacOutputOpenMethodQuestions } from '../content/cardiacOutputSourceBoundaries'
import {
  fickCardiacOutput,
  generateThermodilutionCurve,
  thermodilutionCurveTextEquivalent,
  thermodilutionExclusionReasonsFor,
  thermodilutionQualityLabels,
  type ThermodilutionTrial,
} from '../engine'
import { ThermodilutionCurveFigure } from './ThermodilutionTrialReview'
import styles from './icu-hemodynamics.module.css'

/**
 * The disagreement lab.
 *
 * A scenario is not decided by which number looks more plausible. It is decided by reading both
 * acquisitions — the thermodilution curves and their quality, and the Fick inputs with their
 * provenance — and then saying which result, if either, can be defended. One of the four ends with
 * neither being defensible, and every one of them offers averaging as a position the learner has to
 * decline rather than never meet.
 *
 * The thermodilution side is materialized through the same generator the live lab uses, so an
 * authored episode and a learner's own series are judged by the same quality rules rather than by a
 * narrative written next to a picture.
 */

const CONFIGURATION = {
  injectateVolumeMl: 10,
  injectateTemperatureC: 5,
  maximumTrials: 6,
  minimumAcceptedTrials: 3,
} as const

function buildTrials(scenario: CardiacOutputComparisonScenario): readonly ThermodilutionTrial[] {
  return scenario.thermodilution.trialSpecs.map((spec) =>
    generateThermodilutionCurve({
      trueCardiacOutputLMin: scenario.thermodilution.trueCardiacOutputLMin,
      technique: spec.technique,
      configuration: CONFIGURATION,
      modifiers: {
        ...scenario.thermodilution.modifiers,
        catheterPosition: scenario.thermodilution.positionConfirmed ? 'pa' : 'rv',
      },
      seed: scenario.thermodilution.seed,
      sequence: spec.sequence,
    }),
  )
}

function ScenarioCard({
  scenario,
  onResolved,
}: {
  readonly scenario: CardiacOutputComparisonScenario
  readonly onResolved: () => void
}) {
  const headingId = useId()
  const groupName = useId()
  const [choiceId, setChoiceId] = useState<string | null>(null)
  const [committed, setCommitted] = useState(false)

  const trials = useMemo(() => buildTrials(scenario), [scenario])
  const fick = useMemo(() => fickCardiacOutput(scenario.fick), [scenario])
  const fickMethod = requireCardiacOutputMethod(scenario.fick.methodId)
  const thermodilutionMethod = requireCardiacOutputMethod('thermodilution')
  const chosen = scenario.options.find((option) => option.id === choiceId)
  const openQuestions = cardiacOutputOpenMethodQuestions.filter((question) =>
    scenario.openQuestionIds.includes(question.id),
  )

  return (
    <article className={styles.disagreementCard} aria-labelledby={headingId}>
      <h3 id={headingId}>{scenario.title}</h3>
      <p>{scenario.presentation}</p>

      <div className={styles.scenarioSideBySide}>
        <section aria-label={`Thermodilution acquisition — ${scenario.title}`}>
          <h4 className={styles.thermoTrialQuality}>
            <span>{thermodilutionMethod.name}</span>
          </h4>
          <p>{scenario.thermodilution.acquisitionNarrative}</p>
          {trials.map((trial, index) => {
            const spec = scenario.thermodilution.trialSpecs[index]
            const reasons = thermodilutionExclusionReasonsFor(trial)
            return (
              <div key={trial.id} className={styles.thermoTrialCard}>
                <header>
                  <h5>Trial {trial.sequence}</h5>
                  <p data-trial-state="undecided">{thermodilutionQualityLabels[trial.quality]}</p>
                </header>
                <p>{spec.acquisitionNote}</p>
                <ThermodilutionCurveFigure trial={trial} />
                <p className="sr-only">{thermodilutionCurveTextEquivalent(trial)}</p>
                <p className={styles.thermoTrialResult}>
                  <span>Trial value</span>
                  <strong>{trial.estimatedCardiacOutputLMin.toFixed(1)} L/min</strong>
                  <small>by bolus thermodilution</small>
                </p>
                {reasons.length > 0 ? (
                  <ul className={styles.curveAlerts}>
                    {reasons.map((reason) => (
                      <li key={reason.id}>
                        {reason.label}. {reason.whatItMeans}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.thermoNoReasonNote}>
                    This curve shows no technical reason for exclusion.
                  </p>
                )}
              </div>
            )
          })}
        </section>

        <section aria-label={`Fick acquisition — ${scenario.title}`}>
          <h4 className={styles.thermoTrialQuality}>
            <span>{fickMethod.name}</span>
          </h4>
          <p>{scenario.fickAcquisitionNarrative}</p>
          <dl className={styles.methodProvenanceTable}>
            {fick.trace.map((row) => (
              <div key={row.id}>
                <dt>{row.label}</dt>
                <dd>
                  <span className={styles.provenanceChip} data-status={row.status}>
                    {row.statusLabel}
                  </span>
                </dd>
                <dd>{row.display}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.fickOutcome} data-status={fick.status}>
            <span>{fick.status === 'calculated' ? 'Method result' : 'Not interpretable'}</span>
            <strong>
              {fick.status === 'calculated'
                ? `${fick.cardiacOutputLMin?.toFixed(2)} L/min`
                : 'Result withheld'}
            </strong>
            <small>
              {fick.status === 'calculated'
                ? `by ${fick.methodName.toLowerCase()}`
                : fick.withheldReasons.join(' ')}
            </small>
          </p>
          {fick.caveats.length > 0 ? (
            <ul className={styles.measurementTeachingAudit}>
              {fick.caveats.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <p className={styles.measurementTeachingCallout}>
        <strong>Direction of bias.</strong>{' '}
        {scenario.biasDirection ??
          'This module names no direction of bias here. The reason is below, and it is a gap in the reviewed sources rather than a detail left out.'}
      </p>
      {openQuestions.map((question) => (
        <p key={question.id} className={styles.openQuestionCard}>
          <strong>{question.question}</strong> {question.whyItIsOpen} {question.whatThisModuleDoes}
        </p>
      ))}

      <fieldset className={styles.methodCommitment}>
        <legend>Which position can be defended for this measurement episode?</legend>
        {scenario.options.map((option) => (
          <label key={option.id}>
            <input
              type="radio"
              name={groupName}
              checked={choiceId === option.id}
              disabled={committed}
              onChange={() => setChoiceId(option.id)}
            />
            {option.label}
          </label>
        ))}
        <button
          type="button"
          disabled={choiceId === null || committed}
          onClick={() => {
            setCommitted(true)
            if (chosen?.verdict === 'defensible') onResolved()
          }}
        >
          Commit this position
        </button>
        {committed && chosen ? (
          <p className={styles.methodVerdict} data-verdict={chosen.verdict} role="status">
            <strong>
              {chosen.verdict === 'defensible'
                ? 'Defensible for this episode. '
                : chosen.verdict === 'averages-unlike-methods'
                  ? 'This averages two unlike methods. '
                  : 'Not defensible here. '}
            </strong>
            {chosen.why}
          </p>
        ) : null}
      </fieldset>

      {committed ? (
        <>
          <p className={styles.measurementTeachingCallout}>
            <strong>Why not simply average them.</strong> {scenario.whyNotAverage}
          </p>
          <h4 className={styles.thermoTrialQuality}>
            <span>What to repeat or correct</span>
          </h4>
          <ul className={styles.measurementTeachingAudit}>
            {scenario.whatToRepeatOrCorrect.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className={styles.measurementTeachingCallout}>
            <strong>What goes in the record.</strong> {scenario.reportedResult}
          </p>
        </>
      ) : null}
    </article>
  )
}

export function CardiacOutputDisagreementLab({
  onDisagreementResolved,
}: {
  readonly onDisagreementResolved?: () => void
}) {
  const headingId = useId()
  return (
    <section className={styles.disagreementLab} aria-labelledby={headingId}>
      <h2 id={headingId}>When the two methods disagree</h2>
      <p>
        Four measurement episodes, each with both acquisitions laid out in full. Name the method,
        read where each value came from, judge the thermodilution curves and the Fick sampling, and
        then say which result can be defended — which may be neither. Nothing here ranks the two
        methods in general; each episode is decided on its own acquisition evidence.
      </p>
      {cardiacOutputComparisonScenarios.map((scenario) => (
        <ScenarioCard
          key={scenario.id}
          scenario={scenario}
          onResolved={() => onDisagreementResolved?.()}
        />
      ))}
    </section>
  )
}
