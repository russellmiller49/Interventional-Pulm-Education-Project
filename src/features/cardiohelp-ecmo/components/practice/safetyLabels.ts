import type { ScenarioDefinition } from '../../engine/types'

/**
 * A safety event in the learner's words, never in the engine's.
 *
 * Critical-error identifiers are keys; the sentence written for each lives on the scenario's
 * `unsafeActionPenalties`. A learner who reads "rpm-during-collapse" has been shown a key instead
 * of the explanation, and a screen reader or a second-language reader gets even less from it.
 * The fallback names the class of event without inventing a description.
 */
export function describeSafetyEvent(scenario: ScenarioDefinition, errorId: string): string {
  const penalty = scenario.unsafeActionPenalties.find((item) => item.id === errorId)
  return penalty?.label ?? 'A safety stop was recorded for an action this case treats as unsafe.'
}

export function describeSafetyEvents(
  scenario: ScenarioDefinition,
  errorIds: readonly string[],
): readonly string[] {
  return errorIds.map((errorId) => describeSafetyEvent(scenario, errorId))
}
