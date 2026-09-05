import type { VentilationLearningUnit } from './learningCurriculum'

/**
 * The spine: one breath, four stops.
 *
 * Every term, signal and control in this module is introduced at its place on one breath — the
 * trigger that starts it, the inspiration that pushes gas in, the cycling that switches to
 * expiration, and the expiration that empties back to the baseline. The stops are walked once on
 * the normal running breath (section 2) and lit on every later section, so a later fault is taught
 * as a *location* on a shape the learner already holds rather than as a name in a list.
 *
 * Plain name first, then the word the console and the curriculum use; after this file the module
 * uses the console word. The analogies are one per stop and are never mixed. The checklists are the
 * bedside residue — the thing later sections reference — and are held to four items each.
 *
 * Authored teaching construct. Nothing here is a threshold or a target.
 */

export type BreathStopId = 'trigger' | 'inspiration' | 'cycling' | 'expiration'

export const breathStopIds: readonly BreathStopId[] = [
  'trigger',
  'inspiration',
  'cycling',
  'expiration',
]

export interface BreathStop {
  readonly id: BreathStopId
  /** One-based position along the breath. */
  readonly ordinal: number
  /** "Trigger — the start". */
  readonly title: string
  readonly plainName: string
  /** The console word, and the settings that live at this stop. */
  readonly consoleLabel: string
  readonly analogy: string
  /** What the learner looks at on each trace when standing here. */
  readonly look: { readonly pressure: string; readonly flow: string; readonly volume: string }
  readonly checklist: readonly string[]
  /** One thing to try on the running breath while standing here, and what to watch. */
  readonly wiggle: { readonly change: string; readonly watch: string }
}

export const breathStops: readonly BreathStop[] = [
  {
    id: 'trigger',
    ordinal: 1,
    title: 'Trigger — the start',
    plainName: 'the start of the breath',
    consoleLabel:
      'Trigger sensitivity, and the set rate that starts a breath when the patient does not',
    analogy:
      'A doorbell. Either the patient rings it with an effort, or the timer rings it when nobody has.',
    look: {
      pressure:
        'Just before the pressure rises: a small dip means the patient asked; no dip means the timer did.',
      flow: 'Flow leaves zero and turns positive. This is the moment the machine starts pushing.',
      volume: 'Volume is still at its lowest point — nothing has entered yet.',
    },
    checklist: [
      'Who started this breath: the patient or the timer?',
      'Did every effort start a breath?',
      'Did any breath start with no effort?',
    ],
    wiggle: {
      change: 'Watch two breaths arrive at the set rate, then step one breath at a time.',
      watch: 'The flow trace leaving zero is the start of every breath.',
    },
  },
  {
    id: 'inspiration',
    ordinal: 2,
    title: 'Inspiration — the push',
    plainName: 'gas being pushed in',
    consoleLabel:
      'Tidal volume or inspiratory pressure, flow or inspiratory time; the peak pressure is read here',
    analogy:
      'Filling a balloon through a straw. How fast you push, how much you push, and what it costs in pressure are three different things.',
    look: {
      pressure:
        'The push. A quick rise while gas starts to move, then a climb as the lung fills; the top is the peak.',
      flow: 'Positive the whole way. In a volume breath it is a flat shelf; in a pressure breath it falls as the lung fills.',
      volume: 'Climbing. Flow is how fast; volume is how much has arrived so far.',
    },
    checklist: [
      'How fast is gas moving? (flow)',
      'How much has arrived? (volume)',
      'What did it cost? (pressure)',
    ],
    wiggle: {
      change: 'Change the inspiratory flow and keep the volume.',
      watch: 'The same volume arrives sooner and the inspiration is shorter.',
    },
  },
  {
    id: 'cycling',
    ordinal: 3,
    title: 'Cycling — the switch',
    plainName: 'the switch from inspiration to expiration',
    consoleLabel:
      'Inspiratory time, or the cycle-off setting on a supported breath; the machine stops pushing here',
    analogy:
      'Letting go of the pump handle. Something has to decide when — the clock, the flow, or the patient.',
    look: {
      pressure: 'The pressure falls away from its peak the moment the push stops.',
      flow: 'Flow crosses zero and turns negative. This is the switch.',
      volume: 'Volume is at its top and starts to fall.',
    },
    checklist: [
      'What ended the push: time, flow, or the patient?',
      'Did the patient agree with the moment it ended?',
    ],
    wiggle: {
      change: 'Watch the flow trace cross zero at the end of each push.',
      watch: 'Pressure and volume both turn over at the same instant.',
    },
  },
  {
    id: 'expiration',
    ordinal: 4,
    title: 'Expiration — emptying to baseline',
    plainName: 'gas leaving, back to the baseline',
    consoleLabel: 'PEEP is the baseline; expiratory flow is read here',
    analogy:
      'The balloon emptying through the same straw. It empties fast at first, then slower, and it needs enough time to finish.',
    look: {
      pressure: 'Falls to the baseline and rests there. The baseline is the set PEEP.',
      flow: 'Negative, largest at first, then shrinking toward zero. Whether it reaches zero before the next start is the question.',
      volume: 'Falls toward where it began.',
    },
    checklist: [
      'Did expiratory flow reach zero before the next breath started?',
      'Where does the baseline sit? (PEEP)',
      'How long did emptying take compared with the time available?',
    ],
    wiggle: {
      change: 'Pause during expiration and look at the flow trace.',
      watch: 'Outward flow is below zero and the volume trace is falling.',
    },
  },
]

export const breathStopById: ReadonlyMap<BreathStopId, BreathStop> = new Map(
  breathStops.map((stop) => [stop.id, stop]),
)

export function breathStop(id: BreathStopId): BreathStop {
  const stop = breathStopById.get(id)
  if (!stop) throw new Error(`Unknown breath stop: ${id}`)
  return stop
}

/**
 * Where a curriculum unit stands on the breath.
 *
 * The curriculum authors `spine` as `whole | trigger | delivery | cycle | expiration`; this maps
 * it onto the stops. `whole` lights no single stop — the walk, the systematic read and the
 * integration sections stand at the whole breath.
 */
export function breathStopForUnit(
  unit: Pick<VentilationLearningUnit, 'spine'>,
): BreathStopId | null {
  switch (unit.spine) {
    case 'trigger':
      return 'trigger'
    case 'delivery':
      return 'inspiration'
    case 'cycle':
      return 'cycling'
    case 'expiration':
      return 'expiration'
    default:
      return null
  }
}

/* ------------------------------------------------------------------------------------------------
 * The breath map's geometry — one idealized passive volume-controlled breath
 * ---------------------------------------------------------------------------------------------- */

/** Normalized time bounds of each stop along one cycle, 0..1. */
export const breathMapSegments: Readonly<
  Record<BreathStopId, { readonly from: number; readonly to: number }>
> = {
  trigger: { from: 0, to: 0.06 },
  inspiration: { from: 0.06, to: 0.36 },
  cycling: { from: 0.36, to: 0.42 },
  expiration: { from: 0.42, to: 1 },
}

/**
 * The three schematic traces at normalized time `t` (0..1), each in 0..1 of its own row.
 *
 * A teaching schematic, not a sample of the engine: a square-flow volume breath into a passive
 * single-compartment system, with a resistive step at the start of inspiration, an elastic climb to
 * the peak, and an exponential emptying. Flow is centred at 0.5 (zero) with positive up.
 */
export function breathMapTrace(t: number): {
  readonly pressure: number
  readonly flow: number
  readonly volume: number
} {
  const tInspStart = breathMapSegments.inspiration.from
  const tInspEnd = breathMapSegments.inspiration.to
  const tExpStart = breathMapSegments.cycling.to
  const baseline = 0.18
  if (t < tInspStart) {
    return { pressure: baseline, flow: 0.5, volume: 0 }
  }
  if (t < tInspEnd) {
    const fraction = (t - tInspStart) / (tInspEnd - tInspStart)
    // Resistive step, then the elastic climb.
    const pressure = baseline + 0.22 + 0.5 * fraction
    return { pressure, flow: 0.92, volume: fraction }
  }
  if (t < tExpStart) {
    const fraction = (t - tInspEnd) / (tExpStart - tInspEnd)
    // The switch: flow reverses through zero, pressure lets go of its resistive part first.
    return {
      pressure: baseline + 0.72 - 0.25 * fraction,
      flow: 0.92 - 1.35 * fraction,
      volume: 1 - 0.05 * fraction,
    }
  }
  const elapsed = (t - tExpStart) / (1 - tExpStart)
  const decay = Math.exp(-4.2 * elapsed)
  return {
    pressure: baseline + 0.47 * decay,
    flow: 0.5 - 0.43 * decay,
    volume: 0.95 * decay,
  }
}
