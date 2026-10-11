import { mcsLessons } from './lessons'
import { MCS_NUMBERS } from './teachingNumbers'

/**
 * The Explain step's question, with somewhere for it to land (F11).
 *
 * Every section's Explain step asked a real question — "which bedside finding would you go and look
 * for?" — and gave the learner no way to answer it and no answer to compare with: the card offered
 * Hint, Show explanation and Try again over a panel that explained something else. The question is
 * now what it always was, an optional reflection, and it carries a worked response that can be
 * opened at once, before, after or instead of thinking about it.
 *
 * Nothing is typed and nothing is stored. There is no answer box because a box would either be
 * saved, which this module does not do with free text, or be discarded, which would be a pretence.
 *
 * Each worked response is assembled from sentences the section already carries — its explanation,
 * its organ-level statement, what it does and does not establish, and its transfer — so the
 * response adds no claim the section did not already make. They are still new learner-facing
 * arrangements of clinical prose: DRAFT, NOT REVIEWED, and listed in the MCS-PRE-REVIEW-04 owner
 * packet under OD-07.
 */

export interface McsExplainReflection {
  readonly sectionId: string
  /**
   * Shown as the reflection's question. Left undefined, the section's own `reassessmentPrompt` is
   * used, so the question a learner has always been asked is not reworded here.
   */
  readonly promptOverride?: string
  /** The worked response, one short paragraph per line. */
  readonly workedResponse: readonly string[]
  /** Where in the section the response is drawn from, said to the learner. */
  readonly drawnFrom: string
}

export const MCS_EXPLAIN_REFLECTIONS: readonly McsExplainReflection[] = Object.freeze([
  {
    sectionId: 'mcs-foundations-signals',
    workedResponse: [
      'An organ-level finding: mentation, urine output, skin perfusion and capillary refill, and the lactate trend over time.',
      'None of them is on the monitor. Pressure, the three flow lines and venous saturation each answered a different question; whether the circulation is adequate is answered at the bedside, over hours.',
    ],
    drawnFrom: 'This section’s organ-response level and its “what to do with it” line.',
  },
  {
    sectionId: 'mcs-foundations-mechanisms',
    workedResponse: [
      'Effective systemic flow would not have changed. It is native forward flow plus left-pump flow, less any regurgitant return, so an equal rise and fall cancel.',
      'The pump would carry more of the total while the native ventricle carried less. The ventricle is unloaded; the body receives the same flow.',
      'In the comparison you capture in this section the fall is smaller than the rise, so effective flow goes up, by less than the pump number. The arithmetic is printed under the comparison table on the Observe step.',
    ],
    drawnFrom: 'This section’s flow-level explanation and the captured three-device comparison.',
  },
  {
    sectionId: 'iabp-timing-triggering',
    workedResponse: [
      'Correct timing is a precondition, not an outcome. A taller diastolic peak is a finding at the pressure level.',
      'Next, what the trace cannot say: how much effective systemic flow moved, the filling pressures, and at the bedside mentation, urine output, skin perfusion and the lactate trend over the next hours.',
      'A balloon can be correctly timed and still not be enough. If output is still low, look for what limits it: the ventricle, the filling, the right heart.',
    ],
    drawnFrom: 'This section’s organ-response level and its “what to do with it” line.',
  },
  {
    sectionId: 'iabp-efficacy-limits',
    workedResponse: [
      'Lead with the limiting problem rather than the device: the balloon is timed correctly and its display has not changed, while effective flow and mean pressure are falling with a rising right atrial pressure and a falling pulmonary pulsatility ratio.',
      'That says the limitation has moved upstream of the left heart, and that more timing adjustment is not the answer.',
      'First get an echo and treat the right heart: an inotrope, a pulmonary vasodilator, right-sided support. Then call the shock team with the limiting problem named.',
    ],
    drawnFrom: 'This section’s explanation, what it shows, and its transfer patient.',
  },
  {
    sectionId: 'impella-unloading-placement',
    workedResponse: [
      'In the patient: filling and the pressure at the outlet — wedge pressure, ventricular size and mean arterial pressure.',
      'In the position: echo and the placement signal.',
      'In the device: the P-level has not changed, and the displayed flow is an estimate. Compare it with the mean flow expected at that P-level and with native and effective flow.',
      'Do not raise the P-level because the displayed flow fell. Find the cause first.',
    ],
    drawnFrom: 'This section’s chain from position to delivery and its flow note.',
  },
  {
    sectionId: 'impella-suction-purge-rv',
    workedResponse: [
      'Whether the left ventricle is filling and the left-sided suction pattern clears; what right atrial pressure does; what the effective systemic line does; and, at the bedside, perfusion over hours.',
      'Not the two pump numbers added together: they describe one stream measured twice.',
      'Use right atrial pressure and left-sided filling rather than the pulmonary pulsatility ratio, which barely moves in this simulator when right-sided support starts.',
    ],
    drawnFrom: 'This section’s explanation and its “what to do with it” line.',
  },
  {
    sectionId: 'lvad-parameters-assessment',
    workedResponse: [
      'Read it with the pulsatility index and the mean arterial pressure. Low flow with a low index is an underfilled ventricle: give volume, look for bleeding, get an echo. Low flow with a high index and a high mean pressure is afterload.',
      `If the blood pressure is the cause, lower mean arterial pressure to ${MCS_NUMBERS.value('lvad-map-goal')} with afterload reduction. Flow rises as the pressure falls. Do not raise the speed against it.`,
      'A rising cardiac power is a pressure multiplied by a flow, not proof that perfusion improved.',
    ],
    drawnFrom: 'This section’s controller tour and its transfer patient.',
  },
  {
    sectionId: 'lvad-alarms-emergencies',
    workedResponse: [
      'Keep power connected. Do not disconnect a power source to see whether an alarm clears.',
      'Send LDH and plasma free hemoglobin, and check the anticoagulation.',
      'Get an echo.',
      'Call the LVAD team and surgeon.',
      'The displayed flow is falsely high: it is calculated from power, and thrombus raises power. Believe the pulsatility index, the mean pressure and the patient.',
    ],
    drawnFrom: 'This section’s explanation and its transfer patient.',
  },
  {
    sectionId: 'mcs-device-selection-integration',
    workedResponse: [
      'A different filling-pressure picture: a right atrial pressure that sits well below the wedge pressure instead of rising to meet it, a pump that is not in suction, and an effective systemic flow that rises by about as much as the displayed pump flow when support is added.',
      'Then left-sided support would be the right mechanism, and the bedside would confirm it over the next hours.',
      'Here the right heart is the limit, so the first moves are to turn the P-level down out of suction, get an echo and treat the right ventricle.',
    ],
    drawnFrom: 'This section’s explanation and its “what to do with it” line.',
  },
])

const reflectionBySectionId = new Map(
  MCS_EXPLAIN_REFLECTIONS.map((reflection) => [reflection.sectionId, reflection]),
)

export function mcsExplainReflection(sectionId: string): McsExplainReflection {
  const reflection = reflectionBySectionId.get(sectionId)
  if (!reflection) throw new Error(`No Explain reflection for ${sectionId}`)
  return reflection
}

function validateReflections(): readonly string[] {
  const errors: string[] = []
  for (const lesson of mcsLessons) {
    const reflection = reflectionBySectionId.get(lesson.id)
    if (!reflection) {
      errors.push(`${lesson.id}: the Explain step has no worked response`)
      continue
    }
    if (reflection.workedResponse.length === 0)
      errors.push(`${lesson.id}: the worked response is empty`)
    if (reflection.workedResponse.some((line) => line.trim().length === 0))
      errors.push(`${lesson.id}: an empty line in the worked response`)
  }
  if (MCS_EXPLAIN_REFLECTIONS.length !== mcsLessons.length)
    errors.push('one Explain reflection per section, and no more')
  return errors
}

const reflectionErrors = validateReflections()
if (reflectionErrors.length > 0) {
  throw new Error(`Invalid MCS Explain reflections:\n- ${reflectionErrors.join('\n- ')}`)
}
