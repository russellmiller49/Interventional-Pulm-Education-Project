'use client'

import {
  requireDerivedInputDefinition,
  requireDerivedMetric,
  type DerivedDependencyRole,
  type DerivedMetricId,
} from '../content/derivedMetrics'
import { requireDerivedMeasurementEpisode } from '../content/derivedMeasurementEpisodes'
import { HEMODYNAMICS_QUESTION_SORT } from '../content/questionSort'
import { derivedResultStatusLabels, evaluateDerivedMetric } from '../engine/derivedEvaluation'
import styles from './icu-hemodynamics.module.css'

const ROLE_WORDS: Readonly<Record<DerivedDependencyRole, string>> = {
  numerator: 'numerator',
  denominator: 'denominator',
  factor: 'multiplier',
}

/**
 * One calculated value, drawn: what goes into it, the formula, and what comes out.
 *
 * The derived-values section taught "numbers made of numbers" in text alone. This is the same
 * record every other surface prints, laid out top to bottom: each input with where it came from,
 * the formula exactly as the section prints it, and the result with its status. Nothing here is
 * authored for the drawing: the inputs, their provenance and the result come from
 * `evaluateDerivedMetric` over the worked episode the reading beside it uses.
 *
 * Without an `episodeId` it draws the value's structure and no numbers, for a question or an
 * explanation about a patient the worked episode does not describe.
 */
export function DerivedValueFigure({
  metricId,
  episodeId,
}: {
  readonly metricId: DerivedMetricId
  readonly episodeId?: string
}) {
  const metric = requireDerivedMetric(metricId)
  const episode = episodeId ? requireDerivedMeasurementEpisode(episodeId) : null
  const evaluation = episode
    ? evaluateDerivedMetric(metricId, episode, episode.flowResults[0] ?? null)
    : null
  const role = (inputId: string) =>
    ROLE_WORDS[metric.dependencies.find((dependency) => dependency.inputId === inputId)!.role]
  const inputs = evaluation
    ? evaluation.ledger.map((row) => ({
        id: row.inputId,
        label: row.label,
        role: role(row.inputId),
        value: row.display,
        provenance: row.provenanceLabel,
        usable: row.valid,
      }))
    : metric.dependencies.map((dependency) => ({
        id: dependency.inputId,
        label: requireDerivedInputDefinition(dependency.inputId).label,
        role: ROLE_WORDS[dependency.role],
        value: null,
        provenance: null,
        usable: true,
      }))
  const calculated = HEMODYNAMICS_QUESTION_SORT.origins.find((origin) => origin.id === 'calculated')
  return (
    <figure
      className={styles.derivedValueFigure}
      data-derived-figure={metricId}
      data-derived-values={evaluation ? 'shown' : 'structure'}
    >
      <figcaption>
        <strong>
          {metric.name} ({metric.shortLabel}): what goes in, and what comes out
        </strong>
      </figcaption>
      <p className={styles.derivedValueStage}>Inputs</p>
      <ul className={styles.derivedValueInputs} data-derived-inputs>
        {inputs.map((input) => (
          <li
            key={input.id}
            data-derived-input={input.id}
            data-usable={input.usable}
            data-provenance={input.provenance?.toLowerCase() ?? undefined}
          >
            <b>{input.label}</b>
            {input.value ? <span data-derived-input-value>{input.value}</span> : null}
            <small>
              {input.provenance ? `${input.provenance} · ` : ''}
              {input.role}
            </small>
          </li>
        ))}
      </ul>
      <p className={styles.derivedValueArrow} aria-hidden="true">
        ↓
      </p>
      <p className={styles.derivedValueStage}>Formula</p>
      <p className={styles.derivedValueFormula} data-derived-formula>
        {metric.shortLabel} = {metric.formulaText}
      </p>
      {evaluation?.gradientAccounts.map((gradient) => (
        <p key={gradient.label} className={styles.derivedValueGradient} data-derived-gradient>
          {gradient.display}
        </p>
      ))}
      <p className={styles.derivedValueArrow} aria-hidden="true">
        ↓
      </p>
      <p className={styles.derivedValueStage}>Result</p>
      <p
        className={styles.derivedValueResult}
        data-derived-result={evaluation?.status ?? 'not-shown'}
      >
        {evaluation ? (
          <>
            <strong>
              {evaluation.value === null
                ? 'Result withheld'
                : `${evaluation.value.toFixed(metric.displayPrecision)} ${evaluation.unit}`}
            </strong>{' '}
            · {derivedResultStatusLabels[evaluation.status]}
          </>
        ) : (
          <strong>
            {metric.shortLabel}
            {metric.outputUnit ? `, in ${metric.outputUnit}` : ''}
          </strong>
        )}
      </p>
      {calculated ? (
        <p className={styles.derivedValueNote} data-derived-note>
          {calculated.definition}
        </p>
      ) : null}
    </figure>
  )
}
