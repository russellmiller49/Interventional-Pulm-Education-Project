import { mcsLearnerCopyErrors, mcsSourceIdsRegistered } from './learnerCopy'

/**
 * The spine: one circulation, five stops.
 *
 * Every device in this module is drawn on the same loop — venous return, the right heart, the
 * lung, the left ventricle, the aortic valve, the aorta and the body — and every reading and
 * every control is introduced at its place on it. The circulation map in the simulator pane draws
 * the loop with the selected pathway on it and lights the stop a section is standing at; a
 * question about a place is answered by choosing a place on it.
 *
 * Authored here and drawn in `components/circulation-map/`. The segment ids are the contract
 * between the two: every segment a stop names must have a path on the drawing, which
 * `circulation-map.test.tsx` holds.
 */

export const mcsMapSegmentIds = [
  'venous-return',
  'right-atrium',
  'right-ventricle',
  'pulmonary-artery',
  'lungs',
  'left-atrium',
  'left-ventricle',
  'aortic-valve',
  'ascending-aorta',
  'descending-aorta',
  'systemic-bed',
] as const

export type McsMapSegmentId = (typeof mcsMapSegmentIds)[number]

/** The four simulated pathways the map can draw over the loop. */
export const mcsMapPathwayIds = ['iabp-balloon', 'left-pump', 'right-pump', 'durable-pump'] as const

export type McsMapPathwayId = (typeof mcsMapPathwayIds)[number]

export const mcsSpineStopIds = [
  'venous-return',
  'right-heart',
  'left-ventricle',
  'aortic-valve',
  'aorta-and-body',
] as const

export type McsSpineStopId = (typeof mcsSpineStopIds)[number]

export interface McsSpineStop {
  readonly id: McsSpineStopId
  /** One-based position along the blood path. */
  readonly ordinal: number
  readonly plainName: string
  /** Where on the loop the learner is standing, in one sentence. */
  readonly whereYouAre: string
  /** What a device does at this place — draws from it, returns to it, sits in it, ejects against it. */
  readonly whatADeviceDoesHere: string
  /** One concrete image. One per stop, never two. */
  readonly analogy: string
  /** At most four things to check at this place. The checklist, not the analogy, is what later sections quote. */
  readonly checklist: readonly string[]
  /** The monitor readings that belong to this place. */
  readonly lookAt: readonly string[]
  readonly segmentIds: readonly McsMapSegmentId[]
}

export interface McsSupportSpine {
  readonly stops: readonly McsSpineStop[]
  /** The one sentence the walk opens with. */
  readonly sentence: string
  readonly sourceIds: readonly string[]
}

export const MCS_SUPPORT_SPINE = {
  sentence:
    'Every device in this module is read on the same loop: blood returns to the right heart, crosses the lung, fills the left ventricle, leaves through the aortic valve, and is pushed through the body and back. Each device is drawn on that loop, and every reading has a place on it.',
  stops: [
    {
      id: 'venous-return',
      ordinal: 1,
      plainName: 'Venous return and the right atrium',
      whereYouAre:
        'You are at the beginning of the loop, where blood from the body arrives in the right atrium.',
      whatADeviceDoesHere:
        'Nothing downstream can move blood that has not arrived here. A right-sided pump takes its blood from this place; every other pump depends on it without touching it.',
      analogy:
        'The reservoir. A pump can only move what has already collected in front of it, however hard it is asked to work.',
      checklist: ['the right atrial pressure', 'the volume state', 'anything obstructing return'],
      lookAt: ['right atrial pressure', 'the filling-pressure pair'],
      segmentIds: ['venous-return', 'right-atrium'],
    },
    {
      id: 'right-heart',
      ordinal: 2,
      plainName: 'The right ventricle and the lung',
      whereYouAre:
        'You are at the right ventricle, which pushes blood through the lung to the left heart.',
      whatADeviceDoesHere:
        'Every left-sided device inherits this ventricle: the left heart can only be filled with what the right heart delivers across the lung. A right-sided pump returns its blood here, into the pulmonary artery, and its delivery goes to the lung, not to the body.',
      analogy:
        'The relay runner. The next leg cannot start until this one hands over, and a fast final runner cannot make up for a baton that never arrives.',
      checklist: [
        'the right atrial pressure against the wedge pressure',
        'the pulmonary pulsatility',
        'what the left heart is receiving',
      ],
      lookAt: ['right atrial pressure', 'wedge pressure', 'the pulmonary trace'],
      segmentIds: ['right-ventricle', 'pulmonary-artery', 'lungs'],
    },
    {
      id: 'left-ventricle',
      ordinal: 3,
      plainName: 'The left ventricle',
      whereYouAre:
        'You are in the left ventricle, the chamber most support is described as relieving.',
      whatADeviceDoesHere:
        'A transvalvular pump has its inlet here; a durable pump takes its inflow from the apex. Both draw volume out of this chamber directly. The balloon never touches it — it changes what the ventricle ejects against.',
      analogy:
        'The bucket that gets a helper. Relief is real only if the helper is actually lifting from this bucket, and it can be checked here, by what the chamber holds.',
      checklist: [
        'the wedge pressure',
        'the size of the ventricle',
        'whether the aortic valve still opens',
      ],
      lookAt: ['wedge pressure', 'left ventricular volume', 'aortic-valve opening'],
      segmentIds: ['left-atrium', 'left-ventricle'],
    },
    {
      id: 'aortic-valve',
      ordinal: 4,
      plainName: 'The aortic valve and the ascending aorta',
      whereYouAre:
        'You are at the doorway between the ventricle and the aorta, where blood leaves the heart.',
      whatADeviceDoesHere:
        'A transvalvular pump reaches through this valve, inlet below and outlet above; a durable pump returns its flow just beyond it. The balloon is timed to the moment this valve closes — the notch on the arterial trace.',
      analogy:
        'The doorway. A pump that reaches through it has to keep one end on each side, and the balloon has to wait until the door has shut.',
      checklist: [
        'the dicrotic notch and the assisted beat',
        'where the outlet returns blood',
        'whether the pump is still across the valve',
      ],
      lookAt: ['the arterial trace', 'the displayed pump flow'],
      segmentIds: ['aortic-valve', 'ascending-aorta'],
    },
    {
      id: 'aorta-and-body',
      ordinal: 5,
      plainName: 'The descending aorta and the body',
      whereYouAre:
        'You are downstream of the heart, in the aorta and the vessels every organ is fed from.',
      whatADeviceDoesHere:
        'The balloon sits here and displaces blood already in the vessel; it moves no stream of its own. Every pump ejects against the pressure in this place, and what reaches the organs is decided here, not on the console.',
      analogy:
        'The pipe downstream. It pushes back, and a pump that is asked for more against a stiffer pipe delivers less.',
      checklist: ['the mean pressure', 'the systemic resistance', 'what is reaching the organs'],
      lookAt: ['mean arterial pressure', 'effective systemic delivery', 'mixed venous saturation'],
      segmentIds: ['descending-aorta', 'systemic-bed'],
    },
  ],
  sourceIds: [
    'mcs-bedside-reference-supplied',
    'master-hemodynamics-reference',
    'mcs-educational-model-v1',
  ],
} as const satisfies McsSupportSpine

export const mcsSpineStopById: ReadonlyMap<McsSpineStopId, McsSpineStop> = new Map(
  MCS_SUPPORT_SPINE.stops.map((stop) => [stop.id, stop]),
)

export function mcsSpineStop(id: McsSpineStopId): McsSpineStop {
  const stop = mcsSpineStopById.get(id)
  if (!stop) throw new Error(`Unknown spine stop: ${id}`)
  return stop
}

/** The stops a set of segments belongs to, in path order. */
export function mcsSpineStopsForSegments(
  segmentIds: readonly McsMapSegmentId[],
): readonly McsSpineStop[] {
  return MCS_SUPPORT_SPINE.stops.filter((stop) =>
    stop.segmentIds.some((segment) => segmentIds.includes(segment)),
  )
}

export function validateMcsSupportSpine(spine: McsSupportSpine = MCS_SUPPORT_SPINE): string[] {
  const errors: string[] = []
  if (spine.stops.length !== mcsSpineStopIds.length) {
    errors.push(`the spine must have ${mcsSpineStopIds.length} stops, found ${spine.stops.length}`)
  }
  const seenSegments = new Set<string>()
  spine.stops.forEach((stop, index) => {
    if (stop.id !== mcsSpineStopIds[index]) {
      errors.push(`stop ${index + 1} is ${stop.id}, expected ${mcsSpineStopIds[index]}`)
    }
    if (stop.ordinal !== index + 1) errors.push(`${stop.id}: ordinal is not ${index + 1}`)
    if (stop.checklist.length === 0 || stop.checklist.length > 4) {
      errors.push(`${stop.id}: the checklist must hold one to four items`)
    }
    if (stop.segmentIds.length === 0) errors.push(`${stop.id}: names no segment on the map`)
    for (const segment of stop.segmentIds) {
      if (seenSegments.has(segment))
        errors.push(`${stop.id}: segment ${segment} belongs to two stops`)
      seenSegments.add(segment)
    }
    for (const [field, value] of Object.entries({
      plainName: stop.plainName,
      whereYouAre: stop.whereYouAre,
      whatADeviceDoesHere: stop.whatADeviceDoesHere,
      analogy: stop.analogy,
    })) {
      errors.push(...mcsLearnerCopyErrors(`${stop.id}.${field}`, value))
    }
    for (const item of [...stop.checklist, ...stop.lookAt]) {
      errors.push(...mcsLearnerCopyErrors(`${stop.id}.checklist`, item))
    }
  })
  for (const segment of mcsMapSegmentIds) {
    if (!seenSegments.has(segment)) errors.push(`segment ${segment} belongs to no stop`)
  }
  errors.push(...mcsLearnerCopyErrors('sentence', spine.sentence))
  if (spine.sourceIds.length === 0) errors.push('no sources')
  if (!mcsSourceIdsRegistered(spine.sourceIds)) errors.push('names a source that is not registered')
  return errors
}

const spineErrors = validateMcsSupportSpine()
if (spineErrors.length > 0) {
  throw new Error(`Invalid MCS support spine:\n- ${spineErrors.join('\n- ')}`)
}
