import type { ActivityStepperProps } from './ActivityStepper'
import { ActivityStepper } from './ActivityStepper'

/**
 * Semantic name used by the adaptive activity chrome. ActivityStepper remains
 * exported for compatibility with existing focused-module code and tests.
 */
export function ActivityProgressStepper(props: ActivityStepperProps) {
  return <ActivityStepper {...props} />
}
