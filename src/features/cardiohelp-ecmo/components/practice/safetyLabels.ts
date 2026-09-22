import { ecmoSafetyEventLabels } from '../../content/safetyEventLabels'
import type { ScenarioDefinition } from '../../engine/types'

/**
 * A safety event in the learner's words, never in the engine's.
 *
 * Critical-error identifiers are keys; the sentence written for each lives on the scenario's
 * `unsafeActionPenalties`. A learner who reads "rpm-during-collapse" has been shown a key instead
 * of the explanation, and a screen reader or a second-language reader gets even less from it.
 *
 * Three steps, not two. The scenario's own label wins, because a case may describe the same act in
 * its own terms. Behind it sits the registry of every identifier the reducer can raise, which is
 * what a scenario that never listed one now falls to — both air cases reached the generic sentence
 * for a premature resumption, and named nothing (VAC7-2). The last line stays as a guard against an
 * identifier neither source knows, and is the only case where nothing is named.
 */
export function describeSafetyEvent(scenario: ScenarioDefinition, errorId: string): string {
  const penalty = scenario.unsafeActionPenalties.find((item) => item.id === errorId)
  return (
    penalty?.label ??
    ecmoSafetyEventLabels[errorId] ??
    'A safety stop was recorded for an action this case treats as unsafe.'
  )
}

export function describeSafetyEvents(
  scenario: ScenarioDefinition,
  errorIds: readonly string[],
): readonly string[] {
  return errorIds.map((errorId) => describeSafetyEvent(scenario, errorId))
}
