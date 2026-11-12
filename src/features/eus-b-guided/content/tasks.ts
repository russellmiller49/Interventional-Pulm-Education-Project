import type { EusbObservation } from '@/lib/eus-b-guided-bridge'
import { eusbLab, type EusbLabId } from '@/lib/eus-b-guided-contract'
import { structureName } from './names'

export interface Requirement {
  id: string
  met: boolean
  /** The sentence the learner reads. */
  text: string
}

/**
 * What a lab asks for, as the list the learner reads.
 *
 * This list is the gate: `eusbTaskMet` is true exactly when every item on it is met, so the button
 * can never ask for something the list does not say. An observation from another lab, or from a
 * lab that is not ready, meets nothing.
 */
export function eusbRequirements(
  labId: EusbLabId,
  observation: EusbObservation | null | undefined,
): Requirement[] {
  const lab = eusbLab(labId)
  const live = observation && observation.labId === labId && observation.ready ? observation : null
  if ((lab.kind === 'reach' || lab.kind === 'rotate') && lab.target) {
    const target = live?.target
    return [
      {
        id: 'hold-' + lab.target,
        met: !!target && target.key === lab.target && target.found && !!target.foundAt,
        text: `Bring ${structureName(lab.target)} into the image and hold it for one second.`,
      },
    ]
  }
  return []
}

/** A lab with nothing to ask for is never "met": there is nothing to hold or to continue with. */
export function eusbTaskMet(labId: EusbLabId, observation: EusbObservation | null | undefined) {
  const list = eusbRequirements(labId, observation)
  return list.length > 0 && list.every((item) => item.met)
}

/** What the disabled button says it is waiting for. */
export function eusbOutstanding(labId: EusbLabId, observation: EusbObservation | null | undefined) {
  return eusbRequirements(labId, observation)
    .filter((item) => !item.met)
    .map((item) => item.text)
}
