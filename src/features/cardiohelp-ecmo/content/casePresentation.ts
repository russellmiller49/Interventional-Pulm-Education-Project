import type { ScenarioDefinition } from '../engine/types'

/**
 * Presentation-oriented wording for an optional local prediction variation. Main outlines,
 * pickers, resume and next links use `scenario.title`, matching the shared catalog. A named
 * learning case may state its mechanism; this helper must never impose a debrief-only title
 * or explanation rule (ECMO-02).
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
    'Explore the findings, try an optional prediction, or open the explanation at any time.'
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
