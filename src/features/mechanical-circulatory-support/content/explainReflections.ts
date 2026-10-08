import { mcsLessons } from './lessons'

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

export const MCS_REFLECTION_REVIEW_STATUS = 'Draft teaching copy · not yet clinically reviewed'

export const MCS_EXPLAIN_REFLECTIONS: readonly McsExplainReflection[] = Object.freeze([
  {
    sectionId: 'mcs-foundations-signals',
    workedResponse: [
      'An organ-level finding: mentation, urine output, skin perfusion and capillary refill, and the lactate trend over time.',
      'None of them is on this monitor, and this simulation does not model them. The pressure, the three flow lines and the venous saturation each answered a different question; whether the circulation is adequate is answered at the bedside, and over hours rather than seconds.',
    ],
    drawnFrom: 'This section’s organ-response level and its "does not establish" statement.',
  },
  {
    sectionId: 'mcs-foundations-mechanisms',
    workedResponse: [
      'Effective systemic flow would not have changed. In this model, effective systemic flow is the concurrent native forward flow plus the left-pump flow, less any represented regurgitant recirculation, so an equal rise and fall cancel.',
      'The pump would carry more of the total while the native forward contribution fell. That arithmetic alone does not establish ventricular size, pulse pressure or unloading; those require their own modeled readings.',
      'In the comparison you can capture in this section the fall is smaller than the rise, which is why effective flow goes up — by less than the pump number. The arithmetic is printed under the comparison table on the Observe step.',
    ],
    drawnFrom: 'This section’s flow-level explanation and the captured three-device comparison.',
  },
  {
    sectionId: 'iabp-timing-triggering',
    workedResponse: [
      'Correct timing is a precondition, not an outcome. A taller diastolic peak is a finding at the pressure level.',
      'Next come the things the trace cannot say: how much effective systemic flow actually moved, the filling pressures, which this model represents, plus bedside mentation, urine output, skin perfusion and the lactate trend over the next hours, which it does not represent.',
      'A balloon can be correctly timed and still not be enough; this section does not establish that it is sufficient for this patient.',
    ],
    drawnFrom: 'This section’s organ-response level and its "does not establish" statement.',
  },
  {
    sectionId: 'iabp-efficacy-limits',
    workedResponse: [
      'Lead with the limiting problem rather than the device: the balloon is timed correctly and its display has not changed, while effective flow and mean pressure are falling with a rising right atrial pressure and a falling pulmonary pulsatility ratio.',
      'That says the limitation has moved upstream of the left heart, and that more timing adjustment is not the answer.',
      'Which mechanism should replace or join this one is not established here; that belongs to the responsible team.',
    ],
    drawnFrom: 'This section’s explanation, what it establishes, and its transfer patient.',
  },
  {
    sectionId: 'impella-unloading-placement',
    workedResponse: [
      'In the patient: filling and the pressure at the outlet — wedge pressure, ventricular size and mean arterial pressure.',
      'In the position: imaging and the placement signal. This section’s placement state is a teaching selector; it does not establish where an inlet actually is.',
      'In the device: the performance level has not changed, and the displayed flow is an estimate — compare it with native and effective flow rather than reading it alone.',
      'Raising the level because the displayed flow fell is the misreading this section names.',
    ],
    drawnFrom:
      'This section’s "establishes" and "does not establish" statements and its flow note.',
  },
  {
    sectionId: 'impella-suction-purge-rv',
    workedResponse: [
      'Whether the left ventricle is filling and the left-sided suction pattern clears; what right atrial pressure does; what the effective systemic line does; and, at the bedside, perfusion over hours.',
      'Not the two pump numbers added together: they describe one stream measured twice.',
      'And not the pulmonary pulsatility ratio on its own. In this model it barely moves with right-sided support and must not be used alone to judge it.',
    ],
    drawnFrom: 'This section’s explanation and its "does not establish" statement.',
  },
  {
    sectionId: 'lvad-parameters-assessment',
    workedResponse: [
      'What the pump is ejecting against and what is filling it: mean arterial pressure and systemic resistance, the filling pressures, and echocardiography including aortic-valve opening — together with bedside perfusion.',
      'The displayed flow is an estimate whose value depends on loading, so it is read beside those, not instead of them. A rising cardiac power is a pressure multiplied by a flow, not proof that perfusion improved.',
      'What to do about it is not established here: blood-pressure management and any speed change belong to the prescribing team.',
    ],
    drawnFrom: 'This section’s controller tour, its transfer patient and its limits.',
  },
  {
    sectionId: 'lvad-alarms-emergencies',
    workedResponse: [
      'Preserve the verified power path. Do not disconnect a power source to see whether an alarm clears.',
      'Examine the patient’s perfusion at the bedside, the power sources and the controller trend; focused imaging is part of what the responsible team reconciles.',
      'Call the mechanical-support team now rather than waiting for the numbers to move.',
      'This is not a diagnosis and not a troubleshooting instruction. The unchanged flow display is this generic model’s behaviour: on a HeartMate 3 the displayed flow is calculated from speed, power and hematocrit, and what that controller would show is not reproduced here.',
    ],
    drawnFrom: 'This section’s organ-response level, its transfer patient and its model limit.',
  },
  {
    sectionId: 'mcs-device-selection-integration',
    workedResponse: [
      'A different filling-pressure picture: a right atrial pressure that sits well below the wedge pressure instead of rising to meet it, a pump that is not in suction, and an effective systemic flow that rises by about as much as the displayed pump flow when support is added.',
      'That would show a larger modeled gain in effective flow; it would not establish adequate bedside perfusion or a calibrated diagnosis from filling pressures.',
      'Not the pulmonary pulsatility ratio alone: in this model it moves only weakly with right-sided support. And naming the limiting side is not choosing a device — that stays a team decision.',
    ],
    drawnFrom: 'This section’s explanation and its "does not establish" statement.',
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
