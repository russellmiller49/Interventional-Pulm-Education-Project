import { mcsLessons } from './lessons'

/**
 * A hint is a nudge about this item, not the instruction again (F11).
 *
 * The Hint button opened the "What do I do now?" dialog, which repeats the step's instruction word
 * for word — useful as navigation, useless as a hint. The two are now separate: Help in the header
 * still says what the step is and where it is worked, and Hint says where to look or which question
 * to ask yourself for this one item.
 *
 * A hint points at evidence already on the screen. It adds no clinical statement and names no
 * answer; the worked explanation is one button away for anyone who wants it.
 */

export type McsHintedStepKind = 'identify' | 'prediction' | 'action' | 'observe' | 'transfer'

export type McsSectionHints = Readonly<Record<McsHintedStepKind, string>> & {
  /** The control-panel sort, on the section that carries it. */
  readonly sort?: string
}

export const MCS_STEP_HINTS: Readonly<Record<string, McsSectionHints>> = Object.freeze({
  'mcs-foundations-signals': {
    identify:
      'Look at the unit. The arterial trace is in mm Hg, at one site. Which of the three answers is a statement about mm Hg at one site, and nothing more?',
    prediction:
      'Ask whether a balloon has an inlet and an outlet. If no blood enters or leaves it, on which of the three lines could its effect appear?',
    action:
      'There is nothing to turn here. Use the three Read buttons one after another and notice the unit each reading comes back in.',
    observe:
      'Compare the mm Hg rows with the L/min rows. Nothing was changed, so a small difference between the two columns is the model settling.',
    transfer:
      'Start from what changed: the trace looks damped after transport. What has to be true of the signal before its number can be used?',
  },
  'mcs-foundations-mechanisms': {
    identify:
      'Find the device letter on the Circulation map and follow the pale device line. Does it start in one chamber and end in another, or sit inside one vessel?',
    prediction:
      'Think pathway, not size. Which of the three has a source and a destination to report a flow along?',
    action:
      'Any order works. Each selection rebuilds the same reference patient, so the table fills one column at a time.',
    observe:
      'Work one pump column against the IABP column: how far did the pump row rise, and how far did the native row fall?',
    sort: 'Ask one question of each item: could you set it with your hand, does a screen report it, or does it move when the patient’s loading changes?',
    transfer:
      'The problem named is a distended, congested left ventricle. Which mechanism in the comparison takes blood out of that chamber?',
  },
  'iabp-timing-triggering': {
    identify:
      'Find N, the valve-closure reference, and I, where inflation starts, on the Timing reference. On the assisted beat, which comes first?',
    prediction:
      'Keep two claims apart: what correcting the timing does to the trace, and how much forward flow a balloon with no stream of its own can add.',
    action:
      'Use Inflation vs notch and watch I move toward N on the Timing reference. Deflation stays where it is.',
    observe:
      'Read the timing row and the L/min row separately. One says the events are aligned; the other says how far flow moved.',
    transfer:
      'With an irregular rhythm, judge each assisted beat on the trace itself, not from the synchrony figure.',
  },
  'iabp-efficacy-limits': {
    identify:
      'The question is about upstream of the left heart. Which of the readings on the trend belongs to the right side?',
    prediction:
      'Timing and delivery are two separate accounts. Which of them can a weaker right ventricle change?',
    action:
      'Lower RV contractility with the highlighted control and keep watching the trend, not the timing figure.',
    observe:
      'Set the timing row beside the flow and pressure rows. Which moved, and which did not move at all?',
    transfer:
      'Timing is already acceptable in this patient. Read right atrial pressure and the pulsatility ratio before choosing.',
  },
  'impella-unloading-placement': {
    identify:
      'Follow the pale device line on the map from inlet to outlet. The chamber it starts in is the one being relieved.',
    prediction:
      'The level is not changing; the position is. What can a pump draw if its inlet is no longer where the blood is?',
    action:
      'Set Placement state to Too deep. It is a simulated fault selector, not catheter movement.',
    observe:
      'Read displayed pump flow against LV volume and wedge pressure. If the pump removes less, what happens in the chamber behind it?',
    transfer:
      'Position is acceptable and the level is unchanged here. Look at what else changed — start with mean pressure.',
  },
  'impella-suction-purge-rv': {
    identify:
      'Trace the second device line on the map from the vena cava. Does it end before the lungs or after them?',
    prediction:
      'Two pumps in series handle the same blood one after the other. What was the left pump short of?',
    action:
      'Switch Right-sided support on, then trace the new pathway on the map before reading any number.',
    observe: 'Add the two pump rows yourself, then set your sum beside the effective systemic row.',
    transfer:
      'The alarm is suction and preload has just fallen. What is the inlet short of? Decide that before choosing a level.',
  },
  'lvad-parameters-assessment': {
    identify:
      'Go back to the controller tour and open the displayed pump flow. Which value does the controller measure, and which does it calculate?',
    prediction:
      'Speed is fixed. What does a higher pressure at the outlet do to the volume crossing the pump — and which row multiplies a pressure by a flow?',
    action: 'Raise SVR with the highlighted control. The pump speed control stays untouched.',
    observe:
      'Read mean pressure and effective flow in one glance, then find the single row that is a product of the two.',
    transfer:
      'Nothing was done to the pump. Look for what changed in the patient before reading the flow number.',
  },
  'lvad-alarms-emergencies': {
    identify:
      'Read the line under the alarm’s name. Does it give you a diagnosis, or a pattern you still have to explain?',
    prediction:
      'The controller measures power and calculates the displayed flow from it. If something other than flow raises power, what happens to the display?',
    action:
      'Switch the High-power / thrombosis pattern on and read power and displayed flow in the same glance.',
    observe: 'Compare how far the power row moved with how far the two flow rows moved.',
    transfer:
      'Two things have to hold at once: the power path stays connected, and someone with authority over the device is called.',
  },
  'mcs-device-selection-integration': {
    identify:
      'Set right atrial pressure beside the wedge pressure, and check whether the pump is already in suction.',
    prediction:
      'The pump is in suction at level five. What does a pump that is short of filling gain from three more levels?',
    action:
      'Raise the left-sided Performance level to at least eight, and read the filling pressures first.',
    observe:
      'Compare the change in displayed pump flow with the change in effective systemic delivery, then check right atrial pressure.',
    transfer:
      'Output is low in both patients. What differs is which filling pressure is moving — start there.',
  },
})

export function mcsStepHint(
  sectionId: string,
  kind: McsHintedStepKind | 'sort',
): string | undefined {
  return MCS_STEP_HINTS[sectionId]?.[kind]
}

function validateStepHints(): readonly string[] {
  const errors: string[] = []
  const kinds: readonly McsHintedStepKind[] = [
    'identify',
    'prediction',
    'action',
    'observe',
    'transfer',
  ]
  for (const lesson of mcsLessons) {
    const hints = MCS_STEP_HINTS[lesson.id]
    if (!hints) {
      errors.push(`${lesson.id}: no hints`)
      continue
    }
    for (const kind of kinds) {
      if (!hints[kind]?.trim()) errors.push(`${lesson.id}: no ${kind} hint`)
    }
  }
  const seen = new Set<string>()
  for (const hints of Object.values(MCS_STEP_HINTS)) {
    for (const hint of Object.values(hints)) {
      if (seen.has(hint)) errors.push(`a hint is used for two items: ${hint}`)
      seen.add(hint)
    }
  }
  return errors
}

const hintErrors = validateStepHints()
if (hintErrors.length > 0) {
  throw new Error(`Invalid MCS step hints:\n- ${hintErrors.join('\n- ')}`)
}
