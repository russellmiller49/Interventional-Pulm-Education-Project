'use client'

import { useId, useState } from 'react'

import { cardiacOutputResultLabels } from '../content/cardiacOutputMethods'
import { requireCardiacOutputParameter as requireParameter } from '../content/cardiacOutputSourceBoundaries'
import {
  thermodilutionCurveFeatures,
  thermodilutionCurveTextEquivalent,
  thermodilutionExclusionReasonsFor,
  thermodilutionQualityLabels,
  thermodilutionSeriesConditionWords,
  thermodilutionSeriesSummary,
  thermodilutionTrialInclusion,
  type ThermodilutionSeriesSummary,
  type ThermodilutionTrial,
} from '../engine'
import type { ThermodilutionSeriesView } from '../engine/measurementProvenance'
import styles from './icu-hemodynamics.module.css'

const SERIES_COUNT_QUALIFIER = requireParameter('minimum-accepted-trials').learnerFacingQualifier
const AGREEMENT_QUALIFIER = requireParameter(
  'numeric-repeatability-criterion',
).learnerFacingQualifier

/**
 * The raw curve, drawn from the trial's own trace with its named parts marked.
 *
 * The derived number is deliberately not part of this figure. A learner who has been shown "5.4
 * L/min" beside a curve is judging the curve against the number; the section is built the other way
 * round, so the figure carries baseline, onset, peak, decay, and any secondary disturbance and
 * nothing else.
 */
export function ThermodilutionCurveFigure({ trial }: { readonly trial: ThermodilutionTrial }) {
  const features = thermodilutionCurveFeatures(trial)
  const values = trial.curve.map((point) => point.temperatureChangeC)
  const minimum = Math.min(...values, -0.01)
  const scaleY = (temperatureChangeC: number) =>
    18 + (Math.abs(temperatureChangeC) / Math.abs(minimum)) * 72
  const scaleX = (timeSeconds: number) => (timeSeconds / 8) * 500
  const points = trial.curve
    .map(
      (point) =>
        `${scaleX(point.timeSeconds).toFixed(1)},${scaleY(point.temperatureChangeC).toFixed(1)}`,
    )
    .join(' ')

  return (
    <svg
      viewBox="0 0 500 110"
      role="img"
      aria-label={thermodilutionCurveTextEquivalent(trial)}
      className={styles.thermoTrialCurve}
    >
      <path d="M0 18 H500 M0 54 H500 M0 90 H500" stroke="rgba(255,255,255,.1)" />
      <line
        x1="0"
        x2="500"
        y1={scaleY(features.baselineC)}
        y2={scaleY(features.baselineC)}
        stroke="#8fb6c4"
        strokeDasharray="4 4"
        strokeWidth="1"
      />
      {points.length > 0 ? (
        <polyline points={points} fill="none" stroke="#72d7c8" strokeWidth="2.5" />
      ) : null}
      {features.onsetSeconds !== null ? (
        <circle
          cx={scaleX(features.onsetSeconds)}
          cy={scaleY(features.baselineC)}
          r="3.5"
          fill="#ffd166"
        />
      ) : null}
      <circle
        cx={scaleX(features.peakTimeSeconds)}
        cy={scaleY(features.baselineC + features.peakChangeC)}
        r="4"
        fill="#72d7c8"
      />
      {features.secondaryDisturbanceTimeSeconds !== null ? (
        <circle
          cx={scaleX(features.secondaryDisturbanceTimeSeconds)}
          cy={scaleY(features.baselineC)}
          r="4"
          fill="#ff7488"
        />
      ) : null}
    </svg>
  )
}

/** The named parts of the curve, as words rather than as marks on a picture. */
function CurveFeatureList({ trial }: { readonly trial: ThermodilutionTrial }) {
  const features = thermodilutionCurveFeatures(trial)
  const rows: readonly [string, string][] = [
    ['Baseline', `${features.baselineC.toFixed(3)} °C from the settled trace`],
    [
      'Onset',
      features.onsetSeconds === null
        ? 'No identifiable onset'
        : `${features.onsetSeconds.toFixed(2)} s after injection`,
    ],
    [
      'Peak change',
      `${Math.abs(features.peakChangeC).toFixed(3)} °C below baseline at ${features.peakTimeSeconds.toFixed(2)} s`,
    ],
    [
      'Decay',
      features.decayToTenthSeconds === null
        ? 'Does not settle inside the recorded window'
        : `Back within a tenth of the peak by ${features.decayToTenthSeconds.toFixed(2)} s`,
    ],
    [
      'Secondary disturbance',
      features.secondaryDisturbance
        ? `Present at ${(features.secondaryDisturbanceTimeSeconds ?? 0).toFixed(2)} s`
        : 'None after the trace settles',
    ],
    ['Area used by the calculation', `${features.curveArea.toFixed(3)} in model units`],
  ]
  return (
    <dl className={styles.curveFeatureList}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * One trial: the curve first, then the decision, then — only after the curve has been reviewed —
 * the number it produced.
 *
 * Exclusion needs a reason drawn from what this curve actually shows. When the list is empty the
 * exclude control says so rather than disappearing, because "there is no technical reason to drop
 * this one" is the thing the learner most needs to be told.
 */
export function ThermodilutionTrialCard({
  trial,
  onReview,
  onAccept,
  onExclude,
}: {
  readonly trial: ThermodilutionTrial
  readonly onReview: () => void
  readonly onAccept: () => void
  readonly onExclude: (reasonId: string) => void
}) {
  const headingId = useId()
  const reasonSelectId = useId()
  const availableReasons = thermodilutionExclusionReasonsFor(trial)
  const [reasonId, setReasonId] = useState<string>('')

  const state =
    trial.accepted === true
      ? cardiacOutputResultLabels.acceptedTrial
      : trial.accepted === false
        ? cardiacOutputResultLabels.excludedTrial
        : trial.reviewed
          ? 'Reviewed; no decision yet'
          : cardiacOutputResultLabels.unreviewedTrial
  // Three facts, shown as three (report L7-03): what you chose, what the automatic check found, and
  // whether the curve is in the calculation. The badge used to be the first of these alone.
  const inclusion = thermodilutionTrialInclusion(trial)
  const acceptedButLeftOut = inclusion.learnerDecision === 'accepted' && !inclusion.included

  return (
    <article
      className={styles.thermoTrialCard}
      aria-labelledby={headingId}
      data-trial-inclusion={inclusion.code}
    >
      <header>
        <h4 id={headingId}>Trial {trial.sequence}</h4>
        <p data-trial-state={trial.accepted === null ? 'undecided' : String(trial.accepted)}>
          <span className={styles.srOnly}>Your decision: </span>
          {state}
        </p>
        <p data-trial-in-calculation={inclusion.included ? 'yes' : 'no'}>
          {inclusion.included ? 'In the calculation' : 'Not in the calculation'}
        </p>
      </header>
      {inclusion.learnerDecision !== 'undecided' ? (
        <p
          className={acceptedButLeftOut ? styles.thermoTrialLeftOut : styles.thermoTrialInclusion}
          data-trial-inclusion-note
          role={acceptedButLeftOut ? 'status' : undefined}
        >
          {inclusion.explanation}
        </p>
      ) : null}

      <ThermodilutionCurveFigure trial={trial} />
      <CurveFeatureList trial={trial} />

      <p className={styles.thermoTrialQuality}>
        <span>Automatic quality check</span>
        {thermodilutionQualityLabels[trial.quality]}
      </p>
      {trial.alerts.length > 0 ? (
        <ul className={styles.curveAlerts}>
          {trial.alerts.map((alert) => (
            <li key={alert}>{alert}</li>
          ))}
        </ul>
      ) : null}

      {trial.reviewed ? (
        <p className={styles.thermoTrialResult}>
          <span>{cardiacOutputResultLabels.methodResult}</span>
          <strong>{trial.estimatedCardiacOutputLMin.toFixed(1)} L/min</strong>
          <small>by bolus thermodilution, derived from the area above</small>
        </p>
      ) : (
        <p className={styles.thermoTrialWithheld}>
          The derived value stays hidden until the raw curve has been reviewed. Read the trace
          first, then judge whether the acquisition was usable.
        </p>
      )}

      <div className={styles.thermoTrialActions}>
        <button type="button" onClick={onReview} disabled={trial.reviewed}>
          {trial.reviewed ? 'Curve reviewed' : 'Review this curve'}
        </button>
        <button
          type="button"
          aria-pressed={trial.accepted === true}
          disabled={!trial.reviewed}
          onClick={onAccept}
        >
          Accept into the series
        </button>
      </div>

      <div className={styles.thermoExcludeRow}>
        <label htmlFor={reasonSelectId}>
          Technical reason for excluding this trial
          <select
            id={reasonSelectId}
            value={reasonId}
            disabled={!trial.reviewed || availableReasons.length === 0}
            onChange={(event) => setReasonId(event.target.value)}
          >
            <option value="">Choose a reason</option>
            {availableReasons.map((reason) => (
              <option key={reason.id} value={reason.id}>
                {reason.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-pressed={trial.accepted === false}
          disabled={!trial.reviewed || reasonId === ''}
          onClick={() => onExclude(reasonId)}
        >
          Exclude with this reason
        </button>
      </div>
      {trial.reviewed && availableReasons.length === 0 ? (
        <p className={styles.thermoNoReasonNote}>
          This curve shows no technical reason for exclusion. Disagreeing with the other trials is
          not one — leave it in the series and account for the spread.
        </p>
      ) : null}
    </article>
  )
}

/**
 * The series readout.
 *
 * Spread is shown and described; it is never compared against an authored agreement criterion,
 * because this module has none that a registered record supports. The repeatability sentence says
 * so, and it says the thing a tight series most invites a learner to forget.
 *
 * HD-PRE-REVIEW-02 (report P-05, Figure 42). The readout describes one series: with a state, the
 * one for the conditions the patient is in now. Curves acquired under earlier conditions are listed
 * beneath it, each with its own conditions and numbers, and are never folded into its average.
 */
export function ThermodilutionSeriesReadout({
  trials,
  view,
}: {
  readonly trials: readonly ThermodilutionTrial[]
  /** The state's series view. Without one, the most recently acquired series is described. */
  readonly view?: ThermodilutionSeriesView
}) {
  const summary = view?.current ?? thermodilutionSeriesSummary(trials)
  const earlier = view?.earlier ?? []
  const headingId = useId()

  return (
    <section
      className={styles.thermoSeriesReadout}
      aria-labelledby={headingId}
      data-series-key={summary.identity.key}
    >
      <h4 id={headingId}>
        {earlier.length > 0 ? 'Accepted series — current conditions' : 'Accepted series'}
      </h4>
      {earlier.length > 0 || summary.identity.origin === 'unrecorded' ? (
        <p data-series-conditions>
          This series: {thermodilutionSeriesConditionWords(summary.identity)}.
        </p>
      ) : null}
      {summary.averageLMin === null ? (
        <p data-series-state="incomplete">
          {summary.trialIds.length === 0 && earlier.length > 0
            ? 'No curve has been acquired under these conditions yet. '
            : ''}
          {summary.blockedReasons.join(' ')} {SERIES_COUNT_QUALIFIER}
        </p>
      ) : (
        <>
          <p data-series-state="established">
            <strong>{summary.averageLMin.toFixed(1)} L/min</strong> by bolus thermodilution, from{' '}
            {summary.includedTrialIds.length} reviewed trials in this series.
          </p>
          <dl className={styles.curveFeatureList}>
            <div>
              <dt>Range across accepted trials</dt>
              <dd>
                {summary.lowestLMin?.toFixed(1)} to {summary.highestLMin?.toFixed(1)} L/min, a
                spread of {summary.spreadLMin?.toFixed(2)} L/min
              </dd>
            </div>
            <div>
              <dt>Acquisition</dt>
              <dd>
                {summary.techniqueConsistent
                  ? 'Every accepted trial used the same entered values and respiratory timing.'
                  : 'The accepted trials did not all use the same entered values or respiratory timing, so part of this spread belongs to the operator.'}
              </dd>
            </div>
          </dl>
        </>
      )}
      {summary.excludedTrialIds.length > 0 ? (
        <p className={styles.thermoExcludedNote}>
          {summary.excludedTrialIds.length} trial
          {summary.excludedTrialIds.length === 1 ? ' is' : 's are'} excluded with a recorded
          technical reason and {summary.excludedTrialIds.length === 1 ? 'does' : 'do'} not
          contribute to this value.
        </p>
      ) : null}
      {summary.acceptedButNotIncluded.length > 0 ? (
        <ul className={styles.thermoExcludedNote} data-series-accepted-not-included>
          {summary.acceptedButNotIncluded.map((item) => (
            <li key={item.trialId}>
              Trial {item.sequence}: {item.explanation}
            </li>
          ))}
        </ul>
      ) : null}
      <p className={styles.measurementTeachingCallout}>
        Repeatability describes the spread of the{' '}
        {summary.includedTrialIds.length === 1
          ? 'one curve'
          : `${summary.includedTrialIds.length} curves`}{' '}
        in this series’ calculation. It does not describe where they sit: a series acquired the same
        slightly imperfect way every time agrees with itself and is shifted together.{' '}
        {AGREEMENT_QUALIFIER}
      </p>
      {earlier.length > 0 ? <EarlierSeries earlier={earlier} current={summary} /> : null}
    </section>
  )
}

/**
 * Series from earlier conditions: kept, reviewable, and never averaged with the current one. Opening
 * this list changes nothing — no series is started, relabelled or merged.
 */
function EarlierSeries({
  earlier,
  current,
}: {
  readonly earlier: readonly ThermodilutionSeriesSummary[]
  readonly current: ThermodilutionSeriesSummary
}) {
  return (
    <details className={styles.thermoEarlierSeries} data-earlier-series>
      <summary>Earlier series ({earlier.length}) — kept, and not averaged with this one</summary>
      {current.unpooledReason ? <p>{current.unpooledReason}</p> : null}
      <ul>
        {earlier.map((series) => (
          <li key={series.identity.key} data-earlier-series-key={series.identity.key}>
            <strong>{thermodilutionSeriesConditionWords(series.identity)}</strong>:{' '}
            {series.averageLMin === null
              ? `${series.trialIds.length} curve${series.trialIds.length === 1 ? '' : 's'}, not an established series (${series.includedTrialIds.length} in its calculation).`
              : `${series.averageLMin.toFixed(1)} L/min from ${series.includedTrialIds.length} curves (${series.lowestLMin?.toFixed(1)} to ${series.highestLMin?.toFixed(1)} L/min).`}
          </li>
        ))}
      </ul>
    </details>
  )
}
