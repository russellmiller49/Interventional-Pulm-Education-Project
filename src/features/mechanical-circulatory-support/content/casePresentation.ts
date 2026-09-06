import type { McsScenarioDefinition } from '../engine/types'
import { mcsCapstoneScenarios, mcsPracticeScenarios } from './scenarios'

/**
 * A case is named by what the learner sees before its debrief, never by its diagnosis.
 *
 * A scenario's own `title` names the fault — "The balloon that stays inflated too long", "Low flow
 * with severe hypertension" — which is the answer to the question the case asks. Every surface a
 * learner meets before the debrief (the hub accordion, the pairing offered at the end of a
 * section) shows the presentation instead; the scenario title returns in the debrief, where it
 * is the point.
 */
const PRESENTATION_TITLES: Readonly<Record<string, string>> = {
  'IABP-01': 'Weak augmentation after a timing change',
  'IABP-02': 'Inconsistent assisted beats in an irregular rhythm',
  'IABP-03': 'Well-timed balloon, critically low delivery',
  'IMP-01': 'Falling pump flow with a suction alarm at high support',
  'IMP-02': 'Displayed flow below expectation with an abnormal motor-current pattern',
  'IMP-03': 'Unchanged level, high pressures, falling estimated flow',
  'LVAD-01': 'Low-flow alarm with a high mean pressure',
  'LVAD-02': 'Low pump flow with a high right atrial pressure',
  'LVAD-03': 'A controller alarm and a pump flow of nothing',
  'CAP-IABP-01': 'Intermittent assisted beats in a fast irregular rhythm',
  'CAP-IMP-01': 'Pump activity on the display, little of it arriving',
  'CAP-LVAD-01': 'Low flow with converging filling pressures after a bedside procedure',
}

export function mcsPresentationTitle(
  scenario: Pick<McsScenarioDefinition, 'id' | 'title'>,
): string {
  return PRESENTATION_TITLES[scenario.id] ?? scenario.title
}

export function mcsCaseKindLabel(scenario: Pick<McsScenarioDefinition, 'kind'>): string {
  return scenario.kind === 'capstone' ? 'Challenge case' : 'Practice case'
}

export function validateMcsCasePresentation(): string[] {
  const errors: string[] = []
  for (const scenario of [...mcsPracticeScenarios, ...mcsCapstoneScenarios]) {
    const title = PRESENTATION_TITLES[scenario.id]
    if (!title) errors.push(`${scenario.id}: no presentation title`)
    else if (title === scenario.title)
      errors.push(`${scenario.id}: the presentation is the diagnosis`)
  }
  for (const id of Object.keys(PRESENTATION_TITLES)) {
    if (
      ![...mcsPracticeScenarios, ...mcsCapstoneScenarios].some((scenario) => scenario.id === id)
    ) {
      errors.push(`${id}: a presentation title for no scenario`)
    }
  }
  return errors
}

const presentationErrors = validateMcsCasePresentation()
if (presentationErrors.length > 0) {
  throw new Error(`Invalid MCS case presentation:\n- ${presentationErrors.join('\n- ')}`)
}
