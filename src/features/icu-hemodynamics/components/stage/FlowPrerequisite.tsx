'use client'

import { useState } from 'react'
import {
  derivedMetricRecords,
  requireDerivedMetric,
  type DerivedMetricId,
} from '../../content/derivedMetrics'
import {
  DERIVED_READING_COMPARISON_EPISODE_ID,
  DERIVED_READING_EPISODE_ID,
} from '../../content/derivedFigure'
import { requireDerivedMeasurementEpisode } from '../../content/derivedMeasurementEpisodes'
import { requireCardiacOutputMethod } from '../../content/cardiacOutputMethods'
import {
  CARDIAC_OUTPUT_METHOD_SECTION_HEADINGS,
  CardiacOutputMethodPageSurface,
  CardiacOutputMethodSection,
  CardiacOutputOpenQuestions,
  type CardiacOutputMethodSectionId,
} from '../CardiacOutputMethodModel'
import { requireCardiacOutputParameter } from '../../content/cardiacOutputSourceBoundaries'
import { evaluateDerivedMetric, derivedResultStatusLabels } from '../../engine/derivedEvaluation'
import type { HemodynamicSimulationState } from '../../engine/types'
import { FICK_EPISODES, FickEpisodeCard } from '../FickMethodWorkbench'
import { ThermodilutionCurveFigure } from '../ThermodilutionTrialReview'
import styles from './hemodynamics-stage.module.css'

export type FlowReadingPart =
  | 'td-method'
  | 'td-curve'
  | MethodReadingPart
  | `fick:${string}`
  | `metric:${DerivedMetricId}`

/**
 * Pages that read the thermodilution method a part at a time, with the reference curve beside
 * them (owner, 2026-11-11). These eight headings used to be shown only inside the section's
 * Explain card, about 1,500 words under the explanation of a question. Two pages come before the
 * section's questions, because its tasks ask the learner to apply them: how the method breaks
 * down, and when to repeat or withhold. Three come after the explanation.
 */
type MethodReadingPart = 'td-breakdown' | 'td-decide' | 'td-values' | 'td-calculation' | 'td-limits'

const METHOD_PAGES: Readonly<
  Record<
    MethodReadingPart,
    {
      readonly title: string
      readonly sections: readonly CardiacOutputMethodSectionId[]
      readonly openQuestions?: boolean
    }
  >
> = {
  'td-breakdown': { title: 'How thermodilution breaks down', sections: ['breakdown'] },
  'td-decide': { title: 'When to repeat, and when to withhold', sections: ['repeat', 'withhold'] },
  'td-values': { title: 'Where every value came from', sections: ['provenance'] },
  'td-calculation': {
    title: 'How the calculation runs, and what repeating it shows',
    sections: ['calculation', 'repeatability'],
  },
  'td-limits': {
    title: 'Sources, and where the methods are uncertain',
    sections: ['sources'],
    openQuestions: true,
  },
}

const isMethodPage = (part: FlowReadingPart): part is MethodReadingPart => part in METHOD_PAGES

/** The method parts each page reads, so the card can say where each is read instead. */
export const THERMODILUTION_PAGES_BEFORE_QUESTIONS: readonly MethodReadingPart[] = [
  'td-breakdown',
  'td-decide',
]
export const THERMODILUTION_PAGES_AFTER_EXPLANATION: readonly MethodReadingPart[] = [
  'td-values',
  'td-calculation',
  'td-limits',
]
export function methodSectionsOn(
  pages: readonly MethodReadingPart[],
): readonly CardiacOutputMethodSectionId[] {
  return pages.flatMap((page) => METHOD_PAGES[page].sections)
}

/** Local reading positions do not alter any existing task, phase or assessment identity. */
export function flowReadingParts(
  section: string,
  taskKind: string,
  ordinal: number,
): readonly FlowReadingPart[] {
  if (section === 'thermodilution-series' && ordinal === 1)
    return ['td-method', 'td-curve', ...THERMODILUTION_PAGES_BEFORE_QUESTIONS]
  if (section === 'thermodilution-series' && taskKind === 'observe')
    return FICK_EPISODES.map((episode) => `fick:${episode.id}` as const)
  if (section === 'derived-hemodynamics' && ordinal === 1)
    return derivedMetricRecords.map((metric) => `metric:${metric.id}` as const)
  return []
}

/**
 * Pages read after a task's own content rather than before it. The flow section's Explain task
 * gives its explanation first, then reads the rest of the method a page at a time.
 */
export function flowTrailingParts(
  section: string,
  taskKind: string,
  phase: string,
): readonly FlowReadingPart[] {
  if (section === 'thermodilution-series' && taskKind === 'explain' && phase === 'explain')
    return THERMODILUTION_PAGES_AFTER_EXPLANATION
  return []
}

export function flowReadingTitle(part: FlowReadingPart): string {
  if (isMethodPage(part)) return METHOD_PAGES[part].title
  if (part === 'td-method') return 'What thermodilution acquires'
  if (part === 'td-curve') return 'Read the raw temperature curve'
  if (part.startsWith('fick:'))
    return FICK_EPISODES.find((episode) => part === (`fick:${episode.id}` as const))!.label
  return `${requireDerivedMetric(part.slice(7) as DerivedMetricId).shortLabel}: question, inputs and result`
}

export function FlowPrerequisite({
  part,
  state,
  figureBeside = false,
  comparisonEpisode,
  onComparisonEpisode,
}: {
  readonly part: FlowReadingPart
  readonly state: HemodynamicSimulationState
  /** The section's reference curve is in the visual column, so the text only points at it. */
  readonly figureBeside?: boolean
  /**
   * The derived-values reading's "compare the episode with missing height and weight" switch,
   * held by the stage so the drawing beside the text shows the same episode. Absent, the reading
   * keeps the switch itself.
   */
  readonly comparisonEpisode?: boolean
  readonly onComparisonEpisode?: (on: boolean) => void
}) {
  const method = requireCardiacOutputMethod('thermodilution')
  if (isMethodPage(part)) {
    const page = METHOD_PAGES[part]
    return (
      <section className={styles.teachingCard} data-reading-part={part}>
        {page.sections.map((section) => (
          <div key={section} data-method-section={section}>
            {/* A page of one part is headed by the task card; a page of two names each. */}
            {page.sections.length > 1 || page.openQuestions ? (
              <h3>{CARDIAC_OUTPUT_METHOD_SECTION_HEADINGS[section]}</h3>
            ) : null}
            <CardiacOutputMethodPageSurface>
              <CardiacOutputMethodSection method={method} section={section} />
            </CardiacOutputMethodPageSurface>
          </div>
        ))}
        {page.openQuestions ? (
          <div data-method-open-questions>
            <h3>Where the methods are uncertain</h3>
            <CardiacOutputMethodPageSurface>
              <CardiacOutputOpenQuestions />
            </CardiacOutputMethodPageSurface>
          </div>
        ) : null}
      </section>
    )
  }
  if (part.startsWith('metric:'))
    return (
      <MetricReading
        metricId={part.slice(7) as DerivedMetricId}
        comparisonEpisode={comparisonEpisode}
        onComparisonEpisode={onComparisonEpisode}
      />
    )
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
          {figureBeside ? (
            <p data-figure-pointer>
              The reference curve is the drawing of the raw record, with its parts named.
            </p>
          ) : state.thermodilutionTrials[0] ? (
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

function MetricReading({
  metricId,
  comparisonEpisode,
  onComparisonEpisode,
}: {
  readonly metricId: DerivedMetricId
  readonly comparisonEpisode?: boolean
  readonly onComparisonEpisode?: (on: boolean) => void
}) {
  const [ownChoice, setOwnChoice] = useState(false)
  const questionable = comparisonEpisode ?? ownChoice
  const setQuestionable = onComparisonEpisode ?? setOwnChoice
  const metric = requireDerivedMetric(metricId)
  // Existing ungraded episodes; neither is a keyed prediction or transfer specimen.
  const episode = requireDerivedMeasurementEpisode(
    questionable ? DERIVED_READING_COMPARISON_EPISODE_ID : DERIVED_READING_EPISODE_ID,
  )
  const result = evaluateDerivedMetric(metricId, episode, episode.flowResults[0] ?? null)
  return (
    <section className={styles.teachingCard} data-metric-reading={metricId}>
      <h3>What does {metric.shortLabel} help describe?</h3>
      <p>{metric.interpretation}</p>
      <p>
        <strong>Measurement episode:</strong> {episode.presentation}
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
