import { MCS_AF_TRIGGER_LIMIT, mcsAfTriggerLimitApplies } from '../content/afTriggerLimit'
import type { McsSimulationState } from '../engine/types'

/**
 * The MCS-03 atrial-fibrillation trigger limitation, rendered beside the trigger selector.
 *
 * Presentation only: it reads the live rhythm and device, renders nothing otherwise, and never
 * dispatches, disables or gates anything. Both trigger selectors — the focused Learn task controls
 * and the full control panel used by the cases and the studio — render it, and give the selector an
 * `aria-describedby` pointing at it, so it is read out with the control and not only seen near it.
 *
 * It states the three things in order: what the simulation does, what the checked device labeling
 * says, and that the disagreement is held for review. It does not tell the learner which trigger to
 * pick, and every trigger stays selectable.
 */
export function McsAfTriggerLimit({
  state,
  id,
  className,
}: {
  readonly state: McsSimulationState
  readonly id?: string
  readonly className?: string
}) {
  if (!mcsAfTriggerLimitApplies(state)) return null
  return (
    <p id={id} className={className} data-af-trigger-limit>
      <strong>{MCS_AF_TRIGGER_LIMIT.heldLead}.</strong> {MCS_AF_TRIGGER_LIMIT.modelRating}{' '}
      {MCS_AF_TRIGGER_LIMIT.deviceLabeling} {MCS_AF_TRIGGER_LIMIT.atTheControl}
    </p>
  )
}
