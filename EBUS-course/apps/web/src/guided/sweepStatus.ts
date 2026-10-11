/**
 * Where the learner is in the rotation sweep, in one heading and one sentence. Everything is read
 * from the `LinkedSweep` the workbench holds and the current frame; the wording is an instruction,
 * not a description of the sampler.
 */
import {
  LINKED_SWEEP_TOLERANCES,
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
