/**
 * Truthful sweep status from genuine sampler state (EBUS-PRE-REVIEW-03, L3-6 / L12-4). Every
 * sentence here is derived from the `LinkedSweep` the workbench already holds, the last sampler
 * event, and the current frame's target visibility and contact index. Nothing is inferred from
 * pixels, nothing is seeded, and the counts are transient model samples, not a grade.
 */
import {
  LINKED_SWEEP_TOLERANCES,
  type LinkedSweep,
  type LinkedSweepEvent,
} from '../../../../../src/lib/ebus-linked-contract'

export interface SweepStatusInput {
  sweep: LinkedSweep | undefined
  /** Whether the current rendered frame (not necessarily a sampled one) shows the target. */
  targetVisible: boolean
  frameReady: boolean
  contact: number
  lastEvent: LinkedSweepEvent | null
  /** Sample counts at the moment of the last reset, so an early exit can say what it had. */
  lastResetProgress: { samples: number; span: number } | null
  targetName: string
}
export interface SweepStatus {
  state: 'complete' | 'crossing' | 'inside-start' | 'outside' | 'entered-too-fast' | 'no-window'
  heading: string
  inPlane: string
  waiting: string
  resetReason: string | null
  progress: { samples: number; minSamples: number; span: number; minSpanDeg: number } | null
}
const T = LINKED_SWEEP_TOLERANCES
export function describeLinkedSweep(input: SweepStatusInput): SweepStatus {
  const sweep = input.sweep
  const phase = sweep?.phase ?? 'find-edge'
  const inPlane = !input.frameReady
    ? `Rendering the current plane…`
    : input.targetVisible
      ? `${input.targetName} is in this plane now.`
      : `${input.targetName} is not in this plane now.`
  const resetReason = describeReset(input.lastEvent, input.lastResetProgress)
  if (input.frameReady && input.contact < T.minContact)
    return {
      state: 'no-window',
      heading: 'No acoustic window',
      inPlane,
      waiting: `The contact index is ${input.contact.toFixed(2)}, below the ${T.minContact} this exercise needs for a frame to count. Restore contact with the wall; the pass restarts from a plane without the target.`,
      resetReason,
      progress: null,
    }
  if (phase === 'complete')
    return {
      state: 'complete',
      heading: 'Sweep recorded',
      inPlane,
      waiting:
        'Return to a plane with the target visible and hold the acquisition in the lesson. This bounded sweep does not establish complete clinical survey coverage.',
      resetReason: null,
      progress: sweep
        ? { samples: sweep.samples, minSamples: T.minSamples, span: sweep.span, minSpanDeg: T.minSpanDeg }
        : null,
    }
  if (phase === 'crossing' && sweep) {
    const direction = sweep.direction > 0 ? 'increasing' : 'decreasing'
    const need: string[] = []
    if (sweep.samples < T.minSamples) need.push(`${T.minSamples - sweep.samples} more paused frame${T.minSamples - sweep.samples === 1 ? '' : 's'} with the target`)
    if (sweep.span < T.minSpanDeg) need.push(`${T.minSpanDeg - sweep.span}° more rotation`)
    return {
      state: 'crossing',
      heading: 'Crossing the target',
      inPlane,
      waiting:
        `Keep rotating with ${direction} angles in steps of ${T.maxStepDeg}° or less, pausing for each image. ` +
        (need.length
          ? `Still needed in this pass: ${need.join(' and ')}. Then keep going until the target leaves the sector on the far side.`
          : 'This pass has enough frames and rotation; the sweep records when the target leaves the sector on the far side.') +
        ' Reversing, or a step larger than ' +
        T.maxStepDeg +
        '°, restarts the pass.',
      resetReason,
      progress: { samples: sweep.samples, minSamples: T.minSamples, span: sweep.span, minSpanDeg: T.minSpanDeg },
    }
  }
  const outside = !!sweep?.outside
  if (input.lastEvent === 'entered-too-fast')
    return {
      state: 'entered-too-fast',
      heading: 'The target came into view too quickly',
      inPlane,
      waiting: `The step between the last two paused frames was larger than ${T.maxStepDeg}°, so this entry did not start a pass. Rotate back until the target leaves the sector, then come back in smaller steps.`,
      resetReason,
      progress: null,
    }
  if (outside || (input.frameReady && !input.targetVisible))
    return {
      state: 'outside',
      heading: 'Outside the target — ready to start a pass',
      inPlane,
      waiting: `Rotate slowly toward the target in steps of ${T.maxStepDeg}° or less, pausing for each image. The pass starts on the first paused frame that shows the target.`,
      resetReason,
      progress: null,
    }
  return {
    state: 'inside-start',
    heading: 'The target is already in this plane',
    inPlane,
    waiting:
      'A pass has to begin from a plane without the target, so frames here do not count yet. Rotate in small steps until the target leaves the sector, then sweep back across it in the other direction. From this start the nearest edge may be at either end of the rotation range.',
    resetReason,
    progress: null,
  }
}
function describeReset(
  event: LinkedSweepEvent | null,
  progress: { samples: number; span: number } | null,
): string | null {
  switch (event) {
    case 'reset-reversed':
      return 'The last pass was reset because the rotation direction reversed while crossing the target.'
    case 'reset-step':
      return `The last pass was reset because a step between paused frames was larger than ${T.maxStepDeg}°.`
    case 'reset-contact':
      return `The last pass was reset because the contact index fell below ${T.minContact} — no acoustic window.`
    case 'reset-early-exit':
      return progress
        ? `The last pass was reset because the target left the sector after ${progress.samples} paused frame${progress.samples === 1 ? '' : 's'} over ${progress.span}°; a pass needs ${T.minSamples} frames over ${T.minSpanDeg}°.`
        : `The last pass was reset because the target left the sector before ${T.minSamples} frames over ${T.minSpanDeg}° were collected.`
    default:
      return null
  }
}
/** Learner-facing description of the tolerances, kept beside the status so nothing is hidden. */
export const SWEEP_TOLERANCE_NOTE = `This exercise counts a pass when paused frames show the target at least ${T.minSamples} times across at least ${T.minSpanDeg}° of rotation, with steps of ${T.maxStepDeg}° or less and a contact index of at least ${T.minContact}, and the target then leaves the sector. These are authored exercise tolerances for this model, not clinical thresholds.`
