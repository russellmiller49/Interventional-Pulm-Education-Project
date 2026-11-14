/**
 * Where the learner is in the rotation sweep, in one heading and one sentence. Everything is read
 * from the `LinkedSweep` the workbench holds and the current frame; the wording is an instruction,
 * not a description of the sampler.
 */
import {
  LINKED_SWEEP_TOLERANCES,
  linkedLateralPosition,
  linkedOpticView,
  type LinkedLateralPosition,
  type LinkedSweep,
} from '../../../../../src/lib/ebus-linked-contract'

export interface SweepStatusInput {
  sweep: LinkedSweep | undefined
  /** Whether the current rendered frame shows the target. */
  targetVisible: boolean
  frameReady: boolean
  contact: number
  targetName: string
}
export interface SweepStatus {
  state: 'complete' | 'complete-off-target' | 'sweeping' | 'start' | 'no-window'
  heading: string
  next: string
  /** Degrees of rotation covered so far and needed, while the sweep is open. */
  progress: { span: number; minSpanDeg: number } | null
}
const T = LINKED_SWEEP_TOLERANCES
export function describeLinkedSweep(input: SweepStatusInput): SweepStatus {
  const sweep = input.sweep
  const name = input.targetName
  if (input.frameReady && input.contact < T.minContact)
    return {
      state: 'no-window',
      heading: 'No tissue contact',
      next: 'The transducer has lifted off the airway wall, so the image is empty. Restore contact, then keep rotating.',
      progress: null,
    }
  if (sweep?.phase === 'complete')
    return input.targetVisible || !input.frameReady
      ? {
          state: 'complete',
          heading: 'Sweep done',
          next: `${name} is in the image. Select “Continue with this image”.`,
          progress: null,
        }
      : {
          state: 'complete-off-target',
          heading: 'Sweep done',
          next: `Rotate back until ${lower(name)} is in the image, then continue with that image.`,
          progress: null,
        }
  const span = Math.round(sweep?.span ?? 0)
  const remaining = Math.max(0, T.minSpanDeg - span)
  const progress = { span, minSpanDeg: T.minSpanDeg }
  if (!sweep || sweep.lastRoll === null)
    return {
      state: 'start',
      heading: 'Rotate the scope',
      next: `Move the Scope rotation slider and watch the ultrasound image. Sweep through at least ${T.minSpanDeg}° and find ${lower(name)}.`,
      progress,
    }
  return {
    state: 'sweeping',
    heading: input.targetVisible ? `${name} is in the image` : `${name} is not in the image`,
    next:
      sweep.samples === 0
        ? `Keep rotating until ${lower(name)} comes into the image.`
        : remaining > 0
          ? `Keep rotating: ${remaining}° more to finish the sweep.`
          : `Keep rotating until ${lower(name)} comes into the image.`,
    progress,
  }
}
const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

/**
 * Where the node sits across the image during the advance-and-withdraw task, in one heading and
 * one sentence. It says where the node is, not which way to move: working out the direction from
 * the image is the task.
 */
export interface AlongAirwayStatus {
  state: LinkedLateralPosition | 'no-window' | 'pending'
  heading: string
  next: string
}
export function describeAlongAirway(input: {
  targetLateral: number | null | undefined
  frameReady: boolean
  contact: number
  targetName: string
}): AlongAirwayStatus {
  const name = input.targetName
  if (!input.frameReady)
    return { state: 'pending', heading: 'Updating the image', next: 'Wait for the ultrasound image.' }
  if (input.contact < T.minContact)
    return {
      state: 'no-window',
      heading: 'No tissue contact',
      next: 'The transducer has lifted off the airway wall, so the image is empty. Move the scope back to where the image returned.',
    }
  const position = linkedLateralPosition(input.targetLateral)
  if (position === 'centre')
    return {
      state: 'centre',
      heading: 'Node in the middle of the image',
      next: `${name} sits under the transducer. Select “Continue with this image”.`,
    }
  if (position === 'out')
    return {
      state: 'out',
      heading: 'Node not in the image',
      next: `The plane has slid past ${lower(name)}. Move the scope the other way along the airway to bring it back.`,
    }
  return {
    state: position,
    heading: position === 'left' ? 'Node left of the middle' : 'Node right of the middle',
    next: `Advance or withdraw with the Scope position slider until ${lower(name)} sits in the middle of the image.`,
  }
}

/**
 * The scope lesson's task on the forward-oblique lens: look along the airway, then bring the
 * image back. The first step latches once the lens has looked along the airway; the second is
 * the tip flexed up onto the wall with tissue echoes in the image.
 */
export interface AirwayViewStatus {
  state: 'pending' | 'find-airway' | 'airway' | 'find-wall' | 'wall'
  heading: string
  next: string
}
export function describeAirwayView(input: {
  opticalWallMm: number | null | undefined
  contact: number
  airwayViewed: boolean
  frameReady: boolean
}): AirwayViewStatus {
  if (!input.frameReady)
    return { state: 'pending', heading: 'Updating the image', next: 'Wait for the ultrasound image.' }
  const view = linkedOpticView(input.opticalWallMm, input.contact)
  if (view === 'lumen')
    return {
      state: 'airway',
      heading: 'Looking along the airway',
      next: 'The airway ahead is in the middle of the white-light view and the transducer is off the wall, so there is no ultrasound image. Now flex the tip up.',
    }
  if (!input.airwayViewed)
    return {
      state: 'find-airway',
      heading: 'Flex the tip down',
      next: 'Move Tip flexion until the airway ahead sits in the middle of the white-light view.',
    }
  if (view === 'wall')
    return {
      state: 'wall',
      heading: 'Transducer on the wall',
      next: 'The wall fills the white-light view and tissue echoes are back. Select “Continue with this image”.',
    }
  return {
    state: 'find-wall',
    heading: 'Flex the tip up',
    next: 'Keep flexing up until the wall fills the white-light view and tissue echoes return.',
  }
}
