import type { ScenarioDefinition } from '../engine/types'

/**
 * What a Practice case is called before its debrief.
 *
 * A scenario's `title` names its diagnosis ("Occult hemorrhage with drainage insufficiency"), which
 * is the answer to the plan the learner is about to commit. Every surface that shows the case
 * before the debrief — the header, the case picker, the "Next" links, the Now card, the help
 * dialog — shows the presentation instead: the authored `presentationTitle` where one exists, else
 * the clinical case's patient label, which is already written from the bedside ("Patient with new
 * low flow, tachycardia, and hypotension"), else a neutral line for the capstones. The diagnosis
 * title returns in the debrief, where it belongs.
 */
export function presentationTitle(scenario: ScenarioDefinition): string {
  return (
    scenario.clinicalCase?.presentationTitle ??
    scenario.clinicalCase?.patientLabel ??
    scenario.challengeBrief?.title ??
    'Interpret the observable pattern'
  )
}

export function presentationSummary(scenario: ScenarioDefinition): string {
  return (
    scenario.clinicalCase?.openingNarrative ??
    scenario.challengeBrief?.presentation ??
    'The diagnosis and the corrective steps stay hidden until the debrief. Use everything on screen to commit your plan.'
  )
}

export type EcmoCaseKindLabel = 'ECMO initiation' | 'Patient deterioration' | 'ECMO complication'

export function caseKindLabel(scenario: ScenarioDefinition): EcmoCaseKindLabel | null {
  const kind = scenario.clinicalCase?.kind
  if (!kind) return null
  return kind === 'initiation'
    ? 'ECMO initiation'
    : kind === 'deterioration'
      ? 'Patient deterioration'
      : 'ECMO complication'
}
