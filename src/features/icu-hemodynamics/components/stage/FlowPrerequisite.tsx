'use client'

import { useState } from 'react'
import {
  derivedMetricRecords,
  requireDerivedMetric,
  type DerivedMetricId,
} from '../../content/derivedMetrics'
import { requireDerivedMeasurementEpisode } from '../../content/derivedMeasurementEpisodes'
import { requireCardiacOutputMethod } from '../../content/cardiacOutputMethods'
import { requireCardiacOutputParameter } from '../../content/cardiacOutputSourceBoundaries'
import { evaluateDerivedMetric, derivedResultStatusLabels } from '../../engine/derivedEvaluation'
import type { HemodynamicSimulationState } from '../../engine/types'
import { FICK_EPISODES, FickEpisodeCard } from '../FickMethodWorkbench'
import { ThermodilutionCurveFigure } from '../ThermodilutionTrialReview'
import styles from './hemodynamics-stage.module.css'

export type FlowReadingPart =
  | 'td-method'
  | 'td-curve'
  | `fick:${string}`
  | `metric:${DerivedMetricId}`

/** Local reading positions do not alter any existing task, phase or assessment identity. */
export function flowReadingParts(
  section: string,
  taskKind: string,
  ordinal: number,
): readonly FlowReadingPart[] {
  if (section === 'thermodilution-series' && ordinal === 1) return ['td-method', 'td-curve']
  if (section === 'thermodilution-series' && taskKind === 'observe')
    return FICK_EPISODES.map((episode) => `fick:${episode.id}` as const)
  if (section === 'derived-hemodynamics' && ordinal === 1)
    return derivedMetricRecords.map((metric) => `metric:${metric.id}` as const)
  return []
}

export function flowReadingTitle(part: FlowReadingPart): string {
  if (part === 'td-method') return 'What thermodilution acquires'
  if (part === 'td-curve') return 'Read the raw temperature curve'
  if (part.startsWith('fick:'))
    return FICK_EPISODES.find((episode) => part === (`fick:${episode.id}` as const))!.label
  return `${requireDerivedMetric(part.slice(7) as DerivedMetricId).shortLabel}: question, inputs and result`
}

export function FlowPrerequisite({
  part,
  state,
}: {
  readonly part: FlowReadingPart
  readonly state: HemodynamicSimulationState
}) {
  const method = requireCardiacOutputMethod('thermodilution')
  if (part.startsWith('metric:'))
    return <MetricReading metricId={part.slice(7) as DerivedMetricId} />
  if (part.startsWith('fick:'))
    return (
      <section className={styles.teachingCard}>
        <p>
          {
            requireCardiacOutputParameter('oxygen-uptake-estimating-equation')
              .learnerFacingQualifier
          }{' '}
          {
            requireCardiacOutputParameter('hemoglobin-oxygen-binding-capacity')
              .learnerFacingQualifier
          }
        </p>
        <FickEpisodeCard
          episode={FICK_EPISODES.find((episode) => part === (`fick:${episode.id}` as const))!}
        />
      </section>
    )
  return (
    <section className={styles.teachingCard} data-reading-part={part}>
      {part === 'td-method' ? (
        <>
          <h3>From temperature to flow</h3>
          <p>{method.measurand}</p>
          <p>
            <strong>Observed:</strong> {method.directlyObserved}
          </p>
          <p>
            <strong>Raw record:</strong> {method.rawDataRepresentation}
          </p>
          <ol className={styles.sequence}>
            {method.acquisitionSequence.map((step) => (
              <li key={step.order}>
                <strong>{step.whatYouDo}</strong> {step.whatItEstablishes}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <h3>One existing reference curve</h3>
          <p>
            Read temperature change over time before judging the calculated flow. This is a worked
            observation; viewing it does not review or accept a trial in your ledger.
          </p>
          {state.thermodilutionTrials[0] ? (
            <ThermodilutionCurveFigure trial={state.thermodilutionTrials[0]} />
          ) : null}
          <dl className={styles.stopFacts}>
            {method.qualityChecks.map((check) => (
              <div key={check.id}>
                <dt>{check.label}</dt>
                <dd>
                  {check.whatToLookFor} {check.whenItIsNotMet}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  )
}

function MetricReading({ metricId }: { readonly metricId: DerivedMetricId }) {
  const [questionable, setQuestionable] = useState(false)
  const metric = requireDerivedMetric(metricId)
  // Existing ungraded episodes; neither is a keyed prediction or transfer specimen.
  const episode = requireDerivedMeasurementEpisode(
    questionable ? 'ep-missing-bsa' : 'ep-assumed-vo2',
  )
  const result = evaluateDerivedMetric(metricId, episode, episode.flowResults[0] ?? null)
  return (
    <section className={styles.teachingCard} data-metric-reading={metricId}>
      <h3>What does {metric.shortLabel} help describe?</h3>
      <p>{metric.interpretation}</p>
      <p>
        <strong>Authored measurement episode:</strong> {episode.presentation}
      </p>
      <h4>Source inputs</h4>
      <dl className={styles.stopFacts}>
        {result.ledger.map((row) => (
          <div key={row.inputId}>
            <dt>{row.label}</dt>
            <dd>
              {row.value === null ? 'Missing' : `${row.value} ${row.unit}`} · {row.provenance} ·{' '}
              {row.note}
            </dd>
          </div>
        ))}
      </dl>
      <h4>Formula and units</h4>
      <p>
        {metric.shortLabel} = {metric.formulaText} · {metric.outputUnit}
      </p>
      <p>{metric.unitAccount.join(' ')}</p>
      <h4>Result from these inputs</h4>
      <p data-metric-result={result.status}>
        <strong>
          {result.value === null
            ? 'Result withheld'
            : `${result.value.toFixed(metric.displayPrecision)} ${result.unit}`}
        </strong>{' '}
        · {derivedResultStatusLabels[result.status]}
      </p>
      {result.flowMethodLabel ? (
        <p>{result.flowMethodLabel}</p>
      ) : (
        <p>No cardiac-output method is required for this metric.</p>
      )}
      {[
        ...result.mathematicalValidityReasons,
        ...result.clinicalValidityReasons,
        ...result.cautions,
      ].map((reason) => (
        <p key={reason}>{reason}</p>
      ))}
      <h4>Interpretation boundary</h4>
      <p>{metric.cannotEstablish}</p>
      <p>{metric.sensitivityAccount}</p>
      <label>
        <input
          type="checkbox"
          checked={questionable}
          onChange={(event) => setQuestionable(event.target.checked)}
        />{' '}
        Compare the existing episode with missing height and weight
      </label>
      <p className={styles.dockNote}>
        Changing episodes changes the displayed source records and recalculates this result. Missing
        body size withholds only values that depend on it; missing is never zero.
      </p>
    </section>
  )
}
