/**
 * Where a live case's authored text claims something the model does not do (MV-PRE-REVIEW-02).
 *
 * Batch 02 made each case open at its authored presentation and move only when something the model
 * represents changes. That removed the drift that had been standing in for several authored
 * responses: MV-14's saturation used to "recover" after decompression only because it rose
 * identically without it. Where the case still *says* a response happens that the model has no
 * dependency for, the case says so where the claim is made, rather than a number silently
 * contradicting it. Each note names what is held and for whom; none is a clinical statement.
 *
 * Three places a learner meets such a claim, and each has its own statement here:
 *
 * - beside the case description (`casePresentationModelNote`), read against the live console;
 * - beside the authored expected response in the explanation (`caseResponseModelNote`);
 * - on the action path itself — the feedback printed the moment the action is taken
 *   (`interventionSimulatedResponse`, composed into the case's intervention in `runtimeCases`) and
 *   the coaching card written once its response has been observed (`faultOxygenationBoundary`).
 *   The first repair put the boundary only in the optional explanation, so MV-14's decompression
 *   still announced "Compliance, oxygenation, and blood pressure improve abruptly but temporarily"
 *   over a saturation that went from 76 to 76 and an improvement the model never lets fade.
 */
import type {
  InterventionEffectId,
  VentilationCaseDefinition,
  VentilationSimulationState,
} from '../engine/types'

function cmH2O(value: number, digits = 0): string {
  return `${value.toFixed(digits)} cmH₂O`
}

/**
 * MV-13's alarm, stated against the console as it is now (C3, owner decision D4).
 *
 * The stem says the patient "develops a sudden high-pressure alarm after a turn"; the case is
 * constructed with a 60 cmH₂O limit, and the peak the model produces for every branch sits near 43,
 * so the case opens without one. Lowering the default to make it sound would sound it over a breath
 * the simulator delivers in full — it does not model what a ventilator does to a breath at its
 * pressure limit — so the limit is left alone and the mismatch is stated.
 *
 * The first version interpolated the *current* limit into a sentence that always went on to say the
 * limit was above the peak and no alarm was active. A learner who set the limit to 40 then read
 * "the high-pressure limit at 40 cmH₂O — above the peak this patient is now generating — so the
 * console shows no active high-pressure alarm" directly beside a console sounding "High pressure".
 * Now the note has two parts that cannot be confused: what the case opened with (fixed, and said to
 * be the opening), and what the console is doing now, read from the same limit, peak and alarm list
 * the console itself shows. Alarms are re-evaluated only when the simulation runs, so a limit
 * changed while paused is described as what the console will do next, never as what it is doing.
 */
function mv13AlarmNote(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
): string {
  const openingLimit = definition.initialSettings.highPressureLimitCmH2O
  const limit = state.ventilator.settings.highPressureLimitCmH2O
  const peak = state.measurements.peakPressureCmH2O
  const showing = (code: string) =>
    state.alarms.some((alarm) => alarm.code === code && alarm.active)
  const reached = peak >= limit
  const entry = `The alarm in this description is what prompted the call. The simulation opens after that event, with the high-pressure limit at ${cmH2O(openingLimit)} — above the peak this patient generates — so the case opens without an active high-pressure alarm.`
  let now: string
  if (showing('HIGH_PRESSURE')) {
    now = reached
      ? `Now the limit is ${cmH2O(limit)} and the peak, ${cmH2O(peak, 1)}, has reached it, so the console’s high-pressure alarm is active.`
      : `The console’s high-pressure alarm is still showing from the last breath the simulation evaluated; with the limit now at ${cmH2O(limit)}, above the peak of ${cmH2O(peak, 1)}, it clears when the simulation next runs.`
  } else if (reached) {
    now = `The limit is now ${cmH2O(limit)}, at or below the peak of ${cmH2O(peak, 1)}, so the console raises its high-pressure alarm when the simulation next runs.`
  } else if (limit !== openingLimit || showing('PRESSURE_LIMITATION')) {
    now = `Now the limit is ${cmH2O(limit)}, still above the peak of ${cmH2O(peak, 1)}, so no high-pressure alarm is active${
      showing('PRESSURE_LIMITATION')
        ? '; the peak is close enough to it that the console shows its pressure-limitation alert'
        : ''
    }.`
  } else {
    now = ''
  }
  const boundary =
    'The simulator does not model what a ventilator does to a breath that reaches its pressure limit — the breath is still delivered in full — so whether this case should open with the alarm sounding is held for RT and device review.'
  return [entry, now, boundary].filter(Boolean).join(' ')
}

/** Beside the case description, read against the live console. */
export function casePresentationModelNote(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
): string | null {
  if (state.caseId === 'MV-13') return mv13AlarmNote(state, definition)
  return null
}

/** Beside the authored expected response in the case explanation. */
export function caseResponseModelNote(caseId: string): string | null {
  switch (caseId) {
    case 'MV-06':
      return 'In this simulation, releasing trapped gas lowers the trapped pressure at once, but the blood pressure stays at the obstructive-shock ceiling until the case’s full treatment has taken effect; the prompt rise the case describes after disconnection is not represented and is held for faculty review.'
    case 'MV-12':
      return 'In this simulation the patient’s breathing drive does not respond to carbon dioxide. Lowering support reduces delivered ventilation and lets PaCO₂ rise; lightening sedation adds breaths, which moves it the other way. How the two should combine is held for faculty review.'
    case 'MV-13':
      return 'In this simulation the saturation is not linked to the airway obstruction: treating the cause that is present lowers the peak pressure the same breath needs, but SpO₂ stays where the case opened. The casebook expects oxygenation to recover once the obstruction is relieved; how far and how fast is held for faculty review.'
    case 'MV-14':
      return 'In this simulation the saturation is not linked to the pneumothorax: decompression restores compliance and blood pressure, but the saturation stays where it opened. The improvement the decompression produces also does not fade — the model has no decay for it — so the temporary relief the case describes before definitive drainage is not shown. How far oxygenation should recover, and how fast, is held for faculty review.'
    default:
      return null
  }
}

/* ------------------------------------------------------------------------------------------------
 * The action path
 * ---------------------------------------------------------------------------------------------- */

/**
 * What the simulation shows after an action, where the action's authored response claims more.
 *
 * Composed into the case's own intervention (`runtimeCases`), after the authored text, so the
 * feedback printed the moment the action is taken — and anywhere that feedback is repeated — keeps
 * the clinical expectation and says, in the same place, what the model does instead. Keyed by case
 * as well as action, because the model boundary is the case's: SpO₂ is not linked to MV-14's
 * pneumothorax, which says nothing about a decompression anywhere else.
 */
const simulatedResponses: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'MV-14': {
    'decompress-pneumothorax':
      'In this simulation compliance and blood pressure improve once the decompression takes effect, and the improvement does not fade — the model has no decay for it. SpO₂ is not linked to the pneumothorax here, so it does not change. How far and for how long oxygenation should respond is held for faculty review.',
    'pleural-drainage':
      'In this simulation the improvement after decompression does not fade whether or not drainage is placed; drainage adds a further gain in compliance. SpO₂ is not linked to the pneumothorax here, so it does not change.',
  },
}

export function interventionSimulatedResponse(
  caseId: string,
  interventionId: string,
): string | null {
  return simulatedResponses[caseId]?.[interventionId] ?? null
}

/** The authored response, with what the simulation actually shows after it. */
export function composeInterventionResponse(
  authoredResponse: string,
  simulatedResponse: string | null,
): string {
  return simulatedResponse
    ? `Clinically expected: ${authoredResponse} ${simulatedResponse}`
    : authoredResponse
}

/** The treatments whose response is read against an oxygenation the model does not link to them. */
const faultTreatments: Readonly<Record<string, readonly InterventionEffectId[]>> = {
  'MV-13': ['suction-airway', 'remove-hme', 'reposition-ett', 'bronchodilator'],
  'MV-14': ['decompress-pneumothorax', 'pleural-drainage'],
}

const faultNames: Readonly<Record<string, string>> = {
  'MV-13': 'the airway obstruction',
  'MV-14': 'the pneumothorax',
}

/** The part of a coaching reading this needs; structural, so the coaching module owns the type. */
interface ObservedReading {
  readonly id: string
  readonly inlineLabel: string
  readonly before: number | null
  readonly direction: 'rose' | 'fell' | 'held' | 'small-drift'
  readonly favourable: boolean | null
}

/**
 * The coaching card's model statement for a fault treatment, derived from what the card observed.
 *
 * It says exactly what happened on the card — which readings moved toward better, and what SpO₂ did
 * — and then what the model does not represent. It never says oxygenation improved when the
 * saturation did not move, and it does not credit the action with a saturation that moved for some
 * other reason (a change of FiO₂ during the interval is the obvious one); in both cases the reason is
 * the same: the model has no link from this fault to oxygenation (owner decisions D1/D2).
 */
export function faultOxygenationBoundary(
  caseId: string,
  effectId: InterventionEffectId | null,
  readings: readonly ObservedReading[],
): string | null {
  if (!effectId || !faultTreatments[caseId]?.includes(effectId)) return null
  const fault = faultNames[caseId]
  const spo2 = readings.find((reading) => reading.id === 'spo2')
  const improved = readings
    .filter(
      (reading) =>
        reading.id !== 'spo2' &&
        reading.before !== null &&
        reading.favourable === true &&
        (reading.direction === 'rose' || reading.direction === 'fell'),
    )
    .map((reading) => reading.inlineLabel)
  const improvedList =
    improved.length > 1
      ? `${improved.slice(0, -1).join(', ')} and ${improved.at(-1)}`
      : (improved[0] ?? '')
  const improvedClause = improvedList
    ? `${improvedList.charAt(0).toUpperCase()}${improvedList.slice(1)} moved toward better over this interval`
    : 'None of the other readings moved toward better over this interval'
  const saturationMoved =
    spo2 && spo2.before !== null && (spo2.direction === 'rose' || spo2.direction === 'fell')
  const saturationClause = saturationMoved
    ? `SpO₂ ${spo2.direction}, but not because of this action: in this simulation oxygenation is not linked to ${fault}, so something else moved it.`
    : `SpO₂ did not change. In this simulation oxygenation is not linked to ${fault}, so an unchanged saturation is neither evidence against this action nor a modeled outcome of it.`
  return `${improvedClause}; ${saturationClause} How far and how fast oxygenation should recover once ${fault} is treated is held for faculty review.`
}
