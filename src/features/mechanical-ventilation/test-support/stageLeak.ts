import { mechanicalVentilationCaseById } from '../content/runtimeCases'
import { ventilationExperimentByUnit } from '../content/learningExperiments'
import { ventilationSectionSpec } from '../content/sectionSpecs'

/**
 * What may not appear before a section's prediction is committed.
 *
 * The section spec's own deny patterns, the keyed answer of each round (the surfaces are scanned
 * with the prediction fieldset itself removed, so the answer may appear only where it is being
 * asked), and the diagnosis titles of every clinical case the section's rounds load.
 */
export function ventilationPrecommitDenyPatterns(unitId: string): readonly RegExp[] {
  const spec = ventilationSectionSpec(unitId)
  const experiment = ventilationExperimentByUnit.get(unitId)
  if (!experiment) throw new Error(`Unknown unit ${unitId}`)
  const patterns: RegExp[] = [...spec.precommitDenyPatterns]
  for (const round of experiment.rounds) {
    patterns.push(new RegExp(escape(round.choices[round.correct]), 'i'))
    const definition = mechanicalVentilationCaseById.get(round.caseId)
    if (definition) {
      // The diagnosis half of a case title: "COPD: dynamic hyperinflation…" → each clause.
      for (const clause of definition.title.split(/[:;]/)) {
        const trimmed = clause.trim()
        if (trimmed.length >= 12) patterns.push(new RegExp(escape(trimmed), 'i'))
      }
    }
  }
  return patterns
}

export function ventilationLeakMatches(
  text: string,
  patterns: readonly RegExp[],
): readonly string[] {
  return patterns.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source)
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
