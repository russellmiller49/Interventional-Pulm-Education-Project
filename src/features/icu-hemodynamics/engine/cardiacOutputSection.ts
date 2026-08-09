/**
 * What it takes to have worked through the cardiac-output section.
 *
 * The predicate this replaces was one line: an accepted average exists. That was satisfiable by
 * generating three curves and clicking accept three times without ever looking at a trace, and it
 * had nothing at all to say about Fick — a learner could finish a section named "thermodilution and
 * Fick" without once distinguishing a measured oxygen uptake from a substituted one.
 *
 * The four conditions here are the four questions the section exists to make answerable. They are
 * deliberately expressed over evidence rather than over React state, so a suite can construct the
 * failing combination directly instead of driving a workspace to reach it.
 *
 * Nothing here touches the persisted progress payload, the storage key, the completion-rule id, or
 * scoring. This is a Learn-local judgement about whether the section's own work was done.
 */

import {
  thermodilutionSeriesSummary,
  thermodilutionTrialCountsTowardSeries,
  THERMODILUTION_SERIES_TRIAL_COUNT,
} from './thermodilution'
import type { ThermodilutionTrial } from './types'

export interface ThermodilutionSectionEvidence {
  readonly trials: readonly ThermodilutionTrial[]
  /**
   * Whether the learner separated a measured oxygen uptake from a substituted one, rather than
   * treating "Fick" as a single method.
   */
  readonly methodProvenanceResolved: boolean
  /**
   * Whether the learner reached a defensible position on a scenario where the two methods disagree,
   * without combining them into one number.
   */
  readonly disagreementResolvedWithoutAveraging: boolean
}

export interface ThermodilutionSectionCompletion {
  readonly acceptedSeriesEstablished: boolean
  readonly everyAcceptedTrialWasReviewed: boolean
  readonly everyExclusionHasATechnicalReason: boolean
  readonly methodProvenanceResolved: boolean
  readonly disagreementResolvedWithoutAveraging: boolean
  readonly complete: boolean
  /** What is still outstanding, in the learner's terms. */
  readonly outstanding: readonly string[]
}

export function thermodilutionSectionCompletion(
  evidence: ThermodilutionSectionEvidence,
): ThermodilutionSectionCompletion {
  const summary = thermodilutionSeriesSummary(evidence.trials)
  const acceptedSeriesEstablished = summary.averageLMin !== null

  /**
   * Re-checked here rather than trusted from the reducer. The reducer refuses to accept an
   * unreviewed trial, so this can only be false for a state that was constructed rather than driven
   * — which is exactly the state a regression would produce.
   */
  const everyAcceptedTrialWasReviewed = evidence.trials
    .filter((trial) => trial.accepted === true)
    .every((trial) => trial.reviewed === true)

  const everyExclusionHasATechnicalReason = evidence.trials
    .filter((trial) => trial.accepted === false)
    .every((trial) => typeof trial.exclusionReasonId === 'string' && trial.exclusionReasonId !== '')

  const outstanding: string[] = []
  if (!acceptedSeriesEstablished) {
    const usable = evidence.trials.filter(thermodilutionTrialCountsTowardSeries).length
    outstanding.push(
      `Build a series of ${THERMODILUTION_SERIES_TRIAL_COUNT} reviewed, technically usable trials; ${usable} are available.`,
    )
  }
  if (!everyAcceptedTrialWasReviewed) {
    outstanding.push('Review the raw curve of every trial that was accepted into the series.')
  }
  if (!everyExclusionHasATechnicalReason) {
    outstanding.push('Give a technical reason for every trial left out of the series.')
  }
  if (!evidence.methodProvenanceResolved) {
    outstanding.push(
      'Separate a Fick result whose oxygen uptake was measured from one whose oxygen uptake was assumed.',
    )
  }
  if (!evidence.disagreementResolvedWithoutAveraging) {
    outstanding.push(
      'Work through a scenario where the two methods disagree and say which result, if either, is defensible.',
    )
  }

  return {
    acceptedSeriesEstablished,
    everyAcceptedTrialWasReviewed,
    everyExclusionHasATechnicalReason,
    methodProvenanceResolved: evidence.methodProvenanceResolved,
    disagreementResolvedWithoutAveraging: evidence.disagreementResolvedWithoutAveraging,
    complete: outstanding.length === 0,
    outstanding,
  }
}
