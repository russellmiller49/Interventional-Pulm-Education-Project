import type { McsScenarioDefinition } from '../engine/types'
import { allMcsScenarios } from './scenarios'

/** Meaningful clinical titles are teaching, including before an optional prediction. */
export function mcsPresentationTitle(
  scenario: Pick<McsScenarioDefinition, 'id' | 'title'>,
): string {
  return scenario.title.replace(/ challenge$/i, ' integrated walkthrough')
}
export function mcsCaseKindLabel(scenario: Pick<McsScenarioDefinition, 'kind'>): string {
  return scenario.kind === 'capstone' ? 'Optional integrated case' : 'Guided case'
}
export function validateMcsCasePresentation(): string[] {
  return allMcsScenarios
    .filter((scenario) => !mcsPresentationTitle(scenario).trim())
    .map((scenario) => `${scenario.id}: missing teaching title`)
}
