import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import type { VentilatorControlKey } from '../engine/types'

/**
 * The small control panel: the five things a learner can change on this ventilator.
 *
 * A console reads as fifty things that might need action. Collapsing agency to five knobs turns
 * every later alarm from "what do I touch?" into "which knob, if any?" — and "if any" is itself a
 * teachable answer, because many findings are causes no knob fixes. Three more settings shape the
 * breath and are met at their stop on the spine; everything else on the screen is monitoring.
 *
 * Two axes, named once here and reused on every gas-exchange debrief: oxygenation (oxygen and
 * PEEP) and ventilation (rate and the size of the breath). Every Explain step quotes the panel as a
 * strip with each knob in one of three states: this is the knob, not this knob, or no knob.
 *
 * Authored teaching construct. Device labels vary; the console's own label for each setting comes
 * from its device profile, not from here.
 */

export type VentilationKnobId = 'mode' | 'breath-size' | 'rate' | 'peep' | 'oxygen'

export type VentilationShapingId = 'flow-or-time' | 'trigger' | 'cycle-off' | 'rise'

export type VentilationControlAxis = 'oxygenation' | 'ventilation' | 'delivery'

export interface VentilationKnob {
  readonly id: VentilationKnobId
  readonly plainName: string
  /** What the console calls it, in the generic words the device profiles map onto their own. */
  readonly consoleLabel: string
  readonly axis: VentilationControlAxis
  /** The engine settings this knob is, by mode where they differ. */
  readonly controlKeys: readonly VentilatorControlKey[]
  /** What to check after changing it. */
  readonly principallyMoves: string
  /** The thing a learner expects it to move and it does not. */
  readonly doesNotMove: string
}

export interface VentilationShapingSetting {
  readonly id: VentilationShapingId
  readonly plainName: string
  readonly consoleLabel: string
  readonly controlKeys: readonly VentilatorControlKey[]
  /** The stop on the breath where the setting is met. */
  readonly stopId: 'trigger' | 'inspiration' | 'cycling'
}

export interface VentilationControlPanel {
  readonly sentence: string
  readonly knobs: readonly VentilationKnob[]
  readonly shaping: readonly VentilationShapingSetting[]
  readonly axes: Readonly<Record<VentilationControlAxis, string>>
  readonly monitoringSentence: string
}

export const VENTILATION_CONTROL_PANEL: VentilationControlPanel = {
  sentence:
    'You can change five things on this ventilator: the mode, the size of the breath, the rate, the PEEP, and the oxygen.',
  knobs: [
    {
      id: 'mode',
      plainName: 'the mode — what the breath holds constant',
      consoleLabel: 'Mode',
      axis: 'delivery',
      controlKeys: [],
      principallyMoves:
        'Which variable is fixed and which one you must watch: volume held with pressure free, or pressure held with volume free.',
      doesNotMove: 'The lung. A mode changes the promise the machine makes, not the load it meets.',
    },
    {
      id: 'breath-size',
      plainName: 'the size of the breath — a volume, or a pressure',
      consoleLabel: 'Tidal volume, or inspiratory pressure / pressure support',
      axis: 'ventilation',
      controlKeys: ['vtMl', 'deltaPControlCmH2O', 'pressureSupportCmH2O'],
      principallyMoves:
        'The delivered volume and the pressure it costs, and with the rate, the minute ventilation.',
      doesNotMove: 'Oxygenation, except slowly and indirectly.',
    },
    {
      id: 'rate',
      plainName: 'the rate — how often a breath is started for the patient',
      consoleLabel: 'Rate',
      axis: 'ventilation',
      controlKeys: ['ratePerMin'],
      principallyMoves: 'Minute ventilation, and the time left for each expiration.',
      doesNotMove:
        'Oxygenation, and not the total rate when the patient is triggering above the set rate.',
    },
    {
      id: 'peep',
      plainName: 'the PEEP — the pressure the breath rests at between pushes',
      consoleLabel: 'PEEP',
      axis: 'oxygenation',
      controlKeys: ['peepCmH2O'],
      principallyMoves:
        'The baseline every pressure is read from, the aerated lung at end-expiration, and often the circulation.',
      doesNotMove: 'Carbon dioxide clearance, in the direct way rate and breath size do.',
    },
    {
      id: 'oxygen',
      plainName: 'the oxygen — the fraction of oxygen in the gas delivered',
      consoleLabel: 'Oxygen (FiO₂)',
      axis: 'oxygenation',
      controlKeys: ['oxygenPercent'],
      principallyMoves: 'The oxygen saturation, over the next minutes.',
      doesNotMove: 'Carbon dioxide, the pressure trace, or the delivered volume.',
    },
  ],
  shaping: [
    {
      id: 'flow-or-time',
      plainName: 'how fast the push arrives',
      consoleLabel: 'Inspiratory flow, or inspiratory time',
      controlKeys: ['peakFlowLMin', 'inspiratoryTimeSeconds'],
      stopId: 'inspiration',
    },
    {
      id: 'trigger',
      plainName: 'how small an effort starts a breath',
      consoleLabel: 'Trigger sensitivity',
      controlKeys: ['triggerThreshold'],
      stopId: 'trigger',
    },
    {
      id: 'cycle-off',
      plainName: 'when a supported breath ends',
      consoleLabel: 'Cycle-off (expiratory trigger sensitivity)',
      controlKeys: ['etsPercent'],
      stopId: 'cycling',
    },
    {
      id: 'rise',
      plainName: 'how quickly the pressure reaches its target',
      consoleLabel: 'Rise time (pressure ramp)',
      controlKeys: ['pRampMs'],
      stopId: 'inspiration',
    },
  ],
  axes: {
    oxygenation: 'Oxygenation: the oxygen and the PEEP.',
    ventilation: 'Ventilation: the rate and the size of the breath.',
    delivery: 'Delivery: the mode decides what the breath holds constant.',
  },
  monitoringSentence:
    'Everything else on the screen is monitoring: it tells you what the patient received and how they took it.',
}

export const ventilationKnobById: ReadonlyMap<VentilationKnobId, VentilationKnob> = new Map(
  VENTILATION_CONTROL_PANEL.knobs.map((knob) => [knob.id, knob]),
)

export function ventilationKnob(id: VentilationKnobId): VentilationKnob {
  const knob = ventilationKnobById.get(id)
  if (!knob) throw new Error(`Unknown ventilation knob: ${id}`)
  return knob
}

/** The knob or shaping setting an engine control belongs to, for the strip and the spotlight. */
export function ventilationControlOwner(
  key: VentilatorControlKey,
):
  | { readonly kind: 'knob'; readonly id: VentilationKnobId }
  | { readonly kind: 'shaping'; readonly id: VentilationShapingId }
  | null {
  const knob = VENTILATION_CONTROL_PANEL.knobs.find((item) => item.controlKeys.includes(key))
  if (knob) return { kind: 'knob', id: knob.id }
  const shaping = VENTILATION_CONTROL_PANEL.shaping.find((item) => item.controlKeys.includes(key))
  if (shaping) return { kind: 'shaping', id: shaping.id }
  return null
}

/**
 * Copy faults in the panel: a number in learner copy, a banned term, a knob with no axis
 * sentence, or a shaping setting at a stop that does not exist. Thrown at import so a partial edit
 * fails the build rather than the learner.
 */
export function ventilationControlPanelErrors(panel: VentilationControlPanel): readonly string[] {
  const errors: string[] = []
  const copy = [
    panel.sentence,
    panel.monitoringSentence,
    ...Object.values(panel.axes),
    ...panel.knobs.flatMap((knob) => [knob.plainName, knob.principallyMoves, knob.doesNotMove]),
    ...panel.shaping.map((setting) => setting.plainName),
  ]
  for (const line of copy) {
    if (/\d/.test(line)) errors.push(`Number in learner copy: "${line}"`)
    const flagged = flaggedLearnerCopyTerms(line)
    if (flagged.length > 0) errors.push(`Banned term ${flagged.join(', ')} in "${line}"`)
  }
  if (panel.knobs.length !== 5)
    errors.push(`The panel names ${panel.knobs.length} knobs; the sentence says five.`)
  const ids = new Set(panel.knobs.map((knob) => knob.id))
  if (ids.size !== panel.knobs.length) errors.push('Duplicate knob id.')
  for (const knob of panel.knobs) {
    if (!panel.axes[knob.axis]) errors.push(`Knob ${knob.id} has no axis sentence.`)
  }
  return errors
}

{
  const errors = ventilationControlPanelErrors(VENTILATION_CONTROL_PANEL)
  if (errors.length > 0) {
    throw new Error(`Ventilation control panel is not valid:\n${errors.join('\n')}`)
  }
}
